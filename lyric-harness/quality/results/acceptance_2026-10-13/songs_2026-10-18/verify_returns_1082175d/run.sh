#!/bin/sh
# usage: run.sh TREE OUTDIR  -- plan seed 23 the way the connector does, then grade the draft
T=$1; O=$2; mkdir -p $O; cd $T/lyric-harness
python3 lyric_harness.py plan --seed=23 --lines=16 --functions=verse,chorus --want=beats_per_line\<=8 --title="Last Run" --out=$O/plan.json > $O/plan.log 2>&1
python3 lyric_harness.py plan --seed=23 --lines=16 --functions=verse,chorus --want=beats_per_line\<=8 --title="Last Run" --fill=$O/../draft.txt --out=$O/bp.json > $O/fill.log 2>&1
python3 - "$O" <<'PY'
import json,sys,subprocess
O=sys.argv[1]; p=json.load(open(O+'/plan.json'))
a=["song",O+"/bp.json",O+"/../draft.txt","--groups="+p["groups"]]
if p.get("returns"): a.append("--returns="+p["returns"])
a+=["--subdivision",str(p["subdivision"])]
r=subprocess.run([sys.executable,"lyric_harness.py",*a],capture_output=True,text=True)
open(O+"/song.out","w").write(r.stdout); open(O+"/song.err","w").write(r.stderr); print("song rc",r.returncode)
PY
