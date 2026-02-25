/**
 * Web Search Source — scrape search engines for here.now URLs.
 *
 * Uses DuckDuckGo HTML (no API key needed) and extracts here.now
 * slugs from search result snippets and URLs.
 */

import { extractSlugs } from "../extract.js";
import type { DiscoveredSite, DiscoverResult } from "../types.js";

async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; herenow-discover/1.0; +https://github.com/OthmanAdi/awesome-here-now)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Also try fetching search results from Google via simple HTML.
 * Falls back gracefully if blocked.
 */
async function searchGoogle(query: string): Promise<string> {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=30`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

export async function discoverFromWebSearch(): Promise<DiscoverResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allFound = new Map<string, { slug: string; foundIn: string }>();

  const queries = [
    "site:here.now",
    '"here.now" publish AI agent',
    '"here.now" portfolio demo',
    "inurl:here.now",
  ];

  for (const query of queries) {
    // DuckDuckGo
    try {
      const html = await searchDuckDuckGo(query);
      const slugs = extractSlugs(html);
      for (const slug of slugs) {
        if (!allFound.has(slug)) {
          allFound.set(slug, { slug, foundIn: `duckduckgo:"${query}"` });
        }
      }
    } catch (e) {
      errors.push(`DDG "${query}": ${e}`);
    }

    // Google (may be rate limited)
    try {
      const html = await searchGoogle(query);
      const slugs = extractSlugs(html);
      for (const slug of slugs) {
        if (!allFound.has(slug)) {
          allFound.set(slug, { slug, foundIn: `google:"${query}"` });
        }
      }
    } catch (e) {
      errors.push(`Google "${query}": ${e}`);
    }
  }

  const now = new Date().toISOString();
  const sites: DiscoveredSite[] = [...allFound.values()].map(({ slug, foundIn }) => ({
    slug,
    url: `https://${slug}.here.now/`,
    source: "web-search" as const,
    foundAt: now,
    foundIn,
    status: "unknown" as const,
  }));

  return { source: "web-search", sites, errors, duration: Date.now() - start };
}
