export interface ObjectiveSet {
  /** objective texts, indexed by the number stored in the asset */
  names: string[];
  /** mission id → { slot: name index } */
  missions: Record<string, Record<string, number>>;
}

let cached: Promise<ObjectiveSet | null> | null = null;

/**
 * Stage objectives (the three or four stars under a mission) come from the
 * client's F_CHALLENGE_MST, decrypted from the server's own download and
 * reduced to 12,600 missions. Challenge ids are `mission_id * 10 + slot`.
 */
export const loadObjectives = (): Promise<ObjectiveSet | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/objectives.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.names) && data.missions
          ? (data as ObjectiveSet)
          : null,
      )
      .catch(() => null);
  }
  return cached;
};

export const objectivesFor = (
  set: ObjectiveSet | null,
  missionId: number | string,
): { slot: number; name: string }[] => {
  const row = set?.missions[String(missionId)];
  if (!row) return [];
  return Object.entries(row)
    .map(([slot, index]) => ({
      slot: Number(slot),
      name: set?.names[index] ?? "",
    }))
    .filter((entry) => Number.isFinite(entry.slot) && entry.name)
    .sort((left, right) => left.slot - right.slot);
};
