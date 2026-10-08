// Integration through the shipped controller and actual local D1/R2 bindings.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
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
  const { getPlatformProxy } = await import("wrangler"),
    platform = await getPlatformProxy({
      configPath: path.resolve("dist/server/wrangler.json"),
      persist: { path: path.resolve(".wrangler/state") },
    }),
    env = {
      ...platform.env,
      READER_COOKIE_KEY: "test-cookie-key-longer-than-thirty-two-bytes",
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
    const { handleLibrary } = require("../lib/library-api.ts"),
      manifest = await (
        await handleLibrary(
          new Request("https://test.invalid/api/library/manifest"),
          env,
        )
      ).json();
    assert.equal(manifest.state, "ready");
    let cookie = "";
    async function call(route, method = "GET", body, otherViewer = false) {
      const response = await handleLibrary(
        new Request("https://test.invalid/api/library/" + route, {
          method,
          headers: {
            origin: "https://test.invalid",
            ...(otherViewer ? {} : { cookie }),
            "content-type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
      );
      if (!otherViewer && response.headers.has("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      return response;
    }
    const post = async (ids) => {
      const r = await call("exports", "POST", {
        snapshot_id: manifest.snapshot_id,
        reading_unit_ids: ids,
        format: "json",
      });
      return { status: r.status, data: await r.json() };
    };
    assert.equal((await post([])).status, 400);
    assert.equal((await post(["reading_unknown"])).status, 409);
    const held = await (await call("search?availability=held&limit=1")).json();
    assert.equal((await post([held.items[0].reading_unit_id])).status, 409);
    assert.equal(
      (
        await call("exports", "POST", {
          snapshot_id: manifest.snapshot_id,
          reading_unit_ids: "all",
          format: "invalid",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("metadata/" + held.items[0].reading_unit_id)).status,
      200,
    );
    const output =
      process.env.LIBRARY_EXPORT_TEST_OUTPUT ||
      "/workspace/scratch/a7ae1e66a2d6/site-export-api-verification";
    fs.mkdirSync(output, { recursive: true });
    const id = "reading_3c5bf756-d01e-5900-b806-c98f94741e2f",
      metadata = await (await call("metadata/" + id)).json(),
      reading = await (await call("readings/" + id + "?whole=1")).json(),
      hashes = [];
    for (const format of ["text", "json", "csv"]) {
      let result = await (
        await call("exports", "POST", {
          snapshot_id: manifest.snapshot_id,
          reading_unit_ids: [id, id],
          format,
        })
      ).json();
      assert.equal(result.progress.total, 1);
      assert.equal(
        (await call("exports/" + result.export_id, "GET", undefined, true))
          .status,
        404,
      );
      assert.equal(
        (await call("exports/" + result.export_id + "/download")).status,
        409,
      );
      let steps = 0;
      while (result.state !== "ready") {
        const r = await call(
          "exports/" + result.export_id + "/step",
          "POST",
          {},
        );
        assert.ok(r.status === 200 || r.status === 202, await r.clone().text());
        result = await r.json();
        assert.ok(++steps < 100);
      }
      const bytes = Buffer.from(
        await (
          await call("exports/" + result.export_id + "/download")
        ).arrayBuffer(),
      );
      fs.writeFileSync(path.join(output, format + ".zip"), bytes);
      hashes.push({
        format,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        steps,
      });
      assert.equal(
        (await call("exports/" + result.export_id + "/step", "POST", {}))
          .status,
        200,
      );
      await env.DB.prepare("UPDATE library_exports SET expires=? WHERE id=?")
        .bind("2000-01-01T00:00:00Z", result.export_id)
        .run();
      assert.equal((await call("exports/" + result.export_id)).status, 410);
    }
    const projected = await (
        await call(
          "search?q=" +
            encodeURIComponent("Sin's rooster's crowed") +
            "&limit=20",
        )
      ).json(),
      hit = projected.items.find((r) => r.reading_unit_id === id);
    assert.ok(hit?.search_hit);
    assert.equal(hit.search_hit.physical_line, 104);
    assert.equal(
      hit.search_hit.row_offset,
      reading.lines.findIndex((l) => l.id === hit.search_hit.line_id),
    );
    assert.ok(
      hit.search_hit.source_ranges.every((r) => r.codepoint_range[0] >= 4241),
    );
    fs.writeFileSync(
      path.join(output, "expected.json"),
      JSON.stringify({
        id,
        metadata,
        reading,
        hashes,
        snapshot: manifest.snapshot_id,
      }),
    );
    console.log(
      JSON.stringify({
        passed: true,
        snapshot: manifest.snapshot_id,
        formats: hashes,
        held_body_refused: true,
        cross_viewer_refused: true,
        expired_refused: true,
        search_source_row: 104,
      }),
    );
  } finally {
    await platform.dispose();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
