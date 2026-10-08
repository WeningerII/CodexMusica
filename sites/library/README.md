# Codex Musica Library

The approved Library frontend is a standalone Vinext/React Cloudflare Worker. The static Codex Musica website keeps its existing Library-to-Lyrics handoff; this application owns its reading, search, comparison, rights, analysis and export surfaces.

## Source and release

The application comes from the approved private Site source commit `940dcdc1019aafbb2c92e9b7d11ad22364d5ed6e`. The server routes, UI, artwork credits, database migrations and dependency lock are preserved here. The reviewed release remains at <https://codex-musica-corpus.tonybolognamacaroni.chatgpt.site>. Merging this directory does not change that Site's audience.

The approved backend engine is `ceab2d61b79006621570bdd8a40b3fb5f69f9329`. Its catalog snapshot is `5226b4fbe427848759a626560b18b361990ef8c80debece031d770e363febc9e`: 32,220 metadata entries, 20,865 readable units, 11,354 held units and one research-only unit. This is an immutable release pin, not a claim about the newer corpus on main.

Backend releases retain this approved snapshot beside the current catalog. The retained assets come from the exact previously qualified image and are admitted into the release inventory with their original hashes and rights boundaries. Production qualification exercises a native reader request against both catalogs, so a newer corpus cannot silently invalidate this Site's pinned requests.

Generated catalog packs and complete download parts are deliberately excluded from Git. They come from the backend's source, identity and rights pins; every staged pack is checked against its hashes. The dedicated Library workflow regenerates the qualified catalog from its historical inputs before the full local database/storage checks. The public static build and Render connector image do not bundle this frontend or its generated assets.

## Install and check

Run from the repository root with Node 22.13 or newer and the package's pinned pnpm version:

```sh
corepack enable
corepack pnpm --dir sites/library install --frozen-lockfile
corepack pnpm --dir sites/library run typecheck
corepack pnpm --dir sites/library run test:packages
corepack pnpm --dir sites/library run build
```

The package's full catalog and export tests require generated catalog assets first. After staging the qualified snapshot, run from the repository root:

```sh
corepack pnpm --dir sites/library run test:catalog
corepack pnpm --dir sites/library run test:exports
```

The package manager establishes the application as the tests' working directory. Run those two tests sequentially because they share the local D1/R2 state.

## Catalog staging and downloads

The backend module `lyric-harness/library/catalog.py` builds the canonical rights-filtered snapshot. `lyric-harness/library/catalog_site_export.py` creates bounded compressed transport packs. `sites/library/scripts/stage-library.py` accepts a separate export directory and its canonical snapshot directory, verifies every referenced pack, and creates the application catalog assets. Keep export input separate from its destination: staging replaces the generated catalog directory.

Whole-corpus Text, JSON and CSV packages are built and verified by `lyric-harness/library/catalog_downloads.py`. Attach its package descriptors to the staged bootstrap, then use `sites/library/scripts/publish-library-packages.py` to stage the bounded parts in the Site's durable storage. Its credentials arrive through hidden standard input and are never saved in this repository. The approved release already has all 60 parts verified in storage; runtime download preparation verifies each referenced part again.

## Runtime and publishing

The existing Sites project and logical D1/R2 bindings are declared in `sites/library/.openai/hosting.json`. Preserve that identity when publishing. Use the Sites hosting workflow from this package directory; a GitHub merge or Pages publication does not deploy this Worker.

Configure only server-side runtime values through Sites:

| Variable | Purpose |
| --- | --- |
| `READER_BRIDGE_URL` | Qualified backend's HTTPS origin. |
| `READER_SITE_ID` | This Site's existing project ID. |
| `READER_BRIDGE_SECRET` | Shared signing key for the private backend bridge and package staging. |
| `READER_COOKIE_KEY` | Private viewer-cookie signing key, at least 32 characters. |

The backend must use matching bridge configuration and include this catalog snapshot, either as its current catalog or as an admitted retained snapshot. Viewer cookies isolate analysis jobs and exports. Whole readings and source downloads enforce their recorded rights; held metadata never grants access to a held body. No runtime secrets, private viewer cookies, generated database state or build output belong in source control.

## Completed live acceptance

The approved private release reconciled its full catalog census. Its complete Text (63,566,109 bytes), JSON (305,245,659 bytes) and CSV (117,510,644 bytes) downloads matched their complete-package SHA256 hashes. A finished whole-reading analysis reconciled all 246 evidence pages and 2,073 records, with no pending methods and zero provider calls. Unknown or unsupported obligations remained explicit refusals. A second viewer could not read the job, and a held reading returned no body.

These receipts describe the reviewed release; they do not replace the required checks for later edits.
