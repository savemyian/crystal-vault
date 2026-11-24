/**
 * Item World bonuses are stored as a comma separated list of abilities on the
 * enhanced equipment. Every entry the save holds looks like `24:108117`, so a
 * bare ability id typed into the editor is written with the same prefix.
 *
 * The list may repeat an ability: three `24:102900` entries mean ATK +1000 was
 * learned three times.
 */
export const EX_ABILITY_PREFIX = 24;

export const parseExLearn = (raw: string | null | undefined): string[] =>
  String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** Reads the numeric ability id out of one stored entry. */
export const exAbilityId = (token: string): number | null => {
  const match = token.match(/^(?:\d+:)?(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const MAX_COPIES = 99;

const expandCopies = (entry: string): string[] => {
  // "3x102900", "102900x3" and the same with a typed prefix, e.g. 24:102900*2
  const countFirst = entry.match(/^(\d{1,2})[x*](\d+(?::\d+)?)$/i);
  const countLast = entry.match(/^(\d+(?::\d+)?)[x*](\d{1,2})$/i);
  let body = entry;
  let copies = 1;
  if (countFirst) {
    copies = Number(countFirst[1]);
    body = countFirst[2];
  } else if (countLast) {
    body = countLast[1];
    copies = Number(countLast[2]);
  }
  const id = exAbilityId(body);
  if (id === null) return [];
  const prefix = body.includes(":") ? body.split(":")[0] : String(EX_ABILITY_PREFIX);
  const token = `${Number(prefix)}:${id}`;
  const amount = Number.isFinite(copies)
    ? Math.max(1, Math.min(MAX_COPIES, Math.floor(copies)))
    : 1;
  return Array.from({ length: amount }, () => token);
};

/** Turns typed text into stored entries; commas, spaces and newlines split. */
export const parseExInput = (text: string): string[] => {
  // Fold "102900 x3" / "3 x 102900" into one token so the separators below do
  // not cut the count away from its id.
  const folded = text
    .replace(/(\d+(?::\d+)?)\s*[x*]\s*(\d{1,2})/gi, (_all, id, count) => `${id}x${count}`)
    .replace(/(\d{1,2})\s*[x*]\s*(\d+(?::\d+)?)/gi, (_all, count, id) => `${count}x${id}`);
  const tokens: string[] = [];
  for (const part of folded.split(/[\s,;]+/)) {
    const entry = part.trim();
    if (!entry) continue;
    tokens.push(...expandCopies(entry));
  }
  return tokens;
};

/**
 * Cleans entries and keeps their order. Duplicates are deliberately kept: the
 * save applies every copy, so `ATK +1000` can be learned several times.
 */
export const normalizeExLearn = (tokens: string[]): string[] => {
  const result: string[] = [];
  for (const token of tokens) {
    const id = exAbilityId(token);
    if (id === null) continue;
    const prefix = token.includes(":") ? token.split(":")[0] : String(EX_ABILITY_PREFIX);
    result.push(`${Number(prefix)}:${id}`);
  }
  return result;
};

export const formatExLearn = (tokens: string[]): string =>
  normalizeExLearn(tokens).join(",");
