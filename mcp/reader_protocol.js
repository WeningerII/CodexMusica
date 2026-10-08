// Portable signing contract: this module also runs in the Site's edge runtime.
export const READER_CONTRACT_VERSION = 1;
export const READER_BODY_BYTES = 2 * 1024 * 1024;

export function canonicalReaderQuery(search = '') {
  const seen = new Set();
  const entries = [];
  for (const [key, value] of new URLSearchParams(search)) {
    if (seen.has(key))
      throw Object.assign(new Error('Repeated query fields are not permitted.'), {
        code: 'BAD_SIGNATURE',
      });
    seen.add(key);
    entries.push([key, value]);
  }
  entries.sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  return new URLSearchParams(entries).toString();
}

// Hashes are lowercase SHA-256 hex of exact request/capability UTF-8 bytes.
// No final newline. Empty optional bindings remain empty lines.
export function canonicalReaderSigningInput({
  method,
  path,
  body_sha256,
  capability_sha256,
  site = '',
  viewer = '',
  job = '',
  attempt = '',
  generation = '',
  idempotency = '',
  time,
  nonce,
}) {
  const url = new URL(path, 'https://reader.invalid');
  return [
    'reader-v1',
    String(method).toUpperCase(),
    url.pathname,
    canonicalReaderQuery(url.search),
    body_sha256,
    site,
    viewer,
    job,
    String(attempt),
    String(generation),
    idempotency,
    capability_sha256,
    String(time),
    nonce,
  ].join('\n');
}
