#!/usr/bin/env node
/**
 * guestbook.mjs
 *
 * Reads every issue labeled "guestbook" in this repo, sanitizes the
 * visitor-submitted name/message, and rewrites the table between
 * <!-- GUESTBOOK:START --> / <!-- GUESTBOOK:END --> in README.md with the
 * latest 10 entries (avatar, handle, message).
 *
 * Everything from the issue BODY is untrusted input (any GitHub user can
 * open one of these), so it goes through sanitize() before it ever touches
 * README.md: strip HTML tags, strip markdown table/link syntax, collapse
 * newlines, cap length. The avatar and profile link always come from the
 * issue's actual author (issue.user), never from user-supplied text, so a
 * fake "handle" field can't be used to link/impersonate someone else.
 *
 * Usage (local test, no push needed):
 *   GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=Holmes-99/Holmes-99 node scripts/guestbook.mjs --dry-run
 *
 * In CI (.github/workflows/guestbook.yml) GITHUB_TOKEN/GITHUB_REPOSITORY are
 * provided automatically by Actions.
 */

import { readFileSync, writeFileSync } from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
const dryRun = process.argv.includes("--dry-run");
const MAX_ENTRIES = 10;
const MAX_MESSAGE_LEN = 100;
const MAX_NAME_LEN = 40;

if (!token || !repo) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY env vars are required.");
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "guestbook-generator",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Sanitization: never trust issue body/title text before it lands in README
// ---------------------------------------------------------------------------

function sanitize(raw, maxLen) {
  if (!raw) return "";
  let s = String(raw);
  s = s.replace(/<[^>]*>/g, ""); // strip HTML tags
  s = s.replace(/[|`*_[\]<>]/g, ""); // strip markdown table/link/emphasis syntax
  s = s.replace(/\r?\n+/g, " "); // collapse newlines
  s = s.replace(/\s+/g, " ").trim(); // collapse whitespace
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
  return s;
}

// Issue-form bodies render as repeated "### Label\n\nvalue\n\n" blocks.
function parseFormBody(body) {
  const fields = {};
  const parts = body.split(/^### /m).slice(1);
  for (const part of parts) {
    const [labelLine, ...rest] = part.split("\n");
    const value = rest.join("\n").trim();
    fields[labelLine.trim().toLowerCase()] = value === "_No response_" ? "" : value;
  }
  return fields;
}

// ---------------------------------------------------------------------------

async function main() {
  const issues = await api(
    `/repos/${repo}/issues?labels=guestbook&state=all&sort=created&direction=desc&per_page=${MAX_ENTRIES}`
  );

  const entries = issues
    .filter((issue) => !issue.pull_request) // issues endpoint also returns PRs
    .map((issue) => {
      const fields = parseFormBody(issue.body || "");
      const name = sanitize(fields["your name"], MAX_NAME_LEN) || sanitize(issue.user.login, MAX_NAME_LEN);
      const message = sanitize(fields["message"], MAX_MESSAGE_LEN);
      const handle = sanitize(fields["github handle (optional)"], 39) || issue.user.login;
      return {
        avatar: issue.user.avatar_url,
        profile: `https://github.com/${issue.user.login}`,
        name,
        handle,
        message,
      };
    })
    .filter((e) => e.message); // drop anything that sanitized down to nothing

  const rows = entries
    .map(
      (e) =>
        `| <a href="${e.profile}"><img src="${e.avatar}" width="32" height="32" style="border-radius:50%"/></a> | **${e.name}** ([@${e.handle}](${e.profile})) | ${e.message} |`
    )
    .join("\n");

  const table = entries.length
    ? `| | Visitor | Message |\n|---|---|---|\n${rows}`
    : "_No signatures yet, be the first!_";

  const readmePath = new URL("../README.md", import.meta.url);
  const readme = readFileSync(readmePath, "utf8");
  const start = "<!-- GUESTBOOK:START -->";
  const end = "<!-- GUESTBOOK:END -->";
  const startIdx = readme.indexOf(start);
  const endIdx = readme.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("GUESTBOOK:START/END markers not found in README.md");
  }
  const updated = readme.slice(0, startIdx + start.length) + "\n" + table + "\n" + readme.slice(endIdx);

  if (dryRun) {
    console.log(table);
  } else {
    writeFileSync(readmePath, updated, "utf8");
  }
}

await main();
