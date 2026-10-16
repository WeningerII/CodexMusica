# I8 header repair and current-main reconciliation

The candidate incorporates main `f4b8415886d4303e1469262be8e0a9bb38880564`
through merge `0645854631ccaaff7ff6e6742a67be1d68766869`, then repairs the
reported I8 minimum without changing the frozen contract. PR #569 remains
stacked on #562. No merge into main or deployment was performed.

## Measured before and after

At 390×844, the same 12-line fixture has **3 → 4** fully readable sung rows,
at rest and after actual touchscreen selection on the first sung row, in
both light and dark themes. Header height is **173 → 146px**. The regression
counts whole row rectangles above the visible dock/navigation boundary and
requires text-position hit testing to reach the editor/overlay. This is a
readable-line assertion, not a header-height proxy.

The CSS change applies only to narrow layouts taller than 600px. At heights
508 and 600, header/body/dock/navigation rectangles are exactly equal before
and after, at rest and caret, in both themes. Workspace information remains
available through the Song actions accessible description and menu label.
All ten menu commands remain reachable by keyboard and scrolling; Escape
closes the menu and returns focus to its opener; Review navigation sends no POST.

The 200% text check doubles captured computed font sizes and line heights
for the Lyrics heading, controls, menu, navigation, and editor text, and
asserts the resulting sizes. It is explicitly **not native browser zoom**.
The four-line minimum is asserted at normal text size; at 200%, checks cover
control access and horizontal overflow. Real-device/browser acceptance
remains independent.

## Local checks

- New readability regression: original bundle fails only the four minimum-line
  assertions; repaired bundle passes eight theme/height/text-size cases.
- Full page regression: 809 assertions pass.
- Shared interaction journeys: 13 pass.
- Loop splice/atomic-return/positive-control sections: 53 assertions pass.
  This is the complete selected sections, not the full loop test suite.
- Frozen V1 reader: 4 tests pass; source identity: 20 assertions pass.
- Authenticated binding pipeline: 3 tests pass.
- Actual page → HTTP → MCP/Python transport: 8 cases pass. Exact repeated-word
  navigation remains UTF-16 `[49,52]`; changed declarations/readings, tampered
  projection, unsupported transformations stay unknown or stale/no-Go.
- Map check and full generated-counter check pass.
- Independent HTML rebuild is byte-identical; source formatting and lint pass.

HTML SHA256: `b05b30fb5e3a75d581ae9d8b463a0819be067cdee497fc33464a10e15256d4d7`.
Baseline HTML SHA256: `ad8332b85263638c5da92b2c0401adad09da70e529720d81b37d4b5d155f19ad`.

Raw logs and JSON here retain local fixture evidence. Transport runs actual
application HTTP/MCP/Python code with fixture-based provider selection; no
provider calls or hosted-service acceptance are claimed. Remote exact-head
CI and independent acceptance are separate gates.
