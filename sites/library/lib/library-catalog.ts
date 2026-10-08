import { sha256 } from "./reader-crypto";
import foldTable from "./unicode-casefold.json";
import type {
  Manifest,
  Reading,
  ReadingLine,
  ReadingSummary,
} from "./library-types";
export interface LibraryBindings {
  DB?: D1Database;
  LIBRARY?: R2Bucket;
  ASSETS?: Fetcher;
  READER_BRIDGE_URL?: string;
  READER_BRIDGE_SECRET?: string;
  READER_SITE_ID?: string;
  READER_COOKIE_KEY?: string;
}
export interface ArtifactRef {
  path: string;
  sha256: string;
  raw_sha256: string;
  raw_bytes: number;
  gzip_sha256: string;
  gzip_bytes: number;
  kind?: string;
  field?: string;
  reading_unit_id?: string;
  value_range?: number[];
  normalized_cp_range?: number[];
  search_cp_range?: number[];
  part_index?: number;
}
export interface Bootstrap {
  manifest: Manifest;
  index: ArtifactRef;
  methods: ArtifactRef;
  result_schema: ArtifactRef;
  references: Record<string, ArtifactRef>;
  chunks: ArtifactRef[];
  whole_sources: Record<string, unknown>;
  exports: Record<string, unknown>;
}
export interface ReadingItem {
  summary: ReadingSummary;
  reading: Reading | null;
  source_labels?: unknown[];
  reading_is_header?: boolean;
  reading_chunks?: Record<string, string[]>;
  reading_parts?: string[];
}
export const failure = (
  code: string,
  message: string,
  status = 400,
  remedy = "Check the input and try again.",
) => Object.assign(new Error(message), { code, status, remedy });
export function storage(env: LibraryBindings) {
  if (!env.DB || !env.LIBRARY)
    throw failure(
      "STORAGE_UNAVAILABLE",
      "The Library storage is unavailable.",
      503,
    );
  return { db: env.DB, bucket: env.LIBRARY };
}
export function searchText(s: string) {
  const map = foldTable as Record<string, string>;
  return Array.from(s.normalize("NFC"))
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}
export async function asset(env: LibraryBindings, path: string) {
  if (!env.ASSETS)
    throw failure(
      "STORAGE_UNAVAILABLE",
      "The immutable catalog assets are unavailable.",
      503,
    );
  const r = await env.ASSETS.fetch(
    new Request("https://assets.invalid/catalog/" + path),
  );
  if (!r.ok)
    throw failure(
      "CATALOG_UNAVAILABLE",
      "The pinned catalog artifact could not be loaded.",
      503,
    );
  return new Uint8Array(await r.arrayBuffer());
}
export async function ungzip(bytes: Uint8Array) {
  return new Uint8Array(
    await new Response(
      new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer(),
  );
}
export async function bootstrap(env: LibraryBindings): Promise<Bootstrap> {
  return JSON.parse(
    new TextDecoder().decode(await asset(env, "bootstrap.json")),
  );
}
export function objectKey(snap: string, path: string) {
  if (
    !/^[a-f0-9]{64}$/.test(snap) ||
    !/^packs\/[a-z_]+-\d+\.json\.gz$/.test(path)
  )
    throw failure("STORAGE_CORRUPT", "Invalid immutable object path.", 503);
  return `snapshots/${snap}/objects/${path}`;
}
async function verifyPacked(packed: Uint8Array, ref: ArtifactRef) {
  if (
    packed.length !== ref.gzip_bytes ||
    (await sha256(packed)) !== ref.gzip_sha256
  )
    throw failure(
      "STORAGE_CORRUPT",
      "A catalog compressed checksum does not match.",
      503,
    );
  const bytes = await ungzip(packed);
  if (bytes.length !== ref.raw_bytes || (await sha256(bytes)) !== ref.sha256)
    throw failure("STORAGE_CORRUPT", "A catalog checksum does not match.", 503);
  return bytes;
}
export async function loadObject<T>(
  env: LibraryBindings,
  snap: string,
  ref: ArtifactRef,
): Promise<T> {
  const obj = await storage(env).bucket.get(objectKey(snap, ref.path));
  if (!obj)
    throw failure(
      "STORAGE_UNAVAILABLE",
      "An immutable source object is unavailable.",
      503,
    );
  return JSON.parse(
    new TextDecoder().decode(
      await verifyPacked(new Uint8Array(await obj.arrayBuffer()), ref),
    ),
  );
}
export function reference(b: Bootstrap, path: string) {
  const ref = b.chunks.find((r) => r.path === path);
  if (!ref)
    throw failure(
      "STORAGE_CORRUPT",
      "A logical source part is not registered.",
      503,
    );
  return ref;
}
export async function logicalField(
  env: LibraryBindings,
  b: Bootstrap,
  item: ReadingItem,
  field: string,
) {
  const paths = item.reading_chunks?.[field];
  if (!paths) return undefined;
  const refs = paths.map((path) => reference(b, path));
  let value: unknown;
  for (let i = 0; i < refs.length; i++) {
    const part = await loadObject<{
      value: unknown;
      part_index: number;
      part_count: number;
      reading_unit_id: string;
      reading_revision: string;
      field: string;
    }>(env, b.manifest.snapshot_id, refs[i]);
    if (
      part.part_index !== i ||
      part.part_count !== refs.length ||
      part.field !== field ||
      part.reading_unit_id !== item.summary.reading_unit_id ||
      part.reading_revision !== item.summary.reading_revision
    )
      throw failure(
        "STORAGE_CORRUPT",
        "Logical source parts do not reconcile.",
        503,
      );
    if (Array.isArray(part.value)) {
      if (!value) value = [];
      (value as unknown[]).push(...part.value);
    } else if (typeof part.value === "string")
      value = (typeof value === "string" ? value : "") + part.value;
    else throw failure("STORAGE_CORRUPT", "Invalid logical source field.", 503);
  }
  return value;
}
export async function synchronize(env: LibraryBindings) {
  const { db, bucket } = storage(env),
    b = await bootstrap(env),
    snap = b.manifest.snapshot_id;
  await db
    .prepare(
      "INSERT OR IGNORE INTO library_snapshots (id,state,manifest,imported,total,created) VALUES (?,?,?,0,?,?)",
    )
    .bind(
      snap,
      "staging",
      JSON.stringify(b.manifest),
      b.chunks.length,
      new Date().toISOString(),
    )
    .run();
  const state = await db
    .prepare("SELECT state FROM library_snapshots WHERE id=?")
    .bind(snap)
    .first<{ state: string }>();
  if (state?.state === "ready") {
    if (!(await bucket.head(`snapshots/${snap}/bootstrap.json`))) {
      const bytes = new TextEncoder().encode(JSON.stringify(b));
      await bucket.put(`snapshots/${snap}/bootstrap.json`, bytes, {
        customMetadata: { sha256: await sha256(bytes) },
      });
    }
    return { ready: true, snapshot_id: snap };
  }
  const completed = await db
      .prepare("SELECT chunk,hash FROM library_imports WHERE snapshot=?")
      .bind(snap)
      .all<{ chunk: number; hash: string }>(),
    done = new Map(completed.results.map((r) => [r.chunk, r.hash]));
  // Finish source fragments before admitting readings that depend on them.
  // Small bounded groups overlap storage latency without retaining the corpus.
  const pending = b.chunks.map((ref, i) => ({ ref, i })).filter(({ ref, i }) => {
    if (done.has(i) && done.get(i) !== ref.sha256)
      throw failure("SNAPSHOT_CONFLICT", "A staged identity changed bytes.", 409);
    return !done.has(i);
  });
  const dependencies = pending.filter(({ ref }) => ref.kind !== "readings");
  const selected = (dependencies.length ? dependencies : pending).slice(0, 36);
  const concurrency = dependencies.length ? 8 : 4;
  const importChunk = async (i: number) => {
    const ref = b.chunks[i];
    if (done.has(i)) {
      if (done.get(i) !== ref.sha256)
        throw failure(
          "SNAPSHOT_CONFLICT",
          "A staged identity changed bytes.",
          409,
        );
      return;
    }
    const packed = await asset(env, ref.path),
      bytes = await verifyPacked(packed, ref),
      pack = JSON.parse(new TextDecoder().decode(bytes));
    if (pack.snapshot_id !== snap)
      throw failure(
        "STORAGE_CORRUPT",
        "Catalog snapshot identities differ.",
        503,
      );
    const key = objectKey(snap, ref.path);
    await bucket.put(key, packed, {
      httpMetadata: { contentType: "application/gzip" },
      customMetadata: { sha256: ref.sha256, gzip_sha256: ref.gzip_sha256 },
    });
    if (ref.kind === "sources") {
      const statements = (
        pack.sources as { path: string; sha256: string; text: string }[]
      ).map((source) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO library_sources (snapshot,sha,path,object_key,hash) VALUES (?,?,?,?,?)",
          )
          .bind(snap, source.sha256, source.path, key, ref.sha256),
      );
      for (let j = 0; j < statements.length; j += 80)
        await db.batch(statements.slice(j, j + 80));
    }
    if (ref.kind === "readings") {
      if (!Array.isArray(pack.readings))
        throw failure("STORAGE_CORRUPT", "Invalid reading pack.", 503);
      const statements: D1PreparedStatement[] = [];
      for (const item of pack.readings as ReadingItem[]) {
        const r = item.summary;
        if (item.reading && r.availability !== "readable")
          throw failure(
            "CATALOG_CONFLICT",
            "A held text cannot be admitted.",
            409,
          );
        const body = item.reading
          ? item.reading_is_header
            ? ((await logicalField(env, b, item, "search.text")) as string)
            : ((item.reading.search as { text?: string } | undefined)?.text ??
              "")
          : "";
        if (typeof body !== "string")
          throw failure(
            "STORAGE_CORRUPT",
            "Readable search text is missing.",
            503,
          );
        statements.push(
          db
            .prepare(
              "INSERT OR IGNORE INTO library_readings (snapshot,id,revision,work,edition,title,language,contributor,collections,availability,completeness,body,metadata,object_key,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              snap,
              r.reading_unit_id,
              r.reading_revision,
              r.work_id,
              r.edition_id,
              r.title_search,
              r.language,
              r.contributor_search ?? "",
              JSON.stringify(r.collection_ids),
              r.availability,
              r.completeness,
              body,
              JSON.stringify(r),
              item.reading ? key : null,
              item.reading ? ref.sha256 : null,
            ),
        );
      }
      for (let j = 0; j < statements.length; j += 80)
        await db.batch(statements.slice(j, j + 80));
    }
    await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO library_imports (snapshot,chunk,hash) VALUES (?,?,?)",
        )
        .bind(snap, i, ref.sha256),
      db
        .prepare(
          "UPDATE library_snapshots SET imported=(SELECT count(*) FROM library_imports WHERE snapshot=?) WHERE id=?",
        )
        .bind(snap, snap),
    ]);
  };
  for (let i = 0; i < selected.length; i += concurrency)
    await Promise.all(selected.slice(i, i + concurrency).map(({ i }) => importChunk(i)));
  const count = await db
    .prepare("SELECT count(*) AS n FROM library_imports WHERE snapshot=?")
    .bind(snap)
    .first<{ n: number }>();
  if (count?.n === b.chunks.length) {
    for (const [name, ref] of [
      ["index", b.index],
      ["methods", b.methods],
      ["result-schema", b.result_schema],
    ] as const) {
      const bytes = await verifyPacked(await asset(env, ref.path), ref);
      await bucket.put(`snapshots/${snap}/${name}.json`, bytes, {
        httpMetadata: { contentType: "application/json" },
        customMetadata: { sha256: ref.sha256 },
      });
    }
    const n = await db
      .prepare("SELECT count(*) AS n FROM library_readings WHERE snapshot=?")
      .bind(snap)
      .first<{ n: number }>();
    if (n?.n !== b.manifest.counts.reading_units)
      throw failure(
        "CATALOG_CONFLICT",
        "The complete catalog census does not reconcile.",
        503,
      );
    const descriptor = new TextEncoder().encode(JSON.stringify(b));
    await bucket.put(`snapshots/${snap}/bootstrap.json`, descriptor, {
      customMetadata: { sha256: await sha256(descriptor) },
    });
    await db.batch([
      db.prepare("DELETE FROM library_search WHERE snapshot=?").bind(snap),
      db
        .prepare(
          "INSERT INTO library_search (snapshot,unit,title,contributor,body) SELECT snapshot,id,title,contributor,body FROM library_readings WHERE snapshot=?",
        )
        .bind(snap),
      db
        .prepare("UPDATE library_snapshots SET state=? WHERE id=?")
        .bind("ready", snap),
      db
        .prepare(
          "INSERT INTO library_active (slot,snapshot) VALUES (1,?) ON CONFLICT(slot) DO UPDATE SET snapshot=excluded.snapshot",
        )
        .bind(snap),
    ]);
    return { ready: true, snapshot_id: snap };
  }
  return {
    ready: false,
    snapshot_id: snap,
    imported: count?.n ?? 0,
    total: b.chunks.length,
  };
}
export async function activeSnapshot(
  env: LibraryBindings,
  requested: string | null = null,
) {
  const { db } = storage(env);
  const row = requested
    ? await db
        .prepare(
          "SELECT id,manifest FROM library_snapshots WHERE id=? AND state=?",
        )
        .bind(requested, "ready")
        .first<{ id: string; manifest: string }>()
    : await db
        .prepare(
          "SELECT s.id,s.manifest FROM library_snapshots s JOIN library_active a ON a.snapshot=s.id WHERE a.slot=1",
        )
        .first<{ id: string; manifest: string }>();
  if (!row)
    throw failure(
      requested ? "SNAPSHOT_CHANGED" : "CATALOG_SYNCING",
      requested
        ? "The requested snapshot is unavailable."
        : "The catalog is being staged.",
      requested ? 409 : 503,
      "Refresh the catalog.",
    );
  return { snapshot: row.id, manifest: JSON.parse(row.manifest) as Manifest };
}
export async function objectJSON<T>(
  env: LibraryBindings,
  key: string,
): Promise<T> {
  const obj = await storage(env).bucket.get(key);
  if (!obj)
    throw failure(
      "STORAGE_UNAVAILABLE",
      "A Library artifact is unavailable.",
      503,
    );
  const bytes = new Uint8Array(await obj.arrayBuffer());
  if ((await sha256(bytes)) !== obj.customMetadata?.sha256)
    throw failure(
      "STORAGE_CORRUPT",
      "The immutable JSON artifact failed checksum validation.",
      503,
    );
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
export async function readingItem(
  env: LibraryBindings,
  snapshot: string,
  id: string,
  b?: Bootstrap,
) {
  if (!/^[a-zA-Z0-9_.:-]{1,200}$/.test(id))
    throw failure("BAD_REQUEST", "Invalid reading identity.");
  const { db } = storage(env),
    row = await db
      .prepare(
        "SELECT metadata,object_key,hash FROM library_readings WHERE snapshot=? AND id=?",
      )
      .bind(snapshot, id)
      .first<{
        metadata: string;
        object_key: string | null;
        hash: string | null;
      }>();
  if (!row)
    throw failure(
      "NOT_FOUND",
      "This reading is not in the pinned snapshot.",
      404,
    );
  if (!row.object_key)
    throw failure(
      "READING_UNAVAILABLE",
      "This reading is held or available only as metadata.",
      403,
      "Inspect its recorded rights evidence.",
    );
  b ??= await snapshotBootstrap(env, snapshot);
  if (b.manifest.snapshot_id !== snapshot)
    throw failure(
      "SNAPSHOT_CHANGED",
      "The catalog source version is unavailable.",
      409,
    );
  const path = row.object_key.split("/objects/")[1],
    ref = reference(b, path);
  if (ref.sha256 !== row.hash)
    throw failure(
      "STORAGE_CORRUPT",
      "The registered reading checksum differs.",
      503,
    );
  const pack = await loadObject<{ readings: ReadingItem[] }>(
      env,
      snapshot,
      ref,
    ),
    item = pack.readings.find((r) => r.summary.reading_unit_id === id);
  if (
    !item?.reading ||
    item.reading.reading_revision !== JSON.parse(row.metadata).reading_revision
  )
    throw failure(
      "STORAGE_CORRUPT",
      "The reading revision does not match.",
      503,
    );
  return { b, item };
}
export async function readingPage(
  env: LibraryBindings,
  snapshot: string,
  id: string,
  offset: number,
  limit: number,
) {
  const { b, item } = await readingItem(env, snapshot, id),
    r = item.reading!,
    total = item.reading_is_header ? Number(r.line_count) : r.lines.length;
  let lines: ReadingLine[] = [];
  if (!item.reading_is_header) lines = r.lines.slice(offset, offset + limit);
  else
    for (const path of item.reading_chunks?.lines ?? []) {
      const ref = reference(b, path),
        range = ref.value_range;
      if (!range)
        throw failure(
          "STORAGE_CORRUPT",
          "The source row seek map is missing.",
          503,
        );
      if (range[1] <= offset || range[0] >= offset + limit) continue;
      const part = await loadObject<{ value: ReadingLine[] }>(
        env,
        snapshot,
        ref,
      );
      if (part.value.length !== range[1] - range[0])
        throw failure("STORAGE_CORRUPT", "The source row census differs.", 503);
      lines.push(
        ...part.value.slice(
          Math.max(0, offset - range[0]),
          Math.min(part.value.length, offset + limit - range[0]),
        ),
      );
    }
  const page = () => ({
    ...r,
    snapshot_id: snapshot,
    normalized_text:
      item.reading_is_header || r.normalized_text.length > 100000
        ? null
        : r.normalized_text,
    source_text: null,
    source_map: { ...r.source_map, rows: undefined },
    source_labels: item.source_labels ?? [],
    work_reviewed_equivalence: item.summary.work_reviewed_equivalence,
    source_basis: item.summary.source_basis,
    search: null,
    lines,
    line_page: {
      offset,
      total,
      next_offset: offset + lines.length < total ? offset + lines.length : null,
    },
    analysis_scope: "whole_reading_unit",
  });
  while (
    lines.length > 1 &&
    new TextEncoder().encode(JSON.stringify(page())).length > 2 * 1024 * 1024
  )
    lines.pop();
  if (new TextEncoder().encode(JSON.stringify(page())).length > 2 * 1024 * 1024)
    throw failure(
      "RESOURCE_LIMIT",
      "This complete source row exceeds the page byte budget.",
      413,
      "Use the lossless whole-reading download.",
    );
  return page();
}
export async function wholeReading(
  env: LibraryBindings,
  snapshot: string,
  id: string,
) {
  const { b, item } = await readingItem(env, snapshot, id);
  if (!item.reading_is_header)
    return Response.json(
      {
        ...item.reading,
        snapshot_id: snapshot,
        source_labels: item.source_labels ?? [],
        work_reviewed_equivalence: item.summary.work_reviewed_equivalence,
        source_basis: item.summary.source_basis,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  const parts = item.reading_parts ?? [];
  if (!parts.length)
    throw failure(
      "STORAGE_CORRUPT",
      "The complete source representation is missing.",
      503,
    );
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (index === 0)
          controller.enqueue(
            new TextEncoder().encode(
              `{"snapshot_id":${JSON.stringify(snapshot)},"source_labels":${JSON.stringify(item.source_labels ?? [])},"work_reviewed_equivalence":${JSON.stringify(item.summary.work_reviewed_equivalence ?? false)},"source_basis":${JSON.stringify(item.summary.source_basis ?? {})},`,
            ),
          );
        if (index >= parts.length) {
          controller.close();
          return;
        }
        const part = await loadObject<{
          raw_utf8_fragment: string;
          part_index: number;
          part_count: number;
        }>(env, snapshot, reference(b, parts[index]));
        if (part.part_index !== index || part.part_count !== parts.length)
          throw failure(
            "STORAGE_CORRUPT",
            "The complete source parts differ.",
            503,
          );
        controller.enqueue(
          new TextEncoder().encode(
            index++ === 0
              ? part.raw_utf8_fragment.slice(1)
              : part.raw_utf8_fragment,
          ),
        );
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function originalSource(
  env: LibraryBindings,
  snapshot: string,
  hash: string,
) {
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw failure("BAD_REQUEST", "An exact source hash is required.");
  const b = await snapshotBootstrap(env, snapshot),
    availability = b.whole_sources[hash] as
      | { availability?: string; reason?: string }
      | undefined;
  if (availability?.availability !== "readable")
    throw failure(
      "SOURCE_UNAVAILABLE",
      availability?.reason ?? "The whole source contains unadmitted material.",
      403,
      "Use this unit’s admitted source transcription.",
    );
  const fragments = (availability as { fragment_paths?: string[] })
    .fragment_paths;
  if (fragments?.length) {
    let text = "";
    for (let i = 0; i < fragments.length; i++) {
      const part = await loadObject<{
        artifact_path: string;
        part_index: number;
        part_count: number;
        raw_utf8_fragment: string;
      }>(env, snapshot, reference(b, fragments[i]));
      if (
        part.artifact_path !== `sources/${hash}.bin` ||
        part.part_index !== i ||
        part.part_count !== fragments.length ||
        typeof part.raw_utf8_fragment !== "string"
      )
        throw failure(
          "STORAGE_CORRUPT",
          "The original source fragments differ.",
          503,
        );
      text += part.raw_utf8_fragment;
    }
    if ((await sha256(text)) !== hash)
      throw failure(
        "STORAGE_CORRUPT",
        "The original source checksum differs.",
        503,
      );
    return {
      text,
      source_sha256: hash,
      source_paths: (availability as Record<string, unknown>).source_paths,
      scope: "complete_source_file",
      notice:
        "The complete source may contain additional works. Preserve its recorded credits and reuse terms.",
    };
  }
  const row = await storage(env)
    .db.prepare(
      "SELECT path,object_key,hash FROM library_sources WHERE snapshot=? AND sha=?",
    )
    .bind(snapshot, hash)
    .first<{ path: string; object_key: string; hash: string }>();
  if (!row)
    throw failure(
      "STORAGE_UNAVAILABLE",
      "The exact original source is unavailable.",
      503,
    );
  const ref = reference(b, row.object_key.split("/objects/")[1]);
  if (ref.sha256 !== row.hash)
    throw failure("STORAGE_CORRUPT", "The source pack identity differs.", 503);
  const pack = await loadObject<{
      sources: { path: string; sha256: string; text: string }[];
    }>(env, snapshot, ref),
    source = pack.sources.find((s) => s.sha256 === hash && s.path === row.path);
  if (!source || (await sha256(source.text)) !== hash)
    throw failure(
      "STORAGE_CORRUPT",
      "The whole source failed checksum validation.",
      503,
    );
  return {
    text: source.text,
    source_sha256: hash,
    source_paths: (availability as Record<string, unknown>).source_paths,
    scope: "complete_source_file",
    notice:
      "The complete source may contain additional works. Preserve its recorded credits and reuse terms.",
  };
}

export async function snapshotBootstrap(
  env: LibraryBindings,
  snapshot: string,
) {
  const current = await bootstrap(env);
  return current.manifest.snapshot_id === snapshot
    ? current
    : objectJSON<Bootstrap>(env, `snapshots/${snapshot}/bootstrap.json`);
}
