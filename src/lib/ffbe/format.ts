const numberFormatter = new Intl.NumberFormat("en-US");

export const formatNumber = (value: number | string | null | undefined): string => {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (parsed === null || parsed === undefined || Number.isNaN(parsed))
    return "0";
  return numberFormatter.format(parsed);
};

export const compactNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return numberFormatter.format(value);
};

export const epochToDate = (value: string | number | null): Date | null => {
  if (value === null || value === undefined) return null;
  const seconds = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
};

export const formatEpoch = (value: string | number | null): string => {
  const date = epochToDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const nowEpoch = (): number => Date.now() / 1000;

export const fileNameWithoutExt = (name: string): string =>
  name.replace(/\.[^.]+$/, "");

export const parseIdList = (text: string): string[] => {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const ids = new Set<string>();
  for (const part of parts) {
    if (/^\d+$/.test(part)) ids.add(part);
  }
  return Array.from(ids);
};

/** Parses "id", "id:3", "id x3" or "id*3" tokens into unique id/amount pairs. */
export const parseIdAmounts = (
  text: string,
  fallback: number,
): { id: string; count: number }[] => {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const totals = new Map<string, number>();
  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:[:x*](\d+))?$/i);
    if (!match) continue;
    const id = match[1];
    const amount = match[2] ? Number(match[2]) : fallback;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totals.set(id, (totals.get(id) ?? 0) + Math.floor(amount));
  }
  return [...totals.entries()].map(([id, count]) => ({ id, count }));
};
