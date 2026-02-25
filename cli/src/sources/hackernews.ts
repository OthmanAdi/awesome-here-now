/**
 * Hacker News Source — search HN stories and comments for here.now URLs.
 *
 * Uses the free Algolia HN Search API (no auth required).
 * Searches both stories and comments.
 */

import { extractSlugs } from "../extract.js";
import type { DiscoveredSite, DiscoverResult } from "../types.js";

const HN_API = "https://hn.algolia.com/api/v1";

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  story_text?: string;
  comment_text?: string;
  author: string;
}

interface HnResponse {
  hits: HnHit[];
  nbHits: number;
}

async function searchHn(query: string, tags: string): Promise<HnHit[]> {
  const url = `${HN_API}/search?query=${encodeURIComponent(query)}&tags=${tags}&hitsPerPage=50`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data: HnResponse = await res.json();
    return data.hits;
  } catch {
    return [];
  }
}

async function getItem(id: string): Promise<any> {
  try {
    const res = await fetch(`${HN_API}/items/${id}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractFromHits(hits: HnHit[]): Map<string, { slug: string; foundIn: string }> {
  const found = new Map<string, { slug: string; foundIn: string }>();

  for (const hit of hits) {
    const text = [hit.title, hit.url, hit.story_text, hit.comment_text]
      .filter(Boolean)
      .join(" ");

    const slugs = extractSlugs(text);
    for (const slug of slugs) {
      if (!found.has(slug)) {
        found.set(slug, {
          slug,
          foundIn: `hackernews:${hit.objectID}`,
        });
      }
    }
  }

  return found;
}

export async function discoverFromHackerNews(): Promise<DiscoverResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allFound = new Map<string, { slug: string; foundIn: string }>();

  // Search stories mentioning here.now
  const queries = [
    { q: "here.now", tags: "story" },
    { q: "here.now", tags: "comment" },
    { q: "here.now publish", tags: "(story,comment)" },
  ];

  for (const { q, tags } of queries) {
    try {
      const hits = await searchHn(q, tags);
      const found = extractFromHits(hits);
      for (const [slug, data] of found) {
        if (!allFound.has(slug)) allFound.set(slug, data);
      }
    } catch (e) {
      errors.push(`HN search "${q}": ${e}`);
    }
  }

  // Deep-dive into the known Show HN post comments
  try {
    const showHn = await getItem("47104451");
    if (showHn?.children) {
      const commentTexts = JSON.stringify(showHn.children);
      const slugs = extractSlugs(commentTexts);
      for (const slug of slugs) {
        if (!allFound.has(slug)) {
          allFound.set(slug, { slug, foundIn: "hackernews:47104451-comments" });
        }
      }
    }
  } catch (e) {
    errors.push(`HN Show HN deep-dive: ${e}`);
  }

  const now = new Date().toISOString();
  const sites: DiscoveredSite[] = [...allFound.values()].map(({ slug, foundIn }) => ({
    slug,
    url: `https://${slug}.here.now/`,
    source: "hackernews" as const,
    foundAt: now,
    foundIn,
    status: "unknown" as const,
  }));

  return { source: "hackernews", sites, errors, duration: Date.now() - start };
}
