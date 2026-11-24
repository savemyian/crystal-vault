import {
  GL_CELESTITE_NAMES,
  GL_EQUIP_NAMES,
  GL_MATERIA_NAMES,
} from "./gl-remap";
import type { Catalog } from "./types";

/**
 * Equipment that exists on private "lapis" servers but not in retail master
 * data, so no shipped name matches it. Ids are confirmed by the owning player
 * from their in-game box.
 */
export const PRIVATE_EQUIP_NAMES: Record<string, string> = {
  "800000185": "True Imperial Armor",
  "800000186": "Asterisk Zeta",
  "800000187": "Celestite Helm of Will",
  "800000188": "Celestite Helm of Will 4*",
  "800000189": "Celestite Helm of Will 5*",
  "800000190": "Celestite Helm of Will+ 6*",
  "800000191": "Celestite Helm of Will+ 7*",
  "800000192": "Celestite Helm of Will++ 8*",
  "800000193": "Celestite Helm of Will++ 9*",
  "800000194": "Celestite Crown of Will 10*",
  "800000200": "Celestite Garb of Will",
  "800000201": "Celestite Garb of Will 4*",
  "800000202": "Celestite Garb of Will 5*",
  "800000203": "Celestite Garb of Will+ 6*",
  "800000204": "Celestite Garb of Will+ 7*",
  "800000205": "Celestite Garb of Will++ 8*",
  "800000206": "Celestite Garb of Will++ 9*",
  "800000207": "Celestite Regalia of Will 10*",
  "800000213": "Celestite Circlet of Will",
  "800000214": "Celestite Circlet of Will 4*",
  "800000215": "Celestite Circlet of Will 5*",
  "800000216": "Celestite Circlet of Will+ 6*",
  "800000217": "Celestite Circlet of Will+ 7*",
  "800000218": "Celestite Circlet of Will++ 8*",
  "800000219": "Celestite Circlet of Will++ 9*",
  "800000220": "Celestite Diadem of Will 10*",
  "800000226": "Celestite Ring of Will",
  "800000227": "Celestite Ring of Will 4*",
  "800000228": "Celestite Ring of Will 5*",
  "800000229": "Celestite Ring of Will+ 6*",
  "800000230": "Celestite Ring of Will+ 7*",
  "800000231": "Celestite Ring of Will++ 8*",
  "800000232": "Celestite Ring of Will++ 9*",
  "800000233": "Celestite Signet of Will 10*",
  "800000246": "Celestite Vest of Will",
  "800000247": "Celestite Vest of Will 4*",
  "800000248": "Celestite Vest of Will 5*",
  "800000249": "Celestite Vest of Will+ 6*",
  "800000250": "Celestite Vest of Will+ 7*",
  "800000251": "Celestite Vest of Will++ 8*",
  "800000252": "Celestite Vest of Will++ 9*",
  "800000253": "Celestite Chainmail of Will 10*",
  "800000261": "Ruler's Celestite Regalia of Will+1",
  "800000265": "Dancer's Celestite Diadem of Will+1",
  "800000273": "Ruler's Celestite Crown of Will+1",
  "800000274": "Magister's Celestite Signet of Will+",
  "800000289": "Celestite Breastplate of Will",
  "800000290": "Celestite Breastplate of Will 4*",
  "800000291": "Celestite Breastplate of Will 5*",
  "800000292": "Celestite Breastplate of Will+ 6*",
  "800000293": "Celestite Breastplate of Will+ 7*",
  "800000294": "Celestite Breastplate of Will++ 8*",
  "800000295": "Celestite Breastplate of Will++ 9*",
  "800000296": "Celestite Cuirass of Will 10*",
  "800000307": "High Celestite Mask of Will 10*",
  "800000308": "High Celestite Coat of Will 10*",
  "800000309": "High Celestite Pendant of Will 10*",
  "800000310": "High Celestite Crown of Will 10*",
  "800000311": "High Celestite Robe of Will 10*",
  "800000312": "High Celestite Bracer of Will 10*",
  "800000313": "High Celestite Mask of Will+ 11*",
  "800000314": "High Celestite Coat of Will+ 11*",
  "800000315": "High Celestite Pendant of Will+ 11*",
  "800000316": "High Celestite Crown of Will+ 11*",
  "800000317": "High Celestite Robe of Will+ 11*",
  "800000318": "High Celestite Bracer of Will+ 11*",
  "800000330": "Harukaze",
};

/**
 * Adds the private-server labels, never replacing a real master-data name. The
 * server's own Global import runs first: its ids come from the masters, the
 * hand-kept ones are the box labels the player read off the game.
 */
export const withPrivateEquip = (catalog: Catalog): Catalog => {
  const equip = { ...catalog.equip };
  for (const [id, name] of Object.entries(GL_EQUIP_NAMES)) {
    if (!equip[id]) equip[id] = name;
  }
  for (const [id, name] of Object.entries(GL_CELESTITE_NAMES)) {
    if (!equip[id]) equip[id] = name;
  }
  for (const [id, name] of Object.entries(PRIVATE_EQUIP_NAMES)) {
    if (!equip[id]) equip[id] = name;
  }
  const materia = { ...catalog.materia };
  for (const [id, name] of Object.entries(GL_MATERIA_NAMES)) {
    if (!materia[id]) materia[id] = name;
  }
  return { ...catalog, equip, materia };
};
