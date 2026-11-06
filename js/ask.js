// Ask the Purāṇas: semantic search (cosine similarity) over every English passage + the site's notes.
// Query embeddings are computed in the browser with the same model used to build the index
// (all-MiniLM-L6-v2, 8-bit), so nothing you type leaves your device except the one-time model download.
import { PURANAS } from "./data.js";
import { ANSWERS, CARE_NOTE } from "./answers.js";
import { toDeva } from "./reader.js";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = Object.fromEntries(PURANAS.map(p => [p.id, p]));
const TF_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js";
const EXAMPLES = ["Why am I sad?", "I feel rejected", "What happens to the soul after death?", "I lost someone I love", "How should a king rule justly?", "How to tell a good diamond",
  "Story of the great flood", "I can't control my anger", "How was the universe created?", "I feel lost and need courage"];
const ANSWER_MIN = 0.45;

let answerIdx = null;
async function loadAnswers() {
  if (answerIdx) return answerIdx;
  const buf = await fetch("data/search/answers.bin").then(r => r.arrayBuffer());
  const dv = new DataView(buf), N = dv.getUint32(0, true), D = dv.getUint32(4, true), off = 8 + N * 2 + ((N * 2) % 4);
  answerIdx = { N, D, map: new Uint16Array(buf, 8, N), vec: new Float32Array(buf, off, N * D) };
  return answerIdx;
}
// keyword fallback for answers while the model loads: share of the query's words found in an answer's phrasings
function answerByWords(q) {
  const qs = [...new Set(toks(q))]; if (!qs.length) return null;
  let best = null;
  ANSWERS.forEach((a, i) => {
    const bag = new Set(toks([a.title, ...a.ask].join(" ")));
    const hit = qs.filter(w => bag.has(w)).length / qs.length;
    if (hit >= .6 && (!best || hit > best.score)) best = { i, score: hit, kind: "keyword" };
  });
  return best;
}
let index = null, extractor = null, modelState = "idle", modelProgress = 0, listeners = new Set();
const notify = () => listeners.forEach(f => f());

async function loadIndex() {
  if (index) return index;
  const [items, buf] = await Promise.all([
    fetch("data/search/passages.json").then(r => r.json()),
    fetch("data/search/vectors.bin").then(r => r.arrayBuffer()),
  ]);
  const dv = new DataView(buf), N = dv.getUint32(0, true), D = dv.getUint32(4, true);
  index = { items, N, D, scale: new Float32Array(buf, 8, N), vec: new Int8Array(buf, 8 + N * 4, N * D) };
  return index;
}

async function loadModel() {
  if (extractor || modelState === "loading") return;
  modelState = "loading"; notify();
  try {
    const { pipeline, env } = await import(TF_URL);
    env.allowLocalModels = false;
    const seen = {};
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "q8",
      progress_callback: p => {
        if (p.status === "progress" && p.total) { seen[p.file] = [p.loaded, p.total]; const v = Object.values(seen); modelProgress = v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0); notify(); }
      },
    });
    modelState = "ready";
  } catch (e) { console.warn("model failed", e); modelState = "failed"; }
  notify();
}

// keyword fallback (BM25-ish) used until the model is ready or if it cannot load
const STOP = new Set("the a an and or of to in on for with is are was were be been it its this that what how why who when where which i me my you your we our they them he she his her as at by from about into than then so do does did can could should would not no".split(" "));
const toks = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]{3,}/g)?.filter(w => !STOP.has(w)) || [];
let lex = null, lastAnswer = null;
function lexical(q, k) {
  const { items } = index;
  if (!lex) { lex = items.map(x => toks((x.h || "") + " " + x.t)); lex.df = {}; lex.forEach(ts => new Set(ts).forEach(w => lex.df[w] = (lex.df[w] || 0) + 1)); }
  const qs = [...new Set(toks(q))], N = items.length;
  const scored = lex.map((ts, i) => {
    let s = 0; for (const w of qs) { const tf = ts.filter(x => x === w || x.startsWith(w)).length; if (tf) s += Math.log(1 + N / (lex.df[w] || 1)) * tf / (tf + 1.2 * (0.25 + 0.75 * ts.length / 150)); }
    return [s, i];
  }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k);
  const max = scored[0]?.[0] || 1;
  return scored.map(([s, i]) => ({ i, score: s / max, kind: "keyword" }));
}

async function semantic(q, k) {
  const out = await extractor(q, { pooling: "mean", normalize: true });
  const v = out.data, { N, D, vec, scale } = index;
  const A = await loadAnswers(); let ans = null;
  for (let i = 0; i < A.N; i++) { let s = 0; const o = i * A.D; for (let d = 0; d < A.D; d++) s += A.vec[o + d] * v[d]; if (!ans || s > ans.score) ans = { i: A.map[i], score: s, kind: "cosine" }; }
  lastAnswer = ans && ans.score >= ANSWER_MIN ? ans : null;
  const res = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; const o = i * D; for (let d = 0; d < D; d++) s += vec[o + d] * v[d]; res[i] = s * scale[i]; }
  const order = Array.from(res.keys()).sort((a, b) => res[b] - res[a]);
  // keep at most 3 hits per section so one chapter can't flood the page
  const seen = {}, hits = [];
  for (const i of order) {
    const x = index.items[i], key = x.k === "en" ? x.b + ":" + x.s : "n" + i;
    if ((seen[key] = (seen[key] || 0) + 1) > 3) continue;
    hits.push({ i, score: res[i], kind: "cosine" });
    if (hits.length >= k) break;
  }
  return hits;
}

function answerCard(a, m) {
  const v = a.verse;
  return `<article class="answer hud">
    <div class="hit-meta"><span>THE PURĀṆAS' ANSWER</span><span class="hit-bar"><i style="width:${Math.min(100, Math.max(8, (m.score - .3) / .6 * 100)).toFixed(0)}%"></i></span>
      <span>${m.kind === "cosine" ? "cos " + m.score.toFixed(3) : "keyword match"}</span></div>
    <h3>${esc(a.title)}</h3>
    <p class="answer-text">${esc(a.answer)}</p>
    <figure class="answer-verse">
      <p class="dev">${esc(toDeva(v.sa)).replace(/\n/g, "<br/>")}</p>
      <p class="iast">${esc(v.sa).replace(/\n/g, "<br/>")}</p>
      <blockquote>“${esc(v.tr)}”</blockquote>
      <figcaption>${esc(v.ref)} · <a class="accent" href="#/read/${v.pid}/sa/${v.sec}">read the chapter in Sanskrit →</a></figcaption>
    </figure>
    <div class="btns"><a class="btn" href="${a.link.h}">${esc(a.link.t)} →</a></div>
    ${a.care ? `<p class="note answer-care">${esc(CARE_NOTE)}</p>` : ""}
    <p class="note">Reflection written by Purāṇa Viśva from the cited text; translation ours.</p>
  </article>`;
}

export function askView(q) {
  return `<section class="wrap fade" style="padding-block:72px 24px">
    <p class="eyebrow">Ask</p><h1 style="font-size:clamp(44px,7vw,84px)">Ask the<br/><em>Purāṇas.</em></h1>
    <p class="lede" style="margin-top:20px">Write a question, a feeling, a situation — “why am I sad?” works. For the questions people bring most, you get the Purāṇas' answer with the verse it comes from. Every passage of the texts is a point in meaning-space; we find the ones closest to yours by cosine similarity — and show you exactly where they come from.</p>
  </section>
  <section class="wrap ask">
    <form id="askForm" class="ask-form hud">
      <textarea id="askQ" rows="3" placeholder="e.g. What should I do when I'm afraid of failing?">${esc(q || "")}</textarea>
      <div class="ask-row"><span class="mono muted" id="askStatus">MODEL · IDLE</span><button class="btn primary" type="submit">Ask →</button></div>
    </form>
    <div class="filters" style="margin-top:16px">${EXAMPLES.map(e => `<button class="chip" data-ex="${esc(e)}">${esc(e)}</button>`).join("")}</div>
    <div id="askResults" class="ask-results"></div>
    <p class="note">Searches ${PURANAS.length} Purāṇas: the full English translations of Viṣṇu, Garuḍa, Mārkaṇḍeya, Matsya and Agni (7,300+ passages), plus Purāṇa Viśva's notes on all eighteen.
      Similarity is computed on your device with all-MiniLM-L6-v2 (≈23 MB, downloaded once from Hugging Face). Until it loads, results use keyword matching.</p>
  </section>`;
}

export function bindAsk(app, q) {
  const form = app.querySelector("#askForm"), ta = app.querySelector("#askQ"), out = app.querySelector("#askResults"), st = app.querySelector("#askStatus");
  let last = "";
  const status = () => {
    st.textContent = modelState === "ready" ? "MODEL · READY · COSINE SIMILARITY"
      : modelState === "loading" ? `MODEL · LOADING ${Math.round(modelProgress * 100)}% · KEYWORD MODE`
      : modelState === "failed" ? "MODEL · UNAVAILABLE · KEYWORD MODE" : "MODEL · IDLE";
  };
  const onChange = () => { if (!document.body.contains(st)) { listeners.delete(onChange); return; } status(); if (modelState === "ready" && last) run(last, true); };
  listeners.add(onChange); status();

  async function run(query, silent) {
    query = query.trim(); if (!query) return;
    last = query;
    if (!silent) out.innerHTML = `<p class="mono muted" style="margin-top:28px">SEARCHING 7,442 PASSAGES…</p>`;
    await loadIndex();
    let hits;
    if (modelState === "ready") hits = await semantic(query, 12);
    else { hits = lexical(query, 12); lastAnswer = answerByWords(query); }
    if (query !== last) return;
    const card = lastAnswer ? answerCard(ANSWERS[lastAnswer.i], lastAnswer) : "";
    if (!hits.length && !card) { out.innerHTML = `<p class="empty" style="margin-top:28px">Nothing matched yet — try other words, or wait for the model to finish loading.</p>`; return; }
    out.innerHTML = card + (hits.length ? `<p class="eyebrow ask-sub">${card ? "And from the texts themselves" : "From the texts"}</p>` : "") + hits.map(({ i, score, kind }, r) => {
      const x = index.items[i], p = byId[x.b];
      const pct = Math.max(0, Math.min(1, kind === "cosine" ? (score - .1) / .6 : score));
      const where = x.k === "en" ? `${p ? p.name : x.b} · English translation` : `${p ? p.name + " · " : ""}Purāṇa Viśva note`;
      const link = x.k === "en" ? `#/read/${x.b}/en/${x.s}?hl=${encodeURIComponent(x.t.slice(0, 60))}` : x.u;
      return `<article class="hit">
        <div class="hit-meta"><span>${String(r + 1).padStart(2, "0")}</span><span class="hit-bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></span>
          <span>${kind === "cosine" ? "cos " + score.toFixed(3) : "kw " + score.toFixed(2)}</span></div>
        <p class="eyebrow" style="margin:0 0 8px">${esc(where)}</p>
        ${x.h ? `<h4>${esc(x.h)}</h4>` : ""}
        <p>${esc(x.t.length > 700 ? x.t.slice(0, 700) + "…" : x.t)}</p>
        <a class="accent mono" href="${link}">${x.k === "en" ? "Open in the reader →" : "Open →"}</a>
      </article>`;
    }).join("");
  }
  form.onsubmit = e => { e.preventDefault(); history.replaceState(null, "", `#/ask?q=${encodeURIComponent(ta.value.trim())}`); loadModel(); run(ta.value); };
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
  app.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { ta.value = b.dataset.ex; form.requestSubmit(); });
  loadModel(); loadIndex(); loadAnswers();
  if (q) run(q);
}
