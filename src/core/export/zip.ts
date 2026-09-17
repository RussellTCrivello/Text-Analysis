/**
 * Minimal ZIP writer (STORE method, no compression).
 *
 * Enough to emit genuine OOXML packages (.xlsx, .docx) without pulling a
 * dependency into the browser bundle. Documents are small, so uncompressed
 * storage is a reasonable trade-off for a zero-dependency core.
 */
import { crc32, utf8Bytes } from '../text';

export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
  /** Last-modified date; defaults to 1980-01-01 for reproducible output. */
  date?: Date;
}

const DOS_EPOCH = new Date(Date.UTC(1980, 0, 1));

function dosTime(date: Date): { time: number; date: number } {
  const d = date < DOS_EPOCH ? DOS_EPOCH : date;
  const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
  const day = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  return { time, date: day };
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const data = typeof entry.data === 'string' ? utf8Bytes(entry.data) : entry.data;
    const nameBytes = utf8Bytes(entry.name);
    const crc = crc32(data);
    const { time, date } = dosTime(entry.date ?? DOS_EPOCH);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flag: UTF-8 names
    lv.setUint16(8, 0, true); // method: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, data);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); // central directory header
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, data.length, true);
    dv.setUint32(24, data.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offset, true);
    dir.set(nameBytes, 46);
    central.push(dir);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of [...chunks, ...central, end]) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Inflate a raw-deflate payload (method 8) using the platform stream API. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decode a zip archive via its central directory (names + payloads),
 * transparently inflating DEFLATE entries. This is the reader to use for
 * files produced by other tools (Word/Excel compress entries); the sync
 * `readZip` remains for archives this app itself writes (STORE only).
 */
export async function readZipAsync(bytes: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // locate EOCD (signature 0x06054b50), searching back from the end
  let eocd = -1;
  const scanMin = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= scanMin; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip archive (missing end-of-central-directory record)');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const out: { name: string; data: Uint8Array }[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    // pull the payload from the local header (its name/extra lengths can differ)
    const lnameLen = view.getUint16(localOffset + 26, true);
    const lextraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lnameLen + lextraLen;
    const raw = bytes.subarray(start, start + compSize);
    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`Unsupported compression method ${method} in zip entry "${name}"`);
    out.push({ name, data });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Decode a zip archive's entry names + payloads (used when importing .xlsx files). */
export function readZip(bytes: Uint8Array): { name: string; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: { name: string; data: Uint8Array }[] = [];
  let i = 0;
  while (i + 4 <= bytes.length) {
    if (view.getUint32(i, true) !== 0x04034b50) break;
    const method = view.getUint16(i + 8, true);
    const compSize = view.getUint32(i + 18, true);
    const uncompSize = view.getUint32(i + 22, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const start = i + 30;
    const name = new TextDecoder().decode(bytes.subarray(start, start + nameLen));
    const dataStart = start + nameLen + extraLen;
    if (method !== 0) {
      throw new Error(`Unsupported compression method ${method} in zip entry "${name}"`);
    }
    out.push({ name, data: bytes.subarray(dataStart, dataStart + (compSize || uncompSize)) });
    i = dataStart + compSize;
  }
  return out;
}
