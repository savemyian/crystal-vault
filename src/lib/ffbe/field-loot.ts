/**
 * Field loot of an exploration map: the treasure chests and the collection
 * (harvest) points the map scripts place.
 *
 * The masters hold neither — the server builds both catalogues by scanning the
 * map packs (`lapis.assets.treasure_wiki*` / `harvest_map`), so they ship as an
 * asset. A chest pays once ever (`treasure_open` + its own open switch); a
 * harvest point rolls its area's pool again on every walk, so the editor rolls
 * it per run the way `harvest.roll` does.
 */

export interface FieldChest {
  id: string;
  /** the switch the chest turns on when it opens */
  switchId: string;
  /** [kind, item id, count]: kind 20 is an item, 21 equipment, 22 materia, 60 a recipe book */
  rewards: [number, string, number][];
}

export interface HarvestPoint {
  id: string;
  /** the area whose drop pool this point draws from */
  area: string;
}

/** item id, weight, fewest, most */
export type HarvestPool = [string, number, number, number][];

export interface FieldLoot {
  missions: Record<
    string,
    { chests: FieldChest[]; points: HarvestPoint[] }
  >;
  pools: Record<string, HarvestPool>;
}

let cached: Promise<FieldLoot | null> | null = null;

export const loadFieldLoot = (): Promise<FieldLoot | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/field-loot.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && data.missions && typeof data.missions === "object"
          ? (data as FieldLoot)
          : null,
      )
      .catch(() => null);
  }
  return cached;
};

/** One draw from a pool, by weight, then a count inside its range (harvest.roll). */
export const rollHarvest = (
  pool: HarvestPool | undefined,
): { itemId: string; count: number } | null => {
  if (!pool || pool.length === 0) return null;
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry[1]), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  let picked = pool[pool.length - 1];
  for (const entry of pool) {
    roll -= Math.max(0, entry[1]);
    if (roll < 0) {
      picked = entry;
      break;
    }
  }
  const [itemId, , fewest, most] = picked;
  const low = Math.max(0, Math.min(fewest, most));
  const high = Math.max(low, most);
  return {
    itemId,
    count: low + Math.floor(Math.random() * (high - low + 1)),
  };
};
