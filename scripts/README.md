# scripts/

Looking for what still needs to be done (art to draw, GIFs to record,
settings to check)? That's [TODO.md](../TODO.md), not this file. This file
is only about running the generators locally.

Every generator here can be run locally against the real GitHub API, no
need to wait for a scheduled Action to see your changes. All of them need
Node 18+ (global `fetch`) and a token:

```bash
# any of these work: a personal access token, or `gh auth token` if you
# have the GitHub CLI logged in
export GITHUB_TOKEN=$(gh auth token)
```

## rocket-graph.mjs

Animated SVG of the contribution graph with a pixel rocket destroying
squares as it flies over them.

```bash
node scripts/rocket-graph.mjs Holmes-99 dark  > rocket-dark.svg
node scripts/rocket-graph.mjs Holmes-99 light > rocket-light.svg
```

Open the `.svg` file directly in a browser tab to preview the SMIL
animation (double-click it, or drag it into a tab). No JavaScript runs
inside it on purpose, GitHub renders these via `<img>`, which never
executes embedded `<script>` tags, only SMIL/CSS animate.

Swap in a real Aseprite sprite: see `assets/sprites/README.md`.

## terminal-card.mjs

Neofetch-style info card. Uses `scripts/lib/github-stats.mjs` for the live
GitHub Stats block; everything else (OS/Host/IDE/Languages.Real/etc rows)
is a static list at the top of the file, edit it directly.

```bash
node scripts/terminal-card.mjs Holmes-99 dark  > terminal-dark.svg
node scripts/terminal-card.mjs Holmes-99 light > terminal-light.svg
```

Takes about a minute to run: it walks every non-fork repo's git tree over
the REST API to estimate a lines-of-code count. That's the slow part, if
you're iterating on layout only, comment out `fetchLinesOfCode` in
`lib/github-stats.mjs` and hardcode a number temporarily.

ASCII art on the left is a placeholder until `assets/ascii/mage.txt`
exists, see `scripts/img2ascii.py` below.

## rpg-sheet.mjs

Same stats, RPG character sheet framing (LEVEL/XP/HP/INVENTORY/QUESTS/
ACHIEVEMENTS). Stat mapping constants (commits per level, bar caps) are
right at the top of the file.

```bash
node scripts/rpg-sheet.mjs Holmes-99 dark  > rpg-dark.svg
node scripts/rpg-sheet.mjs Holmes-99 light > rpg-light.svg
```

`SHIPPED_GAMES` is a hand-maintained constant (there's no API for "did I
ship this"), bump it when a new game gets a public build.

## img2ascii.py

Converts a PNG into the ASCII block `terminal-card.mjs` reads from
`assets/ascii/mage.txt`.

```bash
pip install pillow
python scripts/img2ascii.py path/to/mage.png --width 26 > assets/ascii/mage.txt
```

## guestbook.mjs

Reads issues labeled `guestbook`, sanitizes the submitted name/message,
and rewrites the table in `README.md` between the `GUESTBOOK:START`/`END`
markers.

```bash
export GITHUB_REPOSITORY=Holmes-99/Holmes-99
node scripts/guestbook.mjs --dry-run   # prints the table, doesn't touch README.md
node scripts/guestbook.mjs             # actually rewrites README.md locally
```

## lib/github-stats.mjs

Not a script, a shared module imported by `terminal-card.mjs` and
`rpg-sheet.mjs`. If you're adding a third stats-based card, import
`fetchStats` from here instead of re-writing the GraphQL/REST calls.

## Notes on the data

- `GITHUB_TOKEN` in Actions is the per-workflow bot token, not a personal
  token belonging to the profile owner. Contribution/commit counts only
  ever see PUBLIC activity, same as any visitor to the profile would see.
  That's intentional, not a bug to fix.
- "Lines of code" is the CURRENT size of each repo's source files (walked
  via the git tree API), not cumulative lines ever written/deleted. A true
  historical count needs a full `git log --numstat` clone of every repo,
  too slow and bandwidth-heavy to run on a daily schedule.
