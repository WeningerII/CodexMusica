# Build once in CI, qualify this image ID, and promote its registry digest.
# Official node:22.23.2-bookworm-slim manifest, verified 2026-09-08.
FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS runtime-base
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/mcp
COPY mcp/package.json mcp/package-lock.json ./
RUN npm ci --omit=dev
COPY mcp/requirements-runtime.txt ./
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    --only-binary=:all: --require-hashes -r requirements-runtime.txt

FROM runtime-base AS assets
WORKDIR /source
COPY lyric-harness ./lyric-harness
RUN cd lyric-harness \
 && python3 -c "import lyric_harness; lyric_harness.fetch_data()" \
 && python3 quality/fetch_data.py --runtime \
 && python3 quality/release_assets.py --assemble /runtime/lyric-harness \
 && python3 quality/release_assets.py --root /runtime/lyric-harness \
      --staged-data /runtime/lyric-harness/data --check

FROM runtime-base AS production
WORKDIR /app
COPY scripts ./scripts
COPY references ./references
# `capacity_verification.json*` is an OPTIONAL seed for the proof layer below:
# CI restores the newest receipt it has banked to that path before building
# (ci.yml, "Restore the newest capacity receipt"); a checkout without one
# copies nothing, and the glob is what makes an absent seed a no-op rather
# than a failed COPY. The exact file is git-ignored and its siblings
# (`.part`, `.bak`) are docker-ignored, so nothing ships either by accident.
COPY mcp/*.js mcp/production-config.json mcp/capacity_verification.json* ./mcp/
COPY mcp/worker.py mcp/gemini_proposer.py ./mcp/
# Only approved runtime assets reach a final layer; research corpora and optional
# uncleared norms remain outside the deployed image.
COPY --from=assets /runtime/lyric-harness ./lyric-harness
ARG RENDER_GIT_COMMIT=""
ARG BUILD_RELEASE_ID=""
RUN node -e 'const fs=require("fs"); const commit=process.env.RENDER_GIT_COMMIT, release_id=process.env.BUILD_RELEASE_ID; if(!/^[a-f0-9]{40}$/.test(commit||"") || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(release_id||"")) throw new Error("A full commit and unique CI release ID are required"); fs.writeFileSync("/app/mcp/build_identity.json",JSON.stringify({version:1,commit,release_id})+"\n",{mode:0o444});'
# A proof generated in another Python build cannot authorize this runtime.
# Verify every reviewed witness against the final assembled source/data tree;
# retain a separate deterministic receipt without restamping reviewed assets.
#
# --workers=4 SINCE 2026-09-09, AND THIS LAYER IS WHY IT MATTERS MOST.
# MEASURED from CI run 34358366237's BuildKit step timings: this RUN was
# 938.7s of a 968s build -- 97.0% of it. Every other layer combined is under
# 30s (apt 10.3s, npm ci 1.5s, pip 2.3s, the asset assembly 2.1s), so this
# build was never a caching problem ~~and a build cache would have bought
# nothing worth having~~. It was one serial pool.
#
# AND AT FOUR WORKERS IT WAS STILL 95% OF THE BUILD, ON EVERY RUN SINCE.
# MEASURED 2026-09-10: 619.5s of a 647s build (run 34466733505) and 418.3s of
# 450s (run 34436957228). The struck sentence was true of a LAYER cache --
# this RUN sits below two per-run ARGs, so BuildKit could never have reused
# it -- and wrong about what a cache is for. The receipt is a pure function of
# what `certification_identity` reads (source ASTs, lexical data, judge
# tables, declarations, the exact interpreter build) plus the table bytes,
# and no field of it is a timing, so a receipt that passes the admission the
# server runs at boot IS the receipt this run would have written. So since
# 2026-09-10 (M-267) the layer admits before it measures: CI seeds the path
# with the newest receipt it has banked (see the COPY above), and
# `--reuse-valid` keeps it if and only if `require_current_proof` -- the
# boot-time check, unchanged -- accepts it for THIS interpreter, THIS source
# tree and THIS table. Anything else, including no seed at all, measures
# exactly as before. A seed from another Python build is refused by the same
# line that refuses it at boot, which is the sentence at the top of this
# comment. WHAT THE ADMISSION DOES NOT LOOK AT is the layers under this one
# -- the base image, the pinned wheels, the staged assets other than the two
# lexical files -- and that is guarded by WHERE CI takes the seed from: its
# cache prefix hashes this Dockerfile, requirements-runtime.txt and
# data/runtime_assets.json, so a seed is only ever restored from a build of
# the same layers. A seed supplied by hand to a local build has no such
# guard: take it only from an image built from the same three files.
#
# The 81 witnesses are independent, `pool.map` preserves the order they were
# sorted into, and no witness record carries a timing -- so the receipt this
# layer bakes in is the same receipt either way. Verified directly rather than
# argued: the first 16 certified witnesses produce byte-identical records
# serially and at 4 workers, and a full 81/81 run at --workers=4 completed in
# 9m58s wall against 25m57s of CPU. The 45m bound stays: it bounded the serial
# cost and it bounds this one with more room, and a bound lowered on a single
# measurement is a flake waiting for a slow runner.
RUN cd /app/lyric-harness \
 && timeout --signal=TERM --kill-after=15s 45m python3 quality/verify_capacity.py \
      --output /app/mcp/capacity_verification.json --workers=4 --reuse-valid
ENV BUILD_GIT_COMMIT=$RENDER_GIT_COMMIT
ENV RENDER_GIT_COMMIT=$RENDER_GIT_COMMIT
ENV LYRIC_RELEASE_ASSETS_REQUIRED=1
ENV PORT=8080
EXPOSE 8080
WORKDIR /app/mcp
CMD ["node", "server_http.js"]
