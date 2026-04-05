import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { ensureRemixesDir, appendToManifest } from '../../../lib/remixes'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { cardId, imageUrl, prompt = '' } = req.body as {
    cardId: string
    imageUrl: string
    prompt?: string
  }

  if (!cardId || !imageUrl) {
    return res.status(400).json({ error: 'cardId and imageUrl are required' })
  }

  const cardDir = path.join(ASSETS_DIR, cardId)
  if (!fs.existsSync(cardDir)) {
    return res.status(404).json({ error: 'Card asset directory not found' })
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const id = String(Date.now())
    const filename = `${id}-image.png`
    const remixesDir = ensureRemixesDir(cardId)
    fs.writeFileSync(path.join(remixesDir, filename), buffer)

    appendToManifest(cardId, {
      id,
      type: 'image',
      filename,
      prompt,
      createdAt: new Date().toISOString(),
    })

    return res.status(200).json({
      saved: true,
      path: `/assets/${cardId}/remixes/${filename}`,
      id,
    })
  } catch (err) {
    console.error('[remix/save] Error:', err)
    return res.status(500).json({ error: 'Failed to save remix' })
  }
}
