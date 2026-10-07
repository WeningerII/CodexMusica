// These are wire-byte limits. Character counts alone cannot bound encoded JSON.
// RAISED 2026-10-04 with STATE_DECODED_BYTES (mcp/state_codec.js, 512 KiB
// -> 1152 KiB, x2.25), from ~~2 * 1024 * 1024~~ and ~~1 * 1024 * 1024~~. The
// wire allowance stays TWICE the decoded bound — a decoded state of nothing
// but quotes and backslashes doubles when JSON-escaped (test_chat_production's
// maximum recovery export) — and a request stays twice the wire allowance.
export const STATE_WIRE_BYTES = (2 * 1024 + 256) * 1024;
export const HTTP_REQUEST_BYTES = (4 * 1024 + 512) * 1024;
export const STATE_MAX_CHARS = STATE_WIRE_BYTES - 2;
export function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}
export function assertStateFits(value, label = 'state') {
  if (jsonBytes(value) > STATE_WIRE_BYTES)
    throw new Error(
      label +
        ' exceeds its encoded JSON wire-byte allowance (' +
        STATE_WIRE_BYTES +
        '); no unresendable continuation is accepted.'
    );
  return value;
}
