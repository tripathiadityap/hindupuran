import { pipeline } from '@huggingface/transformers';
import fs from 'fs';
import { PURANAS, STORIES, GARUDA_JOURNEY, GARUDA_TEACHINGS, NARAKAS, PANCHA, YUGAS } from '/home/user/hindupuran/js/data.js';
const OUT = process.env.HOME + '/corpus/out/search';
const raw = JSON.parse(fs.readFileSync(process.env.HOME + '/corpus/out/en_passages_raw.json', 'utf8'));
const items = [];
// curated notes first (so every Purāṇa is reachable)
for (const p of PURANAS) items.push({ k: 'note', b: p.id, h: p.name, t: `${p.tagline} ${p.summary} ${p.lesson}`, u: p.special ? '#/garuda' : `#/purana/${p.id}` });
for (const [id, s] of Object.entries(STORIES)) {
  const ps = PURANAS.filter(p => p.stories.includes(id));
  items.push({ k: 'note', b: ps[0]?.id || '', h: s.title, t: s.summary, u: `#/explore?focus=s:${id}` });
}
GARUDA_JOURNEY.forEach(j => items.push({ k: 'note', b: 'garuda', h: 'The soul’s journey · ' + j.t, t: j.d, u: '#/garuda' }));
GARUDA_TEACHINGS.forEach(j => items.push({ k: 'note', b: 'garuda', h: j.q, t: j.a, u: '#/garuda' }));
NARAKAS.forEach(([n, d]) => items.push({ k: 'note', b: 'bhagavata', h: 'Naraka · ' + n, t: d, u: '#/garuda' }));
PANCHA.forEach(x => items.push({ k: 'note', b: '', h: 'Five marks · ' + x.k, t: x.d, u: '#/concepts' }));
YUGAS.forEach(x => items.push({ k: 'note', b: '', h: x.k + ' Yuga', t: x.d, u: '#/concepts' }));
const nNotes = items.length;
for (const p of raw) items.push({ k: 'en', b: p.b, s: p.s, t: p.t });
console.log('items', items.length, 'notes', nNotes);

const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const D = 384, N = items.length;
const q = new Int8Array(N * D), scale = new Float32Array(N);
const B = 32; const t0 = Date.now();
for (let i = 0; i < N; i += B) {
  const batch = items.slice(i, i + B).map(x => (x.h ? x.h + '. ' : '') + x.t);
  const out = await ex(batch, { pooling: 'mean', normalize: true });
  const data = out.data;
  for (let j = 0; j < batch.length; j++) {
    let m = 0; for (let d = 0; d < D; d++) m = Math.max(m, Math.abs(data[j * D + d]));
    const sc = m / 127; scale[i + j] = sc;
    for (let d = 0; d < D; d++) q[(i + j) * D + d] = Math.round(data[j * D + d] / sc);
  }
  if (i % 1600 === 0) console.log(i, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
// binary: [N u32][D u32][scale f32 * N][int8 * N*D]
const buf = Buffer.alloc(8 + N * 4 + N * D);
buf.writeUInt32LE(N, 0); buf.writeUInt32LE(D, 4);
Buffer.from(scale.buffer).copy(buf, 8); Buffer.from(q.buffer).copy(buf, 8 + N * 4);
fs.writeFileSync(OUT + '/vectors.bin', buf);
fs.writeFileSync(OUT + '/passages.json', JSON.stringify(items));
console.log('done', N, (buf.length / 1e6).toFixed(1) + 'MB', (fs.statSync(OUT + '/passages.json').size / 1e6).toFixed(1) + 'MB');
