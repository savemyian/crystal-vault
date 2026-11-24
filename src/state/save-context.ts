import { createContext, useContext } from "react";
import type {
  AutoplayOptions,
  AutoplayOutcome,
  Catalog,
  LoadoutKind,
  MailRow,
  TeamDeck,
  UnitLoadout,
  ChangeEntry,
  InventoryCategory,
  InventoryRow,
  ItemWorldState,
  MissionRow,
  SaveSummary,
  SaveUser,
  SideMissionRow,
  UnitGroup,
  VisionCardGroup,
} from "@/lib/ffbe/types";
import type { ItemMeta } from "@/lib/ffbe/meta";

export type SaveStatus = "idle" | "loading" | "ready" | "error";

export interface SaveStore {
  status: SaveStatus;
  error: string | null;
  fileName: string | null;
  isDemo: boolean;
  loadingLabel: string | null;
  users: SaveUser[];
  activeUser: SaveUser | null;
  activeUserId: string | null;
  summary: SaveSummary;
  catalog: Catalog;
  catalogSource: string | null;
  catalogCount: number;
  changes: ChangeEntry[];
  version: number;
  openFile: (file: File) => Promise<void>;
  /** accepts save.zip, a .db, or save.db together with save.db-wal */
  openFiles: (files: File[]) => Promise<void>;
  openDemo: () => Promise<void>;
  reset: () => void;
  close: () => void;
  selectUser: (userId: string) => void;
  updateUser: (patch: {
    gil?: number;
    lapis?: number;
    energy?: number;
    rank?: number;
    name?: string;
  }) => void;
  readVisionCards: () => VisionCardGroup[];
  addVisionCard: (cardId: string, copies: number) => void;
  setVisionCardCopies: (cardId: string, copies: number) => void;
  setVisionCardLevel: (cardId: string, level: number) => void;
  /** seeds names for every vision card from the unit catalogue */
  nameVisionCards: () => number;
  readInventory: (category: InventoryCategory) => InventoryRow[];
  /** gear bound to one unit row inside one deck (party_type + deck_no) */
  readLoadout: (
    unitRowId: number,
    partyType: number,
    deckNo: number,
  ) => UnitLoadout | null;
  readLoadouts: () => UnitLoadout[];
  setLoadoutSlot: (
    unitRowId: number,
    partyType: number,
    deckNo: number,
    kind: LoadoutKind,
    slot: number,
    itemId: string,
  ) => void;
  /** every stored party: the active one plus the saved decks */
  readTeams: () => TeamDeck[];
  setTeamSlot: (
    deckKey: string,
    position: number,
    unitRowId: number | null,
  ) => void;
  renameDeck: (deckKey: string, name: string) => void;
  readMails: () => MailRow[];
  setMailDeleted: (ids: number[], deleted: boolean) => void;
  setInventoryCount: (
    category: InventoryCategory,
    itemId: string,
    count: number,
  ) => void;
  addInventory: (
    category: InventoryCategory,
    itemId: string,
    count: number,
  ) => void;
  adjustInventory: (
    category: InventoryCategory,
    mode: "multiply" | "set" | "add",
    value: number,
  ) => void;
  readUnitGroups: () => UnitGroup[];
  addUnits: (input: {
    unitId: string;
    level: number;
    rarity: number;
    lb: number;
    awake: number;
    copies: number;
  }) => void;
  removeUnitCopies: (unitId: string, copies: number) => void;
  removeAllUnitCopies: (unitId: string) => void;
  updateUnitGroup: (
    unitId: string,
    patch: {
      level?: number;
      rarity?: number;
      lb?: number;
      awake?: number;
    },
  ) => void;
  readMissions: () => MissionRow[];
  readSideMissions: () => SideMissionRow[];
  simulateStoryRun: (orderedMissionIds: number[]) => void;
  clearMissions: (ids: number[]) => void;
  resetMissions: (ids: number[]) => void;
  readSwitches: () => string[];
  grantStorySwitches: (missionIds?: number[]) => void;
  readStorySwitchState: () => { granted: number; total: number };
  grantMapGates: () => void;
  readMapGateState: () => { granted: number; total: number };
  grantAllSwitches: () => void;
  readAllSwitchState: () => { granted: number; total: number };
  grantAllEspers: () => void;
  readEsperState: () => { owned: number; total: number };
  claimSideMissions: () => void;
  exportSave: () => { bytes: Uint8Array; name: string; integrity: string };
  importCatalog: (text: string, sourceName: string) => void;
  clearCatalog: () => void;
  nameFor: (bucket: keyof Catalog, id: string) => string | null;
  /** master metadata (type, slot, rarity) for an id, when the datamine knows it */
  metaFor: (bucket: keyof Catalog, id: string) => ItemMeta | null;
  /** labels an id the shipped catalogue does not know, kept in the browser */
  nameItem: (bucket: keyof Catalog, id: string, name: string) => void;
  /** replays runs into the save without playing them */
  runAutoplay: (options: AutoplayOptions) => AutoplayOutcome;
  /** the stage objectives (stars) the client's challenge master lists */
  readObjectives: (missionId: number) => { slot: number; name: string }[];
  /** stage ids that ship a drop table and can be replayed with full payout */
  readRewardStages: () => string[];
  /** the gil and drop entries a stage pays per clear, null when it ships no table */
  readStageReward: (missionId: number) => { gil: number; entries: number } | null;
  /** rows the autoplay panel can add points to */
  readPointTargets: () => {
    waves: { key: string; points: number }[];
    raidAreas: { key: string; points: number }[];
    raidDungeons: { key: string; damage: number; clears: number }[];
    raidClears: number;
  };
  /** enhanced equipment, its learned EX abilities and the Item World counters */
  readItemWorld: () => ItemWorldState;
  /** replaces the learned EX abilities of one enhanced item */
  setItemWorldEx: (customId: number, tokens: string[]) => void;
  /** restores the ability set the item held before its last dive */
  restoreItemWorldBefore: (customId: number) => void;
  /** copies one item's learned abilities onto another */
  copyItemWorldEx: (fromCustomId: number, toCustomId: number) => void;
  /** creates a new `custom_equip` row and optionally adds the item to stock */
  createItemWorldEquip: (
    baseItemId: string,
    tokens: string[],
    stockCount?: number,
  ) => number | null;
  /** writes an Item World counter (`eg_orb` or `eg_points`) */
  setItemWorldValue: (key: "orbs" | "points", value: number) => void;
  /** steps back one table snapshot taken before the last edit */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  /** full shipped catalogue of a bucket, filtered by id or name */
  searchCatalog: (
    bucket: keyof Catalog,
    query: string,
    limit?: number,
  ) => { id: string; name: string }[];
}

export const SaveContext = createContext<SaveStore | null>(null);

export const useSave = (): SaveStore => {
  const store = useContext(SaveContext);
  if (!store) throw new Error("useSave must be used inside SaveProvider");
  return store;
};
