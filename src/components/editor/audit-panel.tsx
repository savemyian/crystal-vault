import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  HelpCircle,
  Mail,
  ShieldOff,
  Users,
} from "lucide-react";
import { useSave } from "@/state/save-context";
import { PanelSection } from "./primitives";
import { formatNumber } from "@/lib/ffbe/format";
import { cn } from "@/lib/utils";
import type { Catalog } from "@/lib/ffbe/types";

const MAX_ITEM_STACK = 9999;

interface Finding {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "info" | "good";
  icon: typeof Coins;
  rows: { id: string; name: string | null; extra?: string }[];
}

const toneClass = {
  warning: "border-warning/30 bg-warning/[0.07] text-warning",
  info: "border-border/70 bg-secondary/25 text-muted-foreground",
  good: "border-category-materia/30 bg-category-materia/[0.07] text-category-materia",
} as const;

export const AuditPanel = () => {
  const {
    readInventory,
    readLoadouts,
    readUnitGroups,
    readTeams,
    readMails,
    nameFor,
    version,
  } = useSave();

  const findings = (() => {
    const items = readInventory("item");
    const equip = readInventory("equip");
    const materia = readInventory("materia");
    const important = readInventory("important");
    const units = readUnitGroups();
    const loadouts = readLoadouts();
    const teams = readTeams();
    const mails = readMails();

    const equipped = new Set<string>();
    const slotted = new Set<string>();
    for (const loadout of loadouts) {
      for (const id of loadout.equip) if (id) equipped.add(id);
      for (const id of loadout.materia) if (id) slotted.add(id);
    }

    const deckUnits = new Set<number>();
    for (const team of teams) {
      for (const slot of team.slots) if (slot.unitRowId) deckUnits.add(slot.unitRowId);
    }

    const bucketUnnamed = (
      bucket: keyof Catalog,
      rows: { item_id: string; count: number }[],
    ) =>
      rows
        .filter((row) => !nameFor(bucket, row.item_id))
        .map((row) => ({ id: row.item_id, name: null, extra: `×${row.count}` }));

    const result: Finding[] = [];

    const neverEquipped = equip
      .filter((row) => !equipped.has(row.item_id))
      .map((row) => ({
        id: row.item_id,
        name: nameFor("equip", row.item_id),
        extra: `×${row.count}`,
      }));
    result.push({
      id: "equip-unused",
      title: "Equipment never worn",
      detail:
        "Gear sitting in the box that no unit in this save has equipped. Useful when you are hunting for free slots.",
      tone: neverEquipped.length === 0 ? "good" : "info",
      icon: ShieldOff,
      rows: neverEquipped,
    });

    const neverSlotted = materia
      .filter((row) => !slotted.has(row.item_id))
      .map((row) => ({
        id: row.item_id,
        name: nameFor("materia", row.item_id),
        extra: `×${row.count}`,
      }));
    result.push({
      id: "materia-unused",
      title: "Materia never slotted",
      detail: "Materia in the box that is not attached to any unit loadout.",
      tone: neverSlotted.length === 0 ? "good" : "info",
      icon: HelpCircle,
      rows: neverSlotted,
    });

    const capped = [...items, ...equip, ...materia, ...important]
      .filter((row) => Number(row.count) >= MAX_ITEM_STACK)
      .map((row) => ({ id: row.item_id, name: null, extra: `×${row.count}` }));
    result.push({
      id: "capped",
      title: "Stacks at the cap",
      detail: `Anything at ${formatNumber(MAX_ITEM_STACK)} or more cannot grow further; the game may drop additional copies.`,
      tone: capped.length === 0 ? "good" : "warning",
      icon: AlertTriangle,
      rows: capped,
    });

    const unplaced = units
      .filter((group) => !group.ids.some((id) => deckUnits.has(id)))
      .map((group) => ({
        id: group.unit_id,
        name: nameFor("units", group.unit_id),
        extra: `×${group.copies}`,
      }));
    result.push({
      id: "units-unplaced",
      title: "Units in no deck",
      detail:
        "Owned units that appear in none of your stored decks. Handy for finding forgotten copies.",
      tone: unplaced.length === 0 ? "good" : "info",
      icon: Users,
      rows: unplaced,
    });

    const unnamed = [
      ...bucketUnnamed("items", items),
      ...bucketUnnamed("equip", equip),
      ...bucketUnnamed("materia", materia),
      ...bucketUnnamed("important", important),
      ...units
        .filter((group) => !nameFor("units", group.unit_id))
        .map((group) => ({ id: group.unit_id, name: null, extra: `×${group.copies}` })),
    ];
    result.push({
      id: "unnamed",
      title: "Ids with no name",
      detail:
        "Ids the shipped catalogue still cannot name. Label them once in their own tab and the name sticks.",
      tone: unnamed.length === 0 ? "good" : "warning",
      icon: HelpCircle,
      rows: unnamed,
    });

    const undeleted = mails.filter((mail) => !mail.deleted);
    result.push({
      id: "mail",
      title: "Mail still in the box",
      detail: "Messages the account has not cleared from the box.",
      tone: undeleted.length === 0 ? "good" : "info",
      icon: Mail,
      rows: undeleted.slice(0, 12).map((mail) => ({
        id: String(mail.mail_id),
        name: mail.title,
        extra: mail.received_at ? "received" : "unread",
      })),
    });

    return result;
  })();
  void version;

  return (
    <PanelSection
      title="Audit"
      description="A read-only health check of this account: duplicated effort, forgotten gear and ids the name database still cannot resolve."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {findings.map((finding) => (
          <article
            key={finding.id}
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-secondary/15 p-4"
          >
            <header className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg border",
                  toneClass[finding.tone],
                )}
              >
                <finding.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {finding.title}
                  </h3>
                  <span className="mono-id shrink-0 text-sm text-foreground">
                    {finding.rows.length === 0 ? (
                      <CheckCircle2 className="size-4 text-category-materia" />
                    ) : (
                      finding.rows.length.toLocaleString("en-US")
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{finding.detail}</p>
              </div>
            </header>

            {finding.rows.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {finding.rows.slice(0, 10).map((row) => (
                  <li
                    key={`${finding.id}-${row.id}`}
                    className="max-w-full rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px]"
                  >
                    <span className="mono-id text-foreground">{row.id}</span>
                    {row.name ? (
                      <span className="ml-1.5 text-muted-foreground">{row.name}</span>
                    ) : null}
                    {row.extra ? (
                      <span className="mono-id ml-1.5 text-muted-foreground/80">
                        {row.extra}
                      </span>
                    ) : null}
                  </li>
                ))}
                {finding.rows.length > 10 ? (
                  <li className="px-1 py-1 text-[11px] text-muted-foreground">
                    +{finding.rows.length - 10} more
                  </li>
                ) : null}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </PanelSection>
  );
};
