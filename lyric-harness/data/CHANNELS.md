# CHANNEL MAP — the egress policy is an ALLOWLIST

Doctrine 78. Six cells in one round independently rediscovered that
gutenberg.org is blocked and between them found eleven more blocked hosts.
That is six times the same probing, paid for six times. This file exists so a
cell reads the map instead of re-deriving it.

**REFRAMED 2026-08-21 (M-9).** This file was written as a blocklist and the
policy is not one: the gateway DENIES BY DEFAULT and answers 403 to CONNECT
for anything not on its list. A blocklist of 13 hosts implied 13 closed doors
and an open world; the truth is ~8 open doors. That inversion cost one cell
most of its authors (`data/sources.tsv:125`, which states the allowlist fact
this file contradicted for eleven days) and shaped six sourcing briefs.

**The proxy does NOT publish the allowlist, and its status endpoint is a
failure LOG, not a policy dump.** `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
returns `recentRelayFailures[]`, which is EMPTY until you probe and then names
each denied host as `connect_rejected: gateway answered 403 to CONNECT`.
Probe, then read it — that is the only enumeration available (verified
2026-08-21: empty before five probes, five rows after).

**Doctrine 49 applies to every row here: a row is a claim about the network at
a moment, not about the world.** Rows carry the date they were last probed. If
a row is stale and the source matters, re-probe it and edit the row in place
with the new date — do not add a second row. If you find a new channel, add
it; if you find a row is wrong, correct it and say when.

---

## OPEN — the doors that are known to work

| channel | last verified | evidence |
|---|---|---|
| **`git clone` / `git ls-remote` of any public GitHub repo** | 2026-08-21 | the single most useful channel in the list; works even though `codeload` tarballs 403 at the ORIGIN (see the correction below) |
| **`raw.githubusercontent.com`** | 2026-08-21 | `data/sources.tsv:67`, `:125` |
| **GITenberg** (`github.com/GITenberg`, ~50k repos) | standing | **overturned a committed NOT-FOUND row**: the Finnish Kalevala, recorded as unreachable, fetched in one call and validated at **81.3%** alliteration *(~~81.2%~~ REPINNED 2026-08-13: 3,253 of the first 4,000 verse lines, and 22,795 lines extracted rather than the 22,822 recorded — MEASURED by `quality/audit_kalevala_null.py --check`; the origin row is `data/sources.tsv:58`)* (doctrine 49). Search the org by REPOSITORY NAME — `mcp__github__search_code` does not index GITenberg text bodies (`data/sources.tsv:392`) |
| `mcp__github__search_code` / `search_repositories` | standing | locating a known text by a line of it, OUTSIDE GITenberg. Doctrine 51: count DISTINCT BYTES, not URLs — five hits in four repos were three copies of one file plus a fork. `search_repositories` throttles after ~8 calls |
| GITenberg search via `WebFetch` on github.com HTML | CONTESTED 2026-08-21 | this file said "no rate limit"; `data/sources.tsv:63` records 429 after a couple of `/search` hits. Both rows are committed and they disagree — RE-PROBE AND PICK ONE before relying on either |
| Hugging Face **MCP tools only** (`hf_whoami`, `hf_fs`, `hub_repo_search`) | 2026-08-21 | how `wikimedia/wikisource` is reachable despite wikisource being closed. `hf_fs cat` refuses binaries: `wikimedia/wikisource` config `20231201.cy` — Welsh Wikisource, one 1,251,259-byte parquet — is **named, located and unreadable** until someone has a parquet-capable channel (M-9's standing pointer). `huggingface.co` itself is closed at CONNECT |
| `gitlab.com`, `pypi.org`, `registry.npmjs.org`, `files.pythonhosted.org` | 2026-08-11 | the last three are in the proxy's own `noProxy` list, i.e. direct (`data/sources.tsv:125`) |
| `thabz/Kalliope` | standing | Nordic poetry, found late in a round nobody had mapped |
| `WebSearch` | standing, with the trap named | it works AND its results are often unfetchable — a Blaydon Races search returned mudcat, traditionalmusic and Wikipedia, every one refused at CONNECT (`data/sources.tsv:125`) |

## The stand-in shapes — a blocked host with an open twin

GITenberg for `gutenberg.org` · `unicode-org/unihan-database` for
`unicode.org` · the HF MCP tools for `huggingface.co`, and through
`wikimedia/wikisource`, for wikisource itself.

## KNOWN CLOSED — kept because a cell will try them anyway

Confirmed by `connect_rejected` 2026-08-21: `huggingface.co` (HTTPS — the MCP
route above is open), `gutenberg.org`, `cdn.jsdelivr.net`, `unicode.org`,
`archive.org` (what puts the Tin Pan Alley scans out of reach). Recorded
2026-08-10/11, not re-probed since: `gutendex.com`, `*.wikisource.org`,
`*.wikipedia.org`, `hathitrust.org`, `ccel.org` (Christian Classics),
`hymnary.org`, the Bodleian broadside ballads, `gsarchive.net` (Gilbert &
Sullivan Archive). `WebFetch` on any closed host still fails; the block is
per-host, not per-tool.

## CORRECTED 2026-08-21 — `codeload.github.com` was never egress-denied

It sat under "Blocked (egress-denied)". Measured: the tarball endpoint
returns **403 with a 378-byte body and logs NO `connect_rejected`** — the
tunnel opens and GitHub refuses at the origin. A different fact under
doctrine 49: still unusable for tarballs, for a different reason, and
`git clone` remains the route (five clones, no fallback, 2026-08-11).

---

## Known-good repositories already used

| repo | licence | scope — read this, not the repo root |
|---|---|---|
| `chinese-poetry/chinese-poetry` | MIT on the COMPILATION | the Tang and Song verse inside is a millennium out of any term (doctrine 40) |
| `cltk/non_texts` | `LICENSE_PERSEUS.md` CC-BY-SA-3.0 at root | covers **only** the Perseus fornaldarsögur, **not** the Snorra-Edda directory beside it (doctrine 54) |
| `cltk/old_norse_texts_heimskringla` | — | **byte-identical to `cltk/non_texts`** (md5 `c221b3761633838018e24ccf4e43e7fd`). Not a second source. |
| `sveinbjornt/sagadb.org` | BSD for the CODE | a separate README sentence affirms the TEXTS public domain |
| `OliverHellwig/sanskrit` | CC BY 4.0 | **except** the `corpus/GRETIL/` sibling, which is non-commercial |
| `hulbji/couyun` | MIT at repo root, covering the repository | Two fact tables from expired works (doctrine 40): `couyun/hanzi/hanzi_class.py` gives per-character 平水韻部 **and** 詞林韻部 for 36,891 characters, and `couyun/ci_pu/ci_list/` is the **欽定詞譜 of 1715 as 817 per-詞牌 JSON files** — which line ends a tune mandates as rhymes. The second is ground truth a ci measurement cannot get from any text (doctrine 62: the primary source is a spec). |
| `unicode-org/unihan-database` | Unicode License v3 at repo root — an express redistribution grant, conditioned on the notice travelling with the data | `kSemanticVariant`, `kZVariant`, `kSpecializedSemanticVariant`, `kTraditionalVariant` as plain TSV. The clean route to 異體字, and to telling a simplified form from a genuine variant. **`unicode.org` itself is egress-blocked** and this repo is the way round it — the same shape as GITenberg standing in for gutenberg.org. |
| `nk2028/qieyun-data` | CC0 1.0 at repo root | the UPSTREAM of `data/qieyun_mc.tsv`. `韻書/廣韻.csv` carries the 字頭, 小韻 number, 反切 and 釋義 the extracted TSV drops, and reading it is what proved WHY 魂 is unreadable: 小韻 483's 韻目原貌 is 魂 and its 字頭 is 䰟. Go here before theorising about a gap in the shipped table. |
| `cjkvi/cjkvi-variants` | **NONE — no LICENSE file of any kind. REFUSED.** | Has the largest 異體字 tables on the reachable network (twedu 564KB, hydzd 674KB, koseki 444KB). Silence is not permission (doctrine 92; this repo already refused `Guy-Bilitski/rcc-data` on exactly that). Unihan covers the same ground under an express grant. Recorded so it is not re-opened. |

---

## Rules a cell must follow when it uses this map

1. **Every file that lands in `corpus/` gets a row in `data/sources.tsv`.** A
   file with no row is the defect (doctrine 34).
2. **Record a failed search as a row, not as a memory** (doctrine 39). What was
   queried, what each channel returned, and the date.
3. **Read what a licence says it COVERS**, and record the path it covers
   (doctrine 54). A licence name without a scope is not evidence.
4. **Ask what the ORTHOGRAPHY does to the constraint before accepting any text**
   (doctrine 50). Modernised Icelandic breaks the dróttkvætt syllable count;
   Irish `text_standard` destroys the orthographic rhymes; a 1900 Malay spelling
   is CLOSER to the rhyming sound than the modern standard (doctrine 70).
5. **Check the specific channel, not the general legibility** (doctrine 52). The
   1848 Háttatal OCR reads fine and contains zero occurrences of any of the
   consonants a hending detector needs.
6. **Namespace your working files** (doctrine 77). A sibling cell overwrote a
   shared `fetch.sh` and cost ~30 fetches. Write intermediates under your own
   subdirectory of the scratchpad; only uniquely named deliverables are safe.
