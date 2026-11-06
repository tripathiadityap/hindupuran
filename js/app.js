import {
  PURANAS, STORIES, THEMES, DEITIES, GUNAS, PANCHA, YUGAS,
  GARUDA_JOURNEY, GARUDA_PURVA, GARUDA_TEACHINGS, NARAKAS, REFLECT_KEYWORDS,
} from "./data.js";
import { mountGraph } from "./graph.js";
import { mountLotus, lotusSVG } from "./lotus.js";
import { audio } from "./audio.js";
import { readIndex, bindReadIndex, readView, bindRead, manifest } from "./reader.js";
import { askView, bindAsk } from "./ask.js";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => n.toLocaleString("en-IN");
const byId = Object.fromEntries(PURANAS.map(p => [p.id, p]));
const TOTAL = PURANAS.reduce((a, p) => a + p.verses, 0);
const MAXV = Math.max(...PURANAS.map(p => p.verses));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const gunaPill = g => `<span class="pill ${g}">${GUNAS[g].label}</span>`;
const puranasWith = (key, val) => PURANAS.filter(p => p[key].includes(val));
const storyCard = id => {
  const s = STORIES[id], ps = puranasWith("stories", id);
  return `<article class="story"><h4>${esc(s.title)}</h4><p>${esc(s.summary)}</p>
    <div class="tags">${ps.map(p => `<a href="#/purana/${p.id}">${esc(p.name)}</a>`).join(" · ")}</div></article>`;
};

// ── Views ────────────────────────────────────────────
function home() {
  const random = Object.keys(STORIES)[Math.floor(Math.random() * Object.keys(STORIES).length)];
  const tick = [...PURANAS.map(p => `<span><b>${p.dev}</b> ${p.name.replace(" Purāṇa", "").toUpperCase()} · ${fmt(p.verses)}</span>`)].join("");
  return `
  <section class="hero wrap fade">
    <div>
      <p class="eyebrow">18 Mahāpurāṇas // indexed</p>
      <h1>Ancient stories,<br/><em>machine-read</em><br/>for today.</h1>
      <p class="lede">A quiet place to read, map and reflect on all eighteen Purāṇas — the creation of worlds, the lives of avatāras, the road the soul walks after death.</p>
      <div class="btns">
        <a class="btn primary" href="#/library">Open library →</a>
        <a class="btn" href="#/garuda">Garuḍa deep dive</a>
        <a class="btn" href="#/explore">Explore map</a>
      </div>
    </div>
    <div>
      <div class="vision hud"><canvas data-lotus></canvas></div>
      <div class="vision-cap"><span class="rec">Live · padma.track</span><span>Move cursor to lock target</span></div>
    </div>
  </section>
  <div class="ticker" aria-hidden="true"><div>${tick}${tick}</div></div>
  <section class="wrap" style="padding-top:56px">
    <div class="stats hud">
      <div class="stat"><b>18</b><span>Mahāpurāṇas</span></div>
      <div class="stat"><b>${fmt(TOTAL)}</b><span>verses, traditionally</span></div>
      <div class="stat"><b>${Object.keys(STORIES).length}</b><span>stories &amp; teachings</span></div>
      <div class="stat"><b>${Object.keys(THEMES).length}</b><span>connecting threads</span></div>
    </div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="quote">
      <p class="eyebrow">A verse to begin</p>
      <p class="dev">स वै पुंसां परो धर्मो यतो भक्तिरधोक्षजे ।<br/>अहैतुक्यप्रतिहता ययात्मा सुप्रसीदति ॥</p>
      <p class="iast">sa vai puṃsāṃ paro dharmo yato bhaktir adhokṣaje · ahaituky apratihatā yayātmā suprasīdati</p>
      <blockquote>“The highest dharma is that which awakens devotion to the Transcendent — unmotivated, unbroken — by which the self is completely at peace.”</blockquote>
      <cite>Bhāgavata Purāṇa 1.2.6 · <a class="accent" href="#/purana/bhagavata">Read about the Bhāgavata →</a></cite>
    </div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Read · Ask</p><h2>All of it, in full.<br/><em>Ask it anything.</em></h2>
      <p class="muted">1,29,000+ Sanskrit verses from fourteen Purāṇas, five complete English translations — and a search that finds passages by meaning.</p></div></div>
    <form class="ask-form hud" onsubmit="event.preventDefault();location.hash='#/ask?q='+encodeURIComponent(this.q.value)">
      <textarea name="q" rows="2" placeholder="Ask the Purāṇas… e.g. why am I sad?"></textarea>
      <div class="ask-row"><span class="mono muted">COSINE SIMILARITY · ON-DEVICE</span><span class="btns"><a class="btn" href="#/read">Open the reader</a><button class="btn primary" type="submit">Ask →</button></span></div>
    </form>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Three moods, eighteen books</p><h2>The guṇa map</h2>
      <p class="muted">The Padma Purāṇa sorts the eighteen into three groups of six.</p></div>
      <a class="btn" href="#/concepts">More concepts →</a></div>
    <div class="gunas">${Object.entries(GUNAS).map(([g, v]) => `
      <div class="guna">${gunaPill(g)}<h3>${v.deity}</h3><p>${v.note}</p>
        <ul>${PURANAS.filter(p => p.guna === g).map(p => `<li><a href="#/purana/${p.id}">${esc(p.name)}<span>${fmt(p.verses)}</span></a></li>`).join("")}</ul>
      </div>`).join("")}
    </div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="g-hero" style="padding-block:0">
      <div>
        <p class="eyebrow">Deep dive</p>
        <h2>The Garuḍa Purāṇa</h2>
        <p class="lede" style="margin:20px 0 28px">Read in countless homes in the days after a death. Viṣṇu answers his eagle Garuḍa: what happens when we die — and therefore, how should we live?</p>
        <a class="btn primary" href="#/garuda">Follow the soul's journey →</a>
      </div>
      <div class="vision hud" style="aspect-ratio:4/3"><canvas data-lotus="garuda"></canvas></div>
    </div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Start with one story</p><h2>${esc(STORIES[random].title)}</h2></div>
      <a class="btn" href="#/explore?focus=s:${random}">See its connections →</a></div>
    <p class="lede">${esc(STORIES[random].summary)}</p>
    <p class="muted" style="font-size:14px">Told in ${puranasWith("stories", random).map(p => `<a class="accent" href="#/purana/${p.id}">${esc(p.name)}</a>`).join(", ")}</p>
  </section>`;
}

function library(params) {
  const g = params.get("guna") || "all";
  const sort = params.get("sort") || "order";
  let list = PURANAS.filter(p => g === "all" || p.guna === g);
  if (sort === "length") list = [...list].sort((a, b) => b.verses - a.verses);
  const chip = (val, label) => `<a class="chip ${g === val ? "on" : ""}" href="#/library?guna=${val}&sort=${sort}">${label}</a>`;
  return `<section class="wrap fade" style="padding-block:72px 96px">
    <p class="eyebrow">Library</p><h1 style="font-size:clamp(44px,7vw,80px)">The eighteen.</h1>
    <p class="lede" style="margin:20px 0 40px">Each Purāṇa, in brief — its shape, its voice, its stories. Bars show traditional length.</p>
    <div class="filters">${chip("all", "All")}${Object.entries(GUNAS).map(([k, v]) => chip(k, `${v.label} · ${v.deity}`)).join("")}
      <span style="flex:1"></span>
      <a class="chip ${sort === "length" ? "on" : ""}" href="#/library?guna=${g}&sort=${sort === "length" ? "order" : "length"}">Sort by length</a></div>
    <div class="grid">${list.map(p => `
      <a class="card hud ${p.special ? "special" : ""}" href="#/${p.special ? "garuda" : "purana/" + p.id}">
        <span class="lotus-bg">${lotusSVG(200)}</span>
        <span class="num"><span>№ ${String(p.n).padStart(2, "0")} / 18</span><span>${p.special ? "◉ DEEP DIVE" : "ID:" + p.id.toUpperCase().slice(0, 6)}</span></span>
        <h3>${esc(p.name)}</h3><span class="dev">${p.dev}</span>
        <p>${esc(p.tagline)}</p>
        <div class="bar"><i style="width:${(p.verses / MAXV) * 100}%"></i></div>
        <div class="meta">${gunaPill(p.guna)}<span>${fmt(p.verses)} verses</span></div>
      </a>`).join("")}</div>
  </section>`;
}

function purana(id) {
  const p = byId[id];
  if (!p) return notFound();
  const prev = PURANAS[p.n - 2], next = PURANAS[p.n];
  return `<section class="wrap p-hero fade"><div>
    <div class="crumbs"><a href="#/library">Library</a> / ${String(p.n).padStart(2, "0")} / ${p.id.toUpperCase()}</div>
    <p class="eyebrow">${esc(p.alias)}</p>
    <p class="dev">${p.dev}</p>
    <h1>${esc(p.name)}</h1>
    <p class="lede" style="margin-top:20px">${esc(p.tagline)}</p>
    <div class="p-meta">${gunaPill(p.guna)}<span class="tag">${fmt(p.verses)} verses</span><span class="tag">№ ${p.n} of 18</span>
      ${p.special ? `<a class="btn primary" href="#/garuda" style="padding:6px 14px">Open the deep dive →</a>` : ""}</div>
  </div><div class="p-lotus"><canvas data-lotus="mini" data-code="${p.id.toUpperCase()} // ${String(p.n).padStart(2, "0")}"></canvas></div></section>
  <section class="wrap p-body">
    <div>
      <h2>Overview</h2>
      <div class="prose"><p>${esc(p.summary)}</p></div>
      <div class="lesson">${esc(p.lesson)}</div>
      <h2>Structure</h2>
      <ol class="toc">${p.structure.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      <h2>Stories within</h2>
      <div class="stories">${p.stories.map(storyCard).join("")}</div>
      <nav class="pn">
        ${prev ? `<a href="#/purana/${prev.id}"><span>← Previous</span><b>${esc(prev.name)}</b></a>` : ""}
        ${next ? `<a href="#/purana/${next.id}"><span>Next →</span><b>${esc(next.name)}</b></a>` : ""}
      </nav>
    </div>
    <aside class="aside">
      <dl>
        <dt>Narrated by</dt><dd>${esc(p.speaker)}</dd>
        <dt>Group</dt><dd>${GUNAS[p.guna].label} — ${GUNAS[p.guna].deity}</dd>
        <dt>Deities</dt><dd class="tags">${p.deities.map(d => `<a class="tag" href="#/deity/${d}">${DEITIES[d]}</a>`).join("")}</dd>
        <dt>Themes</dt><dd class="tags">${p.themes.map(t => `<a class="tag" href="#/theme/${t}">${THEMES[t].label}</a>`).join("")}</dd>
        <dt>Length</dt><dd><div class="bar"><i style="width:${(p.verses / MAXV) * 100}%"></i></div>
          <span class="muted" style="font-size:13px">${((p.verses / TOTAL) * 100).toFixed(1)}% of the eighteen</span></dd>
      </dl>
      <div id="readBtns" class="btns" style="flex-direction:column"></div>
      <a class="btn" href="#/explore?focus=p:${p.id}">See it on the map →</a>
    </aside>
  </section>`;
}

function facet(kind, id) {
  const isTheme = kind === "theme";
  const meta = isTheme ? THEMES[id] : { label: DEITIES[id] };
  if (!meta || !meta.label) return notFound();
  const ps = puranasWith(isTheme ? "themes" : "deities", id);
  const stories = isTheme ? Object.entries(STORIES).filter(([, s]) => s.themes.includes(id)).map(([k]) => k)
    : [...new Set(ps.flatMap(p => p.stories))];
  return `<section class="wrap fade" style="padding-block:72px 96px">
    <div class="crumbs"><a href="#/library">Library</a> / ${isTheme ? "Theme" : "Deity"}</div>
    <h1 style="font-size:clamp(44px,7vw,84px)">${esc(meta.label)}</h1>
    ${meta.desc ? `<p class="lede" style="margin-top:16px">${esc(meta.desc)}</p>` : ""}
    <div class="section-head" style="margin:56px 0 20px"><h3>In ${ps.length} Purāṇa${ps.length === 1 ? "" : "s"}</h3>
      <a class="btn" href="#/explore?focus=${isTheme ? "t" : "d"}:${id}">On the map →</a></div>
    <div class="grid">${ps.map(p => `<a class="card" href="#/purana/${p.id}" style="min-height:0"><span class="num">${String(p.n).padStart(2, "0")}</span><h3>${esc(p.name)}</h3><p>${esc(p.tagline)}</p><div class="meta">${gunaPill(p.guna)}<span>${fmt(p.verses)}</span></div></a>`).join("")}</div>
    ${stories.length ? `<h3 style="margin:56px 0 20px">Related stories</h3><div class="stories cols-2">${stories.map(storyCard).join("")}</div>` : ""}
  </section>`;
}

function garuda() {
  const p = byId.garuda;
  return `<section class="wrap fade">
    <div class="g-hero">
      <div>
        <div class="crumbs"><a href="#/library">Library</a> / 17 · Deep dive</div>
        <p class="dev" style="font-size:28px;color:var(--muted);margin:0 0 8px">${p.dev}</p>
        <h1>Garuḍa<br/>Purāṇa</h1>
        <p class="lede" style="margin:24px 0 28px">${esc(p.summary)}</p>
        <div class="p-meta" style="margin:0">${gunaPill(p.guna)}<span class="tag">${fmt(p.verses)} verses</span><span class="tag">${esc(p.speaker)}</span></div>
        <div class="btns" style="margin-top:22px"><a class="btn primary" href="#/read/garuda/en/0">Read it in English →</a><a class="btn" href="#/read/garuda/sa/0">संस्कृत · 11,961 verses</a><a class="btn" href="#/ask?q=${encodeURIComponent("What happens to the soul after death?")}">Ask it →</a></div>
      </div>
      <div><div class="vision hud"><canvas data-lotus="garuda"></canvas></div>
        <div class="vision-cap"><span class="rec">Preta.track</span><span>Viṣṇu ↔ Garuḍa</span></div></div>
    </div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Shape of the text</p><h2>Two halves</h2></div></div>
    <div class="cols-2">
      <div class="tile"><p class="eyebrow">Pūrva Khaṇḍa · Ācāra Kāṇḍa</p><h4 style="margin-top:10px">How to live</h4><p>The larger first part — an encyclopaedia of worship, cosmology, medicine, gems, astrology, law and ethics.</p></div>
      <div class="tile"><p class="eyebrow">Uttara Khaṇḍa · Preta Khaṇḍa</p><h4 style="margin-top:10px">What follows death</h4><p>Garuḍa's questions on death, the departed (preta), the rites of the living, and the court of Yama. Also called the Dharma Kāṇḍa; the Brahma Khaṇḍa follows.</p></div>
    </div>
    <h3 style="margin:56px 0 20px">Inside the Pūrva Khaṇḍa</h3>
    <div class="cols-3">${GARUDA_PURVA.map(x => `<div class="tile"><h4>${esc(x.t)}</h4><p>${esc(x.d)}</p></div>`).join("")}</div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Preta Khaṇḍa</p><h2>The soul's journey</h2>
      <p class="muted">As Viṣṇu describes it to Garuḍa — summarised.</p></div></div>
    <ol class="journey">${GARUDA_JOURNEY.map(j => `<li><h3>${esc(j.t)}</h3><p>${esc(j.d)}</p></li>`).join("")}</ol>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Questions people ask</p><h2>Reading it today</h2></div></div>
    <div class="faq">${GARUDA_TEACHINGS.map((t, i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(t.q)}</summary><p>${esc(t.a)}</p></details>`).join("")}</div>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Fruit of action</p><h2>The twenty-eight narakas</h2>
      <p class="muted">Not eternal damnation — temporary regions where harmful deeds ripen.</p></div></div>
    <div class="naraka-grid">${NARAKAS.map(([n, d], i) => `<div class="naraka"><i>N_${String(i + 1).padStart(2, "0")}</i><b>${n}</b><span>${d}</span></div>`).join("")}</div>
    <p class="note">Names follow the canonical list in Bhāgavata Purāṇa 5.26; the Garuḍa Purāṇa describes punishments in the same spirit, with its own emphases. Descriptions are condensed.</p>
  </section>

  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Connected</p><h2>Stories nearby</h2></div>
      <a class="btn" href="#/explore?focus=p:garuda">See it on the map →</a></div>
    <div class="stories cols-2">${["soul-journey", "vaitarani", "nachiketa", "savitri"].map(storyCard).join("")}</div>
    <div class="lesson">${esc(p.lesson)}</div>
  </section>`;
}

function concepts() {
  const maxY = YUGAS[0].years;
  const avatars = [
    ["Matsya", "The fish who saves Manu from the flood", "matsya"], ["Kūrma", "The tortoise beneath the churning", "kurma"],
    ["Varāha", "The boar who lifts the Earth", "varaha"], ["Narasiṃha", "The man-lion who protects Prahlāda", "vishnu"],
    ["Vāmana", "The dwarf of three strides", "vamana"], ["Paraśurāma", "The axe-wielding sage", "brahmanda"],
    ["Rāma", "The king of dharma", "padma"], ["Kṛṣṇa", "The cowherd, friend and teacher", "bhagavata"],
    ["Buddha / Balarāma", "Lists differ by tradition", "bhagavata"], ["Kalki", "The rider at the end of Kali Yuga", "vishnu"],
  ];
  return `<section class="wrap fade" style="padding-block:72px 24px">
    <p class="eyebrow">Concepts</p><h1 style="font-size:clamp(44px,7vw,84px)">The grammar<br/>of the Purāṇas.</h1>
    <p class="lede" style="margin-top:20px">A few frameworks that recur across all eighteen — learn them once, and every text becomes easier to read.</p>
  </section>
  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Pañca-lakṣaṇa</p><h2>Five marks of a Purāṇa</h2>
      <p class="muted">The classical definition of what a Purāṇa should contain.</p></div></div>
    <div class="pancha">${PANCHA.map((x, i) => `<div><span class="muted">0${i + 1}</span><b>${x.k}</b><p>${x.d}</p></div>`).join("")}</div>
  </section>
  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Kāla</p><h2>The four yugas</h2>
      <p class="muted">Dharma diminishes by a quarter in each age. Together they form one mahāyuga of 4,320,000 years.</p></div></div>
    ${YUGAS.map(y => `<div class="yuga"><b>${y.k}</b><div><div class="bar"><i style="width:${(y.years / maxY) * 100}%"></i></div><span class="muted" style="font-size:13px">${fmt(y.years)} years</span></div><p>${y.d}</p></div>`).join("")}
    <h3 style="margin:56px 0 12px">Scaling up</h3>
    <div class="scale">
      <div><span>1 mahāyuga</span><span>4.32 million years</span></div>
      <div><span>1 manvantara — the reign of one Manu</span><span>71 mahāyugas</span></div>
      <div><span>1 kalpa — a single day of Brahmā (14 Manus)</span><span>1,000 mahāyugas · 4.32 billion years</span></div>
      <div><span>Brahmā's lifespan</span><span>100 of his years — then mahāpralaya</span></div>
    </div>
  </section>
  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Avatāra</p><h2>The ten descents</h2>
      <p class="muted">The most familiar list. The Bhāgavata itself names twenty-two and more.</p></div></div>
    <div class="avatars">${avatars.map(([n, d, p], i) => `<a class="avatar" href="#/purana/${p}"><span class="num">${String(i + 1).padStart(2, "0")}</span><b>${n}</b><p>${d}</p></a>`).join("")}</div>
  </section>
  <section class="section wrap"><span class="sec-id"></span>
    <div class="section-head"><div><p class="eyebrow">Classification</p><h2>The three guṇas</h2></div></div>
    <div class="gunas">${Object.entries(GUNAS).map(([g, v]) => `<div class="guna">${gunaPill(g)}<h3>${v.deity}</h3><p>${v.note}</p>
      <div class="tags">${PURANAS.filter(p => p.guna === g).map(p => `<a class="tag" href="#/purana/${p.id}">${esc(p.name.replace(" Purāṇa", ""))}</a>`).join("")}</div></div>`).join("")}</div>
  </section>`;
}

function explore() {
  return `<section class="explore">
    <div class="explore-ui">
      <p class="eyebrow">Explore</p><h2>The map</h2>
      <div class="filters" style="margin:14px 0 0"><button class="chip" data-mode="2d">2D</button><button class="chip" data-mode="3d">3D · orbit</button></div>
      <p class="lede" style="font-size:15px;margin:10px 0 0">Eighteen Purāṇas, their deities, themes and stories. Tap a node to inspect it. In 3D, drag to orbit; in 2D, drag to pan. Scroll to zoom.</p>
      <div class="legend">
        <span>● Sāttvika Purāṇa</span><span>■ Rājasika Purāṇa</span><span>◆ Tāmasika Purāṇa</span>
        <span>▪ Deity</span><span>○ Theme</span><span>· Story</span>
      </div>
    </div>
    <div class="inspector" id="inspector" hidden></div>
  </section>`;
}

function inspect(n) {
  const el = $("#inspector");
  if (!el) return;
  if (!n) { el.hidden = true; return; }
  el.hidden = false;
  const [kind, id] = n.id.split(":");
  let body = "";
  if (kind === "p") { const p = byId[id]; body = `${gunaPill(p.guna)}<h3>${esc(p.name)}</h3><p>${esc(p.tagline)}</p><a class="btn" href="#/${p.special ? "garuda" : "purana/" + id}">Read →</a>`; }
  else if (kind === "s") { const s = STORIES[id]; body = `<span class="eyebrow">Story</span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><div class="tags">${puranasWith("stories", id).map(p => `<a class="tag" href="#/purana/${p.id}">${esc(p.name)}</a>`).join("")}</div>`; }
  else if (kind === "t") { body = `<span class="eyebrow">Theme</span><h3>${esc(THEMES[id].label)}</h3><p>${esc(THEMES[id].desc)}</p><a class="btn" href="#/theme/${id}">Open theme →</a>`; }
  else { body = `<span class="eyebrow">Deity</span><h3>${esc(DEITIES[id])}</h3><p>Central in ${puranasWith("deities", id).length} Purāṇas.</p><a class="btn" href="#/deity/${id}">Open →</a>`; }
  el.innerHTML = body;
}

function reflect() {
  return `<section class="wrap fade" style="padding-top:72px">
    <p class="eyebrow">Reflect</p><h1 style="font-size:clamp(44px,7vw,84px)">Write what's on<br/>your mind.</h1>
    <p class="lede" style="margin-top:20px">The Purāṇas were told to people in the middle of their lives. Write freely — we'll suggest stories that speak to it. Everything stays in this browser.</p>
  </section>
  <section class="wrap reflect">
    <div>
      <textarea id="note" placeholder="I've been thinking about…"></textarea>
      <div class="btns" style="margin-top:12px">
        <button class="btn primary" id="saveNote">Save reflection</button>
        <button class="btn" id="exportNotes">Export</button>
        <button class="btn" id="askNote">Ask the texts →</button>
      </div>
      <div class="entries" id="entries"></div>
    </div>
    <div><p class="eyebrow" style="margin-bottom:16px">Stories that may speak to this</p><div id="suggest" class="stories"></div></div>
  </section>`;
}

function suggest(text) {
  const t = " " + text.toLowerCase() + " ";
  const score = {};
  for (const [theme, words] of Object.entries(REFLECT_KEYWORDS))
    for (const w of words) if (t.includes(w)) score[theme] = (score[theme] || 0) + 1;
  const themes = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const ids = [];
  for (const th of themes) for (const [id, s] of Object.entries(STORIES)) if (s.themes.includes(th) && !ids.includes(id)) ids.push(id);
  return { themes, ids: ids.slice(0, 4) };
}

function bindReflect() {
  const note = $("#note"), out = $("#suggest"), list = $("#entries");
  note.value = store.get("pv-draft", "");
  const render = () => {
    const { themes, ids } = suggest(note.value);
    out.innerHTML = ids.length
      ? `<div class="tags" style="margin-bottom:8px">${themes.slice(0, 3).map(t => `<a class="tag" href="#/theme/${t}">${THEMES[t].label}</a>`).join("")}</div>${ids.map(storyCard).join("")}`
      : `<p class="empty">Start writing — about a loss, a decision, a fear, a beginning — and stories will appear here.</p>`;
    store.set("pv-draft", note.value);
  };
  const renderList = () => {
    const e = store.get("pv-notes", []);
    list.innerHTML = e.slice().reverse().map(x => `<div class="entry"><time>${new Date(x.at).toLocaleString()}</time>${esc(x.text.slice(0, 220))}${x.text.length > 220 ? "…" : ""}</div>`).join("");
  };
  note.addEventListener("input", render);
  $("#saveNote").onclick = () => {
    if (!note.value.trim()) return;
    const e = store.get("pv-notes", []); e.push({ at: Date.now(), text: note.value.trim() });
    store.set("pv-notes", e); note.value = ""; render(); renderList();
  };
  $("#askNote").onclick = () => { if (note.value.trim()) location.hash = "#/ask?q=" + encodeURIComponent(note.value.trim().slice(0, 500)); };
  $("#exportNotes").onclick = () => {
    const e = store.get("pv-notes", []);
    const blob = new Blob([e.map(x => `## ${new Date(x.at).toLocaleString()}\n\n${x.text}\n`).join("\n")], { type: "text/markdown" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "purana-reflections.md" });
    a.click(); URL.revokeObjectURL(a.href);
  };
  render(); renderList();
}

function notFound() {
  return `<section class="wrap" style="padding-block:120px"><h1>Not found.</h1><p class="lede">Even Brahmā and Viṣṇu could not find the end of the pillar. <a class="accent" href="#/">Return home →</a></p></section>`;
}

async function bindPuranaRead(id) {
  const el = $("#readBtns"); if (!el) return;
  const m = await manifest().catch(() => ({})), e = m[id] || {};
  el.innerHTML = (e.en ? `<a class="btn primary" href="#/read/${id}/en/0">Read in English · ${e.en.sections} sections →</a>` : "")
    + (e.sa ? `<a class="btn" href="#/read/${id}/sa/0">Read in Sanskrit · ${e.sa.verses.toLocaleString("en-IN")} verses →</a>` : "")
    + (!e.en && !e.sa ? `<span class="note">No openly licensed full text yet.</span>` : "");
}
function a_scrollNav() { document.querySelector(".nav a.active")?.scrollIntoView({ inline: "center", block: "nearest" }); }

// ── Router ───────────────────────────────────────────
let graph = null, lotuses = [];
const RAGA_FOR = { "": "bhupali", library: "yaman", purana: "yaman", garuda: "bhairavi", explore: "malkauns", concepts: "bhupali", reflect: "bhairavi", theme: "yaman", deity: "yaman", read: "yaman", ask: "bhupali" };
const cssColors = () => {
  const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue(k).trim();
  return { bg: v("--bg"), ink: v("--ink"), ink2: v("--ink-2"), muted: v("--muted"), line: v("--line"), accent: v("--accent"), sattvic: v("--sattvic"), rajasic: v("--rajasic"), tamasic: v("--tamasic") };
};

function route() {
  graph?.destroy(); graph = null;
  lotuses.forEach(l => l.destroy()); lotuses = [];
  const [path, query = ""] = location.hash.slice(1).split("?");
  const parts = path.split("/").filter(Boolean), params = new URLSearchParams(query);
  const top = parts[0] || "";
  const views = {
    "": () => home(), library: () => library(params), purana: () => purana(parts[1]),
    garuda: () => garuda(), explore: () => explore(), concepts: () => concepts(), reflect: () => reflect(),
    theme: () => facet("theme", parts[1]), deity: () => facet("deity", parts[1]),
    read: () => parts[1] ? readView(parts[1], parts[2] || "en", +(parts[3] || 0)) : readIndex(),
    ask: () => askView(params.get("q")),
  };
  app.innerHTML = (views[top] || notFound)();
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active",
    a.dataset.nav === top || (top === "purana" && a.dataset.nav === "library") || (top === "purana" && parts[1] === "garuda" && a.dataset.nav === "garuda")));
  a_scrollNav();
  document.body.style.overflow = "";
  const titles = { library: "Library", garuda: "Garuḍa Purāṇa", explore: "Explore", concepts: "Concepts", reflect: "Reflect", read: "Read", ask: "Ask", purana: byId[parts[1]]?.name, theme: THEMES[parts[1]]?.label, deity: DEITIES[parts[1]] };
  document.title = (titles[top] ? titles[top] + " · " : "") + "Purāṇa Viśva";
  if (top === "explore") {
    document.querySelector(".footer").hidden = true;
    const mode = store.get("pv-graph-mode", "3d");
    graph = mountGraph($(".explore"), { onSelect: inspect, colors: cssColors, mode });
    const syncMode = m => app.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    syncMode(mode);
    app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { graph.setMode(b.dataset.mode); store.set("pv-graph-mode", b.dataset.mode); syncMode(b.dataset.mode); });
    if (params.get("focus")) graph.select(params.get("focus"));
  } else {
    document.querySelector(".footer").hidden = false;
  }
  if (top === "reflect") bindReflect();
  if (top === "read") parts[1] ? bindRead(app, parts[1], parts[2] || "en", +(parts[3] || 0), params) : bindReadIndex(app);
  if (top === "ask") bindAsk(app, params.get("q"));
  if (top === "purana") bindPuranaRead(parts[1]);
  app.querySelectorAll("[data-lotus]").forEach(cv => {
    const kind = cv.dataset.lotus;
    const opts = kind === "garuda"
      ? { label: "GARUDA // PRETA_KHANDA", code: "CAM_17 / YAMAPATH", mode: "SOUL_TRACK: ACTIVE", motes: 18, pitch: .62, spin: -.14, tags: ["MRTYU", "PINDA", "SAPINDIKARANA", "VAITARANI", "CITRAGUPTA", "YAMA", "KARMA", "MOKSHA"] }
      : kind === "mini" ? { minimal: true, code: cv.dataset.code, scale: .46, cy: .62, spin: .25 } : {};
    lotuses.push(mountLotus(cv, opts));
  });
  app.querySelectorAll(".sec-id").forEach((el, i) => { el.textContent = `SEC_${String(i + 1).padStart(2, "0")} // ${(top || "home").toUpperCase()}`; });
  audio.setRaga(RAGA_FOR[top] || "bhupali");
  if (!params.has("focus") && !params.has("hl")) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();

// ── Theme ────────────────────────────────────────────
$("#themeToggle").onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme !== "light";
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("pv-theme", root.dataset.theme); } catch {}
  graph?.redraw();
};

// ── Search (⌘K) ──────────────────────────────────────
const INDEX = [
  ...PURANAS.map(p => ({ t: p.name, s: p.tagline, k: "Purāṇa", h: p.special ? "#/garuda" : `#/purana/${p.id}`, x: `${p.name} ${p.dev} ${p.alias} ${p.summary} ${p.structure.join(" ")}` })),
  ...Object.entries(STORIES).map(([id, s]) => ({ t: s.title, s: s.summary, k: "Story", h: `#/explore?focus=s:${id}`, x: s.title + " " + s.summary })),
  ...Object.entries(THEMES).map(([id, t]) => ({ t: t.label, s: t.desc, k: "Theme", h: `#/theme/${id}`, x: t.label + " " + t.desc })),
  ...Object.entries(DEITIES).map(([id, d]) => ({ t: d, s: "", k: "Deity", h: `#/deity/${id}`, x: d })),
  ...NARAKAS.map(([n, d]) => ({ t: n, s: d, k: "Naraka", h: "#/garuda", x: n + " " + d })),
  { t: "The soul's journey", s: "Garuḍa Purāṇa · Preta Khaṇḍa", k: "Page", h: "#/garuda", x: "death afterlife yama preta pinda shraddha" },
  { t: "Four yugas", s: "Satya, Tretā, Dvāpara, Kali", k: "Concept", h: "#/concepts", x: "yuga kali satya treta dvapara time kalpa manvantara" },
  { t: "Five marks of a Purāṇa", s: "Pañca-lakṣaṇa", k: "Concept", h: "#/concepts", x: "pancha lakshana sarga pratisarga vamsha manvantara" },
];
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
INDEX.forEach(i => { i.f = fold(i.t); i.fx = fold(i.x); });

const sEl = $("#search"), sIn = $("#searchInput"), sOut = $("#searchResults");
let sel = 0, results = [];
function runSearch() {
  const q = fold(sIn.value.trim());
  const askItem = sIn.value.trim() ? [{ t: `Ask the Purāṇas: “${sIn.value.trim()}”`, s: "Semantic search across the full texts", k: "Ask", h: `#/ask?q=${encodeURIComponent(sIn.value.trim())}` }] : [];
  results = !q ? INDEX.filter(i => i.k === "Purāṇa").slice(0, 8)
    : INDEX.map(i => ({ i, sc: i.f.startsWith(q) ? 3 : i.f.includes(q) ? 2 : q.split(/\s+/).every(w => i.fx.includes(w)) ? 1 : 0 }))
      .filter(r => r.sc).sort((a, b) => b.sc - a.sc).slice(0, 12).map(r => r.i);
  results = [...askItem, ...results];
  sel = 0;
  sOut.innerHTML = results.length ? results.map((r, n) => `<li><a href="${r.h}" class="${n === 0 ? "sel" : ""}"><span>${esc(r.t)}${r.s ? `<span class="sub">${esc(r.s.slice(0, 90))}</span>` : ""}</span><small>${r.k}</small></a></li>`).join("")
    : `<li class="muted" style="padding:14px">Nothing found.</li>`;
}
function openSearch() { sEl.hidden = false; sIn.value = ""; runSearch(); setTimeout(() => sIn.focus(), 0); }
function closeSearch() { sEl.hidden = true; }
$("#openSearch").onclick = openSearch;
sEl.addEventListener("click", e => { if (e.target.dataset.close !== undefined || e.target.closest("a")) closeSearch(); });
sIn.addEventListener("input", runSearch);
sIn.addEventListener("keydown", e => {
  const links = sOut.querySelectorAll("a");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!links.length) return;
    sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    links.forEach((a, n) => a.classList.toggle("sel", n === sel)); links[sel].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && links[sel]) { location.hash = links[sel].getAttribute("href"); closeSearch(); }
});
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); sEl.hidden ? openSearch() : closeSearch(); }
  else if (e.key === "Escape" && !sEl.hidden) closeSearch();
  else if (e.key === "/" && sEl.hidden && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
});

// ── Brand + music ────────────────────────────────────
$("#brandLotus").innerHTML = lotusSVG(22);
const mBtn = $("#musicBtn"), mLabel = $("#musicLabel"), toast = $("#toast");
function syncMusic() {
  const r = audio.ragas[audio.raga];
  mBtn.classList.toggle("on", audio.playing);
  mBtn.setAttribute("aria-pressed", audio.playing);
  mLabel.textContent = audio.playing ? `Rāga · ${r.name}` : "Rāga · off";
  mBtn.title = `${r.name} — ${r.mood}`;
  $("#toastText").textContent = `Now set to ${r.name} · ${r.mood}`;
}
audio.onChange(syncMusic);
mBtn.onclick = () => { audio.toggle(); toast.hidden = true; store.set("pv-music-seen", true); };
$("#toastPlay").onclick = () => { audio.start(); toast.hidden = true; store.set("pv-music-seen", true); };
$("#toastClose").onclick = () => { toast.hidden = true; store.set("pv-music-seen", true); };
if (!store.get("pv-music-seen", false)) setTimeout(() => { toast.hidden = false; }, 2500);
syncMusic();
