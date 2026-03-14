import type { NextApiRequest, NextApiResponse } from 'next'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY,
})

interface PointPrompt {
  x: number
  y: number
  label: 0 | 1
}

interface GenerateRequest {
  imageUrl: string
  points: PointPrompt[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageUrl, points } = req.body as GenerateRequest

  if (!imageUrl || !points?.length) {
    return res.status(400).json({ error: 'imageUrl and points are required' })
  }

  try {
    const result = await fal.subscribe('fal-ai/sam2/image', {
      input: {
        image_url: imageUrl,
        prompts: points.map((p) => ({ x: p.x, y: p.y, label: String(p.label) as '0' | '1' })),
        output_format: 'png',
      },
    })

    const data = result.data as { image: { url: string } }
    return res.status(200).json({ maskUrl: data.image.url })
  } catch (err) {
    console.error('[mask/generate] SAM error:', err)
    return res.status(500).json({ error: 'Failed to generate mask' })
  }
}
