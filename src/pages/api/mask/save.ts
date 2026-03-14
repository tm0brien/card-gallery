import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { cardId, maskUrl } = req.body as { cardId: string; maskUrl: string }

  if (!cardId || !maskUrl) {
    return res.status(400).json({ error: 'cardId and maskUrl are required' })
  }

  const cardDir = path.join(ASSETS_DIR, cardId)
  if (!fs.existsSync(cardDir)) {
    return res.status(404).json({ error: 'Card asset directory not found' })
  }

  try {
    const response = await fetch(maskUrl)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const maskPath = path.join(cardDir, 'mask.png')
    fs.writeFileSync(maskPath, buffer)

    return res.status(200).json({ saved: true, path: `/assets/${cardId}/mask.png` })
  } catch (err) {
    console.error('[mask/save] Error:', err)
    return res.status(500).json({ error: 'Failed to save mask' })
  }
}
