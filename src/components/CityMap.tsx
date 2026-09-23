import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { WORLD_LAND_PATH } from '../lib/worldMapPath'
import {
  MAP_CARD_ASPECT,
  MAP_DEFAULT_VIEW,
  MAP_WORLD_VIEW,
  cityMapPoint,
  panMapView,
  zoomMapView
} from '../lib/mapGeo'
import type { MapCity, MapView } from '../lib/mapGeo'

export interface CityMapPoint {
  city: MapCity
  count: number
}

/** 圆点基准直径（px），分档在此基础上放大 */
const DOT_BASE_SIZE = 14

/**
 * 按场次分四档：点越大越亮；4 场以上额外带外发光。
 * 地图上的圆点与下方图例都从这里取数值，保证两边永远一致。
 */
export const DOT_TIERS = [
  { label: '1 场', scale: 0.85, opacity: 0.62, glow: false },
  { label: '2–3 场', scale: 1.1, opacity: 0.85, glow: false },
  { label: '4–6 场', scale: 1.3, opacity: 1, glow: true },
  { label: '7 场以上', scale: 1.55, opacity: 1, glow: true }
] as const

/** 某个场次对应的圆点样式 */
export function dotTierOf(count: number) {
  if (count >= 7) return DOT_TIERS[3]
  if (count >= 4) return DOT_TIERS[2]
  if (count >= 2) return DOT_TIERS[1]
  return DOT_TIERS[0]
}

/** 拖动超过这个像素数就算「拖动」而不是「点击」 */
const TAP_SLOP = 6
/** 双击间隔 */
const DOUBLE_TAP_MS = 320
/** 双击切换视图的补间时长（偏长，让后半段的「慢」看得见；曲线不变时加长＝慢段变长） */
const ZOOM_ANIMATION_MS = 640

export function CityMap({
  points,
  onSelect
}: {
  points: CityMapPoint[]
  onSelect: (city: MapCity) => void
}) {
  const [view, setView] = useState<MapView>(MAP_DEFAULT_VIEW)
  const [worldView, setWorldView] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ view: MapView; distance: number; moved: boolean } | null>(null)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  function stopAnimation() {
    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  /**
   * 视图补间：双击在中国内地与世界之间切换时用，手势（缩放/拖动）不做补间。
   * 关键点一：按「缩放级别」也就是宽高的**对数**插值。
   * 直接对宽度做缓动的话，6.5 倍的缩放会在头几帧就走完大半，肉眼看起来像瞬间切换；
   * 取对数后每一帧的缩放倍率才是均匀的。
   * 关键点二：缓动用 easeOutQuad 而不是 easeOutCubic——
   * 三次以上的 easeOut 在结尾速率会衰减到接近 0（最后一段时间几乎不动），
   * 二次曲线收尾仍保持约 1/10 的起始速率，所以「先快后慢」的慢段是真的看得见。
   */
  function animateViewTo(target: MapView) {
    stopAnimation()
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setView(target)
      return
    }
    const from = view
    const wFrom = Math.log(from.w)
    const wTo = Math.log(target.w)
    const hFrom = Math.log(from.h)
    const hTo = Math.log(target.h)
    const cxFrom = from.x + from.w / 2
    const cyFrom = from.y + from.h / 2
    const cxTo = target.x + target.w / 2
    const cyTo = target.y + target.h / 2
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_ANIMATION_MS)
      // easeOutQuad：先快后慢，且收尾仍在移动
      const k = 1 - (1 - t) * (1 - t)
      const w = Math.exp(wFrom + (wTo - wFrom) * k)
      const h = Math.exp(hFrom + (hTo - hFrom) * k)
      const cx = cxFrom + (cxTo - cxFrom) * k
      const cy = cyFrom + (cyTo - cyFrom) * k
      setView({
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h
      })
      animationRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    animationRef.current = requestAnimationFrame(step)
  }

  /**
   * 视图在卡片里的实际缩放与偏移：卡片长宽比固定，视图用 meet 居中，
   * 因此比卡片更「扁」的视图（例如世界视图）会上下留边。
   */
  function layoutOf(current: MapView) {
    const scale = Math.min(1 / current.w, MAP_CARD_ASPECT / current.h)
    const contentW = current.w * scale
    const contentH = current.h * scale
    return { scale, contentW, contentH, offsetX: (1 - contentW) / 2, offsetY: (MAP_CARD_ASPECT - contentH) / 2 }
  }

  /** 画布像素 → 地图坐标（考虑留边） */
  function toMapPoint(e: ReactPointerEvent<Element>, rect: DOMRect, current: MapView) {
    const { scale, offsetX, offsetY } = layoutOf(current)
    return {
      x: current.x + ((e.clientX - rect.left) / rect.width - offsetX) / scale,
      y: current.y + (((e.clientY - rect.top) / rect.height) * MAP_CARD_ASPECT - offsetY) / scale
    }
  }

  function toggleWorldView() {
    const next = !worldView
    setWorldView(next)
    animateViewTo(next ? MAP_WORLD_VIEW : MAP_DEFAULT_VIEW)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // 手势优先：一旦按下就停掉正在播的补间
    stopAnimation()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    suppressClick.current = false

    if (pointers.current.size === 1) {
      const tap = lastTap.current
      const now = Date.now()
      if (tap && now - tap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
        lastTap.current = null
        suppressClick.current = true
        gesture.current = null
        toggleWorldView()
        return
      }
      lastTap.current = { time: now, x: e.clientX, y: e.clientY }
      gesture.current = { view, distance: 0, moved: false }
      return
    }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      // 以「当前手势已经累计到的视图」为新起点：第一根手指可能已经拖动过
      gesture.current = {
        view: gesture.current?.view ?? view,
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        moved: false
      }
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = canvasRef.current?.getBoundingClientRect()
    const current = gesture.current
    const previous = pointers.current.get(e.pointerId)
    if (!rect || !current || !previous) return

    if (Math.abs(e.clientX - previous.x) > TAP_SLOP || Math.abs(e.clientY - previous.y) > TAP_SLOP) {
      current.moved = true
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (current.distance > 0 && distance > 0) {
        const next = zoomMapView(
          current.view,
          current.distance / distance,
          toMapPoint(e, rect, current.view)
        )
        // 手势内必须累计：下次移动要以这一次的结果为基础，否则每帧都从手势起点重算，缩放会打滑
        current.view = next
        current.distance = distance
        setView(next)
      }
      return
    }
    // 单指拖动平移：位移同样是「本次移动的增量」，必须累加到手势内的当前视图上。
    // 之前这里用的是手势开始时的视图，于是每帧都变成「起点 + 几个像素」，
    // 地图只在原位抖一下、看起来完全拖不动。
    const perPixel = 1 / (layoutOf(current.view).scale * rect.width)
    const next = panMapView(
      current.view,
      -(e.clientX - previous.x) * perPixel,
      -(e.clientY - previous.y) * perPixel
    )
    current.view = next
    setView(next)
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      suppressClick.current = gesture.current?.moved ?? false
      gesture.current = null
      return
    }
    const [a, b] = [...pointers.current.values()]
    // 抬起一根手指后继续用剩下的手指操作，起点取已累计的视图
    gesture.current = {
      view: gesture.current?.view ?? view,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      moved: true
    }
  }

  return (
    <div
      className="city-map"
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="城市地图：双指缩放、拖动平移、双击在中国内地与世界之间切换"
    >
      {/* 卡片长宽比固定，不随聚焦范围变化 */}
      <div className="city-map-canvas" style={{ paddingTop: `${MAP_CARD_ASPECT * 100}%` }}>
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path className="city-map-land" d={WORLD_LAND_PATH} />
        </svg>
        {points.map(({ city, count }) => {
          const p = cityMapPoint(city)
          const layout = layoutOf(view)
          const left = (layout.offsetX + (p.x - view.x) * layout.scale) * 100
          const top =
            ((layout.offsetY + (p.y - view.y) * layout.scale) / MAP_CARD_ASPECT) * 100
          // 只画真正落在卡片里的点：贴着边缘被裁掉一半的点会像渲染错误，缩放后自然出现
          if (left < -2 || left > 102 || top < -3 || top > 103) return null
          const tier = dotTierOf(count)
          return (
            <button
              key={city.name}
              type="button"
              className={`city-dot city-dot-visual${tier.glow ? ' city-dot-strong' : ''}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${DOT_BASE_SIZE * tier.scale}px`,
                height: `${DOT_BASE_SIZE * tier.scale}px`,
                opacity: tier.opacity
              }}
              aria-label={`${city.name}，${count} 场演出`}
              onClick={(e) => {
                e.stopPropagation()
                if (suppressClick.current) return
                onSelect(city)
              }}
            />
          )
        })}
      </div>
      <span className="city-map-hint">{worldView ? '双击复位' : '双指缩放 · 拖动平移 · 双击看世界'}</span>
    </div>
  )
}
