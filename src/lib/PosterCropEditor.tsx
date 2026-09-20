import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { DEFAULT_CROP, autoCropMode, posterRatio } from '../lib/posterCrop'
import type { ImageAsset, PosterCrop } from '../types'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 海报裁切编辑器：框内就是网格里实际可见的范围。
 * 拖动移动、滑杆缩放，可切换「裁切填充 / 完整显示」；「还原默认」恢复自动规则。
 */
export function PosterCropEditor({
  url,
  poster,
  initial,
  onCancel,
  onApply
}: {
  url: string
  poster?: ImageAsset
  /** 已有的手动裁切设置；为空表示当前按自动规则 */
  initial: PosterCrop | null
  onCancel: () => void
  onApply: (crop: PosterCrop | null) => void
}) {
  const ratio = posterRatio(poster)
  const auto: PosterCrop = { ...DEFAULT_CROP, mode: autoCropMode(poster) }
  const [crop, setCrop] = useState<PosterCrop>(initial ?? auto)
  const [followingAuto, setFollowingAuto] = useState(initial == null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const isFit = crop.mode === 'fit'
  const landscape = ratio > 1

  function update(next: Partial<PosterCrop>) {
    setFollowingAuto(false)
    setCrop((prev) => ({ ...prev, ...next }))
  }

  function imageStyle(value: PosterCrop) {
    return {
      objectFit: value.mode === 'fit' ? ('contain' as const) : ('cover' as const),
      objectPosition: `${value.x}% ${value.y}%`,
      transform: value.scale !== 1 ? `scale(${value.scale})` : undefined
    }
  }

  /**
   * 当前模式下图拖进框体后的实际尺寸：
   * cover 铺满框体（可平移的范围最大）；fit 完整放下（放大后同样可平移）。
   */
  function baseSize(mode: PosterCrop['mode'], boxRatio: number, width: number, height: number) {
    const widerThanBox = ratio >= boxRatio
    if (mode === 'cover') {
      return widerThanBox
        ? { width: height * ratio, height }
        : { width, height: width / ratio }
    }
    return widerThanBox
      ? { width, height: width / ratio }
      : { width: height * ratio, height }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const frame = frameRef.current
    if (!drag || !frame) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    dragRef.current = { x: event.clientX, y: event.clientY }

    const width = frame.clientWidth
    const height = frame.clientHeight
    const boxRatio = width / height
    const base = baseSize(crop.mode, boxRatio, width, height)
    const overflowX = Math.max(0, base.width * crop.scale - width)
    const overflowY = Math.max(0, base.height * crop.scale - height)

    setFollowingAuto(false)
    setCrop((prev) => ({
      ...prev,
      x: overflowX > 1 ? clamp(prev.x - (dx / overflowX) * 100, 0, 100) : prev.x,
      y: overflowY > 1 ? clamp(prev.y - (dy / overflowY) * 100, 0, 100) : prev.y
    }))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  return (
    <div className="crop-editor" role="dialog" aria-label="调整海报裁切">
      <div className="crop-editor-head">
        <h3>调整海报裁切</h3>
        <button type="button" className="close-btn" onClick={onCancel} aria-label="关闭">
          ×
        </button>
      </div>

      <div className="crop-editor-body">
        <div
          className={`crop-frame${isFit ? ' crop-frame-fit' : ''}`}
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {isFit && <img className="crop-blur" src={url} alt="" aria-hidden="true" draggable={false} />}
          <img className="crop-image" src={url} alt="" style={imageStyle(crop)} draggable={false} />
          <span className="crop-thirds" aria-hidden="true" />
        </div>
        <p className="crop-hint">
          {isFit
            ? '完整显示：海报不裁切、上下用模糊放大版填充；放大后可用拖动微调'
            : '裁切填充：框内即网格中的可见范围，拖动移动 · 滑杆缩放'}
        </p>
      </div>

      <div className="crop-editor-controls">
        <div className="panel-seg">
          <button type="button" className={!isFit ? 'on' : ''} onClick={() => update({ mode: 'cover' })}>
            裁切填充
          </button>
          <button type="button" className={isFit ? 'on' : ''} onClick={() => update({ mode: 'fit' })}>
            完整显示
          </button>
        </div>

        <div className="crop-chips">
          {isFit ? (
            <span className="crop-chips-note">完整显示无需定位</span>
          ) : landscape ? (
              <>
                <button type="button" className={crop.x === 0 ? 'crop-chip on' : 'crop-chip'} onClick={() => update({ x: 0 })}>
                  左
                </button>
                <button type="button" className={crop.x === 50 ? 'crop-chip on' : 'crop-chip'} onClick={() => update({ x: 50 })}>
                  中
                </button>
                <button type="button" className={crop.x === 100 ? 'crop-chip on' : 'crop-chip'} onClick={() => update({ x: 100 })}>
                  右
                </button>
              </>
            ) : (
              <>
                <button type="button" className={crop.y === 0 ? 'crop-chip on' : 'crop-chip'} onClick={() => update({ y: 0 })}>
                  上
                </button>
                <button type="button" className={crop.y === 50 ? 'crop-chip on' : 'crop-chip'} onClick={() => update({ y: 50 })}>
                  中
                </button>
                <button type="button" className={crop.y === 100 ? 'crop-chip on' : 'crop-chip'} onClick={() => update({ y: 100 })}>
                  下
                </button>
              </>
          )}
          <button
            type="button"
            className={followingAuto ? 'crop-chip on' : 'crop-chip'}
            onClick={() => {
              setFollowingAuto(true)
              setCrop(auto)
            }}
          >
            还原默认
          </button>
        </div>

        <div className="crop-slider">
          <span>缩放</span>
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={crop.scale}
            onChange={(e) => update({ scale: Number(e.target.value) })}
            aria-label="缩放"
          />
          <span className="crop-scale-value">{Math.round(crop.scale * 100)}%</span>
        </div>
      </div>

      <div className="crop-editor-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(followingAuto ? null : crop)}>
          完成
        </button>
      </div>
    </div>
  )
}
