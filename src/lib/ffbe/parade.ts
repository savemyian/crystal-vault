export interface ParadeMission {
  id: number;
  name: string;
}

export interface ParadeDungeon {
  id: string;
  name: string;
  missions: ParadeMission[];
}

export interface ParadeEdition {
  /** the area the edition is played in */
  area: string;
  /** the area's own title, from the master */
  name: string;
  /** "Dark Visions", "World of Vision" or the edition's own title */
  label: string;
  /** the edition's number among the Dark Visions editions, in master order */
  edition?: number;
  dungeons: ParadeDungeon[];
}

export interface ParadeStages {
  editions: ParadeEdition[];
}

let cached: Promise<ParadeStages | null> | null = null;

/**
 * The score-attack editions (F_AREA_MST areas whose missions are the parade
 * subtype): each edition holds its dungeons, each dungeon its stages. Split out
 * because neither search nor the story tree carries them.
 */
export const loadParadeStages = (): Promise<ParadeStages | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/parade-stages.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.editions) ? (data as ParadeStages) : null,
      )
      .catch(() => null);
  }
  return cached;
};

export const editionMissions = (edition: ParadeEdition): number[] =>
  edition.dungeons.flatMap((dungeon) => dungeon.missions.map((m) => m.id));

export const editionLabel = (edition: ParadeEdition): string =>
  edition.edition
    ? `Dark Visions ${edition.edition} · area ${edition.area}`
    : `${edition.label} · area ${edition.area}`;

export const editionStageCount = (edition: ParadeEdition): number =>
  edition.dungeons.reduce((sum, dungeon) => sum + dungeon.missions.length, 0);
