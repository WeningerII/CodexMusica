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

  hit(key, windowMs, limit, now) {
    const slot = Math.floor(now / windowMs);
    const id = `${key}:${windowMs}:${slot}`;
    const count = (this.buckets.get(id) || 0) + 1;
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

// The client IP, taken from the proxy header Render sets.
//
// Trusting XFF is only safe BEHIND a proxy that overwrites it — which Render
// does — so the leftmost entry is the real client. Direct-to-node deploys must
// not use this: with nothing overwriting the header, the leftmost entry is
// whatever the caller typed, and every bucket below becomes free to choose.
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
