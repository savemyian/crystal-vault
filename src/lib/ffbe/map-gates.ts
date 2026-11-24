export interface MapGateMap {
  /** dungeon id -> switches that open that map node */
  nodes: Record<string, string[]>;
  /** switches of event/town missions that own a hidden node but no dungeon gate */
  extra: string[];
}

let cached: Promise<MapGateMap | null> | null = null;

/**
 * Map nodes (towns, espers, side areas) are opened by the dungeon master's own
 * switch pair plus the open/required switches of every mission that lives in
 * that dungeon — esper and quest missions included. Shipped as a static asset
 * so the editor can open every node without replaying the client.
 */
export const loadMapGates = (): Promise<MapGateMap | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/map-gates.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && data.nodes && typeof data.nodes === "object"
          ? (data as MapGateMap)
          : null,
      )
      .catch(() => null);
  }
  return cached;
};

export const allMapGateSwitches = (map: MapGateMap): string[] => {
  const out = new Set<string>(map.extra ?? []);
  for (const list of Object.values(map.nodes)) {
    for (const switchId of list) out.add(switchId);
  }
  return Array.from(out);
};

export const mapGateNodeCount = (map: MapGateMap): number =>
  Object.keys(map.nodes).length;
