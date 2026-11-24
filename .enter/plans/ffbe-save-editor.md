# FFBE Offline Save Editor

A browser tool that edits your FFBE save directly: add items, units and equipment, mark missions cleared, adjust gil/lapis/energy, then download the edited save to drop back into MuMu.

Your file never leaves your device — everything runs inside the browser tab, no upload and no server.

## What your save contains

I opened a test save and read it: it holds a complete account.

- One active account, with a populated roster, inventory, mission and mail history.
- A second, backup account sits in the same file, and the game also keeps its own `prev` copy — the editor defaults to the active account and never touches that backup.

## What gets built

- [ ] Drop the save file onto the page and see the active account with its current totals, plus the untouched original always one click away for a full reset.
- [ ] Adjust gil, lapis and energy directly, and see the new values in the overview.
- [ ] Items tab with four categories — items, equipment, materia, important items: search by ID, change a count, add an ID that isn't there yet, and bulk actions such as multiplying every stack by 10 or setting all stacks to a chosen number.
- [ ] Units tab: browse the roster, add units by ID with level, rarity, awakening and limit break, bulk-add from a pasted list of IDs, and clean up duplicates.
- [ ] Missions tab: see cleared missions, objectives and side missions; mark chosen ones cleared, mark everything that exists as cleared, and add specific mission IDs you want completed — story missions included, as a "cleared" flag only.
- [ ] A clear label on the story action: it flips completion, it does not play the fights or drop their rewards, and story scenes may not trigger the way they do after a real battle.
- [ ] Optional name list: drop a simple ID + name file (from your pulled data files) and every screen shows readable names and searchable text instead of bare numbers. Without it, everything still works by ID.
- [ ] Export: download a save with the same file name as yours, with a summary of every change and a passed integrity check; the original stays intact and the copy-back steps are shown on screen.

## Limits worth knowing

- It cannot play the game. There is no auto-battling, no automatic story run, no reward generation — a save only records outcomes, so the most it can do for story quests is mark them cleared.
- Rewards tied to a clear are recorded by the game's own battle result, so flagging a mission cleared will not hand you its first-clear prizes.
- Your save stores numbers, not names. Readable item and unit names depend on the name list above; without it you add things by ID.
- Unplayed story missions are not listed anywhere in your save, so completing them needs their IDs pasted in or supplied by a name list.
- The game keeps a second account and its own previous-save copy in the same folder. The editor only rewrites the one file you export, so the existing backup stays as your safety net.
- The tool can't confirm that the game accepts a re-saved file — you copy the export back the same way you pulled the save out, and your original is always kept.
- Bulk mission completion uses the mission IDs available in your save; completing missions the save has never recorded needs either a name list or the IDs pasted in.
- Single-player, offline use only. Nothing is shared, published or synced anywhere.
