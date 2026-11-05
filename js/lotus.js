// Wireframe lotus seen through a "machine-vision" lens: blob tracking, bounding boxes, HUD.
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export function lotusSVG(size = 20, stroke = "currentColor") {
  const petals = (n, len, w, rot) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 360 + rot;
    return `<path transform="rotate(${a} 50 50)" d="M50 50 C ${50 - w} ${50 - len * .45}, ${50 - w * .6} ${50 - len * .9}, 50 ${50 - len} C ${50 + w * .6} ${50 - len * .9}, ${50 + w} ${50 - len * .45}, 50 50Z"/>`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="${stroke}" stroke-width="3" aria-hidden="true">${petals(8, 44, 14, 22.5)}${petals(8, 32, 12, 0)}<circle cx="50" cy="50" r="7"/></svg>`;
}

export function mountLotus(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const label = opts.label || "PADMA // NELUMBO NUCIFERA";
  const tags = opts.tags || ["SARGA", "PRATISARGA", "VAMSHA", "MANVANTARA", "VAMSHANUCARITA", "DHARMA", "BHAKTI", "MOKSHA"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, raf = 0, alive = true, t0 = performance.now(), frame = 0;
  const mouse = { x: -1, y: -1, in: false };

  const layers = [
    { n: 8, len: 1.0, w: .30, rot: Math.PI / 8, sp: .05 },
    { n: 8, len: .78, w: .26, rot: 0, sp: -.04 },
    { n: 8, len: .55, w: .22, rot: Math.PI / 8, sp: .07 },
    { n: 5, len: .32, w: .2, rot: 0, sp: -.1 },
  ];
  // drifting "pollen" blobs with trails
  const motes = Array.from({ length: opts.motes ?? 14 }, (_, i) => ({
    id: 40 + i, a: Math.random() * Math.PI * 2, r: .35 + Math.random() * .9, s: (Math.random() - .5) * .12,
    wob: Math.random() * 10, trail: [],
  }));

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
  }

  function petal(cx, cy, ang, L, w) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u, v) => [cx + ca * v - sa * u, cy + sa * v + ca * u]; // u: across, v: along
    const [x0, y0] = P(0, 0), [x1, y1] = P(-w * L, L * .45), [x2, y2] = P(-w * .6 * L, L * .9), [xt, yt] = P(0, L);
    const [x3, y3] = P(w * .6 * L, L * .9), [x4, y4] = P(w * L, L * .45);
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x1, y1, x2, y2, xt, yt); ctx.bezierCurveTo(x3, y3, x4, y4, x0, y0); ctx.stroke();
    // midrib
    ctx.save(); ctx.globalAlpha *= .4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xt, yt); ctx.stroke(); ctx.restore();
    return [xt, yt];
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
    const s = getComputedStyle(document.documentElement);
    const ink = s.getPropertyValue("--ink").trim() || "#fff", bg = s.getPropertyValue("--bg").trim() || "#000";
    const t = (now - t0) / 1000; frame++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;
    const cx = W * (opts.cx ?? .5), cy = H * (opts.cy ?? .5), R = Math.min(W, H) * (opts.scale ?? (W < 520 ? .3 : .36));
    const breathe = 1 + Math.sin(t * .6) * .025;

    // concentric guide rings + ticks
    ctx.globalAlpha = .14;
    [1.12, 1.32].forEach(k => { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); });
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2 + t * .02, r1 = R * 1.32, r2 = r1 + (i % 6 ? 4 : 10);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    }

    // lotus
    const tips = [];
    layers.forEach((L, li) => {
      ctx.globalAlpha = .35 + li * .15;
      for (let i = 0; i < L.n; i++) {
        const ang = L.rot + i / L.n * Math.PI * 2 + t * L.sp * .2 - Math.PI / 2;
        const len = R * L.len * breathe * (1 + Math.sin(t * 1.3 + i + li) * .015);
        const tip = petal(cx, cy, ang, len, L.w);
        if (li < 2) tips.push({ x: tip[0], y: tip[1], id: li * 8 + i + 1 });
      }
    });
    ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(cx, cy, R * .09, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * .055, cy + Math.sin(a) * R * .055, 1.2, 0, Math.PI * 2); ctx.fill(); }

    // motes
    const blobs = [];
    motes.forEach(m => {
      m.a += m.s * .02; const r = R * (m.r + Math.sin(t * .5 + m.wob) * .05);
      const x = cx + Math.cos(m.a) * r * 1.35, y = cy + Math.sin(m.a) * r * .95 + Math.sin(t + m.wob) * 6;
      m.trail.push([x, y]); if (m.trail.length > 26) m.trail.shift();
      ctx.globalAlpha = .35; ctx.beginPath(); m.trail.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke();
      ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
      blobs.push({ x, y, id: m.id, mote: true });
    });

    // tracking boxes on petal tips (subset rotates over time)
    ctx.font = `10px ${MONO}`; ctx.textBaseline = "bottom";
    const active = tips.filter((_, i) => (i + Math.floor(t * .7)) % 3 === 0);
    [...active, ...blobs.filter((_, i) => i % 2 === 0)].forEach((b, i) => {
      const sz = b.mote ? 16 : 24 + (i % 3) * 6, conf = (.82 + ((b.id * 37 + Math.floor(t * 2)) % 17) / 100).toFixed(2);
      ctx.globalAlpha = .85; bracket(b.x - sz / 2, b.y - sz / 2, sz, sz, 5);
      ctx.globalAlpha = .7;
      ctx.fillText(`${b.mote ? "MOTE" : "PTL"}_${String(b.id).padStart(2, "0")} ${conf}`, b.x - sz / 2, b.y - sz / 2 - 3);
    });

    // connective mesh between nearby blobs
    ctx.globalAlpha = .12;
    const all = [...tips, ...blobs];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
      if (d < R * .45) { ctx.beginPath(); ctx.moveTo(all[i].x, all[i].y); ctx.lineTo(all[j].x, all[j].y); ctx.stroke(); }
    }

    // main object lock
    ctx.globalAlpha = .9; ctx.setLineDash([4, 4]);
    const bw = R * 2.3, bh = R * 2.3;
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh); ctx.setLineDash([]);
    bracket(cx - bw / 2 - 6, cy - bh / 2 - 6, bw + 12, bh + 12, 14);
    ctx.fillRect(cx - bw / 2 - 6, cy - bh / 2 - 24, ctx.measureText(label).width + 66, 16);
    ctx.fillStyle = bg; ctx.fillText(`${label}  ${(0.97 + Math.sin(t) * .02).toFixed(2)}`, cx - bw / 2, cy - bh / 2 - 11);
    ctx.fillStyle = ink;

    // labels orbiting
    ctx.globalAlpha = .55;
    tags.forEach((tg, i) => {
      const a = i / tags.length * Math.PI * 2 - t * .03, r = R * 1.5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = Math.cos(a) > 0 ? "left" : "right";
      ctx.fillText(tg, x + (Math.cos(a) > 0 ? 8 : -8), y + 4);
    });
    ctx.textAlign = "left";

    // mouse crosshair + nearest lock
    if (mouse.in) {
      ctx.globalAlpha = .35; ctx.beginPath();
      ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, H); ctx.moveTo(0, mouse.y); ctx.lineTo(W, mouse.y); ctx.stroke();
      let best = null, bd = 1e9; all.forEach(b => { const d = Math.hypot(b.x - mouse.x, b.y - mouse.y); if (d < bd) { bd = d; best = b; } });
      if (best && bd < 140) {
        ctx.globalAlpha = 1; ctx.lineWidth = 1.5; bracket(best.x - 20, best.y - 20, 40, 40, 8); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(best.x, best.y); ctx.stroke();
        ctx.fillText(`LOCK ▸ ${Math.round(best.x)},${Math.round(best.y)}`, best.x + 24, best.y - 8);
      }
    }

    // scanline
    const sy = (t * 60) % (H + 40) - 20;
    ctx.globalAlpha = .08; ctx.fillRect(0, sy, W, 2);

    // HUD corners
    ctx.globalAlpha = .7;
    ctx.fillText(W < 520 ? `FRM ${String(frame).padStart(6, "0")}` : `FRM ${String(frame).padStart(6, "0")}  ·  TRK ${active.length + Math.ceil(blobs.length / 2)}  ·  ${opts.code || "CAM_01 / TOP"}`, 14, 22);
    ctx.textAlign = "right";
    ctx.fillText(W < 520 ? (opts.mode || "BLOB_TRACK: BUSY") : `T+${t.toFixed(2)}s  ·  ${opts.mode || "BLOB_TRACK: BUSY"}`, W - 14, 22);
    ctx.fillText(`x ${mouse.in ? Math.round(mouse.x) : "---"}  y ${mouse.in ? Math.round(mouse.y) : "---"}`, W - 14, H - 10);
    ctx.textAlign = "left";
    ctx.fillText(`Σ ${tips.length} petals  ·  ${blobs.length} motes`, 14, H - 10);
    ctx.globalAlpha = 1;
  }

  function loop(now) { if (!alive) return; draw(now); raf = requestAnimationFrame(loop); }
  const ro = new ResizeObserver(() => { size(); if (reduce) draw(performance.now()); }); ro.observe(canvas);
  canvas.addEventListener("pointermove", e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = true; });
  canvas.addEventListener("pointerleave", () => { mouse.in = false; });
  size();
  if (reduce) draw(performance.now()); else raf = requestAnimationFrame(loop);
  return { destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); } };
}
