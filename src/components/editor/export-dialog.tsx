import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderDown,
  HardDriveDownload,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
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

interface Prepared {
  url: string;
  name: string;
  integrity: string;
  size: number;
  bytes: Uint8Array;
}

interface WritableHandle {
  createWritable: () => Promise<{
    write: (data: BufferSource | Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

type SaveFilePicker = (options?: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<WritableHandle>;

const TOOLS_HREF = `${import.meta.env.BASE_URL ?? "/"}tools/ffbe-save-tools.bat`;

export const ExportDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { exportSave, changes, isDemo, summary } = useSave();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    try {
      const result = exportSave();
      const blob = new Blob([result.bytes], {
        type: "application/vnd.sqlite3",
      });
      url = URL.createObjectURL(blob);
      setPrepared({
        url,
        name: result.name,
        integrity: result.integrity,
        size: blob.size,
        bytes: result.bytes,
      });
      setFailure(null);
    } catch (caught) {
      setPrepared(null);
      setFailure(
        caught instanceof Error ? caught.message : "The save could not be written.",
      );
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const healthy = prepared?.integrity.toLowerCase() === "ok";
  const grouped = changes.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.label] = (accumulator[entry.label] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <HardDriveDownload className="size-4 text-category-equip" />
            Export save
          </DialogTitle>
          <DialogDescription>
            The file keeps the original name so it drops straight back into the
            game folder. Your pre-edit original stays downloadable until you
            discard changes or reload.
          </DialogDescription>
        </DialogHeader>

        {failure ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{failure}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {isDemo ? (
              <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  This is the built-in sample save. Do not push it to MuMu.
                </span>
              </div>
            ) : null}
            <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                File
              </p>
              <p className="mono-id mt-1 truncate text-sm">{prepared?.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {prepared ? `${formatNumber(prepared.size)} bytes · ` : null}
                {changes.length} edit{changes.length === 1 ? "" : "s"} applied
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Integrity check
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm">
                {healthy ? (
                  <>
                    <CheckCircle2 className="size-4 text-success" />
                    Database structure is intact
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4 text-warning" />
                    {prepared?.integrity ?? "Not available"}
                  </>
                )}
              </p>
            </div>

            {Object.keys(grouped).length > 0 ? (
              <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  What changed
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {Object.entries(grouped).map(([label, count]) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      <span className="mono-id text-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 text-sm text-muted-foreground">
                No edits yet — exporting now returns the save unchanged
                {isDemo ? " (sample save)" : ""}. Current roster:{" "}
                {formatNumber(summary.units)} units, {formatNumber(summary.items)}{" "}
                item stacks.
              </div>
            )}

            <div className="rounded-xl border border-border/70 bg-background/40 p-4">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Push it back
              </p>
              <p className="mt-2 flex items-start gap-2 rounded-lg border border-category-equip/25 bg-category-equip/10 px-2.5 py-2 text-xs leading-relaxed text-foreground">
                <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-category-equip" />
                <span>
                  Easiest: drag{" "}
                  <span className="mono-id">save.db</span> onto{" "}
                  <span className="mono-id">ffbe-save-tools.bat</span>. No menu
                  needed.
                </span>
              </p>
              <ol className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                <li>
                  1. Save this file into the Save Tools folder, or keep the
                  download in Downloads.
                </li>
                <li>
                  2. Drag the downloaded{" "}
                  <span className="mono-id text-foreground">save.db</span> onto{" "}
                  <a
                    href={TOOLS_HREF}
                    download
                    className="text-category-equip underline-offset-2 hover:underline"
                  >
                    ffbe-save-tools.bat
                  </a>{" "}
                  and confirm. (Or double-click the tool and choose 2.)
                </li>
                <li>
                  3. It backs up the live save, writes and verifies the file,
                  then starts the game.
                </li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={!prepared}
              onClick={async () => {
                if (!prepared) return;
                const picker = (
                  window as unknown as { showSaveFilePicker?: SaveFilePicker }
                ).showSaveFilePicker;
                if (!picker) {
                  toast.error(
                    "This browser cannot write directly to a folder — use Download save.",
                  );
                  return;
                }
                try {
                  const handle = await picker({
                    suggestedName: "save.db",
                    types: [
                      {
                        description: "SQLite save",
                        accept: { "application/vnd.sqlite3": [".db"] },
                      },
                    ],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(prepared.bytes);
                  await writable.close();
                  toast.success("Saved. Run Save Tools and choose 2 to push.");
                } catch (caught) {
                  if ((caught as DOMException)?.name !== "AbortError") {
                    toast.error("Could not write that file.");
                  }
                }
              }}
            >
              <FolderDown className="size-4" />
              Save to folder
            </Button>
            <Button
              variant="gold"
              disabled={!prepared}
              onClick={() => {
                if (!prepared) return;
                const link = document.createElement("a");
                link.href = prepared.url;
                link.download = prepared.name;
                link.rel = "noopener";
                document.body.appendChild(link);
                link.click();
                link.remove();
              }}
            >
              <Download className="size-4" />
              Download save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
