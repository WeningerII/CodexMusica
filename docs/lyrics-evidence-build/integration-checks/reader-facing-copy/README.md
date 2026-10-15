# Reader-facing occurrence labels and refusal reasons

This follow-up addresses release-watch comment 6200421557 on PR #519.
Occurrence choices now use the existing pair-row mapping: `line:0` displays
as `L1`, `line:3` as `L4`. Raw occurrence IDs and line IDs remain unchanged.
The mapping is shared by both views, rather than copied.

Missing-binding explanation: “We couldn’t confirm that these results match
your draft.” Stale explanation: “Your lyrics or reading settings changed.”
These strings also reach the title and accessible name. Binding checks,
refusal states, navigation and marking conditions are unchanged.

The adapter suite passes 13 tests. Running the same assertions against the
old adapter produces two expected failures (11 pass), establishing the old
wording/shared-label difference. Existing refusal tests and new explicit
unknown/stale canGo/canPaint-false assertions pass. The browser inspector
also asserts visible L1 labels, no raw line: labels, and unchanged data IDs.
The adapter suite is now registered in the existing npm CI test chain.

HTML SHA256: `d17e5263b4b08181bb015eb8ee5c1908b11f0ba4760a5211d86edd22242ee257`.
The I8 readable-line suite passes all eight cases on the rebuilt bundle.
Backend implementation remains identical to independently reviewed be96c359.
No provider calls or live acceptance are claimed. This changed page artifact
requires continuing independent wording/chooser review and exact-head CI.

Rebuilt browser checks: inspector **16/16**, page **809 assertions**, readable
lines **8/8**. Independent HTML rebuild is byte-identical; changed source/tests
pass ESLint and Prettier. The red control uses the same tests with only the
adapter read redirected to the committed be96 adapter; no fixture rerecording.
