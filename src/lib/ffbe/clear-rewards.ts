/**
 * What a stage pays beyond its drops: the reward of its own first clear and the
 * reward of each challenge star, read from the server's `F_CHALLENGE_MST`.
 *
 * A reward is `[kind, id, count]`. The kinds are the master's own reward types:
 * `lapis`, `unit`, `item`, `equip`, `materia`, `important` (important items),
 * `recipe` (recipe books), `vision` (vision cards), `emblem` (player
 * emblems) and `ability` (latent abilities and blue magic, which only the
 * game itself can hand out).
 */
export type RewardKind =
  | "lapis"
  | "gil"
  | "item"
  | "equip"
  | "materia"
  | "important"
  | "unit"
  | "recipe"
  | "vision"
  | "emblem"
  | "ability";

/** `[kind, id, count, pattern?]`; units and vision cards carry a pattern id. */
export type Reward = [RewardKind, string, number, string?];

export interface ClearRewardMap {
  /** every distinct reward, so 12,600 stages do not repeat the same triple */
  pool: Reward[];
  /** mission id → objective slot → index in `pool` */
  missions: Record<string, Record<string, number>>;
  /** mission id → indexes in `pool` for the stage's own first-clear reward */
  clear?: Record<string, number[]>;
}

const KEY = "clear-rewards.json";
let cached: Promise<ClearRewardMap | null> | null = null;

const isReward = (value: unknown): value is Reward =>
  Array.isArray(value) &&
  typeof value[0] === "string" &&
  typeof value[1] === "string" &&
  Number.isFinite(value[2]) &&
  (value[3] === undefined || typeof value[3] === "string");

/** Loads the reward table once; a save without it simply pays no clear reward. */
export const loadClearRewards = (): Promise<ClearRewardMap | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/${KEY}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.pool) || data.pool.length === 0) return null;
        const missions =
          data.missions && typeof data.missions === "object" ? data.missions : {};
        const clear =
          data.clear && typeof data.clear === "object" ? data.clear : undefined;
        return { pool: data.pool as Reward[], missions, clear } satisfies ClearRewardMap;
      })
      .catch(() => null);
  }
  return cached;
};

const resolve = (map: ClearRewardMap, index: unknown): Reward | null => {
  const reward = map.pool[Number(index)];
  return isReward(reward) ? reward : null;
};

const pick = (map: ClearRewardMap, indexes: unknown): Reward[] => {
  if (!Array.isArray(indexes)) return [];
  return indexes
    .map((index) => resolve(map, index))
    .filter((reward): reward is Reward => reward !== null);
};

/** The reward a single star of a stage pays, or null when it pays nothing. */
export const starReward = (
  map: ClearRewardMap | null,
  missionId: number,
  slot: number,
): Reward | null => {
  if (!map) return null;
  const slots = map.missions[String(missionId)];
  if (!slots) return null;
  return resolve(map, slots[String(slot)]);
};

/** The stage's own first-clear reward, the one its mission entry lists. */
export const clearReward = (
  map: ClearRewardMap | null,
  missionId: number,
): Reward[] => {
  if (!map?.clear) return [];
  return pick(map, map.clear[String(missionId)]);
};
