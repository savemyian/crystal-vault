import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Flag,
  ListChecks,
  RotateCw,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSave } from "@/state/save-context";
import { formatEpoch, formatNumber, parseIdList } from "@/lib/ffbe/format";
import { CategoryDot, IdChip, InlineNote, PanelSection } from "./primitives";

export const MissionsPanel = ({ initialSearch = "" }: { initialSearch?: string }) => {
  const {
    readMissions,
    readSideMissions,
    clearMissions,
    claimSideMissions,
    nameFor,
    summary,
    version,
  } = useSave();

  const [search, setSearch] = useState(initialSearch);
  const [ids, setIds] = useState("");
  const [limit, setLimit] = useState(60);
  const [confirmAll, setConfirmAll] = useState(false);

  const missions = useMemo(
    () => readMissions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const side = useMemo(
    () => readSideMissions(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const unclaimed = side.filter((row) => !row.claimed_at);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return missions;
    return missions.filter(
      (mission) =>
        String(mission.mission_id).includes(query) ||
        (nameFor("missions", String(mission.mission_id)) ?? "")
          .toLowerCase()
          .includes(query),
    );
  }, [missions, search, nameFor]);

  const pendingIds = parseIdList(ids);

  return (
    <div className="space-y-5">
      <InlineNote icon={AlertTriangle} tone="warning">
        A save file only records results. The editor can flag a mission as cleared,
        but it cannot play the fight, and the first-clear rewards the game hands out
        after a real battle are not created here. Story scenes may also stay as they
        are until the game itself advances the story.
      </InlineNote>

      <PanelSection
        title="Mark missions cleared"
        description="Use mission IDs from the game's mission list. IDs that already exist keep their clear date and gain a clear count."
        actions={
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setConfirmAll(true)}
            disabled={missions.length === 0}
          >
            <CheckCheck className="size-4" />
            Mark all existing
          </Button>
        }
      >
        <div className="space-y-3">
          <Textarea
            value={ids}
            onChange={(event) => setIds(event.target.value)}
            placeholder={"Mission IDs, one per line or comma separated\n1110301\n1110302, 95290106"}
            className="mono-id min-h-[90px] bg-background/50 text-xs"
            aria-label="Mission IDs"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {pendingIds.length > 0
                ? `${pendingIds.length} ID${pendingIds.length === 1 ? "" : "s"} ready`
                : "No IDs parsed yet."}
            </p>
            <Button
              size="sm"
              disabled={pendingIds.length === 0}
              onClick={() => {
                clearMissions(pendingIds.map(Number));
                setIds("");
              }}
            >
              <Flag className="size-4" />
              Mark cleared
            </Button>
          </div>
        </div>
      </PanelSection>

      <PanelSection
        title="Cleared missions"
        description="Every mission row stored for this account."
        actions={
          <span className="mono-id text-xs text-muted-foreground">
            {formatNumber(summary.missions)} rows ·{" "}
            {formatNumber(summary.challenges)} objectives
          </span>
        }
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="border-b border-border/60 px-5 py-3 sm:px-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search mission ID or name"
              className="h-9 bg-background/50 pl-8 text-sm"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <ListChecks className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {missions.length === 0
                ? "No mission rows yet for this account."
                : "No mission matches that search."}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.slice(0, limit).map((mission) => (
              <li
                key={mission.mission_id}
                className="row-hover flex flex-col gap-2 border-b border-border/50 px-5 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <CategoryDot category="mission" />
                  <IdChip
                    id={String(mission.mission_id)}
                    name={nameFor("missions", String(mission.mission_id))}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1">
                    clears {formatNumber(mission.clears)}
                  </span>
                  <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1">
                    {formatEpoch(mission.first_clear_at)}
                  </span>
                  <Button
                    size="xs"
                    variant="quiet"
                    onClick={() => clearMissions([mission.mission_id])}
                  >
                    <RotateCw className="size-3.5" />
                    Clear again
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {filtered.length > limit ? (
          <div className="flex justify-center border-t border-border/50 px-5 py-3 sm:px-6">
            <Button variant="quiet" size="sm" onClick={() => setLimit(limit + 60)}>
              Show more ({formatNumber(filtered.length - limit)} left)
            </Button>
          </div>
        ) : null}
      </PanelSection>

      <PanelSection
        title="Side missions"
        description="Objective-style tasks with their own claim state."
        actions={
          <Button
            size="sm"
            variant="subtle"
            onClick={claimSideMissions}
            disabled={summary.sideMissions === 0}
          >
            <Sparkles className="size-4" />
            Claim all
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Tracked
            </p>
            <p className="mono-id mt-1 text-lg font-semibold">
              {formatNumber(summary.sideMissions)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Unclaimed
            </p>
            <p className="mono-id mt-1 text-lg font-semibold">
              {formatNumber(unclaimed.length)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Claimed
            </p>
            <p className="mono-id mt-1 text-lg font-semibold">
              {formatNumber(side.length - unclaimed.length)}
            </p>
          </div>
        </div>

        {unclaimed.length > 0 ? (
          <ul className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-border/70">
            {unclaimed.slice(0, 40).map((mission) => (
              <li
                key={mission.mission_id}
                className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-xs last:border-b-0"
              >
                <IdChip id={mission.mission_id} />
                <span className="text-muted-foreground">
                  progress {formatNumber(mission.progress)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Nothing waiting to be claimed on this account.
          </p>
        )}
      </PanelSection>

      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent className="max-w-md border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">Mark every existing mission cleared?</DialogTitle>
            <DialogDescription>
              All {formatNumber(missions.length)} mission rows for this account get
              status cleared and one extra clear. This cannot grant rewards — it only
              rewrites the saved record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                clearMissions(missions.map((mission) => mission.mission_id));
                setConfirmAll(false);
              }}
            >
              Mark all cleared
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
