# Build cleaned, sectioned English texts + passages from archive.org OCR (public-domain translations).
import re, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from en_parse import candidates

EN = os.path.expanduser('~/corpus/en')
OUT = os.path.expanduser('~/corpus/out')
os.makedirs(OUT, exist_ok=True)

BOOKS = {
  'vishnu': {'files': ['196042'], 'title': 'The Vishnu Purana', 'by': 'English prose version after H. H. Wilson', 'year': '1895 edition',
             'header': r'VISHNU\s+PUR[AÁ]N'},
  'garuda': {'files': ['189319', '189320', '33651'], 'title': 'The Garuda Puranam', 'by': 'tr. Manmatha Nath Dutt', 'year': '1908',
             'header': r'GARU[DḌ]A\s+PUR'},
  'markandeya': {'files': ['47519'], 'title': 'The Markandeya Purana', 'by': 'tr. F. Eden Pargiter', 'year': '1904', 'header': r'M[AĀ]RKA[NṆ][DḌ]EYA'},
  'matsya': {'files': ['45856', '45858'], 'title': 'The Matsya Puranam', 'by': 'tr. a Taluqdar of Oudh (Sacred Books of the Hindus)', 'year': '1916–17',
             'header': r'MATSYA\s+PUR'},
  'agni': {'files': ['279469', '33600', '33601', '33602'], 'title': 'Agni Puranam', 'by': 'tr. Manmatha Nath Dutt', 'year': '1903–04', 'header': r'AGNI\s+PUR'},
}

HEAD_RX = re.compile(r'^\s*(CHAPTER|Chapter|CHAP\.?|Chap[.,]|CANTO|Canto|BOOK|Book)\s+([A-Za-z0-9]{1,9})[.,*:;\s]{0,4}(.{0,80})$')

def is_heading(ln):
    m = HEAD_RX.match(ln)
    if not m: return None
    kind, num, rest = m.group(1).lower().rstrip('.,'), m.group(2), m.group(3).strip()
    if kind in ('chapter', 'canto', 'book') and len(rest) > 6 and not kind.startswith('chap.'):
        return None  # TOC-style lines ("Chapter V.— Creation of ...") are long; body headings are short
    if kind in ('chap',) and rest and len(rest) > 70: return None
    c = candidates(num)
    if not c: return None
    return kind, c, rest

def clean_lines(text, header):
    hdr = re.compile(r'^\s*(THE\s+)?' + header + r'.{0,25}$', re.I)
    out = []
    for ln in text.replace('\r', '').split('\n'):
        s = ln.strip()
        if re.fullmatch(r'[\d\s.,*()\[\]ivxlIVXL|«»"\'-]{0,8}', s): out.append(''); continue  # page numbers / noise
        if hdr.match(s): out.append(''); continue  # running headers
        if re.match(r'^[*†‡f§]\s', s): out.append(''); continue  # footnotes
        s = re.sub(r'\s{2,}', ' ', s)
        out.append(s)
    return out

def paragraphs(lines):
    paras, cur = [], []
    for s in lines:
        if not s:
            if cur and re.search(r'[.?!:;"\')]$', cur[-1]): paras.append(cur); cur = []
            continue
        cur.append(s)
    if cur: paras.append(cur)
    res = []
    for p in paras:
        t = ''
        for s in p:
            if t.endswith('-') and s[:1].islower(): t = t[:-1] + s
            else: t = (t + ' ' + s) if t else s
        t = re.sub(r'\s+([,.;:!?])', r'\1', t)
        t = re.sub(r'[|«»~^_]+', '', t)
        t = re.sub(r'\s{2,}', ' ', t).strip()
        if len(t) > 2: res.append(t)
    return res

def chain(heads, floor):
    # heads: [(line_idx, kind, set(values), rest)] -> longest chain of strictly increasing values with gaps <= 8
    opts = [(i, v) for i, h in enumerate(heads) for v in sorted(h[2]) if v > floor and v < 1000]
    best = {}  # (i,v) -> (length, prev)
    for a, (i, v) in enumerate(opts):
        L, prev = 1, None
        for b in range(a):
            j, w = opts[b]
            if j < i and w < v <= w + 8 and best[(j, w)][0] + 1 > L: L, prev = best[(j, w)][0] + 1, (j, w)
        if L == 1 and v > floor + 12: L = 0  # a chain must start near the expected number
        best[(i, v)] = (L, prev)
    if not best: return []
    end = max(best, key=lambda k: best[k][0]); out = []
    while end: out.append(end); end = best[end][1]
    return [(heads[i], v) for i, v in reversed(out)]

def fix_title(t):
    t = re.sub(r'[•*†]', '', t)
    t = re.sub(r'\bOp\b', 'of', t, flags=re.I); t = re.sub(r'\bOe\b', 'or', t, flags=re.I)
    return re.sub(r'\s+([,;])', r'\1', t).strip(' .;,').title().replace("'S", "'s")

def build(bid, cfg):
    sections = []
    floor = 0
    for f in cfg['files']:
        lines = clean_lines(open(f'{EN}/in.ernet.dli.2015.{f}.txt', encoding='utf-8', errors='ignore').read(), cfg['header'])
        heads = []
        for i, ln in enumerate(lines):
            h = is_heading(ln) if ln else None
            if h and (h[0] != 'book' or bid == 'vishnu'): heads.append((i, h[0], h[1], h[2]))
        if bid == 'vishnu':
            # Books reset chapter numbers: keep Book headings + 'Chap. N. Title' headings in order
            book = 0; marks = []
            for i, kind, c, rest in heads:
                if kind == 'book':
                    nb = min(c, key=lambda v: abs(v - (book + 1)))
                    if nb == book + 1 and i > len(lines) * .02: book = nb; marks.append((i, f'Book {to_roman(book)}'))
                elif book and rest and len(rest) > 3:
                    v = min(c, key=lambda v: v); marks.append((i, f'Book {to_roman(book)} · Chapter {to_roman(v)} · {fix_title(rest)}'))
        else:
            ch = chain(heads, floor)
            marks = []
            for (i, kind, c, rest), v in ch:
                marks.append((i, ('Canto' if kind == 'canto' else 'Chapter') + f' {to_roman(v)}'))
            if ch: floor = ch[-1][1]
        for k, (i, label) in enumerate(marks):
            j = marks[k + 1][0] if k + 1 < len(marks) else len(lines)
            ps = paragraphs(lines[i + 1:j])
            if sum(len(p.split()) for p in ps) > 40 or label.startswith('Book') and k + 1 < len(marks):
                if ps or not label.startswith('Book'): sections.append({'h': label, 'paras': ps})
            elif sections and ps: sections[-1]['paras'].extend(ps)
    sections = [s for s in sections if s['paras']]
    # passages ~120-180 words
    passages = []
    for si, s in enumerate(sections):
        acc = []
        for p in s['paras']:
            acc.append(p)
            if sum(len(x.split()) for x in acc) >= 120:
                passages.append({'s': si, 't': ' '.join(acc)}); acc = []
        if acc:
            if passages and passages[-1]['s'] == si and sum(len(x.split()) for x in acc) < 50: passages[-1]['t'] += ' ' + ' '.join(acc)
            else: passages.append({'s': si, 't': ' '.join(acc)})
    words = sum(len(p.split()) for s in sections for p in s['paras'])
    doc = {'id': bid, 'lang': 'en', 'title': cfg['title'], 'by': cfg['by'], 'year': cfg['year'],
           'source': 'archive.org (public domain scan, OCR)', 'sources': [f'https://archive.org/details/in.ernet.dli.2015.{f}' for f in cfg['files']],
           'sections': [{'h': s['h'], 'p': s['paras']} for s in sections]}
    json.dump(doc, open(f'{OUT}/en_{bid}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{bid}: {len(sections)} sections, {len(passages)} passages, {words} words, {os.path.getsize(f"{OUT}/en_{bid}.json")//1024}KB')
    return passages

def to_roman(n):
    vals = [(1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'), (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'), (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')]
    s = ''
    for v, r in vals:
        while n >= v: s += r; n -= v
    return s

if __name__ == '__main__':
    allp = []
    for bid, cfg in BOOKS.items():
        for p in build(bid, cfg): allp.append({'b': bid, **p})
    json.dump(allp, open(f'{OUT}/en_passages_raw.json', 'w'), ensure_ascii=False)
    print('total passages', len(allp))
