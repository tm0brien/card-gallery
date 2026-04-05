import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAX_TEXTURE_SIZE = 2048

interface CompositeState {
    canvas: HTMLCanvasElement
    tmpCanvas: HTMLCanvasElement
    texture: THREE.CanvasTexture
    video: HTMLVideoElement
    frontImg: HTMLImageElement
    alphaMask: HTMLCanvasElement | null
    feather: number
}

export function useCompositedVideoTexture(
    videoUrl: string | null,
    frontImageUrl: string,
    maskUrl: string,
    feather: number = 3,
): THREE.CanvasTexture | null {
    const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
    const stateRef = useRef<CompositeState | null>(null)

    useEffect(() => {
        if (!videoUrl) {
            if (stateRef.current) {
                stateRef.current.video.pause()
                stateRef.current.video.src = ''
                stateRef.current.texture.dispose()
                stateRef.current = null
            }
            setTexture(null)
            return
        }

        const canvas = document.createElement('canvas')
        const tmpCanvas = document.createElement('canvas')
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.generateMipmaps = true
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter

        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.playsInline = true
        video.loop = true
        video.src = videoUrl

        let frontImg: HTMLImageElement | null = null
        let alphaMask: HTMLCanvasElement | null = null
        let frontLoaded = false
        let maskDone = false
        let videoReady = false
        let cancelled = false

        const tryFinalize = () => {
            if (cancelled || !frontLoaded || !maskDone || !videoReady || !frontImg) return

            let w = frontImg.naturalWidth
            let h = frontImg.naturalHeight
            if (Math.max(w, h) > MAX_TEXTURE_SIZE) {
                const s = MAX_TEXTURE_SIZE / Math.max(w, h)
                w = Math.round(w * s)
                h = Math.round(h * s)
            }
            canvas.width = w
            canvas.height = h
            tmpCanvas.width = w
            tmpCanvas.height = h

            const ctx = canvas.getContext('2d')!
            ctx.drawImage(frontImg, 0, 0, w, h)
            tex.needsUpdate = true

            const state: CompositeState = {
                canvas, tmpCanvas, texture: tex, video, frontImg, alphaMask, feather,
            }
            stateRef.current = state
            setTexture(tex)
            video.play().catch(() => {})
        }

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            if (cancelled) return
            frontImg = img
            frontLoaded = true
            tryFinalize()
        }
        img.src = frontImageUrl

        const mImg = new Image()
        mImg.crossOrigin = 'anonymous'
        mImg.onload = () => {
            if (cancelled) return
            const c = document.createElement('canvas')
            c.width = mImg.naturalWidth
            c.height = mImg.naturalHeight
            const ctx = c.getContext('2d')!
            ctx.drawImage(mImg, 0, 0)
            const data = ctx.getImageData(0, 0, c.width, c.height)
            for (let i = 0; i < data.data.length; i += 4) {
                data.data[i + 3] = data.data[i]
                data.data[i] = 255
                data.data[i + 1] = 255
                data.data[i + 2] = 255
            }
            ctx.putImageData(data, 0, 0)
            alphaMask = c
            maskDone = true
            tryFinalize()
        }
        mImg.onerror = () => {
            if (cancelled) return
            maskDone = true
            tryFinalize()
        }
        mImg.src = maskUrl

        video.onloadeddata = () => {
            if (cancelled) return
            videoReady = true
            tryFinalize()
        }
        video.load()

        return () => {
            cancelled = true
            video.pause()
            video.src = ''
            tex.dispose()
            if (stateRef.current?.texture === tex) {
                stateRef.current = null
            }
        }
    }, [videoUrl, frontImageUrl, maskUrl, feather])

    useFrame(() => {
        const s = stateRef.current
        if (!s) return

        const { canvas, tmpCanvas, texture: tex, video, frontImg, alphaMask, feather: f } = s
        if (video.paused || video.readyState < 2) return

        const ctx = canvas.getContext('2d')!
        const w = canvas.width
        const h = canvas.height

        ctx.drawImage(frontImg, 0, 0, w, h)

        if (alphaMask) {
            const tc = tmpCanvas.getContext('2d')!
            tc.clearRect(0, 0, w, h)
            tc.drawImage(video, 0, 0, w, h)
            tc.globalCompositeOperation = 'destination-in'
            if (f > 0) tc.filter = `blur(${f}px)`
            tc.drawImage(alphaMask, 0, 0, w, h)
            tc.filter = 'none'
            tc.globalCompositeOperation = 'source-over'
            ctx.drawImage(tmpCanvas, 0, 0)
        } else {
            ctx.drawImage(video, 0, 0, w, h)
        }

        tex.needsUpdate = true
    })

    return texture
}
