import sys, unicodedata
sys.path.insert(0, sys.argv[1])
from lyric_harness import reader_token_spans
lines = ["Oh--oh, oh my love", "I 2 love you love", "(oh) record record", "don 't you cry", "love 2 love love",
         "Café au lait", unicodedata.normalize('NFC', "Café au lait"), "rock'n'roll all night"]
for l in lines:
    for sch in ('v1','v2'):
        for sp in (True, False):
            print(repr(l), sch, 'strip' if sp else 'voices', reader_token_spans(l, sp, sch))
