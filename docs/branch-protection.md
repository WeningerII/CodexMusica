# Branch protection for `main` — the ruled check set, and why

`main` is currently **unprotected**. Verified against the live API on 2026-08-08
and again on 2026-09-02: `GET /repos/WeningerII/CodexMusica/branches` returns
`{"name":"main", "protected": false}`.

Everything in this repository's verification story — the machine-checked
promises, the two-sided fault injection, the byte-reproducible artifact — is
advisory until this changes. A gate that a merge is not required to satisfy is a
gate only in the sense that it prints.

**The check set below is RULED, 2026-09-02, under the owner's delegation of the
2026-09-01 triage audit's open questions (`BACKLOG.md` RULINGS WANTED #19).**
Applying it is a repository setting and the delegation does not reach it: the
`gh api` call and the UI steps are at the bottom, and the click is the owner's.

## What actually happened

This is not hypothetical. It is the explanation for the long-standing "why did
#136 and #137 produce no CI run on `main`" question, and the answer turned out to
be that nothing required one:

| PR | What happened |
|---|---|
| #135 | Merged **8 seconds** after opening. Its only CI run had not started. |
| #125 | Merged with `verify` **and** `freshness` both red. |
| #136 | Merged with no workflow run on `main` at all. |
| #137 | Merged with a failing, post-merge run. |

### And then four more, which is what decides the set

Found by the 2026-09-01 triage audit (finding C26) and re-read against the
Actions API on 2026-09-02. Every `push`-event CI run on `main` between 08-28 and
08-30 that ended `failure`, with the jobs that were actually red, and what the
FOUR-CHECK set this page used to propose (`gate` / `verify` / `freshness` /
`catalog-result`) would have done about it:

| run | sha | red job(s) | proposed set |
|---|---|---|---|
| #1090 `33197205002` | `9929ee6` | `suites` | **admits** — all four green |
| #1095 `33201694916` | `5f040d4` | `suites`, `freshness` | blocks (on `freshness`) |
| #1125 `33231520985` | `e8090a1` | `record` | **admits** — all four green, and `suites` was green too |
| #1155 `33284424030` | `09aab6a` | `suites` | **admits** — all four green |

All four were merged by `WeningerII`. Three of the four would have merged with
the proposed set required, and the two jobs that carried the red — `suites`
twice, `record` once — were both outside it. That is the whole finding, and it
is what the set below is chosen against.

**One correction to the audit's own wording, kept rather than overwritten
(doctrine 17).** C26 and RULINGS WANTED #19 say the four merged *"with only the
`suites` job red"*. Measured: that is true of #1090 and #1155; #1125's sole red
was `record` and its `suites` was GREEN; and #1095 had `freshness` red beside
`suites`, so the proposed set does catch that one. The finding SURVIVES the
correction and is sharpened by it — the escaping runs were red in two different
jobs, not one, and neither was in the proposed set, so the remedy is not "add
`suites-result`" but "state the rule that decides membership".

## The rule that decides membership

A job is REQUIRED when all three hold:

1. **It runs on every pull request.** A job with an event `if:` cannot be
   required — a required check that never reports blocks the merge forever, and
   that failure mode stays invisible until somebody opens the first PR it
   applies to.
2. **It has a fixed name.** A matrix publishes expanded names carrying the
   matrix value, so requiring them means re-editing the required set every time
   the shard count changes. *The shard count changes*: `verbs` published
   `verbs (1)` / `verbs (2)` on 2026-08-28 and publishes four names today, and
   `suites` and `catalog` are four-way as well. Where the content should be
   required and the name is not fixed, the requireable name is the job's
   always-reporting `-result` aggregator.
3. **Its content is load-bearing for a merge** — it is a gate somebody would
   revert a merge over.

Everything below follows from those three, and the *reason a job is out* is
always one of them rather than a judgement about the job.

## The required set

    gate
    verify
    freshness
    catalog-result
    suites-result
    verbs-result
    record
    revision-loop

**Wall clock, MEASURED on run #1216 (`33559152222`, 2026-09-01, sha `54650e5`),
a fully green post-sharding run.** These are per-job wall clocks from the
Actions API, not CPU sums — this file has been wrong in that exact way before
(`ci.yml`'s `suites` header carries the strike). A required check that takes 16
minutes is a real cost and is stated here rather than discovered:

| required check | wall | why it is in |
|---|---|---|
| `gate` | **1m03s** | Every other job `needs:` it. The cheapest check in the file, and a red `gate` means nothing downstream ran at all. |
| `verify` | **12m11s** | The site/API/connector contract: static API promises, promise→gate coverage, locale invariance, the edit differential, UI reachability. #125 merged with this red. |
| `freshness` | **16m26s** | Byte-reproducibility of the committed artifact plus the two-sided fault injection (0 escapes). #125 merged with this red, and it is the one proposed check that caught any of the four above (#1095). |
| `catalog-result` | **0m02s** (shards max 6m50s) | The catalog-wide smoke over every tradition. Required through the aggregator by rule 2 — `catalog` is a 4-way matrix — and by rule 1: `catalog` is also conditional, so a skip must PASS here. |
| `suites-result` | **0m03s** (shards max 9m22s) | The 75-suite pool. **Was "a policy call…not made here"; it is ruled IN**: #1090 and #1155 were red in nothing else. Required through the aggregator by rule 2. Its `skipped` arm FAILS (`suites` has no `if:`, so a skip means `gate` did not succeed and no suite ran). |
| `verbs-result` | **0m03s** (shards max 11m42s) | `test_verbs`, the longest suite here and the one holding the checks aimed at CI itself (§43 parses this workflow; §24 catches suites that are named by nothing). Required through an aggregator **added to `ci.yml` by this ruling** — rule 2 left `verbs` with no fixed name, which is the same debt sharding incurred for `catalog` and `suites`, noticed twice and never generalised. |
| `record` | **6m28s** | The register against the code: doctrine numbering, entry claims in `MISSING.md`/`BACKLOG.md`, committed counters re-measured, `data/sources.tsv` rows against their files. **#1125's only red job.** This repository's central discipline is that the record does not lie about the code; a merge that may break the record and not the code is exactly the merge this check exists for. |
| `revision-loop` | **10m24s** | `test_revise` + `test_loop` — the writer's revision path. It was PART of `suites` until 2026-08-18 and left for wall clock, not because its content stopped mattering. A job may not lose required status by a scheduling move. |

**Adding the four new checks costs ZERO wall clock.** The run's critical path is
`freshness` at 16m26s, and every addition — `suites-result` (its slowest shard
9m22s), `verbs-result` (11m42s), `record` (6m28s), `revision-loop` (10m24s) —
finishes inside it. Whole-run wall on #1216 was **18m16s**. So the merge waits
about 18 minutes either way, and the four-check set was not buying speed; it was
only declining to look.

### What is NOT required, and which rule excludes it

| job | rule | reason |
|---|---|---|
| `catalog`, `suites`, `verbs` | 2 | Matrix jobs. Required through `catalog-result` / `suites-result` / `verbs-result`. Never name the shards. |
| `tandem` | 1 | `workflow_dispatch` or the Monday `0 6 * * 1` schedule. Does not run per-PR. |
| `mutation` | 1 | `workflow_dispatch` or the `17 4 * * *` schedule. A shard is hours. |
| `nightly` | 1 | Same condition as `mutation`; `timeout-minutes: 240`. |

That is every job in `.github/workflows/ci.yml`. The set is complete: nothing
per-PR is silently outside it.

### Why the `-result` jobs, and not the obvious names

`catalog-result` is a summary job added for this purpose. The `catalog` job
itself **cannot** be required:

1. It is a matrix, so it publishes four expanded names — `catalog (shard 1/4)`
   and friends. Requiring names that carry a matrix value means re-editing the
   required set every time the shard count changes, and the shard count exists to
   track catalog growth, so it will change.
2. It is conditional — skipped whenever no changed path can move an artifact. A
   required check that never reports blocks the merge **forever**, and that
   failure mode stays invisible until someone opens a docs-only PR and finds it
   un-mergeable.

A conditional job does still report a `skipped` conclusion (`tandem` does exactly
that). But `tandem` has neither a matrix nor a `needs:`, and `catalog` has both,
so that is evidence about a differently-shaped job rather than proof about this
one. `catalog-result` removes the question instead of betting on the answer:
fixed name, no matrix, ~~`if: always()`~~ **`if: ${{ !cancelled() }}`**. It
passes when the shards succeeded or were legitimately skipped, and fails on
anything else.

That struck condition is this page's own staleness and is corrected here rather
than overwritten (doctrine 17). `always()` was replaced in `ci.yml` on
2026-08-16 because it **includes the cancelled state**: the concurrency group is
keyed on the branch and not the event, so whichever run starts later kills
whatever is still running, and `always()` then aggregated a torn-down run into a
red X on a sha whose surviving run was green. The reason the job exists is
unchanged; the condition that makes it safe is not the one written here.

`suites` JOINED THAT LIST 2026-09-01, and the entry above turned out to describe
a rule rather than one job. `suites` — the 75-suite pool, the largest test job
here — was an ordinary fixed-name job and was requireable; it is now a four-way
matrix (`suites (shard 1/4)` and friends) for the same reason `catalog` is, so
reason 1 above applies to it word for word. Reason 2 does **not**: `suites`
carries no `if:`, so it runs on every event and a `skipped` result can only mean
`gate` did not succeed. `suites-result` is its always-reporting name, and it
differs from `catalog-result` in exactly that arm — a skip FAILS there and
PASSES here, from the same aggregate value, because a suite pool that never ran
must not report success.

~~Whether to add `suites-result` to the required set is a policy call and is not
made here.~~ **RULED 2026-09-02: it is IN**, on the evidence of #1090 and
#1155 — two merges whose only red job was `suites`, admitted by a set that
omitted it.

`verbs` was the third case and nobody generalised it. It is a four-way matrix
with no `if:`, i.e. `suites`'s shape exactly, and it had no aggregator — so the
rule that had been discovered twice was still being applied one job at a time.
`verbs-result` is added to `ci.yml` by this ruling, mirroring `suites-result`
including the inverted `skipped` arm, and it is a 3-second job.

Do **not** add `tandem`, `mutation` or `nightly` — none of them runs per-PR.

## The other ruling: admins are NOT exempt

**Rulesets bind only actors outside the bypass list, and repository admins can be
exempted. Ruled 2026-09-02: do not exempt them.** The bypass list gets one
entry, the `github-actions` app, for the reason in the next section — and no
`repository_role` / `OrganizationAdmin` entry at all.

The argument is arithmetic, not principle. Every merge this ruleset exists to
prevent was made by `WeningerII`: #135 and #125 in the original finding, and all
four of the 08-28→08-30 runs above. This repository has one human. An
admin exemption therefore makes the ruleset apply to **nobody** — it would stop a
stranger's PR and nothing else, and there is no stranger.

The override is not lost, only made visible. The owner can set the ruleset's
enforcement to `disabled` (or `evaluate`) for the length of one emergency and
turn it back on, and that leaves a dated ruleset-history entry naming who did it
and when. A standing admin bypass leaves no record of any individual merge it
let through; a temporary disable leaves one of itself. Prefer the version that
writes something down.

"I want the safety net but I keep the override" remains a legitimate position for
a solo repo. It is available here as **disable-and-re-enable**, which costs two
clicks and produces a record, rather than as a standing exemption that costs
nothing and produces none. If the owner overrules this, the change is one entry
in `bypass_actors` and this paragraph is the thing to strike.

## The bypass you have to add, and what it costs

Add a bypass entry for the **`github-actions`** app (Ruleset → Bypass list →
Add → Integrations → GitHub Actions).

Without it, `.github/workflows/sync-pages.yml:195` — `git push origin main` — is
rejected by the "require a pull request" rule and the publish job starts failing.

Be clear-eyed about what this costs. It hands a standing exemption to the
`contents: write` identity that `AUDIT.md` rates as the repo's single CRITICAL
finding area. Two things make it tolerable today, and both are worth re-checking
if the workflow changes:

- That push has never actually executed. It is guarded by
  `if git diff --cached --quiet; then … exit 0`, and the `freshness` gate keeps
  the committed artifacts byte-identical to a fresh build, so there is normally
  nothing to commit.
- The push is a plain, non-force push onto a freshly-fetched `origin/main`, so a
  race resolves as a rejected non-fast-forward rather than an overwrite.

If you would rather not grant the bypass at all: the publish step is effectively
dead code, since Pages already serves `main` directly. Removing it is a real
option, and a cleaner one — but it is a separate change from this document.

## Applying it

Everything above is a decision; this section is the click. Either route produces
the same ruleset — use the UI if you want to see the bypass picker resolve the
GitHub Actions app for you.

### Route A — the UI

Repository → Settings → Rules → Rulesets → **New branch ruleset**.

| Field | Value |
|---|---|
| Name | `main` |
| Enforcement status | **Active** |
| Target branches | Include **default branch** |
| Bypass list | Add → Integrations → **GitHub Actions** (nothing else — no admin role) |

Rules to enable:

- **Restrict deletions**
- **Block force pushes**
- **Require a pull request before merging**
  - Required approvals: `0` is fine for a solo repo — the point here is that CI
    gets a chance to run, not that a second human reviews. Raise it if that
    changes.
  - Dismiss stale approvals on push: on
- **Require status checks to pass**
  - Require branches to be up to date before merging: **on**. Without it, a PR
    that was green against an older `main` can merge into a `main` that has since
    moved, and `freshness` — which byte-compares the committed artifact against a
    fresh build of *that tree* — is exactly the check that goes stale first.
  - Required checks: the eight names from **The required set** above, typed
    exactly. `verbs-result` will only appear in the picker's suggestions after
    the commit that adds it has run once; type it in either way.

### Route B — one `gh api` call

Written for the `gh` CLI, authenticated as the owner. It creates the ruleset in
one shot. `15368` is GitHub Actions' app id — **confirm it in the UI's bypass
list after creating**, because a wrong id there silently grants nothing and the
`sync-pages` push starts failing on the next merge instead.

    gh api --method POST /repos/WeningerII/CodexMusica/rulesets --input - <<'JSON'
    {
      "name": "main",
      "target": "branch",
      "enforcement": "active",
      "bypass_actors": [
        { "actor_id": 15368, "actor_type": "Integration", "bypass_mode": "always" }
      ],
      "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
      "rules": [
        { "type": "deletion" },
        { "type": "non_fast_forward" },
        {
          "type": "pull_request",
          "parameters": {
            "required_approving_review_count": 0,
            "dismiss_stale_reviews_on_push": true,
            "require_code_owner_review": false,
            "require_last_push_approval": false,
            "required_review_thread_resolution": false
          }
        },
        {
          "type": "required_status_checks",
          "parameters": {
            "strict_required_status_checks_policy": true,
            "required_status_checks": [
              { "context": "gate" },
              { "context": "verify" },
              { "context": "freshness" },
              { "context": "catalog-result" },
              { "context": "suites-result" },
              { "context": "verbs-result" },
              { "context": "record" },
              { "context": "revision-loop" }
            ]
          }
        }
      ]
    }
    JSON

To change the set later, `gh api /repos/WeningerII/CodexMusica/rulesets` lists
the ruleset ids and the same body goes to
`gh api --method PUT /repos/WeningerII/CodexMusica/rulesets/<id> --input -`.
Editing beats deleting: a replaced ruleset loses its history, which is the
record the admin-exemption argument above depends on.

`verbs-result` does not exist on `main` until the commit that adds it lands, so
if you apply this ruleset first, that one check will sit pending on the PR that
introduces it. Either land that commit first, or apply the ruleset with seven
checks and add the eighth after.

## What this still does not cover

- **`render.yaml` sets `autoDeploy: true`.** The MCP connector deploys on push to
  `main`, independent of CI. A ruleset gates what reaches `main`; it does not gate
  what Render does once something is there. (`AUDIT.md` F079, untouched.)
- **A green `freshness` proves less than it looks on some diffs.** The scope step
  skips the rebuild when no changed path is in the artifact build closure, and
  `.github/workflows/ci.yml` and `scripts/faults.js` are both classified *inert*
  (`node scripts/check_build_closure.js --affected <paths>`). So a PR that edits
  the CI wiring itself merges with the reproducibility assertion skipped. That is
  correct — neither file is read by any artifact builder — but it means the
  required check is attesting to less on exactly the PRs that change the rules.
  This bites the present change: the commit that adds `verbs-result` is a
  CI-only diff, so `freshness` will report green with its rebuild skipped.
- **A required check set is not a green-main guarantee.** The `schedule`-event
  runs on `main` go red independently of any merge (three of them between 08-29
  and 08-30 alongside the four above), and no ruleset touches those.

## Verifying it took

1. `GET /repos/WeningerII/CodexMusica/branches` — `main` must now report
   `"protected": true`.
2. Open a throwaway **docs-only** PR (touch a `.md` file). Confirm:
   - merge is blocked until all eight checks report;
   - `catalog-result` reports **success** with "Shards skipped", and does *not*
     hang pending — this is the failure mode the summary job exists to prevent;
   - `suites-result` and `verbs-result` report **success** with "All shards
     passed" — they have no `if:`, so on a docs-only PR they must have really run
     rather than skipped;
   - the PR is mergeable once the checks land.
3. Open a throwaway PR touching `references/` and confirm `catalog-result` waits
   for the real shards instead of short-circuiting.
4. After the next merge, confirm the `Sync site to Pages branch` run still
   succeeds rather than failing on a rejected push — that is the `github-actions`
   bypass entry proving it resolved to the right app.
