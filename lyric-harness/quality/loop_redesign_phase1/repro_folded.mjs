import console from 'node:console';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import * as L from './lyric_tools.js';
const I = L._verdictInternals;
const prev = JSON.parse(
  readFileSync(
    '/tmp/claude-0/-home-user-CodexMusica/6517c01f-1c45-5a7f-8ca2-ee4b0bfeaa6a/scratchpad/p1/st_b_q1.json'
  )
);
prev.pending.answer =
  'L2: and walked out to the empty field\nL4: and left its footprints near the drawer';
const next = JSON.parse(
  readFileSync(
    '/tmp/claude-0/-home-user-CodexMusica/6517c01f-1c45-5a7f-8ca2-ee4b0bfeaa6a/scratchpad/p1/st_b.json'
  )
);
console.log(JSON.stringify(I.foldedOf(prev, next), null, 1));
process.exit(0);
