#!/usr/bin/env node
/**
 * terminal-card.mjs
 *
 * Generates a neofetch-style "terminal" info card: ASCII art on the left,
 * aligned label/value rows with dot leaders on the right, plus a live
 * GitHub stats block at the bottom. Static personal info (OS/Host/IDE/
 * Languages.Real/Engines/Hobbies/Contact rows) lives in the ROWS constant
 * below, edit it directly, it's not fetched from anywhere. The GitHub
 * Stats block IS live, pulled by scripts/lib/github-stats.mjs.
 *
 * Usage (local test, no push needed):
 *   GITHUB_TOKEN=ghp_xxx node scripts/terminal-card.mjs Holmes-99 dark  > terminal-dark.svg
 *   GITHUB_TOKEN=ghp_xxx node scripts/terminal-card.mjs Holmes-99 light > terminal-light.svg
 *
 * Requires Node 18+.
 */

import { fetchStats } from "./lib/github-stats.mjs";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const [, , usernameArg, themeArg] = process.argv;
const username = usernameArg || process.env.GITHUB_REPOSITORY_OWNER;
const theme = (themeArg || "dark").toLowerCase();
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  console.error("Usage: GITHUB_TOKEN=... node terminal-card.mjs <username> <dark|light>");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Static personal info. Edit freely, nothing here is fetched.
// ---------------------------------------------------------------------------

const STATIC_ROWS = [
  ["OS", "Palestine 🇵🇸 Linux (probably, still learning)"],
  ["Uptime", "Student, Year 3"],
  ["Host", "Ramallah, Palestine"],
  ["Kernel", "Computer Engineering Student"],
  ["IDE", "VS Code, Unity, Aseprite, Blender"],
  ["Languages.Programming", "C#, Python, Java, C, JavaScript"],
  ["Languages.Real", "Arabic, English, learning Palestinian Sign Language"],
  ["Engines", "Unity 6, learning Roblox Studio"],
  ["Hobbies", "pixel art, game jams"],
  ["Contact", "abualrubshatha1@gmail.com, shatha-abualrob.netlify.app"],
];

// ---------------------------------------------------------------------------
// ASCII art: see scripts/img2ascii.py for converting a real sprite into
// this block. This is a clearly-marked placeholder until then.
// ---------------------------------------------------------------------------

const ASCII_ART_PLACEHOLDER = [
  "     .--.",
  "    /.-. '----------.",
  "    \\'-' .--\"\"\"\"\"\"-. '.",
  "     '--' .------.  '. \\",
  "         /  MAGE  \\  : :",
  "        |  PLACE-  |  ; ;",
  "        |  HOLDER  | ; ;",
  "         \\        / ; ;",
  "          '------' ;;",
  "     -- run img2ascii.py --",
  "     -- to replace this --",
];

function loadAsciiArt() {
  const custom = join(__dirname, "..", "assets", "ascii", "mage.txt");
  if (existsSync(custom)) {
    return readFileSync(custom, "utf8").replace(/\r\n/g, "\n").split("\n");
  }
  return ASCII_ART_PLACEHOLDER;
}

// ---------------------------------------------------------------------------

const PALETTES = {
  dark: {
    bg: "#0d1117",
    chrome: "#161b22",
    border: "#2E86AB",
    label: "#39d353",
    value: "#e6edf3",
    dots: "#3d4450",
    ascii: "#2E86AB",
    header: "#ffffff",
  },
  light: {
    bg: "#ffffff",
    chrome: "#f6f8fa",
    border: "#1F4E79",
    label: "#216e39",
    value: "#24292f",
    dots: "#c9d1d9",
    ascii: "#1F4E79",
    header: "#1F4E79",
  },
};

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function dotLeader(label, value, totalChars) {
  const used = label.length + value.length + 2;
  const dots = Math.max(1, totalChars - used);
  return `${label} ${".".repeat(dots)} ${value}`;
}

function buildSvg(stats, paletteName) {
  const palette = PALETTES[paletteName];
  const ascii = loadAsciiArt();

  const rows = [
    ...STATIC_ROWS,
    ["Repos", String(stats.publicRepos)],
    ["Commits (public)", String(stats.totalCommits)],
    ["Stars", String(stats.stars)],
    ["Followers", String(stats.followers)],
    ["Lines of Code", String(stats.linesOfCode)],
  ];

  const FONT = "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace";
  const LINE_H = 18;
  const ASCII_W = 260;
  const ROWS_X = ASCII_W + 30;
  const TOP = 56;
  const width = 760;
  const height = TOP + Math.max(ascii.length, rows.length + 3) * LINE_H + 30;

  const asciiLines = ascii
    .map(
      (line, i) =>
        `<text x="20" y="${TOP + i * LINE_H}" font-family="${FONT}" font-size="12" fill="${palette.ascii}" xml:space="preserve">${escapeXml(line)}</text>`
    )
    .join("\n    ");

  const nameLine = `<text x="${ROWS_X}" y="${TOP}" font-family="${FONT}" font-size="14" font-weight="bold" fill="${palette.header}">${escapeXml(stats.login)}@birzeit</text>`;
  const ruleLine = `<line x1="${ROWS_X}" y1="${TOP + 8}" x2="${width - 24}" y2="${TOP + 8}" stroke="${palette.dots}" stroke-width="1"/>`;

  let statsHeaderShown = false;
  const rowLines = rows
    .map((row, i) => {
      const [label, value] = row;
      const isStat = i >= STATIC_ROWS.length;
      let extra = "";
      if (isStat && !statsHeaderShown) {
        statsHeaderShown = true;
        extra = `<text x="${ROWS_X}" y="${TOP + 24 + i * LINE_H}" font-family="${FONT}" font-size="12" font-weight="bold" fill="${palette.header}">GitHub Stats</text>\n    `;
      }
      const y = TOP + (isStat ? 24 : 0) + (i + 1) * LINE_H;
      const text = dotLeader(label, value, 58);
      const labelEnd = label.length;
      return `${extra}<text x="${ROWS_X}" y="${y}" font-family="${FONT}" font-size="12" xml:space="preserve"><tspan fill="${palette.label}">${escapeXml(label)}</tspan><tspan fill="${palette.dots}">${escapeXml(text.slice(labelEnd, text.length - value.length))}</tspan><tspan fill="${palette.value}">${escapeXml(value)}</tspan></text>`;
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" rx="8" fill="${palette.bg}" stroke="${palette.border}" stroke-width="2"/>
  <rect width="100%" height="28" rx="8" fill="${palette.chrome}"/>
  <rect y="14" width="100%" height="14" fill="${palette.chrome}"/>
  <circle cx="18" cy="14" r="5" fill="#ff5f56"/>
  <circle cx="36" cy="14" r="5" fill="#ffbd2e"/>
  <circle cx="54" cy="14" r="5" fill="#27c93f"/>
  <text x="${width / 2}" y="18" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${palette.value}">neofetch.svg</text>
  <g>
    ${asciiLines}
    ${nameLine}
    ${ruleLine}
    ${rowLines}
  </g>
</svg>`;
}

const stats = await fetchStats(username, token);
const svg = buildSvg(stats, theme === "light" ? "light" : "dark");
process.stdout.write(svg);
