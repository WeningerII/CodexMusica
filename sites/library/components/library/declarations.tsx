"use client";
import options from "@/lib/declaration-options.json";
import {
  PronunciationChoices,
  type PronunciationChoice,
} from "./pronunciation-choices";
import { useState } from "react";
import { Plus, Save, Download, Info } from "lucide-react";
import { download } from "@/lib/library-client";
import type { Method, Reading } from "@/lib/library-types";
type Decl = Record<string, unknown>;
type Section = {
  id: string;
  function: string;
  line_ids: string[];
  name?: string;
  voice?: string;
  source_ranges?: { physical_line?: number }[];
};
const atoms = options.atoms,
  junctions = options.junctions;
export function Declarations({
  reading,
  sections: sourceSections = [],
  pronunciationChoices = [],
  methods,
  value,
  onSave,
  unsaved,
}: {
  reading: Reading;
  sections?: Section[];
  pronunciationChoices?: PronunciationChoice[];
  methods: Method[];
  value: Decl;
  onSave: (v: Decl) => void;
  unsaved: boolean;
}) {
  const lines = reading.lines.filter((l) => l.analysis_line !== null);
  const [targetReady, setTargetReady] = useState(true);
  const [raw, setRaw] = useState(JSON.stringify(value, null, 2)),
    [error, setError] = useState(""),
    [kind, setKind] = useState("verse"),
    [start, setStart] = useState(lines[0]?.analysis_line ?? 1),
    [end, setEnd] = useState(lines[0]?.analysis_line ?? 1),
    [source, setSource] = useState(""),
    [voice, setVoice] = useState(""),
    [hook, setHook] = useState(""),
    [target, setTarget] = useState(""),
    [narrativeAtoms, setNarrativeAtoms] = useState<Record<string, string>>({}),
    [links, setLinks] = useState<Record<string, string>>({});
  let declared: Section[] = [];
  try {
    const parsed = JSON.parse(raw);
    declared = parsed.form?.sections ?? [];
  } catch {}
  const narrativeSections = [
    ...new Map([...sourceSections, ...declared].map((s) => [s.id, s])).values(),
  ]
    .sort((a, b) => {
      const position = (s: Section) =>
        reading.lines.find((l) => l.id === s.line_ids?.[0])?.physical_line ??
        s.source_ranges?.[0]?.physical_line ??
        Number.MAX_SAFE_INTEGER;
      return position(a) - position(b);
    })
    .filter((s) => !["turnaround", "interlude", "solo"].includes(s.function));
  function selectTarget(id: string) {
    setTarget(id);
    setTargetReady(true);
    setError("");
    const section = sourceSections.find((s) => s.id === id);
    if (!section) return;
    const rows = section.line_ids.map((id) => lines.find((l) => l.id === id));
    if (!rows.length || rows.some((l) => !l)) {
      setTargetReady(false);
      setError("Load the section’s source rows before changing its range.");
      return;
    }
    setKind(section.function);
    setVoice(section.voice ?? "");
    const numbers = rows.map((l) => l!.analysis_line!);
    setStart(Math.min(...numbers));
    setEnd(Math.max(...numbers));
  }
  function addSection() {
    try {
      if (!targetReady)
        throw Error(
          "Load the chosen section’s source rows before changing it.",
        );
      const rows = lines.filter(
        (l) => l.analysis_line! >= start && l.analysis_line! <= end,
      );
      if (
        !source.trim() ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start < 1
      )
        throw Error(
          "Choose an existing line range and provide the source or basis.",
        );
      if (rows.length !== end - start + 1)
        throw Error(
          "Load every source row in this analysis-line range before adding it.",
        );
      const v = JSON.parse(raw) as Decl;
      const form = (v.form ?? {}) as Decl;
      const sections = Array.isArray(form.sections)
        ? (form.sections as Section[])
        : [];
      const item = {
        id: target || "declared:" + crypto.randomUUID(),
        function: kind,
        line_ids: rows.map((l) => l.id),
        basis: "reader_declared",
        source,
        ...(voice.trim() ? { voice: voice.trim() } : {}),
      };
      setRaw(
        JSON.stringify(
          {
            ...v,
            form: {
              ...form,
              sections: [...sections.filter((s) => s.id !== item.id), item],
            },
          },
          null,
          2,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addNarrative() {
    try {
      if (!source.trim() || !narrativeSections.length)
        throw Error("Provide a basis and concrete section functions first.");
      const selected = narrativeSections.map((s) => narrativeAtoms[s.id] ?? ""),
        joined = narrativeSections.slice(1).map((s) => links[s.id] ?? "");
      if ([...selected, ...joined].some((s) => !s))
        throw Error(
          "Explicitly choose every section atom and intervening junction.",
        );
      const v = JSON.parse(raw);
      setRaw(
        JSON.stringify(
          { ...v, narrative: { source, atoms: selected, junctions: joined } },
          null,
          2,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addHook() {
    try {
      if (!source.trim() || !hook.trim())
        throw Error("Supply the exact fragment and its source or basis.");
      const v = JSON.parse(raw) as Decl;
      setRaw(
        JSON.stringify(
          {
            ...v,
            hooks: [
              ...(Array.isArray(v.hooks) ? v.hooks : []),
              { text: hook, source },
            ],
          },
          null,
          2,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function save() {
    try {
      const v = JSON.parse(raw);
      if (!v || typeof v !== "object" || Array.isArray(v))
        throw Error("Declarations must be an object.");
      onSave(v);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="declaration-editor">
      <h3>Reading interpretations</h3>
      <p className="note">
        On this device · tied to this edition and revision. Source geometry and
        whole-work scope remain explicit.
      </p>
      <details>
        <summary>Add or interpret a section / line function</summary>
        <label>
          Concrete occurrence
          <select value={target} onChange={(e) => selectTarget(e.target.value)}>
            <option value="">New unmarked range</option>
            {sourceSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.function} · {s.id}
              </option>
            ))}
          </select>
        </label>
        <p className="note">
          An existing occurrence retains its ID. A new range adds a section
          alongside recorded source sections.
        </p>
        <label>
          Function
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {methods
              .filter((m) => m.namespace === "function")
              .map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <div className="range-inputs">
          <label>
            From analysis line
            <input
              type="number"
              min={1}
              max={lines.at(-1)?.analysis_line ?? 1}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
          </label>
          <label>
            To analysis line
            <input
              type="number"
              min={start}
              max={lines.at(-1)?.analysis_line ?? 1}
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          Voice, if explicitly known
          <input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="Leave undeclared unless supplied"
          />
        </label>
        <label>
          Source / basis
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Edition note or your reading"
          />
        </label>
        <button className="button" disabled={!targetReady} onClick={addSection}>
          <Plus size={16} />
          Add range
        </button>
      </details>
      <details>
        <summary>Declare a hook fragment</summary>
        <p className="note">
          A sourced sub-line text fragment is independent from the hook section
          function. Occurrences are found across the entire reading.
        </p>
        <label>
          Exact fragment
          <input value={hook} onChange={(e) => setHook(e.target.value)} />
        </label>
        <label>
          Source / basis
          <input value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <button className="button" onClick={addHook}>
          <Plus size={16} />
          Add hook fragment
        </button>
      </details>
      <details>
        <summary>Narrative interpretation</summary>
        <p className="note">
          These labels express your reading of each concrete section. The
          backend checks declaration grammar; it does not detect narrative
          meaning.
        </p>
        {narrativeSections.map((s, i) => (
          <div key={s.id}>
            {i > 0 && (
              <label>
                Junction before {s.name ?? s.function}
                <select
                  value={links[s.id] ?? ""}
                  onChange={(e) =>
                    setLinks({ ...links, [s.id]: e.target.value })
                  }
                >
                  <option value="">Not declared</option>
                  {junctions
                    .filter(
                      (a) =>
                        !narrativeAtoms[s.id] ||
                        (options.enter as Record<string, string[]>)[
                          a
                        ]?.includes(narrativeAtoms[s.id]),
                    )
                    .map((a) => (
                      <option key={a} value={a}>
                        {a.replaceAll("_", " ")}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              {s.name ?? s.function}
              <select
                value={narrativeAtoms[s.id] ?? ""}
                onChange={(e) =>
                  setNarrativeAtoms({
                    ...narrativeAtoms,
                    [s.id]: e.target.value,
                  })
                }
              >
                <option value="">Not declared</option>
                {atoms
                  .filter((a) =>
                    (options.function_atoms as Record<string, string[]>)[
                      s.function
                    ]?.includes(a),
                  )
                  .map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ))}
        {!narrativeSections.length && (
          <p className="note">
            Analyze to load recorded section occurrences, or declare their
            concrete ranges.
          </p>
        )}
        <label>
          Source / basis
          <input value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <button className="button" onClick={addNarrative}>
          <Plus size={16} />
          Add narrative interpretation
        </button>
      </details>
      <details>
        <summary>Musical setting and native declarations</summary>
        <p className="note">
          Supply only what is known: concrete section IDs, explicit meter
          numerator/denominator, positive bars, and each participating line’s
          exact bar, beat and duration. Grouping, subdivision, isochrony, tempo,
          BeatGrid and melody are independent declarations. Text does not imply
          4/4 or one bar per line.
        </p>
        <p className="note">
          Native options include sourced pronunciation choices,
          stanza/caesura/lift boundaries, tonal templates, refrains, historical
          or delivered surfaces, hooks, voices, response links and narrative
          annotations. The backend validates each field and returns specific
          refusals. Exact fractions use numerator and positive denominator.
        </p>
      </details>
      {(reading.language === "eng" || pronunciationChoices.length > 0) && (
        <PronunciationChoices
          choices={pronunciationChoices}
          onAdd={(row) => {
            try {
              const v = JSON.parse(raw);
              const existing = Array.isArray(v.pronunciations)
                ? v.pronunciations
                : [];
              setRaw(
                JSON.stringify(
                  {
                    ...v,
                    pronunciations: [
                      ...existing.filter(
                        (r: Record<string, unknown>) =>
                          r.line !== row.line || r.token !== row.token,
                      ),
                      row,
                    ],
                  },
                  null,
                  2,
                ),
              );
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      <details>
        <summary>Advanced sourced declarations</summary>
        <label className="json-label">
          Declaration bundle
          <textarea
            aria-label="Reading declaration bundle"
            rows={14}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
          />
        </label>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {unsaved && (
        <p className="error">
          Storage unavailable. These interpretations are unsaved; download them
          before leaving.
        </p>
      )}
      <div className="button-row">
        <button className="button primary" onClick={save}>
          <Save size={16} />
          Apply interpretation
        </button>
        <button
          className="button"
          onClick={() => {
            try {
              download(
                "reading-declarations.json",
                JSON.stringify(
                  {
                    reading_unit_id: reading.reading_unit_id,
                    reading_revision: reading.reading_revision,
                    declarations: JSON.parse(raw),
                  },
                  null,
                  2,
                ),
              );
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Download size={16} />
          Download
        </button>
      </div>
      <p className="note">
        <Info size={13} /> Applying an interpretation creates a new analysis
        identity. Previous evidence remains separately identified.
      </p>
    </section>
  );
}
