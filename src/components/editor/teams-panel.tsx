import { useMemo, useState } from "react";
import {
  Check,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Swords,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSave } from "@/state/save-context";
import { CatalogCombobox } from "./catalog-combobox";
import { IdChip, InlineNote, PanelSection } from "./primitives";
import { formatNumber } from "@/lib/ffbe/format";
import type { LoadoutKind, TeamSlot } from "@/lib/ffbe/types";
import { cn } from "@/lib/utils";

const deckCoords = (key: string): { partyType: number; deckNo: number } => {
  const [kind, a, b] = key.split(":");
  if (kind === "main") return { partyType: 0, deckNo: 0 };
  if (kind === "type") return { partyType: Number(a), deckNo: Number(b) };
  return { partyType: 1, deckNo: Number(a) };
};

const EQUIP_SLOTS = 6;
const MATERIA_SLOTS = 5;

const UnitPicker = ({
  open,
  onOpenChange,
  onPick,
  unitName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (unitRowId: number, unitId: string) => void;
  unitName: (id: string) => string | null;
}) => {
  const { readUnitGroups } = useSave();
  const [query, setQuery] = useState("");
  void open;
  const groups = readUnitGroups();
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? groups.filter(
        (group) =>
          group.unit_id.includes(needle) ||
          (unitName(group.unit_id) ?? "").toLowerCase().includes(needle),
      )
    : groups;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-category-equip" />
            Pick a unit
          </DialogTitle>
          <DialogDescription>
            Only units that exist in this account can be placed in a slot.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a name or unit id"
            className="bg-background/50 pl-8"
          />
        </div>
        <ul className="max-h-[46vh] overflow-auto rounded-xl border border-border/60">
          {matches.slice(0, 200).map((group) => (
            <li key={group.unit_id} className="border-b border-border/40 last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onPick(group.ids[0], group.unit_id);
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/50"
              >
                <IdChip
                  id={group.unit_id}
                  name={unitName(group.unit_id) ?? "Unnamed unit"}
                />
                <span className="mono-id shrink-0 text-[11px] text-muted-foreground">
                  ★{group.bestRarity} · Lv {group.bestLevel} · ×{group.copies}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No unit matches that search.
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

const SlotCard = ({
  slot,
  label,
  unitName,
  onPick,
  onClear,
  onSelect,
}: {
  slot: TeamSlot;
  label: string;
  unitName: (rowId: number) => { id: string; name: string | null } | null;
  onPick: () => void;
  onClear: () => void;
  onSelect: () => void;
}) => {
  const unit = slot.unitRowId ? unitName(slot.unitRowId) : null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        unit
          ? "border-category-equip/30 bg-category-equip/[0.06]"
          : "border-dashed border-border/70 bg-secondary/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {unit ? (
          <span className="flex items-center gap-1">
            <Button
              size="xs"
              variant="quiet"
              aria-label={`Change the unit in ${label}`}
              onClick={onPick}
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              size="xs"
              variant="quiet"
              aria-label={`Clear ${label}`}
              onClick={onClear}
            >
              <X className="size-3.5" />
            </Button>
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={unit ? onSelect : onPick}
        className="min-w-0 text-left"
      >
        {unit ? (
          <>
            <p className="truncate text-sm text-foreground">
              {unit.name ?? "Unnamed unit"}
            </p>
            <p className="mono-id mt-0.5 truncate text-[11px] text-muted-foreground">
              {unit.id} · row {slot.unitRowId}
            </p>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Plus className="size-3.5" /> empty slot
          </span>
        )}
      </button>
    </div>
  );
};

const GearSlot = ({
  kind,
  index,
  value,
  onSet,
  owned,
}: {
  kind: LoadoutKind;
  index: number;
  value: string;
  onSet: (next: string) => void;
  owned: Map<string, number>;
}) => {
  const { nameFor } = useSave();
  return (
    <div className="space-y-1.5 rounded-xl border border-border/60 bg-secondary/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {kind === "equip" ? "Equip" : "Materia"} {index + 1}
        </span>
        {value ? (
          <span className="mono-id text-[10px] text-category-equip">
            ×{formatNumber(owned.get(value) ?? 0)}
          </span>
        ) : null}
      </div>
      <CatalogCombobox
        bucket={kind === "equip" ? "equip" : "materia"}
        value={value}
        onChange={onSet}
        placeholder={kind === "equip" ? "gear id or name" : "materia id or name"}
        ariaLabel={`${kind} slot ${index + 1}`}
        ownedFor={(id) => owned.get(id)}
        inputClassName="h-8 text-xs"
      />
      <p className="truncate text-[11px] text-muted-foreground">
        {value ? nameFor(kind === "equip" ? "equip" : "materia", value) ?? "unnamed" : "empty"}
      </p>
    </div>
  );
};

export const TeamsPanel = ({ initialSearch = "" }: { initialSearch?: string }) => {
  const {
    readTeams,
    setTeamSlot,
    renameDeck,
    readLoadout,
    setLoadoutSlot,
    readInventory,
    nameFor,
    version,
  } = useSave();
  void version;
  const teams = readTeams();
  const [deckKey, setDeckKey] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [gearDeck, setGearDeck] = useState<string>("main");
  const [nameDraft, setNameDraft] = useState("");
  const [search, setSearch] = useState(initialSearch);

  const active = teams.find((team) => team.key === deckKey) ?? teams[0] ?? null;
  const coords = deckCoords(gearDeck);
  const loadout = selectedRow
    ? readLoadout(selectedRow, coords.partyType, coords.deckNo)
    : null;

  const { readUnitGroups } = useSave();
  const rowIndex = new Map<number, string>();
  for (const group of readUnitGroups()) {
    for (const id of group.ids) rowIndex.set(id, group.unit_id);
  }
  const unitNameFor = (unitId: string) => nameFor("units", unitId);
  const rowLabel = (rowId: number) => {
    const unitId = rowIndex.get(rowId);
    if (!unitId) return null;
    return { id: unitId, name: unitNameFor(unitId) };
  };

  const equipStock = new Map<string, number>();
  for (const row of readInventory("equip")) equipStock.set(row.item_id, row.count);
  const materiaStock = new Map<string, number>();
  for (const row of readInventory("materia")) materiaStock.set(row.item_id, row.count);

  const needle = search.trim().toLowerCase();
  const matching = needle
    ? teams.filter((team) =>
        team.slots.some((slot) => {
          const unit = slot.unitRowId ? rowLabel(slot.unitRowId) : null;
          return (
            (unit?.name ?? "").toLowerCase().includes(needle) ||
            (unit?.id ?? "").includes(needle)
          );
        }),
      )
    : [];

  return (
    <div className="space-y-5">
      <PanelSection
        title="Teams"
        description="Every deck stored in this save: the active party, the saved decks and the arena/stage decks. Pick a unit to edit its gear below."
        actions={
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a unit in your decks"
              className="h-8 bg-background/50 pl-8 text-sm"
            />
          </div>
        }
      >
        {teams.length === 0 ? (
          <InlineNote icon={Layers}>
            This save has no party tables, so there is nothing to arrange.
          </InlineNote>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((team) => {
                const isActive = active?.key === team.key;
                return (
                  <button
                    key={team.key}
                    type="button"
                    onClick={() => {
                      setDeckKey(team.key);
                      setNameDraft(team.name);
                      setSelectedRow(null);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      isActive
                        ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                        : "border-border/70 text-muted-foreground hover:bg-secondary/40",
                    )}
                  >
                    {team.label}
                  </button>
                );
              })}
            </div>

            {matching.length > 0 ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {matching.length} deck{matching.length === 1 ? "" : "s"} contain a
                  matching unit:
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {matching.map((team) => (
                    <button
                      key={team.key}
                      type="button"
                      onClick={() => setDeckKey(team.key)}
                      className="rounded-md border border-border/70 px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary/50"
                    >
                      {team.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {active ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {active.key === "main" ? (
                    <p className="text-xs text-muted-foreground">
                      The active party is the deck the game uses for story quests.
                    </p>
                  ) : (
                    <>
                      <Input
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        placeholder="Deck name"
                        className="mono-id h-8 w-48 bg-background/50 text-xs"
                        aria-label="Deck name"
                      />
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => renameDeck(active.key, nameDraft)}
                      >
                        <Check className="size-3.5" />
                        Save name
                      </Button>
                    </>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {active.slots.map((slot) => (
                    <SlotCard
                      key={slot.position}
                      slot={slot}
                      label={`Slot ${slot.position + 1}`}
                      unitName={rowLabel}
                      onPick={() => setPicking(slot.position)}
                      onSelect={() => {
                        if (slot.unitRowId) {
                          setSelectedRow(slot.unitRowId);
                          setGearDeck(active.key);
                        }
                      }}
                      onClear={() => setTeamSlot(active.key, slot.position, null)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </PanelSection>

      <PanelSection
        title="Gear"
        description="Equipment and materia bound to a unit row. Slots come from the save's own loadout string; the second saved set is left untouched."
        actions={
          selectedRow ? (
            <Button size="xs" variant="quiet" onClick={() => setSelectedRow(null)}>
              <X className="size-3.5" />
              Close
            </Button>
          ) : null
        }
      >
        {selectedRow === null ? (
          <InlineNote icon={Shield}>
            Select a unit above to edit its six equipment slots, five materia slots
            and vision card.
          </InlineNote>
        ) : !loadout ? (
          <InlineNote icon={Shield} tone="warning">
            No loadout row exists for this unit yet — pick any slot below to create
            one.
          </InlineNote>
        ) : null}

        {selectedRow !== null ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <UserRound className="size-4 text-category-equip" />
              <span className="text-sm text-foreground">
                {rowLabel(selectedRow)?.name ?? "Unnamed unit"}
              </span>
              <span className="rounded-md border border-border/70 bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {teams.find((team) => team.key === gearDeck)?.label ?? "Active party"}
              </span>
              <span className="mono-id text-xs text-muted-foreground">
                {rowLabel(selectedRow)?.id} · row {selectedRow}
              </span>
            </div>

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Swords className="size-3.5" /> Equipment
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: EQUIP_SLOTS }, (_, index) => (
                  <GearSlot
                    key={`equip-${index}`}
                    kind="equip"
                    index={index}
                    value={loadout?.equip[index] ?? ""}
                    owned={equipStock}
                    onSet={(next) =>
                      setLoadoutSlot(
                        selectedRow,
                        coords.partyType,
                        coords.deckNo,
                        "equip",
                        index,
                        next,
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" /> Materia
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: MATERIA_SLOTS }, (_, index) => (
                  <GearSlot
                    key={`materia-${index}`}
                    kind="materia"
                    index={index}
                    value={loadout?.materia[index] ?? ""}
                    owned={materiaStock}
                    onSet={(next) =>
                      setLoadoutSlot(
                        selectedRow,
                        coords.partyType,
                        coords.deckNo,
                        "materia",
                        index,
                        next,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </PanelSection>

      <UnitPicker
        open={picking !== null}
        onOpenChange={(open) => {
          if (!open) setPicking(null);
        }}
        unitName={unitNameFor}
        onPick={(rowId) => {
          if (active && picking !== null) setTeamSlot(active.key, picking, rowId);
          setPicking(null);
          setSelectedRow(rowId);
          if (active) setGearDeck(active.key);
        }}
      />
    </div>
  );
};
