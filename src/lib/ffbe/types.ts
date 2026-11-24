export type InventoryCategory = "item" | "equip" | "materia" | "important";

export interface SaveUser {
  user_id: string;
  name: string;
  rank: number;
  gil: number;
  lapis: number;
  energy: number;
  tutorial_done: number;
}

export interface InventoryRow {
  item_id: string;
  count: number;
}

export interface UnitRow {
  id: number;
  unit_id: string;
  level: number;
  exp: number;
  rarity: number;
  lb: number;
  awake: number;
  tmr: number;
  stmr: number;
  nv_ex_lv: number;
  master_card: number;
  limit_ex_lv: number;
  warehouse: number;
}

export interface UnitGroup {
  unit_id: string;
  copies: number;
  bestLevel: number;
  bestRarity: number;
  bestLb: number;
  bestAwake: number;
  ids: number[];
}

export interface MissionRow {
  mission_id: number;
  status: number;
  clears: number;
  first_clear_at: string | null;
}

export interface SideMissionRow {
  mission_id: string;
  progress: number;
  cleared_at: number | null;
  claimed_at: number | null;
}

export interface SaveSummary {
  items: number;
  equip: number;
  materia: number;
  important: number;
  units: number;
  distinctUnits: number;
  vision: number;
  missions: number;
  sideMissions: number;
  challenges: number;
  mails: number;
}

export interface VisionCardGroup {
  card_id: string;
  copies: number;
  level: number;
  exp: number;
  locked: number;
}

/**
 * One equipment enhanced in the Item World. The save stores no numeric stats
 * for it: the bonus is the list of learned EX abilities in `ex_learn`, and the
 * client resolves their stat values from its ability master.
 */
export interface ItemWorldEquip {
  customId: number;
  baseItemId: string;
  /** learned abilities, as stored, e.g. `24:108117` */
  exLearn: string[];
  /** the set the item had before the last run, used by the revert option */
  beforeExLearn: string[];
  createdAt: number | null;
  /** copies of the base item in `equip_stock` */
  stock: number;
}

export interface ItemWorldClaim {
  rewardId: string;
  claimedAt: number | null;
}

export interface ItemWorldRun {
  customId: number | null;
  baseItemId: string | null;
  floor: number;
  phase: string | null;
}

export interface ItemWorldState {
  orbs: number | null;
  points: number | null;
  week: number | null;
  selected: string | null;
  customSeq: number | null;
  equips: ItemWorldEquip[];
  claims: ItemWorldClaim[];
  /** an unfinished dive, when the save has one */
  activeRun: ItemWorldRun | null;
}

export type LoadoutKind = "equip" | "materia";

export interface UnitLoadout {
  partyType: number;
  deckNo: number;
  unitRowId: number;
  equip: string[];
  materia: string[];
  vision: string;
  skin: string;
}

export interface TeamSlot {
  position: number;
  unitRowId: number | null;
}

export interface TeamDeck {
  key: string;
  label: string;
  name: string;
  slots: TeamSlot[];
}

export interface MailRow {
  mail_id: number;
  title: string;
  message: string;
  sent_at: number;
  received_at: number | null;
  deleted: number;
  source: string;
  grants: string;
}

import type { CowStats, ParadeStats } from "./score";

export interface AutoplayOptions {
  missionIds: number[];
  runs: number;
  energyPerRun: number;
  grantDrops: boolean;
  recordAttempts: boolean;
  pointTarget?: {
    kind: "wave" | "raidArea" | "raidClears";
    key: string;
    perRun: number;
  };
  /** how many objective stars a simulated clear fills in (0 keeps them empty) */
  stars: 0 | 3 | 4;
  /** mission id → objective slots to fill, when the objective list is known */
  objectives?: Record<string, number[]>;
  /** ranking modes: raid damage, Dark Visions / World of Vision, Clash of Wills */
  scoreTarget?: ScoreTarget;
  /** the party rows a run is fought with, for trust mastery */
  partyUnitIds?: number[];
  /** trust mastery per clear, in percent (0 disables it) */
  tmrPerClear?: number;
  /** the party's bonus for the running raid/event, in percent of the points */
  bonusPct?: number;
}

/**
 * Each score attack keeps its own criteria — the numbers its result screen
 * grades — so the editor asks for those, not for a score to write down.
 */
export type ScoreTarget =
  | { kind: "raid"; damage: number; dungeonId: string }
  | {
      kind: "parade";
      /** the six radar axes of parade_score.py */
      stats: ParadeStats;
      /** clear points of the stage: first, next or final of its dungeon */
      clearPoints: number;
    }
  | {
      kind: "cow";
      stats: CowStats;
      level: number;
      levelBonus: number;
      bonusPct: number;
      rating: string;
    };

export interface AutoplayOutcome {
  missions: number;
  runs: number;
  stars: number;
  gil: number;
  items: number;
  points: number;
  energySpent: number;
  attemptsLogged: number;
  score: number;
  /** map switches a clear turned on, the side quests it completed included */
  unlocks: number;
  /** treasure chests opened by the exploration maps of the stage */
  chests: number;
  /** trust mastery advanced, in percent of the gauge */
  tmr: number;
  /** reward mails written: first clears and the stars they won */
  rewards: number;
  /** what each stage of the queue paid, for the run log */
  stages: {
    missionId: number;
    runs: number;
    stars: number;
    gil: number;
    items: number;
    chests: number;
    /** reward mails this stage produced */
    rewards: number;
    /** false when the stage was already cleared before this run */
    cleared: boolean;
  }[];
}

export interface ChangeEntry {
  id: number;
  at: number;
  label: string;
  detail: string;
}

export interface Catalog {
  items: Record<string, string>;
  equip: Record<string, string>;
  materia: Record<string, string>;
  important: Record<string, string>;
  units: Record<string, string>;
  missions: Record<string, string>;
  vision: Record<string, string>;
}

export const emptyCatalog = (): Catalog => ({
  items: {},
  equip: {},
  materia: {},
  important: {},
  units: {},
  missions: {},
  vision: {},
});

export const catalogSize = (catalog: Catalog) =>
  Object.keys(catalog.items).length +
  Object.keys(catalog.equip).length +
  Object.keys(catalog.materia).length +
  Object.keys(catalog.important).length +
  Object.keys(catalog.units).length +
  Object.keys(catalog.missions).length +
  Object.keys(catalog.vision).length;
