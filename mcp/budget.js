// budget.js — THE ONE TOOL BUDGET (`MISSING.md` M-165).
//
// Two layers used to hold two separately-spelled clocks over the same work:
// chat.js waited CHAT_TOOL_TIMEOUT_MS (default 240s) for a tool call while
// lyric_tools.js killed the python underneath it at its own 180s constant —
// a wall sitting UNDER the caller's declared patience, so the subprocess
// died for work its own caller had another minute of budget for, and the
// model was handed exit -1 for a call that was legitimately still working.
// Round 8 of the flash battery measured the cost (run 33253826300): EIGHT
// consecutive lyric_revise kills in one turn, 25.6 minutes, MAX_TURN_COST —
// the round's whole remaining budget spent earning the same kill. One
// definition now, read by both layers, so the two clocks cannot drift
// (doctrine 1 at the connector).
//
// THE DEFAULT IS DERIVED FROM THE DEFERRED-RUN REPLAY'S OWN MEASURED
// GROWTH, not guessed: lyric_revise's defer: shape replays every folded
// answer before asking the next question, and the replay grows with the
// record — measured across rounds 6 and 8 at ~34s to the first question
// and ~15s more per folded answer, so it crosses 180s by roughly answer 10.
// A 22-line song's clean run needs on the order of 35-40 answers (a fold
// per flagged line, several lines re-asked), putting the last replays near
// 34 + 15 x 38 ≈ 600s. The budget is set AT that envelope rather than 2x
// over it because the sum it feeds is already margin-checked one layer up:
// the battery's turn deadline is maxSteps x this value, and the workflow's
// own timeout carries the 2x. "Eventually free the box" (the constant's
// standing job since lyric_tools.js first declared it) still holds — the
// bound is ten minutes, not never.
export const DEFAULT_TOOL_BUDGET_MS = 600_000;

// The env override keeps its historical name: CHAT_TOOL_TIMEOUT_MS is what
// render.yaml pins and what an operator has always reached for. Same
// semantics as chat.js's num() helper — a finite positive number wins, any
// other spelling falls back to the derived default.
const env = Number(process.env.CHAT_TOOL_TIMEOUT_MS);
export const TOOL_BUDGET_MS = Number.isFinite(env) && env > 0 ? env : DEFAULT_TOOL_BUDGET_MS;
