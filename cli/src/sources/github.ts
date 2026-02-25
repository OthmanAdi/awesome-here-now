/**
 * GitHub Source — search GitHub code for here.now URLs.
 *
 * Uses the `gh` CLI (must be authenticated).
 * Searches code, READMEs, issues, and discussions.
 */

import { extractSlugs } from "../extract.js";
import type { DiscoveredSite, DiscoverResult } from "../types.js";

interface GhSearchResult {
  path: string;
  repository: { nameWithOwner: string };
  textMatches: { fragment: string }[];
}

async function runGh(args: string[]): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return stdout;
}

async function searchCode(query: string, limit = 50): Promise<GhSearchResult[]> {
  try {
    const raw = await runGh([
      "search", "code", query,
      "--limit", String(limit),
      "--json", "path,repository,textMatches",
    ]);
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function extractFromResults(results: GhSearchResult[]): Map<string, { slug: string; foundIn: string }> {
  const found = new Map<string, { slug: string; foundIn: string }>();

  for (const result of results) {
    const repo = result.repository.nameWithOwner;
    for (const match of result.textMatches) {
      const slugs = extractSlugs(match.fragment);
      for (const slug of slugs) {
        if (!found.has(slug)) {
          found.set(slug, { slug, foundIn: `github:${repo}/${result.path}` });
        }
      }
    }
  }

  return found;
}

export async function discoverFromGithub(): Promise<DiscoverResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allFound = new Map<string, { slug: string; foundIn: string }>();

  // Multiple search queries to cast a wide net
  const queries = [
    ".here.now/",
    "here.now/ publish",
    "here.now site_url",
    "here.now slug",
  ];

  for (const query of queries) {
    try {
      const results = await searchCode(query, 30);
      const found = extractFromResults(results);
      for (const [slug, data] of found) {
        if (!allFound.has(slug)) allFound.set(slug, data);
      }
    } catch (e) {
      errors.push(`GitHub search "${query}": ${e}`);
    }
  }

  // Also search issues/PRs mentioning here.now URLs
  try {
    const issueRaw = await runGh([
      "search", "issues", "here.now",
      "--limit", "20",
      "--json", "title,body,url",
    ]);
    const issues: { title: string; body: string; url: string }[] = JSON.parse(issueRaw || "[]");
    for (const issue of issues) {
      const text = `${issue.title} ${issue.body}`;
      const slugs = extractSlugs(text);
      for (const slug of slugs) {
        if (!allFound.has(slug)) {
          allFound.set(slug, { slug, foundIn: `github-issue:${issue.url}` });
        }
      }
    }
  } catch (e) {
    errors.push(`GitHub issue search: ${e}`);
  }

  const now = new Date().toISOString();
  const sites: DiscoveredSite[] = [...allFound.values()].map(({ slug, foundIn }) => ({
    slug,
    url: `https://${slug}.here.now/`,
    source: "github" as const,
    foundAt: now,
    foundIn,
    status: "unknown" as const,
  }));

  return { source: "github", sites, errors, duration: Date.now() - start };
}
