# M-78 — convention versus failure, 2026-09-17

Implementation and verification are in progress. No calibration pass or
comparator repin is claimed yet. Based on main fe9181f7, with open PRs
328 and 329 inspected for changed files; neither changes comparator inputs.
PR 330 concerns shared counters and will be integrated before final validation.

Doctrine 96 formalizes the existing convention policy without changing a
finding's severity or the permitted region. The census now enforces that
policy on membership as well as counts. The mutation controls exchange a
convention and a flag while holding every aggregate count constant, and
separately test mandatory pursuit and the length gate. Removing the new
check recreates the old false pass. Declared requirements still gate.

The first four compute attempts refused (exit 2) because the research
concreteness resource was absent. They are retained as staging refusals,
not measurements. The established research stager supplies and checks it
before the fresh computations. Each recomputation uses its own initially
absent memo; no invalidated memo is reused.

The comparator edit is confined to doctrine numbers in comments, the CLI help
and diagnostic strings. `comparator-source-comparison.json` compares the
before/after Python ASTs after normalizing only doctrine-reference numbers;
they are equal. This explains the expected absence of numeric movement but
is not used to waive recomputation or advance the pin.

Focused verification completed so far:
- `gate-census-tests.txt`: all sections pass, including promotion mutations.
- `doctrines.txt`: 96 definitions, contiguous numbering, matching index,
  preserved pre-split baseline, valid registry and references; PASS.
- `entries.txt`: no false entry claims.
- `record-gates.json`: pin argv, figures, census, battery rounds, data rows,
  and triage checks all exit 0.
- `docs.txt`, `format.txt`, `promises.txt`: documentation paths, workflow
  formatting, and promise coverage pass.

These are local working-tree receipts. The later source hashes identify the
published files; CI must qualify the final published head and current base.
