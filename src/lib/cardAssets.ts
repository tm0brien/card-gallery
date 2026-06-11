export const DISPLAY_BASE = '/assets/display'

export type CardFace = 'front' | 'back'
export type SlabEdge = 'left' | 'right' | 'top' | 'bottom'

export function getCardDisplayUrl(cardId: string, face: CardFace): string {
  return `${DISPLAY_BASE}/${cardId}/${face}.webp`
}

export function getSlabEdgeDisplayUrl(edge: SlabEdge): string {
  return `${DISPLAY_BASE}/edges/${edge}.webp`
}

/** Full-res PNG sources for 3D viewer, remix, mask, and export APIs */
export function getCardSourceUrl(cardId: string, face: CardFace): string {
  return `/assets/${cardId}/${face}.png`
}

export function getSlabEdgeSourceUrl(edge: SlabEdge): string {
  return `/assets/${edge}.png`
}

export function getCardSourceTextureUrls(cardId: string): { front: string; back: string } {
  return {
    front: getCardSourceUrl(cardId, 'front'),
    back: getCardSourceUrl(cardId, 'back'),
  }
}

export function getCardDisplayTextureUrls(cardId: string): { front: string; back: string } {
  return {
    front: getCardDisplayUrl(cardId, 'front'),
    back: getCardDisplayUrl(cardId, 'back'),
  }
}

export const SHARED_SLAB_EDGE_SOURCE_URLS = {
  left: getSlabEdgeSourceUrl('left'),
  right: getSlabEdgeSourceUrl('right'),
  top: getSlabEdgeSourceUrl('top'),
  bottom: getSlabEdgeSourceUrl('bottom'),
} as const

export const SHARED_SLAB_EDGE_SOURCE_URL_LIST = Object.values(SHARED_SLAB_EDGE_SOURCE_URLS)

export const SHARED_SLAB_EDGE_DISPLAY_URLS = {
  left: getSlabEdgeDisplayUrl('left'),
  right: getSlabEdgeDisplayUrl('right'),
  top: getSlabEdgeDisplayUrl('top'),
  bottom: getSlabEdgeDisplayUrl('bottom'),
} as const

export const SHARED_SLAB_EDGE_DISPLAY_URL_LIST = Object.values(SHARED_SLAB_EDGE_DISPLAY_URLS)

/**
 * The full texture set the 3D slab loads, in a stable key order.
 * Both CardSlab's useTexture call and the preloader derive from this so the
 * suspense cache key ([TextureLoader, ...urls]) matches exactly.
 */
export function getSlabTextureUrls(cardId: string): {
  front: string
  back: string
  left: string
  right: string
  top: string
  bottom: string
} {
  return {
    front: getCardDisplayUrl(cardId, 'front'),
    back: getCardDisplayUrl(cardId, 'back'),
    left: SHARED_SLAB_EDGE_DISPLAY_URLS.left,
    right: SHARED_SLAB_EDGE_DISPLAY_URLS.right,
    top: SHARED_SLAB_EDGE_DISPLAY_URLS.top,
    bottom: SHARED_SLAB_EDGE_DISPLAY_URLS.bottom,
  }
}
