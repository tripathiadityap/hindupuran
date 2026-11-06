import re, itertools, json, sys
R = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
def roman(s):
    tot = 0; prev = 0
    for ch in reversed(s):
        v = R.get(ch)
        if v is None: return None
        tot = tot - v if v < prev else tot + v; prev = max(prev, v)
    return tot
AMB = {'L': 'LI', 'l': 'I', '1': 'I', 'T': 'I', 'i': 'I', 'J': 'I', 'N': 'X', 'K': 'X', 'B': 'I', 't': 'I', 'Y': 'V', 'U': 'II', 'H': 'II', 'Z': 'I'}
def candidates(tok):
    tok = re.sub(r'[^A-Za-z0-9]', '', tok)[:10]
    opts = [AMB.get(c, c.upper()) if c not in 'IVXLCDM' or c == 'L' else (c if c != 'L' else 'LI') for c in tok]
    out = set()
    for combo in itertools.product(*[list(o) if len(o) > 1 and o != 'II' else [o] for o in opts]):
        v = roman(''.join(combo))
        if v: out.add(v)
    if tok.isdigit(): out.add(int(tok))
    return out
HEAD = {
  'chapter': re.compile(r'^\s*(?:CHAPTER|Chapter|CHAP\.?)\s+([A-Za-z0-9]{1,10})[.,*:;\s]{0,4}\S{0,6}\s*$'),
  'canto': re.compile(r'^\s*CANTO\s+([A-Za-z0-9]{1,10})[.,*:;\s]{0,4}\S{0,6}\s*$', re.I),
}
def find_chapters(lines, kind, start=1):
    rx = HEAD[kind]; heads = []; expect = start
    for i, ln in enumerate(lines):
        m = rx.match(ln)
        if not m: continue
        c = candidates(m.group(1))
        if expect in c: heads.append((i, expect)); expect += 1
        elif any(expect < v <= expect + 3 for v in c):
            v = min(v for v in c if expect < v <= expect + 3); heads.append((i, v)); expect = v + 1
    return heads
if __name__ == '__main__':
    for f, kind in [(a, b) for a, b in (x.split(':') for x in sys.argv[1:])]:
        lines = open(f, encoding='utf-8', errors='ignore').read().split('\n')
        best = None
        for s in (1, 2):
            h = find_chapters(lines, kind, s)
            if not best or len(h) > len(best): best = h
        # also try starting anywhere: find first plausible head number
        nums = [candidates(re.match(HEAD[kind], l).group(1)) for l in lines if HEAD[kind].match(l)]
        firsts = sorted(min(c) for c in nums[:40] if c)[:1]
        for s in set([n for c in nums[:60] for n in c if n < 400]):
            h = find_chapters(lines, kind, s)
            if len(h) > len(best): best = h
        print(f, kind, 'n=', len(best), 'range', best[0][1] if best else None, '-', best[-1][1] if best else None)
