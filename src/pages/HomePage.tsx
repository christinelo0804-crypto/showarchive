import { Link } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activeShows } from '../db/repositories'
import { EmptyState, PageHeader } from '../components/ui'
import { PosterCard } from '../components/PosterCard'
import type { Show } from '../types'

function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.classList.add('poster-reveal-visible')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('poster-reveal-visible')
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="poster-reveal">
      {children}
    </div>
  )
}

export default function HomePage() {
  const shows = useLiveQuery(() => activeShows(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const [wallStyle, setWallStyle] = useState<'grid' | 'masonry'>(() => {
    try {
      return localStorage.getItem('showarchive-wall') === 'masonry' ? 'masonry' : 'grid'
    } catch {
      return 'grid'
    }
  })

  const masonryColumns = useMemo(() => {
    const columns: Show[][] = [[], []]
    const heights = [0, 0]
    for (const show of shows ?? []) {
      const aspect =
        show.poster?.width && show.poster?.height
          ? show.poster.width / show.poster.height
          : 2 / 3
      const col = heights[0] <= heights[1] ? 0 : 1
      columns[col].push(show)
      heights[col] += 1 / aspect
    }
    return columns
  }, [shows])

  function switchWall(next: 'grid' | 'masonry') {
    setWallStyle(next)
    try {
      localStorage.setItem('showarchive-wall', next)
    } catch {
      // 存储不可用时仅本次生效
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="ShowArchive"
        title="我的观演档案"
        action={
          <div className="wall-toggle">
            <button
              type="button"
              className={`wall-toggle-btn ${wallStyle === 'grid' ? 'wall-toggle-active' : ''}`}
              onClick={() => switchWall('grid')}
            >
              网格
            </button>
            <button
              type="button"
              className={`wall-toggle-btn ${wallStyle === 'masonry' ? 'wall-toggle-active' : ''}`}
              onClick={() => switchWall('masonry')}
            >
              瀑布流
            </button>
          </div>
        }
      />
      {!shows ? (
        <p className="muted">读取中…</p>
      ) : shows.length === 0 ? (
        <EmptyState title="还没有任何记录" hint="从第一场演出开始，建立你的观演档案馆。">
          <Link className="btn btn-primary" to="/new">
            记录第一场
          </Link>
        </EmptyState>
      ) : (
        wallStyle === 'grid' ? (
          <div className="poster-wall">
            {shows.map((show) => (
              <PosterCard
                key={show.id}
                show={show}
                variant="grid"
                categoryName={categories?.find((c) => c.id === show.categoryLevel1Id)?.name ?? ''}
              />
            ))}
          </div>
        ) : (
          <div className="poster-wall-masonry">
            {masonryColumns.map((column, i) => (
              <div key={i} className="masonry-col">
                {column.map((show) => (
                  <Reveal key={show.id}>
                    <PosterCard
                      show={show}
                      variant="masonry"
                      categoryName={
                        categories?.find((c) => c.id === show.categoryLevel1Id)?.name ?? ''
                      }
                    />
                  </Reveal>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
