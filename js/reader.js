// Full-text reader: public-domain English translations + Sanskrit (IAST / Devanagari) from GRETIL.
import { PURANAS } from "./data.js";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = Object.fromEntries(PURANAS.map(p => [p.id, p]));
const cache = new Map();
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export async function load(path) {
  if (!cache.has(path)) cache.set(path, fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  return cache.get(path);
}
export const manifest = () => load("data/manifest.json");

// ── IAST → Devanagari ────────────────────────────────
const V = { a: ["अ", ""], "ā": ["आ", "ा"], i: ["इ", "ि"], "ī": ["ई", "ी"], u: ["उ", "ु"], "ū": ["ऊ", "ू"], "ṛ": ["ऋ", "ृ"], "ṝ": ["ॠ", "ॄ"],
  "ḷ": ["ऌ", "ॢ"], "ḹ": ["ॡ", "ॣ"], e: ["ए", "े"], ai: ["ऐ", "ै"], o: ["ओ", "ो"], au: ["औ", "ौ"] };
const C = { k: "क", kh: "ख", g: "ग", gh: "घ", "ṅ": "ङ", c: "च", ch: "छ", j: "ज", jh: "झ", "ñ": "ञ", "ṭ": "ट", "ṭh": "ठ", "ḍ": "ड", "ḍh": "ढ",
  "ṇ": "ण", t: "त", th: "थ", d: "द", dh: "ध", n: "न", p: "प", ph: "फ", b: "ब", bh: "भ", m: "म", y: "य", r: "र", l: "ल", v: "व",
  "ś": "श", "ṣ": "ष", s: "स", h: "ह", "ḻ": "ळ" };
const OTHER = { "ṃ": "ं", "ṁ": "ं", "ḥ": "ः", "'": "ऽ", "’": "ऽ", "/": "।", "|": "।", "0": "०", "1": "१", "2": "२", "3": "३", "4": "४", "5": "५", "6": "६", "7": "७", "8": "८", "9": "९" };
export function toDeva(src) {
  const s = src.normalize("NFC").toLowerCase().replace(/(\S)-(?=\S)/g, "$1");
  let out = "", pend = false; // pending consonant awaiting a vowel
  for (let i = 0; i < s.length;) {
    const two = s.slice(i, i + 2), one = s[i];
    if (V[two] || V[one]) {
      const k = V[two] ? two : one;
      out += pend ? V[k][1] : V[k][0]; pend = false; i += k.length; continue;
    }
    if (C[two] || C[one]) {
      const k = C[two] ? two : one;
      if (pend) out += "्";
      out += C[k]; pend = true; i += k.length; continue;
    }
    if (pend) { out += "्"; pend = false; }
    if (one === "m" && s[i + 1] === "̐") { out += "ँ"; i += 2; continue; }
    out += OTHER[one] ?? one; i++;
  }
  if (pend) out += "्";
  return out.replace(/।।/g, "॥");
}

// ── Views ────────────────────────────────────────────
export function readIndex() {
  return `<section class="wrap fade" style="padding-block:72px 104px">
    <p class="eyebrow">Read</p><h1 style="font-size:clamp(44px,7vw,84px)">The texts,<br/><em>in full.</em></h1>
    <p class="lede" style="margin-top:20px">Full Sanskrit for fourteen Purāṇas and complete public-domain English translations for five. Pick one and read — your place is remembered.</p>
    <div id="readContinue"></div>
    <div class="grid" id="readGrid" style="margin-top:40px"><div class="card" style="min-height:0"><p class="muted">Loading the library…</p></div></div>
    <p class="note" style="margin-top:28px">Sanskrit: GRETIL (Göttingen Register of Electronic Texts in Indian Languages), CC BY-NC-SA 4.0 — shown here non-commercially with attribution.
      English: public-domain translations (1895–1917) from scans on archive.org; machine-read (OCR), so expect occasional misprints.
      Padma, Varāha, Bhaviṣya and Brahmavaivarta have no openly licensed full text yet — their pages here are summaries.</p>
  </section>`;
}

export async function bindReadIndex(app) {
  const m = await manifest();
  const last = store.get("pv-read-last", null);
  if (last && byId[last.id]) app.querySelector("#readContinue").innerHTML =
    `<a class="btn primary" style="margin-top:28px" href="#/read/${last.id}/${last.lang}/${last.sec}">Continue · ${esc(byId[last.id].name)} · ${esc(last.h || "")} →</a>`;
  app.querySelector("#readGrid").innerHTML = PURANAS.map(p => {
    const e = m[p.id] || {}, langs = [e.en && "en", e.sa && "sa"].filter(Boolean);
    const href = langs.length ? `#/read/${p.id}/${langs[0]}/0` : `#/purana/${p.id}`;
    return `<a class="card hud" href="${href}" style="min-height:200px">
      <span class="num"><span>№ ${String(p.n).padStart(2, "0")} / 18</span><span>${langs.length ? langs.map(l => l.toUpperCase()).join(" · ") : "NOTES ONLY"}</span></span>
      <h3>${esc(p.name)}</h3><span class="dev">${p.dev}</span>
      <p>${e.en ? `English: ${esc(e.en.by)} (${esc(e.en.year)}) · ${e.en.sections} sections<br/>` : ""}${e.sa ? `संस्कृत: ${e.sa.verses.toLocaleString("en-IN")} verses · ${e.sa.sections} chapters` : ""}${!langs.length ? "No open full text yet — read the summary." : ""}</p>
    </a>`;
  }).join("");
}

export function readView(id, lang, sec) {
  const p = byId[id];
  return `<section class="wrap reader fade">
    <div class="crumbs"><a href="#/read">Read</a> / ${esc(p ? p.name : id)}</div>
    <div class="reader-grid">
      <aside class="toc-panel">
        <div class="reader-tabs" id="langTabs"></div>
        <input class="toc-filter" id="tocFilter" type="search" placeholder="Filter chapters…" />
        <ol class="toc-list" id="tocList"></ol>
      </aside>
      <article class="reader-main">
        <div class="reader-head">
          <div><p class="eyebrow" id="rdSource"></p><h1 class="reader-title" id="rdTitle">${esc(p ? p.name : "")}</h1><h2 class="reader-sec" id="rdSec"></h2></div>
          <div class="reader-tools" id="rdTools"></div>
        </div>
        <div id="rdBody" class="reader-body"><p class="muted">Loading the text…</p></div>
        <nav class="pn" id="rdNav"></nav>
        <p class="note" id="rdCredit"></p>
      </article>
    </div>
  </section>`;
}

export async function bindRead(app, id, lang, sec, params) {
  const m = await manifest(); const e = m[id];
  if (!e || !e[lang]) { location.hash = e?.en ? `#/read/${id}/en/0` : e?.sa ? `#/read/${id}/sa/0` : `#/purana/${id}`; return; }
  app.querySelector("#langTabs").innerHTML = ["en", "sa"].filter(l => e[l]).map(l =>
    `<a class="chip ${l === lang ? "on" : ""}" href="#/read/${id}/${l}/0">${l === "en" ? "English" : "संस्कृत"}</a>`).join("");
  let doc;
  try { doc = await load(`data/${lang}/${id}.json`); } catch { app.querySelector("#rdBody").innerHTML = `<p class="empty">Couldn't load this text. Check your connection and try again.</p>`; return; }
  const n = doc.sections.length; sec = Math.max(0, Math.min(n - 1, sec | 0));
  const s = doc.sections[sec];
  const script = store.get("pv-script", "deva");
  app.querySelector("#rdSource").textContent = lang === "en" ? `${doc.title} · ${doc.by} · ${doc.year}` : `${doc.title || ""} · ${script === "deva" ? "देवनागरी" : "IAST"}`;
  app.querySelector("#rdSec").textContent = s.h;
  app.querySelector("#rdTools").innerHTML = lang === "sa"
    ? `<div class="filters" style="margin:0"><button class="chip ${script === "deva" ? "on" : ""}" data-script="deva">देवनागरी</button><button class="chip ${script === "iast" ? "on" : ""}" data-script="iast">IAST</button></div>`
    : `<span class="tag">${sec + 1} / ${n}</span>`;
  app.querySelectorAll("[data-script]").forEach(b => b.onclick = () => { store.set("pv-script", b.dataset.script); bindRead(app, id, lang, sec, params); });

  const body = app.querySelector("#rdBody");
  if (lang === "en") {
    body.innerHTML = s.p.map((t, i) => `<p data-i="${i}">${esc(t)}</p>`).join("");
  } else {
    const tx = t => script === "deva" ? toDeva(t) : t;
    body.innerHTML = s.v.map(([num, t]) => num
      ? `<div class="verse"><span class="vn">${esc(num)}</span><p class="${script === "deva" ? "dev" : "iast"}">${esc(tx(t)).replace(/\n/g, "<br/>")}</p></div>`
      : `<p class="vnote ${script === "deva" ? "dev" : ""}">${esc(tx(t))}</p>`).join("");
  }
  // highlight a passage handed over from Ask
  const hl = params.get("hl");
  if (hl && lang === "en") {
    const key = hl.slice(0, 60);
    const el = [...body.querySelectorAll("p")].find(p => p.textContent.includes(key.slice(0, 40)));
    if (el) { el.classList.add("hl"); setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 80); }
  }
  const prev = sec > 0 ? doc.sections[sec - 1] : null, next = sec < n - 1 ? doc.sections[sec + 1] : null;
  app.querySelector("#rdNav").innerHTML =
    (prev ? `<a href="#/read/${id}/${lang}/${sec - 1}"><span>← Previous</span><b>${esc(prev.h)}</b></a>` : "") +
    (next ? `<a href="#/read/${id}/${lang}/${sec + 1}"><span>Next →</span><b>${esc(next.h)}</b></a>` : "");
  app.querySelector("#rdCredit").innerHTML = lang === "en"
    ? `Public-domain translation, scanned on archive.org (${doc.sources.map((u, i) => `<a class="accent" href="${u}" target="_blank" rel="noopener">vol ${i + 1}</a>`).join(", ")}). Text is machine-read (OCR) and lightly cleaned; misprints remain.`
    : `Sanskrit text: ${esc(doc.source)} (<a class="accent" href="${doc.sources[0]}" target="_blank" rel="noopener">source</a>), licensed ${esc(doc.licence)}. Devanagari is transliterated automatically from IAST.`;

  const list = app.querySelector("#tocList"), filter = app.querySelector("#tocFilter");
  const renderToc = q => {
    const f = (q || "").toLowerCase();
    list.innerHTML = doc.sections.map((x, i) => (!f || x.h.toLowerCase().includes(f)) ? `<li><a class="${i === sec ? "on" : ""}" href="#/read/${id}/${lang}/${i}">${esc(x.h)}</a></li>` : "").join("");
    const on = list.querySelector("a.on");
    if (on) list.scrollTop = on.offsetTop - list.offsetTop - list.clientHeight / 2 + on.offsetHeight / 2;
  };
  renderToc(""); filter.oninput = () => renderToc(filter.value);
  store.set("pv-read-last", { id, lang, sec, h: s.h });
  document.title = `${byId[id]?.name || id} · ${s.h} · Purāṇa Viśva`;
}
