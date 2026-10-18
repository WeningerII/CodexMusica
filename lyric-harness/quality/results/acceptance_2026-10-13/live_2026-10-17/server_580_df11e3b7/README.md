# #580 (df11e3b7) server live check, BB8, 2026-10-18

The deploy run 39080494999 (dispatched after production qualification 39076891337) posted the deploy hook at 23:50:32 UTC.

- **Build:** `/health` reports `commit` and `build.commit` `df11e3b7b3837708241c5d360b2e63e724cd4a95`, release `1255164302:39074801295:1:lyrics-image`.
- **check_live:** the deploy's own `check_live.mjs --commit=df11e3b7 --ready --config=render --image-manifest=verified-image/lyrics-image.json` printed MATCH at 23:53:35 and 23:53:43 UTC: 21 tools, full metadata and initialization match (`deploy_check_live.txt`).
- **/ready:** 200 by itself, after one attempt: `mode: sync`, started 23:51:49.021Z, 17,707 ms, passed. The children were inventory (10,596 ms) and capacity (6,001 ms), each with a 30,000 ms limit. `in_flight` is null and there was no background retry. Second Render cold sample: 17.7 s, against 18.7 s on 070d0875.
- **Library:** `/library/v1/health` 200, with `capabilities.pronunciation_numbering` = `["v1","v1+voices","v2","v2+voices"]`. The pre-deploy baseline had no `capabilities` key.
- **Reader:**
  - `/health.reader` reports ready true, enabled true, and the catalog snapshot `ef7cc67b…`. `/health.library.state` is ready.
  - On this build the reader is mounted only after `probeReaderScheme` returns `v1` or `v2`; otherwise the server refuses READER_UNAVAILABLE and mounts no reader. So the probe returned a known scheme.
  - `/health` does not print which scheme. Locally, the df11e3b7 tree (identical to the 54304b34 tree I passed) reports `reader_scheme()` = `v2`.
- **Chat ledger:** `capDurable` true, `accountingBlocked` null, reserved and unknown 0, `countingSince` 23:52:15Z.
