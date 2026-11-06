// Embed every phrasing of every curated answer -> data/search/answers.bin ([N u32][D u32][answerIndex u16 * N][f32 * N*D])
import { pipeline } from '@huggingface/transformers';
import fs from 'fs';
import { ANSWERS } from '../js/answers.js';
const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const rows = ANSWERS.flatMap((a, i) => [a.title, ...a.ask].map(t => [i, t]));
const out = await ex(rows.map(r => r[1]), { pooling: 'mean', normalize: true });
const N = rows.length, D = 384, buf = Buffer.alloc(8 + N * 2 + N * D * 4 + ((N * 2) % 4));
buf.writeUInt32LE(N, 0); buf.writeUInt32LE(D, 4);
rows.forEach(([i], k) => buf.writeUInt16LE(i, 8 + k * 2));
const off = 8 + N * 2 + ((N * 2) % 4);
Buffer.from(out.data.buffer, out.data.byteOffset, N * D * 4).copy(buf, off);
fs.writeFileSync(new URL('../data/search/answers.bin', import.meta.url), buf);
console.log('answers', ANSWERS.length, 'phrasings', N, buf.length, 'bytes');
