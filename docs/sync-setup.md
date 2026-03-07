# Google Sheets Sync — Setup Guide

No API key, no Google Cloud project, no credentials file. Just make your sheet publicly viewable and run the command.

---

## 1. Make your Google Sheet viewable

1. Open your Google Sheet
2. Click **Share** (top-right)
3. Under "General access", change **Restricted** to **Anyone with the link**
4. Make sure the role is set to **Viewer** (read-only — no one can edit your sheet)
5. Click **Done**

That's the only setup step. The Sheet ID is already in `.env.local`.

---

## 2. Run the sync

```bash
npm run sync-cards
```

Output example:
```
🔄  Syncing cards from Google Sheets…

📄  Fetching CSV export…
✅  Fetched 25 data rows.

  🖼   1955 Hank Aaron — Bowman — BVG 5.5
  📋  1998-99 Paul Pierce — Upper Deck — BGS 9
  📋  2008-2009 Paul Pierce — Topps Signature — BGS 9.5 (auto 10)
  📋  2015 Rafael Devers — Bowman Chrome — BGS 9
  ...

✅  Wrote 25 cards to public/data/cards.json
    🖼  1 with assets
    📋  24 without assets (placeholder)
```

Cards marked `🖼` have `front.png` and `back.png` in `public/assets/[id]/` and will show the real image in the gallery. Cards marked `📋` have metadata only and will show a placeholder tile.

---

## Your sheet's column layout

The first three columns are fixed; the rest are "packed left" — each row fills only what applies to that card, with no blank gaps.

**Fixed columns:**

| Column | Header | Description |
|--------|--------|-------------|
| A | Year | Card year (e.g. "1955", "2017-18") |
| B | Player | Player name(s) |
| C | Set | Set name (e.g. "Topps", "Bowman Chrome") |

**Variable descriptive columns (D–H, not all rows use all five):**

| Header | Description | Examples |
|--------|-------------|---------|
| Subset | Insert, subset, or product line | "Autographs", "Prospects", "BeamTeam" |
| Variation | Variation name | "Yellow", "Grey Back", "Purple Refractor" |
| Parallel | Additional parallel descriptor | "Blue", "Refractor" |
| Set number | Card number within the set | "179", "TSA-PP", "BCP34", "30B" |
| Limited number | Serial numbering | "1717/1999", "108/250", "/1020" |

**Grading columns (immediately follow the last descriptive field):**

| Header | Description |
|--------|-------------|
| Grader | BGS, BVG, PSA, SGC, etc. |
| Overall Grade | Numeric grade |
| Auto Grade | Auto grade for signed cards (omit if not applicable) |
| Centering | Centering subgrade (omit if not recorded) |
| Corners | Corners subgrade |
| Edges | Edges subgrade |
| Surface | Surface subgrade |
| Grading serial | 10-digit certification number |

The script detects the grader column automatically by scanning for a known grading company name, so column alignment doesn't need to be perfect.

---

## Re-running the sync

Run `npm run sync-cards` any time you update the sheet. It fully rewrites `public/data/cards.json`.

---

## Multiple tabs

If your card data is not on the first tab, find the tab's GID in the URL (`gid=XXXXXX`) and uncomment `GOOGLE_SHEET_GID` in `.env.local`.
