# Immutable lyrics image release

CI builds the production Dockerfile for linux/amd64 and records its immutable
local image ID before testing. The image bakes the full commit and a unique
CI repository/run/attempt/job release ID into `mcp/build_identity.json`; runtime
environment variables cannot override either value. The offline image gate runs that ID with one CPU,
2 GiB of memory and no external network. On a trusted main push, the same ID is
pushed to the private-by-default GHCR package `ghcr.io/weningerii/codexmusica/lyrics`.
The `lyrics-image` artifact contains its registry digest, commit and actual runtime
source/data fingerprints. A successful image job alone does not authorize a deploy.

The deployment workflow requires a successful trusted main CI run and its complete
required-job evidence, downloads the image manifest from that exact run, checks the
main ordering guard, and calls the Render hook with `imgURL=repository@sha256:...`.
It never rebuilds the image. After deployment it checks initialization, tool
metadata, public runtime configuration, readiness, durable recovery and the tested
image's baked release ID and source/data/Python/Node fingerprints. The registry must retain deployed
and rollback digests for as long as Render can need them.

## Required service transition

The existing `render.yaml` describes the legacy Git-backed service. Render's
image-backed service is a separate deployment mode; a commit hook on the legacy
service cannot promote a prebuilt digest. Until the transition below is complete,
the new deployment workflow refuses instead of taking the old rebuild path.

Configure an image-backed Render service for the GHCR repository above, with a
registry credential that can read that package. Preserve the existing public URL,
single-instance Standard resources, runtime environment and durable `/data/lyrics`
store (including signing key and accounting ledger). Moving or attaching a disk
and switching the public endpoint require a planned service migration; creating a
fresh empty ledger is not a migration. Stop paid admission during that transition,
allow current work to settle, and verify retained receipts and ledger before reopening.

Set repository variable `RENDER_IMAGE_REPOSITORY` to the exact GHCR repository and
secret `RENDER_DEPLOY_HOOK_URL` to that image-backed service's hook. Remove the old
service's Blueprint synchronization/deploy path. `mcp/production-config.json` is the desired configuration contract used by
readiness, memory admission and the battery. Keep `render.yaml` only as the
legacy migration reference, with parity tests until transition completes. Replace
it with a reviewed image-service Blueprint using an actual existing digest, then
remove its migration-only parser and tests. The first digest is available only after this
change's CI build succeeds; this document does not invent one.

The workflow implementation and local manifest tests do not prove GHCR publication,
Render migration or a paid long-song run. Those remain release qualification steps.


Production promotion also requires the latest **Production qualification** manual
workflow at the exact main commit and verified run attempt to succeed. It intentionally
executes all four mutation shards, full song and short-song band comparisons
(200 seeds, 2,000 draws), and the five adopted lyric curves. Each command has its
existing bound: mutation 200 minutes, each band 150 minutes, curves 40 minutes.
Its artifact binds source, input/runtime fingerprints, command scope, commit and
attempt. The image manifest separately records the full repository source
fingerprint captured before Docker build and rechecked unchanged after testing;
deployment compares qualification to that value. The installed runtime fingerprint
remains separate because the assembled image deliberately excludes research files. A timeout,
partial comparison, missing shard, stale source, or successful older attempt cannot
qualify. Cached progress is retained under failure. Candidate images remain
buildable before this production gate passes. Both automated schedules stay disabled.

The historical nightly estimate did not count the newer 40-minute curve step:
77.4 minutes of older measured other work + 150-minute song bound + 40-minute curve
bound = 267.4 minutes before setup/save, exceeding the 240-minute job by 27.4 minutes.
That is arithmetic from old measurements and current bounds, not a measured current
completion. The separate qualification jobs avoid that stack; their current actual
completion times and complete four-shard outcomes remain to be measured. The old
nightly remains unable to promise cache persistence at its job ceiling.

This evidence attests the maintained full comparisons. It does not substitute for
a fresh held-out model-adoption study, hosted resource qualification, restore proof,
or the paid new-song acceptance run. Production readiness still needs those applicable
checks; a green comparison artifact alone makes no broader claim.


CI and production qualification call the same reusable all-family capacity proof
workflow once per attempt. Main CI requires its successful result; the nightly
capacity adoption command receives and validates that exact attempt's proof. Static
record/provenance checks and nonproduction sample/lookup tests do not call the
current-proof checker and receive no unnecessary repeated verification. Consumers receive that exact attempt's receipt, verify its bytes and workflow
identity, then validate all 81 witness records against their own Python runtime,
source and capacity table before installing it. Another Python version cannot use
the proof. The Docker build independently verifies the assembled production tree;
a checkout proof does not replace that installed-runtime check.

The local single-worker all81 measurement completed in 1600.725 seconds wall
(1596.374 seconds process CPU) on Python 3.12.13 at the preceding verifier epoch.
The later full proof after the batching repair completed in 549.696 seconds with
four workers and consumed 2042.343 seconds aggregate CPU. Its strict serialized
receipt and installed admission passed. Neither timing substitutes for an actual
single-worker Python 3.11 run in the final image.

The former 15-minute bound was insufficient, and a 35-minute proof allowance had
little margin against the newer measured cost. The proof now has 45 minutes:
1.25 times the larger of observed serial wall (1600.725 seconds) and later aggregate
CPU (2042.343 seconds), rounded up to 5 minutes. Aggregate CPU is a conservative
setup-cost input, not a serial-wall measurement. The reusable job has 55 minutes,
including 10 minutes for checkout, dependencies, staging and upload. These are
explicit allowances; actual CI Python 3.11 completion remains required.

The image build has 55 minutes: the 45-minute proof allowance plus 10 minutes for
runtime assembly and dependency work. The image job has 145 minutes: 2 audit +
55 build + 5 image checks + 65 capacity = 127 minutes, with 18 minutes reserved for
checkout/setup, cheap oracles, artifact uploads and publishing the tested image.
Actual Docker Python 3.11 build and total-job completion are still required before
claiming these budgets fit.

The 65-minute capacity step is also unproven. Its full denominator is 18 instrument
executions (three lengths × three seeds × cold/worker), containing 72 measured verb
calls: 36 grade and 36 revise. Each size/seed has one cold call and three worker calls
per verb, plus plan/setup, resident-server recovery and queue-pressure work. Local
maximum-size samples do not establish the whole matrix's elapsed time or Docker
resource qualification. No operational 600-second call or 40-minute turn limit changed.

Build timing/status is archived even on failure where the runner can reach the
upload step; an interrupted running record is not completion evidence.


The local retirement follow-up is recorded in [legacy-retirement.md](../docs/legacy-retirement.md).
Rollback means promoting a retained tested image digest while preserving the durable
store. It never means re-enabling the legacy source rebuild route. Before closing
migration, inspect effective live configuration and remove `CHAT_MAX_TURNS_PER_DAY`;
the repository cannot remove a dashboard override by deleting a YAML entry.
