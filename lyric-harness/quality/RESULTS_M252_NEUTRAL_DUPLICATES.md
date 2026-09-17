# M-252 — duplicate push runs observed skipping

Inspected 2026-09-17 against main
`269752040aa3c9890876bc2f6a535607876d74f6`. M-252 closes on existing
executed evidence. This correction changes no workflow or runtime behavior.

## The mechanism that actually ran

M-252's September 6 fix moved the duplicate question into its own `dup` job
and added the permission its second question required. The remaining debt
was a live push twin skipping instead of being cancelled before it answered.

BCI-07 (`a75da39f`) subsequently separated push and pull-request concurrency
groups, but also removed the duplicate lookup. The owner's September 16
instruction restored the open-PR question in
[b823ff28](https://github.com/WeningerII/CodexMusica/commit/b823ff28db61fc3b2f633b4bb4c012c780d74771),
merged through [PR #291](https://github.com/WeningerII/CodexMusica/pull/291).
The event-specific concurrency groups remain. The observations below are
of that restored implementation, not a retroactive claim that the original
September 6 implementation beat its cancellation race.

The current question selects an OPEN pull request whose head is the exact
push SHA. Uncertainty leaves `already_covered=false`. Main pushes and
non-push events always do their own work. M-251's successful-main-run lookup
remains absent; this closure does not restore or certify it.

## Observed job conclusions

All rows are attempt 1 of CI (`.github/workflows/ci.yml`). The counts enumerate
the complete jobs response (`per_page=100`, returned length equals
`total_count`), including matrix placeholders when a matrix was skipped.
They are counts of reported jobs, not runner executions. All times are UTC.

| Head / event | Run | Workflow conclusion | Job conclusions |
| --- | --- | --- | --- |
| `d4df5657ef56baae3b06efb741b2b75f89736de3` / push | [35171749828](https://github.com/WeningerII/CodexMusica/actions/runs/35171749828) | success | 1 success (`dup`), 24 skipped, 0 failed/cancelled |
| Same head / pull_request #314 | [35171752534](https://github.com/WeningerII/CodexMusica/actions/runs/35171752534) | success | 43 success, 4 skipped, 0 failed/cancelled |
| `9d7414a7f0b9eba2a77b0f32cfee1a3d43562651` / push | [35174057450](https://github.com/WeningerII/CodexMusica/actions/runs/35174057450) | success | 1 success (`dup`), 24 skipped, 0 failed/cancelled |
| Same head / pull_request #315 | [35174061541](https://github.com/WeningerII/CodexMusica/actions/runs/35174061541) | cancelled | 33 success, 4 skipped, 10 cancelled; not complete verification |

The [first push's dup log](https://github.com/WeningerII/CodexMusica/actions/runs/35171749828/job/105044695364)
records its actual decision at `2026-09-17T01:45:04.0097445Z`:
`1 open pull request(s) have this commit at their head (d4df5657ef56baae3b06efb741b2b75f89736de3)`.
Every other job is `skipped`, including gate, record, verify, the ordinary
matrices and their aggregate checks. Of those 24, 21 consume the duplicate
guard and three (nightly, tandem, mutation) cannot run on push events anyway.
The API conclusion is literally `skipped`, not `neutral`; the neutral
outcome here is zero failed/cancelled jobs and a successful workflow.

The [matching PR's dup log](https://github.com/WeningerII/CodexMusica/actions/runs/35171752534/job/105044703006)
prints `already_covered=false` at `2026-09-17T01:45:10.2529953Z`. Its gate,
record, verify, suites, verb/planning/revision/capacity shards, image,
capacity proof and capacity matrix executed successfully. Its four skips
are nightly, tandem, mutation and the catalog matrix. Thus the evidence
includes the counterpart doing the work, not merely a green empty twin.

The [second push's dup log](https://github.com/WeningerII/CodexMusica/actions/runs/35174057450/job/105051738523)
repeats the exact-head decision at `2026-09-17T02:20:52.9086317Z`.
PR #315 had been open since `2026-09-17T01:48:03Z`, before this push run
was created. Its subsequently cancelled PR run is deliberately retained in
the table: a successful skipped push is not proof that the PR passed.
Merge readiness must still inspect the current PR run's actual conclusions.

Selected run metadata, every reported job's ID/name/status/conclusion, PR
creation/merge times and timestamped decision-log excerpts are banked in
`quality/results/m252_neutral_duplicates_2026-09-17/receipts.json`, with the
source API URLs. This is a selected incident reconciliation, not an estimate
of reliability over all pushes. It does not promise that superseded or
manually cancelled runs will never carry cancelled checks.

## Scope of closure

The missing live observation is established, including one fully successful
PR counterpart. No M-252 implementation work remains. Existing regression
coverage in `quality/test_shard.py` section 6 exercises the real extracted
script, the real jq filter, uncertain responses, the downstream guards,
event-specific concurrency, and planted defects. Those tests establish the
local contract; the Actions receipts above establish the live outcome.

The PR merge tree remains the verification target when a duplicate push is
skipped. These historical runs do not verify this documentation change's
final head; that head must complete its own CI before merge.
