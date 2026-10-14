"""The ACTUAL payload each page sent and the mandate each harness PARSES
from it, for the returns rows of `verify-page-matrix-2/page_end_returns.json`.

    python3 payload_and_mandate.py PAGE_END_RETURNS.json OUT.json TAG=HARNESS_ROOT...

For every page case (tree, row) it takes the `returns` string the page put
on the wire to /chat (`sent`, recorded by the stubbed endpoint, not the
durable row label), and for every harness root given it calls that tree's
own mandate parser in a fresh process, the way the CLI's `--returns=`
does (`lyric_harness.py`: `_groups` splits on `;` and `,`, then
`quality.schemes.mandate([], n_lines=8, returns=...)`): each parsed return
class's lines, placements (`loci`, empty for a whole-line class), verbatim
flag and origin, or the refusal text. 8 is the line count of
`verify-page-matrix-2/harness/song8.txt`. Read-only.
"""
import json, subprocess, sys

PROBE = r"""
import json, sys
sys.path.insert(0, sys.argv[1])
from quality import schemes as SC
def _groups(raw):
    return [[x.strip() for x in g.split(",") if x.strip()] for g in raw.split(";") if g.strip()]
out = {}
for spec in json.loads(sys.argv[2]):
    try:
        m = SC.mandate([], n_lines=8, returns=_groups(spec))
        out[spec] = [{"lines": list(r.lines), "loci": list(getattr(r, "loci", ()) or ()),
                      "kind": "placed" if getattr(r, "loci", ()) else "whole_line",
                      "verbatim": repr(r.verbatim), "origin": r.origin} for r in m.returns]
    except SC.NoMandate as exc:
        out[spec] = {"refused": str(exc)}
print(json.dumps(out))
"""


def main(page_json, out, *roots):
    cases = json.load(open(page_json, encoding="utf-8"))
    sent = sorted({s["returns"] for c in cases for s in c.get("sent", []) if s.get("returns")})
    parsed = {}
    for spec in roots:
        tag, root = spec.split("=", 1)
        r = subprocess.run([sys.executable, "-I", "-c", PROBE, root, json.dumps(sent)],
                           capture_output=True, text=True, cwd=root)
        if r.returncode:
            raise SystemExit(f"{tag}: {r.stderr}")
        parsed[tag] = json.loads(r.stdout)
    rows = [{"tree": c["tree"], "case": c["name"], "written": c["written"],
             "row_after_load": (c.get("after") or c.get("before") or {}).get("rows"),
             "sent": [s.get("returns") for s in c.get("sent", [])]} for c in cases]
    json.dump({"page_cases": rows, "parsed_by_harness": parsed}, open(out, "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    for r in rows:
        print(f"[{r['tree']}] {r['case']}\n  written {r['written']}\n  sent    {r['sent']}")
        for tag, p in parsed.items():
            for s in r["sent"]:
                print(f"    {tag}: {s!r} -> {json.dumps(p.get(s), ensure_ascii=False)}")


if __name__ == "__main__":
    main(*sys.argv[1:])
