export type CardOrientation = 'portrait' | 'landscape'

export function resolveCardOrientation(card: { orientation?: CardOrientation }): CardOrientation {
  return card.orientation ?? 'portrait'
}
