"""BB8 verify: run the real Library AnalysisSession (the reader worker's core)
on a pre-batch (v1-numbered, unmarked) Library choice: token 2 'oh' of
'Oh--oh, oh my love', phones AA1 (dictionary would read OW1). Report which
characters the declared reading lands on."""
import json, sys
from unittest.mock import patch
sys.path.insert(0, '.')
from library.analysis import AnalysisSession, runtime_identity
import lyric_harness as LH

LINE = 'Oh--oh, oh my love'
TEXT = LINE + '\nthe road is long'
def source():
    return {"reading_unit_id": "bb8:eng", "reading_revision": "bb8-r1", "language": "eng", "text": TEXT}

def complete(decl):
    committed, checkpoint = [], None
    rid = runtime_identity()
    session = None
    for _ in range(20000):
        if session is None:
            with patch("library.analysis.runtime_identity", return_value=rid):
                session = AnalysisSession(source(), decl, {"layers": ["sound"], "schemas": []}, checkpoint,
                    load_records=lambda mid: (r for r in committed if r.get("method_id") == mid))
        last = session.step(256)
        committed.extend(last["records"])
        checkpoint = last["checkpoint"]
        if last["done"]:
            return session, committed
    raise SystemExit("no finish")

tok = int(sys.argv[1]) if len(sys.argv) > 1 else 2
decl = {"pronunciations": [{"line": LINE, "token": tok, "word": "oh", "phones": ["AA1"],
                            "basis": "declared", "source": "the singer"}]}
print("process reader scheme:", getattr(LH, 'resolve_reader_scheme', lambda s=None: 'v1(no-scheme-api)')())
try:
    session, recs = complete(decl)
except Exception as e:
    print("REFUSED:", type(e).__name__, e)
    raise SystemExit(0)
toks = {r["token_id"]: r for r in recs if r["kind"] == "token"}
for r in recs:
    if r["kind"] == "syllable" and r["line_id"].endswith(":0") or (r["kind"] == "syllable" and "line:0" in r["line_id"]):
        pass
# print line-0 tokens with their syllable phones and char ranges
line0 = [r for r in recs if r["kind"] == "token" and r["coordinate"][0] == 0] if recs and "coordinate" in recs[0] else None
syl = [r for r in recs if r["kind"] == "syllable"]
for t in [r for r in recs if r["kind"] == "token"]:
    if t["line_id"] != [r for r in recs if r["kind"] == "token"][0]["line_id"]:
        continue
    phones = [s["syllable"] for s in syl if s["token_id"] == t["token_id"]]
    cps = [x.get("codepoint_range") for x in t["source_ranges"]]
    print(json.dumps({"token": t["token"] + 1, "text": t["text"], "codepoint_ranges": cps,
                      "precision": [x.get("precision") for x in t["source_ranges"]],
                      "syllables": phones, "reading_status": t.get("reading_status")}, ensure_ascii=False))
