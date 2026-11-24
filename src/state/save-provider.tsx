import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Database } from "sql.js";
import { toast } from "sonner";
import { all, first, hasTable, integrityCheck, openSave, run, scalar } from "@/lib/ffbe/sql";
import {
  clearStoredCatalog,
  loadBuiltinCatalog,
  loadStoredCatalog,
  parseCatalog,
  storeCatalog,
} from "@/lib/ffbe/catalog";
import { nowEpoch } from "@/lib/ffbe/format";
import {
  parseMembers,
  parseSlots,
  writeMembers,
  writeSlot,
} from "@/lib/ffbe/loadout";
import { withPrivateEquip } from "@/lib/ffbe/private-equip";
import { buildVisionNames } from "@/lib/ffbe/vision-names";
import { withServerNames } from "@/lib/ffbe/server-names";
import { loadMeta, metaFor, type ItemMeta } from "@/lib/ffbe/meta";
import { loadObjectives, objectivesFor } from "@/lib/ffbe/objectives";
import {
  allMapGateSwitches,
  loadMapGates,
  type MapGateMap,
} from "@/lib/ffbe/map-gates";
import { loadAllSwitches } from "@/lib/ffbe/all-switches";
import {
  esperUnlockSwitches,
  loadEspers,
  type EsperList,
} from "@/lib/ffbe/espers";
import { cowScore, cowStatsJson, paradeScore, paradeValues } from "@/lib/ffbe/score";
import { loadMapEvents, switchesFromEvents, type MapEventMap } from "@/lib/ffbe/map-events";
import { loadFieldLoot, rollHarvest, type FieldLoot } from "@/lib/ffbe/field-loot";
import {
  loadEventRewards,
  loadStageRewards,
  rollDrops,
  type StageRewardMap,
} from "@/lib/ffbe/stage-rewards";
import { loadClearSwitches } from "@/lib/ffbe/clear-switches";
import {
  clearReward,
  loadClearRewards,
  starReward,
  type ClearRewardMap,
  type Reward,
} from "@/lib/ffbe/clear-rewards";
import {
  formatExLearn,
  normalizeExLearn,
  parseExLearn,
} from "@/lib/ffbe/item-world";
import { readSaveFiles } from "@/lib/ffbe/save-package";
import {
  allStorySwitches,
  loadStorySwitches,
  switchesForMissions,
  type StorySwitchMap,
} from "@/lib/ffbe/story-switches";
import {
  catalogSize,
  emptyCatalog,
  type Catalog,
  type ChangeEntry,
  type InventoryCategory,
  type InventoryRow,
  type ItemWorldState,
  type AutoplayOptions,
  type AutoplayOutcome,
  type LoadoutKind,
  type MailRow,
  type MissionRow,
  type SaveSummary,
  type SaveUser,
  type SideMissionRow,
  type TeamDeck,
  type TeamSlot,
  type UnitGroup,
  type UnitLoadout,
  type VisionCardGroup,
} from "@/lib/ffbe/types";
import { SaveContext, type SaveStatus, type SaveStore } from "./save-context";

const TABLES: Record<InventoryCategory, string> = {
  item: "item",
  equip: "equip_stock",
  materia: "materia_stock",
  important: "important_item",
};

const LABELS: Record<InventoryCategory, string> = {
  item: "Items",
  equip: "Equipment",
  materia: "Materia",
  important: "Important items",
};

const emptySummary = (): SaveSummary => ({
  items: 0,
  equip: 0,
  materia: 0,
  important: 0,
  units: 0,
  distinctUnits: 0,
  vision: 0,
  missions: 0,
  sideMissions: 0,
  challenges: 0,
  mails: 0,
});

const mergeCatalog = (base: Catalog, extra: Catalog): Catalog => ({
  items: { ...base.items, ...extra.items },
  equip: { ...base.equip, ...extra.equip },
  materia: { ...base.materia, ...extra.materia },
  important: { ...base.important, ...extra.important },
  units: { ...base.units, ...extra.units },
  missions: { ...base.missions, ...extra.missions },
  // official card names shipped with the editor win over unit-derived labels
  vision: { ...extra.vision, ...base.vision },
});

interface TableRows {
  columns: string[];
  rows: unknown[][];
}

interface UndoEntry {
  label: string;
  detail: string;
  rows: Record<string, TableRows>;
}

/**
 * Undo works on whole-table snapshots of the active account. Every table an
 * edit can touch is small (the largest, `mail`, is a few thousand rows), so a
 * snapshot is cheaper and far safer than hand-written inverse SQL.
 */
const captureTables = (
  db: Database,
  userId: string,
  tables: string[],
): Record<string, TableRows> => {
  const snapshot: Record<string, TableRows> = {};
  for (const table of tables) {
    if (!hasTable(db, table)) continue;
    const columns = all<{ name: string }>(db, `PRAGMA table_info(${table})`).map(
      (column) => column.name,
    );
    const rows = all<Record<string, unknown>>(
      db,
      `SELECT * FROM ${table} WHERE user_id = ?`,
      [userId],
    );
    snapshot[table] = {
      columns,
      rows: rows.map((row) => columns.map((column) => row[column])),
    };
  }
  return snapshot;
};

const restoreTables = (
  db: Database,
  userId: string,
  snapshot: Record<string, TableRows>,
) => {
  for (const [table, content] of Object.entries(snapshot)) {
    run(db, `DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    if (content.rows.length === 0 || content.columns.length === 0) continue;
    const placeholders = content.columns.map(() => "?").join(", ");
    const sql = `INSERT OR REPLACE INTO ${table} (${content.columns.join(", ")}) VALUES (${placeholders})`;
    for (const row of content.rows) run(db, sql, row);
  }
};

const summarize = (db: Database, userId: string): SaveSummary => {
  const count = (sql: string) => {
    const value = scalar(db, sql, [userId]);
    return typeof value === "number" ? value : Number(value ?? 0);
  };

  return {
    items: count("SELECT COUNT(*) FROM item WHERE user_id = ?"),
    equip: count("SELECT COUNT(*) FROM equip_stock WHERE user_id = ?"),
    materia: count("SELECT COUNT(*) FROM materia_stock WHERE user_id = ?"),
    important: count("SELECT COUNT(*) FROM important_item WHERE user_id = ?"),
    units: count("SELECT COUNT(*) FROM unit WHERE user_id = ?"),
    distinctUnits: count("SELECT COUNT(DISTINCT unit_id) FROM unit WHERE user_id = ?"),
    vision: count("SELECT COUNT(*) FROM vision_card WHERE user_id = ?"),
    missions: count("SELECT COUNT(*) FROM mission_progress WHERE user_id = ?"),
    sideMissions: count("SELECT COUNT(*) FROM sp_mission WHERE user_id = ?"),
    challenges: count("SELECT COUNT(*) FROM challenge_progress WHERE user_id = ?"),
    mails: count("SELECT COUNT(*) FROM mail WHERE user_id = ?"),
  };
};

const SWITCH_KEY = "switches";

/**
 * The three objective stars on a stage card are `challenge_progress` rows whose
 * challenge id is `mission_id * 10 + n`. Marking a mission cleared alone leaves
 * them empty, so every clear writes them too.
 */
/**
 * How many stars a stage can hold: the challenge master's own rows for it, and
 * none at all for a scene stage. A story scene (`Visitors from Beyond`, a
 * cutscene between two nodes) carries no challenge, so writing stars for it
 * invents rows the client never draws.
 */
const stageSlots = (
  missionId: number,
  wanted: number,
  known: number,
  hasBattle: boolean,
): number => {
  if (known > 0) return Math.min(wanted, known);
  return hasBattle ? wanted : 0;
};

const awardChallenges = (
  db: Database,
  userId: string,
  missionId: number,
  achievedAt: string,
  slots = 4,
): number[] => {
  if (!hasTable(db, "challenge_progress")) return [];
  const added: number[] = [];
  for (let slot = 0; slot < slots; slot += 1) {
    const challengeId = missionId * 10 + slot;
    const existing = first(
      db,
      "SELECT 1 FROM challenge_progress WHERE user_id = ? AND mission_id = ? AND challenge_id = ?",
      [userId, missionId, challengeId],
    );
    if (existing) continue;
    run(
      db,
      `INSERT INTO challenge_progress
         (user_id, mission_id, challenge_id, achieved_at)
       VALUES (?, ?, ?, ?)`,
      [userId, missionId, challengeId, achievedAt],
    );
    added.push(slot);
  }
  return added;
};

/** `user_kv['switches']` holds the unlock ids the client checks for the world map. */
const readSwitchList = (db: Database, userId: string): string[] => {
  if (!hasTable(db, "user_kv")) return [];
  const row = first<{ value: string | null }>(
    db,
    "SELECT value FROM user_kv WHERE user_id = ? AND key = ?",
    [userId, SWITCH_KEY],
  );
  const raw = row?.value;
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const writeSwitchList = (db: Database, userId: string, values: string[]): void => {  if (!hasTable(db, "user_kv")) return;
  const unique = Array.from(new Set(values)).sort(
    (left, right) => Number(left) - Number(right),
  );
  run(
    db,
    `INSERT INTO user_kv (user_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, SWITCH_KEY, unique.join(",")],
  );
};

export const SaveProvider = ({ children }: { children: ReactNode }) => {
  const dbRef = useRef<Database | null>(null);
  const originalRef = useRef<Uint8Array | null>(null);

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [users, setUsers] = useState<SaveUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [version, setVersion] = useState(0);
  const [storedCatalog, setStoredCatalog] = useState<Catalog>(
    () => loadStoredCatalog() ?? emptyCatalog(),
  );
  const [builtinCatalog, setBuiltinCatalog] = useState<Catalog | null>(null);
  const [meta, setMeta] = useState<Parameters<typeof metaFor>[0]>(null);
  const [storySwitches, setStorySwitches] = useState<StorySwitchMap | null>(null);
  const [mapGates, setMapGates] = useState<MapGateMap | null>(null);
  const [mapEvents, setMapEvents] = useState<MapEventMap | null>(null);
  const [fieldLoot, setFieldLoot] = useState<FieldLoot | null>(null);
  const [allSwitches, setAllSwitches] = useState<string[] | null>(null);
  const [stageRewards, setStageRewards] = useState<StageRewardMap | null>(null);
  const [eventRewards, setEventRewards] = useState<StageRewardMap | null>(null);
  const [clearSwitches, setClearSwitches] = useState<string[] | null>(null);
  const [clearRewards, setClearRewards] = useState<ClearRewardMap | null>(null);
  const [espList, setEspList] = useState<EsperList | null>(null);
  const [userSource, setUserSource] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<Awaited<ReturnType<typeof loadObjectives>>>(null);
  const changeId = useRef(1);
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  useEffect(() => {
    let alive = true;
    loadStorySwitches().then((map) => {
      if (alive && map) setStorySwitches(map);
    });
    loadMapGates().then((map) => {
      if (alive && map) setMapGates(map);
    });
    loadMapEvents().then((map) => {
      if (alive && map) setMapEvents(map);
    });
    loadFieldLoot().then((map) => {
      if (alive && map) setFieldLoot(map);
    });
    loadAllSwitches().then((list) => {
      if (alive && list) setAllSwitches(list);
    });
    loadStageRewards().then((map) => {
      if (alive && map) setStageRewards(map);
    });
    loadEventRewards().then((map) => {
      if (alive && map) setEventRewards(map);
    });
    loadClearSwitches().then((list) => {
      if (alive && list) setClearSwitches(list);
    });
    loadClearRewards().then((map) => {
      if (alive && map) setClearRewards(map);
    });
    loadEspers().then((list) => {
      if (alive && list) setEspList(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadBuiltinCatalog().then((names) => {
      if (alive && names) setBuiltinCatalog(names);
    });
    loadMeta().then((value) => {
      if (alive && value) setMeta(value);
    });
    loadObjectives().then((value) => {
      if (alive && value) setObjectives(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const catalog = useMemo(
    () =>
      withServerNames(
        withPrivateEquip(
          builtinCatalog
            ? mergeCatalog(builtinCatalog, storedCatalog)
            : storedCatalog,
        ),
      ),
    [builtinCatalog, storedCatalog],
  );
  const catalogCount = useMemo(() => catalogSize(catalog), [catalog]);

  const activeUser = users.find((user) => user.user_id === activeUserId) ?? null;

  const summary = useMemo(() => {
    const db = dbRef.current;
    if (!db || !activeUserId) return emptySummary();
    try {
      return summarize(db, activeUserId);
    } catch {
      return emptySummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, activeUserId, status]);

  const applyBytes = async (
    bytes: Uint8Array,
    name: string,
    demo: boolean,
  ) => {
    const next = await openSave(bytes);
    try {
      if (!hasTable(next, "user") || !hasTable(next, "item")) {
        throw new Error(
          "That file does not look like an FFBE save — its account tables are missing.",
        );
      }
      const rows = all<SaveUser>(
        next,
        "SELECT user_id, name, rank, gil, lapis, energy, tutorial_done FROM user",
      );
      if (rows.length === 0) {
        throw new Error("This save has no account rows to edit.");
      }
      const activeSetting = first<{ value: string }>(
        next,
        "SELECT value FROM server_setting WHERE key = 'active_user'",
      );
      const preferred =
        rows.find((row) => row.user_id === activeSetting?.value) ?? rows[0];

      dbRef.current?.close();
      dbRef.current = next;
      originalRef.current = bytes;
      setFileName(name);
      setIsDemo(demo);
      setUsers(rows);
      setActiveUserId(preferred.user_id);
      setChanges([]);
      setError(null);
      setStatus("ready");
      setVersion((value) => value + 1);
    } catch (caught) {
      next.close();
      throw caught;
    }
  };

  const openFiles = async (files: File[]) => {
    setError(null);
    if (files.length === 0) return;
    setLoadingLabel(
      files.length === 1 ? `Reading ${files[0].name}` : `Reading ${files.length} files`,
    );
    setStatus("loading");
    try {
      const payloads = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })),
      );
      const loaded = readSaveFiles(payloads);
      setLoadingLabel("Opening the save");
      await applyBytes(loaded.bytes, loaded.name, false);
      toast.success(
        loaded.mergedWal
          ? `Loaded ${loaded.name} — ${loaded.walPages} WAL page(s) merged`
          : `Loaded ${loaded.name}`,
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "That file could not be opened.";
      setError(message);
      setStatus("error");
    } finally {
      setLoadingLabel(null);
    }
  };

  const openFile = (file: File) => openFiles([file]);

  const openDemo = async () => {
    setError(null);
    setLoadingLabel("Opening the sample save");
    setStatus("loading");
    try {
      const base = import.meta.env.BASE_URL ?? "/";
      const response = await fetch(`${base}demo-save.db`);
      if (!response.ok) throw new Error("The sample save could not be loaded.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      await applyBytes(bytes, "demo-save.db", true);
      try {
        const catalogResponse = await fetch(`${base}demo-catalog.json`);
        if (catalogResponse.ok) {
          const demoCatalog = parseCatalog(await catalogResponse.text());
          setStoredCatalog((current) => mergeCatalog(current, demoCatalog));
          setUserSource("Sample names");
        }
      } catch {
        // Names are optional for the sample.
      }
      setVersion((value) => value + 1);
      toast.success("Sample save loaded");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "The sample save failed to open.";
      setError(message);
      setStatus("error");
    } finally {
      setLoadingLabel(null);
    }
  };

  const close = () => {
    dbRef.current?.close();
    dbRef.current = null;
    originalRef.current = null;
    setUsers([]);
    setActiveUserId(null);
    setChanges([]);
    setFileName(null);
    setIsDemo(false);
    setError(null);
    setStatus("idle");
  };

  const reset = async () => {
    const original = originalRef.current;
    if (!original || !fileName) return;
    try {
      await applyBytes(original, fileName, isDemo);
      toast.success("All edits discarded");
    } catch {
      toast.error("Could not restore the original file");
    }
  };

  const syncUndoDepth = () => {
    setUndoDepth(undoStack.current.length);
    setRedoDepth(redoStack.current.length);
  };

  const mutate = (
    label: string,
    detail: string,
    action: (db: Database, userId: string) => void,
    tables: string[] = [],
  ) => {
    const db = dbRef.current;
    const userId = activeUserId;
    if (!db || !userId) return;
    try {
      const before = tables.length ? captureTables(db, userId, tables) : null;
      action(db, userId);
      if (before) {
        const captured = Object.values(before).reduce(
          (total, table) => total + table.rows.length,
          0,
        );
        // A mail-sized table would eat memory across many steps, so keep a much
        // shorter history for the few large tables.
        const depth = captured > 2000 ? 3 : 25;
        undoStack.current = [
          ...undoStack.current.slice(-(depth - 1)),
          { label, detail, rows: before },
        ];
        redoStack.current = [];
        syncUndoDepth();
      }
      setChanges((previous) => [
        ...previous.slice(-199),
        { id: changeId.current++, at: Date.now(), label, detail },
      ]);
      setVersion((value) => value + 1);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "That edit was not applied.",
      );
    }
  };

  const stepBack = (direction: "undo" | "redo") => {
    const db = dbRef.current;
    const userId = activeUserId;
    if (!db || !userId) return;
    const from = direction === "undo" ? undoStack.current : redoStack.current;
    const to = direction === "undo" ? redoStack.current : undoStack.current;
    const entry = from.pop();
    if (!entry) {
      toast.message(direction === "undo" ? "Nothing left to undo" : "Nothing to redo");
      return;
    }
    const current = captureTables(db, userId, Object.keys(entry.rows));
    restoreTables(db, userId, entry.rows);
    to.push({ ...entry, rows: current });
    syncUndoDepth();
    setChanges((previous) => [
      ...previous.slice(-199),
      {
        id: changeId.current++,
        at: Date.now(),
        label: direction === "undo" ? "Undo" : "Redo",
        detail: entry.detail,
      },
    ]);
    setVersion((value) => value + 1);
  };

  const readInventory = (category: InventoryCategory): InventoryRow[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    return all<InventoryRow>(
      db,
      `SELECT item_id, count FROM ${TABLES[category]} WHERE user_id = ? ORDER BY count DESC, item_id ASC`,
      [activeUserId],
    );
  };

  const setInventoryCount = (
    category: InventoryCategory,
    itemId: string,
    count: number,
  ) => {
    const table = TABLES[category];
    const safeCount = Math.max(0, Math.min(999999999, Math.floor(count)));
    mutate(
      LABELS[category],
      safeCount === 0
        ? `Removed ${itemId}`
        : `Set ${itemId} to ${safeCount.toLocaleString("en-US")}`,
      (db, userId) => {
        if (safeCount === 0) {
          run(db, `DELETE FROM ${table} WHERE user_id = ? AND item_id = ?`, [
            userId,
            itemId,
          ]);
          return;
        }
        run(
          db,
          `INSERT INTO ${table} (user_id, item_id, count) VALUES (?, ?, ?)
           ON CONFLICT(user_id, item_id) DO UPDATE SET count = excluded.count`,
          [userId, itemId, safeCount],
        );
      },
      [table],
    );
  };

  const addInventory = (
    category: InventoryCategory,
    itemId: string,
    count: number,
  ) => {
    const table = TABLES[category];
    const delta = Math.trunc(count);
    if (delta === 0) return;
    const verb = delta > 0 ? "Added" : "Removed";
    mutate(LABELS[category], `${verb} ${Math.abs(delta)} × ${itemId}`, (db, userId) => {
      if (delta > 0) {
        run(
          db,
          `INSERT INTO ${table} (user_id, item_id, count) VALUES (?, ?, ?)
           ON CONFLICT(user_id, item_id)
           DO UPDATE SET count = MIN(999999999, count + excluded.count)`,
          [userId, itemId, delta],
        );
        return;
      }
      run(
        db,
        `UPDATE ${table} SET count = count + ? WHERE user_id = ? AND item_id = ?`,
        [delta, userId, itemId],
      );
      run(
        db,
        `DELETE FROM ${table} WHERE user_id = ? AND item_id = ? AND count <= 0`,
        [userId, itemId],
      );
    }, [table]);
  };

  const readVisionCards = (): VisionCardGroup[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    return all<VisionCardGroup>(
      db,
      `SELECT CAST(card_id AS TEXT) AS card_id,
              COUNT(*) AS copies,
              MAX(level) AS level,
              MAX(exp) AS exp,
              MAX(locked) AS locked
         FROM vision_card
        WHERE user_id = ?
        GROUP BY card_id
        ORDER BY copies DESC, card_id ASC`,
      [activeUserId],
    );
  };

  const addVisionCard = (cardId: string, copies: number) => {
    const amount = Math.max(1, Math.min(99, Math.floor(copies)));
    mutate("Vision cards", `Added ${amount} × ${cardId}`, (db, userId) => {
      for (let index = 0; index < amount; index += 1) {
        run(
          db,
          `INSERT INTO vision_card (user_id, card_id, level, exp, created_at, locked)
           VALUES (?, ?, 1, 0, ?, 0)`,
          [userId, cardId, nowEpoch()],
        );
      }
    });
  };

  const setVisionCardCopies = (cardId: string, copies: number) => {
    const amount = Math.max(0, Math.min(99, Math.floor(copies)));
    mutate(
      "Vision cards",
      amount === 0
        ? `Removed ${cardId}`
        : `Set ${cardId} to ${amount} copies`,
      (db, userId) => {
        const copies = all<{ id: number }>(
          db,
          `SELECT id FROM vision_card
            WHERE user_id = ? AND card_id = ?
            ORDER BY level ASC, id ASC`,
          [userId, cardId],
        );
        let missing = amount - copies.length;
        while (missing > 0) {
          run(
            db,
            `INSERT INTO vision_card (user_id, card_id, level, exp, created_at, locked)
             VALUES (?, ?, 1, 0, ?, 0)`,
            [userId, cardId, nowEpoch()],
          );
          missing -= 1;
        }
        const surplus = copies.slice(0, Math.max(0, -missing));
        for (const row of surplus) {
          run(db, "DELETE FROM vision_card WHERE id = ?", [row.id]);
        }
      },
    );
  };

  const setVisionCardLevel = (cardId: string, level: number) => {
    const safeLevel = Math.max(1, Math.min(120, Math.floor(level)));
    mutate("Vision cards", `Set ${cardId} to level ${safeLevel}`, (db, userId) => {
      run(
        db,
        "UPDATE vision_card SET level = ? WHERE user_id = ? AND card_id = ?",
        [safeLevel, userId, cardId],
      );
    });
  };

  /** names every vision card from the unit catalogue, returns how many it hit */
  const nameVisionCards = (): number => {
    const groups = readVisionCards();
    const derived = buildVisionNames(
      groups.map((group) => group.card_id),
      catalog.units,
    );
    const missing = Object.entries(derived).filter(
      ([cardId]) => !catalog.vision[cardId],
    );
    if (missing.length === 0) {
      toast.message("Nothing left to name from the unit list");
      return 0;
    }
    setStoredCatalog((current) => {
      const next = {
        ...current,
        vision: { ...current.vision, ...Object.fromEntries(missing) },
      } as Catalog;
      storeCatalog(next);
      return next;
    });
    toast.success(`Named ${missing.length} vision cards from their unit`);
    return missing.length;
  };

  const adjustInventory = (
    category: InventoryCategory,
    mode: "multiply" | "set" | "add",
    value: number,
  ) => {
    const table = TABLES[category];
    if (!Number.isFinite(value)) return;
    const settings = {
      multiply: {
        sql: `UPDATE ${table} SET count = MIN(999999999, MAX(1, count * ?)) WHERE user_id = ?`,
        params: [value],
        label: `Multiplied every ${LABELS[category].toLowerCase()} stack by ${value}`,
      },
      set: {
        sql: `UPDATE ${table} SET count = ? WHERE user_id = ?`,
        params: [Math.max(1, Math.min(999999999, Math.floor(value)))],
        label: `Set every ${LABELS[category].toLowerCase()} stack to ${value}`,
      },
      add: {
        sql: `UPDATE ${table} SET count = MIN(999999999, count + ?) WHERE user_id = ?`,
        params: [Math.floor(value)],
        label: `Added ${value} to every ${LABELS[category].toLowerCase()} stack`,
      },
    }[mode];

    mutate(settings.label, "Bulk change", (db, userId) => {
      run(db, settings.sql, [...settings.params, userId]);
    });
  };

  const readLoadout = (
    unitRowId: number,
    partyType: number,
    deckNo: number,
  ): UnitLoadout | null => {
    const db = dbRef.current;
    if (!db || !activeUserId || !hasTable(db, "unit_equip")) return null;
    const row = first<{
      equip: string;
      materia: string;
      vision: string;
      skin: string;
    }>(
      db,
      `SELECT equip, materia, vision, skin FROM unit_equip
        WHERE user_id = ? AND unit_row_id = ? AND party_type = ? AND deck_no = ?`,
      [activeUserId, unitRowId, partyType, deckNo],
    );
    if (!row) return null;
    return {
      partyType,
      deckNo,
      unitRowId,
      equip: parseSlots(row.equip),
      materia: parseSlots(row.materia),
      vision: parseSlots(row.vision)[0] ?? "",
      skin: String(row.skin ?? "0"),
    };
  };

  const readLoadouts = (): UnitLoadout[] => {
    const db = dbRef.current;
    if (!db || !activeUserId || !hasTable(db, "unit_equip")) return [];
    return all<{
      party_type: number;
      deck_no: number;
      unit_row_id: number;
      equip: string;
      materia: string;
      vision: string;
      skin: string;
    }>(
      db,
      `SELECT party_type, deck_no, unit_row_id, equip, materia, vision, skin
         FROM unit_equip WHERE user_id = ?`,
      [activeUserId],
    ).map((row) => ({
      partyType: Number(row.party_type),
      deckNo: Number(row.deck_no),
      unitRowId: Number(row.unit_row_id),
      equip: parseSlots(row.equip),
      materia: parseSlots(row.materia),
      vision: parseSlots(row.vision)[0] ?? "",
      skin: String(row.skin ?? "0"),
    }));
  };

  const setLoadoutSlot = (
    unitRowId: number,
    partyType: number,
    deckNo: number,
    kind: LoadoutKind,
    slot: number,
    itemId: string,
  ) => {
    const clean = itemId.trim().replace(/\D/g, "").slice(0, 10);
    const value = clean && clean !== "0" ? clean : "0";
    mutate(
      "Gear",
      `Unit ${unitRowId} · deck ${partyType}-${deckNo} · ${kind} ${slot + 1} → ${
        value === "0" ? "empty" : value
      }`,
      (db, userId) => {
        if (!hasTable(db, "unit_equip")) {
          throw new Error("This save has no equipment table.");
        }
        const row = first<{ equip: string; materia: string }>(
          db,
          `SELECT equip, materia FROM unit_equip
            WHERE user_id = ? AND unit_row_id = ? AND party_type = ? AND deck_no = ?`,
          [userId, unitRowId, partyType, deckNo],
        );
        if (!row) {
          run(
            db,
            `INSERT INTO unit_equip
               (user_id, party_type, deck_no, unit_row_id, equip, materia, vision, skin)
             VALUES (?, ?, ?, ?, ?, ?, '', '0')`,
            [
              userId,
              partyType,
              deckNo,
              unitRowId,
              kind === "equip" ? writeSlot("", slot, value) : "",
              kind === "materia" ? writeSlot("", slot, value) : "",
            ],
          );
          return;
        }
        const column = kind === "equip" ? "equip" : "materia";
        const next = writeSlot(
          kind === "equip" ? row.equip : row.materia,
          slot,
          value,
        );
        run(
          db,
          `UPDATE unit_equip SET ${column} = ?
            WHERE user_id = ? AND unit_row_id = ? AND party_type = ? AND deck_no = ?`,
          [next, userId, unitRowId, partyType, deckNo],
        );
      },
      ["unit_equip"],
    );
  };

  const readTeams = (): TeamDeck[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    const slots = (ids: (number | null)[], width: number): TeamSlot[] =>
      Array.from({ length: Math.max(width, ids.length) }, (_, index) => ({
        position: index,
        unitRowId: ids[index] ?? null,
      }));
    const teams: TeamDeck[] = [];

    if (hasTable(db, "party")) {
      const rows = all<{ slot: number; unit_row_id: number }>(
        db,
        "SELECT slot, unit_row_id FROM party WHERE user_id = ? ORDER BY slot",
        [activeUserId],
      );
      const ids: (number | null)[] = [];
      for (const row of rows) ids[Number(row.slot)] = Number(row.unit_row_id) || null;
      teams.push({
        key: "main",
        label: "Active party",
        name: "Active party",
        slots: slots(ids, 5),
      });
    }

    if (hasTable(db, "party_deck")) {
      const rows = all<{ deck_no: number; name: string; members: string }>(
        db,
        "SELECT deck_no, name, members FROM party_deck WHERE user_id = ? ORDER BY deck_no",
        [activeUserId],
      );
      for (const row of rows) {
        const no = Number(row.deck_no);
        teams.push({
          key: `deck:${no}`,
          label: row.name?.trim() ? row.name.trim() : `Deck ${no + 1}`,
          name: row.name ?? "",
          slots: slots(parseMembers(row.members), 5),
        });
      }
    }

    if (hasTable(db, "party_deck_type")) {
      const rows = all<{
        party_type: number;
        deck_no: number;
        name: string;
        members: string;
      }>(
        db,
        `SELECT party_type, deck_no, name, members FROM party_deck_type
          WHERE user_id = ? ORDER BY party_type, deck_no`,
        [activeUserId],
      );
      for (const row of rows) {
        const type = Number(row.party_type);
        const no = Number(row.deck_no);
        teams.push({
          key: `type:${type}:${no}`,
          label: row.name?.trim() ? row.name.trim() : `Type ${type} deck ${no + 1}`,
          name: row.name ?? "",
          slots: slots(parseMembers(row.members), 2),
        });
      }
    }

    return teams;
  };

  const setTeamSlot = (
    deckKey: string,
    position: number,
    unitRowId: number | null,
  ) => {
    const [kind, a, b] = deckKey.split(":");
    mutate(
      "Teams",
      `Slot ${position + 1} → ${unitRowId ?? "empty"}`,
      (db, userId) => {
        if (kind === "main") {
          const existing = first<{ slot: number }>(
            db,
            "SELECT slot FROM party WHERE user_id = ? AND slot = ?",
            [userId, position],
          );
          if (!existing) {
            if (unitRowId === null) return;
            run(db, "INSERT INTO party (user_id, slot, unit_row_id) VALUES (?, ?, ?)", [
              userId,
              position,
              unitRowId,
            ]);
            return;
          }
          if (unitRowId === null) {
            run(db, "DELETE FROM party WHERE user_id = ? AND slot = ?", [
              userId,
              position,
            ]);
            return;
          }
          run(db, "UPDATE party SET unit_row_id = ? WHERE user_id = ? AND slot = ?", [
            unitRowId,
            userId,
            position,
          ]);
          return;
        }

        const table = kind === "type" ? "party_deck_type" : "party_deck";
        const deckNo = Number(kind === "type" ? b : a);
        const filter =
          kind === "type"
            ? "user_id = ? AND party_type = ? AND deck_no = ?"
            : "user_id = ? AND deck_no = ?";
        const params = kind === "type" ? [userId, Number(a), deckNo] : [userId, deckNo];
        const row = first<{ members: string }>(
          db,
          `SELECT members FROM ${table} WHERE ${filter}`,
          params,
        );
        if (!row) throw new Error("That deck is not in this save.");
        run(db, `UPDATE ${table} SET members = ? WHERE ${filter}`, [
          writeMembers(row.members, position, unitRowId),
          ...params,
        ]);
      },
      ["party", "party_deck", "party_deck_type"],
    );
  };

  const renameDeck = (deckKey: string, name: string) => {
    const [kind, a, b] = deckKey.split(":");
    if (kind === "main") {
      toast.message("The active party has no stored name");
      return;
    }
    const table = kind === "type" ? "party_deck_type" : "party_deck";
    const deckNo = Number(kind === "type" ? b : a);
    mutate(
      "Teams",
      `Renamed deck to "${name}"`,
      (db, userId) => {
        if (kind === "type") {
          run(
            db,
            "UPDATE party_deck_type SET name = ? WHERE user_id = ? AND party_type = ? AND deck_no = ?",
            [name, userId, Number(a), deckNo],
          );
          return;
        }
        run(db, "UPDATE party_deck SET name = ? WHERE user_id = ? AND deck_no = ?", [
          name,
          userId,
          deckNo,
        ]);
      },
      ["party_deck", "party_deck_type"],
    );
  };

  const readMails = (): MailRow[] => {
    const db = dbRef.current;
    if (!db || !activeUserId || !hasTable(db, "mail")) return [];
    return all<MailRow>(
      db,
      `SELECT mail_id, title, message, sent_at, received_at, deleted, source, grants
         FROM mail WHERE user_id = ? ORDER BY mail_id DESC`,
      [activeUserId],
    );
  };

  const setMailDeleted = (ids: number[], deleted: boolean) => {
    if (ids.length === 0) return;
    mutate(
      "Mail",
      `${deleted ? "Deleted" : "Restored"} ${ids.length} message${ids.length === 1 ? "" : "s"}`,
      (db, userId) => {
        const placeholders = ids.map(() => "?").join(", ");
        run(
          db,
          `UPDATE mail SET deleted = ? WHERE user_id = ? AND mail_id IN (${placeholders})`,
          [deleted ? 1 : 0, userId, ...ids],
        );
      },
      ["mail"],
    );
  };

  const readUnitGroups = (): UnitGroup[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    const rows = all<{
      unit_id: string;
      copies: number;
      best_level: number;
      best_rarity: number;
      best_lb: number;
      best_awake: number;
      ids: string;
    }>(
      db,
      `SELECT unit_id,
              COUNT(*) AS copies,
              MAX(level) AS best_level,
              MAX(rarity) AS best_rarity,
              MAX(lb) AS best_lb,
              MAX(awake) AS best_awake,
              GROUP_CONCAT(id) AS ids
         FROM unit
        WHERE user_id = ?
        GROUP BY unit_id
        ORDER BY best_rarity DESC, best_level DESC, copies DESC`,
      [activeUserId],
    );
    return rows.map((row) => ({
      unit_id: row.unit_id,
      copies: Number(row.copies),
      bestLevel: Number(row.best_level),
      bestRarity: Number(row.best_rarity),
      bestLb: Number(row.best_lb),
      bestAwake: Number(row.best_awake),
      ids: String(row.ids ?? "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id)),
    }));
  };

  const addUnits = (input: {
    unitId: string;
    level: number;
    rarity: number;
    lb: number;
    awake: number;
    copies: number;
  }) => {
    const copies = Math.max(1, Math.min(999, Math.floor(input.copies)));
    mutate("Units", `Added ${copies} × unit ${input.unitId}`, (db, userId) => {
      for (let index = 0; index < copies; index += 1) {
        run(
          db,
          `INSERT INTO unit
             (user_id, unit_id, level, exp, rarity, lb, awake, extra, tmr, stmr,
              lb_exp, doping, limit_ex, trust_info, nv_ex_lv, unique_ex_lv,
              master_card, limit_ex_lv, warehouse)
           VALUES (?, ?, ?, 0, ?, ?, ?, '{}', 0, 0, 0, '0,0,0,0,0,0',
                   '0,0,0,0,0,0', '', 0, 0, 0, 0, 0)`,
          [
            userId,
            input.unitId,
            Math.max(1, Math.floor(input.level)),
            Math.max(0, Math.floor(input.rarity)),
            Math.max(0, Math.floor(input.lb)),
            Math.max(0, Math.floor(input.awake)),
          ],
        );
      }
    }, ["unit"]);
  };

  const removeUnitCopies = (unitId: string, copies: number) => {
    const limit = Math.max(1, Math.floor(copies));
    mutate("Units", `Removed ${limit} × unit ${unitId}`, (db, userId) => {
      const rows = all<{ id: number }>(
        db,
        `SELECT id FROM unit WHERE user_id = ? AND unit_id = ?
          ORDER BY level ASC, id ASC LIMIT ?`,
        [userId, unitId, limit],
      );
      for (const row of rows) {
        run(db, "DELETE FROM unit WHERE id = ?", [row.id]);
        run(db, "DELETE FROM unit_equip WHERE user_id = ? AND unit_row_id = ?", [
          userId,
          row.id,
        ]);
        run(db, "DELETE FROM party WHERE user_id = ? AND unit_row_id = ?", [
          userId,
          row.id,
        ]);
      }
    });
  };

  const removeAllUnitCopies = (unitId: string) => {
    mutate("Units", `Removed every copy of unit ${unitId}`, (db, userId) => {
      const rows = all<{ id: number }>(
        db,
        "SELECT id FROM unit WHERE user_id = ? AND unit_id = ?",
        [userId, unitId],
      );
      for (const row of rows) {
        run(db, "DELETE FROM unit WHERE id = ?", [row.id]);
        run(db, "DELETE FROM unit_equip WHERE user_id = ? AND unit_row_id = ?", [
          userId,
          row.id,
        ]);
        run(db, "DELETE FROM party WHERE user_id = ? AND unit_row_id = ?", [
          userId,
          row.id,
        ]);
      }
    });
  };

  const updateUnitGroup = (
    unitId: string,
    patch: { level?: number; rarity?: number; lb?: number; awake?: number },
  ) => {
    const allowed = ["level", "rarity", "lb", "awake"] as const;
    const fields = allowed.filter((field) => patch[field] !== undefined);
    if (fields.length === 0) return;
    mutate("Units", `Updated every copy of unit ${unitId}`, (db, userId) => {
      const assignments = fields.map((field) => `${field} = ?`).join(", ");
      const values = fields.map((field) =>
        Math.max(0, Math.floor(Number(patch[field]))),
      );
      run(db, `UPDATE unit SET ${assignments} WHERE user_id = ? AND unit_id = ?`, [
        ...values,
        userId,
        unitId,
      ]);
    });
  };


  const readMissions = (): MissionRow[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    return all<MissionRow>(
      db,
      `SELECT mission_id, status, clears, first_clear_at
         FROM mission_progress WHERE user_id = ? ORDER BY mission_id`,
      [activeUserId],
    );
  };

  const readSideMissions = (): SideMissionRow[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    return all<SideMissionRow>(
      db,
      `SELECT mission_id, progress, cleared_at, claimed_at
         FROM sp_mission WHERE user_id = ? ORDER BY mission_id`,
      [activeUserId],
    );
  };

  const readSwitches = (): string[] => {
    const db = dbRef.current;
    if (!db || !activeUserId) return [];
    return readSwitchList(db, activeUserId);
  };

  const clearMissions = (ids: number[]) => {
    const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
    if (unique.length === 0) return;
    const unlocks = storySwitches
      ? switchesForMissions(storySwitches, unique)
      : [];
    mutate(
      "Missions",
      unlocks.length > 0
        ? `Marked ${unique.length} mission(s) cleared and granted ${unlocks.length} area flag(s)`
        : `Marked ${unique.length} mission(s) cleared`,
      (db, userId) => {
        const stamp = String(nowEpoch());
        for (const missionId of unique) {
          run(
            db,
            `INSERT INTO mission_progress
               (user_id, mission_id, status, clears, first_clear_at)
             VALUES (?, ?, 2, 1, ?)
             ON CONFLICT(user_id, mission_id) DO UPDATE SET
               status = 2,
               clears = mission_progress.clears + 1,
               first_clear_at = CASE
                 WHEN mission_progress.first_clear_at IS NULL
                   OR mission_progress.first_clear_at IN ('', '0.0')
                 THEN excluded.first_clear_at
                 ELSE mission_progress.first_clear_at
               END`,
            [userId, missionId, stamp],
          );
          awardChallenges(db, userId, missionId, stamp);
        }
        if (unlocks.length > 0) {
          writeSwitchList(db, userId, [...readSwitchList(db, userId), ...unlocks]);
        }
      },
    );
  };

  const SIMULATED_STAGE_SECONDS = 1200;

  /**
   * Replays the story the way a real run would leave it: every stage cleared in
   * catalog order, each with its own switch granted and a spaced clear stamp.
   */
  const simulateStoryRun = (orderedMissionIds: number[]) => {
    if (!storySwitches) {
      toast.error("The story data is still loading.");
      return;
    }
    const ids = orderedMissionIds.filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;

    const outcome = {
      created: 0,
      skipped: 0,
      unlocks: 0,
      gil: 0,
      items: 0,
      challenges: 0,
    };
    const days = (ids.length * SIMULATED_STAGE_SECONDS) / 86400;

    mutate(
      "Story",
      `Simulated playthrough of ${ids.length} stage(s) over ${days.toFixed(1)} day(s)`,
      (db, userId) => {
        const cleared = new Set(
          all<{ mission_id: number }>(
            db,
            "SELECT mission_id FROM mission_progress WHERE user_id = ?",
            [userId],
          ).map((row) => Number(row.mission_id)),
        );
        const now = Number(nowEpoch());
        let stamp = now - ids.length * SIMULATED_STAGE_SECONDS;
        const played: number[] = [];
        for (let index = 0; index < ids.length; index += 1) {
          const missionId = ids[index];
          // jitter keeps the timeline from looking machine-generated
          const at = String(Math.round(stamp + ((index * 37) % 361) - 180));
          stamp += SIMULATED_STAGE_SECONDS;
          if (cleared.has(missionId)) {
            outcome.skipped += 1;
            // stages cleared by an earlier run still need their stars filled in
            outcome.challenges += awardChallenges(
              db,
              userId,
              missionId,
              at,
              stageSlots(
                missionId,
                4,
                objectivesFor(objectives, missionId).length,
                Boolean(rewardFor(missionId)),
              ),
            ).length;
            continue;
          }
          run(
            db,
            `INSERT INTO mission_progress
               (user_id, mission_id, status, clears, first_clear_at)
             VALUES (?, ?, 2, 1, ?)
             ON CONFLICT(user_id, mission_id) DO NOTHING`,
            [userId, missionId, at],
          );
          played.push(missionId);
          outcome.created += 1;
          outcome.challenges += awardChallenges(
            db,
            userId,
            missionId,
            at,
            stageSlots(
              missionId,
              4,
              objectivesFor(objectives, missionId).length,
              Boolean(rewardFor(missionId)),
            ),
          ).length;
        }
        if ((stageRewards || eventRewards) && played.length > 0) {
          let gil = 0;
          const items = new Map<string, number>();
          for (const missionId of played) {
            const reward = rewardFor(missionId);
            if (!reward) continue;
            gil += reward.g || 0;
            rollDrops(reward, items);
          }
          if (gil > 0 && hasTable(db, "user")) {
            run(db, "UPDATE user SET gil = gil + ? WHERE user_id = ?", [
              gil,
              userId,
            ]);
          }
          if (items.size > 0 && hasTable(db, "item")) {
            const grantedAt = String(nowEpoch());
            for (const [itemId, count] of items) {
              run(
                db,
                `INSERT INTO item (user_id, item_id, count) VALUES (?, ?, ?)
                 ON CONFLICT(user_id, item_id) DO UPDATE SET
                   count = item.count + excluded.count`,
                [userId, itemId, count],
              );
              if (hasTable(db, "reward_grant")) {
                run(
                  db,
                  `INSERT INTO reward_grant
                     (user_id, source, ref, kind, item_id, count, granted_at)
                   VALUES (?, 'drop', 'story', 'item', ?, ?, ?)`,
                  [userId, itemId, count, grantedAt],
                );
              }
            }
          }
          outcome.gil = gil;
          outcome.items = Array.from(items.values()).reduce(
            (sum, count) => sum + count,
            0,
          );
        }
        const unlocks = switchesForMissions(storySwitches, ids);
        const clears = clearSwitches ?? [];
        // esper/town nodes are opened by dungeon gates, not by story switches
        const gates = mapGates ? allMapGateSwitches(mapGates) : [];
        if (unlocks.length > 0 || clears.length > 0 || gates.length > 0) {
          const next = [
            ...readSwitchList(db, userId),
            ...unlocks,
            ...clears,
            ...gates,
          ];
          // the maps' own events: a side quest that was just completed plays and
          // opens the next part of the map, esper islands included
          const quests = mapEvents ? switchesFromEvents(mapEvents, next) : [];
          writeSwitchList(db, userId, [...next, ...quests]);
          outcome.unlocks += quests.length;
        }
        outcome.unlocks += unlocks.length + clears.length + gates.length;
      },
    );

    if (outcome.created > 0) {
      toast.success(
        `Played ${outcome.created} stage(s): ${outcome.challenges} star(s), +${outcome.gil.toLocaleString()} gil, ${outcome.items.toLocaleString()} item(s), ${outcome.unlocks} switches.`,
      );
    }
  };

  /** The drop table of a stage, story or not: the two assets split that by mode. */
  const rewardFor = (missionId: number | string) =>
    stageRewards?.missions[String(missionId)] ??
    eventRewards?.missions[String(missionId)] ??
    null;

  /** What one clear pays: the gil its enemies carry and how many drop entries roll. */
  const readStageReward = (missionId: number) => {
    const reward = rewardFor(missionId);
    if (!reward) return null;
    return { gil: reward.g || 0, entries: (reward.d ?? []).length };
  };

  /** Story stages only: the queue button plays the story, not every event. */
  const readRewardStages = (): string[] =>
    stageRewards ? Object.keys(stageRewards.missions) : [];

  const readPointTargets = () => {
    const db = dbRef.current;
    const empty = { waves: [], raidAreas: [], raidDungeons: [], raidClears: 0 };
    if (!db || !activeUserId) return empty;
    const waves = hasTable(db, "wave_points")
      ? all<{ event: string; points: number }>(
          db,
          "SELECT event, points FROM wave_points WHERE user_id = ? ORDER BY event",
          [activeUserId],
        ).map((row) => ({ key: String(row.event), points: Number(row.points) }))
      : [];
    const raidAreas = hasTable(db, "raid_area_points")
      ? all<{ area: string; points: number }>(
          db,
          "SELECT area, points FROM raid_area_points WHERE user_id = ? ORDER BY area",
          [activeUserId],
        ).map((row) => ({ key: String(row.area), points: Number(row.points) }))
      : [];
    const raidDungeons = hasTable(db, "raid_state")
      ? all<{ dungeon_id: string; damage: number; clears: number }>(
          db,
          "SELECT dungeon_id, damage, clears FROM raid_state WHERE user_id = ?",
          [activeUserId],
        ).map((row) => ({
          key: String(row.dungeon_id),
          damage: Number(row.damage),
          clears: Number(row.clears),
        }))
      : [];
    const raidClears =
      hasTable(db, "raid_state")
        ? Number(
            scalar(db, "SELECT COALESCE(SUM(clears), 0) FROM raid_state WHERE user_id = ?", [
              activeUserId,
            ]) ?? 0,
          )
        : 0;
    return { waves, raidAreas, raidDungeons, raidClears };
  };

  /**
   * The Item World keeps its counters in `user_kv` and every enhanced item in
   * `custom_equip`. The bonus itself lives only in `ex_learn`; the save has no
   * stat columns for equipment.
   */
  const readItemWorld = (): ItemWorldState => {
    const empty: ItemWorldState = {
      orbs: null,
      points: null,
      week: null,
      selected: null,
      customSeq: null,
      equips: [],
      claims: [],
      activeRun: null,
    };
    const db = dbRef.current;
    const userId = activeUserId;
    if (!db || !userId) return empty;

    const kv = new Map<string, string>();
    if (hasTable(db, "user_kv")) {
      for (const row of all<{ key: string; value: string | null }>(
        db,
        "SELECT key, value FROM user_kv WHERE user_id = ?",
        [userId],
      )) {
        kv.set(String(row.key), String(row.value ?? ""));
      }
    }
    const num = (key: string): number | null => {
      const raw = kv.get(key);
      if (raw === undefined || raw.trim() === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };

    const stock = new Map<string, number>();
    if (hasTable(db, "equip_stock")) {
      for (const row of all<{ item_id: string; count: number }>(
        db,
        "SELECT item_id, count FROM equip_stock WHERE user_id = ?",
        [userId],
      )) {
        stock.set(String(row.item_id), Number(row.count ?? 0));
      }
    }

    const equips = hasTable(db, "custom_equip")
      ? all<{
          custom_id: number;
          base_item_id: string | null;
          ex_learn: string | null;
          before_ex_learn: string | null;
          created_at: number | null;
        }>(
          db,
          `SELECT custom_id, base_item_id, ex_learn, before_ex_learn, created_at
             FROM custom_equip WHERE user_id = ? ORDER BY custom_id`,
          [userId],
        ).map((row) => {
          const baseItemId = String(row.base_item_id ?? "");
          return {
            customId: Number(row.custom_id),
            baseItemId,
            exLearn: parseExLearn(row.ex_learn),
            beforeExLearn: parseExLearn(row.before_ex_learn),
            createdAt:
              row.created_at === null || row.created_at === undefined
                ? null
                : Number(row.created_at),
            stock: stock.get(baseItemId) ?? 0,
          };
        })
      : [];

    const claims = hasTable(db, "equip_grow_claims")
      ? all<{ reward_id: string; claimed_at: number | null }>(
          db,
          `SELECT reward_id, claimed_at FROM equip_grow_claims
             WHERE user_id = ? ORDER BY reward_id`,
          [userId],
        ).map((row) => ({
          rewardId: String(row.reward_id),
          claimedAt:
            row.claimed_at === null || row.claimed_at === undefined
              ? null
              : Number(row.claimed_at),
        }))
      : [];

    const run = hasTable(db, "equip_grow_run")
      ? first<{
          custom_id: number | null;
          base_item_id: string | null;
          next_floor: number | null;
          phase: string | null;
        }>(
          db,
          `SELECT custom_id, base_item_id, next_floor, phase
             FROM equip_grow_run WHERE user_id = ?`,
          [userId],
        )
      : undefined;

    return {
      orbs: num("eg_orb"),
      points: num("eg_points"),
      week: num("eg_week"),
      selected: kv.get("eg_selected") ?? null,
      customSeq: num("eg_custom_seq"),
      equips,
      claims,
      activeRun: run
        ? {
            customId: run.custom_id === null ? null : Number(run.custom_id),
            baseItemId:
              run.base_item_id === null ? null : String(run.base_item_id),
            floor: Number(run.next_floor ?? 0),
            phase: run.phase === null ? null : String(run.phase),
          }
        : null,
    };
  };

  const setItemWorldEx = (customId: number, tokens: string[]) => {
    const clean = normalizeExLearn(tokens);
    if (!Number.isFinite(customId)) return;
    mutate(
      "Item World",
      `Set ${clean.length} EX abilit${clean.length === 1 ? "y" : "ies"} on item ${customId}`,
      (db, userId) => {
        run(
          db,
          `UPDATE custom_equip SET ex_learn = ? WHERE user_id = ? AND custom_id = ?`,
          [formatExLearn(clean), userId, customId],
        );
      },
      ["custom_equip"],
    );
  };

  const restoreItemWorldBefore = (customId: number) => {
    const db = dbRef.current;
    const userId = activeUserId;
    if (!db || !userId) return;
    const row = first<{ before_ex_learn: string | null }>(
      db,
      `SELECT before_ex_learn FROM custom_equip WHERE user_id = ? AND custom_id = ?`,
      [userId, customId],
    );
    const before = parseExLearn(row?.before_ex_learn);
    if (before.length === 0) {
      toast.message("That item has no revert point stored.");
      return;
    }
    setItemWorldEx(customId, before);
  };

  const copyItemWorldEx = (fromCustomId: number, toCustomId: number) => {
    const db = dbRef.current;
    const userId = activeUserId;
    if (!db || !userId || fromCustomId === toCustomId) return;
    const row = first<{ ex_learn: string | null; base_item_id: string | null }>(
      db,
      `SELECT ex_learn, base_item_id FROM custom_equip WHERE user_id = ? AND custom_id = ?`,
      [userId, fromCustomId],
    );
    if (!row) return;
    const tokens = parseExLearn(row.ex_learn);
    const name = row.base_item_id ? String(row.base_item_id) : String(fromCustomId);
    mutate(
      "Item World",
      `Copied ${tokens.length} EX abilit${tokens.length === 1 ? "y" : "ies"} from ${name}`,
      (innerDb, innerUser) => {
        run(
          innerDb,
          `UPDATE custom_equip SET ex_learn = ? WHERE user_id = ? AND custom_id = ?`,
          [formatExLearn(tokens), innerUser, toCustomId],
        );
      },
      ["custom_equip"],
    );
  };

  /**
   * Adds Item World data to an equipment id that has no row yet: a `custom_equip`
   * row with the next custom id and the learned abilities. The base item is the
   * id the game equips, so the save needs no new inventory row.
   */
  const createItemWorldEquip = (
    baseItemId: string,
    tokens: string[],
    stockCount = 0,
  ): number | null => {
    const db = dbRef.current;
    const userId = activeUserId;
    const base = baseItemId.trim();
    const clean = normalizeExLearn(tokens);
    const extraStock = Math.max(0, Math.min(9999, Math.floor(stockCount)));
    if (!db || !userId) return null;
    if (!/^\d+$/.test(base)) {
      toast.error("Enter the numeric equipment id first.");
      return null;
    }
    if (clean.length === 0) {
      toast.error("Pick at least one EX ability.");
      return null;
    }
    if (!hasTable(db, "custom_equip")) {
      toast.error("This save has no custom_equip table.");
      return null;
    }
    const duplicate = first(
      db,
      "SELECT 1 FROM custom_equip WHERE user_id = ? AND base_item_id = ?",
      [userId, base],
    );
    if (duplicate) {
      toast.error("That equipment already has an Item World row — edit it instead.");
      return null;
    }

    // The server hands out custom ids as 1,000,000,000 + eg_custom_seq.
    const seqRow = first<{ value: string | null }>(
      db,
      "SELECT value FROM user_kv WHERE user_id = ? AND key = ?",
      [userId, "eg_custom_seq"],
    );
    const seq = Number(seqRow?.value ?? 0);
    const maxRow = first<{ maxId: number | null }>(
      db,
      "SELECT MAX(custom_id) AS maxId FROM custom_equip WHERE user_id = ?",
      [userId],
    );
    const maxOffset = Number(maxRow?.maxId ?? 0) - 1_000_000_000;
    const nextSeq =
      Math.max(Number.isFinite(seq) ? seq : 0, Number.isFinite(maxOffset) ? maxOffset : 0, 1) + 1;
    const customId = 1_000_000_000 + nextSeq;
    const createdAt = nowEpoch();

    mutate(
      "Item World",
      `Enhanced ${base} with ${clean.length} EX abilit${clean.length === 1 ? "y" : "ies"}${extraStock > 0 ? `, +${extraStock} in stock` : ""}`,
      (innerDb, innerUser) => {
        run(
          innerDb,
          `INSERT INTO custom_equip
             (user_id, custom_id, base_item_id, ex_learn, before_ex_learn, created_at)
           VALUES (?, ?, ?, ?, '', ?)`,
          [innerUser, customId, base, formatExLearn(clean), createdAt],
        );
        run(
          innerDb,
          `INSERT INTO user_kv (user_id, key, value) VALUES (?, ?, ?)
           ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
          [innerUser, "eg_custom_seq", String(nextSeq)],
        );
        if (extraStock > 0 && hasTable(innerDb, "equip_stock")) {
          run(
            innerDb,
            `INSERT INTO equip_stock (user_id, item_id, count) VALUES (?, ?, ?)
             ON CONFLICT(user_id, item_id)
             DO UPDATE SET count = count + excluded.count`,
            [innerUser, base, extraStock],
          );
        }
      },
      ["custom_equip", "user_kv", "equip_stock"],
    );
    return customId;
  };

  const setItemWorldValue = (key: "orbs" | "points", value: number) => {
    const kvKey = key === "orbs" ? "eg_orb" : "eg_points";
    const safe = Math.max(0, Math.min(999999999, Math.floor(value)));
    if (!Number.isFinite(safe)) return;
    mutate(
      "Item World",
      `Set ${key} to ${safe.toLocaleString("en-US")}`,
      (db, userId) => {
        run(
          db,
          `INSERT INTO user_kv (user_id, key, value) VALUES (?, ?, ?)
           ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
          [userId, kvKey, String(safe)],
        );
      },
      ["user_kv"],
    );
  };

  /**
   * Writes the rows a played run leaves behind: clears, stars, drops, the drop
   * log, an attempt row and the event/raid points the stage would have paid.
   * Nothing here invents data — gil and drops come from the same stage table the
   * story simulator uses.
   */
  const runAutoplay = (options: AutoplayOptions): AutoplayOutcome => {
    const db = dbRef.current;
    const userId = activeUserId;
    const empty: AutoplayOutcome = {
      missions: 0,
      runs: 0,
      stars: 0,
      gil: 0,
      items: 0,
      points: 0,
      energySpent: 0,
      attemptsLogged: 0,
      score: 0,
      unlocks: 0,
      chests: 0,
      tmr: 0,
      rewards: 0,
      stages: [],
    };
    if (!db || !userId) return empty;

    const missionIds = Array.from(
      new Set(options.missionIds.filter((id) => Number.isFinite(id))),
    );
    const runs = Math.max(1, Math.min(999, Math.floor(options.runs)));
    if (missionIds.length === 0) {
      toast.error("Pick at least one mission first.");
      return empty;
    }

    const outcome: AutoplayOutcome = { ...empty, missions: missionIds.length };
    const SECONDS_PER_RUN = 1200;
    const totalRuns = missionIds.length * runs;

    mutate(
      "Autoplay",
      `${totalRuns} run(s) across ${missionIds.length} mission(s)`,
      (innerDb, innerUser) => {
        const now = Number(nowEpoch());
        let stamp = now - totalRuns * SECONDS_PER_RUN;
        const gilTotal = { value: 0 };
        const items = new Map<string, number>();
        const chestSwitches = new Set<string>();
        const equips = new Map<string, number>();
        const materias = new Map<string, number>();
        const books = new Set<string>();
        const attempts: { missionId: number; drops: string; at: string }[] = [];
        /** reward mails, in the shape the save's own mail rows use */
        const mails: {
          title: string;
          message: string;
          source: string;
          ref: string;
          at: number;
          rewards: Reward[];
        }[] = [];
        // the server's own lapis multiplier scales a mission's clear reward;
        // challenge and first-clear rewards are paid as the masters list them
        const lapisReward = (() => {
          if (!hasTable(innerDb, "server_setting")) return 1;
          const row = first<{ value: string }>(
            innerDb,
            "SELECT value FROM server_setting WHERE key = 'master:lapis_reward'",
          );
          const scale = Number(row?.value);
          return Number.isFinite(scale) && scale > 0 ? scale : 1;
        })();
        const scaleClear = (rewards: Reward[]): Reward[] =>
          rewards.map((reward) =>
            reward[0] === "lapis"
              ? ([reward[0], reward[1], reward[2] * lapisReward] as Reward)
              : reward,
          );
        // kinds the save's own mail rows use: a latent ability or a player
        // emblem has no mail grant kind, so it could never be claimed
        const MAIL_KINDS = new Set([
          "lapis",
          "gil",
          "item",
          "equip",
          "materia",
          "important",
          "unit",
          "recipe",
          "vision",
        ]);
        const missionName = (missionId: number) =>
          catalog.missions[String(missionId)] ?? `Mission ${missionId}`;
        const rewardName = ([kind, id]: Reward) => {
          if (kind === "lapis") return "Lapis";
          if (kind === "gil") return "Gil";
          const name =
            kind === "item"
              ? catalog.items[id]
              : kind === "equip"
                ? catalog.equip[id]
                : kind === "materia"
                  ? catalog.materia[id]
                  : kind === "important"
                    ? catalog.important[id]
                    : kind === "unit"
                      ? catalog.units[id]
                      : kind === "vision"
                        ? catalog.vision[id]
                        : undefined;
          return name ?? id;
        };
        const queueMail = (mail: {
          source: string;
          ref: string;
          title: string;
          missionId: number;
          rewards: Reward[];
          at: number;
        }) => {
          const rewards = mail.rewards.filter(([kind]) => MAIL_KINDS.has(kind));
          if (rewards.length === 0) return;
          const received = rewards
            .map((reward) => `${rewardName(reward)} \u00d7${reward[2].toLocaleString()}`)
            .join(", ");
          mails.push({
            source: mail.source,
            ref: mail.ref,
            title: mail.title,
            at: mail.at,
            message: `You received: ${received}. From: ${missionName(mail.missionId)} (mission ${mail.missionId}).`,
            rewards,
          });
        };

        for (const missionId of missionIds) {
          let missionGil = 0;
          const starsBefore = outcome.stars;
          const chestsBefore = outcome.chests;
          const alreadyCleared = Boolean(
            first(
              innerDb,
              "SELECT 1 FROM mission_progress WHERE user_id = ? AND mission_id = ? AND status >= 2",
              [innerUser, missionId],
            ),
          );
          const mailsBefore = mails.length;
          // a stage pays its own clear reward once, on the clear that opens it
          if (!alreadyCleared) {
            const rewards = scaleClear(clearReward(clearRewards, missionId));
            queueMail({
              source: "clear_reward",
              ref: `clear:${missionId}`,
              title: "Mission Clear Reward",
              missionId,
              rewards,
              at: now,
            });
          }
          const missionDrops = new Map<string, number>();
          for (let pass = 0; pass < runs; pass += 1) {
            const at = String(Math.round(stamp + ((pass * 41) % 297) - 148));
            stamp += SECONDS_PER_RUN;
            run(
              innerDb,
              `INSERT INTO mission_progress
                 (user_id, mission_id, status, clears, first_clear_at)
               VALUES (?, ?, 2, 1, ?)
               ON CONFLICT(user_id, mission_id) DO UPDATE SET
                 status = 2,
                 clears = mission_progress.clears + 1,
                 first_clear_at = CASE
                   WHEN mission_progress.first_clear_at IS NULL
                     OR mission_progress.first_clear_at IN ('', '0.0')
                   THEN excluded.first_clear_at
                   ELSE mission_progress.first_clear_at
                 END`,
              [innerUser, missionId, at],
            );
            const chosen = options.objectives?.[String(missionId)];
            if (chosen) {
              for (const slot of chosen) {
                const challengeId = missionId * 10 + slot;
                const exists = first(
                  innerDb,
                  "SELECT 1 FROM challenge_progress WHERE user_id = ? AND mission_id = ? AND challenge_id = ?",
                  [innerUser, missionId, challengeId],
                );
                if (exists) continue;
                run(
                  innerDb,
                  `INSERT INTO challenge_progress
                     (user_id, mission_id, challenge_id, achieved_at)
                   VALUES (?, ?, ?, ?)`,
                  [innerUser, missionId, challengeId, at],
                );
                outcome.stars += 1;
                const reward = starReward(clearRewards, missionId, slot);
                if (reward) {
                  queueMail({
                    source: slot === 0 ? "first_clear" : "challenge",
                    ref: `${missionId}:${challengeId}`,
                    title: slot === 0 ? "First Clear Reward" : "Challenge Reward",
                    missionId,
                    rewards: [reward],
                    at: now,
                  });
                }
              }
            } else if (options.stars > 0) {
              const named = objectivesFor(objectives, missionId).length;
              const listed = clearRewards
                ? Object.keys(clearRewards.missions[String(missionId)] ?? {}).length
                : 0;
              // a stage the challenge master does not list has no missions at
              // all, so a star there would be invented
              const slots =
                clearRewards && named === 0 && listed === 0
                  ? 0
                  : stageSlots(
                      missionId,
                      options.stars,
                      named || listed,
                      Boolean(rewardFor(missionId)),
                    );
              if (slots > 0) {
                const won = awardChallenges(
                  innerDb,
                  innerUser,
                  missionId,
                  at,
                  slots,
                );
                outcome.stars += won.length;
                for (const slot of won) {
                  const reward = starReward(clearRewards, missionId, slot);
                  if (reward) {
                    queueMail({
                      source: slot === 0 ? "first_clear" : "challenge",
                      ref: `${missionId}:${missionId * 10 + slot}`,
                      title: slot === 0 ? "First Clear Reward" : "Challenge Reward",
                      missionId,
                      rewards: [reward],
                      at: now,
                    });
                  }
                }
              }
            }

            if (options.grantDrops) {
              const reward = rewardFor(missionId);
              if (reward) {
                missionGil += reward.g || 0;
                rollDrops(reward, missionDrops);
              }
              // collection points are gathered again on every walk
              const points = fieldLoot?.missions[String(missionId)]?.points ?? [];
              for (const point of points) {
                const drawn = rollHarvest(fieldLoot?.pools[point.area]);
                if (!drawn) continue;
                missionDrops.set(
                  drawn.itemId,
                  (missionDrops.get(drawn.itemId) ?? 0) + drawn.count,
                );
              }
            }
          }

          // a chest opens once ever: record it, pay its contents, light its switch
          const chests = fieldLoot?.missions[String(missionId)]?.chests ?? [];
          if (options.grantDrops && chests.length > 0) {
            const opened = hasTable(innerDb, "treasure_open")
              ? new Set(
                  all<{ treasure_id: number }>(
                    innerDb,
                    "SELECT treasure_id FROM treasure_open WHERE user_id = ?",
                    [innerUser],
                  ).map((row) => String(row.treasure_id)),
                )
              : new Set<string>();
            for (const chest of chests) {
              if (opened.has(chest.id)) continue;
              if (hasTable(innerDb, "treasure_open")) {
                run(
                  innerDb,
                  `INSERT OR IGNORE INTO treasure_open (user_id, treasure_id, opened_at)
                   VALUES (?, ?, ?)`,
                  [innerUser, Number(chest.id), Number(nowEpoch())],
                );
              }
              opened.add(chest.id);
              chestSwitches.add(chest.switchId);
              outcome.chests += 1;
              for (const [kind, itemId, count] of chest.rewards) {
                if (count <= 0) continue;
                // 20 an item, 21 equipment, 22 materia, 60 a recipe book
                if (kind === 20) items.set(itemId, (items.get(itemId) ?? 0) + count);
                else if (kind === 21) equips.set(itemId, (equips.get(itemId) ?? 0) + count);
                else if (kind === 22) materias.set(itemId, (materias.get(itemId) ?? 0) + count);
                else if (kind === 60) books.add(itemId);
              }
            }
          }

          outcome.stages.push({
            missionId,
            runs,
            stars: outcome.stars - starsBefore,
            gil: missionGil,
            items: Array.from(missionDrops.values()).reduce((sum, n) => sum + n, 0),
            chests: outcome.chests - chestsBefore,
            rewards: mails.length - mailsBefore,
            cleared: !alreadyCleared,
          });

          if (missionGil > 0) {
            gilTotal.value += missionGil;
            run(innerDb, "UPDATE user SET gil = gil + ? WHERE user_id = ?", [
              missionGil,
              innerUser,
            ]);
          }
          for (const [itemId, count] of missionDrops) {
            items.set(itemId, (items.get(itemId) ?? 0) + count);
          }
          if (options.recordAttempts && hasTable(innerDb, "mission_attempt")) {
            const startedAt = Number(nowEpoch()) - (missionIds.length - attempts.length) * runs * SECONDS_PER_RUN;
            attempts.push({
              missionId,
              at: String(startedAt),
              drops: JSON.stringify(
                Object.fromEntries(
                  Array.from(missionDrops.entries()).map(([id, count]) => [
                    `item:${id}`,
                    count,
                  ]),
                ),
              ),
            });
          }
        }

        if (options.grantDrops && items.size > 0 && hasTable(innerDb, "item")) {
          const grantedAt = String(nowEpoch());
          for (const [itemId, count] of items) {
            run(
              innerDb,
              `INSERT INTO item (user_id, item_id, count) VALUES (?, ?, ?)
               ON CONFLICT(user_id, item_id) DO UPDATE SET
                 count = item.count + excluded.count`,
              [innerUser, itemId, count],
            );
            if (hasTable(innerDb, "reward_grant")) {
              run(
                innerDb,
                `INSERT INTO reward_grant
                   (user_id, source, ref, kind, item_id, count, granted_at)
                 VALUES (?, 'drop', 'autoplay', 'item', ?, ?, ?)`,
                [innerUser, itemId, count, grantedAt],
              );
            }
          }
        }

        // a chest's equipment, materia and recipe books land in their own stocks
        if (options.grantDrops) {
          const grantedAt = String(nowEpoch());
          const stock = (table: string, kind: string, rows: Map<string, number>) => {
            if (!hasTable(innerDb, table)) return;
            for (const [itemId, count] of rows) {
              run(
                innerDb,
                `INSERT INTO ${table} (user_id, item_id, count) VALUES (?, ?, ?)
                 ON CONFLICT(user_id, item_id) DO UPDATE SET
                   count = ${table}.count + excluded.count`,
                [innerUser, itemId, count],
              );
              if (hasTable(innerDb, "reward_grant")) {
                run(
                  innerDb,
                  `INSERT INTO reward_grant
                     (user_id, source, ref, kind, item_id, count, granted_at)
                   VALUES (?, 'treasure', 'autoplay', ?, ?, ?, ?)`,
                  [innerUser, kind, itemId, count, grantedAt],
                );
              }
            }
          };
          stock("equip_stock", "equip", equips);
          stock("materia_stock", "materia", materias);
          if (hasTable(innerDb, "recipe_book")) {
            for (const bookId of books) {
              run(
                innerDb,
                "INSERT OR IGNORE INTO recipe_book (user_id, book_id) VALUES (?, ?)",
                [innerUser, bookId],
              );
              if (hasTable(innerDb, "reward_grant")) {
                run(
                  innerDb,
                  `INSERT INTO reward_grant
                     (user_id, source, ref, kind, item_id, count, granted_at)
                   VALUES (?, 'treasure', 'autoplay', 'book', ?, 1, ?)`,
                  [innerUser, bookId, grantedAt],
                );
              }
            }
          }
        }

        for (const attempt of attempts) {
          run(
            innerDb,
            `INSERT INTO mission_attempt
               (user_id, mission_id, started_at, ended_at, result, client_report,
                cow, continues, drops, suspended)
             VALUES (?, ?, ?, ?, '{}', '{}', NULL, 0, ?, 0)`,
            [
              innerUser,
              attempt.missionId,
              attempt.at,
              String(Number(attempt.at) + SECONDS_PER_RUN),
              attempt.drops,
            ],
          );
          outcome.attemptsLogged += 1;
        }

        if (options.energyPerRun > 0 && hasTable(innerDb, "user")) {
          const spent = Math.max(0, Math.floor(options.energyPerRun)) * totalRuns;
          run(innerDb, "UPDATE user SET energy = MAX(0, energy - ?) WHERE user_id = ?", [
            spent,
            innerUser,
          ]);
          outcome.energySpent = spent;
        }

        const target = options.pointTarget;
        if (target && target.perRun > 0) {
          // a raid/event bonus unit raises every run's points by its own %
          const withBonus = Math.floor(
            Math.max(0, target.perRun) * (1 + Math.max(0, options.bonusPct ?? 0) / 100),
          );
          const gained = Math.max(0, withBonus) * totalRuns;
          if (target.kind === "wave" && hasTable(innerDb, "wave_points")) {
            run(
              innerDb,
              `INSERT INTO wave_points (user_id, event, points) VALUES (?, ?, ?)
               ON CONFLICT(user_id, event) DO UPDATE SET
                 points = wave_points.points + excluded.points`,
              [innerUser, target.key, gained],
            );
            outcome.points = gained;
          } else if (target.kind === "raidArea" && hasTable(innerDb, "raid_area_points")) {
            run(
              innerDb,
              `INSERT INTO raid_area_points (user_id, area, points) VALUES (?, ?, ?)
               ON CONFLICT(user_id, area) DO UPDATE SET
                 points = raid_area_points.points + excluded.points`,
              [innerUser, target.key, gained],
            );
            outcome.points = gained;
          } else if (target.kind === "raidClears" && hasTable(innerDb, "raid_state")) {
            run(
              innerDb,
              "UPDATE raid_state SET clears = clears + ? WHERE user_id = ?",
              [totalRuns, innerUser],
            );
            outcome.points = totalRuns;
          }
        }

        const score = options.scoreTarget;
        if (score?.kind === "raid" && score.damage > 0 && hasTable(innerDb, "raid_state")) {
          const damage = Math.floor(score.damage);
          run(
            innerDb,
            `UPDATE raid_state SET damage = damage + ?, clears = clears + ?
              WHERE user_id = ? AND dungeon_id = ?`,
            [damage * totalRuns, totalRuns, innerUser, score.dungeonId || "0"],
          );
          outcome.score = damage * totalRuns;
        } else if (score?.kind === "parade") {
          // parade_score.score: the six radar axes, their sum is the stage score
          const result = paradeScore(score.stats, score.clearPoints);
          const values = paradeValues(result);
          const week =
            Number(
              scalar(
                innerDb,
                "SELECT week FROM raid_season_state WHERE user_id = ?",
                [innerUser],
              ) ?? 0,
            ) || 0;
          let best = 0;
          for (const missionId of missionIds) {
            const existing = hasTable(innerDb, "parade_best")
              ? first<{ points: number }>(
                  innerDb,
                  "SELECT points FROM parade_best WHERE user_id = ? AND mission_id = ?",
                  [innerUser, String(missionId)],
                )
              : null;
            best = Math.max(Number(existing?.points ?? 0), result.total);
            if (hasTable(innerDb, "parade_best")) {
              run(
                innerDb,
                `INSERT INTO parade_best (user_id, mission_id, points, grade, values_csv, at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, mission_id) DO UPDATE SET
                   points = MAX(parade_best.points, excluded.points),
                   grade = excluded.grade,
                   values_csv = excluded.values_csv`,
                [
                  innerUser,
                  String(missionId),
                  result.total,
                  result.grade,
                  values,
                  Number(nowEpoch()),
                ],
              );
            }
            if (hasTable(innerDb, "parade_best_past")) {
              run(
                innerDb,
                `INSERT OR REPLACE INTO parade_best_past
                   (user_id, mission_id, week, points, grade, values_csv, at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  innerUser,
                  String(missionId),
                  week,
                  result.total,
                  result.grade,
                  values,
                  Number(nowEpoch()),
                ],
              );
            }
          }
          outcome.score = best;
        } else if (score?.kind === "cow" && hasTable(innerDb, "cow_state")) {
          // cow_score.total: seven components, and the stats the server re-scores from
          const result = cowScore(score.stats, {
            levelBonus: score.levelBonus,
            bonusPct: score.bonusPct,
          });
          const row = first<{ best_score: number }>(
            innerDb,
            "SELECT best_score FROM cow_state WHERE user_id = ?",
            [innerUser],
          );
          const bestScore = Math.max(Number(row?.best_score ?? 0), result.total);
          run(
            innerDb,
            `UPDATE cow_state
                SET best_score = ?, best_rating = ?, best_stats = ?, best_level = ?,
                    level = MAX(level, ?), best_at = ?
              WHERE user_id = ?`,
            [
              bestScore,
              score.rating || "S",
              cowStatsJson(score.stats),
              Math.floor(score.level) || 1,
              Math.floor(score.level) || 1,
              Number(nowEpoch()),
              innerUser,
            ],
          );
          outcome.score = bestScore;
        }

        // A clear turns on the mission's own open switches, the map gates and
        // then every event those unlock: a side quest that only needs switches
        // the account already holds is done, and its node opens.
        const missionSwitches = storySwitches
          ? switchesForMissions(storySwitches, missionIds)
          : [];
        const gates = mapGates ? allMapGateSwitches(mapGates) : [];
        const seeded = [
          ...readSwitchList(innerDb, innerUser),
          ...missionSwitches,
          ...(clearSwitches ?? []),
          ...gates,
          ...chestSwitches,
        ];
        const quests = mapEvents ? switchesFromEvents(mapEvents, seeded) : [];
        const total = [...new Set([...seeded, ...quests])];
        if (total.length > 0) {
          writeSwitchList(innerDb, innerUser, total);
          outcome.unlocks = total.length;
        }

        // trust mastery: each clear advances the party's gauge by the share the
        // game gives per battle; the column's scale is read from the save itself
        const party = (options.partyUnitIds ?? []).filter((id) =>
          Number.isFinite(id),
        );
        const perClear = Math.max(0, options.tmrPerClear ?? 0);
        if (perClear > 0 && party.length > 0 && hasTable(innerDb, "unit")) {
          const top = Number(
            scalar(
              innerDb,
              `SELECT MAX(tmr) FROM unit WHERE user_id = ? AND id IN (${party
                .map(() => "?")
                .join(", ")})`,
              [innerUser, ...party],
            ) ?? 0,
          );
          // 100 = the gauge as a percentage, 10000 = in hundredths
          const scale = top > 150 ? 10000 : 100;
          const step = Math.max(1, Math.round((perClear * scale) / 100));
          const gained = step * totalRuns;
          run(
            innerDb,
            `UPDATE unit
                SET tmr = MIN(?, tmr + ?)
              WHERE user_id = ? AND id IN (${party.map(() => "?").join(", ")})
                AND tmr < ?`,
            [scale, gained, innerUser, ...party, scale],
          );
          outcome.tmr = (gained / scale) * 100;
        }

        // the reward mails land in the box unread, ready to claim in game
        if (mails.length > 0 && hasTable(innerDb, "mail")) {
          const sentAt = Number(nowEpoch());
          const base = Number(
            scalar(
              innerDb,
              "SELECT COALESCE(MAX(mail_id), 0) FROM mail WHERE user_id = ?",
              [innerUser],
            ) ?? 0,
          );
          mails.forEach((mail, index) => {
            run(
              innerDb,
              `INSERT INTO mail
                 (user_id, mail_id, title, message, sent_at, received_at,
                  deleted, icon_type, source, ref, grants)
               VALUES (?, ?, ?, ?, ?, NULL, 0, 2, ?, ?, ?)`,
              [
                innerUser,
                base + 1 + index,
                mail.title,
                mail.message,
                sentAt + index,
                mail.source,
                mail.ref,
                JSON.stringify(
                  mail.rewards.map(([kind, id, count, pattern]) => ({
                    kind,
                    item_id: kind === "lapis" || kind === "gil" ? "" : id,
                    count,
                    pattern: pattern ?? "",
                    points: 0,
                  })),
                ),
              ],
            );
          });
          outcome.rewards = mails.length;
        }

        outcome.gil = gilTotal.value;
        outcome.items = Array.from(items.values()).reduce(
          (sum, count) => sum + count,
          0,
        );
        outcome.runs = totalRuns;
      },
      [
        "mission_progress",
        "challenge_progress",
        "item",
        "reward_grant",
        "user",
        "mission_attempt",
        "wave_points",
        "raid_area_points",
        "raid_state",
        "parade_best",
        "cow_state",
        "user_kv",
        "mail",
        "treasure_open",
        "equip_stock",
        "materia_stock",
        "recipe_book",
        "unit",
      ],
    );

    return outcome;
  };

  const grantStorySwitches = (missionIds?: number[]) => {    if (!storySwitches) {
      toast.error("The story flag list is still loading.");
      return;
    }
    const scope =
      missionIds && missionIds.length > 0
        ? missionIds
        : Object.keys(storySwitches.missions);
    const unlocks = switchesForMissions(storySwitches, scope);
    const clears = clearSwitches ?? [];
    if (unlocks.length === 0 && clears.length === 0) return;
    mutate(
      "Story",
      `Granted ${unlocks.length} area flag(s) and ${clears.length} clear flag(s)`,
      (db, userId) => {
        writeSwitchList(db, userId, [
          ...readSwitchList(db, userId),
          ...unlocks,
          ...clears,
        ]);
      },
    );
  };

  const readStorySwitchState = () => {
    const db = dbRef.current;
    if (!db || !activeUserId || !storySwitches) return { granted: 0, total: 0 };
    const all = allStorySwitches(storySwitches);
    const have = new Set(readSwitchList(db, activeUserId));
    return {
      granted: all.filter((switchId) => have.has(switchId)).length,
      total: all.length,
    };
  };

  const grantMapGates = () => {
    if (!mapGates) {
      toast.error("The map node list is still loading.");
      return;
    }
    const unlocks = allMapGateSwitches(mapGates);
    if (unlocks.length === 0) return;
    mutate(
      "Story",
      `Opened ${unlocks.length} map node gate(s)`,
      (db, userId) => {
        writeSwitchList(db, userId, [...readSwitchList(db, userId), ...unlocks]);
      },
    );
  };

  const readMapGateState = () => {
    const db = dbRef.current;
    if (!db || !activeUserId || !mapGates) return { granted: 0, total: 0 };
    const all = allMapGateSwitches(mapGates);
    const have = new Set(readSwitchList(db, activeUserId));
    return {
      granted: all.filter((switchId) => have.has(switchId)).length,
      total: all.length,
    };
  };

  const grantAllSwitches = () => {
    if (!allSwitches) {
      toast.error("The full switch list is still loading.");
      return;
    }
    mutate(
      "Story",
      `Granted every switch (${allSwitches.length})`,
      (db, userId) => {
        writeSwitchList(db, userId, [
          ...readSwitchList(db, userId),
          ...allSwitches,
        ]);
      },
    );
  };

  const readAllSwitchState = () => {
    const db = dbRef.current;
    if (!db || !activeUserId || !allSwitches) return { granted: 0, total: 0 };
    const have = new Set(readSwitchList(db, activeUserId));
    return {
      granted: allSwitches.filter((switchId) => have.has(switchId)).length,
      total: allSwitches.length,
    };
  };

  /**
   * Espers are rows in `beast`, one per esper id, with rarity/level/board state.
   * The roster is the 21 `820<id>100` switches in the switch master; a story
   * clear hands one of those out together with the row.
   */
  const grantAllEspers = () => {
    if (!espList) {
      toast.error("The esper list is still loading.");
      return;
    }
    const espers = espList.espers;
    if (espers.length === 0) return;
    const missing = Math.max(0, espers.length - readEsperState().owned);
    mutate(
      "Espers",
      missing > 0
        ? `Unlocked ${missing} esper(s), ${espers.length} owned in total`
        : `Refreshed all ${espers.length} espers`,
      (db, userId) => {
        if (!hasTable(db, "beast")) {
          throw new Error("This save has no esper table.");
        }
        const have = new Set(
          all<{ beast_id: number }>(
            db,
            "SELECT beast_id FROM beast WHERE user_id = ?",
            [userId],
          ).map((row) => Number(row.beast_id)),
        );
        // rarity/level/CP/board come from the client's own esper tables, so the
        // rows stay inside what this build accepts
        for (const esper of espers) {
          if (!have.has(esper.id)) {
            run(
              db,
              `INSERT INTO beast
                 (user_id, beast_id, rare, lv, exp, total_exp, cp, reset_count, pieces, unlocked)
               VALUES (?, ?, ?, ?, 0, 21600000, ?, 0, ?, '')`,
              [userId, esper.id, esper.maxRare, esper.maxLv, esper.cp, esper.mask],
            );
            continue;
          }
          run(
            db,
            `UPDATE beast
                SET rare = MAX(rare, ?),
                    lv = MAX(lv, ?),
                    cp = MAX(cp, ?),
                    pieces = ?
              WHERE user_id = ? AND beast_id = ?`,
            [esper.maxRare, esper.maxLv, esper.cp, esper.mask, userId, esper.id],
          );
        }
        // ids outside the shipped roster confuse the esper screen
        const keep = espers.map((esper) => esper.id);
        run(
          db,
          `DELETE FROM beast
            WHERE user_id = ? AND beast_id NOT IN (${keep.map(() => "?").join(", ")})`,
          [userId, ...keep],
        );
        writeSwitchList(db, userId, [
          ...readSwitchList(db, userId),
          ...esperUnlockSwitches(espList),
        ]);
      },
    );
  };

  const readEsperState = () => {
    const db = dbRef.current;
    if (!db || !activeUserId || !espList || !hasTable(db, "beast"))
      return { owned: 0, total: 0 };
    const owned = all<{ beast_id: number }>(
      db,
      "SELECT beast_id FROM beast WHERE user_id = ?",
      [activeUserId],
    );
    return {
      owned: owned.filter((row) =>
        espList.espers.some((esper) => esper.id === Number(row.beast_id)),
      ).length,
      total: espList.espers.length,
    };
  };

  const resetMissions = (ids: number[]) => {
    const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
    if (unique.length === 0) return;
    const revoked = storySwitches
      ? new Set(switchesForMissions(storySwitches, unique))
      : new Set<string>();
    mutate("Missions", `Reset ${unique.length} mission(s)`, (db, userId) => {
      for (const missionId of unique) {
        run(
          db,
          "DELETE FROM mission_progress WHERE user_id = ? AND mission_id = ?",
          [userId, missionId],
        );
        if (hasTable(db, "challenge_progress")) {
          run(
            db,
            "DELETE FROM challenge_progress WHERE user_id = ? AND mission_id = ?",
            [userId, missionId],
          );
        }
      }
      if (revoked.size > 0) {
        writeSwitchList(
          db,
          userId,
          readSwitchList(db, userId).filter((switchId) => !revoked.has(switchId)),
        );
      }
    });
  };

  const claimSideMissions = () => {
    mutate("Missions", "Claimed every side mission", (db, userId) => {
      const stamp = nowEpoch();
      run(
        db,
        `UPDATE sp_mission
            SET progress = 1,
                cleared_at = COALESCE(cleared_at, ?),
                claimed_at = COALESCE(claimed_at, ?)
          WHERE user_id = ?`,
        [stamp, stamp, userId],
      );
    });
  };

  const exportSave = () => {
    const db = dbRef.current;
    if (!db) throw new Error("No save is loaded.");
    const bytes = db.export();
    return {
      bytes,
      name: fileName ?? "ffbe-save.db",
      integrity: integrityCheck(db),
    };
  };

  const importCatalog = (text: string, sourceName: string) => {
    const parsed = parseCatalog(text);
    const total = catalogSize(parsed);
    if (total === 0) {
      toast.error("No names were found in that file.");
      return;
    }
    setStoredCatalog((current) => {
      const merged = mergeCatalog(current, parsed);
      storeCatalog(merged);
      return merged;
    });
    setUserSource(sourceName);
    toast.success(`Loaded ${total.toLocaleString("en-US")} names`);
  };

  const nameItem = (bucket: keyof Catalog, itemId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredCatalog((current) => {
      const next = {
        ...current,
        [bucket]: { ...current[bucket], [itemId]: trimmed },
      } as Catalog;
      storeCatalog(next);
      return next;
    });
    toast.success(`Named ${itemId}`);
  };

  const clearCatalog = () => {
    clearStoredCatalog();
    setStoredCatalog(emptyCatalog());
    setUserSource(null);
    toast.success("Imported name list cleared");
  };

  const store: SaveStore = {
    status,
    error,
    fileName,
    isDemo,
    loadingLabel,
    users,
    activeUser,
    activeUserId,
    summary,
    catalog,
    catalogSource: userSource ?? (builtinCatalog ? "Game data" : null),
    catalogCount,
    changes,
    version,
    openFile,
    openFiles,
    openDemo,
    reset,
    close,
    selectUser: (userId: string) => {
      setActiveUserId(userId);
      setVersion((value) => value + 1);
    },
    updateUser: (patch) => {
      const editable = ["gil", "lapis", "energy", "rank", "name"] as const;
      const fields = editable.filter((key) => patch[key] !== undefined);
      if (fields.length === 0) return;
      mutate("Account", `Updated ${fields.join(", ")}`, (db, userId) => {
        const assignments = fields.map((field) => `${field} = ?`).join(", ");
        const values = fields.map((field) => {
          const value = patch[field as keyof typeof patch];
          if (field === "name") return String(value);
          return Math.max(0, Math.floor(Number(value)));
        });
        run(db, `UPDATE user SET ${assignments} WHERE user_id = ?`, [
          ...values,
          userId,
        ]);
      });
    },
    readVisionCards,
    addVisionCard,
    setVisionCardCopies,
    setVisionCardLevel,
    nameVisionCards,
    readInventory,
    readLoadout,
    readLoadouts,
    setLoadoutSlot,
    readTeams,
    setTeamSlot,
    renameDeck,
    readMails,
    setMailDeleted,
    runAutoplay,
    readObjectives: (missionId: number) => objectivesFor(objectives, missionId),
    readRewardStages,
    readStageReward,
    readPointTargets,
    readItemWorld,
    setItemWorldEx,
    restoreItemWorldBefore,
    copyItemWorldEx,
    createItemWorldEquip,
    setItemWorldValue,
    undo: () => stepBack("undo"),
    redo: () => stepBack("redo"),
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
    undoDepth,
    setInventoryCount,
    addInventory,
    adjustInventory,
    readUnitGroups,
    addUnits,
    removeUnitCopies,
    removeAllUnitCopies,
    updateUnitGroup,
    readMissions,
    readSideMissions,
    simulateStoryRun,
    clearMissions,
    resetMissions,
    readSwitches,
    grantStorySwitches,
    readStorySwitchState,
    grantMapGates,
    readMapGateState,
    grantAllSwitches,
    readAllSwitchState,
    grantAllEspers,
    readEsperState,
    claimSideMissions,
    exportSave,
    importCatalog,
    clearCatalog,
    nameItem,
    searchCatalog: (bucket, query, limit = 60) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      const hits: { id: string; name: string }[] = [];
      for (const [id, name] of Object.entries(catalog[bucket])) {
        if (id.includes(needle) || name.toLowerCase().includes(needle)) {
          hits.push({ id, name });
        }
      }
      hits.sort((left, right) => {
        const leftName = left.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const rightName = right.name.toLowerCase().startsWith(needle) ? 0 : 1;
        if (leftName !== rightName) return leftName - rightName;
        return left.id.length - right.id.length || left.id.localeCompare(right.id);
      });
      return hits.slice(0, limit);
    },
    metaFor: (bucket, id) => metaFor(meta, bucket, id),
    nameFor: (bucket, id) => {
      const direct = catalog[bucket][id];
      if (direct) return direct;
      // Unit ids carry their rarity/awakening tier in the last two digits, so a
      // base-unit name still applies to e.g. 100000106 -> 1000001.
      if (bucket === "units" && id.length === 9) {
        return catalog.units[id.slice(0, 7)] ?? null;
      }
      return null;
    },
  };

  return <SaveContext.Provider value={store}>{children}</SaveContext.Provider>;
};
