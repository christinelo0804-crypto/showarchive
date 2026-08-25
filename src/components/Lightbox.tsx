import { useEffect, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import { ImagePreview } from './ImagePreview'
import type { ImageAsset } from '../types'

export function Lightbox({
  images,
  labels,
  index,
  onChange,
  onClose
}: {
  images: ImageAsset[]
  labels: string[]
  index: number
  onChange: (index: number) => void
  onClose: () => void
}) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const total = images.length
  const currentIndex = Math.max(0, Math.min(index, total - 1))
  const current = images[currentIndex]
  const label = labels[currentIndex] ?? ''

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onChange((currentIndex - 1 + total) % total)
      if (e.key === 'ArrowRight') onChange((currentIndex + 1) % total)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, onChange, currentIndex, total])

  if (!current) return null

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    setDragging(true)
    setDragX(0)
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > Math.abs(dy)) setDragX(dx)
  }

  function handleTouchEnd() {
    if (!touchStart.current) return
    if (dragX < -60 && currentIndex < total - 1) onChange(currentIndex + 1)
    else if (dragX > 60 && currentIndex > 0) onChange(currentIndex - 1)
    touchStart.current = null
    setDragging(false)
    setDragX(0)
  }

  return (
    <div className="lightbox" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            className="lightbox-nav lightbox-prev"
            onClick={(e) => {
              e.stopPropagation()
              onChange((currentIndex - 1 + total) % total)
            }}
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox-nav lightbox-next"
            onClick={(e) => {
              e.stopPropagation()
              onChange((currentIndex + 1) % total)
            }}
            aria-label="下一张"
          >
            ›
          </button>
          <span className="lightbox-count">
            {currentIndex + 1} / {total}
          </span>
        </>
      )}
      <div
        className="lightbox-stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="lightbox-slide"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? 'none' : 'transform 0.25s ease'
          }}
        >
          <ImagePreview asset={current} alt={label} className="lightbox-img" />
        </div>
      </div>
      {total > 1 && <span className="lightbox-label">{label}</span>}
    </div>
  )
}
