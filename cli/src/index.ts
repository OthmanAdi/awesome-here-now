#!/usr/bin/env bun
/**
 * herenow-discover — Find and catalog sites published on here.now
 *
 * Commands:
 *   discover   Run all discovery sources and validate found sites
 *   validate   Re-validate all previously discovered sites
 *   sync       Export discoveries to ../website/sites.json
 *   stats      Show discovery statistics
 */

import { discoverFromGithub } from "./sources/github.js";
import { discoverFromHackerNews } from "./sources/hackernews.js";
import { discoverFromWebSearch } from "./sources/web-search.js";
import { probeMany, applyProbeResults } from "./sources/probe.js";
import { loadStore, saveStore, mergeSites } from "./store.js";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { DiscoveredSite, DiscoverResult } from "./types.js";

// ─── Output helpers ───────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function log(msg: string) {
  console.log(msg);
}

function header(title: string) {
  log(`\n${BOLD}${CYAN}${title}${RESET}`);
  log(`${DIM}${"─".repeat(50)}${RESET}`);
}

function success(msg: string) {
  log(`  ${GREEN}✓${RESET} ${msg}`);
}

function warn(msg: string) {
  log(`  ${YELLOW}!${RESET} ${msg}`);
}

function error(msg: string) {
  log(`  ${RED}✗${RESET} ${msg}`);
}

function statusIcon(status: string): string {
  if (status === "live") return `${GREEN}●${RESET}`;
  if (status === "dead") return `${RED}●${RESET}`;
  return `${YELLOW}●${RESET}`;
}

// ─── Commands ─────────────────────────────────────────────

async function cmdDiscover(sources: string[]) {
  log(`\n${BOLD}herenow-discover${RESET} — Finding sites on here.now\n`);

  const enabledSources = sources.length > 0 ? sources : ["github", "hackernews", "web-search"];

  const store = await loadStore();
  const results: DiscoverResult[] = [];

  // Run enabled sources
  for (const source of enabledSources) {
    const label = source.padEnd(12);
    process.stdout.write(`  ${DIM}[${label}]${RESET} Searching...`);

    let result: DiscoverResult;
    switch (source) {
      case "github":
        result = await discoverFromGithub();
        break;
      case "hackernews":
        result = await discoverFromHackerNews();
        break;
      case "web-search":
        result = await discoverFromWebSearch();
        break;
      default:
        warn(`Unknown source: ${source}`);
        continue;
    }

    results.push(result);
    const dur = `${(result.duration / 1000).toFixed(1)}s`;
    process.stdout.write(
      `\r  ${DIM}[${label}]${RESET} ${result.sites.length} slugs found ${DIM}(${dur})${RESET}\n`
    );

    for (const err of result.errors) {
      error(`  ${err}`);
    }
  }

  // Merge all discovered slugs
  const allDiscovered = results.flatMap((r) => r.sites);
  const uniqueSlugs = [...new Set(allDiscovered.map((s) => s.slug))];

  header(`Validating ${uniqueSlugs.length} unique slugs`);
  const probeResults = await probeMany(uniqueSlugs, 15);

  const live = probeResults.filter((r) => r.status === "live");
  const dead = probeResults.filter((r) => r.status === "dead");
  const unknown = probeResults.filter((r) => r.status === "unknown");

  success(`${live.length} live`);
  if (dead.length > 0) warn(`${dead.length} dead/expired`);
  if (unknown.length > 0) warn(`${unknown.length} unknown`);

  // Apply probe results and merge into store
  const validated = applyProbeResults(allDiscovered, probeResults);
  const { merged, newCount } = mergeSites(store.sites, validated);

  store.sites = merged;
  store.lastRun = new Date().toISOString();
  store.totalRuns++;
  await saveStore(store);

  // Results summary
  header("Results");

  if (live.length > 0) {
    log("");
    for (const site of merged.filter((s) => s.status === "live")) {
      log(`  ${statusIcon("live")} ${BOLD}${site.url}${RESET}`);
      if (site.foundIn) log(`    ${DIM}Found in: ${site.foundIn}${RESET}`);
    }
  }

  log("");
  log(`  ${BOLD}Total in database:${RESET} ${merged.length} sites`);
  log(`  ${BOLD}New this run:${RESET}     ${newCount}`);
  log(`  ${BOLD}Live:${RESET}             ${merged.filter((s) => s.status === "live").length}`);
  log(`  ${BOLD}Dead/expired:${RESET}     ${merged.filter((s) => s.status === "dead").length}`);
  log(`  ${BOLD}Data saved to:${RESET}    cli/data/discovered.json`);
  log("");
}

async function cmdValidate() {
  log(`\n${BOLD}herenow-discover validate${RESET} — Re-checking all known sites\n`);

  const store = await loadStore();
  if (store.sites.length === 0) {
    warn("No sites in database. Run 'discover' first.");
    return;
  }

  const slugs = store.sites.map((s) => s.slug);
  log(`  Probing ${slugs.length} sites...`);

  const probeResults = await probeMany(slugs, 15);
  store.sites = applyProbeResults(store.sites, probeResults);
  store.lastRun = new Date().toISOString();
  await saveStore(store);

  const live = store.sites.filter((s) => s.status === "live");
  const dead = store.sites.filter((s) => s.status === "dead");

  header("Validation Results");

  for (const site of store.sites) {
    const icon = statusIcon(site.status || "unknown");
    log(`  ${icon} ${site.url} ${DIM}(${site.status})${RESET}`);
  }

  log("");
  success(`${live.length} live, ${dead.length} dead/expired`);
  log("");
}

async function cmdSync() {
  log(`\n${BOLD}herenow-discover sync${RESET} — Syncing to website/sites.json\n`);

  const store = await loadStore();
  const liveSites = store.sites.filter((s) => s.status === "live");

  if (liveSites.length === 0) {
    warn("No live sites to sync. Run 'discover' first.");
    return;
  }

  // Read existing sites.json
  const sitesJsonPath = join(import.meta.dir, "..", "..", "website", "sites.json");
  let existingSites: any[] = [];
  try {
    const raw = await readFile(sitesJsonPath, "utf-8");
    existingSites = JSON.parse(raw);
  } catch {
    existingSites = [];
  }

  const existingSlugs = new Set(existingSites.map((s: any) => s.slug));
  const newSites: any[] = [];

  for (const site of liveSites) {
    if (!existingSlugs.has(site.slug)) {
      newSites.push({
        slug: site.slug,
        title: site.title || site.slug,
        description: site.description || `Discovered via ${site.source}`,
        author: "Unknown",
        github: "",
        category: "misc",
        agent: "Unknown",
        submitted: site.foundAt.split("T")[0],
        auth: "unknown",
        discoveredBy: "herenow-discover",
        source: site.source,
      });
    }
  }

  if (newSites.length === 0) {
    warn("No new sites to add. Everything is already in sites.json.");
    return;
  }

  const merged = [...existingSites, ...newSites];
  await writeFile(sitesJsonPath, JSON.stringify(merged, null, 2) + "\n");

  success(`Added ${newSites.length} new sites to website/sites.json`);
  for (const site of newSites) {
    log(`    ${GREEN}+${RESET} ${site.slug}`);
  }
  log("");
  warn("Review the new entries and fill in author/category/agent before publishing.");
  log("");
}

async function cmdStats() {
  const store = await loadStore();

  header("herenow-discover stats");
  log("");
  log(`  ${BOLD}Total sites:${RESET}   ${store.sites.length}`);
  log(`  ${BOLD}Live:${RESET}          ${store.sites.filter((s) => s.status === "live").length}`);
  log(`  ${BOLD}Dead:${RESET}          ${store.sites.filter((s) => s.status === "dead").length}`);
  log(`  ${BOLD}Unknown:${RESET}       ${store.sites.filter((s) => s.status === "unknown").length}`);
  log(`  ${BOLD}Total runs:${RESET}    ${store.totalRuns}`);
  log(`  ${BOLD}Last run:${RESET}      ${store.lastRun || "never"}`);

  // Source breakdown
  const bySrc = new Map<string, number>();
  for (const site of store.sites) {
    bySrc.set(site.source, (bySrc.get(site.source) || 0) + 1);
  }
  if (bySrc.size > 0) {
    log("");
    log(`  ${BOLD}By source:${RESET}`);
    for (const [src, count] of bySrc) {
      log(`    ${src.padEnd(15)} ${count}`);
    }
  }

  log("");
}

// ─── CLI Router ───────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "discover":
    await cmdDiscover(args);
    break;
  case "validate":
    await cmdValidate();
    break;
  case "sync":
    await cmdSync();
    break;
  case "stats":
    await cmdStats();
    break;
  default:
    log(`
${BOLD}herenow-discover${RESET} — Find sites published on here.now

${BOLD}Usage:${RESET}
  bun run src/index.ts <command> [options]

${BOLD}Commands:${RESET}
  discover [sources...]  Search for here.now sites (github, hackernews, web-search)
  validate               Re-check all known sites (live/dead)
  sync                   Export live discoveries to ../website/sites.json
  stats                  Show discovery database statistics

${BOLD}Examples:${RESET}
  bun run src/index.ts discover                    # All sources
  bun run src/index.ts discover github             # GitHub only
  bun run src/index.ts discover github hackernews  # Multiple sources
  bun run src/index.ts validate                    # Re-check everything
  bun run src/index.ts sync                        # Push to sites.json
`);
}
