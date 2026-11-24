export interface StorySwitchMap {
  missions: Record<string, string[]>;
}

let cached: Promise<StorySwitchMap | null> | null = null;

/**
 * Every story stage opens the map through a "switch" id stored in
 * `user_kv['switches']`. Mission rows alone do not unlock the world map, so the
 * editor has to grant the same ids a real clear would. The client's own master
 * data supplies the per-mission ids; they are shipped as a static asset.
 */
export const loadStorySwitches = (): Promise<StorySwitchMap | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/story-switches.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && data.missions && typeof data.missions === "object"
          ? (data as StorySwitchMap)
          : null,
      )
      .catch(() => null);
  }
  return cached;
};

export const switchesForMissions = (
  map: StorySwitchMap,
  missionIds: Array<number | string>,
): string[] => {
  const out = new Set<string>();
  for (const id of missionIds) {
    for (const switchId of map.missions[String(id)] ?? []) out.add(switchId);
  }
  return Array.from(out);
};

export const allStorySwitches = (map: StorySwitchMap): string[] => {
  const out = new Set<string>();
  for (const list of Object.values(map.missions)) {
    for (const switchId of list) out.add(switchId);
  }
  return Array.from(out);
};

export const storyMissionCount = (map: StorySwitchMap): number =>
  Object.keys(map.missions).length;
