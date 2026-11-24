import { useState } from "react";
import { Layers, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSave } from "@/state/save-context";
import type { UnitGroup } from "@/lib/ffbe/types";

const FIELD = [
  { key: "level", label: "Level" },
  { key: "rarity", label: "Rarity" },
  { key: "lb", label: "LB level" },
  { key: "awake", label: "Awakening" },
] as const;

export const UnitGroupDialog = ({
  group,
  open,
  onOpenChange,
}: {
  group: UnitGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { updateUnitGroup, addUnits, removeAllUnitCopies, nameFor } = useSave();
  const [values, setValues] = useState({
    level: String(group?.bestLevel ?? 1),
    rarity: String(group?.bestRarity ?? 3),
    lb: String(group?.bestLb ?? 0),
    awake: String(group?.bestAwake ?? 0),
  });
  const [addCount, setAddCount] = useState("1");
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!group) return null;

  const numeric = {
    level: Math.max(1, Number(values.level) || 1),
    rarity: Math.max(0, Number(values.rarity) || 0),
    lb: Math.max(0, Number(values.lb) || 0),
    awake: Math.max(0, Number(values.awake) || 0),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCog className="size-4 text-category-equip" />
            <span className="mono-id">{group.unit_id}</span>
          </DialogTitle>
          <DialogDescription>
            {nameFor("units", group.unit_id) ?? "Unit"} ·{" "}
            {group.copies.toLocaleString("en-US")} copies in this account. Changes
            apply to every copy of this unit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELD.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label
                htmlFor={`group-${field.key}`}
                className="text-xs text-muted-foreground"
              >
                {field.label}
              </Label>
              <Input
                id={`group-${field.key}`}
                value={values[field.key]}
                inputMode="numeric"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                className="mono-id h-9 bg-background/50"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-secondary/25 p-3">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <Input
              value={addCount}
              inputMode="numeric"
              onChange={(event) => setAddCount(event.target.value)}
              className="mono-id h-8 w-16 bg-background/50 text-center text-xs"
              aria-label="Copies to add"
            />
            <span className="text-xs text-muted-foreground">more copies</span>
          </div>
          <Button
            size="xs"
            variant="subtle"
            className="ml-auto"
            onClick={() =>
              addUnits({
                unitId: group.unit_id,
                copies: Math.max(1, Number(addCount) || 1),
                ...numeric,
              })
            }
          >
            Add copies
          </Button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] p-3">
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-foreground">
                Delete all {group.copies} copies of {group.unit_id}?
              </span>
              <Button
                size="xs"
                variant="destructive"
                className="ml-auto"
                onClick={() => {
                  removeAllUnitCopies(group.unit_id);
                  setConfirmRemove(false);
                  onOpenChange(false);
                }}
              >
                Yes, delete them
              </Button>
              <Button
                size="xs"
                variant="quiet"
                onClick={() => setConfirmRemove(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="xs"
              variant="quiet"
              className="text-destructive"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="size-3.5" />
              Remove every copy
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => {
              updateUnitGroup(group.unit_id, numeric);
              onOpenChange(false);
            }}
          >
            Apply to all copies
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
