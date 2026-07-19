import { useEffect, useRef } from 'react'

interface MaskPreviewProps {
    title: string
    imageData: ImageData | null
    /** Show an alpha checkerboard behind the canvas (for RGBA textures). */
    alphaBackground?: boolean
    note?: string
}

/** One labelled canvas tile in the diagnostic grid. */
export default function MaskPreview({ title, imageData, alphaBackground = false, note }: MaskPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !imageData) return
        canvas.width = imageData.width
        canvas.height = imageData.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.putImageData(imageData, 0, 0)
    }, [imageData])

    return (
        <figure className="maskPreview">
            <figcaption>
                <strong>{title}</strong>
                {note ? <span className="maskPreviewNote"> {note}</span> : null}
            </figcaption>
            <div className={alphaBackground ? 'maskPreviewCanvasWrap alphaChecker' : 'maskPreviewCanvasWrap'}>
                {imageData ? <canvas ref={canvasRef} /> : <div className="maskPreviewEmpty">processing…</div>}
            </div>
            <style jsx>{`
                .maskPreview {
                    margin: 0;
                    min-width: 0;
                }
                figcaption {
                    font-size: 12px;
                    color: #c8c3ba;
                    margin-bottom: 6px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .maskPreviewNote {
                    color: #7d786f;
                }
                .maskPreviewCanvasWrap {
                    border: 1px solid #2c2a26;
                    border-radius: 4px;
                    overflow: hidden;
                    line-height: 0;
                }
                .maskPreviewCanvasWrap.alphaChecker {
                    background: repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 20px 20px;
                }
                canvas {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .maskPreviewEmpty {
                    padding: 40px 0;
                    text-align: center;
                    color: #6b665e;
                    font-size: 12px;
                    line-height: 1.4;
                }
            `}</style>
        </figure>
    )
}
