# Branch protection for `main` — the config to apply, and why

`main` is currently **unprotected**. Verified against the live API on 2026-08-08:
`GET /repos/WeningerII/CodexMusica/branches` returns `{"name":"main", "protected": false}`.

Everything in this repository's verification story — the machine-checked
promises, the two-sided fault injection, the byte-reproducible artifact — is
advisory until this changes. A gate that a merge is not required to satisfy is a
gate only in the sense that it prints.

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

## The config

Repository → Settings → Rules → Rulesets → **New branch ruleset**.

| Field | Value |
|---|---|
| Name | `main` |
| Enforcement status | **Active** |
| Target branches | Include **default branch** |

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
  - Required checks:

    ```
    gate
    verify
    freshness
    catalog-result
    ```

### Why those four names, and not the obvious ones

`gate`, `verify` and `freshness` are ordinary jobs with fixed names.

`catalog-result` is a summary job added for this purpose (`.github/workflows/ci.yml`).
The `catalog` job itself **cannot** be required:

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

Whether to add `suites-result` to the required set is a policy call and is not
made here. What is recorded here is that sharding `suites` moved it out of the
set of names a merge can depend on, and that `suites-result` is the name to use
if it should be back in.

Do **not** add `tandem` — it is a weekly/on-demand job and does not run per-PR.

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

## The decision that is actually yours

**Rulesets bind only actors outside the bypass list, and repository admins can be
exempted.** Both merges that motivated this — #135 and #125 — were made by
`WeningerII`, the repo owner.

So: if you exempt admins, this ruleset changes nothing about the two incidents it
was written to prevent. It will stop a stranger's PR and nothing else.

Decide explicitly. There is no wrong answer — "I want the safety net but I keep
the override" is a legitimate position for a solo repo — but it should be a
choice rather than a default, because the default is the version that does not
work.

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

## Verifying it took

1. `GET /repos/WeningerII/CodexMusica/branches` — `main` must now report
   `"protected": true`.
2. Open a throwaway **docs-only** PR (touch a `.md` file). Confirm:
   - merge is blocked until the four checks report;
   - `catalog-result` reports **success** with "Shards skipped", and does *not*
     hang pending — this is the failure mode the summary job exists to prevent;
   - the PR is mergeable once the checks land.
3. Open a throwaway PR touching `references/` and confirm `catalog-result` waits
   for the real shards instead of short-circuiting.
4. After the next merge, confirm the `Sync site to Pages branch` run still
   succeeds rather than failing on a rejected push.
