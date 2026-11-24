export interface EsperEntry {
  id: number;
  name: string;
  /** highest rarity the client ships for this esper (1-3 stars) */
  maxRare: number;
  /** level at that rarity */
  maxLv: number;
  /** CP earned by that level, from F_BEAST_CP_MST */
  cp: number;
  /** every board piece learned: 73 bits, 19 hex digits */
  mask: string;
  /** 820<esper><rarity>10 switches that unlock each star */
  switches: string[];
}

export interface EsperList {
  espers: EsperEntry[];
}

let cached: Promise<EsperList | null> | null = null;

/**
 * Built from the client's own F_BEAST_MST / F_BEAST_STATUS_MST /
 * F_BEAST_BOARD_PIECE_MST / F_BEAST_CP_MST tables: 21 espers, ids 1-21.
 */
export const loadEspers = (): Promise<EsperList | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/espers.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.espers) ? (data as EsperList) : null,
      )
      .catch(() => null);
  }
  return cached;
};

/** `10007400` opens the 幻獣 screen itself; retail grants it at Siren's tower. */
const ESPER_MENU_SWITCH = "10007400";

export const esperUnlockSwitches = (list: EsperList): string[] => [
  ESPER_MENU_SWITCH,
  ...list.espers.flatMap((esper) => esper.switches),
];
