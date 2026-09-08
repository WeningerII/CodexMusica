# Production and historical dependency retirement

This follow-up changes local code after the production audit's recorded verification
commit. Earlier audit test results remain evidence for that earlier commit; they do
not certify this revision or the live deployment.

## Production configuration

`mcp/production-config.json` is the desired service/resource/environment contract.
Readiness comparisons, battery timeout calculation and the memory gate consume it.
The Dockerfile ships it and the runtime source fingerprint covers its exact bytes.
The legacy `render.yaml` remains a migration reference only. A transition test binds
its environment, tier and disk to the contract; it is not a second deployment path.
Existing tests reading the Blueprint remain transition checks until its retirement.

Removal condition: publish and qualify an actual image, migrate the service while
preserving URL, signing key, receipts and spending ledger, disable old Blueprint
synchronization and deploy hooks, and verify effective settings and recovery. Then
replace the legacy Blueprint with the reviewed image-service declaration and remove
the legacy parser/parity tests. No digest or successful migration is assumed here.
Remove the dashboard's obsolete `CHAT_MAX_TURNS_PER_DAY` override during that
transition. Retain tested deployed/rollback image digests and compatible durable
state; do not retain a source rebuild route as a rollback mechanism.

## Resource profiles

From `lyric-harness/`, `python3 quality/fetch_data.py` now stages production inputs
only. `--runtime` explicitly names the same default. `--research` additionally stages
current optional research inputs such as concreteness; it does not stage the legacy
tagger or Punkt. Their records moved out of the active manifest into
`lyric-harness/quality/archive/retired-lexical-assets.json`. Historical implementation
remains in Git; no extra legacy installer is maintained. The two current flags
are mutually exclusive. Research profiles do not change the manifest's
redistribution decisions or authorize including those resources in a release.
Current full research CI opts into `--research`; connector setup and Docker use
`--runtime`. Normal setup no longer downloads optional historical packages.

| Retained item | Concrete purpose | Boundary and retirement condition |
| --- | --- | --- |
| `data/structure_census_eng.tsv` | Historical structure measurement; `quality/test_structure_census.py` exercises its artifact arm. | Research only. Preserve bytes until a versioned replacement retains the old experiment's provenance and those checks are deliberately migrated. |
| `data/kalevala_alliteration_pairs.tsv` | Calibration output produced by `quality/kalevala_calibration.py`; records the researched population. | Research only. Keep the generator and source/provenance record with the frozen output. Regenerating against today's corpus is not proof of reproducing an old snapshot. |
| Archived legacy tagger and Punkt records | Exact URLs/hashes preserve historical source identity. | Removed from the active manifest and both staging profiles. No maintained consumer was found. Historical executable setup remains in Git rather than an active fallback. |
| Concreteness metadata/input | `quality/features.py` still exposes concreteness research features. | Research opt-in; clearance remains unresolved in the manifest. Removing it outright would remove an existing research capability. |

The historical tables retain their existing locations because generators, artifact
checks and provenance refer to those paths. Moving them cosmetically would break
reproduction without reducing production contents: the release assembler already
excludes them and rejects research or undeclared files in the assembled image.
Historical evidence is not a fallback implementation. There is no runtime switch
that reads these tables merely because the current implementation fails.

## Verification and remaining work

Verified locally: 75 offline Node tests and the Python control groups (16, 7, 5,
and 6 tests); 20 connector contract tests including Blueprint/config parity and
source fingerprint mutation; three targeted resource staging/refusal regressions; six battery lifecycle/storage
tests (including the 43-control lifecycle instrument); memory admission; lint,
format and document checks. After moving the retired manifest entries, all five
runtime-asset tests and the three staging/refusal tests passed again; the full
offline count above belongs to the preceding integration step. These checks validate
local changes only.
GitHub publication, hosted CI, target Docker qualification and the service migration
remain pending; neither a configuration file nor a comment disables a remote hook.
