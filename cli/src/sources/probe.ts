/**
 * HTTP Probe — validate whether a here.now slug is live.
 *
 * Uses HEAD requests to minimize bandwidth.
 * 200 = live, 404 = dead/expired, anything else = unknown.
 */

import type { DiscoveredSite } from "../types.js";
import { slugToUrl } from "../extract.js";

interface ProbeResult {
  slug: string;
  status: "live" | "dead" | "unknown";
  httpStatus: number;
  contentType?: string;
}

export async function probeSite(slug: string): Promise<ProbeResult> {
  const url = slugToUrl(slug);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    const contentType = res.headers.get("content-type") || undefined;

    if (res.status === 200) {
      return { slug, status: "live", httpStatus: 200, contentType };
    } else if (res.status === 404) {
      return { slug, status: "dead", httpStatus: 404 };
    } else {
      return { slug, status: "unknown", httpStatus: res.status };
    }
  } catch {
    return { slug, status: "unknown", httpStatus: 0 };
  }
}

export async function probeMany(
  slugs: string[],
  concurrency = 10
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const queue = [...slugs];

  async function worker() {
    while (queue.length > 0) {
      const slug = queue.shift()!;
      const result = await probeSite(slug);
      results.push(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, slugs.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

export function applyProbeResults(
  sites: DiscoveredSite[],
  results: ProbeResult[]
): DiscoveredSite[] {
  const resultMap = new Map(results.map((r) => [r.slug, r]));
  const now = new Date().toISOString();

  return sites.map((site) => {
    const probe = resultMap.get(site.slug);
    if (probe) {
      return {
        ...site,
        status: probe.status,
        httpStatus: probe.httpStatus,
        contentType: probe.contentType,
        lastChecked: now,
      };
    }
    return site;
  });
}
