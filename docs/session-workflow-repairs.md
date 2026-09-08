# Repairs from the Moonshots connector runs

These changes address reproducible implementation failures exposed by the actual
recipe and lyric sessions. Local verification is not a hosted deployment receipt
or a successful paid forty-minute kitchen qualification.

## Fixes

* Native SDK client: new lyrics default to creation mode and use the same
  sweep → screen → program plan → exact-draft grade → revise receipt checks as
  the Gemini host. A model cannot replace the plan with a hand-authored mandate.
  Discovery is still available, and an explicit host `phase: 'edit'` permits
  work on an existing song. Tool arguments cannot select that phase.
* Native continuation: the host stores the exact returned state and run arguments,
  restores them on subsequent calls, rejects conflicting continuation fields,
  and serializes workflow calls. Public surface metadata cannot mutate authority.
* CLI: `--session-file=FILE` is required for creation calls and carries those
  executed receipts across reconnects. Session files contain private continuation
  capabilities; writes are atomic and mode 0600. One process owns a session file;
  concurrent processes writing the same file are not supported.
* Declared-blueprint revision renders section/meter headers through the same
  header builder as generated plans. Repeated section names are matched by their
  start bar as well as name. Current revised words replace blueprint placeholder
  text. No meter is invented for a blueprint that omits one.
* Placement checking forwards the declared dictionary/G2P fallback into its
  English reader. The separately calibrated density/prominence bands keep their
  registered reader. Guessed pronunciation is still an assumption, not a verified
  pronunciation of a person's name.
* An authenticated partial grade is described as incomplete measurement, rather
  than as the harness not answering. Certification remains false.
* Rich compression retains explicitly pinned part descriptors before stock
  descriptors. Browser technique edits now create pins too; a subsequent material
  edit cannot quietly discard that earlier choice. Other formats retain their
  own rendering policies.
* Recipe responses disclose explicit descriptors/prefaces absent literally from
  the output, and identify the shared environment card. These are text-presence
  checks, not proof of acoustic rendering or per-instrument attribution.
* `move_instrument` reorders existing cards without rebuilding them. Omit `before`
  to put the selected card first and make its tradition/environment primary.
* Final recipe renderers enforce even limits smaller than their genre header.
* Sweep predicates accept `sections.verse`, `min_lines.verse`, and
  `max_lines.verse`, and corresponding names for every declared section function.
  For example, `sections.verse=5`, `min_lines.verse=4`, `max_lines.verse=4` asks
  for five four-line verses. These filter generated plans; they do not rank them,
  privilege a meter, or derive lyrics from a recipe.
* The test corpus reader closes its input file explicitly.

## Native CLI usage

Use the same session file throughout a new song:

```sh
node scripts/connector_client.mjs --task=lyrics --session-file=/tmp/song-session.json --call=lyric_sweep --args-file=/tmp/sweep.json --out=/tmp/sweep-result.json
```

Continue with screen, plan, grade and revise using that file. For pasted-song
editing, explicitly choose `--phase=edit`. SDK users retain the connection, or
privately persist `connection.snapshot()` and supply it as `session` on reconnect.
This is trusted host state, not a tool argument to offer the model.

The raw MCP endpoint still exposes independent tools. MCP cannot observe user
intent or prevent a third-party host from ignoring its instructions or printing
text without calling it. Use the maintained client or the Gemini host for
mechanically enforced creation order. A local MCP replay exercises real tools
and graders but does not certify a particular external host's integration.

## Boundaries that must not be disguised as fixes

* `class:ASSONANCE` is the harness's graded nucleus-agreement class. It is not
  exact vowel identity. The surprising prize/house result reproduced on bare
  words too; carrier contamination was not established by that observation.
  Changing the class threshold without recalibration would be a different,
  unverified instrument. Full-line anchor-span searches can differ from standalone
  screening, which is now stated on the tool itself.
* No verified pronunciation declarations for Blundin, Mostaque, or Moonshot were
  supplied. Low fallback guesses are not biographical evidence. The original replay left the homograph
  "record" unresolved and correctly remained uncertified. The pronunciation
  replay now declares the dictionary noun reading and regrades before revision. No guessed names were added
  to the dictionary merely to get a green result.
* The legacy FINISHED stamp denotes a loop stop, and includes its exit and
  uncertainty. It is not certification. Consumers must use the authenticated
  `certified`, coverage, findings, and completion receipt rather than the word
  FINISHED alone.
* Room, chain, stereophonic/panoramic words and turntable descriptions are a text
  recipe. There is no rendered audio here from which to establish a perfect mix,
  performed meter, catchiness, or emotional impact.
* The 1000-character ceiling cannot preserve an unlimited number of instruments
  and explicit details. Missing literal descriptors are disclosed, not silently
  called successful customization. Catalog preface IDs (including `conductors`)
  retain their canonical spelling; no unaudited global rename was made.

## Repeatable verification

`npm run test:session:repairs` exercises real MCP creation receipts/reconnection,
reordering, descriptor-loss disclosure, partial measurement status, blueprint
headers, function-specific predicates, and meter fallback.

`npm run qualify:session:workflow` replays the actual 30-line Moonshots draft
through the maintained client and real sweep, screen, plan, grade and interview
revision tools. It uses no paid model and does not alter continuation state.
Evidence is written beside the checked-in draft. The replay checks that all seven
section headers survive and the unknown-name lower-bound meter refusals disappear
under explicitly selected low fallback. It then declares the noun reading of
"record", regrades, resumes the two actual lyric repairs, and requires exit 0
with complete requested coverage. The original uncertified replay remains as
a counterexample; the new evidence uses the `moonshots-pronunciation-replay` prefix.

See [pronunciation-choices.md](pronunciation-choices.md) for the occurrence-reading
implementation, regression evidence, and certification limits.
