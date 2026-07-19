import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useRef } from 'react'

import { clamp } from '../../slab-extraction/color'
import type { NormalizedRect } from '../../slab-extraction/types'

type RegionId = 'card' | 'label'
type HandleId = 'nw' | 'ne' | 'sw' | 'se'

interface ProtectedRegionEditorProps {
    imageUrl: string
    /** Natural aspect ratio (width / height) of the source image. */
    aspect: number
    cardRect: NormalizedRect
    labelRect: NormalizedRect
    showOverlay: boolean
    onChange: (region: RegionId, rect: NormalizedRect) => void
}

interface DragState {
    region: RegionId
    handle: HandleId | 'move'
    startX: number
    startY: number
    startRect: NormalizedRect
}

const MIN_SIZE = 0.02

const REGION_COLORS: Record<RegionId, string> = {
    card: '#38bdf8',
    label: '#fbbf24'
}

/**
 * Visual editor for the protected card/label rectangles. Drag a rect body to
 * move it, drag a corner handle to resize. All coordinates are normalized
 * [0,1] relative to the source image.
 */
export default function ProtectedRegionEditor({
    imageUrl,
    aspect,
    cardRect,
    labelRect,
    showOverlay,
    onChange
}: ProtectedRegionEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<DragState | null>(null)

    const beginDrag = useCallback(
        (event: ReactPointerEvent, region: RegionId, handle: HandleId | 'move') => {
            event.preventDefault()
            event.stopPropagation()
            ;(event.target as Element).setPointerCapture(event.pointerId)
            dragRef.current = {
                region,
                handle,
                startX: event.clientX,
                startY: event.clientY,
                startRect: region === 'card' ? { ...cardRect } : { ...labelRect }
            }
        },
        [cardRect, labelRect]
    )

    const onPointerMove = useCallback(
        (event: ReactPointerEvent) => {
            const drag = dragRef.current
            const container = containerRef.current
            if (!drag || !container) return
            const bounds = container.getBoundingClientRect()
            const dx = (event.clientX - drag.startX) / bounds.width
            const dy = (event.clientY - drag.startY) / bounds.height
            const start = drag.startRect
            let next: NormalizedRect

            if (drag.handle === 'move') {
                next = {
                    x: clamp(start.x + dx, 0, 1 - start.width),
                    y: clamp(start.y + dy, 0, 1 - start.height),
                    width: start.width,
                    height: start.height
                }
            } else {
                let left = start.x
                let top = start.y
                let right = start.x + start.width
                let bottom = start.y + start.height
                if (drag.handle === 'nw' || drag.handle === 'sw') left = clamp(left + dx, 0, right - MIN_SIZE)
                if (drag.handle === 'ne' || drag.handle === 'se') right = clamp(right + dx, left + MIN_SIZE, 1)
                if (drag.handle === 'nw' || drag.handle === 'ne') top = clamp(top + dy, 0, bottom - MIN_SIZE)
                if (drag.handle === 'sw' || drag.handle === 'se') bottom = clamp(bottom + dy, top + MIN_SIZE, 1)
                next = { x: left, y: top, width: right - left, height: bottom - top }
            }
            onChange(drag.region, next)
        },
        [onChange]
    )

    const endDrag = useCallback(() => {
        dragRef.current = null
    }, [])

    const renderRegion = (region: RegionId, rect: NormalizedRect) => {
        const color = REGION_COLORS[region]
        const style: CSSProperties = {
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${rect.height * 100}%`,
            borderColor: color
        }
        const handles: Array<{ id: HandleId; style: CSSProperties }> = [
            { id: 'nw', style: { left: 0, top: 0, cursor: 'nwse-resize' } },
            { id: 'ne', style: { right: 0, top: 0, cursor: 'nesw-resize' } },
            { id: 'sw', style: { left: 0, bottom: 0, cursor: 'nesw-resize' } },
            { id: 'se', style: { right: 0, bottom: 0, cursor: 'nwse-resize' } }
        ]
        return (
            <div
                key={region}
                className="region"
                style={style}
                onPointerDown={e => beginDrag(e, region, 'move')}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <span className="regionLabel" style={{ background: color }}>
                    {region}
                </span>
                {handles.map(h => (
                    <span
                        key={h.id}
                        className="handle"
                        style={{ ...h.style, background: color }}
                        onPointerDown={e => beginDrag(e, region, h.id)}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                    />
                ))}
                <style jsx>{`
                    .region {
                        position: absolute;
                        border: 2px solid;
                        border-radius: 2px;
                        cursor: move;
                        touch-action: none;
                        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
                    }
                    .regionLabel {
                        position: absolute;
                        top: -1px;
                        left: -1px;
                        font-size: 10px;
                        line-height: 1;
                        padding: 3px 5px;
                        color: #111;
                        font-weight: 700;
                        text-transform: uppercase;
                        border-radius: 0 0 3px 0;
                        pointer-events: none;
                    }
                    .handle {
                        position: absolute;
                        width: 12px;
                        height: 12px;
                        margin: -6px;
                        border-radius: 50%;
                        border: 2px solid #111;
                        touch-action: none;
                    }
                `}</style>
            </div>
        )
    }

    return (
        <div ref={containerRef} className="editor" style={{ aspectRatio: `${aspect}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Source scan" draggable={false} />
            {showOverlay ? (
                <>
                    {renderRegion('card', cardRect)}
                    {renderRegion('label', labelRect)}
                </>
            ) : null}
            <style jsx>{`
                .editor {
                    position: relative;
                    width: 100%;
                    border: 1px solid #2c2a26;
                    border-radius: 4px;
                    overflow: hidden;
                    user-select: none;
                }
                img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                    pointer-events: none;
                }
            `}</style>
        </div>
    )
}
