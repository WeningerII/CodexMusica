#!/bin/bash
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; K=$S/h0af/king-relation
PY=$S/venv311/bin/python; export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
( cd $K/e/rev/lyric-harness && $PY -m unittest -v quality.test_reader.Normalisation.test_the_brief_verb_judges_the_declared_broken_word > $K/e/brief_test_pristine.log 2>&1 ) &
( cd $K/e/revA/lyric-harness && $PY -m unittest -v quality.test_reader.Normalisation.test_the_brief_verb_judges_the_declared_broken_word > $K/e/brief_test_revA.log 2>&1 ) &
wait
