#!/bin/bash
# queue 3: p3 (the two remaining writers, whole-line returns, blocked member, record/card) and p4 (typing, APP vs native undo) on every tree
O=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h8ea/order-marker
for t in cand c695 main c0af c61b; do (cd $O/p3 && node run.js $t > run_$t.log 2>&1; echo "p3-$t $?" >> $O/p3/done.txt); (cd $O/p4 && node extras.js $t > extras_$t.log 2>&1; echo "p4-$t $?" >> $O/p4/done.txt); done
