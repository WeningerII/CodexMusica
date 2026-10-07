# PR 460 / 479 integration checkpoint — 2026-10-07

This branch preserves the reviewed integration, lint repairs and safe-point test
continuations. **PR 479 is not qualified for merge.** Its original author branch
remains at `88abb0a04e4b174939e6594cac0b49806e3e9584`.

The separate experimental projection is preserved at
[`d49e08cd`](https://github.com/WeningerII/CodexMusica/commit/d49e08cd)
on `codex/repair-460-479`. It is absent from this branch's production source.

## Completed checks

- Main/PR 460 conflicts resolved while preserving the bound-word behavior,
  current handbook layout, and the author's subsequent dependency update.
- All 11 original PR 479 ESLint findings repaired; sparse-tree ESLint passed.
- Five connector redesign tests passed; two additional test-helper controls
  passed (local Node 24 / Python 3.12, before the inherited SDK update).
  These are scoped checks, not final remote qualification. A saved exit-5 call resumes without repeating its answer, while errors
  and killed calls remain failures.
- The experimental projection passed all 46 production-revision tests in
  576.494 seconds on Python 3.11.16, including normal-reporting grade parity.
  This validates those semantics, **not completion within the runtime budget**.

## Reproduced blocker

On the current integrated plan, a cold first call already stalls inside its
first L1 end-word place. The baseline remained unfinished after 606 seconds;
the projection remained unfinished after 610 seconds. Both exceeded the
599-second deadline with zero completed places saved. No warm continuation was
needed to reproduce this failure. A focused warm-proxy probe independently
showed correct hook cleanup and identical cached/resumed results.

A bounded 10-grade trace completed in 75.714 seconds. Five demanded single-pair
checks cost 0.0165–0.0294 seconds each; four required collateral checks over ten
pairs cost 9.77–11.78 seconds each. The first fallback pool contains 24 candidates.
The narrow first-pass projection therefore does not resolve the expensive
collateral work. No further equivalent resolver optimization was proven.

Do not remove collateral checks, truncate search, increase timeouts, or accept
killed calls to make this green. Finer-than-place checkpointing would expand the
existing Option B design and is outside this bounded pass. Full connector
continuation and the combined 45-minute verify-job runtime remain unqualified.
Historical walk counts cannot be copied: main's plan change `fd06327c` changed
the integrated fixture.

Raw logs and diagnostic scripts in [evidence](evidence/) preserve both failed
and passing experiments; their intermediate status fields are historical.
Some reproducer scripts name the original staged local paths. The final bounded
outcome is this document and [handoff.json](handoff.json).
