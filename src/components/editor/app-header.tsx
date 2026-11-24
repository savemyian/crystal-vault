import { useState } from "react";
import {
  Database,
  Download,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Tags,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSave } from "@/state/save-context";
import { CatalogDialog } from "./catalog-dialog";
import { ExportDialog } from "./export-dialog";

export const AppHeader = ({ onOpenSearch }: { onOpenSearch: () => void }) => {
  const {
    fileName,
    isDemo,
    activeUser,
    changes,
    reset,
    close,
    undo,
    redo,
    canUndo,
    canRedo,
    undoDepth,
  } = useSave();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-category-equip/30 bg-category-equip/10">
            <Database className="size-5 text-category-equip" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
              Offline save toolkit
            </p>
            <h1 className="text-lg font-semibold leading-tight tracking-tight">
              Crystal Vault
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="quiet"
            size="sm"
            onClick={onOpenSearch}
            title="Search everything (Ctrl+K)"
          >
            <Search className="size-4" />
            Search
            <kbd className="mono-id rounded border border-border/70 px-1 text-[10px] text-muted-foreground">
              Ctrl K
            </kbd>
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title={canUndo ? `Undo (${undoDepth} steps)` : "Nothing to undo"}
          >
            <Undo2 className="size-4" />
            Undo
          </Button>
          <Button variant="quiet" size="sm" onClick={redo} disabled={!canRedo}>
            <Redo2 className="size-4" />
            Redo
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setCatalogOpen(true)}>
            <Tags className="size-4" />
            Name list
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => void reset()}
            disabled={changes.length === 0}
          >
            <RotateCcw className="size-4" />
            Discard edits
          </Button>
          <Button variant="gold" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="size-4" />
            Export save
            {changes.length > 0 ? (
              <span className="ml-1 rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold">
                {changes.length}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs">
        <span className="mono-id inline-flex max-w-full items-center gap-2 truncate rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-muted-foreground">
          <Database className="size-3.5 shrink-0" />
          <span className="truncate">{fileName}</span>
          {isDemo ? (
            <Badge
              variant="outline"
              className="border-category-materia/40 bg-category-materia/10 text-[10px] text-category-materia"
            >
              <Sparkles className="mr-1 size-3" />
              sample
            </Badge>
          ) : null}
        </span>

        {activeUser ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-muted-foreground">
            <UserRound className="size-3.5" />
            <span className="text-foreground">{activeUser.name}</span>
            <span className="mono-id">rank {activeUser.rank}</span>
          </span>
        ) : null}

        <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-muted-foreground">
          {changes.length} pending edit{changes.length === 1 ? "" : "s"}
        </span>

        <Button
          variant="quiet"
          size="xs"
          className="ml-auto"
          onClick={close}
          title="Close this save and open another"
        >
          <X className="size-3.5" />
          Close save
        </Button>
      </div>

      <CatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </header>
  );
};
