# Stream-guard reopen evidence (2026-10-11)

Raw evidence behind the parked #535 follow-up (the proven-reader stream guard
in `mcp/library_export_routes.js`). It answers one question: when a client
reads a guarded download slowly, how long can the server's public progress
signals stay frozen while the client is healthy?

- `probe.mjs` — the probe (no guard): serves 200 MB to six concurrent clients,
  three reading at 10,240 B/s and three at 4,096 B/s, and logs one JSON line
  per stream per second.
- `run.jsonl` — one run, 130 s (`node probe.mjs 130 > run.jsonl`). The first
  line is the setup record (Node version, kernel, transport, client, payload,
  write size, rates, the TCP buffer sysctls); every other line is a sample
  `{stream, t, bytes_written, write_callbacks_bytes, tx_queue}`.

## Setup (from the setup record)

Node v22.22.0, Linux 6.18.44-fc-v114 (a cloud container). TCP over loopback
127.0.0.1, plain HTTP (`node:http` server and client; no TLS in this run). The
client pauses on each data chunk and resumes after `chunk.length / rate`
seconds. The server writes 64 KiB drain-paced writes. `net.ipv4.tcp_wmem`
4096 16384 4194304, `net.ipv4.tcp_rmem` 4096 131072 33554432,
`net.core.wmem_max` and `rmem_max` 4194304, `tcp_moderate_rcvbuf` 1 (receive
buffer autotuning on). Per-socket SO_SNDBUF/SO_RCVBUF were not read (Node
exposes no getter).

## What the run shows

Each stream's samples, collapsed to the seconds at which any value changed
(t s: bytes_written / write_callbacks_bytes / tx_queue):

| stream | changes |
|---|---|
| 0, 10,240 B/s | 1: 5,702,546 / 5,636,096 / 4,170,857 · then tx_queue only: 26: 3,875,892 · 52: 3,589,172 · 84: 3,303,476 · 115: 2,954,292 · 128: 2,829,364 |
| 1, 10,240 B/s | 1: 3,932,831 / 3,866,624 / 2,975,744 · 26: 5,440,366 / 5,373,952 / 4,192,520 · then tx_queue only: 58, 71, 96 |
| 2, 10,240 B/s | 1: 3,932,831 / 3,866,624 / 2,975,744 · 26: 5,440,366 / 5,373,952 / 4,192,520 · then tx_queue only: 52, 71, 96, 128 |
| 3, 4,096 B/s | 1: 3,932,831 / 3,866,624 / 2,975,744 · 64: 5,440,366 / 5,373,952 / 4,192,520 · 128: tx_queue 3,906,824 |
| 4, 4,096 B/s | 1: 3,932,831 / 3,866,624 / 2,975,744 · 64: 5,440,366 / 5,373,952 / 4,192,520 · nothing more to 130 s |
| 5, 4,096 B/s | 1: 5,833,636 / 5,767,168 / 3,624,394 · then tx_queue only: 80: 3,269,066 |

1. After the first second, `bytes_written` and `write_callbacks_bytes` moved
   at most once more in 130 s (streams 1–4, a ~1.5 MB step at 26 s or 64 s)
   and not at all for streams 0 and 5. A guard reading only those two
   signals cannot tell these healthy readers from a reader that reads
   nothing, for the length of these gaps.
2. `tx_queue` (`/proc/net/tcp`, Linux-only, not a Node private handle) does
   move while the other two are frozen: it falls in steps of roughly
   260–350 KB, about every 26–32 s at 10,240 B/s and every ~64 s at
   4,096 B/s (stream 5 first at 80 s). This corrects an earlier report from
   this work that tx_queue was frozen too (that came from sampling every 2 s
   over 20 s, too short to see a step).

## Limits of this evidence

- This is one run of six streams. "2 of 3 streams" anywhere in the
  follow-up's discussion is a sample, not a rate.
- A stream showing no reopen within 130 s does not establish that any
  particular longer limit (such as 330 s) would cover it: nothing was
  measured past 130 s.
- Loopback only. In production the server's TCP peer is Render's proxy, not
  the browser; burst and step sizes there have to be measured there.
- No TLS in this run (the guard's TLS behaviour is covered by the tests in
  `mcp/test_library_corpus.mjs`, not by this trace).
- The sysctls are the container's; other kernels autotune differently.
