import { useState } from "react";
import { Mail, MailOpen, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSave } from "@/state/save-context";
import { InlineNote, PanelSection } from "./primitives";
import { cn } from "@/lib/utils";
import type { Catalog } from "@/lib/ffbe/types";

const dateLabel = (value: number | null) => {
  if (!value) return "—";
  return new Date(Number(value) * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const GRANT_BUCKET: Record<string, keyof Catalog> = {
  item: "items",
  equip: "equip",
  materia: "materia",
  important: "important",
  unit: "units",
  vision: "vision",
};

const grantSummary = (
  raw: string,
  nameFor: (bucket: keyof Catalog, id: string) => string | null,
) => {
  try {
    const parsed = JSON.parse(raw) as {
      kind?: string;
      id?: string;
      item_id?: string;
      count?: number;
    }[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed
      .slice(0, 3)
      .map((entry) => {
        const kind = typeof entry.kind === "string" ? entry.kind : "";
        const id = entry.id ?? entry.item_id ?? "?";
        const count = entry.count ?? 1;
        if (kind === "lapis") return `${count.toLocaleString("en-US")} lapis`;
        if (kind === "gil") return `${count.toLocaleString("en-US")} gil`;
        const bucket = GRANT_BUCKET[kind];
        const name = bucket ? nameFor(bucket, id) : null;
        return `${name ?? id} ×${count}`;
      })
      .join(" · ");
  } catch {
    return null;
  }
};

export const MailPanel = () => {
  const { readMails, setMailDeleted, version, nameFor } = useSave();
  void version;
  const mails = readMails();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"kept" | "deleted" | "all">("kept");
  const [limit, setLimit] = useState(60);

  const needle = query.trim().toLowerCase();
  const visible = mails.filter((mail) => {
    if (filter === "kept" && mail.deleted) return false;
    if (filter === "deleted" && !mail.deleted) return false;
    if (!needle) return true;
    return (
      String(mail.mail_id) === needle ||
      mail.title.toLowerCase().includes(needle) ||
      mail.message.toLowerCase().includes(needle) ||
      mail.source.toLowerCase().includes(needle)
    );
  });

  const keptCount = mails.filter((mail) => !mail.deleted).length;

  return (
    <PanelSection
      title="Mail box"
      description="Every message stored in the save. Deleting here only hides the message from the box — the items attached to it are not granted or removed."
      actions={
        <>
          <div className="flex rounded-lg border border-border/70 p-0.5">
            {(["kept", "deleted", "all"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                  filter === option
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, text or source"
              className="h-8 bg-background/50 pl-8 text-sm"
            />
          </div>
          <Button
            size="xs"
            variant="quiet"
            disabled={visible.length === 0}
            onClick={() => setMailDeleted(visible.map((mail) => mail.mail_id), true)}
          >
            <Trash2 className="size-3.5" />
            Delete these
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MailOpen className="size-3.5" />
          {keptCount.toLocaleString("en-US")} in the box
        </span>
        <span className="text-border">·</span>
        <span>{mails.length.toLocaleString("en-US")} stored in total</span>
      </div>

      {mails.length === 0 ? (
        <InlineNote icon={Mail}>This save has no mail table.</InlineNote>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
          {visible.slice(0, limit).map((mail) => {
            const grants = grantSummary(mail.grants, nameFor);
            return (
              <li
                key={mail.mail_id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm",
                      mail.deleted ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {mail.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {mail.message}
                  </p>
                  <p className="mono-id mt-1 text-[10px] text-muted-foreground/80">
                    #{mail.mail_id} · {dateLabel(mail.sent_at)} · {mail.source}
                    {grants ? ` · ${grants}` : ""}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="quiet"
                  className="shrink-0"
                  onClick={() => setMailDeleted([mail.mail_id], !mail.deleted)}
                >
                  {mail.deleted ? (
                    <>
                      <Undo2 className="size-3.5" /> Restore
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-3.5" /> Delete
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > limit ? (
        <Button
          variant="quiet"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setLimit((value) => value + 200)}
        >
          Show more ({visible.length - limit} left)
        </Button>
      ) : null}
    </PanelSection>
  );
};
