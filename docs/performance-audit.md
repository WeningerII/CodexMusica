# Performance audit — 2026-09-15

A measured pass over the twenty standard web-performance items, run against the
built site in real Chromium with Lighthouse 12.8.2. It exists because the
alternative to measuring is guessing, and several items on that list turned out
to be already done, already rejected for a reason, or not actionable on this
stack — which is only visible once the numbers are in front of you.

## How these numbers were produced

Lighthouse's defaults are a mobile profile with 4x CPU throttling and simulated
slow 4G. That is the right lens for "how does this feel on a mid-range phone",
and it is unforgiving of a large page. Two corrections were needed before the
run meant anything:

- **The local server must gzip.** A plain `python3 -m http.server` sends
  `codex.html` uncompressed at 5,430,853 bytes; GitHub Pages sends it gzipped at
  1,427,626. Auditing the uncompressed figure measured a transfer production
  never makes, and cost about 20 points on its own.
- **Third-party calls must be excluded, not left to hang.** This sandbox's proxy
  blocks outbound HTTPS, so `mcp.codexmusica.com/chat/status` (the chat dock's
  readiness probe) and the atlas's Google Fonts request time out rather than
  resolve. A timeout is not a slow response: it pushed reported LCP to 16.1s on a
  5.9 KB landing page. They are excluded via `blockedUrlPatterns` so they fail
  fast, which is nearer production than a hang, but is still not the same as a
  live response. **Treat the two app scores as a floor, not a reading.**

## Scores

| page | perf | a11y | best-practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `atlas.html` | **95** | 100 | 100 | 92 | 1.4 s | 1.4 s | 260 ms | 0 |
| `index.html` | 35 | 95 | 100 | 91 | 4.2 s | 16.1 s | 1,990 ms | 0.063 |
| `codex.html` | 28 | 95 | 100 | 91 | 7.7 s | 15.3 s | 2,300 ms | 0.063 |

`index.html` is not a separate result. It is a 5.9 KB text landing page that
redirects to `codex.html` by design — plain text for LLM fetchers, the app for
humans — so its score is `codex.html`'s plus one redirect hop (Lighthouse prices
the hop at 600 ms). The redirect is load-bearing, not a defect.

`codex.html`'s 28 is dominated by one thing, and it is not a missing
optimisation: 2,775 KiB of page, nearly all of it JavaScript, parsed and
executed under a 4x CPU throttle. TBT of 2,300 ms is that parse. No further
squeezing moves it much; only shipping less code would, and the lazy shell
already keeps 66% of the catalog out of the page.

## The twenty items, as measured

**Already done, and Lighthouse confirms it**

| item | evidence |
|---|---|
| Minify JS | `unminified-javascript` scores **1** on `codex.html`. |
| Compress payloads | `uses-text-compression` scores **1**. |
| Defer non-critical scripts | `render-blocking-resources` scores **1**. Every script is inline or at `</body>`. |
| Split code into chunks | 19 `<script>` blocks, largest 750 KiB against a 1024 KiB ceiling. |
| Add a CDN | GitHub Pages. |
| Lazy loading | The lazy shell fetches `api/browse.json` once and pulls traditions on demand. |
| Paginate large lists | Sharded into 2,589 per-entity JSON files rather than paged. |
| Cache API responses | `Catalog.ensureFull` memoises: two calls for the same tradition make **one** network fetch (verified). A cold visit is 2 requests total. |
| Server-side caching | `mcp/engine.js` holds a bounded catalog memo, keyed only to real tradition ids after a measured 315 MB exhaustion bug. |
| Cache expensive queries | The search index normalises once instead of per keystroke — a measured ~35x. |
| Compress images | Mostly SVG; the rasters are the pinned icon set. |
| Avoid unnecessary re-renders | No framework, so no re-render cycle to avoid. |

**Not applicable to this stack**

Index the database, avoid N+1 queries, database connection pooling — there is no
database anywhere. Remove unused dependencies — the root has **zero** runtime
dependencies; the connector has four, all used.

**Changed by this pass**

*Debounce input handlers.* Partly done already, and the part that was done was
tuned deliberately: the tradition picker debounces at 30 ms, cut down from 120 ms
once the search index made a keystroke cheap, with a note arguing that a long
delay "stops hiding cost and becomes the cost". Measuring the three search inputs
against that standard, in Chromium, per keystroke:

| input | steady state | first keystroke of a burst | debounced? |
|---|---|---|---|
| preface picker | ~15 ms | 60–152 ms | **now, at 30 ms** |
| tradition picker | ~9 ms | 59 ms | already, at 30 ms |
| instrument picker | 1.6–8.2 ms | 8.2 ms | no, and correctly so |

Only the preface picker was both undebounced and expensive. The instrument
picker is left alone on the same reasoning the existing note gives: at 2 ms a
30 ms delay would be the largest term in how the list feels.

That debounce is not free, and the cost is a correctness one. The preface input's
Enter handler reads the rendered list to commit the top match, so a pending
render leaves a 30 ms window where Enter acts on the *previous* query's results —
and typing a name then hitting Enter is the normal way to use it. Demonstrated
live before fixing: after typing `bright`, the top match was still `bittersweet`
until the pending render was flushed, then `blazing`. The handler now flushes
first.

**Open, and each needs a decision rather than a patch**

- *Loading skeletons.* The chrome — header, nav, every action button — paints at
  ~150 ms, but the workspace stays empty until ~1,150 ms. No errors and no
  early-click hazard were found, so this is presentation, not correctness. A
  skeleton would fill ~800 ms of visible emptiness.
- *HTTP caching of `api/`.* `uses-long-cache-ttl` finds 0 cacheable resources,
  because GitHub Pages sets its own headers and this repo cannot change them. The
  only lever is a service worker, which is a real architectural addition with its
  own staleness and update story.
- *Minify the atlas's scripts.* `atlas.html` serves `src/atlas.js` and
  `src/map-ui.js` as raw source; Lighthouse estimates 5 KiB. That page already
  scores 95, and minifying would mean a second generated artifact with its own
  freshness gate. Not obviously worth it.
- *Load balancer.* One Render instance on the Standard tier, sized by a measured
  826–882 MB peak per lyric call. Adding instances is a spending decision and the
  owner's to make.
