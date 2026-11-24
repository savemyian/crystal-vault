import { useEffect, useMemo, useState } from "react";
import {
  Check,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSave } from "@/state/save-context";
import { formatNumber, parseIdAmounts } from "@/lib/ffbe/format";
import { describeMeta } from "@/lib/ffbe/meta";
import type { Catalog, InventoryCategory } from "@/lib/ffbe/types";
import { CategoryDot, IdChip, PanelSection } from "./primitives";
import { CatalogCombobox } from "./catalog-combobox";

const BUCKET: Record<InventoryCategory, keyof Catalog> = {
  item: "items",
  equip: "equip",
  materia: "materia",
  important: "important",
};

const COPY: Record<
  InventoryCategory,
  { title: string; description: string; placeholder: string }
> = {
  item: {
    title: "Items",
    description:
      "Consumables, materials and orbs. Counts stack per item ID — adding an ID that already exists raises its stack.",
    placeholder: "Item ID, e.g. 201000101",
  },
  equip: {
    title: "Equipment",
    description:
      "Weapons, armour and accessories owned by the account. Equipment lives in its own stock table, separate from items.",
    placeholder: "Equipment ID, e.g. 401000101",
  },
  materia: {
    title: "Materia",
    description:
      "Ability stones and orb items. Each row is one materia stack the game reads when building a party.",
    placeholder: "Materia ID, e.g. 504000101",
  },
  important: {
    title: "Important items",
    description:
      "Keys, tickets and tokens counted by the game outside the normal inventory.",
    placeholder: "Important item ID, e.g. 100",
  },
};

const InventoryRowView = ({
  category,
  id,
  name,
  count,
  isNew,
  meta,
  onSet,
  onAdd,
  onName,
}: {
  category: InventoryCategory;
  id: string;
  name: string | null;
  count: number;
  isNew?: boolean;
  meta?: string | null;
  onSet: (next: number) => void;
  onAdd: (delta: number) => void;
  onName: (next: string) => void;
}) => {
  const [draft, setDraft] = useState(
    count > 0 ? String(count) : isNew ? "99" : "0",
  );
  const [labelDraft, setLabelDraft] = useState("");

  const commitLabel = () => {
    const next = labelDraft.trim();
    if (!next) return;
    onName(next);
    setLabelDraft("");
  };

  useEffect(() => {
    setDraft(count > 0 ? String(count) : isNew ? "99" : "0");
  }, [count, isNew]);

  const commit = () => {
    const next = Number(draft.replace(/[,.\s]/g, ""));
    if (Number.isFinite(next)) onSet(Math.max(0, Math.floor(next)));
  };

  return (
    <li className="row-hover flex flex-col gap-3 border-b border-border/50 px-5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <CategoryDot category={category} />
        <div className="min-w-0">
          <IdChip id={id} name={name} />
          {meta ? (
            <p className="truncate text-[11px] text-muted-foreground/80">{meta}</p>
          ) : null}
        </div>
        {name ? null : (
          <div className="flex items-center gap-1">
            <Input
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitLabel();
              }}
              placeholder="label this id"
              className="h-7 w-44 bg-background/50 text-xs"
              aria-label={`Name for ${id}`}
            />
            <Button
              size="xs"
              variant="quiet"
              aria-label={`Save name for ${id}`}
              onClick={commitLabel}
              disabled={labelDraft.trim().length === 0}
            >
              <Tag className="size-3.5" />
            </Button>
          </div>
        )}
        {isNew ? (
          <span className="rounded border border-border/70 bg-secondary/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            not in save
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={draft}
          inputMode="numeric"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className="mono-id h-8 w-28 bg-background/50 text-right text-xs"
          aria-label={`Count for ${id}`}
        />
        <Button size="xs" variant="subtle" onClick={commit}>
          <Check className="size-3.5" />
          Set
        </Button>
        <Button size="xs" variant="quiet" onClick={() => onAdd(-50)}>
          -50
        </Button>
        <Button size="xs" variant="quiet" onClick={() => onAdd(10)}>
          +10
        </Button>
        <Button size="xs" variant="quiet" onClick={() => onAdd(50)}>
          +50
        </Button>
        <Button size="xs" variant="quiet" onClick={() => onAdd(100)}>
          +100
        </Button>
        <Button size="xs" variant="quiet" onClick={() => onAdd(1000)}>
          +1k
        </Button>
        <Button
          size="xs"
          variant="quiet"
          aria-label={`Remove ${id}`}
          onClick={() => onSet(0)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
};

const BulkDialog = ({
  open,
  onOpenChange,
  category,
  stacks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: InventoryCategory;
  stacks: number;
}) => {
  const { adjustInventory } = useSave();
  const [mode, setMode] = useState<"multiply" | "set" | "add">("multiply");
  const [value, setValue] = useState("10");

  const apply = () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    adjustInventory(category, mode, amount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-category-equip" />
            Bulk change
          </DialogTitle>
          <DialogDescription>
            Applies to all {formatNumber(stacks)} {COPY[category].title.toLowerCase()} stacks
            of this account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={mode} onValueChange={(next) => setMode(next as typeof mode)}>
            <SelectTrigger className="border-border/70 bg-secondary/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiply">Multiply each stack</SelectItem>
              <SelectItem value="set">Set every stack to</SelectItem>
              <SelectItem value="add">Add to every stack</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input
              value={value}
              inputMode="numeric"
              onChange={(event) => setValue(event.target.value)}
              className="mono-id bg-background/50"
              aria-label="Bulk amount"
            />
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                setMode("set");
                setValue("999999999");
              }}
            >
              Max
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Values are capped at 999,999,999. Every touched stack is listed in the
            session history.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={apply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const InventoryPanel = ({
  category,
  initialSearch = "",
}: {
  category: InventoryCategory;
  initialSearch?: string;
}) => {
  const {
    readInventory,
    setInventoryCount,
    addInventory,
    nameFor,
    nameItem,
    metaFor,
    searchCatalog,
    version,
  } = useSave();
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<"count" | "id">("count");
  const [limit, setLimit] = useState(40);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newCount, setNewCount] = useState("99");
  const [bulkIds, setBulkIds] = useState("");

  const copy = COPY[category];
  const bucket = BUCKET[category];

  const rows = useMemo(
    () => readInventory(category),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, category],
  );

  const totalStacks = rows.length;
  const totalUnits = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const known = new Set(rows.map((row) => row.item_id));
    const matched = query
      ? rows.filter((row) => {
          if (row.item_id.toLowerCase().includes(query)) return true;
          const name = nameFor(bucket, row.item_id);
          if (name && name.toLowerCase().includes(query)) return true;
          const info = metaFor(bucket, row.item_id);
          return info ? (describeMeta(info) ?? "").toLowerCase().includes(query) : false;
        })
      : rows;
    const owned = [...matched]
      .sort((left, right) =>
        sort === "count"
          ? Number(right.count) - Number(left.count)
          : left.item_id.localeCompare(right.item_id),
      )
      .map((row) => ({
        id: row.item_id,
        count: Number(row.count),
        isNew: false,
      }));
    if (!query) return owned;
    // anything the client ships but this save has never held is listed too, so
    // it can be added without knowing its id
    const extra = searchCatalog(bucket, search, 40)
      .filter((entry) => !known.has(entry.id))
      .map((entry) => ({ id: entry.id, count: 0, isNew: true }));
    return [...owned, ...extra];
  }, [rows, search, sort, bucket, nameFor, metaFor, searchCatalog]);

  useEffect(() => {
    setLimit(40);
  }, [search, sort, category]);

  const typed = newId.trim();
  const nameMatch = typed && !/^\d+$/.test(typed)
    ? searchCatalog(bucket, typed, 40).find(
        (entry) => entry.name.toLowerCase() === typed.toLowerCase(),
      )
    : undefined;
  const resolvedId = /^\d+$/.test(typed) ? typed : (nameMatch?.id ?? null);
  const existing = resolvedId
    ? rows.find((row) => row.item_id === resolvedId)
    : undefined;

  return (
    <div className="space-y-5">
      <PanelSection
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button variant="subtle" size="sm" onClick={() => setBulkOpen(true)}>
              <SlidersHorizontal className="size-4" />
              Bulk
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add
            </Button>
          </>
        }
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="flex flex-col gap-2 border-b border-border/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ID or name"
              className="h-9 bg-background/50 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="mono-id">
              {formatNumber(totalStacks)} stacks · {formatNumber(totalUnits)} total
            </span>
            <Button
              variant="quiet"
              size="xs"
              onClick={() => setSort(sort === "count" ? "id" : "count")}
            >
              {sort === "count" ? "By count" : "By ID"}
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <PackagePlus className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {rows.length === 0
                ? "This account has no rows in this category yet — add an ID to create one."
                : "Nothing matches that search, including the shipped catalogue."}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.slice(0, limit).map((row) => (
              <InventoryRowView
                key={row.id}
                category={category}
                id={row.id}
                name={nameFor(bucket, row.id)}
                meta={describeMeta(metaFor(bucket, row.id))}
                count={row.count}
                isNew={row.isNew}
                onSet={(next) => setInventoryCount(category, row.id, next)}
                onAdd={(delta) => addInventory(category, row.id, delta)}
                onName={(next) => nameItem(bucket, row.id, next)}
              />
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">Add {copy.title.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Adding an ID that already exists raises its stack instead of
              replacing it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-inventory-id" className="text-xs text-muted-foreground">
                ID or name
              </Label>
              <CatalogCombobox
                id="add-inventory-id"
                bucket={bucket}
                value={newId}
                onChange={setNewId}
                placeholder={copy.placeholder}
                ariaLabel="ID or name to add"
                ownedFor={(id) =>
                  rows.find((row) => row.item_id === id)?.count ?? 0
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-inventory-amount" className="text-xs text-muted-foreground">
                Amount
              </Label>
              <Input
                id="add-inventory-amount"
                value={newCount}
                inputMode="numeric"
                onChange={(event) => setNewCount(event.target.value)}
                className="mono-id bg-background/50"
                aria-label="Amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-add-ids" className="text-xs text-muted-foreground">
                Or paste many IDs — one per line, or id:amount
              </Label>
              <Textarea
                id="bulk-add-ids"
                value={bulkIds}
                onChange={(event) => setBulkIds(event.target.value)}
                placeholder={"201000101:50\n201000201 x5\n290010001"}
                className="mono-id min-h-[70px] bg-background/50 text-xs"
              />
            </div>
            {existing && !bulkIds.trim() ? (
              <p className="text-xs text-muted-foreground">
                {nameFor(bucket, existing.item_id) ?? existing.item_id} already has{" "}
                {formatNumber(existing.count)} — the amount is added on top.
              </p>
            ) : resolvedId && !bulkIds.trim() ? (
              <p className="text-xs text-muted-foreground">
                A new row is created for{" "}
                {nameFor(bucket, resolvedId) ?? resolvedId}.
              </p>
            ) : typed && !bulkIds.trim() ? (
              <p className="text-xs text-muted-foreground">
                No shipped entry matches “{typed}” — pick a suggestion or paste the
                numeric ID.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                bulkIds.trim() === "" && !resolvedId
              }
              onClick={() => {
                const amount = Number(newCount);
                const pastedIds = parseIdAmounts(
                  bulkIds,
                  Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1,
                );
                if (pastedIds.length > 0) {
                  for (const entry of pastedIds) {
                    addInventory(category, entry.id, entry.count);
                  }
                } else if (resolvedId) {
                  if (!Number.isFinite(amount) || amount <= 0) return;
                  addInventory(category, resolvedId, Math.floor(amount));
                } else {
                  return;
                }
                setNewId("");
                setBulkIds("");
                setAddOpen(false);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        category={category}
        stacks={totalStacks}
      />
    </div>
  );
};
