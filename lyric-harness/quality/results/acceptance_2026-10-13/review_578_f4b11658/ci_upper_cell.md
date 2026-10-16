# CI "cells upper" (24:20260910, 24:20260908), worker mode, copied from the job logs

The instrument reads rss/peak (VmRSS/VmHWM, MiB) the moment each reply frame arrives.

## Base 34dd4c1fb4: production qualification 38867915283, job 116864912042 (FAILED)
24/20260910 worker:
  call=3 grade  rss=418.9 peak=554.5
  call=4 revise rss=626.1 peak=627.0
  call=5 grade  rss=530.8 peak=702.6   <- second grade climbs 75 MiB above the revise peak
  call=6..8     peak=702.6
  resident (Node + Python) peak 1,910,575,104 B
  failure: "24/20260910/worker: missing or excessive resident-memory peak during this execution"
24/20260908 worker: call=4 peak 630.6, call=5 peak 637.6 (+7)

## Head f4b11658a7: production qualification 38915406585, job 117021481505 (passed)
24/20260910 worker:
  call=3 grade  rss=418.4 peak=555.1
  call=4 revise rss=625.4 peak=628.0
  call=5 grade  rss=540.5 peak=628.0   <- no climb
  call=6..8     peak=628.0
  resident (Node + Python) peak 1,753,735,168 B
24/20260908 worker: call=4 peak 635.3, call=5 peak 635.3 (+0)
Shard result: passed; capacity-matrix / merge passed; qualification-capacity-matrix passed.

This is one CI sample per side. The author reports the base call-5 climb does not reproduce every time (575-676 MiB worker peak locally).
