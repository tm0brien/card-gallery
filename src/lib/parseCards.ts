/**
 * Pure CSV parsing and row-to-card transformation.
 * No network or filesystem dependencies — safe to import anywhere.
 */

import type { CardSummary } from '@/types/card'

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

export const GRADER_PATTERN = /^(BGS|BVG|PSA|SGC|CSG|HGA|GAI|KSA|BCCG)$/i
const CERT_PATTERN = /^\d{7,}$/
const SERIAL_PATTERN = /\/\d+/
const CARD_NUMBER_PATTERN = /^(?:\d+[A-Z]?|[A-Z]{1,5}-?[A-Z]*\d+)$/i

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180-compliant CSV parser — handles quoted fields containing commas. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const fields: string[] = []
    let field = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(field)
        field = ''
      } else {
        field += ch
      }
    }
    fields.push(field)
    rows.push(fields)
  }

  return rows
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function deriveId(player: string, year: string, set: string, grader: string, grade: string): string {
  return slugify(`${year}-${player}-${set}-${grader}-${grade}`)
}

export function trim(v: string | undefined): string {
  return (v ?? '').trim()
}

// ---------------------------------------------------------------------------
// Descriptive field parser (columns D–H, packed left)
// ---------------------------------------------------------------------------

interface DescriptiveFields {
  subset: string
  cardNumber: string
  parallel: string
  serialNumber: string
}

function parseDescriptive(values: string[]): DescriptiveFields {
  const result: DescriptiveFields = { subset: '', cardNumber: '', parallel: '', serialNumber: '' }

  for (const v of values) {
    if (SERIAL_PATTERN.test(v)) {
      result.serialNumber = v
    } else if (CARD_NUMBER_PATTERN.test(v)) {
      result.cardNumber = v
    } else {
      if (!result.subset) {
        result.subset = v
      } else {
        result.parallel = v
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Grading value parser
//   1 value  → overall only
//   5 values → overall + 4 subgrades
//   6 values → overall + auto grade + 4 subgrades
// ---------------------------------------------------------------------------

interface GradingFields {
  overallGrade: string
  autoGrade: string
  centering: string
  corners: string
  edges: string
  surface: string
}

function parseGradingValues(values: string[]): GradingFields {
  const [v0 = '', v1 = '', v2 = '', v3 = '', v4 = '', v5 = ''] = values

  if (values.length >= 6) {
    return { overallGrade: v0, autoGrade: v1, centering: v2, corners: v3, edges: v4, surface: v5 }
  }
  if (values.length === 5) {
    return { overallGrade: v0, autoGrade: '', centering: v1, corners: v2, edges: v3, surface: v4 }
  }
  if (values.length === 4) {
    return { overallGrade: v0, autoGrade: '', centering: v1, corners: v2, edges: v3, surface: '' }
  }
  return { overallGrade: v0, autoGrade: '', centering: '', corners: '', edges: '', surface: '' }
}

// ---------------------------------------------------------------------------
// Row → CardSummary
// ---------------------------------------------------------------------------

/**
 * Converts a raw CSV row into a CardSummary.
 * @param hasAssetsFn  Called with the derived card ID to check if 3D assets exist.
 *                     Pass `() => false` when running outside a filesystem context.
 */
export function rowToCard(
  row: string[],
  now: string,
  hasAssetsFn: (id: string) => boolean
): CardSummary | null {
  const year = trim(row[0])
  const player = trim(row[1])
  const set = trim(row[2])

  if (!player || !year || !set) return null

  let graderIdx = -1
  for (let i = 3; i <= Math.min(8, row.length - 1); i++) {
    if (GRADER_PATTERN.test(trim(row[i]))) {
      graderIdx = i
      break
    }
  }

  if (graderIdx === -1) return null

  const gradeCompany = trim(row[graderIdx])
  const descriptiveRaw = row.slice(3, graderIdx).map(trim).filter(Boolean)
  const { subset, cardNumber, parallel, serialNumber } = parseDescriptive(descriptiveRaw)

  let certNumber = ''
  let certIdx = row.length
  for (let i = row.length - 1; i > graderIdx; i--) {
    const v = trim(row[i])
    if (v && CERT_PATTERN.test(v)) {
      certNumber = v
      certIdx = i
      break
    }
  }

  const gradingRaw = row.slice(graderIdx + 1, certIdx).map(trim).filter(Boolean)
  const { overallGrade, autoGrade, centering, corners, edges, surface } =
    parseGradingValues(gradingRaw)

  const hasSubgrades = centering || corners || edges || surface
  const id = deriveId(player, year, set, gradeCompany, overallGrade)

  const titleParts = [year, player, set]
  if (subset) titleParts.push(subset)
  if (parallel) titleParts.push(parallel)
  const title = titleParts.join(' ')

  return {
    id,
    title,
    player,
    year,
    set,
    ...(subset && { subset }),
    ...(cardNumber && { cardNumber }),
    ...(parallel && { parallel }),
    ...(serialNumber && { serialNumber }),
    grade: {
      company: gradeCompany,
      score: overallGrade,
      ...(hasSubgrades && {
        subgrades: {
          ...(centering && { centering }),
          ...(corners && { corners }),
          ...(edges && { edges }),
          ...(surface && { surface }),
        },
      }),
    },
    ...(autoGrade && { autoGrade }),
    certificationNumber: certNumber,
    hasAssets: hasAssetsFn(id),
    lastSynced: now,
  }
}

// ---------------------------------------------------------------------------
// CSV text → CardSummary[]
// ---------------------------------------------------------------------------

export function parseSheetCSV(
  csvText: string,
  hasAssetsFn: (id: string) => boolean
): CardSummary[] {
  const rows = parseCSV(csvText)
  if (rows.length < 2) return []

  const now = new Date().toISOString()
  const cards: CardSummary[] = []

  for (const row of rows.slice(1)) {
    if (!row.some((v) => trim(v))) continue
    const card = rowToCard(row, now, hasAssetsFn)
    if (card) cards.push(card)
  }

  return cards
}
