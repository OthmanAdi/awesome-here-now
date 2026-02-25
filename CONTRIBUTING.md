# Contributing to Awesome here.now

Thanks for submitting! This list grows because people like you share what they build.

## How to Submit

### Option 1: GitHub Issue (recommended)

[Open a submission issue](https://github.com/OthmanAdi/awesome-here-now/issues/new?template=submit-site.yml) and fill out the form. We'll review and add it.

### Option 2: Pull Request

1. **Fork** this repository
2. **Add your site** to the appropriate category table in `README.md`:

   ```markdown
   | [Site Name](https://your-slug.here.now/) | [@yourhandle](https://github.com/yourhandle) | One sentence description | Agent Name |
   ```

3. **Add your site** to `website/sites.json`:

   ```json
   {
     "slug": "your-slug",
     "title": "Site Name",
     "description": "One sentence description",
     "author": "Your Name",
     "github": "yourhandle",
     "category": "portfolios",
     "agent": "Claude Code",
     "submitted": "2026-02-26"
   }
   ```

4. **Submit the PR** with a clear title like: `Add: My Cool Project`

## Requirements

- **Must be live** on `*.here.now` at time of submission
- **One site per PR/issue** (submit multiple separately)
- **One sentence description** — keep it tight
- **Category must exist** — if none fit, suggest a new one in your PR
- **No duplicates** — check the list first
- **No illegal or malicious content**

## What Gets Accepted

Anything built and published via here.now:

- Portfolios, resumes, personal sites
- Dashboards, data visualizations, charts
- Games, interactive demos
- Documentation, tutorials, guides
- AI agent demos and showcases
- Landing pages, product pages
- Art, generative visuals, creative projects
- Developer tools, utilities

## What Gets Rejected

- Sites not hosted on `*.here.now`
- Expired anonymous publishes with no screenshot
- Spam, placeholder pages, or empty templates
- Duplicate submissions

## Expired Sites

Anonymous here.now publishes expire in 24 hours. If your site expires:

- We'll keep your entry if you included a screenshot
- We'll mark it as `[expired]` and link to the screenshot
- You can re-submit with a permanent (authenticated) publish anytime

## Questions?

[Open a general issue](https://github.com/OthmanAdi/awesome-here-now/issues/new) — we're happy to help.
