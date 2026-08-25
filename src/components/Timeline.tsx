import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ImagePreview } from './ImagePreview'
import { formatDate } from '../lib/format'
import type { Category, City, Show, Venue } from '../types'

interface MonthGroup {
  month: string
  label: string
  shows: Show[]
}

interface YearGroup {
  year: string
  months: MonthGroup[]
}

export function Timeline({
  shows,
  categories,
  cities,
  venues
}: {
  shows: Show[]
  categories: Category[]
  cities: City[]
  venues: Venue[]
}) {
  const groups = useMemo(() => {
    const sorted = [...shows].sort((a, b) => (a.date < b.date ? 1 : -1))
    const yearMap = new Map<string, Map<string, Show[]>>()
    for (const show of sorted) {
      const year = show.date.slice(0, 4)
      const month = show.date.slice(5, 7)
      const months = yearMap.get(year) ?? new Map<string, Show[]>()
      const list = months.get(month) ?? []
      list.push(show)
      months.set(month, list)
      yearMap.set(year, months)
    }
    const result: YearGroup[] = []
    for (const [year, months] of yearMap) {
      result.push({
        year,
        months: [...months.entries()].map(([month, list]) => ({
          month,
          label: `${Number(month)}月`,
          shows: list
        }))
      })
    }
    return result
  }, [shows])

  const showCategoryName = (show: Show) =>
    categories.find((c) => c.id === show.categoryLevel2Id)?.name ??
    categories.find((c) => c.id === show.categoryLevel1Id)?.name ??
    ''
  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? ''
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? ''

  return (
    <div className="timeline">
      {groups.map((group) => (
        <Fragment key={group.year}>
          <div className="timeline-year">{group.year}</div>
          {group.months.map((month) => (
            <Fragment key={month.month}>
              <div className="timeline-month">{month.label}</div>
              {month.shows.map((show) => (
                <Link key={show.id} to={`/shows/${show.id}`} className="timeline-item">
                  <span className="tl-thumb">
                    {show.poster && (show.poster.display || show.poster.thumbnail) ? (
                      <ImagePreview asset={show.poster} alt="" />
                    ) : (
                      <span>{show.title.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="tl-body">
                    <span className="tl-title">{show.title}</span>
                    <span className="tl-meta">
                      {showCategoryName(show)} · {cityName(show.cityId)} · {venueName(show.venueId)}
                    </span>
                  </span>
                  <span className="tl-right">
                    <span className="tl-date">{formatDate(show.date)}</span>
                    {show.status === 'upcoming' ? (
                      <span className="tl-upcoming">待观看</span>
                    ) : show.rating != null ? (
                      <span className="tl-rating">★ {show.rating.toFixed(1)}</span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </Fragment>
          ))}
        </Fragment>
      ))}
    </div>
  )
}
