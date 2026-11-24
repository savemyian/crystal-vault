import { emptyCatalog, type Catalog } from "./types";

type RawEntry = { id: string; name: string; category?: string };

const normalizeKey = (key: string): keyof Catalog | null => {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (k.startsWith("item")) return "items";
  if (k.startsWith("equip") || k.startsWith("weapon") || k.startsWith("armor"))
    return "equip";
  if (k.startsWith("materia") || k.startsWith("abilitystone"))
    return "materia";
  if (k.startsWith("important")) return "important";
  if (k.startsWith("unit") || k.startsWith("character")) return "units";
  if (k.startsWith("mission") || k.startsWith("quest")) return "missions";
  if (k.startsWith("vision") || k.startsWith("card")) return "vision";
  return null;
};

const guessCategory = (id: string): keyof Catalog => {
  const len = id.length;
  if (len <= 4) return "important";
  if (len >= 10) return "materia";
  if (id.startsWith("3") || id.startsWith("4") || id.startsWith("8"))
    return "equip";
  return "items";
};

const addEntry = (
  catalog: Catalog,
  entry: RawEntry,
  fallbackCategory?: keyof Catalog,
) => {
  const id = String(entry.id ?? "").trim();
  const name = String(entry.name ?? "").trim();
  if (!id || !name) return;
  const bucket =
    (entry.category ? normalizeKey(entry.category) : null) ??
    fallbackCategory ??
    guessCategory(id);
  catalog[bucket][id] = name;
};

const parseJson = (text: string): unknown => JSON.parse(text);

const fromArray = (value: unknown[], catalog: Catalog) => {
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const id =
      record.id ?? record.item_id ?? record.unit_id ?? record.mission_id ?? record.key;
    const name =
      record.name ?? record.title ?? record.label ?? record.value ?? record.display_name;
    if (id === undefined || name === undefined) continue;
    addEntry(
      catalog,
      {
        id: String(id),
        name: String(name),
        category: (record.category ?? record.type ?? record.kind) as
          | string
          | undefined,
      },
      undefined,
    );
  }
};

const fromObject = (value: Record<string, unknown>, catalog: Catalog) => {
  const keys = Object.keys(value);
  const buckets = keys.filter((key) => normalizeKey(key) !== null);

  if (buckets.length > 0) {
    for (const bucketKey of buckets) {
      const bucket = normalizeKey(bucketKey);
      const content = value[bucketKey];
      if (!bucket || !content || typeof content !== "object") continue;
      if (Array.isArray(content)) {
        fromArray(content, catalog);
        continue;
      }
      for (const [id, name] of Object.entries(content as Record<string, unknown>)) {
        if (name && typeof name === "object") {
          const record = name as Record<string, unknown>;
          addEntry(catalog, {
            id,
            name: String(record.name ?? record.title ?? id),
            category: bucketKey,
          });
        } else if (typeof name === "string" || typeof name === "number") {
          addEntry(catalog, { id, name: String(name) }, bucket);
        }
      }
    }
    return;
  }

  for (const [id, name] of Object.entries(value)) {
    if (typeof name === "string" || typeof name === "number") {
      addEntry(catalog, { id, name: String(name) });
    } else if (name && typeof name === "object") {
      const record = name as Record<string, unknown>;
      const label = record.name ?? record.title ?? record.label;
      if (label !== undefined) {
        addEntry(catalog, {
          id,
          name: String(label),
          category: (record.category ?? record.type) as string | undefined,
        });
      }
    }
  }
};

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const fromCsv = (text: string, catalog: Catalog) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return;

  const header = splitCsvLine(lines[0]).map((cell) =>
    cell.toLowerCase().replace(/[^a-z]/g, ""),
  );
  const idIndex = header.findIndex((cell) =>
    ["id", "itemid", "unitid", "missionid", "key"].includes(cell),
  );

  if (idIndex === -1) {
    for (const line of lines) {
      const cells = splitCsvLine(line);
      if (cells.length < 2) continue;
      addEntry(catalog, { id: cells[0], name: cells[1] });
    }
    return;
  }

  const nameIndex = header.findIndex((cell) =>
    ["name", "title", "label", "displayname"].includes(cell),
  );
  const categoryIndex = header.findIndex((cell) =>
    ["category", "type", "kind"].includes(cell),
  );

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    addEntry(catalog, {
      id: cells[idIndex] ?? "",
      name: cells[nameIndex === -1 ? 1 : nameIndex] ?? "",
      category: categoryIndex === -1 ? undefined : cells[categoryIndex],
    });
  }
};

export const parseCatalog = (text: string): Catalog => {
  const catalog = emptyCatalog();
  const trimmed = text.trim();
  if (!trimmed) return catalog;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = parseJson(trimmed);
    if (Array.isArray(parsed)) fromArray(parsed, catalog);
    else if (parsed && typeof parsed === "object")
      fromObject(parsed as Record<string, unknown>, catalog);
    return catalog;
  }

  fromCsv(trimmed, catalog);
  return catalog;
};

const BUILTIN_PATH = "ffbe/names.json";
let builtinCache: Promise<Catalog | null> | null = null;

const normalizeBuiltin = (raw: Record<string, unknown>): Catalog => {
  const catalog = emptyCatalog();
  for (const bucket of Object.keys(catalog) as (keyof Catalog)[]) {
    const value = raw[bucket];
    if (!value || typeof value !== "object") continue;
    const target = catalog[bucket] as Record<string, string>;
    for (const [id, name] of Object.entries(value as Record<string, unknown>)) {
      if (typeof name === "string" && name) target[id] = name;
    }
  }
  return catalog;
};

/**
 * Names extracted from the game client's master data, shipped with the editor
 * so every id has a readable name without importing anything.
 */
export const loadBuiltinCatalog = (): Promise<Catalog | null> => {
  if (!builtinCache) {
    const base = import.meta.env.BASE_URL ?? "/";
    builtinCache = fetch(`${base}${BUILTIN_PATH}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && typeof data === "object"
          ? normalizeBuiltin(data as Record<string, unknown>)
          : null,
      )
      .catch(() => null);
  }
  return builtinCache;
};

const STORAGE_KEY = "ffbe-save-editor:catalog";

export const loadStoredCatalog = (): Catalog | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...emptyCatalog(), ...(JSON.parse(raw) as Partial<Catalog>) };
  } catch {
    return null;
  }
};

export const storeCatalog = (catalog: Catalog) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // A catalog bigger than the storage quota simply stays session-only.
  }
};

export const clearStoredCatalog = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};
