import type { NextApiRequest, NextApiResponse } from 'next'

import { isAdminAllowed } from '@/lib/adminAuth'
import { extractColorCandidates } from '@/lib/colorExtraction'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!isAdminAllowed(req)) {
        return res.status(404).json({ error: 'Not found' })
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const cardId = req.query.cardId as string
    if (!cardId) {
        return res.status(400).json({ error: 'cardId is required' })
    }

    try {
        const candidates = await extractColorCandidates(cardId)
        return res.status(200).json({ candidates })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to extract colors'
        if (message.includes('not found')) {
            return res.status(404).json({ error: message })
        }
        console.error('[admin/colors] Error:', err)
        return res.status(500).json({ error: 'Failed to extract colors' })
    }
}
