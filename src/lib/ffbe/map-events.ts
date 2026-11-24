export interface MapEvent {
  /** the mission the event closes */
  m: string;
  /** switches that make the event play */
  c: string[];
  /** the switch the event turns on once it has played */
  o: string;
}

export interface MapEventMap {
  events: MapEvent[];
  /** switches another one stands for (the master's own gaps) */
  implied: Record<string, string[]>;
}

let cached: Promise<MapEventMap | null> | null = null;

/**
 * The maps' own event pages (the client's `F_MAP_EVENT_MST`): an event plays
 * once the switches it names are on, and turns on the switch that opens the
 * next part of the map — the side quests an esper island or a town node waits
 * for. The client does this while walking; the editor has to do it itself.
 */
export const loadMapEvents = (): Promise<MapEventMap | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/map-events.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.events) ? (data as MapEventMap) : null,
      )
      .catch(() => null);
  }
  return cached;
};

/**
 * Every switch `held` implies: an event whose conditions are all on plays and
 * turns on its own switch, which may let further events play. Runs to a fixed
 * point, so a quest chain completes in one pass however long it is.
 */
export const switchesFromEvents = (
  map: MapEventMap,
  held: Iterable<string>,
): string[] => {
  const have = new Set<string>();
  for (const id of held) have.add(String(id).trim());
  const added = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const [trigger, extras] of Object.entries(map.implied ?? {})) {
      if (!have.has(trigger)) continue;
      for (const extra of extras) {
        if (have.has(extra)) continue;
        have.add(extra);
        added.add(extra);
        changed = true;
      }
    }
    for (const event of map.events) {
      if (have.has(event.o)) continue;
      if (event.c.length === 0) continue;
      if (!event.c.every((switchId) => have.has(switchId))) continue;
      have.add(event.o);
      added.add(event.o);
      changed = true;
    }
  }
  return Array.from(added);
};
