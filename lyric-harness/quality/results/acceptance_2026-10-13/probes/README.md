# Acceptance probes for H1, P-A and #561

BB8 owns the independent qualification of these three items (#527 6194001452). Each probe runs a tree's **own** code. The probes are fixed before any fix lands, so the fix has a stated target. Everything here is local; nothing runs live.

## `h1_pin_guard/h1_probe.py` — H1 (declared relation refused by the numbering guard)

    cd lyric-harness && python3 quality/results/acceptance_2026-10-13/probes/h1_pin_guard/h1_probe.py <TREE> <OUT.json> [PYTHON]

**What it runs:** `brief --reader-scheme=v2 --groups=1.T2,2.T2 --relation="perfect rhyme"` under the `none` and `v2` supplements. It adds `--numbering=v2` where the tree accepts that flag.

**Cases:**
- five repeated multi-reading words after a dash join: `Read--read`, `Lead--lead`, `Wound--wound`, `Tear--tear`, `Live--live`;
- a plain control, `I read, I read it again`;
- one caller-side ambiguity case (H4, `I 2 love you love` with unmarked `1.T3,2.end`).

**Pass rule for a fix head:** every `judge` case is JUDGED, and the ambiguity case is REFUSED.

**Results so far** (`h1_pin_guard/out/`):

| Tree | Result |
|---|---|
| `5e97e06f` | all six `judge` cases JUDGED. The ambiguity case is JUDGED too, because the refusal didn't exist yet, so the probe exits FAIL there by design. |
| `b887e5ef` | the five dash cases are **UNJUDGED (`SCHEME_UNREADABLE`) under the `v2` supplement** and JUDGED under `none`. The control is JUDGED, and the ambiguity case is REFUSED. |

So H1 is not one witness: all five multi-reading words fail.

## `blank_guard/blank_probe.py` — #561 (blank-replacement guard)

    cd <TREE>/lyric-harness && python3 <this dir>/blank_guard/blank_probe.py <TREE>/lyric-harness <OUT.json>

**What it runs:** the tree's `swap_end_word` and `swap_at_slot(1.T2)` on `the room on fire`, under v1 and v2, for 17 replacement words.

**Gate:** every whitespace-blank replacement must decline, and every lettered replacement must splice. Invisible-only (Unicode Cf/Zs) and punctuation-only replacements are reported but not gated until a rule is set.

**Results** (`blank_guard/out/`):

| Tree | Blank (10) | Invisible (12) | Punctuation (8) | Words (4) | Gate |
|---|---|---|---|---|---|
| `b887e5ef` | **spliced** | spliced | spliced | spliced | FAIL |
| `d85d2f26` | declined | spliced | spliced | spliced | PASS |

## `pa_voices/` — P-A (a voices toggle binds another word)

`pa_voices/README.md` gives the full rule and the commands. In short:
- **Page side:** a node replica, running the tree's own `lyrics.js` with its send through `lySubmitLyricsAction('review')`. **It is not a browser run.**
- **Harness side:** the tree's own `normalize-numbering`.
- **Matrix:** 162 cases — 4 lines; groups, returns and readings; rows written by the migration, written by a form, or stored as `b887e5ef` writes them; voices off→sung and sung→off, plus controls.
- **Pass rule:** 3PO's preserve-or-refuse (#527 6194066262). Never bind a different word silently. A row with no recorded basis passes only if it is refused with its bytes unchanged, or if every plausible basis binds the same occurrence.

**Results** (`pa_voices/out/`):

| Page tree | Harness tree | SAME_WORD | REFUSED | WRONG_WORD | Fail (incl. GUESSED) |
|---|---|---:|---:|---:|---:|
| `b887e5ef` | `b887e5ef` | 105 | 25 | **32** | 64 |
| `8ea94ac9` | `b887e5ef` | 66 | 75 | 21 | 51 |
| `5e97e06f` | `b887e5ef` | 66 | 75 | 21 | 51 |

**What the results show:**
- At `b887e5ef`, every form-written row, which records its basis, passes. All 32 WRONG_WORD cases come after a voices flip, on rows with no recorded basis. One example: `Oh--oh, (ah) oh my love`, where love becomes my.
- The older pages' 21 WRONG_WORD cases are read by the `b887e5ef` harness, because those trees have no `normalize-numbering`. They sit on lines where the v1 and v2 cuts number the target the same, so the harness has no ambiguity to refuse. They are older than `b887e5ef`.
- The 32 GUESSED failures at `b887e5ef` are controls (no flip) on rows with no recorded basis. 3PO's rule counts them as failures; 3PO should confirm that is intended.
