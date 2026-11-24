import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const CategoryDot = ({
  category,
  className,
}: {
  category: "item" | "equip" | "materia" | "important" | "unit" | "mission";
  className?: string;
}) => (
  <span
    className={cn(
      "inline-block size-1.5 rounded-full",
      category === "item" && "bg-category-item",
      category === "equip" && "bg-category-equip",
      category === "materia" && "bg-category-materia",
      category === "important" && "bg-category-important",
      category === "unit" && "bg-category-item",
      category === "mission" && "bg-category-important",
      className,
    )}
  />
);

export const PanelSection = ({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <section
    className={cn(
      "panel-surface rounded-2xl border border-border/70",
      className,
    )}
  >
    <header className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
    <div className={cn("px-5 py-4 sm:px-6 sm:py-5", bodyClassName)}>
      {children}
    </div>
  </section>
);

const accentMap = {
  gold: "border-category-equip/30 bg-category-equip/10 text-category-equip",
  item: "border-category-item/30 bg-category-item/10 text-category-item",
  equip: "border-category-equip/30 bg-category-equip/10 text-category-equip",
  materia:
    "border-category-materia/30 bg-category-materia/10 text-category-materia",
  important:
    "border-category-important/30 bg-category-important/10 text-category-important",
  neutral: "border-border/70 bg-secondary/50 text-muted-foreground",
} as const;

export const StatTile = ({
  label,
  value,
  hint,
  icon: Icon,
  accent = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof accentMap;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-xl border border-border/70 bg-secondary/30 p-4",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "grid size-7 place-items-center rounded-lg border",
          accentMap[accent],
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
    </div>
    <p className="mono-id mt-2 text-xl font-semibold text-foreground">{value}</p>
    {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

export const IdChip = ({
  id,
  name,
  tone = "neutral",
}: {
  id: string;
  name?: string | null;
  tone?: "neutral" | "gold";
}) => (
  <div className="min-w-0">
    <p
      className={cn(
        "mono-id truncate text-sm",
        tone === "gold" ? "text-category-equip" : "text-foreground",
      )}
    >
      {id}
    </p>
    {name ? (
      <p className="truncate text-xs text-muted-foreground">{name}</p>
    ) : null}
  </div>
);

export const InlineNote = ({
  icon: Icon,
  children,
  tone = "muted",
}: {
  icon: LucideIcon;
  children: ReactNode;
  tone?: "muted" | "warning";
}) => (
  <div
    className={cn(
      "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
      tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-border/70 bg-secondary/30 text-muted-foreground",
    )}
  >
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0 leading-relaxed">{children}</div>
  </div>
);
