// A remote, encrypted pre-dispatch record survives complete runner loss.
// Local runs opt out; the hosted paid workflow requires this boundary.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sealArchive } from './battery_archive.mjs';

export async function archiveBeforeDispatch(
  source,
  { required = false, upload = null, timeoutMs = 60_000 } = {}
) {
  if (!required && !upload) return null;
  if (!upload && (!process.env.ACTIONS_RUNTIME_TOKEN || !process.env.ACTIONS_RESULTS_URL)) {
    throw new Error(
      'Remote recovery is required, but the Actions artifact service is unavailable; no request sent.'
    );
  }
  const directory = mkdtempSync(join(tmpdir(), 'battery-remote-'));
  try {
    const archive = join(directory, 'battery-recovery.enc');
    const manifest = sealArchive({ source, out: archive });
    const name = `flash-battery-checkpoint-${Date.now()}-${randomUUID()}`;
    if (!upload) {
      const { DefaultArtifactClient } =
        await import('./battery-actions/node_modules/@actions/artifact/lib/artifact.js');
      const client = new DefaultArtifactClient();
      upload = (...args) => client.uploadArtifact(...args);
    }
    let timer;
    let result;
    try {
      result = await Promise.race([
        upload(name, [archive], directory, { retentionDays: 7, compressionLevel: 0 }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error('Remote recovery upload exceeded its deadline; no request sent.')),
            timeoutMs
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!Number.isSafeInteger(result?.id) || result.id <= 0) {
      throw new Error('Remote recovery archive was not acknowledged; no request sent.');
    }
    return { artifact_id: result.id, name, ...manifest };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
