import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSave } from "@/state/save-context";
import type { Catalog } from "@/lib/ffbe/types";
import { cn } from "@/lib/utils";

const BUCKETS: { bucket: keyof Catalog; tab: string; label: string }[] = [
  { bucket: "items", tab: "item", label: "Items" },
  { bucket: "equip", tab: "equip", label: "Equipment" },
  { bucket: "materia", tab: "materia", label: "Materia" },
  { bucket: "important", tab: "important", label: "Important" },
  { bucket: "units", tab: "units", label: "Units" },
  { bucket: "vision", tab: "vision", label: "Vision cards" },
  { bucket: "missions", tab: "missions", label: "Missions" },
];

interface Hit {
  id: string;
  name: string;
  tab: string;
  bucket: string;
}

export const GlobalSearch = ({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (tab: string, query: string) => void;
}) => {
  const { searchCatalog } = useSave();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const needle = query.trim();
    if (needle.length < 2) return [];
    const results: Hit[] = [];
    for (const entry of BUCKETS) {
      for (const match of searchCatalog(entry.bucket, needle, 6)) {
        results.push({
          id: match.id,
          name: match.name,
          tab: entry.tab,
          bucket: entry.label,
        });
      }
    }
    return results.slice(0, 36);
  }, [query, searchCatalog]);

  const choose = (hit: Hit) => {
    onPick(hit.tab, hit.id);
    onOpenChange(false);
  };

  const index = Math.min(active, Math.max(0, hits.length - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-3 border-border/70 bg-card p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm">Search everything</DialogTitle>
          <DialogDescription className="text-xs">
            Items, gear, materia, units, vision cards and missions. Picking a hit
            opens that tab filtered to it.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive(Math.min(index + 1, hits.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(Math.max(0, index - 1));
              } else if (event.key === "Enter" && hits[index]) {
                event.preventDefault();
                choose(hits[index]);
              }
            }}
            placeholder="Type at least two characters"
            className="bg-background/50 pl-8"
          />
        </div>

        <ul className="max-h-[46vh] overflow-auto rounded-xl border border-border/60">
          {hits.map((hit, position) => (
            <li key={`${hit.tab}-${hit.id}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(position)}
                onClick={() => choose(hit)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                  position === index ? "bg-secondary/70" : "hover:bg-secondary/40",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {hit.name}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {hit.bucket}
                </span>
                <span className="mono-id shrink-0 text-[11px] text-muted-foreground">
                  {hit.id}
                </span>
                {position === index ? (
                  <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
              </button>
            </li>
          ))}
          {query.trim().length >= 2 && hits.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing in the name database matches that.
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
};
