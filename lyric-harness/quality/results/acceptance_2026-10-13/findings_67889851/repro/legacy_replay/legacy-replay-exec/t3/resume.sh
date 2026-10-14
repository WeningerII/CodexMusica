#!/bin/bash
# usage: resume.sh TREE LABEL STATE_FIXTURE [ENV=VAL...] [-- extra global flags]
W=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/legacy-replay-exec
TREE=$1; LABEL=$2; FX=$3; shift 3
ENVS=(); while [ $# -gt 0 ] && [ "$1" != "--" ]; do ENVS+=("$1"); shift; done; [ "$1" == "--" ] && shift
R=$W/t3/run; rm -rf $R; mkdir -p $R
cp $W/fx/d12.txt $R/d12.txt; cp $W/fx/t3_ledger_after_suspend.json $R/d12.txt.briefed.json; cp $W/fx/$FX $R/state.json
echo "# resume.sh $TREE $LABEL $FX: restored $R from fx/{d12.txt,t3_ledger_after_suspend.json,$FX}" >> $W/COMMANDS.txt
$W/run.sh $TREE $LABEL "${ENVS[@]}" -- "$@" finish $R/d12.txt --seed=23 --lines=12 --propose=defer:$R/state.json
cp $R/state.json $W/t3/res/$LABEL.state.json; cp $R/d12.txt.briefed.json $W/t3/res/$LABEL.ledger.json
