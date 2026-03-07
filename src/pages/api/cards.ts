import type { NextApiRequest, NextApiResponse } from 'next'
import type { CardManifest } from '@/types/card'
import { getCards } from '@/lib/cards'

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<CardManifest>
) {
  const manifest = await getCards()

  // If serving stale cache, communicate that via a response header
  if (manifest.source === 'cache') {
    res.setHeader('X-Cards-Source', 'cache')
    res.setHeader('X-Cards-Last-Synced', manifest.lastSynced)
  }

  // Short cache: browsers/CDNs may cache for 60s, but always revalidate
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

  res.status(200).json(manifest)
}
