import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Database,
  Download,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSave } from "@/state/save-context";
import { cn } from "@/lib/utils";

const TOOLS_HREF = `${import.meta.env.BASE_URL ?? "/"}tools/ffbe-save-tools.bat`;

const STEPS = [
  {
    icon: Download,
    title: "1. Pull with Save Tools",
    body: "Download ffbe-save-tools.bat once. Double-click it and choose 1. It finds adb and MuMu, stops the game safely and opens a folder with save.zip. Keep the game closed until you push.",
  },
  {
    icon: Upload,
    title: "2. Drop save.zip here",
    body: "The database and its newest WAL changes are merged inside this tab. You can also drop save.db together with save.db-wal.",
  },
  {
    icon: ArrowLeftRight,
    title: "3. Drag save.db onto the tool",
    body: "Export the save, then drag save.db onto ffbe-save-tools.bat. That is the easiest way — it detects the push automatically, backs up the live save (WAL included), verifies the write and starts the game.",
  },
];

export const ImportScreen = () => {
  const { openFiles, openDemo, status, error, loadingLabel } = useSave();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = status === "loading";

  const choose = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    void openFiles(Array.from(list));
  };

  return (
    <div className="app-backdrop min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-12 sm:px-6">
        <div className="fade-up">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-category-equip/30 bg-category-equip/10">
              <Database className="size-5 text-category-equip" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Offline save toolkit
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                Crystal Vault
              </h1>
            </div>
          </div>

          <h2 className="mt-10 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Edit your FFBE save <span className="gold-text">without touching the game</span>.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Drop the <span className="mono-id text-foreground/90">save.zip</span>{" "}
            produced by Save Tools. Add items, units and equipment, settle
            missions, then push the edited file back. The save is opened inside
            this tab — nothing is uploaded anywhere.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files);
            }}
            className={cn(
              "fade-up panel-surface shimmer-border flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors",
              dragging
                ? "border-category-equip/70 bg-category-equip/[0.06]"
                : "border-border/80",
            )}
          >
            <span className="grid size-14 place-items-center rounded-2xl border border-border/70 bg-secondary/40">
              {busy ? (
                <Loader2 className="size-6 animate-spin text-category-equip" />
              ) : (
                <Upload className="size-6 text-category-equip" aria-hidden="true" />
              )}
            </span>

            <p className="mt-4 text-base font-medium">
              {busy ? loadingLabel ?? "Opening the save" : "Drop save.zip or save.db here"}
            </p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A zip with{" "}
              <span className="mono-id text-foreground/90">save.db</span> and{" "}
              <span className="mono-id text-foreground/90">save.db-wal</span> is
              merged automatically. No extraction or commands needed.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="default"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <Upload className="size-4" />
                Choose save file
              </Button>
              <Button variant="subtle" onClick={() => void openDemo()} disabled={busy}>
                <Sparkles className="size-4" />
                Open sample save
              </Button>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".zip,.db,.sqlite,.sqlite3,application/octet-stream"
              className="hidden"
              onChange={(event) => {
                choose(event.target.files);
                event.target.value = "";
              }}
            />

            {error ? (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="fade-up space-y-3">
            <div className="rounded-xl border border-category-equip/30 bg-category-equip/[0.06] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Save Tools for Windows</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    One file. No console commands.
                  </p>
                </div>
                <Button asChild variant="gold" size="sm">
                  <a href={TOOLS_HREF} download>
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                One-time setup: in MuMu, enable{" "}
                <span className="text-foreground">Root</span> (Settings → Other →
                Root permission). Keep MuMu running and the game installed.
              </p>
            </div>

            {STEPS.map((step) => (
              <div
                key={step.title}
                className="flex gap-3 rounded-xl border border-border/70 bg-secondary/25 px-4 py-3.5"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/40">
                  <step.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Your original file is never modified. Save Tools keeps a backup
                of the live save before every push.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
