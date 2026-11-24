/**
 * The two score-attack modes of the game, as their own servers compute them.
 *
 * Dark Visions and World of Vision share one formula (`parade_score.py` of the
 * lapis server, config/dark_visions.yaml): six radar axes — clear, one-turn
 * damage, weakness hits, KO count, damage taken, chain — summed into the stage
 * score, with a grade taken from the share of the axes' maximum.
 *
 * Clash of Wills scores seven components (`cow_score.py`): a flat clear bonus,
 * one-turn damage, effective (weak-point) attacks, turns, chain, the morale
 * level reached and the morale gained over the battle.
 */

export interface ParadeStats {
  maxDamage: number;
  weakness: number;
  kos: number;
  taken: number;
  chain: number;
}

export interface ParadeScore {
  clear: number;
  damage: number;
  weakness: number;
  ko: number;
  taken: number;
  chain: number;
  total: number;
  /** 0 S++ … 5 C, the client's own ids */
  grade: number;
}

/** config/dark_visions.yaml, its shipped defaults */
export const PARADE = {
  clearFirst: 50_000,
  clearNext: 100_000,
  clearFinal: 250_000,
  damageBase: 5_000,
  damageDiv: 85_899,
  damageCap: 30_000,
  weaknessPerHit: 1_700,
  weaknessCap: 10_000,
  koCap: 10_000,
  koPenalty: 1_000,
  takenCap: 10_000,
  takenFullLoss: 2_000_000,
  chainPer: 100,
  chainCap: 10_000,
  gradeSteps: [
    [0, 5],
    [30, 4],
    [50, 3],
    [65, 2],
    [80, 1],
    [95, 0],
  ] as const,
};

export const PARADE_GRADE_NAMES = ["S++", "S+", "S", "A", "B", "C"] as const;

const paradeGrade = (percent: number): number => {
  let grade: number = PARADE.gradeSteps[0][1];
  for (const [atLeast, id] of PARADE.gradeSteps) {
    if (percent >= atLeast) grade = id;
  }
  return grade;
};

export const paradeScore = (
  stats: ParadeStats,
  clearPoints: number,
): ParadeScore => {
  const clear = Math.max(0, Math.floor(clearPoints));
  const damage =
    stats.maxDamage <= 0
      ? 0
      : Math.min(
          PARADE.damageCap,
          PARADE.damageBase + Math.floor(stats.maxDamage / PARADE.damageDiv),
        );
  const weakness = Math.min(
    PARADE.weaknessCap,
    Math.floor(stats.weakness * PARADE.weaknessPerHit),
  );
  const ko = Math.max(0, PARADE.koCap - Math.floor(stats.kos * PARADE.koPenalty));
  const taken = Math.max(
    0,
    Math.floor(
      (PARADE.takenCap * (PARADE.takenFullLoss - stats.taken)) /
        PARADE.takenFullLoss,
    ),
  );
  const chain = Math.min(PARADE.chainCap, Math.floor(stats.chain * PARADE.chainPer));
  const total = clear + damage + weakness + ko + taken + chain;
  const maximum =
    clear +
    PARADE.damageCap +
    PARADE.weaknessCap +
    PARADE.koCap +
    PARADE.takenCap +
    PARADE.chainCap;
  const percent = maximum > 0 ? Math.floor((total * 100) / maximum) : 0;
  return {
    clear,
    damage,
    weakness,
    ko,
    taken,
    chain,
    total,
    grade: paradeGrade(percent),
  };
};

/** The six numbers `parade_best.values_csv` holds, in the order the client reads them. */
export const paradeValues = (score: ParadeScore): string =>
  [score.clear, score.damage, score.weakness, score.ko, score.taken, score.chain].join(
    ",",
  );

export interface CowStats {
  maxDamage: number;
  /** weak-point (element/status) hits */
  effective: number;
  turns: number;
  chain: number;
  /** the morale percentage the battle ended on */
  finalMoralePct: number;
  /** morale gained during the battle */
  moraleGained: number;
  /** the mission's morale scale */
  moraleScale: number;
}

export const COW = {
  clear: 10_000,
  damageCap: 30_000,
  damageFull: 2_500_000_000,
  effectivePer: 1_700,
  effectiveCap: 10_000,
  turnsFull: 10_000,
  turnsStep: 1_000,
  turnsFree: 10,
  chainPer: 100,
  chainCap: 10_000,
  moraleFinalCap: 10_000,
  moraleTotalCap: 30_000,
  /** every component at its cap: what the rating is a share of */
  maxBase: 110_000,
} as const;

export interface CowScore {
  parts: {
    clear: number;
    damage: number;
    effective: number;
    turns: number;
    chain: number;
    moraleFinal: number;
    moraleTotal: number;
  };
  base: number;
  total: number;
}

export const cowScore = (
  stats: CowStats,
  options: { levelBonus?: number; bonusPct?: number } = {},
): CowScore => {
  const scale = Math.max(1, Math.floor(stats.moraleScale) || 10_000);
  const parts = {
    clear: COW.clear,
    damage: Math.min(
      COW.damageCap,
      Math.floor((COW.damageCap * Math.max(0, stats.maxDamage)) / COW.damageFull),
    ),
    effective: Math.min(
      COW.effectiveCap,
      COW.effectivePer * Math.max(0, Math.floor(stats.effective)),
    ),
    turns: Math.max(
      0,
      COW.turnsFull -
        COW.turnsStep * Math.max(0, Math.floor(stats.turns) - COW.turnsFree),
    ),
    chain: Math.min(COW.chainCap, COW.chainPer * Math.max(0, Math.floor(stats.chain))),
    moraleFinal: Math.min(
      COW.moraleFinalCap,
      Math.round(COW.moraleFinalCap * (Math.max(0, stats.finalMoralePct) / 100)),
    ),
    moraleTotal: Math.min(
      COW.moraleTotalCap,
      Math.floor((Math.max(0, stats.moraleGained) * COW.moraleTotalCap) / scale),
    ),
  };
  const base = Object.values(parts).reduce((sum, value) => sum + value, 0);
  const bonusPct = Math.max(0, Math.min(100, options.bonusPct ?? 0));
  const levelBonus = Math.max(0, Math.floor(options.levelBonus ?? 0));
  return { parts, base, total: levelBonus + base + Math.round((base * bonusPct) / 100) };
};

/** What `cow_state.best_stats` holds: the raw statistics the server re-scores the battle from. */
export const cowStatsJson = (stats: CowStats): string =>
  JSON.stringify({
    max_damage: Math.max(0, Math.floor(stats.maxDamage)),
    chain: Math.max(0, Math.floor(stats.chain)),
    effective: Math.max(0, Math.floor(stats.effective)),
    turns: Math.max(0, Math.floor(stats.turns)),
    final_pct: Math.max(0, stats.finalMoralePct),
    gained: Math.max(0, Math.floor(stats.moraleGained)),
    scale: Math.max(1, Math.floor(stats.moraleScale) || 10_000),
  });
