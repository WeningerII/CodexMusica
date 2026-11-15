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
