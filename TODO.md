# TODO

Single source of truth for what's left on the profile README. Everything
else (workflows, scripts, sections) is done and verified working. This file
only tracks what needs a human (you) to do something outside of code.

## Pixel art to draw

All of these are currently working placeholders, nothing is broken while
they're missing. Draw in Aseprite, export, drop in at the exact path, done,
no README edits needed for any of these except the rocket sprite (which
needs a one-line code change too, see below).

- [ ] **Rocket ship sprite**, for the animated rocket contribution graph
  - Path: `assets/sprites/rocket.png`
  - Size: 16x16px (or 32x32px if you want more detail, see note below)
  - Format: PNG, transparent background, hard pixel edges (no anti-aliasing
    on export)
  - Facing right (the rocket flies both directions across the grid; either
    keep the sprite symmetric or draw a second mirrored frame)
  - After drawing: open `scripts/rocket-graph.mjs`, find the
    `rocketSprite` template string, replace the `<rect>` pixel grid with an
    `<image href="...">` tag. Exact code and explanation are in
    `assets/sprites/README.md`. If you go with 32x32 instead of 16x16,
    adjust the scale math there too.
  - Nothing to run locally, just push, `rocket.yml` picks it up on the next
    scheduled run (every 12h) or `git push` to main.

- [ ] **Mage ASCII art**, for the terminal info card
  - You need a source PNG of your pixel art mage character first (doesn't
    exist in this repo yet, draw it in Aseprite, any size, doesn't need to
    match anything, transparent background helps but isn't required)
  - Run: `pip install pillow` (one time), then:
    ```
    python scripts/img2ascii.py path/to/your/mage.png --width 26 > assets/ascii/mage.txt
    ```
  - `terminal-card.mjs` automatically uses `assets/ascii/mage.txt` if it
    exists, falls back to a placeholder block if not. No other changes
    needed, just commit the new `assets/ascii/mage.txt` and push.
  - Tip: try a few `--width` values (20 to 32 is reasonable) and look at
    the output in a monospace editor before committing, ASCII art at the
    wrong width reads as noise.

- [ ] **Arcade nav buttons** (6 total), redraw the placeholder chunky-pixel
  SVGs to match your actual style. All in `assets/buttons/`, same
  filenames so the README doesn't need edits:
  - `nav-projects.svg`, 168x40px, label "PROJECTS"
  - `nav-skills.svg`, 168x40px, label "SKILLS"
  - `nav-stats.svg`, 168x40px, label "STATS"
  - `nav-contact.svg`, 168x40px, label "CONTACT"
  - `nav-play.svg`, 188x40px, label "PLAY MY GAMES"
  - `sign-guestbook.svg`, 220x44px, label "SIGN THE GUESTBOOK"
  - Transparent background so it reads on both GitHub light and dark theme.
  - If you switch to PNG instead of SVG, you DO need to edit README.md,
    the `<img src>` paths currently end in `.svg`. Full details in
    `assets/buttons/README.md`.

## GIFs to record

The Featured Builds section currently shows real gameplay screenshots
(re-encoded as static, single-frame GIFs, not fake placeholders, just not
animated yet). Recording actual gameplay clips will make them come alive.

- [ ] **Frog Hop: Fly Hunt**: record 3 to 6 seconds of gameplay (hopping,
  dodging water, catching a fly). Export as GIF, roughly 760px wide (matches
  the current still), keep it under 3MB so it loads fast on GitHub. Save as
  `assets/previews/frog-hop.gif`, exact filename, overwrites the current
  still automatically, no README edit needed.
- [ ] **Flappy Bird Clone**: same idea, 3 to 6 seconds of the duck flying
  through pipes. Same size/weight targets. Save as
  `assets/previews/flappy-bird.gif`.
- The Hospital Location Optimizer tile intentionally stays a static plot
  image (it's a data viz project, not gameplay), nothing to record there.

## Repo settings

Nothing is currently broken or misconfigured, this section is just what to
double check if something stops working later:

- [ ] If `guestbook.yml` ever fails to push with a permissions error,
  go to **Settings > Actions > General > Workflow permissions** and make
  sure "Read and write permissions" is selected. It's working as of this
  session, but this is the first place to look if it stops.
- [ ] If you ever add branch protection rules to `main` (required reviews,
  required status checks), several workflows push directly to `main`
  (`guestbook.yml`) or to the `output` branch (`snake.yml`, `rocket.yml`,
  `3d-contrib.yml`, `terminal-card.yml`, `rpg-sheet.yml`). Protection rules
  on `main` that block bot pushes will break the guestbook. The `output`
  branch pushes are unaffected by `main`'s protection either way.

## Could not verify, or had to make a judgment call

- **Third Featured Builds slot**: picked `hospital-location-optimizer` (your
  first-preference candidate), verified the repo exists and its
  `images/solutions_comparison.png` loads. Didn't check the other
  candidates since the first one worked.
- **Travel Planner Android app**: added this to the plain Featured Projects
  grid (not Featured Builds) to keep that grid at an even 6 cards after
  removing the now-duplicated Hospital Optimizer card. Wasn't explicitly
  requested, remove it if you'd rather have an odd-numbered grid.
- **itch.io devlog RSS**: still doesn't exist for this account (checked
  again this session), the Recent Activity section still falls back to
  GitHub's own activity feed. Nothing changed here, just confirming it's
  still the right call.
- **Arabic header subtitle**: was rendering as literal `???` (not actually
  reversed text, the capsule-render service was failing to decode it).
  Root cause: the URL had the Arabic characters embedded raw instead of
  percent-encoded. Fixed by percent-encoding `شذى أبو الرب` properly,
  confirmed byte-for-byte against the source string. If you ever edit that
  `desc=` parameter by hand, re-encode the whole value, don't paste raw
  Arabic into the URL.
