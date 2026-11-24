import { useEffect, useMemo, useState } from "react";
import {
  CirclePlay,
  Coins,
  Mail,
  MapPin,
  ScrollText,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSave } from "@/state/save-context";
import { InlineNote, PanelSection } from "./primitives";
import { formatNumber } from "@/lib/ffbe/format";
import { COW, PARADE, PARADE_GRADE_NAMES, cowScore, paradeScore } from "@/lib/ffbe/score";
import { loadStoryMaster, type StoryMaster } from "@/lib/ffbe/story-master";
import {
  editionLabel,
  editionStageCount,
  loadParadeStages,
  type ParadeEdition,
  type ParadeStages,
} from "@/lib/ffbe/parade";
import { cn } from "@/lib/utils";
import type { AutoplayOutcome } from "@/lib/ffbe/types";

/**
 * One numbered box of the panel: a gold step badge, the title, an optional
 * right-hand readout and the controls it owns.
 */
const Step = ({
  step,
  title,
  hint,
  aside,
  children,
}: {
  step: string;
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-secondary/10">
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 bg-secondary/20 px-3 py-2.5">
      <span className="mono-id flex size-6 shrink-0 items-center justify-center rounded-full border border-category-equip/40 bg-category-equip/10 text-[11px] font-semibold text-category-equip">
        {step}
      </span>
      <h3 className="min-w-0 flex-1 text-sm font-medium tracking-tight text-foreground">
        {title}
      </h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
    <div className="px-3 py-3">
      {hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
      <div className={hint ? "mt-2" : ""}>{children}</div>
    </div>
  </section>
);

const TOGGLES = [
  { key: "grantDrops", label: "Grant gil and drops" },
  { key: "recordAttempts", label: "Log an attempt row per mission" },
] as const;

export const AutoplayPanel = () => {
  const {
    searchCatalog,
    nameFor,
    readMissions,
    runAutoplay,
    readRewardStages,
    readStageReward,
    readObjectives,
    readPointTargets,
    readTeams,
    version,
  } = useSave();

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ id: number; name: string }[]>([]);
  const [runs, setRuns] = useState("1");
  const [energy, setEnergy] = useState("0");
  const [toggles, setToggles] = useState({ grantDrops: true, recordAttempts: true });
  const [target, setTarget] = useState("none");
  const [perRun, setPerRun] = useState("0");
  const [stars, setStars] = useState<"3" | "4" | "0">("3");
  const [scoreMode, setScoreMode] = useState("none");
  const [raidDamage, setRaidDamage] = useState("0");
  const [parade, setParade] = useState({
    maxDamage: "0",
    weakness: "0",
    kos: "0",
    taken: "0",
    chain: "0",
  });
  const [paradeStage, setParadeStage] = useState("first");
  const [cow, setCow] = useState({
    maxDamage: "0",
    effective: "0",
    turns: "10",
    chain: "0",
    finalPct: "0",
    gained: "0",
    scale: "10000",
    level: "1",
    levelBonus: "0",
    bonusPct: "0",
  });
  const [cowRating, setCowRating] = useState("S");
  const [master, setMaster] = useState<StoryMaster | null>(null);
  const [fromNode, setFromNode] = useState("0");
  const [toNode, setToNode] = useState("0");
  const [skipCleared, setSkipCleared] = useState(true);
  const [editions, setEditions] = useState<ParadeStages | null>(null);
  const [editionPick, setEditionPick] = useState("0");
  const [partyKey, setPartyKey] = useState("main");
  const [tmrPerClear, setTmrPerClear] = useState("0.1");
  const [bonusPct, setBonusPct] = useState("0");
  const [onlyUncleared, setOnlyUncleared] = useState(false);
  const [slotChoice, setSlotChoice] = useState<Record<number, number[]>>({});
  const [outcome, setOutcome] = useState<AutoplayOutcome | null>(null);
  const [log, setLog] = useState<{ id: number; at: string; text: string }[]>([]);

  void version;

  // only a stage the player actually cleared counts: a save keeps a row for
  // every stage it has touched, and its status says whether it was won
  const progress = new Map<number, number>();
  for (const row of readMissions()) {
    if (Number(row.status) >= 2) {
      progress.set(Number(row.mission_id), Number(row.clears));
    }
  }

  useEffect(() => {
    let alive = true;
    loadParadeStages().then((stages) => {
      if (alive && stages) setEditions(stages);
    });
    loadStoryMaster().then((tree) => {
      if (!alive || !tree) return;
      setMaster(tree);
      const count = tree.worlds
        .flatMap((world) => world.lands)
        .flatMap((land) => land.dungeons)
        .filter((dungeon) => dungeon.missions.length > 0).length;
      setToNode(String(Math.max(0, count - 1)));
    });
    return () => {
      alive = false;
    };
  }, []);

  const teams = useMemo(
    () => readTeams(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const party =
    teams.find((team) => team.key === partyKey) ?? teams[0] ?? null;
  const partyUnitIds = (party?.slots ?? [])
    .map((slot) => slot.unitRowId)
    .filter((id): id is number => typeof id === "number");

  const points = readPointTargets();
  const rewardStages = readRewardStages();

  /** the story tree, in the order the world map walks it: world → land → dungeon → stage */
  const storyNodes = useMemo(() => {
    if (!master) return [] as { label: string; missions: number[] }[];
    const out: { label: string; missions: number[] }[] = [];
    for (const world of master.worlds) {
      for (const land of world.lands) {
        for (const dungeon of land.dungeons) {
          if (dungeon.missions.length === 0) continue;
          out.push({
            label: `${land.name} — ${dungeon.name}`,
            missions: dungeon.missions.map((mission) => mission.id),
          });
        }
      }
    }
    return out;
  }, [master]);

  const paradeMissions = useMemo(() => {
    const out = new Set<number>();
    for (const edition of editions?.editions ?? []) {
      for (const dungeon of edition.dungeons) {
        for (const mission of dungeon.missions) out.add(mission.id);
      }
    }
    return out;
  }, [editions]);

  const rangeStages = (() => {
    if (storyNodes.length === 0) return { total: 0, uncleared: 0 };
    const low = Math.max(0, Math.min(Number(fromNode), Number(toNode)));
    const high = Math.max(Number(fromNode), Number(toNode));
    const ids = storyNodes.slice(low, high + 1).flatMap((node) => node.missions);
    return {
      total: ids.length,
      uncleared: ids.filter((id) => !progress.has(Number(id))).length,
    };
  })();

  const number = (value: string) => Math.max(0, Number(value) || 0);
  const paradeStats = {
    maxDamage: number(parade.maxDamage),
    weakness: number(parade.weakness),
    kos: number(parade.kos),
    taken: number(parade.taken),
    chain: number(parade.chain),
  };
  const clearPoints =
    paradeStage === "final"
      ? PARADE.clearFinal
      : paradeStage === "next"
        ? PARADE.clearNext
        : PARADE.clearFirst;
  const paradeResult = paradeScore(paradeStats, clearPoints);
  const cowStats = {
    maxDamage: number(cow.maxDamage),
    effective: number(cow.effective),
    turns: number(cow.turns),
    chain: number(cow.chain),
    finalMoralePct: Math.min(100, number(cow.finalPct)),
    moraleGained: number(cow.gained),
    moraleScale: number(cow.scale) || 10_000,
  };
  const cowResult = cowScore(cowStats, {
    levelBonus: number(cow.levelBonus),
    bonusPct: number(cow.bonusPct),
  });

  const queueUnclearedStory = () => {
    const entries = rewardStages
      .filter((id) => !progress.has(Number(id)))
      .map((id) => ({
        id: Number(id),
        name: nameFor("missions", id) ?? `Stage ${id}`,
      }));
    if (entries.length === 0) {
      setQuery("");
      return;
    }
    setPicked((current) => {
      const seen = new Set(current.map((entry) => entry.id));
      return [...current, ...entries.filter((entry) => !seen.has(entry.id))];
    });
  };
  /** Adds stage ids to the queue, without duplicates and with their names. */
  const addToQueue = (ids: number[], label: string) => {
    if (ids.length === 0) {
      pushLog(`${label}: nothing to add — that range has no stages.`);
      return;
    }
    const queued = new Set(picked.map((entry) => entry.id));
    const fresh = ids.filter((id) => !queued.has(id));
    if (fresh.length === 0) {
      pushLog(`${label}: all ${ids.length} stage(s) were already in the queue.`);
      return;
    }
    pushLog(`${label}: ${fresh.length} stage(s) queued.`);
    setPicked((current) => {
      const seen = new Set(current.map((entry) => entry.id));
      return [
        ...current,
        ...fresh
          .filter((id) => !seen.has(id))
          .map((id) => ({
            id,
            name: nameFor("missions", String(id)) ?? `Stage ${id}`,
          })),
      ];
    });
  };

  /**
   * The stages of a range the player still has to play. An account that has
   * cleared them all gets the whole range back instead of nothing, and the skip
   * toggle is turned off so the next click matches what is on screen.
   */
  const stagesToQueue = (ids: number[], label: string): number[] => {
    if (!skipCleared) return ids;
    const left = ids.filter((id) => !progress.has(Number(id)));
    if (left.length > 0) return left;
    setSkipCleared(false);
    pushLog(
      `${label}: every stage is already cleared, so all ${ids.length} were queued to replay. The skip toggle is now off.`,
    );
    return ids;
  };

  /** Every stage of one score-attack edition, in its dungeon order. */
  const queueEdition = () => {
    const edition = editions?.editions[Number(editionPick)];
    if (!edition) return;
    if (scoreMode === "none") {
      setScoreMode("parade");
      requestAnimationFrame(() => {
        document
          .getElementById("parade-criteria")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    const ids = edition.dungeons.flatMap((dungeon) =>
      dungeon.missions.map((mission) => mission.id),
    );
    addToQueue(stagesToQueue(ids, `Edition ${editionLabel(edition)}`), `Edition ${editionLabel(edition)}`);
  };

  /** Every stage from one node of the world map to another, in walking order. */
  const queueRange = () => {
    if (storyNodes.length === 0) return;
    const low = Math.max(0, Math.min(Number(fromNode), Number(toNode)));
    const high = Math.max(Number(fromNode), Number(toNode));
    const ids = storyNodes.slice(low, high + 1).flatMap((node) => node.missions);
    const label = `${storyNodes[low]?.label ?? "range"} → ${storyNodes[high]?.label ?? "range"}`;
    addToQueue(stagesToQueue(ids, label), label);
  };

  // score-attack stages, which the catalogue does not name with their edition
  const earner = query.trim().toLowerCase();
  const editionHits: { id: string; name: string }[] =
    earner.length >= 2 && editions
      ? editions.editions
          .flatMap((edition) =>
            edition.dungeons.flatMap((dungeon) =>
              dungeon.missions.map((mission) => ({
                id: String(mission.id),
                name: `${editionLabel(edition)} · ${dungeon.name} · ${mission.name}`,
              })),
            ),
          )
          .filter((hit) => hit.name.toLowerCase().includes(earner))
          .slice(0, 12)
      : [];

  const results = (
    query.trim().length >= 2
      ? searchCatalog("missions", query.trim(), 40).filter((hit) =>
          /^[0-9]+$/.test(hit.id),
        )
      : []
  )
    .filter((hit) => !onlyUncleared || !progress.has(Number(hit.id)))
    .concat(
      editionHits.filter((hit) => !progress.has(Number(hit.id)) || !onlyUncleared),
    )
    .slice(0, 24);

  const slotsFor = (missionId: number): number[] => {
    const known = readObjectives(missionId).map((entry) => entry.slot);
    if (known.length === 0) return [];
    return slotChoice[missionId] ?? known;
  };

  const toggleSlot = (missionId: number, slot: number) => {
    const current = slotsFor(missionId);
    const next = current.includes(slot)
      ? current.filter((value) => value !== slot)
      : [...current, slot].sort();
    setSlotChoice((state) => ({ ...state, [missionId]: next }));
  };

  const addMission = (id: string, name: string) => {
    const numeric = Number(id);
    if (!Number.isFinite(numeric)) return;
    // a Dark Visions / World of Vision stage is scored: show its six axes
    if (scoreMode === "none" && paradeMissions.has(numeric)) {
      setScoreMode("parade");
    }
    setPicked((current) =>
      current.some((entry) => entry.id === numeric)
        ? current
        : [...current, { id: numeric, name }],
    );
  };

  const totalRuns =
    picked.length * Math.max(1, Math.min(999, Number(runs) || 1));

  const pushLog = (text: string) => {
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setLog((current) => [
      { id: (current[0]?.id ?? 0) + 1, at, text },
      ...current,
    ].slice(0, 60));
  };

  const run = () => {
    if (picked.length === 0) {
      setOutcome(null);
      pushLog("Nothing queued — add a stage first.");
      return;
    }
    const result = runAutoplay({
      missionIds: picked.map((entry) => entry.id),
      runs: Math.max(1, Math.min(999, Number(runs) || 1)),
      energyPerRun: Math.max(0, Number(energy) || 0),
      grantDrops: toggles.grantDrops,
      recordAttempts: toggles.recordAttempts,
      stars: Number(stars) === 0 ? 0 : Number(stars) === 4 ? 4 : 3,
      partyUnitIds,
      tmrPerClear: number(tmrPerClear),
      bonusPct: number(bonusPct),
      objectives: Object.fromEntries(
        picked
          .map((entry) => [String(entry.id), slotsFor(entry.id)] as const)
          .filter(([, slots]) => slots.length > 0),
      ),
      scoreTarget:
        scoreMode === "raid"
          ? {
              kind: "raid",
              damage: number(raidDamage),
              dungeonId: points.raidDungeons[0]?.key ?? "0",
            }
          : scoreMode === "parade"
            ? { kind: "parade", stats: paradeStats, clearPoints }
            : scoreMode === "cow"
              ? {
                  kind: "cow",
                  stats: cowStats,
                  level: Math.max(1, number(cow.level)),
                  levelBonus: number(cow.levelBonus),
                  bonusPct: number(cow.bonusPct),
                  rating: cowRating,
                }
              : undefined,
      pointTarget:
        target === "none"
          ? undefined
          : {
              kind: target.startsWith("wave:")
                ? "wave"
                : target.startsWith("area:")
                  ? "raidArea"
                  : "raidClears",
              key: target.includes(":") ? target.split(":")[1] : "",
              perRun: Math.max(0, Number(perRun) || 0),
            },
    });
    setOutcome(result);
    // one line per stage, then the summary last so it sits on top of them
    for (const stage of result.stages) {
      const name =
        nameFor("missions", String(stage.missionId)) ??
        `Stage ${stage.missionId}`;
      const parts = [
        `${formatNumber(stage.stars)} star${stage.stars === 1 ? "" : "s"}`,
        stage.gil > 0 ? `+${formatNumber(stage.gil)} gil` : "",
        stage.items > 0 ? `${formatNumber(stage.items)} items` : "",
        stage.chests > 0 ? `${formatNumber(stage.chests)} chest${stage.chests === 1 ? "" : "s"}` : "",
        stage.rewards > 0 ? `${formatNumber(stage.rewards)} reward mail${stage.rewards === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      pushLog(
        `${name} (${stage.missionId})${stage.cleared ? "" : " · replay"}: ${parts.join(", ")}`,
      );
    }
    pushLog(
      `${formatNumber(result.runs)} run${result.runs === 1 ? "" : "s"} on ${formatNumber(result.missions)} stage${result.missions === 1 ? "" : "s"}: ` +
        `${formatNumber(result.stars)} star${result.stars === 1 ? "" : "s"}, ` +
        `+${formatNumber(result.gil)} gil, ${formatNumber(result.items)} item${result.items === 1 ? "" : "s"}, ` +
        `${formatNumber(result.chests)} chest${result.chests === 1 ? "" : "s"}, ` +
        `${formatNumber(result.rewards)} reward mail${result.rewards === 1 ? "" : "s"}, ` +
        `${formatNumber(result.unlocks)} switch${result.unlocks === 1 ? "" : "es"}`,
    );
    if (result.score > 0) {
      pushLog(
        scoreMode === "parade"
          ? `Dark Visions: best ${formatNumber(result.score)} · ${PARADE_GRADE_NAMES[paradeResult.grade]}`
          : scoreMode === "cow"
            ? `Clash of Wills: ${formatNumber(result.score)} · ${cowRating}`
            : `Raid: +${formatNumber(result.score)} damage`,
      );
    }
    if (result.tmr > 0) {
      pushLog(
        `Trust: +${result.tmr.toFixed(2)}% on ${partyUnitIds.length} unit${partyUnitIds.length === 1 ? "" : "s"}`,
      );
    }
    if (result.points > 0) {
      pushLog(`Event points: +${formatNumber(result.points)}`);
    }
  };

  return (
    <div className="space-y-5">
      <PanelSection
        title="Autoplay"
        description="Replays stages offline: every run writes the same rows a fought battle leaves — a clear, its three stars, gil, drops, the drop log and an attempt row. A stage's own first clear and each star it wins pay their reward as a mail, once: the challenge master's own amounts, never twice. Nothing is sent anywhere; export and push the save when you are happy."
        actions={
          <>
            <span className="mono-id rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {formatNumber(picked.length)} queued · {formatNumber(totalRuns)} run
              {totalRuns === 1 ? "" : "s"}
            </span>
            <Button variant="gold" size="sm" onClick={run} disabled={picked.length === 0}>
              <CirclePlay className="size-4" />
              Run {formatNumber(totalRuns)} run{totalRuns === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <Step
          step="1"
          title="Run settings"
          hint="How many times each queued stage is played, the NRG it costs and the points target."
          aside={
            <span className="mono-id text-[11px] text-muted-foreground">
              {formatNumber(totalRuns)} run{totalRuns === 1 ? "" : "s"}
            </span>
          }
        >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Runs per mission
            </span>
            <Input
              value={runs}
              inputMode="numeric"
              onChange={(event) => setRuns(event.target.value)}
              className="mono-id bg-background/50"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Energy per run
            </span>
            <Input
              value={energy}
              inputMode="numeric"
              onChange={(event) => setEnergy(event.target.value)}
              className="mono-id bg-background/50"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Points target
            </span>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground"
              aria-label="Points target"
            >
              <option value="none">Leave event points</option>
              {points.waves.map((wave) => (
                <option key={`wave-${wave.key}`} value={`wave:${wave.key}`}>
                  Event {wave.key} · {formatNumber(wave.points)} pts
                </option>
              ))}
              {points.raidAreas.map((area) => (
                <option key={`area-${area.key}`} value={`area:${area.key}`}>
                  Raid area {area.key} · {formatNumber(area.points)} pts
                </option>
              ))}
              <option value="clears">Raid clears counter</option>
            </select>
          </div>
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Points per run
            </span>
            <Input
              value={perRun}
              inputMode="numeric"
              onChange={(event) => setPerRun(event.target.value)}
              className="mono-id bg-background/50 disabled:opacity-40"
              disabled={target === "none"}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {TOGGLES.map((toggle) => (
            <button
              key={toggle.key}
              type="button"
              onClick={() =>
                setToggles((current) => ({
                  ...current,
                  [toggle.key]: !current[toggle.key],
                }))
              }
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                toggles[toggle.key]
                  ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:bg-secondary/40",
              )}
            >
              {toggle.label}
            </button>
          ))}
        </div>
        </Step>

        <Step
          step="2"
          title="Stars and score"
          hint="The stars a clear fills in, then the ranking mode and its own criteria."
          aside={
            <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {scoreMode === "none"
                ? "no ranking"
                : scoreMode === "raid"
                  ? "raid"
                  : scoreMode === "parade"
                    ? "dark visions"
                    : "clash of wills"}
            </span>
          }
        >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Objective stars
            </span>
            <select
              value={stars}
              onChange={(event) => setStars(event.target.value as "3" | "4" | "0")}
              className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground"
              aria-label="Objective stars"
            >
              <option value="3">Fill 3 stars</option>
              <option value="4">Fill all 4 stars</option>
              <option value="0">Leave stars empty</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Ranking mode
            </span>
            <select
              value={scoreMode}
              onChange={(event) => setScoreMode(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground"
              aria-label="Ranking score mode"
            >
              <option value="none">Do not touch scores</option>
              <option value="raid">Raid damage</option>
              <option value="parade">Dark Visions / World of Vision</option>
              <option value="cow">Clash of Wills</option>
            </select>
          </label>
        </div>
        {scoreMode !== "none" ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {scoreMode === "raid"
              ? "Damage is added to the raid dungeon and one clear is counted per run."
              : scoreMode === "parade"
                ? "Dark Visions and World of Vision share one formula: six radar axes, and the best score per stage is kept."
                : "Clash of Wills scores seven components of the battle, and the best score of the season is kept."}
          </p>
        ) : null}

        {scoreMode === "raid" ? (
          <div className="mt-3 rounded-lg border border-border/50 bg-background/30 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Damage per run
                </span>
                <Input
                  value={raidDamage}
                  inputMode="numeric"
                  onChange={(event) => setRaidDamage(event.target.value)}
                  className="mono-id bg-background/50"
                />
              </label>
            </div>
            {points.raidDungeons.length > 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Raid dungeon {points.raidDungeons[0].key} · current damage{" "}
                {formatNumber(points.raidDungeons[0].damage)} ·{" "}
                {points.raidDungeons[0].clears} clears
              </p>
            ) : null}
          </div>
        ) : null}

        {scoreMode === "parade" ? (
          <div
            id="parade-criteria"
            className="mt-3 scroll-mt-24 rounded-lg border border-border/50 bg-background/30 p-3"
          >
            <p className="text-[11px] text-muted-foreground">
              Dark Visions and World of Vision score the same six axes. Each box is
              one axis of the result screen; the note under it is the rule the server
              applies.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  key: "maxDamage" as const,
                  label: "Max dmg in 1 turn",
                  hint: "5,000 + damage / 85,899, capped at 30,000",
                },
                {
                  key: "weakness" as const,
                  label: "Weakness attacks",
                  hint: "1,700 per hit, capped at 10,000",
                },
                {
                  key: "kos" as const,
                  label: "KOs",
                  hint: "10,000 minus 1,000 for each unit that fell",
                },
                {
                  key: "taken" as const,
                  label: "Damage taken",
                  hint: "10,000 × (2,000,000 − taken) / 2,000,000",
                },
                {
                  key: "chain" as const,
                  label: "Max chain",
                  hint: "100 per chain point, capped at 10,000",
                },
              ].map((field) => (
                <label key={field.key} className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {field.label}
                  </span>
                  <Input
                    value={parade[field.key]}
                    inputMode="numeric"
                    onChange={(event) =>
                      setParade((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mono-id bg-background/50"
                  />
                  <span className="block text-[10px] leading-tight text-muted-foreground/80">
                    {field.hint}
                  </span>
                </label>
              ))}
              <label className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Clear points
                </span>
                <select
                  value={paradeStage}
                  onChange={(event) => setParadeStage(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground"
                  aria-label="Clear points"
                >
                  <option value="first">First stage · 50,000</option>
                  <option value="next">Middle stage · 100,000</option>
                  <option value="final">Final stage · 250,000</option>
                </select>
                <span className="block text-[10px] leading-tight text-muted-foreground/80">
                  fixed by the stage's place in its dungeon, always paid
                </span>
              </label>
            </div>
            <p className="mono-id mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Score {formatNumber(paradeResult.total)} ·{" "}
                {PARADE_GRADE_NAMES[paradeResult.grade]}
              </span>
              <span>
                clear {formatNumber(paradeResult.clear)} · dmg{" "}
                {formatNumber(paradeResult.damage)} · weak{" "}
                {formatNumber(paradeResult.weakness)} · ko{" "}
                {formatNumber(paradeResult.ko)} · taken{" "}
                {formatNumber(paradeResult.taken)} · chain{" "}
                {formatNumber(paradeResult.chain)}
              </span>
            </p>
          </div>
        ) : null}

        {scoreMode === "cow" ? (
          <div className="mt-3 rounded-lg border border-border/50 bg-background/30 p-3">
            <p className="text-[11px] text-muted-foreground">
              Clash of Wills scores seven components of one battle. The four the
              ranking screen grades are the first boxes; the rest are the morale and
              the season's bonus.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  key: "maxDamage" as const,
                  label: "Max dmg in 1 turn",
                  hint: "30,000 × damage / 2,500,000,000",
                },
                {
                  key: "effective" as const,
                  label: "Effective attacks",
                  hint: "1,700 per weak-point hit, capped at 10,000",
                },
                {
                  key: "turns" as const,
                  label: "Turns for clear",
                  hint: "10,000 at 10 turns, −1,000 per turn after",
                },
                {
                  key: "chain" as const,
                  label: "Max chain",
                  hint: "100 per chain point, capped at 10,000",
                },
                {
                  key: "finalPct" as const,
                  label: "Final morale %",
                  hint: "10,000 at 100% of the bar",
                },
                {
                  key: "gained" as const,
                  label: "Morale gained",
                  hint: "× 30,000 / scale, capped at 30,000",
                },
                {
                  key: "scale" as const,
                  label: "Morale scale",
                  hint: "the mission's own scale, 10,000 by default",
                },
                {
                  key: "level",
                  label: "Level",
                  hint: "the echelon level the battle was fought at",
                },
                {
                  key: "levelBonus" as const,
                  label: "Level bonus",
                  hint: "points the level adds on top of the sum",
                },
                {
                  key: "bonusPct" as const,
                  label: "Options bonus %",
                  hint: "the picked options' % added to the sum",
                },
              ].map((field) => (
                <label key={field.key} className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {field.label}
                  </span>
                  <Input
                    value={cow[field.key]}
                    inputMode="numeric"
                    onChange={(event) =>
                      setCow((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mono-id bg-background/50"
                  />
                  <span className="block text-[10px] leading-tight text-muted-foreground/80">
                    {field.hint}
                  </span>
                </label>
              ))}
              <label className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Rating
                </span>
                <select
                  value={cowRating}
                  onChange={(event) => setCowRating(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground"
                  aria-label="Clash of Wills rating"
                >
                  {["S++", "S+", "S", "A", "B", "C"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="block text-[10px] leading-tight text-muted-foreground/80">
                  shown on the ranking screen, from the sum of the components
                </span>
              </label>
            </div>
            <p className="mono-id mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>Score {formatNumber(cowResult.total)} · max {formatNumber(COW.maxBase)}</span>
              <span>
                clear {formatNumber(cowResult.parts.clear)} · dmg{" "}
                {formatNumber(cowResult.parts.damage)} · eff{" "}
                {formatNumber(cowResult.parts.effective)} · turns{" "}
                {formatNumber(cowResult.parts.turns)} · chain{" "}
                {formatNumber(cowResult.parts.chain)} · morale{" "}
                {formatNumber(cowResult.parts.moraleFinal)} +{" "}
                {formatNumber(cowResult.parts.moraleTotal)}
              </span>
            </p>
          </div>
        ) : null}

        </Step>

        <Step
          step="3"
          title="Party and trust"
          hint="The party a run is fought with: its units gain trust mastery per clear, and its raid/event bonus raises the points every run pays."
        >
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Party
              </span>
              <select
                value={party?.key ?? ""}
                onChange={(event) => setPartyKey(event.target.value)}
                disabled={teams.length === 0}
                className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground disabled:opacity-40"
                aria-label="Party"
              >
                {teams.map((team) => (
                  <option key={team.key} value={team.key}>
                    {team.label}
                  </option>
                ))}
              </select>
              <span className="block text-[10px] leading-tight text-muted-foreground/80">
                {partyUnitIds.length} unit{partyUnitIds.length === 1 ? "" : "s"} in it
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Trust per clear %
              </span>
              <Input
                value={tmrPerClear}
                inputMode="decimal"
                onChange={(event) => setTmrPerClear(event.target.value)}
                className="mono-id bg-background/50"
              />
              <span className="block text-[10px] leading-tight text-muted-foreground/80">
                0.1 = one battle's worth; 0 leaves the gauge alone
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Party bonus %
              </span>
              <Input
                value={bonusPct}
                inputMode="numeric"
                onChange={(event) => setBonusPct(event.target.value)}
                className="mono-id bg-background/50"
              />
              <span className="block text-[10px] leading-tight text-muted-foreground/80">
                added to points per run (raid and event bonus units)
              </span>
            </label>
          </div>
        </Step>

        <Step
          step="4"
          title="Story range — play node A through node X"
          hint="Every stage from the first node to the last, in walking order, so each node opens as the stages before it are cleared."
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground">
              <MapPin className="size-3.5" />
              From / to
            </span>
            <span className="mono-id text-[11px] text-muted-foreground">
              {formatNumber(rangeStages.total)} stages
              {rangeStages.uncleared !== rangeStages.total
                ? ` · ${formatNumber(rangeStages.uncleared)} not cleared`
                : ""}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                From
              </span>
              <select
                value={fromNode}
                onChange={(event) => setFromNode(event.target.value)}
                disabled={storyNodes.length === 0}
                className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground disabled:opacity-40"
                aria-label="Range start"
              >
                {storyNodes.map((node, index) => (
                  <option key={`from-${index}`} value={String(index)}>
                    {node.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                To
              </span>
              <select
                value={toNode}
                onChange={(event) => setToNode(event.target.value)}
                disabled={storyNodes.length === 0}
                className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground disabled:opacity-40"
                aria-label="Range end"
              >
                {storyNodes.map((node, index) => (
                  <option key={`to-${index}`} value={String(index)}>
                    {node.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setSkipCleared((value) => !value)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  skipCleared
                    ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-secondary/40",
                )}
              >
                Skip stages I have cleared
              </button>
              <Button
                size="sm"
                variant="gold"
                onClick={queueRange}
                disabled={storyNodes.length === 0 || rangeStages.total === 0}
              >
                <Sparkles className="size-3.5" />
                Queue range
              </Button>
            </div>
          </div>
        </Step>

        <Step
          step="5"
          title="Score-attack editions"
          hint="Dark Visions and World of Vision. Queue one and the ranking mode switches to Dark Visions, so its six axes are scored for every stage of the edition."
        >
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Edition
              </span>
              <select
                value={editionPick}
                onChange={(event) => setEditionPick(event.target.value)}
                disabled={!editions}
                className="h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm text-foreground disabled:opacity-40"
                aria-label="Score attack edition"
              >
                {(editions?.editions ?? []).map((edition, index) => (
                  <option key={`ed-${edition.area}`} value={String(index)}>
                    {editionLabel(edition)} · {editionStageCount(edition)}{" "}
                    stages
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button
                size="xs"
                variant="subtle"
                onClick={queueEdition}
                disabled={!editions}
              >
                <Sparkles className="size-3.5" />
                Queue this edition
              </Button>
            </div>
          </div>
        </Step>

        <Step
          step="6"
          title="Queue"
          hint="Search a single stage, or review everything the boxes above queued."
          aside={
            <span className="mono-id text-[11px] text-muted-foreground">
              {formatNumber(picked.length)} stage{picked.length === 1 ? "" : "s"}
            </span>
          }
        >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a stage by name or id"
                className="bg-background/50 pl-8"
              />
            </div>
            <button
              type="button"
              onClick={() => setOnlyUncleared((value) => !value)}
              className={cn(
                "mt-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                onlyUncleared
                  ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:bg-secondary/40",
              )}
            >
              Hide stages I have already cleared
            </button>
            {results.length > 0 ? (
              <ul className="mt-2 max-h-64 overflow-auto rounded-xl border border-border/60">
                {results.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => addMission(hit.id, hit.name)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/40"
                    >
                      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {hit.name}
                      </span>
                      <span className="mono-id shrink-0 text-[11px] text-muted-foreground">
                        {hit.id}
                        {progress.has(Number(hit.id))
                          ? ` · ${progress.get(Number(hit.id))}×`
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Type at least two characters. Stage names come from the shipped
                catalogue, so every story, vortex, event and raid stage is here.
              </p>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Queue · {picked.length} mission{picked.length === 1 ? "" : "s"}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={queueUnclearedStory}
                  disabled={rewardStages.length === 0}
                >
                  <Sparkles className="size-3.5" />
                  All uncleared story
                </Button>
                <Button
                  size="xs"
                  variant="quiet"
                  onClick={() => setPicked([])}
                  disabled={picked.length === 0}
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-category-equip/30 bg-category-equip/5 px-2.5 py-2">
              <Button
                size="sm"
                variant="gold"
                onClick={run}
                disabled={picked.length === 0}
              >
                <CirclePlay className="size-4" />
                Run {formatNumber(totalRuns)} run{totalRuns === 1 ? "" : "s"}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                starts the queue in order — this button and the one at the top of
                the panel do the same thing
              </span>
            </div>
            <ul className="mt-2 max-h-64 overflow-auto rounded-xl border border-border/60">
              {picked.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nothing queued yet.
                </li>
              ) : null}
              {picked.map((entry) => {
                const objectives = readObjectives(entry.id);
                const active = slotsFor(entry.id);
                const reward = readStageReward(entry.id);
                return (
                  <li
                    key={entry.id}
                    className="border-b border-border/40 px-3 py-2 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {entry.name || nameFor("missions", String(entry.id)) || "Unnamed stage"}
                        </span>
                        <span className="mono-id block text-[11px] text-muted-foreground">
                          {entry.id}
                          {reward
                            ? ` · ${formatNumber(reward.gil)} gil · ${reward.entries} drop entr${reward.entries === 1 ? "y" : "ies"}`
                            : " · no drop table"}
                        </span>
                      </span>
                      <Button
                        size="xs"
                        variant="quiet"
                        aria-label={`Remove ${entry.id}`}
                        onClick={() =>
                          setPicked((current) =>
                            current.filter((item) => item.id !== entry.id),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {objectives.length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-1">
                        {objectives.map((objective) => {
                          const on = active.includes(objective.slot);
                          return (
                            <li key={`${entry.id}-${objective.slot}`}>
                              <button
                                type="button"
                                onClick={() => toggleSlot(entry.id, objective.slot)}
                                title={objective.name}
                                className={cn(
                                  "max-w-[22rem] truncate rounded-md border px-1.5 py-0.5 text-[10px] transition-colors",
                                  on
                                    ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                                    : "border-border/60 text-muted-foreground line-through",
                                )}
                              >
                                {objective.name}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        </Step>

        <Step
          step="7"
          title="Results and log"
          hint="What the last run paid, and every run before it."
          aside={
            <span className="mono-id text-[11px] text-muted-foreground">
              {formatNumber(log.length)} entr{log.length === 1 ? "y" : "ies"}
            </span>
          }
        >
        {outcome ? (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Runs", value: formatNumber(outcome.runs), icon: CirclePlay },
              { label: "Stars", value: formatNumber(outcome.stars), icon: Sparkles },
              { label: "Gil", value: formatNumber(outcome.gil), icon: Coins },
              { label: "Items", value: formatNumber(outcome.items), icon: Plus },
              { label: "Points", value: formatNumber(outcome.points), icon: Zap },
              { label: "Best score", value: formatNumber(outcome.score), icon: Sparkles },
              {
                label: "Energy spent",
                value: formatNumber(outcome.energySpent),
                icon: Zap,
              },
              {
                label: "Switches",
                value: formatNumber(outcome.unlocks),
                icon: MapPin,
              },
              {
                label: "Chests",
                value: formatNumber(outcome.chests),
                icon: Coins,
              },
              {
                label: "Mail",
                value: formatNumber(outcome.rewards),
                icon: Mail,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-border/70 bg-secondary/25 p-3"
              >
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tile.icon className="size-3" />
                  {tile.label}
                </span>
                <p className="mono-id mt-1 text-lg text-foreground">{tile.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-border/60 bg-secondary/15">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <ScrollText className="size-3.5" />
              Log · {log.length}
            </span>
            <Button
              size="xs"
              variant="quiet"
              onClick={() => setLog([])}
              disabled={log.length === 0}
            >
              <Trash2 className="size-3.5" />
              Clear
            </Button>
          </div>
          <ul className="max-h-52 space-y-1 overflow-auto px-3 py-2">
            {log.length === 0 ? (
              <li className="text-[11px] text-muted-foreground">
                Nothing run yet. Every run writes what it cleared, what it paid and
                the score it set here.
              </li>
            ) : null}
            {log.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-[11px] leading-snug">
                <span className="mono-id shrink-0 text-muted-foreground/70">
                  {entry.at}
                </span>
                <span className="text-foreground/90">{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
        </Step>
      </PanelSection>

      <InlineNote icon={CirclePlay}>
        Every battle stage of the server's monster masters ships a drop table — 980
        story stages and 11,972 vortex, raid, event, esper and episode stages — so a
        run pays the gil its enemies carry and rolls every entry of their drop tables
        at its own rate, exactly like the client does per kill. Exploration maps draw
        their enemies per walk, so their battles pay nothing — but their 1,010 chests
        open once each (contents paid, switch lit, `treasure_open` row) and their
        collection points hand out a draw from the area's pool on every run. A clear
        also lights the stage's switches and the map events those unlock.
      </InlineNote>
    </div>
  );
};
