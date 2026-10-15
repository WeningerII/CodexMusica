"""Write single-guard ablations of 0af quality/loop.py (each edit must match exactly once).
usage: python ablate0af.py <0af loop.py> <outdir>"""
import os, sys
src = open(sys.argv[1], encoding="utf-8").read(); outdir = sys.argv[2]
AB = {
 # the guard 3e77a5d9 rewrote: anchors empty -> accept (strongest mutation of the new refusal)
 "z1_zero_anchor_accepts": [("        # refuses (3PO #519 6163216518). A multi-word anchor that binds\n        # syllables never waived this: its endpoint is checked below.\n        return False",
                             "        # refuses (3PO #519 6163216518). A multi-word anchor that binds\n        # syllables never waived this: its endpoint is checked below.\n        return True", 1)],
 # r2-tests skeptic's a1: the whole endpoint check off
 "a1_endpoint_check_off": [("        if lex is not None and not _end_occurrence_bound(lex, text, tokens[-1]):", "        if False:", 1)],
 # r2-tests skeptic's a3: printed-material guard in the v2 NON-default swap_at_slot
 "a3_word_material_off": [("        if not _only_word_material(text, hit.pieces):\n            return None\n        start, end = hit.pieces[0][0], hit.pieces[-1][1]",
                           "        if False:\n            return None\n        start, end = hit.pieces[0][0], hit.pieces[-1][1]", 1)],
 # the same helper's other call site, in v2 swap_end_word (default end)
 "a3e_end_word_material_off": [("        if not _only_word_material(text, runs[-1].pieces):", "        if False:", 1)],
 # r2-tests skeptic's a7: endpoint pieces/text check in _end_occurrence_bound
 "a7_endpoint_pieces_check_off": [("    if last.pieces != replaced.pieces or last.text != replaced.text:", "    if False:", 1)],
}
for name, edits in AB.items():
    s = src
    for old, new, n in edits:
        c = s.count(old)
        assert c == n, (name, c, old)
        s = s.replace(old, new)
    assert s != src
    open(os.path.join(outdir, name + ".py"), "w", encoding="utf-8").write(s)
    print(name)
