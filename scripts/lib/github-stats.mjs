/**
 * github-stats.mjs
 *
 * Shared GitHub data-fetching used by both scripts/terminal-card.mjs and
 * scripts/rpg-sheet.mjs, so the two "same script family" generators the
 * README asks for don't duplicate API logic. Not a standalone script,
 * import it: `import { fetchStats } from "./lib/github-stats.mjs"`.
 *
 * All calls use the plain REST/GraphQL API over global fetch (Node 18+),
 * authenticated with GITHUB_TOKEN. Note: GITHUB_TOKEN is the Actions bot
 * token, not a personal token belonging to the profile owner, so
 * contribution/commit counts only ever see PUBLIC activity, same as any
 * visitor looking at the profile would see. That's the correct behaviour
 * for a public README, just noting it so the numbers aren't a surprise.
 */

const API = "https://api.github.com";

function authHeaders(token) {
  return {
    Authorization: `bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "profile-stats-generator",
  };
}

async function rest(path, token) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`REST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function graphql(query, variables, token) {
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function paginate(pathBuilder, token, maxPages = 10) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await rest(pathBuilder(page), token);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

// --- commits: sum public commit contributions across every year the
// account has existed, since contributionsCollection only accepts <=1yr
// ranges at a time.
async function fetchTotalCommits(username, createdAt, token) {
  const startYear = new Date(createdAt).getUTCFullYear();
  const endYear = new Date().getUTCFullYear();
  let total = 0;
  for (let year = startYear; year <= endYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    const data = await graphql(
      `query ($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
          }
        }
      }`,
      { login: username, from, to },
      token
    );
    total += data.user.contributionsCollection.totalCommitContributions;
  }
  return total;
}

async function fetchCommitsThisYear(username, token) {
  const now = new Date();
  const from = `${now.getUTCFullYear()}-01-01T00:00:00Z`;
  const to = now.toISOString();
  const data = await graphql(
    `query ($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
        }
      }
    }`,
    { login: username, from, to },
    token
  );
  return data.user.contributionsCollection.totalCommitContributions;
}

async function fetchCurrentStreak(username, token) {
  const data = await graphql(
    `query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`,
    { login: username },
    token
  );
  const days = data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  // Walk backwards from today (or yesterday, if today has no contributions
  // yet) counting consecutive days with at least one contribution.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) {
      streak++;
    } else if (streak > 0 || i < days.length - 1) {
      break;
    }
  }
  return streak;
}

const SOURCE_EXTENSIONS = new Set([
  ".cs", ".c", ".h", ".cpp", ".hpp", ".py", ".js", ".mjs", ".ts", ".java",
  ".v", ".sv", ".html", ".css", ".md", ".json", ".yml", ".yaml", ".sh",
  ".ps1", ".shader", ".cginc",
]);
const MAX_FILES_PER_REPO = 200;

// Lines of code: walks each repo's git tree via the REST API (no cloning)
// and counts newlines in files with a source-code extension. This is the
// CURRENT codebase size, not cumulative lines ever written/deleted, that
// would need a full `git log --numstat` clone of every repo, too slow and
// too much bandwidth to run on a schedule for a profile README.
async function fetchLinesOfCode(repos, token) {
  let total = 0;
  for (const repo of repos) {
    if (repo.fork || repo.size === 0) continue;
    try {
      const tree = await rest(
        `/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
        token
      );
      const files = (tree.tree || [])
        .filter((f) => f.type === "blob" && SOURCE_EXTENSIONS.has(getExt(f.path)))
        .slice(0, MAX_FILES_PER_REPO);
      for (const file of files) {
        const res = await fetch(
          `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${encodeURI(file.path)}`,
          { headers: { "User-Agent": "profile-stats-generator" } }
        );
        if (!res.ok) continue;
        const text = await res.text();
        total += text.split("\n").length;
      }
    } catch {
      // Repo might be empty, disabled, or the tree too large to list; skip it
      // rather than fail the whole stats run over one repo.
    }
  }
  return total;
}

function getExt(path) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i);
}

export async function fetchStats(username, token) {
  const profile = await rest(`/users/${username}`, token);
  const repos = await paginate(
    (page) => `/users/${username}/repos?per_page=100&page=${page}&type=owner`,
    token
  );
  const nonForkRepos = repos.filter((r) => !r.fork);
  const stars = nonForkRepos.reduce((sum, r) => sum + r.stargazers_count, 0);

  const mergedPrs = await rest(
    `/search/issues?q=author:${username}+type:pr+is:merged`,
    token
  );

  const [totalCommits, commitsThisYear, currentStreak, linesOfCode] = await Promise.all([
    fetchTotalCommits(username, profile.created_at, token),
    fetchCommitsThisYear(username, token),
    fetchCurrentStreak(username, token),
    fetchLinesOfCode(nonForkRepos, token),
  ]);

  const languageCounts = {};
  for (const r of nonForkRepos) {
    if (r.language) languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
  }
  const topLanguages = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  return {
    login: profile.login,
    name: profile.name || profile.login,
    publicRepos: profile.public_repos,
    followers: profile.followers,
    createdAt: profile.created_at,
    totalCommits,
    commitsThisYear,
    stars,
    mergedPrCount: mergedPrs.total_count,
    currentStreak,
    linesOfCode,
    topLanguages,
  };
}
