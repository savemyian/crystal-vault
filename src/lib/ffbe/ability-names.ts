export interface AbilityName {
  /** English display name */
  en: string;
  /** Japanese master name, kept so searches still work in either language */
  ja: string;
}

export type AbilityNames = Record<string, AbilityName>;

const ABILITY_PATH = "ffbe/abilities.json";
let cache: Promise<AbilityNames | null> | null = null;

const normalize = (raw: Record<string, unknown>): AbilityNames => {
  const names: AbilityNames = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(id) || !value || typeof value !== "object") continue;
    const entry = value as { en?: unknown; ja?: unknown };
    if (typeof entry.en !== "string" || !entry.en) continue;
    names[id] = {
      en: entry.en,
      ja: typeof entry.ja === "string" ? entry.ja : "",
    };
  }
  return names;
};

/**
 * English names for the Item World ability families. The save stores only
 * ability ids; the Japanese master supplies the original text, and the English
 * column is the translated label shown in the editor.
 */
export const loadAbilityNames = (): Promise<AbilityNames | null> => {
  if (!cache) {
    const base = import.meta.env.BASE_URL ?? "/";
    cache = fetch(`${base}${ABILITY_PATH}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && typeof data === "object"
          ? normalize(data as Record<string, unknown>)
          : null,
      )
      .catch(() => null);
  }
  return cache;
};

export const searchAbilityNames = (
  names: AbilityNames | null,
  query: string,
  limit = 8,
): { id: string; name: string; ja: string }[] => {
  if (!names) return [];
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: { id: string; name: string; ja: string; rank: number }[] = [];
  for (const [id, entry] of Object.entries(names)) {
    const en = entry.en.toLowerCase();
    const ja = entry.ja.toLowerCase();
    const enAt = en.indexOf(needle);
    const jaAt = ja.indexOf(needle);
    if (id !== needle && !id.includes(needle) && enAt < 0 && jaAt < 0) continue;
    const rank =
      id === needle
        ? 0
        : en.startsWith(needle) || ja.startsWith(needle)
          ? 1
          : enAt >= 0 || jaAt >= 0
            ? 2
            : 3;
    hits.push({ id, name: entry.en, ja: entry.ja, rank });
  }
  hits.sort((left, right) => left.rank - right.rank || Number(left.id) - Number(right.id));
  return hits.slice(0, limit).map(({ id, name, ja }) => ({ id, name, ja }));
};
