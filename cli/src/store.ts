import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import type { DiscoveredSite, Store } from "./types.js";

const STORE_PATH = join(import.meta.dir, "..", "data", "discovered.json");

export async function loadStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { sites: [], totalRuns: 0 };
  }
}

export async function saveStore(store: Store): Promise<void> {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2) + "\n");
}

export function mergeSites(
  existing: DiscoveredSite[],
  incoming: DiscoveredSite[]
): { merged: DiscoveredSite[]; newCount: number } {
  const bySlug = new Map<string, DiscoveredSite>();

  // Existing sites as baseline
  for (const site of existing) {
    bySlug.set(site.slug, site);
  }

  let newCount = 0;

  for (const site of incoming) {
    const prev = bySlug.get(site.slug);
    if (!prev) {
      // Brand new discovery
      bySlug.set(site.slug, site);
      newCount++;
    } else {
      // Update with latest validation data if available
      if (site.status && site.status !== "unknown") {
        prev.status = site.status;
        prev.lastChecked = site.lastChecked;
        prev.httpStatus = site.httpStatus;
      }
      // Keep richer metadata
      if (site.title && !prev.title) prev.title = site.title;
      if (site.description && !prev.description)
        prev.description = site.description;
    }
  }

  const merged = [...bySlug.values()].sort(
    (a, b) => b.foundAt.localeCompare(a.foundAt)
  );

  return { merged, newCount };
}
