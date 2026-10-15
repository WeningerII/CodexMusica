import sys, json
sys.path.insert(0, sys.argv[1] + "/probes")
from cli import run
tree = sys.argv[2]; draft = sys.argv[3]
L1 = "I 2 love you love"; L3 = "Oh--oh, oh my love"
def row(tok, word="love", line=L1, numbering=None, order=None, source="probe"):
    r = {"line": line, "token": tok, "word": word, "phones": ["L","AH1","V"], "basis": "dictionary", "source": source}
    if numbering: r["numbering"] = numbering
    if order == "rev": r = dict(reversed(list(r.items())))
    return r
def norm(scheme, prons=None, groups=None, returns=None, numbering=None, voices=False):
    argv = []
    if voices: argv.append("--voices")
    if numbering: argv.append(f"--numbering={numbering}")
    if prons is not None: argv.append("--pronunciations=" + json.dumps(prons))
    argv += [f"--reader-scheme={scheme}", "normalize-numbering", draft]
    if groups: argv.append(f"--groups={groups}")
    if returns: argv.append(f"--returns={returns}")
    rc, rec, out, err = run(tree, argv)
    return (rec or {}).get("canonical_declarations") or (rec or {}).get("refusal") or (out[-300:] + err[-300:])
cases = [
 ("v2 P0 unmarked v1-only tok4", "v2", dict(prons=[row(4)])),
 ("v2 P1 marked v2 tok5", "v2", dict(prons=[row(5, numbering="v2")])),
 ("v2 P2 marked v1 tok4", "v2", dict(prons=[row(4, numbering="v1")])),
 ("v2 P3 marked v1 tok2 (other love)", "v2", dict(prons=[row(2, numbering="v1")])),
 ("v2 P4 marked v2 tok5 reversed keys", "v2", dict(prons=[row(5, numbering="v2", order="rev")])),
 ("v2 P5 marked v2+voices tok5", "v2", dict(prons=[row(5, numbering="v2+voices")])),
 ("v2 P6 unmarked oh tok2 (ambiguous)", "v2", dict(prons=[row(2, word="oh", line=L3, )])),
 ("v1 Q0 unmarked tok4", "v1", dict(prons=[row(4)])),
 ("v1 Q1 marked v2 tok5", "v1", dict(prons=[row(5, numbering="v2")])),
 ("v1 Q2 marked v1 tok4", "v1", dict(prons=[row(4, numbering="v1")])),
 ("v2 G0 groups 1.T5 numbering v2", "v2", dict(groups="1.T5,2.end", numbering="v2")),
 ("v2 G1 groups 1.T4 numbering v1", "v2", dict(groups="1.T4,2.end", numbering="v1")),
 ("v2 G2 groups 1.T5 unmarked", "v2", dict(groups="1.T5,2.end")),
 ("v2 G3 groups ' 1.T5 , 2.end ;; ' numbering v2", "v2", dict(groups=" 1.T5 , 2.end ;; ", numbering="v2")),
 ("v2 G4 groups 01.T5 numbering v2", "v2", dict(groups="01.T5,2.end", numbering="v2")),
 ("v1 G5 groups 1.T9 unmarked (out of range)", "v1", dict(groups="1.T9,2.end")),
]
for name, sch, kw in cases:
    print(name, "=>", json.dumps(norm(sch, **kw), ensure_ascii=False))
