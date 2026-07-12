import type { NextApiRequest, NextApiResponse } from 'next'

import { isRemixEffectStyle } from '@/config/appSettings'
import { isAdminAllowed } from '@/lib/adminAuth'
import { writeAppSettings } from '@/lib/appSettings'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!isAdminAllowed(req)) {
        return res.status(404).json({ error: 'Not found' })
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body as { remixEffectStyle?: unknown }

    if (!isRemixEffectStyle(body.remixEffectStyle)) {
        return res.status(400).json({ error: 'remixEffectStyle must be "holo" or "arcane"' })
    }

    try {
        const settings = writeAppSettings({ remixEffectStyle: body.remixEffectStyle })
        return res.status(200).json({ saved: true, settings })
    } catch (err) {
        console.error('[admin/app-settings] Error:', err)
        return res.status(500).json({ error: 'Failed to save app settings' })
    }
}
