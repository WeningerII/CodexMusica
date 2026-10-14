"""Identity-level diff of two `audit_corpus.py --json` outputs.
usage: audit_diff.py BASE.json HEAD.json
Identity = (check, severity, path, what, measured). A finding whose
(check, severity, path, what) survives but whose `measured` changed is
reported as CHANGED, not as one removal plus one addition."""
import json, sys, collections
def load(p):
    f = json.load(open(p))["findings"]
    full = collections.Counter((x["check"], x["severity"], x["path"], x["what"], x.get("measured")) for x in f)
    return f, full
bf, b = load(sys.argv[1]); hf, h = load(sys.argv[2])
added = h - b; removed = b - h
loose = lambda c: collections.Counter(k[:4] for k in c.elements())
la, lr = loose(added), loose(removed)
changed = la & lr
for k in changed.elements():
    pass
print("base", collections.Counter(x["severity"] for x in bf), "head", collections.Counter(x["severity"] for x in hf))
def show(title, c, skip):
    rows = [k for k in c.elements() if k[:4] not in skip]
    print(f"{title}: {len(rows)}")
    for k in sorted(rows): print("  ", k[0], k[1], k[2], "|", k[3][:90], "|", (k[4] or "")[:80])
show("ADDED", added, changed); show("REMOVED", removed, changed)
print(f"CHANGED (same check/severity/path/what, measured differs): {sum(changed.values())}")
for k in sorted(changed.elements()):
    old = [m[4] for m in removed.elements() if m[:4] == k]; new = [m[4] for m in added.elements() if m[:4] == k]
    print("  ", k[0], k[1], k[2], "|", k[3][:70], "| old", old[:2], "| new", new[:2])
print("by check (head - base):", {c: v for c, v in (collections.Counter((x['check'], x['severity']) for x in hf) - collections.Counter((x['check'], x['severity']) for x in bf)).items()},
      "| (base - head):", dict(collections.Counter((x['check'], x['severity']) for x in bf) - collections.Counter((x['check'], x['severity']) for x in hf)))
