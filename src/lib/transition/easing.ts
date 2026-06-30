// CSS-style cubic-bezier easing evaluation, plus small interpolation helpers.
// No animation library is used; transitions are driven by useFrame + refs, so
// these pure functions turn MotionConfig's [x1, y1, x2, y2] tuples into an
// ease(t) curve we can sample each frame.

export type CubicBezier = [number, number, number, number]

export function clamp01(t: number): number {
    if (t < 0) return 0
    if (t > 1) return 1
    return t
}

export function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t
}

// Standard easings used as fallbacks / for the asymmetric exit curve.
export function easeInCubic(t: number): number {
    const x = clamp01(t)
    return x * x * x
}

export function easeOutCubic(t: number): number {
    const x = clamp01(t)
    const inv = 1 - x
    return 1 - inv * inv * inv
}

// Build a function that evaluates a cubic-bezier easing curve, matching the CSS
// timing-function semantics where the curve passes through (0,0) and (1,1) with
// the two provided control points. Uses Newton-Raphson with a bisection
// fallback to invert x(t) -> t, then returns y(t). The solver is created once
// per curve so the per-frame call stays cheap.
export function cubicBezier([x1, y1, x2, y2]: CubicBezier): (t: number) => number {
    // Linear shortcut (also avoids divide-by-zero in the solver).
    if (x1 === y1 && x2 === y2) {
        return (t: number) => clamp01(t)
    }

    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx

    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by

    const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
    const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
    const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

    const solveForT = (x: number) => {
        let t = x
        for (let i = 0; i < 8; i++) {
            const xEstimate = sampleX(t) - x
            if (Math.abs(xEstimate) < 1e-6) return t
            const derivative = sampleDerivativeX(t)
            if (Math.abs(derivative) < 1e-6) break
            t -= xEstimate / derivative
        }

        // Bisection fallback for poorly-conditioned regions.
        let low = 0
        let high = 1
        t = x
        while (low < high) {
            const xEstimate = sampleX(t)
            if (Math.abs(xEstimate - x) < 1e-6) return t
            if (x > xEstimate) low = t
            else high = t
            t = (high + low) / 2
        }
        return t
    }

    return (t: number) => {
        const x = clamp01(t)
        if (x === 0 || x === 1) return x
        return sampleY(solveForT(x))
    }
}
