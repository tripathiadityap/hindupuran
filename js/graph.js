// Minimal force-directed knowledge graph on <canvas>. No dependencies.
import { PURANAS, STORIES, DEITIES, THEMES } from "./data.js";

export function buildGraph() {
  const nodes = [], links = [], byId = new Map();
  const add = (id, label, kind, extra = {}) => {
    if (byId.has(id)) return byId.get(id);
    const n = { id, label, kind, x: (Math.random() - .5) * 600, y: (Math.random() - .5) * 600, vx: 0, vy: 0, deg: 0, ...extra };
    nodes.push(n); byId.set(id, n); return n;
  };
  const link = (a, b) => { links.push({ s: a, t: b }); a.deg++; b.deg++; };

  for (const p of PURANAS) {
    const pn = add("p:" + p.id, p.name.replace(" Purāṇa", ""), "purana", { ref: p });
    p.deities.forEach(d => link(pn, add("d:" + d, DEITIES[d], "deity")));
    p.themes.forEach(t => link(pn, add("t:" + t, THEMES[t].label, "theme", { ref: THEMES[t] })));
    p.stories.forEach(s => link(pn, add("s:" + s, STORIES[s].title, "story", { ref: STORIES[s] })));
  }
  return { nodes, links, byId };
}

export function mountGraph(container, { onSelect, colors }) {
  const canvas = document.createElement("canvas");
  container.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const { nodes, links } = buildGraph();
  const neighbors = new Map(nodes.map(n => [n, new Set()]));
  links.forEach(l => { neighbors.get(l.s).add(l.t); neighbors.get(l.t).add(l.s); });

  let W = 0, H = 0, dpr = 1;
  const view = { x: 0, y: 0, k: 1 };
  let hover = null, selected = null, drag = null, pan = null, alpha = 1, raf = 0, alive = true;

  const radius = n => n.kind === "purana" ? 5 + Math.sqrt(n.ref.verses) / 32 : n.kind === "deity" ? 6 + n.deg * .35 : n.kind === "theme" ? 4 + n.deg * .3 : 3.5;

  function resize() {
    const r = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    view.k = Math.min(W, H) / 900;
    view.x = W / 2 + (W > 720 ? 80 : 0); view.y = H / 2 + (W > 720 ? 0 : 40);
    alpha = Math.max(alpha, .3); kick();
  }

  function tick() {
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1;
        if (d2 > 160000) continue;
        const f = 2600 / d2 * alpha, d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
      }
    }
    for (const l of links) {
      const a = l.s, b = l.t, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const target = a.kind === "purana" && b.kind === "story" ? 80 : 150;
      const f = (d - target) / d * .02 * alpha;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const p of nodes) {
      p.vx -= p.x * .004 * alpha; p.vy -= p.y * .004 * alpha;
      if (p === drag?.node) { p.vx = p.vy = 0; continue; }
      p.vx *= .82; p.vy *= .82; p.x += p.vx; p.y += p.vy;
    }
    alpha = Math.max(alpha * .992, 0);
  }

  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  let frame = 0, mouse = null;
  const code = n => n.kind === "purana" ? "P" + String(n.ref.n).padStart(2, "0") : n.kind === "deity" ? "D" : n.kind === "theme" ? "T" : "S";
  function bracket(x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
    ctx.stroke();
  }
  function shape(n, r) {
    ctx.beginPath();
    if (n.kind === "purana" && n.ref.guna === "rajasic") ctx.rect(n.x - r * .85, n.y - r * .85, r * 1.7, r * 1.7);
    else if (n.kind === "purana" && n.ref.guna === "tamasic") { ctx.moveTo(n.x, n.y - r * 1.15); ctx.lineTo(n.x + r * 1.15, n.y); ctx.lineTo(n.x, n.y + r * 1.15); ctx.lineTo(n.x - r * 1.15, n.y); ctx.closePath(); }
    else if (n.kind === "deity") ctx.rect(n.x - r * .7, n.y - r * .7, r * 1.4, r * 1.4);
    else ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  }

  function draw() {
    const c = colors(); frame++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // screen-space grid
    ctx.strokeStyle = c.line; ctx.globalAlpha = .5; ctx.lineWidth = 1;
    const gs = 48 * view.k, ox = view.x % gs, oy = view.y % gs;
    ctx.beginPath();
    for (let x = ox; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = oy; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
    const focus = selected || hover;
    const near = focus ? neighbors.get(focus) : null;
    const lit = n => !focus || n === focus || near.has(n);
    const px = 1 / view.k;

    ctx.lineWidth = px;
    for (const l of links) {
      const on = focus && (l.s === focus || l.t === focus);
      ctx.strokeStyle = on ? c.ink : c.muted;
      ctx.globalAlpha = focus ? (on ? .85 : .06) : .22;
      if (on) ctx.setLineDash([3 * px, 3 * px]);
      ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const n of nodes) {
      const r = radius(n);
      ctx.globalAlpha = lit(n) ? 1 : .15;
      shape(n, r);
      if (n.kind === "purana" || n.kind === "deity") { ctx.fillStyle = c.ink; ctx.fill(); }
      else if (n.kind === "theme") { ctx.fillStyle = c.bg; ctx.fill(); ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2 * px; ctx.stroke(); }
      else { ctx.fillStyle = c.ink2; ctx.fill(); }
      if (n.kind === "purana") { // tracking bracket
        ctx.strokeStyle = c.ink; ctx.lineWidth = px; ctx.globalAlpha = lit(n) ? .6 : .1;
        const b = r + 6; bracket(n.x - b, n.y - b, b * 2, b * 2, 4 * px + 2);
      }
    }
    // labels
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const n of nodes) {
      const show = n.kind === "purana" || n.kind === "deity" || (focus && lit(n)) || view.k > 1.4;
      if (!show) continue;
      ctx.globalAlpha = lit(n) ? (n.kind === "story" ? .8 : 1) : .12;
      const size = (n.kind === "purana" ? 11 : 10) / Math.max(view.k, .6);
      ctx.font = `${n.kind === "purana" ? 500 : 400} ${size}px ${MONO}`;
      ctx.fillStyle = n.kind === "story" ? c.ink2 : c.ink;
      const txt = n.kind === "purana" ? `${code(n)} ${n.label.toUpperCase()}` : n.kind === "deity" ? n.label.toUpperCase() : n.label;
      ctx.fillText(txt, n.x + radius(n) + 9 * px + 2, n.y);
    }
    // focus: lock box around cluster
    if (focus) {
      const pts = [focus, ...near];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      const pad = 26 * px;
      ctx.globalAlpha = .7; ctx.strokeStyle = c.ink; ctx.lineWidth = px; ctx.setLineDash([5 * px, 4 * px]);
      ctx.strokeRect(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.lineWidth = 1.5 * px;
      const fr = radius(focus) + 12; bracket(focus.x - fr, focus.y - fr, fr * 2, fr * 2, 7);
      const tag = `LOCK ${code(focus)} · n=${near.size} · conf ${(0.9 + (focus.deg % 9) / 100).toFixed(2)}`;
      ctx.font = `${10 * px}px ${MONO}`; ctx.textBaseline = "bottom";
      const tw = ctx.measureText(tag).width;
      ctx.fillStyle = c.ink; ctx.fillRect(x0 - pad, y0 - pad - 15 * px, tw + 10 * px, 15 * px);
      ctx.fillStyle = c.bg; ctx.fillText(tag, x0 - pad + 5 * px, y0 - pad - 3 * px);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // crosshair + HUD
    ctx.font = `10px ${MONO}`; ctx.fillStyle = c.ink; ctx.strokeStyle = c.ink; ctx.lineWidth = 1;
    if (mouse) {
      ctx.globalAlpha = .25; ctx.beginPath();
      ctx.moveTo(mouse[0], 0); ctx.lineTo(mouse[0], H); ctx.moveTo(0, mouse[1]); ctx.lineTo(W, mouse[1]); ctx.stroke();
      ctx.globalAlpha = .7; ctx.textBaseline = "top"; ctx.textAlign = "left";
      const w = toWorld(mouse[0], mouse[1]);
      ctx.fillText(`${w.x.toFixed(0)}, ${w.y.toFixed(0)}`, mouse[0] + 8, mouse[1] + 8);
    }
    ctx.globalAlpha = .6; ctx.textBaseline = "bottom";
    ctx.textAlign = "left"; ctx.fillText(`NODES ${nodes.length} · EDGES ${links.length} · ZOOM ${view.k.toFixed(2)}x`, 16, H - 12);
    ctx.textAlign = "right"; ctx.fillText(`GRAPH_TRACK: ${alpha > .01 ? "SETTLING" : "STABLE"} · FRM ${String(frame).padStart(5, "0")}`, W - 16, H - 12);
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }

  function loop() {
    if (!alive) return;
    if (alpha > .002) tick();
    draw();
    raf = alpha > .002 || drag || pan || mouse ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  const toWorld = (px, py) => ({ x: (px - view.x) / view.k, y: (py - view.y) / view.k });
  function pick(px, py) {
    const p = toWorld(px, py);
    let best = null, bd = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y), r = radius(n) + 6 / view.k;
      if (d < r && d < bd) { best = n; bd = d; }
    }
    return best;
  }
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = local(e), n = pick(x, y);
    if (n) drag = { node: n, moved: false, sx: x, sy: y };
    else pan = { x, y, vx: view.x, vy: view.y, moved: false };
    canvas.style.cursor = "grabbing"; kick();
  });
  canvas.addEventListener("pointermove", e => {
    const [x, y] = local(e);
    mouse = [x, y];
    if (drag) {
      if (Math.hypot(x - drag.sx, y - drag.sy) > 3) drag.moved = true;
      const p = toWorld(x, y); drag.node.x = p.x; drag.node.y = p.y; alpha = Math.max(alpha, .25);
    } else if (pan) {
      if (Math.hypot(x - pan.x, y - pan.y) > 3) pan.moved = true;
      view.x = pan.vx + x - pan.x; view.y = pan.vy + y - pan.y;
    } else {
      const n = pick(x, y);
      if (n !== hover) { hover = n; canvas.style.cursor = n ? "pointer" : "grab"; kick(); }
    }
    kick();
  });
  const up = () => {
    if (drag && !drag.moved) { selected = drag.node; onSelect(selected); }
    else if (pan && !pan.moved) { selected = null; onSelect(null); }
    drag = pan = null; canvas.style.cursor = hover ? "pointer" : "grab"; kick();
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", () => { mouse = null; if (!drag && !pan && hover) hover = null; kick(); });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const [x, y] = local(e), k = Math.min(4, Math.max(.3, view.k * Math.exp(-e.deltaY * .0015)));
    view.x = x - (x - view.x) * k / view.k; view.y = y - (y - view.y) * k / view.k; view.k = k; kick();
  }, { passive: false });

  const ro = new ResizeObserver(resize); ro.observe(container);
  for (let i = 0; i < 260; i++) tick();
  alpha = .35; resize();

  return {
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); },
    select(id) { const n = nodes.find(n => n.id === id); selected = n || null; onSelect(selected); kick(); },
    redraw: kick,
  };
}
