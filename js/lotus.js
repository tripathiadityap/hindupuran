// 3D wireframe lotus seen through a "machine-vision" lens: perspective, blob tracking, HUD.
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const D2R = Math.PI / 180;

export function lotusSVG(size = 20, stroke = "currentColor") {
  const petals = (n, len, w, rot) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 360 + rot;
    return `<path transform="rotate(${a} 50 50)" d="M50 50 C ${50 - w} ${50 - len * .45}, ${50 - w * .6} ${50 - len * .9}, 50 ${50 - len} C ${50 + w * .6} ${50 - len * .9}, ${50 + w} ${50 - len * .45}, 50 50Z"/>`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="${stroke}" stroke-width="3" aria-hidden="true">${petals(8, 44, 14, 22.5)}${petals(8, 32, 12, 0)}<circle cx="50" cy="50" r="7"/></svg>`;
}

// ── Geometry ─────────────────────────────────────────
// Each layer: count, length, open angle from vertical (deg), tip curl (deg), width, cup depth, angular offset.
const LAYERS = [
  { n: 8, L: 1.0, open: 84, curl: 62, w: .34, cup: .5, off: 22.5 },
  { n: 8, L: .92, open: 58, curl: 44, w: .32, cup: .55, off: 0 },
  { n: 8, L: .8, open: 34, curl: 26, w: .3, cup: .6, off: 22.5 },
  { n: 6, L: .62, open: 14, curl: 10, w: .3, cup: .6, off: 0 },
];
const U = 14; // samples along a petal

function petalMesh(layer, theta) {
  // integrate the spine in the (r, y) plane
  const spine = [[0, 0, 0]]; // r, y, angle
  let r = .1, y = .02;
  const ds = layer.L / U;
  for (let i = 1; i <= U; i++) {
    const u = i / U, a = (layer.open - layer.curl * Math.pow(u, 1.6)) * D2R;
    r += Math.sin(a) * ds; y += Math.cos(a) * ds;
    spine.push([r, y, a]);
  }
  spine[0] = [.1, .02, layer.open * D2R];
  const width = u => layer.L * layer.w * Math.pow(Math.sin(Math.PI * Math.pow(u, .75)), .9);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const P = (i, v) => {
    const [sr, sy, a] = spine[i], u = i / U, w = width(u);
    const nr = -Math.cos(a), ny = Math.sin(a); // inward/up normal
    const lift = layer.cup * v * v * w;
    const rr = sr + nr * lift, yy = sy + ny * lift, x = v * w;
    return [rr * ct - x * st, yy, rr * st + x * ct];
  };
  const left = [], right = [], mid = [], ribs = [];
  for (let i = 0; i <= U; i++) { left.push(P(i, -1)); right.push(P(i, 1)); mid.push(P(i, 0)); }
  for (const i of [4, 8, 11]) { const rib = []; for (let k = -4; k <= 4; k++) rib.push(P(i, k / 4)); ribs.push(rib); }
  return { outline: [...left, ...right.slice().reverse()], mid, ribs, tip: mid[U] };
}

function buildLotus() {
  const petals = [];
  LAYERS.forEach((layer, li) => {
    for (let i = 0; i < layer.n; i++) {
      const theta = (i / layer.n) * Math.PI * 2 + layer.off * D2R + li * .07;
      petals.push({ li, id: li * 8 + i + 1, ...petalMesh(layer, theta) });
    }
  });
  // seed pod: frustum with seed dots on top
  const pod = [], seeds = [];
  for (const [rad, yy] of [[.1, .05], [.17, .28], [.2, .34]]) {
    const ring = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; ring.push([Math.cos(a) * rad, yy, Math.sin(a) * rad]); } pod.push(ring);
  }
  seeds.push([0, .345, 0]);
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; seeds.push([Math.cos(a) * .11, .345, Math.sin(a) * .11]); }
  // stamens: short filaments around the pod
  const stamens = [];
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * Math.PI * 2, r0 = .17, r1 = .27 + (k % 3) * .02;
    stamens.push([[Math.cos(a) * r0, .2, Math.sin(a) * r0], [Math.cos(a) * r1, .38 + (k % 2) * .04, Math.sin(a) * r1]]);
  }
  return { petals, pod, seeds, stamens };
}

// ── Mount ────────────────────────────────────────────
export function mountLotus(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const minimal = !!opts.minimal;
  const label = opts.label || "PADMA // NELUMBO NUCIFERA";
  const tags = opts.tags || ["SARGA", "PRATISARGA", "VAMSHA", "MANVANTARA", "VAMSHANUCARITA", "DHARMA", "BHAKTI", "MOKSHA"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const geo = buildLotus();
  let W = 0, H = 0, dpr = 1, raf = 0, alive = true, frame = 0, last = performance.now(), t = 0;
  const cam = { yaw: opts.yaw ?? .4, pitch: opts.pitch ?? 26 * D2R, vyaw: 0, vpitch: 0 };
  const mouse = { x: -1, y: -1, in: false };
  let drag = null, visible = true;

  const motes = Array.from({ length: minimal ? 0 : (opts.motes ?? 14) }, (_, i) => ({
    id: 40 + i, a: Math.random() * Math.PI * 2, r: .7 + Math.random() * .7, y: .1 + Math.random() * .9,
    s: (.15 + Math.random() * .25) * (Math.random() < .5 ? -1 : 1), wob: Math.random() * 10, trail: [],
  }));

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
  }

  function bracket(x, y, w, h, c = 6) {
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
    ctx.stroke();
  }

  function draw(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now; t += dt; frame++;
    const s = getComputedStyle(document.documentElement);
    const ink = s.getPropertyValue("--ink").trim() || "#fff", bg = s.getPropertyValue("--bg").trim() || "#000";

    if (!drag) {
      cam.yaw += (opts.spin ?? .18) * dt + cam.vyaw; cam.vyaw *= .94;
      cam.pitch += cam.vpitch; cam.vpitch *= .9;
      cam.pitch += ((opts.pitch ?? 26 * D2R) - cam.pitch) * .01;
    }
    cam.pitch = Math.max(-5 * D2R, Math.min(80 * D2R, cam.pitch));

    const cx = W * (opts.cx ?? .5), cy = H * (opts.cy ?? .58);
    const S = Math.min(W, H) * (opts.scale ?? (W < 520 ? .4 : .44));
    const cy_ = Math.cos(cam.yaw), sy_ = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const breathe = 1 + Math.sin(t * .7) * .02;
    const proj = ([x, y, z]) => {
      x *= breathe; z *= breathe; y = y * breathe - .25;
      const x1 = x * cy_ - z * sy_, z1 = x * sy_ + z * cy_;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const p = 3.2 / (3.2 + z2);
      return [cx + x1 * S * p, cy - y2 * S * p, z2, p];
    };
    const depthA = z => Math.max(.12, Math.min(1, .62 - z * .45));
    const line = (pts, closed) => {
      const q = pts.map(proj); let zsum = 0;
      ctx.beginPath(); q.forEach(([x, y, z], i) => { zsum += z; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (closed) ctx.closePath();
      return { q, z: zsum / q.length };
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;

    // water: concentric ripples on the y=0 plane
    for (let k = 1; k <= (minimal ? 3 : 6); k++) {
      const rad = (k * .32 + (t * .08) % .32) * 1.0, ring = [];
      for (let a = 0; a <= 48; a++) ring.push([Math.cos(a / 48 * Math.PI * 2) * rad, -.02, Math.sin(a / 48 * Math.PI * 2) * rad]);
      ctx.globalAlpha = .16 * (1 - rad / 2.1); line(ring, true); ctx.stroke();
    }
    // stem shadow axis
    ctx.globalAlpha = .2; line([[0, -.02, 0], [0, .05, 0]]); ctx.stroke();

    // petals, back to front
    const drawn = geo.petals.map(p => ({ p, z: proj(p.tip)[2] })).sort((a, b) => b.z - a.z);
    for (const { p } of drawn) {
      const ql = p.outline.map(proj), z = ql.reduce((a, q) => a + q[2], 0) / ql.length;
      ctx.beginPath(); ql.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.globalAlpha = .9; ctx.fillStyle = bg; ctx.fill(); // occlusion
      ctx.globalAlpha = depthA(z) + .15; ctx.stroke();
      ctx.globalAlpha = depthA(z) * .5; line(p.mid); ctx.stroke();
      if (!minimal || p.li < 2) { ctx.globalAlpha = depthA(z) * .32; p.ribs.forEach(r => { line(r); ctx.stroke(); }); }
    }
    ctx.fillStyle = ink;
    // stamens + pod
    ctx.globalAlpha = .55; geo.stamens.forEach(sg => { line(sg); ctx.stroke(); });
    geo.pod.forEach((ring, i) => { ctx.globalAlpha = .5 + i * .2; line(ring, true); if (i === 2) { ctx.globalAlpha = .9; ctx.fillStyle = bg; ctx.fill(); ctx.fillStyle = ink; } ctx.stroke(); });
    ctx.globalAlpha = .9; geo.seeds.forEach(sd => { const [x, y, , p] = proj(sd); ctx.beginPath(); ctx.arc(x, y, 2.2 * p, 0, Math.PI * 2); ctx.stroke(); });

    if (minimal) {
      // a single calm lock on the nearest outer tip
      const front = geo.petals.filter(p => p.li === 0).map(p => proj(p.tip)).sort((a, b) => a[2] - b[2])[0];
      ctx.globalAlpha = .7; bracket(front[0] - 14, front[1] - 14, 28, 28, 5);
      ctx.globalAlpha = .5; ctx.font = `10px ${MONO}`; ctx.textBaseline = "bottom"; ctx.fillText(opts.code || "PADMA", front[0] - 14, front[1] - 18);
      ctx.globalAlpha = 1; return;
    }

    // motes in 3D with trails
    const blobs = [];
    motes.forEach(m => {
      m.a += m.s * dt;
      const pos = [Math.cos(m.a) * m.r * 1.2, m.y + Math.sin(t * .8 + m.wob) * .08, Math.sin(m.a) * m.r * 1.2];
      const [x, y, z, p] = proj(pos);
      m.trail.push([x, y]); if (m.trail.length > 24) m.trail.shift();
      ctx.globalAlpha = .3 * depthA(z); ctx.beginPath(); m.trail.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke();
      ctx.globalAlpha = depthA(z) + .2; ctx.beginPath(); ctx.arc(x, y, 1.8 * p, 0, Math.PI * 2); ctx.fill();
      blobs.push({ x, y, z, id: m.id, mote: true });
    });

    // tracked petal tips (outer two layers), rotating subset
    const tips = geo.petals.filter(p => p.li < 2).map(p => { const [x, y, z] = proj(p.tip); return { x, y, z, id: p.id }; });
    ctx.font = `10px ${MONO}`; ctx.textBaseline = "bottom";
    const active = tips.filter((b, i) => b.z < .2 && (i + Math.floor(t * .7)) % 2 === 0);
    [...active, ...blobs.filter((_, i) => i % 2 === 0)].forEach((b, i) => {
      const sz = b.mote ? 16 : 22 + (i % 3) * 6, conf = (.82 + ((b.id * 37 + Math.floor(t * 2)) % 17) / 100).toFixed(2);
      ctx.globalAlpha = .85; bracket(b.x - sz / 2, b.y - sz / 2, sz, sz, 5);
      ctx.globalAlpha = .7; ctx.fillText(`${b.mote ? "MOTE" : "PTL"}_${String(b.id).padStart(2, "0")} ${conf} z${b.z.toFixed(2)}`, b.x - sz / 2, b.y - sz / 2 - 3);
    });
    // mesh between nearby blobs
    const all = [...tips, ...blobs];
    ctx.globalAlpha = .1;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      if (Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) < S * .38) { ctx.beginPath(); ctx.moveTo(all[i].x, all[i].y); ctx.lineTo(all[j].x, all[j].y); ctx.stroke(); }
    }

    // 3D bounding box of the flower (projected cube)
    const B = 1.25, cube = [];
    for (const x of [-B, B]) for (const y of [-.02, 1.15]) for (const z of [-B, B]) cube.push(proj([x, y, z]));
    ctx.globalAlpha = .22; ctx.setLineDash([3, 4]);
    [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(cube[a][0], cube[a][1]); ctx.lineTo(cube[b][0], cube[b][1]); ctx.stroke();
    });
    ctx.setLineDash([]);
    // 2D lock box from the cube's extent
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    cube.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    ctx.globalAlpha = .9; bracket(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12, 14);
    const tag = `${label}  ${(0.97 + Math.sin(t) * .02).toFixed(2)}`;
    ctx.fillRect(x0 - 6, y0 - 24, ctx.measureText(tag).width + 12, 16);
    ctx.fillStyle = bg; ctx.fillText(tag, x0, y0 - 11); ctx.fillStyle = ink;

    // orbiting tags in 3D
    tags.forEach((tg, i) => {
      const a = i / tags.length * Math.PI * 2 + t * .05;
      const [x, y, z] = proj([Math.cos(a) * 1.75, .5 + Math.sin(a * 2) * .1, Math.sin(a) * 1.75]);
      ctx.globalAlpha = depthA(z) * .8;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(tg, x + 7, y + 4);
    });

    // mouse crosshair + nearest lock
    if (mouse.in && !drag) {
      ctx.globalAlpha = .3; ctx.beginPath();
      ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, H); ctx.moveTo(0, mouse.y); ctx.lineTo(W, mouse.y); ctx.stroke();
      let best = null, bd = 1e9; all.forEach(b => { const d = Math.hypot(b.x - mouse.x, b.y - mouse.y); if (d < bd) { bd = d; best = b; } });
      if (best && bd < 140) {
        ctx.globalAlpha = 1; ctx.lineWidth = 1.5; bracket(best.x - 20, best.y - 20, 40, 40, 8); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(best.x, best.y); ctx.stroke();
        ctx.fillText(`LOCK ▸ ${best.mote ? "MOTE" : "PTL"}_${best.id}`, best.x + 24, best.y - 8);
      }
    }

    // scanline
    ctx.globalAlpha = .08; ctx.fillRect(0, (t * 60) % (H + 40) - 20, W, 2);

    // HUD corners
    ctx.globalAlpha = .7; ctx.textAlign = "left";
    ctx.fillText(W < 520 ? `FRM ${String(frame).padStart(6, "0")}` : `FRM ${String(frame).padStart(6, "0")}  ·  TRK ${active.length + Math.ceil(blobs.length / 2)}  ·  ${opts.code || "CAM_01 / ORBIT"}`, 14, 22);
    ctx.textAlign = "right";
    const hud = opts.mode || "BLOB_TRACK: BUSY";
    ctx.fillText(W < 520 ? hud : `YAW ${((cam.yaw / D2R) % 360).toFixed(1)}°  PITCH ${(cam.pitch / D2R).toFixed(1)}°  ·  ${hud}`, W - 14, 22);
    ctx.fillText(drag ? "ORBIT ▸ MANUAL" : "DRAG TO ORBIT", W - 14, H - 10);
    ctx.textAlign = "left";
    ctx.fillText(`Σ ${geo.petals.length} petals · ${blobs.length} motes · 3D`, 14, H - 10);
    ctx.globalAlpha = 1;
  }

  function loop(now) { if (!alive) return; if (visible) draw(now); raf = requestAnimationFrame(loop); }

  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", e => { const [x, y] = local(e); drag = { x, y }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    const [x, y] = local(e); mouse.x = x; mouse.y = y; mouse.in = true;
    if (drag) { cam.yaw += (x - drag.x) * .008; cam.pitch += (y - drag.y) * .006; cam.vyaw = (x - drag.x) * .002; drag = { x, y }; }
  });
  const end = () => { drag = null; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { mouse.in = false; });

  const ro = new ResizeObserver(() => { size(); if (reduce) draw(performance.now()); }); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);
  size();
  if (reduce) draw(performance.now()); else raf = requestAnimationFrame(loop);
  return { destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); } };
}
