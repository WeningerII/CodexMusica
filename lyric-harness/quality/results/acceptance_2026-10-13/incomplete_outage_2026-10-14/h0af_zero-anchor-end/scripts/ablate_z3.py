"""z3: a narrower zero-anchor refusal -- refuse only where the raw last run IS the last token
(an unread word / numeral / hyphenated word), accept where the run is wider than the token
(the crafted 'go кот5', 'ﬁne', combining-overlay class). Probes whether any test pins that class.
usage: ablate_z3.py <0af loop.py> <out.py>"""
import sys
s = open(sys.argv[1], encoding="utf-8").read()
old = ("        # syllables never waived this: its endpoint is checked below.\n        return False")
new = ("        # syllables never waived this: its endpoint is checked below.\n"
       "        return raw_final_token(text, getattr(lx, 'strip_parens', True), scheme='v2') != last.text")
assert s.count(old) == 1
open(sys.argv[2], "w", encoding="utf-8").write(s.replace(old, new))
