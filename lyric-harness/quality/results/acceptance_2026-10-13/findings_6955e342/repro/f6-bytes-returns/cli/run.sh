#!/bin/bash
# CLI path for the candidate page's actual wire strings: lyric_harness.py brief --returns=<sent> on the candidate harness (v2) and base.
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-695/lyric-harness
for spec in '4.end,6.end' '4,6' '5.end,6.end;1.T5,8.T5' '5,6;1.T5,8.T5' '1.end,6.head'; do
  tag=$(echo "$spec" | tr ';,.' '_-~')
  LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python lyric_harness.py brief /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h695/f6-bytes-returns/cli/song8.txt --returns="$spec" > /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h695/f6-bytes-returns/cli/cand_brief_$tag.log 2>&1; echo "cand $spec rc=$?"
done
