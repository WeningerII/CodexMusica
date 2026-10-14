// usage: node fp.mjs <TREE>  -> the reader resource fingerprint server_http.js computes
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const tree = process.argv[2];
const { runtimeAssets } = await import(pathToFileURL(path.join(tree, 'mcp/runtime_assets.js')));
const { releaseIdentity } = await import(pathToFileURL(path.join(tree, 'mcp/build_identity.js')));
const a = runtimeAssets();
const commit = releaseIdentity(process.env).commit;
const fp = process.env.READER_RESOURCE_FINGERPRINT || a.assets_sha256 || commit || 'unidentified';
console.log(JSON.stringify({ tree, commit, assets_sha256: a.assets_sha256, manifest_sha256: a.manifest_sha256, ok: a.ok, errors: a.errors, reader_resource_fingerprint: fp }));
