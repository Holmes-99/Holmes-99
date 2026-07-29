#!/usr/bin/env node
/**
 * rocket-graph.mjs
 *
 * Generates an animated SVG of a GitHub contribution calendar with a pixel
 * rocket flying a boustrophedon (zig-zag) sweep across it, firing at squares
 * and "destroying" them as it passes. No JavaScript runs inside the SVG
 * (GitHub renders these via <img>, which never executes embedded <script>) -
 * all motion is plain SMIL (<animate>, <animateMotion>, <animateTransform>).
 *
 * Usage (local test, no push needed):
 *   GITHUB_TOKEN=ghp_xxx node scripts/rocket-graph.mjs <username> dark  > rocket-dark.svg
 *   GITHUB_TOKEN=ghp_xxx node scripts/rocket-graph.mjs <username> light > rocket-light.svg
 *
 * In CI (.github/workflows/rocket.yml) GITHUB_TOKEN is the default Actions
 * token, which is sufficient to read a user's PUBLIC contribution calendar
 * over the GraphQL API.
 *
 * Requires Node 18+ (uses global fetch).
 */

const [, , usernameArg, themeArg] = process.argv;
const username = usernameArg || process.env.ROCKET_USERNAME || process.env.GITHUB_REPOSITORY_OWNER;
const theme = (themeArg || "dark").toLowerCase();
const token = process.env.GITHUB_TOKEN;

if (!username) {
  console.error("Usage: node rocket-graph.mjs <username> <dark|light>");
  process.exit(1);
}
if (!token) {
  console.error("GITHUB_TOKEN env var is required (GraphQL contribution calendar).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Fetch the contribution calendar
// ---------------------------------------------------------------------------

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              weekday
              contributionCount
            }
          }
        }
      }
    }
  }
`;

async function fetchCalendar() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "rocket-graph-generator",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data.user.contributionsCollection.contributionCalendar;
}

// ---------------------------------------------------------------------------
// 2. Layout + colour palette
// ---------------------------------------------------------------------------

const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;
const MARGIN_LEFT = 4;
const MARGIN_TOP = 26; // room for the rocket to fly above row 0
const ROWS = 7;
const SECONDS_PER_ROW = 3.2;
const TOTAL = ROWS * SECONDS_PER_ROW;

const PALETTES = {
  dark: {
    bg: "transparent",
    empty: "#161b22",
    levels: ["#0e4429", "#006d32", "#26a641", "#39d353"],
    text: "#8b949e",
    rocketBody: "#e6edf3",
    rocketAccent: "#39d353",
    flame: "#ff8a3d",
    bullet: "#ffdd57",
  },
  light: {
    bg: "transparent",
    empty: "#ebedf0",
    levels: ["#9be9a8", "#40c463", "#30a14e", "#216e39"],
    text: "#57606a",
    rocketBody: "#24292f",
    rocketAccent: "#216e39",
    flame: "#ff6b1a",
    bullet: "#d4a72c",
  },
};

function levelFor(count, max) {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const q = max / 4;
  if (count <= q) return 1;
  if (count <= q * 2) return 2;
  if (count <= q * 3) return 3;
  return 4;
}

// ---------------------------------------------------------------------------
// 3. Build the SVG
// ---------------------------------------------------------------------------

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function buildSvg(calendar, paletteName) {
  const palette = PALETTES[paletteName];
  const weeks = calendar.weeks;
  const weekCount = weeks.length;
  const maxCount = Math.max(...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));

  const width = MARGIN_LEFT * 2 + weekCount * STEP;
  const height = MARGIN_TOP + ROWS * STEP + 6;

  // Flatten to a per-row, per-week grid for a boustrophedon sweep.
  const grid = Array.from({ length: ROWS }, () => new Array(weekCount).fill(null));
  weeks.forEach((week, wIdx) => {
    week.contributionDays.forEach((day) => {
      grid[day.weekday][wIdx] = day;
    });
  });

  // --- rocket flight path: zig-zag across all 7 rows -----------------------
  const rowY = (r) => MARGIN_TOP + r * STEP + CELL / 2;
  const leftX = MARGIN_LEFT - 6;
  const rightX = MARGIN_LEFT + weekCount * STEP + 6;

  let pathD = "";
  const hitEvents = [];
  for (let r = 0; r < ROWS; r++) {
    const leftToRight = r % 2 === 0;
    const y = rowY(r);
    const startX = leftToRight ? leftX : rightX;
    const endX = leftToRight ? rightX : leftX;
    pathD += r === 0 ? `M ${startX} ${y} ` : `L ${startX} ${y} `;
    pathD += `L ${endX} ${y} `;

    for (let w = 0; w < weekCount; w++) {
      const day = grid[r][w];
      if (!day || day.contributionCount === 0) continue;
      const wIdx = leftToRight ? w : weekCount - 1 - w;
      const frac = weekCount <= 1 ? 0 : wIdx / (weekCount - 1);
      const rowStart = r * SECONDS_PER_ROW;
      const t = rowStart + frac * SECONDS_PER_ROW;
      const cx = MARGIN_LEFT + w * STEP + CELL / 2;
      const cy = MARGIN_TOP + r * STEP + CELL / 2;
      hitEvents.push({ row: r, week: w, cx, cy, t, count: day.contributionCount, date: day.date });
    }
  }

  // Sample a subset of hits to draw muzzle-flash "bullets" for, so the file
  // stays a reasonable size on active accounts with lots of contributions.
  const bulletStep = Math.max(1, Math.ceil(hitEvents.length / 90));
  const bulletEvents = hitEvents.filter((_, i) => i % bulletStep === 0);

  // --- SVG cells -------------------------------------------------------------
  let cellsSvg = "";
  for (const h of hitEvents) {
    const level = levelFor(h.count, maxCount);
    const color = palette.levels[level - 1] || palette.levels[0];
    const hitFrac = h.t / TOTAL;
    const beforeFrac = Math.max(0, hitFrac - 0.015);
    cellsSvg += `
    <rect x="${(h.cx - CELL / 2).toFixed(1)}" y="${(h.cy - CELL / 2).toFixed(1)}" width="${CELL}" height="${CELL}" rx="2" fill="${color}">
      <title>${escapeXml(h.date)}: ${h.count} contribution${h.count === 1 ? "" : "s"}</title>
      <animate attributeName="opacity" dur="${TOTAL}s" begin="0s" repeatCount="indefinite"
        keyTimes="0;${beforeFrac.toFixed(4)};${hitFrac.toFixed(4)};1"
        values="1;1;0.12;1" calcMode="linear"/>
      <animateTransform attributeName="transform" type="translate" attributeType="XML" dur="${TOTAL}s" begin="0s" repeatCount="indefinite"
        keyTimes="0;${beforeFrac.toFixed(4)};${hitFrac.toFixed(4)};1"
        values="0,0;0,0;0,7;0,0" calcMode="linear"/>
    </rect>`;
  }

  // empty-cell backdrop (drawn first, underneath, always visible)
  let backdropSvg = "";
  for (let r = 0; r < ROWS; r++) {
    for (let w = 0; w < weekCount; w++) {
      const x = MARGIN_LEFT + w * STEP;
      const y = MARGIN_TOP + r * STEP;
      backdropSvg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.empty}"/>`;
    }
  }

  // --- bullets -----------------------------------------------------------
  let bulletsSvg = "";
  const LEAD = 0.22; // seconds a bullet takes to travel from rocket to target
  for (const h of bulletEvents) {
    const hitFrac = h.t / TOTAL;
    const fireFrac = Math.max(0, (h.t - LEAD) / TOTAL);
    const startX = h.cx;
    const startY = rowY(h.row) < h.cy ? rowY(h.row) : rowY(h.row);
    bulletsSvg += `
    <circle r="1.6" fill="${palette.bullet}">
      <animate attributeName="cx" dur="${TOTAL}s" begin="0s" repeatCount="indefinite"
        keyTimes="0;${fireFrac.toFixed(4)};${hitFrac.toFixed(4)};1"
        values="${startX.toFixed(1)};${startX.toFixed(1)};${h.cx.toFixed(1)};${h.cx.toFixed(1)}" calcMode="linear"/>
      <animate attributeName="cy" dur="${TOTAL}s" begin="0s" repeatCount="indefinite"
        keyTimes="0;${fireFrac.toFixed(4)};${hitFrac.toFixed(4)};1"
        values="${startY.toFixed(1)};${startY.toFixed(1)};${h.cy.toFixed(1)};${h.cy.toFixed(1)}" calcMode="linear"/>
      <animate attributeName="opacity" dur="${TOTAL}s" begin="0s" repeatCount="indefinite"
        keyTimes="0;${fireFrac.toFixed(4)};${hitFrac.toFixed(4)};1"
        values="0;1;0;0" calcMode="linear"/>
    </circle>`;
  }

  // --- rocket sprite (simple pixel-art built from rects) ------------------
  // 8x8 pixel grid, 2px/pixel. Swap assets/sprites/rocket.png in for a real
  // Aseprite sprite later (see scripts/README.md for how to wire it in).
  const rocketSprite = `
  <g id="rocket-sprite">
    <g transform="translate(-8,-8)">
      <rect x="6" y="0" width="4" height="2" fill="${palette.rocketAccent}"/>
      <rect x="4" y="2" width="8" height="2" fill="${palette.rocketBody}"/>
      <rect x="4" y="4" width="8" height="4" fill="${palette.rocketBody}"/>
      <rect x="2" y="6" width="2" height="4" fill="${palette.rocketAccent}"/>
      <rect x="12" y="6" width="2" height="4" fill="${palette.rocketAccent}"/>
      <rect x="6" y="8" width="4" height="2" fill="#2b2f36"/>
      <rect x="6" y="10" width="4" height="3" fill="${palette.flame}">
        <animate attributeName="height" values="3;5;3" dur="0.22s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.6;1" dur="0.22s" repeatCount="indefinite"/>
      </rect>
    </g>
  </g>`;

  const rocketMotion = `
  <use href="#rocket-sprite">
    <animateMotion dur="${TOTAL}s" begin="0s" repeatCount="indefinite" rotate="0" path="${pathD.trim()}"/>
  </use>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Segoe UI', Ubuntu, Sans-Serif">
  <rect width="100%" height="100%" fill="${palette.bg}"/>
  <text x="${MARGIN_LEFT}" y="14" font-size="11" fill="${palette.text}">${calendar.totalContributions} contributions in the last year, under rocket fire</text>
  ${backdropSvg}
  ${cellsSvg}
  ${bulletsSvg}
  ${rocketSprite}
  ${rocketMotion}
</svg>`;
}

// ---------------------------------------------------------------------------

const calendar = await fetchCalendar();
const svg = buildSvg(calendar, theme === "light" ? "light" : "dark");
process.stdout.write(svg);
