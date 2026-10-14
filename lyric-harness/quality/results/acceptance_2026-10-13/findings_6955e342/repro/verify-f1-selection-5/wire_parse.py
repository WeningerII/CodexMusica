"""Parse each wire `returns`/`groups` string with a harness tree's own mandate
parser, the way the CLI's --returns= / --groups= do (split on ';' then ','),
to check that the candidate's wire spelling '1.end,2.end' carries the same
obligation as main's '1.end, 2.end'. Read-only. Usage: python -I wire_parse.py ROOT"""
import json, sys
sys.path.insert(0, sys.argv[1])
from quality import schemes as SC
def _groups(raw):
    return [[x.strip() for x in g.split(",") if x.strip()] for g in raw.split(";") if g.strip()]
out = {}
for spec in ["1.end, 2.end", "1.end,2.end", "1,2", "1.T3, 2.end", "1.T3,2"]:
    try:
        m = SC.mandate([], n_lines=8, returns=_groups(spec))
        out[spec] = [{"lines": list(r.lines), "loci": [str(x) for x in (getattr(r, "loci", ()) or ())],
                      "kind": "placed" if getattr(r, "loci", ()) else "whole_line"} for r in m.returns]
    except Exception as exc:
        out[spec] = {"refused": f"{type(exc).__name__}: {exc}"}
print(json.dumps(out, ensure_ascii=False, indent=1))
