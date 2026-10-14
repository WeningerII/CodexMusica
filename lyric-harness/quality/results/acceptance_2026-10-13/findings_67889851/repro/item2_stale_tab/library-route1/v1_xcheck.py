# base harness (pre-batch, v1 only) line_tokens(text, False) for each line
import sys, json, os
sys.path.insert(0, sys.argv[1]); os.chdir(sys.argv[1])
import lyric_harness as LH
lines = json.load(open(sys.argv[2]))
print(json.dumps([LH.line_tokens(t, strip_parens=False) for t in lines], ensure_ascii=False))
