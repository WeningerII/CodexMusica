# `wip/` — work in flight, and nothing else

**Everything here is TEMPORARY and is deleted by the sitting that produced
it.** This directory is not part of the harness, nothing reads it at run
time, and no measurement depends on it. It exists for one reason: a
derivation that costs CPU-hours should survive a container being reclaimed.

It is deliberately NOT under `data/`. `data/` is provenance-governed —
doctrine 34 says every file there needs a `data/sources.tsv` row, and
`quality/test_provenance.py` §12 fails on an orphan. Writing a provenance row
for an artifact that will be deleted within the hour would be churn in the
one table that must not be churned.

---

## `rhyme_capacity_parts/` — 2026-08-21

Per-family checkpoints from `quality/capacity.py --derive`, which is
re-certifying `data/rhyme_capacity_eng.tsv` against the rebuilt modal tables.

**Why the re-derivation is happening.** `chain_hi` is tier-1 arithmetic over
the pronunciation lexicon. `chain_lo` is certified THROUGH THE GRADER, whose
tier-2 (MODAL) ban reads two corpus-derived tables — and `66eb44e` rebuilt
both over the loaded corpus (46,881 → 131,394 and 39,122 → 97,129 rows). Every
committed witness clique had been certified against the old ranking, so
`test_capacity` §3 goes red with six families carrying banned pairs and 0
drift. `capacity.py` records the judge's md5s in the artifact now, so the next
time this happens the check names the moved table instead of leaving six
mysterious family failures.

**What one file is.** `<FAMILY>.tsv`, one line: `chain_lo<TAB>witness words`.
The witness is exactly what `Reviser.inspect` accepted — chain_lo by
construction, not by claim.

**Why they are committed at all.** Certification is the expensive half: about
2.5 CPU-hours for the deepest families, and the checkpoints lived in
container-local `/tmp`, where a reclaim would have taken all of them. 200K
buys immunity to that.

**Resume from them:**

```
python3 quality/capacity.py --derive --parts=wip/rhyme_capacity_parts
```

`derive()` reads an existing part instead of re-certifying that family, so
only the families still missing cost anything. Add `--budget=SECONDS` to stop
cleanly (exit 3) and re-invoke — the checkpoints carry the run.

**DELETE THIS DIRECTORY** in the same commit that lands the re-derived
`data/rhyme_capacity_eng.tsv` and repins `capacity.ADOPTED`. A checkpoint kept
after its artifact has landed is a stale copy of a superseded derivation, and
this repo has spent enough of today on exactly that shape.
