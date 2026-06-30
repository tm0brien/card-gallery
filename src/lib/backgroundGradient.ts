/**
 * Derives a radial-gradient stop set (center -> mid -> edge) from a single base
 * color, used by the "Spotlight" viewer mode to build a card-colored backdrop.
 *
 * The center is a touch lighter than the base and the edge falls off darker so
 * the card stays the focal point. Pure math — safe on the client.
 */

export interface BackgroundGradientStops {
    center: string
    mid: string
    edge: string
}

interface Rgb {
    r: number
    g: number
    b: number
}

function parseHex(hex: string): Rgb | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
    if (!m) return null
    const int = parseInt(m[1], 16)
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function toHex({ r, g, b }: Rgb): string {
    const h = (v: number) =>
        Math.max(0, Math.min(255, Math.round(v)))
            .toString(16)
            .padStart(2, '0')
    return `#${h(r)}${h(g)}${h(b)}`
}

/** Mix `color` toward `target` (0 = unchanged, 1 = target). */
function mix(color: Rgb, target: Rgb, amount: number): Rgb {
    return {
        r: color.r + (target.r - color.r) * amount,
        g: color.g + (target.g - color.g) * amount,
        b: color.b + (target.b - color.b) * amount
    }
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 0, g: 0, b: 0 }

const FALLBACK: BackgroundGradientStops = {
    center: '#1a1a1d',
    mid: '#121214',
    edge: '#08080a'
}

export function deriveBackgroundGradient(hex: string | undefined | null): BackgroundGradientStops {
    if (!hex) return FALLBACK
    const base = parseHex(hex)
    if (!base) return FALLBACK

    return {
        center: toHex(mix(base, WHITE, 0.12)),
        mid: toHex(base),
        edge: toHex(mix(base, BLACK, 0.45))
    }
}
