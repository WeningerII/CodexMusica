import sys, copy
tree = sys.argv[1]; sys.path.insert(0, tree)
mode = sys.argv[2]
import lyric_harness as LH
import quality.pronunciation as P
orig = P.pin_readings
def unguarded(lex, occ, source):
    lx = copy.copy(lex); lx.__dict__.pop('_numbering_guard', None)
    return orig(lx, occ, source)
if mode == "unguard":
    P.pin_readings = unguarded
sys.argv = ["lyric_harness.py"] + sys.argv[3:]
LH.main()
