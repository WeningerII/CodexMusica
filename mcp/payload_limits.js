// These are wire-byte limits. Character counts alone cannot bound encoded JSON.
export const HTTP_REQUEST_BYTES = 2 * 1024 * 1024;
export const STATE_WIRE_BYTES = 1024 * 1024;
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
