#!/bin/bash
W=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/legacy-replay-exec
TREE=$1; LABEL=$2; FX=$3; shift 3
R=$W/t5/run; rm -rf $R; mkdir -p $R $W/t5/res
cp $W/fx/t5_d6.txt $R/d6.txt; cp $W/fx/t5_ledger.json $R/d6.txt.briefed.json; cp $W/fx/$FX $R/state.json
echo "# t5/resume.sh $TREE $LABEL $FX: restored $R from fx/{t5_d6.txt,t5_ledger.json,$FX}" >> $W/COMMANDS.txt
$W/run.sh $TREE $LABEL -- "$@" revise $R/d6.txt "$(cat $W/fx/t5_groups.txt)" --attempts=1 --propose=defer:$R/state.json
cp $R/state.json $W/t5/res/$LABEL.state.json; cp $R/d6.txt.briefed.json $W/t5/res/$LABEL.ledger.json
