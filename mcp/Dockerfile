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
