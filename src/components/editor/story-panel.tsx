import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Flag,
  KeyRound,
  Loader2,
  Map as MapIcon,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Unlock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSave } from "@/state/save-context";
import { formatNumber } from "@/lib/ffbe/format";
import type { MissionRow } from "@/lib/ffbe/types";
import { buildStoryChapters, chapterLabel } from "@/lib/ffbe/story";
import {
  allMasterMissionIds,
  dungeonMissionIds,
  landMissionIds,
  loadStoryMaster,
  type MasterDungeon,
  type MasterLand,
  type MasterWorld,
  type StoryMaster,
} from "@/lib/ffbe/story-master";
import { InlineNote, PanelSection } from "./primitives";
import { cn } from "@/lib/utils";

interface PendingAction {
  mode:
    | "clear"
    | "reset"
    | "unlock"
    | "gates"
    | "everything"
    | "espers"
    | "play";
  ids: number[];
  title: string;
  description: string;
}

/** Shapes the nodes a save already records into the same tree as the catalog. */
const buildSaveOnlyTree = (
  missions: MissionRow[],
  nameFor: (bucket: "missions", id: string) => string | null,
): StoryMaster => ({
  worlds: [
    {
      id: 0,
      name: "This save",
      lands: buildStoryChapters(missions).map((chapter) => ({
        id: Number(chapter.key) || 0,
        name: chapterLabel(chapter.key),
        dungeons: chapter.areas.map((area) => ({
          id: Number(area.key) || 0,
          name: `Area ${area.key}`,
          missions: area.nodes.map((node) => ({
            id: node.missionId,
            name:
              nameFor("missions", String(node.missionId)) ??
              `Stage ${node.stage}`,
          })),
        })),
      })),
    },
  ],
});

const totalFor = (land: MasterLand) => landMissionIds(land).length;

export const StoryPanel = () => {
  const {
    readMissions,
    simulateStoryRun,
    clearMissions,
    resetMissions,
    grantStorySwitches,
    readStorySwitchState,
    grantMapGates,
    readMapGateState,
    grantAllSwitches,
    readAllSwitchState,
    grantAllEspers,
    readEsperState,
    nameFor,
    version,
  } = useSave();
  const [master, setMaster] = useState<StoryMaster | null>(null);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [worldId, setWorldId] = useState<number | null>(null);
  const [landId, setLandId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    let alive = true;
    loadStoryMaster().then((data) => {
      if (!alive) return;
      setMaster(data);
      setLoadingMaster(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const missions = useMemo(
    () => readMissions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const cleared = useMemo(() => {
    const map = new Map<number, number>();
    for (const mission of missions) {
      if (Number(mission.status) >= 2) {
        map.set(Number(mission.mission_id), Number(mission.clears ?? 1));
      }
    }
    return map;
  }, [missions]);

  const switchState = useMemo(
    () => readStorySwitchState(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const gateState = useMemo(
    () => readMapGateState(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const allSwitchState = useMemo(
    () => readAllSwitchState(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const esperState = useMemo(
    () => readEsperState(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const tree = useMemo(
    () => master ?? buildSaveOnlyTree(missions, nameFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [master, missions],
  );

  const world: MasterWorld | undefined =
    tree.worlds.find((entry) => entry.id === worldId) ?? tree.worlds[0];
  const land: MasterLand | undefined =
    world?.lands.find((entry) => entry.id === landId) ?? world?.lands[0];

  useEffect(() => {
    setSelected([]);
    setQuery("");
  }, [land?.id, world?.id]);

  const allIds = useMemo(() => allMasterMissionIds(tree), [tree]);
  const clearedTotal = allIds.filter((id) => cleared.has(id)).length;

  const matches = (dungeon: MasterDungeon, missionId: number, name: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      String(missionId).includes(needle) ||
      name.toLowerCase().includes(needle) ||
      dungeon.name.toLowerCase().includes(needle)
    );
  };

  const toggle = (missionId: number) => {
    setSelected((current) =>
      current.includes(missionId)
        ? current.filter((id) => id !== missionId)
        : [...current, missionId],
    );
  };

  const runPending = () => {
    if (!pending) return;
    if (pending.mode === "play") simulateStoryRun(pending.ids);
    else if (pending.mode === "clear") clearMissions(pending.ids);
    else if (pending.mode === "unlock") grantStorySwitches();
    else if (pending.mode === "gates") grantMapGates();
    else if (pending.mode === "everything") {
      grantAllSwitches();
      grantAllEspers();
    }
    else if (pending.mode === "espers") grantAllEspers();
    else resetMissions(pending.ids);
    setPending(null);
    setSelected([]);
  };

  const renderDungeon = (dungeon: MasterDungeon) => {
    const visible = dungeon.missions.filter((mission) =>
      matches(dungeon, mission.id, mission.name),
    );
    if (visible.length === 0) return null;
    const clearedCount = dungeon.missions.filter((mission) =>
      cleared.has(mission.id),
    ).length;

    return (
      <div
        key={dungeon.id}
        className="rounded-xl border border-border/70 bg-secondary/20 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {dungeon.name}
            </p>
            <p className="mono-id mt-0.5 text-[11px] text-muted-foreground">
              {dungeon.id} · {clearedCount}/{dungeon.missions.length} cleared
            </p>
          </div>
          <Button
            size="xs"
            variant="quiet"
            onClick={() =>
              setPending({
                mode: "clear",
                ids: dungeonMissionIds(dungeon),
                title: `Clear every stage in ${dungeon.name}?`,
                description: `${dungeon.missions.length} stages are written as cleared. Stages your save never recorded are created as new rows.`,
              })
            }
          >
            <Flag className="size-3.5" />
            Clear area
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((mission) => {
            const isCleared = cleared.has(mission.id);
            const isSelected = selected.includes(mission.id);
            return (
              <button
                key={mission.id}
                type="button"
                onClick={() => toggle(mission.id)}
                title={`${mission.id} — ${mission.name}${
                  isCleared ? ` · cleared ×${cleared.get(mission.id)}` : " · open"
                }`}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                  isCleared
                    ? "border-category-equip/50 bg-category-equip/10 text-foreground"
                    : "border-dashed border-border/70 bg-background/30 text-muted-foreground hover:text-foreground",
                  isSelected &&
                    "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border",
                    isCleared
                      ? "border-category-equip/60 bg-category-equip/20 text-category-equip"
                      : "border-border/70 text-muted-foreground",
                  )}
                >
                  {isCleared ? (
                    <Check className="size-2.5" />
                  ) : (
                    <span className="size-1 rounded-full bg-current opacity-60" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">
                  {mission.name}
                </span>
                <span className="mono-id shrink-0 text-[10px] opacity-60">
                  {String(mission.id).slice(5)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <InlineNote icon={AlertTriangle} tone="warning">
        Story stages unlock through two layers: the per-stage switch (written by
        clearing) and the map-node gate that towns, espers and side areas carry in
        the dungeon master. Unlock all nodes opens every one of them — esper and
        quest nodes included; battles still have to be fought for first-clear
        rewards and scenes.
      </InlineNote>

      <PanelSection
        title="Story chapters"
        description={
          master
            ? "Every chapter, area and stage the game ships, not only the ones this save has touched. Green stages are cleared in your save."
            : "Showing only the stages recorded in this save. The full mission list could not be loaded."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="subtle"
              disabled={allIds.length === 0}
              onClick={() =>
                setPending({
                  mode: "play",
                  ids: allIds,
                  title: "Simulate a full story playthrough?",
                  description:
                    `Runs all ${formatNumber(allIds.length)} stages in story order, ` +
                    "stamping each clear about 20 minutes apart (roughly 15 days), " +
                    "granting that stage's switches, marking the story-clear flags " +
                    "(types 103/200/201), filling its objective stars, and paying out " +
                    "the gil and item drops its enemies carry in the master data. " +
                    "Already-cleared stages keep their real timestamps. Battles, scenes " +
                    "and NPC quests are not recreated.",
                })
              }
            >
              <Play className="size-4" />
              Simulate playthrough
            </Button>
            <Button
              size="sm"
              variant="quiet"
              disabled={switchState.total === 0}
              onClick={() =>
                setPending({
                  mode: "unlock",
                  ids: [],
                  title: "Grant every story area flag?",
                  description:
                    "The world map unlocks through switch ids, not mission rows. This adds all " +
                    `${formatNumber(switchState.total)} story openers plus the 2,571 ` +
                    "main-story clear flags (types 103/200/201), so stages also read as " +
                    "cleared. Mission rows stay untouched.",
                })
              }
            >
              <KeyRound className="size-4" />
              Unlock areas
            </Button>
            <Button
              size="sm"
              variant="quiet"
              disabled={gateState.total === 0}
              onClick={() =>
                setPending({
                  mode: "gates",
                  ids: [],
                  title: "Open every map node, espers included?",
                  description:
                    "Towns, espers and side areas have their own gate switches in the " +
                    `dungeon master. This grants all ${formatNumber(gateState.total)} ` +
                    "switches that open a node: each dungeon's gate and node flag plus " +
                    "the open/required switch of every mission in it, so esper entries " +
                    "and quest-only nodes appear without finishing their chains.",
                })
              }
            >
              <MapIcon className="size-4" />
              Unlock all nodes
            </Button>
            <Button
              size="sm"
              variant="quiet"
              disabled={esperState.total === 0}
              onClick={() =>
                setPending({
                  mode: "espers",
                  ids: [],
                  title: "Unlock every esper?",
                  description:
                    `The client ships ${formatNumber(esperState.total)} espers. This adds ` +
                    `the ${formatNumber(Math.max(0, esperState.total - esperState.owned))} ` +
                    "your save is missing as fully grown rows in the beast table, raises " +
                    "any esper you already own to that same rarity and level, learns every " +
                    "board node (1★ through 3★) with enough SP left over, and grants each " +
                    "esper's own story switch.",
                })
              }
            >
              <Sparkles className="size-4" />
              Unlock all espers
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={allSwitchState.total === 0}
              onClick={() =>
                setPending({
                  mode: "everything",
                  ids: [],
                  title: "Unlock absolutely everything?",
                  description:
                    `All ${formatNumber(allSwitchState.total)} switch ids from the ` +
                    "client's switch master are written to user_kv (story, map nodes, " +
                    "quest chains, menus), and every esper is added with its whole board " +
                    "already learned. Nothing has to be tapped in game — make a backup first.",
                })
              }
            >
              <Unlock className="size-4" />
              Unlock everything
            </Button>
            <Button
              size="sm"
              variant="subtle"
              disabled={allIds.length === 0}
              onClick={() =>
                setPending({
                  mode: "clear",
                  ids: allIds,
                  title: "Clear every story stage?",
                  description: `${formatNumber(allIds.length)} stages across ${tree.worlds.length} world(s) are marked cleared, including ${formatNumber(
                    allIds.length - clearedTotal,
                  )} stages your save has never recorded. Their story switches are granted too.`,
                })
              }
            >
              <Flag className="size-4" />
              Clear all story
            </Button>
          </div>
        }
      >
        {loadingMaster ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading the full mission list…
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-id rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            {formatNumber(clearedTotal)}/{formatNumber(allIds.length)} stages
            cleared
          </span>
          {switchState.total > 0 ? (
            <span
              className={cn(
                "mono-id rounded-lg border px-2.5 py-1.5 text-xs",
                switchState.granted >= switchState.total
                  ? "border-category-equip/50 bg-category-equip/10 text-foreground"
                  : "border-border/70 bg-secondary/40 text-muted-foreground",
              )}
              title="Area switches in user_kv — these are what the world map actually reads"
            >
              {formatNumber(switchState.granted)}/{formatNumber(switchState.total)}{" "}
              area flags
            </span>
          ) : null}
          {gateState.total > 0 ? (
            <span
              className={cn(
                "mono-id rounded-lg border px-2.5 py-1.5 text-xs",
                gateState.granted >= gateState.total
                  ? "border-category-equip/50 bg-category-equip/10 text-foreground"
                  : "border-border/70 bg-secondary/40 text-muted-foreground",
              )}
              title="Node gates — towns, espers, quest-only areas and their missions"
            >
              {formatNumber(gateState.granted)}/{formatNumber(gateState.total)} node
              gates
            </span>
          ) : null}
          {esperState.total > 0 ? (
            <span
              className={cn(
                "mono-id rounded-lg border px-2.5 py-1.5 text-xs",
                esperState.owned >= esperState.total
                  ? "border-category-equip/50 bg-category-equip/10 text-foreground"
                  : "border-border/70 bg-secondary/40 text-muted-foreground",
              )}
              title="Espers recorded in the beast table"
            >
              {formatNumber(esperState.owned)}/{formatNumber(esperState.total)} espers
            </span>
          ) : null}
          {tree.worlds.length > 1
            ? tree.worlds.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setWorldId(entry.id);
                    setLandId(entry.lands[0]?.id ?? null);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    world?.id === entry.id
                      ? "border-category-item/50 bg-category-item/10 text-foreground"
                      : "border-border/70 bg-secondary/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.name}
                  <span className="mono-id ml-2 opacity-70">
                    {entry.lands.reduce((sum, item) => sum + totalFor(item), 0)}
                  </span>
                </button>
              ))
            : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {world?.lands.map((entry) => {
            const total = totalFor(entry);
            const done = landMissionIds(entry).filter((id) => cleared.has(id)).length;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setLandId(entry.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  land?.id === entry.id
                    ? "border-category-equip/50 bg-category-equip/10 text-foreground"
                    : "border-border/70 bg-secondary/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.name}
                <span className="mono-id ml-2 opacity-70">
                  {done}/{total}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter stages by name or id"
              className="h-9 pl-9 text-sm"
            />
          </div>
          {land ? (
            <Button
              size="sm"
              variant="quiet"
              onClick={() =>
                setPending({
                  mode: "clear",
                  ids: landMissionIds(land),
                  title: `Clear every stage in ${land.name}?`,
                  description: `${totalFor(land)} stages are written as cleared.`,
                })
              }
            >
              <Flag className="size-3.5" />
              Clear {land.name}
            </Button>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-category-equip/30 bg-category-equip/[0.06] px-3 py-2.5">
            <span className="text-xs text-foreground">
              {selected.length} stage{selected.length === 1 ? "" : "s"} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                size="xs"
                onClick={() =>
                  setPending({
                    mode: "clear",
                    ids: selected,
                    title: `Clear ${selected.length} selected stage(s)?`,
                    description:
                      "They are written as cleared with one extra clear each. Stages that were never recorded get new rows.",
                  })
                }
              >
                <Check className="size-3.5" />
                Clear selected
              </Button>
              <Button
                size="xs"
                variant="subtle"
                onClick={() =>
                  setPending({
                    mode: "reset",
                    ids: selected,
                    title: `Reset ${selected.length} selected stage(s)?`,
                    description:
                      "Their clear rows are deleted, as if the stage had never been touched. Rewards already granted are not removed.",
                  })
                }
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
              <Button size="xs" variant="quiet" onClick={() => setSelected([])}>
                <X className="size-3.5" />
                Clear selection
              </Button>
            </div>
          </div>
        ) : null}

        {land ? (
          <div className="mt-4 space-y-3">
            {land.dungeons.map(renderDungeon)}
            {query.trim() &&
            land.dungeons.every(
              (dungeon) =>
                !dungeon.missions.some((mission) =>
                  matches(dungeon, mission.id, mission.name),
                ),
            ) ? (
              <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                No stage in {land.name} matches “{query}”.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border/70 px-5 py-10 text-center">
            <BookOpen className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No story stages are available for this save yet.
            </p>
          </div>
        )}
      </PanelSection>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">{pending?.title}</DialogTitle>
            <DialogDescription>{pending?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={runPending}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
