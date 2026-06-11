import fs from 'fs'
import path from 'path'

export type ImageOrientation = 'portrait' | 'landscape'

/** Read width/height from a PNG's IHDR chunk (bytes 16–23). */
export function readPngDimensions(filePath: string): { width: number; height: number } | undefined {
  if (!fs.existsSync(filePath)) return undefined
  try {
    const buf = Buffer.alloc(24)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buf, 0, 24, 0)
    fs.closeSync(fd)
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    }
  } catch {
    return undefined
  }
}

export function orientationFromDimensions(
  width: number,
  height: number
): ImageOrientation {
  return width > height ? 'landscape' : 'portrait'
}

export function detectImageOrientation(filePath: string): ImageOrientation | undefined {
  const dims = readPngDimensions(filePath)
  if (!dims) return undefined
  return orientationFromDimensions(dims.width, dims.height)
}

/** Orientation derived from front.png under public/assets/{id}/. */
export function detectFrontOrientation(
  assetsDir: string,
  id: string
): ImageOrientation | undefined {
  return detectImageOrientation(path.join(assetsDir, id, 'front.png'))
}
