/**
 * Hybrid card data fetcher.
 *
 * Priority:
 *   1. Live CSV export from Google Sheets (always attempted first)
 *   2. Cached public/data/cards.json  (written on every successful live fetch)
 *   3. Empty manifest                 (if both fail — e.g. first run with no cache)
 *
 * This runs server-side only (Next.js API routes / getStaticProps).
 */

import fs from 'fs'
import path from 'path'
import type { CardManifest } from '@/types/card'
import { parseSheetCSV } from '@/lib/parseCards'

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SHEET_GID = process.env.GOOGLE_SHEET_GID ?? '0'
const MANIFEST_PATH = path.resolve(process.cwd(), 'public/data/cards.json')
const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

function hasAssets(id: string): boolean {
  const dir = path.join(ASSETS_DIR, id)
  return (
    fs.existsSync(path.join(dir, 'front.png')) &&
    fs.existsSync(path.join(dir, 'back.png'))
  )
}

function detectOrientation(id: string): 'portrait' | 'landscape' | undefined {
  const frontPath = path.join(ASSETS_DIR, id, 'front.png')
  if (!fs.existsSync(frontPath)) return undefined
  try {
    const buf = Buffer.alloc(24)
    const fd = fs.openSync(frontPath, 'r')
    fs.readSync(fd, buf, 0, 24, 0)
    fs.closeSync(fd)
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    return width > height ? 'landscape' : 'portrait'
  } catch {
    return undefined
  }
}

function readCache(): CardManifest | null {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8')
    return { ...JSON.parse(raw), source: 'cache' } as CardManifest
  } catch {
    return null
  }
}

function writeCache(manifest: CardManifest): void {
  try {
    fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
    // Don't persist the runtime-only source field
    const { source: _source, ...rest } = manifest
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(rest, null, 2))
  } catch (err) {
    // Non-fatal — read-only filesystems (e.g. Vercel) will hit this
    console.warn('[cards] Could not write cache:', err)
  }
}

export async function getCards(): Promise<CardManifest> {
  // 1. Attempt live fetch
  if (SHEET_ID) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
      const res = await fetch(csvUrl)

      if (res.ok) {
        const csvText = await res.text()
        const cards = parseSheetCSV(csvText, hasAssets)
        for (const card of cards) {
          const orientation = detectOrientation(card.id)
          if (orientation && orientation !== 'portrait') {
            card.orientation = orientation
          }
        }
        const manifest: CardManifest = {
          version: 1,
          lastSynced: new Date().toISOString(),
          cards,
          source: 'live',
        }
        writeCache(manifest)
        return manifest
      }

      console.warn(`[cards] Live fetch returned HTTP ${res.status}, falling back to cache.`)
    } catch (err) {
      console.warn('[cards] Live fetch failed, falling back to cache:', err)
    }
  }

  // 2. Fall back to cached file
  const cached = readCache()
  if (cached) {
    console.warn('[cards] Serving cached data from', cached.lastSynced)
    return cached
  }

  // 3. Nothing available
  console.error('[cards] No live data and no cache file found. Run `npm run sync-cards` to seed the cache.')
  return { version: 1, lastSynced: '', cards: [], source: 'empty' }
}
