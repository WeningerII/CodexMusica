# Stage 0: five drawn cases written by fresh agents, baseline

Live connector build: eb5bd415b7. Cases from cases_frozen.json. One fresh agent per case, no knowledge of the plan.

## Case 3 (group: contradicts itself). Expected: refused, naming the declaration to change.

- Outcome: NEEDS THE PERSON after 25 connector calls, about 4 to 5 minutes. No plan, no song.
- Declarations matched the key: form, lines and the section count were sent as stated on every sweep. The rhyme scheme and the stress pattern were sent nowhere: no field takes them, and nothing told the agent they are not supported.
- Stops and next steps: all seven sweeps ended exit 2 with "widen the range, or drop a predicate" and "declare a target length in lines ..., declare the section roster in functions, or continue from next_seed_from". The agent did each one that was open to it (196 seed-plans over 7 windows, with and without a roster). None could work: the request cannot fit (3 sections that each need a line, 2 lines). The refusal never says so. FAIL against the expected outcome: refused, but not naming the declaration to change.
- Did it end: yes, by the agent giving up, not by the connector. Same refusal seen seven times.
- Other stops seen: SESSION_STORE_FULL twice (said to retry the same call; worked on the third try; five test sessions were open at once). Bad Gateway twice (transport, no advice; a re-read then a retry worked).

## Case 14 (group: supported and fits together). Expected: a finished song whose final plan matches the answer key.

- Outcome: NEEDS THE PERSON after 74 connector calls, about 10 minutes. No plan, no song. FAIL against the expected outcome.
- Declarations matched the key: form, lines and both section counts were sent as stated on every sweep.
- Stops and next steps: fifteen sweeps over seeds 0 to 419 ended exit 2 with "widen the range, or drop a predicate". Zero seeds accepted. One stated count held on its own 14 times in 420; the other never held. The advice "declare a target length in lines if you have not" was repeated although lines was declared every time. The advice "declare the section roster in functions" was followed twice and the planner refused all 56 seeds; that refusal's reason arrives cut off mid-word and no detail view exists for a sweep.
- Did it end: by the agent giving up. The connector offered "continue from next_seed_from" without end.
- Other stops seen: SESSION_STORE_FULL seven times in a row (retry worked on the eighth); Bad Gateway 17 times (no advice; retries worked after 1 to 9 tries). 24 of the 74 calls were lost to these two.

## Case 1 (group: asks for something not supported yet). Expected: refused, naming what is not supported yet (a rhyme scheme, a stress pattern).

- Outcome: NEEDS THE PERSON after 65 connector calls, about 10 minutes. No plan, no song.
- Declarations matched the key: form, the section count and beats per line were sent as stated. The rhyme scheme was tried once as a sweep predicate and refused as "not a coordinate a sweep can read", with the table of coordinates and no call named that would carry a scheme. The stress pattern was sent nowhere: no parameter takes one and nothing said so. PARTLY against the expected outcome: one of the two unsupported things was named, by accident of the agent trying it; the other was silent.
- Stops and next steps: 22 sweeps over seeds 0 to 615 ended exit 2 with the same advice. Zero accepted. The two supported stated values held on their own once and eight times in 616.
- Did it end: by the agent giving up.
- Other stops seen: Bad Gateway 11 times (no advice). Four sweeps were sent twice after a Bad Gateway; the agent could not tell whether the failed first attempt had queued anything.

## Case 4 (group: supported and fits together). Expected: a finished song whose final plan matches the answer key.

- Outcome: OUT OF BUDGET after 88 connector calls, about 35 to 45 minutes. A 51-line draft was sent for grading and never graded. FAIL against the expected outcome.
- Declarations matched the key: form and beats per line were sent as stated on every sweep, plan and grade. Length was not stated; the planner drew 197, then 205, then 51 lines on three plans.
- Stops and next steps:
  - Two plan results (100,520 and 114,773 characters) were too large for the agent's client to deliver, so the agent never saw those plans. Asking for a narrower view was refused: the detail view covers a grade, a revise and a screen, not a plan, and the refusal pointed back to the read that had overflowed.
  - A grade refused twice with "cannot resolve token N in '<line>' under v2 ... declare numbering". The grade tool takes no numbering argument, so the named fix cannot be made.
  - The third plan (51 lines) was readable. Its grade stayed pending for 17 polls, then the server restarted. The record said interrupted, resumable. Five resume calls all got Bad Gateway.
- Did it end: no. The agent ran out of calls.
- Other stops seen: Bad Gateway 33 times in three runs of 7, 1 and 21 plus 5.

## Case 22 (group: states only the form). Expected: a finished song; everything but the form shown as drawn.

- Outcome: STUCK after 82 connector calls, about 30 minutes. No verdict on any draft. FAIL against the expected outcome.
- Declarations matched the key: only the form was sent. The planner drew a 444-line plan in ten sections.
- Stops and next steps:
  - The plan result (167,847 characters) was too large to deliver. The agent learned the length only from the grade's refusal of a short draft, and wrote 444 lines without seeing the plan.
  - The same "declare numbering" refusal, twice, with no argument that takes it.
  - Once a 444-line draft passed that refusal, the grade never returned: the server restarted, the agent resumed it as told, it stayed pending, and a second session's sweep and a plain lookup then also failed.
- Did it end: no. The agent stopped with the service answering Bad Gateway.
- Other stops seen: Bad Gateway 20 times; "interrupted, process restarted" twice.

## The live server during these runs

The five runs overlapped from about 19:35 to 20:04 UTC on 15 November. The host's records for the live service show:

- 19:39 to 19:51: one processor 50 to 73 percent busy, memory 1.44 to 1.52 GB of 2 GB. Bad Gateway answers began here, before any restart.
- 19:52:13: the server was killed for running out of memory (2 GB limit). Back at 19:52:17.
- 19:55 to 20:01: processor at 100 percent, memory 1.66 rising to 2.14 GB.
- 20:02:10: killed for running out of memory again. Back at 20:02:17.
- After the last agent stopped: memory about 0.4 GB, health check answering.

Both kills came while the 444-line grade was running or had just been resumed.

## The Bad Gateway answers, measured afterwards (16 November)

Read from the host's records and the service's own request log for 15 November. Nothing was run on the live server for this.

- The host counted 93 answers with status 502 in three bursts: 37 from 19:40 to 19:44 (before any restart), 9 from 19:53 to 19:56, and 47 from 20:02 to 20:07.
- The service's own log for those three stretches has no 5xx and no aborted request. Every call to `/mcp` that reached it was answered 200 (93, 19 and 2 calls). So the 502s were given by the host's proxy for calls the service never saw.
- From 20:02 to 20:08 the host gave 47 502s while 2 calls to `/mcp` reached the service. In the same minutes 17 plain reads of `/health` sent through the same proxy were all answered 200.
- The host's troubleshooting page names two causes of a 502 for a service like this one. One is a Node server whose idle-connection timeout is too low. This server used Node's default, 5 seconds, which is also the interval a pending operation is polled at. A proxy sends a read again when a reused connection turns out closed and does not send a write again, which is the pattern above.
- The other cause it names is a health check that answers late (over 5 seconds, for 15 seconds in a row). Each health check here made five synchronous disk syncs and took 0.87 to 4.8 seconds inside the service (median 1.1), and nothing else was answered while one ran. Four in a row took 3.5 to 4.8 seconds at 19:41. Health checks were answering in about a second during the second and third bursts, so this cause does not explain those.
- Also seen: a call that queues a lyric operation takes about a second inside the service (sweep: 0.9 to 4.9 seconds, median 1.1), and nothing else is answered meanwhile. A read of an operation takes about 5 milliseconds.
- After the 19:52 restart the service was listening within a second, and a `resume_operation` call was admitted 34 seconds later. The resumed grade was the one that ran out of memory again at 20:02.

Not proven: the host's proxy log is not available, so the idle-connection cause is the reading that fits every burst, not a recorded fact. The check is the host's 502 count once the fix is live.

The counts from the service's log were computed by script from a hand copy of 510 log lines (the log tool returns no file), with checks that each page's line count and each call's start line matched.

## One long grade, measured alone

Run on a development machine, not on the live server, on main `f022397c44`: the same seed and form the agent drew (444 lines, ten sections), filled with a placeholder draft that keeps the plan's own repeats, graded once with the command the plan verb prints.

- Memory of the grading process: 0.9 GB after 70 seconds, 1.27 GB after 213 seconds, 1.59 GB after 381 seconds, 1.85 GB after 1,094 seconds. Largest value recorded: 1,874 MB.
- Time: 1,143 seconds (19 minutes) to finish. Exit 2 (coverage incomplete on the placeholder words).

The live server has 2 GB in all and rested at 1.39 to 1.40 GB before the test. So this one grade does not fit on it, alone, whatever else is running. The connector runs one harness job at a time (`mcp/python_bridge.js`, the `pump` function), so the kills were not two heavy jobs side by side.

## Totals

Five cases, five fresh agents, 334 connector calls. Songs finished: 0. Plans reached: 2 of 5. Drafts graded to a verdict: 0.
