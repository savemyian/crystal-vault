let cached: Promise<string[] | null> | null = null;

/**
 * Every switch id the client's switch master defines. Story, map nodes, towns
 * and quest chains all read from this single pool, so granting all of it is the
 * catch-all for gates that no other table explains.
 */
export const loadAllSwitches = (): Promise<string[] | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/all-switches.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.ids) ? (data.ids as string[]) : null,
      )
      .catch(() => null);
  }
  return cached;
};
