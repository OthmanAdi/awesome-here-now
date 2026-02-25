# herenow-discover

CLI tool to discover, validate, and catalog sites published on [here.now](https://here.now).

## How It Works

Since here.now has no public directory API, this tool discovers sites from multiple sources:

| Source | Method | Auth Required |
|--------|--------|---------------|
| **GitHub** | Searches code, READMEs, and issues for here.now URLs via `gh` CLI | `gh auth login` |
| **Hacker News** | Searches stories and comments via Algolia HN API | None |
| **Web Search** | Scrapes DuckDuckGo and Google for indexed here.now sites | None |
| **HTTP Probe** | Validates discovered slugs (HEAD request, 200=live, 404=dead) | None |

Every discovered URL is validated via HTTP probe before being stored.

## Requirements

- [Bun](https://bun.sh) runtime
- [GitHub CLI](https://cli.github.com/) (`gh`) — authenticated

## Usage

```bash
cd cli

# Run all discovery sources
bun run src/index.ts discover

# Run specific sources
bun run src/index.ts discover github
bun run src/index.ts discover github hackernews

# Re-validate all known sites
bun run src/index.ts validate

# Export live sites to website/sites.json
bun run src/index.ts sync

# View stats
bun run src/index.ts stats
```

Or use npm scripts:

```bash
bun run discover
bun run validate
bun run sync
bun run stats
```

## Data

Discovered sites are stored in `data/discovered.json`. Each entry includes:

- `slug` — the here.now subdomain
- `url` — full URL
- `source` — where it was found (github, hackernews, web-search)
- `foundIn` — specific location (repo, HN post ID, search query)
- `status` — live, dead, or unknown
- `lastChecked` — when it was last validated

## Adding Sources

Each source is a standalone module in `src/sources/`. To add a new source:

1. Create `src/sources/your-source.ts`
2. Export a `discoverFromYourSource(): Promise<DiscoverResult>` function
3. Add it to the switch statement in `src/index.ts`
