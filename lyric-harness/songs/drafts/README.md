# The bytes a grading verb was handed

`<song>.<md5>.draft.txt` — the `load_lyric_lines` text a `song`, `brief`,
`revise` or `finish` run was graded on, banked by
`quality/song_log.py --record` and named by the md5 **the verb itself
printed**, so the file and the log's own `md5` fact agree by construction
(doctrine 1). `--record` fingerprints the bytes through the harness's own two
definitions before writing and, on a disagreement, writes NOTHING and says so:
a file whose name states an identity its contents may not have is worse than no
file.

**WHY THIS EXISTS.** `MISSING.md` M-196's 2026-09-02 addendum and M-168's "THE
BAN AGAINST THE BANK": the log banked an md5 of what was graded and not the
bytes, so `crooked_waltz` step 19 `29697fccfe8d`, `matinee` steps 54/55 and
`the_long_way_back` step 2 are **provable and unreadable** — six md5 rows, four
drafts, and the screen-versus-final measurement C18 asked for is not
constructible from them. Nothing written here can join that list.

**WHY THEY ARE COMMITTED AND NOT IGNORED.** The point is that a later reader
can grade the same bytes. A gitignored draft is one machine's disk: a clone
holds the md5 and not the text, which is exactly the state the entry above
measures. Cost, measured 2026-09-02: the bank's 50 md5 rows are 20 DISTINCT
md5s over 16 songs — the name is keyed on CONTENT, so a step that graded bytes
already banked re-uses their file. The sixteen committed lyrics are **13,411
bytes** of graded text, so all twenty drafts land near 16.8 KB.

**WHY HERE AND NOT BESIDE THE LYRIC.** `quality/test_songs.py` §1 globs
`songs/*.txt` and fails on any file there without a `.blueprint.json` beside
it. A draft in `songs/` needs an exclusion carved into that population gate,
and then a real lyric with no blueprint passes by being named `.draft.txt`
(doctrine 58). The subdirectory needs no exclusion anywhere.

**WHAT IS NOT HERE.** Nothing is backfilled. Sixteen of the bank's twenty md5s
are the songs' own committed bytes and `--drafts` reports them as
**RECOVERABLE** rather than banked, because a file written today from a re-hash
would make a run that recorded its bytes and a run that did not look identical
— which is the one distinction this directory is for (doctrine 20).

    python3 quality/song_log.py --drafts     # every banked md5 vs the bytes
