# Lyric Harness

**This is a harness for writing songs.** You write the words; it tells you what
the sound is actually doing and refuses the lines that do not hold. It never
writes for you and it never gives a line a mark out of ten — it locates the
defect, names the layer the defect is in, and hands the line back.

Declaration-driven rhyme, meter, and song-structure engine. The model
proposes; these tools grade. Target: MCP server beside Codex Musica —
Codex Musica describes the recording, this disciplines the words.

## TWO STANDING RULES FROM THE OWNER — read before proposing any architecture

Recorded 2026-08-17, verbatim intent, after both were violated in one session.
These outrank any inference a session draws from the code.

1. **THE RECIPE ENGINE AND THE LYRICS DO NOT TOUCH. EVER.** "Beside" above
   means beside: two separate instruments for two separate questions. No
   bridge, no import, no pipeline from `start_recipe`/`render_recipe` into
   this tree, no blueprint or mandate derived from a recipe. A session that
   proposes connecting them is repeating a mistake the owner has had to
   correct multiple times.

2. **THIS PROJECT IS A SONGWRITER, NOT A GRADER.** The checking machinery is
   the enforcement half of a system whose intended order is
   **PLAN → WRITE → REVISE**: a first phase in which the PROGRAM works out how
   to put the song together — the structure, the blueprint, the mandate — then
   writing against that plan, then the revise/verify loop enforcing it.
   ~~The planning phase DOES NOT EXIST YET: as of this note, nothing in this
   tree generates a blueprint or a mandate, and every run to date had the
   operator hand-writing both.~~ STRUCK LATER THE SAME DAY: `quality/plan.py`
   and the `plan` verb are the phase's v1 — structure from a declared pattern
   grammar, schemes from the FULL `rgs()` enumeration, meters from a declared
   cycle set, every free choice seeded and disclosed, refusals for unknown
   forms and unattainable lengths, and a round-trip test proving the graders
   accept what it emits (`quality/test_plan.py`). REWRITTEN AS V2 2026-08-18
   after the owner caught v1's bias in one sitting of songs — 4 lines and
   4/4, everywhere — and named the cause: tables (constants per function,
   three meters by hand, five pattern strings). V2 replaces every table
   with a generator over a derived space: meters from the {2,3}-composition
   cycle grammar filtered by ONE derived envelope whose ~~floor and ceiling
   are both slots-per-line (floor = the calibrated density band's floor,
   ceiling = band ceiling × one declared multiplier)~~ **two ends are the
   same calibrated band read in two UNITS: the CEILING in beats (a line runs
   at most the density band's ceiling in beats, because it carries at most
   that many syllables and at least one beat each — `BEATS_PER_SYLLABLE_MAX`
   is the one declared step) and the FLOOR in slots (a line holds at least
   the band's floor, because a syllable occupies one slot). The slots ceiling
   is not declared at all now; it FOLLOWS as beats-ceiling × the finest grid
   the vocabulary models**, sampled BY DERIVATION — ~~dimension pair, then beat
   count, then grouping~~ ~~SLOTS PER LINE, then a factorisation of it~~
   **BEATS PER LINE, then a factorisation of it, then the grouping**
   (REPOINTED TWICE ON 2026-08-23, `MISSING.md` M-81, owner's rulings *"do A"*
   then *"now do B"*. (A): the envelope's coordinate must be what the draw is
   uniform over — uniform-over-dimension-pairs is not, because `bars_per_line`
   runs to `hi // 2` (a sound bound, never a claim that all 24 values are
   equally musical) and a high-bars pair's beat range COLLAPSES, so
   `bars=24, sub=1` emitted the ceiling every time it was drawn: measured at a
   median of **eight bars per lyric line**. (B): and the coordinate itself was
   in the wrong UNIT. A slot is a subdivision unit, so 48 slots is twelve
   beats at subdivision 4 and forty-eight at subdivision 1 — the same envelope
   entry calling two different lines the same. MEASURED across all three
   states, 24,000 seeded draws: **beats per LINE median 24 -> 22 -> 7**,
   bars per line 8 -> 1 -> 1, beats per BAR 2 -> 11 -> **4**, and the share of
   lines whose grid a band-legal line can FILL **4.6% -> 19.9% -> 56.3%**.
   Read the first row and (A)'s contribution comes into focus: it fixed how
   the length was SPELLED and could not fix the length, because the quantity
   it drew uniformly was still the wrong one. The pair marginal is now a
   REALISABILITY share, predicted from `meter_factorisations` alone and held
   to four sigma — deliberately not flat, because a beat count one
   factorisation can make must not be rarer than one fifteen can), each
   uniform over its own set, never uniform over
   the enumerated leaves (which weight a cycle by how many groupings it
   admits and hand nearly every plan the maximal beat count — the first
   smoke run's own finding. **§4's LAST TWO THRESHOLDS WENT WITH (B)**: the
   leaf measure's >=40 share is 0 under the beats ceiling and so is this
   sampler's, and `0 <= 0` reads exactly like a check that examined
   something. Both surviving checks are TWO-HYPOTHESIS TESTS between two
   COMPUTED distributions with no number in them — the beats-per-bar marginal
   is total variation **0.0089** from this sampler's own prediction and
   **0.4327** from the leaf's, and the pair marginal **0.0095** from the
   realisability share against **0.4941** from flat);
   lines per section uniform over the envelope;
   schemes exact-uniform via Bell-triangle completion counts above the
   enumeration bound, so large stanzas are reachable; patterns generated
   from the section-function vocabulary's recurrence contracts —
   ~~14 of 21~~ **every SECTION-kind function, 20 of the 22 as of
   2026-08-28** (the 14 was v2's launch coverage; M-54's derived cells
   took it to 19 on 2026-08-22 and this sentence was never told — an
   inherited staleness found and repinned by M-52's close, the same day
   `patter` entered as the 22nd function; the two out are `refrain` and
   `burden`, line-kind by M-56's ruling, which a span grammar can never
   draw) — including instrumentals (zero-line sections) and verbatim
   returners; anacrusis per function KIND (the pickup is part of the tune —
   per-instance draws handed the shape layer a RETURN_SLOT_DRIFT on the
   planner's own verbatim returns). THE CORPUS SAMPLES NOTHING — measured
   distributions as a sampler would give the unprecedented shape
   probability ~zero (the owner's "move 37" ban), and `test_plan.py` §4
   pins by AST that `plan.py` imports no corpus reader and opens no file.
   The same section holds the samplers to their enumerations at small n —
   a pin that caught `bell()` returning B(k−1) on the day it was written,
   with every above-enumeration scheme pool disclosed an order of
   magnitude small. Still true and still the rule: do not describe this
   project as a grader, and do not present operator-authored plans as the
   system working as intended — the planner is the front door now, and
   hand-written blueprints are for tests.

3. **NO PRIVATE INSTRUMENTS (2026-08-18).** The owner asked what "my
   private workflow" meant and the honest answer was a confession: both
   zero-flag songs to date were pre-screened pair by pair through an
   OPERATOR'S SCRATCH SCRIPT (two dummy lines, a minimal mandate, read
   the codes) that lived in one session's memory — below prose, below
   doctrine 48, reachable by nobody — and the final performance-order
   song text was assembled BY HAND in that operator's chat. The checks
   were implemented; the working method was not. The rule: **any
   measurement or step used in producing a delivered song goes through a
   verb, and an improvised script used twice is a defect report, not a
   convenience.** The fixes shipped with this rule: `screen` (pair ban
   screening — the song grader itself on a minimal mandated pair,
   `quality/test_screen.py` pins NO DRIFT against the full-draft grade)
   and the rendered song (`plan --fill` emits the complete
   performance-order text, headers from each section's own measurements,
   returns written out — `render_song`, pinned in `test_plan.py` §6).
   ~~The seed-sweep instrument (looping `make_plan` with filters to find a
   shape) stays manual for now BY THE OWNER'S PENDING RULING, and is
   named here so it cannot become a quiet fourth instrument.~~
   **THE RULING CAME 2026-08-23 — *"make it a verb"* — AND IT IS
   `plan --sweep=LO-HI [--want=PRED;PRED]` (`MISSING.md` M-82).** It was the
   last exception to this rule, and the session that closed it had already
   broken the rule twice in one sitting: the seeds behind M-81's end-to-end
   figures came from two scratch scripts carrying SEVEN filter criteria
   invented on the spot and declared nowhere. A sweep is needed because
   `--functions` is an ALLOW-LIST — it PERMITS a roster and cannot COMPEL a
   draw to use it, since compelling means weighting the dice — so the honest
   compel is to DRAW AGAIN, and rejection sampling from a uniform proposal is
   uniform over the accepted set. **IT DOES NOT RANK** (doctrine 7/19: an
   argmax over a swept parameter is biased, and whatever it ranked by would
   be the score doctrine 6 forbids), **it invents no criteria** (a CLOSED
   predicate vocabulary, every name reading a coordinate the plan already
   discloses, an undeclared one refusing by name), and **it has no default**
   — a sweep with no predicate accepts everything and says so, because a
   default would be the instrument deciding what the caller wants, and
   `before=verse,chorus` in particular is the rate-matching
   `plan.FORM_TENDENCIES` explicitly refuses. Three counts, never summed;
   an empty accepted set REFUSES at exit 2 with the rate beside it, because
   unreachable and merely rare are different answers. It returns SEEDS and no
   plan (`--fill`/`--out` refused with it), since a plan is a pure function
   of its seed. `test_plan.py` §10 holds the API and `test_verbs.py` §40
   holds the half this rule is actually about — that a person can RUN it.

**Read this file before you write. Read `quality/METHOD.md` when you are about
to MEASURE** — a rate, a null, a threshold, a refusal, a provenance claim. One
doctrine numbered 1–95 spans the two files and the index at the bottom of this
file says which number lives where; `doctrine 79` is still doctrine 79. The
split exists because this file had reached ninety-five doctrines of which some
seventy were about checking, so a session reading it learned to audit rather
than to write (`MISSING.md` L-5, `BACKLOG.md` §4.5). Doctrine 48 is the reason
that mattered: a principle that lives only in prose gets followed exactly as
often as someone remembers it, and a session cannot remember what it never
reached.

## The code graph (graphify) — what it answers, and what it cannot

**ADOPTED 2026-08-23 AS A LENS, NOT AS A SOURCE OF TRUTH, and the token case
that was made for it is REFUTED on this tree.** `graphify extract . --code-only`
builds a graph.json under graphify-out/ from the AST alone — local,
deterministic, no API key, **47s** over this repo — giving 7,555 nodes and
15,261 edges. That output is a GITIGNORED build artifact and its path is
deliberately NOT written here as a backticked repo-path citation, because it
is not one: it is absent from a clean checkout, and `quality/
verify_entries.py` is right to fail a sentence that claims otherwise (it did,
on this paragraph's first draft — the same treatment data/provenance_ledger.tsv
already gets). The scope is `.graphifyignore` (corpus/ and data/ are out:
283k lines of verse would swamp every hub).

**RESTORE IT IN A FRESH CONTAINER:** `bash scripts/setup-graphify.sh`,
idempotent. That script exists because EVERY OPERATIONAL PIECE OF THIS LIVES
OUTSIDE THE REPOSITORY — the CLI in the container's home, the Claude skill in
`~/.claude/skills/`, the git hooks in `.git/hooks/` which is never cloned, the
graph itself gitignored — so "graphify is installed" was true of exactly one
container and of nothing else. A setup somebody has to remember is the
private-instrument defect standing rule 3 exists for.
**AND THE FIRST INSTALL OF IT WAS THIS FILE'S OWN FAMILY OF DEFECT.** The
session that adopted it built the graph, measured it, and wrote this section
telling later sessions to consult it — WITHOUT EVER RUNNING `graphify install`,
so the skill was registered with nothing and the graph was reachable only by a
hand-typed CLI call. Built, tested, documented, unreachable: the same shape as
`--blueprint` before 2026-08-11 and `stanza_lock` before 2026-08-14, committed
an hour after quoting both. The owner caught it by asking to SEE it.
**REBUILD WHEN THE TREE MOVES:** `graphify extract . --code-only` from the repo
root — and `graphify hook install` (which the setup script runs) puts a
post-commit hook in place so the graph re-extracts the changed files by itself,
because a staleness warning in prose is the thing this repository has learned
does not work. **A STALE GRAPH ANSWERS CONFIDENTLY**, which is this repo's own
most-repeated defect wearing a new hat, so the graph carries a `built_at_commit` — check it against `HEAD` before trusting an answer, and
rebuild rather than reason from a graph built before the change you are asking
about. Absent that file the probe REFUSES at exit 2 and says so, rather than
reporting a comparison it did not make (doctrine 20).

**WHAT IT IS GOOD FOR, measured:**
  - `graphify affected "SYMBOL" --depth 2` — what DEPENDS on a symbol, which
    is a different question from `grep`'s "where does this string appear" and
    is the one worth asking before a refactor.
  - `graphify god-nodes` — the architectural hubs. On its first run, with no
    access to this file, it independently recovered the spine this file
    describes: `Reviser` 108 edges, `Declaration` 68, `Lexicon` 55,
    `Syllable` 55, `Mandate` 53, `line_anchors` 48. A map derived from the AST
    agreeing with a map written by hand is a check on both.

**WHAT IT CANNOT DO, AND THIS IS THE HALF THAT MATTERS HERE.** `quality/
graph_probe.py` re-derives the advertised *"70x fewer tokens per search"* on
this tree and it does not reproduce (`MISSING.md` M-76):
  - against the search answering the SAME question (`grep 'SYMBOL('`) the
    graph route costs **0.68x — half again as MUCH**, not 70x less. The
    **180x** appears only against `grep+read`, every matched file quoted in
    full, which is a baseline nobody uses.
  - mean recall **0.74**, **1 of 5** questions complete: the cheaper-looking
    route is also the less complete one.
  - **MODULE-LEVEL CONSTANTS ARE NOT INDEXED AT ALL.** `MANDATORY_PURSUE`,
    `LENGTH_GATE_CODES`, `PROFILES`, `ADOPTED`, `RHYME_FINDINGS` have NO NODE;
    4,347 of the 7,555 nodes are callables and none is a constant. **Doctrine
    1 makes a declared constant the primary coupling in this tree**, so the
    graph covers the callable half of the architecture and is blind to the
    declared half — the half `quality/gate_census.py` reads to answer what can
    refuse anything. Ask the graph about a constant and it says nothing, which
    reads exactly like "nothing depends on it".

**SO IT NEVER SETTLES A QUESTION A CHECK CAN SETTLE.** `wiring` finds stranded
modules, `counters.py` censuses every public symbol by who references it,
`gate_census.py` says what can refuse, `verify_entries.py` fails when prose
goes stale. Those GATE; a graph edge does not. The graph is where to look
FIRST on a broad "what touches this" question and it is never the last word,
and no check in this repository depends on it.

**AND THE SEMANTIC HALF IS DELIBERATELY NOT RUN.** `graphify extract` without
`--code-only` sends documents to a model API. That is a non-deterministic
derivation (doctrine 66) presented beside deterministic ones, and this repo
already has a name for a claim that cannot be re-derived. `--code-only` is the
shipped invocation.
**AND `INFERRED` IS ONE LABEL OVER TWO PROVENANCES, WHICH IS DOCTRINE 1 IN
SOMEBODY ELSE'S VOCABULARY — CORRECTED HERE 2026-08-23 THE HOUR IT WAS
WRITTEN.** ~~an INFERRED edge would be declared-not-counted~~ read as though
`--code-only` emitted none. It does not: this tree's own report is **93%
EXTRACTED, 7% INFERRED — 1,079 edges at average confidence 0.86 — with a
token cost of 0 input and 0 output.** Those are DETERMINISTIC symbol
resolutions the AST could not settle by an explicit reference, not model
output, and they are reproducible. The semantic pass emits edges under the
SAME NAME that are model output and are not. So `INFERRED` alone does not say
which, and the coordinate that separates them is the INVOCATION: under
`--code-only` an INFERRED edge is derived-and-reproducible; under the semantic
pass it is derived-and-not. Read the report's own token cost before trusting
either.

## The loop, and the MCP wrap plan

Tools: transcribe, score, candidates, check_scheme, check_meter,
check_song, infer_chains, rhyme_graph, internal, density, qafiya,
cynghanedd, weight. Loop: spec -> draft -> check -> revise flagged
lines only -> re-check. Model never self-certifies. `screen` and the
plan/render pair joined 2026-08-18 (standing rule 3): the wrap exposes
only real entrances, and pair screening + performance-order rendering
are entrances now, not operator habits. THE WRAP SHIPPED LATER THE SAME
DAY, by the owner's direct request: five `lyric_*` tools
(screen/plan/grade/check/types) on the CodexMusica connector
(`mcp/lyric_tools.js`) — a DISJOINT family beside the recipe tools
(standing rule 1 holds: zero shared state, subprocess-per-call over
this CLI, stateless because a plan is a pure function of its seed), so
the same tools reach every MCP client AND the website's Gemini chat
(whose system prompt is the server's own instructions). ~~`revise`/`loop`
and `verify` are deliberately NOT wrapped yet (a 40-90s synchronous
call is the wrong shape for chat)~~ **STRUCK 2026-08-28 — BOTH ARE
WRAPPED, AND THE DEFERRAL'S OWN REASON WAS THE DESIGN'S ANSWER
(`MISSING.md` M-154, owner's directive "go, start on the seam")**:
`lyric_verify` shipped earlier, and `lyric_revise` wraps the loop in
the `defer:` shape, which is MADE for chat — the harness suspends at
one question per call, the CALLER carries the state blob (the
deferred-run record, replayable by anyone), and no response contains a
song until the loop reaches a stop condition. The 40-90s objection
named the synchronous-wait shape, and `defer:` never waits: measured
34s to the first question, 4s to re-ask an unanswered one, 92s to fold
an answer and advance. The CLI front door is the `finish` verb — the
working order's last step as ONE command, the mandate read off the
plan, the render structurally unreachable before a stop condition —
and the loop's budget is a declared choice now (`--max-rounds`,
`--attempts`, `--backtrack`: three `ReviseDeclaration` coordinates
that were CLI-unreachable since the loop was written, the
`--blueprint`-before-2026-08-11 species on the knobs that decide what
a run costs); ~~the seed sweep stays manual per the
owner's pending ruling~~ (struck long since — `plan --sweep` is M-82's
verb and `lyric_sweep` wraps it; this clause outlived both).

**AND THE WRAP'S FIRST FIELD FAILURE WAS DOCTRINE 48 AT THE CONNECTOR
(2026-08-19).** The site's chat planned, wrote and graded a song whose
every intended rhyme was on the two-tier ban — 43 banned pairs when the
clusters were screened after the fact (bend/friend/end/mend/trend/spend
15 of 15; mass/pass/grass/glass, day/way, slow/glow/flow/sow;
plain/stain/rain/chain/again) — and presented it as finished, seed and
verdict withheld. Not a fabrication (the page's tool chips are the
`/chat` response's real call list; the zero-anacrusis headers carry the
builder's own unexampled spelling) and not, in the first instance, the
model's defect: `lyric_screen` was skipped, and a mandated
HOMEOTELEUTON pair grades EXIT 0 — the ban's pair findings are pursued
NOTES whose enforcement lives in `loop.MANDATORY_PURSUE`, i.e. in the
loop the wrap deliberately does not carry, and the wrap's own "NOTES
are not to be fixed" wording then protected the banned pairs from
revision. The fix (same day) is DISCLOSURE MADE MECHANICAL, never a
severity change — doctrine 7 stands and the notes stay notes:
`lyric_grade`/`lyric_check` verdicts carry `banned_pairs` (count,
codes, lines — extracted from the report's own FINDING lines, the
L{i}/L{j} shape `capacity.py` already parses) AHEAD of the report; a
SERVER-written `[GRADED — seed N — exit E, … — N banned pair(s)]`
stamp rides under the rendered song inside the verbatim block, so the
seed and the verdict reach the user through a client that relays
nothing; the chat page's tool chips print the exit code and banned
count from the same harvested verdict; and the instructions now say
the ban is unskippable at any exit code. All connector-side
(`mcp/lyric_tools.js`, `gemini_agent.js`, `chat.js`, the page) — the
harness itself is untouched.

**THE END-RHYME PROJECTION IS NO LONGER THE ARCHITECTURE — PLACEMENT IS A
DECLARED COORDINATE (2026-08-23, `MISSING.md` M-67).** The owner's ruling,
verbatim: *"it looks like an insane idea to me to only be planning around end
rhyme and only ever look for end rhymes. rhymes happen in the first word in
several rhyme types, rhymes happen all throughout the piece as well ... there's
just no way that we can only be contemplating the last word of every line."*
**AND DOCTRINE 2 HAS SAID SO SINCE THE FIRST COMMIT** — *"the full pairwise
score matrix is the primary object ... never rebuild a projection-first
architecture"* — while every enforcement layer here was built on one
projection: `line_anchors` takes `words[-1]`, a `Mandate` group is a tuple of
LINE numbers, `swap_end_word` is the loop's only move, the planner emits
end-letter schemes. The doctrine sat at the top of this file and the
architecture drifted anyway, because the graph that got built was the
projection wearing the doctrine's name.
**THE VOCABULARY WAS ALREADY ON DISK AND REACHABLE BY ALMOST NOTHING.**
`quality/relations.py`'s `SpanRule` — locus, anchor, direction, magnitude —
has carried it since 2026-08-10, and its own census is the argument: over the
77 schemas' 154 member rules the anchors are `word_start` 64, `last_stressed`
58, `word_end` 15, `searched` 8, `none` 6, `final_unstressed` 2, `penult` 1.
Nearly half the vocabulary reads from the FRONT of a word, and **8 schemas are
MIXED** — one member at each end, which no global alignment value can express.
It was reachable only through a `schema:` mandate; the default grading path
reached none of it. `grade()` said so in its own comment, one line above the
hardcoded `position="end"` it was diagnosing.
**`quality/slots.py` + `Mandate.loci` CLOSE IT.** Placement rides in a PARALLEL
index-aligned coordinate — the convention `structures` and `relations` already
use — because a group is a tuple of line numbers that some sixty sites take
literally, down to `_normalise_groups`' own `int(x)`. Absence keeps ONE meaning
and the default slot is resolved by CALLING `line_anchors`, so every mandate
ever written is byte-identical BY CONSTRUCTION. `--groups=1.T4,2` binds L1's
FOURTH WORD to L2's end; `grade()` scores it through the SAME `best_score`;
`brief()` names the right word; `loop.swap_at_slot` rewrites the right word;
`revise_loop` converges. **WHAT REFUSES IS THE POINT**: seven loci need a frame
a mandate does not carry and refuse AT DECLARATION TIME naming it; a `searched`
anchor refuses citing doctrine 56; and a WITHIN-LINE binding refuses naming the
route that does answer it (`relations.realise` + `quality/figures.py`), because
a group is a set of lines and a rhyme whose members share a line has one
member. `quality/test_slots.py`, 9 sections.

**AND THE PIPELINE HAS TWO FRONT HALVES NOW, NOT ONE (2026-08-23,
`MISSING.md` M-72).** The owner's ruling: *"If an LLM writes something we go
through all of the steps, if a human does it then we need the same steps. If a
person puts unstructured song in for example, then the beginning must be to
structure it."* `plan.py` gave the LLM door its front half; a PASTED song
reached the graders with nothing, so an operator hand-wrote a `--groups=`
string or the run was rhyme-only by omission — and every gate downstream is
only as good as what was declared to it. `quality/recover.py` emits the
plan's own shape from text, so the same grading command runs and the same
gates apply.
**FOUR PROVENANCES, CLOSED AND NOT INTERCHANGEABLE**, which is the module's
whole discipline: `counted` (arithmetic — the line count, the syllables per
line), `declared` (the text said so — a `[SECTION]` mark), `derived` (the
harness inferred it, carrying doctrine 14 IN THE COORDINATE: every edge of the
recovered cover is a band-passing pair BY CONSTRUCTION), and `REFUSED` (not
obtainable, not guessed). Sections prefer the declaration in that order and a
text with neither mark nor blank block is REFUSED, because a sectioning
invented here would be graded as though the writer had asked for it.
**THE METER IS REFUSED, AND THAT IS THE AMENDED DOCTRINE 4 RATHER THAN A
GAP** — counting gives SYLLABLES, which the module reports; a bar grid is a
declared coordinate, and inferring one would be this harness declaring a meter
on the writer's behalf and then grading them against it. The refusal names
`--blueprint=` and does not reach for audio.
**AND THE RECOVERED COVER IS OVER PLACEMENTS**, which is why it is not
`mandate_from_graph`: that function's cliques are cliques of `words[-1]`.
Measured on a six-line fixture — 21 binding sites, 22 admitted pairs, **20 of
them at a placement other than the line end**, where an end-anchored recovery
finds 2. Every edge is spelled in the mandate's own notation, so a recovered
cover hands straight to `--groups=`.

**AND HOW MUCH OF THIS HARNESS CAN REFUSE ANYTHING IS A COMMAND NOW, NOT A
MEMORY (2026-08-23, `MISSING.md` M-73).** The owner's standing rule, verbatim:
*"I fucking hate seeing prose, flags, notes, etc... and ... you refuse to
finish your work unless we have the appropriate gate, band, constraint,
etc..."* A note is a RECORD; only a gate is an ENFORCEMENT, and work that ends
in a note has not closed its loop. That is one sentence and it is impossible
to keep across every finding this tree emits — doctrine 48's own subject — so
it was kept by memory and nothing could say how much of the harness enforces
anything.
**`quality/gate_census.py` ENUMERATES THE THREE GATE MECHANISMS** so the answer
is checkable rather than argued: a `flag` severity at the construction site
(`verify()` gates acceptance on `new_flags`; `song`/`revise` exit 3 while one
stands), `loop.MANDATORY_PURSUE` (a line held open on a pursued NOTE — the
mechanism doctrine 9 needed and the reason a note is not automatically
toothless), and `floor.LENGTH_GATE_CODES` (the codes a verb may not exit 0
on). Each set is READ from the module that OWNS it, never respelled, because a
second copy of a gate set is how a census starts disagreeing with the thing it
counts (doctrine 1).
**MEASURED, AND THE FIRST READING WAS WRONG IN ITS OWN FLATTERING DIRECTION.**
~~of 67 finding codes, 8 CAN definitely refuse something, 15 definitely
CANNOT, and 44 depend on where they are constructed — 23 `computed` and 21
`consumer-assigned`~~ **STRUCK 2026-08-23 (`MISSING.md` M-77): the standing
figure is ~~20 GATED / 51 DISCLOSED-ONLY~~ ~~21 GATED / 50~~ ~~22 GATED / 49~~
**23 GATED / 48 DISCLOSED-ONLY (repinned three times on 2026-08-23 as the
owner ruled on the roster this instrument produced: `HOOK_DOES_NOT_RECUR`
promoted to a flag (`M-84`), `SHARED_SUFFIX` promoted and PURSUED rather than
flagged (`M-85`), `TITLE_NOT_IN_HOOK` promoted to a flag on reaffirmation
against a measured 67.7% corpus rate (`M-86`). That ladder is the roster
working: M-77 built it so the question would be ASKED of each code by a
person, and three were)** /
0 UNDECIDABLE, over 71 codes and
not 67 — the placement layer builds `GridFinding` from a VARIABLE at one
site, so four codes this tree emits were counted by nothing, and the same
gap would have crashed `severity_of` on any draft that tripped one.** Never summed past
that partition (doctrine 79).
**THE 23/21 SPLIT WAS AN ARTEFACT AND 39 OF THE 44 WERE NEVER UNDECIDED.** The
census read ARGUMENT 1 as the severity for every constructor, because
`floor.Finding` and `readability.Finding` are `(code, severity, message, ...)`.
`FitFinding` is `(code, MESSAGE, ...)` with NO severity field, so 18 of
`fit.py`'s codes had their message tested against "flag"/"note" and filed
`computed`. **A severity can be DECLARED in four spellings** and the census
knew one: a `severity` field; ANOTHER FIELD NAME (`FitFinding.satisfiable` --
False means the declaration cannot be met, a contradiction, so a flag); a
PER-CODE TABLE (`grid.SEVERITY`); and a DOWNGRADE CEILING (`floor.py`'s
`sev("flag")`, whose body is `default if exact else "note"`, so the argument
is the strongest reachable severity). An over-reported UNDECIDABLE makes the
tree look worse and the instrument look more necessary -- the direction an
instrument least audits itself in.
**WHAT CHANGED IN THE TREE, kept apart from what changed in the reading**:
`grid.SEVERITY` rules on all 21 shape codes in the module that DEFINES them
(it was `"flag" if f.code == "HOOK_ABSENT" else "note"`, one inline
conditional in a consumer that defines none of them); `severity_of` REFUSES an
unruled code rather than defaulting it, because a default is a ruling nobody
made; and `FitFinding.severity`/`GridFinding.severity` are the ONE definition
of mappings `revise.py` held THREE copies of -- under a docstring reading
*"SEVERITY IS NOT RE-DECIDED HERE ... this method does not maintain a second
opinion."* **NO DRAFT GRADES DIFFERENTLY**: every table was proven equivalent
to the expression it replaced before it shipped (0 disagreements over all 21
shape codes), so 0 codes are newly enforced and all 12 newly-VISIBLE gates
were already firing.
**A DISCLOSED-ONLY CODE IS NOT AUTOMATICALLY A DEFECT AND DOCTRINE 6 IS THE
COUNTERWEIGHT**: a CONVENTION a writer may depart from cannot be what fails a
check, so the shape layer's notes (`DOWNBEAT_LOCKED`, `QUATRAIN_LOCK`) are
notes ON PURPOSE and promoting them would be the error. The instrument
produces the LIST, so "should this one gate?" is asked of each code by a
person rather than answered by whoever last edited the file.
**AND IT CAUGHT ITS OWN VERSION OF THE DEFECT ON ITS FIRST RUN.** The first
draft named two constructors, measured **46** codes, and silently omitted
`quality/grid.py` — the layer gap 10 below calls "the only checks in the repo
that ask about the song as a whole SHAPE". A census blind to a whole layer
reports that layer as FULLY GATED, which is the flattering direction; its own
prose then carried "55 codes in eleven modules" against a measured 67 in FOUR
files, struck before shipping (doctrine 58). `FINDING_CONSTRUCTORS` is a
declared tuple and `quality/test_gate_census.py` §5 drops one as a MUTATION
and requires the count to move. The pin is on the COUNTS and not the
membership — a new finding is a question rather than a merge conflict — and
`gate_census.py --check` exits **3** on drift in the cheap CI job.

**AND THE PLANNER DRAWS PLACEMENTS AND OVERLAPPING COVERS NOW — TWO CLASSES
THAT HAD PROBABILITY EXACTLY ZERO FROM THE FRONT DOOR (2026-08-23,
`MISSING.md` M-71).** The owner's ruling, aimed at the generator: *"if that
end rhyme focus is poisoning our planning as severely as it appears to be then
I think it needs to be converted into just straight up all rhymes."* The
"move 37" ban exists because sampling measured distributions gives an
unprecedented shape probability ~zero; the planner was committing that error
by OMISSION twice — every group member was a bare line number (the end of the
line, because nothing else was sayable), and groups came from an RGS code,
which is a PARTITION, so doctrine 2's own overlapping cliques were declarable
and never drawable.
**PLACEMENT IS DRAWN PER MEMBER**, uniform over what the grading path
resolves — per member because 8 of the 77 schemas anchor one member at each
end of a word. MEASURED over ~~200~~ 400 seeds: `end` takes ~~9.6%~~ **8.5%**
of members (REPINNED 2026-08-23 with M-80's word-keying: once a WORD is bound
its other names are excluded, and the last word carries two names against the
six that carry one each). The consequence is DISCLOSED in `choices.placements`
rather than buried: a two-member group is all-ends with probability 1/|pool|²,
so a plain end-rhyme plan becomes rare, and whether `end` should be a
first-class outcome instead is a taste question printed for the owner to
answer into a coordinate.
**THE OWNER ANSWERED IT 2026-08-24 AND THE ANSWER IS NEITHER OF THE TWO ON
OFFER (`MISSING.md` M-107).** Not "leave it rare" and not "weight the draw":
*"add a step at the end that adds rhymes to the end of the lines in order to
follow the respective forms of the sections"* — with the draw itself put out
of bounds in the same sitting, *"no, end should not be uniform ... do not fuck
up what we've already built."* So `_place_group`'s uniform draw is UNTOUCHED
and the **8.5% stands**; what is added is a SECOND realisation, at the ends, of
a scheme each sung section had already drawn. `plan.end_rhyme_groups` is a
PURE FUNCTION OF THE EMITTED PLAN — it reads `choices["schemes"][fn]["rgs"]`,
`line_slots`, `returns` and `groups`, consumes NO seed entropy, is idempotent,
and runs before the joint gate so whatever it adds passes the same refusal
everything else did. **MEASURED over 240 seeds, the before-figure being the
same plan read without the pass's own contribution: lines whose END is bound
47.8% -> 71.1%, group members binding the last word 18.4% -> 25.1%, 0 seeds
lost, 0 joint findings.** Three counts, never summed: added 889, blocked 1601
(the draw had already spent that end), narrow 29 (the line cannot carry one
more distinct span). **CROSS-SECTION COHERENCE IS A NON-BUILD AND IS RECORDED
AS ONE**: a sung function carries ONE code, so every instance already shares
the scheme SHAPE, and binding instance 1's line i to instance 2's line i would
be the planner deciding two verses share their RHYMES — which most songs do
not. **AND THE TWO MUTATIONS ARE NOT SYMMETRIC**, which is the half worth
carrying: dropping the end-collision check makes `make_plan` REFUSE
(`TWO_GROUPS_ONE_WORD`, no plan ships), while dropping the participation
ceiling refuses NOTHING — 60 of 60 seeds still plan with 26 lines over it —
because `joint_findings` asks the LOOSER question on purpose. So that ceiling
is a GENERATOR discipline with no gate behind it and `test_plan.py` §13's
check IS its enforcement, which the check's own message says.
**OVERLAP IS SATISFIABLE BECAUSE PLACEMENT EXISTS.** Two groups on one line at
the SAME placement constrain ONE word — `joint_field`'s question, which needs
words a plan does not have. At DIFFERENT placements they constrain different
words and the question does not arise, so a line joins a further group only at
a placement it does not already carry: satisfiable BY CONSTRUCTION.
**~~a placement it does not already carry~~ — THE COORDINATE WAS WRONG AND THIS
SENTENCE IS THE WHOLE ARGUMENT FOR DRAWING OVERLAPPING COVERS AT ALL
(`MISSING.md` M-80, 2026-08-23).** `used` held the placement NAME, and four of
the names the pool draws denote only TWO words: `end` and `endword` are both
the last word, `head`, `headrime` and `T1` are all the first — `headrime` and
`T1` the IDENTICAL span of it. So the invariant was tested against a
distinction that is not the distinction it names, and **376 of 400 plans
(94%)** put two declared rhyme groups on one word — **291 of them (72.8%)** on
the IDENTICAL SPAN of it. `slots.placement_word` is
the coordinate that answers it, DERIVED from each rule's own locus and
REFUSING a locus it cannot resolve to one word. **A WORD it does not already
bind** is the invariant now, and it is checked rather than asserted — see the
joint gate below.
**HOW MUCH WEB IS A PER-LINE DRAW AND BOTH EXTREMES ARE REFUSED** — the
owner's *"I don't think that literally every word need N pairs of rhymes but
there's just no way that we can only be contemplating the last word of every
line."* Drawing a count of extra GROUPS measured at 100% of plans overlapping,
median 22 groups a song — a density set by the shape of a loop. Each line now
draws its own participation uniform over what a band-legal line can CARRY: the
calibrated density band's FLOOR, since distinct bindings need distinct spans.
Measured after: participation uniform over 1–5, median 26 groups a song.
**AND THE LEXICON'S CEILING IS A PLAN-TIME GATE**: `capacity.ADOPTED_MAX_GROUP`
adopts the deepest CERTIFIED chain (40, a witness clique graded through
`Reviser.inspect`; the tier-1 ceiling reaches 228 and is ungraded), so a plan
never asks for a rhyme family no family can fill. Re-derived by
`capacity.py --check` nightly.

**AND A PLAN IS CHECKED FOR WRITABILITY BEFORE A WRITER EVER SEES IT
(2026-08-23, `MISSING.md` M-79/M-80).** The owner's instruction after the
first end-to-end run: *"build the plan-time joint satisfiability gate."* Every
constraint this planner draws is individually legal — the meter from a derived
cycle space, the density band from a corpus calibration, the schemes
exact-uniform over completions, the placements bounded by a reachable token
index — and **NO LAYER HELD THEIR CONJUNCTION**, so an unwritable plan was
emitted, graded as legal, and discovered three revise rounds in.
`plan.joint_findings` is that layer, and `ADOPTED_MAX_GROUP` above is the
shape it generalises: a plan-time refusal, per LINE rather than per group.
**FOUR CAUSES, NEVER SUMMED (doctrine 79), measured over 400 seeds before the
repair**: a span below the density FLOOR where the band flags too few
syllables and `fit.SLOTS_EXCEEDED` too many (**1/400**); a placement naming a
word the line cannot reach (**5/400**); more DISTINCT words demanded than the
line has syllables (**4/400**); and two declared rhyme groups on ONE WORD
(**376/400**). **AFTER: 0 over 400, with 0 seeds lost** — the three
derivations they came from are repaired, so the gate is satisfied BY
CONSTRUCTION and a MUTATION is the only way to fire it (`test_plan.py` §7
restores the pre-fix `_place_group` and **38 of 40 seeds then REFUSE**).
**THE PREMISE WAS FALSIFIED BEFORE THE GATE WAS BUILT ON IT.** M-79's Finding
1 read 78% of plans as handing the writer *"a bar they cannot legally fill"*
and proposed promoting `SPARSE`, whose own gloss is *"fewer units than
pulses"* — **slots are a CAPACITY, never a requirement**, so a twelve-syllable
line in a twenty-four-slot bar is a slower line and promoting the note would
have made every slow line a defect (doctrine 7). `line_syllable_ceiling` is
the honest conjunction — the smaller of the bar and the band — and a
deliberately sparse line produces no finding at all.
**WHAT IT DOES NOT DECIDE**: two groups on one LINE at different words stay
permitted, because whether the lexicon holds a word answering two families at
once is `capacity.py`'s question and `MISSING.md` M-41's ladder step is still
open. The gate refuses what is decidable without words rather than reaching.

**AND THE PLANNER'S ENVELOPE IS DERIVED NOW, ALL SIX BOUNDS (2026-08-23,
`MISSING.md` M-69/M-70).** The owner's standing rule: *"we do not want hard
numbers anywhere ... meter should be something like x/y and number of lines
should be something like N"*, and on the specific one, *"1-16 is weird ...
should we change it to a variable?"* — with increasing the digit refused in
the same breath as the same stub in a bigger hat. V2 replaced the planner's
TABLES and left its BOUNDS literal. The derivation source was measured and
unread: every floor profile STATES its line count in its `unit` prose
("4-line quatrain", "14-line sonnet") where no code could reach it.
`Profile.n_lines` declares it, and the two stanza profiles then fix a
tokens-per-line band agreeing to a fifth of a token (7.25–9.25 against
7.71–9.00).
**SO THE ENVELOPE IS WHAT THE ENFORCEMENT CAN ENFORCE.** MEASURED over
1–699 tokens: **39.9% of lengths can produce a FLAG, 29.8% sit in a tolerance
band where every length-sensitive finding is downgraded to a note, and 30.3%
reach no profile at all.** ~~`gradeable_line_counts()` is the surviving set and
it is NOT contiguous — **a song of 6 to 11 lines cannot be graded with teeth
at any length-sensitive check** — and `line_count_gaps()` prints that hole in
every plan's own disclosure, so it is a calibration request rather than a
discovery.~~
**STRUCK 2026-08-24 (`MISSING.md` M-106): THE HOLE WAS AN ARTEFACT OF ASKING
THE WRONG QUESTION, AND THE PLANNER WAS DRAWING ITS LENGTH FROM THREE KINDS OF
TEXT.** `gradeable_line_counts()` unions `section` (a 4-line quatrain),
`sonnet` and `song`, whose reaches at the derived tokens-per-line band are
**4–5**, **12–17** and ~~**17–55**~~ **22–55** lines — so 6 to 11 is the space
between a QUATRAIN and a SONNET and was never a fact about songs.
`song_line_counts()` reads the profile that grades a lyric sheet, identified by
its own `n_lines == 0` and never by name: ~~**17..55, 39 values,
CONTIGUOUS.**~~ ~~**22..55, 34 values, STILL CONTIGUOUS**~~ **`{6..20} | {22..55}`, 49 values, ONE HOLE AT 21 — REPINNED 2026-09-01 (`MISSING.md` M-193): a second lyric-sheet profile, `short` (50–150 tokens), joined the floor and this function unions every `n_lines == 0` profile by construction; the hole is the seam between two calibrated bands. What the planner VOLUNTEERS is narrower — `fillable_line_counts()`, the totals whose stanza-sized cell ceiling can hold the form's own minimum section count (verse once, chorus twice), so `ENVELOPE["total_lines"]` is (12, 55).** The 2026-08-26 reading, kept: 22..55, 34 values, still contiguous — REPINNED 2026-08-26
by the M-131 re-adoption (`MISSING.md` M-133), which took the song profile's
band `lo` from 150 to 200 tokens; this function READS that band, so the
envelope followed it and every seed's drawn length moved with it. **The
ARGUMENT is untouched and the endpoints are all that moved**: the set is still
the one profile that grades the object the planner emits, and it is still
contiguous. The
function above is unchanged and still answers its own different question —
**and it now has TWO holes, which is this entry's own diagnosis confirmed
rather than dented.** The union gained **18–21**, the space between a SONNET
and a SONG once the song floor rose past the sonnet ceiling: the identical
species as 6–11, at the next seam out, and one more length that is a fact about
which KINDS of text were unioned rather than a fact about songs.
**AND THE SECTION CEILING WAS M-81(A)'s ERROR ONE LAYER OVER** —
`_sample_pattern` took `max_cells = total` on the argument that a song of T
lines cannot hold more than T sung sections, TRUE and never a claim that all T
values are equally musical. With the total drawn INDEPENDENTLY of the count it
was then divided among, lines-per-section is a hyperbola.
`stanza_line_floor()` — the `section` profile's own reach, 4 lines — bounds the
count at `T // 4` instead. **MEASURED over 240 seeds, per section instance:
ONE-LINE sung sections 39.4% -> 20.2%, sections per song median 10 -> 8 and max
31 -> 13, totals median 32 -> 35 with the floor 5 -> 17, 0 seeds lost.** It is
NOT zero and must not be read as zero: 1 is the modal part of any exact-uniform
composition (the ladder is 52% under the sequential draw, 39.4%, 20.2%), and a
one-line tag is a real section. **THE OTHER HALF OF THE OWNER'S COMPLAINT WAS
THE WRITING, MEASURED**: line LENGTH is not biased short by the planner — 0.0%
of lines get a ceiling under the density floor and **51.7% can carry the full
12 syllables**, so a six-syllable line out of a twelve-syllable allowance is
the writer's choice, not the harness's. Three more literals fell out while widening what they silently
bounded: a pickup-phrase lookup table that raised `KeyError: 0.75` the moment
anacrusis became a function of the section's own subdivision; an independent
per-kind line draw that produced **6 plans in 200 seeds** (replaced by
`_partition_uniform`, the counted-completions move `_rgs_uniform` already
uses — acceptance 91%); and `body_cells (2, 6)`, which was tracking a REAL
decay by guesswork (the placement vocabulary admits **71%** of one-cell
patterns, **18%** at six, **0.12%** at twenty-four — a decay, not a ceiling).
**AND AN INSTRUMENTAL IS NOT A SECTION WITH NO CONSTRAINTS.** The owner:
*"instrumental is not free of lines. what have you that idea?"* — and the idea
came from v2's own paragraph here, repeated uncritically. A section carrying
no constraint mass is a free token an optimiser appends to satisfy any
structural rule, which is the two-line-outro cheat in its cheapest form. Every
section draws a PHRASE count and its bars follow from it; `WORDLESS_FUNCTIONS`
removes the LYRIC half and nothing else. The first fix overshot the other way
— **984-bar instrumentals beside four-line verses** — so the phrase count is
drawn against the longest SUNG section THIS plan drew, a derivation from the
plan rather than a number chosen for it.

**THE CAPACITY LAYER (density stage 1, derived 2026-08-19).** The
owner's ruling on rhyme density: solve, don't census — a survey of
what's been done would band the middle and rate the marvel verse
out-of-band (move 37 again). `quality/capacity.py` derives what the
LEXICON sustains: 39,969 singable words collapse into 12,387
perfect-rhyme families (the comparator's last-prominent anchor; run 1
mirrored `_spelled_rime`'s primary-first anchor and was VOIDED by
test_capacity's own control pair, gasoline/tambourine); a family's
earned-chain ceiling is its spelling-class count (tier 1: an earned
scheme group needs distinct spellings), and the certified floor is a
witness clique built THROUGH `Reviser.inspect` and stored word for
word. Headlines: 162 families sustain a 12-chain, 81 a 20-chain, the
deepest certified chain is 40, held by TWELVE families at the declared
construction cap — ~~NINE~~ REPINNED 2026-08-28, when M-41's sitting
re-derived the artifact under the M-47/M-152-rebuilt judge tables and
`AY-Z-D`, `EY-Z` and `OW-N` joined the tie (15 of 81 certified chains
moved, every one UP; the original nine — `AE-K`, `AE-N`, `AO-L`, `EH-L`,
`EY`, `EY-T-AH-D`, `EY-T-ER`, `EY-T-IH-NG`, `IH-Z-AH-M` — all held) —
~~40 (EY)~~ named one of a sorted
tie, and 40 measures the CAP rather than the language: those twelve are
bounded BELOW at 40 and their true ceilings are unmeasured —
the long dense verse switches sound families because English forces
it. Artifact `data/rhyme_capacity_eng.tsv`; `capacity` verb reads it;
`--check` re-derives tier 1 exactly and re-grades the sample witnesses
(nightly). Two declared bounds of `EXACT_ENUM_MAX`'s species: attempt
cap 40, certification floor 20 classes (raised from 8 when the anchor
correction tripled the certifiable tier — the reasons are numbers in
the module). STAGES 2 AND 3 ARE DELIBERATELY UNBUILT — the earned-
event counter (notes only) and the declared density coordinate await
the owner's ruling on these results; a capacity is a ceiling, not a
score, and nothing grades a draft against it.

**THE CORPUS TAXONOMY (adopted 2026-08-19): language × region/tradition
× function/venue, and the filename group token is DEMOTED.** The six
words in the eng filenames (american/hymn/british/parlour/celtic/hall)
answered two questions in one slot — region vs function — with the
answer decided by which kind of book a file was staged from: ten-plus
American hymnists filed under `hymn`, the Battle Hymn of the Republic
under `american`, and the ENGLISH Taylor sisters under `american`
because their anthology was printed in New York. The slot is split into
two DECLARED per-song coordinates: `data/song_regions.tsv` (global — 4
active rows; `welsh` is one tradition across `cym` and `eng`) and
`data/song_functions_eng.tsv` (per-language — 9 active rows), each row
carrying a definition and an EVIDENCE RULE. Assignment is
evidence-or-blank: `# region:`/`# function:` file headers default,
`--- REGION:`/`--- FUNCTION:` song lines override, blank is UNDECLARED
and never guessed; REGION is single-valued (contested stays blank,
recorded), FUNCTION takes N values each independently attested, with
the multi-tag rate MEASURED by the report so tag inflation drifts a
number instead of becoming a habit. Both vocabularies are closed sets
— `quality/corpus_taxonomy.py --check` is the gate, and a new value enters by
a defined table row in the same commit as its first song (reserved
values wait in `quality/CORPUS_LOADING_PROTOCOL.md`, deliberately NOT
in the tables: a value with zero members is the declared-but-unread
defect in a taxonomy hat). THE TAXONOMY MOVES NO MEASUREMENT: the tag
spellings are apparatus to every reader (pinned by
`quality/test_taxonomy.py` §4 on tagged/untagged twins; the meter-band
adoption re-derives exactly over the identical 139,694 lines), and the
backfill's 21 staged-file md5 repins in `data/sources.tsv` are the
corpus audit's check C working as designed. The language axis was
never new — the filename prefix has dispatched the phonology since
doctrine 45. `data/calibration_manifest.tsv`
(`quality/corpus_manifest.py`) snapshots WHICH corpus state the
adopted constants describe, so loading can drift the live tree
visibly (`--check` exits 3, an answer) and reconcile deliberately —
re-derive, re-adopt, re-snapshot in one closing sitting. The loading
protocol itself, including the pass-1/pass-2 order, the adjudication
records and the escalation rule for licences, is
`quality/CORPUS_LOADING_PROTOCOL.md`.

**THE LOOP IS BUILT: quality/revise.py, tests in test_revise.py.**
`Reviser.brief(lines, scheme)` returns line-scoped instructions;
`Reviser.verify(before, after, scheme, targeted=...)` returns a verdict.
It NEVER generates text — the model proposes, this grades. Four
rejections are enforced and each is a silent failure mode:
  - a revision that fixes the flagged line and breaks another
  - a revision that takes the MODAL candidate (doctrine 9, below)
  - a revision that touches lines nobody targeted
  - a revision that restructures rather than revises
Doctrine 9 is the load-bearing one and it is now mechanical: a flagged
rhyme gets its candidate field with the MOST FREQUENT band-passing
members marked FORBIDDEN, and verify() rejects a revision that lands on
one. Passing the band by reaching for fire/desire is the slop direction,
so a loop that recommended it would manufacture what the floor rejects.
`modal_exclusion=0` disables the rule and is reachable so the defect is
demonstrable; it is not the default.

**THE BAN IS TWO TIERS (owner's rule, 2026-08-18), because a single top-N
cliff was beaten by its own reviser.** hAIR/chAIR, stOVE/wOVE/cOVE and
sOWN/grOWN each passed at rank 7-11 of the very predictability ranking
that computed the old cliff — a reviser iterating candidates until the
checker passed was descending that ranking and stopping at rank 7 every
time. Tier 1: HOMEOTELEUTON — a partner on the SAME SPELLED ENDING
(`lyric_harness.spelled_rime`: silent-e folds, y is a vowel letter, w is
not) is banned outright, whatever the corpus frequency, and the pair
check reads the spellings directly so no finite field can shelter one.
Tier 2: the top `modal_exclusion` of the DIFFERENTLY-spelled remainder.
Both tiers land in `joint_field`'s forbidden set (the offers) AND the
proactive pair check (`HOMEOTELEUTON` / `MODAL_RHYME` notes, both in
`MANDATORY_PURSUE` — unskippable). The counterweight that keeps the ban
from closing rhyme classes is `Declaration.admit`: what satisfies a
mandate is a DECLARED set. **THE DEFAULT IS ALL FOUR SINCE 2026-08-22
(owner ruling)** and DERIVES from `ADMITTABLE_RELATIONS` rather than
restating it — ~~default ("RHYME", "RIME_RICHE") byte-identical to history,
widenable to ASSONANCE/CONSONANCE ... and the door was admitting 2~~
(doctrine 17). The 601-entry world survey (quality/RHYME_CANON.md) and the
engine's 49 named types are the palette. Validated at declaration time;
near-only refuses; `REPEAT` still refused (identity has its own licence
machinery). NARROWING is now the declared move and is the useful direction —
a cell that genuinely wants perfect rhyme only says so and gets exactly the
old behaviour. `quality/test_homeoteleuton.py`, 4 mutations proven.

**THE DOOR AND THE ROUTE ARE NOT ALTERNATIVES, AND THIS SESSION'S OWN PROSE
CONFUSED THEM — WRITTEN DOWN 2026-08-22 BECAUSE THE OWNER CAUGHT IT.** Asked
why fixing the named judge mattered when "we still only have acknowledged
rhyme and rime riche", and the question was fair: this file and this session
both kept saying *"still at the door with 2 and 4"* as though `admit` were the
binding constraint, in the same sitting that built the thing which BYPASSES
it. Those two sentences do not sit together.
~~**MEASURED, and it settles it.** `sun`/`much` is `ASSONANCE`:
`brief FILE --groups=1,2` reports `SCHEME_VIOLATION`; the identical command
with `--relation=class:ASSONANCE` **PASSES**.~~ **STRUCK 2026-08-26 — THIS
PARAGRAPH'S OWN WORKED EXAMPLE STOPPED REPRODUCING, AND IT IS THE HALF THAT
WAS DOING THE SETTLING.** Re-run today, BOTH commands pass: `sun`/`much` earns
NO `SCHEME_VIOLATION` at the default door, because M-59 put ASSONANCE inside
`decl.admit` four days after this sentence was written. **The contrast is
zero, so the example demonstrates nothing** — a fact about the door, recorded
as a fact about the route, and left standing while the door moved twice
underneath it (doctrine 17; this is the same species as the `joint_field`
worked example M-139 found, and it is the second in one file).
**THE CLAIM SURVIVES AND ITS EVIDENCE MOVES TO THE OTHER ROW OF THE SAME 2x2**,
which is the honest repair and is a sharper demonstration than the struck one,
because it shows the route being STRICTER rather than merely different:

| pair | default door | `--relation=class:ASSONANCE` |
|---|---|---|
| `cat`/`hat` — perfect rhyme | passes | **SCHEME_VIOLATION** |
| `sun`/`much` — assonance | passes | passes |

Read down the second column and the route is a real coordinate: a group
declaring `class:ASSONANCE` is NOT satisfied by a perfect rhyme. Read across
the second row and the DOOR has caught up with the route on exactly the case
this paragraph was written about.
**AND BOTH ROWS WERE ALREADY MECHANICAL — THE PROSE WAS SIMPLY WIRED TO
NEITHER, WHICH IS WHY IT COULD GO STALE WITH EVERY SUITE GREEN.** The door
row is `quality/test_homeoteleuton.py` §5 (*"DEFAULT now SATISFIES sun/much"*,
repaired at M-59 — it had been ASSERTING the defect); the route row is
`quality/test_mandate_relation.py` §8 (`schema:consonance` VIOLATING on a
perfect rhyme). No third check is written here: a second copy of a pin is how
two pins start disagreeing (doctrine 1). What this paragraph owed was the
CITATION, so the next reader of a sentence like the struck one can find the
check that would have told them. When a mandate declares a
relation, `grade()` routes through `satisfies_relation` and **never consults
`admits()`**. ~~The 2-name door governs exactly one case — the one where nobody
said anything.~~ **STRUCK with the same date and for the same reason, twice
over**: the door is not 2-name (M-59, all four of `ADMITTABLE_RELATIONS`), and
the one case it governs — where nobody said anything — is precisely the case
M-116 then handed ALL 77 SCHEMAS, so the silent case is now judged by
`admits(s, theta, decl.admit)` OR `relations.whole_vocabulary_pairs` and is the
WIDEST door in the tree rather than the narrowest. Its chance rate is
`quality/chance_rate.py` and is priced by nothing (`MISSING.md` M-138, M-140).
**TWO MECHANISMS, FOUR DAYS APART, ANSWERING ONE COMPLAINT.**
`Declaration.admit` (2026-08-18) is the counterweight to the homoeoteleuton
ban: a declared set, maximum FOUR (`ADMITTABLE_RELATIONS`), so the ban cannot
quietly close rhyme classes. **`admit`'s own ceiling of four is unchanged and
is NOT the ceiling of the default any more (amended 2026-08-26): M-116 put the
77 schemas beside it, so a pair `admit` refuses can still satisfy a silent
mandate. Read this sentence as being about `admit` and not about the door.** The relation route is the other answer and is
richer AND stricter at once: per group, so a group declaring
`class:ASSONANCE` is NOT satisfied by a perfect rhyme.
~~"It stays at two on purpose — it is ONE GLOBAL SET answering 'what
satisfies ANY mandate anywhere', so widening it makes every requirement in
every song LOOSER. The door was never raised because raising it is the wrong
move; the route around it was built instead."~~ **OVERRULED BY THE OWNER
2026-08-22 AND THE SUPERSEDED TEXT STAYS VISIBLE (doctrine 17).** Both
premises are true and the conclusion drawn from them was wrong. Looser was
the RIGHT direction for this particular door, because doctrines 3/24 make
ASSONANCE and CONSONANCE real named sonic events and the mandate layer was
then saying those names satisfy nothing — one repository giving two opposite
answers about one pair. MEASURED across the battery: of 726 flagged mandated
pairs, **355 (48.9%) were typed ASSONANCE or CONSONANCE by this harness's
own band**. See `MISSING.md` M-59 for the full accounting and for how the
two-name default survived every green run (a check in
`test_homeoteleuton.py` §5 was ASSERTING the defect).
**SO A HOLE IN THE ROUTE IS NOT A SECOND-ORDER PROBLEM** — it is a hole in the
only path past the door, which is why `MISSING.md` M-58 (the named judge is
monosyllable-only for 69 of its 76 names) outranks both the null sweep and any
widening of `admit`. **AND M-58 CLOSED 2026-08-28**: the `type:` judge holds
three declared dispositions past the monosyllable key — 13 `EXTENSIBLE` names
take the anchored-tail rule (the registry's own polysyllabic spelling), 7
count-definitional names answer a real no, and the rest REFUSE naming the
registry's gap instead of failing the writer; `screen --relation=NAME` asks
the grade's own question through the same judge, and the plan-first `GRADE
IT` prints the two-step instruction that actually runs. `cellar`/`seller`
satisfies `type:rime riche` now, as the engine's own `types` analysis always
said it did.

**AND WHICH DOOR EACH SITE ACTUALLY READS IS A COMMAND NOW, NOT A MEMORY
(2026-08-26, `MISSING.md` M-139).** The owner's ruling, verbatim: *"go find
everywhere it still has the incorrect 4 and make sure all 77 are there ... 4 is
poisonous as fuck. without all 77 we're going to be racking up the wrong
numbers and then we have to come back and do all of this all over again."*
**THE DEFAULT DOOR MOVED TWICE AND IN TWO DIFFERENT COORDINATES** — M-59
widened `Declaration.admit` to four relations on 2026-08-22, M-116 put ALL 77
SCHEMAS in the default on 2026-08-25 — so the complete default is
**`admits(s, theta, decl.admit)` OR `relations.whole_vocabulary_pairs`**, and a
site reading only the first is answering in August 22nd's vocabulary while
looking exactly like a site that never needed to move.
**MEASURED, `quality/door_census.py`, derived on the AST: 19
pair-satisfaction sites and TWO reached the complete default** — `check_scheme`
and `Reviser.grade`, which are two because they are ONE judge deliberately
called twice (doctrine 1). Six dispositions, never summed past the partition:
FULL / INCOMPLETE / PER_WORD (holds a word, and the 77 judge LINE PAIRS, so it
cannot ask) / RENDERING / VALIDATION / ARGUED.
**THE SHARPEST INSTANCE WAS THE WRITER'S OWN CANDIDATE FIELD.**
`Reviser._field` promises in capitals that *"THE BRIEF AND THE VERDICT HAVE TO
ASK THE SAME QUESTION"*, and `_field_one` under it called `admits(s, theta)`
with `relations=` OMITTED — the historical two. `joint_field`'s own worked
example is the proof: the six words its docstring names as answering all five
of a pivot's calls came back `offered=0`, because `love ~ does` scores **0.983
ASSONANCE** — a fifth of a point ABOVE the band — and the pre-widening door
refuses it. The example that justified raising `field_depth` off 200 stopped
reproducing four days later and nothing could see it.
**AN UNRULED SITE FAILS `--check`, AND A `FULL` RULING IS CHECKED AGAINST THE
CODE** — a site cannot be talked into compliance by editing its own row. That
is the half that answers the ruling's last clause; the census costs 1.9s and
runs in the cheap CI job. ~~Three INCOMPLETE sites are still open, each priced:
`whole_vocabulary_pairs` builds a full 77-schema stream at **2.94s over 14
lines, 4.74s over 28, 14.73s over 56**~~ **REPINNED 2026-08-26: TWO are open,
and that ladder is an ORDER OF MAGNITUDE and not a bound.** **REPINNED AGAIN
2026-08-27: ZERO are open — both were RULED rather than repaired, and the
cost each ruling declines to pay is priced below (`MISSING.md` M-145).** The text is an
undeclared coordinate of it in two directions at once — Whitman runs 3-4x
higher at matched length, and *within sonnets* three separate readings of the
same three lengths give 2.94/4.74/14.73, 1.60/6.00/25.00 and 1.83/4.26/13.72,
moving in OPPOSITE directions at the two ends, because "the sonnets" is a
family of texts and which fourteen lines was never said. There is also a WALL
rather than a slope: free verse `raises RuntimeError("candidate explosion")`
between 90 and 110 lines. And
both shipped consumers gate it
lazily on a pair already charged, so the remaining two need a lazy design
rather than a one-line widening — **except that `Reviser.mandate_from_graph`
is not a cost problem at all.** Its lazy gate is measured to fire on **170 of
170 drafts** (a draft where the narrow door admits every line pair does not
exist here), it has no mandate so `bearing=` has no honest value, and widening
it takes a 41-line draft's derived cover from 19 groups to 41 and its mandated
pair-slots from 242 to 10,626. ~~What it owes is an owner ruling on whether
`--cliques` means the RHYME graph or the whole-vocabulary relation graph, not
a door edit.~~
**BOTH RULINGS WERE MADE 2026-08-27 ON THE OWNER'S DELEGATION — *"you're
more than capable of making those rulings correctly"* — AND `incomplete` IS
**0** (`MISSING.md` M-145). NOT ONE BYTE OF EITHER DOOR MOVED.** `--cliques`
MEANS THE RHYME GRAPH, and `recover` keeps the narrow door too, on ONE
argument that fits both: each site is a **GENERATOR** sweeping every pair,
and that is the population `chance_rate.py --null` measures the 77-schema
door **at chance** on — 69.05% against a null median 71.02%, below its own
null on 20 of 20 draws, p 0.9048 — while the same door separates by **+12.50
pp over the null MAX** on the pairs a WRITER declared. `grade()`'s
77-consult is a **RESCUE** on a declared pair; the same judge run as a
**GENERATOR** manufactures structure rather than finding it (doctrine 71,
and the "move 37" ban one layer over). The two rates are never summed
(doctrine 79). **THE LIMIT IS STATED, NOT BURIED: that null was measured on
14-line SONNETS, so carrying it to either site's drafts is an INFERENCE from
one item shape to another** — the strongest evidence in the tree and not a
measurement on those populations. **`recover`'S SECOND QUESTION IS ANSWERED
THE OTHER WAY**: `slots.PLANNABLE_PLACEMENTS` excludes `T<n>` by an argument
about what a planner may **VOLUNTEER**, and recovery does not volunteer — it
OBSERVES a text that already exists, so the index is READ and not drawn and a
recovered `T4` binding is admissible where a planned one is not. That ships
as a coordinate rather than as a paragraph: `recover.RECOVERABLE_PLACEMENTS`
is the module's own default (imported from `slots`, byte-identical, so no
cover moves) and `--placements=` reaches it from the command line, which it
did from NOTHING before — measured on 12 lines, 41 sites / 113 edges by
default against 60 / 256 with `T2,T3,T4` declared, 143 of them naming one.
**AND `test_door_census.py` §4's `incomplete > 0` GUARD IS REPOINTED, NEVER
DELETED** — every ARGUED reason must now carry a MEASUREMENT and a register
citation, because ARGUED is the disposition a site could be TALKED into.
**AND THE CHANCE RATE OF BOTH DOORS IS A COMMAND NOW** —
`quality/chance_rate.py`, built the same day out of M-138's strike, because the
figures that entry recorded came from an uncommitted script and do not
reproduce: the SAMPLER's population and reader were never declared. Measured
against random CMUdict pairs, the ADMIT door admits **8.48%** and the SCHEMA
door ~~23.30%~~ **24.0–24.9% (repinned 2026-08-28: the M-148 `_seq`
cluster repair moved which random pairs the consonance-family schemas
answer, so the door's chance rate rose WITH its correctness — measured
960..994 of 4,000 over the adopted grid, the admit and narrow arms
HELD)**, against **1.18%** of Shakespeare's mandated pairs failing —
**7.16x and ~20x**, where the gap that got `theta_coda` recalibrated was
1.5x. Neither is priced (`MISSING.md` M-138, M-140).

**THE RELATION IS THE DEFAULT ROUTE NOW (2026-08-22, owner's instruction).**
~~"...AND THE DOOR IT REPLACES ADMITTED TWO. `Declaration.admit` is ONE
global set answering 'what satisfies ANY mandate anywhere', so widening it
makes every requirement in every song LOOSER — which is why it still holds
`('RHYME', 'RIME_RICHE')` and why the answer was never to widen it."~~
Superseded the same day: the door admits all four and the answer WAS to
widen it (M-59).
`Mandate.relations` is per GROUP and therefore richer AND STRICTER: a group
declaring `class:ASSONANCE` is NOT satisfied by a perfect rhyme. What shipped
this sitting is the half that makes it a route rather than a field:
**`Mandate.default_relation`** — the same name declared ONCE for the whole
song, with `relation_of` resolving group's own -> mandate's -> `""` (the coarse
path, so a mandate declaring neither is byte-for-byte the old object) — and
**`--relations=LABEL:NAME,...` / `--relation=NAME` on the command line**, which
is the first spelling of ANY relation coordinate reachable without dropping to
Python. Validated at DECLARATION time through `Mandate.__post_init__`, which is
the one place every construction passes through (`mandate()` is not: `plan.py`,
the tests and the re-open path all build `Mandate` directly).
**AND THE `schema:` NAMESPACE IS JUDGED SINCE 2026-08-22 — ALL 77 NAMES
(owner ruling, `MISSING.md` M-59).** Those names RESOLVED 77/77 through the
vocabulary and were judged 0/77: `satisfies_relation` refused them for a
shape reason and a policy reason, and only the shape reason was real.
**Shape:** a `RelationSchema` is evaluated by `relations.realise()` over a
whole STREAM and `satisfies_relation` holds two words. Fixed by doing the
stream work ONCE in `grade()`, where the lines are, and handing the judge the
line pairs — `relations.line_pairs_for` is the new bridge, and `Span.origin`
(`L<0-based>.<locus>`) is converted in exactly one place.
**Policy:** ~~"gated on the null sweep: a schema that does not beat its own
null must not become enforceable"~~ — STRUCK. It is the same prove-it-first
instinct that produced the two-name default. **The null sweep governs what
this harness may ASSERT unprompted; it does not govern what a writer may ASK
FOR by name.**
**ALL 77 ARE ASKABLE SINCE 2026-08-22 — 0 BLOCKED** (`python3 quality/schema_census.py` re-derives it; `quality/test_capabilities.py` §8 pins it). Seven capabilities stood in the way at the last count and every one closed by building the CONSTRUCTOR that lets a caller DECLARE the coordinate, never by inferring it: `declare_senses`, `declare_stub_resolution`, `declare_period_surface`, `declare_beat`, `declare_lifts`/`search_lifts`, and `declare_delivery` for the delivered/sung surfaces. Doctrine 4 is untouched — its own words were then "no beat grid without audio OR A DECLARED TEMPO" (amended 2026-08-23 to name the DECLARED TEMPO alone: audio left the project's vocabulary by owner ruling, and the quote here is kept as the historical wording), so an INFERRED grid is still refused and `frames.beat` is still None by default. Two schemas also needed a PREDICATE rather than a capability: a bare `requires=` gate cannot make a schema selective, and stamping it would have labelled every perfect rhyme trite and every internal rhyme offbeat — which `UNPROVIDABLE` predicted in as many words.
**WHAT ROUTING BUYS, counted apart (doctrine 79) — 35 of the 77 were live in a mandate at the halfway mark.** 33 out of the box, plus 2 (`epistrophe / radif`,
`qafiya (before the radif)`) that this same lot turned on by calling
`relations.mark_refrain_tail` when a declared schema needs the frame — and
passing `lines=` THE MANDATE'S OWN GROUPS rather than `None`, because that
function's docstring records `lines=None` answering ZERO on 495 of 495 Hafez
ghazals: the fraction is taken over lines that never carried the rhyme.
`lines` is "the declared rhyme-bearing subset as line indices" and a mandate
IS that subset, so the coordinate comes from the declaration and not from
the checker's guess (doctrine 45). The remaining 42 are 19 INTRA-LINE
figures, 5 waiting on a grounded stanza frame (M-39, NOT a wiring job —
`grade()` is handed lines with the blanks stripped, and an all-zero stanza
vector is the defect M-39(b) closed), 8 blocked by data that does not exist
here, 5 by a resource nobody has built, 1 deliberately inert, and 4 whose
blocker M-36's own table gives no KIND for. By placement: 29 declare
`both_line_final` and fit a `--groups=` mandate directly, 19 more are
cross-line at another placement, 19 are intra-line, 10 declare none. The 19 intra-line
schemas do NOT become rhyme relations by being routed: a `same_line` figure
is a property of ONE line, so the judge REFUSES with the placement named
rather than answering `False` — answering `False` would charge a writer for
asking a question the schema does not answer (doctrine 20). Four distinct
answers pinned in `quality/test_mandate_relation.py` §8: satisfied
(`schema:perfect rhyme` on `much`/`touch`), VIOLATED (`schema:consonance` on
the same pair — the schema route is STRICTER, not another way to pass),
refused-for-placement (`schema:alliteration`) and refused-for-evidence
(`schema:holorhyme` needs `lexicon`). ~~The cost is lazy: a mandate that never
says `schema:` never imports `relations` and never builds a stream.~~
**HALF STRUCK 2026-08-23 — THE PLACEMENT WORK FALSIFIED IT AND MEASURED THE
COST (`MISSING.md` M-74).** The second clause HOLDS and is the expensive half:
a mandate that never says `schema:` still builds NO stream, and `realise()` is
never called. The first clause is now FALSE. `quality/schemes.py` imports
`SlotUnsupported` from `quality/slots.py` at MODULE level — correctly, as the
one definition of the placement refusal — and `slots.py` imports
`quality/relations.py` at module level for `SpanRule`, so **every mandate
imports `relations` now, `schema:` or none.** MEASURED, warm, five runs each,
against `9ad2dad^`: `import quality.schemes` was **17.7–18.2 ms** with
`quality.relations` NOT in `sys.modules`, and is **132.8–177.2 ms** with it
loaded — roughly 7x, paid once per process. It is a COST and not a defect: the
alias is doctrine 1 working (two exception classes for one refusal is how a
caller catches the wrong one), and restoring the laziness means making
`_normalise_groups`' `except` clause discriminate a `ValueError` subclass
without naming its module, which is a real restructure of the one function
every mandate passes through and is NOT taken here on the strength of 115 ms.
What is not tolerated is the sentence: a claim about laziness that the tree
stopped satisfying, left standing, is doctrine 17's own subject.

**FOUR DEFECTS FELL OUT OF WIRING IT AND THREE WERE LIVE.** (1) `MISSING.md`
M-49 — the store held a relation's BARE canonical name and `grade()`
re-resolves it, so the 26 names living in BOTH the `type` and `schema`
namespaces (the whole reason M-37 made the namespace mandatory) were ACCEPTED
AT THE DOOR AND REFUSED AT THE JUDGE: **52 of 157 declarations, measured by
round-tripping the entire vocabulary**, now 0. The store is namespaced, so the
invariant is structural — *the stored value re-resolves to the same judge*.
(2) M-50 — `mandate()`'s re-open guard named `returns`/`scope`/`structures` and
not `relations`, so `mandate(m, relations={...})` compared EQUAL to
`mandate(m)`: a declared coordinate consumed and ignored, three lines under a
comment describing that exact defect in the coordinate next door. (3) The
CLI's own copy of the same family, caught by measurement rather than reading:
`brief FILE --groups=1,2` and the same command with `--relation=type:rime
riche` were **BYTE-IDENTICAL** on a draft the relation is satisfied by
(md5 `9e8f3f418504`), so a caller could not tell the flag was read from it
being dropped. `_say_relation` announces the coordinate whenever one is
declared and prints nothing when none is — a line about the CALL, never a
`Finding`, the same shape `_say_blueprint` has. (4) M-53, found by testing
that the new CLI path — which RE-OPENS whatever cover the other flags built —
preserves what it is not declaring: `mandate()` opens with `rule = rule or
ReturnRule()`, so the parameter is non-`None` for the rest of the function and
the re-open branch's `rule=rule` **read silence as a declaration of the
default**. MEASURED: a mandate built with `return_rhyme='positional'` comes
back `'union'` from every re-open — `returns`, `scope`, `structures`, and the
two this sitting added. That coordinate decides whether a return class's rhyme
obligations are read as a UNION with its group's or POSITIONALLY, so
re-defaulting it re-judges the song. The repair had to move UPWARD rather than
sideways: a `if rule is None` guard inside the branch measured `False` on all
four paths, because it was testing a variable the function had already
overwritten.
**THE FAMILY, STATED ONCE:** the re-open branch could not distinguish *not
declared* from *declared as the default* (`rule`), and could not distinguish
*not declared* from *not re-openable* (`relations`). One branch, two ways of
reading an omitted argument as a statement.
`quality/test_mandate_relation.py` §6 (9 checks, three mutations killing 8 / 3
/ 5) and §7 (10 checks, the re-open mutation killing 5).

**THE WRITER CAN NOW SAY WHAT THEY WANT, AND IT REACHES THE CONNECTOR
(2026-08-22, `MISSING.md` M-55).** M-54 gave the vocabulary its definitional
constraints and `FormConvention` has always held the statistical ones. The
layer BETWEEN them did not exist: *"I want a chorus and a postchorus, and
because of that a prechorus would mess that up"* is neither definitional nor
conventional — it is a DECLARATION about THIS song, and there was no way to
spell it. `make_plan` took a seed, a form and a line count; the roster came
from `GENERATOR_ROSTER` and nothing else.
**`--relation=NAME` AND `--functions=a,b,c`, AND NEITHER IS SAMPLED.**
~~The planner does not pick a relation: putting `type:pararhyme` on a group
nobody asked for is the "move 37" ban pointed at rhyme instead of at
shape.~~ **SUPERSEDED BY OWNER RULING 2026-08-25 (`MISSING.md` M-117, the
planner half of M-116, doctrine 17 keeps the strike visible): when the
writer declares NOTHING, each group now DRAWS its relation uniformly over
the bare default plus `relations.DRAWABLE_SCHEMAS` — the 22 schemas a
declared sixteen-line English witness certifies a writer can satisfy
(**a certificate M-148, 2026-08-27, measured as issued on the wrong
ROUTE — it answered on the realise() stream while at least one drawn name
refused its own canonical answers on the mandate's word-pair route,
monosyllables included. REPAIRED the same day, in the sitting the entry
demanded: `relations._seq` reads the vowel-anchored consonant sequence as
the post-vocalic CLUSTER (fast~lost was [F,S,T] vs [L,S,T]; an EMPTY
cluster answers False with the reason rather than vacuously true), and
`relations.pair_satisfies` judges a schema at the DECLARED tokens where a
mandate binds non-default slots, refusing by name the span shapes one
token cannot bind. The gate ships with it — `test_mandate_relation.py`
§10: every drawable name accepts its answer THROUGH `Reviser.grade`, the
canonical monosyllable battery, and the declared-token contrast, each half
killed by its own hand-proven mutation. The certificate and the judge now
agree; M-148 records what moved (one test_relations pin, 30/26/21 ->
31/26/20) and what did not (the pool, the battery's 12/1014)**)
(answers on the witness; not intra-line-only; no token identity at a
line-final placement). A uniform draw over a witness-certified vocabulary
is the planner's ordinary dice; move 37 bans sampling MEASURED corpus
distributions, which this is not. The pool grows by growing the witness,
never by hand; `test_plan.py` §14 re-derives the adoption; drawn
relations ride `--relations=LABEL:schema:NAME` in the grading command and
are named per group in the writer's brief; seed SHAPES are byte-identical
to the pre-draw planner because the draw consumes entropy last; and since
M-149(a) — 2026-08-28 — a group binding declared tokens draws only from
the schemas the pair judge can bind there (`relations.pair_bindable`, the
judge's own predicate: measured 354 unbindable draw-placement
conjunctions over seeds 1-60 before, 0 after), the four window-searching
and head-index names staying drawable at default slots.** What
survives of the struck sentence is PRECEDENCE: a writer's `--relation=`
SILENCES the draw, because the planner still CARRIES what was declared —
into `plan["relation"]`, into the `GRADE IT` line `grading_command`
prints, and into the report as its own disclosure, because a plan that
dropped the coordinate would otherwise look exactly like one that never
had it.
**THE ROSTER IS AN ALLOW-LIST CHECKED AGAINST M-54's `requires` BEFORE ANY
SHAPE IS DRAWN**, which is what makes the two entries one mechanism rather
than two tables: `plan --functions=prechorus,verse` REFUSES, quoting the
gloss — *"'prechorus' REQUIRES ['chorus'] by definition ('lifts from verse
into chorus'). A section that cannot stand in the relation its own name
states is not a novel structure, it is a mislabelled one."* Three more
refusals at plan time: an undeclared relation, a BARE name living in two
namespaces (M-37), and a function the vocabulary declares that this GENERATOR
cannot build (`refrain`, whose own gloss says it is not a standalone section
— M-56 surfacing as a buildability problem). Enforced by REJECTION, so the
draw stays uniform over the admissible set.
**A ROSTER PERMITS, IT DOES NOT COMPEL** — `functions_unused` names every
requested function this seed's draw did not reach, because silence would let
a writer believe they got a section they did not (doctrine 20).
**AND THE CONNECTOR SHIPPED IN THE SAME COMMIT.** That is the half that
matters: `--structures` has been accepted by the CLI since 2026-08-18 and
reachable from `mcp/lyric_tools.js` by NOTHING, which is this file's own
most-repeated defect sitting at the outermost layer. `lyric_plan` and
`lyric_grade` gain `relation` and `functions`; `planArgs` passes them; the
grade picks `plan.relation` off the ARTIFACT exactly as it already does
`plan.groups` and `plan.returns`, because the plan is the one object that
records what was asked for and grading against anything else would be a
second statement of the mandate (doctrine 1). `lyric_check` takes `relation`
DIRECTLY, since it builds its own mandate rather than reading a plan — same
coordinate, and the difference is which object is the mandate.
`quality/test_plan.py` §9, 10 checks. **One pre-existing red is NOT this
change and was verified by reverting**: `mcp/test.mjs`'s `grade returns two
blocks` fails byte-identically before and after, ~~because `data/cmudict.dict`
is unfetched in this container so the harness cannot grade.~~
**THE FIRST HALF HELD AND THE CAUSE WAS WRONG — REPINNED 2026-08-23, AND THE
CAUSE WAS A STALE FIXTURE OF OURS.** `cmudict.dict` sits at the repo root,
not under `data/`, and it is present: `lyric_screen live: hair/chair BANNED:
HOMEOTELEUTON` passes in the same run, which is the whole stack answering.
The check's own comment read *"Seed 55 is Count to Five's shape: 22 lines,
chorus lines 17-19 returning verbatim as 20-22"* — true of planner v1. V2
re-derived every space it samples from, so **seed 55 is 53 lines in 4
sections today** and a 22-line draft REFUSES at exit 2, correctly; with no
render, `lyric_grade` returns one block and the check reads `1 !== 2`, which
names neither the seed nor the count. Calling an environment artifact was
doctrine 20 pointed at our own suite: a defect nobody had looked at, recorded
as a defect nobody could fix.
**THE SHAPE IS READ FROM THE PLAN NOW, NEVER REMEMBERED.** The draft is built
from `lyric_plan`'s own report — declared line count, bracket-header rows,
`RETURNS:` classes — so the check proves the two-block contract for whatever
shape the planner produces and cannot go stale when the planner is
re-derived. It also reads two coordinates the literal never consulted, and
adds an invariant the literal could not state: the section headers must
account for every declared line. A second `lyric_plan` call on the same seed,
asserting the same remembered header, is folded into the first (doctrine 1).
`node mcp/test.mjs` is **34 checks, exit 0**; stubbing `extractRender` to
return `null` takes it to 31 and red, which is the proof the repaired check
reads the coordinate it names.

**WHERE A SECTION MAY GO IS A DECLARED COORDINATE NOW (2026-08-22,
`MISSING.md` M-54).** "An outro is last" was true of every plan the planner
produced and was stated in NO coordinate: `plan._sample_pattern` enforced it
by the ORDER OF TWO `append` CALLS. So nothing could consult it — a
hand-written blueprint with an outro in the middle graded CLEAN — and the
roster could not be extended by a table row.
**THE FIRST DESIGN WAS WRONG AND ITS OWN DERIVATION REFUTED IT.** `position ∈
{first, last, free}` read out of the glosses by keyword claimed a position for
11 of 21 rows and got **4 wrong**, every failure a RELATIONAL fact flattened
into an ABSOLUTE one and inverted: `false_ending` came out `last` on the word
*close* when its definition is that the song COMES BACK FROM it;
`turnaround` and `interlude` are BETWEEN things; `reprise` needs something
earlier. Exactly THREE rows carry a genuine boundary fact (`intro`, `outro`,
`coda`) and everything else falls out of a dependency, so position is mostly
DERIVED. `quality/SECTION_CONSTRAINTS_DESIGN.md` is the argument.
**FOUR KINDS, AND THE LAYER ONLY EVER DENIES**: `boundary` (an edge of the
whole song), `requires` (a precondition on the ROSTER — "this song has no
chorus, so it has neither a pre- nor a post-chorus"), `adjacent_before`/
`adjacent_after` (a NAMED immediate neighbour), `needs_before`/`needs_after`
(SOME neighbour). Anything not denied stays reachable, so **`verse` carries
nothing at all** — which is what keeps this from barring an unprecedented
shape. A denial is admissible only if DEFINITIONAL, and the per-row test is
written into the field: *violate it — is the result a NOVEL SONG or a
MISLABELLED SECTION?* A prechorus with no chorus is not experimental; the word
means before-the-chorus. Mislabelled, so it prunes. Verse-chorus-verse-chorus-
bridge violated is a novel song — a CONVENTION, `FormConvention`'s business, a
note, never the planner (doctrine 6, the owner's "move 37" ban).
**A REFUSAL IS NOT AN ABSENCE** (doctrine 20): `placement_refused` records
*why* a row could not claim, and 2 rows use it — `tag`, whose gloss says
"closing a section OR THE SONG" and asserts both readings, and `drop`, where
the build edge is a ruling rather than a reading. A refused row is SILENT in
the grader.
**EVERY CLAIM QUOTES A GLOSS, AND THE TABLE CHECKS ITSELF AT IMPORT.** Six
checks, each proven by a mutation: a boundary outside the declared two, a
`requires` naming no function, a claim with no evidence, evidence quoting a
phrase that occurs in no gloss, a row both claiming and refusing, and
`boundary='first'` beside `needs_before`. An unevidenced placement rule is the
`_CELLS` defect this entry exists to end (doctrine 45).
**IT FOUND A LIVE DEFECT ON ITS FIRST RUN.** Shipped blueprints: **0
violations**. The PLANNER: **19 of 300 plans**, every one an `interlude`
opening or closing the song — a span whose own gloss is *"between sung
sections"*, with nothing sung on one side. `_sample_pattern` derives its edges
from `boundary` now and rejects any body `placement_findings` refuses
(rejection sampling from a uniform proposal is uniform over the ACCEPTED set,
which is why it is not a greedy left-to-right collapse — that would
re-introduce the enumeration bias v2's own smoke run found). **0 of 300 now,
with function coverage unmoved at 14 of 21.**
**NOTES, NOT FLAGS, and the precedent is `uncovered_bars` verbatim**: a
section's position is a fact about the DECLARATION, not any line's words, so
no rewrite moves it and a flag would spend every round of `max_rounds` and
report ROUND_LIMIT. **And the question is asked only when it CAN be put** —
the first wiring asked it unconditionally and `test_song_function` §8b caught
it, because a song where no section declares a function has no placement
question at all. One honest repin stands: `moonlight_fixture`'s triple moves
(4, 3, 1) -> (5, 4, 1), a real new question asked and answered, with the
FINDING LIST unmoved.
**AND `plan.py`'s MOVE-37 GUARD WAS WIDENED AND RE-TIGHTENED IN THE SAME
BREATH.** `test_plan.py` §4 pins by AST that `plan.py` imports only
`{schemes, meter_bands, structures}` and opens no file. `grid` had to join it,
and it is the ONLY member that needed an argument: the other three open ZERO
files between them and `grid.py` opens THREE, so admitting it hands the
planner transitive reach to a corpus reader. It is admitted because
`SECTION_FUNCTIONS` is a HAND-DECLARED vocabulary of the same species as
`structures`, and because deriving the placement rules anywhere else would put
a second copy beside the grader's. The guard is narrowed where it was widened:
a second check asserts `plan.py` names ONLY the vocabulary and its pure
checker from `grid`, never a reader — stricter than the list it replaces.
`quality/test_placement.py`, 24 checks over 5 sections.

**THE STRUCTURE CATALOG IS WIRED — MANDATE, GRADER AND PLANNER READ ONE
TABLE (2026-08-18).** Phase A/B built the 58 rows (`quality/structures.py`:
1 comparator sentinel, 9 presets, 48 named axis cells, world aliases); this
sitting made them a DECLARED COORDINATE. `Mandate.structures` is an
index-aligned tuple ("" = default), declared as `mandate(...,
structures={"B": "kalevala-alliteration"})` by label, index or list, stored
CANONICAL (an alias resolves at declaration, never downstream), refused as
`NoMandate` on an unknown name — the catalog's own message carried through,
because a `StructureRefused` escaping `mandate()` would be the right
refusal in the wrong layer's words. The re-open path takes `structures=`
the same way it takes `returns=`/`scope=` (before it joined that condition,
a late declaration was DROPPED at the idempotence branch in silence), and
the origin names what was actually re-declared. `grade()` routes every
mandated pair through its group's row: REPEAT stays the identity
machinery's first (an identical word trivially "satisfying" an alliteration
demand is the laziness that machinery adjudicates), a non-default row's
judge answers True/False/None, None is a REFUSAL RECORD (doctrine 79 —
named structure, its own `groups`, counted in `pairs_refused`, rendered as
`SCHEME_UNREADABLE`, never a violation), and every verdict carries
`"structure"` — the row that answered, or None on a mandate that never
learned the coordinate, which takes the byte-identical old path with no
catalog import paid. TWO SCOPE DECISIONS, both about honesty rather than
reach: the proactive pair check (HOMEOTELEUTON/MODAL_RHYME) SKIPS pairs
judged under a non-default row, because the spelled-rime class and the
eng-song modal table are END-RHYME calibrations and charging them to a
coda-only hending grades the wrong axis with the wrong corpus; and the
skip's counterweight is `Structure.calibrated` + the
`STRUCTURE_UNCALIBRATED` whole-draft NOTE — a declared row with no measured
laziness regime grades correctness and says out loud that laziness is NOT
graded, once per draft, because silence there would read as clean (doctrine
48). `calibrated` flips True only when a preregistered calibration ADOPTS a
predictability table + lazy class under that row's own pairing relation
(the meter-band pattern: register -> measure -> adopt -> CI re-derives);
today it is True for exactly the sentinel, so `plan.py` — which now samples
a per-function structure and discloses it in `choices.structures` — has a
pool of one, a FORCED pick consuming no seed entropy. The CLI
`--structures` flag was ~~DELIBERATELY DEFERRED~~ **and the deferral ENDED
with the Kalevala adoption — the flag ships** (`lyric_harness.py`, and
`test_verbs.py` §39 grades the same draft with and without the declaration).
The sentence below is the argument for the deferral, kept because it is the
reason the flag waited for a calibrated row rather than a reason it still
waits (doctrine 17); struck 2026-08-21. It was deferred to the first
calibration
sitting (Kalevala alliteration against the Kanteletar's 28,935 lines): the
only event that can produce a non-default pick is the same event that
should ship the spelling, and a flag shipped before any row is calibrated
would be a door to declaring checks the grader must immediately disclaim.
`quality/test_structures.py` §4–7, 4 hand-proven mutations (routing gate,
pair-check skip, disclosure stub, planner filter), each killed by a named
check.

**PHASE 2 OPENED AND ITS FIRST CALIBRATION ADOPTED THE SAME DAY
(2026-08-18): the census, then Kalevala alliteration — and `calibrated`
is a LANGUAGE TUPLE because of it.** The owner overturned
one-structure-first: the census
(`quality/STRUCTURE_CENSUS_PREREGISTRATION.md` →
`RESULTS_STRUCTURE_CENSUS.md`, `data/structure_census_eng.tsv`) ran all
57 non-comparator rows over English — 417M pair judgings, three counts
never summed — and banked the CHANCE-RATE table that is the null half of
every future laziness calibration (English alliterates by accident at
~9% within a line; constrained/incidental is a declared per-cell tag,
because laziness is a property of choices under a constraint and
blending chance with choice is the bias the design refuses). Its E1
falsifier fired once, honestly: iambic pentameter cannot end a line on a
dactyl, so `dactylic-rhyme` left the constrained family by amendment.
Then the first constrained measurement
(`KALEVALA_ALLITERATION_PREREGISTRATION.md` →
`RESULTS_KALEVALA_ALLITERATION.md`, `data/kalevala_alliteration_pairs.tsv`,
adoption re-derived nightly by `kalevala_calibration.py --check`):
Finnish verse under the rule alliterates at 0.3249 against its own
vocabulary randomly re-paired at 0.1225 max over 200 resamples and
unconstrained later Finnish at 0.1446 — and run 1 was VOIDED by its own
table head (`inen`/`isen` are suffix fragments; the ASCII tokenizer had
shredded ä/ö, and the fin phonology's `_tokens` was the one definition
all along, doctrine 1). TIER 1 IS REFUSED BY MEASUREMENT: the
shared-prefix distribution has no separable same-stem mass, so no
HOMEOTELEUTON analogue exists for this structure — the end-rhyme rule's
shape transposed, its content did not. The adopted conditional
(`vanha`/`väinämöinen` 303 at its head) is type-sparse and token-dense
like its English sibling: a BACKOFF source, never used alone. AND THE
ADOPTION'S OWN REGISTRATION CARRIED A CONFLICT — "the planner pool grows
to two" against its binding-scope non-claim — resolved for the non-claim
(doctrine 8): `Structure.calibrated` is a tuple of language codes, the
ENGLISH pool is UNCHANGED, the grader's disclosure names the draft's
language, and `--structures=LABEL:NAME` ships on the CLI
(`test_verbs.py` §39: the same draft grades differently with and without
the declaration, which is the only shape that proves the flag is read).

**METER JOINED THE SAME LOOP 2026-08-11, and rides the FIRST rejection
above rather than adding a fifth.** `brief`/`inspect`/`verify` all take
optional `blueprint=`/`subdivision=`/`assume=`; when given, `quality/fit.py`'s
per-line findings are folded into the SAME set rhyme findings already live
in, so a revision that fixes a rhyme and overflows its bar is rejected by
the existing "fixes the flagged line and breaks another" rule with no
meter-specific veto written. `subdivision` is a `quality.fit.Subdivision` —
a real declared choice, never a default — and it is call-site declared, the
same way a mandate is: nothing in a blueprint file is read as a subdivision.
Severity is not re-decided here either: a `SLOTS_EXCEEDED` finding (more
syllables than slots — mathematically impossible once the setting is
declared) is a hard flag because `fit.py`'s own `satisfiable=False` already
says so; `PROMINENCE_EXCEEDS_HEADS` and friends stay soft notes, the same
tier as an unintended rhyme collision, because they are a style call and not
a contradiction. Omit `blueprint=` and nothing changes — meter is opt-in.
`quality/test_revise.py` test 25.

**THE CALIBRATED BANDS ARE NOT OPT-IN (2026-08-18).** `inspect()` also runs
`_band_findings` on every draft, blueprint or none: DENSITY [5, 12]
syllables/line and PROMINENCE [2, 7] prominent/line, measured over 139,694
corpus lines and adopted by three preregistrations
(`quality/METER_BANDS_PREREGISTRATION*.md` → `RESULTS_METER_BANDS_READER.md`
— two refusals, then one adoption). Out of band EITHER way is a per-line
**flag** — the loop holds the line open, `revise` exits 3 if it stands —
because these quantities have no correct direction and a band is the only
refusable shape. The check reads with the calibration's own reader
(`meter_bands.reader("fallback-low")`, the registered instrument-match
condition), judges unreadable lines asymmetrically (a lower bound OVER the
ceiling flags; under the floor it is a `BAND_UNJUDGED` note, doctrine 79),
and the shipped constants (`meter_bands.ADOPTED`) are re-derived against
the corpus by `python3 quality/meter_bands.py --check` in CI so drift fails
loud. `quality/test_meter_bands.py` sections 9–10.

**THE LOOP IS AUTOMATED: quality/loop.py, tests in test_loop.py.**
`brief`/`verify` graded one round at a time by hand; `revise_loop(reviser,
lines, mandate, ...)` drives them to convergence. It still never writes: text
generation is a `propose`/`propose_group` callable the caller supplies, and
the one shipped here (`swap_at_slot`, a single-word splice at the binding
site) exists to prove the loop's OWN control flow, not to write a good line.

**THE TWO SEAMS ARE NOT ONE SEAM, AND TIER 2's WAS STARVED — FIXED
2026-08-14.** `propose(brief, lines, attempt, reasons=None, whole=())` and
`propose_pair(pair_brief) -> (str, str) | None` are the contracts.
`propose_pair` USED to take four bare strings — the two line texts and two
words — while both line numbers, the whole draft, the group label and
members, the pivot's own `Brief`, the attempt index and the previous
rejection all sat in scope at the call site and were passed to nobody. Tier 1
has had a rejection-feedback channel since it was written; tier 2 kept NO
reasons at all, so its writer could not be told why the last attempt was
refused and composed blind. `PairBrief` carries all of it.
AND BOTH TIERS WERE GRADED ON A RUBRIC NEITHER WAS SHOWN: `verify()` reads
the WHOLE-draft findings and no proposer ever saw them — measured at
`whole_flags ['LEXICAL_MONOTONY', 'HOOK_ABSENT']` against a proposer whose
entire view was `['CLICHE_PAIR', 'CROWDED', 'PROMINENCE_EXCEEDS_HEADS']`.
`whole=` closes it, read once per round off the SAME `inspect()` key
`LoopResult.whole` already uses rather than derived a second time.
NO COMPATIBILITY SHIM, and the reason is that neither end can dispatch
honestly: under a two-shape interface the CALLEE would have to type-test its
own first argument to learn which contract it is in (one fact read twice) and
the CALLER can only ask `inspect.signature`, which is unreadable for builtins
and C callables and is a second statement of the contract beside the
docstring. The break set is ENUMERATED instead — any four-positional
`propose_pair=`, any four-parameter `propose=` — and both raise `TypeError`
at the FIRST proposal, before a line of the draft is touched.
**`pivot_word`/`anchor_word` ARE THE PROPOSAL, NOT THE STATUS QUO** — the
current words are the last tokens of `pivot_text`/`anchor_text`. That
sentence is load-bearing: `quality/propose.py`'s `render_pair` held the
opposite reading and printed `(ends on 'mankind')` beside a line ending on
"dream", so every tier-2 prompt of every real run misstated the draft on both
lines and in the options heading at once. One field, two readings, in two
modules (doctrine 1). Neither suite could see it — one built its own
stand-in object with the same misreading baked into the fixture, the other
drove tier 2 with its own stub — and NOTHING crossed the seam until
`quality/test_propose.py` §7c/§7d were written to. §7d drives a REAL
`revise_loop` into REAL tier 2 through `ModelProposer`, which before this
contract landed raised `TypeError` on the first joint conflict with both
suites green.

**WHO WRITES THE LINE IS `--propose=`, AND THE LOOP CAN NOW SUSPEND RATHER
THAN GUESS — `defer:PATH` BUILT 2026-08-15.** `revise_loop` has taken
`propose=`/`propose_pair=` since it was written and for most of that time the
only proposer reachable from the command line was the stub, so the flagship
verb's every demo was a single-word splice. Four spellings now: `stub` (the
default, and it stays the default because CI runs `revise` and a default that
opened a socket would make a suite's result depend on a remote service),
`replay:PATH`, `defer:PATH`, and `call:MODULE:FACTORY` — where the CALLER
names both halves and this repo ships no module of its own, because the
proposing half is not this project's to ship.

**THE CONSTRAINT `defer:` EXISTS FOR IS NOT A LANGUAGE PROBLEM, and the first
diagnosis of it in this project said it was.** A proposer is
`callable(prompt) -> str`; anything can be one. What cannot happen is a CHILD
PROCESS re-entering the agent that spawned it — while `revise_loop` runs,
whoever started it is blocked waiting for it to return, so a proposer needing
a writer's judgement has nobody to ask, four frames down, through a contract
whose return type is `str | None`. `None` is unavailable as a suspension
signal because it already means THIS PROPOSER GAVE UP and the loop acts on
that. `call:` answers this by reaching a service, which needs a credential.
`defer:` answers it by reaching NOTHING: the loop stops at the first request
it has no answer for, writes down what it asked, and exits **4** — a fourth
code for the reason `song` needed a third (0 clean, 2 the harness could not
answer, 1 Python's own, 3 answered-with-a-flag-standing; a gate that is
WAITING is not a gate that failed). The writer fills `pending.answer`; the
SAME command run again replays every answer in order and continues.

**RESUMPTION IS SOUND ONLY BECAUSE THE LOOP IS DETERMINISTIC, and that was
verified rather than assumed** — by inspection (no set iteration in its
control flow, doctrine 66) and empirically (three separate processes,
byte-identical output, so hash randomisation would have shown).

**THE ENFORCEMENT IS THE POINT, not the convenience.** The failure this closes
was never that the loop was wrong — it is that a writer disciplined enough to
drive it by hand is a writer who can also decide not to, and this file's own
history is the evidence: the loop was run by hand exactly once, converged in
three rounds, and rejected two drafts for modal rhymes, after a full session
of not running it at all. There is now no path from "flags outstanding" to a
final draft except through the gates, because the verb emits none until the
run it is resuming reaches a stop condition. Re-running without answering
returns the same question, not a worse song.
**AND A FINISHED DEFERRED RUN IS A RECORDED ONE**: the state's `answered`
block is byte-for-byte the schema `replay:` reads, ASSERTED and not claimed —
`quality/test_verbs.py` §20 hands it to `--propose=replay:` and requires the
same final draft, so a session that wrote a song is reproducible by someone
with no writer and no credential (doctrine 14).

TWO TIERS, matching what backspacing through a draft actually does. TIER 1
swaps a flagged line's own word for an offered candidate. TIER 2
BACKTRACKS: `Brief.joint_conflict` means `joint_field` already searched the
complete pool and nothing answers every group a pivot is in at once —
retrying tier 1 there is re-running a search already proven empty, which is
why the brief says "the mandate, not the line, is what needs revising."
Tier 2 instead revises the WORD of the line the pivot has to match, ~~bounded
to a two-line group (the pivot and one anchor): a group of three or more
would mean rewriting the whole group to keep it mutually rhyming, which is a
bigger move this tier does not attempt, and it says so rather than pretend
the search was wider than it was.~~
**AND THE BOUND IS GONE — IT REWRITES THE WHOLE GROUP AT ONCE (2026-08-24,
`MISSING.md` M-105, owner's instruction *"build the joint backtrack"*).** The
struck sentence has two halves and only the first is true: rewriting the group
at once IS how its members stay mutually rhyming, and that is one more member
on the same search, not a bigger move. **MEASURED over 300 plans, 7,641
declared groups: 3,177 (41.6%) have three or more members, carrying 28,912 of
the 33,376 mandated pairs (86.6%)** — every one of them refused by this tier,
correctly disclosed, which is why nothing ever went red. The bound dates from
when a group came from an RGS partition and was almost always a pair; it
stopped fitting when placement drawing (M-71/M-80) began emitting overlapping
covers at a median of 26 groups a song, and nothing re-asked it. **THE CLIQUE
IS BY CONSTRUCTION**: members are assigned IN ORDER, each one's field searched
against the pivot's word PLUS every sibling already placed, so `joint_field`'s
intersection holds the group together and there is no second mutual-rhyme
predicate to drift from the grader (doctrine 1). **THE COST IS LINEAR IN THE
GROUP** — `width * (k - 1)` searches and `width ** 2` proposals, never
`width ** k` — and **at k=2 it is byte-identical to the pair search it
replaces**, pinned by `test_loop.py` §16 measuring two widths on one fixture.
The contract moved rather than grew a second shape (a pair IS a group of two,
doctrine 1): `PairBrief` -> `GroupBrief` + `AnchorSlot`, `propose_pair` ->
`propose_group(group_brief) -> tuple[str, ...]` in `GroupBrief.members` order,
`render_pair`/`parse_pair` -> `render_group`/`parse_group`, and the response
marker is `L<n>:` because two role names cannot address a group of nine.
**AND THE STUB WAS SPLICING THE WRONG WORD**: `default_propose_pair` called
`swap_end_word` unconditionally, so a HEAD-bound group was answered by
rewriting its ENDING — the defect `swap_at_slot` closed for tier 1 on
2026-08-23, still live here because the two stubs were repaired a lot apart.
`test_loop.py` §6 was the test that PINNED the bound (`tried == 0`, `"3+
members"`, draft untouched) and is rewritten in place on the same fixture: its
load-bearing assertion is now that EVERY member moved in ONE accepted attempt,
and that draft goes from `0 tried, untouched` to SUCCESS in 3 rounds.

THREE STOP CONDITIONS, and they are not one thing. SUCCESS — nothing left
carries a flag finding **ON A LINE. That qualifier is load-bearing and was
missing until 2026-08-13.** Every stop condition reads `brief()`, `brief()` is
built from `inspect()`'s `per_line` half, and a WHOLE-DRAFT finding names no
line — so it is in no `Brief` and no stop condition can see it. ~~Exactly three
codes are~~ ~~FOUR codes are~~ ~~FIVE codes are~~ **SIX codes are (2026-08-25: `STACKED_DRAFT` joined — the sentencehood layer's calibrated noun-stack ceiling, `MISSING.md` M-110, same species as the floor's two and priced by the same argument below)** whole-draft AND a flag:
`LEXICAL_MONOTONY` and
`FUNCTION_WORD_HEAVY`
(the floor, and only inside a calibrated profile's MEASURED range) and
`HOOK_ABSENT` — ~~which is the song-function layer's ONLY flag~~ **joined
2026-08-23 by `HOOK_DOES_NOT_RECUR` (`MISSING.md` M-84, owner's ruling), so the
song-function layer now has THREE and they are the same kind: all are facts
about a hook the WRITER DECLARED, not measurements against `POPULAR_SONG` —
`TITLE_NOT_IN_HOOK` joined 2026-08-23 (`M-86`), promoted on the owner's
reaffirmation after the 67.7% corpus rate was put in front of them, and it
ships with `TITLE_LONGER_THAN_HOOK`, a REFUSAL for the case no writing can
answer** —
so the layer
wired in above can never stop this loop. `verify()` reads all four, because
its diff covers `whole` as well as `per_line`. **So a whole-draft flag can
REJECT a revision and can never ASK for one**, and `revise_loop` on a four-line
draft with a declared blueprint returns SUCCESS with `LEXICAL_MONOTONY` and
`HOOK_ABSENT` both standing. NOT closed by widening the stop condition: this
loop's only move is a word swap on a named line, none of the three names one,
so promoting them would spend every round of `max_rounds` on a defect the loop
has no move for and then report ROUND_LIMIT. DISCLOSED instead —
`LoopResult.whole`/`.whole_flags` carry them out and `LoopResult.disclosure()`
prints them under the stop reason. `quality/test_loop.py` test 11.
NO_PROGRESS — a whole round fixed nothing, so
another identical round is not run. ROUND_LIMIT — `ReviseDeclaration.
max_rounds` (declared since the first commit of `quality/revise.py`,
default 4, unread by anything until this module) is reached. A single
unsolved line is NEVER a stop condition — the loop keeps going on every
other flagged line and reports the dead end in the result.

**AND "FLAGGED" WAS TOO NARROW: THE LOOP STOPPED ON THE ONE THING DOCTRINE 9
IS ABOUT — `ReviseDeclaration.pursue`, FIXED 2026-08-15, FOUND BY WRITING A
SONG THROUGH THE LOOP.** `MODAL_RHYME` and `PREDICTABLE_RHYME` are in
`RHYME_FINDINGS`, so `brief()` hands a line carrying one a COMPLETE candidate
field with the modal words marked FORBIDDEN — the machinery to fix them is
built, reachable and correct. Both are NOTES, and every stop condition here
read `severity == "flag"`, so the loop reported SUCCESS and stopped before it
ever asked. MEASURED on a 33-line draft: `revise` converged after ONE answer
and said SUCCESS while `song` on the byte-identical draft reported four
`MODAL_RHYME` and `PREDICTABLE_RHYME` at 3 of 3, 100% of pairs above 0.90.
**And on the song this repo had already declared finished at 0 FLAG — `warm`/
`storm` and `june`/`soon`, each the #1 answer in its own field, both still
standing.** Doctrine 9 is this project's central claim and its own loop could
not enforce it; doctrine 48 is the entry for exactly this shape, one layer in,
because here the mechanism WAS mechanical and the stop condition made it
unreachable.
**A DECLARED COORDINATE, NOT A PROMOTION**, and re-typing `MODAL_RHYME` as a
flag was wrong twice over: doctrine 7 says a floor may not order the region it
already passed and a pair that RHYMES is inside that region, and `verify()`
gates on flags, so a promoted note would begin REJECTING revisions for
introducing one — the exact regression `new_flags` was split out to end.
**SO PURSUING CHANGES WHAT THE LOOP ASKS FOR AND NEVER WHAT IT REJECTS**:
`verify()` is untouched, `quality/test_verbs.py` §21 pins the verdict as
BYTE-IDENTICAL with the note pursued. The pair composes doctrine 9 end to end
— the loop now ASKS for a non-modal word and `verify()`'s pre-existing
`modal_taken` rejection refuses an answer that takes one. `--pursue=CODE,CODE`
on the CLI; ~~empty by default, so every earlier run reads unchanged~~; a code
`brief()` cannot offer a field for REFUSES rather than sitting inert.
**THE DEFAULT IS NOT EMPTY SINCE THE BAN WENT UNSKIPPABLE, AND
`PREDICTABLE_RHYME` JOINED IT 2026-08-23 BY OWNER RULING (`MISSING.md`
M-66).** `loop.MANDATORY_PURSUE` is
`{MODAL_RHYME, HOMEOTELEUTON, PREDICTABLE_RHYME}` and the CLI flag only ever
ADDS to it. The third member was in the loop's vocabulary and outside its
reach the whole time: the floor's note fired as an AGGREGATE ("N of M pairs
above 0.90") with no locations, and the old comment beside `MANDATORY_PURSUE`
excused the omission with "it names no line" — a fact about the EMISSION, not
the phenomenon, since `_predictability` computes per-pair triples and the
emitter was discarding them. The emitter now names BOTH members of every
obvious pair (the partner is closed by `resolved_elsewhere` when one end's
fix clears the pair), `brief()` offers the same candidate field a
`MODAL_RHYME` line gets, and a real `revise_loop` drove a 7/7 draft to 5/7 —
under the sonnet profile's measured 0.8333, so the finding CLEARS — where the
byte-identical draft was previously SUCCESS in 0 rounds. The note still fires
only inside a profile whose `predictability_max` was measured, so the pursue
is calibration-gated by construction.

**AND THE BRIEF TOLD A WRITER SOMETHING FALSE ABOUT THE MANDATE — FIXED
2026-08-16, FOUND BY WRITING A SONG THROUGH `--propose=defer:`.** `brief()`
gated the MANDATE BLOCK and the CANDIDATE FIELD on ONE condition, `wants and
groups`, where `wants` is "this line carries a finding in `RHYME_FINDINGS`".
So a line flagged for METER ALONE while sitting in a mandated group got NO
`must_answer` — and `quality/propose.py`'s `_mandate_block`, with nothing to
print, fell through to its default: `(no rhyme group declared for this line)`.
**That sentence is about the MANDATE and the condition that produced it is
about the FINDING SET** — one question, two readings, and the rendered one is
FALSE (doctrine 1).
THE COST IS NOT THE SENTENCE, IT IS WHAT A WRITER DOES NEXT. On a two-line
draft (fingerprint `385ff1e4055e`, mandate `AA`, 2 bars of 4/4 at
`--subdivision 2`) L1 carried `SLOTS_EXCEEDED` and no rhyme finding while
`m.groups_of(1)` was `[0]` label `A` and `m.requirement(1, 2)` was
`REQUIRE_RHYME`. Told no group existed, the writer fixed the meter by
shortening the line and moved the end word `four` -> `burns`; `verify()`
ACCEPTED it, correctly by its own rules, and the word the OTHER half of the
only mandated pair has to answer changed in silence.
**TWO GATES NOW, AND THE SECOND IS UNCHANGED.** The block is gated on the
mandate; the FIELD stays gated on `wants`, which is `brief()`'s own
long-standing argument — a meter-only line is never handed rhyme words it has
no use for — and it also keeps the enforcement honest by construction, since
`verify()`'s RULE 3 reads `b.forbidden_modal`, the brief's own list, so a line
offered no field is one the modal rule does not enforce against.
`joint_conflict` stays inside the field branch: it reports a search that came
back empty, and setting it where no search runs would be a claim about a test
nobody performed (doctrine 20).
**NOT A RARE SHAPE — MEASURED ON THIS REPO'S OWN FIXTURES**, as briefed lines
in a mandated group carrying no rhyme finding: **23 of 106 (21.7%)** under
DECLARED mandates and **32 of 140 (22.9%)** under `mandate_from_graph`, each
with and without a blueprint. The two agree to a point, which is the check that
the derived cover's own bias is not driving it (doctrine 14). Roughly one
briefed line in five was being told the mandate said nothing about it, and the
rate rises with a blueprint declared, as it must — meter is the layer that
flags a line without implicating its rhyme. **ONLY A WRITER COULD FIND IT**:
the stub proposer never reads the mandate block, so no run before this one
could see it. `quality/test_revise.py` §40 is 7 checks and fails exactly 2
against the pre-fix gate; the other 5 are the premise and three controls that
must pass on both trees, the load-bearing one being that a line in NO mandated
group STILL gets the default sentence — the repair states a fact, it does not
delete a line of the prompt. §32 carried the identical conflation in its own
assertion (`not b1.must_answer` standing in as a second proof of a claim about
the candidate FIELD) and is repaired with it. **A SECOND DEFECT FROM THE SAME
SESSION IS RECORDED AND NOT FIXED** — the next line's brief cites the DELETED
word and offers a field computed against it, which `quality/loop.py:741-748`
documents as a deliberate tradeoff whose argument is about ACCEPTANCE and
silent about GUIDANCE. `quality/COVERAGE_PREREGISTRATION.md`, rung 1, holds
both in full.

**AND `revise` AND `verify` DISAGREED ABOUT ONE BEFORE/AFTER PAIR — FIXED
2026-08-16, FOUND BY RUNNING `verify` ON A DRAFT `revise` HAD JUST CONVERGED
ON.** The loop returned SUCCESS; the verb, handed the identical pair with the
same mandate, blueprint and subdivision, returned `REJECTED — L2 took the modal
candidate 'stairs'`. Doctrine 1 between two surfaces of one module — **and the
rejection's own sentence was FALSE**: L2 did not TAKE `stairs`, it already
ended on `stairs` and was revised elsewhere in the line, for its meter.
`forbidden_modal` carries TWO rules at once — the modal head (doctrine 9) and
`brief()`'s incumbent clause, *"the word currently there is itself excluded"* —
and MEASURED, `modal_field('four')` is `['door','more','before','shore','sore',
'or']` with and without the exclusion, so **`stairs` is not a modal candidate
for `four` under any spelling** and was on the list only as the incumbent. The
report named the rule that did not fire.
**TAKING REQUIRES A CHANGE.** RULE 3 skips a line whose end word is
byte-identical before and after: doctrine 9 is about REACHING for the obvious
answer and a kept word reached for nothing. IT DOES NOT WEAKEN THE RULE,
because the incumbent clause's real work is RULE 4's one block down — a line
that keeps its end word keeps its rhyme finding, so "nothing was fixed" refuses
it unless the revision repaired something ELSE, which is exactly the case this
guard lets through. Doctrine 7 is why it must: a line already sitting on a
conventional word may still have its METER fixed, and blocking that is the
floor ordering the region it already passed.
**THE FIELD IS STILL READ OFF `before`, DELIBERATELY** — recomputing it against
`after` was the other candidate fix and is doctrine 48, since a revision that
repairs the rhyme clears the finding, so `brief(after)` offers no field and the
rule could never fire on any accepted revision. **THE SECOND HALF CLOSES AS A
COROLLARY**: `forbidden_modal` is `modal_head + [cur]` and `cur` IS the
`before` end word, so `got == cur` now implies `got == was` and is skipped —
`modal_violations` is a SUBSET OF THE MODAL HEAD by construction, and "took the
modal candidate" is true of every entry it can hold. The skip is DISCLOSED via
`modal_endword_unchanged` and in the acceptance reasons, because "kept a
forbidden word" and "was never on the list" are different outcomes (doctrine
20). `quality/test_revise.py` §41 is 7 checks and fails exactly 2 with the
end-word test removed; its second premise is the disagreement made mechanical —
under the mutant the loop still converges while `verify` rejects.

**AND THE BRIEF WENT STALE MID-ROUND — FIXED 2026-08-16, DEFECT B, AND THE
ARGUMENT IT OVERTURNS IS STILL TRUE.** `revise_loop` briefed ONCE PER ROUND
and then walked the flagged lines proposing against that snapshot, so fixing
line X handed a LATER line Y a `must rhyme with`, a candidate field and a
`SCHEME_VIOLATION` evidence string computed against a word no longer in the
draft. `quality/loop.py`'s own docstring called this deliberate: *"`verify()`
always re-derives the true finding set for the CURRENT `lines` before
accepting anything, so a stale candidate is simply rejected rather than
wrongly accepted — correctness does not depend on re-briefing every line."*
**Every word of that is true, and it is about ACCEPTANCE. A brief is
GUIDANCE, and the argument covers none of it.**
**THE ECONOMICS CHANGED UNDER IT.** It was written when the only proposer was
the free mechanical stub, for which a rejected attempt costs nothing;
`--propose=defer:` made the proposer a person or a model. MEASURED on the
rung-1 draft: a writer following the stale field exactly burned all three
attempts twice over and the loop returned NO_PROGRESS with the line
unresolved, while the correct move was to ignore the field the harness had
just offered. And on the blind re-run the flag Y was briefed to fix had
**already been repaired by X's own answer**, with 24 offered words every one
of which would have broken the rhyme that then held.
**A LINE IS RE-BRIEFED IF THE DRAFT MOVED SINCE THE ROUND OPENED**, and a line
an earlier fix CLOSED is not asked about at all — recorded on
`RoundResult.resolved_elsewhere` and rendered `[==]`, NOT as a `LineAttempt`,
because no attempt was made and `accepted=False` would be a failure that never
happened (doctrine 79). **COST, MEASURED** on the 41-line `mandate_song`
fixture, two runs each: **30.3–30.8s before, 31.2–33.7s after (+3% to +9%)**,
with the OUTCOME BYTE-IDENTICAL both times — `no_progress`, 2 rounds, 5 lines
fixed, final md5 `ef78e300f1a9` — which is the old argument holding exactly as
it always did. Nothing is re-derived until an accepted proposal has actually
moved the draft, so a round that fixes nothing pays zero.
`quality/test_loop.py` §18 is 8 checks and fails 5 with the re-brief removed;
the 3 survivors are the two invariance controls and convergence itself, which
must hold on both trees precisely because acceptance was never the defect.

**AND THE FORBIDDEN LIST WAS TWO RULES IN ONE FIELD — SPLIT 2026-08-16.**
`brief()` built `Brief.forbidden_modal` as the modal head (doctrine 9 — do not
pass the band by reaching for the most predictable word) and then APPENDED the
INCUMBENT under a different argument entirely (*"re-proposing the word that is
already there is not a revision"*). One list, two questions, and **three
renderers labelled the whole of it doctrine 9**: `Brief.__str__`, the CLI
`brief`/`song` report, and the tier-1 writer prompt. `forbidden_modal` is the
head alone now and `forbidden_incumbent` is its own field, with every surface
naming the rule it is stating.
**THE FIELDS OVERLAP ON PURPOSE AND THE OBVIOUS PARTITION IS A REGRESSION.**
`joint_field`'s `exclude=(cur,)` never filtered the FORBIDDEN half — it builds
`drop` and uses it only for the offered `rest` — so the head contains the
incumbent whenever the word already there is genuinely modal, which is **2 of 2
briefed lines on this repo's own `MODAL_DRAFT`** (`down` at index 0, `more` at
index 1). Subtracting `cur` to make the two disjoint would stop `verify()`
rejecting a revision that moves a DIFFERENT line onto that word. What the
fields no longer do is answer for each other.
**THE `2 of 2` IS A FIXTURE, NOT A RATE, and the rate is the interesting
number — REPINNED 2026-08-16 after an adversary refuted the reading that the
overlap is why the blast radius is small.** Over the two shipped lyric fixtures
under their DECLARED mandates the incumbent is inside its own head on **10 of
18** briefed-with-field lines (55.6%), so the split moves `forbidden_modal` on
the other 44.4% — and **on the lines carrying `SCHEME_VIOLATION`, the
population this loop exists to revise, it is 0 of 8**. A line the loop is
actually working on does NOT have its end word in its own modal head, which is
what a violated pair means. So the overlap is a property of lines that are
already fine, the split changes the field on every line that is not, and the
small test churn was never evidence that little changed.
**RULE 3 READS A FIELD PER BRANCH, AND THAT IS THE LOAD-BEARING EDIT** —
`modal_hits` off the head, `modal_kept` off the incumbent, with the loop gated
on `(forbidden_modal or forbidden_incumbent)`. Gating on the head alone would
have `continue`d past every line whose only exclusion is its incumbent and
silently emptied `modal_endword_unchanged`, deleting the doctrine-20 disclosure
that had shipped hours earlier — measured, not feared.
**THREE SENTENCES WERE FALSE AND ONE OF THEM WAS MINE.** The tier-1 prompt's
`do not end L{n} on any of these` is false of a word the line KEEPS (RULE 3
asks whether one was TAKEN), so it is `do not MOVE TO`; its `Taking any one of
them is REJECTED OUTRIGHT` was true of the head and false of the incumbent, and
its single `({len(forbidden)})` summed two rules into one integer a writer
reads (doctrine 79); and RULE 3's own comment, written the same day, claimed
*"The LAST entry is `brief()`'s incumbent clause"* — false whenever the
incumbent is already modal, because the append was guarded by `if cur not in
forbidden_modal` and on `MODAL_DRAFT` the last entries are `renown` and `or`.
Nothing indexed `[-1]`, so the code was never wrong; the prose was.
**AND THE SPLIT MADE A THIRD CAUSE SAYABLE.** `candidates == []` can mean no
rhyme finding earned a field, or nothing in the lexicon answers the groups, or
**everything that answers is inside the modal head** — and the prompt
enumerated only the first two, so in the third case both stated causes were
false in the same breath. It could not be named while the head also held the
incumbent. `quality/test_revise.py` §42 is 10 checks; §2's incumbent check is
repointed at the new field, because it read `"fire" in b.forbidden_modal` and
passed for the OTHER rule — `fire`/`desire` is the canonical modal pair, so
`fire` is head[0] on its own merits and would sit there with the incumbent
clause deleted. `quality/test_verbs.py` §22's equality is now STRUCTURAL rather
than a property of its fixture, and `quality/test_propose.py` §7c gained the
`B`/`Brief` field-set guard that `PB`/`PairBrief` already had — without it a
stand-in that has not grown a field renders the new rule as an EMPTY BLOCK,
no error and no red, which is how a writer-facing rule disappears.
**TWO CLI SURFACES WERE REPAIRED IN THE SAME PASS.** The `verify` verb printed
`untargeted` and `modal_taken`, two keys `Reviser.verify` has NEVER set, and
printed neither of the two it does — so RULE 3's structured disclosure was
unreachable from the command line while `revise.py`'s comment argued it was
disclosed. And `candidates W n --modal` claimed its set is "what `verify()`
rejects a revision for taking" flat; that holds only for a line in ONE group,
because a PIVOT is enforced against the head of the INTERSECTION of its k
fields, which a one-word verb cannot state.
**AND THE SAME CONFLATION IN TWO MORE CONTAINERS — FIXED 2026-08-16,
`BACKLOG.md` §4.8.** Found by asking the audit the wider question: where ELSE
does one name carry two rules such that a report can name the wrong one.
`quality/loop.py`'s tier-1 dead end printed `"no candidates offered"` for every
path reaching `tried == 0` — MEASURED against a proposer returning `None` on a
line whose `brief.candidates` held **24 words**, so the harness took the blame
for the writer's refusal on the ordinary `revise` output path. **It is THREE
rules, not two**: nothing to propose FROM, a proposer that declined, and
`attempts_per_line < 1` — the question never put at all, doctrine 20's own
case, reachable because that is a declared coordinate with no floor. The first
two are measured on ONE run, which is what makes them two rules rather than two
namings of one.
**AND `LoopResult.unresolved` MERGED A FLAG WITH A PURSUED NOTE** against its
own field comment (*"still carrying a flag finding at stop"*), which is false
for every line `--pursue` holds open — the entire purpose of that coordinate.
SPLIT, NOT REPLACED: `unresolved` stays the UNION because that is the question
a stop condition asks, and `unresolved_flagged`/`unresolved_pursued` say WHY,
with `__str__` printing `L3 (pursued note), L4 (flag)`. **Never summed** — they
overlap on a line carrying both, measured on `_open_by_rule` at 2 + 2 = 4
against a union of 3. `quality/test_loop.py` §17 is 8 checks and needs TWO
mutations because the fix has two layers: the merged sentence and bare list
kill 5, and making `unresolved_flagged` the union again — the old false comment
made true — kills the other 2.
**AND THE MANDATE BLOCK CALLED A RETURN A RHYME — FIXED 2026-08-17, DEFECT E,
FOUND BY RUNG 3 OF THE COVERAGE EXPERIMENT.** `Brief.must_answer` is `(label,
members, [(line, endword), ...])` and carries no requirement KIND, so every
renderer printed one sentence over all of them. MEASURED on a blind writer's
draft graded against `--groups` and `--returns` together, where one flagged
line sat in a group of each: `requirement(7, 8)` and `requirement(7, 3)` are
`REQUIRE_RHYME`, `requirement(7, 19)` is `REQUIRE_RETURN`, and the prompt said
*"group C [7, 19] — this line must rhyme with: L19 ('ear')"* for all three.
That is not a looser wording, it is A DIFFERENT AND STRICTLY WEAKER
REQUIREMENT: a writer who answers with a rhyme has not returned,
`RETURN_NOT_VERBATIM` is a FLAG, and the loop then rejects the answer its own
prompt asked for. `Brief.return_groups` is the fix, populated by asking
`Mandate.requirement` — never by testing `returns` membership, which would be
a second statement of it (doctrine 1) and would mark `Return(verbatim=False)`,
a `LICENSE_REPEAT`, as something the grader does not enforce. **THE HONEST
CONSEQUENCE SHIPS WITH IT** (doctrine 20): rule 2 forbids the writer moving
the other endpoint, so where a return endpoint must ALSO move to answer a
rhyme group, no legal answer satisfies both — the prompt now says the RETURN
is what breaks and that this is a fact about the mandate rather than about
anything they can write. `quality/test_revise.py` §43 is 8 checks and needs
FOUR mutations: killing the field reds 5, reverting either renderer reds that
renderer's 1 and 3, and inferring the field from `returns` membership reds
exactly the one check that distinguishes the two — the `verbatim=False`
control.
**AND THE SEARCH UNDER IT OFFERED A PAIR THE GRADER REJECTS — FIXED
2026-08-17, DEFECT F, `BACKLOG.md` §4.9.** Found by COMPLETING rung 3's defer
session rather than stopping at the first prompt, which is the half rung 1
only reached once. MEASURED: the pair printed under *THE PAIR THE GRADER'S OWN
SEARCH IS PROPOSING* came back from `verify()` as `accepted False, new_flags
[(5, 'SCHEME_VIOLATION'), (19, 'RETURN_NOT_VERBATIM')]` — **the offer failing
the check that judges the answer**, which is doctrine 48 one layer over.
`_try_tier2` built both searches out of the PIVOT's group list and nothing
else, so `other_calls` fed a REQUIRE_RETURN group's end word into a RHYME
search (the search half of defect E, still open after the rendering half
landed) and `modal_field(w)` searched the anchor as though the shared group
were its only obligation. `_anchor_obligations` asks the mandate for both now;
a line pinned by a verbatim return is NOT SEARCHED with the group named; and
`PairBrief.anchor_calls` reaches the prompt. **THREE COUNTS, NEVER SUMMED** —
`tried`, `pinned`, `starved` — and the third was unsayable before the fold,
because `modal_field(w)` was never empty here: it returned 24 words each of
which broke a group nobody had mentioned. On rung 3's own draft the loop now
answers the planted seed correctly — `NOT ATTEMPTED — all 3 two-line group(s)
are pinned by a declared verbatim return`, draft byte-identical, no prompt
issued.
**AND THREE OF `test_loop.py`'s OWN SECTIONS WERE PINNING IT.** §5 asserted
*"tier 2 DID search (`tried > 0`), it did not bail out early"* on a fixture
whose own comment says every backtrack there breaks a real mandated pair —
both halves true, and together they said the loop was right to propose 50
pairs it would reject every time. §13 and §16 then measured the SIZE of that
doomed search and called 8 and 50 a contract. A test that measures a wrong
behaviour precisely is what keeps it. §5 now asserts the opposite and says
why; §13 and §16 keep their subjects and both numbers on the same draft with
the anchor locks removed and a NO-OP PROPOSER supplying the rejections.

**AND THE FINDING NAMED A PAIR THAT DID NOT PRODUCE THE NUMBER — FIXED
2026-08-17, `BACKLOG.md` §1.2 CLOSED.** `best_score` takes a max over k span
pairs and has carried an `Attribution` naming the winner since adversary 7;
`check_scheme` prints it through `spans_note`. **`brief` did not** — and
`brief` is the half a writer reads. `inspect()`'s findings printed two end
words and a number, which is an ASSERTION (doctrine 45), without ever
evaluating it: `go/receipt 0.579` was `go` ~ the last syllable of `receipt`.
`Reviser._attribution` appends the provenance, GATED ON `Attribution.claims`
so it fires exactly when the ordinary sentence would be false. THE GATE WAS
MEASURED, not assumed: on rung 3's 26-line draft 325 of 325 pairs carry a
note, **208** name something other than the two end words, and **4 of the 13
mandated pairs** do — so printing it always would bury the live cases under
two hundred `scored on: humming ~ coming`. Both report paths in `grade()` read
the one gate. `quality/test_revise.py` §44, 6 checks, 3 mutations, two of them
controls proving no VERDICT moved.

**THE COVERAGE EXPERIMENT IS CLOSED — 2026-08-17, 79 of 82** (78 of 83 at the ladder's close; `PROMINENCE_UNDECIDED` then left the denominator as unreachable by any draft, and the §F form seed closed `RADIF_LICENSED`)**.**
`quality/COVERAGE_PREREGISTRATION.md` §R3.8/§E. The ladder ran rungs 0-3 (2
lines, 8, 26) against a denominator of 94 in-scope finding codes, repinned to
83 reachable from the CLI writing path. **78 fired.** The 5 that did not are
blocked by what a draft CONTAINS, not by how long it is — four words-bound
(`STUB_RETURN`, `RADIF_LICENSED`, `BRIDGE_IS_A_VERSE`, `PROMINENCE_UNDECIDED`)
and one arithmetic (`QUATRAIN_LOCK` needs a line count divisible by 4). **A
longer song reaches none of them, which is the result that closes the
ladder** — rung 4 as more-of-the-same would score 78 again. Two of the five
are already proven to fire on constructed input, so the open claim is "not yet
reached by the BLIND PATH", never "unreachable". Reaching them needs a seed
that specifies a FORM (a ghazal has a radif by definition; a lead sheet
abbreviates the return) — which keeps the writer blind, and which is a NEW
pre-registration rather than another rung of this one. 11 further codes are
out of the instrument's reach for stated reasons: 8 `NC` (an API-level
experiment, named as separate), 3 scoped to the `function` verb or words-bound.
**THE 8 `NC` ARE EXERCISED — `quality/test_nc_census.py`, 7 fired and 1
declared inert.** They are still not scored into the 82, because the API is a
different instrument and folding it in would let an API result read as a
statement about the writing path. What changed is that "no claim is made about
whether they work" is retired: seven were already asserted across three
suites, `NO_TEMPO` cannot fire and is inert, and the census now answers in ONE
place so the question stops being answered from the label `NC` instead of from
the code.
**AND THE FORM SEED (§F) CLOSED THE LAST REACHABLE CODE.** The ladder could
not reach `RADIF_LICENSED` at any length; a blind writer asked for *a ghazal*
— a FORM, not a feature — returned one whose radif `turn` closes 15 of 15
mandated pairs. The same run found a message that overclaimed: the floor's
note said *"self-rhyme checking is suppressed"* while 15 `SCHEME_VIOLATION`s
fired on the same pairs. Both were correct — the floor suppresses its OWN
`REPEAT_IN_VERSE`, the mandate layer reads `repeat_licence` (15 violations at
the default, 0 at `'refrain'`, the finding unmoved in both) — and the sentence
was what claimed a settlement for a layer its module does not own. The three
remaining codes get a stated refusal rather than a run: reaching them means
dictating a line, declaring a grid the measurer writes, or asking for a bridge
that fails to contrast, and none of those still measures the writer.

**NINE HARNESS FINDINGS AND EVERY ONE WAS IN A MESSAGE OR A HANDOFF**
— six at rung 1, zero at rung 2, two at rung 3. Rung 2's null is the load-
bearing measurement: it was LONGER than rung 1 and found nothing, which is
what proved length is the coverage lever and the SPEC is the defect lever.

**`candidates` AND THE LOOP ANSWERED ONE QUESTION TWO WAYS — FIXED
2026-08-15, FOUND BY PRE-SCREENING A RHYME WITH THE WRONG LIST.** The verb
ranks by RHYME SCORE; the modal exclusion ranks by FREQUENCY over the words
the GRADER would accept. Neither said so, and the one a writer can reach from
the command line is not the one `verify()` enforces. MEASURED on `lines`: the
verb's top 7 is signs/mines/designs/shines/headlines/airlines/whines against
the loop's shines/signs/designs/vines/declines/pines — **three in common**.
The cost is not theoretical: `tinder`/`cinder` reads as fresh and is the #2
answer in its own field, and `warning`/`morning` passed the verb's screen and
the loop called it modal. `candidates W [n] --modal` now calls
`Reviser.modal_field` — the LOOP'S OWN method, not a reimplementation — and
the default output names its ordering and points at the other. §22's binding
assertion is that what the verb forbids EQUALS what `brief()` forbids for the
same word, so the two cannot drift.

**A DECLARED REFRAIN WAS BEING ATTACKED, NOT PROTECTED — FIXED 2026-08-11.**
`Mandate.returns` (the villanelle/triolet/radif machinery in
`quality/schemes.py`) was read by the REPORTING layer only
(`group_merges`'s "is this collision a declared return") and never by the
GRADER: `grade()` decided whether an identical end word was a violation with
one song-wide `rdecl.repeat_licence` switch, so a CORRECT verbatim refrain —
required by the mandate itself — was flagged as a violation under the
default setting, and `revise_loop` would have tried to "fix" a refrain that
was already right. Two changes, both required: `grade()` now asks the
mandate's own `Mandate.repeat_is_violation(i, j)` per pair before falling
back to the switch (a plain letter scheme with no declared returns is
unaffected AT THE DEFAULT `repeat_licence="unlicensed"` — and NOT unaffected
at `repeat_licence="refrain"`, CORRECTED 2026-08-13, where this sentence
claimed "completely unaffected — the fallback is exactly the old behaviour".
It is not: a MANDATED pair under a plain letter scheme is `REQUIRE_RHYME`,
whose `declared=True`/`repeat_is_violation=True` means `decided()` answers
before the fallback is ever consulted, so the switch is INERT there. Measured
on `AABB` with two identical-word pairs: `unlicensed` charges a violation
either way, `refrain` used to LICENSE it and now charges it, and the
`REFRAIN_REPEAT` notes drop to zero. The fix is not to weaken `REQUIRE_RHYME`
— that value is doctrine 3 and three test sections rest on it — but to gate
the mandate's answer on the mandate having declared any return at all, which
is what this sentence always claimed was happening. A letter scheme cannot
STATE the question: a letter has two states and the question has five answers,
so `REQUIRE_RHYME`'s True there is `schemes.py`'s default and not the writer's
declaration, and doctrine 1 says a declared coordinate is not silently
outranked by another layer's default. `quality/test_mandate_language.py` §11
pins the schemes-side facts so the fix is visible when it is made); and
`inspect()` now emits `Mandate.returns_check()` findings
(`RETURN_NOT_VERBATIM`, a flag), so `verify()`'s existing net-negative diff
— the same mechanism meter rides — can for the first time see a revision
that breaks a declared return. No new rejection rule was written for
either direction. `quality/test_revise.py` test 26, on a real 19-line
villanelle.

**TWO MORE CAPABILITIES WERE BUILT AND NEVER WIRED TO THE SPINE THEY WERE
BUILT FOR — WIRED 2026-08-11, ALONGSIDE THE REFRAIN FIX ABOVE.** Both were
found the same way that one was: asking "out of everything already built,
what is declared but unread" rather than building something new.

- **`quality/g2p.py`'s `Fallback` reaches `Lexicon.transcribe_word`.**
  `Lexicon(fallback="high"|"low")` is a DECLARED coordinate, `None` by
  default and reproducing every transcription this class has ever returned
  unchanged when omitted. Wiring it naively would recurse forever:
  `Fallback._dictionary` calls `lex.transcribe_word`, and the real
  `Lexicon.transcribe_word` is what would be calling INTO the fallback — OOV
  -> ask the fallback -> the fallback asks `transcribe_word` -> still OOV ->
  ask the fallback again. `_DictionaryOnlyLexicon` is the non-recursive base
  case `Fallback` is built to wrap: a bare view over `Lexicon.entries` and
  `Lexicon.freq_rank` (shared by IDENTITY, so it sees every entry once the
  real constructor's loops finish, without a second copy) with none of
  `transcribe_word`'s own heuristics. A second, sharper bug caught before it
  shipped: `transcribe_word`'s own boundary-apostrophe strip removes the
  trailing `'` that `Fallback._final_apostrophe` keys off to find `groun'`/
  `thro'` — passing it the ALREADY-stripped word would silently disable that
  layer, so the fallback call passes the RAW word and lets `Fallback.read`
  do its own normalization, which does not strip apostrophes for exactly
  this reason. See known gap 1, above, for what this does and does not
  close. `quality/test_g2p.py` §14-20.
- **`quality/grid.py`'s `song_function_report` joins the same `blueprint=`
  coordinate meter already rides, not a fourth parameter.** A blueprint
  section has always been able to declare `"function"` and a blueprint has
  always been able to carry a top-level `"hooks"` list, and nothing past
  `quality/fit.py` ever read either field, because `fit.py` places lines in
  bars and does not know or need to know what a section is FOR.
  `Reviser._function_findings` reads them with a new `grid.song_from_blueprint`
  (independent of `fit.py`'s own reader, matching that module's choice not
  to import this one — `fit.py` builds `Placement`/`SectionFit`, which carry
  WHERE a line sits and nothing about what it is FOR), then REBUILDS that
  `Song`'s lines with THIS DRAFT's current words before grading: `grid.py`'s
  `compare_returns`/`hook_occurrences` both read `Line.text`, and grading
  the blueprint's own stored text would silently stop reacting to every
  revision after the first (`quality/test_revise.py` test 27 proves both
  directions — a hook moved INTO the current draft is found there, and one
  removed FROM it is seen missing, even though the blueprint's stored text
  says the opposite in each case). SEVERITY: everything is a `note` except
  `HOOK_ABSENT`, which is a `flag`. The rest — `RETURN_LOCKED`,
  `BRIDGE_IS_A_VERSE`, `RETURN_LENGTH_DRIFT` and the like — are
  measurements against `POPULAR_SONG`, a labelled CONVENTION
  (`grid.FormConvention`, the same move `Meter.conventional_grouping`
  makes), not a mandate the writer declared, and doctrine 6 says a
  convention a writer is free to depart from cannot be the thing that fails
  `verify()`. `HOOK_ABSENT` is different in kind: the writer supplied the
  exact hook TEXT, and whether it occurs in the draft at all is a factual
  question with no convention in it — the same shape `RETURN_NOT_VERBATIM`
  already is. `quality/test_revise.py` test 27, `quality/test_grid.py`
  §11-15 for `song_from_blueprint` itself.

**THE BUILT-AND-TESTED WAS NOT THE REACHABLE — FIXED 2026-08-11.** Everything
above was true at the Python API: `Reviser.brief`/`.verify` and
`revise_loop` have taken `blueprint=`/`subdivision=`/`assume=` since meter
joined the loop, and song-function joined it in the paragraph just above
this one. NONE OF IT COULD BE REACHED FROM THE COMMAND LINE. `brief`,
`verify` and `revise` — the only verbs that run the loop at all — parsed
just a file, a mandate spec, and (for `verify`) targeted line numbers;
there was no `--blueprint` anywhere in that block, so a run through the CLI
was rhyme-and-floor only, silently, no matter what the library underneath
it could do. (A fourth verb, `song BLUEPRINT LYRIC`, did take a
blueprint — but called `check_song`, an older function that never touched
`Reviser`, `Mandate`, or the slop floor, so even the one CLI surface that
looked blueprint-aware never did rhyme grading either. Rebuilt 2026-08-12;
see below.) `--blueprint=`,
`--subdivision`, `--isochronous` — the same three flags `fit` already
reads — now reach all three verbs, and a run through `revise` immediately
found the gap real: the mechanical stub proposer tried to swap a chorus
word, and the loop rejected it for introducing `HOOK_ABSENT` — the first
time a CLI run of this project's own flagship verb has ever seen the
song-function layer say no. Omitting `--blueprint` changes nothing about
the rhyme/floor behaviour that already existed. WHETHER IT WAS OMITTED IS
DISCLOSED EITHER WAY, not left for a caller to notice on their own —
printed as soon as a mandate is known to exist. The one exception is doctrine
20's own case: with no mandate at all, `brief`/`verify`/`revise` REFUSE
immediately, and that refusal has to be the first thing printed
(`quality/test_verbs.py` §6 pins this), so the blueprint line is skipped
rather than printed ahead of a refusal about an entirely different layer.

**THE SAME GAP, ONE MORE TIME, IN THE SAME COMMIT — FIXED 2026-08-12.**
`quality/g2p.py`'s `Fallback` was wired into `Lexicon.transcribe_word` as
`fallback=` on 2026-08-11, tested at the Python API, and reachable from the
CLI by nothing at all: `lex = Lexicon()` at the top of `main()` never passed
it, for ANY verb. `--fallback=high|low` is now a GLOBAL flag, consumed ahead
of `cmd` itself rather than inside one verb's own argument parsing —
`Lexicon()` is built once, before any verb dispatches, so it cannot live
where `--blueprint` does. `eq_only`, on purpose: unlike `--blueprint`, this
flag sits ahead of an ARBITRARY verb's own arguments, and a space-separated
`--fallback high FILE.txt` has no way to tell "high" the value from "high" a
filename that happened to be that word. An undeclared value (`--fallback=
bogus`) REFUSES with a printed message and exit 2 — the same shape `NoMandate`
already holds — rather than a raw `KeyError` from three frames down, since
this flag now sits ahead of every verb rather than one. `quality/test_verbs.py`
§9.

**`song`'S OWN DEAD SCHEMA — REBUILT 2026-08-12.** `song BLUEPRINT LYRIC` read
`check_song`/`group_sounds`, a per-section `{"lines", "scheme"} | {"ref"}`
schema written before the bar-grid shape existed. Every blueprint shipped in
`examples/` had already moved to bar-grid (`bars`/`start_bar`/`meter`/
`function`, per-line `bar`/`beat`/`duration`) — a shape `check_song` cannot
read at all, so `song` raised `KeyError` on every real blueprint in this
repo, silently, for as long as that shape has existed; `wiring` called it
wired the whole time because import reachability is not invocation
reachability (`quality/test_verbs.py` §7, before this fix). `song` is now
`song BLUEPRINT LYRIC [MANDATE] [--subdivision N] [--isochronous]`: it reads
the blueprint through `quality/grid.py`'s `song_from_blueprint`, cross-checks
the lyric's own `[Section]` markers against the blueprint's declared
sections by name and by line count (`STRUCTURE:` — something `brief` has no
reason to do, since `brief` never sees a blueprint's section list), then
runs the IDENTICAL report `brief` prints (factored into
`lyric_harness._print_brief_report`, so the two formats cannot drift apart)
with meter and song-function joining the finding set exactly as they do for
`brief --blueprint=`/`verify --blueprint=`. MANDATE is required for the same
reason it is on `brief` (doctrine 20) — a length mismatch against the draft
REFUSES by name (`REFUSED — ...`, exit 2) rather than raising, and a bare
`NoMandate` refusal (no MANDATE argument at all) is routed to the SAME
refusal path `brief`/`verify`/`revise` share rather than printing a second,
slightly different shape of the same message. This repo's own root
`blueprint.json` is a THIRD, never-migrated schema (no `lines` array, a
single top-level `scheme` string) that neither the old nor the new `song`
can read — left alone rather than deleted or migrated, since migrating a
dead schema nothing reads teaches nothing a fresh fixture wouldn't; `quality/
test_verbs.py`'s `song` cases run against a real bar-grid blueprint instead.

**BLUEPRINT OMISSION, DISCLOSED AT THE API TOO — FIXED 2026-08-12.** The
paragraph above closes the CLI's copy of this gap (`_say_blueprint()`); the
Python API had its own, separate copy. `Reviser.inspect()` silently returned
nothing about meter/function whenever `blueprint=None` — no different, in
the returned dict, from meter having been checked and found clean. A caller
importing `quality.revise.Reviser` directly (or reading a stored/serialized
`inspect()`/`verify()` result later, without the call site in view) had no
way to tell the two apart; only the CLI's own print statements ever said so,
and only when a human was reading stdout. `inspect()` and `verify()` now
both return a `"blueprint_declared"` key (`blueprint is not None`) alongside
their existing keys. It is deliberately NOT a `Finding`: omitting an OPT-IN
layer is the ordinary case (most callers never pass `blueprint=` and have no
reason to), not a defect on the draft, so it does not belong in `whole`,
which callers scan for things wrong with the song — and being a plain dict
key rather than a new Finding code meant the ~50 exact-finding-list
assertions across `quality/test_revise.py`/`test_loop.py`/`test_g2p.py` this
fix was originally expected to touch needed NONE of them changed; the whole
sweep stayed green. `verify()`'s `fixed`/`new` diff is unaffected either
way, by construction — the key is metadata about the CALL, present
identically on both `before` and `after` when `blueprint` does not change
between them, so it cancels out of the diff the same way a genuinely clean
finding would. `brief()` does NOT surface the key: a `Brief` is a per-LINE
record and whether meter was asked at all is a whole-draft fact, so a caller
wanting it calls `inspect()` directly (its own docstring says so).
`quality/test_revise.py` test 28.

**`--returns=` — A VERBATIM CHORUS HAD NO WAY TO BE DECLARED, FOUND BY
WRITING A SONG WITH ONE — FIXED 2026-08-12.** `quality.schemes.mandate`'s
`returns=` parameter has, since it was written, been the only way to say
"these lines are the SAME LINE" — `REQUIRE_RETURN`: identity REQUIRED,
REPEAT is the requirement, not a violation (doctrine 3's second half).
Nothing on the command line could ever reach it, on any of `brief`/
`verify`/`revise`/`song`: `Reviser.mandate()` is `SC.mandate(spec,
n_lines=...)` and forwards no `returns=` of its own, so the ONLY path to
`REQUIRE_RETURN` semantics was dropping to the Python API and pre-building
a `Mandate` object by hand. The two mandate spellings the CLI already had —
`--groups=`, which builds a bare Cover defaulting every pair to
`REQUIRE_RHYME` (identity FORBIDDEN), and `--cliques`, which derives its
groups from OBSERVED rhyme rather than a writer's declared repeat — both
get this wrong for a song with an intentional refrain: a real end-to-end
run of the pipeline, on a draft with a three-times-repeated chorus, run
through `song ... --cliques`, was charged `SCHEME_VIOLATION` on its own
hook for being exactly identical, the one thing it was supposed to be.
This is not a
narrow bug in one example — it is what happens to EVERY chorus/refrain
declared through the CLI, on every verb that takes a MANDATE, since the day
`quality.schemes.mandate` grew `returns=`. `--returns=` closes it: same
syntax as `--groups=` (1-based, `;`-separated groups), but each group is
realised as a return class via `SC.mandate(groups, n_lines=...,
returns=groups)` — a fully-built `Mandate` handed straight to `rv.brief`/
`.verify`/`.inspect`, since that is the only way to get identity semantics
into them at all. Declaring the SAME chorus with `--returns=` instead of
`--groups=`/`--cliques` reports `REFRAIN_REPEAT` (a note: satisfied) where
it used to report `SCHEME_VIOLATION` (a flag: broken), on the identical
draft. `quality/test_verbs.py` §6 covers both spellings on the same
constructed pair to make the contrast mechanical rather than anecdotal.
NOTE what this does NOT fix: the mandate-INDEPENDENT slop floor's
`REPEAT_IN_VERSE` finding (`quality/floor.py`) still reports a verbatim
chorus as repeated words — it is a different question (does the draft's raw
language behave like human verse did in calibration) asked by a layer that
does not consult `Mandate.requirement` at all, doctrine 6/7's "two sources,
deliberately kept apart" holding exactly as designed. `--returns=` fixes the
MANDATE layer's misclassification; it was never going to silence the floor,
and should not.
**AND FOR THREE DAYS IT COULD NOT BE USED WITH `--groups=` — FIXED
2026-08-15, FOUND BY WRITING A SONG THROUGH THE LOOP RATHER THAN BY READING
THE CODE.** The mandate was read from ONE positional slot, so a second
spelling on the same command line was never looked at. A song with rhyming
verses AND a verbatim chorus needs both at once — `--groups=` cannot say
"identity required" and `--returns=` cannot say "these merely rhyme" — so the
paragraph above shipped a vocabulary the reader could not accept, which is the
ordinary shape of a popular song and not a corner case.
IT FAILED TWO WAYS AND THE QUIET ONE IS THE BAD ONE. `song`/`brief`/`revise`
dropped the unread flag in silence: `song … --groups=A --returns=B` was
MEASURED BYTE-IDENTICAL to `song … --groups=A`, so a declared chorus went
ungraded and the report said nothing was wrong. `verify` has a trailing
line-number positional, so the same unread flag reached `int()` and refused in
the wrong layer's words — `invalid literal for int() with base 10:
'--returns=1'`. One coordinate, dropped silently by three verbs and mis-blamed
by the fourth (doctrine 1, and doctrine 20 on a refusal naming its own cause).
Both spellings now go into ONE cover with `returns=` naming which groups are
the return classes, because a `Mandate` is the only object that holds two
requirement kinds at once. The combinations that CANNOT be expressed REFUSE
rather than pick a winner: `--cliques` with anything (it DERIVES its groups,
doctrine 14), a letter string with anything (a letter is a property of a LINE
and carries no overlapping return class, doctrine 2), and the same spelling
twice. `quality/test_verbs.py` §19, whose first assertion is a DIFFERENCE
between two runs and not a string match — byte-identical output is the only
shape that proves a silent drop. 7 of its 8 checks fail against the unfixed
reader; the 8th is why the letter string there is 16 chars for a 16-line
fixture, since `ABAB` refuses on LENGTH and would have passed against the
defect.
~~correctly and on purpose~~ — **REPINNED 2026-08-14, and only the SEVERITY
was wrong.** That the floor still SPEAKS about a verbatim chorus is right and
is unchanged. That it FAILED the draft for it was never measured, and the
premise which excused not measuring it was false: `radif_min_pair_fraction`
was carried as definitional because "this project has no corpus of radif verse
to calibrate it against", while `corpus/song/eng_*` held **1,859 items inside
this profile's own token band** — the population four of the five other
thresholds were already calibrated on. Measured: 57 of those items carry a
repetend closing ≥2 pairs and the declared 0.50 **refuses to license 54 of the
57, a 94.7% false-positive rate on canonical published verse** against the ~5%
its siblings hold to. It is also anti-correlated with its own target — it
admits two ONE-word runs (`john` 8/16 and `da` 7/11, beside the two-word `john
tod` 12/21) and charges every repetend of three words or more, 10 of 10,
Burns's six-word `a health to them that's awa` at 4/20 included. Neither density
(0.1292 vs 0.1417 median, one-word against multi-word) nor run length (FPR
70.2/82.5/86.0% at ≥2/3/4 words) reaches 5%, **so the value is NOT repinned** —
retuning with no calibration behind the new number is doctrine 58's error. The
RECURRING case is a note from that date; a run closing ONE pair recurs nowhere,
is a one-off self-rhyme outside everything measured, and **stays a flag**.
Splitting those two cost zero test churn, which is itself the evidence that
`quality/test_floor.py`'s existing assertions were all about the one-off.
**EVERY COUNT IN THIS PARAGRAPH IS REPINNED 2026-08-14, FROM ~~1,872 items /
46 carriers / 43 refused / 93.5% FPR / density 0.125 vs 0.150 / run-length FPR
60.9-73.9-78.3%~~ — commit `d362b9e`'s own figures, and not one of them
reproduces.** Three independent re-derivations agree on 1,859/57/54/94.7%, one
of them run against the tree AS OF `d362b9e` with `_strip_radif`, `_tokens`
and the corpus byte-identical to it — so the record was wrong on the day it
was written, not stale since. `quality/floor.py` had been contradicting itself
twelve lines apart the whole time: the `song` Profile declares `n_human=1859`
and that same profile's `source=` reads "1,859 items over 108 authors".
(Both of those quotes are the 2026-08-14 reading and are LEFT AS QUOTED: this
paragraph is the record of an investigation into which population 1,872 could
have come from, and rewriting its evidence would destroy the thing it proves.
The profile itself was re-adopted 2026-08-21 at `n_human=3571`, 3,571 items
over 879 authors — see `quality/RESULTS_SONG_FLOOR.md` §5·A.)
**1,872 IS reachable, two ways, and neither of them is this band** — `hi=405`
instead of 400, or a whitespace `.split()` token count instead of the
profile's own `QualityFeatures._tokens` — and under BOTH the carrier counts
stay 57/54/94.7%, so nothing about the band rescues 46/43. **46/43/93.5% is
not reachable under any defensible protocol.** It appears only at bands
nowhere near the declared one (`150–330…349`, `56–222`), and at none of those
do the record's other four figures follow; swept over every band
`lo ∈ 1..800, hi ∈ lo..3000` under three tokenizers and three pairing
conventions, NO band returns 46/43 together with the recorded run-length
profile — that profile needs 18/12/10 carriers with runs of ≥2/3/4 words and
the best any 46/43 band reaches is 15/10/8. **THE FINDING IS UNCHANGED AND
SHARPER: the false-positive rate went UP.** Nothing was tuned to bring 93.5%
back — doctrine 58 aimed at the measurement rather than at the threshold, and
the same argument that keeps 0.50 keeps 94.7%. What DOES reproduce exactly,
and is why this repin lands on the counts and not on the mechanism: the three
admitted repetends above, the Burns figure, and every repetend of ≥3 words
charged, 10 of 10.

**THE TOKENISER COULD NOT SPELL ENGLISH AS PRINTED, AND THE INDENT WAS
THROWN AWAY BEFORE ANYTHING SAW IT — BOTH FIXED 2026-08-21, BOTH FOUND BY THE
OWNER ASKING WHAT ELSE THE CORPUS IS SCORING.**
`line_tokens`'s own docstring calls it *"the ONLY definition of the words of a
line the rhyme path may use"*, and its body was `re.findall(r"[A-Za-z'\-]+")`.
That is not a narrower Latin, it is a repertoire that cannot spell this
repository's own English: Barnes's `jaÿ` tokenised as `ja` and `A-baggèn` as
`A-bagg` + `n`, Welsh printed in `eng_` files gave `tân` -> `t` + `n` with END
WORD `n`, and 43.1% of the corpus returned NO TOKENS AT ALL.
`LATIN_SCRIPT` is the declared repertoire now — measured, not guessed:
10,164,939 letters of `corpus/` inside it and **zero letters whose Unicode
name begins LATIN outside it**. FOUR SITES MOVED IN ONE EDIT
(`line_tokens`, `Lexicon.transcribe`, `token_pieces`, `readability`'s piece
filter) because half-fixing it is worse than not fixing it: with only
`line_tokens` widened the two readers DISAGREED ABOUT WHAT A WORD IS and
`line_anchors` reported a Welsh line READABLE, anchored on a spelling-out of
its own rhyme word (T-IY, EH-N for `tân`). The end-word refusal rate rises
5.74% -> 6.2611% and the direction is the point (doctrine 79): a fragment
CMUdict happened to list used to read, and the whole word honestly does not.
THREE CONTROLS SAY IT MOVED ONLY WHAT WAS WRONG — `corpus/sonnets.txt` is
0 of 2,621 lines moved and the battery is byte-identical (1064/1014/50/82
AS IT STOOD THAT DAY; the violation count is 35 since 2026-08-22 and the
other three are unchanged, so this control still reads as it did);
`data/song_endword_en.tsv` and `song_rhymepair_en.tsv` rebuild BYTE-IDENTICAL,
so the modal ban is untouched, because the words the fix reveals are words
CMUdict cannot read anyway. `letters_outside_repertoire` names the scripts
this reader does not serve, so "no words" and "a script I cannot read" stop
being the same empty list (doctrine 20). `MISSING.md` M-22.
**AND THE INDENT IS A COORDINATE, NOT WHITESPACE.** Every reader here called
`.strip()` first, so the compositor's ladder — which over `eng_*` predicts a
shared spelled rime at **6.19x**, +9.92 pp against a within-block permutation
null whose whole 20-draw range is -2.71 to -2.49 pp — reached nothing.
`line_indent` is the one definition, `load_lyric_lines(with_indent=True)`
returns it from the SAME walk, `grid.Block.indents` carries it and
`grid.indent_partition` normalises it to a shape. `audit_corpus` CHECK I is
what READS it and it CHARGES NOTHING: of 545 files with a ladder, 517 agree,
6 run opposite, 22 sit inside the null. The threshold was refused by a file —
`eng_pah_francis_lieber.txt` indents ONLY the rhyming fourth line of an ABCB
stanza, so an indent can mark the rhyme GROUP or the rhyme BEARER and those
are opposite conventions in one typography. This is the control `--cliques`
cannot be (doctrine 14): the printing is INDEPENDENT of the grader's own
graph. Nothing derives a mandate from whitespace. `MISSING.md` M-28.

**A LYRIC FILE'S APPARATUS LINES ARE `[Section]`, `---`, OR `#` — NOTHING
ELSE — CENTRALIZED 2026-08-12, CONVERGED 2026-08-13.** A `(parenthetical stage direction)` under a
section header is not apparatus to any reader in this repo: it starts with
`(`, and every line-loader here only ever excluded `[`/`---`/`#`. Written
that way it is scored as sung text — tokenized, fed to the rhyme graph,
counted toward MATTR — which is how a stage direction like "(instrumental
fade, 7/8)" ends up polluting a real measurement. A dozen readers under
`quality/` already agreed on `#`/`---`/`[...]` as apparatus — but
`quality/readability.py`'s `read_lines` and `quality/grid.py`'s
`read_marked_songs`, the two this paragraph named, DID NOT, and saying they
did is what let them keep their own spellings for a day (see below);
`lyric_harness.py`'s own CLI verbs (`brief`, `verify`, `revise`, `song`,
`density`, `graph`, `chains`, `partition`, `scheme`) were the one holdout,
each with its own inline `not startswith("[")` filter, silently missing
`#`/`---`. `is_apparatus_line`/`load_lyric_lines` (`lyric_harness.py`, near
the top) are now the one definition every verb calls — a stage direction,
or any other non-sung line, belongs on a `#`-prefixed line under the
section header it annotates, and it will be dropped exactly the way a
`--- TITLE:` line already is everywhere else in this repo.

**AND "CENTRALIZED" MEANT "A THIRD SPELLING WAS WRITTEN THAT DAY" — FOUND BY
DIFFING THE TWO READERS THIS PARAGRAPH CITED AS AGREEING, FIXED 2026-08-13.**
Both now CALL `is_apparatus_line`; neither did on 2026-08-12, and each was
wrong in a different direction. `read_lines` tested `--- ` WITH A TRAILING
SPACE, and a four-hyphen line is not `--- `: four Wordsworth epigraphs in
`corpus/song/eng_british_felicia_hemans.txt` were verse to that one reader and
apparatus to every other, `lines_countable` 151,898 -> **151,894**. The record
was ALREADY self-contradictory on this: `quality/RESULTS_HYPHEN_REFUSAL.md`,
`readability.py`'s own module docstring and `token_pieces` all said 151,894
while `test_readability.py` test 5 pinned 151,898, so the fix closed a
disagreement rather than moving an agreed number — and NO RATE MOVED, because
all four end words are in CMUdict, so 9,078/174/149/8,842 are byte-identical
and only the divisor fell. `read_marked_songs` never stripped before its test
and routed `[` through `^\[([^\]]*)\]`, so a bracket with **no closing `]`**
matched nothing, opened no block, and fell through to be scored as a LYRIC:
**133 lines in 19 files across 130 blocks, 14 of them emptied outright**
because a printer's stage direction — `[Exeunt.`, `[Drinks.`, `[Music:` — was
the block's entire content. Emptying them costs nothing measurable and the
corpus says so twice: an empty block was already ordinary here (6,187 of
182,147, 5,884 of them Persian) and none of the 14 is a chorus/burden/refrain,
so `compare_returns` — the only reader of `Block.lines` anywhere — is never
handed one. ORDER IS THE REASON THIS IS ONE CLAUSE AND NOT A FILTER AT THE
TOP: `[VERSE 1]` IS apparatus by this rule and is also the thing that opens a
block, so `--- TITLE:` must be tested first and `_MARK_RE` before the
apparatus drop. **Five `startswith("--- ")` sites still survive** —
`quality/negative_control.py`, `cym_rhyme_rate.py` (x2), `test_cym.py`,
`test_phonology.py`, all on the Welsh/negative-control path, unmeasured
because that cell owns them. `grep -rn 'startswith("--- ")'` is the whole list
and it is the check that this is finished. `quality/test_readability.py` test
5 now sweeps all 189,066 letter-bearing corpus lines to prove `read_lines` and
`is_apparatus_line` are the SAME predicate and not two that happen to agree;
`quality/test_grid.py` §23, `quality/test_song_function.py` §9.

**`--voices` — THE SAME `(...)` MEANT TWO OPPOSITE THINGS IN THIS REPO,
DEPENDING WHICH FUNCTION READ IT — FOUND WRITING IN VOICE-ATTRIBUTION
NOTATION, FIXED 2026-08-12.** The paragraph above settles what `(...)`
means at the WHOLE-LINE level (never apparatus). It does not settle what
`(...)` means WITHIN a sung line, and two answers to that had shipped at
once: `is_apparatus_line` treats a bare `(...)` line as real sung text,
while `line_tokens` (and its own separate copies in `Lexicon.transcribe`
and `quality/fit.py`'s `_chunks`) erased anything inside `(...)` before
tokenizing, on the assumption that a parenthetical is always a stage
direction. That assumption is correct for this repo's own `corpus/song/`
(196 files use `(...)` the traditional literary way — Carroll's "(We know
it to be true):", an aside, genuinely not sung) and wrong for a caller
writing in voice-attribution notation, where a whole line in parens is a
backup/group vocal and a trailing `(ad lib)` is a second voice cutting in
— both real sung words, just not the lead's. The same character sequence
is genuinely ambiguous between two traditions this harness reads text
from, which doctrine 1 already has the answer for: the reading is a
declaration, not a fact the function may assume either way.

`line_tokens`/`raw_final_token` (`lyric_harness.py`) now take a
`strip_parens=True` parameter — `True` reproduces every tokenization
either function has ever returned, unchanged. `Lexicon(strip_parens=True)`
carries the same coordinate as `self.strip_parens`, read by `.transcribe`
and by every function that already took a `lex` (`line_anchors`,
`line_readability`, `word_syllable_map`, `quality/readability.py`'s
`substitution_report`) instead of each taking a parameter of its own —
the same design `fallback=` already uses, and for the same reason: these
functions are called from deep inside `quality/schemes.py`, `revise.py`,
`relations.py` and `grid.py`, and `Lexicon` is already threaded through
all of it, so nothing upstream of `Lexicon.transcribe_word` needed to
change for `fallback=` and nothing upstream of these needed to change
either. `quality/fit.py`'s parallel meter pipeline (`_chunks` -> `read_line`
-> `fit_line` -> `fit_song`) carries its own `strip_parens=True` chain for
the same reason `fit.py` has always mirrored `line_tokens`'s tokenization
choices on purpose; `Reviser._meter_findings` passes `self.lex.strip_parens`
into it, so meter-checking a voice-attributed draft respects the same
declaration rhyme-checking it does.

`--voices` is a GLOBAL bare-presence flag, consumed the same way and for
the same reason `--fallback` is (`Lexicon()` is built once, ahead of any
verb). Declaring it builds `Lexicon(strip_parens=False)`; every verb reads
`(...)`/`*asterisk*` (never special either way) as real words from there.
Omitted, nothing changes anywhere — every verb, and `quality/
build_song_frequency.py`'s corpus-frequency-table builder, which never
opts in, keeps reading `corpus/song/`'s literary parentheticals exactly as
it always has, so the shipped `data/song_endword_en.tsv`/
`song_rhymepair_en.tsv` are unaffected by this coordinate existing.
`quality/test_loop.py` test 10, alongside test 8's `(repeat)` case, which
is now the WORKED CONTRAST: the identical text refuses one way (a stage
direction, by default) and reads clean the other (a second voice,
declared) — the same line, two readings, because it was always going to
be one or the other and never both at once.

**`MODAL_RHYME` — DOCTRINE 9 WAS ONLY EVER ASKED REACTIVELY, FOUND BY WATCHING
IT FAIL TO CATCH ITS OWN TARGET — FIXED 2026-08-12.** `modal_field`/
`joint_field` have existed since doctrine 9 was mechanized, and every caller
of them — `brief()`'s own candidate offer, `verify()`'s `modal_taken`
rejection, `_try_tier2`'s backtrack search — only ever consults them once a
LINE HAS ALREADY BEEN FLAGGED and a replacement word is being searched for.
A pair that rhymes cleanly on the FIRST draft is never asked whether the
word it landed on was the single most predictable answer to its partner,
because nothing routed a passing pair through this method at all — the
mechanism was real and it was wired to only one of the two moments doctrine
9 actually applies to. FOUND BY MEASURING, NOT ARGUING: two real songs'
worth of pairs that all passed `grade()` cleanly, checked against
`modal_field` after the fact, turned out to BE the #1 or #2 ranked
candidate for roughly half of them — nothing had ever asked, because a
first draft can reach for the predictable rhyme exactly as easily as a
revision can.

`inspect()` now asks the question of every PASSING mandated pair too: for
each `verdicts` entry with no violation and no declared identity, both
endwords are checked against each other's `modal_field`, in BOTH
directions (P(partner|call) is not symmetric — see below), and a hit earns
a `MODAL_RHYME` finding. It is a **note**, not a flag, and that is the
whole design: doctrine 7 says a floor may not order the permitted region,
and a pair that already rhymes correctly is inside that region — blocking
it outright would be doctrine 9 turning into a ranking rule it was never
meant to be. `MODAL_RHYME` joined `RHYME_FINDINGS`, so `brief()` hands back
a real candidate field for it exactly the way a flagged rhyme gets one,
making it structurally impossible to miss rather than a line in a report a
caller has to go looking for. `modal_exclusion=0` silences it the same way
it silences the reactive check — one declared coordinate, not a second
switch. `quality/test_revise.py` test 29.

**TWO MORE DEFECTS SURFACED BUILDING THAT ONE NOTE, BOTH IN `verify()`'s
OWN GATE, NEITHER NEW — HARDENED IN THE SAME COMMIT.** Wiring `MODAL_RHYME`
into a REAL loop run (not just a constructed pair) broke two of
`quality/test_loop.py`'s existing fixtures outright, which is how both were
found: measuring the mechanism against real output rather than trusting
the design on paper.

- **`verify()`'s net-new gate counted every new finding against
  `allow_net_new`, note or flag alike.** A tier-2 backtrack that correctly
  cleared a real `joint_conflict` was rejected outright the instant its
  resolving pair happened to be conventional enough to earn a `MODAL_RHYME`
  note — the exact thing doctrine 7 says a note must never do. Worse, this
  was not a new failure mode: `test_tier2_tries_and_correctly_rejects`
  (test 5) had been demonstrating a REJECTION built on a `SCHEME_COLLISION`
  note the WHOLE TIME (an unmandated incidental rhyme — "the writer's call,"
  in that finding's own message text — never a defect this loop is entitled
  to block on), and only stopped reaching SUCCESS because the same
  severity-blind gate happened to catch it for the wrong reason. `verify()`
  now computes `new_flags`/`new_notes` alongside the existing `new`, and
  gates acceptance on `new_flags` only; `new`/`fixed` stay exactly as
  reported before for full disclosure (doctrine 79 — count the two kinds
  separately, never sum what asks different things of a writer). Test 5's
  fixture is REBUILT — `SILVER_NIGHT_LOCKED`, with two extra lines that
  mandate L1 and L2 each to their OWN separate rhyme family, so backtracking
  EITHER anchor now breaks a genuine mandated pair and earns a real
  `SCHEME_VIOLATION` flag, the demonstration test 5 always meant to give.
- **The same diff collapsed MULTIPLE findings of the same code on the same
  line into ONE key, hiding a regression from doctrine or arithmetic
  fixing the SAME shape of bug as the earlier `MANDATE_GROUPS_
  INDISTINGUISHABLE` fix (`codes()`'s own docstring), just left half-done:
  that fix keyed WHOLE findings on their first line so four at once
  wouldn't collapse to one; per-line findings never got the same
  treatment.** A pivot line answering two mandated groups can carry TWO
  `SCHEME_VIOLATION` findings at once — one per group — and a revision
  trading a REPEAT-based violation on one group for a real phonetic
  violation on TWO groups still showed the identical `(line,
  "SCHEME_VIOLATION")` key before and after, so a plain set diff called it
  unchanged. `quality/test_revise.py` test 20's own NET-NEGATIVE case
  (`R.verify(..., sub(33, "...kitchen"), ...)`) was accepting exactly this
  on re-run — L33 traded one violation for two — until `codes()` was
  rebuilt to return a MULTISET (list, not set) and the diff at the call
  site switched from set subtraction to `collections.Counter` subtraction:
  same 2-tuple key shape (three call sites elsewhere in the test suite
  check `(line, code) in res["new"]` membership directly, and none of them
  needed to change), but a key whose COUNT increases now correctly shows up
  in `new` rather than cancelling out. Doctrine 47 again: a loop that
  cannot see the change it asked for is a rubber stamp in the other
  direction, and that is as true of a count as it is of a key.

**BLUEPRINT OMISSION, DISCLOSED AT THE LOOP TOO — FIXED 2026-08-13.**
`_say_blueprint()` closed this at the CLI and `blueprint_declared` closed it at
the `Reviser`. `revise_loop` sits BETWEEN those two and had a third copy of the
same gap: `LoopResult` carried `stop_reason`/`lines`/`rounds`/`unresolved` and
nothing about which layers the run actually asked, so a caller holding one —
or reading a stored one later — could not tell "meter clean" from "meter never
asked". `subdivision` and `profile` were undisclosed at every level.
`LoopResult` now carries `blueprint_declared` (READ off `inspect()`'s own key,
never recomputed from `blueprint is not None`, so the two cannot drift —
doctrine 1), `subdivision_declared`, `profile`, `whole`, and
`pairs_mandated`/`pairs_judged`/`pairs_refused` — doctrine 79's three counts,
which `grade()` has always returned and the loop discarded at the very
`brief()` call that computed them. One extra `inspect()` per RUN pays for it:
measured at 0.1s against the first inspect's 43.6s on the same draft, because
the caches are warm for the draft the loop is already holding.
**AND OMITTING `blueprint=` DROPS TWO LAYERS, NOT ONE** — meter and
song-function ride the same coordinate, and nothing said so until now.
`quality/test_loop.py` test 11.

**THE APPARATUS FILTER HAD ONE MORE HOLDOUT — FIXED 2026-08-13.** The
centralization onto `load_lyric_lines` covered `lyric_harness.py`'s verbs on
2026-08-12 and missed `quality/loop.py`'s own `__main__`, which kept only the
`[` case. A `#` stage direction or a `--- TITLE:` note reached THE FLAGSHIP
LOOP as sung text — tokenized, rhyme-graded, counted toward MATTR, and
eligible to be handed back to the writer as a line to revise. It calls
`load_lyric_lines` now.

**AND ONE MORE AFTER THAT — FIXED 2026-08-13.** `quality/relations.py`'s own
`main()` was a FOURTH site, keeping only the `[` case, so `python3
quality/relations.py FILE` and `python3 lyric_harness.py relations FILE` read
different texts out of one file. Spelled inline rather than imported: P10's
guard (`quality/test_relations.py`) requires `relations.py` to import nothing
from `lyric_harness`, and `load_lyric_lines` would be wrong here regardless —
it drops blank lines, which this module derives its stanza frame from. No
shipped corpus or fixture carries a `#`/`---` line, so no recorded number
moves. FOUR HOLDOUTS FOUND BY FOUR SEPARATE LOTS OVER TWO DAYS, each after a
paragraph in this file said the centralization was done;
~~`grep -rn 'startswith("--- ")'` and `grep -rn 'startswith("\[")'` are the only
checks that it actually is.~~ **STRUCK 2026-08-23 BY THE SIXTH SITE, WHICH
NEITHER GREP CAN SEE (`MISSING.md` M-83).** `plan --fill` read its draft with a
bare `open()` and `if l.strip()` — it tests no prefix at all, so both commands
come back clean on a tree that counts `[SECTION]`, `#` and `--- TITLE:` as sung
text. A grep for the two spellings answers "is anyone else spelling the rule by
hand", and the way the rule actually broke here was **nobody spelling it at
all**. The check that this is finished has to be a RUN: `test_verbs.py` §41
drives `--fill` on a draft carrying all three apparatus spellings and requires
it to fill, and restoring the inline reader reds exactly that check while both
its controls hold.

**AND THE RULE GREW THREE DECLARED COORDINATES 2026-08-28 (`MISSING.md`
M-47/M-27), because "starts with `[`" was reading a third of the question.**
A wrapped Gutenberg note leaked its TAIL as verse (`1818.]` the first kept
line of a Shelley song — 423 lines of editorial prose across the corpus),
and a bracketed token inside a sung line was a WORD to the tokeniser — 68 of
the 93 sized markers were END WORDS, Byron rhyming on the footnote letters
`a b c d`. The repair is DECLARED, never guessed, because the obvious
positional rule was tested and refuted (`craving[me]` is an anchor,
`to[o]` is an editor's supplied letter, same position):
`wrapped_apparatus_drops` follows an unclosed `[` row to its close in the
files that declare the convention (`WRAPPED_APPARATUS_FOLLOW` — and the two
exclusions are the warning: on Durfey and Gay the scan measurably ate sung
lines, so those files are M-152's bracketed-VERSE class instead);
`normalise_bracket_spans` resolves a span by its class — footnote anchor
(drop), `[oe]` ligature (`Ph[oe]bus` -> `Phoebus`), editor-supplied text
(`BARNE[S].` -> `BARNES.`), PG diacritic markup (`dr[=e]ve` -> `drēve`); and
the orphan caption tail (`": alun105.jpg]"`, which put `jpg` into WELSH end
words) is apparatus by content. One definition, four readers
(`load_lyric_lines`, `readability.read_lines`, `grid.read_marked_songs`,
`build_song_frequency` — doctrine 1), a draft with no file untouched by any
corpus file's convention, and `audit_corpus` check L NOTEs whatever no
declaration covers, so a newly staged Byron cannot leak in silence.
`test_readability.py` §11 runs both mutations in place; the corpus pins
repinned there carry the ladders (countable 282731 -> 282402, the
substituted split 16710+2 -> 16685+1 — the −1 being known gap 8's own
`turf,[mm]` exemplar).

**AND THE THIRD CONVENTION CLOSED THE SAME DAY — A BRACKET THAT WRAPS SUNG
TEXT KEEPS THE BODY AND LOSES THE BRACKETS (`MISSING.md` M-152).** Watts
prints whole optional hymn stanzas in brackets, Drake a quatrain, Skeat's
pantun edition its own sung colophon (split by staging across two items),
Durfey's `[Music:` cues enclose 9–38 sung lines, Carroll's "[later editions
continued" note opens a sung body, and Gay's stage directions never close —
the OPPOSITE defect from M-47's, verse read as apparatus, with each
block's opening line silently lost. `bracketed_verse_edits` -> (drops,
edits) rides beside the two rules above through the SAME four readers,
with the per-line edit applied BEFORE the apparatus test; three declared
tables (`BRACKETED_VERSE_FILES` per file, `BRACKET_BLOCK_ROWS` per block
keyed on the opener's own content, `BRACKET_LINE_EDITS` for the six
orphan brackets no scan can follow — Emmett's lost note tail, Lovelace's
printer marks and mid-line gloss, Freneau's authorial parenthetical kept
word for word), matched through ONE predicate (`bracket_block_rule`) that
check L also asks, and an import-time check refusing a file in both
follow conventions. EVERY BLOCK WAS READ BEFORE ITS FILE WAS DECLARED,
and the reading corrected the census three times (watts's "never-closing"
block closes at +8 across its own `[VERSE 4]` marker). The zero-orphan
sweep that closed the class found M-47's own scan stopping at a BALANCED
footnote anchor inside a Hemans note (`character,[399]` read as the
close) — the close row's `]` must OUTNUMBER its `[`s now, and the three
leaked lines are the whole corpus-wide delta. Countable 282402 -> 282397
(+16 recovered sung lines − 18 dropped editorial lines − 3 Hemans), with
every refusal count in §5's pins measured byte-identical — the
convention moved which lines are SUNG and moved no refusal.
`test_readability.py` §12, three table mutations hand-proven in place;
what it deliberately does NOT reach is staging: editorial text under a
bare `[VERSE n]` mark with no bracket to key on is M-153, named open.

**AND THE FIFTH SITE WAS NOT THE APPARATUS RULE — IT WAS THE DECODE, ONE LAYER
EARLIER, FOUND 2026-08-15 BY SWEEPING THE VERBS RATHER THAN GREPPING THE
PREDICATE.** The two checks that paragraph ends on find `startswith` and only
`startswith`. Underneath it three readers still disagreed about the same file:
`load_lyric_lines` decoded STRICTLY, `quality/readability.py`'s `read_lines`
carried `errors="replace"`, and the `relations` verb spelled `open(...,
encoding="utf-8")` a third time. `read_lyric_text` is the one definition now —
text mode and `f.read()`, so universal-newline translation is untouched, and
MEASURED at **0 of 279 files** under `corpus/`, `quality/fixtures/` and
`examples/` where `.splitlines()` and iterating the handle would split
differently, so no recorded line count moves (doctrine 58: the equivalence is
measured, not read off the shape of the code).

**THE COST WAS AN EXIT CODE ON SEVEN VERBS AND A NUMBER ON THE EIGHTH.**
`UnicodeDecodeError` is a `ValueError`, so `__main__`'s `except OSError` — the
handler that turns a missing file into `REFUSED` at exit 2 — never saw it, and
`chains graph density relations qafiya partition refrain` each exited **1**,
Python's own uncaught-exception code, on a file the caller mistyped. The eighth
is the one worth the commit: `readability` exited **0** and printed `countable
line ends 1   read 1   REFUSED 0   (0.00%)`. That verb's entire subject is how
much of a text could not be ingested; `errors="replace"` had it certify a
binary file as fully read, which is doctrine 48 in the headline of the report
whose job is the refusal count. AND THE COORDINATE WAS BUYING NOTHING ON THE
POPULATION IT EXISTS FOR: **0 of 269 files under `corpus/`** fail a strict
decode, so it fired on no recorded measurement and only on a caller's mistake.
`UndecodableLyricFile` is a CLASS and not one more clause on that handler
because `UnicodeDecodeError` carries the byte, the offset and the codec and NOT
the path — a clause at the top could say "not valid UTF-8" and could not say
which file, on a verb like `verify BEFORE AFTER` holding two.

**AND CATCHING IT EXPOSED THAT THIS FILE IS TWO MODULES.** Run as a script
`lyric_harness.py` is `__main__`; every module under `quality/` does `from
lyric_harness import ...`, which finds nothing by that name, RE-EXECUTES the
whole file, and binds a second, unrelated copy of every class in it — invisible
until identity is what a statement rests on, and it rests on it in an `except`.
So the new refusal was caught for seven verbs and MISSED for `readability`, the
one that reaches the reader through `quality/`, which kept exiting 1 with a
traceback whose last line read `lyric_harness.UndecodableLyricFile: … not valid
UTF-8` — the right message about the wrong class. `sys.modules.setdefault(
"lyric_harness", sys.modules["__main__"])` ahead of dispatch collapses them,
which also ends a 47.9ms double execution and a duplicated copy of every
module-level cache. §26's binding assertion is that `chains` and `readability`
refuse in BYTE-IDENTICAL text, which two module objects cannot.

**AND THAT ONE LINE TURNED OUT TO BE A REPORT FIX, FOUND BY BYTE-DIFFING ALL 28
VERB INVOCATIONS EITHER SIDE OF IT RATHER THAN BY REASONING ABOUT WHAT IT COULD
TOUCH.** 27 came back identical; `song` GAINED four lines, and they are the
loudest lines this report has. `report_pair` — *"the defect was never that the
provenance was unavailable after `best_score` recorded it, it was that a
consumer holding both printed only one"* — gates its whole disclosure on
`isinstance(sp, Attribution)`, and `sp` arrives from `Reviser.inspect`, built by
the copy `quality/` imported. Against `__main__`'s `Attribution` that test is
FALSE for a real `Attribution`, `claimed` falls back to True, and the block is
skipped. **So the defect `report_pair` exists to end came back one level up
wearing module identity, and `NAMED PAIR IS NOT THE EVIDENCE` was dead on every
verb that scores through `quality/` — `song`, `brief`, `verify`, `revise`.**
THE REPORT HAD BEEN CONTRADICTING ITSELF IN ADJACENT LINES, which is what makes
this checkable without trusting either half: `spans_note` is a plain string and
never crossed the boundary, so `MOSAIC (both sides): the winning span reaches
back past the end word` printed on all four pairs the whole time, directly
beneath the missing banner that says the same fact loudly. §27 asserts the
IMPLICATION rather than a count — every `MOSAIC` line must be immediately
preceded by the banner — and names its own population first, so it cannot pass
by examining nothing. It is a RENDERING fix and the verdict beside it is
asserted unchanged (`(counting/counting): 1.0  REPEAT`), because a number moving
here would mean the alias had done something else as well.

**AND THE FOUR REVISER VERBS NEVER TRACEBACKED ON AN UNDECODABLE FILE AT ALL —
THEY REFUSED IN THE WRONG LAYER'S WORDS**, which is worse and is why the sweep
found it and reading the code did not. `UnicodeDecodeError` is a `ValueError`,
and `brief`/`verify`/`revise`/`song`'s `except ValueError` is the BLUEPRINT/DRAFT
LENGTH MISMATCH handler, so a decode failure came out as `REFUSED — 'utf-8'
codec can't decode byte 0xff in position 0` — right exit code, right shape, and
on `verify BEFORE AFTER`, which is holding two files, **naming neither of
them.** `UndecodableLyricFile` derives from `Exception` and not `ValueError`
precisely so that clause stops catching it; §26 asserts the path is named with
the bad file in BOTH argument positions, so the check cannot pass by naming
whichever file is read first.

**AND EVERY VERB'S OWN ARGUMENTS WERE THE LAST SHAPE LEFT — FIXED 2026-08-15.**
The three fixes above close the argument shapes NO SINGLE VERB OWNED: a missing
positional, a named file that is not there, an undecodable one. What was still
open is the half each verb owns ITSELF, and it was the same defect fifteen
times: `int(raw)`/`float(raw)`/`w1, w2 = rest.split("--")`/`assert len(scheme)
== len(lines)` on text the caller typed, reaching the top as exit 1 while
`_subdivision_or_refuse` sat one screen away doing it correctly for ONE FLAG.
`candidates lines two`, `chains FILE x`, `graph FILE x`, `prasa x`, `cycle x`,
`cycle 4`, `score dawn again`, `types dawn again`, `scheme ABAB` on two lines —
all a bare traceback, all now `REFUSED … ` at 2 through `_number_or_refuse` and
`_two_sides_or_refuse`, which carry the underlying `ValueError`'s own message
through unchanged because the message was never the problem.
**TWO OF THE FIFTEEN ANSWERED AT EXIT 0, AND THOSE ARE THE BAD ONES.**
`candidates --modal=yes` was BYTE-IDENTICAL to passing no flag — `"--modal" in
args` is an exact membership test, so the `=` spelling every sibling accepts
fell through and the caller who asked for the FREQUENCY-ranked forbidden set
was handed the RHYME-SCORE list, which is the precise substitution §22 exists
to stop. And `refrain zzznotaform` printed `rhyme partition: AAABCDEFCGH` — an
eleven-line poem made of the letters of the typo — because
`REFRAIN_FORMS.get(name, name)` is a silent downgrade in a verb that prints its
own vocabulary when called bare. `meter TEMPLATE` with no lines was worse than
either: exit 0, stdout EMPTY, which in a pipeline reads as "checked, nothing
wrong" from a verb whose every line of output is per-line.
**THE FORM/NOTATION READING IS DISCLOSED, NOT GUESSED**, because the two
vocabularies genuinely overlap in shape: `refrain` now prints `READ AS: named
form 'villanelle'` or `READ AS: raw A-1 notation`, and refuses only on a
CONJUNCTION — not declared, no capital, and not an alphabet-prefix scheme.
Each signal alone is too weak, and THE RULE WAS RUN OVER THE SHIPPED VOCABULARY
BEFORE IT WAS TRUSTED: a strict prefix test refuses the rondeau's `aabba aabR
aabbaR`, whose `R` is the RENTREMENT and is a real notation. §28 asserts all
eight shipped forms still resolve, which is the check that this rule cannot
refuse one.
**AND THE AUDIT THAT RAISED THESE NINE WAS 3 OF 9 STALE AT HEAD** — `grid`,
`fit`, `song` and `function` on a MISSING blueprint, and `verify --nope`, were
already closed by `6873e20`'s `except OSError` and `6d204a7`'s flag guard.
Re-measured before anything was changed, for the reason lever 2 recorded: a
named defect can be two-thirds shut and the live third a different shape.
§28 fails 26 of its 34 checks against `be8d1ea`.

**DOCTRINE 34 CAN ONLY BE ASKED OF A FILE THE WALK HANDED OVER — FIXED 2026-08-16.** `audit_corpus.load()` reads two extensions. Anything else under `corpus/` reached NO CHECK AT ALL, so for a `.csv` or a `.tsv` the question was not answered NO — it was NOT ASKED, and the audit would report the tree clean without ever having looked. MEASURED: all 269 files are `.txt`/`.json`, so the hole is LATENT and not live, which is exactly why it survived. `EXTS` is a named constant now (an exclusion nobody writes down is a threshold nobody wrote down, doctrine 58), `unwalked(root)` is the population, and check A emits a NOTE PER SKIPPED FILE. Today that is zero, so `PINNED_SHAPE` is unmoved at 269/1/230/198 — and a planted `.csv` takes NOTE to 199 and turns `--verify-shape` red, which is what makes this a gate rather than a report.

**MY OWN TEST SECTION SURVIVED THE MUTATION, AND THAT IS THE ENTRY.** The first draft exercised `unwalked()` and `load()` DIRECTLY and never asserted that check A calls them — so stubbing the emission to `for p in []` left all five checks GREEN. A helper that computes the right population and reports it to nobody is the precise defect this lane exists to close, reproduced inside the test written to close it, and it is the same shape §29 had four commits ago: both halves tested, never the pair. The section drives the AUDIT now.

**AND THE MUTATION EXPOSED A SECOND BUG IN MY OWN FIX.** `check_row` called `unwalked()` WITH NO ROOT, so auditing any tree but the default reported the SHIPPED corpus's skipped files — the wrong population, silently. `load()` records `LAST_UNWALKED` for the tree it just walked and check A reads that, with the ordering coupling stated where it lives. Both failure modes are pinned: stubbing the emission fails a check, and restoring the no-root call fails a check.

**THE COLLISION CUT WAS ONE NUMBER WRITTEN TWICE, AND THE FINDING THAT SAYS SO WAS THE ONLY THING HOLDING IT — FIXED 2026-08-16.** `quality/revise.py`'s `COLLISION_CUT_IS_SCALAR_ONLY` states that its collision set is EXACTLY `check_scheme`'s and that "the two constants must not drift". Nothing stopped them: `revise.py` declared `THETA_COLLISION` and `lyric_harness.check_scheme` spelled a bare literal, so a lot moving either moved exactly one. A promise in a comment is not a mechanism (doctrine 1). **AND `quality/mutate.py` QR6 IS THE PROOF RATHER THAN THE WORRY** — it raises the threshold to 1.1 to check the constant is load-bearing, and against the old spelling it moved `revise.py` ALONE, leaving the two halves of the repo reporting different collision sets while every suite stayed green. One definition now, in `lyric_harness.py` because that is the layer `revise.py` imports FROM; QR6 re-anchored onto it, so the mutation that tests the constant now moves both readers at once. 57/57 mutations apply cleanly.

**AND THE THIRD `0.9` IS A DIFFERENT QUESTION AND STAYS SEPARATE.** `check_cynghanedd`'s llusg test — does a final penult rhyme an earlier syllable in the same line — carries the same number by coincidence, and binding it to this name would make a WELSH-IMITATION rule move whenever the English collision report was retuned. §31 asserts it is still its own literal, so a later lot tidying constants has to read that argument rather than rediscover it.

**AND THE FINDING'S OWN TEXT CARRIED A CLAIM THAT WENT FALSE FIVE DAYS AFTER IT WAS WRITTEN.** It said `lyric_harness.check_scheme` "carries the same untyped message and is not this cell's file" — true on 2026-08-11 and corrected that same day in `check_scheme`, which has typed its own members since. A stale deferral inside a finding whose entire subject is a claim two modules make about one set (doctrine 17). `quality/test_verbs.py` §31 is 3 checks and fails 2 with the second declaration restored; the third is the llusg control, which must pass on both trees.

**AND THE TITLE A LYRIC DECLARES REACHED NO CHECK — FIXED 2026-08-15.** `--- TITLE:` is THIS REPO'S OWN ITEM CONVENTION: `grid.read_marked_songs` parses it into `MarkedSong.title`, `audit_corpus` counts `--- TITLE:` blocks as the unit every staged file writes, and `verify_entries` reads it as the rule for what a song IS. On `song` it is apparatus, so `load_lyric_lines` drops it — correctly, it is not sung — AND NOTHING ELSE LOOKED AT IT. The title `hook_findings` grades comes from the blueprint's `"title"` key alone, so a writer who named their song the way the corpus does was graded against a title they never gave. MEASURED byte-identical, md5 `d3ca7fb536`, with and without the line.

`TITLE_NOT_IN_HOOK` IS A REAL CHECK AND IT FIRES CORRECTLY — verified on a blueprint carrying a title and a hook, on both `song` and `function`. What was broken is WHICH DECLARATION REACHES IT. `song` hands the blueprint PATH down and the title is re-read from that file, so there is no seam to carry a second one; this REFUSES and NAMES BOTH SPELLINGS rather than inventing plumbing or dropping the coordinate — the same answer `song --blueprint=` gets, and the third time this session that a coordinate declared twice and read once has been settled that way. Case alone is not a disagreement: a title is a NAME, not a token. `quality/test_verbs.py` §30 is 5 checks and fails 2 with the guard stubbed to `if False:`; the other 3 are controls — a lyric with no title line grades EXACTLY as before, and a lyric title that AGREES with the blueprint's grades normally, so the section cannot pass against a build that refuses every titled lyric.

**A SECTION BRACKET IS PRESENTED WHOLE OR NOT AT ALL — GATED 2026-08-24 (`MISSING.md` M-97).** `quality/plan.py:section_header` is the ONE builder and it puts the line count, the bar count, the METER and the pickup INSIDE the bracket: `[INTRO — 2 lines — 2 bars of 8/8, one-beat pickup]`. Flattening that to `[INTRO]` when presenting a song throws away two thirds of what the section declares, and it happened six or seven times because nothing could see it — `test_plan.py` §6 gates the RENDERER, `test_songs.py` gates the FILE, and neither reads a message. **DO NOT RETYPE A SONG.** `plan --seed=N --fill=DRAFT --out=BP` prints it; present those bytes. This is no longer a standing instruction: `.claude/settings.json` registers a **Stop hook** that runs `quality/check_render_form.py` against the turn about to be delivered and EXITS 2 — the turn is blocked and the reason comes back. Quoting a raw lyric file, which legitimately carries bare `[VERSE1]` markers, is the one escape and it is declared IN THE TEXT with `RAW LYRIC FILE`. **AND THE SAME INSTRUMENT ASKS A SECOND QUESTION SINCE 2026-08-28 (`MISSING.md` M-150): a turn presenting two or more BUILT headers must also DECLARE the run's convergence state** — an exit code in the verbs' own spelling ("exit 0", "exit 3"), or UNCONVERGED / PARKED — because a rendered song shown bare reads as FINISHED with no instrument having said so, and the working order's last step (revise to a STOP CONDITION) was the only step nothing could refuse. Disclosure, never adjudication: an exit-3 draft presented AS exit 3 passes, and a false claim is `quality/song_log.py --verdicts`' business.

**THE SONGS ARE A SERIES NOW, AND SO IS THE PROCESS THAT MADE THEM — 2026-08-24
(`MISSING.md` M-98/M-99/M-100).** Five songs shipped and nothing compared any
of them to any other; every report about them was a PASS/FAIL bit — `song`
exit 0, `revise` 0 rounds — read aloud as a judgement of quality. **IT IS NOT
ONE, AND THE MEASUREMENT IS THE ARGUMENT**: BOTH drafts of `carry_it_over`
were exit 0 with 0 rounds, the one whose lines were atmosphere stacked into
token positions and the rewrite, and NO GATE IN THIS TREE CAN TELL THEM APART.
A bit that cannot separate those two cannot support a sentence containing the
word "best".
**TWO REGISTERS, KEPT APART BECAUSE THEY ANSWER DIFFERENT QUESTIONS.**
`quality/song_record.py` -> `songs/RESULTS.tsv` banks what a song IS: the ten
pre-registered features over the committed bytes, keyed on the HARNESS COMMIT,
so a moved number means the TREE moved and the delta is attributable. The
songs become fixed witnesses and `--check` is a regression detector for the
whole quality layer. `quality/song_log.py` -> `songs/<name>.log.tsv` banks
what the VERBS SAID while a song was written — one row per (invocation, fact),
long and not wide, because an empty cell reads as a measurement that came back
zero and a fact a verb does not emit must have NO ROW.
**NEITHER GRADES.** `song_record.py` extracts features with NO SCHEME and
stops; `song_log.py` reaches every verdict through `subprocess` and imports no
grader at all, checked by ABSENCE in `test_songs_log.py` §5. The reason is
M-99: `discriminate.py` is fitted on **152 SONNETS** under a fixed
`SONNET_SCHEME` while `corpus/song/` holds **1,421** songs that calibrate the
FLOOR's song profile. Pushing a 25-line song in 8/8 through a sonnet-fitted
model and printing the number is a measurement laundered out of its domain
(doctrine 13/14), so **there is no human-vs-generated discriminator for songs
and the tables say so by having no column for one.**
**BOTH GATES ARE AIMED AT THE NARRATOR RATHER THAN THE CODE**, which is what
makes them worth the commit. `--claims` requires every comparative sentence in
`songs/README.md` to carry a `[RESULTS: <column> <song>]` citation that
resolves — an uncited superlative FAILS, and it failed on its first run
against two of my own. `--verdicts` charges every process claim — an exit
code, a stop reason, a round count, an md5, a mandated/judged/refused triple —
against a banked row. Three counts, never summed: RESOLVED, MISMATCHED and
REFUSED, the third being the genuinely unrepeatable half (a superseded draft
nobody committed), which is refused rather than passed (doctrine 20).
**AND THE FIRST RUN DID NOT FLATTER THE NEWEST SONG**, which is the whole
point of banking before claiming: `carry_it_over.txt` is LOWEST of the five on
concreteness (3.043667) and `keep_the_light.txt` LOWEST on rhyme
predictability (0.816206) — both readings against the story the session had
been telling.

**AND THE BLUEPRINT'S OWN `"title"` KEY HAD NO ENTRANCE UNTIL 2026-08-24 (`MISSING.md` M-93).** The paragraphs above settle WHICH declaration reaches `hook_findings` — the blueprint's key, and only that one. What none of them noticed is that `plan.fill_plan` wrote `"title": ""` into every blueprint the planner has ever built and no flag anywhere could say otherwise, so the coordinate the tree fought twice to route correctly could only be SET by editing the planner's output by hand. `plan --title=TEXT` is that entrance, on the same footing `--relation` and `--functions` have had since M-55: CARRIED, never sampled, and no flag still leaves `""` with `TITLE_UNDECLARED` standing byte-identically. `songs/stay_awake.txt` is the first song here to answer that question rather than report it.

**THE SIXTH ITEM IN THAT AUDIT LANE WAS ALREADY CLOSED** — `--pursue` announced on `brief`/`song` is what this session's own flag guard fixed, and `lyric_harness.py` carries the refusal (`only \`revise\` runs a loop`) dated the same day. Re-measured before anything was touched, as with every lever before it: the lane was 6 items and closed as 4 repairs, 1 already shut, and 1 — `grid.Meter.assumed` — NOT A DEFECT AT ALL.

**AND A SIXTH, IN A CLASS THAT IMPLEMENTS THE SAME COORDINATE CORRECTLY ONE METHOD AWAY — FIXED 2026-08-15.** `cym.cynghanedd(line, caesura=...)` validates against `("marked", "search")` and implements both; `cym.cynghanedd_scan(line, caesura="search")` took the same name, never read it (0 loads in the body, measured on the AST) and never validated it. So `cynghanedd_scan(line, caesura="marked")` PERFORMED THE SEARCH IT WAS WRITTEN TO REFUSE. One coordinate, two readings, in one class — doctrine 1's own case, and the same silent substitution `--modal=yes` was.

**AND THE COST IS A NULL, NOT A LABEL.** `positions_tried` exists so doctrine 19/56's inflation can be CORRECTED rather than absorbed — a search over placements needs a null under the same search. The dropped coordinate returned **k for a reading the caller had pinned to ONE placement**, so a declared reading was over-corrected against a sweep it never ran. Measured on the staged edition, which prints the gwant as `--`: `Och o'u swn!--yn gasach sydd;` is **traws under both readings, at k=15 searched and k=1 marked**; `Ust! y ffrwd,--pa sibrwd sydd?` is **sain at k=15 searched and NOTHING at k=1 marked** — a type that exists only because the boundary was swept, which is the inflation made visible rather than argued. A line with no printed caesura refuses under `marked` at **k=0**, not 1: no placement was available to try, and a 1 would correct for a test that never happened (doctrine 20/79). THE DEFAULT IS UNTOUCHED, so every recorded searched rate still reproduces — `cynghanedd_rate.py --check` and `cym_rhyme_rate.py --check` both PASS. `quality/test_phonology.py` §10k is 6 checks and fails 4 against the pre-fix method; the other 2 are controls that must pass on both trees.

**FIVE DECLARED COORDINATES WERE READ BY NOTHING — FIXED 2026-08-15, AND THE AUDIT KNEW ABOUT ONE.** A census over every `*Declaration` dataclass — 8 classes, 88 fields — is now `quality/test_declared_inputs.py` §15. Doctrine 1 says a disagreement is located in a coordinate of the tuple; a field no code reads cannot hold one, and it is WORSE than a missing setting because it reads as a knob and takes a value.

`Declaration.theta_repeat_onset` declared a THRESHOLD for a boundary decided by EXACT EQUALITY — `score()` settles REPEAT on `wa == wb` and RIME_RICHE on every channel comparing equal with no extra syllable. MEASURED before removal: the six-pair relation/score/flag report is md5 `c9b9e7bf4bd2` at 0.0, at 0.5 and at 1.0, and those two ends are the settings that would make EVERYTHING or NOTHING a REPEAT if the band existed. Removed rather than wired: the exactness is deliberate (doctrine 3, identity is not rhyme) and the repair is to stop advertising a threshold. `rhyme_constraints.Declaration.tie_break` stated a REAL rule — `_backtrack`'s stable `sorted` and `exists_k`'s first-maximum `max` both settle on the lowest index — that no code consulted, so statement and behaviour could move apart; removed as a knob and STATED AT THE TWO SITES THAT ENFORCE IT. `fit.LineFit.isochronous_positions` was written by both placement paths and read by neither: each builds its own local (`on`, `landed`/`prom_on`) and reports from it, so removing the field loses no finding.

**TWO HAD A JOB AND WERE WIRED.** `MatrixDeclaration.fitted_on` was declared when that class was written and written by NEITHER FITTER, so every matrix claimed an empty training set while `fit_all`'s own docstring warns that scoring an item that was in `items` is circular — the field that makes that CHECKABLE rather than remembered. `rhyme_constraints.Declaration.surfaces` is the sharpest: `token`/`token_span` read `Site.surface`, the ORTHOGRAPHIC form, while every declaration ever built kept the `("phonemic",)` default — verbatim the case that class's own docstring refuses for channels, *"a type that asks for an undeclared channel must be REFUSED, not defaulted"*. `read_channel` returns UNREADABLE for an undeclared surface now, and `declaration_for` PROBES surfaces the way it already probes channels.

**THE INSTRUMENT WAS WRONG TWICE AND BOTH WERE FOUND BY RUNNING IT, NOT READING IT.** First it was a regex over the raw text — and the COMMENT documenting each removal names the field it removed, so re-planting `theta_repeat_onset` as a live dataclass field left §15 GREEN. A check defeated by its own documentation is doctrine 48 with a paper trail. Rewritten on the AST, where comments do not exist. It STILL passed: `ast.AnnAssign.target` is itself an `ast.Name`, so every field counted as its own use and NOTHING could ever be dead — the check could not fail on any tree. Excluded by node IDENTITY, and only then did the mutant fail. **The corrected census immediately found `surfaces`, which the regex had missed** because the phrase "two surfaces" appears in unrelated prose across a dozen files. AND `grid.Meter.assumed` — on the audit's list — IS NOT DEAD: it is read as `getattr(m, "assumed", "")`, invisible to attribute syntax, which is why the census counts string constants as references too. Wrong in both directions, one axis apart, in the same sweep.

**AND THE TABLE THAT GATE READS ITS DATES OUT OF HAD NO PROVENANCE OF ITS OWN — FIXED 2026-08-15.** `audit_corpus.check_row` asks doctrine 34's question — does a `data/sources.tsv` row reach this file — and walks `corpus/` ONLY. Nothing ever asked it of `data/`, where the derived tables live. Ten of them carry a row anyway, BY CONVENTION RATHER THAN BY ENFORCEMENT, and an unenforced convention had exactly one hole: `data/authority.tsv`, 13,997 death-year records, reachable by NONE of the three routes — no row, no header, not even a prose mention. Every other tracked data table is reached by at least one. The file that decides what may be scored at all was the file with no provenance.

The row is written now and says the two things that make it auditable: the BUILDER (`quality/populate_authority.py`) and that the builder's INPUTS (`data/authority_src/`) are not in the repository — gitignored, never committed — so `auditable` is not read as `reproducible from this checkout`, which are different claims and only the first is true here. It also records what the table's own contents fail: 204 rows fail `trusted()` under the default strict declaration (200 `qid_only_no_date`, 4 `model_recall`) and 187 more name an undeclared dataset. Recorded rather than deleted, which is the point of a table whose rejections are as auditable as its admissions.

`quality/test_provenance.py` §12 asks the question of `data/` and reports FOUR COUNTS, never summed (doctrine 79/91): reached by a row **11**, by prose only **3** (`lyricists.tsv`, `qieyun_mc.tsv`, `sources.tsv` — the weakest route, surviving exactly as long as somebody keeps writing the path into a note), declared-not-data **11**, orphan **0**. The not-data list is DECLARED (`*.py`, `*.md`, `LICENSE.*`, `build_report.json`), so a new table that stops matching it becomes an orphan and FAILS rather than slipping into a bucket. The census uses `git ls-files` and REFUSES if it cannot read the population, because globbing would fold in the gitignored artifacts — `provenance_ledger.tsv`, `feature_cache.json`, `cmudict.dict`, `data/nltk` — which have no row BECAUSE THEY ARE NOT COMMITTED, and reporting those as defects punishes the table for working (doctrine 20). §12 is 7 checks and fails 5 with the row removed. **TWO OF THEM ORIGINALLY VANISHED INSTEAD OF FAILING**, guarded behind `if arow:` — a section that silently sheds two checks prints the same `all pass` as one that ran them, so the guard was replaced by an explicit `exactly one row claims it` check and an empty default.

**THE DATE GATE TRUSTED A SCHEME AND NEVER READ WHAT IT NAMED — FIXED 2026-08-15.** `AuthorRecord.trusted()` is `verification_source.split(":")[0] in TRUSTED_VERIFICATION`: it reads the text before the first colon and stops. Four of the five trusted schemes name authorities OUTSIDE this repo (`wikidata`, `viaf`, `critical_edition`, `printed_authority`) and have no row to reach. The fifth, `dataset_field:`, NAMES A DATASET IN THIS REPO — and its payload was never looked at, so `dataset_field:` followed by any string whatever cleared the gate that decides what may be scored at all. A check that cannot fail on its discriminating coordinate, doctrine 48, inside `quality/provenance.py`.

`resolve_dataset_field` gives the payload THREE DECLARED ROUTES — path prefix, owner, repo name — the same shape `audit_corpus.route()` uses for corpus files, and written down for the reason doctrine 1 exists: a resolution rule nobody can read is a rule nobody can disagree with in a coordinate. `REJECT_UNDECLARED_DATASET` is its OWN verdict rather than a second meaning for `REJECT_UNVERIFIED_DATE` (doctrine 79): "wikipedia is not an authority" and "this authority is real and never passed the provenance gate" are different failures and merging them hides the second inside the first's total. `require_declared_dataset` is a declared coordinate, not a hardcoded rule.

MEASURED against the shipped table. **187 of 13,997 `data/authority.tsv` rows reach no `data/sources.tsv` row** — 178 `corpus_1835/csv/authors.csv`, 9 `trister95/dbnl_bear/notebook/poezie.csv` — and every one of them passed before this. Those two datasets have no row and I cannot write one without licence research I have not done, so they REJECT and the count is REPORTED rather than asserted to be zero (doctrine 58). **NO RECORDED VERDICT MOVES**: the whole of the provenance ledger (data/provenance_ledger.tsv, a GITIGNORED build artifact — deliberately not written as a repo-path citation, because it is not one, and a claim about a file that is present in a working tree and absent from a clean checkout cannot be true in both) was replayed, 87,433 rows, and every verdict is identical; 385 `reason` cells gained the row they resolved to, which routes 2 and 3 make load-bearing because both are ambiguous in principle.

**TWO PAYLOADS WERE SPELLING DEFECTS, NOT PROVENANCE ONES, and correcting them is what kept 385 admissions honest rather than merely alive.** `dataset_field:OpenITI_metadata_2025-1-9` (213 rows) and `dataset_field:benyehuda` (2) named datasets whose TARGET ROW'S OWN NOTE declares this exact route — `OpenITI/RELEASE` says "metadata carries author death dates in AH -> dataset_field route" — and `quality/CORPUS_INVENTORY.md` independently records the OpenITI file as `metadata/OpenITI_metadata_2025-1-9` INSIDE that repo. Re-spelled with the `#subset` convention `data/sources.tsv` already uses. `quality/populate_authority.py`'s `OPENITI_RELEASE` constant was corrected in the same lot, or its next run writes the unreachable spelling straight back in — the generator, not only the artifact.

**AND THE RESOLVER'S FIRST DRAFT COULD RETURN AN ID THAT NAMED NO ROW.** It stripped `#subset` from the row ids and returned the STRIPPED string, so a table holding only `OpenITI/RELEASE#metadata` answered `OpenITI/RELEASE` — the function whose entire job is proving a row exists, handing back a source_id that is not one. `quality/test_provenance.py` §11's route-1 case caught it before it shipped, and the section now asserts the invariant over EVERY shipped payload rather than the four cases it started with. §11 is 18 checks and fails 6 against pre-fix semantics, proved by mutation; the other 12 are controls that must pass on both trees.

**AND THAT GUARD ASKED THE NARROWER QUESTION AND REFUSED A LEGITIMATE RUN — caught by the battery, fixed the same day.** The `--subdivision`/`--isochronous` refusal above was written as `bp_path is None`, which is a question about the SPELLING `--blueprint=`. `song` declares its blueprint POSITIONALLY (`args[1]`), so `bp_path` is None on every legitimate `song` run and `song BP LYRIC --subdivision N` — a command whose blueprint is sitting in the argument list — refused. Seven invocations in `quality/test_verbs.py` do exactly that; four sections went red (§16 `song exits on a flag`, §15 the repeated-name blueprint, §24 both mandate spellings, §21 the rollup) for 15 failures. THE PREDICATE IS "no blueprint reaches the meter layer", NOT "no `--blueprint=` was typed". **AND §29 — THE SECTION SHIPPED WITH THE GUARD — COULD NOT HAVE CAUGHT IT.** It tested `song --blueprint=` and `brief --subdivision` as two separate halves and never the pair, so the one combination the guard broke was the one combination it did not exercise: doctrine 48 one layer up, inside the test written to enforce doctrine 48. §29 now runs `song BP LYRIC --cliques` under `--subdivision 1`, `--subdivision 2` and `--isochronous` and asserts all four reports DIFFER — read, not merely tolerated.

**`--profile` — THE COMPARATOR EVERY SCORE IS READ UNDER — REACHED THE FOUR
GRADING VERBS FROM NOTHING, WIRED 2026-08-15.** `Reviser.brief`, `.verify`,
`.inspect` and `revise_loop` have ALL taken `profile=` since they were written,
and `_matrix` forwards it to `best_score` — the same parameter `scheme
--profile` rebinds. No CLI spelling reached any of `brief`/`verify`/`revise`/
`song`, so the one flag that changes what every number MEANS was API-only. AND
`revise` PRINTED THE COORDINATE ANYWAY: `COMPARATOR: profile=declared default`,
a report naming a setting its own caller could not set. Same shape as
`--blueprint` before 2026-08-11 — built, tested, unreachable — and the same fix:
parse it beside the other three, validate against `PROFILES` with the shape
`--fallback` has had since it was written, pass it through. `--profile=bogus`
refuses by name rather than falling through to the default weights, which is
the silent comparator substitution doctrine 1 is about.

**AND TWO COORDINATES WITH NOTHING TO BIND TO WERE ACCEPTED AND DROPPED.**
`--subdivision`/`--isochronous` are coordinates of the METER layer, and meter
rides `--blueprint`; declared without one they were consumed and ignored —
MEASURED byte-identical, md5 `202b23ce64` for `brief FILE --groups=…` with each
of them and without. That is verbatim the sentence `_no_unknown_flags_or_refuse`
already refuses on, so it gets the same answer. `song --blueprint=X` is the
sharper case and was the lane's BLOCKER: this verb's blueprint is its FIRST
POSITIONAL, so the flag had nothing to bind to — parsed, stripped by the shared
`_FLAG_NAMES` pass, never opened. Measured with a path that does not exist:
byte-identical to omitting it, exit 3 either way, so a caller who named one
blueprint and was graded against another had no way to tell. It refuses now and
NAMES BOTH SPELLINGS.
**THE AUDIT'S FOURTH ITEM IN THIS LANE WAS ALREADY CLOSED** — "a refusal blames
the mandate layer for a flag from another layer" is what `6d204a7`'s flag guard
fixed; `brief … --profile=assonance` now says `brief has no flag '--profile'`
rather than reporting it as a letter scheme. Re-measured before anything was
touched, as with the two levers before it. `quality/test_verbs.py` §29 fails 10
of its 11 checks against `e743663`; the 11th is the control that must pass on
both trees.
AND ONE OF ITS CHECKS PASSED FOR THE WRONG REASON FIRST: `--profile` REACHES
`brief` was written as `base != prof`, and against the unfixed tree the profiled
run REFUSED, so the two outputs differed and the check went green on an error.
It requires both runs to exit 0 now — a reachable comparator produces a REPORT
that differs, not an error that differs.

**A MISTYPED PATH WAS GRADED AS A LYRIC — SAME COMMIT, AND IT IS THE ONE THAT
ANSWERED AT EXIT 0.** `qafiya`/`partition` are documented `FILE|L...` and each
spelled the decision `os.path.exists(src[0])` itself, so an absent path fell
through to the LINE reading and was scored: `qafiya nope.txt` reported `L1
(txt)` — the file extension graded as the rhyme word. A wrong answer at the
success code is worse than the traceback the same typo earns on every sibling
verb. `_lyric_source` is the one definition and it REFUSES rather than picking,
naming both readings — but only for a token carrying a path marker, since the
genuinely ambiguous reading is narrower than the merely-absent one. MEASURED AS
A FALSE-POSITIVE RATE over the 450,271 sung lines of `corpus/song/` (doctrine
22, state it as an FPR and not as an argument about how paths tend to look):
**29 match, 0.0064%, and all 29 are the separator half — the extension half,
which is what a mistyped path actually trips, is ZERO.** Not one of the 29 is
sung: a `http://` URL, four Finnish dates (`22/9 1879.`), Byron's transliterated
Greek — apparatus the corpus filter did not catch. The two verbs keep their own
normalization, because they disagreed about blank arguments and that was not
the question asked.

Full sweep after both fixes: `quality/test_loop.py` (12/12, was 10/10),
`quality/test_revise.py` (29/29), and every other test file under
`quality/` — unaffected, confirmed by re-running rather than assumed clean
because the module they share a diff mechanism with had just changed.
**BOTH COUNTS ARE SUPERSEDED, MEASURED 2026-08-14 and quoted with the command
that produced them (`grep -cE '^[0-9]+[a-z]?\. '` for sections, `'^\s+(PASS|
FAIL)'` for checks, over the suite's own stdout): `test_loop.py` **16
sections / 86 checks**, `test_revise.py` **39 sections**, and
`quality/test_propose.py` — which did not exist when the line above was
written — **13 sections / 104 checks**. The two figures above are a SECTION
count doubled, not a section/check pair, so `12/12` never carried a check
count at all and the shape of the old notation is itself the reason it went
stale unnoticed.

## Commands (python3 lyric_harness.py ...)
**Run `wiring` first.** It prints which verb runs on which layer, CHECKS that
map against the dispatch and against `--help`, NAMES every one-shot runner
with the command that runs it and its own first line, and lists every
production module with no caller and no `__main__` — so "is this plugged in?"
is a command rather than an audit. A count of runners is not discoverability:
`quality/audit_corpus.py`, `quality/relations_null.py` and
`quality/ltc_overlap.py` were "standalone by design" for the whole time nobody
could find them. Doctrine 48: a principle that lives only in prose gets
followed exactly as often as someone remembers it — this round it had to be
remembered eight times and was remembered zero, so the map, the usage text and
the dispatch are now three sets that `wiring` and `quality/test_verbs.py`
require to be equal. A verb added without a row and a `--help` line is a
failing test, not something a later session notices.
declaration | score A -- B | candidates W [n] | meter TEMPLATE L... |
scheme LETTERS [--profile assonance|rawi] L... | song BLUEPRINT LYRIC
[MANDATE] | chains FILE [theta] | graph FILE [theta] | internal "line" |
density FILE | weight "line" | qafiya FILE|L... |
cynghanedd [--lang=cym|eng] "line" | prasa K L... | demo
THE QUALITY LAYER, REACHABLE SINCE 2026-08-10 (it was not, and that was the
single largest defect in the project): wiring | types W1 -- W2 [--lang=]
[--preset=] | partition FILE|L... | cycle N/D [a+b+c] | relations FILE
[--schema=] | grid BLUEPRINT |
fit BLUEPRINT [--subdivision N] [--isochronous] [-v] |
function BLUEPRINT [--function=SECTION:FN,...] [--title=T] [--hook=H]
[--rhyme-key=cmudict] | refrain NOTATION|FORM [FILE] |
brief FILE [MANDATE] | verify BEFORE AFTER [MANDATE] [lines] |
revise FILE [MANDATE] | readability FILE

Four of those shipped on 2026-08-11 and closed the gap that had reopened
underneath the quality layer:
- **`fit`** is the only verb that answers *do the words fit the bars*. The
  subdivision is a DECLARED coordinate with NO default — without one the slot
  questions refuse rather than assume a sixteenth-note grid. At
  `--subdivision 2` the 4/4 choruses of `quality/fixtures/song.blueprint.json`
  are UNSATISFIABLE and the 7/8 verses are not, because an eighth-note pulse
  subdivided twice is finer than a quarter-note one.
  **THE TIME SIGNATURE ITSELF DID NOT HOLD THAT LINE UNTIL 2026-08-14.**
  `Meter.groups` has always refused an undeclared value — "Empty means
  UNDECLARED, and an undeclared grouping is refused rather than guessed",
  raising `UNDECLARED_GROUPING` on the argument that there are 2^(n-1)
  orderings and picking one by fiat is doctrine 19's error. The `beats` and
  `unit` sitting one line above it silently became **4 and 4**, at FOUR sites
  each spelling the literal (`Meter`'s field defaults, `grid.song_from_`
  `blueprint`, `lyric_harness._grid_song`, and `fit._cycle_of`) — directly
  under a docstring reading *"A time signature. Arbitrary; nothing here
  privileges 4/4."* So half of one declaration failed safe and half failed
  silent, inside one object, and a section that declared no meter was graded
  in common time and told nobody.
  ~~`UNDECLARED_METER` closes it. THE VALUE IS NOT CHANGED, only disclosed —
  refusing outright would reject every blueprint that omits the key, and 4/4
  is a defensible reading of silence in this repertoire.~~
  **STRUCK THE SAME DAY IT WAS WRITTEN, AND BOTH CLAUSES WERE WRONG.** The
  cost of refusing was never measured before it was quoted: it is **7 inline
  test sections and ZERO shipped blueprints**, not "every blueprint that omits
  the key". And a NOTE was the wrong instrument — this session had already
  established that a warning is advisory to a human and invisible to an agent
  in a hurry, so fixing a silent default with a disclosure swaps a silence for
  a shrug. A default cannot be "defensible" under a docstring that says
  nothing privileges it.
  **THE READER REFUSES NOW.** An undeclared signature raises a `ValueError`
  from BOTH readers — `fit.from_blueprint` and `grid.song_from_blueprint`, so
  the `song` verb and the `grid` verb cannot answer differently about one file
  — and the CLI turns it into `REFUSED …` exit 2 on the path a blueprint/draft
  length mismatch already takes. `fit.AssumedMeter` is the only way past, and
  being a `_Sourced` it cannot be constructed without naming who assumed and
  why; that name is carried into `ASSUMED_METER` and into everything
  conditional on it. 4/4 is still reachable — what is gone is reaching it with
  nobody's name on it. `Placement.meter_declared`/`meter_assumed` and
  `grid.Meter.declared`/`assumed` carry the coordinate, both defaulting to
  DECLARED on purpose: writing `Meter(5, 4)` in Python IS a declaration, and
  only a reader facing an absent key cannot tell.
  **WHAT THE CHURN EXPOSED, which is the argument for taking it.** Three of
  the repaired fixtures carried a top-level `"meter": "4/4"` — **a key no
  reader reads** — so their authors had written a declaration that did nothing
  and the silent default made it look like it worked. And `test_fit.py`'s own
  "`from_song` is not a second, looser reader" caught that `grid.Meter` could
  not carry the assumption's source, so the two readers diverged; `Meter.
  assumed` closes it. Every shipped blueprint declares a meter on every
  section, so no fixture could ever have shown the default firing — which is
  why it survived. `quality/test_fit.py`'s undeclared-signature test.
- **`function`** reads `Section.function`, which is not `Section.name`: an
  undeclared function REFUSES and the harness never reads `"chorus"` out of a
  name. Three counts on every run — asked / answered / refused (doctrine 79).
  `--function=` declares one at the command line, LABELLED as a CLI
  declaration, for blueprints written before the coordinate existed.
- **`refrain`** reads the A-1 notation, where a CAPITAL is a line that must
  come back VERBATIM. `refrain villanelle FILE` catches the drifted refrain
  that the rhyme partition and the band both pass.
- **`brief` / `verify`** take `--cliques` (the song's own graph structure,
  marked `source=derived` and NOT INDEPENDENT of the grader, doctrine 14) and
  `--groups=1,3;2,4` (1-based, MAY OVERLAP) as well as a letter string. With
  no mandate at all they REFUSE and **exit 2** — doctrine 20, and a caller in
  a pipeline has to be able to tell a refusal from a pass.

## Doctrine you hold while writing

Twenty of the ninety-five, and they are the twenty that decide what gets MADE:
what the object is, what the tool will and will not say about it, and what is
worth measuring at all. The other seventy-five are in `quality/METHOD.md` and
are not less true — they are just not what you need in working memory to draft
a verse. The numbering is global and deliberately non-contiguous here.
Do not drift from these. (This section is the former **Core doctrine (do not
drift from these)** and the writing-facing part of **Doctrine additions, earned
from the first run — do not drift from these either:**, merged into one run.)

<!-- DOCTRINE-BLOCK -->

1. **Declaration tuple.** Every analysis states its assumptions:
   dialect (CMUdict General American), anchor rule, channel weights,
   thresholds. All in the `Declaration` dataclass. Disagreements are
   located in a coordinate of the tuple, never argued at large.

2. **Graph first.** The full pairwise score matrix is the primary
   object (`rhyme_graph`). Letter schemes, chains, blueprints are lossy
   projections. Maximal cliques may OVERLAP = structures with no letter
   representation (chained slant). Never rebuild a projection-first
   architecture.

3. **Band-pass, TYPED.** Identity is not rhyme. Relations: RHYME
   (graded), REPEAT (same word), RIME_RICHE (same sound, different
   word), ASSONANCE (nucleus agrees, coda does not), CONSONANCE (coda
   agrees, nucleus does not). The band inverts by context: REPEAT is a
   violation inside a verse, the requirement across chorus instances,
   licensed as radif/refrain. The conjunctive coda rule RELABELS, never
   rejects — `sun`/`much` is assonance, not a non-relation — because a
   rule that closed the leak by deleting assonance from the taxonomy
   would be a worse defect than the leak. See RESULTS_BAND.md.

4. **Four layers.** Signal (phoneme channels: nucleus/coda/onset/stress,
   scored separately). Time (BUILT, and **MUTE** — not powered, and the
   difference is the whole 2026-08-11 retraction, which this line had not been
   told until 2026-08-13. It read "BUILT and POWERED, and it found nothing",
   which is the sentence that would make a reader believe the layer works;
   `quality/RESULTS_FWER.md` has said since 2026-08-11 that **the layer is not
   measurable, it is MUTE**, and marked P1/P2/P4 VOID. A null from a powered
   instrument and silence from an instrument that cannot fire are different
   results, and doctrine 20 is the doctrine about not collapsing them.
   quality/time_layer.py, RESULTS_TIME.md, RESULTS_FWER.md. Placement of
   rhyme against a metric period, phase-invariant and self-normalizing,
   with family-wise error control across each position's candidate family
   (median 89 on a quatrain, 156-282 across 24 sonnets — MEASURED 2026-08-13,
   median 203; 176-265 is the same statistic over sonnets 1-8 only; "~15" was
   the SCORED family and is amended at doctrine 29).
   ~~Saturation 6-16%.~~ **REPINNED 2026-08-13: 6-16% is `m` = SCORED and was
   struck VOID at RESULTS_FWER.md's own P1 row on 2026-08-11 — this file went
   on quoting it un-struck for two days. At the honest candidate family
   saturation is 0.0%, 18 of 20 real sonnets return `cannot tell` and the other
   2 return zero events.**
   The standing record of what that layer does and does not
   license is METHOD § Time layer.
   ~~Still no beat grid — there is no audio, so isochrony is an assumed
   coordinate, not a measurement, and "on the beat" is not a claim this
   project can make.~~ **AMENDED 2026-08-23 BY OWNER RULING, AND THE
   RULING IS PERMANENT: AUDIO IS NOT IN THIS PROJECT'S VOCABULARY.** The
   owner's words: it is entirely unnecessary, it will never be supplied,
   and the recurring reflex of proposing it was poisoning the reasoning —
   three sessions cited "without audio" as if audio were the missing
   instrument, when COUNTING is the instrument: `word_syllable_map`
   counts syllables, `fit.py` answers satisfiability against a DECLARED
   meter, and the composition grammar recovers meter from text. The
   rule's refusal is unchanged and restated in the only terms it ever
   needed: **no beat grid without a DECLARED tempo/meter — an INFERRED
   grid is refused, and the declaration is the one and only route in.**
   Isochrony remains an assumed coordinate unless declared; what is
   struck is audio as the contemplated alternative source, everywhere,
   forever). 
   Perception (theta is a function: per-genre theta_chain, promotion
   licensed only by declared meter). Value (cliche pairs, shared-suffix
   stem check, REPEAT flags; doggerel = value failure, not rhyme type).

5. **Weights are `fitted: false`.** Hand-set, and they stay that way:
   the Hirjee-Brown path has now been walked (quality/fit_matrix.py)
   and its answer is that it buys nothing. Do not tune by single
   examples — accumulate, then fit — and if the fit does not beat the
   hand-set weights held-out, do not ship it because it is fancier.

6. **No weighted quality score, ever.** The features stay a vector. The
   exchange rate between surprise and clarity is not derivable; it is a
   genre's answer, so it belongs in a declaration, not in a constant.

7. **Rejection, not selection.** Detecting bad writing held-out at AUC **0.960**;
   ranking good writing at **0.723**. Enforce a floor, do not order the permitted
   region. REPINNED 2026-08-22 from ~~0.964~~ / ~~0.717~~ — `MISSING.md` M-31,
   a stale out-of-vocabulary sentinel left behind by the frequency-source swap,
   which had feature 10 scoring an unknown word as commoner than 60% of
   English. The gap goes ~~0.247~~ **0.237** and the argument is untouched.
   The two per-feature falls are larger and are recorded as a DOWNGRADE, not
   softened: `content_word_freq_mean` on human-vs-generated ~~0.807~~ 0.707 and
   `wi_freq_delta` ~~0.639~~ 0.544, because under the stale sentinel that
   feature was partly measuring an out-of-vocabulary RATE, which tracks the
   label, rather than the rarity it names. Also REPINNED 2026-08-14 from
   ~~0.971~~ / ~~0.709~~, which were the
   PRE-OOV-FIX reading of 2026-08-09 and have been superseded TWICE: pre-fix
   0.709/0.971, warm post-fix 0.659/0.975, cold 0.717/0.964, and cold with the
   sentinel corrected 0.723/0.960. The pair is
   `quality/test_discriminate.py`'s `abs_exp1`/`abs_exp2` joint AUCs. **The
   argument is unchanged and the gap is what carries it** — 0.237 today, 0.247
   before the sentinel fix, 0.262 pre-fix, so rejection
   still beats selection by a quarter of an AUC and this doctrine never rested
   on the third decimal.
   **AMENDED 2026-08-22 — `MISSING.md` M-32, by owner ruling, and it moves
   neither number in this doctrine.** `content_word_freq_mean`'s preregistered
   cell said **LOWER** and glossed it *(rarer words)*, which are opposite
   claims about a frequency RANK; the owner ruled the gloss was the
   commitment. The feature's declared direction is now `higher`, so its
   Experiment 2 verdict goes `WRONG SIGN` → **HIT (FDR)**, the headline hit
   count 4/10 → **5/10** and the wrong-sign count 5 → **4**. No AUC moves —
   the permutation test is direction-free and the joint classifier fits on raw
   values — so 0.960 / 0.723 and the 0.237 gap are the same figures either
   side of the ruling. The DOWNGRADE above is unaffected and stands: the AUC
   did fall from 0.807, and a feature can be a hit and a weaker one at once.

9. **Optimizing toward the phonetic maximum is the slop direction.** Handing a
   model "L2-L4 below theta" makes it reach for the highest-scoring rhyme,
   which is the most predictable one. A revision protocol must push away from
   the optimum: pass the band, but not by taking the modal candidate.

24. **When a rule would delete a category, make it RELABEL instead.** The
   conjunctive coda rule exists because `sun`/`much` has an identical nucleus
   and no comparator can stop a strong channel buying a weak one. Written as
   "rhyme requires the coda to match" it would have deleted assonance,
   consonance, oblique and slant rhyme from a harness built to represent them.
   Written as a type — nucleus-only is ASSONANCE, coda-only is CONSONANCE —
   it closes the leak and the vocabulary grows from three names to five. The
   test of such a rule is whether the harness can say MORE afterwards.

32. **A corpus is defined by the property under test, not by a genre or a
   language.** The replacement for the deleted rap arm is "forms in which
   sound-repetition is constrained to fixed metrical positions", which spans
   nine language families (quality/POSITIVE_CONTROL.md). Proposing "a second
   rap corpus", and then one tradition swapped for another, was doctrine 8
   broken twice over: single source AND single language. No tradition
   conceptualizes the property the same way, which is the reason to take many
   rather than a reason to pick one.

34. **Every corpus file must have a row in data/sources.tsv, including the
   local ones.** verse.txt sat in the repo from the first import, was never
   declared, was never run through the provenance gate it would have failed,
   and carried an entire experimental arm. Fixtures, generated text and
   PD downloads all now carry rows -- a file with no row is the defect.

37. **Test a phonology against its tradition, not against its own rules.** A
   syllabifier that satisfies only its author is untested. Kalevala lines that
   are known to alliterate must alliterate; canonical regulated verse that is
   known to rhyme must rhyme. That check is what caught the Finnish hiatus
   apostrophe: `saa'ani` was unreadable, so a line that alliterates reported
   that it did not.

44. **The blocker is not always difficulty.** Welsh was listed as blocked on
   transcription from the first commit; it turned out to be as cheap as
   Finnish once someone looked -- near-phonemic, eight digraphs, penultimate
   stress, an afternoon. What is actually blocked is the TEXT. Separate
   "hard to build" from "cannot obtain" in every gap entry, because the two
   have completely different remedies.

45. **Give a form's checker the language of the form, and make the language a
   coordinate.** check_cynghanedd now defaults to `cym` because cynghanedd is
   Welsh; `--lang=eng` keeps the CMUdict path for English imitation and says
   in its own output that it IS an imitation. Every result declares which
   phonology produced it. A checker that silently picks a phonology is making
   a claim it never states.

46. **A function-word list is part of a phonology, not an optimisation.**
   Welsh penultimate stress makes every monosyllable stressed, so without a
   PROCLITIC list cynghanedd lusg "answers" the definite article `y`. The
   English engine has always had WEAK_ALWAYS for the same reason. Any new
   language needs its own before its prominence rule means anything -- and the
   list changes what a skeleton IS: a half-line ending in a proclitic has its
   last stress on an earlier word, which is an edge case that silently swept
   the final coda into the skeleton until a test line hit it.

47. **A revision loop that only checks the line it was told to fix is a rubber
   stamp.** The three ways a revision goes wrong are all silent: it fixes the
   rhyme and breaks the scheme elsewhere, it fixes the rhyme by taking the most
   predictable word in the field, or it quietly rewrites lines nobody asked
   about. verify() diffs the whole finding set, enforces the modal exclusion,
   and refuses changes outside the targeted lines. Accepting on "the flagged
   finding is gone" would pass all three.

48. **Doctrine 9 is only real once it is mechanical.** "Push away from the
   optimum" sat in this file as a sentence for the whole project. It is now a
   number -- modal_exclusion -- and an enforcement: the brief names the most
   frequent band-passing candidates as FORBIDDEN and verify() rejects a
   revision that takes one. A principle that lives only in prose gets followed
   exactly as often as someone remembers it.

62. **The tradition frequently states the rule you were about to invent.**
   Snorri's own Háttatal prose supplies two things a modern summary omits, and
   both are load-bearing: that the ONSETS MUST DIFFER for a hending to count --
   which is doctrine 3 written in the 1220s -- and a málfylling list of
   function words, which is doctrine 46 attested rather than assumed. Without
   the second, Snorri's own line 5 reads as three vowel-initial words and his
   own stanza reports as malformed. Read the tradition's own statement of its
   rules before writing a checker for them; the primary source is a spec.

85. **An express NON-COMMERCIAL grant is a rejection, and it has to bind the
   same way in every language.** 4,347 ci and 734 樂府 were located, extracted,
   validated at 99.03% character coverage and measured against 311-year-old
   ground truth — and then refused, because the digitiser's grant quoted inside
   the files is `資料自由使用，但不得為商業用途`. This repo had ALREADY rejected
   `irfanzainudin/pantunis-data` for a quoted non-commercial restriction on the
   OTA layer, and CELT before it. Admitting Chinese on terms that refused Malay
   would make the gate a function of how much the corpus was wanted. The ci half
   fails twice over: its stated base is 唐圭璋's 《全宋詞》 (1940) and he died in
   1990, so life+70 runs to 2060 — and the sourcing cell's own measurement shows
   his PUNCTUATION is the signal (45.2% rhyme agreement at 。-ends against 2.7%
   at ，-ends and a 2.8% matched null), so we would be building ON the
   in-copyright contribution rather than around it. What survives is 花間集,
   500 songs, whose own last line is 王鵬運's 1893 四印齋 colophon and whose
   chain quotes no restriction at all. **Record the unblock route in the same
   breath as the refusal**: kanripo/KR4j 白文 (文淵閣四庫全書, 1782) segmented by
   the 欽定詞譜 (1715) ~~reaches the same corpus~~ with no living copyright
   anywhere.
   **THE ROUTE IS NO LONGER PROSPECTIVE AND THE CLAUSE WAS WRONG — REPINNED
   2026-08-21, `BACKLOG.md` §3.1 / `K-7` CLOSED.** It is BUILT: **10,029 ci
   across 687 詞牌 in 66 `corpus/song/ltc_siku_kr4j*.txt` files**, segmented by
   `data/qindingcipu_ge.tsv`, 70 `data/sources.tsv` rows — **2.3× the 4,347
   this doctrine refused**. And it does **not reach "the same corpus"**: §3.1's
   close states *"the refusal still stands and the build re-acquires none of it
   by any door."* It reaches a DIFFERENT and admissible corpus. Doctrine 92,
   one paragraph down, is the correct frame for the pair — the admissible
   source and the complete source are disjoint here, and an unblock route is
   worth recording precisely because it is a different set, not because it
   recovers the refused one.

92. **The admissible source and the complete source can be DISJOINT sets.**
   Doctrine 44 separated "hard to build" from "cannot obtain". This is a third
   category and the remedy is different again. The Gītagovinda's rāga and tāla
   headings — the named-air field this whole round was chasing — are built,
   digitised, GitHub-indexed and one `curl` away, verified present (25
   `gīyate`, 5 `rāgeṇa`, 9 `tālena`, HTTP 200). They are CC BY-**NC**-SA, so
   they are refused, and the copy that is admissible is the copy that dropped
   them. Neither difficulty nor reachability is the blocker; the two properties
   we need simply do not co-occur in any one file. A gap entry has to say which
   of the three it is, because "find a better source" is the answer to only one.
   Same round, second instance: `Guy-Bilitski/rcc-data` carries the root and
   commentary with **no licence file at all**, and silence is not permission.

<!-- /DOCTRINE-BLOCK -->

## House rules
Never abbreviate project names: Codex Musica, Pantheon Registry,
Deus ex Homine, Chocolate Secrets. No artist/producer names as
descriptors in any generation-facing output — era+region+technique.

## Test discipline

**DOCTRINE 48 TURNED ON THE SUITES THEMSELVES — SEVEN CHECKS THAT COULD NOT
FAIL, FIXED 2026-08-15.** Every one was found by MUTATION or by AST, never by
reading, because a check that cannot fail reads exactly like a check that
passes. The two worst were the two that named the strongest claims in their
own sections:

- **`verify`'s TARGETED line list was parsed and never read.** Every `verify`
  call in `quality/test_verbs.py` handed the SAME path in as BEFORE and AFTER,
  so nothing changed, so `targeted` — which gates only the "you touched a line
  nobody asked you to" rejection — could not fire whatever it held. MEASURED:
  `targeted = None` in `lyric_harness.py` left the whole file at rc 0, 0
  failures. §19 now drives a REAL one-line revision on an UNTARGETED line and
  requires the same diff to reach OPPOSITE verdicts with and without the
  trailing list (ACCEPTED against `REJECTED … [4] were changed but not
  targeted`); the mutant now fails 2 checks.
- **The tier-2 prompt's end-word invariant examined ZERO claims.** It scanned
  for two literal phrasings — `(ends on 'X')` and `L<n> could end on instead
  of 'X'` — that the 2026-08-14 fix had REMOVED, so `bad == []` meant "nothing
  to inspect" and read as "nothing wrong": doctrine 20 inside a test.
  Re-planting the exact defect it is named after left the whole propose suite
  green. Keyed on the VERB FORM now (`ends on` / `ending on`, present
  indicative — `to end on` and `could end on` are proposals and stay
  unmatched), attributed by position so a claim written anywhere in the prompt
  is charged to the right line, and it RETURNS ITS OWN DENOMINATOR. The
  section asserts the count as well as the verdict, and since the honest count
  today is ZERO — the rendering claims nothing, which is the stronger property
  — a **planted** misstatement is fed to the scanner in the same section to
  prove the guard is alive. The non-vacuous half is new: the two words the
  prompt prints must DIFFER from what their own lines currently end on, which
  is what "these are the proposal, not the status quo" means, checked on every
  prompt a real loop generates.

The other five: an assertion whose condition was `8 == 2 * 2 ** 2 and 50 == 2
* 5 ** 2` — no Name, no Call, no Attribute, unmovable by any change to this
repository — while naming the claim that the tier-2 bound tracks a DECLARED
coordinate (test 13 now hands test 16 its measured `(width, count)`, so both
runs are read); `rc == 0 and "group B" in out or "group A" in out`, which
Python groups so that the exit code is enforced by nothing (True at rc 0, 1,
2, 3 and 4 alike) and whose named clause is unreachable because the command
declares ONE group; `candidates --modal`'s "this is not a relabelling",
comparing a 7-word list to a 6-word set so `!=` held on CARDINALITY and a
literal truncation mutant passed it; `function`'s only CLI-rendering
assertion for the return comparison, satisfied by static explanatory PROSE
about a different finding, so deleting the whole rendering left the section
green; and `gm_edges <= {...}`, where `set() <= anything` is True, so a merge
detector that recovers NOTHING satisfied the one assertion naming its recall.
**THE INSTRUMENT IS THE CHECK THAT THIS IS DONE**: an AST sweep for `check()`
conditions containing no Name, Call, Attribute or Subscript node reports
**6 of 656** here against **7 of 647** at `945ac41`, and all 6 survivors are
the True/False arms of `try/except` refusal blocks in `test_revise.py`, which
are legitimate. Five of the seven are pinned by a production MUTATION that
the repaired check now fails and the old one did not.

- `python3 battery.py` — sonnet oracle (152 sonnets, ABABCDCDEFEFGG),
  Lear limerick known-answers, Whitman **legacy** comparator.
- `python3 quality/suite_sweep.py` — **IS THE WHOLE SUITE TREE GREEN, AND
  WHERE DOES THE TIME GO?** Added here 2026-08-22 for the same reason
  `negative_control.py` was added the day before: this list is the one place a
  reader looks, and it named neither sweep. Three counts never summed — PASS,
  FAIL, and **CANNOT RUN**, which is a bound or a crash and is never added to
  PASS. It replaces a shell loop that had been rewritten from memory every
  sitting (standing rule 3), and that loop's own defect is the reason the
  module exists: it printed `FAIL(0 rc=124)` for a suite its `timeout(1)` had
  killed, so a suite that RAN OUT OF TIME rendered exactly like a suite with a
  red check in it. **Over an hour**, and every suite's runtime prints beside
  its verdict — five suites carry 3,265s of it. A before-you-push command, not
  a per-commit one; `--only` asks a subset.
- `python3 quality/pin_sweep.py` — **WHICH COMMITTED FIGURES DOES THIS WORKING
  TREE MOVE?** (`MISSING.md` M-21). Runs every pin-holding instrument's own
  `--check`. HOLDS / MOVED / CANNOT RUN, never summed; repairs nothing, and
  `test_pin_sweep.py` asserts on the AST that it cannot. Also over an hour.
  **Its first full run found 30 pin-holding files against 23 named in CI — 5
  pins asked by nothing that gates.**
- `python3 quality/negative_control.py` — **THE NEGATIVE CONTROL, and it is
  not Whitman.** Added here 2026-08-21, because this list is the one place a
  reader looks for this project's controls and it named only the retired one.
  Built 2026-08-11 (`MISSING.md` K-2/K-3, `BACKLOG.md` §3.5): the negative is
  `line_permutation` over the positive corpus's own quatrains — matched by
  construction — against a multi-author positive of 4,217 quatrains from 712
  of the 1,297 `eng_*` files across 9 tradition groups. **Whitman is retained
  as a LEGACY arm and is explicitly not the control**, because
  `corpus/whitman.txt` carries the property under test as epistrophe and was
  never eligible for the role (`K-3`, still OPEN as a finding).
- Current baselines: sonnets **1.2% violations (12/1014 JUDGED pairs)** —
  MEASURED 2026-08-25, not recalled: `python3 battery.py` prints
  `mandated 1064, judged 1014, refused 50` and `violations 12`.
  **REPINNED 2026-08-25 from ~~3.5% (35/1014)~~ when ALL 77 SCHEMAS joined
  the DEFAULT on the owner's ruling (`MISSING.md` M-116): a mandated pair
  that declares no relation is satisfied when its lines stand in ANY schema
  the vocabulary names, judged by ONE shared function —
  `relations.whole_vocabulary_pairs`, consulted by `check_scheme` and
  `quality.revise.grade` alike. One-directional by construction, measured
  per pair: 23 STOPPED violating, 0 newly violate (chain rhyme 16, internal
  rhyme 11, consonance 10, assonance 3, multisyllabic 2, anaphora 2,
  additive 1, subtractive 1 — a pair can carry several). REPEAT is still
  excluded (doctrine 3) and laziness at these relations is UNCALIBRATED,
  disclosed per pair in `pairs_schema_satisfied` and in the report's
  `SCHEMA DEFAULT` line. The earlier ladder, kept visible (doctrine 17):**
  **REPINNED 2026-08-22 from ~~8.1% (82/1014)~~** when the default admit set
  widened to all four relations (`MISSING.md` M-59, owner ruling). The
  superseded ladder stays visible (doctrine 17): ~~82/1014 = 8.1%~~,
  ~~73/1014 = 7.2% before `theta_coda` was calibrated 0.60 -> 0.80 on
  2026-08-11~~, ~~35/1014 = 3.5% pre-band~~, ~~81/8.0% on 2026-08-11~~.
  **WHICH LAYER MOVED: the DOOR, and only the door.**
  `mandated`/`judged`/`refused` are unchanged — a refusal is an ingestion
  verdict reached before any comparison — and the movement was measured as
  one-directional per (sonnet, line_i, line_j): **47 pairs STOPPED violating,
  0 newly violated**, being **38 CONSONANCE and 9 ASSONANCE**. Not one is
  `NO_RELATION` and not one is `REPEAT`; the door still refuses both, which
  is why 35 is not 0.
  The new figure MEASURES EQUAL to the old pre-band figure, and the 47 show
  why: the conjunctive band's entire contribution to the sonnet violation
  count was pairs it demoted from RHYME to a near relation, and the two-name
  door converted that demotion into a charge. The band's work survives — all
  47 are still TYPED and `types` still names them — what stops is the charge.
  ~~"The rise is the typed residue"~~: the residue is the point now, not the
  price. love/prove and its class are CONSONANCE in the declared General
  American dialect, which is correct, is named, and is no longer charged.
  Report **refused, judged and mandated as three separate counts, always** —
  50 of the 1064 mandated pairs are REFUSALS, end words absent from CMUdict,
  and charging them to the comparator is the triage rule two items below this
  one broken in the headline number (doctrine 79).
  Whitman **10.7%** chained at theta 0.82 — MEASURED 2026-08-13, and
  `battery.py` prints it: `lines captured in chains: 16 (10.7%) across 7
  chains`, over 150 free-verse lines.
  REPINNED 2026-08-13 from 17.3%, which this file asserted as "MEASURED, and
  `battery.py` prints it" and which `battery.py` had stopped printing — the
  claim was wrong by 6.6 points in the one place the sentence invites a reader
  to check it. 17.3% was itself measured 2026-08-11; the recorded 20.0% and
  18.0% are older still, the PRE-`b1d7f64` comparator's, reproducing exactly
  at head alignment with `theta_coda` 0.60 and in no other cell of that 2x2.
  So **four of the five Whitman figures in this repo's record are a comparator
  that no longer ships**, and the count has grown once since it was written.
  Doctrine 58, one axis further out — **a rate is a coordinate of the
  COMPARATOR**, and a rate quoted with the command that prints it goes stale
  the moment the comparator moves, silently, because nothing re-runs the
  command. 26.0% band-OFF is comparator-invariant and still reproduces, which
  is the check that it is the same statistic.
  RE-VERIFIED 2026-08-13, and **the +9.3 does not reproduce.**
  `python3 quality/audit_band_control.py 200` (seed 20260810) prints band OFF
  `R_obs 26.0%, null median 19.3%, excess +6.7 pp, p 0.0547` and band ON
  `R_obs 10.7%, null median 5.3%, excess +5.3 pp, p 0.0199`.
  THE CONTROL ON THE CONTROL, and it is what makes this readable: the band-OFF
  row reproduces TO THE DECIMAL on both corpora — Whitman's null 19.3/8.7/27.3
  and the sonnets' 29.9/25.5/35.6, +23.6 pp over the null MEDIAN and +17.9 pp
  over the null MAX, at the full n=200. So the null machinery is demonstrably
  unchanged and every figure that moved is downstream of the band-ON comparator
  alone.
  CORRECTED 2026-08-14: this sentence read "+23.6 pp and +17.9 pp over the null
  max", attaching ONE label to TWO statistics — and it did so twenty-five lines
  above the paragraph that warns, in this file, about exactly that conflation.
  +23.6 is over the median (53.5 − 29.9); only +17.9 is over the max
  (53.5 − 35.6). Found by `audit_band_control.py --check`, which now prints the
  two under separate labels so the report cannot restate the ambiguity.
  **The band's effect on the separation is +6.7 -> +5.3 pp — MEASURED
  2026-08-13.** REPINNED from +6.7 -> +9.3 pp (MEASURED 2026-08-11, the
  17.3%/8.0% comparator), which had itself superseded +6.7 -> +3.3 pp
  (MEASURED 2026-08-10, pre-`b1d7f64`).
  **THE SIGN DOES NOT FLIP — IT FLIPPED BACK.** The separation FALLS when the
  band goes on, the same direction the 2026-08-10 record had, because the
  observation falls 15.3 pp and the null median falls 14.0 pp together. So
  doctrine 71's own sentence — a filter that lowers chance and signal together
  has not tightened anything — HOLDS on this text again. THE INSTRUMENT IS
  FINE AND ONLY THE WHITMAN COMPARISON IS EMPTY: the same statistic under the
  same null moves the SONNETS +23.6 -> +27.6 pp (53.5% -> 48.9% against null
  medians 29.9% -> 21.3%), with p at the 0.0050 floor in both arms. The band
  widens the separation on the positive corpus and narrows it on the negative
  control, which is what a working filter looks like. And the 2026-08-11
  amendment that retired it is the figure that went stale. Three comparators,
  three answers, one text: the clause that caught this is doctrine 58 one axis
  out, **re-run the control when the COMPARATOR moves**.
  Nor does the control clear its null at the floor: p 0.0199 at n=200,
  REPINNED from p 0.0050 — 0 of 200 permutations reached the observation then,
  3 of 200 do now. The recorded `p 0.006 at n=2000` was measured on R_obs
  17.3%, which no longer reproduces, so it is superseded whatever its
  resolution was, and has not been re-run.
  **The band's empirical warrant stays withdrawn**, on the prior ground that
  needs no null at all — and that ground is now STRONGER, not weaker:
  **seven of Whitman's NINE detected chain links (78%) are REPEAT on an
  identical token**, MEASURED 2026-08-13. REPINNED from "half ... 7 RHYME and
  7 REPEAT of 14" (MEASURED 2026-08-11): the REPEAT count did not move, the
  RHYME links collapsed 7 -> 2. `now` closes four consecutive lines, which
  `battery.py` has printed under `false chains (should be near zero)` since
  the first commit.
  ONE STATISTIC, TWO MEANINGS, and the record has been quoting both under one
  word: +6.7, +3.3, +9.3 and +5.3 are the excess over the null MEDIAN (**+5.3
  added 2026-08-14 — it is the CURRENT head figure and this warning list had
  omitted it, so the sentence naming the trap left out the number most likely to
  be quoted**); the +17.9 pp
  cited in METHOD § doctrine 71 is the excess over the null MAX, on a
  different corpus. Doctrine 91 — a count is a coordinate of the rendering. A negative control is a text in which the
  property is ABSENT, and this one carries it as epistrophe, in the one
  relation doctrine 3 says cannot be read without a declared context.
  `corpus/whitman.txt` was never eligible, at any rate, under any comparator.
  THE BAND STILL SHIPS, on the doctrine 3/24 argument that it RELABELS rather
  than rejects — a claim about the taxonomy, which needs no negative control.
  `quality/RESULTS_NULL_SHAPES.md`, `quality/NULL_AUDIT.md` §1.1, and METHOD
  § The sonnet battery for why `verse.txt` was deleted.
- Triage every failure to a layer: ingestion / projection / anchor /
  comparator / band / structure / value. Fix only when a category
  accumulates. Every fixed case becomes a permanent regression.
- Real exemplars over constructed tests. Constructed tests encode the
  author's assumptions; canon corrects the checker (**7 rule-error
  CATEGORIES** found this way: strict groes final-consonant rule, sain
  any-stressed link, radif licensing, hyphen splitting **x3**, collision bar,
  mosaic anchor reach, prefix phrase-final seam).
  REPINNED 2026-08-13 from **8**, and the provenance is `git log`, not an
  argument: commit `29d61f2` — whose own subject line is *"four adversaries
  was never eight, and hyphen splitting x2 is x3"* — rewrote `7 rule errors`
  to `8 rule errors` in the same edit that moved the hyphen count x2 -> x3.
  It incremented a CATEGORY count because an INSTANCE count moved. The list
  is 7 categories and 9 instances, so **8 is derivable under neither
  convention**, and a commit correcting a miscount introduced one.
  AND THEY ARE NOT ALL `check_cynghanedd`'s, which four separate sites say
  they are. Only **two** are cynghanedd rules — strict groes and sain. Radif
  licensing is the Persian ghazal band (METHOD § doctrine 18); hyphen
  splitting x3 is the ENGLISH song corpus, 174 English line ends, three
  paragraphs below this one; collision bar is a canon merge
  (`quality/RHYME_CANON.md`); mosaic anchor reach is
  `quality/RESULTS_SPANS.md`. Doctrine 43 — a checker can implement a
  tradition's rules and never have read that tradition's language — rests on
  the TWO, and is not weakened by that: two rule errors found by canon in a
  language the checker could not read is the whole of its claim. The third hyphen error was the
  expensive one and it was a different KIND from the first two: they produced
  a refusal, this produced a WRONG ANSWER. **FIXED 2026-08-11, and it is a
  refusal now.** In **174** English song line ends the LAST letter-bearing
  piece of a hyphenated word is unread, so the anchor was built from an
  earlier piece and the line was nonetheless reported READABLE --
  `hill-zide` scored on `hill`, and `hill-zide`/`wife-zide 0.472 NO_RELATION`
  was `hill` against `wife`. The sharpest case is `a-vound`, where the only
  piece that reads is the participial prefix whose only phone is a schwa, so
  ANY TWO of Barnes's participles scored as a rhyme with each other on it:
  the harness was MANUFACTURING rhymes, not mislabelling them. One predicate,
  `unread_final_piece`, is read by the anchor path and by the record, so they
  cannot disagree. The 149 report-layer cases (`threshing-floor` reads
  `floor`; the anchor is right and the record of what was read is not) are
  NOT refused.
  Price, measured on both populations rather than argued: **zero on the
  sonnets** -- `wilful-slow` and `o'er-read` read on their LAST piece and stay
  judged at 1.0 -- and +0.099pp on the song corpus, 1.83% of all end-word
  refusals. It falls on 28 of 143 files and 63.8% of it on two, Barnes and
  Burns, which is dialect; doctrine 67 says measure WHERE and the answer is
  that those 28 files already refused at 8.26% against the other 115's 2.08%,
  so the rule lands where CMUdict was ALREADY failing. And it is not purely
  dialectal: 88 of the 174 are ordinary compounds, half of them standard
  literary English CMUdict does not list (`high-souled`, `star-inwrought`,
  `dew-pearled`) in Keats, Shelley, Arnold, Rossetti, Blake, Browning.
  `line_readability` had misfiled the unread piece as INTERIOR unreadable in
  328 of 328 cases; `interior_unreadable` is derived by POSITION now, so no
  string coincidence can put a final piece in it, and 0 of 323 are misfiled.
  Both hyphenated pairs in the sonnet battery score 1.0 correctly because
  their last piece reads -- so the oracle was structurally incapable of
  finding any of this, which is why it took a corpus sweep.

## Quality layer (quality/)
Separate from the correctness engine above and deliberately so: the harness
grades whether a rhyme is *correct*, this grades whether the writing is any
good. Ten pre-registered features (quality/PREREGISTRATION.md), a
discrimination test (quality/discriminate.py), results in quality/RESULTS.md.

Four things about it you need before you touch it. Its ten features have **no
demonstrated cross-design signal** (doctrine 10) and ~~two~~ **one** feature was
caught reading period rather than quality (doctrine 11 — REPINNED here
2026-08-21; this file's own index row 11 has carried the strike since
2026-08-13 and this sentence did not, so the prose and the index of ONE FILE
disagreed for eight days), so do not build on them and do not
cite their earlier numbers. The floor knows ~~two~~ **three** text lengths — a
4-line quatrain, a 14-line sonnet, **and a whole lyric sheet of 150–400
tokens** — and text outside all three gets no length-sensitive
finding at all (doctrine 15). **REPINNED 2026-08-21**: `floor.PROFILES` is
`section` / `sonnet` / `song`, the third landed 2026-08-11 and was re-adopted
2026-08-21 at `n_human=3571`. `L-4`'s close repinned three other "two"
citations — `quality/floor.py`, `BACKLOG.md`'s Tier-5 row, `quality/FLOOR.md`
— and missed this one, while the floor paragraph higher in THIS file already
carries the 3,571-item re-adoption. Two sentences, one file, opposite counts. Relations are keyed on eight axes, of which
ANCHOR is declared per MEMBER rather than per pair (doctrine 83). And there are
**eight** adversaries, not the four this paragraph listed until 2026-08-11 —
`BACKLOG.md` §0 holds the roster and its statuses, which is where they belong
because they change:

  1 our RESULTS   line-permutation nulls, matched redeals, shuffled controls
  2 the WRITING   `quality/revise.py`
  3 the CODE's generosity   `quality/redteam_band.py`, band only
  4 the TESTS   `quality/mutate.py`
  5 the CORPUS   `quality/audit_corpus.py`
  6 the TAXONOMY   `quality/audit_register.py --provenance`
  7 the REPORT   `quality/audit_spans.py` — do the number, the label and the
    evidence agree? Its first run said no for 382 of 1014 judged sonnet pairs.
  8 the RECORD   `quality/audit_register.py` — do the documents agree with each
    other and with the code?

Adversary 8 was not on the list when the list was written, and it is the one
that found four false entries in a week: 1–7 all attack the WORK and nothing
attacked the RECORD of it. That is the argument for reading `BACKLOG.md` §0
rather than this paragraph — a roster copied into two files drifts in both.

## Known gaps, priority order
1. **G2P for OOV.** CMUdict lacks hypotenuse, shiesty, coinages.
   Canary test: score "lot o' news" -- "hypotenuse" (currently
   NO_ANCHOR). `quality/g2p.py`'s `Fallback` (dictionary -> morphology ->
   elision -> compound -> letter, in that load-bearing order) was built and
   tested standalone against exactly this canary (`quality/test_g2p.py`);
   `Lexicon(fallback="high"|"low")` (`lyric_harness.py`, WIRED 2026-08-11)
   is the "equivalent as transcribe fallback" this entry used to ask for as
   a TODO. THE CANARY IS STILL NOT FIXED, on purpose: `hypotenuse` has no
   CMUdict-derived stem or elision pattern, so it still refuses at the
   shipped default (`min_confidence="high"`); only `"low"` reaches the
   letter-to-sound layer, which `test_g2p.py`'s
   `test_letter_layer_costs_more_than_it_buys` measures as net harmful (it
   answers Shakespeare's own real refusals wrong **50.0%** of the time — 5 of
   the 10 pairs only it can judge — against **5.1%** for the derived layers,
   2 of 39, a **9.8x** gap. REPINNED 2026-08-13, and ~~"about 40% ... against
   ~3%"~~ were BOTH stale by the same 2026-08-11 coda-identity fix that moved
   §9 from 38/39 to 37/39 and never reached §10's MESSAGE STRING, which quoted
   the literal `1/39 = 3%` — doctrine 48 inside an f-string. §10 now COMPUTES
   both rates from the same three battery runs and asserts the RATIO, so
   neither figure can drift alone again. Measured independently the same day by
   two lots that agreed to the decimal. The three battery arms in full:
   off 1064/1014/50/82, `high` 1064/1053/11/84, `low` 1064/1063/1/89 —
   mandated/judged/refused/violations. **ALL THREE VIOLATION COUNTS WERE
   MEASURED UNDER THE TWO-NAME DOOR** and are kept at those values rather
   than silently restated: the door widened 2026-08-22 (M-59) and the
   `off` arm is 35 today. The §10 assertion is on the RATIO between arms
   and is computed from three runs of whatever the current door is, so it
   does not depend on these three literals; they are history. The conclusion is unchanged and the
   absolute case is STRONGER, so the shipped default was never at risk) and
   which the wiring does not default to. What the wiring closes: known DICTIONARY-DERIVED refusals
   (`viewest`, `o'er`, `savour`, `groun'`) now read correctly wherever a
   caller opts in; what it does not close is this gap's own canary, and
   the gap entry stays open on that basis, not closed on the strength of
   the easier cases around it.
2. **Fitted substitution matrix — BUILT, and it does not help.**
   quality/fit_matrix.py, RESULTS_MATRIX.md. The floor IS removed: the
   free 0.15 stress gift became -0.0999 bits, and empty/empty coda went
   from 1.0 to -0.000. Held-out separation gains +0.003 (0.9177 vs
   0.9146) -- real in sign, inside anyone's noise -- and the Whitman
   negative control still got worse (21.3% vs 18.0% at matched FPR) --
   BUT THAT HALF IS ALSO WITHDRAWN, for the same reason as the band's --
   AND THE REASON WAS RESTATED ON 2026-08-11, so do not quote the old
   one. It used to read: all four recorded Whitman figures (18.0, 20.0,
   21.3, 26.0) fall inside one line-permutation null spanning
   6.7%-27.3%. That arithmetic no longer holds. 18.0 and 20.0 are the
   pre-`b1d7f64` comparator's; 20.0 re-read as 17.3 on 2026-08-11 and reads
   **10.7 on 2026-08-13** (`battery.py`, repinned in Test discipline above).
   16.0 is 18.0's 2026-08-11 re-reading and was NOT re-verified in that
   repin, so do not quote it without re-running. 21.3 has
   never been re-run under either, because it needs a fitted comparator
   threaded through `infer_chains` and that is still unbuilt. The
   withdrawal stands on the ground in quality/RESULTS_NULL_SHAPES.md §2
   instead: `corpus/whitman.txt` carries the property under test as
   epistrophe -- half its detected links are REPEAT on an identical
   token -- so it was never an eligible negative control and no
   ordering among figures measured on it means anything. See
   quality/NULL_AUDIT.md.
   NOT the default; Declaration.fitted stays False and a test enforces
   it -- now resting ONLY on the held-out gain of +0.003, which the
   record already called "inside anyone's noise". That is a weaker case
   than this file used to make, and it is the honest one: the fitted
   matrix is not shipped because nothing shows it helps, not because
   something shows it hurts. (Both figures here are the CLEAN ones; the
   first run was fitted on 9.2% corrupted end words.)
   ~~Remaining: sun/much needs a CONJUNCTIVE band rule, not a comparator
   -- its nucleus is identical, so it was never a floor case.~~
   **STRUCK 2026-08-16: THE RULE THIS SENTENCE ASKS FOR SHIPPED TWENTY-ONE
   MINUTES AFTER IT WAS WRITTEN, AND THE SENTENCE STOOD FOR SIX DAYS.**
   `01a6e1c` (2026-08-10 01:01:33) wrote the ask; `0c3a0b1` (01:22:57, *"Add
   the conjunctive coda band"*) built it, and `git merge-base --is-ancestor`
   confirms that order. The diagnosis was exactly right — a band rule, not a
   comparator — which is what makes the staleness interesting: this is not a
   forecast that failed, it is a correct prescription whose own fill was never
   recorded next to it.
   `python3 lyric_harness.py score sun -- much` today:
   `total: 0.772   relation: ASSONANCE`, `flags: conjunctive band: nucleus
   agrees, coda does not` — the 0.772 scalar is UNCHANGED and still above the
   0.75 band, so nothing here was fixed by moving a threshold; `admits()`
   rejects it on the RELATION (`lyric_harness.py:2011`). `Declaration()
   .conjunctive_band` is `True` — the SHIPPED default, not an opt-in.
   Recorded in three other places while this line said "Remaining":
   `quality/RESULTS_BAND.md:13` (`P1 — sun/much stops being admitted as rhyme
   | **CONFIRMED** — types as ASSONANCE`), and doctrines 3 and 24 in this
   file, which describe the rule as shipped. Only the gap list was never told.
3. **Time layer.** Placement half built, and **MUTE**.
   ~~POWERED and null. The blocker was never the comparator: it was
   multiplicity, and family-wise error control fixed it (RESULTS_FWER.md).~~
   **REPINNED 2026-08-13, and this was the live claim.** That sentence is this
   file's copy of a headline `RESULTS_FWER.md` voided on 2026-08-11, and it is
   the reason a reader would believe the layer works. **Family-wise error
   control did not fix it.** It moved the layer from 87-97% saturation — no
   power, because everything was an event — to 0%, no power, because ~~nothing
   is attainable~~. The reason is that `m` had been measured over band
   SURVIVORS rather than over candidates: at the honest candidate family (89 on
   a quatrain, 156-282 across 24 sonnets) ~~NO POSITION ON ANY ITEM IN THIS
   REPOSITORY clears its cut at window 32~~. So the blocker was multiplicity AND
   the family size is the measurement that says so.
   **BOTH ABSOLUTES ARE STRUCK, REPINNED 2026-08-16, AND THE STRIKE IS THE
   FINDING — THE DIRECTION IS UNCHANGED.** `python3 quality/audit_fwer_fpr.py
   --check` (PASS, exit 0) pins the REAL arm as **18 `cannot_tell` / 0
   `refused` / 2 `answered`**, and pins the 2 `answered` as `2 attainable, 0
   events -- an observed zero, not a refusal`. `python3
   quality/time_attainable.py` agrees independently: `32 real | 18/20 mute |
   ev>0 0`. So 2 of the 20 items ARE attainable and came back with a MEASURED
   ZERO. "Nothing is attainable" and "NO POSITION ON ANY ITEM" state the
   20/0/0 reading, and this file's own instrument has pinned 18/0/2 the whole
   time.
   Two doctrines, not one. **Doctrine 20:** an observed zero is a NULL — the
   layer looked and found no event — while "nothing is attainable" is
   INCONCLUSIVE BY CONSTRUCTION, the layer unable to look. Collapsing the
   first into the second charges a real measurement to the instrument's
   blindness and throws away the only two items that answered. **Doctrine
   79:** 18 and 2 are two counts and this sentence read them as their sum.
   `quality/RESULTS_FWER.md:243-248` says so in as many words — *"18 and 2
   never sum to 20 ... An 18/0/2 that became 20/0/0 would leave the printed
   rate, the empirical p and every 'mute' total untouched and **is a different
   finding**"* — which is exactly why no instrument went red on this: every
   number a command checks is identical under both readings, and the only
   thing that differs is the English.
   **WHAT IS UNCHANGED, and it is the whole load-bearing claim:** the layer is
   MUTE, the blocker is multiplicity, and the family size is the measurement
   that says so. 18 of 20 items are mute, pinned to the recorded REASON
   (`m_needed >= 1` AND `share_firable == 0.0`, median family / m_needed
   5.5x-21.3x). The layer is not usable; it is just not usable for the reason
   stated in one absolute too many. The beat grid still does not
   exist and cannot until ~~audio or~~ a declared tempo enters (the
   audio clause struck 2026-08-23 with doctrine 4's amendment — the
   declaration is the only route, by owner ruling). NOT a
   second rap corpus -- that was doctrine 8 broken twice (single
   source, single language) and no rap is admissible anyway. The
   binding constraint is EVENTS PER ITEM: 8 events at ~75% of an item's
   rhymes on one phase reaches **~0.74** power, so a cell needs ~40
   events or pooling to clear 0.80. **REPINNED 2026-08-13 from "needs
   ~75% ... to reach 0.80 power", which was a THRESHOLD CROSSING THAT
   DOES NOT REPRODUCE.** `power(65, 8, 0.75)` over ten seeds gives
   0.68 0.72 0.73 0.74 0.74 0.74 0.77 0.79 0.80 0.82 -- median 0.74, and
   only 2 of 10 reach 0.80. The recorded 0.82 that
   `POSITIVE_CONTROL.md` bolds is the MAXIMUM of that spread, and this
   sentence had promoted one lucky draw into the number a reader plans a
   cell around. Doctrine 73: a single seed is a coin flip reported as a
   verdict. `positive_control.py --check` pins the c=0.75 case as a BAND
   (0.50-0.95) rather than a cell for exactly this reason, and is green
   on 10/10 seeds; the ceiling and floor ARE pinned, because those have
   zero and near-zero spread. The direction of the finding is unchanged
   and slightly sharpened -- the cell is further from 0.80 than recorded,
   not closer. See POSITIVE_CONTROL.md.
4. **Cross-line internal walk.** ~~internal_matches supports two lines;
   no verse-wide positional graph yet.~~
   **REPINNED 2026-08-16 — THE GRAPH WAS BUILT ON 2026-08-10 AND THIS ENTRY
   WAS NEVER TOLD.** `quality/relations.py`'s `internal rhyme` schema IS the
   song-wide positional graph, and its own `note=` field has said so in those
   words for six days (`REGISTRY['internal rhyme'].note` ends "MISSING E-3:
   this is the song-wide positional graph the two-line `internal_matches`
   could not build"). Measured on a four-line fixture, `realise()` returns
   true verdicts at line distances **1, 2 AND 3** — the whole stanza, not a
   sliding pair.
   **WHAT ACTUALLY REMAINS IS A DOCTRINE 1 PROBLEM, NOT A MISSING BUILD:
   "internal rhyme" HAS TWO READINGS IN THIS REPO AND NEITHER NAMES THE
   OTHER.** `lyric_harness.internal_matches` takes `text_a` and an optional
   `text_b` — exactly two texts — and `rhyme_density`, its only cross-line
   caller, walks `range(len(lines) - 1)` with `text_b=lines[idx + 1]`
   (`lyric_harness.py:2990`), so the ENTIRE `lyric_harness` reading is
   distance <= 1 **structurally**, not by threshold. `relations.py` reaches
   distance 3 on the same text. So a reader asking this harness "what rhymes
   internally" gets a different answer depending on which layer answers, and
   nothing discloses the difference at either site. That is the live gap: not
   an unbuilt graph, but an undeclared coordinate — the WINDOW — with two
   values and no statement of which is being read.
   Reproduce both halves:
   `python3 -c "import inspect,lyric_harness as LH; print(inspect.signature(LH.internal_matches))"`
   against `realise(REGISTRY['internal rhyme'], build_stream(...))`.
   `MISSING.md` E-3 carried the identical stale sentence and is repinned with
   this one.
5. **Assonance corpus.** Moncrieff Song of Roland (1919, PD) pending
   verification that translation preserves laisse assonance.
6. **Non-English phonology.** FOUR CELLS UNBLOCKED (quality/phonology/):
   fin, som, ltc — cheap for three DIFFERENT reasons, so three
   implementations rather than one G2P with three tables. Finnish: a
   near-phonemic orthography, regular syllabification, stress fixed on
   syllable 1 (rules only, nothing to licence). Somali: phonemic 1972
   Latin script, (C)V(V)(C), and it REFUSES a stress grid — pitch
   accent, not stress, so grid_unit is the mora. Middle Chinese: not
   G2P at all but a lookup, data/qieyun_mc.tsv (CC0), 19,499 chars,
   plus the 平水韻 同用 grouping without which 流/樓 do not rhyme.
   Welsh: near-phonemic, and its EIGHT DIGRAPHS (ch dd ff ng ll ph rh
   th) are single consonants -- split them and every consonant
   skeleton in the language is wrong while still looking plausible.
   cym implements croes/traws/sain/llusg on Welsh units, with a
   PROCLITIC list (y, a, i, o, yn, ar, fy, ei ...) because penultimate
   stress otherwise makes every monosyllable stressed and llusg then
   "answers" on the definite article. FIXED: check_cynghanedd now takes
   `language` and DEFAULTS TO WELSH; `--lang=eng` keeps the original
   CMUdict path for English imitation (Hopkins wrote it) and labels
   itself an imitation. Every result declares its phonology. It had
   built its skeleton from CMUdict since the first commit, so the seven
   recorded rule errors are findings about the RULES, never about Welsh.
   ~~PHONOLOGY still blocked: Indic (prasa), Old Norse (hendings).~~
   **SUPERSEDED 2026-08-14 — BOTH ARE BUILT, AND BOTH HAVE RUN.** This is the
   same failure the Welsh half of this entry already carries a correction for:
   a blocker asserted long after its own row recorded the unblock. Sanskrit is
   `quality/phonology/san.py`, 571 lines, dated 2026-08-10 — `prasa()`,
   `prasa_anchor()`, `prasa_depth()`, `antya_prasa()` — and the cell has fully
   run, staged a corpus slice, and written two `data/sources.tsv` rows;
   `prasa_rate.py --check` pins its counts and exits 0. Old Norse is
   `quality/phonology/non.py`, 959 lines, with `RESULTS_NON_HATTATAL.md`,
   `test_phon_non.py`, and five modules importing it. Twelve `sources.tsv` rows
   carry the two corpora between them.
   WHAT IS ACTUALLY BLOCKED IS NARROWER and belongs in the language of doctrine
   44/92: nothing here is hard to build or impossible to obtain — the remaining
   Sanskrit gap is that V2 ādyakṣara refuses on 30.7% of half-verses because a
   pāda beginning with a vowel has no initial consonant to share, which is a
   property of the language and not a defect.
   **TEXT IS NO LONGER BLOCKED FOR WELSH — SUPERSEDED 2026-08-13.** This
   entry read *"TEXT blocked for Welsh: see SEARCH:welsh-cynghanedd-corpus in
   data/sources.tsv. The capability is built; the corpus is not reachable."*
   That row is `data/sources.tsv:56` and it has read **OVERTURNED — source
   located via GITenberg** since 2026-08-10. **Seven Welsh files, 8,758
   lines, are on disk** (`wc -l corpus/cym_* corpus/song/cym_*` — the total
   reproduces exactly), each with its own row: `GITenberg/Gwaith-Alun_14865`
   1909 strict-metre (1,558), `GITenberg/Gwaith-Twm-o-r-Nant-Cyfrol-2_2734`
   cywydd (156), `.../Some-Specimens-of-the-Poetry-of-the-Ancient-Welsh-
   Bards_32767` — Llywelyn Goch cywydd (149) — and four song rows
   (`Yr-Hwiangerddi_8194`, `Gwaith-Mynyddog.-Cyfrol-II_14547`, and the two
   `#songs` halves of Alun and Twm o'r Nant). The cell has RUN — the
   seven-corpus specificity gradient is `MISSING.md` N-1. So this gap entry
   spent three days asserting a blocker that its own `sources.tsv` row had
   already recorded as lifted, which is doctrine 39's failure mode inverted:
   a NOT-FOUND row was correctly re-tested and overturned (doctrine 49), and
   the gap entry that cited it was never told.
   **THE CITATIONS ARE BY `source_id` NOW, NOT BY LINE NUMBER — REPINNED
   2026-08-16, AND THE SPELLING IS THE FIX.** This paragraph read
   ~~`:68`, `:69`, `:265`–`:269`~~ for the seven and
   ~~`data/sources.tsv:271`, `:272`~~ for the two NOT FOUND rows. Both were
   TRUE when written (`8d3e05a`, 2026-08-13) and both are FALSE now, by the
   same mechanism and without one character of either sentence changing:
   `7ab38df` (2026-08-14, *"two editions were named in a corpus header and had
   no provenance row"*) INSERTED TWO UNRELATED ENGLISH ROWS at positions 211
   and 220 — `GITenberg/BeechenbrookA-Rhyme-of-the-War_16480` and
   `GITenberg/Little-Ann-and-Other-Poems_42947` — and everything below them
   slid by two. Nothing about Welsh changed; nothing in this paragraph was
   edited; a commit that never touched the subject, the sentence, or even the
   file the sentence is in made the sentence false. `:265`/`:266` are Malay searches and the
   Welsh song rows have slid to `:267`–`:271`; `:271`/`:272` now land on a
   SATISFIED public-domain row and a RIGHTS REFUSAL, so the sentence saying
   "still genuinely NOT FOUND" was pointing at a row that was found and a row
   that was refused — the two verdicts doctrine 79 most needs kept apart. The
   rows meant are `SEARCH:welsh-hymn-corpus-tune-and-metre` and
   `SEARCH:welsh-cywydd-medieval-poets`, both still `NOT FOUND`, and naming
   them is what makes the citation survive the next insertion. **A LINE
   NUMBER INTO AN APPEND-ONLY TABLE IS NOT AN ADDRESS, IT IS AN OFFSET FROM
   A MOVING ORIGIN**, and every other `data/sources.tsv:NNN` citation in this
   repo carries the same defect latent.
   WHAT REMAINS BLOCKED IS NARROWER, and is recorded where it belongs: no
   cerdd-dafod treatise (`quality/RESULTS_CYM_RHYME.md` item 1, *Blocker:
   **cannot obtain***), and the hymn and medieval-cywydd corpora are still genuinely
   NOT FOUND (`SEARCH:welsh-hymn-corpus-tune-and-metre`,
   `SEARCH:welsh-cywydd-medieval-poets`).
   **AND THE WELSH PROSE NEGATIVE ARM IS NOT ON THAT LIST — MOVED OUT
   2026-08-16.** This sentence filed it under "WHAT REMAINS BLOCKED" while the
   source it cites labels it the opposite: `quality/RESULTS_CYM_RHYME.md`
   item 3 reads *"Blocker: **neither** — it is a staging request, and the
   material is one `curl` away on a channel that already answers"*, and
   `data/sources.tsv`'s `NOTE:gitenberg-welsh-holdings-enumerated` row already
   names a reachable Welsh PROSE holding (`Gwaith-Samuel-Roberts_14354
   (prose)`). The neighbouring item IS correctly labelled `cannot obtain`, so
   the file distinguishes the two and this paragraph flattened them. Calling
   an unstaged-but-reachable text "blocked" is doctrine 20 pointed at the
   corpus: work nobody has done, recorded as work nobody can do.
7. **Blueprint identity-with-variation.** This entry named TWO gaps and one
   of them closed without the entry being told: **chorus variation is
   CLOSED** (`quality/grid.py`'s `compare_returns`, over the ~~12~~ named
   `VARIATION_KINDS` — VERBATIM, LEXICAL_VARIATION, HEAD_PRESERVED,
   RHYME_PRESERVING_REWRITE and the rest — not a verbatim/not-verbatim
   boolean; `return_findings` runs it over every declared function's own
   recurrences).
   **THE COUNT IS STRUCK AND NOT REPLACED, 2026-08-16.** `VARIATION_KINDS`
   measures **15** today
   (`python3 -c "from quality import grid as GR; print(len(GR.VARIATION_KINDS))"`),
   and writing 15 here would only reset the clock on the same defect. **It was
   never 12 in the first place:** `git log -S'12 named' -- CLAUDE.md` gives
   `8592e8b` (2026-08-12), whose own subject line is *"Fix stale gap status"*,
   and at that very commit the tuple already had 15 members — it passed 12 on
   2026-08-11 at `d944ff7`. So the commit written to repair a stale status
   wrote a count that was stale on arrival, which is doctrine 58 with the
   shortest possible fuse. The ARGUMENT this sentence is making — a graded
   ladder rather than a verbatim/not-verbatim boolean — does not turn on the
   cardinality, so the cardinality is not stated; the constant is named and
   the command is beside it. `MISSING.md`'s "12-way ladder" is the same figure
   in the other register and is struck with it. "Current refs are verbatim-only" stopped being true two
   days after this line was written and nobody split the sentence — doctrine
   48's own failure mode, caught by a real draft's final chorus coming back
   `HEAD_PRESERVED` in a real run rather than the boolean the sentence still
   claimed. **Outro-extends-intro — CLOSED 2026-08-14.** `grid.reprise_findings`
   calls the same primitive across two DIFFERENT declared functions. THE DESIGN
   WAS NEVER THE COMPARISON, IT WAS THE ASKED SET: `compare_returns(INTRO,
   OUTRO)` already answers `EXTENDED_RETURN` with no special case, so the
   primitive was never the missing piece — the CALL was. The asked set is
   `FormConvention.reprises`, a declared coordinate holding three ordered pairs
   taken from `SECTION_FUNCTIONS`' own glosses, because asking every ordered
   pair is MEASURABLY WRONG: over `corpus/song/`, 51 of 889 cross-function pairs
   (5.7%) share a whole line and NOT ONE is a reprise — they are refrain lines a
   printer set inside the verse. All 51 are silent under the shipped default
   (doctrine 61). The threshold keys on `Return.invariant_lines`, NOT on a
   hand-copied subset of `VARIATION_KINDS` — that spelling is what rotted
   `single_use`, which drifted from `FunctionSpec.recurrence` by one member and
   silenced both gates it fed. `CROSS_FUNCTION_REPRISE` is a NOTE, so it reaches
   `verify()`'s diff and cannot reject there (doctrine 6), proven by a
   counterfactual that re-types only that code and flips acceptance to False.
   The corpus bounds the FALSE-POSITIVE side and cannot supply the positive one
   — no INTRO/OUTRO/REPRISE mark exists in `MARK_FUNCTION` — and that limit is
   pinned by a test rather than papered over. `quality/test_grid.py` §24,
   `test_song_function.py` §10. One thing the closure found on its way: `reprise`
   is the only function whose gloss declares it IS a cross-function return, and
   its `recurrence` is `"once"`, so `return_findings` answered `SINGLE_INSTANCE`
   and stopped — the one property that defines the function was invisible to
   every check in the file.
   ~~**Outro-extends-intro is still OPEN**: `compare_returns` takes two line lists and does not care where
   they came from, but `song_function_report` only ever calls it on
   MULTIPLE INSTANCES OF THE SAME declared function (`song.instances_of(fn)`)
   — comparing across two DIFFERENT functions (does the outro reprise the
   intro) is not asked by anything. The primitive that would answer it
   already exists; nothing calls it that way.~~
8. **CLOSED 2026-08-14 — the readability report joins the revision loop.**
   `Reviser.inspect` folds `readability.report`'s findings in, so an unreadable
   end word on a line THE MANDATE LEAVES FREE is now reported. Measured before:
   `readability.report` said `[('UNREADABLE_END_WORD','flag',[4])]` and
   `inspect()` said `[]`.
   BOTH ARRIVE AS **NOTES**, and the asymmetry resolves toward
   `SCHEME_UNREADABLE` rather than toward `readability.report`. A refusal is not
   a violation (doctrine 79) — `inspect()`'s own comment records the price of
   getting this backwards, a loop that "briefed a model to rewrite lines that
   rhyme perfectly well, Barnes's Dorset `drong`/`zong` among them". And the
   consistency argument is decisive: `SCHEME_UNREADABLE` is the SAME refusal on
   a pair the mandate DECLARED and is already a note, so a flag here would make
   an unreadable word on an UNMANDATED line fail harder than the identical word
   on a mandated one. The downgrade is stated in each finding's own evidence
   rather than applied silently. No new opt-out: `Lexicon(fallback=...)` already
   sits at the right layer, and a second switch would be a second place to
   change one answer (doctrine 1).
   THE BLAST RADIUS MOVES BOTH WAYS AT `verify()`, measured: unreadable ->
   readable was `accepted=False, fixed=[]` — a real repair called a no-op — and
   is now `accepted=True` with the fix named; readable -> unreadable was
   INVISIBLE and now lands in `new_notes`, never `new_flags`. The loop can see a
   change it was blind to in both directions and still cannot reject on it.
   `quality/test_revise.py` test 34.
   **AND THAT WIRING TOOK `report` AND LEFT `substitution_report`, WHICH THAT
   FUNCTION'S OWN DOCSTRING CALLS THE SHARPER HALF — WIRED 2026-08-14.** It sits
   100 lines below `report` in the same module and its only callers were
   `readability.py`'s `main()`, which prints a COUNT and never a word, and one
   test. So every draft-grading surface could say the LINE was unreadable and
   none could say WHICH WORD the harness would have rhymed on instead — the
   actionable half, and the dangerous one, because "the substituted word is a
   plausible English word and nothing about the output looks wrong". It is now
   `SUBSTITUTED_END_WORD` in `report`'s own finding list, so `inspect` reaches
   it through the call it already makes (one definition, two surfaces) and the
   `readability` verb gains it too. A **note**, arriving as one from `report`
   rather than downgraded here, because it is not a second charge.
   **DO NOT OVERSTATE WHAT IT BUYS, AND THE MEASUREMENT IS WHY.** Over the 143
   English song files 8,842 lines are substitutions and **8,840 of them are
   ALREADY `UNREADABLE_END_WORD`** — the line was never silent, only the word
   was. What the wiring newly makes VISIBLE AT ALL is 2 lines.
   **AND `substitution_report`'s claim to be "a strict subset of the
   unreadable-final lines" IS FALSE, measured while wiring it** (6 of 31,355
   over all 260 `corpus/song/` files): a final token that READS and yields NO
   SYLLABLE — `mm` is `['M']`, and a lone consonant syllabifies to nothing — is
   dropped by `word_syllable_map` exactly as an OOV word is while `line_anchors`
   still returns an anchor built on the PREVIOUS word, so `final_unreadable` is
   False and the whole module was silent. Byron's `...lay white on the turf,[mm]`
   is anchored on `turf` and reported READABLE: invented relation #4 of that
   module's docstring, at a site `unread_final_piece` does not cover. ~~Those 2
   lines are the only population here no other finding reaches~~ **ONE line
   since 2026-08-28 (`MISSING.md` M-27): `[mm]` is footnote anchor 47 of
   Byron's 54, so the declared bracket-anchor class drops it at read time and
   the line's end word IS `turf` — the edge case closed by reading the page's
   apparatus correctly rather than by teaching `word_syllable_map` about it.
   D'Urfey's `_Sh----_` is the class's one remaining member**, and
   `corpus_rate` now returns `substituted_flagged`/`substituted_silent` as two
   counts that are never summed. `quality/test_revise.py` test 36,
   `quality/test_readability.py` tests 2/5/7 (the [mm] line is test 7's
   exemplar, and it fires that code and NO other — repointed with the repin).
   ~~`quality/readability.py`'s own report never joins the revision loop, and
   the data is already on the path.** `Reviser._matrix` computes
   `readability_records` for EVERY line on EVERY run. The only readability
   findings that reach the finding set are `grade()`'s `refusals`, which
   `refusals_for_pairs` scopes to pairs the MANDATE puts together — so an
   unreadable end word on a line the mandate leaves free produces nothing at
   all, while `readability.report`'s `UNREADABLE_END_WORD` and
   `UNREADABLE_END_WORD_PIECE` are FLAGS about every line, and the loop's own
   `SCHEME_UNREADABLE` counterpart is only a note. This is neither doctrine
   44's "hard to build" nor doctrine 92's "cannot obtain": the measurement is
   already computed, on the path, and thrown away. The join belongs in
   `Reviser.inspect`. Found 2026-08-13 by asking what a default `revise_loop`
   run actually consults.~~
9. **CLOSED 2026-08-13 BY COMMIT `9c9a5c5`, AND THIS ENTRY WAS NEVER TOLD.**
   `_meter_findings` has called `FT.overlap_findings(fits)` since that commit —
   `git blame` puts it there — so the entry below spent a day describing as
   pending a change that had already shipped, and a lot was briefed to make it
   before anyone checked. That is this file's own recurring failure mode aimed
   at a gap entry rather than at a capability.
   VERIFIED BY MUTATION rather than by reading the log: on a purpose-built
   overlap blueprint, reverting the call gives `fit` `over 4` and `song` twelve
   findings with ZERO mentioning the overlap; at head `song` gives twenty
   findings of which EIGHT are `OVERLAPPING_SPANS`. All four shipped blueprints
   measure 0 overlaps, which confirms the "zero test churn" claim and is also
   exactly why the gap survived — no existing fixture could see it.
   `quality/test_revise.py` test 35 pins the `Reviser` side and the
   byte-identical-evidence invariant; `quality/test_fit.py` already carried the
   `fit` side.
   **THE SAME SHAPE ONE RELATION FURTHER OUT SURVIVED THAT EXTRACTION —
   `SectionFit.uncovered_bars`, WIRED 2026-08-14.** Bars of a section no line's
   declared span touches. `overlap_findings` was moved off `SectionFit` and onto
   the flat `LineFit` list precisely because "written as a method on `SongFit`
   this check would have stayed unreachable from the revision loop"; coverage is
   a SECTION-level relation by the identical argument, and it was left as a
   method, so it stayed exactly there — `SongFit.table` -> `fit.report` -> the
   `fit` verb, and nothing else. MEASURED on one blueprint before the wiring:
   `fit` printed `4 3..6` and `2 11..12` on two sections while `inspect()`
   returned ELEVEN distinct codes, not one of them about a bar nobody sings.
   `fit.uncovered_bar_findings(fits, sections)` takes the same flat list
   `overlap_findings` does; the second argument is not decoration, because a
   section with NO LINES — a declared instrumental, the archetypal case — puts
   nothing in that list at all. It was a TABLE COLUMN and not a `FitFinding`, so
   the code is new, and `_uncovered_bars` is now the one definition both the
   column and the finding go through.
   **THE CHARGE IS THE DECISION, AND THE COUNTERFACTUAL WAS MEASURED.** A bar
   nobody covers is a fact about the DECLARATION (bar/beat/duration), not about
   any line's WORDS — no rewrite moves it, and the loop's only move is a word
   swap on a named line. So it is WHOLE-DRAFT with NO locations, and a **note**
   (`fit.py` marks it satisfiable — a rest, an instrumental, or a melisma that
   layer's own `UNANSWERABLE` says it cannot see; `revise.py` re-decides
   nothing). Charged instead as a PER-LINE FLAG on the same draft the loop goes
   from **SUCCESS in 0 rounds to NO_PROGRESS in 2 with all four lines
   permanently `unresolved`**, briefed with an empty candidate field on 3 of 4 —
   which is the destroyed SUCCESS `inspect()`'s own readability block already
   priced. It never reaches `verify()`'s gate either way: coverage is a function
   of the blueprint alone, so it is identical on both sides and cancels out of
   the diff. NOT summed into any existing count (doctrine 79/91):
   `SongFit.section_findings` is separate from `SongFit.findings()`, which is
   the per-LINE set, and the finding is not a `FitRefusal`, so `fit.report`'s
   REFUSED-by-cause totals are unmoved. `quality/test_revise.py` test 37,
   `quality/test_fit.py`'s `test_uncovered_bars_asked_of_a_flat_list...`.
   ~~`OVERLAPPING_SPANS` is reachable from `fit` and from nothing else.**
   `Reviser._meter_findings` calls `quality/fit.py`'s `fit_line` once per line
   and never builds a `SongFit` — and an overlap is a relation BETWEEN two
   lines, which cannot be seen from inside one. Measured at both surfaces on
   one blueprint: `fit BLUEPRINT` prints `over 1` and two findings; `song
   BLUEPRINT LYRIC` on the identical file prints five meter findings and not
   one word about the overlap. `fit.overlap_findings(fits)` was extracted
   2026-08-13 to take the flat `LineFit` list — the object BOTH callers
   already hold — with identical arithmetic and evidence text, and `fit_song`
   now calls it; the one-line change that would make `_meter_findings` call it
   too is verified at runtime and costs zero test churn, since all four
   shipped blueprints have 0 overlapping lines. Same shape as the
   built-and-tested-was-not-the-reachable family above, one layer in.~~
10. **CLOSED 2026-08-14 — the SHAPE layer joins the revision loop, and it is
   the layer this harness was built for.** `grid.stanza_lock` states its own
   subject: *"THE SPECIFIC CLICHE THIS NAMES: sixteen bars of 4/4 carrying
   four lines, repeated. Nothing in this repo could see that before — the
   rhyme checker would certify it as clean, because every check it had was
   about words."* It was reachable from `lyric_harness.py`'s `grid` verb and
   from NOTHING that grades a draft: `song_function_report` never calls it, so
   `METER_LOCKED`, `SECTION_LENGTH_LOCKED`, `QUATRAIN_LOCK`,
   `DOWNBEAT_LOCKED`, `UNIFORM_ANACRUSIS` and `PHRASE_LENGTH_LOCKED` were six
   findings computed by a function no grading path reached. Third instance of
   the family gaps 8 and 9 belong to, and the largest: those two closed ONE
   code each, this closes six, and they are the only checks in the repo that
   ask about the song as a whole SHAPE rather than as words.
   `Reviser._function_findings` calls it now. Measured on a purpose-built
   locked grid — 16 bars of 4/4, four 4-bar sections, four lines each: the
   whole-draft set goes **10 findings -> 15**, five of the six fire, and
   stubbing `stanza_lock` to `[]` takes exactly those five back out.
   `UNIFORM_ANACRUSIS` is correctly silent rather than missing — it is the
   `elif` of `DOWNBEAT_LOCKED`, which fired (doctrine 24, the rule relabels).
   NOTES, never flags, and the FLAG count is byte-identical either side of the
   wiring: this is a measurement against a CONVENTION at an uncalibrated 0.90
   threshold, and doctrine 6 says a convention a writer may depart from cannot
   be what fails `verify()`. 5/4 and an 11-bar bridge are choices, not repairs.
   **THAT HOLDS FOR THE SIX LOCKS AND STOPPED BEING TRUE OF THE LAYER
   2026-08-23 (`MISSING.md` M-84).** `HOOK_DOES_NOT_RECUR` is a FLAG by the
   owner's ruling, and the distinction it turns on is the one this paragraph
   already draws: the locks measure a draft against `POPULAR_SONG` at an
   uncalibrated threshold, while a hook occurring once fails `M-54`'s own
   per-row test — *NOVEL SONG or MISLABELLED SECTION?* — as a mislabelled one.
   Promoting it exposed that **the PLANNER could not satisfy it**: 219 of 400
   seeds declared a hook in a section drawn once, a defect no writer can clear
   by writing, so the slot derivation and a fifth `JOINT_CODES` member shipped
   in the same commit. 0 of 400 after, 0 seeds lost.
   **AND EVERY ONE OF THOSE STATISTICS WAS SILENCED BY APPENDING ONE SHORT
   SECTION — FIXED 2026-08-23, `MISSING.md` M-75, owner's ruling *"derived
   envelope not rate-matching"*.** The owner's anecdote: *"it made all
   quatrains and ended with a 2 line outro which technically satisfied it but
   that's blatantly just gaming the system."* Each lock fired on a FRACTION OF
   SECTIONS, so one appended section moved the denominator by 1/n and went
   quiet for every song of fewer than TEN sections. **The threshold is
   untouched and retuning it would only move the duck from one section to
   two** (doctrine 58); what changed is the POPULATION the fraction is over —
   the MASS each section carries, bars for the metric locks and lines for the
   lyric one. The two measures that were already per-LINE (`downbeat_locked`,
   `uniform_anacrusis`) stop being exceptions and become instances of one
   rule. **AND THE DUCK IS NOT GONE, WHICH IS THE HONEST STATEMENT** — its
   PRICE went from a constant (one section, any size) to a share of the song,
   derived from the declared threshold itself: silencing k sections of length
   L now needs an appended section longer than `kL(1-t)/t`, a ninth of the
   song at 0.90. **FOUND IN THIS REPO'S OWN FIXTURES**, where the sizing had
   looked at the planner and called it latent: `function_fixture` is eight
   2-bar sections and a ONE-BAR outro (`equal_section_length` 8/9 = 0.889,
   silent; by bars 16/17 = 0.941, fires) and `mandate_song` is 65 bars of 4/4
   whose single one-bar outro was worth a fifth of a section-count statistic
   (`bars_multiple_of_four` 4/5 = 0.800; by bars 64/65 = 0.985). **No suite
   went red on either** — 298 checks in `test_grid.py` passed against a repair
   that moves two fixtures. Over 15,063 corpus songs the lyric lock goes
   **11.80% -> 15.30%**, and the 550 newly charged are not a slice of verse
   but the anecdote itself: the six commonest are `[1,4,4,4,4,4,4]`,
   `[1,4,4,4,4]`, `[1,4,4,4,4,4]`, `[2,4,4,4,4,4,4]`, `[1,4,4,4]`,
   `[1,4,4,4,4,4,4,4]`. `test_grid.py` §27, 9 checks, the mutation being to
   put the section-count denominator back.
   NOT folded into `song_function_report`, whose contract is every
   *function*-dependent question and whose doctrine-79 triple has already gone
   negative once; `stanza_lock` never reads `Section.function`.
   **AND THE "NO FIXTURE COULD SEE IT" STORY IS FALSE HERE — the truth is
   worse.** Gap 9 got to say no shipped blueprint tripped `OVERLAPPING_SPANS`.
   THREE OF FOUR trip `DOWNBEAT_LOCKED` right now (`song`, `mandate_song`,
   `moonlight_fixture`, the last also `PHRASE_LENGTH_LOCKED`), so this layer
   was not untested — it was firing on the repo's own fixtures and reporting
   to nobody. Four of the six are tripped by no fixture at all, which is why
   the test constructs the cliché rather than reaching for one.
   **A DOCTRINE-17 CASUALTY FOUND ON THE WAY IN, PINNED NOT REPAIRED**:
   `uniformity`'s docstring says the 41-line fixture "cleared the check by
   giving every second line a pickup of 1.5 pulses" and that `downbeat_locked`
   "fell to 51%". All 41 lines declare `beat: 1` today and it reads **1.00** —
   the pickups are gone and the recorded figure does not reproduce. Restoring
   them would re-commit the exact cheat `UNIFORM_ANACRUSIS` was written to
   name, so the CURRENT reading is pinned instead and the fixture is left
   alone. `quality/test_revise.py` test 36.
   **SAME FAMILY, SECOND SITE, SAME DAY — a `Return`'s own refusals.**
   `compare_returns` builds a `Return` carrying `.refusals` (`STUB_RETURN`,
   `NO_RHYME_KEY`, `END_WORD_UNREADABLE`) and BOTH callers —
   `return_findings` and `reprise_findings` — read `.kind` off it and dropped
   the rest, so three codes were computed on every comparison and reachable
   only by calling `describe()` on the object by hand. Nothing does. The
   refusal list doctrine 79's triple is counted from was short by every
   refusal the comparison itself made. ONE IS LIVE IN THE LOOP:
   `_function_findings` always passes a real `rhyme_key`, so `NO_RHYME_KEY`
   cannot fire there — but `END_WORD_UNREADABLE` can, the moment a chorus
   carries a word the declared phonology cannot read, and "did the rhyme
   survive the return" then answered CANNOT TELL to nobody.
   **AND THE FIRST ATTEMPT COLLECTED ALL THREE, WHICH WAS WRONG AND SIX
   EXISTING ASSERTIONS SAID SO.** `NO_RHYME_KEY` is a property of the CALL,
   not of the draft — the caller passed no phonology, which is ONE fact that
   `bridge_contrast` already states once as `CHANNEL_NOT_MEASURED`.
   Collecting it per returning function turns one fact into N records, the
   exact inflation `song_function_report`'s counting docstring records being
   bitten by (`asked 3, answered -1, refused 4`), and §19's "a partly-refused
   question is one refused question, not several" is the assertion that
   caught it. The rule that fell out and is now written down: **a refusal
   ABOUT THE DRAFT is collected; a refusal ABOUT THE CALL is not.** Scoped
   that way the collection costs zero test churn. `STUB_RETURN` is skipped in
   `reprise_findings` alone, where `REPRISE_STUB` already says it in that
   function's own vocabulary. `quality/test_grid.py` §25.
   **THE SAME OBJECT'S THIRD STATE — `Return.rhyme_scheme_preserved`'s FALSE.**
   The paragraph above collects that field's CANNOT TELL. Its TRUE reached the
   quality ladder as `RHYME_PRESERVING_REWRITE` and **its FALSE reached no
   quality, no kind and no finding** — only `describe()`, which no grading path
   calls. Measured on two songs identical but for one end word: every caller
   came back BYTE-IDENTICAL, so "the chorus came back on a different rhyme
   scheme" was answered on every run of the loop and told to nobody.
   `RETURN_SCHEME_DRIFT` closes it, as the fourth member of the
   `RETURN_LENGTH_DRIFT`/`METER`/`SLOT` family — *this returning function does
   not hold one X across its returns*, one channel over. **NOT a quality and
   not a kind**, and doctrine 24 is why rather than why not: the ladder answers
   WHAT SURVIVED, and a rewrite that broke its rhyme still survived as
   `PARTIAL_RETURN`, so relabelling it by what FAILED would delete the
   observation that something held.
   **THE GATE WAS MEASURED BEFORE IT WAS WRITTEN, and it is the positive's own
   gate with the opposite answer** — equal line counts, at least one line
   moved. Over `corpus/song/`: 1,920 return pairs, 947 hold, 949 CANNOT TELL,
   24 FALSE. Ungated it fires on all 24 and **twenty of them differ only in
   LINE COUNT** (`ABCD -> A`, `A -> AA` — Durfey's burdens printed short on the
   return), which the ladder already names `TRUNCATED_RETURN`/`EXTENDED_RETURN`
   and which charges a length fact to the rhyme layer (doctrine 79). Gated it
   fires on **4 (0.21%)**: Scott's `AB -> AA` x3 and Hart's `ABAC -> ABCB`.
   All four are already `REWRITTEN_RETURN`, whose own gloss says the harness
   cannot choose between "a chorus that rewrites" and "a mark grouping two
   different sections" — **so the printed corpus bounds the false-positive side
   and does not supply the positive one**, the same limit
   `CROSS_FUNCTION_REPRISE` states. The target population is the REVISION LOOP,
   where a half-rewritten chorus is the ordinary output and lands on
   `PARTIAL_RETURN`/`HEAD_PRESERVED` with nothing saying the rhyme went.
   **IT FIRES ON ONE OF THE FOUR SHIPPED BLUEPRINTS AND IT IS A TRUE POSITIVE**
   — `moonlight_fixture`'s verse 1 is ABAB (frame/name `EY M`, cold/told
   `OW L D`) and verse 2 is ABCB (hand `AE N D` against can `AE N`). The key is
   an IDENTITY key, stricter than the graded band, and its `declared_name` says
   so inside the evidence, so the finding claims "not preserved under
   perfect-rhyme identity" and never "does not rhyme". Same shape as this
   entry's SHAPE layer: not untested, firing on the repo's own fixtures and
   reporting to nobody.
   **A NOTE, and this is the one most likely to be promoted later** because it
   is about RHYME and rhyme is what the mandate flags. It must not be:
   `return_findings` is never handed a mandate, so everything it says is
   measured against `POPULAR_SONG` and doctrine 6 applies — and **the flag for
   this already exists one layer down**, as `RETURN_NOT_VERBATIM` on a return
   the writer DECLARED with `schemes.Return(verbatim=True)`. `reprise_findings`
   does NOT get it: a reprise's own gloss is "later and CHANGED" and names no
   channel it must hold. The triple is unmoved (a finding is not a refusal),
   verified either side. `quality/test_grid.py` §26.
   **AND `Return.line_runs` HAD ZERO READERS** — production, tests,
   `describe()` — while `invariant_runs`, the MINIMUM over it, was printed.
   SURFACED rather than deleted: a reader shown `(0, 0)` could not tell one
   line that shares nothing from a block that shares nothing. §26b.

## The doctrine index — every number, and where it lives

`W` = this file, above. `A`–`F` = the part of `quality/METHOD.md`. Nothing is
defined in both places; every `doctrine N` citation anywhere in the repo
resolves through this table.

**The invariant, so it can be checked rather than trusted.** Extract every
`^\d+\. \*\*` between the `<!-- DOCTRINE-BLOCK -->` markers of these two files;
that set must be exactly 1–95, with no number in both. Extract every
`doctrines? N` reference in the repo (with a literal space — `data/`
`concreteness.txt` has a lexicon row `doctrine` TAB `0` that `\s` would read as a
citation); every one must land in that set. At the split there were 1,630
reference sites over 87 distinct numbers across 1,000+ files, so a number
cannot be renumbered — only added.

| # | in | doctrine |
|---:|:---:|---|
| 1 | `W` | Declaration tuple |
| 2 | `W` | Graph first |
| 3 | `W` | Band-pass, TYPED |
| 4 | `W` | Four layers |
| 5 | `W` | Weights are `fitted: false` |
| 6 | `W` | No weighted quality score, ever |
| 7 | `W` | Rejection, not selection |
| 8 | `B` | Never fit on one tradition |
| 9 | `W` | Optimizing toward the phonetic maximum is the slop direction |
| 10 | `B` | The quality layer has NO demonstrated cross-design signal |
| 11 | `B` | One feature has now been caught reading period, not quality (REPINNED 2026-08-13 from ~~"Two features..."~~ — the second was superseded by the cold comparator) |
| 12 | `B` | Wimsatt binding is unsupported here, under two operationalizations |
| 13 | `B` | Any resource used to score a cell must be INDEPENDENT of that cell's label |
| 14 | `B` | A control may not be defined in terms of the quantity it controls |
| 15 | `B` | Text length is a coordinate of the declaration, not a detail |
| 16 | `B` | An uncalibrated threshold does not fail safe, it fails loud — and it fails toward whoever guessed |
| 17 | `B` | A check may be kept after its premise is falsified, but never quoted as if it were not |
| 18 | `B` | A licence granted by pattern must be earned by systematicity |
| 19 | `A` | An argmax over a swept parameter is biased toward whichever end of the sweep has more degrees of freedom, and must be withheld on a null result |
| 20 | `A` | "Inconclusive by construction" is not "null", and collapsing the two is a false negative dressed as a finding |
| 21 | `B` | Removing a floor does not remove COMPENSATION, and they are different defects |
| 22 | `B` | State a threshold as a false-positive rate, not as a point on a scale |
| 23 | `B` | A fix can remove one unconditional gift and hand out another |
| 24 | `W` | When a rule would delete a category, make it RELABEL instead |
| 25 | `A` | Agreement is not evidence, and one channel can need both predicates |
| 26 | `F` | Normalize U+2019 anywhere a word is extracted from text |
| 27 | `A` | A null must not be conditioned on the filter it is calibrating |
| 28 | `A` | Distinguish "none" from "cannot tell", mechanically |
| 29 | `B` | BH and FWER have different resolution requirements, and BH's is brutal |
| 30 | `A` | A powered null is a different claim from an unpowered one |
| 31 | `A` | Run the positive control before believing any null |
| 32 | `W` | A corpus is defined by the property under test, not by a genre or a language |
| 33 | `A` | Correcting across items is not combining evidence across them |
| 34 | `W` | Every corpus file must have a row in data/sources.tsv, including the local ones |
| 35 | `E` | Prominence is not always stress, and faking it is invisible in the numbers |
| 36 | `E` | A rime dictionary is finer than any poet worked to |
| 37 | `W` | Test a phonology against its tradition, not against its own rules |
| 38 | `D` | A writing system can postdate the provenance cutoff, and that is a different trap from a modern edition |
| 39 | `D` | Record a failed source search as a row, not as a memory |
| 40 | `D` | A licence on a compilation is not a licence on its contents, and the two layers separate cleanly |
| 41 | `A` | A positive control can pass for the wrong reason, and only a second control tells you which |
| 42 | `A` | The cross-family replication came back negative, twice |
| 43 | `E` | A checker can implement a tradition's rules and never have read that tradition's language |
| 44 | `W` | The blocker is not always difficulty |
| 45 | `W` | Give a form's checker the language of the form, and make the language a coordinate |
| 46 | `W` | A function-word list is part of a phonology, not an optimisation |
| 47 | `W` | A revision loop that only checks the line it was told to fix is a rubber stamp |
| 48 | `W` | Doctrine 9 is only real once it is mechanical |
| 49 | `D` | Re-test the channel map before believing a NOT-FOUND row |
| 50 | `E` | An orthographic layer can silently destroy the very constraint a cell measures |
| 51 | `D` | Corroboration across repositories can be a single file |
| 52 | `D` | A perfect licence over a destroyed signal is still unusable, and the destruction is channel-specific |
| 53 | `C` | Admissibility is per-RELATION, not per-corpus |
| 54 | `D` | A repo-root LICENSE is a claim about part of the repo |
| 55 | `E` | Punctuation is not metre |
| 56 | `A` | A search over placements needs a null under the same search |
| 57 | `A` | An empirical p sitting at 1/(n+1) is reporting the resolution, not the effect |
| 58 | `B` | A recorded COUNT is a threshold nobody wrote down |
| 59 | `C` | Refusing because the ORTHOGRAPHY DOES NOT WRITE THE DECIDING SEGMENT has a measurable cost, and it should be paid in the open (REPINNED 2026-08-13 from ~~"Refusing on SCRIPT..."~~ — the figure was attached to the wrong axis by a factor of 1,754) |
| 60 | `C` | Derive a refusal from what the RELATION needs, not from which relation looks vulnerable |
| 61 | `B` | A rule that fires more often is not a better rule |
| 62 | `W` | The tradition frequently states the rule you were about to invent |
| 63 | `A` | Check whether your null is the identity map before you trust it |
| 64 | `A` | A big true effect and an uninterpretable headline are compatible |
| 65 | `E` | The same mark means opposite things in two languages, and both are right |
| 66 | `F` | A tie broken by iterating a set is a result that does not reproduce |
| 67 | `C` | A refusal rate is not a tax -- measure WHERE it falls |
| 68 | `A` | The identity-map trap has more than one shape |
| 69 | `A` | A null can be a null about the wrong thing |
| 70 | `E` | Modernising an orthography can move it FURTHER from the sound the form constrains |
| 71 | `A` | A negative control that does not separate from its own null is not a negative control |
| 72 | `B` | A calibration measured at n=6 is not a calibration |
| 73 | `A` | A single CV seed is a coin flip reported as a verdict |
| 74 | `A` | Check that your H0 is uniform before quoting a p from it |
| 75 | `A` | A null that is correct for one predicate can MANUFACTURE a null for another |
| 76 | `A` | A null is only as good as the demonstration that the instrument could have found something |
| 77 | `F` | Parallel cells share a scratchpad, so working files must be namespaced |
| 78 | `F` | A parallel round needs one shared channel-map, updated as it runs |
| 79 | `C` | A REFUSAL is not a failure, and putting it in the numerator charges the wrong layer |
| 80 | `D` | Provenance has TWO gates and the author is the cheap one |
| 81 | `D` | Bound a vague life at the END of its window, and say in the row that you did |
| 82 | `E` | A span that belongs to ONE class was applied to all four, and it under-read the line in both directions |
| 83 | `E` | A locator is per-MEMBER, and suffix alignment was the function rather than a parameter of it |
| 84 | `C` | Ask the phonology in its own declared relation — and keep the channel path reachable |
| 85 | `W` | An express NON-COMMERCIAL grant is a rejection, and it has to bind the same way in every language |
| 86 | `E` | Doctrine 50 finally has a POSITIVE instance, and it inverts the reflex |
| 87 | `D` | Doctrine 51's first NEGATIVE instance, and it is the more useful half |
| 88 | `C` | A rime dictionary keyed on ONE orthographic norm silently refuses the character that NAMES a rhyme group |
| 89 | `A` | Report the excess as a SERIES, because a falling raw rate can hide a collapsing constraint |
| 90 | `A` | A null can be RIGHT and the statistic wrong, and only the pairing tells you |
| 91 | `B` | Doctrine 58 gains an axis: a count is a coordinate of the RENDERING, not only of the threshold |
| 92 | `W` | The admissible source and the complete source can be DISJOINT sets |
| 93 | `D` | "Sung in performance" is a claim about practice; the TEXT has to carry a mark of it |
| 94 | `B` | A positive-case suite cannot find a rule that is too GENEROUS |
| 95 | `F` | The alignment defect was in the SHIPPED comparator, not only the taxonomy, and equal-length examples hid it |

**METHOD's parts.** `A` nulls, controls and what a negative result means ·
`B` thresholds, calibration and fitting · `C` refusals and determinacy ·
`D` corpora, provenance, licences and editions · `E` phonology, orthography and
what an edition does to a constraint · `F` instruments, engineering and running
cells in parallel.

**Reading orders, so the appendix is reached on purpose rather than by
accident.** About to write a phonology module: METHOD part E end to end, then
45, 46 and 62 above. About to fetch a corpus: 34, 44, 85 and 92 above, then
METHOD part D. About to report a rate: 79 first, then METHOD parts A and C.
About to move a threshold: METHOD part B, and 5 above. About to believe a null:
31, 71 and 76, in that order.

**Two numbering systems, and they do not collide.** The `Known gaps` list above
runs 1–10 (REPINNED 2026-08-14 from 1–9 when the SHAPE layer closed as entry
10; REPINNED 2026-08-13 from 1–7 before that, when entries 8 and 9 were added
the same day and this sentence was never split, while `verify_doctrines.py` had
been printing `CLAUDE.md's own 1-9 list` on every run — the file's own
instrument contradicting its own prose, which is doctrine 48's failure mode
inside the file that states doctrine 48. THE INSTRUMENT IS THE REASON THIS ONE
DID NOT REPEAT: `verify_doctrines.py` derives the list from this file's own
markdown rather than from a literal, so entry 10 was defined the moment it was
written and no third repin of a hardcoded range was possible) and is cited
elsewhere as `known gap N` (MATRIX_PREREGISTRATION.md,
fit_matrix.py, TIME_PREREGISTRATION.md, test_phon_san.py, test_phonology.py,
test_relations.py, POSITIVE_CONTROL.md, time_layer.py). It is not part of the
doctrine numbering and never was. The doctrine run is delimited in both files by
`<!-- DOCTRINE-BLOCK -->` markers so a checker can tell them apart.
