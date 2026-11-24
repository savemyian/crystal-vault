/**
 * Vision card ids are the unit family id × 100 + a two digit card index,
 * e.g. 401008501 belongs to unit family 4010085. The save carries no card
 * names, so the unit catalogue is the closest thing we can seed them with.
 */
export const buildVisionNames = (
  cardIds: string[],
  units: Record<string, string>,
): Record<string, string> => {
  // prefer a latin name when the family has both a JP and a GL entry
  const families = new Map<string, { id: string; name: string; latin: boolean }>();
  for (const [id, name] of Object.entries(units)) {
    if (id.length < 7) continue;
    const family = id.slice(0, -2);
    const latin = !/[\u3000-\u9fff\uff00-\uffef]/.test(name);
    const current = families.get(family);
    if (
      !current ||
      (latin && !current.latin) ||
      (latin === current.latin && id < current.id)
    ) {
      families.set(family, { id, name, latin });
    }
  }

  const names: Record<string, string> = {};
  for (const cardId of cardIds) {
    const hit = families.get(cardId.slice(0, -2));
    if (hit) names[cardId] = `${hit.name} card`;
  }
  return names;
};
