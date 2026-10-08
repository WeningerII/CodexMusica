import { bootstrap, failure, storage, type LibraryBindings } from "./library-catalog";
import { sha256 } from "./reader-crypto";

type Part = { path: string; bytes: number; sha256: string };

// Server-only publication step: stage verified download bytes independently of
// the Worker archive. The signature remains required if Site access changes.
export async function importPackagePart(request: Request, env: LibraryBindings) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/library\/exports\/package-parts\/(text|json|csv)\/(\d+)$/);
  if (!match) return null;
  if (!["GET", "POST"].includes(request.method))
    throw failure("METHOD_NOT_ALLOWED", "Use GET or POST for package staging.", 405);
  const secret = env.READER_BRIDGE_SECRET;
  const time = request.headers.get("x-library-upload-time") ?? "";
  const signature = request.headers.get("x-library-upload-signature") ?? "";
  if (!secret || secret.length < 32 || !/^\d{10}$/.test(time) ||
      Math.abs(Date.now() / 1000 - Number(time)) > 300 || !/^[a-f0-9]{64}$/.test(signature))
    throw failure("FORBIDDEN", "A valid publication signature is required.", 403);
  const b = await bootstrap(env);
  const snapshot = url.searchParams.get("snapshot");
  const index = Number(match[2]);
  const part = (b.exports[match[1]] as { parts?: Part[] } | undefined)?.parts?.[index];
  if (snapshot !== b.manifest.snapshot_id || !Number.isSafeInteger(index) || !part)
    throw failure("BAD_REQUEST", "Choose a part from the pinned package.");
  const input = ["library-package-v1", request.method, snapshot, match[1], String(index), part.sha256, time].join("\n");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(signature.match(/../g)!, (s) => parseInt(s, 16));
  if (!await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(input)))
    throw failure("FORBIDDEN", "The publication signature is invalid.", 403);
  if (part.bytes > 8 * 1024 * 1024)
    throw failure("RESOURCE_LIMIT", "Package parts must fit within 8 MiB.", 413);
  const bucket = storage(env).bucket;
  const objectKey = `snapshots/${snapshot}/exports/${match[1]}/${index}`;
  const existing = await bucket.head(objectKey);
  if (request.method === "GET")
    return Response.json({ ready: existing?.size === part.bytes && existing?.customMetadata?.sha256 === part.sha256 });
  if (!request.body) throw failure("BAD_REQUEST", "Package bytes are required.");
  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > part.bytes) {
      await reader.cancel();
      throw failure("RESOURCE_LIMIT", "The package part exceeds its pinned size.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (size !== part.bytes || await sha256(bytes) !== part.sha256)
    throw failure("STORAGE_CORRUPT", "The package bytes do not match the pinned checksum.", 409);
  await bucket.put(objectKey, bytes, { customMetadata: { sha256: part.sha256 } });
  return Response.json({ ready: true, snapshot_id: snapshot, format: match[1], part_index: index });
}
