let cached: Promise<string[] | null> | null = null;

/**
 * Story *clear* flags. In the server code these are the switch ids whose type is
 * in {103, 200, 201, 9002} — the "main story clear" set. Opening a stage only
 * needs a type-101 opener, which is why a map can look fully unlocked while no
 * stage reads as cleared.
 */
export const loadClearSwitches = (): Promise<string[] | null> => {
  if (!cached) {
    const base = import.meta.env.BASE_URL ?? "/";
    cached = fetch(`${base}ffbe/clear-switches.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        data && Array.isArray(data.ids) ? (data.ids as string[]) : null,
      )
      .catch(() => null);
  }
  return cached;
};
