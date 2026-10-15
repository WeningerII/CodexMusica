# Live acceptance checklist for the EOD release (H1, P-A, #562)

BB8 wrote this list so that whoever has live access (deployed site, live connector, real devices) can run it in minutes. BB8 cannot reach any of those from its environment. Everything BB8 qualified was local or emulated, and this list covers the gap. Record each step as PASS, FAIL or NOT RUN, with device, browser and time, and post the results on #527.

## 0. Preconditions: the right build is live

1. **Deployed code.** The deployed `codex.html` must be the one built at the commit that was qualified. Fetch the live `codex.html` and compare its sha256 with the qualified head's `codex.html`. If they differ, stop: everything below would be testing something else.
2. **Connector.** The live connector at `https://mcp.codexmusica.com/mcp` must run the same harness commit. If the server card or the deploy log names a commit, record it.

## 1. H1: a declared rhyme on a repeated multi-reading word is judged

Run this through the live connector, as an edit of pasted lyrics: `begin_lyrics` with `phase: "edit"`, then `lyric_check`.

- **Lyrics:** `Read--read, read it again` / `the bed is made for me`
- **Declarations:** groups `1.T2,2.T2`, relation `perfect rhyme`, default lexicon basis.
- **PASS:** the rhyme obligation for lines 1–2 is answered, and `blocking` doesn't list it as refused or unjudged.
- **FAIL:** the obligation is refused, or `SCHEME_UNREADABLE` appears. That is what `b887e5ef` does.
- **Repeat** with `Lead--lead, lead the way` / `the bed is made for me`.
- **Control, must still refuse:** `I 2 love you love` / `the dove above` with an unmarked `1.T3,2.end`. The refusal must ask to declare the numbering.

## 2. P-A: a voices toggle never binds a different word

Run this on the deployed Lyrics page, desktop, with browser developer tools open on the Network tab.

1. Paste this draft:
   ```
   [SETUP — rhyme groups — 1.T4,2.end]
   Oh--oh, (ah) oh my love
   a song for us above
   ```
   Leave "parentheses are sung" (voices) **off**. Press **Run review** once. That send is a migration boundary: the row should now read `1.T5,2.end — cut v2` (on a fixed build it may also carry a numbering mark).
2. Set voices to **sung** using the page's own repeats/voices control.
3. Press **Run review** again. In that `/chat` request body, find `context.declarations`.
4. **PASS** is either of these:
   - the request names the word **love** (with v2+voices numbering, `1.T6`);
   - the page or the server refuses and asks you to declare the numbering.
5. **FAIL:** the request carries `1.T5` with `numbering: "v2+voices"`, because that binds **my**. This is what `b887e5ef` does.
6. **Reverse direction:** start with voices **sung** and the same legacy row, then switch voices **off**. The same pass and fail rule applies.

## 3. #562: editing controls and viewport on real devices

Use a real phone in portrait and landscape, plus a desktop browser. Record the model, OS and browser for each.

1. **Gate visible.** Make a change that leaves pending edits, then press Run review from the Review panel. The warning, **Apply all** and **Cancel all** must be fully on screen without scrolling, with focus on Apply all. Check portrait, landscape, and a short window (about 500–600 px tall).
2. **Cancel focus.** Press Cancel. Focus must return to the button that opened the gate, and must not drop to the page.
3. **Keyboard rise.** Tap into a line near the bottom of a long draft. When the on-screen keyboard opens, that line must stay visible above the bottom bar.
4. **Typing straight away** (the known minor case). Tap a low line and type immediately as the keyboard opens. Note whether the line ends up hidden under the bottom bar. This is a known minor issue; record how often it happens on a real keyboard.
5. **No snapping.** Scroll away from the caret, then let the URL bar collapse or expand, or rotate the device. The view must stay where you scrolled. It must not jump back to the caret.
6. **Reading position.** With nothing focused, rotate or resize across about 600 px of height. The same lyric line must stay in view.
7. **Screen reader** (VoiceOver or TalkBack). When the gate opens, it must be announced, and Apply all and Cancel must each be reachable and named.
8. **IME.** With a Japanese or Chinese input method, compose a word on a low line while the keyboard is up. The composed text must commit to the right line.

## 4. Not live-facing in this release

- **#561** (blank-replacement guard): the reviser's internals, covered by tests. There's no live step.
- **#563** (importer bytes): build-time only.
- **#564** (M25): unqualified, and not part of this release.

## Where the local evidence is

- H1, P-A and #561 probes: `probes/`.
- #562 reviews: `review_562/` (including `rev2/` and `rev3/`).
- Main-branch review: `review_b887e5ef/`.
