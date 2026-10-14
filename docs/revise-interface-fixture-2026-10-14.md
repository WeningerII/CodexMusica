# Revise interface fixture — 2026-10-14

The former four-line AAAA fixture in high-report test 8 required nearly 60 seconds of worker CPU in a failing CI request against the unchanged 60-second SDK deadline. John approved a bounded test-only adjustment after disclosure of the coverage tradeoff.

The test now uses the original first two lines with scheme AA. It requires initial revision 1, a state continuation suspending at revision 2, and an unconditional returned-note continuation reaching revision 3 on the same run. Declaration refusals, long-answer rejection and shared-cache identity checks remain. The note must name the revision that is then used. A terminal state cannot silently skip this path.

This removes the three-violating-member workload and replaces the second state continuation with the note continuation. It does not claim to fix production latency. The original four-line fixture, failed-run diagnostics and bounded probes are preserved in the [diagnostic receipt](https://github.com/WeningerII/CodexMusica/tree/07b0e35d7434b0180e3ca1a2d43b8e92c8928fe3/lyric-harness/quality/results/final_timeout_2026-10-14). The separate broader continuation tests are not claimed to be an identical witness.

The focused implemented test passed with a first request of 10.943 seconds locally, leaving about 49 seconds below the same deadline. This local measurement is not exact-head CI qualification. Production behavior, timeouts and unrelated records are unchanged.
