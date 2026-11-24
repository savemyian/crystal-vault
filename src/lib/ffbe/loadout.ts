/**
 * A unit's gear lives in `unit_equip.equip` / `.materia` as compact strings:
 *
 *   equip   "1-302023000@2-0@3-0@4-0@5-0@6-0|1-0@2-0@..."
 *   materia "1-504244447@2-0@3-0@4-0"
 *
 * Each `slot-number@` pair is `index-value`. The part after `|` is the second
 * saved gear set, which the editor leaves untouched.
 */

export const parseSlots = (raw: string | null | undefined): string[] => {
  const head = String(raw ?? "").split("|")[0] ?? "";
  if (!head.trim()) return [];
  return head.split("@").map((part) => {
    const [, value] = part.split("-");
    return value && value !== "0" ? value : "";
  });
};

export const writeSlot = (
  raw: string | null | undefined,
  index: number,
  value: string,
): string => {
  const groups = String(raw ?? "").split("|");
  const head = groups[0] ?? "";
  const parts = head.length > 0 ? head.split("@") : [];
  const slot = value && value !== "0" ? value : "0";
  while (parts.length <= index) parts.push(`${parts.length + 1}-0`);
  parts[index] = `${index + 1}-${slot}`;
  groups[0] = parts.join("@");
  return groups.join("|");
};

/** "1:0:9632,0:1:2799" → [9632, null, ...] in deck position order. */
export const parseMembers = (raw: string | null | undefined): (number | null)[] => {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  return text
    .split(",")
    .map((entry) => {
      const parts = entry.split(":");
      const id = Number(parts[2]);
      return Number.isFinite(id) && id > 0 ? id : null;
    });
};

export const writeMembers = (
  raw: string | null | undefined,
  position: number,
  unitRowId: number | null,
): string => {
  const text = String(raw ?? "").trim();
  const entries = text ? text.split(",") : [];
  const parsed = entries.map((entry) => {
    const [flag, pos, id] = entry.split(":");
    return {
      flag: Number.isFinite(Number(flag)) ? flag : "0",
      position: Number(pos),
      id: Number(id) > 0 ? Number(id) : 0,
    };
  });
  while (parsed.length <= position) {
    parsed.push({
      flag: parsed.length === 0 ? "1" : "0",
      position: parsed.length,
      id: 0,
    });
  }
  const target = parsed[position];
  target.id = unitRowId ?? 0;
  return parsed
    .map((entry, index) => `${entry.flag}:${Number.isFinite(entry.position) ? entry.position : index}:${entry.id}`)
    .join(",");
};
