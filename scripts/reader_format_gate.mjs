// Reader-format gate (#656 Phase B). Once the reader store holds gzip objects
// it writes reader-jobs-v1/store-format.json {"min_reader": "A"}, and an image
// whose reader cannot read gzip must never be promoted onto that store. The
// check lives here, outside the candidate image, because an old image cannot
// know about a format that postdates it. See docs/library-native-design.md,
// "Storage at rest: gzip in two phases".
//
// The candidate's format comes from its image manifest (`reader_format`,
// recorded by image_release.mjs from the image's
// com.codexmusica.reader-format label). The live store's requirement comes
// from GET /library/v1/health -> reader_store.min_reader.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Ordered oldest first. A later format reads every earlier one.
export const READER_FORMATS = Object.freeze(['A']);
export const READER_FORMAT_LABEL = 'com.codexmusica.reader-format';

const rank = (format) => READER_FORMATS.indexOf(format);

// live: { reachable: boolean, minReader: null | string } — minReader is the
// health field's value: null (no marker), a format, or "unknown" (malformed).
// candidate: the manifest's reader_format, or undefined/null when the image
// predates the label.
export function readerFormatDecision(live, candidate) {
  const known = typeof candidate === 'string' && rank(candidate) >= 0;
  if (candidate != null && !known)
    return {
      go: false,
      why: `the candidate declares reader format ${JSON.stringify(candidate)}, which this gate does not know`,
    };
  const required = live?.reachable ? live.minReader : 'unknown';
  if (required === null) return { go: true, why: 'the live store has no format marker' };
  if (required !== 'unknown' && rank(required) < 0)
    return known
      ? {
          go: false,
          why: `the live store requires reader format ${JSON.stringify(required)}, which this gate does not know`,
        }
      : {
          go: false,
          why: `the live store requires reader format ${JSON.stringify(required)} and the candidate declares none`,
        };
  if (required === 'unknown')
    return known
      ? {
          go: true,
          why: `the live store's requirement is unknown, and the candidate reads format ${candidate}, the newest this gate knows of or later`,
        }
      : {
          go: false,
          why: "the live store's format requirement is unknown and the candidate declares no reader format; an image without one cannot read gzip objects",
        };
  if (!known)
    return {
      go: false,
      why: `the live store requires reader format ${required} (reader-jobs-v1/store-format.json) and the candidate declares none. Convert the store with mcp/reader_store_inflate.mjs under the writer lock first, or promote an image that reads ${required}`,
    };
  if (rank(candidate) < rank(required))
    return {
      go: false,
      why: `the live store requires reader format ${required}; the candidate reads only ${candidate}`,
    };
  return {
    go: true,
    why: `the candidate reads format ${candidate}; the live store requires ${required}`,
  };
}

// Health body -> { reachable, minReader }. A body without reader_store comes
// from a server that predates the marker report: it cannot have written a
// marker, so the requirement is null.
export function liveReaderRequirement(body) {
  if (!body || typeof body !== 'object') return { reachable: false, minReader: 'unknown' };
  if (!('reader_store' in body)) return { reachable: true, minReader: null };
  const value = body.reader_store?.min_reader;
  if (value === null) return { reachable: true, minReader: null };
  return { reachable: true, minReader: typeof value === 'string' ? value : 'unknown' };
}

async function fetchHealth(url, timeoutMs = 20_000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [manifestPath, healthUrl] = process.argv.slice(2);
  try {
    if (!manifestPath || !healthUrl)
      throw new Error('Usage: reader_format_gate.mjs IMAGE_MANIFEST LIBRARY_HEALTH_URL');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const body = await fetchHealth(healthUrl);
    const live = liveReaderRequirement(body);
    const decision = readerFormatDecision(live, manifest.reader_format);
    console.log(`${decision.go ? 'READER FORMAT OK' : 'READER FORMAT REFUSED'}: ${decision.why}.`);
    if (!live.reachable) console.log(`  (${healthUrl} did not answer with JSON)`);
    process.exitCode = decision.go ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
