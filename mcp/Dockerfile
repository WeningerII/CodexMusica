# CodexMusica MCP server — Streamable HTTP.
#
# Build from the REPO ROOT (the server imports ../scripts and ../references):
#   docker build -f mcp/Dockerfile -t codex-mcp .
#   docker run -p 8080:8080 codex-mcp
#
# Runs the Node engine UNCHANGED — works on any container host:
# Cloudflare Containers, Render, Fly, Railway, or a plain VPS.
FROM node:22-slim

# Install runtime deps first for layer caching.
WORKDIR /app/mcp
COPY mcp/package.json mcp/package-lock.json ./
RUN npm ci --omit=dev

# Engine + catalog (imported via ../scripts and ../references) and the server source.
WORKDIR /app
COPY scripts ./scripts
COPY references ./references
COPY mcp/*.js ./mcp/
# THE WARM WORKER IS A .py FILE AND THE GLOB ABOVE IS *.js, so from M-155
# (2026-08-29) to 2026-09-01 every image built from this file lacked
# mcp/worker.py, and the connector's own fallback hid it: a spawn that fails
# is the cold execFile with byte-identical output, so production answered
# every verb cold, the M-167 replay memo never engaged, and no gate could see
# it — M-170's audit found the line by reading it (`MISSING.md` M-187).
# mcp/test.mjs now derives the runtime list from `git ls-files mcp/` and holds
# this file's COPY set to it, so the next non-.js runtime file cannot repeat
# this. MEASURED BEFORE SHIPPING, on this file's 2 GB history (M-157), seed 31
# (22 lines; `scripts/measure_verb_memory.py --seed=31`, cold `--verb=both`
# and `--worker --rounds=3`): cold grade 666 MB / revise 665 MB; through ONE
# worker over plan, fill and three grade+revise rounds, peak 661 MB — the same
# process doing the same work — with 594 MB RETAINED after the first round
# and 602 MB after the third (+8 MB across two more rounds; 638 MB at most
# between calls), and the second and third revise calls 6.4 s and 4.3 s
# against 76.8 s for the first, which is the memo engaging. Safe at 2 GB
# because the residual lives INSIDE the process whose peak the gate banks
# (scripts/check_deploy_memory.js: 882 MB x 2.0 = 1,764 MB required of
# 2,048): mcp/lyric_tools.js SIGKILLs the worker on every path that falls
# back cold, so the box never holds a warm worker BESIDE a cold child at
# peak. `LYRIC_WORKER=0` in the service's env is the documented switch if a
# live measurement ever says otherwise.
COPY mcp/worker.py ./mcp/

# The lyric harness (mcp/lyric_tools.js runs it as python3 subprocesses —
# pure stdlib except nltk, which the slop floor's POS tagger reaches through
# quality/features.py). Staging mirrors CI's revision-loop job exactly:
# fetch_data() downloads CMUdict, quality/fetch_data.py stages the tagger
# model and concreteness norms into data/. All at BUILD time so a running
# container makes no network calls (openWorldHint stays false).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*
COPY lyric-harness ./lyric-harness
RUN python3 -m pip install --no-cache-dir --break-system-packages nltk \
 && cd lyric-harness \
 && python3 -c "import lyric_harness; lyric_harness.fetch_data()" \
 && python3 quality/fetch_data.py

ENV PORT=8080
EXPOSE 8080
WORKDIR /app/mcp
CMD ["node", "server_http.js"]
