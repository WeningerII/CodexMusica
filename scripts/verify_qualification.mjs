// Only a successful trusted workflow supplies this receipt. Bind its exact
// attempt and complete scope to the immutable candidate image before promotion.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// DELIBERATELY A SECOND, INDEPENDENT COPY of scripts/production_qualification
// .py's table -- the deploy verifier re-derives what each component SHOULD have
// run rather than trusting the receipt's own word for it. Two implementations
// are the point; `quality/test_shard.py` §9 is what stops them drifting apart,
// because a drift here fails at DEPLOY time, after a four-hour qualification.
export const MUTATION_SHARDS = 8;
export const COMPONENTS = Object.freeze([
  ...Array.from({ length: MUTATION_SHARDS }, (_, i) => `mutation-${i + 1}`),
  'song',
  'short',
  'curves',
]);
export function expectedCommand(component) {
  return fullCommand(component);
}
function fullCommand(component) {
  const shard = /^mutation-(\d+)$/.exec(component);
  if (shard && Number(shard[1]) >= 1 && Number(shard[1]) <= MUTATION_SHARDS)
    return ['quality/test_mutation.py', `--shard=${shard[1]}/${MUTATION_SHARDS}`];
  if (component === 'song' || component === 'short')
    return [
      'quality/song_profile_calibration.py',
      '--check',
      `--profile=${component}`,
      '--seeds=200',
      '--draws=2000',
    ];
  return ['quality/length_curve_calibration.py', 'check'];
}
export function validateQualification(value, image, verified, repository) {
  const evidence = verified?.qualification;
  if (
    !evidence ||
    value?.version !== 1 ||
    value.completed !== true ||
    value.scope !== 'complete-maintained-mutation-and-calibration-comparisons' ||
    value.repository !== repository ||
    value.run_id !== evidence.run_id ||
    value.run_attempt !== evidence.run_attempt ||
    !Number.isSafeInteger(evidence.run_id) ||
    evidence.run_id < 1 ||
    !Number.isSafeInteger(evidence.run_attempt) ||
    evidence.run_attempt < 1 ||
    value.identity?.commit !== verified.commit ||
    image?.commit !== verified.commit ||
    evidence.commit !== verified.commit ||
    !/^[a-f0-9]{40}$/.test(verified.commit || '') ||
    !/^[a-f0-9]{64}$/.test(value.identity?.source_sha256 || '') ||
    !/^[a-f0-9]{64}$/.test(value.identity?.inputs_sha256 || '') ||
    value.identity.source_sha256 !== image.repository_source_sha256 ||
    JSON.stringify(value.components) !== JSON.stringify(COMPONENTS) ||
    !Array.isArray(value.receipts) ||
    value.receipts.length !== COMPONENTS.length ||
    JSON.stringify(value.receipts.map((r) => r.component).sort()) !==
      JSON.stringify([...COMPONENTS].sort()) ||
    !Array.isArray(value.mutation_inventory) ||
    value.mutation_inventory.length < 1 ||
    new Set(value.mutation_inventory).size !== value.mutation_inventory.length ||
    value.receipts.some(
      (r) =>
        JSON.stringify(r.command) !== JSON.stringify(fullCommand(r.component)) ||
        JSON.stringify(r.inventory) !== JSON.stringify(value.mutation_inventory) ||
        r.status !== 'completed' ||
        r.exit_code !== 0 ||
        r.run_id !== evidence.run_id ||
        r.run_attempt !== evidence.run_attempt ||
        r.repository !== repository ||
        JSON.stringify(r.identity) !== JSON.stringify(value.identity) ||
        JSON.stringify(r.identity_after) !== JSON.stringify(value.identity)
    )
  ) {
    throw new Error(
      'Production requires complete mutation/calibration evidence for this exact source and verified attempt.'
    );
  }
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [receipt, manifest, evidence] = process.argv
      .slice(2)
      .map((p) => JSON.parse(readFileSync(p, 'utf8')));
    validateQualification(receipt, manifest, evidence, process.env.GITHUB_REPOSITORY);
    console.log('Complete maintained comparisons match the verified image source.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
