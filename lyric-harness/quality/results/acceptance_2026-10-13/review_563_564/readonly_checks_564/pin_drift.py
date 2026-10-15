import json, subprocess, sys, os
root = sys.argv[1]
m = json.load(open(os.path.join(root, "lyric-harness/library/catalog_sources.json")))
tree = m["tree"]; drift = []; missing = []
for e in tree:
    p = os.path.join(root, e["path"])
    if not os.path.exists(p): missing.append(e["path"]); continue
    sha = subprocess.run(["git", "hash-object", "--no-filters", p], capture_output=True, text=True).stdout.strip()
    if sha != e["sha"]: drift.append((e["path"], e["sha"][:12], sha[:12], e.get("size"), os.path.getsize(p)))
print(f"repository_commit {m['repository_commit']}  pinned paths {len(tree)}  drifted {len(drift)}  missing {len(missing)}")
for d in drift: print("DRIFT", d[0], "pinned", d[1], "now", d[2], "size", d[3], "->", d[4])
for x in missing: print("MISSING", x)
