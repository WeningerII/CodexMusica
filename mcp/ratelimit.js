// ratelimit.js — fixed-window counters and caller identity, shared by every
// public surface on this deployment.
//
// This started life inside chat.js, guarding the one endpoint that spends money.
// It lives here now because /mcp needs the same thing for a different reason:
// not cost, but CPU. The MCP endpoint is open and unauthenticated, it runs on a
// single-process instance, and several of its operations are synchronous and
// expensive enough to hold the event loop for hundreds of milliseconds — long
// enough that a plain `while true; do curl; done` starves /health, /chat and
// every other MCP caller at once. server_http.js used to answer that with a
// comment telling the operator to "protect it with edge rate-limiting", which
// render.yaml never configured. A limiter that only exists in prose is off.
//
// Deliberately not Redis: this is one Render instance, and a limiter that needs
// a second service to boot is a limiter that is off the first time the second
// service is down.
//
// KNOWN LIMITATION, stated rather than hidden: process-local. A redeploy or a
// crash resets the buckets, and a second instance (autoscale) would keep its
// own. For /chat, Google's per-key quota is the backstop underneath this. For
// /mcp there is no backstop but the CPU itself, which is precisely why the
// per-request input bounds in schemas.js matter more than this file does — this
// limits how OFTEN a caller can ask, the schemas limit how EXPENSIVE one ask
// can be. Neither substitutes for the other.

/** Fixed windows over an in-process Map. */
export class Windows {
  constructor() {
    this.buckets = new Map();
  }

  // `weight`: how many units this request spends (a JSON-RPC batch spends one
  // per message).
  hit(key, windowMs, limit, now, weight = 1) {
    const slot = Math.floor(now / windowMs);
    const id = `${key}:${windowMs}:${slot}`;
    const count = (this.buckets.get(id) || 0) + weight;
    this.buckets.set(id, count);
    // Opportunistic sweep: without it this Map is an unbounded leak keyed by
    // client IP, which is the sort of thing that stays invisible until an
    // instance has been up for a month.
    //
    // The stale test is `slot !== current slot for that window`, derived from
    // the key. It used to split on ':' and read fields [1] and [2], which is
    // right for an IPv4 key ("1.2.3.4:60000:29551123") and wrong for every
    // IPv6 one ("2001:db8::1:60000:29551123"), where those fields are part of
    // the address. Every IPv6 bucket therefore looked stale on every sweep and
    // was deleted — silently resetting those callers' windows. Reading the last
    // two fields instead is correct for both, because the suffix this code
    // appends is fixed-width in fields regardless of what the key contains.
    if (this.buckets.size > 5000) {
      for (const k of this.buckets.keys()) {
        const parts = k.split(':');
        const s = Number(parts[parts.length - 1]);
        const w = Number(parts[parts.length - 2]);
        if (Math.floor(now / w) !== s) this.buckets.delete(k);
      }
    }
    return { ok: count <= limit, count, retryAfter: Math.ceil((slot + 1) * windowMs - now) };
  }
}

// How many proxies sit in front of this process. Render is one; a deploy behind
// an extra CDN would be two. Same meaning as Express's numeric `trust proxy`.
const proxyValue = process.env.TRUSTED_PROXY_HOPS;
export const TRUSTED_PROXY_HOPS = proxyValue === undefined ? 1 : Number(proxyValue);
if (!Number.isInteger(TRUSTED_PROXY_HOPS) || TRUSTED_PROXY_HOPS < 0)
  throw new Error(
    'TRUSTED_PROXY_HOPS must be a nonnegative integer; use zero for direct connections.'
  );

// The client IP, counted back from the RIGHT of X-Forwarded-For.
//
// This used to read the leftmost entry, and the leftmost entry is the one place
// in that header a caller can write. XFF is built by appending: each proxy adds
// the address it received the connection FROM, so the header reads
// `<whatever the client sent>, <client as seen by proxy 1>, <...>`. A request
// that arrives carrying `X-Forwarded-For: 1.2.3.4` leaves Render's proxy as
// `1.2.3.4, <real client>` — and the old code bucketed on `1.2.3.4`, a value
// the caller chose. Every per-IP limit here was therefore opt-out: change the
// header each request and you get a fresh bucket every time, which makes the
// limits decorative against exactly the traffic they exist to stop.
//
// Counting back one hop from the right lands on the entry the nearest trusted
// proxy wrote, which the client cannot forge — it is the address Render
// actually saw. Anything further left may be spoofed and is ignored.
//
// DIRECT-TO-NODE DEPLOYS MUST NOT SET TRUSTED_PROXY_HOPS ABOVE THE REAL COUNT.
// Trusting more hops than exist walks left past the proxy-written entries and
// back into caller-controlled text, which is the bug this replaced.
// Every caller keys a limit on this value, so it names the CLIENT, not one of
// its addresses (Jony, #519): an IPv4-mapped IPv6 address is its IPv4 address,
// and an IPv6 address is its /64 — the block one home or host is handed, which
// it can rotate through at will. Keying on the literal address gave each of a
// /64's 2^64 addresses its own bucket, so the per-IP limits did not bind IPv6.
export function bucketOf(ip) {
  if (typeof ip !== 'string' || !ip || ip === 'unknown') return ip || 'unknown';
  let a = ip.trim().toLowerCase();
  const zone = a.indexOf('%');
  if (zone >= 0) a = a.slice(0, zone);
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  if (mapped) return mapped[1];
  if (!a.includes(':')) return a;
  // A dotted IPv4 tail is the last two groups.
  const dotted = /:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (dotted) {
    const [w, x, y, z] = dotted.slice(1).map(Number);
    a =
      a.slice(0, dotted.index + 1) +
      ((w << 8) | x).toString(16) +
      ':' +
      ((y << 8) | z).toString(16);
  }
  // Expand '::' to full 8 groups, then keep the first four.
  const [head, tail = ''] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = a.includes('::') ? (tail ? tail.split(':') : []) : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  if (!a.includes('::') && groups.length !== 8) return a;
  // An IPv4-mapped address written in hex or in full (::ffff:cb00:7107,
  // 0:0:0:0:0:ffff:1.2.3.4) is still its IPv4 address (BB8's review): read the
  // last 32 bits rather than the shared all-zero /64.
  if (
    groups.length === 8 &&
    groups.slice(0, 5).every((g) => /^0{1,4}$/.test(g)) &&
    groups[5] === 'ffff' &&
    groups.slice(6).every((g) => /^[0-9a-f]{1,4}$/.test(g))
  ) {
    const [hi, lo] = groups.slice(6).map((g) => parseInt(g, 16));
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
  }
  const first = groups.slice(0, 4);
  // Not an IPv6 address after all: keyed as written, as before.
  if (first.length !== 4 || !first.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return a;
  return `${first.map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

export function clientIp(req) {
  return bucketOf(rawClientIp(req));
}

function rawClientIp(req) {
  if (TRUSTED_PROXY_HOPS === 0) return req.socket?.remoteAddress || req.ip || 'unknown';
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length) {
      // hops.length - TRUSTED_PROXY_HOPS, clamped: a header shorter than the
      // configured hop count means something upstream did not append what we
      // expected, so fall back to the leftmost real entry rather than undefined.
      const idx = Math.max(0, hops.length - TRUSTED_PROXY_HOPS);
      return hops[idx];
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// The native Library tab's limits (docs/library-native-design.md, owner
// decision 4, approved as recommended). The old Site had no limiter: its only
// bounds were 2 outstanding analyses per viewer and 16 waiting globally, and
// those stay the binding analysis limits. Per-IP values are abuse ceilings.
export const LIBRARY_LIMITS = Object.freeze({
  searchPerIpPerMinute: 600,
  outstandingPerIp: 12,
  createsPerViewerPerHour: 30,
  createsPerIpPerHour: 120,
  jobReadsPerIpPerMinute: 600,
  controlsPerViewerPerHour: 120,
  // Checked before the viewer bucket: a viewer is any cookie the caller sends,
  // so without it one address mints an hour-long bucket per request.
  controlsPerIpPerHour: 480,
  mintsPerIpPerHour: 30,
  exportPlansPerIpPerHour: 120,
  exportStreamsPerIp: 2,
  exportStreamsGlobal: 4,
  corpusStartsPerIpPerDay: 6,
  corpusStreamsGlobal: 2,
  // Every download stream (selection, analysis, corpus): cut after 60 s with
  // no progress, or when fewer than 4 KiB/s moved over a 120 s window.
  streamIdleMs: 60_000,
  streamMinBytesPerSecond: 4096,
  streamRateWindowMs: 120_000,
  longReadingLines: 5000,
});
