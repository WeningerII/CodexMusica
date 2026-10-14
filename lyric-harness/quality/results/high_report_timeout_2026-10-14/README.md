# High-report timeout investigation, 2026-10-14

No timeout, production source, grading policy, or provider configuration was changed.
Tests invoke the real local Python harness through an in-memory MCP transport;
they make no model-provider calls and are not live-service acceptance evidence.

## CI evidence

Read through the authorized GitHub connector, including full job logs. The
commit-workflow wrapper only returns pull-request-triggered runs and returned
empty lists for these push commits; the generic GitHub fetch endpoint found them.

| Exact head | Run / verify job | Test 8 | Overall verify |
| --- | --- | --- | --- |
| 6955e342963a90bdf470741266cea0dd84f0a797 | 38534604648 / 115755752499 | PASS, 114613.194789 ms | success |
| 43d32cdf3a039071d5f96cb84046c29f0e6d4ddd | 38554634818 / 115824305264 | FAIL, 60033.490420 ms | failure |
| 8ea94ac9d5141eb5062a8094351a9330f4edc38c | 38566931003 / 115863745234 | FAIL, 60058.138006 ms | failure |

Both failures are `MCP error -32001: Request timed out`, test location
`mcp/test_high_report.mjs:387:1`, with 9 pass / 1 fail. In each verify job,
high_report is the only failing leaf. The runner executes 83 leaves four at a
time. These facts do not establish contention as the cause. The passing
baseline test contains multiple requests; its 114.6-second whole-test duration
does not reveal the margin of any individual request against the 60-second
default MCP request limit. The other helper in the file explicitly uses 120
seconds, but test 8 uses the SDK default; neither was changed.

Relevant verbatim excerpts are preserved in the sibling `*-ci-excerpt.log`
files. They exclude unrelated setup output. All three entire CI runs concluded
failure; a passing verify job is not a claim that the entire run passed.

## Local setup and limitations

Detached disposable worktree `/workspace/musica-ci`, separate from the saved
R2 work and the continuation worktree. Run heads sequentially, checking out each
exact commit without changing tracked source. Node v24.19.0, CPython 3.12.14,
x86_64, cgroup CPU quota 400000/100000 (four CPU equivalents). CI uses Node 22;
this environment is not a CI replica. Other agents may use CPU concurrently.

Connector dependencies were installed from the committed lockfile using
`npm ci --prefix mcp --ignore-scripts --cache /tmp/musica-ci-npm`. Python uses
`/workspace/musica-ci-venv`, with the hash-pinned runtime requirements installed;
the additional installed cloudpickle 3.1.2 is a dependency of current NLTK.
CMUdict and runtime tagger/concreteness resources were staged using the
repository's explicit setup commands before testing.

Command at each head:

```
LYRIC_PYTHON=/workspace/musica-ci-venv/bin/python PATH=/workspace/musica-ci-venv/bin:$PATH node --test --test-reporter=tap mcp/test_high_report.mjs
```

The test file and MCP lockfile are unchanged across all three historical heads.
Their SHA-256 hashes are respectively
`23b14c3e5592a5fb6ea4ee544db6234ecfba291ee0e7399daa16b64911bbef75` and
`d40528964f67c91090e8d48c19a0872cf2ebbc31c072343054fd007940869db5`.

| Local exact head | Result | Test 8 duration (ms) | Entire file duration (ms) |
| --- | --- | --- | --- |
| 6955e342963a90bdf470741266cea0dd84f0a797 | 9 pass / 1 fail, MCP -32001 | 60468.651937 | 181597.805875 |
| 43d32cdf3a039071d5f96cb84046c29f0e6d4ddd | 10 pass / 0 fail | 75317.675377 | 158340.194034 |
| 8ea94ac9d5141eb5062a8094351a9330f4edc38c | 10 pass / 0 fail | 87172.678211 | 184565.922916 |

The baseline reproduces the timeout here, while both subsequent heads pass.
Host load was not controlled, and these
runs do not establish a later-head performance regression or a contention cause.
All local logs are retained as sibling TAP files. No deep profile was justified
by a demonstrated later-head slowdown. An external request-duration observer
can identify the expensive individual request on the final continuation head
without altering production code, assertions, or any timeout.

## Remaining qualification

The investigation verifies a repeated CI timeout at the two later historical
heads, not its root cause. Neither later head has a passing verify job in the
queried run. Do not call this resolved or claim contention from the local pass.
The next bounded step is an observed request-duration run at the exact final
head and its ordinary CI verify job, keeping the existing timeout. Any proposed
optimization requires evidence of the expensive path before changing code.
