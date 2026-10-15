# Current Lyrics controls: reachability receipt

Base: `30e52b401380393a6671cdddf5a4794b22065731`.
CI verify job `116677210500` reported 218/220 reachable capabilities: the old empty-draft Run review setup and removed Export menu selector failed. This receipt repairs test setup/inventory only; production controls and behavior are unchanged.

The Review precondition opens Lyrics, saves a local nonempty sung draft, then clicks the actual header Review button. The assertion requires an enabled Run review button inside the nonhidden Review panel. No review request is sent. Export opens Song actions; its assertion requires all four enabled actions (Copy with headers, Copy sung lines, Download text, Export session) in the nonhidden menu. No entries were retired, marked pending, or bypassed. Behavioral submission/export contracts remain covered by the existing page tests; this gate proves DOM reachability only.

## Red and green

- `before-http.txt`: unchanged baseline runner/inventory, 218 pass / 2 fail, specifically `lyrics-review-draft` and `lyrics-export`.
- `after-http.txt`: revised runner/inventory, 220 pass / 0 fail, same embedded bytes.
- `missing-*.txt`: each isolated HTML copy adds a MutationObserver that removes one actual rendered control. Each full gate run must exit 1 and report the corresponding capability as a missing selector. `negative-controls.py` contains the exact mutation and expected failures; no original HTML is modified.
- `negative-summary.txt`: all five controls independently rejected when absent.

The ordinary file-URL baseline was blocked by local Chromium policy (`ERR_BLOCKED_BY_ADMINISTRATOR`), recorded in `before.txt`; this was a setup failure, not a capability result. Local red/green and negative controls therefore use HTTP on 127.0.0.1:8936, serving identical embedded bytes. `local-runner.patch` records every runner-copy change: local module/fixture paths and navigation transport only, with no assertion or precondition changes. `make-runners.py` reconstructs these temporary runner copies and the original inventory from the pinned base SHA. Production runner transport is unchanged.

## Build and reproduction

```
NODE_PATH=/workspace/musica-repair/node_modules node scripts/build_html.js --out=/tmp/reachability-repair/codex.html --embedded --quiet
python /tmp/reachability-repair/make-runners.py
python -m http.server 8936 --bind 127.0.0.1 --directory /tmp/reachability-repair
# In another shell, repository cwd:
NODE_PATH=/workspace/musica-repair/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/musica-browsers node /tmp/reachability-repair/before-runner.js --html=/tmp/reachability-repair/codex.html
NODE_PATH=/workspace/musica-repair/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/musica-browsers node /tmp/reachability-repair/after-runner.js --html=/tmp/reachability-repair/codex.html
python /tmp/reachability-repair/negative-controls.py
```

`assets/icon-192.png` and the sparsely omitted inventory were materialized from HEAD as real files; no mutable fixture symlinks were used. Copy the two receipt Python scripts into the temporary directory before reproducing. The baseline script pins the pre-repair base SHA above so it remains reproducible after committing.

Embedded build: 25,010,641 bytes, SHA-256 `89caad586a78cc2f22d2c52d16d3b8ff8b5ab20f5299a7c3ab6b0000a0581865`.
Committed production `codex.html` remains SHA-256 `94dbde6a41896462fc82beeeb52213e26dea6b15bee03e4b11e2656878e3879e`.
`node --check` and Prettier check passed for the edited runner. These are local fixture results, not provider or live-service acceptance.
