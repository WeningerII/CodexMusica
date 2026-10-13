# Lyrics: tools, review and recovery — design discussion

Scope: this session owns six-tool discovery/use, findings and suggestions, version validity, interrupted-run recovery and responsive access. The companion session owns start/import, brief, editor, section navigation and writer interaction. **Design only; await 3PO’s shared image concepts, visual critique/consensus and persistent Claude review of both PRs before implementation.**

## Observed evidence

Investigated main `fce4bf0f1b4b274d1c44c67831a6e40b22a8802c`, repository instructions, [UI foundation](ui-foundation.md), [capability inventory](../tests/ui_capability_inventory.md), and the repository lyric-workflows skill. Workspace `.agents` was empty. Ran the shipped `codex.html` locally in system Chromium: `node scripts/check_lyrics_page.js --shots=/tmp/lyrics-evidence` passed **214 assertions**. All service replies were fixtures; this does not establish live-service reliability or usability with John.

Additional captures use the same fixture song and existing page, actual tool clicks, a pending bars edit (8 → 10), and an explicitly injected unknown-request state. No prototype or production code changed. Desktop: 1440×900; phone: 390×844. Recovery screenshot demonstrates rendering, not a real recovered request.

| Tool | Capability to preserve |
| --- | --- |
| Form & story | Section order, duplicate/remove, name/line target, story jobs/junctions/notes; structural edits remap line references. Story is creative guidance. |
| Rhymes | Declared links, line/word placement, Any/Rhyme/Assonance/Consonance/custom relations; writer options labeled matched/partial/refused, without automatic insertion. |
| Rhythm | Meter, bars, pickup, copy across sections; line start/duration in beats or bars; optional declared melody. No assumed tempo or performance certification. |
| Pronunciation | Exact sung-word selection; dictionary alternatives, sourced custom ARPABET, uncertainty and removal; changed text requires choosing again. |
| Repeats & voices | Detected exact repeats versus declared/placed returns; parenthesised words as unsung aside or sung second voice. |
| Word rules | Required/avoided phrases checked by exact wording; no prose-quality judgment. |

Source: [tool renderers](https://github.com/WeningerII/CodexMusica/blob/fce4bf0f1b4b274d1c44c67831a6e40b22a8802c/src/pages/lyrics.js#L3138).

Observed friction (design interpretation, not a user-study result):

- [Form & story](lyrics-tools-review-evidence/desktop-form-story.png) and [Rhythm](lyrics-tools-review-evidence/desktop-rhythm-pending.png) replace the editor on desktop; other tools occupy the inspector. Rhythm shows both “Save rhythm” and pending “Apply”; its edited field and committed table display different bar counts. Melody is nested beneath a tool whose entry label omits it.
- [Stale review](lyrics-tools-review-evidence/desktop-stale-review.png) puts coverage and an earlier-result card before the suggestion; the suggestion actions are below this viewport. A version identifier alone does little to explain the next action.
- [Phone tools](lyrics-tools-review-evidence/phone-tools.png) expose all six entries, but [expanded Rhythm](lyrics-tools-review-evidence/phone-rhythm-pending.png) spends most of the initial viewport on header/navigation. The pending strip further reduces visible editing space. History is reached through Writer.
- [Unknown outcome](lyrics-tools-review-evidence/desktop-unknown-outcome.png) correctly prioritizes retrieving a saved result; ordinary conversation controls remain visible underneath.

## Proposed direction for shared concepts

1. Keep the six named tools, adding short task examples and an explicit melody cue. Preserve the selected section/line/word context. Give large tools an obvious “Back to lyrics” route; compare this with a contextual inspector concept before choosing the layout.
2. Use one consistent pending-change presentation with explicit scope, Apply/Discard and validation beside the field. Distinguish “saved on this device” from “applied to lyrics.” Preserve edits across tool switches, one-step Undo for Apply, and changed-target refusal. Audit placement/melody subforms as well as the six top-level tools.
3. Lead Review with a plain-language version state and the next useful action; place actionable findings/suggestions before detailed coverage. Keep original/proposed text, Show in draft, Keep mine, Apply change, Write my own and stale Recheck accessible. Keep local exact-text checks visibly separate from server review.
4. Surface unfinished-work status wherever a new tool request could start. Unknown outcome → retrieve; safe checkpoint → resume; changed draft → explain restore versus new work. Preserve old runs in History and never retry uncertain work automatically. Coordinate this status treatment with the writer owner.
5. Retain Song/Tools/Writer/Review on narrow screens, with discoverable History. Compare a compact tool header and contextual return with the current accordion. Validate expanded tools, pending/error states and recovery at narrow widths, keyboard focus and enlarged text—not only the six-item index.

## Non-negotiable truth and design handoff

Pending entries, committed document, writer run and review validity remain distinct. Review sends committed content; pending changes offer Apply all / Review saved version / Cancel. Certification requires matching actual server completion and the exact document version; text, headers and declarations matter. Stale suggestions require recheck; a recovered draft without its request baseline is an unchecked replacement. Preserve incomplete/refused/not-requested coverage, story as guidance and performance as not assessed. No invented score, percentage, melody certification or guaranteed completion. See [version/review logic](https://github.com/WeningerII/CodexMusica/blob/fce4bf0f1b4b274d1c44c67831a6e40b22a8802c/src/pages/lyrics.js#L2610) and [recovery UI](https://github.com/WeningerII/CodexMusica/blob/fce4bf0f1b4b274d1c44c67831a6e40b22a8802c/src/pages/lyrics.js#L3699).

Use existing `.cm-*` components, `--cm-*` tokens, typography, line icons, restrained cards, blue actions and light/dark themes. Preserve Library provenance and explicit recipe context. 3PO’s concepts should cover blank start, active writing, advanced tool, pending changes, stale review, interrupted writer and mobile. Agree the return-to-editor pattern and state hierarchy across both lanes, then assign exact `lyrics.js` function ownership/integration order. No shared-engine, dictionary, recipe, deployment or merge work is included.
