"""Parse every (groups, returns) declaration pair the pages put on the wire to
/chat with each harness tree's OWN mandate parser, the way the CLI does
(lyric_harness.py: `_groups` splits on ';' then ',', then
`quality.schemes.mandate(g, n_lines, returns=r)`; groups alone ->
`mandate(g, n_lines)`). Adapted from
findings_67889851/repro/returns_nend/payload_and_mandate.py (same _groups and
mandate call; adds the groups side and runs per pair). Read-only.

    python -I mandate_probe.py PAIRS.json OUT.json N_LINES TAG=HARNESS_ROOT ...
"""
import json
import subprocess
import sys

PROBE = r"""
import json, sys
sys.path.insert(0, sys.argv[1])
from quality import schemes as SC
def _groups(raw):
    return [[x.strip() for x in g.split(",") if x.strip()] for g in raw.split(";") if g.strip()]
n = int(sys.argv[3])
out = {}
for pair in json.loads(sys.argv[2]):
    groups, returns = pair
    key = json.dumps(pair, ensure_ascii=False)
    g = _groups(groups) if groups else []
    r = _groups(returns) if returns else []
    try:
        m = SC.mandate(g, n_lines=n, returns=r) if r else SC.mandate(g, n_lines=n)
        rets = [{"lines": list(x.lines), "loci": list(getattr(x, "loci", ()) or ()),
                 "kind": "placed" if getattr(x, "loci", ()) else "whole_line",
                 "verbatim": repr(x.verbatim), "origin": x.origin} for x in m.returns]
        grp = []
        loci = m.loci if isinstance(m.loci, tuple) else ()
        for k, lines in enumerate(m.groups):
            sl = loci[k] if k < len(loci) and isinstance(loci[k], tuple) else ()
            grp.append({"lines": list(lines),
                        "slots": [getattr(getattr(s, "rule", None), "locus", None) for s in sl]})
        out[key] = {"returns": rets, "groups": grp}
    except SC.NoMandate as exc:
        out[key] = {"refused": str(exc)}
    except Exception as exc:  # recorded, never hidden
        out[key] = {"error": f"{type(exc).__name__}: {exc}"}
print(json.dumps(out))
"""


def main(pairs_json, out, n_lines, *roots):
    keys = json.load(open(pairs_json, encoding="utf-8"))
    parsed = {}
    for spec in roots:
        tag, root = spec.split("=", 1)
        r = subprocess.run([sys.executable, "-I", "-c", PROBE, root, json.dumps(keys), n_lines],
                           capture_output=True, text=True, cwd=root)
        if r.returncode:
            raise SystemExit(f"{tag}: {r.stderr}")
        parsed[tag] = json.loads(r.stdout)
    json.dump(parsed, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"parsed {len(keys)} pairs in {', '.join(parsed)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
