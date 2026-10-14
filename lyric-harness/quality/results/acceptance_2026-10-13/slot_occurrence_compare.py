"""Compare two `slot_occurrence.py` record dumps of the same population, case
by case, every field, and write a reviewable receipt.

    python3 slot_occurrence_compare.py OLD.jsonl.gz NEW.jsonl.gz OUT.json [OLD_TAG NEW_TAG]

A case is (mode, line, slot); excluded-line placeholders (slot null) are keyed
(mode, line, None) and compared too. It reports:
- the sha256 of each uncompressed stream and its record count;
- per reader scheme: cases, excluded placeholders, evaluated records, and how
  many are EQUAL IN EVERY FIELD (the parsed JSON records compare equal; this
  is not a byte comparison of the record lines, whose stream hashes are
  given separately);
- the readable default-end check: v2 `end` records reading `occ_agree` in
  OLD, and how many are equal in every field in NEW;
- the complete change set: every case whose record differs, with both
  records, and a count by (mode, slot, old occurrence -> new occurrence).
A dump holding the same case twice is refused, never silently overwritten.
Read-only.
"""
import collections, gzip, hashlib, json, sys


def load(path):
    raw = gzip.open(path, "rb").read()
    recs = {}
    for line in raw.decode("utf-8").splitlines():
        if not line:
            continue
        r = json.loads(line)
        k = (r["mode"], r["line"], r["slot"])
        if k in recs:
            raise SystemExit(f"{path}: duplicate case {k!r}; a dump must hold one record per case")
        recs[k] = r
    return hashlib.sha256(raw).hexdigest(), recs


def main(old_p, new_p, out, old_tag="old", new_tag="new"):
    ho, O = load(old_p)
    hn, N = load(new_p)
    keys = sorted(set(O) | set(N), key=lambda k: (k[0], k[1], str(k[2])))
    scheme = lambda k: k[0].split(":")[0]
    per = collections.defaultdict(lambda: collections.Counter())
    changed, by = [], collections.Counter()
    for k in keys:
        a, b = O.get(k), N.get(k)
        s = per[scheme(k)]
        s["cases"] += 1
        if k[2] is None:
            s["excluded_placeholders"] += 1
        else:
            s["evaluated"] += 1
        if a == b:
            s["identical"] += 1
            continue
        s["different"] += 1
        by[(k[0], str(k[2]), (a or {}).get("occurrence"), (b or {}).get("occurrence"))] += 1
        changed.append({"mode": k[0], "line": k[1], "slot": k[2], old_tag: a, new_tag: b})
    readable = [k for k in keys if k[0].startswith("cur:") and k[2] == "end"
                and (O.get(k) or {}).get("occurrence") == "occ_agree"]
    rec = {"streams": {old_tag: {"path": old_p, "uncompressed_sha256": ho, "records": len(O)},
                       new_tag: {"path": new_p, "uncompressed_sha256": hn, "records": len(N)}},
           "per_scheme": {s: dict(c) for s, c in sorted(per.items())},
           "readable_default_end": {"what": f"v2 `end` records reading occ_agree in {old_tag}",
                                    "count": len(readable),
                                    "identical_in_new": sum(1 for k in readable if O.get(k) == N.get(k))},
           "change_counts": {f"{m} | {s} | {a} -> {b}": n for (m, s, a, b), n in sorted(by.items(), key=str)},
           "changed": changed}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(json.dumps({k: rec[k] for k in ("streams", "per_scheme", "readable_default_end", "change_counts")},
                     indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:6])
