import type { MissionRow } from "./types";

export interface StoryNode {
  missionId: number;
  stage: string;
  cleared: boolean;
  clears: number;
  firstClear: string | null;
}

export interface StoryArea {
  key: string;
  chapter: string;
  nodes: StoryNode[];
  clearedCount: number;
}

export interface StoryChapter {
  key: string;
  areas: StoryArea[];
  clearedCount: number;
  total: number;
}

/** Story chapters use 7-digit 1xxxxxx IDs; events, raids and trials do not. */
export const isStoryMissionId = (missionId: number): boolean => {
  const value = String(missionId);
  return value.length === 7 && value.startsWith("1");
};

const CHAPTER_LABELS: Record<string, string> = {
  "1110": "Chapter 1",
  "1115": "Chapter 1 — Interlude",
  "1120": "Chapter 2",
  "1121": "Chapter 2 — Interlude",
  "1125": "Chapter 2 — Side Arc",
  "1135": "Chapter 3",
};

export const chapterLabel = (key: string): string =>
  CHAPTER_LABELS[key] ?? `Chapter ${key}`;

/**
 * Builds the story tree from the mission rows the save actually contains.
 * Stages missing between the lowest and highest recorded node in an area are
 * surfaced as uncleared nodes, because a save only stores missions already
 * touched by the player.
 */
export const buildStoryChapters = (missions: MissionRow[]): StoryChapter[] => {
  const recorded = new Map<number, MissionRow>();
  for (const mission of missions) {
    if (isStoryMissionId(mission.mission_id)) {
      recorded.set(Number(mission.mission_id), mission);
    }
  }

  const areasByKey = new Map<string, Map<number, MissionRow>>();
  for (const [missionId, row] of recorded) {
    const key = String(missionId).slice(0, 5);
    const bucket = areasByKey.get(key) ?? new Map<number, MissionRow>();
    bucket.set(missionId, row);
    areasByKey.set(key, bucket);
  }

  const chapters = new Map<string, StoryArea[]>();

  for (const [key, rows] of areasByKey) {
    const stages = [...rows.keys()].map((missionId) =>
      Number(String(missionId).slice(5)),
    );
    const lowest = Math.max(0, Math.min(...stages));
    const highest = Math.min(99, Math.max(...stages));

    const nodes: StoryNode[] = [];
    for (let stage = lowest; stage <= highest; stage += 1) {
      const missionId = Number(`${key}${String(stage).padStart(2, "0")}`);
      const row = rows.get(missionId);
      nodes.push({
        missionId,
        stage: String(stage).padStart(2, "0"),
        cleared: Boolean(row && Number(row.status) >= 2),
        clears: Number(row?.clears ?? 0),
        firstClear: row?.first_clear_at ?? null,
      });
    }

    const area: StoryArea = {
      key,
      chapter: key.slice(0, 4),
      nodes,
      clearedCount: nodes.filter((node) => node.cleared).length,
    };

    chapters.set(area.chapter, [...(chapters.get(area.chapter) ?? []), area]);
  }

  return [...chapters.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, areas]) => {
      const sorted = [...areas].sort((left, right) =>
        left.key.localeCompare(right.key),
      );
      return {
        key,
        areas: sorted,
        clearedCount: sorted.reduce((sum, area) => sum + area.clearedCount, 0),
        total: sorted.reduce((sum, area) => sum + area.nodes.length, 0),
      };
    });
};

export const allStoryNodeIds = (chapters: StoryChapter[]): number[] =>
  chapters.flatMap((chapter) =>
    chapter.areas.flatMap((area) => area.nodes.map((node) => node.missionId)),
  );

/** Mission families that are not story chapters — events, raids, trials. */
export const buildOtherFamilies = (
  missions: MissionRow[],
): { key: string; count: number }[] => {
  const families = new Map<string, number>();
  for (const mission of missions) {
    if (isStoryMissionId(mission.mission_id)) continue;
    const key = String(mission.mission_id).slice(0, 5);
    families.set(key, (families.get(key) ?? 0) + 1);
  }
  return [...families.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => Number(right.count) - Number(left.count));
};
