import { unzipSync } from "fflate";
import { mergeWal } from "./wal";

export interface SaveFilePayload {
  name: string;
  bytes: Uint8Array;
}

export interface LoadedSave {
  bytes: Uint8Array;
  name: string;
  /** true when committed WAL frames were applied */
  mergedWal: boolean;
  walPages: number;
}

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

const isZip = (bytes: Uint8Array) =>
  bytes.byteLength > 4 &&
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  (bytes[2] === 0x03 || bytes[2] === 0x05);

const isWal = (name: string) => /-wal$/i.test(name);

const isDatabase = (name: string) =>
  /\.(db|sqlite|sqlite3)$/i.test(name) && !isWal(name) && !/-shm$/i.test(name);

const isSqlite = (bytes: Uint8Array) => {
  const magic = "SQLite format 3\u0000";
  if (bytes.byteLength < magic.length) return false;
  for (let index = 0; index < magic.length; index += 1) {
    if (bytes[index] !== magic.charCodeAt(index)) return false;
  }
  return true;
};

const pickEntry = (
  entries: Record<string, Uint8Array>,
  predicate: (name: string) => boolean,
) => {
  const names = Object.keys(entries)
    .filter(predicate)
    .sort((left, right) => {
      const leftRoot = left.includes("/") ? 1 : 0;
      const rightRoot = right.includes("/") ? 1 : 0;
      return leftRoot - rightRoot || left.length - right.length;
    });
  return names[0];
};

const fromArchive = (payload: SaveFilePayload): LoadedSave => {
  const entries = unzipSync(payload.bytes);
  const dbKey =
    pickEntry(entries, (name) => /(^|[\\/])save\.db$/i.test(name)) ??
    pickEntry(entries, (name) => isDatabase(name));
  if (!dbKey) {
    throw new Error(
      "That archive has no save.db. Use the save.zip produced by the Save Tools.",
    );
  }
  const dbName = baseName(dbKey);
  const walKey =
    pickEntry(
      entries,
      (name) => baseName(name).toLowerCase() === `${dbName.toLowerCase()}-wal`,
    ) ?? pickEntry(entries, (name) => isWal(name));
  const db = entries[dbKey];
  if (!isSqlite(db)) {
    throw new Error("The archive's save.db is not a SQLite save database.");
  }
  const wal = walKey ? entries[walKey] : undefined;
  const merged = wal ? mergeWal(db, wal) : null;
  return {
    bytes: merged?.bytes ?? new Uint8Array(db),
    name: "save.db",
    mergedWal: Boolean(merged && !merged.empty),
    walPages: merged?.pages ?? 0,
  };
};

/**
 * Accepts either the `save.zip` from the Save Tools (database + WAL) or the
 * two files dropped together, and returns one database with the WAL applied.
 */
export const readSaveFiles = (files: SaveFilePayload[]): LoadedSave => {
  if (files.length === 0) throw new Error("Choose a save file first.");

  const archive = files.find((file) => isZip(file.bytes));
  if (archive) return fromArchive(archive);

  const dbFile = files.find((file) => isDatabase(file.name));
  const walFile = files.find((file) => isWal(file.name));
  if (!dbFile) {
    throw new Error(
      "No save.db found. Drop save.zip, or save.db together with save.db-wal.",
    );
  }
  if (!isSqlite(dbFile.bytes)) {
    throw new Error("That file is not a SQLite save database.");
  }
  const merged = walFile ? mergeWal(dbFile.bytes, walFile.bytes) : null;
  return {
    bytes: merged?.bytes ?? new Uint8Array(dbFile.bytes),
    name: "save.db",
    mergedWal: Boolean(merged && !merged.empty),
    walPages: merged?.pages ?? 0,
  };
};
