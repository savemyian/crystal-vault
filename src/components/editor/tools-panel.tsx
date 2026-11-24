import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  HardDriveDownload,
  History,
  Layers,
  MousePointerClick,
  Plus,
  Save,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSave } from "@/state/save-context";
import { InlineNote, PanelSection } from "./primitives";
import { cn } from "@/lib/utils";
import type { InventoryCategory } from "@/lib/ffbe/types";

const PRESET_KEY = "ffbe-save-editor:presets";
const ADB_KEY = "ffbe-save-editor:adb";

const TOOLS_HREF = `${import.meta.env.BASE_URL ?? "/"}tools/ffbe-save-tools.bat`;
const PACKAGE = "com.square_enix.ffbejpn";
const ROOT = `/data/data/${PACKAGE}/files/lapis/root`;
const SAVE = `${ROOT}/data/save.db`;
const BACKUPS = `${ROOT}/data/backups`;

interface PresetEntry {
  category: InventoryCategory;
  itemId: string;
  count: number;
}

interface Preset {
  id: string;
  name: string;
  entries: PresetEntry[];
}

const loadPresets = (): Preset[] => {
  try {
    const raw = window.localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Preset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("The browser blocked the clipboard");
  }
};

const Command = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1.5 rounded-xl border border-border/60 bg-secondary/20 p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <Button size="xs" variant="quiet" onClick={() => void copy(value)}>
        <Copy className="size-3.5" />
        Copy
      </Button>
    </div>
    <pre className="mono-id overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-background/60 p-2 text-[11px] leading-relaxed text-foreground">
      {value}
    </pre>
  </div>
);

export const ToolsPanel = () => {
  const { addInventory, version } = useSave();
  const [adb, setAdb] = useState(
    () => window.localStorage.getItem(ADB_KEY) ?? "D:\\Program Files\\Netease\\MuMuPlayer\\nx_main\\adb.exe",
  );
  const [port, setPort] = useState("16384");
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("equip");
  const [body, setBody] = useState("");

  void version;

  const remember = (value: string) => {
    setAdb(value);
    try {
      window.localStorage.setItem(ADB_KEY, value);
    } catch {
      // storage may be full; the field still works this session
    }
  };

  const device = `-s 127.0.0.1:${port.trim() || "16384"}`;
  const commands = useMemo(
    () => ({
      connect: `"${adb}" connect 127.0.0.1:${port.trim() || "16384"}`,
      pull: `"${adb}" ${device} pull ${SAVE} "%USERPROFILE%\\Downloads\\save.db"`,
      backups: `"${adb}" ${device} exec-out sh -c "ls -lt ${BACKUPS} | head -10"`,
      restore: `"${adb}" ${device} pull "${BACKUPS}/<name from the list>" "%USERPROFILE%\\Downloads\\save-before.db"`,
      push: `"${adb}" ${device} shell am force-stop ${PACKAGE} && "${adb}" ${device} push "%USERPROFILE%\\Downloads\\save.db" /data/local/tmp/save.db && "${adb}" ${device} shell "su -c 'cat /data/local/tmp/save.db > ${SAVE}'"`,
    }),
    [adb, device, port],
  );

  const savePresets = (next: Preset[]) => {
    setPresets(next);
    try {
      window.localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    } catch {
      toast.error("Preset storage is full");
    }
  };

  const createPreset = () => {
    const entries: PresetEntry[] = [];
    for (const line of body.split("\n")) {
      const match = line.trim().match(/^([0-9]+)\s*[x*,: ]\s*([0-9]+)$/i);
      if (!match) continue;
      entries.push({
        category,
        itemId: match[1],
        count: Math.max(1, Math.min(999999, Number(match[2]))),
      });
    }
    if (entries.length === 0) {
      toast.error("Write one “id count” pair per line, e.g. 800000253 1");
      return;
    }
    const preset: Preset = {
      id: `preset-${Date.now()}`,
      name: name.trim() || `Preset ${presets.length + 1}`,
      entries,
    };
    savePresets([...presets, preset]);
    setName("");
    setBody("");
    toast.success(`Saved ${preset.name} with ${entries.length} entries`);
  };

  const applyPreset = (preset: Preset) => {
    for (const entry of preset.entries) {
      addInventory(entry.category, entry.itemId, entry.count);
    }
    toast.success(`Applied ${preset.name}`);
  };

  return (
    <div className="space-y-5">
      <PanelSection
        title="Device sync"
        description="Pull and push the live save with one Windows file. No commands to type."
        actions={
          <Button asChild variant="gold" size="sm">
            <a href={TOOLS_HREF} download>
              <Download className="size-4" />
              Download Save Tools
            </a>
          </Button>
        }
      >
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">1.</span> Double-click{" "}
            <span className="mono-id text-foreground">ffbe-save-tools.bat</span>{" "}
            and choose <span className="text-foreground">1</span>. It finds adb
            and MuMu, stops the game, and opens a folder with{" "}
            <span className="mono-id text-foreground">save.zip</span>.
          </li>
          <li>
            <span className="text-foreground">2.</span> Drop that zip into the
            importer. The WAL is merged automatically.
          </li>
          <li>
            <span className="text-foreground">3.</span> After editing, export the
            save, then drag{" "}
            <span className="mono-id text-foreground">save.db</span> onto{" "}
            <span className="mono-id text-foreground">ffbe-save-tools.bat</span>.
            It backs up, writes, verifies, and restarts the game.
          </li>
        </ol>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-category-equip/25 bg-category-equip/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-category-equip" />
          <span>
            <span className="font-medium">Easiest push:</span> drag the exported{" "}
            <span className="mono-id">save.db</span> onto{" "}
            <span className="mono-id">ffbe-save-tools.bat</span>. No menu needed.
          </span>
        </p>
        <InlineNote icon={HardDriveDownload} tone="warning">
          One-time setup: enable Root in MuMu (Settings → Other → Root
          permission). Windows may warn about the downloaded .bat; choose Keep.
        </InlineNote>

        <details className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Advanced: manual adb commands
          </summary>
          <div className="mt-3 grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={adb}
                onChange={(event) => remember(event.target.value)}
                className="mono-id h-8 w-72 bg-background/50 text-xs"
                aria-label="adb path"
              />
              <Input
                value={port}
                onChange={(event) => setPort(event.target.value)}
                className="mono-id h-8 w-20 bg-background/50 text-xs"
                aria-label="emulator adb port"
              />
            </div>
            <Command label="1 · connect to the emulator" value={commands.connect} />
            <Command label="2 · pull the save" value={commands.pull} />
            <Command label="3 · push it back" value={commands.push} />
            <Command label="4 · list the newest backups" value={commands.backups} />
            <Command label="5 · pull one backup" value={commands.restore} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Pushing writes over the live save. Close the game first — the push
            command force-stops the package — and keep the file you pulled as
            your rollback.
          </p>
          <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <History className="mt-0.5 size-3.5 shrink-0" />
            After pulling a backup, open it here, check the numbers, then push it
            with step 3.
          </p>
        </details>
      </PanelSection>

      <PanelSection
        title="Presets"
        description="Named bundles you can re-apply in one click. Write one “id count” pair per line; the bundle is stored in this browser."
        actions={
          <Button size="xs" variant="subtle" onClick={createPreset}>
            <Plus className="size-3.5" />
            Save preset
          </Button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Preset name, e.g. Celestite set"
            className="h-9 bg-background/50 text-sm"
            aria-label="Preset name"
          />
          <div className="flex flex-wrap gap-1">
            {(["equip", "materia", "item", "important"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs capitalize transition-colors",
                  category === option
                    ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                    : "border-border/70 text-muted-foreground hover:bg-secondary/40",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          placeholder={"800000253 1\n800000307 1\n800000313 1"}
          className="mono-id mt-2 w-full rounded-xl border border-border/70 bg-background/50 p-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Preset entries"
        />

        <ul className="mt-3 divide-y divide-border/50 rounded-xl border border-border/60">
          {presets.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No presets yet.
            </li>
          ) : null}
          {presets.map((preset) => (
            <li
              key={preset.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{preset.name}</p>
                <p className="mono-id text-[11px] text-muted-foreground">
                  {preset.entries.length} entries ·{" "}
                  {preset.entries
                    .slice(0, 3)
                    .map((entry) => entry.itemId)
                    .join(", ")}
                  {preset.entries.length > 3 ? " …" : ""}
                </p>
              </div>
              <Button size="xs" variant="secondary" onClick={() => applyPreset(preset)}>
                <Wand2 className="size-3.5" />
                Apply
              </Button>
              <Button
                size="xs"
                variant="quiet"
                aria-label={`Delete ${preset.name}`}
                onClick={() => savePresets(presets.filter((item) => item.id !== preset.id))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>

        <InlineNote icon={Layers}>
          Applying a preset adds the listed copies to your stock; every entry is a
          separate edit, so Undo steps back through them one at a time.
        </InlineNote>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Save className="size-3.5" />
          Presets live in this browser only — they never leave your machine.
        </p>
      </PanelSection>
    </div>
  );
};
