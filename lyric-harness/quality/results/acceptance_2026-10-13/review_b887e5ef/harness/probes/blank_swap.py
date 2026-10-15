import sys, os
sys.path.insert(0, sys.argv[1])
from lyric_harness import Lexicon
from quality.loop import swap_end_word, swap_at_slot, default_propose_group, GroupBrief, AnchorSlot
from quality.slots import parse_slot
import dataclasses as dc
lines = ('the room on fire', 'we walk in rain')
for scheme in ('v1','v2'):
    lex = Lexicon(reader_scheme=scheme)
    for w in ('', ' ', ' ', '​', '­', '⁠', '﻿', '-', "'", '...', '　', '᠎'):
        e = swap_end_word(lines[0], w, scheme=scheme, lex=lex)
        p = swap_at_slot(lines[0], parse_slot('1.T2'), w, scheme=scheme, lex=lex)
        print(scheme, repr(w), 'end->', repr(e), ' T2->', repr(p))
    g = GroupBrief(pivot_line_no=1, pivot_text=lines[0], pivot_word='', pivot_offered=(),
                   anchors=(AnchorSlot(2, lines[1], 'train', ('train',)),), label='A', members=(1,2),
                   brief=None, lines=lines, attempt=0)
    print(scheme, 'whole_repair ->', default_propose_group(dc.replace(g, whole_repair=True), scheme=scheme, lex=lex))
