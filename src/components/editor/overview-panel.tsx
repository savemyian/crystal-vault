import { useEffect, useState } from "react";
import {
  Coins,
  Gem,
  History,
  Mail,
  Package,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSave } from "@/state/save-context";
import type { SaveUser } from "@/lib/ffbe/types";
import { compactNumber, formatNumber } from "@/lib/ffbe/format";
import { InlineNote, PanelSection, StatTile } from "./primitives";

const ProfileEditor = ({
  user,
  onApply,
}: {
  user: SaveUser;
  onApply: (patch: { name?: string; rank?: number }) => void;
}) => {
  const [name, setName] = useState(user.name ?? "");
  const [rank, setRank] = useState(String(user.rank ?? 1));

  useEffect(() => {
    setName(user.name ?? "");
    setRank(String(user.rank ?? 1));
  }, [user.user_id, user.name, user.rank]);

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/25 p-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="profile-name" className="text-xs text-muted-foreground">
          Player name
        </Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 bg-background/50"
        />
      </div>
      <div className="w-full space-y-1.5 sm:w-28">
        <Label htmlFor="profile-rank" className="text-xs text-muted-foreground">
          Rank
        </Label>
        <Input
          id="profile-rank"
          value={rank}
          inputMode="numeric"
          onChange={(event) => setRank(event.target.value)}
          className="mono-id h-9 bg-background/50"
        />
      </div>
      <Button
        size="sm"
        variant="subtle"
        onClick={() =>
          onApply({
            name: name.trim() === "" ? undefined : name.trim(),
            rank: Number(rank) || undefined,
          })
        }
      >
        Save profile
      </Button>
    </div>
  );
};

const ResourceEditor = ({
  label,
  icon: Icon,
  value,
  max,
  onApply,
}: {
  label: string;
  icon: typeof Coins;
  value: number;
  max: number;
  onApply: (next: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const next = Number(draft.replace(/[,.\s]/g, ""));
    if (!Number.isFinite(next) || next < 0) return;
    onApply(Math.min(max, Math.floor(next)));
  };

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="mono-id text-xs text-muted-foreground">
          {compactNumber(value)}
        </span>
      </div>
      <p className="mono-id mt-2 text-lg font-semibold">{formatNumber(value)}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <Input
          value={draft}
          inputMode="numeric"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className="mono-id h-8 bg-background/50 text-xs"
          aria-label={`${label} amount`}
        />
        <Button size="xs" variant="subtle" onClick={() => onApply(max)}>
          Max
        </Button>
        <Button size="xs" onClick={commit}>
          Set
        </Button>
      </div>
    </div>
  );
};

const SHORTCUTS = [
  {
    id: "teams",
    label: "Teams & gear",
    detail: "Arrange decks and bind equipment to units",
    icon: Swords,
  },
  {
    id: "mail",
    label: "Mail box",
    detail: "Browse and clear stored messages",
    icon: Mail,
  },
  {
    id: "audit",
    label: "Audit",
    detail: "Find unworn gear and unnamed ids",
    icon: ShieldCheck,
  },
  {
    id: "tools",
    label: "Tools",
    detail: "Device sync, restore points, presets",
    icon: History,
  },
] as const;

export const OverviewPanel = ({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) => {
  const { activeUser, users, selectUser, summary, updateUser, changes } =
    useSave();

  if (!activeUser) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.id}
            type="button"
            onClick={() => onNavigate?.(shortcut.id)}
            className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-left transition-colors hover:border-category-equip/40 hover:bg-category-equip/[0.06]"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <shortcut.icon className="size-4 text-category-equip" />
              {shortcut.label}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {shortcut.detail}
            </span>
          </button>
        ))}
      </div>

      <PanelSection
        title="Account"
        description="Resources are written straight into the save. The game picks them up the next time it reads the file."
        actions={
          users.length > 1 ? (
            <Select value={activeUser.user_id} onValueChange={selectUser}>
              <SelectTrigger className="h-9 w-[220px] border-border/70 bg-secondary/40 text-xs">
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.name} · rank {user.rank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      >
        <ProfileEditor
          user={activeUser}
          onApply={(patch) => updateUser(patch)}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <ResourceEditor
            label="Gil"
            icon={Coins}
            value={activeUser.gil}
            max={999999999}
            onApply={(next) => updateUser({ gil: next })}
          />
          <ResourceEditor
            label="Lapis"
            icon={Gem}
            value={activeUser.lapis}
            max={99999999}
            onApply={(next) => updateUser({ lapis: next })}
          />
          <ResourceEditor
            label="Energy"
            icon={Zap}
            value={activeUser.energy}
            max={9999}
            onApply={(next) => updateUser({ energy: next })}
          />
        </div>

        {users.length > 1 ? (
          <div className="mt-3">
            <InlineNote icon={ShieldCheck}>
              This save holds {users.length} accounts. Only the selected one is
              edited — the others keep their current data untouched.
            </InlineNote>
          </div>
        ) : null}
      </PanelSection>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Items"
          value={formatNumber(summary.items)}
          hint="Distinct stacks"
          icon={Package}
          accent="item"
        />
        <StatTile
          label="Equipment"
          value={formatNumber(summary.equip)}
          hint="Weapons, armour, accessories"
          icon={Swords}
          accent="equip"
        />
        <StatTile
          label="Materia"
          value={formatNumber(summary.materia)}
          hint="Stones and orbs"
          icon={Sparkles}
          accent="materia"
        />
        <StatTile
          label="Units"
          value={formatNumber(summary.units)}
          hint={`${formatNumber(summary.distinctUnits)} distinct`}
          icon={Users}
          accent="item"
        />
        <StatTile
          label="Missions cleared"
          value={formatNumber(summary.missions)}
          hint="Recorded mission rows"
          icon={ScrollText}
          accent="equip"
        />
        <StatTile
          label="Side missions"
          value={formatNumber(summary.sideMissions)}
          hint={`${formatNumber(summary.challenges)} objectives`}
          icon={ShieldCheck}
          accent="materia"
        />
        <StatTile
          label="Important items"
          value={formatNumber(summary.important)}
          hint="Tickets, keys, tokens"
          icon={Gem}
          accent="important"
        />
        <StatTile
          label="Mails"
          value={formatNumber(summary.mails)}
          hint="Delivered messages"
          icon={Mail}
          accent="neutral"
        />
      </div>

      <PanelSection
        title="Session history"
        description="Every change made in this tab, newest last. Nothing is saved until you export."
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        {changes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">
            No edits yet. Open a tab and start changing values.
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {[...changes].reverse().map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 border-b border-border/50 px-5 py-2.5 text-sm last:border-b-0 sm:px-6"
              >
                <History className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-foreground">{entry.label}</span>
                  <span className="text-muted-foreground"> — {entry.detail}</span>
                </span>
                <span className="mono-id shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </div>
  );
};
