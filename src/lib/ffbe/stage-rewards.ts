/** [itemId, count per drop, drop rate in percent, independent rolls per clear] */
export type StageDrop = [string, number, number, number];

export interface StageReward {
  /** gil the enemies of this stage hand out */
  g: number;
  /** the enemies' own drop tables, straight from the monster masters */
  d: StageDrop[];
}

export interface StageRewardMap {
  missions: Record<string, StageReward>;
}

const cache: Partial<Record<string, Promise<StageRewardMap | null>>> = {};

const fetchRewards = (file: string): Promise<StageRewardMap | null> => {
  if (!cache[file]) {
    const base = import.meta.env.BASE_URL ?? "/";
    cache[file] = fetch(`${base}ffbe/${file}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && data.missions && typeof data.missions === "object"
          ? (data as StageRewardMap)
          : null,
      )
      .catch(() => null);
  }
  return cache[file];
};

/**
 * Story stages, walked from F_MISSION_PHASE_MST → F_BATTLE_GROUP_MST →
 * F_MONSTER_PARTS_MST of the server's own decoded masters: the gil each enemy
 * carries and the drop table of its parts.
 */
export const loadStageRewards = () => fetchRewards("stage-rewards.json");

/**
 * The same walk for every other battle stage the masters know: vortex, raid,
 * event, esper, exp dungeon, story episodes and event quests.
 */
export const loadEventRewards = () => fetchRewards("event-rewards.json");

/**
 * Rolls a stage's drop tables once: every entry on its own at its rate, like the
 * client does when a monster dies. Returns the item id → count of this clear.
 */
export const rollDrops = (reward: StageReward, out: Map<string, number>) => {
  for (const [itemId, count, rate, rolls] of reward.d ?? []) {
    if (!count || !rolls) continue;
    const chance = Math.min(100, Math.max(0, rate));
    for (let roll = 0; roll < rolls; roll += 1) {
      if (chance >= 100 || Math.random() * 100 < chance) {
        out.set(itemId, (out.get(itemId) ?? 0) + count);
      }
    }
  }
};
