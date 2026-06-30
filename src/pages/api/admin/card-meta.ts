import type { NextApiRequest, NextApiResponse } from 'next'

import { isAdminAllowed } from '@/lib/adminAuth'
import { writeOverride } from '@/lib/cardOverrides'
import type { CardOverride } from '@/types/card'

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!isAdminAllowed(req)) {
        return res.status(404).json({ error: 'Not found' })
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { cardId, backgroundColor, defaultRemixId, defaultRemixFilename } = req.body as {
        cardId?: string
        backgroundColor?: string | null
        defaultRemixId?: string | null
        defaultRemixFilename?: string | null
    }

    if (!cardId) {
        return res.status(400).json({ error: 'cardId is required' })
    }

    const patch: CardOverride = {}

    // `backgroundColor` present in the body means "set or clear it".
    if ('backgroundColor' in req.body) {
        if (backgroundColor && !HEX_PATTERN.test(backgroundColor)) {
            return res.status(400).json({ error: 'backgroundColor must be a #rrggbb hex string' })
        }
        patch.backgroundColor = backgroundColor ?? undefined
    }

    if ('defaultRemixId' in req.body) {
        patch.defaultRemixId = defaultRemixId ?? undefined
    }
    if ('defaultRemixFilename' in req.body) {
        patch.defaultRemixFilename = defaultRemixFilename ?? undefined
    }

    try {
        const entry = writeOverride(cardId, patch)
        return res.status(200).json({ saved: true, override: entry })
    } catch (err) {
        console.error('[admin/card-meta] Error:', err)
        return res.status(500).json({ error: 'Failed to save card metadata' })
    }
}
