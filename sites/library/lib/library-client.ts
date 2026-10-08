import { canonical, randomHex, sha256 } from "./reader-crypto";
import type { Reading } from "./library-types";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api/library/" + path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = (await r.json()) as T & {
    error?: { message?: string; code?: string; remedy?: string };
  };
  if (!r.ok)
    throw Object.assign(
      new Error(data.error?.message ?? "The Library could not answer."),
      { code: data.error?.code, remedy: data.error?.remedy },
    );
  return data;
}
export function download(
  name: string,
  value: string | Blob,
  mime = "application/json",
) {
  const url = URL.createObjectURL(
    value instanceof Blob ? value : new Blob([value], { type: mime }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function openLyrics(
  reading: Reading,
  excerpt?: { text: string; line_ids: string[] },
  declarations: unknown = {},
  receiverWindow?: Window | null,
) {
  const nonce = randomHex(),
    handoffId = crypto.randomUUID(),
    draftId = crypto.randomUUID();
  const envelope = {
    protocol: "codex-musica.library-import",
    version: 1,
    handoffId,
    draftId,
    createdAt: new Date().toISOString(),
    payload: {
      text: excerpt?.text ?? reading.normalized_text,
      title: reading.title,
      language: reading.language,
      scope: excerpt ? "excerpt" : "whole",
      provenance: {
        snapshotId: reading.snapshot_id,
        unitId: reading.reading_unit_id,
        workId: reading.work_id,
        editionId: reading.edition_id,
        revisionId: reading.reading_revision,
        source_sha256: reading.source_sha256,
        normalized_sha256: reading.normalized_sha256,
        source_path: reading.source_path,
        rights: reading.rights,
        contributors: reading.contributors,
        completeness: reading.completeness,
        metadata: reading.metadata,
        source_map: reading.source_map,
        source_marks: reading.source_marks,
        source_labels: reading.source_labels,
        source_basis: reading.source_basis,
        work_reviewed_equivalence: reading.work_reviewed_equivalence,
      },
      lineage: reading.lines
        .filter(
          (l) =>
            l.analysis_line !== null &&
            (!excerpt || excerpt.line_ids.includes(l.id)),
        )
        .map((l) => ({
          line_id: l.id,
          physical_line: l.physical_line,
          analysis_line: l.analysis_line,
          normalized_cp_range: l.normalized_cp_range,
          normalized_utf16_range: l.normalized_utf16_range,
          source_ranges: l.source_ranges,
        })),
      declarations: excerpt ? [] : [declarations],
    },
  };
  let transferAttempted = false;
  const signed = { ...envelope, digest: await sha256(canonical(envelope)) };
  const encoded = JSON.stringify(signed),
    fallback = () => {
      if (receiverWindow && !receiverWindow.closed && !transferAttempted)
        receiverWindow.close();
      download("codex-musica-library-import.json", encoded);
      return {
        status: "bundle",
        message: "Import bundle downloaded. In Lyrics, choose Import.",
      };
    };
  if (
    receiverWindow === null ||
    new TextEncoder().encode(encoded).length > 8 * 1024 * 1024
  )
    return fallback();
  const target = new URL("https://codexmusica.com/codex.html");
  target.searchParams.set("cm_library_origin", location.origin);
  target.searchParams.set("cm_library_nonce", nonce);
  target.hash = "lyrics";
  const receiver = receiverWindow ?? window.open(target.href, "_blank");
  if (!receiver) return fallback();
  if (receiverWindow) receiver.location.href = target.href;
  return new Promise<{ status: string; message: string }>((resolve) => {
    let transferred = false;
    function finish(result: { status: string; message: string }) {
      clearTimeout(timer);
      clearInterval(retry);
      window.removeEventListener("message", onMessage);
      resolve(result);
    }
    function onMessage(e: MessageEvent) {
      if (
        e.origin !== target.origin ||
        e.source !== receiver ||
        e.data?.nonce !== nonce ||
        e.data?.version !== 1
      )
        return;
      if (e.data.type === "codex-musica.library.ready") {
        transferred = true;
        transferAttempted = true;
        receiver!.postMessage(
          {
            type: "codex-musica.library.transfer",
            version: 1,
            nonce,
            envelope: signed,
          },
          target.origin,
        );
      } else if (
        e.data.type === "codex-musica.library.ack" &&
        e.data.handoffId === handoffId &&
        e.data.digest === signed.digest &&
        e.data.draftId === draftId
      )
        finish({
          status: "acknowledged",
          message:
            "A separate copy is open in Lyrics. Its source details were preserved.",
        });
      else if (e.data.type === "codex-musica.library.error") finish(fallback());
    }
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => finish(fallback()), 60000);
    const retry = setInterval(() => {
      if (transferred && !receiver.closed)
        receiver.postMessage(
          {
            type: "codex-musica.library.transfer",
            version: 1,
            nonce,
            envelope: signed,
          },
          target.origin,
        );
    }, 2500);
  });
}
