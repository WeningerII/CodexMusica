const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
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
(async () => {
  const { getPlatformProxy } = await import("wrangler");
  const platform = await getPlatformProxy({
    configPath: path.resolve("dist/server/wrangler.json"),
    persist: { path: path.resolve(process.env.LIBRARY_CATALOG_TEST_STATE || ".wrangler/state") },
  });
  const env = {
    ...platform.env,
    ASSETS: {
      async fetch(request) {
        const rel = new URL(request.url).pathname.replace(/^\//, "");
        const file = path.resolve("public", rel);
        if (!file.startsWith(path.resolve("public") + "/"))
          return new Response("", { status: 403 });
        try {
          return new Response(fs.readFileSync(file));
        } catch {
          return new Response("", { status: 404 });
        }
      },
    },
  };
  env.READER_COOKIE_KEY = "test-cookie-key-longer-than-thirty-two-bytes";
  for (const migration of fs
    .readdirSync("drizzle")
    .filter((p) => p.endsWith(".sql"))
    .sort())
    for (const statement of fs
      .readFileSync("drizzle/" + migration, "utf8")
      .replaceAll("--> statement-breakpoint", "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await env.DB.prepare(
        statement
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
    }
  const { handleLibrary } = require("../lib/library-api.ts");
  const { searchText } = require("../lib/library-catalog.ts");
  assert.equal(searchText("  STRAẞE\nStraße "), "strasse strasse");
  assert.notEqual(searchText("café"), searchText("cafe"));
  let n = 0,
    r,
    m;
  do {
    r = await handleLibrary(
      new Request("https://test.invalid/api/library/manifest"),
      env,
    );
    m = await r.json();
    assert.ok(r.status === 200 || r.status === 202, JSON.stringify(m));
    if (n++ % 10 === 0)
      console.log(
        JSON.stringify({
          stage: m.state,
          imported: m.imported,
          total: m.total,
        }),
      );
  } while (m.state !== "ready");
  assert.equal(m.counts.reading_units, 32220);
  assert.equal(m.counts.readable_reading_units, 20865);
  const get = async (route) => {
    const result = await handleLibrary(
      new Request("https://test.invalid/api/library/" + route),
      env,
    );
    return { status: result.status, data: await result.json() };
  };
  const catalog = await get("catalog");
  assert.equal(catalog.data.total, 1476);
  assert.equal(catalog.data.collections.length, 100);
  assert.equal(catalog.data.next_offset, 100);
  const method = await get("methods");
  assert.equal(method.data.counts.schemas, 78);
  assert.equal(method.data.counts.functions, 22);
  const large = await get(
    "readings/reading_e08cee8e-f284-5eff-b7ec-111fef4060a9?offset=22700",
  );
  assert.equal(large.data.line_page.total, 22795);
  assert.equal(large.data.lines.length, 95);
  assert.equal(large.data.line_page.next_offset, null);
  assert.equal(large.data.analysis_scope, "whole_reading_unit");
  const first = await get(
    "readings/reading_e08cee8e-f284-5eff-b7ec-111fef4060a9",
  );
  assert.equal(first.data.lines.length, 250);
  const whole = await get(
    "readings/reading_e08cee8e-f284-5eff-b7ec-111fef4060a9?whole=1",
  );
  assert.equal(whole.data.lines.length, 22795);
  assert.equal(whole.data.snapshot_id, m.snapshot_id);
  assert.equal(
    require("node:crypto")
      .createHash("sha256")
      .update(whole.data.normalized_text)
      .digest("hex"),
    whole.data.normalized_sha256,
  );
  const held = await get("search?availability=held&limit=1");
  assert.equal(held.data.total, 11354);
  const unavailable = await get(
    "readings/" + held.data.items[0].reading_unit_id,
  );
  assert.equal(unavailable.status, 403);
  assert.equal(unavailable.data.error.code, "READING_UNAVAILABLE");
  const quoted = await get("search?q=" + encodeURIComponent('" OR 1=1'));
  assert.equal(quoted.status, 200);
  assert.equal(quoted.data.total, 0);
  const hit = await get("search?q=" + encodeURIComponent("Sin’s rooster"));
  assert.equal(hit.status, 200);
  const labeled = await get(
    "readings/reading_3c5bf756-d01e-5900-b806-c98f94741e2f",
  );
  assert.ok(labeled.data.source_labels.length);
  assert.equal(labeled.data.source_labels[0].physical_line, 104);
  const original = await get(
    "sources/8cae5e7a04eeb236156c13e263241da1041d5c82021e1b8670ae475094ef2086",
  );
  assert.equal(original.status, 200);
  assert.equal(
    require("node:crypto")
      .createHash("sha256")
      .update(original.data.text)
      .digest("hex"),
    original.data.source_sha256,
  );
  console.log(
    JSON.stringify({
      passed: true,
      snapshot: m.snapshot_id,
      full_census: 32220,
      largest_rows: 22795,
      held_rows: 11354,
      registry_schemas: 78,
    }),
  );
  await platform.dispose();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
