import { projectSearchHit } from "./search-hit";
import { importPackagePart } from "./library-package-import";
import { handleExport, createAnalysisExport } from "./library-exports";
import {
  canonical,
  hmac,
  randomHex,
  readerHeaders,
  sha256,
} from "./reader-crypto";
import type { ReaderJob, ResultManifest } from "./library-types";

import {
  activeSnapshot,
  bootstrap,
  synchronize,
  objectJSON,
  readingPage,
  wholeReading,
  originalSource,
  storage as getStorage,
  failure as fail,
  searchText,
  type LibraryBindings as Bindings,
} from "./library-catalog";
type BindingRow = {
  id: string;
  viewer: string;
  capability: string;
  record: string;
  request_hash: string;
  idempotency: string;
};
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const validId = (s: string) => /^[a-zA-Z0-9_.:-]{1,200}$/.test(s);
async function viewer(request: Request, env: Bindings) {
  const key = env.READER_COOKIE_KEY ?? env.READER_BRIDGE_SECRET;
  if (!key || key.length < 32)
    throw fail(
      "READER_UNAVAILABLE",
      "Private analysis is not configured.",
      503,
    );
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("__Host-cm_reader="))
    ?.slice(17);
  if (cookie) {
    const [id, sig] = cookie.split(".");
    if (
      /^[a-f0-9]{64}$/.test(id) &&
      sig === (await hmac(key, "viewer-v1:" + id))
    )
      return {
        id: await sha256(id),
        cookie: `__Host-cm_reader=${id}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
      };
  }
  const id = randomHex();
  return {
    id: await sha256(id),
    cookie: `__Host-cm_reader=${id}.${await hmac(key, "viewer-v1:" + id)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
  };
}
async function backend(
  env: Bindings,
  v: string,
  path: string,
  method = "GET",
  body = "",
  binding?: BindingRow,
  key = "",
) {
  if (
    !env.READER_BRIDGE_URL ||
    !env.READER_BRIDGE_SECRET ||
    !env.READER_SITE_ID
  )
    throw fail(
      "READER_UNAVAILABLE",
      "The analysis service is not configured.",
      503,
    );
  const base = new URL(env.READER_BRIDGE_URL);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw fail(
      "READER_UNAVAILABLE",
      "The configured analysis address is invalid.",
      503,
    );
  const job = binding ? (JSON.parse(binding.record) as ReaderJob) : undefined;
  const headers = await readerHeaders(
    env.READER_BRIDGE_SECRET,
    {
      site: env.READER_SITE_ID,
      viewer: v,
      job: binding?.id,
      attempt: job?.attempt,
      generation: job?.generation,
      idempotency: key,
      capability: binding?.capability,
    },
    method,
    path,
    body,
  );
  const r = await fetch(new URL(path, base), {
    method,
    headers,
    ...(body ? { body } : {}),
  });
  if (!r.ok) {
    const data = (await r
      .json()
      .catch(() => ({
        error: {
          code: "READER_UNAVAILABLE",
          message: "The analysis service did not answer.",
        },
      }))) as { error?: { code: string; message: string; remedy?: string } };
    throw fail(
      data.error?.code ?? "READER_ERROR",
      data.error?.message ?? "Analysis failed.",
      r.status,
      data.error?.remedy,
    );
  }
  return r;
}
async function boundJob(env: Bindings, id: string, v: string) {
  const row = await getStorage(env)
    .db.prepare("SELECT * FROM library_jobs WHERE id=? AND viewer=?")
    .bind(id, v)
    .first<BindingRow>();
  if (!row)
    throw fail(
      "NOT_FOUND",
      "This analysis is unavailable for this viewer.",
      404,
    );
  return row;
}
async function refreshJob(env: Bindings, v: string, row: BindingRow) {
  const response = await backend(
    env,
    v,
    `/internal/reader/jobs/${row.id}`,
    "GET",
    "",
    row,
  );
  const data = (await response.json()) as { job: ReaderJob };
  await getStorage(env)
    .db.prepare(
      "UPDATE library_jobs SET record=?,accessed=? WHERE id=? AND viewer=?",
    )
    .bind(JSON.stringify(data.job), new Date().toISOString(), row.id, v)
    .run();
  row.record = JSON.stringify(data.job);
  return data.job;
}
async function verifiedPull(
  env: Bindings,
  v: string,
  row: BindingRow,
  path: string,
  hash: string,
  kind: string,
) {
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw fail("BAD_REQUEST", "An immutable result hash is required.");
  const { db, bucket } = getStorage(env);
  const key = `private/${v}/${row.id}/${kind}/${hash}.json`;
  const receipt = await db
    .prepare("SELECT hash FROM library_receipts WHERE key=? AND viewer=?")
    .bind(key, v)
    .first<{ hash: string }>();
  if (receipt) {
    const object = await bucket.get(key);
    if (object) {
      const bytes = new Uint8Array(await object.arrayBuffer());
      if ((await sha256(bytes)) === hash) return bytes;
    }
  }
  const result = await backend(env, v, path, "GET", "", row);
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (
    bytes.length > 2 * 1024 * 1024 ||
    result.headers.get("x-reader-sha256") !== hash ||
    (await sha256(bytes)) !== hash
  )
    throw fail(
      "STORAGE_CORRUPT",
      "Analysis evidence failed checksum validation.",
      503,
    );
  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { sha256: hash },
    });
    await db
      .prepare(
        "INSERT INTO library_receipts (key,hash,job,viewer,created) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET hash=excluded.hash WHERE library_receipts.hash=excluded.hash",
      )
      .bind(key, hash, row.id, v, new Date().toISOString())
      .run();
  } catch {
    console.warn(
      "Library cache temporarily unavailable; returning verified backend bytes.",
    );
  }
  return bytes;
}
export async function handleLibrary(
  request: Request,
  env: Bindings,
): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname;
  if (!path.startsWith("/api/library/")) return null;
  let cookie: string | null = null;
  try {
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !== url.origin
    )
      throw fail(
        "BAD_ORIGIN",
        "A same-origin Library request is required.",
        403,
      );
    const { db } = getStorage(env);
    if (
      !/^\/api\/library\/(analyses|jobs|exports)(\/|$)/.test(path) &&
      request.method !== "GET"
    )
      throw fail("METHOD_NOT_ALLOWED", "Use GET to read Library records.", 405);
    if (path === "/api/library/manifest") {
      const b = await bootstrap(env),
        current = await db
          .prepare("SELECT snapshot FROM library_active WHERE slot=1")
          .first<{ snapshot: string }>();
      if (current?.snapshot !== b.manifest.snapshot_id) {
        const status = await synchronize(env);
        if (!status.ready) return json({ state: "staging", ...status }, 202);
      }
      const active = await activeSnapshot(env);
      return json({
        ...active.manifest,
        state: "ready",
        analysis_available: !!(
          env.READER_BRIDGE_URL && env.READER_BRIDGE_SECRET
        ),
      });
    }
    if (path === "/api/library/catalog" || path === "/api/library/methods") {
      const { snapshot } = await activeSnapshot(
        env,
        url.searchParams.get("snapshot"),
      );
      const value = await objectJSON<{
        collections: unknown[];
        [key: string]: unknown;
      }>(
        env,
        `snapshots/${snapshot}/${path.endsWith("methods") ? "methods" : "index"}.json`,
      );
      if (path.endsWith("methods")) return json(value);
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Math.min(250, Number(url.searchParams.get("limit") ?? 100));
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(limit) ||
        limit < 1
      )
        throw fail("BAD_QUERY", "Invalid catalog page.");
      const collections = value.collections.slice(offset, offset + limit);
      const page = () => ({
        ...value,
        collections,
        total: value.collections.length,
        next_offset:
          offset + collections.length < value.collections.length
            ? offset + collections.length
            : null,
      });
      while (
        collections.length > 1 &&
        new TextEncoder().encode(JSON.stringify(page())).length >
          2 * 1024 * 1024
      )
        collections.pop();
      return json(page());
    }
    if (path === "/api/library/search") {
      const { snapshot } = await activeSnapshot(
        env,
        url.searchParams.get("snapshot"),
      );
      const q = searchText(url.searchParams.get("q") ?? "");
      if (q.length > 500)
        throw fail(
          "BAD_QUERY",
          "Search queries may contain at most 500 characters.",
        );
      const limit = Math.min(250, Number(url.searchParams.get("limit") ?? 100)),
        offset = Number(url.searchParams.get("offset") ?? 0);
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw fail("BAD_QUERY", "Invalid search page.");
      const where = ["r.snapshot=?"],
        args: unknown[] = [snapshot];
      for (const [field, col] of [
        ["language", "language"],
        ["availability", "availability"],
        ["completeness", "completeness"],
      ] as const) {
        const value = url.searchParams.get(field);
        if (value && value !== "all") {
          where.push(`r.${col}=?`);
          args.push(value);
        }
      }
      const work = url.searchParams.get("work");
      if (work) {
        where.push("r.work=?");
        args.push(work);
      }
      const collection = url.searchParams.get("collection");
      if (collection) {
        where.push(
          "EXISTS (SELECT 1 FROM json_each(r.collections) WHERE value=?)",
        );
        args.push(collection);
      }
      const contributor = url.searchParams.get("contributor");
      if (contributor) {
        where.push("instr(lower(r.contributor),?)>0");
        args.push(searchText(contributor));
      }
      const join = "";
      if (q) {
        where.push(
          "(instr(r.title,?)>0 OR instr(r.contributor,?)>0 OR instr(r.body,?)>0)",
        );
        args.push(q, q, q);
      }
      const sort =
        url.searchParams.get("sort") === "contributor"
          ? "r.contributor,r.title,r.id"
          : "r.title,r.id";
      const from = `FROM library_readings r${join} WHERE ${where.join(" AND ")}`;
      const rows = await db
        .prepare(
          `SELECT r.metadata,substr(r.body,1,180) AS snippet,instr(r.body,?) AS body_position ${from} ORDER BY ${sort} LIMIT ? OFFSET ?`,
        )
        .bind(q, ...args, limit, offset)
        .all<{ metadata: string; snippet: string; body_position: number }>();
      const total = await db
        .prepare(`SELECT count(*) AS n ${from}`)
        .bind(...args)
        .first<{ n: number }>();
      const items: Record<string, unknown>[] = [];
      for (const row of rows.results) {
        const item = JSON.parse(row.metadata);
        const hit =
          q && row.body_position > 0 && item.availability === "readable"
            ? await projectSearchHit(
                env,
                snapshot,
                item.reading_unit_id,
                row.body_position - 1,
                Array.from(q).length,
              )
            : null;
        items.push({
          ...item,
          snippet: hit?.snippet ?? row.snippet,
          search_hit: hit,
        });
      }
      const payload = () => ({
        snapshot_id: snapshot,
        items,
        total: total?.n ?? 0,
        next_offset:
          offset + items.length < (total?.n ?? 0)
            ? offset + items.length
            : null,
      });
      while (
        items.length > 1 &&
        new TextEncoder().encode(JSON.stringify(payload())).length >
          2 * 1024 * 1024
      )
        items.pop();
      if (
        new TextEncoder().encode(JSON.stringify(payload())).length >
        2 * 1024 * 1024
      )
        throw fail(
          "RESOURCE_LIMIT",
          "This metadata record exceeds the page byte budget.",
          413,
        );
      return json(payload());
    }
    const metadata = path.match(
      /^\/api\/library\/metadata\/([A-Za-z0-9_.:-]+)$/,
    );
    if (metadata) {
      const { snapshot } = await activeSnapshot(
        env,
        url.searchParams.get("snapshot"),
      );
      const row = await db
        .prepare(
          "SELECT metadata FROM library_readings WHERE snapshot=? AND id=?",
        )
        .bind(snapshot, metadata[1])
        .first<{ metadata: string }>();
      if (!row)
        throw fail("NOT_FOUND", "This record is not in the snapshot.", 404);
      return json(JSON.parse(row.metadata));
    }
    const original = path.match(/^\/api\/library\/sources\/([a-f0-9]{64})$/);
    if (original) {
      const { snapshot } = await activeSnapshot(
        env,
        url.searchParams.get("snapshot"),
      );
      return json(await originalSource(env, snapshot, original[1]));
    }
    const read = path.match(/^\/api\/library\/readings\/([A-Za-z0-9_.:-]+)$/);
    if (read) {
      const { snapshot } = await activeSnapshot(
        env,
        url.searchParams.get("snapshot"),
      );
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Math.min(500, Number(url.searchParams.get("limit") ?? 250));
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(limit) ||
        limit < 1
      )
        throw fail("BAD_QUERY", "Invalid line page.");
      const r = await readingPage(env, snapshot, read[1], offset, limit);
      if (
        url.searchParams.get("revision") &&
        url.searchParams.get("revision") !== r.reading_revision
      )
        throw fail("STALE_READING", "The reading revision changed.", 409);
      if (url.searchParams.get("whole") === "1")
        return wholeReading(env, snapshot, read[1]);
      return json(r);
    }
    const importedPart = await importPackagePart(request, env);
    if (importedPart) return importedPart;
    const v = await viewer(request, env);
    cookie = v.cookie;
    let response: Response;
    if (path.startsWith("/api/library/exports")) {
      const r = await handleExport(
        request,
        env,
        v.id,
        async (jobId, hash, offset) => {
          const row = await boundJob(env, jobId, v.id);
          const refs = (await (
            await backend(
              env,
              v.id,
              `/internal/reader/jobs/${jobId}/manifests/${hash}/pages?offset=${offset}&limit=1`,
              "GET",
              "",
              row,
            )
          ).json()) as { page_refs: { sha256: string }[] };
          if (refs.page_refs.length !== 1)
            throw fail(
              "STORAGE_CORRUPT",
              "The analysis export page reference is missing.",
              503,
            );
          return verifiedPull(
            env,
            v.id,
            row,
            `/internal/reader/jobs/${jobId}/pages/${refs.page_refs[0].sha256}?manifest=${hash}`,
            refs.page_refs[0].sha256,
            "pages",
          );
        },
      );
      if (!r) throw fail("NOT_FOUND", "Unknown export route.", 404);
      if (cookie) r.headers.set("Set-Cookie", cookie);
      r.headers.set("Cache-Control", "private, no-store");
      return r;
    }
    if (path === "/api/library/analyses" && request.method === "POST") {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024)
        throw fail(
          "RESOURCE_LIMIT",
          "Declarations exceed the analysis request byte limit.",
          413,
        );
      const input = JSON.parse(raw) as {
        snapshot_id: string;
        reading_unit_id: string;
        reading_revision: string;
        idempotency_key: string;
      };
      if (!validId(input.idempotency_key ?? ""))
        throw fail("BAD_REQUEST", "An idempotency key is required.");
      await activeSnapshot(env, input.snapshot_id);
      const r = await db
        .prepare(
          "SELECT revision,availability FROM library_readings WHERE snapshot=? AND id=?",
        )
        .bind(input.snapshot_id, input.reading_unit_id)
        .first<{ revision: string; availability: string }>();
      if (!r || r.revision !== input.reading_revision)
        throw fail(
          "STALE_READING",
          "The requested reading revision is not available.",
          409,
        );
      if (r.availability !== "readable")
        throw fail(
          "READING_UNAVAILABLE",
          "The requested unit is not readable.",
          403,
        );
      const requestHash = await sha256(canonical(input)),
        prior = await db
          .prepare(
            "SELECT * FROM library_jobs WHERE viewer=? AND idempotency=?",
          )
          .bind(v.id, input.idempotency_key)
          .first<BindingRow>();
      if (prior && prior.request_hash !== requestHash)
        throw fail(
          "IDEMPOTENCY_CONFLICT",
          "This retry key was used for different declarations.",
          409,
        );
      if (prior)
        response = json({
          contract_version: 1,
          job: await refreshJob(env, v.id, prior),
        });
      else {
        const upstream = await backend(
          env,
          v.id,
          "/internal/reader/jobs",
          "POST",
          raw,
          undefined,
          input.idempotency_key,
        );
        const result = (await upstream.json()) as {
          job: ReaderJob;
          capability: string;
        };
        const requestBytes = new TextEncoder().encode(raw),
          requestKey = `private/${v.id}/${result.job.id}/request.json`,
          rawHash = await sha256(requestBytes);
        await getStorage(env).bucket.put(requestKey, requestBytes, {
          customMetadata: { sha256: rawHash },
        });
        await db
          .prepare(
            "INSERT OR IGNORE INTO library_receipts (key,hash,job,viewer,created) VALUES (?,?,?,?,?)",
          )
          .bind(
            requestKey,
            rawHash,
            result.job.id,
            v.id,
            new Date().toISOString(),
          )
          .run();
        await db
          .prepare(
            "INSERT INTO library_jobs (id,viewer,capability,idempotency,request_hash,record,accessed) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            result.job.id,
            v.id,
            result.capability,
            input.idempotency_key,
            requestHash,
            JSON.stringify(result.job),
            new Date().toISOString(),
          )
          .run();
        response = json(
          { contract_version: 1, job: result.job },
          upstream.status,
        );
      }
    } else {
      const jobRoute = path.match(
        /^\/api\/library\/(jobs|analyses)\/([A-Za-z0-9_.:-]+)(?:\/(cancel|resume|manifest|results|export))?$/,
      );
      if (!jobRoute) throw fail("NOT_FOUND", "Unknown Library route.", 404);
      if (request.method === "DELETE") {
        const deleted = await db
          .prepare(
            "SELECT id FROM library_deleted_jobs WHERE id=? AND viewer=?",
          )
          .bind(jobRoute[2], v.id)
          .first();
        if (deleted) {
          const r = json({ deleted: true, job_id: jobRoute[2] });
          r.headers.set("Set-Cookie", cookie);
          return r;
        }
      }
      if (!jobRoute[3] && !["GET", "DELETE"].includes(request.method))
        throw fail(
          "METHOD_NOT_ALLOWED",
          "Use GET or DELETE for this analysis.",
          405,
        );
      const row = await boundJob(env, jobRoute[2], v.id);
      if (request.method === "DELETE") {
        await backend(
          env,
          v.id,
          `/internal/reader/jobs/${row.id}`,
          "DELETE",
          "",
          row,
          request.headers.get("idempotency-key") ?? randomHex(16),
        );
        const receipts = await db
          .prepare("SELECT key FROM library_receipts WHERE job=? AND viewer=?")
          .bind(row.id, v.id)
          .all<{ key: string }>();
        for (const r of receipts.results)
          await getStorage(env).bucket.delete(r.key);
        const exports = await db
          .prepare(
            "SELECT id FROM library_exports WHERE viewer=? AND json_extract(record,'$.analysis_job_id')=?",
          )
          .bind(v.id, row.id)
          .all<{ id: string }>();
        for (const e of exports.results) {
          let cursor: string | undefined;
          do {
            const objects = await getStorage(env).bucket.list({
              prefix: `private/${v.id}/exports/${e.id}/`,
              cursor,
            });
            if (objects.objects.length)
              await getStorage(env).bucket.delete(
                objects.objects.map((o) => o.key),
              );
            cursor = objects.truncated ? objects.cursor : undefined;
          } while (cursor);
          await db
            .prepare("DELETE FROM library_exports WHERE id=? AND viewer=?")
            .bind(e.id, v.id)
            .run();
        }
        await db.batch([
          db
            .prepare(
              "INSERT OR IGNORE INTO library_deleted_jobs (id,viewer,deleted) VALUES (?,?,?)",
            )
            .bind(row.id, v.id, new Date().toISOString()),
          db
            .prepare("DELETE FROM library_receipts WHERE job=? AND viewer=?")
            .bind(row.id, v.id),
          db
            .prepare("DELETE FROM library_jobs WHERE id=? AND viewer=?")
            .bind(row.id, v.id),
        ]);
        response = json({ deleted: true, job_id: row.id });
      } else if (
        request.method === "POST" &&
        ["cancel", "resume"].includes(jobRoute[3])
      ) {
        const r = await backend(
          env,
          v.id,
          `/internal/reader/jobs/${row.id}/${jobRoute[3]}`,
          "POST",
          "{}",
          row,
          request.headers.get("idempotency-key") ?? randomHex(16),
        );
        const data = (await r.json()) as { job: ReaderJob };
        await db
          .prepare("UPDATE library_jobs SET record=? WHERE id=? AND viewer=?")
          .bind(JSON.stringify(data.job), row.id, v.id)
          .run();
        response = json(data, r.status);
      } else if (!jobRoute[3])
        response = json({
          contract_version: 1,
          job: await refreshJob(env, v.id, row),
        });
      else {
        const job = await refreshJob(env, v.id, row),
          hash = url.searchParams.get("manifest") ?? job.manifest_hash;
        if (!hash)
          throw fail(
            "RESULT_NOT_READY",
            "No evidence checkpoint is committed yet.",
            409,
          );
        const bytes = await verifiedPull(
          env,
          v.id,
          row,
          `/internal/reader/jobs/${row.id}/manifests/${hash}`,
          hash,
          "manifests",
        );
        const manifest = JSON.parse(
          new TextDecoder().decode(bytes),
        ) as ResultManifest;
        if (
          manifest.job_id !== row.id ||
          (manifest.identity_hash !== job.identity.hash &&
            manifest.identity_hash !== (await sha256(canonical(job.identity))))
        )
          throw fail(
            "STORAGE_CORRUPT",
            "Analysis manifest identity differs from its job.",
            503,
          );
        if (jobRoute[3] === "export") {
          if (request.method !== "POST")
            throw fail(
              "METHOD_NOT_ALLOWED",
              "Use POST to create an analysis export.",
              405,
            );
          const identity = job.identity;
          response = json(
            await createAnalysisExport(
              env,
              v.id,
              String(identity.snapshot_id),
              String(identity.reading_unit_id),
              {
                job_id: row.id,
                manifest_hash: hash,
                manifest_key: `private/${v.id}/${row.id}/manifests/${hash}.json`,
                request_key: `private/${v.id}/${row.id}/request.json`,
                page_count: manifest.page_count,
                partial: manifest.partial,
              },
            ),
            202,
          );
        } else if (jobRoute[3] === "manifest")
          response = json({ ...manifest, manifest_hash: hash });
        else {
          const offset = Number(url.searchParams.get("offset") ?? 0),
            refsResponse = await backend(
              env,
              v.id,
              `/internal/reader/jobs/${row.id}/manifests/${hash}/pages?offset=${offset}&limit=1`,
              "GET",
              "",
              row,
            );
          const refs = (await refsResponse.json()) as {
            page_refs: { sha256: string }[];
            next_offset: number | null;
            total: number;
          };
          const records: unknown[] = [];
          for (const ref of refs.page_refs) {
            const page = await verifiedPull(
              env,
              v.id,
              row,
              `/internal/reader/jobs/${row.id}/pages/${ref.sha256}?manifest=${hash}`,
              ref.sha256,
              "pages",
            );
            records.push(
              ...(
                JSON.parse(new TextDecoder().decode(page)) as {
                  instances: unknown[];
                }
              ).instances,
            );
          }
          response = json({
            manifest_hash: hash,
            partial: manifest.partial,
            instances: records,
            next_offset: refs.next_offset,
            total_pages: refs.total,
          });
        }
      }
    }
    if (cookie) response.headers.set("Set-Cookie", cookie);
    return response;
  } catch (error) {
    const e = error as Error & {
      code?: string;
      status?: number;
      remedy?: string;
    };
    const response = json(
      {
        error: {
          code: e.code ?? "LIBRARY_ERROR",
          message: e.message,
          remedy: e.remedy ?? "Retry explicitly.",
        },
      },
      e.status ?? 500,
    );
    if (cookie) response.headers.set("Set-Cookie", cookie);
    return response;
  }
}
