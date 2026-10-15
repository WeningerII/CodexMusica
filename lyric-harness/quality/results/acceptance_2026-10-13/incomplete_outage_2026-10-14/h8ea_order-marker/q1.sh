#!/bin/bash
# queue 1: p1 (BB8 order-marker driver) orders on the controls, then extras on every tree
O=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h8ea/order-marker
cd $O/p1
for t in c695 main c0af c61b; do node orders.js $t > orders_$t.log 2>&1; echo "p1-orders-$t $?" >> done.txt; done
for t in cand c695 main c0af c61b; do node extras.js $t > extras_$t.log 2>&1; echo "p1-extras-$t $?" >> done.txt; done
