"use client";
import { useState } from "react";
import { ChevronDown, Info, Link2 } from "lucide-react";
import type { Evidence, Method } from "@/lib/library-types";
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (s) => s.toUpperCase());
const stateLabels: Record<string, string> = {
  true: "Measured",
  false: "Measured · absent",
  conditional: "Conditional",
  unknown: "Cannot tell",
  unread: "Cannot tell",
  refused: "Cannot tell",
  answered: "Measured",
  needs_declaration: "Not declared",
  not_declared: "Not declared",
  unsupported: "Unsupported",
  research_only: "Research only",
  not_requested: "Not requested",
};
const evidenceState = (r: Evidence) => {
  const state = String(r.verdict ?? r.coverage ?? "Evidence");
  return stateLabels[state] ?? label(state);
};
const omit = new Set([
  "id",
  "source_ranges",
  "line_ids",
  "method_id",
  "reading_revision",
  "reading_unit_id",
  "snapshot_id",
  "identity_hash",
]);
function LazyDetails({
  title,
  children,
  initial = false,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  initial?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {open ? children : null}
    </details>
  );
}
export function Value({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  const [limit, setLimit] = useState(100);
  const more = (total: number) => (
    <button className="text-link" onClick={() => setLimit(limit + 100)}>
      Show next values · {Math.min(limit, total)} / {total}
    </button>
  );
  if (value === undefined)
    return <span className="unknown">Not loaded yet</span>;
  if (value === null)
    return <span className="unknown">Undeclared / unread</span>;
  if (typeof value === "boolean")
    return (
      <span className={value ? "positive" : "muted"}>
        {value ? "Yes" : "No"}
      </span>
    );
  if (typeof value === "string" || typeof value === "number")
    return <span className="data-value">{String(value)}</span>;
  if (Array.isArray(value)) {
    const loaded = Object.keys(value).length;
    if (loaded < value.length)
      return (
        <div>
          <p className="note">
            {loaded} / {value.length} entries loaded. Further evidence pages are
            required.
          </p>
          {Object.entries(value)
            .slice(0, limit)
            .map(([i, v]) => (
              <LazyDetails key={i} title={"Item " + (Number(i) + 1)}>
                <Value value={v} depth={depth + 1} />
              </LazyDetails>
            ))}
          {loaded > limit && more(loaded)}
        </div>
      );
    if (!value.length) return <span className="muted">Explicitly empty</span>;
    if (value.every((v) => typeof v !== "object"))
      return (
        <span>
          {value.slice(0, limit).map(String).join(" · ")}
          {value.length > limit && more(value.length)}
        </span>
      );
    return (
      <div className="data-items">
        {value.slice(0, limit).map((v, i) => (
          <LazyDetails
            key={i}
            initial={depth < 1 && value.length < 8}
            title={
              typeof v === "object" && v !== null
                ? String(
                    v.name ??
                      v.word ??
                      v.line_id ??
                      v.kind ??
                      v.method_id ??
                      `Item ${i + 1}`,
                  )
                : `Item ${i + 1}`
            }
          >
            <Value value={v} depth={depth + 1} />
          </LazyDetails>
        ))}
        {value.length > limit && more(value.length)}
      </div>
    );
  }
  const record = value as Record<string, unknown>;
  if ("numerator" in record && "denominator" in record)
    return (
      <span>
        {String(record.numerator)}/{String(record.denominator)}
      </span>
    );
  return (
    <dl className="data-grid">
      {Object.entries(record)
        .filter(([k]) => !omit.has(k))
        .map(([k, v]) => (
          <div key={k}>
            <dt>{label(k)}</dt>
            <dd>
              {typeof v === "object" && v !== null && depth > 1 ? (
                <LazyDetails title={"Inspect " + label(k).toLowerCase()}>
                  <Value value={v} depth={depth + 1} />
                </LazyDetails>
              ) : (
                <Value value={v} depth={depth + 1} />
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function EvidenceCard({
  record,
  method,
  inspect,
}: {
  record: Evidence;
  method?: Method;
  inspect: (r: Evidence) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article
      className={`evidence-card verdict-${record.verdict ?? record.coverage ?? "measured"}`}
    >
      <button
        className="evidence-heading"
        onClick={() => {
          setExpanded(!expanded);
          inspect(record);
        }}
      >
        <span>
          <strong>
            {method?.name ??
              String(
                record.schema_name ?? record.native_method ?? record.kind,
              ).replaceAll("_", " ")}
          </strong>
          <small>
            {record.namespace ?? record.kind} · {record.basis ?? "measured"}
          </small>
        </span>
        <span className="state-badge">{evidenceState(record)}</span>
        <ChevronDown size={16} />
      </button>
      {expanded && (
        <div className="evidence-detail">
          <Value value={record} />
          {record.line_ids?.length ? (
            <button className="text-link" onClick={() => inspect(record)}>
              <Link2 size={15} />
              Locate {record.line_ids.length} participating lines
            </button>
          ) : null}
          {record.source_ranges?.length ? (
            <details>
              <summary>Source coordinates</summary>
              <Value value={record.source_ranges} />
            </details>
          ) : null}
        </div>
      )}
    </article>
  );
}
export function MethodDetail({
  method,
  onAnalyze,
}: {
  method: Method;
  onAnalyze?: (m: Method) => void;
}) {
  return (
    <details className="method-detail">
      <summary>
        <span>
          <strong>{method.name}</strong>
          <small>
            {method.namespace} ·{" "}
            {method.pair_local === undefined
              ? (method.scope ?? method.language ?? "native")
              : method.pair_local
                ? "Pair-local"
                : "Whole figure"}
          </small>
        </span>
        {method.normative && method.normative !== "ordinary" && (
          <span className="state-badge">{method.normative}</span>
        )}
      </summary>
      <div>
        <p>
          {method.definition || "Definition supplied by the installed engine."}
        </p>
        {method.aliases?.length ? (
          <p className="note">Also called {method.aliases.join(", ")}</p>
        ) : null}
        {method.required_capabilities?.length ? (
          <>
            <h4>Requires</h4>
            {method.required_capabilities.map((c) => (
              <p className="requirement" key={c}>
                <Info size={14} />
                <span>
                  <b>{label(c)}</b>
                  <small>{method.remedies?.[c]}</small>
                </span>
              </p>
            ))}
          </>
        ) : null}
        {method.figure && (
          <details>
            <summary>Figure shape and alignment</summary>
            <Value
              value={{ figure: method.figure, channels: method.channels }}
            />
          </details>
        )}
        {method.provenance && (
          <details>
            <summary>Tradition and provenance</summary>
            <Value value={method.provenance} />
          </details>
        )}
        {onAnalyze && (
          <button className="button" onClick={() => onAnalyze(method)}>
            Analyze entire work with this method
          </button>
        )}
      </div>
    </details>
  );
}
