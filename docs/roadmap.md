# Card Gallery — Roadmap

## Current State

A polished single-card 3D viewer built on Next.js + React Three Fiber. Displays one hardcoded card (`1955-aaron-bowman-bgs-55`) with 6-face textured geometry, interactive camera controls, lighting themes, and an info panel. Card data lives as static JSON files under `public/assets/[card-id]/`.

---

## Phase 1 — Google Sheets Import & Data Foundation

**Goal:** Seed the card inventory from your existing Google Sheet without needing a database yet.

### What to build

- **`/scripts/sync-from-sheets.ts`** — a one-time (and re-runnable) Node script that:
  1. Reads your Google Sheet via the Google Sheets API (or a published CSV export URL — no API key required)
  2. Maps each row to the existing `CardData` shape in `src/types/card.ts`
  3. Writes a single `public/data/cards.json` manifest file listing all cards
  4. Optionally scaffolds a `public/assets/[card-id]/card-data.json` for any card that doesn't already have one

- **`public/data/cards.json`** — a flat manifest of every card with at minimum:
  ```json
  [
    {
      "id": "1955-aaron-bowman-bgs-55",
      "player": "Hank Aaron",
      "year": "1955",
      "set": "Bowman",
      "grade": { "company": "BGS", "score": "5.5" },
      "hasAssets": true
    }
  ]
  ```
  Cards without photos yet can be listed with `"hasAssets": false` and shown as a placeholder in the gallery.

### Google Sheet format to target

| id | player | year | set | cardNumber | team | gradeCompany | gradeScore | centering | corners | edges | surface | certNumber | notes |
|----|--------|------|-----|------------|------|-------------|------------|-----------|---------|-------|---------|------------|-------|

### Decisions to make before building
- Will you use a published CSV URL (simplest, no auth) or the Sheets API with a service account?
- Should the script be a one-time migration or stay as a recurring sync command (`npm run sync-cards`)?

---

## Phase 2 — Inventory / Gallery View

**Goal:** A browsable grid of all cards that routes into the existing single-card 3D viewer.

### Routing changes

Introduce Next.js dynamic routing:

```
/                    → Inventory (gallery grid)
/card/[id]           → Single card 3D viewer (existing Root.tsx experience)
```

`src/pages/index.tsx` becomes the gallery. `src/pages/card/[id].tsx` becomes the viewer, loading the card by ID from `public/data/cards.json` and then fetching `/assets/[id]/card-data.json`.

### Inventory page features

- **Card grid** — responsive grid of card thumbnails using the `front.png` from each card's asset folder (or a placeholder for cards without assets yet)
- **Card tile** — shows player name, year, set, grade badge, and a hover effect
- **Quick search / filter** — filter by player name, year, set, or grade range (client-side, no backend needed at this scale)
- **Sort** — by year, grade score, player name, set
- **"No assets yet" state** — cards from the Sheet without photos show a stylized placeholder tile so the full collection is visible even before you photograph everything
- **Theme continuity** — same Gallery/Study/Night themes as the viewer, applied to the grid UI

### Navigation

- Clicking a card tile navigates to `/card/[id]`
- The viewer page gets a **Back to Gallery** button
- Browser back/forward works naturally via Next.js routing
- Deep links to `/card/[id]` work directly (useful for sharing)

### What changes in existing code

- `Root.tsx` stops hardcoding the card path; it accepts a card ID prop from the page
- `src/pages/index.tsx` is repurposed (or the viewer moves to `/card/[id]`)
- `src/types/card.ts` gets a `CardSummary` type (for the manifest) alongside the existing `CardData` type

---

## Phase 3 — Admin Tool

**Goal:** A simple, password-protected admin interface to manage the card inventory without touching JSON files directly.

### Approach

Use Next.js API routes + a lightweight local data store (start with the `cards.json` file, graduate to SQLite or a hosted DB when needed).

### Admin features

#### Card list management
- View all cards in a table
- Add a new card (form matching the `CardData` shape)
- Edit any card's metadata
- Toggle a card's visibility in the public gallery
- Delete a card

#### Asset management
- Upload `front.png`, `back.png`, and the 4 edge images per card
- Preview the uploaded images before saving
- Mark a card as having complete assets

#### Google Sheets re-sync
- A "Re-sync from Sheets" button that re-runs the import script server-side, merging new rows without overwriting manual edits

### Authentication

Start with HTTP Basic Auth via a Next.js middleware check on `/admin/*` routes — a single hardcoded `ADMIN_PASSWORD` environment variable. No user accounts needed.

```
/admin               → Card list table
/admin/cards/new     → Add card form
/admin/cards/[id]    → Edit card form + asset uploader
```

### Data persistence options (pick one)

| Option | Pros | Cons |
|--------|------|------|
| `public/data/cards.json` (current) | Zero setup | Not writable in production deploys |
| `data/cards.json` (project root, not public) | Simple, git-trackable | Still file-based |
| **SQLite via `better-sqlite3`** | Real DB, fast, single file, no server | Needs persistent disk (works on VPS, not Vercel) |
| PlanetScale / Turso / Neon (hosted) | Works anywhere, scales | External dependency, free tier limits |

**Recommendation:** SQLite for local/self-hosted, swap to Turso (libSQL, SQLite-compatible) if you ever deploy to a serverless host.

---

## Phase 4 — Future Enhancements (Backlog)

These are lower-priority ideas to revisit after Phases 1–3 are solid:

- **Comparison view** — put two cards side-by-side in the 3D viewer
- **Collection stats** — dashboard showing total cards, grade distribution, set breakdown
- **Sharing** — generate a shareable link or image card for a specific card
- **Card sets / binders** — group cards into named collections or sets
- **Search with filters saved in URL** — `/?player=aaron&grade=8+` so filtered views are shareable
- **Public vs. private cards** — mark individual cards as unlisted
- **Mobile camera upload** — photo a card on your phone and upload it directly from the admin on mobile

---

## Technical Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing | Next.js file-based routing (`pages/`) | Already in use, zero migration |
| Data for Phase 1–2 | Static JSON manifest | No backend needed, git-trackable |
| Admin auth | Env var + middleware | Minimal complexity for a personal tool |
| 3D viewer | Keep React Three Fiber | Already polished, no reason to change |
| Styling | Keep CSS Modules + existing theme system | Consistency with current UI |
| Google Sheets sync | Published CSV or Sheets API | TBD based on auth preference |

---

## Open Questions

1. **Google Sheet access** — published CSV (no auth, manual publish step) or Sheets API service account (automatic, needs credentials)?
2. **Deployment target** — local only, VPS, or Vercel? This determines the right database choice for the admin tool.
3. **Photo workflow** — will you photograph cards yourself and upload via admin, or are images coming from an external source (COMC, eBay, etc.)?
4. **Public access** — should the gallery be publicly accessible on the internet, or is this a private local tool?
