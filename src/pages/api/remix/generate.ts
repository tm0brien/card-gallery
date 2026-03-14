import type { NextApiRequest, NextApiResponse } from 'next'
import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

fal.config({
  credentials: process.env.FAL_KEY,
})

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

interface RemixRequest {
  cardId: string
  prompt: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { cardId, prompt } = req.body as RemixRequest

  if (!cardId || !prompt) {
    return res.status(400).json({ error: 'cardId and prompt are required' })
  }

  const cardDir = path.join(ASSETS_DIR, cardId)
  const maskPath = path.join(cardDir, 'mask.png')
  const frontPath = path.join(cardDir, 'front.png')

  if (!fs.existsSync(frontPath)) {
    return res.status(404).json({ error: 'Card front image not found' })
  }
  if (!fs.existsSync(maskPath)) {
    return res.status(404).json({ error: 'Mask not found — create one first' })
  }

  const frontBase64 = `data:image/png;base64,${fs.readFileSync(frontPath).toString('base64')}`
  const maskBase64 = `data:image/png;base64,${fs.readFileSync(maskPath).toString('base64')}`

  try {
    const result = await fal.subscribe('fal-ai/flux-lora/inpainting', {
      input: {
        prompt,
        image_url: frontBase64,
        mask_url: maskBase64,
        strength: 0.95,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        output_format: 'png',
      },
    })

    const data = result.data as { images: { url: string }[] }
    if (!data.images?.length) {
      return res.status(500).json({ error: 'No image returned from model' })
    }

    return res.status(200).json({ imageUrl: data.images[0].url })
  } catch (err) {
    console.error('[remix/generate] Inpainting error:', err)
    return res.status(500).json({ error: 'Failed to generate remix' })
  }
}
