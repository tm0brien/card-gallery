/**
 * Admin gating for the authoring experience (/admin and /api/admin/*).
 *
 * Default policy is local-first: admin is enabled when running outside a
 * production build, or when the request targets a localhost host. The
 * structure also supports a future password by setting the ADMIN_TOKEN env
 * var — when present, a matching `admin_token` cookie or `x-admin-token`
 * header unlocks admin even in production. This lets a deployed instance be
 * opened up later without refactoring callers.
 *
 * Server-side only.
 */

import type { IncomingMessage } from 'http'
import type { NextApiRequest } from 'next'

type AdminRequest = NextApiRequest | (IncomingMessage & { headers: IncomingMessage['headers'] })

function hostIsLocal(host: string | undefined): boolean {
    if (!host) return false
    const name = host.split(':')[0].toLowerCase()
    return name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name === '::1'
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null
    for (const part of cookieHeader.split(';')) {
        const [k, ...rest] = part.trim().split('=')
        if (k === name) return decodeURIComponent(rest.join('='))
    }
    return null
}

export function isAdminAllowed(req: AdminRequest): boolean {
    // Local development: always allowed.
    if (process.env.NODE_ENV !== 'production') return true

    // Local host (e.g. running `next start` on the machine): allowed.
    if (hostIsLocal(req.headers.host)) return true

    // Optional shared token for a deployed instance (disabled unless set).
    const token = process.env.ADMIN_TOKEN
    if (token) {
        const headerToken = req.headers['x-admin-token']
        const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken
        const cookieValue = readCookie(req.headers.cookie, 'admin_token')
        if (headerValue === token || cookieValue === token) return true
    }

    return false
}
