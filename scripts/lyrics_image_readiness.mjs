// Readiness polling for the production image gate (scripts/check_lyrics_image.mjs).
// Each function is self-contained on purpose: the gate embeds their source text
// in the probe that runs inside the service container, and
// scripts/test_lyrics_image_readiness.mjs calls these same functions against
// local fixtures, so the two cannot drift.

// The readiness window. #521 set 30 s; on a one-CPU runner the cold first
// /health after a restart measured 22-24 s, so 30 s left no headroom.
export const READY_MS = 60_000;
// One attempt (connect, headers and the whole body), clamped to the window.
export const ATTEMPT_MS = 5_000;

export async function getJson(url, budgetMs) {
  const controller = new AbortController();
  // A referenced timer, not AbortSignal.timeout, whose timer does not hold the
  // event loop. Main's scheduled CI run on 2026-10-10 saw the old probe exit 13
  // ("unsettled top-level await") with res.json() still pending: nothing kept
  // the process alive to finish or abort that read. While this timer is
  // pending the loop cannot empty, so every attempt settles within budgetMs.
  const timer = setTimeout(
    () => controller.abort(new Error(`no complete response within ${budgetMs} ms`)),
    budgetMs
  );
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: res.ok ? JSON.parse(text) : null };
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForHealth(url, windowMs, attemptMs) {
  const until = Date.now() + windowMs;
  for (;;) {
    const left = until - Date.now();
    if (left <= 0) return null;
    try {
      const res = await getJson(url, Math.min(attemptMs, left));
      if (res.ok) return res.body;
    } catch {
      /* bounded startup polling */
    }
    const pause = Math.min(250, until - Date.now());
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
  }
}
