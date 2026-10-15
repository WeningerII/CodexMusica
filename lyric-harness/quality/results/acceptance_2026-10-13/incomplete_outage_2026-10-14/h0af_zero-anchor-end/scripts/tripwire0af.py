"""Write a TRIPWIRE copy of 0af quality/loop.py: behaviour unchanged, but each
guard under study appends one JSON line to $TRIPWIRE_LOG when it REFUSES
(a3: swap_at_slot _only_word_material; a3e: swap_end_word _only_word_material;
a7: _end_occurrence_bound pieces/text check; z1: _end_occurrence_bound zero
anchors), with the test id from the stack. usage: tripwire0af.py <loop.py> <out.py>"""
import sys
src = open(sys.argv[1], encoding="utf-8").read()
HELPER = '''

def _tw(tag, text):
    import os as _o, json as _j, traceback as _tb
    p = _o.environ.get("TRIPWIRE_LOG")
    if not p:
        return
    tests = [f"{fs.filename.rsplit('/', 1)[-1]}:{fs.name}" for fs in _tb.extract_stack() if "/test_" in fs.filename]
    with open(p, "a", encoding="utf-8") as fh:
        fh.write(_j.dumps({"tag": tag, "text": text, "tests": tests[-2:]}, ensure_ascii=False) + "\\n")

'''
EDITS = [
 ("def _only_word_material(text, pieces):", HELPER + "def _only_word_material(text, pieces):", 1),
 ("        if not _only_word_material(text, runs[-1].pieces):\n            return None",
  "        if not _only_word_material(text, runs[-1].pieces):\n            _tw('a3e', text)\n            return None", 1),
 ("        if not _only_word_material(text, hit.pieces):\n            return None",
  "        if not _only_word_material(text, hit.pieces):\n            _tw('a3', text)\n            return None", 1),
 ("    if last.pieces != replaced.pieces or last.text != replaced.text:\n        return False",
  "    if last.pieces != replaced.pieces or last.text != replaced.text:\n        _tw('a7', text)\n        return False", 1),
 ("        # syllables never waived this: its endpoint is checked below.\n        return False",
  "        # syllables never waived this: its endpoint is checked below.\n        _tw('z1', text)\n        return False", 1),
]
for old, new, n in EDITS:
    assert src.count(old) == n, old
    src = src.replace(old, new)
open(sys.argv[2], "w", encoding="utf-8").write(src)
