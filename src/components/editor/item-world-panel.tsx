import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarRange,
  Gem,
  Info,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSave } from "@/state/save-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogCombobox } from "@/components/editor/catalog-combobox";
import { InlineNote, PanelSection, StatTile } from "@/components/editor/primitives";
import { formatNumber } from "@/lib/ffbe/format";
import {
  loadAbilityNames,
  searchAbilityNames,
  type AbilityNames,
} from "@/lib/ffbe/ability-names";
import {
  exAbilityId,
  normalizeExLearn,
  parseExInput,
} from "@/lib/ffbe/item-world";
import type { ItemWorldEquip } from "@/lib/ffbe/types";

const equipLabel = (
  baseItemId: string,
  name: string | null,
  customId: number,
) => {
  const base = name ?? `Unnamed base ${baseItemId}`;
  return `${base} (item ${customId})`;
};

const formatDate = (epoch: number | null) => {
  if (!epoch) return null;
  const date = new Date(epoch * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const abilityLabel = (names: AbilityNames | null, id: number | null) =>
  id === null ? null : (names?.[String(id)]?.en ?? null);

/**
 * Ability input that turns the shipped passive table into a name search. A
 * numeric id still works when the table has no name for it.
 */
const AbilitySearch = ({
  names,
  onPick,
  placeholder,
  ariaLabel,
  inputClassName,
}: {
  names: AbilityNames | null;
  onPick: (tokens: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  inputClassName?: string;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(
    () => searchAbilityNames(names, query, 8),
    [names, query],
  );
  const show = open && matches.length > 0;
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));

  const pick = (id: string) => {
    onPick([`24:${id}`]);
    setQuery("");
    setOpen(false);
  };

  const addTyped = () => {
    const tokens = parseExInput(query);
    if (tokens.length > 0) {
      onPick(tokens);
      setQuery("");
      setOpen(false);
      return;
    }
    // "ATK +1000 x3" or "3x ATK +1000": an exact name plus a copy count.
    const trailing = query.match(/^(.*?)\s*[x*]\s*(\d{1,2})$/i);
    const leading = query.match(/^(\d{1,2})\s*[x*]\s*(.*)$/i);
    const namePart = (trailing?.[1] ?? leading?.[2] ?? "").trim();
    const nameQuery = namePart || (trailing || leading ? "" : query.trim());
    const copies = Number(trailing?.[2] ?? leading?.[1] ?? 1);
    if (nameQuery && names) {
      const needle = nameQuery.toLowerCase();
      const exact = Object.entries(names).filter(
        ([, entry]) =>
          entry.en.toLowerCase() === needle || entry.ja === nameQuery,
      );
      if (exact.length === 1) {
        const token = `24:${exact[0][0]}`;
        const amount = Number.isFinite(copies)
          ? Math.max(1, Math.min(99, Math.floor(copies)))
          : 1;
        onPick(Array.from({ length: amount }, () => token));
        setQuery("");
        setOpen(false);
        return;
      }
    }
    toast.error("Pick the ability from the list, or enter a numeric id.");
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive(Math.min(activeIndex + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(Math.max(0, activeIndex - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (show) pick(matches[activeIndex].id);
            else addTyped();
          } else if (event.key === "Escape" && show) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={show}
        aria-autocomplete="list"
        autoComplete="off"
        className={`bg-background/50 pl-8 ${inputClassName ?? ""}`}
      />

      {show ? (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {matches.map((entry, index) => (
            <li key={entry.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(entry.id)}
                title={entry.ja || entry.name}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                  index === activeIndex
                    ? "bg-secondary/70 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {entry.name}
                </span>
                <span className="mono-id shrink-0 text-[11px] text-muted-foreground">
                  {entry.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const AbilityChip = ({
  token,
  label,
  onDuplicate,
  duplicateLabel,
  onRemove,
  removeLabel,
}: {
  token: string;
  label: string | null;
  onDuplicate?: () => void;
  duplicateLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) => (
  <li className="inline-flex items-center gap-1.5 rounded-lg border border-category-equip/30 bg-category-equip/10 py-1 pl-2 pr-1 text-xs text-foreground">
    <Sparkles className="size-3 shrink-0 text-category-equip" aria-hidden="true" />
    <span className="flex min-w-0 flex-col leading-tight">
      {label ? <span className="truncate text-xs">{label}</span> : null}
      <span
        className={`mono-id ${label ? "text-[10px] text-muted-foreground" : "text-xs"}`}
        title={token}
      >
        {token}
      </span>
    </span>
    {onDuplicate ? (
      <button
        type="button"
        onClick={onDuplicate}
        className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-category-equip/15 hover:text-category-equip"
        aria-label={duplicateLabel}
        title="Add another copy"
      >
        <Plus className="size-3" />
      </button>
    ) : null}
    {onRemove ? (
      <button
        type="button"
        onClick={onRemove}
        className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        aria-label={removeLabel}
      >
        <X className="size-3" />
      </button>
    ) : null}
  </li>
);

const EquipCard = ({
  equip,
  name,
  names,
  others,
  onSetEx,
  onRestore,
  onCopy,
  onName,
}: {
  equip: ItemWorldEquip;
  name: string | null;
  names: AbilityNames | null;
  others: { customId: number; label: string }[];
  onSetEx: (tokens: string[]) => void;
  onRestore: () => void;
  onCopy: (fromCustomId: number) => void;
  onName: (next: string) => void;
}) => {
  const [label, setLabel] = useState("");
  const [copyFrom, setCopyFrom] = useState<string>("");

  const commitLabel = () => {
    const next = label.trim();
    if (!next) return;
    onName(next);
    setLabel("");
  };

  const addAbilities = (tokens: string[]) => {
    onSetEx(normalizeExLearn([...equip.exLearn, ...tokens]));
  };

  const copySource = copyFrom || (others[0] ? String(others[0].customId) : "");
  const created = formatDate(equip.createdAt);

  return (
    <li className="rounded-xl border border-border/70 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {name ?? `Unnamed base item ${equip.baseItemId}`}
          </p>
          <p className="mono-id mt-0.5 text-[11px] text-muted-foreground">
            item {equip.customId} · base {equip.baseItemId}
            {equip.stock > 0
              ? ` · ×${formatNumber(equip.stock)} in stock`
              : " · not in stock"}
          </p>
          {name === null ? (
            <div className="mt-1.5 flex items-center gap-1">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitLabel();
                }}
                placeholder="label this base item"
                className="h-7 w-44 bg-background/50 text-xs"
                aria-label={`Label for base item ${equip.baseItemId}`}
              />
              <Button
                size="xs"
                variant="quiet"
                aria-label={`Save label for base item ${equip.baseItemId}`}
                onClick={commitLabel}
                disabled={label.trim().length === 0}
              >
                <Tag className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span className="mono-id">
            {equip.exLearn.length} EX{" "}
            {equip.exLearn.length === 1 ? "ability" : "abilities"}
          </span>
          {created ? <span>· {created}</span> : null}
        </div>
      </div>

      {equip.exLearn.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
          No EX abilities learned on this item yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {equip.exLearn.map((token, index) => {
            const id = exAbilityId(token);
            return (
              <AbilityChip
                key={`${token}-${index}`}
                token={token}
                label={abilityLabel(names, id)}
                onDuplicate={() => onSetEx([...equip.exLearn, token])}
                duplicateLabel={`Add another ${token} to item ${equip.customId}`}
                onRemove={() =>
                  onSetEx(equip.exLearn.filter((_, at) => at !== index))
                }
                removeLabel={`Remove ${token} from item ${equip.customId}`}
              />
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <AbilitySearch
            names={names}
            onPick={addAbilities}
            placeholder="Search an ability name or type 102900 x3"
            ariaLabel={`Ability to add to item ${equip.customId}`}
            inputClassName="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="quiet"
            onClick={onRestore}
            disabled={equip.beforeExLearn.length === 0}
            title={
              equip.beforeExLearn.length === 0
                ? "The save holds no revert point for this item"
                : `Restore the ${equip.beforeExLearn.length} abilities from before the last dive`
            }
          >
            <RotateCcw className="size-3.5" />
            Revert ({equip.beforeExLearn.length})
          </Button>
        </div>
      </div>

      {others.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2">
          <span className="text-[11px] text-muted-foreground">Copy EX from</span>
          <Select value={copySource} onValueChange={setCopyFrom}>
            <SelectTrigger
              className="h-7 w-full max-w-[18rem] border-border/70 bg-background/40 text-xs"
              aria-label={`Item whose abilities are copied onto ${equip.customId}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((entry) => (
                <SelectItem key={entry.customId} value={String(entry.customId)}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="xs"
            variant="quiet"
            disabled={!copySource}
            onClick={() => onCopy(Number(copySource))}
          >
            <ArrowRightLeft className="size-3.5" />
            Copy
          </Button>
        </div>
      ) : null}
    </li>
  );
};

const CreateEquipDialog = ({
  open,
  onOpenChange,
  equips,
  names,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  equips: ItemWorldEquip[];
  names: AbilityNames | null;
}) => {
  const { readInventory, nameFor, createItemWorldEquip, version } = useSave();
  const [base, setBase] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [stockCount, setStockCount] = useState("1");

  useEffect(() => {
    if (!open) {
      setBase("");
      setTokens([]);
      setStockCount("1");
    }
  }, [open]);

  const stock = useMemo(
    () =>
      new Map(
        readInventory("equip").map((row) => [row.item_id, Number(row.count)]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, open],
  );

  const id = /^\d+$/.test(base.trim()) ? base.trim() : null;
  const existing = id ? equips.find((equip) => equip.baseItemId === id) : null;
  const owned = id ? (stock.get(id) ?? 0) : 0;
  const extraStock = Math.max(
    0,
    Math.min(9999, Math.floor(Number(stockCount.replace(/[,.\s]/g, "")) || 0)),
  );

  useEffect(() => {
    if (open) setStockCount(owned > 0 ? "0" : "1");
  }, [open, id, owned]);

  const add = (tokens: string[]) =>
    setTokens((previous) => normalizeExLearn([...previous, ...tokens]));

  const create = () => {
    if (!id) return;
    const customId = createItemWorldEquip(id, tokens, extraStock);
    if (customId === null) return;
    toast.success(
      `Created Item World data ${customId} for ${id}${extraStock > 0 ? ` (+${extraStock} in stock)` : ""}`,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="text-base">Enhance equipment</DialogTitle>
          <DialogDescription>
            Creates the Item World row the game keeps for an equipment id, so an
            item that never went through a dive can still carry EX abilities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="item-world-base" className="text-xs text-muted-foreground">
              Equipment id or name
            </Label>
            <CatalogCombobox
              id="item-world-base"
              bucket="equip"
              value={base}
              onChange={setBase}
              placeholder="e.g. 303016000 or Crimson Saber"
              ariaLabel="Equipment to enhance"
              ownedFor={(itemId) => stock.get(itemId)}
              inputClassName="h-9 text-sm"
            />
            {id ? (
              <p className="text-[11px] text-muted-foreground">
                {nameFor("equip", id) ?? "No shipped name for this id"} ·{" "}
                {owned > 0
                  ? `${formatNumber(owned)} in equipment stock`
                  : "not in equipment stock"}
              </p>
            ) : null}
            {existing ? (
              <InlineNote icon={AlertTriangle} tone="warning">
                This equipment already has an Item World row (item{" "}
                <span className="mono-id">{existing.customId}</span>). Edit that
                row above instead of creating a second one.
              </InlineNote>
            ) : null}
            {!existing && id && owned === 0 ? (
              <p className="text-[11px] text-warning">
                The account does not own this equipment yet. Add stock below or
                the enhanced item cannot be equipped.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="item-world-stock"
              className="text-xs text-muted-foreground"
            >
              Add to equipment stock
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="item-world-stock"
                value={stockCount}
                inputMode="numeric"
                onChange={(event) => setStockCount(event.target.value)}
                className="mono-id h-9 w-28 bg-background/50 text-sm"
                aria-label="Copies to add to equipment stock"
              />
              <span className="text-[11px] text-muted-foreground">
                {id
                  ? `owned ${formatNumber(owned)} → ${formatNumber(owned + extraStock)}`
                  : "the equipment itself is created with the enhancement"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-world-ability" className="text-xs text-muted-foreground">
              EX abilities
            </Label>
            <AbilitySearch
              names={names}
              onPick={add}
              placeholder="Search by name, or type 102900 x3"
              ariaLabel="EX ability to add"
              inputClassName="h-9 text-sm"
            />
            {tokens.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {tokens.map((token, index) => (
                  <AbilityChip
                    key={`${token}-${index}`}
                    token={token}
                    label={abilityLabel(names, exAbilityId(token))}
                    onDuplicate={() => add([token])}
                    duplicateLabel={`Add another ${token}`}
                    onRemove={() =>
                      setTokens((previous) =>
                        previous.filter((_, at) => at !== index),
                      )
                    }
                    removeLabel={`Remove ${token}`}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Pick at least one. The save stores each one as{" "}
                <span className="mono-id">24:&lt;id&gt;</span>; add the same
                ability again with the + button or by typing{" "}
                <span className="mono-id">102900 x3</span>.
              </p>
            )}
          </div>

          <InlineNote icon={Info}>
            The new row takes the next custom id and advances{" "}
            <span className="mono-id">eg_custom_seq</span>; stock is written in
            the same step. The game must reload the save before it lists the
            item. Existing enhanced items hold three abilities each; this editor
            does not cap the list.
          </InlineNote>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={create} disabled={!id || Boolean(existing) || tokens.length === 0}>
            <Plus className="size-4" />
            Create enhanced item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ItemWorldPanel = () => {
  const {
    readItemWorld,
    nameFor,
    setItemWorldEx,
    restoreItemWorldBefore,
    copyItemWorldEx,
    setItemWorldValue,
    nameItem,
    version,
  } = useSave();
  const [orbs, setOrbs] = useState("");
  const [points, setPoints] = useState("");
  const [names, setNames] = useState<AbilityNames | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAbilityNames().then((value) => {
      if (alive && value) setNames(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const state = useMemo(
    () => readItemWorld(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const commit = (input: string, key: "orbs" | "points") => {
    const amount = Number(input.replace(/[,.\s]/g, ""));
    if (!Number.isFinite(amount)) {
      toast.error("Enter a number first.");
      return;
    }
    setItemWorldValue(key, amount);
    if (key === "orbs") setOrbs("");
    else setPoints("");
  };

  const chosen = state.selected
    ? {
        id: state.selected,
        name: nameFor("equip", state.selected),
      }
    : null;

  const labels = new Map(
    state.equips.map((equip) => [
      equip.customId,
      equipLabel(equip.baseItemId, nameFor("equip", equip.baseItemId), equip.customId),
    ]),
  );

  return (
    <div className="space-y-5">
      <PanelSection
        title="Item World"
        description="Equipment enhanced in the Item World carries its bonus as a list of learned EX abilities. The save stores only those ability ids; the shipped ability table supplies their English names, and the game resolves their stat values."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Orbs"
            value={state.orbs === null ? "—" : formatNumber(state.orbs)}
            hint="eg_orb"
            icon={Gem}
            accent="equip"
          />
          <StatTile
            label="Points"
            value={state.points === null ? "—" : formatNumber(state.points)}
            hint="eg_points"
            icon={Sparkles}
            accent="materia"
          />
          <StatTile
            label="Week"
            value={state.week === null ? "—" : formatNumber(state.week)}
            hint="eg_week"
            icon={CalendarRange}
          />
          <StatTile
            label="Enhanced items"
            value={formatNumber(state.equips.length)}
            hint={`${formatNumber(state.claims.length)} claimed rewards`}
            icon={Swords}
            accent="gold"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-14 text-xs text-muted-foreground">Orbs</span>
            <Input
              value={orbs}
              inputMode="numeric"
              onChange={(event) => setOrbs(event.target.value)}
              placeholder={state.orbs === null ? "empty" : String(state.orbs)}
              className="mono-id h-8 w-24 bg-background/50 text-sm"
              aria-label="Item World orbs"
            />
            <Button
              size="xs"
              variant="secondary"
              onClick={() => commit(orbs, "orbs")}
              disabled={orbs.trim().length === 0}
            >
              Set
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-14 text-xs text-muted-foreground">Points</span>
            <Input
              value={points}
              inputMode="numeric"
              onChange={(event) => setPoints(event.target.value)}
              placeholder={state.points === null ? "empty" : String(state.points)}
              className="mono-id h-8 w-32 bg-background/50 text-sm"
              aria-label="Item World points"
            />
            <Button
              size="xs"
              variant="secondary"
              onClick={() => commit(points, "points")}
              disabled={points.trim().length === 0}
            >
              Set
            </Button>
          </div>
          <p className="mono-id self-center text-[11px] text-muted-foreground">
            selected {chosen ? `${chosen.id}${chosen.name ? ` · ${chosen.name}` : ""}` : "—"}
            {state.customSeq !== null ? ` · seq ${state.customSeq}` : ""}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <InlineNote icon={Info}>
            An EX ability entry is written as{" "}
            <span className="mono-id">24:&lt;id&gt;</span>. Names are the
            English labels translated from the JP ability table; an id missing
            there still works and shows as a raw id. The game resolves each
            ability's stats from the client master.
          </InlineNote>
          {state.activeRun ? (
            <InlineNote icon={AlertTriangle} tone="warning">
              A dive is unfinished: item{" "}
              <span className="mono-id">{state.activeRun.customId ?? "—"}</span>{" "}
              is at floor {formatNumber(state.activeRun.floor)}
              {state.activeRun.phase ? ` (${state.activeRun.phase})` : ""}.
              Editing an item mid-run may be overwritten when the run finishes.
            </InlineNote>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection
        title="Enhanced equipment"
        description="Each row is one custom equip. Add or remove the EX abilities it has learned, revert to the set stored before its last dive, or copy a set onto another item. The same ability can be added more than once — three ATK +1000 entries mean three stacks."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Enhance equipment
          </Button>
        }
        bodyClassName="px-4 py-4 sm:px-5 sm:py-5"
      >
        {state.equips.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            This account has no rows in <span className="mono-id">custom_equip</span>.
            Use <span className="text-foreground">Enhance equipment</span> above to
            create one, or run an item through the Item World in game.
          </p>
        ) : (
          <ul className="space-y-3">
            {state.equips.map((equip) => (
              <EquipCard
                key={equip.customId}
                equip={equip}
                name={nameFor("equip", equip.baseItemId)}
                names={names}
                others={state.equips
                  .filter((entry) => entry.customId !== equip.customId)
                  .map((entry) => ({
                    customId: entry.customId,
                    label: `${labels.get(entry.customId) ?? entry.baseItemId} · ${entry.exLearn.length} EX`,
                  }))}
                onSetEx={(tokens) => setItemWorldEx(equip.customId, tokens)}
                onRestore={() => restoreItemWorldBefore(equip.customId)}
                onCopy={(fromCustomId) =>
                  copyItemWorldEx(fromCustomId, equip.customId)
                }
                onName={(next) => nameItem("equip", equip.baseItemId, next)}
              />
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection
        title="Claimed floor rewards"
        description="Rows in equip_grow_claims. These reward ids were already paid out, so they stay read-only."
      >
        {state.claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Item World reward claims recorded.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {formatNumber(state.claims.length)} claims
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {state.claims.map((claim) => {
                const when = formatDate(claim.claimedAt);
                return (
                  <li
                    key={claim.rewardId}
                    className="mono-id rounded-md border border-border/60 bg-secondary/40 px-2 py-1 text-[11px] text-muted-foreground"
                    title={when ? `Claimed ${when}` : undefined}
                  >
                    {claim.rewardId}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </PanelSection>

      <CreateEquipDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        equips={state.equips}
        names={names}
      />
    </div>
  );
};
