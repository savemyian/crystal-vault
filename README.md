# Crystal Vault

**Crystal Vault** is a browser-based save editor and desktop pull/push toolkit for **Final Fantasy Brave Exvius JP** running against a local **lapis** private server (typically inside MuMu Player).

It opens the server's `save.db` entirely in the browser, lets you edit inventory, units, missions, mail, Item World enhancements and more, then writes a clean, self-contained database back to the device.

> **Unofficial fan project.** Not affiliated with Square Enix, gumi, or the lapis server authors. FINAL FANTASY BRAVE EXVIUS and its assets belong to Square Enix. Use it only with your own save, and keep a backup.

---

## Highlights

- **Fully local editing** — the save is parsed with SQLite compiled to WebAssembly (sql.js). Save contents are never uploaded.
- **WAL-aware import** — drag in `save.zip` (database + `-wal`) or `save.db` + `save.db-wal`; committed WAL frames are merged in the browser. No Python, no extraction.
- **One-file Save Tools** — a Windows `.bat` that finds adb and MuMu, pulls the live save, and pushes the edited one back with backups, checksums and automatic restore on failure. No console commands.
- **Complete editor** — account, items, equipment, materia, important items, units, teams, Vision cards, story unlocks, missions, mail, autoplay simulation, audit log and undo/redo.
- **Item World editor** — inspect and edit EX abilities on enhanced equipment, add the same ability multiple times, create enhancement rows for items that never went through a dive, and add the equipment stock in the same step.
- **Real reward data** — first-clear and star rewards are generated from a shipped reward pool validated against live server mail.
- **English ability labels** — Item World ability ids are shown with English names and remain searchable by their original Japanese names.

---

## Quick start

### 1. Pull the save with Save Tools

1. Download [`ffbe-save-tools.bat`](public/tools/ffbe-save-tools.bat).
2. In MuMu, enable **Root** once: **Settings → Other → Root permission**.
3. Start MuMu and double-click the tool.
4. Choose **1** to pull.

The tool:

- finds `adb` automatically (or opens a file picker once and remembers it),
- finds the emulator on the common adb ports,
- checks root access,
- stops the game, copies `save.db` + `-wal` + `-shm`, and writes `save.zip`,
- opens the `ffbe-save` folder next to the tool.

The game is left **stopped**. Do not play until you push your edits back.

### 2. Edit

Drag `save.zip` into the editor. The WAL is merged automatically.

### 3. Push

Export the save (`Download save` or `Save to folder`), then **drag `save.db` onto `ffbe-save-tools.bat`**. The tool detects the dropped file, asks for confirmation, then:

- backs up the live database and WAL,
- writes the edited database in place,
- removes the old WAL/SHM files,
- verifies MD5 and WAL cleanup,
- restores the backup automatically if verification fails,
- restarts the game.

You can also double-click the tool and choose **2**; it looks for the newest `save.db` in `ffbe-save` or `Downloads` and asks before writing.

### Running locally

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm build:prod   # production build in dist/
pnpm lint
pnpm exec tsc --noEmit
```

Any static host can serve the production build. The Save Tools file is a normal static asset under `public/tools/`.

### Fork and customize

Fork the repository and run `pnpm install && pnpm dev`. The save-format logic lives in `src/lib/ffbe`, the editor UI in `src/components/editor`, and the shipped data in `public/ffbe`. The MIT license allows modifications and redistribution; keep the attribution and the game-data notice.

---

## Supported setup

| Item | Details |
| --- | --- |
| Client | FFBE **JP** (`com.square_enix.ffbejpn`) |
| Server | lapis private server |
| Emulator | MuMu Player (primary); other adb-accessible emulators may work |
| Save path | `/data/data/com.square_enix.ffbejpn/files/lapis/root/data/save.db` |
| Related files | `save.db-wal`, `save.db-shm` |
| Access | Root required to read/write `/data/data` |
| Platform | Editor: any modern browser. Save Tools: Windows |

The save **is** the lapis server database. There is no separate export format.

---

## Editor sections

| Section | What it does |
| --- | --- |
| **Overview** | Account name, rank, gil, lapis, energy; quick navigation. |
| **Items / Equipment / Materia / Important** | Stack counts, add/remove items, bulk multiply/set/add, search the shipped catalogue, label unknown ids. |
| **Units** | Add units and copies, set level/rarity/LB/awakening, remove copies, group by unit. |
| **Teams** | Edit the active party and saved decks; move units between slots. |
| **Autoplay** | Replay stages without fighting: clears, stars, drops, gil, chests, harvest, quest/story progress, DV/CoW scores, TMR, event points, and reward mail. |
| **Vision cards** | Copies, level, naming. |
| **Story** | Grant story/world-map switches and map gates, grant espers. |
| **Missions** | Clear/reset missions, inspect side missions, claim side-mission rewards. |
| **Mail** | Browse generated mail, read grants, mark as read/deleted. |
| **Item World** | Enhanced equipment, EX abilities, counters, claims, create new enhancements. |
| **Audit** | Every change made this session, with undo/redo. |
| **Tools** | Save Tools download, manual adb commands, named inventory presets. |

Every write goes through one mutation path that records an audit entry and snapshots the affected tables for undo.

---

## Item World

The save has no numeric stat columns for enhanced equipment. The bonus is stored as a list of learned EX abilities in `custom_equip.ex_learn`:

```text
custom_equip
  custom_id        1000000006
  base_item_id     302008300       -- the equipment the game equips
  ex_learn         24:102900,24:102900,24:102900
  before_ex_learn  <previous set, used by the in-game revert>
  created_at       <unix time>
```

- `24:<abilityId>` is the stored entry format.
- **Duplicates are valid.** Three `24:102900` entries mean ATK +1000 learned three times.
- `before_ex_learn` is the pre-dive set; the editor can restore it.
- `equip_grow_claims` records floor rewards already claimed.
- `user_kv` holds the counters: `eg_orb`, `eg_points`, `eg_week`, `eg_selected`, `eg_custom_seq`.

**Enhance equipment** in the editor:

- picks an equipment id (or name from the catalogue),
- adds EX abilities (search by English name, Japanese name, or raw id),
- optionally adds copies to equipment stock in the same operation,
- creates the next `custom_equip` row (`1,000,000,000 + eg_custom_seq`), advances the sequence, and refuses to create a duplicate row for the same base item.

Ability labels live in [`public/ffbe/abilities.json`](public/ffbe/abilities.json): 170 Item World ability families with English labels and the original Japanese names for search. These JP-only abilities have no official English release; the English labels are translations. The game still resolves their stats from its own client master.

---

## Save format notes

These are the semantics the editor relies on. They were established against real saves.

- `mission_progress.status = 2` means **cleared**. “COMPLETE” is derived from the challenge rows, not a separate status.
- Objective stars are `challenge_progress` rows with `challenge_id = mission_id * 10 + slot`.
- Stage clear mail uses `clear_reward` / `Mission Clear Reward`; star mail uses `first_clear` / `Challenge Reward` with refs like `<mission>:<challengeId>`.
- Mail grants are JSON: `{"kind","item_id","count","pattern","points"}`. Lapis and gil use an empty `item_id`.
- Reward kinds used by the server: `lapis`, `gil`, `item`, `equip`, `materia`, `important`, `unit`, `recipe`, `vision`.
- The mission clear lapis amount is multiplied by `server_setting['master:lapis_reward']` when present (for example, 100 × 20 = 2,000). Challenge lapis is paid raw.
- Item World ability entries are the `24:<id>` list described above.
- The editor **does not invent reward values**: star and clear rewards come from `public/ffbe/clear-rewards.json`, which was generated from the server's own reward data and validated against live mail:
  - 759/759 star mails matched,
  - 64/64 clear mails matched.
- Autoplay uses the shipped stage/drop masters, event rewards, field loot and story data. It writes the same rows a real run would: clears, stars, drops, attempts, gil, points, switches and reward mail.

---

## WAL and archive handling

The live database is usually in WAL mode, so recent transactions live in `save.db-wal` rather than `save.db`.

- [`src/lib/ffbe/wal.ts`](src/lib/ffbe/wal.ts) applies committed frames in order, verifies header/frame checksums and salts, stops at the last valid commit, ignores torn tail frames, and sets the final database page count.
- [`src/lib/ffbe/save-package.ts`](src/lib/ffbe/save-package.ts) accepts:
  - `save.zip` containing `save.db` + `save.db-wal`,
  - `save.db` and `save.db-wal` dropped together,
  - an already-merged `save.db` alone.
- The exported database is self-contained; re-importing it does not need a WAL.

This was tested against real saves: the JS merge produced table-for-table identical results to SQLite's own `VACUUM INTO` merge across all 81 tables, with `PRAGMA integrity_check = ok`, and the result opens in sql.js.

---

## Architecture

```text
public/
  ffbe/                 shipped master data and reward pools
  tools/                Windows Save Tools
  demo-save.db          synthetic sample save
  demo-catalog.json     sample names
src/
  components/editor/    editor UI (one panel per section)
  lib/ffbe/             save-format helpers, masters, WAL merge, simulation
  state/
    save-provider.tsx   sql.js database, mutations, undo/redo, export
    save-context.ts     typed store contract
  pages/Index.tsx       tab shell
```

- **React 19 + Vite + TypeScript + Tailwind + shadcn/ui**
- **sql.js** for SQLite in the browser
- **fflate** for ZIP import
- **No backend, no accounts.** The database lives in the browser tab; only UI settings, imported name overrides and presets use `localStorage`.
- The hosting platform may collect standard page analytics; save data is never part of it.
- Mutations are plain SQL against the in-memory database. Each change snapshots the affected tables for undo (25 steps, 3 for very large tables such as mail).

---

## Verification and limitations

**Verified here**

- WAL merge against two real saves, including zip and two-file import paths.
- Clear/star reward values against the server's historical mail.
- Item World row creation/editing format and sequence handling.
- `pnpm lint`, `pnpm exec tsc --noEmit`, and the production build.

**Not verified here**

- The Windows Save Tools adb pull/push against a real emulator — this environment has no Windows or MuMu. The pull logic follows a working adb workflow; the push path is new. Test with a no-op push or a second emulator instance, and keep the automatic backup.
- In-game application of every edited field. The editor writes the server database; the client still validates data and resolves master data on its side.

**Known limits**

- Built for the JP client + lapis private server; it is not a GL or official-server editor.
- Root is required for `/data/data`.
- The Save Tools is Windows-only.
- Item World stores ability ids, not stat numbers; the game's ability master determines the actual values.
- English Item World ability labels are translations, not official localizations.
- No cloud sync or multi-device accounts.

---

## Safety

- Keep the `save.zip` you pulled as your rollback.
- Save Tools backs up the live database and WAL before every push and restores automatically on a checksum/WAL failure.
- Do not share saves publicly; they contain account data.
- Do not push a save exported from the sample save or from a different account.

---

## Data and credits

- FFBE JP master data (names, metadata, objectives, stage/drop tables, story data) comes from public JP master-data dumps and is shipped as static JSON under `public/ffbe/`.
- Item World ability labels were derived from the public `aEnigmatic/ffbe-jp` passive-skill data (MIT) and translated.
- Clear-reward pools were generated from the server's own reward data and validated against live mail.
- Built with [Enter](https://enter.pro).

## License

The original Crystal Vault source is released under the **MIT License** — see [LICENSE](LICENSE). You may use, modify and redistribute the code, including commercially, with attribution.

FINAL FANTASY BRAVE EXVIUS game data and assets remain the property of Square Enix and are not covered by the MIT license; see [NOTICE.md](NOTICE.md).

---

## Suggested GitHub metadata

**Description**

> Browser-based save editor and Windows pull/push toolkit for FFBE JP on a lapis private server.

**Topics**

`ffbe` `final-fantasy-brave-exvius` `save-editor` `sqlite` `sqljs` `react` `vite` `typescript` `tailwindcss` `mumu` `adb`
