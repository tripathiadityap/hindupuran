# Build Sanskrit (IAST) texts from GRETIL TEI. Licence: CC BY-NC-SA 4.0 (GRETIL).
import re, json, os, html
SA = os.path.expanduser('~/corpus/sa'); OUT = os.path.expanduser('~/corpus/out')
FILES = {
  'agni': (['sa_agnipurANa'], None), 'bhagavata': (['sa_bhAgavatapurANa'], ('Skandha', 'Adhyāya')),
  'brahma': (['sa_brahmapurANa-1-246'], None), 'brahmanda': (['sa_brahmANDapurANa'], ('Pāda', 'Adhyāya')),
  'garuda': (['sa_garuDapurANa'], ('Khaṇḍa', 'Adhyāya')), 'kurma': (['sa_kUrmapurANa'], ('Bhāga', 'Adhyāya')),
  'linga': (['sa_liGgapurANa1-108'], ('Bhāga', 'Adhyāya')), 'markandeya': (['sa_mArkaNDeyapurANa1-93'], None),
  'matsya': (['sa_matsyapurANa1-176'], None), 'narada': (['sa_nAradapurANa'], ('Bhāga', 'Adhyāya')),
  'shiva': (['sa_zivapurANabooks-1-and-7'], ('Saṃhitā', 'Adhyāya')), 'skanda': (['sa_skandapurANa-revAkhaNDa-rks'], None),
  'vamana': (['sa_vAmanapurANa1-69'], None), 'vishnu': (['sa_viSNupurANa'], ('Aṃśa', 'Adhyāya')),
}
TITLE = {'skanda': 'Skandapurāṇa · Revākhaṇḍa', 'shiva': 'Śivapurāṇa · books 1 and 7', 'brahma': 'Brahmapurāṇa (1–246)',
         'linga': 'Liṅgapurāṇa · part 1', 'markandeya': 'Mārkaṇḍeyapurāṇa (1–93)', 'matsya': 'Matsyapurāṇa (1–176)', 'vamana': 'Vāmanapurāṇa (1–69)'}
REF = re.compile(r'/+\s*([^\W\d_]\w*_[\w.,]*\d[a-f*]*)\s*/+')
TOK = re.compile(r'<(/?)([\w:]+)\b([^>]*?)/?>|([^<]+)', re.S)

def clean(t):
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t))
    t = re.sub(r'[$&%]', ' ', t)
    t = re.sub(r'\(\d+\)', '', t)
    return re.sub(r'\s+', ' ', t).strip()

def parse(path):
    s = open(path, encoding='utf-8').read()
    b = s.find('<body'); s = s[b:s.find('</body>')]
    out = []  # ('v', ref, [lines]) | ('p', text)
    in_l = in_p = in_lg = False; buf = ''; lg_ref = None; lg_lines = []
    def emit_lines(lines, ref):
        # split a run of lines into verses at inline refs; fall back to the lg ref
        cur = []
        for ln in lines:
            m = REF.search(ln)
            txt = REF.sub(' ', ln).strip().rstrip('/').strip()
            if txt: cur.append(txt)
            if m: out.append(('v', m.group(1), cur)); cur = []
        if cur:
            if ref: out.append(('v', ref, cur))
            elif out and out[-1][0] == 'v': out[-1][2].extend(cur)
            else: out.append(('v', None, cur))
    for m in TOK.finditer(s):
        close, tag, attrs, text = m.group(1), m.group(2), m.group(3), m.group(4)
        if text is not None:
            if in_l or in_p: buf += text
            continue
        if tag == 'lg':
            if not close:
                in_lg = True; lg_lines = []
                mm = re.search(r'xml:id="([^"]+)"', attrs or ''); lg_ref = mm.group(1) if mm else None
            else:
                emit_lines(lg_lines, lg_ref); in_lg = False; lg_lines = []; lg_ref = None
        elif tag == 'l':
            if not close:
                if in_p and buf.strip() and not in_lg: out.append(('p', clean(buf)))
                buf = ''; in_l = True
            else:
                ln = clean(buf); buf = ''; in_l = False
                if in_lg: lg_lines.append(ln)
                else: emit_lines([ln], None)
        elif tag in ('p', 'head'):
            if not close: in_p = True; buf = ''
            else:
                if buf.strip(): out.append(('p', clean(buf)))
                buf = ''; in_p = False
    return out

def chap_key(ref):
    r = (ref.split('_', 1)[1] if '_' in ref else re.sub(r'^\D+', '', ref)).rstrip('*').strip()
    r = re.sub(r'[a-f]+$', '', r)
    if '.' in r: ch, v = r.rsplit('.', 1)
    else: ch, v = r, ''
    ch = '.'.join(str(int(x)) if x.isdigit() else x for x in re.split(r'[.,]', ch))
    v = v.lstrip('0') or v
    return ch, v

def build(pid, files, names):
    chapters, order = {}, []
    pending = []; last = None
    for f in files:
        for item in parse(f'{SA}/{f}.xml'):
            if item[0] == 'p':
                if len(item[1]) < 400: pending.append(item[1])
                continue
            _, ref, lines = item
            lines = [x for x in lines if x]
            if not lines: continue
            if ref is None:
                if last: chapters[last[0]][-1][1] += '\n' + '\n'.join(lines)
                continue
            ch, v = chap_key(ref)
            if ch not in chapters: chapters[ch] = []; order.append(ch)
            for n in pending: chapters[ch].append(['', n])
            pending = []
            text = '\n'.join(lines)
            if last == (ch, v) and chapters[ch] and chapters[ch][-1][0] == v:
                if text not in chapters[ch][-1][1]: chapters[ch][-1][1] += '\n' + text
            else: chapters[ch].append([v, text])
            last = (ch, v)
    for ch in order:  # end each verse with a double danda, half-verses with a single one
        for item in chapters[ch]:
            if item[0]:
                ls = [x.rstrip(' /|').strip() for x in item[1].split('\n')]
                ls = [x for k, x in enumerate(ls) if x and (k == 0 or x != ls[k - 1])]
                item[1] = '\n'.join(x + (' ॥' if k == len(ls) - 1 else ' /') for k, x in enumerate(ls))
    secs = []
    for ch in order:
        parts = ch.split('.')
        if ch.lower().startswith('mang'): label = 'Maṅgala'
        elif names and len(parts) >= 2: label = f'{names[0]} {parts[0]} · {names[1]} {".".join(parts[1:])}'
        else: label = f'Adhyāya {ch}'
        secs.append({'h': label, 'v': chapters[ch]})
    nverse = sum(1 for s in secs for v in s['v'] if v[0])
    doc = {'id': pid, 'lang': 'sa', 'title': TITLE.get(pid, ''), 'script': 'IAST',
           'source': 'GRETIL – Göttingen Register of Electronic Texts in Indian Languages',
           'sources': [f'https://gretil.sub.uni-goettingen.de/gretil/corpustei/{f}.xml' for f in files],
           'licence': 'CC BY-NC-SA 4.0', 'sections': secs}
    json.dump(doc, open(f'{OUT}/sa_{pid}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{pid}: {len(secs)} chapters, {nverse} verses, {os.path.getsize(f"{OUT}/sa_{pid}.json")//1024}KB  first={secs[0]["h"] if secs else None} last={secs[-1]["h"] if secs else None}')

if __name__ == '__main__':
    for pid, (files, names) in FILES.items(): build(pid, files, names)
