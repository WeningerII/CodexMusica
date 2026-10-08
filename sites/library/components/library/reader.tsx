"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Play,
  Pause,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
  Download,
  ExternalLink,
  SlidersHorizontal,
  Plus,
  Check,
  GitCompare,
  Search,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { api, download, openLyrics } from "@/lib/library-client";
import { readDevice, writeDevice } from "@/lib/device-state";
import { hydrateEvidence, component, lineIDs } from "@/lib/evidence-records";
import { randomHex } from "@/lib/reader-crypto";
import {
  readerLenses as READER_LENSES,
  type ReaderLens,
} from "@/lib/reader-lenses";
import {
  languageNames,
  type Evidence,
  type Reading,
  type ReadingLine,
  type ReaderJob,
  type Registry,
  type ResultManifest,
} from "@/lib/library-types";
import { TextMarks } from "./text-marks";
import type { PronunciationChoice } from "./pronunciation-choices";
import { Declarations } from "./declarations";
import { EvidenceCard, MethodDetail, Value } from "./evidence";

const failMessage = (e: unknown) =>
  (e as Error & { remedy?: string }).message +
  ((e as { remedy?: string }).remedy
    ? " " + (e as { remedy: string }).remedy
    : "");
export function Reader({
  id,
  snapshot,
  registry,
  selected,
  onToggle,
  onBack,
  onCompare,
}: {
  id: string;
  snapshot: string;
  registry: Registry;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onBack: () => void;
  onCompare: (id: string, passage?: string[]) => void;
}) {
  const [reading, setReading] = useState<Reading | null>(null),
    [linePage, setLinePage] = useState<{
      next_offset: number | null;
      total: number;
    } | null>(null),
    [lens, setLens] = useState<ReaderLens>("summary"),
    [formView, setFormView] = useState("Structure"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [inspector, setInspector] = useState(true),
    [mobile, setMobile] = useState(false),
    [sourceView, setSourceView] = useState(false),
    [size, setSize] = useState(20),
    [selectedLines, setSelectedLines] = useState<Set<string>>(new Set()),
    [highlight, setHighlight] = useState<Set<string>>(new Set()),
    [highlightRecord, setHighlightRecord] = useState<Evidence | null>(null),
    [startOffset, setStartOffset] = useState(0),
    [anchor, setAnchor] = useState(""),
    [job, setJob] = useState<ReaderJob | null>(null),
    [report, setReport] = useState<ResultManifest | null>(null),
    [records, setRecords] = useState<Evidence[]>([]),
    [nextEvidence, setNextEvidence] = useState<number | null>(null),
    [pageOffset, setPageOffset] = useState(0),
    [declarations, setDeclarations] = useState<Record<string, unknown>>({}),
    [declOpen, setDeclOpen] = useState(false),
    [unsaved, setUnsaved] = useState(false),
    [methodQuery, setMethodQuery] = useState(""),
    [methodFilter, setMethodFilter] = useState("all"),
    [methodsOpen, setMethodsOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voice, setVoice] = useState(""),
    [speed, setSpeed] = useState(1),
    [speaking, setSpeaking] = useState(false),
    [previous, setPrevious] = useState<{ id: string; declarations: unknown }[]>(
      [],
    );
  const linePending = useRef(false),
    autoplayed = useRef(false),
    speakRef = useRef<() => void>(() => {});
  const speechGeneration = useRef(0),
    currentJob = useRef<ReaderJob | null>(null),
    currentReport = useRef<ResultManifest | null>(null);
  const jobId = job?.id;
  useEffect(() => {
    currentReport.current = report;
  }, [report]);
  const evidenceEpoch = useRef(0),
    evidencePending = useRef(new Set<string>()),
    evidenceLoaded = useRef(new Set<string>());
  const [resolved, setResolved] = useState<Evidence[]>([]),
    [incompleteDetails, setIncompleteDetails] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void hydrateEvidence(records).then((result) => {
      if (live) {
        setResolved(result.records);
        setIncompleteDetails(result.pending);
      }
    });
    return () => {
      live = false;
    };
  }, [records]);
  useEffect(() => {
    currentJob.current = job;
  }, [job]);
  const methodById = useMemo(
    () => new Map(registry.methods.map((m) => [m.id, m])),
    [registry],
  );
  const storageKey = reading
    ? `interpretation:${snapshot}:${id}:${reading.reading_revision}`
    : "";
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(location.search),
      initialLens = params.get("lens");
    void readDevice<{ line_id?: string; offset?: number } | string>(
      `position:${snapshot}:${id}`,
      {},
    )
      .catch(() => ({}) as { line_id?: string; offset?: number })
      .then((position) => {
        if (READER_LENSES.some((l) => l.id === initialLens))
          setLens(initialLens as ReaderLens);
        const offset = Number(
          params.get("offset") ??
            (typeof position === "object" ? (position.offset ?? 0) : 0),
        );
        setStartOffset(offset);
        setAnchor(
          params.get("line") ??
            (typeof position === "string"
              ? position
              : (position.line_id ?? "")),
        );
        return api<
          Reading & { line_page: { next_offset: number | null; total: number } }
        >(
          `readings/${id}?snapshot=${snapshot}&offset=${offset}${params.get("revision") ? "&revision=" + encodeURIComponent(params.get("revision")!) : ""}`,
        );
      })
      .then(async (r) => {
        if (!live) return;
        setReading(r);
        setLinePage(r.line_page);
        if (!params.has("revision")) {
          const u = new URL(location.href);
          u.searchParams.set("revision", r.reading_revision);
          history.replaceState(null, "", u);
        }
        const span = params.get("span")?.split(":").map(Number);
        if (span?.length === 2 && span.every(Number.isSafeInteger)) {
          setHighlightRecord({
            id: "search-anchor",
            kind: "line",
            normalized_ranges: [
              {
                codepoint_range: span,
                precision:
                  params.get("precision") === "exact" ? "exact" : "span",
              },
            ],
          });
          if (params.get("line")) setHighlight(new Set([params.get("line")!]));
        }
        const key = `interpretation:${snapshot}:${id}:${r.reading_revision}`;
        try {
          const stored = await readDevice<{
            declarations: Record<string, unknown>;
            job_id?: string;
            previous?: { id: string; declarations: unknown }[];
          }>(key, { declarations: {} });
          if (!live) return;
          setDeclarations(stored.declarations);
          setPrevious(stored.previous ?? []);
          if (stored.job_id) {
            const data = await api<{ job: ReaderJob }>(`jobs/${stored.job_id}`);
            if (live) setJob(data.job);
          }
        } catch (e) {
          if ((e as { code?: string }).code !== "NOT_FOUND")
            setNotice(failMessage(e));
        }
      })
      .catch((e) => live && setError(failMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
      speechGeneration.current++;
      window.speechSynthesis?.cancel();
    };
  }, [id, snapshot]);
  useEffect(() => {
    const sync = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    sync();
    window.speechSynthesis?.addEventListener("voiceschanged", sync);
    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", sync);
  }, []);
  const loadEvidence = useCallback(
    async (j: ReaderJob, offset = 0, append = false) => {
      if (!j.manifest_hash) return;
      const hash = j.manifest_hash,
        key = `${j.id}:${hash}:${offset}`;
      if (
        evidencePending.current.has(key) ||
        (append && evidenceLoaded.current.has(key))
      )
        return;
      if (append && currentReport.current?.manifest_hash !== hash) return;
      evidencePending.current.add(key);
      const epoch = append ? evidenceEpoch.current : ++evidenceEpoch.current;
      try {
        const [manifest, page] = await Promise.all([
          api<ResultManifest>(`analyses/${j.id}/manifest?manifest=${hash}`),
          api<{ instances: Evidence[]; next_offset: number | null }>(
            `analyses/${j.id}/results?manifest=${hash}&offset=${offset}`,
          ),
        ]);
        if (
          currentJob.current?.id !== j.id ||
          evidenceEpoch.current !== epoch ||
          (append && currentReport.current?.manifest_hash !== hash)
        )
          return;
        if (!append) evidenceLoaded.current.clear();
        evidenceLoaded.current.add(key);
        currentReport.current = manifest;
        setReport(manifest);
        setRecords((old) =>
          append ? [...old, ...page.instances] : page.instances,
        );
        setNextEvidence(page.next_offset);
        setPageOffset(offset);
      } finally {
        evidencePending.current.delete(key);
      }
    },
    [],
  );
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    const tick = async () => {
      try {
        const data = await api<{ job: ReaderJob }>(`jobs/${jobId}`);
        if (!live || currentJob.current?.id !== jobId) return;
        if (data.job.manifest_hash && !currentReport.current)
          await loadEvidence(data.job);
        else if (
          data.job.manifest_hash &&
          data.job.manifest_hash !== currentReport.current?.manifest_hash
        )
          setNotice(
            "A newer evidence checkpoint is available. Load it explicitly to replace the currently pinned pages.",
          );
        if (!live || currentJob.current?.id !== jobId) return;
        setJob(data.job);
      } catch (e) {
        if (live) setError(failMessage(e));
      }
    };
    const initial = currentJob.current;
    if (initial?.manifest_hash && !currentReport.current)
      void loadEvidence(initial).catch((e) => {
        if (live && currentJob.current?.id === jobId) setError(failMessage(e));
      });
    const timer = setInterval(() => {
      if (
        ["queued", "running", "deferred_requeue"].includes(
          currentJob.current?.state ?? "",
        )
      )
        void tick();
    }, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [jobId, loadEvidence]);
  async function analyze(method?: string) {
    if (!reading) return;
    setBusy(true);
    setError("");
    try {
      const old = job ? [...previous, { id: job.id, declarations }] : previous;
      const data = await api<{ job: ReaderJob }>("analyses", {
        method: "POST",
        body: JSON.stringify({
          contract_version: 1,
          snapshot_id: snapshot,
          reading_unit_id: id,
          reading_revision: reading.reading_revision,
          declaration_set: declarations,
          requested_layers: ["sound", "form", "rhythm", "language"],
          ...(method ? { requested_methods: [method] } : {}),
          idempotency_key: randomHex(16),
        }),
      });
      evidenceEpoch.current++;
      evidenceLoaded.current.clear();
      currentJob.current = data.job;
      currentReport.current = null;
      setPrevious(old);
      setJob(data.job);
      setReport(null);
      setRecords([]);
      try {
        await writeDevice(storageKey, {
          declarations,
          job_id: data.job.id,
          previous: old,
        });
        setUnsaved(false);
      } catch {
        setUnsaved(true);
      }
    } catch (e) {
      setError(failMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function control(action: "cancel" | "resume" | "delete") {
    if (!job) return;
    setBusy(true);
    try {
      if (action === "delete") {
        await api(`jobs/${job.id}`, {
          method: "DELETE",
          headers: { "idempotency-key": randomHex(16) },
        });
        evidenceEpoch.current++;
        evidenceLoaded.current.clear();
        currentJob.current = null;
        currentReport.current = null;
        setJob(null);
        setReport(null);
        setRecords([]);
        await writeDevice(storageKey, { declarations, previous });
      } else {
        const result = await api<{ job: ReaderJob }>(
          `jobs/${job.id}/${action}`,
          {
            method: "POST",
            headers: { "idempotency-key": randomHex(16) },
            body: "{}",
          },
        );
        setJob(result.job);
      }
    } catch (e) {
      setError(failMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeSourcePage(direction: "next" | "previous") {
    if (
      !reading ||
      linePending.current ||
      (direction === "next" && linePage?.next_offset === null) ||
      (direction === "previous" && startOffset === 0)
    )
      return;
    linePending.current = true;
    setBusy(true);
    try {
      const revision = reading.reading_revision,
        rows: ReadingLine[] = [];
      let offset =
          direction === "next"
            ? (linePage?.next_offset ?? 0)
            : Math.max(0, startOffset - 250),
        next: { next_offset: number | null; total: number } | null = null;
      const initialOffset = offset;
      do {
        const limit =
          direction === "previous" ? Math.min(250, startOffset - offset) : 250;
        const r = await api<
          Reading & { line_page: { next_offset: number | null; total: number } }
        >(
          `readings/${id}?snapshot=${snapshot}&revision=${revision}&offset=${offset}&limit=${limit}`,
        );
        rows.push(...r.lines);
        next = r.line_page;
        if (direction === "next") break;
        if (
          !r.lines.length ||
          (next.next_offset !== null && next.next_offset <= offset)
        )
          throw Error("The source page did not advance.");
        offset = next.next_offset ?? startOffset;
      } while (offset < startOffset);
      setReading((current) => {
        if (!current || current.reading_revision !== revision) return current;
        const ordered =
          direction === "previous"
            ? [...rows, ...current.lines]
            : [...current.lines, ...rows];
        return {
          ...current,
          lines: Array.from(new Map(ordered.map((l) => [l.id, l])).values()),
        };
      });
      if (direction === "previous") setStartOffset(initialOffset);
      else if (next) setLinePage(next);
    } catch (e) {
      setError(failMessage(e));
    } finally {
      linePending.current = false;
      setBusy(false);
    }
  }
  async function loadLines() {
    await changeSourcePage("next");
  }
  async function fullReading() {
    if (!reading) throw Error("Reading unavailable");
    return api<Reading>(
      `readings/${id}?snapshot=${snapshot}&revision=${reading.reading_revision}&whole=1`,
    );
  }
  async function handoff(excerpt = false) {
    const receiver = window.open("about:blank", "_blank");
    setBusy(true);
    setNotice("");
    try {
      const whole = await fullReading();
      const selected = whole.lines.filter(
        (l) => selectedLines.has(l.id) && l.analysis_line !== null,
      );
      const result = await openLyrics(
        whole,
        excerpt
          ? {
              text: selected.map((l) => l.text).join("\n"),
              line_ids: selected.map((l) => l.id),
            }
          : undefined,
        declarations,
        receiver,
      );
      setNotice(result.message);
    } catch (e) {
      receiver?.close();
      setError(failMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportAnalysis() {
    if (!job?.manifest_hash) return;
    const manifestHash = report?.manifest_hash ?? job.manifest_hash;
    setBusy(true);
    setError("");
    try {
      const key = `analysis-export:${job.id}:${manifestHash}`,
        existing = await readDevice<string | null>(key, null).catch(() => null);
      let result = existing
        ? await api<{
            export_id: string;
            state: string;
            download_url?: string;
          }>(`exports/${existing}`)
        : await api<{
            export_id: string;
            state: string;
            download_url?: string;
          }>(`analyses/${job.id}/export?manifest=${manifestHash}`, {
            method: "POST",
            body: "{}",
          });
      await writeDevice(key, result.export_id).catch(() => setUnsaved(true));
      await writeDevice("pending-export", result.export_id).catch(() =>
        setUnsaved(true),
      );
      while (result.state !== "ready") {
        result = await api(`exports/${result.export_id}/step`, {
          method: "POST",
          body: "{}",
        });
        setNotice(
          "Preparing the pinned analysis checkpoint with all evidence pages and source credits.",
        );
        if ((result as { busy?: boolean }).busy)
          await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!result.download_url)
        throw Error("The analysis package has no download address.");
      const a = document.createElement("a");
      a.href = result.download_url;
      a.download = "codex-musica-analysis.zip";
      a.click();
      await writeDevice("pending-export", null).catch(() => setUnsaved(true));
      setNotice(
        "The pinned analysis package is ready, including its original declarations and every committed evidence page.",
      );
    } catch (e) {
      setError(failMessage(e));
      setNotice(
        "Export paused. Use this action again to resume its committed steps.",
      );
    } finally {
      setBusy(false);
    }
  }
  function inspect(record: Evidence) {
    setHighlightRecord(record);
    const ids = lineIDs(record);
    setHighlight(ids);
    const first = reading?.lines.find((l) => ids.has(l.id));
    if (first)
      document
        .getElementById(first.id)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    else if (ids.size)
      setNotice(
        "This evidence is elsewhere in the work. Load the next source lines to locate its spans.",
      );
  }
  function speak() {
    if (speaking) {
      speechGeneration.current++;
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const lang = reading?.language ?? "",
      tags: Record<string, string> = {
        eng: "en",
        fas: "fa",
        fin: "fi",
        cym: "cy",
        non: "is",
        ltc: "zh",
        msa: "ms",
        san: "sa",
        som: "so",
      };
    const chosen =
      voices.find((v) => v.voiceURI === voice) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(tags[lang] ?? "!"));
    if (!chosen) {
      setNotice("No matching device voice is available for this language.");
      return;
    }
    const generation = ++speechGeneration.current;
    setSpeaking(true);
    void fullReading()
      .then((r) => {
        const chunks = r.lines
          .filter((l) => l.analysis_line !== null)
          .map((l) => l.text)
          .filter(Boolean);
        let i = 0;
        function next() {
          if (generation !== speechGeneration.current) return;
          if (i >= chunks.length) {
            setSpeaking(false);
            return;
          }
          const utterance = new SpeechSynthesisUtterance(chunks[i++]);
          utterance.voice = chosen!;
          utterance.rate = speed;
          utterance.onend = next;
          utterance.onerror = () => setSpeaking(false);
          speechSynthesis.speak(utterance);
        }
        next();
      })
      .catch((e) => {
        setError(failMessage(e));
        setSpeaking(false);
      });
  }
  useEffect(() => {
    speakRef.current = speak;
  });
  useEffect(() => {
    if (
      !reading ||
      !voices.length ||
      autoplayed.current ||
      new URLSearchParams(location.search).get("autoplay") !== "1"
    )
      return;
    autoplayed.current = true;
    const u = new URL(location.href);
    u.searchParams.delete("autoplay");
    history.replaceState(null, "", u);
    speakRef.current();
  }, [reading, voices]);
  useEffect(() => {
    if (anchor && reading?.lines.some((l) => l.id === anchor))
      document.getElementById(anchor)?.scrollIntoView({ block: "center" });
  }, [anchor, reading]);
  useEffect(() => {
    if (!reading) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const element = visible[0]?.target;
        if (!element) return;
        const index = reading.lines.findIndex((l) => l.id === element.id);
        if (index < 0) return;
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            void writeDevice(`position:${snapshot}:${id}`, {
              line_id: element.id,
              offset: Math.max(0, startOffset + index - 30),
            }).catch(() => setUnsaved(true)),
          800,
        );
      },
      { rootMargin: "-150px 0px -55% 0px" },
    );
    reading.lines.forEach((l) => {
      const element = document.getElementById(l.id);
      if (element) observer.observe(element);
    });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [reading, snapshot, id, startOffset]);
  function toggleLine(line: ReadingLine) {
    if (line.analysis_line === null) return;
    setSelectedLines((old) => {
      const set = new Set(old);
      if (set.has(line.id)) set.delete(line.id);
      else set.add(line.id);
      return set;
    });
    void writeDevice(`position:${snapshot}:${id}`, {
      line_id: line.id,
      offset: Math.max(
        0,
        startOffset + reading!.lines.findIndex((l) => l.id === line.id) - 30,
      ),
    }).catch(() => setUnsaved(true));
  }
  const form = component(resolved, "form_result"),
    language = component(resolved, "language_result");
  const visible = resolved.filter((r) => {
    if (methodFilter !== "all" && r.method_id !== methodFilter) return false;
    if (
      selectedLines.size &&
      lineIDs(r).size &&
      !Array.from(lineIDs(r)).some((i) => selectedLines.has(i))
    )
      return false;
    if (lens === "sound")
      return !["form_result", "language_result", "syllable", "token"].includes(
        r.kind,
      );
    if (lens === "rhythm")
      return (
        r.kind === "syllable" ||
        (r.kind === "form_result" &&
          (String(Array.isArray(r.path) ? r.path[0] : "") === "rhythm" ||
            (r.result && typeof r.result === "object" && "rhythm" in r.result)))
      );
    if (lens === "language") return r.kind === "language_result";
    if (lens === "form") return r.kind === "form_result";
    return false;
  });
  const inspectors = (
    <div className="inspector-content">
      <div
        className="lens-tabs"
        role="group"
        aria-label="Interpretation lenses"
      >
        {READER_LENSES.map((l) => (
          <button
            key={l.id}
            aria-pressed={lens === l.id}
            className={lens === l.id ? "active" : ""}
            onClick={() => {
              setLens(l.id);
              const u = new URL(location.href);
              u.searchParams.set("lens", l.id);
              history.replaceState(null, "", u);
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
      <section className="analysis-status">
        <div>
          <strong>
            {job ? job.state.replaceAll("_", " ") : "Interpret the entire work"}
          </strong>
          {job && (
            <span className="state-badge">
              {report?.partial
                ? "Partial evidence"
                : report
                  ? "Complete report"
                  : "Waiting for evidence"}
            </span>
          )}
        </div>
        <p className="note">
          {job
            ? "Complete reading unit · selection only filters evidence"
            : "Native sound, form, rhythm and language · deterministic analysis"}
        </p>
        {job && <Value value={job.progress} />}
        <button
          className="button primary full-width"
          disabled={busy}
          onClick={() => void analyze()}
        >
          {busy
            ? "Working…"
            : job
              ? "New whole-work analysis"
              : "Analyze entire work"}
        </button>
        {job && (
          <div className="job-controls">
            {["paused", "cancelled", "failed"].includes(job.state) && (
              <button
                className="button"
                disabled={busy || !!job.deferred_requeue}
                onClick={() => void control("resume")}
              >
                Resume
              </button>
            )}
            {["running", "queued"].includes(job.state) && (
              <button
                className="button"
                disabled={busy}
                onClick={() => void control("cancel")}
              >
                Cancel
              </button>
            )}
            <button
              className="text-link"
              onClick={() => void control("delete")}
            >
              Delete analysis
            </button>
          </div>
        )}
        {job?.reason && <Value value={job.reason} />}
        {job?.manifest_hash &&
          report?.manifest_hash &&
          job.manifest_hash !== report.manifest_hash && (
            <button
              className="button full-width"
              onClick={() =>
                void loadEvidence(job).catch((e) => setError(failMessage(e)))
              }
            >
              Load latest evidence checkpoint
            </button>
          )}
        <button className="text-link" onClick={() => setDeclOpen(!declOpen)}>
          <SlidersHorizontal size={15} />
          Reading interpretations
        </button>
      </section>
      {declOpen && reading && (
        <Declarations
          key={JSON.stringify(declarations)}
          reading={reading}
          pronunciationChoices={Array.from(
            new Map(
              resolved
                .filter((r) => r.kind === "token" && r.reading_choices)
                .map((r) => {
                  const c = r.reading_choices as PronunciationChoice;
                  return [c.line + ":" + c.token, c] as const;
                }),
            ).values(),
          )}
          sections={
            Array.isArray(form.sections)
              ? (form.sections as {
                  id: string;
                  function: string;
                  line_ids: string[];
                  name?: string;
                  voice?: string;
                }[])
              : []
          }
          methods={registry.methods}
          value={declarations}
          unsaved={unsaved}
          onSave={(v) => {
            setDeclarations(v);
            setDeclOpen(false);
            setNotice(
              "Interpretation saved on this device. Run a new whole-work analysis to apply it.",
            );
            void writeDevice(storageKey, {
              declarations: v,
              job_id: job?.id,
              previous,
            }).catch(() => setUnsaved(true));
          }}
        />
      )}
      {lens === "summary" && reading && (
        <>
          <section className="inspect-section">
            <h3>This reading</h3>
            <div className="measure-grid">
              <button onClick={() => setLens("form")}>
                <b>{linePage?.total ?? reading.lines.length}</b>physical rows
              </button>
              <button onClick={() => setLens("form")}>
                <b>{String(reading.completeness).replaceAll("_", " ")}</b>
                documented scope
              </button>
            </div>
            <p className="note">{reading.source_path}</p>
          </section>
          {report && (
            <section className="inspect-section">
              <h3>Coverage of the entire unit</h3>
              <Value value={report.summary ?? report.coverage} />
              <p className="note">
                Unknown readings and refused obligations remain separate from
                measured results.
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() => void exportAnalysis()}
              >
                <Download size={15} />
                {report.partial
                  ? "Export partial checkpoint"
                  : "Export complete analysis"}
              </button>
            </section>
          )}
          {previous.length > 0 && (
            <details className="inspect-section">
              <summary>Earlier analyses ({previous.length})</summary>
              {previous.map((p) => (
                <button
                  className="text-link"
                  key={p.id}
                  onClick={() =>
                    void api<{ job: ReaderJob }>(`jobs/${p.id}`)
                      .then((r) => {
                        evidenceEpoch.current++;
                        evidenceLoaded.current.clear();
                        currentJob.current = r.job;
                        currentReport.current = null;
                        setJob(r.job);
                        setRecords([]);
                        setReport(null);
                      })
                      .catch((e) => setError(failMessage(e)))
                  }
                >
                  Open {p.id.slice(-12)}
                </button>
              ))}
            </details>
          )}
        </>
      )}
      {lens === "form" && (
        <>
          <div className="subview-tabs">
            {["Structure", "Returns", "Voices", "Narrative"].map((x) => (
              <button
                className={formView === x ? "active" : ""}
                key={x}
                onClick={() => setFormView(x)}
              >
                {x}
              </button>
            ))}
          </div>
          {Object.keys(form).length > 0 && (
            <section className="inspect-section">
              <h3>{formView}</h3>
              <Value
                value={
                  formView === "Structure"
                    ? {
                        sections: form.sections,
                        stanzas: form.stanzas,
                        profile: form.profile,
                        shape: form.shape,
                        hooks: form.hooks,
                      }
                    : form[formView.toLowerCase()]
                }
              />
            </section>
          )}
        </>
      )}
      {lens === "rhythm" && Object.keys(form).length > 0 && (
        <section className="inspect-section">
          <h3>Native rhythm and setting</h3>
          <Value value={form.rhythm} />
          <p className="note">
            Meter, bars, duration, grouping and performance timing remain
            undeclared unless supplied.
          </p>
        </section>
      )}
      {lens === "language" && Object.keys(language).length > 0 && (
        <section className="inspect-section">
          <h3>Language measurements</h3>
          <Value value={language} />
        </section>
      )}
      {lens === "sources" && reading && (
        <>
          <section className="inspect-section">
            <h3>Text, edition and digital witness</h3>
            <Value
              value={{
                work_id: reading.work_id,
                edition_id: reading.edition_id,
                contributors: reading.contributors,
                source_path: reading.source_path,
                completeness: reading.completeness,
                metadata: reading.metadata,
              }}
            />
          </section>
          <section className="inspect-section">
            <h3>Rights and required credits</h3>
            <Value value={reading.rights} />
            <Value value={reading.source_basis} />
          </section>
          <section className="inspect-section">
            {job && (
              <details>
                <summary>Analysis engine and resource identity</summary>
                <Value value={job.identity} />
                <Value value={report?.identity} />
              </details>
            )}
            <h3>Recorded source labels</h3>
            <Value value={reading.source_labels} />
            <h3>Exact source identity</h3>
            <p className="hash-text">
              Snapshot {snapshot}
              <br />
              Revision {reading.reading_revision}
              <br />
              Source SHA256 {reading.source_sha256}
            </p>
            <button
              className="button"
              onClick={() =>
                void fullReading()
                  .then((r) =>
                    download(
                      "reading-provenance.json",
                      JSON.stringify(
                        {
                          snapshot_id: snapshot,
                          reading_unit_id: id,
                          reading_revision: r.reading_revision,
                          rights: r.rights,
                          source_map: r.source_map,
                          source_marks: r.source_marks,
                          source_labels: r.source_labels,
                          source_basis: r.source_basis,
                          work_reviewed_equivalence:
                            r.work_reviewed_equivalence,
                          metadata: r.metadata,
                        },
                        null,
                        2,
                      ),
                    ),
                  )
                  .catch((e) => setError(failMessage(e)))
              }
            >
              <Download size={15} />
              Source details
            </button>
          </section>
        </>
      )}
      {lens !== "sources" && lens !== "summary" && (
        <section className="inspect-section">
          <h3>Evidence{selectedLines.size ? " in selected passage" : ""}</h3>
          {incompleteDetails.length > 0 && (
            <p className="note">
              {incompleteDetails.length} records require further verified detail
              pages. They remain incomplete until every referenced part is
              loaded.
            </p>
          )}
          <label className="small-label">
            Method
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="all">All available methods</option>
              {registry.methods
                .filter(
                  (m) =>
                    m.reader_requestable &&
                    (!m.language || m.language === reading?.language),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          {visible.map((r) => (
            <EvidenceCard
              key={r.id}
              record={r}
              method={methodById.get(r.method_id ?? "")}
              inspect={inspect}
            />
          ))}
          {!visible.length && (
            <p className="note">
              {job
                ? "No evidence in the loaded pages for this lens. Further pages and committed generations remain addressable."
                : "Analyze the entire work to inspect backend evidence."}
            </p>
          )}
          {nextEvidence !== null && (
            <button
              className="button full-width"
              disabled={busy}
              onClick={() =>
                job &&
                void loadEvidence(
                  {
                    ...job,
                    manifest_hash: report?.manifest_hash ?? job.manifest_hash,
                  },
                  nextEvidence,
                  true,
                ).catch((e) => setError(failMessage(e)))
              }
            >
              Load more evidence · page {nextEvidence + 1}
            </button>
          )}
          {report && (
            <p className="note">
              {report.evidence_count} committed records across{" "}
              {report.page_count} pages ·{" "}
              {report.partial ? "partial" : "complete"}. Loaded through page{" "}
              {pageOffset + 1}.
            </p>
          )}
        </section>
      )}
      <section className="inspect-section">
        <button
          className="text-link"
          onClick={() => setMethodsOpen(!methodsOpen)}
        >
          <Search size={15} />
          Method reference · {registry.counts.schemas} schemas /{" "}
          {registry.counts.functions} functions
        </button>
        {methodsOpen && (
          <>
            <input
              className="method-search"
              placeholder="Find a method or requirement"
              aria-label="Search method reference"
              value={methodQuery}
              onChange={(e) => setMethodQuery(e.target.value)}
            />
            {registry.methods
              .filter((m) =>
                `${m.name} ${m.aliases?.join(" ")} ${m.required_capabilities?.join(" ")}`
                  .toLowerCase()
                  .includes(methodQuery.toLowerCase()),
              )
              .map((m) => (
                <MethodDetail
                  key={m.id}
                  method={m}
                  onAnalyze={
                    m.reader_requestable
                      ? (method) => void analyze(method.id)
                      : undefined
                  }
                />
              ))}
          </>
        )}
      </section>
      <section className="inspect-section">
        <h3>Read aloud</h3>
        <label>
          Device voice
          <select value={voice} onChange={(e) => setVoice(e.target.value)}>
            <option value="">Match language</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} · {v.lang}
              </option>
            ))}
          </select>
        </label>
        <label>
          Speed
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
        <button className="button" onClick={speak}>
          {speaking ? <Pause size={16} /> : <Play size={16} />}{" "}
          {speaking ? "Stop" : "Read this work"}
        </button>
        <p className="note">
          {reading?.language === "ltc"
            ? "Modern Chinese device speech · independent from Middle Chinese analysis"
            : "Device speech · independent from phonology evidence"}
        </p>
      </section>
    </div>
  );
  if (loading)
    return (
      <div className="empty-state">
        <BookOpen />
        <h2>Opening the source…</h2>
      </div>
    );
  if (!reading)
    return (
      <div className="empty-state">
        <h2>Reading unavailable</h2>
        <p role="alert">{error}</p>
        <button className="button" onClick={onBack}>
          Back to works
        </button>
      </div>
    );
  return (
    <div className={`complete-reader ${inspector ? "" : "inspector-hidden"}`}>
      <div className="reader-toolbar">
        <button className="text-link" onClick={onBack}>
          <ArrowLeft size={17} />
          Works
        </button>
        <span className="chip">
          {languageNames[reading.language] ?? reading.language}
        </span>
        <label className="source-toggle">
          <input
            type="checkbox"
            checked={sourceView}
            onChange={(e) => setSourceView(e.target.checked)}
          />
          Source transcription
        </label>
        <button
          className="icon-button"
          aria-label="Decrease reading size"
          onClick={() => setSize(Math.max(16, size - 2))}
        >
          A−
        </button>
        <button
          className="icon-button"
          aria-label="Increase reading size"
          onClick={() => setSize(Math.min(32, size + 2))}
        >
          A+
        </button>
        <button
          className="button mobile-inspect"
          onClick={() => setMobile(true)}
        >
          Inspect
        </button>
        <button
          className="icon-button inspector-toggle"
          aria-label={inspector ? "Collapse inspector" : "Open inspector"}
          onClick={() => setInspector(!inspector)}
        >
          {inspector ? (
            <PanelRightClose size={18} />
          ) : (
            <PanelRightOpen size={18} />
          )}
        </button>
      </div>
      <div className="reader-columns">
        <article className="reading-paper">
          <header className="poem-heading">
            <p className="eyebrow">
              {String(reading.completeness).replaceAll("_", " ")} ·{" "}
              {sourceView ? "Source transcription" : "Normalized reading text"}
            </p>
            <h1>{reading.title}</h1>
            <p className="poem-author">
              {reading.contributors.map((c) => c.name).join(" · ")}
            </p>
            <div className="button-row">
              <button className="button" onClick={() => onToggle(id)}>
                {selected.has(id) ? <Check size={16} /> : <Plus size={16} />}
                Export selection
              </button>
              <button className="button" onClick={() => onCompare(id)}>
                <GitCompare size={16} />
                Compare
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => void handoff()}
              >
                <ExternalLink size={16} />
                Open in Lyrics
              </button>
            </div>
          </header>
          {error && (
            <p className="reader-alert error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="reader-alert" role="status">
              {notice}
            </p>
          )}
          {unsaved && (
            <p className="reader-alert error">
              Device storage is unavailable. Download interpretations to
              preserve them.
            </p>
          )}
          {selectedLines.size > 0 && (
            <div className="selection-actions">
              <b>{selectedLines.size} lines selected</b>
              <button
                onClick={() => {
                  setHighlight(new Set(selectedLines));
                  setMobile(true);
                }}
              >
                Inspect
              </button>
              <button onClick={() => onCompare(id, Array.from(selectedLines))}>
                Compare passage
              </button>
              <button
                onClick={() => {
                  setDeclOpen(true);
                  setMobile(true);
                }}
              >
                Annotate
              </button>
              <button onClick={() => void handoff(true)}>
                Open excerpt in Lyrics
              </button>
              <button
                aria-label="Clear passage selection"
                onClick={() => setSelectedLines(new Set())}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div
            className="source-lines"
            dir={reading.direction}
            style={{ fontSize: size }}
          >
            {startOffset > 0 && (
              <button
                className="button full-width"
                disabled={busy}
                onClick={() => void changeSourcePage("previous")}
              >
                Load preceding source rows
              </button>
            )}
            {reading.lines
              .filter(
                (l) =>
                  sourceView ||
                  l.kind === "lyric" ||
                  l.kind === "blank" ||
                  l.kind === "structure",
              )
              .map((l) => (
                <div
                  id={l.id}
                  key={l.id}
                  className={`source-line line-kind-${l.kind} ${highlight.has(l.id) ? "evidence-highlight" : ""} ${selectedLines.has(l.id) ? "passage-selected" : ""}`}
                  style={{ scrollMarginTop: 200 }}
                >
                  <button
                    className="line-number"
                    aria-label={`${selectedLines.has(l.id) ? "Deselect" : "Select"} analysis line ${l.analysis_line ?? "source row " + l.physical_line}`}
                    onClick={() => toggleLine(l)}
                    disabled={l.analysis_line === null}
                  >
                    {sourceView ? l.physical_line : (l.analysis_line ?? "")}
                  </button>
                  <span
                    lang={reading.language}
                    style={{
                      paddingInlineStart: sourceView
                        ? 0
                        : Math.min(l.indent, 30) + "ch",
                    }}
                  >
                    <TextMarks
                      line={l}
                      record={highlightRecord}
                      source={sourceView}
                    />
                  </span>
                  <button
                    className="source-location"
                    aria-label={`Inspect source row ${l.physical_line}`}
                    onClick={() => {
                      setHighlight(new Set([l.id]));
                      setLens("sources");
                      setNotice(
                        `Source row ${l.physical_line} · ${l.source_ranges.map((r) => r.precision).join(", ")} coordinates`,
                      );
                      setMobile(true);
                    }}
                  >
                    ↗
                  </button>
                </div>
              ))}
          </div>
          {linePage?.next_offset !== null && (
            <button
              className="button full-width"
              disabled={busy}
              onClick={() => void loadLines()}
            >
              Load next source rows · {reading.lines.length} / {linePage?.total}
            </button>
          )}
          <footer className="poem-footer">
            <BookOpen size={15} />
            <span>
              Every interpretation uses the complete identified reading unit.
              Apparatus is preserved in Source transcription.
            </span>
          </footer>
        </article>
        {inspector && (
          <aside
            className="complete-inspector"
            aria-label="Interpretation inspector"
          >
            {inspectors}
          </aside>
        )}
      </div>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="bottom" className="mobile-reader-sheet">
          <SheetTitle>Interpret this reading</SheetTitle>
          <SheetDescription>
            Evidence from the complete reading unit
          </SheetDescription>
          {inspectors}
        </SheetContent>
      </Sheet>
    </div>
  );
}
