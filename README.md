<div align="center">

# trilium-tree-proxy-template

A production-oriented **Cloudflare Workers** template for exposing a safe, frontend-friendly **Trilium ETAPI tree API**.

Turn your private Trilium note hierarchy into a public tree endpoint for blogs, note maps, knowledge graphs, and lazy-loaded navigation — **without exposing your ETAPI token**.

</div>

---

## Features

- **Cloudflare Workers ready**: lightweight, edge-deployable proxy template
- **Token-safe design**: keeps `TRILIUM_ETAPI_TOKEN` on the server side
- **Two response modes**:
  - lazy tree API for frontend tree components
  - note-map graph API for visual knowledge maps
- **CORS support** for cross-origin frontend consumption
- **Cache headers** for better public API performance
- **Node filtering** for hidden/system notes
- **Debug mode** to inspect fetch behavior and failures
- **TypeScript implementation** with simple local development workflow

---

## Use Cases

This template is useful when you want to:

- build a public **knowledge tree** from Trilium
- power an **About / Notes / Map** page in a blog
- load a large Trilium tree **on demand** instead of returning the whole tree at once
- generate a **graph-friendly structure** for visualization libraries
- keep Trilium private while exposing only a curated tree API

---

## Available Endpoints

### `GET /`
Basic service information.

### `GET /healthz`
Health check endpoint for uptime monitoring.

### `GET /api/trilium-tree`
Returns a **one-level lazy tree structure**.

Best for:
- expandable sidebar trees
- lazy-loaded note navigation
- public tree browsing in frontend apps

Supported query params:
- `rootNoteId`: override the default root note
- `debug=1`: include debug info in the response

### `GET /api/note-map/tree`
Returns a **graph-oriented tree representation**.

Best for:
- note map pages
- knowledge graph visualizations
- relationship-based frontend rendering

Typical response fields include:
- `notes`
- `links`
- `noteIdToDescendantCountMap`
- `rootNoteId`
- `generatedAt`

---

## Filtering Rules

By default, the template excludes notes that should not appear in the public tree:

- notes whose `noteId` starts with `_`
- notes with the label `excludeFromNoteMap`
- special `imageLink` relations are handled separately during descendant counting
- note-map mode reads the optional `color` label for visualization metadata

This makes it easier to keep internal/system nodes out of your public output.

---

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `TRILIUM_BASE_URL` | Yes | Your Trilium base URL, e.g. `https://trilium.example.com` |
| `TRILIUM_ETAPI_TOKEN` | Yes | Trilium ETAPI token |
| `ROOT_NOTE_ID` | No | Default root note ID used by tree endpoints |
| `ALLOW_ORIGIN` | No | Allowed CORS origin, defaults to `*` |
| `CACHE_MAX_AGE` | No | Public cache seconds, defaults to `300` |
| `MAP_MAX_NODES` | No | Max node count for note-map mode |

> Note: the current implementation does **not** use `MAX_DEPTH`.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Prepare local variables

Create a local development file based on the example:

```bash
cp .dev.vars.example .dev.vars
```

Then fill in your real values:

```dotenv
TRILIUM_BASE_URL=https://your-trilium.example.com
TRILIUM_ETAPI_TOKEN=replace_me
```

### 3. Start local development

```bash
npm run dev
```

### 4. Type-check

```bash
npm run check
```

---

## Deployment

### Deploy to Cloudflare Workers

```bash
wrangler login
wrangler secret put TRILIUM_ETAPI_TOKEN
wrangler deploy
```

If you want to define non-secret variables, configure them in `wrangler.jsonc` or the Cloudflare dashboard.

---

## Example Requests

### Lazy tree mode

```bash
curl 'https://your-worker.example.com/api/trilium-tree?rootNoteId=xxxxxxxx'
```

### Graph mode

```bash
curl 'https://your-worker.example.com/api/note-map/tree?rootNoteId=xxxxxxxx'
```

### Debug mode

```bash
curl 'https://your-worker.example.com/api/trilium-tree?debug=1'
```

---

## Project Structure

```text
.
├── index.ts           # Worker entry and API implementation
├── package.json       # npm scripts and dependencies
├── wrangler.jsonc     # Cloudflare Workers configuration
├── .dev.vars.example  # local env example
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

---

## Security Notes

- Never expose `TRILIUM_ETAPI_TOKEN` to the browser.
- Prefer setting a specific `ALLOW_ORIGIN` instead of `*` for production.
- Review your Trilium labels and hidden notes before making the API public.
- Use Cloudflare secrets for sensitive values.

---

## Who This Template Is For

This repository is a good fit if you:

- use **Trilium as a source of truth**
- want a **public read-only tree API**
- deploy infrastructure on **Cloudflare Workers**
- need a reusable starting point instead of building a proxy from scratch

---

## License

Released under the repository license.

If this template helps your project, feel free to fork it and adapt the filtering rules and output shape to your own frontend needs.
