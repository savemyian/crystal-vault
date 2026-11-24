export interface MasterMission {
  id: number;
  name: string;
}

export interface MasterDungeon {
  id: number;
  name: string;
  missions: MasterMission[];
}

export interface MasterLand {
  id: number;
  name: string;
  dungeons: MasterDungeon[];
}

export interface MasterWorld {
  id: number;
  name: string;
  lands: MasterLand[];
}

export interface StoryMaster {
  worlds: MasterWorld[];
}

let cached: Promise<StoryMaster | null> | null = null;

/**
 * The full story mission tree (every chapter, area and stage of the client),
 * shipped as a static asset. Saves only store missions the player has touched,
 * so this catalog is what makes untouched chapters visible.
 */
export const loadStoryMaster = (): Promise<StoryMaster | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/story-master.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.worlds) ? (data as StoryMaster) : null,
      )
      .catch(() => null);
  }
  return cached;
};

const flattenLand = (land: MasterLand): number[] =>
  land.dungeons.flatMap((dungeon) => dungeon.missions.map((m) => m.id));

export const landMissionIds = (land: MasterLand): number[] => flattenLand(land);

export const dungeonMissionIds = (dungeon: MasterDungeon): number[] =>
  dungeon.missions.map((mission) => mission.id);

export const allMasterMissionIds = (master: StoryMaster): number[] =>
  master.worlds.flatMap((world) =>
    world.lands.flatMap((land) => flattenLand(land)),
  );

export const masterMissionCount = (master: StoryMaster): number =>
  allMasterMissionIds(master).length;
