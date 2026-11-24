import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Settings2, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { UnitGroup } from "@/lib/ffbe/types";
import { UnitGroupDialog } from "./unit-group-dialog";
import { formatNumber, parseIdList } from "@/lib/ffbe/format";
import { CategoryDot, IdChip, InlineNote, PanelSection } from "./primitives";

const RARITY_LABEL = (rarity: number) => `${Math.max(1, rarity)}-star`;

const AddUnitDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { addUnits, metaFor, nameFor } = useSave();
  const [unitId, setUnitId] = useState("");
  const [pasted, setPasted] = useState("");
  const [copies, setCopies] = useState("1");
  const [level, setLevel] = useState("1");
  const [rarity, setRarity] = useState("3");
  const [lb, setLb] = useState("0");
  const [awake, setAwake] = useState("0");

  const pastedIds = parseIdList(pasted);
  const ready = pastedIds.length > 0 || /^\d+$/.test(unitId.trim());

  const submit = () => {
    const shared = {
      level: Number(level) || 1,
      rarity: Number(rarity) || 3,
      lb: Number(lb) || 0,
      awake: Number(awake) || 0,
      copies: Number(copies) || 1,
    };
    if (pastedIds.length > 0) {
      for (const id of pastedIds) addUnits({ unitId: id, ...shared, copies: 1 });
    } else {
      addUnits({ unitId: unitId.trim(), ...shared });
    }
    setUnitId("");
    setPasted("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-category-equip" />
            Add units
          </DialogTitle>
          <DialogDescription>
            Each copy becomes its own roster row, exactly like a summon. Nothing is
            retro-granted — the unit simply exists after the game reloads the save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="unit-id" className="text-xs text-muted-foreground">
              Unit ID
            </Label>
            <Input
              id="unit-id"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              placeholder="e.g. 100046007"
              className="mono-id bg-background/50"
            />
            {unitId.trim() ? (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const id = unitId.trim();
                  const name = nameFor("units", id) ?? "unknown unit";
                  const info = metaFor("units", id);
                  const range =
                    info?.rarityMin && info?.rarityMax
                      ? ` · ${info.rarityMin}★–${info.rarityMax}★`
                      : "";
                  return `${name}${range}`;
                })()}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { id: "unit-copies", label: "Copies", value: copies, set: setCopies },
              { id: "unit-level", label: "Level", value: level, set: setLevel },
              { id: "unit-rarity", label: "Rarity", value: rarity, set: setRarity },
              { id: "unit-lb", label: "LB level", value: lb, set: setLb },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id} className="text-xs text-muted-foreground">
                  {field.label}
                </Label>
                <Input
                  id={field.id}
                  value={field.value}
                  inputMode="numeric"
                  onChange={(event) => field.set(event.target.value)}
                  className="mono-id h-9 bg-background/50"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit-awake" className="text-xs text-muted-foreground">
                Awakening
              </Label>
              <Input
                id="unit-awake"
                value={awake}
                inputMode="numeric"
                onChange={(event) => setAwake(event.target.value)}
                className="mono-id h-9 bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unit-paste" className="text-xs text-muted-foreground">
              Or paste a list of IDs (one per line, or comma separated)
            </Label>
            <Textarea
              id="unit-paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={"100046007\n100046507, 100047007"}
              className="mono-id min-h-[74px] bg-background/50 text-xs"
            />
            {pastedIds.length > 0 ? (
              <p className="text-xs text-category-equip">
                {pastedIds.length} IDs ready — one copy each.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!ready} onClick={submit}>
            Add to roster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const UnitsPanel = ({ initialSearch = "" }: { initialSearch?: string }) => {
  const { readUnitGroups, addUnits, removeUnitCopies, nameFor, version, summary } =
    useSave();
  const [search, setSearch] = useState(initialSearch);
  const [limit, setLimit] = useState(40);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UnitGroup | null>(null);

  const groups = useMemo(
    () => readUnitGroups(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (group) =>
        group.unit_id.toLowerCase().includes(query) ||
        (nameFor("units", group.unit_id) ?? "").toLowerCase().includes(query),
    );
  }, [groups, search, nameFor]);

  useEffect(() => {
    setLimit(40);
  }, [search]);

  return (
    <div className="space-y-5">
      <PanelInfo />

      <PanelSection
        title="Roster"
        description="Grouped by unit ID so duplicates stay visible. Removing takes the lowest-level copies first."
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add units
          </Button>
        }
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="flex flex-col gap-2 border-b border-border/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search units by ID or name"
              className="h-9 bg-background/50 pl-8 text-sm"
            />
          </div>
          <span className="mono-id text-xs text-muted-foreground">
            {formatNumber(summary.distinctUnits)} unit types ·{" "}
            {formatNumber(summary.units)} copies
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <Users className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {groups.length === 0
                ? "This roster is empty — add a unit ID to start."
                : "No unit matches that search."}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.slice(0, limit).map((group) => (
              <li
                key={group.unit_id}
                className="row-hover flex flex-col gap-3 border-b border-border/50 px-5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <CategoryDot category="unit" />
                  <IdChip id={group.unit_id} name={nameFor("units", group.unit_id)} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-muted-foreground">
                    ×{formatNumber(group.copies)}
                  </span>
                  <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-muted-foreground">
                    Lv {group.bestLevel}
                  </span>
                  <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-muted-foreground">
                    {RARITY_LABEL(group.bestRarity)}
                  </span>
                  <Button
                    size="xs"
                    variant="quiet"
                    aria-label={`Add one copy of ${group.unit_id}`}
                    onClick={() =>
                      addUnits({
                        unitId: group.unit_id,
                        copies: 1,
                        level: group.bestLevel,
                        rarity: group.bestRarity,
                        lb: group.bestLb,
                        awake: group.bestAwake,
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    size="xs"
                    variant="quiet"
                    aria-label={`Remove one copy of ${group.unit_id}`}
                    onClick={() => removeUnitCopies(group.unit_id, 1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    aria-label={`Edit every copy of ${group.unit_id}`}
                    onClick={() => setEditing(group)}
                  >
                    <Settings2 className="size-3.5" />
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {filtered.length > limit ? (
          <div className="flex justify-center border-t border-border/50 px-5 py-3 sm:px-6">
            <Button variant="quiet" size="sm" onClick={() => setLimit(limit + 40)}>
              Show more ({formatNumber(filtered.length - limit)} left)
            </Button>
          </div>
        ) : null}
      </PanelSection>

      <AddUnitDialog open={addOpen} onOpenChange={setAddOpen} />
      <UnitGroupDialog
        key={editing?.unit_id ?? "empty"}
        group={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
};

const PanelInfo = () => (
  <InlineNote icon={Users}>
    A unit is stored as one roster row plus its level, rarity and awakening.
    Adding copies is safe; the game keeps the newest rows and shows them as
    duplicates in the unit list.
  </InlineNote>
);
