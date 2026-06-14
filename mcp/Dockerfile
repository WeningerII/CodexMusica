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

ENV PORT=8080
EXPOSE 8080
WORKDIR /app/mcp
CMD ["node", "server_http.js"]
