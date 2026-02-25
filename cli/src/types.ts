export interface DiscoveredSite {
  slug: string;
  url: string;
  title?: string;
  description?: string;
  source: Source;
  foundAt: string; // ISO date
  foundIn?: string; // e.g. repo name, HN post ID
  status?: "live" | "dead" | "unknown";
  lastChecked?: string;
  httpStatus?: number;
  contentType?: string;
}

export type Source =
  | "github"
  | "hackernews"
  | "web-search"
  | "manual"
  | "probe";

export interface DiscoverResult {
  source: Source;
  sites: DiscoveredSite[];
  errors: string[];
  duration: number;
}

export interface Store {
  sites: DiscoveredSite[];
  lastRun?: string;
  totalRuns: number;
}
