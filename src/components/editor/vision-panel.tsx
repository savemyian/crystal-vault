import { useMemo, useState } from "react";
import { IdCard, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useSave } from "@/state/save-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IdChip, PanelSection } from "@/components/editor/primitives";
import { formatNumber } from "@/lib/ffbe/format";
import { describeMeta } from "@/lib/ffbe/meta";
import type { VisionCardGroup } from "@/lib/ffbe/types";

const sortOptions = [
  { id: "copies", label: "Most copies" },
  { id: "level", label: "Highest level" },
  { id: "id", label: "Card id" },
] as const;

type SortId = (typeof sortOptions)[number]["id"];

const VisionRow = ({
  card,
  name,
  meta,
  onCopies,
  onLevel,
  onName,
}: {
  card: VisionCardGroup;
  name: string | null;
  meta?: string | null;
  onCopies: (next: number) => void;
  onLevel: (next: number) => void;
  onName: (next: string) => void;
}) => {
  const [copies, setCopies] = useState(String(card.copies));
  const [level, setLevel] = useState(String(card.level));
  const [label, setLabel] = useState("");

  const commitCopies = () => {
    const next = Number(copies.replace(/[,.\s]/g, ""));
    if (Number.isFinite(next)) onCopies(Math.max(0, Math.floor(next)));
  };

  const commitLevel = () => {
    const next = Number(level.replace(/[,.\s]/g, ""));
    if (Number.isFinite(next)) onLevel(Math.max(1, Math.floor(next)));
  };

  const commitLabel = () => {
    const next = label.trim();
    if (!next) return;
    onName(next);
    setLabel("");
  };

  return (
    <li className="row-hover flex flex-col gap-3 border-b border-border/50 px-5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <IdChip id={card.card_id} name={name} tone="gold" />
        {name ? null : (
          <div className="flex items-center gap-1">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitLabel();
              }}
              placeholder="label this card"
              className="h-7 w-44 bg-background/50 text-xs"
              aria-label={`Name for ${card.card_id}`}
            />
            <Button
              size="xs"
              variant="quiet"
              aria-label={`Save name for ${card.card_id}`}
              onClick={commitLabel}
              disabled={label.trim().length === 0}
            >
              <Tag className="size-3.5" />
            </Button>
          </div>
        )}
        <span className="mono-id text-xs text-muted-foreground">×{card.copies}</span>
        {meta ? (
          <span className="truncate text-[11px] text-muted-foreground/80">{meta}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={copies}
          inputMode="numeric"
          onChange={(event) => setCopies(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitCopies();
          }}
          className="h-8 w-20 bg-background/50 text-sm"
          aria-label={`Copies of ${card.card_id}`}
        />
        <Button size="xs" variant="secondary" onClick={commitCopies}>
          Set
        </Button>
        <Button
          size="xs"
          variant="quiet"
          onClick={() => onCopies(Math.max(0, card.copies - 50))}
          aria-label={`Remove 50 copies of ${card.card_id}`}
        >
          -50
        </Button>
        <Button
          size="xs"
          variant="quiet"
          onClick={() => onCopies(card.copies + 1)}
          aria-label={`Add a copy of ${card.card_id}`}
        >
          <Plus className="size-3.5" />
          1
        </Button>
        <Button
          size="xs"
          variant="quiet"
          onClick={() => onCopies(card.copies + 50)}
          aria-label={`Add 50 copies of ${card.card_id}`}
        >
          +50
        </Button>
        <Input
          value={level}
          inputMode="numeric"
          onChange={(event) => setLevel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitLevel();
          }}
          className="h-8 w-20 bg-background/50 text-sm"
          aria-label={`Level of ${card.card_id}`}
        />
        <Button size="xs" variant="secondary" onClick={commitLevel}>
          Level
        </Button>
        <Button
          size="xs"
          variant="quiet"
          onClick={() => onCopies(0)}
          aria-label={`Remove ${card.card_id}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
};

export const VisionPanel = ({ initialSearch = "" }: { initialSearch?: string }) => {
  const {
    summary,
    readVisionCards,
    addVisionCard,
    setVisionCardCopies,
    setVisionCardLevel,
    nameFor,
    nameItem,
    nameVisionCards,
    metaFor,
  } = useSave();
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortId>("copies");
  const [addId, setAddId] = useState("");
  const [addCopies, setAddCopies] = useState("1");

  const rows = useMemo(() => {
    const groups = readVisionCards();
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? groups.filter(
          (group) =>
            group.card_id.includes(needle) ||
            (nameFor("vision", group.card_id) ?? "").toLowerCase().includes(needle),
        )
      : groups;
    const sorted = [...filtered];
    if (sort === "copies") sorted.sort((a, b) => b.copies - a.copies);
    if (sort === "level") sorted.sort((a, b) => b.level - a.level);
    if (sort === "id") sorted.sort((a, b) => a.card_id.localeCompare(b.card_id));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, summary.vision, nameFor]);

  const submitAdd = () => {
    const id = addId.trim();
    if (!id) return;
    addVisionCard(id, Number(addCopies) || 1);
    setAddId("");
    setAddCopies("1");
  };

  return (
    <div className="flex flex-col gap-4">
      <PanelSection
        title="Vision cards"
        description="Every vision_card row on this account. Copies are separate rows; a level change applies to all copies of that card. The 151 cards restored by the FFBE Memorial project ship with their official names; the rest are labelled from the unit each card belongs to."
        actions={
          <>
            <span className="mono-id text-xs text-muted-foreground">
              {formatNumber(summary.vision)} rows
            </span>
            <Button size="sm" variant="secondary" onClick={nameVisionCards}>
              <Tag className="size-3.5" />
              Name remaining cards
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a card id or a name you gave it"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            {sortOptions.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={sort === option.id ? "secondary" : "quiet"}
                onClick={() => setSort(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border/60 bg-secondary/20 p-3 sm:flex-row sm:items-center">
          <Input
            value={addId}
            onChange={(event) => setAddId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitAdd();
            }}
            placeholder="Card id, e.g. 401008501"
            className="mono-id sm:flex-1"
          />
          <Input
            value={addCopies}
            inputMode="numeric"
            onChange={(event) => setAddCopies(event.target.value)}
            className="w-24"
            aria-label="Copies to add"
          />
          <Button onClick={submitAdd} disabled={addId.trim().length === 0}>
            <Plus className="size-4" />
            Add card
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Owned cards" bodyClassName="px-0 py-0 sm:px-0 sm:py-0">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No vision cards match that search.
          </p>
        ) : (
          <ul>
            {rows.map((card) => (
              <VisionRow
                key={card.card_id}
                card={card}
                name={nameFor("vision", card.card_id)}
                meta={describeMeta(metaFor("vision", card.card_id))}
                onCopies={(next) => setVisionCardCopies(card.card_id, next)}
                onLevel={(next) => setVisionCardLevel(card.card_id, next)}
                onName={(next) => nameItem("vision", card.card_id, next)}
              />
            ))}
          </ul>
        )}
      </PanelSection>

      <p className="text-xs text-muted-foreground">
        {formatNumber(rows.length)} card types · {formatNumber(summary.vision)} rows on this account
      </p>
    </div>
  );
};
