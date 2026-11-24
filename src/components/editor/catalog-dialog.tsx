import { useRef, useState } from "react";
import { FileJson, Tags, Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSave } from "@/state/save-context";
import { formatNumber } from "@/lib/ffbe/format";

export const CatalogDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { importCatalog, clearCatalog, catalogCount, catalogSource } = useSave();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const load = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    importCatalog(text, file.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tags className="size-4 text-category-equip" />
            Name list
          </DialogTitle>
          <DialogDescription>
            Names for units, items, equipment, materia and missions are built in
            from the game's data, so every screen shows readable names instead of
            bare IDs. Load your own list only to override them.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void load(event.dataTransfer.files?.[0]);
          }}
          className={`rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? "border-category-equip/70 bg-category-equip/[0.06]"
              : "border-border/80 bg-secondary/25"
          }`}
        >
          <FileJson className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop a JSON or CSV name list</p>
          <p className="mt-1 text-xs text-muted-foreground">
            IDs stay editable either way — names are display only.
          </p>
          <Button
            variant="subtle"
            size="sm"
            className="mt-3"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.csv,.txt"
            className="hidden"
            onChange={(event) => {
              void load(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Accepted shapes
          </p>
          <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-muted-foreground">
{`{"items":{"201000101":"Crimson Tonic"}}
[{"id":"401000101","name":"Silverblade","category":"equip"}]
csv: id,name,category`}
          </pre>
        </div>

        <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {catalogCount > 0
              ? `${formatNumber(catalogCount)} names loaded${
                  catalogSource ? ` · ${catalogSource}` : ""
                }`
              : "No names loaded — everything works by ID."}
          </p>
          <div className="flex items-center gap-2">
            {catalogCount > 0 ? (
              <Button variant="quiet" size="sm" onClick={clearCatalog}>
                <Trash2 className="size-3.5" />
                Clear imported
              </Button>
            ) : null}
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
