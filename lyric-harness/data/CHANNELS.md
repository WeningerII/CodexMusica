# CHANNEL MAP — what can be reached from inside this container

Doctrine 78. Six cells in one round independently rediscovered that
gutenberg.org is blocked and between them found eleven more blocked hosts. That
is six times the same probing, paid for six times. This file exists so a cell
reads the map instead of re-deriving it.

**Doctrine 49 applies to every row here: a NOT-REACHABLE row is a claim about
the network at a moment, not about the world.** Rows carry the date they were
last probed. If a row is stale and the source matters, re-probe it and edit the
row in place with the new date — do not add a second row.

**Append, do not rewrite.** If you find a new channel, add it. If you find a row
is wrong, correct it and say when.

---

## Blocked (egress-denied from this container)

Last probed 2026-08-10 unless noted.

| host | note |
|---|---|
| `gutenberg.org` | use GITenberg on GitHub instead — see below |
| `gutendex.com` | the Gutenberg JSON API; same block |
| `*.wikisource.org` | including all language subdomains |
| `*.wikipedia.org` | |
| `archive.org` | this is what puts the Tin Pan Alley scans out of reach |
| `hathitrust.org` | |
| `ccel.org` | Christian Classics Ethereal Library |
| `hymnary.org` | |
| Bodleian broadside ballads | |
| `gsarchive.net` | Gilbert & Sullivan Archive |
| `codeload.github.com` | the tarball endpoint — `git clone` still works |
| `cdn.jsdelivr.net` | |

## Reachable

| channel | how | note |
|---|---|---|
| **`git clone` of any public GitHub repo** | plain `git clone https://github.com/OWNER/REPO` | works even though `codeload` is blocked. This is the single most useful channel in the list. |
| **GITenberg** | `github.com/GITenberg` — Project Gutenberg mirrored as ~50k repos | **overturned a committed NOT-FOUND row**: the Finnish Kalevala, recorded as unreachable, fetched in one call and validated at 81.2% alliteration (doctrine 49) |
| **GITenberg search via `WebFetch`** | fetch the org's HTML search page | **no rate limit**, unlike the MCP `search_repositories` tool, which throttles after ~8 calls |
| `mcp__github__search_code` | GitHub-wide code search | good for locating a known text by a line of it. Doctrine 51: count DISTINCT BYTES, not distinct URLs — five hits in four repos turned out to be three copies of one file plus a fork |
| `huggingface.co` datasets | the HF MCP tools, and `hf_fs` | how `wikimedia/wikisource` is reachable despite wikisource itself being blocked |
| `thabz/Kalliope` | GitHub repo | Nordic poetry, found late in a round nobody had mapped |
| `WebSearch` / `WebFetch` | general | `WebFetch` on a blocked host still fails; the block is per-host, not per-tool |

## Known-good repositories already used

| repo | licence | scope — read this, not the repo root |
|---|---|---|
| `chinese-poetry/chinese-poetry` | MIT on the COMPILATION | the Tang and Song verse inside is a millennium out of any term (doctrine 40) |
| `cltk/non_texts` | `LICENSE_PERSEUS.md` CC-BY-SA-3.0 at root | covers **only** the Perseus fornaldarsögur, **not** the Snorra-Edda directory beside it (doctrine 54) |
| `cltk/old_norse_texts_heimskringla` | — | **byte-identical to `cltk/non_texts`** (md5 `c221b3761633838018e24ccf4e43e7fd`). Not a second source. |
| `sveinbjornt/sagadb.org` | BSD for the CODE | a separate README sentence affirms the TEXTS public domain |
| `OliverHellwig/sanskrit` | CC BY 4.0 | **except** the `corpus/GRETIL/` sibling, which is non-commercial |

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
