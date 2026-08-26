import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Show } from '../types'
import { coverColors, coverSize } from '../lib/posterCover'

// 模块级图片 URL 缓存：同一演出记录在网格/瀑布流间切换时复用同一条
// ObjectURL，避免每次切换视图都重新生成、重新解码图片导致闪现。
const posterUrlCache = new Map<string, string>()

function getPosterUrl(show: Show): string | null {
  // 海报墙卡片尺寸小，优先用 400px 缩略图，避免加载 1600px 大图解码卡顿
  const source = show.poster?.thumbnail ?? show.poster?.display
  if (!source) return null
  const cacheKey = `${show.id}:${show.updatedAt}`
  const cached = posterUrlCache.get(cacheKey)
  if (cached) return cached
  const url = URL.createObjectURL(source)
  posterUrlCache.set(cacheKey, url)
  // 防止长期使用缓存无限增长：超过 200 条时清理最早的一条
  if (posterUrlCache.size > 200) {
    const oldest = posterUrlCache.keys().next().value
    if (oldest != null) {
      const oldUrl = posterUrlCache.get(oldest)
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      posterUrlCache.delete(oldest)
    }
  }
  return url
}

/** 首页海报墙卡片：仅展示海报图片，无任何叠加信息。 */
export function PosterCard({
  show,
  variant = 'grid',
  categoryName = ''
}: {
  show: Show
  variant?: 'grid' | 'masonry'
  categoryName?: string
}) {
  const colors = useMemo(() => coverColors(show.title, categoryName), [show.title, categoryName])
  const size = coverSize(show.title)
  // 同步计算 URL：首帧即图片，不再经历「占位封面 → 图片」的延迟渲染
  const posterUrl = useMemo(() => getPosterUrl(show), [show])

  return (
    <Link
      to={`/shows/${show.id}`}
      className="poster-card"
      style={
        variant === 'masonry'
          ? {
              aspectRatio: `${show.poster?.width ?? 2} / ${show.poster?.height ?? 3}`
            }
          : undefined
      }
      aria-label={show.title}
    >
      {posterUrl && <img className="poster-img" src={posterUrl} alt={show.title} loading="lazy" />}
      {!posterUrl && (
        <div
          className="poster-cover"
          style={{ background: `linear-gradient(155deg, ${colors[0]}, ${colors[1]})` }}
        >
          <span className={`cover-title cover-${size}`}>{show.title}</span>
        </div>
      )}
    </Link>
  )
}
