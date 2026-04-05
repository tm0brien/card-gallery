import fs from 'fs'
import path from 'path'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

export interface RemixEntry {
  id: string
  type: 'image' | 'video'
  filename: string
  prompt: string
  createdAt: string
}

export function getRemixesDir(cardId: string): string {
  return path.join(ASSETS_DIR, cardId, 'remixes')
}

export function ensureRemixesDir(cardId: string): string {
  const dir = getRemixesDir(cardId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function manifestPath(cardId: string): string {
  return path.join(getRemixesDir(cardId), 'remixes.json')
}

export function readManifest(cardId: string): RemixEntry[] {
  const p = manifestPath(cardId)
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return []
  }
}

export function appendToManifest(cardId: string, entry: RemixEntry): void {
  const entries = readManifest(cardId)
  entries.push(entry)
  const dir = ensureRemixesDir(cardId)
  fs.writeFileSync(path.join(dir, 'remixes.json'), JSON.stringify(entries, null, 2))
}
