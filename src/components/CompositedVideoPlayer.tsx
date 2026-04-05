import { useCallback, useEffect, useRef, useState } from 'react'

interface CompositedVideoPlayerProps {
  cardId: string
  imageUrl: string
  videoUrl: string
  feather?: number
  autoPlay?: boolean
  className?: string
  canvasClassName?: string
  style?: React.CSSProperties
}

export default function CompositedVideoPlayer({
  cardId,
  imageUrl,
  videoUrl,
  feather = 3,
  autoPlay = false,
  className,
  canvasClassName,
  style,
}: CompositedVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frontImgRef = useRef<HTMLImageElement | null>(null)
  const alphaMaskRef = useRef<HTMLCanvasElement | null>(null)
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)

  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('auto')

  // Load front image and mask
  useEffect(() => {
    let frontLoaded = false
    let maskLoaded = false

    const checkReady = () => {
      if (frontLoaded && maskLoaded) setReady(true)
    }

    const frontImg = new Image()
    frontImg.crossOrigin = 'anonymous'
    frontImg.onload = () => {
      frontImgRef.current = frontImg
      setAspectRatio(`${frontImg.naturalWidth} / ${frontImg.naturalHeight}`)
      frontLoaded = true
      checkReady()
    }
    frontImg.src = imageUrl

    const maskImg = new Image()
    maskImg.crossOrigin = 'anonymous'
    maskImg.onload = () => {
      const c = document.createElement('canvas')
      c.width = maskImg.naturalWidth
      c.height = maskImg.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(maskImg, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i + 3] = data.data[i]
        data.data[i] = 255
        data.data[i + 1] = 255
        data.data[i + 2] = 255
      }
      ctx.putImageData(data, 0, 0)
      alphaMaskRef.current = c
      maskLoaded = true
      checkReady()
    }
    maskImg.onerror = () => {
      maskLoaded = true
      checkReady()
    }
    maskImg.src = `/assets/${cardId}/mask.png`
  }, [cardId, imageUrl])

  const drawStaticFrame = useCallback(() => {
    const canvas = canvasRef.current
    const front = frontImgRef.current
    if (!canvas || !front) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.drawImage(front, 0, 0, rect.width, rect.height)
  }, [])

  useEffect(() => {
    if (ready) drawStaticFrame()
  }, [ready, drawStaticFrame])

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    const front = frontImgRef.current
    const alphaMask = alphaMaskRef.current
    if (!canvas || !video || !front) return

    if (video.paused || video.ended) {
      setPlaying(false)
      return
    }

    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const dw = rect.width
    const dh = rect.height

    ctx.drawImage(front, 0, 0, dw, dh)

    if (alphaMask) {
      if (!tmpCanvasRef.current) {
        tmpCanvasRef.current = document.createElement('canvas')
      }
      const tmp = tmpCanvasRef.current
      tmp.width = canvas.width
      tmp.height = canvas.height
      const tc = tmp.getContext('2d')!
      tc.setTransform(dpr, 0, 0, dpr, 0, 0)

      tc.clearRect(0, 0, dw, dh)
      tc.drawImage(video, 0, 0, dw, dh)
      tc.globalCompositeOperation = 'destination-in'
      if (feather > 0) {
        tc.filter = `blur(${feather}px)`
      }
      tc.drawImage(alphaMask, 0, 0, dw, dh)
      tc.filter = 'none'
      tc.globalCompositeOperation = 'source-over'

      ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height, 0, 0, dw, dh)
    } else {
      ctx.drawImage(video, 0, 0, dw, dh)
    }

    rafRef.current = requestAnimationFrame(renderFrame)
  }, [feather])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(renderFrame)
    } else {
      video.pause()
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
    }
  }

  const handleVideoEnded = () => {
    cancelAnimationFrame(rafRef.current)
    const video = videoRef.current
    if (video) {
      video.currentTime = 0
      video.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(renderFrame)
    }
  }

  const handleVideoReady = () => {
    drawStaticFrame()
    if (autoPlay) {
      videoRef.current?.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(renderFrame)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        style={{ display: 'block', width: '100%', aspectRatio, cursor: 'pointer' }}
        onClick={togglePlay}
      />
      {!playing && ready && (
        <button
          onClick={togglePlay}
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            lineHeight: 1,
          }}
        >
          ▶
        </button>
      )}
      <video
        ref={videoRef}
        src={videoUrl}
        crossOrigin="anonymous"
        muted
        playsInline
        onEnded={handleVideoEnded}
        onLoadedData={handleVideoReady}
        style={{ display: 'none' }}
      />
    </div>
  )
}
