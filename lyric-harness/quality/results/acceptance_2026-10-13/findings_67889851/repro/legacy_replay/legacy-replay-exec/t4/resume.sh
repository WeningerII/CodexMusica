#!/bin/bash
# usage: resume.sh TREE LABEL STATE_FIXTURE [ENV=VAL...] [-- extra global flags]
W=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/legacy-replay-exec
TREE=$1; LABEL=$2; FX=$3; shift 3
ENVS=(); while [ $# -gt 0 ] && [ "$1" != "--" ]; do ENVS+=("$1"); shift; done; [ "$1" == "--" ] && shift
R=$W/t4/run; rm -rf $R; mkdir -p $R $W/t4/res
cp $W/fx/t4_d4.txt $R/d4.txt; cp $W/fx/t4_ledger.json $R/d4.txt.briefed.json; cp $W/fx/$FX $R/state.json
echo "# t4/resume.sh $TREE $LABEL $FX: restored $R from fx/{t4_d4.txt,t4_ledger.json,$FX}" >> $W/COMMANDS.txt
$W/run.sh $TREE $LABEL "${ENVS[@]}" -- "$@" --voices revise $R/d4.txt "--groups=1,2;1,3" --attempts=1 --propose=defer:$R/state.json
cp $R/state.json $W/t4/res/$LABEL.state.json; cp $R/d4.txt.briefed.json $W/t4/res/$LABEL.ledger.json
