#!/usr/bin/env python3
"""BB8 driver: run revise_loop with the stock tier-2 stub
(`default_propose_group`) explicitly declared, a tier-1 proposer that
declines everything (so tier 2 is reached), and a --voices lexicon
(strip_parens=False). argv: MODE OUT.json, MODE in base|v1|v2. Run with cwd =
<tree>/lyric-harness. 'base' builds the pre-batch Lexicon (no scheme
parameter); v1/v2 build the candidate's under reader_scheme_scope(MODE)."""
import contextlib, dataclasses, json, sys
sys.path.insert(0, ".")
import lyric_harness as LH
from quality import loop as LP
from quality.revise import Reviser
mode, out_path = sys.argv[1], sys.argv[2]
lines = [l.rstrip("\n") for l in open(sys.argv[3], encoding="utf-8")]
groups = json.loads(sys.argv[4])
kw = {} if mode == "base" else {"reader_scheme": mode}
scope = contextlib.nullcontext() if mode == "base" else LH.reader_scheme_scope(mode)
calls = []
def enc(x):
    if dataclasses.is_dataclass(x):
        return {f.name: enc(getattr(x, f.name)) for f in dataclasses.fields(x)}
    if isinstance(x, dict): return {str(k): enc(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, set, frozenset)):
        v = [enc(i) for i in x]; return sorted(v, key=repr) if isinstance(x, (set, frozenset)) else v
    if isinstance(x, (str, int, float, bool)) or x is None: return x
    return repr(x)
def pg(gb):
    out = LP.default_propose_group(gb)
    calls.append({"members": enc(gb.members),
                  "proposals": {str(m): enc(gb.proposal_for(m)) for m in gb.members},
                  "brief": enc(gb), "out": enc(out)})
    return out
with scope:
    lex = LH.Lexicon(strip_parens=False, **kw)
    rv = Reviser(lex=lex)
    m = rv.mandate(lines, groups)
    res = LP.revise_loop(rv, lines, m, propose=lambda *a, **k: None, propose_group=pg)
rec = {"mode": mode, "stop": res.stop_reason, "lines": res.lines,
       "rounds": [[(a.line_no, a.tier, a.accepted, a.tried, a.reason, list(a.touched))
                   for a in r.attempts] for r in res.rounds],
       "group_calls": calls}
json.dump(rec, open(out_path, "w"), ensure_ascii=False, indent=1, sort_keys=True)
print(mode, rec["stop"], rec["lines"], "group calls:", len(calls),
      [(c["members"], c["proposals"], c["out"]) for c in calls])
