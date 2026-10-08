import {
  activeSnapshot,
  asset,
  bootstrap,
  failure,
  loadObject,
  readingItem,
  reference,
  originalSource,
  snapshotBootstrap,
  storage,
  type LibraryBindings,
  type ReadingItem,
} from "./library-catalog";
import { canonical, randomHex, sha256 } from "./reader-crypto";
import {
  crc32,
  csvFields,
  csvValue,
  joinBytes,
  zipCentral,
  zipDescriptor,
  zipEnd,
  zipHeader,
} from "./zip-stream";
import type { ReadingLine } from "./library-types";
type Package = {
  filename: string;
  sha256: string;
  bytes: number;
  parts: {
    path: string;
    sha256: string;
    bytes: number;
    offset: number;
    part_index: number;
  }[];
};
type State = {
  mode: "prebuilt" | "selection" | "analysis";
  format: string;
  snapshot: string;
  total: number;
  ids_key?: string;
  unit: number;
  sub: number;
  part: number;
  chunk: number;
  offset: number;
  entries: number;
  phase: "units" | "roots" | "central" | "complete";
  root: number;
  central_index: number;
  central_offset: number;
  central_size: number;
  analysis_key?: string;
  analysis_job_id?: string;
  sources?: string[];
  entry?: { name: string; offset: number; size: number; crc: number };
  package?: Package;
};
type Row = {
  id: string;
  viewer: string;
  record: string;
  state: string;
  expires: string;
  lock_until: number;
};
const encoder = new TextEncoder(),
  prefix = (v: string, id: string) => `private/${v}/exports/${id}`,
  expires = () => new Date(Date.now() + 2592000000).toISOString();
function result(id: string, s: State) {
  return {
    export_id: id,
    state: s.phase === "complete" ? "ready" : "preparing",
    progress: {
      completed: s.mode === "prebuilt" ? s.part : s.unit,
      total: s.mode === "prebuilt" ? s.package!.parts.length : s.total,
      kind: s.mode === "prebuilt" ? "package_parts" : "readings",
      ...(s.mode === "analysis"
        ? { evidence_pages: Math.max(0, s.root - 6) }
        : {}),
    },
    ...(s.phase === "complete"
      ? { download_url: `/api/library/exports/${id}/download` }
      : {}),
  };
}
async function putVerified(
  env: LibraryBindings,
  key: string,
  bytes: Uint8Array,
) {
  const { bucket } = storage(env),
    hash = await sha256(bytes),
    existing = await bucket.head(key);
  if (existing && existing.customMetadata?.sha256 !== hash)
    throw failure(
      "STORAGE_CONFLICT",
      "An export checkpoint changed bytes.",
      409,
    );
  if (!existing)
    await bucket.put(key, bytes, { customMetadata: { sha256: hash } });
  return hash;
}
async function checkedObject(
  env: LibraryBindings,
  key: string,
  expected?: string,
) {
  const object = await storage(env).bucket.get(key);
  if (!object)
    throw failure("STORAGE_UNAVAILABLE", "An export part is unavailable.", 503);
  const bytes = new Uint8Array(await object.arrayBuffer());
  if ((await sha256(bytes)) !== (expected ?? object.customMetadata?.sha256))
    throw failure(
      "STORAGE_CORRUPT",
      "An export part failed checksum validation.",
      503,
    );
  return bytes;
}
function provenance(item: ReadingItem, snapshot: string) {
  const r = item.reading!;
  const {
    lines,
    normalized_text,
    source_text,
    search,
    source_map,
    ...identity
  } = r;
  void lines;
  void normalized_text;
  void source_text;
  void search;
  return {
    schema_version: 1,
    ...identity,
    snapshot_id: snapshot,
    coordinates: {
      source_map,
      body: "Content JSON or CSV retains the exact source coordinates.",
    },
  };
}
function credits(item: ReadingItem) {
  const r = item.reading!;
  return `${r.title} [${r.reading_unit_id}]\nSource: ${r.source_path} (${r.source_sha256})\n${r.contributors.map((c) => `${c.role}: ${c.name}`).join("\n")}\nRecorded rights and required source declarations:\n${JSON.stringify(r.rights, null, 2)}\n`;
}
async function fieldPart(
  env: LibraryBindings,
  b: Awaited<ReturnType<typeof bootstrap>>,
  item: ReadingItem,
  field: string,
  part: number,
) {
  const paths = item.reading_chunks?.[field];
  if (paths) {
    const value = await loadObject<{
      value: unknown;
      reading_unit_id: string;
      reading_revision: string;
      part_index: number;
      part_count: number;
    }>(env, b.manifest.snapshot_id, reference(b, paths[part]));
    if (
      value.reading_unit_id !== item.summary.reading_unit_id ||
      value.reading_revision !== item.summary.reading_revision ||
      value.part_index !== part ||
      value.part_count !== paths.length
    )
      throw failure("STORAGE_CORRUPT", "The export source parts differ.", 503);
    return { value: value.value, last: part === paths.length - 1 };
  }
  return { value: item.reading![field], last: true };
}
function csvLines(
  item: ReadingItem,
  snapshot: string,
  lines: ReadingLine[],
  first: boolean,
) {
  const r = item.reading!,
    marks = (r.source_marks ?? [])
      .slice()
      .sort(
        (a, b) => Number(a.physical_line ?? 0) - Number(b.physical_line ?? 0),
      );
  let text = first ? csvFields.map(csvValue).join(",") + "\r\n" : "";
  for (const line of lines) {
    let structure = "",
      voice = "";
    for (const mark of marks) {
      if (Number(mark.physical_line ?? 0) > line.physical_line) break;
      const name = String(mark.name ?? "");
      if (/^(VOICE|SINGER|SPEAKER)/i.test(name))
        voice = String(mark.raw ?? name);
      else structure = String(mark.raw ?? name);
    }
    const values = {
      ...r,
      ...line,
      snapshot_id: snapshot,
      row_id: line.id,
      structure,
      voice: line.voice ?? voice,
    };
    text +=
      csvFields
        .map((k) => csvValue(values[k as keyof typeof values]))
        .join(",") + "\r\n";
  }
  return text;
}
async function bodyPart(
  env: LibraryBindings,
  b: Awaited<ReturnType<typeof bootstrap>>,
  item: ReadingItem,
  s: State,
) {
  const r = item.reading!,
    id = r.reading_unit_id;
  if (s.sub === 0) {
    if (s.format === "json") {
      if (item.reading_parts?.length) {
        const raw = await loadObject<{
          raw_utf8_fragment: string;
          part_index: number;
          part_count: number;
        }>(env, s.snapshot, reference(b, item.reading_parts[s.part]));
        if (
          raw.part_index !== s.part ||
          raw.part_count !== item.reading_parts.length
        )
          throw failure(
            "STORAGE_CORRUPT",
            "The exact reading fragments differ.",
            503,
          );
        return {
          name: `READINGS/${id}.json`,
          text: raw.raw_utf8_fragment,
          last: s.part === item.reading_parts.length - 1,
        };
      }
      return { name: `READINGS/${id}.json`, text: canonical(r), last: true };
    }
    if (s.format === "text") {
      const p = await fieldPart(env, b, item, "normalized_text", s.part);
      return {
        name: `READINGS/${id}.txt`,
        text: p.value as string,
        last: p.last,
      };
    }
    const p = await fieldPart(env, b, item, "lines", s.part);
    return {
      name: `READINGS/${id}.csv`,
      text: csvLines(item, s.snapshot, p.value as ReadingLine[], s.part === 0),
      last: p.last,
    };
  }
  if (s.sub === 1) {
    const p = await fieldPart(env, b, item, "source_text", s.part);
    return {
      name: `TRANSCRIPTIONS/${id}.txt`,
      text: p.value as string,
      last: p.last,
    };
  }
  if (s.sub === 2)
    return {
      name: `PROVENANCE/${id}.json`,
      text: canonical(provenance(item, s.snapshot)) + "\n",
      last: true,
    };
  if (s.sub === 3)
    return { name: `ATTRIBUTIONS/${id}.txt`, text: credits(item), last: true };
  const notices = (r.rights.notices ?? []) as unknown as {
    sha256: string;
    text: string;
    scope: unknown;
  }[];
  if (s.sub === 4 + notices.length) {
    const source = await originalSource(env, s.snapshot, r.source_sha256);
    return {
      name: `SOURCES/${r.source_sha256}.bin`,
      text: source.text,
      last: true,
    };
  }
  const notice = notices[s.sub - 4];
  if (!notice || typeof notice.text !== "string")
    throw failure("STORAGE_CORRUPT", "A required notice is missing.", 503);
  if ((await sha256(notice.text)) !== notice.sha256)
    throw failure(
      "STORAGE_CORRUPT",
      "A required notice checksum differs.",
      503,
    );
  return {
    name: `NOTICES/${id}-${notice.sha256}.txt`,
    text: notice.text,
    last: true,
  };
}
export async function handleExport(
  request: Request,
  env: LibraryBindings,
  viewer: string,
  pullAnalysis?: (
    job: string,
    manifest: string,
    offset: number,
  ) => Promise<Uint8Array>,
): Promise<Response | null> {
  const url = new URL(request.url),
    path = url.pathname,
    { db, bucket } = storage(env);
  if (path === "/api/library/exports" && request.method === "POST") {
    const raw = await request.text();
    if (encoder.encode(raw).length > 2 * 1024 * 1024)
      throw failure(
        "RESOURCE_LIMIT",
        "The selected export request exceeds 2 MiB.",
        413,
        "Reduce the request or use the readable corpus export.",
      );
    const input = JSON.parse(raw) as {
      snapshot_id: string;
      reading_unit_ids: string[] | "all";
      format: string;
    };
    const { snapshot, manifest } = await activeSnapshot(env, input.snapshot_id);
    if (!["text", "json", "csv"].includes(input.format))
      throw failure("BAD_REQUEST", "Choose Text, JSON or CSV.");
    const b = await snapshotBootstrap(env, snapshot);
    let ids: string[] = [];
    if (input.reading_unit_ids !== "all") {
      if (
        !Array.isArray(input.reading_unit_ids) ||
        !input.reading_unit_ids.length ||
        input.reading_unit_ids.some(
          (id) =>
            typeof id !== "string" || !/^reading_[a-zA-Z0-9_-]+$/.test(id),
        )
      )
        throw failure(
          "BAD_REQUEST",
          "Choose a nonempty pinned reading selection.",
        );
      ids = Array.from(new Set(input.reading_unit_ids)).sort();
      for (let i = 0; i < ids.length; i += 80) {
        const slice = ids.slice(i, i + 80),
          rows = await db
            .prepare(
              `SELECT id,availability FROM library_readings WHERE snapshot=? AND id IN (${slice.map(() => "?").join(",")})`,
            )
            .bind(snapshot, ...slice)
            .all<{ id: string; availability: string }>();
        if (
          rows.results.length !== slice.length ||
          rows.results.some((r) => r.availability !== "readable")
        )
          throw failure(
            "SELECTION_UNAVAILABLE",
            "The selection contains an unknown or unadmitted reading.",
            409,
            "Remove unavailable items or explicitly choose the remaining readable selection.",
          );
      }
    }
    const all =
        input.reading_unit_ids === "all" ||
        ids.length === manifest.counts.readable_reading_units,
      id = randomHex(16),
      s: State = {
        mode: all ? "prebuilt" : "selection",
        format: input.format,
        snapshot,
        total: all
          ? Number(manifest.counts.readable_reading_units)
          : ids.length,
        unit: 0,
        sub: 0,
        part: 0,
        chunk: 0,
        offset: 0,
        entries: 0,
        phase: "units",
        root: 0,
        central_index: 0,
        central_offset: 0,
        central_size: 0,
      };
    if (all) {
      s.package = b.exports[input.format] as Package;
      if (!s.package)
        throw failure(
          "EXPORT_UNAVAILABLE",
          "The pinned readable corpus package is unavailable.",
          503,
        );
    } else {
      s.ids_key = prefix(viewer, id) + "/selection.json";
      await putVerified(
        env,
        s.ids_key,
        encoder.encode(canonical({ snapshot, ids })),
      );
    }
    await db
      .prepare(
        "INSERT INTO library_exports (id,viewer,snapshot,format,state,record,accessed,expires,lock_until) VALUES (?,?,?,?,?,?,?,?,0)",
      )
      .bind(
        id,
        viewer,
        snapshot,
        input.format,
        "preparing",
        JSON.stringify(s),
        new Date().toISOString(),
        expires(),
      )
      .run();
    return Response.json(result(id, s), { status: 202 });
  }
  const match = path.match(
    /^\/api\/library\/exports\/([a-f0-9]{32})(?:\/(step|download))?$/,
  );
  if (!match) return null;
  const id = match[1],
    row = await db
      .prepare("SELECT * FROM library_exports WHERE id=? AND viewer=?")
      .bind(id, viewer)
      .first<Row>();
  if (!row)
    throw failure(
      "NOT_FOUND",
      "This export is unavailable for this viewer.",
      404,
    );
  if (Date.parse(row.expires) < Date.now())
    throw failure(
      "EXPORT_EXPIRED",
      "This export expired.",
      410,
      "Create a new export explicitly.",
    );
  let state = JSON.parse(row.record) as State;
  await db
    .prepare(
      "UPDATE library_exports SET accessed=?,expires=? WHERE id=? AND viewer=?",
    )
    .bind(new Date().toISOString(), expires(), id, viewer)
    .run();
  if (match[2] === "download") {
    if (request.method !== "GET")
      throw failure(
        "METHOD_NOT_ALLOWED",
        "Use GET to download this package.",
        405,
      );
    if (state.phase !== "complete")
      throw failure("EXPORT_NOT_READY", "The export is still preparing.", 409);
    let index = 0;
    const count =
      state.mode === "prebuilt" ? state.package!.parts.length : state.chunk;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (index >= count) {
            controller.close();
            return;
          }
          const key =
            state.mode === "prebuilt"
              ? `snapshots/${state.snapshot}/exports/${state.format}/${index}`
              : prefix(viewer, id) + `/chunks/${index}`;
          controller.enqueue(
            await checkedObject(
              env,
              key,
              state.mode === "prebuilt"
                ? state.package!.parts[index].sha256
                : undefined,
            ),
          );
          index++;
        } catch (e) {
          controller.error(e);
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${state.package?.filename ?? "codex-musica-library-" + state.format + "-selection.zip"}"`,
        "Cache-Control": "private, no-store",
        "Content-Length": String(
          state.mode === "prebuilt" ? state.package!.bytes : state.offset,
        ),
        ...(state.package ? { "X-Library-SHA256": state.package.sha256 } : {}),
      },
    });
  }
  if (!match[2] && request.method === "GET")
    return Response.json(result(id, state));
  if (match[2] !== "step" || request.method !== "POST")
    throw failure(
      "METHOD_NOT_ALLOWED",
      "Use POST to commit an export step.",
      405,
    );
  if (state.phase === "complete") return Response.json(result(id, state));
  const lock = Date.now() + 300000,
    lease = await db
      .prepare(
        "UPDATE library_exports SET lock_until=? WHERE id=? AND viewer=? AND lock_until<? RETURNING record",
      )
      .bind(lock, id, viewer, Date.now())
      .first<{ record: string }>();
  if (!lease)
    return Response.json({ ...result(id, state), busy: true }, { status: 202 });
  state = JSON.parse(lease.record);
  const base = prefix(viewer, id);
  try {
    if (state.mode === "prebuilt") {
      const part = state.package!.parts[state.part],
        key = `snapshots/${state.snapshot}/exports/${state.format}/${state.part}`,
        existing = await bucket.head(key);
      if (existing?.customMetadata?.sha256 !== part.sha256) {
        const bytes = await asset(env, part.path);
        if (
          bytes.length !== part.bytes ||
          (await sha256(bytes)) !== part.sha256
        )
          throw failure(
            "STORAGE_CORRUPT",
            "A corpus export part differs.",
            503,
          );
        await putVerified(env, key, bytes);
      }
      state.part++;
      state.unit = Math.round(
        (state.total * state.part) / state.package!.parts.length,
      );
      if (state.part === state.package!.parts.length) state.phase = "complete";
    } else {
      const selection = JSON.parse(
        new TextDecoder().decode(await checkedObject(env, state.ids_key!)),
      ) as { snapshot: string; ids: string[] };
      if (
        selection.snapshot !== state.snapshot ||
        selection.ids.length !== state.total
      )
        throw failure(
          "STORAGE_CORRUPT",
          "The pinned export selection differs.",
          503,
        );
      const chunks: Uint8Array[] = [];
      const emit = (bytes: Uint8Array) => {
        chunks.push(bytes);
        state.offset += bytes.length;
      };
      const open = (name: string) => {
        if (!state.entry) {
          state.entry = { name, offset: state.offset, size: 0, crc: 0 };
          emit(zipHeader(name));
        }
        if (state.entry.name !== name)
          throw failure(
            "STORAGE_CORRUPT",
            "The ZIP entry checkpoint differs.",
            503,
          );
      };
      const close = async () => {
        const entry = state.entry!;
        emit(zipDescriptor(entry.crc, entry.size));
        await putVerified(
          env,
          base + `/central/${state.entries}`,
          zipCentral(entry.name, entry.crc, entry.size, entry.offset),
        );
        state.entries++;
        delete state.entry;
      };
      const write = (text: string) => {
        const bytes = encoder.encode(text);
        state.entry!.crc = crc32(bytes, state.entry!.crc);
        state.entry!.size += bytes.length;
        emit(bytes);
      };
      if (state.phase === "units") {
        const b = await snapshotBootstrap(env, state.snapshot),
          { item } = await readingItem(
            env,
            state.snapshot,
            selection.ids[state.unit],
            b,
          ),
          piece = await bodyPart(env, b, item, state);
        open(piece.name);
        write(piece.text);
        if (piece.last) {
          await close();
          state.part = 0;
          state.sub++;
          const notices = (item.reading!.rights.notices ?? []) as unknown[];
          const includeOriginal =
            state.format === "json" &&
            (item.summary as unknown as { whole_source_availability?: string })
              .whole_source_availability === "readable" &&
            !(state.sources ?? []).includes(item.summary.source_sha256);
          if (state.sub === 4 + notices.length + 1) {
            state.sources ??= [];
            state.sources.push(item.summary.source_sha256);
          }
          if (state.sub >= 4 + notices.length + (includeOriginal ? 1 : 0)) {
            state.unit++;
            state.sub = 0;
            if (state.unit === state.total) state.phase = "roots";
          }
        } else state.part++;
      } else if (state.phase === "roots") {
        const analysis = state.analysis_key
          ? (JSON.parse(
              new TextDecoder().decode(
                await checkedObject(env, state.analysis_key),
              ),
            ) as AnalysisExport)
          : undefined;
        let name: string, text: string;
        if (state.root < 2) {
          name = state.root === 0 ? "PROVENANCE.json" : "ATTRIBUTION.txt";
          text =
            state.root === 0
              ? canonical({
                  schema_version: 1,
                  snapshot_id: state.snapshot,
                  scope: analysis
                    ? "whole_reading_unit_analysis"
                    : "selected_readings",
                  reading_unit_ids: selection.ids,
                  ...(analysis
                    ? {
                        analysis_manifest_hash: analysis.manifest_hash,
                        partial: analysis.partial,
                      }
                    : {}),
                  provenance_directory: "PROVENANCE/",
                  required_credits_directory: "ATTRIBUTIONS/",
                  notices_directory: "NOTICES/",
                  artwork_included: false,
                  audio_included: false,
                }) + "\n"
              : "This package preserves pinned Library text, source credits and reuse terms in ATTRIBUTIONS/ and PROVENANCE/. Applicable notices are preserved verbatim in NOTICES/. Credits are required and must accompany reuse.\n";
        } else if (analysis && state.root < 6) {
          const files = [
            ["ANALYSIS/MANIFEST.json", analysis.manifest_key],
            ["ANALYSIS/REQUEST.json", analysis.request_key],
            [
              "ANALYSIS/METHODS.json",
              `snapshots/${state.snapshot}/methods.json`,
            ],
            [
              "ANALYSIS/RESULT_SCHEMA.json",
              `snapshots/${state.snapshot}/result-schema.json`,
            ],
          ];
          [name] = files[state.root - 2];
          text = new TextDecoder().decode(
            await checkedObject(env, files[state.root - 2][1]),
          );
        } else if (analysis && pullAnalysis) {
          name = `ANALYSIS/EVIDENCE/${String(state.root - 6).padStart(8, "0")}.json`;
          text = new TextDecoder().decode(
            await pullAnalysis(
              analysis.job_id,
              analysis.manifest_hash,
              state.root - 6,
            ),
          );
        } else
          throw failure(
            "EXPORT_UNAVAILABLE",
            "The analysis export page reader is unavailable.",
            503,
          );
        open(name);
        write(text);
        await close();
        state.root++;
        if (state.root === (analysis ? 6 + analysis.page_count : 2)) {
          state.phase = "central";
          state.central_offset = state.offset;
        }
      } else if (state.phase === "central") {
        for (
          let n = 0;
          n < 100 && state.central_index < state.entries;
          n++, state.central_index++
        ) {
          const bytes = await checkedObject(
            env,
            base + `/central/${state.central_index}`,
          );
          emit(bytes);
          state.central_size += bytes.length;
        }
        if (state.central_index === state.entries) {
          emit(zipEnd(state.entries, state.central_size, state.central_offset));
          state.phase = "complete";
        }
      }
      const bytes = joinBytes(chunks);
      if (bytes.length) {
        await putVerified(env, base + `/chunks/${state.chunk}`, bytes);
        state.chunk++;
      }
    }
    const update = await db
      .prepare(
        "UPDATE library_exports SET record=?,state=?,lock_until=0 WHERE id=? AND viewer=? AND lock_until=?",
      )
      .bind(
        JSON.stringify(state),
        state.phase === "complete" ? "ready" : "preparing",
        id,
        viewer,
        lock,
      )
      .run();
    if (!update.meta.changes)
      throw failure(
        "EXPORT_LEASE_LOST",
        "The export checkpoint lease expired.",
        409,
        "Retry the last step.",
      );
    return Response.json(result(id, state), {
      status: state.phase === "complete" ? 200 : 202,
    });
  } catch (e) {
    await db
      .prepare(
        "UPDATE library_exports SET lock_until=0 WHERE id=? AND viewer=? AND lock_until=?",
      )
      .bind(id, viewer, lock)
      .run();
    throw e;
  }
}

export type AnalysisExport = {
  job_id: string;
  manifest_hash: string;
  manifest_key: string;
  request_key: string;
  page_count: number;
  partial: boolean;
};
export async function createAnalysisExport(
  env: LibraryBindings,
  viewer: string,
  snapshot: string,
  unit: string,
  analysis: AnalysisExport,
) {
  const id = randomHex(16),
    base = prefix(viewer, id),
    state: State = {
      mode: "analysis",
      format: "json",
      snapshot,
      total: 1,
      unit: 0,
      sub: 0,
      part: 0,
      chunk: 0,
      offset: 0,
      entries: 0,
      phase: "units",
      root: 0,
      central_index: 0,
      central_offset: 0,
      central_size: 0,
      ids_key: base + "/selection.json",
      analysis_key: base + "/analysis.json",
      analysis_job_id: analysis.job_id,
    };
  await activeSnapshot(env, snapshot);
  await readingItem(env, snapshot, unit);
  await checkedObject(env, analysis.manifest_key, analysis.manifest_hash);
  await checkedObject(env, analysis.request_key);
  await putVerified(
    env,
    state.ids_key!,
    encoder.encode(canonical({ snapshot, ids: [unit] })),
  );
  await putVerified(
    env,
    state.analysis_key!,
    encoder.encode(canonical(analysis)),
  );
  await storage(env)
    .db.prepare(
      "INSERT INTO library_exports (id,viewer,snapshot,format,state,record,accessed,expires,lock_until) VALUES (?,?,?,?,?,?,?,?,0)",
    )
    .bind(
      id,
      viewer,
      snapshot,
      "json",
      "preparing",
      JSON.stringify(state),
      new Date().toISOString(),
      expires(),
    )
    .run();
  return result(id, state);
}
