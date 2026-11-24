import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSave } from "@/state/save-context";
import type { Catalog } from "@/lib/ffbe/types";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/ffbe/format";

/**
 * ID input that also accepts a name: typing shows the shipped catalogue
 * entries as a dropdown, picking one fills in its numeric ID.
 */
export const CatalogCombobox = ({
  bucket,
  value,
  onChange,
  placeholder,
  id,
  ariaLabel,
  ownedFor,
  inputClassName,
  limit = 8,
}: {
  bucket: keyof Catalog;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  ownedFor?: (id: string) => number | undefined;
  inputClassName?: string;
  limit?: number;
}) => {
  const { searchCatalog } = useSave();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = value.trim();
  const matches = query.length >= 2 ? searchCatalog(bucket, query, limit) : [];
  const show = open && matches.length > 0;
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive(Math.min(activeIndex + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(Math.max(0, activeIndex - 1));
          } else if (event.key === "Enter" && show) {
            event.preventDefault();
            pick(matches[activeIndex].id);
          } else if (event.key === "Escape" && show) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn("mono-id bg-background/50 pl-8", inputClassName)}
      />

      {show ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {matches.map((entry, index) => {
            const owned = ownedFor?.(entry.id);
            return (
              <li key={entry.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(entry.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                    index === activeIndex
                      ? "bg-secondary/70 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/40",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {entry.name}
                  </span>
                  {typeof owned === "number" && owned > 0 ? (
                    <span className="mono-id shrink-0 text-[11px] text-category-equip">
                      {formatNumber(owned)}
                    </span>
                  ) : null}
                  <span className="mono-id shrink-0 text-[11px] text-muted-foreground">
                    {entry.id}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
