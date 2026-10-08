// Stored ZIP64 entries: unknown lengths are closed by CRC/size descriptors.
// Output fragments are immutable and can be concatenated without buffering ZIPs.
const encoder = new TextEncoder();
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array, prior = 0) {
  let c = (prior ^ 0xffffffff) >>> 0;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function buffer(size: number) {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}
export function joinBytes(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
export function zipHeader(name: string) {
  const n = encoder.encode(name),
    { bytes, view } = buffer(30 + n.length + 20);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 45, true);
  view.setUint16(6, 0x808, true);
  view.setUint16(12, 0x21, true);
  view.setUint32(18, 0xffffffff, true);
  view.setUint32(22, 0xffffffff, true);
  view.setUint16(26, n.length, true);
  view.setUint16(28, 20, true);
  bytes.set(n, 30);
  view.setUint16(30 + n.length, 1, true);
  view.setUint16(32 + n.length, 16, true);
  return bytes;
}
export function zipDescriptor(crc: number, size: number) {
  const { bytes, view } = buffer(24);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setBigUint64(8, BigInt(size), true);
  view.setBigUint64(16, BigInt(size), true);
  return bytes;
}
export function zipCentral(
  name: string,
  crc: number,
  size: number,
  offset: number,
) {
  const n = encoder.encode(name),
    { bytes, view } = buffer(46 + n.length + 28);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 45 | (3 << 8), true);
  view.setUint16(6, 45, true);
  view.setUint16(8, 0x808, true);
  view.setUint16(14, 0x21, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, 0xffffffff, true);
  view.setUint32(24, 0xffffffff, true);
  view.setUint16(28, n.length, true);
  view.setUint16(30, 28, true);
  view.setUint32(38, 0x81a40000, true);
  view.setUint32(42, 0xffffffff, true);
  bytes.set(n, 46);
  const i = 46 + n.length;
  view.setUint16(i, 1, true);
  view.setUint16(i + 2, 24, true);
  view.setBigUint64(i + 4, BigInt(size), true);
  view.setBigUint64(i + 12, BigInt(size), true);
  view.setBigUint64(i + 20, BigInt(offset), true);
  return bytes;
}
export function zipEnd(
  entries: number,
  centralSize: number,
  centralOffset: number,
) {
  const { bytes, view } = buffer(98);
  view.setUint32(0, 0x06064b50, true);
  view.setBigUint64(4, BigInt(44), true);
  view.setUint16(12, 45, true);
  view.setUint16(14, 45, true);
  view.setBigUint64(24, BigInt(entries), true);
  view.setBigUint64(32, BigInt(entries), true);
  view.setBigUint64(40, BigInt(centralSize), true);
  view.setBigUint64(48, BigInt(centralOffset), true);
  view.setUint32(56, 0x07064b50, true);
  view.setBigUint64(64, BigInt(centralOffset + centralSize), true);
  view.setUint32(72, 1, true);
  view.setUint32(76, 0x06054b50, true);
  view.setUint16(84, 0xffff, true);
  view.setUint16(86, 0xffff, true);
  view.setUint32(88, 0xffffffff, true);
  view.setUint32(92, 0xffffffff, true);
  return bytes;
}
export const csvFields = [
  "snapshot_id",
  "reading_unit_id",
  "work_id",
  "edition_id",
  "reading_revision",
  "title",
  "language",
  "source_path",
  "source_sha256",
  "row_id",
  "physical_line",
  "analysis_line",
  "sung_line",
  "indent",
  "kind",
  "structure",
  "voice",
  "couplet",
  "hemistich",
  "text",
  "source_text",
  "terminator",
  "source_ranges",
  "normalized_cp_range",
  "normalized_utf16_range",
  "transformation_spans",
];
export function csvValue(value: unknown) {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
