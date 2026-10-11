// Capture the Worker's own answers on the pinned catalog as permanent goldens.
//
// The native Library tab re-implements search, reading pages, hit projection,
// held metadata and selection ZIPs on Render (mcp/library_*.js). Before this
// Worker is retired, its shipped controller answers a fixed request set
// (tests/library/goldens/<snap>/queries.json, written by
// library-golden-queries.py) through the real local D1/R2 bindings, exactly as
// test-library-export-api.cjs drives it. The native routes must reproduce
// every answer byte for byte; the goldens outlive sites/library.
//
//   node scripts/capture-library-goldens.cjs QUERIES.json OUT_DIR
//
// Run after `pnpm run build` with the catalog staged by stage-library.py.
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  crypto = require("node:crypto"),
  ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );

const [queriesFile, outDir] = process.argv.slice(2);
if (!queriesFile || !outDir) {
  console.error(
    "usage: node scripts/capture-library-goldens.cjs QUERIES.json OUT_DIR",
  );
  process.exit(2);
}
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const gzipJsonl = (rows) =>
  zlib.gzipSync(rows.map((r) => JSON.stringify(r)).join("\n") + "\n", {
    level: 9,
  });

// The ZIP's central directory names every entry; list them so a byte mismatch
// later can be traced to the entry that moved.
function zipEntries(bytes) {
  const names = [];
  let eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let count = bytes.readUInt16LE(eocd + 10),
    offset = bytes.readUInt32LE(eocd + 16);
  const z64 = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
  if (z64 >= 0 && (count === 0xffff || offset === 0xffffffff)) {
    count = Number(bytes.readBigUInt64LE(z64 + 32));
    offset = Number(bytes.readBigUInt64LE(z64 + 48));
  }
  for (let i = 0; i < count; i++) {
    const n = bytes.readUInt16LE(offset + 28),
      x = bytes.readUInt16LE(offset + 30),
      c = bytes.readUInt16LE(offset + 32);
    names.push(bytes.subarray(offset + 46, offset + 46 + n).toString("utf8"));
    offset += 46 + n + x + c;
  }
  return names;
}

(async () => {
  const queries = JSON.parse(fs.readFileSync(queriesFile, "utf8"));
  const { getPlatformProxy } = await import("wrangler"),
    platform = await getPlatformProxy({
      configPath: path.resolve("dist/server/wrangler.json"),
      persist: { path: path.resolve(".wrangler/state") },
    }),
    env = {
      ...platform.env,
      READER_COOKIE_KEY: "golden-capture-cookie-key-longer-than-32-bytes",
      ASSETS: {
        async fetch(request) {
          const file = path.resolve(
            "public",
            new URL(request.url).pathname.slice(1),
          );
          return file.startsWith(path.resolve("public") + "/") &&
            fs.existsSync(file)
            ? new Response(fs.readFileSync(file))
            : new Response("", { status: 404 });
        },
      },
    };
  try {
    for (const file of fs
      .readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      for (const sql of fs
        .readFileSync("drizzle/" + file, "utf8")
        .replaceAll("--> statement-breakpoint", "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await env.DB.prepare(
          sql
            .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
            .replace(
              /CREATE UNIQUE INDEX /g,
              "CREATE UNIQUE INDEX IF NOT EXISTS ",
            )
            .replace(/CREATE INDEX /g, "CREATE INDEX IF NOT EXISTS ")
            .replace(
              /CREATE VIRTUAL TABLE /g,
              "CREATE VIRTUAL TABLE IF NOT EXISTS ",
            ),
        ).run();
    const { handleLibrary } = require("../lib/library-api.ts");
    let cookie = "";
    async function call(route, method = "GET", body) {
      const response = await handleLibrary(
        new Request("https://golden.invalid/api/library/" + route, {
          method,
          headers: {
            origin: "https://golden.invalid",
            cookie,
            "content-type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
      );
      if (response.headers.has("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      return response;
    }
    let manifest = await (await call("manifest")).json();
    for (let i = 0; manifest.state !== "ready"; i++) {
      if (i > 2000) throw new Error("catalog import did not finish");
      manifest = await (await call("manifest")).json();
    }
    if (manifest.snapshot_id !== queries.snapshot_id)
      throw new Error(
        `staged snapshot ${manifest.snapshot_id} is not the queried ${queries.snapshot_id}`,
      );
    fs.mkdirSync(outDir, { recursive: true });

    const search = [];
    for (const q of queries.search) {
      const qs = new URLSearchParams(q.params).toString();
      const r = await call("search" + (qs ? "?" + qs : ""));
      search.push({
        label: q.label,
        params: q.params,
        status: r.status,
        body: await r.json(),
      });
    }
    const readings = [];
    for (const { id, offset } of queries.readings) {
      const r = await call(`readings/${id}?offset=${offset}`);
      readings.push({ id, offset, status: r.status, body: await r.json() });
    }
    const whole = [];
    for (const id of queries.whole_readings) {
      const r = await call(`readings/${id}?whole=1`);
      const bytes = Buffer.from(await r.arrayBuffer());
      whole.push({ id, status: r.status, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const metadata = [];
    for (const id of queries.metadata) {
      const r = await call("metadata/" + id);
      metadata.push({ id, status: r.status, body: await r.json() });
    }
    const exports = [];
    for (const selection of queries.exports)
      for (const format of ["text", "json", "csv"]) {
        let result = await (
          await call("exports", "POST", {
            snapshot_id: manifest.snapshot_id,
            reading_unit_ids: selection.ids,
            format,
          })
        ).json();
        for (let steps = 0; result.state !== "ready"; steps++) {
          if (steps > 500) throw new Error(`export ${selection.label} stalled`);
          result = await (
            await call("exports/" + result.export_id + "/step", "POST", {})
          ).json();
        }
        const bytes = Buffer.from(
          await (
            await call("exports/" + result.export_id + "/download")
          ).arrayBuffer(),
        );
        exports.push({
          label: selection.label,
          ids: selection.ids,
          format,
          bytes: bytes.length,
          sha256: sha256(bytes),
          entries: zipEntries(bytes),
        });
      }

    fs.writeFileSync(path.join(outDir, "search.jsonl.gz"), gzipJsonl(search));
    fs.writeFileSync(path.join(outDir, "readings.jsonl.gz"), gzipJsonl(readings));
    fs.writeFileSync(path.join(outDir, "metadata.jsonl.gz"), gzipJsonl(metadata));
    fs.writeFileSync(
      path.join(outDir, "exports.json"),
      JSON.stringify({ whole_readings: whole, exports }, null, 1) + "\n",
    );
    const files = {};
    for (const f of [
      "queries.json",
      "search.jsonl.gz",
      "readings.jsonl.gz",
      "metadata.jsonl.gz",
      "exports.json",
    ])
      files[f] = sha256(
        fs.readFileSync(
          f === "queries.json" ? queriesFile : path.join(outDir, f),
        ),
      );
    fs.writeFileSync(
      path.join(outDir, "capture.json"),
      JSON.stringify(
        {
          snapshot_id: manifest.snapshot_id,
          captured_by: "sites/library/scripts/capture-library-goldens.cjs",
          worker: "sites/library/lib/library-api.ts (shipped controller, local D1/R2)",
          counts: {
            search: search.length,
            readings: readings.length,
            whole_readings: whole.length,
            metadata: metadata.length,
            exports: exports.length,
          },
          files,
        },
        null,
        1,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        snapshot: manifest.snapshot_id,
        search: search.length,
        readings: readings.length,
        exports: exports.map((e) => `${e.label}/${e.format} ${e.sha256.slice(0, 12)}`),
      }),
    );
  } finally {
    await platform.dispose();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
