import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

let sqlPromise: Promise<SqlJsStatic> | null = null;

const loadEngine = (): Promise<SqlJsStatic> => {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) =>
        `${import.meta.env.BASE_URL ?? "/"}${file}`,
    }).catch((error: unknown) => {
      sqlPromise = null;
      console.error("SQLite engine failed to start", error);
      throw new Error(
        "The save engine could not start. Reload the page and try again.",
      );
    });
  }
  return sqlPromise;
};

export const openSave = async (bytes: Uint8Array): Promise<Database> => {
  const SQL = await loadEngine();
  try {
    return new SQL.Database(bytes);
  } catch (error) {
    console.error("Save file could not be read", error);
    throw new Error(
      "That file is not a readable save database. Use the .db file inside the archive, not the archive itself.",
    );
  }
};

export const all = <T>(
  db: Database,
  sql: string,
  params: unknown[] = [],
): T[] => {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
};

export const first = <T>(
  db: Database,
  sql: string,
  params: unknown[] = [],
): T | null => all<T>(db, sql, params)[0] ?? null;

export const scalar = (
  db: Database,
  sql: string,
  params: unknown[] = [],
): number | string | null => {
  const row = first<Record<string, number | string | null>>(db, sql, params);
  if (!row) return null;
  const values = Object.values(row);
  return values.length > 0 ? values[0] : null;
};

export const run = (db: Database, sql: string, params: unknown[] = []) => {
  db.run(sql, params as never);
};

export const integrityCheck = (db: Database): string => {
  const result = db.exec("PRAGMA integrity_check");
  const value = result[0]?.values?.[0]?.[0];
  return typeof value === "string" ? value : "unavailable";
};

export const hasTable = (db: Database, table: string): boolean =>
  first(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [
    table,
  ]) !== null;
