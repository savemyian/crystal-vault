/**
 * SQLite WAL merging.
 *
 * The save database is usually still in WAL mode when it is pulled, so the
 * newest transactions live in `save.db-wal` and are not part of `save.db`.
 * The browser has no SQLite file VFS, so this applies the committed WAL frames
 * itself before sql.js opens the database.
 *
 * Only frames up to the last commit are applied; a torn frame at the end of a
 * live pull is ignored. Checksums are verified with the byte order declared by
 * the WAL header.
 */

const WAL_HEADER_SIZE = 32;
const FRAME_HEADER_SIZE = 24;
const MAGIC_LITTLE_ENDIAN = 0x377f0682;
const MAGIC_BIG_ENDIAN = 0x377f0683;

export interface WalMergeResult {
  bytes: Uint8Array;
  /** committed pages taken from the WAL */
  pages: number;
  /** number of valid committed transactions found */
  commits: number;
  /** true when the WAL held nothing that needed applying */
  empty: boolean;
}

const checksum = (
  source: Uint8Array,
  start: number,
  length: number,
  s1: number,
  s2: number,
  littleEndian: boolean,
): [number, number] => {
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  const end = start + length;
  for (let offset = start; offset + 8 <= end; offset += 8) {
    const first = littleEndian
      ? view.getUint32(offset, true)
      : view.getUint32(offset, false);
    const second = littleEndian
      ? view.getUint32(offset + 4, true)
      : view.getUint32(offset + 4, false);
    s1 = (s1 + first + s2) >>> 0;
    s2 = (s2 + second + s1) >>> 0;
  }
  return [s1, s2];
};

const readU32 = (view: DataView, offset: number) => view.getUint32(offset, false);

/**
 * Applies the committed frames of `wal` to a copy of `db` and returns the
 * self-contained database. An unusable WAL returns the original bytes.
 */
export const mergeWal = (db: Uint8Array, wal: Uint8Array): WalMergeResult => {
  const unchanged = (): WalMergeResult => ({
    bytes: new Uint8Array(db),
    pages: 0,
    commits: 0,
    empty: true,
  });
  if (wal.byteLength < WAL_HEADER_SIZE + FRAME_HEADER_SIZE) return unchanged();

  const view = new DataView(wal.buffer, wal.byteOffset, wal.byteLength);
  const magic = readU32(view, 0);
  if (magic !== MAGIC_LITTLE_ENDIAN && magic !== MAGIC_BIG_ENDIAN) {
    return unchanged();
  }
  const littleEndian = magic === MAGIC_LITTLE_ENDIAN;
  const pageSize = readU32(view, 8);
  if (
    pageSize < 512 ||
    pageSize > 65536 ||
    (pageSize & (pageSize - 1)) !== 0
  ) {
    return unchanged();
  }
  if (db.byteLength >= 100) {
    const dbPageSizeRaw = new DataView(
      db.buffer,
      db.byteOffset,
      db.byteLength,
    ).getUint16(16, false);
    const dbPageSize = dbPageSizeRaw === 1 ? 65536 : dbPageSizeRaw;
    if (dbPageSize !== pageSize) return unchanged();
  }
  const salt1 = readU32(view, 16);
  const salt2 = readU32(view, 20);
  const [headerS1, headerS2] = checksum(wal, 0, 24, 0, 0, littleEndian);
  if (
    headerS1 !== readU32(view, 24) ||
    headerS2 !== readU32(view, 28)
  ) {
    return unchanged();
  }

  interface Frame {
    page: number;
    data: Uint8Array;
  }
  const frames: Frame[] = [];
  let lastCommit = -1;
  let finalSize = 0;
  let commitCount = 0;
  let s1 = headerS1;
  let s2 = headerS2;
  let offset = WAL_HEADER_SIZE;

  while (offset + FRAME_HEADER_SIZE + pageSize <= wal.byteLength) {
    const page = readU32(view, offset);
    const dbSize = readU32(view, offset + 4);
    if (
      readU32(view, offset + 8) !== salt1 ||
      readU32(view, offset + 12) !== salt2
    ) {
      break;
    }
    [s1, s2] = checksum(wal, offset, 8, s1, s2, littleEndian);
    [s1, s2] = checksum(wal, offset + FRAME_HEADER_SIZE, pageSize, s1, s2, littleEndian);
    if (s1 !== readU32(view, offset + 16) || s2 !== readU32(view, offset + 20)) {
      break;
    }
    if (page === 0) break;
    frames.push({
      page,
      data: wal.slice(offset + FRAME_HEADER_SIZE, offset + FRAME_HEADER_SIZE + pageSize),
    });
    if (dbSize !== 0) {
      lastCommit = frames.length - 1;
      finalSize = dbSize;
      commitCount += 1;
    }
    offset += FRAME_HEADER_SIZE + pageSize;
  }

  if (lastCommit < 0 || finalSize === 0) return unchanged();

  let output = new Uint8Array(Math.max(db.byteLength, finalSize * pageSize));
  output.set(db);
  for (let index = 0; index <= lastCommit; index += 1) {
    const frame = frames[index];
    const start = (frame.page - 1) * pageSize;
    const needed = start + pageSize;
    let target = output;
    if (needed > target.byteLength) {
      target = new Uint8Array(needed);
      target.set(output);
      output = target;
    }
    output.set(frame.data, start);
  }

  const committed = output.slice(0, finalSize * pageSize);
  // The WAL's final commit is authoritative for the page count.
  if (committed.byteLength >= 32) {
    new DataView(committed.buffer).setUint32(28, finalSize, false);
  }

  return {
    bytes: committed,
    pages: lastCommit + 1,
    commits: commitCount,
    empty: false,
  };
};
