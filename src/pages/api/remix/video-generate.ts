import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY,
})

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

interface VideoRemixRequest {
  cardId: string
  prompt: string
  duration?: '5' | '10'
  loop?: boolean
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { cardId, prompt, duration = '5', loop = false } = req.body as VideoRemixRequest

  if (!cardId || !prompt) {
    return res.status(400).json({ error: 'cardId and prompt are required' })
  }

  const frontPath = path.join(ASSETS_DIR, cardId, 'front.png')
  if (!fs.existsSync(frontPath)) {
    return res.status(404).json({ error: 'Card front image not found' })
  }

  try {
    const resized = await sharp(frontPath)
      .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()
    const blob = new Blob([new Uint8Array(resized)], { type: 'image/jpeg' })
    const uploadedUrl = await fal.storage.upload(blob)

    const input = {
      prompt,
      image_url: uploadedUrl,
      duration,
      negative_prompt: 'blur, distort, low quality, face change, color shift',
      ...(loop ? { tail_image_url: uploadedUrl } : {}),
    }

    const result = await fal.subscribe('fal-ai/kling-video/v2.5-turbo/pro/image-to-video', {
      input,
    })

    const data = result.data as { video: { url: string } }
    if (!data.video?.url) {
      return res.status(500).json({ error: 'No video returned from model' })
    }

    return res.status(200).json({ videoUrl: data.video.url })
  } catch (err: any) {
    const detail = err?.body?.detail ?? err?.body ?? err?.message ?? err
    console.error('[remix/video-generate] Error:', JSON.stringify(detail, null, 2))
    const message = typeof detail === 'string' ? detail : 'Failed to generate video'
    return res.status(500).json({ error: message, detail })
  }
}
