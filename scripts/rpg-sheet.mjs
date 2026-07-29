#!/usr/bin/env node
/**
 * rpg-sheet.mjs
 *
 * Renders real GitHub stats as a 16-bit RPG character sheet: chunky pixel
 * border, segmented XP/HP bars, inventory of top languages, quest log.
 * Uses the same scripts/lib/github-stats.mjs fetcher as terminal-card.mjs.
 *
 * Stat mapping (edit the constants below to retune):
 *   LEVEL        = floor(totalCommits / COMMITS_PER_LEVEL) + 1
 *   XP bar       = commits this calendar year, full bar at XP_BAR_MAX
 *   HP bar       = current contribution streak (days), full bar at HP_BAR_MAX
 *   INVENTORY    = top languages across owned repos
 *   QUESTS       = merged PRs + public repos
 *   ACHIEVEMENTS = SHIPPED_GAMES (static, see comment below, not derivable
 *                  from the API since "shipped" isn't a GitHub concept)
 *
 * Usage (local test, no push needed):
 *   GITHUB_TOKEN=ghp_xxx node scripts/rpg-sheet.mjs Holmes-99 dark  > rpg-dark.svg
 *   GITHUB_TOKEN=ghp_xxx node scripts/rpg-sheet.mjs Holmes-99 light > rpg-light.svg
 *
 * Requires Node 18+.
 */

import { fetchStats } from "./lib/github-stats.mjs";

const [, , usernameArg, themeArg] = process.argv;
const username = usernameArg || process.env.GITHUB_REPOSITORY_OWNER;
const theme = (themeArg || "dark").toLowerCase();
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  console.error("Usage: GITHUB_TOKEN=... node rpg-sheet.mjs <username> <dark|light>");
  process.exit(1);
}

// Games confirmed to actually be shipped/playable somewhere public as of
// writing: Frog Hop: Fly Hunt (itch.io + Unity Play). Bump this by hand
// when another game gets a public build, there's no API for "did I ship
// this."
const SHIPPED_GAMES = 1;

const COMMITS_PER_LEVEL = 25;
const XP_BAR_MAX = 200; // commits this year for a "full" bar
const HP_BAR_MAX = 30; // day streak for a "full" bar
const BAR_SEGMENTS = 20;

const PALETTES = {
  dark: {
    bg: "#0d1117",
    panel: "#161b22",
    border: "#39d353",
    borderInner: "#1F4E79",
    text: "#e6edf3",
    label: "#39d353",
    xpFill: "#2E86AB",
    xpEmpty: "#21262d",
    hpFill: "#e05252",
    hpEmpty: "#21262d",
    chip: "#1F4E79",
  },
  light: {
    bg: "#ffffff",
    panel: "#f6f8fa",
    border: "#216e39",
    borderInner: "#1F4E79",
    text: "#24292f",
    label: "#216e39",
    xpFill: "#2E86AB",
    xpEmpty: "#d0d7de",
    hpFill: "#cf2222",
    hpEmpty: "#d0d7de",
    chip: "#1F4E79",
  },
};

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function pixelBorder(x, y, w, h, fill, cut = 6) {
  const points = [
    [x + cut, y],
    [x + w - cut, y],
    [x + w, y + cut],
    [x + w, y + h - cut],
    [x + w - cut, y + h],
    [x + cut, y + h],
    [x, y + h - cut],
    [x, y + cut],
  ]
    .map((p) => p.join(","))
    .join(" ");
  return `<polygon points="${points}" fill="${fill}"/>`;
}

function segmentedBar(x, y, w, h, fraction, fillColor, emptyColor) {
  const filled = Math.round(BAR_SEGMENTS * Math.max(0, Math.min(1, fraction)));
  const segW = w / BAR_SEGMENTS;
  let out = "";
  for (let i = 0; i < BAR_SEGMENTS; i++) {
    const sx = x + i * segW;
    out += `<rect x="${sx.toFixed(1)}" y="${y}" width="${(segW - 1.5).toFixed(1)}" height="${h}" fill="${i < filled ? fillColor : emptyColor}"/>`;
  }
  return out;
}

function buildSvg(stats, paletteName) {
  const p = PALETTES[paletteName];
  const FONT = "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace";
  const level = Math.floor(stats.totalCommits / COMMITS_PER_LEVEL) + 1;
  const xpFraction = stats.commitsThisYear / XP_BAR_MAX;
  const hpFraction = stats.currentStreak / HP_BAR_MAX;
  const inventory = stats.topLanguages.slice(0, 6);
  const quests = stats.mergedPrCount + stats.publicRepos;

  const width = 640;
  const height = 360;

  let y = 70;
  const line = (label, value, extra = "") => {
    const out = `<text x="30" y="${y}" font-family="${FONT}" font-size="13" fill="${p.text}"><tspan fill="${p.label}" font-weight="bold">${escapeXml(label)}:</tspan> ${escapeXml(value)}</text>${extra}`;
    y += 26;
    return out;
  };

  const classLine = line("CLASS", "Game Developer");
  const levelLine = line("LEVEL", String(level));
  y += 4;

  const xpBar = segmentedBar(140, y - 12, 460, 12, xpFraction, p.xpFill, p.xpEmpty);
  const xpLine = `<text x="30" y="${y}" font-family="${FONT}" font-size="13" fill="${p.label}" font-weight="bold">XP:</text>${xpBar}<text x="610" y="${y}" font-family="${FONT}" font-size="10" fill="${p.text}" text-anchor="end">${stats.commitsThisYear}</text>`;
  y += 30;

  const hpBar = segmentedBar(140, y - 12, 460, 12, hpFraction, p.hpFill, p.hpEmpty);
  const hpLine = `<text x="30" y="${y}" font-family="${FONT}" font-size="13" fill="${p.label}" font-weight="bold">HP:</text>${hpBar}<text x="610" y="${y}" font-family="${FONT}" font-size="10" fill="${p.text}" text-anchor="end">${stats.currentStreak}d</text>`;
  y += 34;

  const invLabel = `<text x="30" y="${y}" font-family="${FONT}" font-size="13" fill="${p.label}" font-weight="bold">INVENTORY:</text>`;
  y += 22;
  const invChips = inventory
    .map((lang, i) => {
      const cx = 30 + i * 100;
      return `<rect x="${cx}" y="${y - 16}" width="92" height="22" rx="3" fill="${p.chip}"/><text x="${cx + 46}" y="${y}" font-family="${FONT}" font-size="11" fill="#ffffff" text-anchor="middle">${escapeXml(lang)}</text>`;
    })
    .join("");
  y += 34;

  const questsLine = line("QUESTS COMPLETED", `${quests} (${stats.mergedPrCount} PRs merged, ${stats.publicRepos} repos)`);
  const achievementsLine = line("ACHIEVEMENTS", `${SHIPPED_GAMES} game${SHIPPED_GAMES === 1 ? "" : "s"} shipped`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${pixelBorder(0, 0, width, height, p.border)}
  ${pixelBorder(4, 4, width - 8, height - 8, p.panel)}
  <text x="${width / 2}" y="34" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="bold" fill="${p.text}">${escapeXml(stats.name)}</text>
  <text x="${width / 2}" y="54" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${p.label}">@${escapeXml(stats.login)} the Pixel Artificer</text>
  ${classLine}
  ${levelLine}
  ${xpLine}
  ${hpLine}
  ${invLabel}
  ${invChips}
  ${questsLine}
  ${achievementsLine}
</svg>`;
}

const stats = await fetchStats(username, token);
const svg = buildSvg(stats, theme === "light" ? "light" : "dark");
process.stdout.write(svg);
