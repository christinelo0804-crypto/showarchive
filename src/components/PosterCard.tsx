import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Show } from '../types'
import { coverColors, coverSize } from '../lib/posterCover'

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
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const colors = useMemo(() => coverColors(show.title, categoryName), [show.title, categoryName])
  const size = coverSize(show.title)

  useEffect(() => {
    const source = show.poster?.display ?? show.poster?.thumbnail
    if (!source) {
      setPosterUrl(null)
      return
    }
    const url = URL.createObjectURL(source)
    setPosterUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [show.poster])

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
