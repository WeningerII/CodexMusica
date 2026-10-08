import { sha256 } from "./reader-crypto";
import type { Evidence } from "./library-types";
export async function hydrateEvidence(records: Evidence[]) {
  const groups = new Map<string, Evidence[]>(),
    positions = new Map(records.map((r, i) => [r, i]));
  for (const r of records) {
    if (r.kind !== "detail_part") continue;
    const key = String(r.detail_id);
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  const hydrated: Evidence[] = [],
    pending: string[] = [];
  async function resolve(
    v: unknown,
    parent: Evidence,
    field = "",
  ): Promise<unknown> {
    if (Array.isArray(v))
      return Promise.all(v.map((child) => resolve(child, parent, field)));
    if (!v || typeof v !== "object") return v;
    const object = v as Record<string, unknown>;
    if ("$detail_ref" in object) {
      const id = String(object.$detail_ref),
        parts = groups.get(id) ?? [];
      if (
        object.encoding !== "json" ||
        !Number.isSafeInteger(object.parts) ||
        Number(object.parts) < 1 ||
        !Number.isSafeInteger(object.byte_length) ||
        Number(object.byte_length) < 0 ||
        !/^([a-f0-9]{64})$/.test(String(object.sha256))
      )
        throw Error(`Detail ${id} has invalid encoding or count.`);
      if (parts.length !== object.parts)
        throw Error(
          `Detail ${id} requires ${String(object.parts)} parts; ${parts.length} loaded.`,
        );
      for (let i = 0; i < parts.length; i++)
        if (
          parts[i].part !== i ||
          parts[i].total !== object.parts ||
          parts[i].parent_id !== parent.id ||
          parts[i].method_id !== parent.method_id ||
          parts[i].field !== field ||
          typeof parts[i].json_fragment !== "string" ||
          positions.get(parts[i])! <= positions.get(parent)!
        )
          throw Error(`Detail ${id} has missing, changed or reordered parts.`);
      const interval = records.slice(
        positions.get(parent)! + 1,
        positions.get(parts.at(-1)!)! + 1,
      );
      if (
        interval.some(
          (r) => r.kind !== "detail_part" || r.parent_id !== parent.id,
        )
      )
        throw Error(`Detail ${id} is interleaved with another parent.`);
      const text = parts.map((r) => r.json_fragment).join(""),
        bytes = new TextEncoder().encode(text);
      if (
        bytes.length !== object.byte_length ||
        (await sha256(bytes)) !== object.sha256
      )
        throw Error(`Detail ${id} failed checksum validation.`);
      return resolve(JSON.parse(text), parent, field);
    }
    const out: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(object))
      out[k] = await resolve(child, parent, field || k);
    return out;
  }
  for (const r of records) {
    if (r.kind === "detail_part") continue;
    try {
      hydrated.push((await resolve(r, r)) as Evidence);
    } catch (e) {
      pending.push((e as Error).message);
    }
  }
  const byId = new Map(hydrated.map((r) => [r.id, r])),
    figureChunks = new Map<string, Evidence[]>();
  for (const r of hydrated.filter((r) => r.kind === "figure_edges")) {
    const id = String(r.figure_id);
    figureChunks.set(id, [...(figureChunks.get(id) ?? []), r]);
  }
  for (const figure of hydrated.filter((r) => r.kind === "relation_figure")) {
    if (figure.edge_count === undefined && Array.isArray(figure.edges))
      continue;
    const chunks = figureChunks.get(figure.id) ?? [];
    let offset = 0;
    const edges: Evidence[] = [];
    for (const r of chunks) {
      if (r.offset !== offset || !Array.isArray(r.edge_ids)) {
        pending.push(`Figure ${figure.id} has incomplete edge pages.`);
        break;
      }
      for (const id of r.edge_ids) {
        const edge = byId.get(String(id));
        if (
          !edge ||
          edge.kind !== "relation_instance" ||
          edge.method_id !== figure.method_id
        ) {
          pending.push(
            `Figure ${figure.id} needs verified relation ${String(id)} for its method.`,
          );
          continue;
        }
        edges.push(edge);
      }
      offset += r.edge_ids.length;
    }
    if (offset === figure.edge_count && edges.length === offset)
      figure.edges = edges;
    else {
      figure.edges_incomplete = true;
      pending.push(
        `Figure ${figure.id} has ${edges.length} of ${String(figure.edge_count)} verified edges.`,
      );
    }
  }
  return {
    records: hydrated.filter((r) => r.kind !== "figure_edges"),
    pending,
  };
}
export function component(records: Evidence[], kind: string) {
  let root: unknown = {};
  for (const r of records.filter((r) => r.kind === kind)) {
    const path = Array.isArray(r.path) ? r.path : [],
      value =
        r.result !== undefined
          ? r.result
          : r.container === "array"
            ? new Array(Number(r.length ?? 0))
            : r.container === "object"
              ? Object.fromEntries(
                  ((r.keys ?? []) as string[]).map((k) => [k, undefined]),
                )
              : undefined;
    if (value === undefined) continue;
    if (!path.length) {
      root = value;
      continue;
    }
    let cursor = root as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = String(path[i]);
      cursor[key] ??= typeof path[i + 1] === "number" ? [] : {};
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[String(path.at(-1))] = value;
  }
  return root as Record<string, unknown>;
}
export function lineIDs(record: Evidence) {
  const ids = new Set(record.line_ids ?? []);
  function walk(v: unknown) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, c] of Object.entries(v)) {
      if (k === "line_id" && typeof c === "string") ids.add(c);
      else if ((k === "line_ids" || k === "member_lines") && Array.isArray(c))
        c.forEach((x) => typeof x === "string" && ids.add(x));
      else walk(c);
    }
  }
  walk(record);
  walk(record.result);
  if (
    Array.isArray(record.path) &&
    record.path.at(-1) === "line_ids" &&
    Array.isArray(record.result)
  )
    record.result.forEach((x) => typeof x === "string" && ids.add(x));
  return ids;
}
