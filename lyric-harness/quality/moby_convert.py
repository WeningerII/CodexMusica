#!/usr/bin/env python3
"""THE MOBY CONVERTER: Moby Pronunciator II (Project Gutenberg #3205,
`mpron.txt`) to CMUdict ARPAbet, every lossy or conventional step logged per row.

    python3 quality/moby_convert.py --check            # staged mpron.txt
    python3 quality/moby_convert.py --check --mpron=PATH

WHAT IT IS FOR. Candidate readings for the reviewed lexicon supplement
(quality/lexicon_supplement.py). It writes NO supplement row: a converted
reading is a candidate until a reviewer who did not author it accepts it into
a new frozen version, under the source key `moby:3205:attested`. Nothing at
runtime imports this file.

THE LEGEND IS THE ONLY AUTHORITY. Symbols are mapped by aaREADME.txt's own
legend; a symbol outside it is REJECTED, never guessed. The three extensions
the source uses without documenting (`[@]`, `ju`, `/&//U/`) are counted
separately as `ext:*` so each can be vetoed. Foreign sounds (x, y, Y, R)
reject the row. A row the rules cannot settle (`[@]` with no adjacent r,
OW before an intervocalic r, a polysyllable with no primary mark) is held
as `review:*`, not converted. Monosyllables, which Moby leaves unmarked, take
primary stress by a counted `convention:*`.

THE CONVERSION LOGIC BELOW IS THE REVIEWED v2 CONVERTER, kept verbatim
(recovered byte-exact, sha256 22e9d165...4de8, 2026-10-11). Its pinned output
on the pinned input is the regression `--check` and
quality/test_moby_convert.py hold it to.

THE INPUT IS STAGED, NOT COMMITTED. mpron.txt is read from the staged data
directory (`quality/features.DATA`, overridable by LYRIC_STAGED_DATA) at
`moby/mpron.txt`, or from --mpron. Its sha256 must be MPRON_SHA256 (the
file data/sources.tsv's `moby:3205:attested` row cites); a missing file is
CANNOT TELL (exit 2), a different file is a refusal (exit 1).
"""
import argparse
import collections
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

MPRON_SHA256 = "55580c3b258873723fed33497fe3a438b26167370bbe016431b3fc65fea67f2d"

#: The converter's pinned output on the pinned mpron.txt (policy owr=review,
#: schwa=all). A change to any rule moves these, and must be argued as one.
PINNED_COUNTS = {
    "converted rows": 87449,
    "distinct converted headwords": 86785,
    "headwords absent from CMUdict": 59300,
}

LEGEND_V={'&':'AE','(@)':'EH','A':'AA','eI':'EY','@':'AH','-':'AH','E':'EH','i':'IY','I':'IH','aI':'AY',
          'Oi':'OY','AU':'AW','O':'AO','oU':'OW','u':'UW','U':'UH','@r':'ER'}
EXT_V={'[@]':'ER*','ju':'Y UW'}          # not in legend; '[@]' becomes ER only before an adjacent r, else held
LEGEND_C={'b':'B','tS':'CH','d':'D','f':'F','g':'G','h':'HH','hw':'W','dZ':'JH','k':'K','l':'L','m':'M',
          'N':'NG','n':'N','p':'P','r':'R','S':'SH','s':'S','T':'TH','D':'DH','t':'T','v':'V','w':'W','j':'Y',
          'Z':'ZH','z':'Z'}
FOREIGN={'x','y','Y','R'}                 # legend's non-English sounds -> reject (foreign words go to review)
def tokens(p, log):
    out=[]; pend=None
    for piece in p.split('/'):
        if not piece: continue
        sym=piece.strip("',")
        if sym in LEGEND_V or sym in EXT_V:
            if piece!=sym and piece[0] in "',": pend='1' if piece[0]=="'" else '2'; out.append(['|',None])
            if sym in EXT_V: log.add('ext:'+sym)
            for ph in (LEGEND_V.get(sym) or EXT_V[sym]).split():
                glide = sym=='-'
                if ph in ('Y',): out.append([ph,None])
                else: out.append([ph,pend or '0']+(['g'] if glide else [])); pend=None
            continue
        i=0
        while i<len(piece):
            c=piece[i]
            if c=="'": pend='1'; out.append(['|',None]); i+=1; continue
            if c==',': pend='2'; out.append(['|',None]); i+=1; continue
            if c=='_': out.append(['|',None]); i+=1; continue   # hyphen joint: a boundary, no stress
            if c in FOREIGN: log.add('reject:foreign'); return None
            two=piece[i:i+2]
            if two in ('tS','dZ','hw'): out.append([LEGEND_C[two],None]); i+=2; continue
            if c in LEGEND_C: out.append([LEGEND_C[c],None]); i+=1; continue
            log.add('reject:non-legend char'); return None
    return out
def convert(p, log, owr='review', hyph=False, schwa='all', w=None):
    if '_' in p:
        if not hyph or p.count('_')!=w.count('-'): log.add('reject:phrase'); return None
        log.add('hyphen:_ kept as a word-joint boundary')
    if '/&//U/' in p: log.add('ext:/&//U/ -> AW'); p=p.replace('/&//U/','/AU/')   # undocumented spelling of the legend's /AU/ ("how")
    out=tokens(p,log)
    if out is None: return None
    dd=[]
    for x in out:
        if dd and x[0]=='|' and dd[-1][0]=='|': continue   # adjacent joint + stress mark: one boundary
        if dd and x[1] is None and dd[-1][1] is None and dd[-1][0]==x[0]: log.add('rule:double-consonant'); continue
        dd.append(x)
    out=dd; res=[]; k=0
    isv=lambda x: x is not None and x[1] is not None and x[0]!='|'
    while k<len(out):
        ph,st=out[k][:2]; g=out[k][2:]; nxt=out[k+1] if k+1<len(out) else None; nn=out[k+2] if k+2<len(out) else None
        if ph=='ER*':
            if nxt and nxt[0]=='R': res.append(['ER',st]); log.add('rule:[@]r->ER (adjacent r)'); k+=2; continue
            log.add('review:[@] without adjacent r (%s)'%('stress boundary before r' if nxt and nxt[0]=='|' and nn and nn[0]=='R' else 'no r')); return None
        if ph=='ER' : res.append(['ER',st]); k+=1; continue
        coda = nxt is not None and nxt[0]=='R' and not isv(nn)   # adjacency only: Moby marks stressed onsets, not every syllable joint
        if st is not None and ph=='AH' and nxt and nxt[0]=='R' and st=='0' and (coda or schwa=='all'):
            res.append(['ER','0']+g); log.add('rule:unstressed schwa+r->ER ('+('coda' if coda else 'intervocalic')+')'); k+=2; continue
        if owr=='review' and st is not None and ph=='OW' and nxt and nxt[0]=='R' and not coda:
            log.add('review:OW before intervocalic r (FORCE vowel or morpheme joint, e.g. glory vs showroom)'); return None
        if st is not None and ph=='OW' and nxt and nxt[0]=='R' and (owr in ('all','review') or (owr=='coda' and coda)):
            res.append(['AO',st]); log.add('rule:OW+r->AO r ('+('coda' if coda else 'intervocalic')+')'); k+=1; continue
        res.append([ph,st]+g); k+=1
    res=[x for x in res if x[0]!='|']
    vow=[x for x in res if x[1] is not None]
    if not vow: log.add('reject:no vowel'); return None
    if not any(x[1]=='1' for x in vow):
        full=[x for x in vow if x[2:]!=['g']]
        if any(x[1]=='2' for x in vow): log.add('review:no primary mark (secondary only)'); return None
        if len(vow)==1 or len(full)==1:
            (full or vow)[0][1]='1'; log.add('convention:monosyllable stress 1 (unmarked in source)'+(' [nucleus + glide]' if len(vow)>1 else ''))
        else: log.add('review:no primary mark (unmarked)'); return None
    return tuple(x[0]+(x[1] if x[1] is not None else '') for x in res)
def load(path, owr='review', keep_logs=False, schwa='all'):
    E=collections.defaultdict(list); C=collections.Counter(); L={}
    for line in open(path,encoding='latin-1'):
        line=line.rstrip('\r\n'); C['raw lines']+=1
        if ' ' not in line: C['x no field delimiter']+=1; continue
        w,p=line.split(' ',1)
        if '/' in w: w=w.split('/')[0]; C['  pos-tagged rows (kept as variants)']+=1
        if '_' in w or ' ' in w: C['x phrase headword']+=1; continue
        if w!=w.lower(): C['x headword not lowercase (held for proper-noun pass)']+=1; continue
        C['lowercase single-word rows']+=1
        log=set(); a=convert(p,log,owr,'-' in w,schwa,w)
        for t in log: C[t]+=1
        if a: E[w].append(a); C['converted rows']+=1
        if keep_logs: L.setdefault(w,[]).append((p,a,sorted(log)))
    C['distinct converted headwords']=len(E)
    return (E,C,L) if keep_logs else E


def staged_mpron():
    from quality.features import DATA
    return os.path.join(DATA, "moby", "mpron.txt")


def check(path):
    """-> (exit code, report lines)."""
    if not os.path.exists(path):
        return 2, [f"CANNOT TELL: mpron.txt is not staged at {path}"]
    with open(path, "rb") as fh:
        got = hashlib.sha256(fh.read()).hexdigest()
    if got != MPRON_SHA256:
        return 1, [f"REFUSED: {path} sha256 {got}, expected {MPRON_SHA256}"]
    import lyric_harness as LH
    E, C, _logs = load(path, keep_logs=True)
    cmu = LH.Lexicon().entries
    measured = {"converted rows": C["converted rows"],
                "distinct converted headwords": len(E),
                "headwords absent from CMUdict": sum(1 for w in E if w not in cmu)}
    lines = [f"mpron.txt sha256 {got}"]
    ok = True
    for k, want in PINNED_COUNTS.items():
        lines.append(f"  {k}: {measured[k]} (pinned {want})")
        ok = ok and measured[k] == want
    lines.append("RESULT: " + ("PASS" if ok else "MOVED -- a conversion rule changed"))
    return (0 if ok else 1), lines


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", required=True)
    ap.add_argument("--mpron", help="mpron.txt path (default: the staged copy)")
    a = ap.parse_args(argv)
    code, lines = check(a.mpron or staged_mpron())
    print("\n".join(lines))
    return code


if __name__ == "__main__":
    sys.exit(main())
