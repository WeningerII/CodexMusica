"""Create or check dated source-access metadata for every claim carrying a reference."""
import argparse
import csv
import io
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from evidence import evidence_index, read

def assemble():
    retrieved = read("rechecked-sources.json")
    access = {record["url"]: record for record in retrieved["sources"]}
    receipts = evidence_index()
    output = io.StringIO(newline="")
    tab = csv.writer(output, delimiter="\t", lineterminator="\n")
    tab.writerow(["form", "target_if_relationship", "url", "date_of_this_check", "url_retrieval",
                  "claim_access", "passage_locator", "scoped_paraphrase_or_limit"])
    for path in sorted((ROOT / "audit").glob("*.json")):
        forms = json.loads(path.read_text(encoding="utf-8"))
        for title, form in forms.items():
            scopes = [("", form.get("attested_refs", []))]
            scopes.extend((edge["target"], edge.get("refs", [])) for edge in form["edges"])
            for target, refs in scopes:
                findings = receipts.get((title, target), [])
                for url in dict.fromkeys([*refs, *(r["url"] for r in findings)]):
                    named = [r for r in findings if r["url"] == url]
                    retrieval = access.get(url, {}).get("access", "no global URL retest")
                    if named:
                        for r in named:
                            tab.writerow([title, target, url, r["checked_on"], retrieval, r["access"],
                                          r["locator"], r["passage"]])
                    else:
                        tab.writerow([title, target, url, retrieved["checked_on"] if url in access else "",
                                      retrieval, "inherited citation; claim not independently passage-checked",
                                      "", "No claim-specific reading date or passage was retained from the previous pass."])
    return output.getvalue()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = assemble()
    path = ROOT / "comparison/claim-source-ledger.tsv"
    if args.check:
        if path.read_bytes() != data.encode("utf-8"):
            raise SystemExit("Claim source ledger requires rebuilding")
    else:
        path.write_bytes(data.encode("utf-8"))
    print(f"{len(list(csv.reader(io.StringIO(data), delimiter=chr(9))))-1} claim/source decisions")
