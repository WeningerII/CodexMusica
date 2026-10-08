const encoder = new TextEncoder();
export function hex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(bytes as ArrayBuffer), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export function randomHex(n = 32) {
  return hex(crypto.getRandomValues(new Uint8Array(n)));
}
export async function sha256(value: string | Uint8Array) {
  return hex(
    await crypto.subtle.digest(
      "SHA-256",
      typeof value === "string" ? encoder.encode(value) : new Uint8Array(value),
    ),
  );
}
export async function hmac(key: string, value: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", k, encoder.encode(value)));
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",") +
    "}"
  );
}
export function canonicalQuery(search: string) {
  const seen = new Set<string>();
  const values: Array<[string, string]> = [];
  for (const [k, v] of new URLSearchParams(search)) {
    if (seen.has(k)) throw Error("Repeated query parameter");
    seen.add(k);
    values.push([k, v]);
  }
  values.sort(([a, av], [b, bv]) =>
    a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
  );
  return new URLSearchParams(values).toString();
}
export async function readerHeaders(
  secret: string,
  fields: {
    site: string;
    viewer: string;
    job?: string;
    attempt?: number;
    generation?: number;
    idempotency?: string;
    capability?: string;
  },
  method: string,
  path: string,
  body = "",
) {
  const time = String(Math.floor(Date.now() / 1000)),
    nonce = randomHex(24),
    u = new URL(path, "https://reader.invalid");
  const input = [
    "reader-v1",
    method.toUpperCase(),
    u.pathname,
    canonicalQuery(u.search),
    await sha256(body),
    fields.site,
    fields.viewer,
    fields.job ?? "",
    String(fields.attempt ?? ""),
    String(fields.generation ?? ""),
    fields.idempotency ?? "",
    await sha256(fields.capability ?? ""),
    time,
    nonce,
  ].join("\n");
  return {
    "content-type": "application/json",
    "x-reader-site": fields.site,
    "x-reader-viewer": fields.viewer,
    "x-reader-job": fields.job ?? "",
    "x-reader-attempt": String(fields.attempt ?? ""),
    "x-reader-generation": String(fields.generation ?? ""),
    "x-reader-idempotency": fields.idempotency ?? "",
    "x-reader-capability": fields.capability ?? "",
    "x-reader-time": time,
    "x-reader-nonce": nonce,
    "x-reader-signature": await hmac(secret, input),
  };
}
