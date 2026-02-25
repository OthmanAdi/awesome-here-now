/**
 * Extract here.now URLs from arbitrary text.
 *
 * Matches patterns like:
 *   https://some-slug.here.now/
 *   https://some-slug.here.now
 *   http://some-slug.here.now/
 *   some-slug.here.now
 *
 * Filters out:
 *   - The root domain (here.now, www.here.now)
 *   - API/docs URLs (here.now/api/*, here.now/docs)
 *   - Email-like patterns (me@here.now)
 */

const HERE_NOW_URL_PATTERN =
  /(?:https?:\/\/)?([a-z0-9][a-z0-9-]{2,50})\.here\.now\b\/?/gi;

const EXCLUDED_SUBDOMAINS = new Set([
  "www",
  "api",
  "docs",
  "app",
  "dashboard",
  "mail",
  "smtp",
  "ftp",
]);

// Example/placeholder slugs found in documentation and templates
const PLACEHOLDER_SLUGS = new Set([
  "bright-canvas-a7k2", // REFERENCE.md example
  "your-slug",          // CONTRIBUTING.md placeholder
  "my-site",
  "example-site",
]);

export function extractSlugs(text: string): string[] {
  const slugs = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset regex state
  HERE_NOW_URL_PATTERN.lastIndex = 0;

  while ((match = HERE_NOW_URL_PATTERN.exec(text)) !== null) {
    const slug = match[1].toLowerCase();

    // Skip root/infra subdomains
    if (EXCLUDED_SUBDOMAINS.has(slug)) continue;

    // Skip if preceded by @ (email pattern)
    const charBefore = match.index > 0 ? text[match.index - 1] : "";
    if (charBefore === "@") continue;

    // Slug should contain at least one hyphen (the word-word-xxxx pattern)
    if (!slug.includes("-")) continue;

    // Skip known placeholders from docs/templates
    if (PLACEHOLDER_SLUGS.has(slug)) continue;

    slugs.add(slug);
  }

  return [...slugs];
}

export function slugToUrl(slug: string): string {
  return `https://${slug}.here.now/`;
}
