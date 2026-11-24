import { useEffect, useState } from "react";
import {
  BookOpen,
  Gem,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Mail,
  Package,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  UsersRound,
  Wrench,
  CirclePlay,
} from "lucide-react";
import { SaveProvider } from "@/state/save-provider";
import { useSave } from "@/state/save-context";
import { AppHeader } from "@/components/editor/app-header";
import { ImportScreen } from "@/components/editor/import-screen";
import { OverviewPanel } from "@/components/editor/overview-panel";
import { InventoryPanel } from "@/components/editor/inventory-panel";
import { UnitsPanel } from "@/components/editor/units-panel";
import { TeamsPanel } from "@/components/editor/teams-panel";
import { MissionsPanel } from "@/components/editor/missions-panel";
import { VisionPanel } from "@/components/editor/vision-panel";
import { StoryPanel } from "@/components/editor/story-panel";
import { MailPanel } from "@/components/editor/mail-panel";
import { AuditPanel } from "@/components/editor/audit-panel";
import { ToolsPanel } from "@/components/editor/tools-panel";
import { AutoplayPanel } from "@/components/editor/autoplay-panel";
import { ItemWorldPanel } from "@/components/editor/item-world-panel";
import { GlobalSearch } from "@/components/editor/global-search";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/ffbe/format";

type TabId =
  | "overview"
  | "item"
  | "equip"
  | "itemworld"
  | "materia"
  | "important"
  | "units"
  | "teams"
  | "autoplay"
  | "vision"
  | "story"
  | "missions"
  | "mail"
  | "audit"
  | "tools";

const TABS: {
  id: TabId;
  label: string;
  icon: typeof Package;
  count?: (summary: ReturnType<typeof useSave>["summary"]) => number;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "item", label: "Items", icon: Package, count: (s) => s.items },
  { id: "equip", label: "Equipment", icon: Swords, count: (s) => s.equip },
  { id: "itemworld", label: "Item World", icon: Gem },
  { id: "materia", label: "Materia", icon: Sparkles, count: (s) => s.materia },
  {
    id: "important",
    label: "Important",
    icon: KeyRound,
    count: (s) => s.important,
  },
  { id: "units", label: "Units", icon: Users, count: (s) => s.units },
  { id: "teams", label: "Teams", icon: UsersRound },
  { id: "autoplay", label: "Autoplay", icon: CirclePlay },
  { id: "vision", label: "Vision cards", icon: IdCard, count: (s) => s.vision },
  { id: "story", label: "Story", icon: BookOpen },
  { id: "missions", label: "Missions", icon: ScrollText, count: (s) => s.missions },
  { id: "mail", label: "Mail", icon: Mail, count: (s) => s.mails },
  { id: "audit", label: "Audit", icon: ShieldCheck },
  { id: "tools", label: "Tools", icon: Wrench },
];

const EditorShell = () => {
  const { status, summary } = useSave();
  const [tab, setTab] = useState<TabId>("overview");
  const [searchOpen, setSearchOpen] = useState(false);
  const [seed, setSeed] = useState<{ tab: TabId; query: string; nonce: number }>({
    tab: "overview",
    query: "",
    nonce: 0,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (status !== "ready") return <ImportScreen />;

  const seeded = (target: TabId) =>
    seed.tab === target ? seed.query : "";
  const seedKey = (target: TabId) => `${target}-${seed.nonce}`;

  return (
    <div className="app-backdrop min-h-screen">
      <div className="mx-auto w-full max-w-[1420px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <AppHeader onOpenSearch={() => setSearchOpen(true)} />

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
          <nav
            aria-label="Editor sections"
            className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0"
          >
            <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {TABS.map((entry) => {
                const active = entry.id === tab;
                const count = entry.count ? entry.count(summary) : null;
                return (
                  <li key={entry.id} className="shrink-0 lg:w-full">
                    <button
                      type="button"
                      onClick={() => setTab(entry.id)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "border-category-equip/40 bg-category-equip/10 text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-secondary/40 hover:text-foreground",
                      )}
                    >
                      <entry.icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-category-equip" : "text-muted-foreground",
                        )}
                      />
                      <span className="whitespace-nowrap font-medium">
                        {entry.label}
                      </span>
                      {count !== null ? (
                        <span className="mono-id ml-auto hidden text-[11px] text-muted-foreground lg:inline">
                          {formatNumber(count)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="min-w-0 flex-1">
            <div key={tab} className="fade-up">
              {tab === "overview" ? <OverviewPanel onNavigate={(next) => setTab(next as TabId)} /> : null}
              {tab === "item" ? (
                <InventoryPanel
                  key={seedKey("item")}
                  category="item"
                  initialSearch={seeded("item")}
                />
              ) : null}
              {tab === "equip" ? (
                <InventoryPanel
                  key={seedKey("equip")}
                  category="equip"
                  initialSearch={seeded("equip")}
                />
              ) : null}
              {tab === "itemworld" ? <ItemWorldPanel /> : null}
              {tab === "materia" ? (
                <InventoryPanel
                  key={seedKey("materia")}
                  category="materia"
                  initialSearch={seeded("materia")}
                />
              ) : null}
              {tab === "important" ? (
                <InventoryPanel
                  key={seedKey("important")}
                  category="important"
                  initialSearch={seeded("important")}
                />
              ) : null}
              {tab === "units" ? (
                <UnitsPanel key={seedKey("units")} initialSearch={seeded("units")} />
              ) : null}
              {tab === "teams" ? (
                <TeamsPanel key={seedKey("teams")} initialSearch={seeded("teams")} />
              ) : null}
              {tab === "autoplay" ? <AutoplayPanel /> : null}
              {tab === "vision" ? (
                <VisionPanel
                  key={seedKey("vision")}
                  initialSearch={seeded("vision")}
                />
              ) : null}
              {tab === "story" ? <StoryPanel /> : null}
              {tab === "missions" ? (
                <MissionsPanel
                  key={seedKey("missions")}
                  initialSearch={seeded("missions")}
                />
              ) : null}
              {tab === "mail" ? <MailPanel /> : null}
              {tab === "audit" ? <AuditPanel /> : null}
              {tab === "tools" ? <ToolsPanel /> : null}
            </div>
          </main>
        </div>
      </div>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPick={(target, query) => {
          const next = (TABS.find((entry) => entry.id === target)?.id ??
            "overview") as TabId;
          setSeed({ tab: next, query, nonce: Date.now() });
          setTab(next);
        }}
      />
    </div>
  );
};

const Index = () => (
  <SaveProvider>
    <EditorShell />
  </SaveProvider>
);

export default Index;
