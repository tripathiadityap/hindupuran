// Ambient rāga engine — synthesised live with the Web Audio API.
// No samples or recordings are used: a tanpura drone, a breathy flute and temple bells,
// all generated in the browser, so there is nothing under copyright.

const RAGAS = {
  bhupali: { name: "Bhūpālī", mood: "Dawn · serene", steps: [0, 2, 4, 7, 9] },
  bhairavi: { name: "Bhairavī", mood: "Reflective · devotional", steps: [0, 1, 3, 5, 7, 8, 10] },
  malkauns: { name: "Mālkauns", mood: "Night · deep", steps: [0, 3, 5, 8, 10] },
  yaman: { name: "Yaman", mood: "Evening · luminous", steps: [0, 2, 4, 6, 7, 9, 11] },
};
const SA = 138.59; // C#3
const hz = semi => SA * Math.pow(2, semi / 12);

let ctx, master, wet, dry, playing = false, raga = "bhupali", timers = [], listeners = new Set();

function impulse(seconds = 4.5) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

function init() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  const verb = ctx.createConvolver(); verb.buffer = impulse();
  wet = ctx.createGain(); wet.gain.value = .55; dry = ctx.createGain(); dry.gain.value = .6;
  wet.connect(verb).connect(master); dry.connect(master); master.connect(comp).connect(ctx.destination);
}
const out = node => { node.connect(dry); node.connect(wet); };

// Tanpura pluck: bright saw, jawari-like shimmer from a moving bandpass, long decay.
function pluck(freq, when) {
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.setValueAtTime(2400, when); lp.frequency.exponentialRampToValueAtTime(500, when + 4);
  bp.type = "bandpass"; bp.Q.value = 6; bp.frequency.setValueAtTime(freq * 6, when); bp.frequency.exponentialRampToValueAtTime(freq * 2, when + 3.5);
  const bpg = ctx.createGain(); bpg.gain.value = .5;
  [-4, 0, 4].forEach(dt => {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = dt;
    o.connect(lp); o.connect(bp); o.start(when); o.stop(when + 5.5);
  });
  bp.connect(bpg).connect(g); lp.connect(g);
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(.05, when + .02); g.gain.exponentialRampToValueAtTime(.0008, when + 5.2);
  out(g);
}

// Bansuri-like flute: sine + soft triangle, vibrato, breath noise, glide (meend) into the note.
function flute(freq, when, dur, from) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
  o.type = "sine"; o2.type = "triangle";
  if (from) { o.frequency.setValueAtTime(from, when); o.frequency.exponentialRampToValueAtTime(freq, when + .35); }
  else o.frequency.setValueAtTime(freq, when);
  o2.frequency.value = freq * 2;
  vib.frequency.value = 4.8; vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(freq * .008, when + dur * .6);
  vib.connect(vg); vg.connect(o.frequency);
  const g2 = ctx.createGain(); g2.gain.value = .12; o2.connect(g2).connect(g); o.connect(g);
  // breath
  const n = ctx.createBufferSource(), nb = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = nb; const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = freq * 3; nf.Q.value = 2;
  const ng = ctx.createGain(); ng.gain.value = .018; n.connect(nf).connect(ng).connect(g);
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(.07, when + .25);
  g.gain.setValueAtTime(.07, when + dur - .5); g.gain.exponentialRampToValueAtTime(.0005, when + dur + .4);
  [o, o2, vib, n].forEach(x => { x.start(when); x.stop(when + dur + .5); });
  out(g);
}

// Temple bell: inharmonic partials.
function bell(when) {
  const f = hz(24 + [0, 7, 12][Math.floor(Math.random() * 3)]);
  [[1, .05], [2.76, .025], [5.4, .012], [8.93, .006]].forEach(([m, a]) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * m;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(a, when + .005); g.gain.exponentialRampToValueAtTime(.0001, when + 7 / m + 1);
    o.connect(g); out(g); o.start(when); o.stop(when + 9);
  });
}

function schedule(fn, ms) { const id = setTimeout(() => { if (playing) fn(); }, ms); timers.push(id); }

function tanpuraLoop() {
  const t = ctx.currentTime + .05, step = 1.15;
  [-5, 0, 0, -12].forEach((s, i) => pluck(hz(s), t + i * step));
  schedule(tanpuraLoop, step * 4 * 1000);
}

let deg = 0;
function melodyLoop() {
  const steps = RAGAS[raga].steps, t = ctx.currentTime + .1;
  const phrase = 2 + Math.floor(Math.random() * 4);
  let at = t, prev = null;
  for (let i = 0; i < phrase; i++) {
    deg = Math.max(-2, Math.min(steps.length + 2, deg + [-1, -1, 1, 1, 0, 2, -2][Math.floor(Math.random() * 7)]));
    const oct = Math.floor(deg / steps.length), idx = ((deg % steps.length) + steps.length) % steps.length;
    const f = hz(12 + steps[idx] + oct * 12), dur = 1.2 + Math.random() * 2.2;
    flute(f, at, dur, prev && Math.random() < .5 ? prev : null);
    prev = f; at += dur * .9;
  }
  if (Math.random() < .25) { deg = 0; flute(hz(12), at, 3.5, prev); at += 3.5; }
  schedule(melodyLoop, (at - ctx.currentTime + 2 + Math.random() * 5) * 1000);
}
function bellLoop() { bell(ctx.currentTime + .05); schedule(bellLoop, 14000 + Math.random() * 16000); }

export const audio = {
  ragas: RAGAS,
  get playing() { return playing; },
  get raga() { return raga; },
  onChange(fn) { listeners.add(fn); },
  setRaga(r) { if (RAGAS[r] && r !== raga) { raga = r; deg = 0; listeners.forEach(f => f()); } },
  async start() {
    if (!ctx) init();
    await ctx.resume(); if (playing) return;
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(.9, ctx.currentTime + 3);
    tanpuraLoop(); schedule(melodyLoop, 4000); schedule(bellLoop, 2000);
    listeners.forEach(f => f());
  },
  stop() {
    if (!playing) return;
    playing = false; timers.forEach(clearTimeout); timers = [];
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    listeners.forEach(f => f());
  },
  toggle() { return playing ? this.stop() : this.start(); },
};
