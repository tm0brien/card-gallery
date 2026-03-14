/**
 * Manually seeds / refreshes public/data/cards.json from Google Sheets.
 *
 * Usage:
 *   npm run sync-cards
 *
 * This is only needed to seed the initial cache before the first run,
 * or to force a refresh outside of the normal request cycle.
 * The app itself fetches live data via src/lib/cards.ts on every request.
 *
 * Required env vars (set in .env.local):
 *   GOOGLE_SHEET_ID   — the Sheet ID from the URL
 *   GOOGLE_SHEET_GID  — tab GID (default: 0)
 *
 * The sheet must be set to "Anyone with the link can view".
 */

import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { parseSheetCSV } from '../src/lib/parseCards'
import type { CardManifest } from '../src/types/card'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

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

/** Read width/height from a PNG's IHDR chunk (bytes 16–23). */
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

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = (targetUrl: string) => {
      https.get(targetUrl, { agent: false }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      }).on('error', reject)
    }
    request(url)
  })
}

async function main() {
  console.log('🔄  Syncing cards from Google Sheets…\n')

  if (!SHEET_ID) {
    console.error('❌  GOOGLE_SHEET_ID is not set in .env.local')
    process.exit(1)
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
  console.log('📄  Fetching CSV export…')

  let csvText: string
  try {
    csvText = await httpsGet(csvUrl)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌  Failed to fetch sheet: ${msg}`)
    console.error('    Make sure the sheet is set to "Anyone with the link can view".')
    process.exit(1)
  }

  const cards = parseSheetCSV(csvText, hasAssets)

  for (const card of cards) {
    const orientation = detectOrientation(card.id)
    if (orientation && orientation !== 'portrait') {
      card.orientation = orientation
    }
  }

  console.log(`✅  Parsed ${cards.length} cards.\n`)

  let skipped = 0
  for (const card of cards) {
    const icon = card.hasAssets ? '🖼 ' : '📋'
    const gradeStr = `${card.grade.company} ${card.grade.score}`
    const autoStr = card.autoGrade ? ` (auto ${card.autoGrade})` : ''
    console.log(`  ${icon}  ${card.year} ${card.player} — ${card.set} — ${gradeStr}${autoStr}`)
  }

  if (skipped > 0) console.log(`\n  ⚠  Skipped ${skipped} row(s).`)

  const manifest: CardManifest = {
    version: 1,
    lastSynced: new Date().toISOString(),
    cards,
  }

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  console.log(`\n✅  Wrote ${cards.length} cards to public/data/cards.json`)
  console.log(`    🖼  ${cards.filter((c) => c.hasAssets).length} with assets`)
  console.log(`    📋  ${cards.filter((c) => !c.hasAssets).length} without assets`)
}

main().catch((err) => {
  console.error('\n❌  Sync failed:', err.message ?? err)
  process.exit(1)
})
