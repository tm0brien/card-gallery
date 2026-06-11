export interface CardSubgrades {
    centering?: string
    corners?: string
    edges?: string
    surface?: string
}

export interface CardGrade {
    company: string
    score: string
    label?: string
    subgrades?: CardSubgrades
}

export interface CardData {
    title: string
    player: string
    year: string
    set: string
    cardNumber: string
    team: string
    manufacturer?: string
    grade: CardGrade
    certificationNumber: string
    notes?: string
}

/**
 * Lightweight summary stored in public/data/cards.json.
 * Loaded by the inventory page without fetching individual card-data.json files.
 */
export interface CardSummary {
  id: string
  /** Generated display title, e.g. "1955 Hank Aaron Bowman" */
  title: string
  player: string
  year: string
  set: string
  /** Insert/subset name, e.g. "Autographs", "Prospects", "BeamTeam" */
  subset?: string
  /** Card number within the set, e.g. "179", "TSA-PP", "BCP34" */
  cardNumber?: string
  /** Parallel or variation name, e.g. "Purple Refractor", "Yellow", "Grey Back" */
  parallel?: string
  /** Serial numbering, e.g. "1717/1999", "108/250", "/1020" */
  serialNumber?: string
  grade: CardGrade
  /** Auto grade for signed cards */
  autoGrade?: string
  certificationNumber: string
  notes?: string
  /** "portrait" or "landscape" — derived from front.png dimensions at sync time */
  orientation?: 'portrait' | 'landscape'
  /** True when front.png and back.png exist under public/assets/[id]/ */
  hasAssets: boolean
  /** ISO timestamp of the last sync from Google Sheets */
  lastSynced: string
}

export interface CardManifest {
  version: number
  lastSynced: string
  cards: CardSummary[]
  /** Where this manifest came from — useful for debugging staleness */
  source?: 'live' | 'cache' | 'empty'
}

export interface CameraPreset {
    name: string
    position: [number, number, number]
    target: [number, number, number]
}
