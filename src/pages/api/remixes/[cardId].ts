import type { NextApiRequest, NextApiResponse } from 'next'
import { readManifest } from '../../../lib/remixes'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cardId = req.query.cardId as string
  if (!cardId) {
    return res.status(400).json({ error: 'cardId is required' })
  }

  const remixes = readManifest(cardId)
  return res.status(200).json({ remixes })
}
