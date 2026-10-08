"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Library,
  BookOpen,
  Search,
  FileText,
  Scale,
  Music2,
  Guitar,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Check,
  Play,
  MoreVertical,
  SlidersHorizontal,
  Download,
  X,
  ExternalLink,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import artwork from "@/lib/artwork.json";
import { api, download } from "@/lib/library-client";
import { readDevice, writeDevice } from "@/lib/device-state";
import {
  languageNames,
  type Catalog,
  type Collection,
  type Manifest,
  type ReadingSummary,
  type Registry,
} from "@/lib/library-types";
import { Reader } from "./reader";
import { Comparison } from "./comparison";
import { ComparisonPicker } from "./comparison-picker";
import { MethodDetail, Value } from "./evidence";

async function completeCatalog(snapshot: string) {
  const collections: Collection[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page: Catalog & { next_offset: number | null } = await api<
      Catalog & { next_offset: number | null }
    >(`catalog?snapshot=${snapshot}&offset=${offset}&limit=250`);
    collections.push(...page.collections);
    offset = page.next_offset;
  }
  return { collections };
}
function art(c: Collection) {
  const name = (c.title + " " + c.source_path)
    .toLowerCase()
    .replaceAll("_", " ");
  return artwork.find((a) =>
    a.id === "li-qingzhao"
      ? /li qingzhao|李清照/.test(name)
      : a.id === "bilhana"
        ? /bilhana|bilhaṇa|caurap/.test(name)
        : name.includes(a.id),
  );
}
function Shelf({
  language,
  items,
  selected,
  onOpen,
  onSelect,
  onPlay,
}: {
  language: string;
  items: Collection[];
  selected: Set<string>;
  onOpen: (c: Collection) => void;
  onSelect: (c: Collection) => void;
  onPlay: (c: Collection) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    logical = useRef(0),
    persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    [shelfUnsaved, setShelfUnsaved] = useState(false),
    [windowed, setWindowed] = useState({
      start: 0,
      count: 12,
      width: 0,
      gap: 22,
    });
  const copies = items.length > 1 ? [...items, ...items, ...items] : items;
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    let frame = 0,
      live = true;
    const resize = () => {
      const card = e.querySelector(".collection-card");
      if (!card) return;
      const width = card.getBoundingClientRect().width,
        gap = Number.parseFloat(getComputedStyle(e).gap) || 22,
        stride = width + gap,
        count = Math.ceil(e.clientWidth / stride) + 6,
        position = (items.length > 1 ? items.length : 0) + logical.current;
      setWindowed({
        start: Math.max(
          0,
          Math.min(copies.length - count, Math.floor(position) - 3),
        ),
        count,
        width,
        gap,
      });
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        e.scrollLeft = position * stride;
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(e);
    resize();
    void readDevice<number>(`shelf-position:${language}`, 0)
      .then((position) => {
        if (!live) return;
        logical.current = Number.isFinite(position)
          ? Math.max(0, Math.min(items.length - 1, position))
          : 0;
        resize();
      })
      .catch(() => {
        if (live) setShelfUnsaved(true);
      });
    return () => {
      live = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(persistTimer.current);
      void writeDevice(`shelf-position:${language}`, logical.current).catch(
        () => {},
      );
    };
  }, [items.length, language, copies.length]);
  function loop() {
    const e = ref.current;
    if (!e || !windowed.width) return;
    const stride = windowed.width + windowed.gap,
      span = items.length * stride;
    if (items.length > 1) {
      if (e.scrollLeft < stride) e.scrollLeft += span;
      else if (e.scrollLeft > e.scrollWidth - e.clientWidth - stride)
        e.scrollLeft -= span;
    }
    logical.current =
      items.length > 1
        ? (((e.scrollLeft / stride) % items.length) + items.length) %
          items.length
        : 0;
    setWindowed((old) => ({
      ...old,
      start: Math.max(
        0,
        Math.min(
          copies.length - old.count,
          Math.floor(e.scrollLeft / stride) - 3,
        ),
      ),
    }));
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(
      () =>
        void writeDevice(`shelf-position:${language}`, logical.current)
          .then(() => setShelfUnsaved(false))
          .catch(() => setShelfUnsaved(true)),
      500,
    );
  }
  return (
    <section className="shelf">
      <div className="shelf-heading">
        <h2>{languageNames[language] ?? language}</h2>
        <span>
          {items.length} collections{shelfUnsaved ? " · position unsaved" : ""}
        </span>
      </div>
      <div
        className="shelf-scroll"
        ref={ref}
        onScroll={loop}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            ["ArrowLeft", "ArrowRight"].includes(e.key)
          ) {
            e.preventDefault();
            e.currentTarget.scrollLeft +=
              (e.key === "ArrowLeft" ? -1 : 1) *
              (windowed.width + windowed.gap);
          }
        }}
        tabIndex={0}
        aria-label={`${languageNames[language]} collections, scroll horizontally`}
      >
        {windowed.start > 0 && windowed.width > 0 && (
          <div
            aria-hidden="true"
            style={{
              flex: `0 0 ${windowed.start * (windowed.width + windowed.gap) - windowed.gap}px`,
            }}
          />
        )}
        {copies
          .slice(windowed.start, windowed.start + windowed.count)
          .map((c, j) => {
            const i = windowed.start + j,
              a = art(c),
              middle =
                items.length === 1 ||
                (i >= items.length && i < items.length * 2),
              chosen =
                c.readable_reading_unit_ids.length > 0 &&
                c.readable_reading_unit_ids.every((id) => selected.has(id)),
              mixed =
                !chosen &&
                c.readable_reading_unit_ids.some((id) => selected.has(id));
            return (
              <article
                className="collection-card"
                key={`${c.collection_id}:${i}`}
                aria-hidden={!middle || undefined}
              >
                <div className="art-frame">
                  <button
                    className="art-open"
                    tabIndex={middle ? 0 : -1}
                    onClick={() => onOpen(c)}
                    aria-label={`Open ${c.title}`}
                  >
                    {a ? (
                      <img src={a.image} alt={a.imageCredit} loading="lazy" />
                    ) : (
                      <div
                        className="type-cover"
                        style={
                          {
                            "--cover-tone": [
                              "#eff5ff",
                              "#edf5f0",
                              "#fff5e7",
                              "#f1eff8",
                            ][i % 4],
                          } as React.CSSProperties
                        }
                      >
                        <small>{languageNames[c.language]}</small>
                        <BookOpen size={30} />
                        <strong>{c.title}</strong>
                        <span>
                          {c.readable_reading_unit_ids.length} readable units
                        </span>
                      </div>
                    )}
                  </button>
                  <div className="quick-actions">
                    <button
                      tabIndex={middle ? 0 : -1}
                      onClick={() => onPlay(c)}
                      aria-label={`Read first work of ${c.title} aloud`}
                    >
                      <Play size={18} />
                    </button>
                    <button
                      tabIndex={middle ? 0 : -1}
                      className={chosen ? "added" : ""}
                      aria-pressed={mixed ? "mixed" : chosen}
                      aria-label={`${chosen ? "Remove" : "Add"} ${c.title} ${chosen ? "from" : "to"} export selection`}
                      onClick={() => onSelect(c)}
                    >
                      {chosen ? <Check size={19} /> : <Plus size={19} />}
                    </button>
                  </div>
                </div>
                <div className="caption">
                  <button
                    className="caption-title"
                    tabIndex={middle ? 0 : -1}
                    onClick={() => onOpen(c)}
                  >
                    {c.title}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="icon-button"
                        tabIndex={middle ? 0 : -1}
                        aria-label={`Actions for ${c.title}`}
                      >
                        <MoreVertical size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onOpen(c)}>
                        <BookOpen />
                        Open collection
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSelect(c)}>
                        <Plus />
                        {chosen ? "Remove selection" : "Select readable units"}
                      </DropdownMenuItem>
                      {a && (
                        <DropdownMenuItem asChild>
                          <a
                            href={a.imageSource}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink />
                            Artwork source & credit
                          </a>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="caption-meta">
                  {c.readable_reading_unit_ids.length} readable ·{" "}
                  {c.reading_unit_ids.length} recorded units
                </p>
              </article>
            );
          })}
        {windowed.width > 0 &&
          windowed.start + windowed.count < copies.length && (
            <div
              aria-hidden="true"
              style={{
                flex: `0 0 ${(copies.length - windowed.start - windowed.count) * (windowed.width + windowed.gap) - windowed.gap}px`,
              }}
            />
          )}
      </div>
    </section>
  );
}
interface SearchResult {
  snapshot_id: string;
  items: ReadingSummary[];
  total: number;
  next_offset: number | null;
}
export function LibraryApp() {
  const [manifest, setManifest] = useState<Manifest | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [registry, setRegistry] = useState<Registry | null>(null),
    [route, setRoute] = useState("/"),
    [urlKey, setUrlKey] = useState(""),
    [query, setQuery] = useState(""),
    [language, setLanguage] = useState("all"),
    [availability, setAvailability] = useState("readable"),
    [completeness, setCompleteness] = useState("all"),
    [contributor, setContributor] = useState(""),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [unsaved, setUnsaved] = useState(false),
    [rail, setRail] = useState(true),
    [filterOpen, setFilterOpen] = useState(false),
    [search, setSearch] = useState<SearchResult | null>(null),
    [offset, setOffset] = useState(0),
    [sort, setSort] = useState("title"),
    [selectionLoadedKey, setSelectionLoadedKey] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [staging, setStaging] = useState<{
      imported: number;
      total: number;
    } | null>(null),
    [format, setFormat] = useState("text"),
    [methodSearch, setMethodSearch] = useState(""),
    [methodsOpen, setMethodsOpen] = useState(false),
    [compare, setCompare] = useState<string | null>(null),
    [compareOther, setCompareOther] = useState(""),
    [compareSnapshot, setCompareSnapshot] = useState(""),
    [exporting, setExporting] = useState(false),
    [pendingExport, setPendingExport] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    [metadata, setMetadata] = useState<ReadingSummary | null>(null),
    [comparePassage, setComparePassage] = useState<string[]>([]);
  const collectionId = route.startsWith("/collections/")
      ? decodeURIComponent(route.slice(13))
      : null,
    readingId = route.startsWith("/read/")
      ? decodeURIComponent(route.slice(6))
      : null;
  const selectionSnapshot =
      readingId && typeof window !== "undefined"
        ? (new URLSearchParams(location.search).get("snapshot") ??
          manifest?.snapshot_id)
        : manifest?.snapshot_id,
    selectionKey = selectionSnapshot
      ? `export-selection:${selectionSnapshot}`
      : "";
  const searchRef = useRef<HTMLInputElement>(null),
    previousLocation = useRef("/works"),
    previousScroll = useRef(0);
  const go = useCallback((path: string) => {
    history.pushState(null, "", path);
    setRoute(path.split("?")[0]);
    setUrlKey(path);
    setOffset(
      Number(new URL(path, location.origin).searchParams.get("offset") ?? 0),
    );
    setCompare(null);
    void readDevice<string | null>("pending-export", null)
      .then(setPendingExport)
      .catch(() => setUnsaved(true));
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const pop = () => {
      setRoute(location.pathname);
      setUrlKey(location.href);
      const p = new URLSearchParams(location.search);
      setQuery(p.get("q") ?? "");
      setLanguage(p.get("language") ?? "all");
      setAvailability(p.get("availability") ?? "readable");
      setCompleteness(p.get("completeness") ?? "all");
      setContributor(p.get("contributor") ?? "");
      setSort(p.get("sort") ?? "title");
      setOffset(Number(p.get("offset") ?? 0));
      const compared = p.get("compare");
      if (location.pathname.startsWith("/read/") && compared) {
        setCompare(decodeURIComponent(location.pathname.slice(6)));
        setCompareOther(compared);
        setCompareSnapshot(p.get("snapshot") ?? "");
        setComparePassage([]);
      } else setCompare(null);
    };
    queueMicrotask(() => {
      pop();
      setRail(window.innerWidth >= 1100);
    });
    window.addEventListener("popstate", pop);
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const m = await api<
          Manifest & { state: string; imported?: number; total?: number }
        >("manifest");
        if (!live) return;
        if (m.state === "staging") {
          setStaging({ imported: m.imported ?? 0, total: m.total ?? 0 });
          timer = setTimeout(() => void load(), 500);
          return;
        }
        setManifest(m);
        const [c, r] = await Promise.all([
          completeCatalog(m.snapshot_id),
          api<Registry>(`methods?snapshot=${m.snapshot_id}`),
        ]);
        if (!live) return;
        setCatalog(c);
        setRegistry(r);
        setLoading(false);
      } catch (e) {
        if (live) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [retry]);
  useEffect(() => {
    void readDevice<string | null>("pending-export", null)
      .then(setPendingExport)
      .catch(() => setUnsaved(true));
  }, []);
  useEffect(() => {
    if (!manifest) return;
    let live = true;
    void readDevice<string[]>(selectionKey, [])
      .then((ids) => {
        if (live) {
          setSelected(new Set(ids));
          setSelectionLoadedKey(selectionKey);
        }
      })
      .catch(() => setUnsaved(true));
    return () => {
      live = false;
    };
  }, [manifest, selectionKey]);

  const activeCollection = catalog?.collections.find(
    (c) => c.collection_id === collectionId,
  );
  useEffect(() => {
    if (!manifest || readingId) return;
    let live = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        snapshot: manifest.snapshot_id,
        q: query,
        language,
        availability,
        completeness,
        contributor,
        sort,
        offset: String(offset),
        limit: "50",
      });
      if (collectionId) params.set("collection", collectionId);
      void api<SearchResult>("search?" + params)
        .then((r) => live && setSearch(r))
        .catch((e) => live && setError((e as Error).message));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [
    manifest,
    query,
    language,
    availability,
    completeness,
    contributor,
    sort,
    offset,
    collectionId,
    readingId,
  ]);
  useEffect(() => {
    if (readingId || loading || location.pathname !== route) return;
    const u = new URL(location.href);
    for (const [key, value] of Object.entries({
      q: query,
      language,
      availability,
      completeness,
      contributor,
      sort,
      offset: String(offset),
    })) {
      if (value && value !== "all" && value !== "0")
        u.searchParams.set(key, value);
      else u.searchParams.delete(key);
    }
    history.replaceState(null, "", u);
  }, [
    query,
    language,
    availability,
    completeness,
    contributor,
    sort,
    offset,
    readingId,
    loading,
    route,
  ]);
  function saveSelection(set: Set<string>) {
    setSelected(set);
    void writeDevice(selectionKey, Array.from(set))
      .then(() => setUnsaved(false))
      .catch(() => setUnsaved(true));
  }
  function toggle(id: string) {
    if (selectionLoadedKey !== selectionKey) return;
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    saveSelection(set);
  }
  function toggleCollection(c: Collection) {
    if (selectionLoadedKey !== selectionKey) return;
    const set = new Set(selected),
      all =
        c.readable_reading_unit_ids.length > 0 &&
        c.readable_reading_unit_ids.every((id) => set.has(id));
    for (const id of c.readable_reading_unit_ids)
      if (all) set.delete(id);
      else set.add(id);
    saveSelection(set);
  }
  async function exportSelection(all = false, resume?: string) {
    if (!manifest) return;
    setExporting(true);
    setError("");
    try {
      let result = resume
        ? await api<{
            export_id: string;
            state: string;
            download_url?: string;
            progress?: { completed: number; total: number; kind?: string };
          }>(`exports/${resume}`)
        : await api<{
            export_id: string;
            state: string;
            download_url?: string;
            progress?: { completed: number; total: number; kind?: string };
          }>("exports", {
            method: "POST",
            body: JSON.stringify({
              snapshot_id: all ? manifest.snapshot_id : selectionSnapshot,
              reading_unit_ids: all ? "all" : Array.from(selected),
              format,
            }),
          });
      setPendingExport(result.export_id);
      await writeDevice("pending-export", result.export_id).catch(() =>
        setUnsaved(true),
      );
      while (result.state !== "ready") {
        result = await api(`exports/${result.export_id}/step`, {
          method: "POST",
          body: "{}",
        });
        if ((result as { busy?: boolean }).busy)
          await new Promise((resolve) => setTimeout(resolve, 1000));
        if (result.progress)
          toast.loading(
            `Preparing export · ${result.progress.completed} / ${result.progress.total} ${result.progress.kind === "package_parts" ? "package parts" : "readings"}`,
            { id: "library-export" },
          );
      }
      if (!result.download_url)
        throw Error("The completed package has no download address.");
      const a = document.createElement("a");
      a.href = result.download_url;
      a.download = "codex-musica-library.zip";
      a.click();
      setPendingExport(null);
      await writeDevice("pending-export", null).catch(() => setUnsaved(true));
      toast.success("Export package ready, including source credits.", {
        id: "library-export",
      });
    } catch (e) {
      setError((e as Error).message);
      toast.error(
        "Export paused. The committed package steps remain available.",
        { id: "library-export" },
      );
    } finally {
      setExporting(false);
    }
  }
  function openCollection(c: Collection) {
    go("/collections/" + c.collection_id);
  }
  function openReading(
    id: string,
    hit?: Record<string, unknown>,
    autoplay = false,
  ) {
    if (manifest) {
      previousLocation.current = location.pathname + location.search;
      previousScroll.current = window.scrollY;
      const params = new URLSearchParams({ snapshot: manifest.snapshot_id });
      if (hit?.line_id) {
        params.set("line", String(hit.line_id));
        params.set("offset", String(hit.row_offset ?? 0));
        const range = hit.normalized_cp_range as number[] | undefined;
        if (range) {
          params.set("span", range.join(":"));
          params.set("precision", String(hit.precision ?? "span"));
        }
      }
      if (autoplay) params.set("autoplay", "1");
      go(`/read/${id}?${params}`);
    }
  }
  const visibleCollections = useMemo(
    () =>
      catalog?.collections.filter(
        (c) =>
          (language === "all" || c.language === language) &&
          c.readable_reading_unit_ids.length > 0 &&
          (query
            ? `${c.title} ${c.source_path}`
                .toLowerCase()
                .includes(query.toLowerCase())
            : true),
      ) ?? [],
    [catalog, language, query],
  );
  const shelves = useMemo(
    () => Array.from(new Set(visibleCollections.map((c) => c.language))),
    [visibleCollections],
  );
  const isWorks = route === "/works" || !!collectionId || !!query;
  return (
    <div className="app full-library">
      <a className="skip-link" href="#library-content">
        Skip to Library
      </a>
      <header className="global-header">
        <a className="brand" href="https://codexmusica.com">
          <img src="/favicon.svg" alt="" />
          <span>Codex Musica</span>
        </a>
        <nav className="global-nav" aria-label="Codex Musica">
          {[
            { label: "Genre", icon: Music2, hash: "genre", color: "#e53935" },
            {
              label: "Instrument",
              icon: Guitar,
              hash: "instrument",
              color: "#ed6c02",
            },
            { label: "Atlas", icon: Map, hash: "map", color: "#1a73e8" },
            {
              label: "Lyrics",
              icon: FileText,
              hash: "lyrics",
              color: "#8e46d9",
            },
          ].map((n) => (
            <a
              href={`https://codexmusica.com/codex.html#${n.hash}`}
              key={n.hash}
              aria-label={n.label}
            >
              <n.icon size={21} style={{ color: n.color }} />
              <span>{n.label}</span>
            </a>
          ))}
          <button className="current" onClick={() => go("/")}>
            <Library className="green" size={21} />
            Library
          </button>
        </nav>
        <button
          className="icon-button"
          aria-label={
            rail ? "Collapse collections rail" : "Open collections rail"
          }
          onClick={() => setRail(!rail)}
        >
          {rail ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
        </button>
      </header>
      <div className="library-toolbar">
        <h1 className="library-title">
          Library<span>.</span>
        </h1>
        <nav className="library-sections" aria-label="Library">
          <button
            className={route === "/" && !query ? "active" : ""}
            onClick={() => {
              setQuery("");
              go("/");
            }}
          >
            <Search size={17} />
            Explore
          </button>
          <button
            className={isWorks && !readingId ? "active" : ""}
            onClick={() => go("/works")}
          >
            <FileText size={17} />
            Works
          </button>
          <button
            className={route === "/rights" ? "active" : ""}
            onClick={() => go("/rights")}
          >
            <Scale size={17} />
            Sources & rights
            {selected.size > 0 && (
              <span className="tab-count">{selected.size}</span>
            )}
          </button>
        </nav>
        <label className="search-field">
          <Search size={19} />
          <input
            ref={searchRef}
            placeholder="Search titles, authors, or exact phrases"
            aria-label="Search Library"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
              if (readingId) go("/works");
            }}
          />
          {query ? (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={16} />
            </button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </label>
        <button
          className="button"
          onClick={() => setFilterOpen(true)}
          aria-label="Filter Library"
        >
          <SlidersHorizontal size={18} />
          <span className="filter-label">Filter</span>
        </button>
      </div>
      <div className={`library-workspace ${rail ? "" : "rail-closed"}`}>
        {rail && (
          <aside className="library-rail" aria-label="Collections">
            <div className="rail-header">
              <BookOpen size={17} />
              <strong>Collections</strong>
              <button
                className="icon-button"
                aria-label="Collapse collections"
                onClick={() => setRail(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="rail-scroll">
              <div className="book-stack">
                {(catalog?.collections ?? [])
                  .filter(
                    (c) =>
                      c.readable_reading_unit_ids.length > 0 &&
                      (language === "all" || language === c.language),
                  )
                  .map((c, i) => (
                    <button
                      key={c.collection_id}
                      className={`book-spine spine-${i % 4} ${collectionId === c.collection_id ? "spine-active" : ""}`}
                      onClick={() => openCollection(c)}
                    >
                      <span className="spine-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{c.title}</strong>
                        <small>
                          {languageNames[c.language]} ·{" "}
                          {c.readable_reading_unit_ids.length} readings
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
            <footer className="rail-footer">
              <button
                className="selection-shortcut"
                onClick={() => go("/rights")}
              >
                <Download size={17} />
                <span>Export selection</span>
                <b>{selected.size}</b>
              </button>
              <small>On this device{unsaved ? " · unsaved" : ""}</small>
            </footer>
          </aside>
        )}
        <main id="library-content" className="library-main">
          <div className="workspace-topline">
            <span className="context-label">
              {readingId ? (
                <>
                  <BookOpen size={16} />
                  Reader
                </>
              ) : (
                <>
                  <Library size={16} />
                  {manifest
                    ? `${manifest.counts.readable_collections} readable collections · ${manifest.counts.readable_reading_units} reading units`
                    : "Opening the complete catalog"}
                </>
              )}
            </span>
            {manifest && (
              <span className="snapshot-label">
                Snapshot {manifest.snapshot_id.slice(0, 8)}
              </span>
            )}
          </div>
          {error && (
            <p className="reader-alert error" role="alert">
              {error}
            </p>
          )}
          {error && !catalog && (
            <button
              className="button"
              onClick={() => {
                setError("");
                setLoading(true);
                setRetry(retry + 1);
              }}
            >
              Retry opening the catalog
            </button>
          )}
          {loading ? (
            <div className="empty-state">
              <BookOpen />
              <h2>
                {staging
                  ? "Preparing the complete Library"
                  : "Opening the Library"}
              </h2>
              <p>
                {staging
                  ? `${staging.imported} / ${staging.total} verified source packs staged. The snapshot activates after the full census reconciles.`
                  : "Loading source identities, native methods and rights."}
              </p>
            </div>
          ) : manifest && catalog && registry ? (
            <>
              {readingId ? (
                <Reader
                  key={readingId + urlKey}
                  id={readingId}
                  snapshot={
                    new URLSearchParams(
                      typeof window === "undefined" ? "" : location.search,
                    ).get("snapshot") ?? manifest.snapshot_id
                  }
                  registry={registry}
                  selected={selected}
                  onToggle={toggle}
                  onBack={() => {
                    go(previousLocation.current);
                    requestAnimationFrame(() =>
                      window.scrollTo({ top: previousScroll.current }),
                    );
                  }}
                  onCompare={(id, passage = []) => {
                    setCompare(id);
                    setCompareSnapshot(
                      selectionSnapshot ?? manifest.snapshot_id,
                    );
                    setCompareOther("");
                    setComparePassage(passage);
                  }}
                />
              ) : route === "/rights" ? (
                <div className="rights-content">
                  <div className="view-heading">
                    <div>
                      <h2>Sources & rights</h2>
                      <p>
                        Text, editions, transcriptions and artwork retain their
                        own records.
                      </p>
                    </div>
                  </div>
                  <div className="rights-layout">
                    <div>
                      <section className="source-detail">
                        <h3>Catalog census</h3>
                        <dl>
                          {[
                            "source_files",
                            "collections",
                            "works",
                            "editions",
                            "reading_units",
                            "readable_collections",
                            "readable_works",
                            "readable_editions",
                            "readable_reading_units",
                          ].map((k) => (
                            <div key={k}>
                              <dt>{k.replaceAll("_", " ")}</dt>
                              <dd>{String(manifest.counts[k])}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="note">
                          Held and research records remain searchable as
                          metadata. Their source bodies are excluded from
                          readable exports.
                        </p>
                        <button
                          className="button"
                          onClick={() => {
                            setAvailability("all");
                            go("/works");
                          }}
                        >
                          Inspect all recorded availability
                        </button>
                      </section>
                      <section className="source-detail">
                        <h3>Artwork credits</h3>
                        {artwork.map((a) => (
                          <div className="art-credit" key={a.id}>
                            <img src={a.image} alt="" />
                            <p>
                              {a.imageCredit}
                              <small>{a.imageNote}</small>
                              <a
                                href={a.imageSource}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source <ExternalLink size={12} />
                              </a>
                            </p>
                          </div>
                        ))}
                      </section>
                      <section className="source-detail">
                        <button
                          className="text-link"
                          onClick={() => setMethodsOpen(!methodsOpen)}
                        >
                          Method reference · {registry.counts.schemas} schemas ·{" "}
                          {registry.counts.functions} section / line functions ·{" "}
                          {registry.profiles.length} native profiles
                        </button>
                        {methodsOpen && (
                          <>
                            <input
                              placeholder="Search methods, functions or capabilities"
                              aria-label="Search methods"
                              value={methodSearch}
                              onChange={(e) => setMethodSearch(e.target.value)}
                            />
                            {registry.methods
                              .filter((m) =>
                                `${m.name} ${m.definition ?? ""} ${m.required_capabilities ?? ""}`
                                  .toLowerCase()
                                  .includes(methodSearch.toLowerCase()),
                              )
                              .map((m) => (
                                <MethodDetail key={m.id} method={m} />
                              ))}
                          </>
                        )}
                      </section>
                    </div>
                    <section className="export-panel">
                      <h3>
                        <Download size={21} />
                        Export selection
                      </h3>
                      <p>
                        {selected.size} pinned reading units · On this device
                        {unsaved ? " · unsaved" : ""}
                      </p>
                      <label>
                        Format
                        <select
                          value={format}
                          onChange={(e) => setFormat(e.target.value)}
                        >
                          <option value="text">Text</option>
                          <option value="json">JSON with coordinates</option>
                          <option value="csv">
                            CSV physical / analysis rows
                          </option>
                        </select>
                      </label>
                      <p className="required-credit">
                        <Scale size={16} />
                        Every ZIP includes PROVENANCE.json, ATTRIBUTION.txt and
                        applicable notices.
                      </p>
                      <p className="note">
                        Source artwork and device speech are excluded. Snapshot
                        updates do not add items to this selection.
                      </p>
                      <button
                        className="button primary full-width"
                        disabled={
                          !selected.size ||
                          exporting ||
                          selectionLoadedKey !== selectionKey
                        }
                        onClick={() => void exportSelection()}
                      >
                        <Download size={16} />
                        {exporting
                          ? "Preparing package…"
                          : "Export selected readings"}
                      </button>
                      <button
                        className="button full-width"
                        disabled={exporting}
                        onClick={() => void exportSelection(true)}
                      >
                        Export readable corpus
                      </button>
                      {pendingExport && (
                        <button
                          className="button full-width"
                          disabled={exporting}
                          onClick={() =>
                            void exportSelection(false, pendingExport)
                          }
                        >
                          Resume prepared export
                        </button>
                      )}
                      {pendingExport && (
                        <button
                          className="text-link"
                          onClick={() => {
                            setPendingExport(null);
                            void writeDevice("pending-export", null);
                          }}
                        >
                          Forget export reference
                        </button>
                      )}
                      <button
                        className="text-link"
                        onClick={() => saveSelection(new Set())}
                      >
                        Clear selection
                      </button>
                      {unsaved && (
                        <button
                          className="button"
                          onClick={() =>
                            download(
                              "library-selection.json",
                              JSON.stringify({
                                snapshot_id: manifest.snapshot_id,
                                reading_unit_ids: Array.from(selected),
                              }),
                            )
                          }
                        >
                          Download unsaved selection
                        </button>
                      )}
                    </section>
                  </div>
                </div>
              ) : isWorks ? (
                <div className="works-content">
                  <div className="view-heading">
                    <div>
                      <h2>{activeCollection?.title ?? "Works"}</h2>
                      <p>
                        {search?.total ?? 0} reading units · work and edition
                        identities remain distinct
                      </p>
                    </div>
                    {activeCollection && (
                      <button
                        className="button"
                        onClick={() => toggleCollection(activeCollection)}
                      >
                        <Plus size={16} />
                        Select collection
                      </button>
                    )}
                  </div>
                  <div className="table-scroll">
                    <table className="works-table">
                      <thead>
                        <tr>
                          <th>Work / reading</th>
                          <th>Contributor</th>
                          <th>Language</th>
                          <th>Scope / availability</th>
                          <th>
                            <span className="sr-only">Export selection</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {search?.items.map((r) => (
                          <tr key={r.reading_unit_id}>
                            <td>
                              <button
                                className="work-title"
                                onClick={() =>
                                  r.availability === "readable"
                                    ? openReading(
                                        r.reading_unit_id,
                                        r.search_hit as Record<string, unknown>,
                                      )
                                    : setMetadata(r)
                                }
                              >
                                <BookOpen size={18} />
                                <span>
                                  {r.title}
                                  <small>{r.snippet || r.source_path}</small>
                                </span>
                              </button>
                              <small className="edition-id">
                                Edition {r.edition_id.slice(-8)} · work{" "}
                                {r.work_id.slice(-8)}
                              </small>
                            </td>
                            <td>
                              {r.contributor_search ||
                                "Source contributor unknown"}
                            </td>
                            <td>{languageNames[r.language] ?? r.language}</td>
                            <td>
                              <span className="state-badge">
                                {r.availability}
                              </span>
                              <small>
                                {r.completeness.replaceAll("_", " ")}
                              </small>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                disabled={r.availability !== "readable"}
                                aria-label={`${selected.has(r.reading_unit_id) ? "Remove" : "Add"} ${r.title} ${selected.has(r.reading_unit_id) ? "from" : "to"} export selection`}
                                onClick={() => toggle(r.reading_unit_id)}
                              >
                                {selected.has(r.reading_unit_id) ? (
                                  <Check className="blue" size={19} />
                                ) : (
                                  <Plus size={19} />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {search?.total === 0 && (
                    <div className="empty-state">
                      <Search />
                      <h2>No matching readings</h2>
                      <p>
                        Search is literal and accent-preserving. Try a recorded
                        title, contributor or exact phrase.
                      </p>
                    </div>
                  )}
                  <div className="pagination">
                    <button
                      className="button"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      Previous
                    </button>
                    <span>
                      {offset + 1}–
                      {Math.min(
                        offset + (search?.items.length ?? 0),
                        search?.total ?? 0,
                      )}{" "}
                      of {search?.total ?? 0}
                    </span>
                    <button
                      className="button"
                      disabled={search?.next_offset === null}
                      onClick={() => setOffset(search?.next_offset ?? offset)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className="explore-content">
                  {shelves.map((lang) => (
                    <Shelf
                      key={lang}
                      language={lang}
                      items={visibleCollections.filter(
                        (c) => c.language === lang,
                      )}
                      selected={selected}
                      onSelect={toggleCollection}
                      onOpen={openCollection}
                      onPlay={(c) => {
                        const first = c.readable_reading_unit_ids[0];
                        if (first) {
                          openReading(first, undefined, true);
                        }
                      }}
                    />
                  ))}
                  <footer className="catalogue-footer">
                    <Library size={15} />
                    <span>
                      {manifest.counts.readable_reading_units as number}{" "}
                      readable units from a fully reconciled source snapshot
                    </span>
                    <a
                      href={`https://github.com/WeningerII/CodexMusica/tree/${manifest.repository_commit}/lyric-harness/corpus`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Corpus source <ExternalLink size={13} />
                    </a>
                  </footer>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent className="filter-sheet">
          <SheetTitle>Filter Library</SheetTitle>
          <SheetDescription>
            Filter recorded metadata and readable source text.
          </SheetDescription>
          <div className="filter-body">
            <label>
              Language
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">All recorded languages</option>
                {Object.entries(languageNames)
                  .filter(([id]) =>
                    catalog?.collections.some((c) => c.language === id),
                  )
                  .map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Availability
              <select
                value={availability}
                onChange={(e) => {
                  setAvailability(e.target.value);
                  setOffset(0);
                }}
              >
                {[
                  "readable",
                  "all",
                  "held",
                  "metadata_only",
                  "research_only",
                  "rejected",
                ].map((a) => (
                  <option key={a} value={a}>
                    {a.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Completeness
              <select
                value={completeness}
                onChange={(e) => {
                  setCompleteness(e.target.value);
                  setOffset(0);
                }}
              >
                {[
                  "all",
                  "complete_poem",
                  "source_item",
                  "documented_excerpt",
                  "continuous_segment",
                ].map((a) => (
                  <option key={a} value={a}>
                    {a.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contributor
              <input
                value={contributor}
                onChange={(e) => {
                  setContributor(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label>
              Sort
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="title">Title</option>
                <option value="contributor">Contributor, then title</option>
              </select>
            </label>
            <button
              className="button primary full-width"
              onClick={() => {
                setFilterOpen(false);
                if (route === "/") go("/works");
              }}
            >
              Apply filters
            </button>
            <button
              className="text-link"
              onClick={() => {
                setLanguage("all");
                setAvailability("readable");
                setCompleteness("all");
                setContributor("");
                setSort("title");
                setQuery("");
                setOffset(0);
              }}
            >
              Clear filters
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!compare}
        onOpenChange={(open) => {
          if (!open) {
            setCompare(null);
            const u = new URL(location.href);
            u.searchParams.delete("compare");
            history.replaceState(null, "", u);
          }
        }}
      >
        <SheetContent side="bottom" className="comparison-sheet">
          <SheetTitle>Text comparison</SheetTitle>
          <SheetDescription>
            Compare complete units or a selected passage. Edition equivalence
            requires a reviewed work identity.
          </SheetDescription>
          {compare && (
            <>
              {manifest && (
                <ComparisonPicker
                  id={compare}
                  snapshot={
                    compareSnapshot || selectionSnapshot || manifest.snapshot_id
                  }
                  onChoose={(id) => {
                    setCompareOther(id);
                    const u = new URL(location.href);
                    u.searchParams.set("compare", id);
                    history.replaceState(null, "", u);
                  }}
                />
              )}
              {compareOther && manifest && (
                <Comparison
                  key={compare + compareOther}
                  earlier={compare}
                  other={compareOther}
                  snapshot={
                    compareSnapshot || selectionSnapshot || manifest.snapshot_id
                  }
                  passage={comparePassage}
                />
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!metadata}
        onOpenChange={(open) => !open && setMetadata(null)}
      >
        <SheetContent className="source-metadata-sheet">
          <SheetTitle>{metadata?.title ?? "Source record"}</SheetTitle>
          <SheetDescription>
            Recorded availability and source evidence
          </SheetDescription>
          {metadata && (
            <div className="filter-body">
              <span className="state-badge">{metadata.availability}</span>
              <Value
                value={{
                  source_path: metadata.source_path,
                  availability_reason: metadata.availability_reason,
                  source_basis: metadata.source_basis,
                  work_reviewed_equivalence: metadata.work_reviewed_equivalence,
                }}
              />
              <p>
                Admission requires resolving the recorded evidence before a
                source body can be read or exported.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
