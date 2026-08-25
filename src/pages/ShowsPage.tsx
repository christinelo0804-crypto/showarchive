import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activeShows, draftShows } from '../db/repositories'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { Timeline } from '../components/Timeline'
import { Select } from '../components/Select'
import { ImagePreview } from '../components/ImagePreview'
import { coverColors } from '../lib/posterCover'
import { formatDateWithYear } from '../lib/format'
import type { Show } from '../types'

type ViewMode = 'list' | 'calendar' | 'timeline'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function ShowsPage() {
  const [view, setView] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [cat1, setCat1] = useState('')
  const [cat2, setCat2] = useState('')
  const [city, setCity] = useState('')
  const [venue, setVenue] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const shows = useLiveQuery(() => activeShows(), [])
  const drafts = useLiveQuery(() => draftShows(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const cities = useLiveQuery(() => db.cities.toArray(), [])
  const venues = useLiveQuery(() => db.venues.toArray(), [])

  const cityName = (id: string) => cities?.find((c) => c.id === id)?.name ?? ''
  const venueName = (id: string) => venues?.find((v) => v.id === id)?.name ?? ''
  const showCategoryName = (show: Show) =>
    categories?.find((c) => c.id === show.categoryLevel2Id)?.name ??
    categories?.find((c) => c.id === show.categoryLevel1Id)?.name ??
    ''
  const bySort = (a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'zh-CN')
  const level1 = (categories ?? []).filter((c) => !c.parentId).sort(bySort)
  const level2 = (categories ?? []).filter((c) => c.parentId === cat1).sort(bySort)
  const cityVenues = (city ? (venues ?? []).filter((v) => v.cityId === city) : (venues ?? [])).sort(
    byName
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (shows ?? []).filter((s) => {
      if (status && s.status !== status) return false
      if (cat1 && s.categoryLevel1Id !== cat1) return false
      if (cat2 && s.categoryLevel2Id !== cat2) return false
      if (city && s.cityId !== city) return false
      if (venue && s.venueId !== venue) return false
      if (!q) return true
      return [s.title, cityName(s.cityId), venueName(s.venueId)].some((v) =>
        v.toLowerCase().includes(q)
      )
    })
  }, [shows, query, status, cat1, cat2, city, venue, cities, venues])

  const cells = useMemo(() => {
    const pad = new Date(year, month, 1).getDay()
    const count = new Date(year, month + 1, 0).getDate()
    const list: Array<string | null> = Array.from({ length: pad }, () => null)
    for (let d = 1; d <= count; d++) {
      list.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return list
  }, [year, month])

  const dayShows = selectedDate ? filtered.filter((s) => s.date === selectedDate) : []
  const monthTitle = `${year} 年 ${month + 1} 月`
  const activeFilterCount = [status, cat1, cat2, city, venue].filter(Boolean).length

  const showsByDate = useMemo(() => {
    const map = new Map<string, Show[]>()
    for (const s of filtered) {
      const list = map.get(s.date) ?? []
      list.push(s)
      map.set(s.date, list)
    }
    return map
  }, [filtered])

  function resetFilters() {
    setStatus('')
    setCat1('')
    setCat2('')
    setCity('')
    setVenue('')
  }

  function MiniPoster({ show }: { show: Show }) {
    const poster = show.poster
    if (poster && (poster.display || poster.thumbnail)) {
      return <ImagePreview asset={poster} alt="" className="cal-poster-img" />
    }
    const colors = coverColors(
      show.title,
      categories?.find((c) => c.id === show.categoryLevel1Id)?.name ?? ''
    )
    return (
      <span
        className="cal-poster-cover"
        style={{ background: `linear-gradient(155deg, ${colors[0]}, ${colors[1]})` }}
      />
    )
  }

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    setSelectedDate(null)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Archive"
        title="我的演出"
        action={
          <div className="segmented">
            <button
              type="button"
              className={view === 'list' ? 'seg-active' : ''}
              onClick={() => setView('list')}
            >
              列表
            </button>
            <button
              type="button"
              className={view === 'calendar' ? 'seg-active' : ''}
              onClick={() => setView('calendar')}
            >
              月历
            </button>
            <button
              type="button"
              className={view === 'timeline' ? 'seg-active' : ''}
              onClick={() => setView('timeline')}
            >
              时间线
            </button>
          </div>
        }
      />

      <div className="toolbar">
        <input
          className="input toolbar-search"
          type="search"
          placeholder="搜索名称、城市、场馆…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索"
        />
        <button
          type="button"
          className={`filter-trigger ${activeFilterCount > 0 ? 'filter-trigger-active' : ''}`}
          onClick={() => setFilterOpen(true)}
        >
          <span>筛选</span>
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
        <Link className="count-chip" to="/drafts">
          <span>草稿</span>
          <span className="draft-num">{drafts?.length ?? 0}</span>
        </Link>
      </div>

      {view === 'list' ? (
        filtered.length === 0 ? (
          <EmptyState title="没有符合条件的记录" hint="换个关键词，或先新增一条记录。" />
        ) : (
          <div className="show-list">
            {filtered.map((show) => (
              <Link key={show.id} to={`/shows/${show.id}`} className="show-row">
                <span className="show-date">{formatDateWithYear(show.date)}</span>
                <span className="show-body">
                  <span className="show-name">{show.title}</span>
                  <span className="show-sub">
                    {showCategoryName(show)} · {cityName(show.cityId)} · {venueName(show.venueId)}
                  </span>
                </span>
                <span className={`status-chip status-${show.status}`}>
                  {show.status === 'upcoming' ? '待观看' : '已观看'}
                </span>
              </Link>
            ))}
          </div>
        )
      ) : view === 'calendar' ? (
        <>
          <div className="calendar-head">
            <h2 className="calendar-title">{monthTitle}</h2>
            <div className="calendar-nav">
              <button type="button" className="icon-btn" onClick={() => changeMonth(-1)} aria-label="上个月">
                ‹
              </button>
              <button type="button" className="icon-btn" onClick={() => changeMonth(1)} aria-label="下个月">
                ›
              </button>
            </div>
          </div>
          <div className="calendar-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-weekday">
                {w}
              </div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <span key={`pad-${i}`} />
              const dayList = showsByDate.get(date) ?? []
              return (
                <button
                  key={date}
                  type="button"
                  className={`cal-day ${dayList.length > 0 ? 'cal-has-show' : ''} ${
                    selectedDate === date ? 'cal-selected' : ''
                  }`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="cal-day-num">{Number(date.slice(-2))}</span>
                  {dayList.length > 0 && (
                    <span className="cal-poster">
                      <MiniPoster show={dayList[0]} />
                    </span>
                  )}
                  {dayList.length > 1 && <span className="cal-count">{dayList.length}</span>}
                </button>
              )
            })}
          </div>
          {selectedDate &&
            (dayShows.length === 0 ? (
              <>
                <h2 className="section-title">当天记录</h2>
                <p className="muted">当天没有记录。</p>
              </>
            ) : (
              <>
                <h2 className="section-title">当天记录</h2>
                <div className="show-list">
                  {dayShows.map((show) => (
                    <Link key={show.id} to={`/shows/${show.id}`} className="show-row">
                      <span className="show-date">{formatDateWithYear(show.date)}</span>
                      <span className="show-body">
                        <span className="show-name">{show.title}</span>
                        <span className="show-sub">
                          {showCategoryName(show)} · {cityName(show.cityId)} · {venueName(show.venueId)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            ))}
        </>
      ) : filtered.length === 0 ? (
        <EmptyState title="没有符合条件的记录" hint="换个关键词，或先新增一条记录。" />
      ) : (
        <Timeline
          shows={filtered}
          categories={categories ?? []}
          cities={cities ?? []}
          venues={venues ?? []}
        />
      )}

      {filterOpen && (
        <div className="drawer-overlay" onClick={() => setFilterOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h3>筛选</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFilterOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <p className="drawer-sub">条件之间取交集，与搜索同时生效</p>
            <div className="filter-row">
              <span className="filter-label">状态</span>
              <Select
                value={status}
                onChange={setStatus}
                options={[
                  { value: '', label: '全部状态' },
                  { value: 'upcoming', label: '待观看' },
                  { value: 'watched', label: '已观看' }
                ]}
                ariaLabel="按状态筛选"
              />
            </div>
            <div className="filter-row">
              <span className="filter-label">一级类别</span>
              <Select
                value={cat1}
                onChange={(v) => {
                  setCat1(v)
                  setCat2('')
                }}
                options={[
                  { value: '', label: '全部一级类别' },
                  ...level1.map((c) => ({ value: c.id, label: c.name }))
                ]}
                ariaLabel="按一级类别筛选"
              />
            </div>
            <div className="filter-row">
              <span className="filter-label">二级类别</span>
              <Select
                value={cat2}
                onChange={setCat2}
                options={[
                  { value: '', label: '全部二级类别' },
                  ...level2.map((c) => ({ value: c.id, label: c.name }))
                ]}
                ariaLabel="按二级类别筛选"
              />
            </div>
            <div className="filter-row">
              <span className="filter-label">城市</span>
              <Select
                value={city}
                onChange={(v) => {
                  setCity(v)
                  setVenue('')
                }}
                options={[
                  { value: '', label: '全部城市' },
                  ...[...(cities ?? [])].sort(byName).map((c) => ({ value: c.id, label: c.name }))
                ]}
                ariaLabel="按城市筛选"
              />
            </div>
            <div className="filter-row">
              <span className="filter-label">场馆</span>
              <Select
                value={venue}
                onChange={setVenue}
                options={[
                  { value: '', label: '全部场馆' },
                  ...cityVenues.map((v) => ({ value: v.id, label: v.name }))
                ]}
                ariaLabel="按场馆筛选"
              />
            </div>
            <div className="drawer-foot">
              <Button type="button" variant="ghost" onClick={resetFilters}>
                重置
              </Button>
              <Button type="button" onClick={() => setFilterOpen(false)}>
                完成
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
