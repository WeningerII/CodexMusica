# Acceptance probes for H1, P-A and #561

BB8 owns the independent qualification of these three items (#527 6194001452). Each probe runs a tree's **own** code. The probes are fixed before any fix lands, so the fix has a stated target. Everything here is local; nothing runs live.

## `h1_pin_guard/h1_probe.py` — H1 (declared relation refused by the numbering guard)

    python3 lyric-harness/quality/results/acceptance_2026-10-13/probes/h1_pin_guard/h1_probe.py <TREE> <OUT.json> [PYTHON]

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

## `pa_voices/` — P-A (voices toggle binds another word)

Being built. Its README states its pass rule: never bind a different word silently. It also covers the open decision about rows `b887e5ef` already migrated without a numbering mark.
