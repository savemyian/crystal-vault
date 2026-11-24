import type { Catalog } from "./types";

export interface ItemMeta {
  /** equipment type, e.g. "Sword" */
  type?: string;
  /** equipment slot, e.g. "Weapon" */
  slot?: string;
  /** rarity on the equipment */
  rarity?: number;
  /** unit rarity range */
  rarityMin?: number;
  rarityMax?: number;
  /** vision card base rarity and level cap */
  cardRarity?: number;
  cardMaxLevel?: number;
}

interface RawMeta {
  equip?: Record<string, { t?: string; s?: string; r?: number }>;
  units?: Record<string, { a?: number; b?: number }>;
  vision?: Record<string, { r?: number; l?: number }>;
}

const META_PATH = "ffbe/meta.json";
let cache: Promise<RawMeta | null> | null = null;

/** Master metadata (type, slot, rarity) extracted from the public datamine. */
export const loadMeta = (): Promise<RawMeta | null> => {
  if (!cache) {
    const base = import.meta.env.BASE_URL ?? "/";
    cache = fetch(`${base}${META_PATH}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data && typeof data === "object" ? (data as RawMeta) : null))
      .catch(() => null);
  }
  return cache;
};

export const metaFor = (
  meta: RawMeta | null,
  bucket: keyof Catalog,
  id: string,
): ItemMeta | null => {
  if (!meta) return null;
  if (bucket === "equip" || bucket === "materia") {
    const row = meta.equip?.[id];
    if (!row) return null;
    return { type: row.t, slot: row.s, rarity: row.r };
  }
  if (bucket === "units") {
    const row = meta.units?.[id];
    if (!row) return null;
    return { rarityMin: row.a, rarityMax: row.b };
  }
  if (bucket === "vision") {
    const row = meta.vision?.[id];
    if (!row) return null;
    return { cardRarity: row.r, cardMaxLevel: row.l };
  }
  return null;
};

/** Human readable one-liner for a row, e.g. "Sword · Weapon · 5★". */
export const describeMeta = (value: ItemMeta | null): string | null => {
  if (!value) return null;
  const parts: string[] = [];
  if (value.type) parts.push(value.type);
  if (value.slot) parts.push(value.slot);
  if (value.rarity) parts.push(`${value.rarity}★`);
  if (value.rarityMin && value.rarityMax) {
    parts.push(
      value.rarityMin === value.rarityMax
        ? `${value.rarityMin}★`
        : `${value.rarityMin}★–${value.rarityMax}★`,
    );
  }
  if (value.cardRarity) parts.push(`${value.cardRarity}★`);
  if (value.cardMaxLevel) parts.push(`max Lv ${value.cardMaxLevel}`);
  return parts.length > 0 ? parts.join(" · ") : null;
};
