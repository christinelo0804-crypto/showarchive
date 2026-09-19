import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { activeShows, draftShows } from '../db/repositories'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { Timeline } from '../components/Timeline'
import { ImagePreview } from '../components/ImagePreview'
import { useToast } from '../components/Toast'
import { useCachedLiveQuery } from '../lib/liveCache'
import { restoreScrollPosition } from '../lib/scrollRestore'
import { coverColors, coverSize } from '../lib/posterCover'
import { formatDateWithYear } from '../lib/format'
import type { Category, Show, Venue } from '../types'

type ViewMode = 'list' | 'calendar' | 'timeline'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 筛选抽屉的分组（两列布局的左列）。 */
type FilterTab = 'status' | 'category' | 'place' | 'year' | 'language' | 'channel'

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'status', label: '状态' },
  { key: 'category', label: '类别' },
  { key: 'place', label: '地点' },
  { key: 'year', label: '年份' },
  { key: 'language', label: '语言' },
  { key: 'channel', label: '购票渠道' }
]

/** 在数组中增删某个值（多选筛选用）。 */
function toggleIn(list: string[], value: string, on: boolean): string[] {
  if (on) return list.includes(value) ? list : [...list, value]
  return list.filter((v) => v !== value)
}

/** 支持半选状态的复选框：父级部分勾选时显示横杠。 */
function TriCheckbox({
  checked,
  indeterminate,
  onChange
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}

/** 浏览状态缓存：从「我的演出」进入详情页再返回时，恢复上次停留的位置。 */
interface ShowsBrowseState {
  view: ViewMode
  query: string
  statuses: string[]
  cat1Ids: string[]
  cat2Ids: string[]
  cityIds: string[]
  venueIds: string[]
  languageIds: string[]
  channelIds: string[]
  years: string[]
  year: number
  month: number
  selectedDate: string | null
  scrollTop: number
}
let showsBrowseCache: ShowsBrowseState | null = null
// 滚动过程中持续记录最新位置，避免离开页面时读取时机被“回到顶部”覆盖成 0
let showsScrollTop = 0

export default function ShowsPage() {
  const { push } = useToast()
  const cached = showsBrowseCache
  const [view, setView] = useState<ViewMode>(cached?.view ?? 'list')
  const [query, setQuery] = useState(cached?.query ?? '')
  const [statuses, setStatuses] = useState<string[]>(cached?.statuses ?? [])
  const [cat1Ids, setCat1Ids] = useState<string[]>(cached?.cat1Ids ?? [])
  const [cat2Ids, setCat2Ids] = useState<string[]>(cached?.cat2Ids ?? [])
  const [cityIds, setCityIds] = useState<string[]>(cached?.cityIds ?? [])
  const [venueIds, setVenueIds] = useState<string[]>(cached?.venueIds ?? [])
  const [languageIds, setLanguageIds] = useState<string[]>(cached?.languageIds ?? [])
  const [channelIds, setChannelIds] = useState<string[]>(cached?.channelIds ?? [])
  const [years, setYears] = useState<string[]>(cached?.years ?? [])
  const [filterTab, setFilterTab] = useState<FilterTab>('status')
  const [filterOpen, setFilterOpen] = useState(false)
  const [year, setYear] = useState(() => cached?.year ?? new Date().getFullYear())
  const [month, setMonth] = useState(() => cached?.month ?? new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(cached?.selectedDate ?? null)
  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const stateRef = useRef({
    view,
    query,
    statuses,
    cat1Ids,
    cat2Ids,
    cityIds,
    venueIds,
    languageIds,
    channelIds,
    years,
    year,
    month,
    selectedDate
  })
  stateRef.current = {
    view,
    query,
    statuses,
    cat1Ids,
    cat2Ids,
    cityIds,
    venueIds,
    languageIds,
    channelIds,
    years,
    year,
    month,
    selectedDate
  }

  const shows = useCachedLiveQuery('shows:active', () => activeShows())
  const drafts = useCachedLiveQuery('shows:drafts', () => draftShows())
  const categories = useCachedLiveQuery('categories', () => db.categories.toArray())
  const cities = useCachedLiveQuery('cities', () => db.cities.toArray())
  const venues = useCachedLiveQuery('venues', () => db.venues.toArray())
  const languages = useCachedLiveQuery('languages', () => db.languages.toArray())
  const channels = useCachedLiveQuery('ticket-channels', () => db.ticketChannels.toArray())

  // 监听滚动容器，持续记录「我的演出」页的滚动位置
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.app-main')
    const onScroll = () => {
      const mainTop = main ? main.scrollTop : 0
      const winTop = window.scrollY || document.documentElement.scrollTop || 0
      showsScrollTop = Math.max(mainTop, winTop)
    }
    main?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // 离开本页时保存浏览状态；只有进入演出详情页才缓存，切到其他页面则下次从默认开始。
  const mountPathRef = useRef(window.location.pathname)
  useEffect(() => {
    return () => {
      const path = window.location.pathname
      // React StrictMode 在开发环境会先模拟卸载再重新挂载，此时路径未变，跳过以免清空缓存
      if (path === mountPathRef.current) return
      if (/\/shows\/[^/]+$/.test(path)) {
        showsBrowseCache = { ...stateRef.current, scrollTop: showsScrollTop }
        push('info', `诊断·已记录 ${Math.round(showsScrollTop)}`)
      } else {
        showsBrowseCache = null
      }
    }
  }, [])

  // 从详情页返回时恢复滚动位置：绘制前先放回，并在随后约 1.6 秒内守住
  // （iOS 的滚动恢复可能稍后才把容器重置为 0；用户主动滚动后立即停止干预）
  const savedScrollTop = cached?.scrollTop ?? 0
  useLayoutEffect(() => restoreScrollPosition(savedScrollTop), [])

  // 临时诊断（真机定位用，定位后移除）：返回后位置不对时在屏幕上提示数值
  useEffect(() => {
    if (cached == null) return
    const timer = window.setTimeout(() => {
      const main = document.querySelector<HTMLElement>('.app-main')
      const actual = main ? Math.round(main.scrollTop) : -1
      if (actual !== Math.round(savedScrollTop)) {
        push('error', `诊断：目标 ${Math.round(savedScrollTop)}，实际 ${actual}`)
      }
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cityNameMap = useMemo(() => new Map((cities ?? []).map((c) => [c.id, c.name])), [cities])
  const venueNameMap = useMemo(() => new Map((venues ?? []).map((v) => [v.id, v.name])), [venues])
  const categoryNameMap = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories]
  )
  const cityName = (id: string) => cityNameMap.get(id) ?? ''
  const venueName = (id: string) => venueNameMap.get(id) ?? ''
  const languageNameMap = useMemo(
    () => new Map((languages ?? []).map((l) => [l.id, l.name])),
    [languages]
  )
  const channelNameMap = useMemo(
    () => new Map((channels ?? []).map((c) => [c.id, c.name])),
    [channels]
  )
  const languageName = (id?: string) => (id ? languageNameMap.get(id) ?? '' : '')
  const channelName = (id?: string) => (id ? channelNameMap.get(id) ?? '' : '')
  const showCategoryName = (show: Show) =>
    (show.categoryLevel2Id ? categoryNameMap.get(show.categoryLevel2Id) : undefined) ??
    (show.categoryLevel1Id ? categoryNameMap.get(show.categoryLevel1Id) : undefined) ??
    ''
  const bySort = (a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'zh-CN')
  const level1 = (categories ?? []).filter((c) => !c.parentId).sort(bySort)
  const level2ByParent = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const c of categories ?? []) {
      if (!c.parentId) continue
      const list = map.get(c.parentId) ?? []
      list.push(c)
      map.set(c.parentId, list)
    }
    for (const list of map.values()) list.sort(bySort)
    return map
  }, [categories])
  const venuesByCity = useMemo(() => {
    const map = new Map<string, Venue[]>()
    for (const v of venues ?? []) {
      const list = map.get(v.cityId) ?? []
      list.push(v)
      map.set(v.cityId, list)
    }
    for (const list of map.values()) list.sort(byName)
    return map
  }, [venues])

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const statusSet = new Set(statuses)
    const cat1Set = new Set(cat1Ids)
    const cat2Set = new Set(cat2Ids)
    const citySet = new Set(cityIds)
    const venueSet = new Set(venueIds)
    const yearSet = new Set(years)
    const languageSet = new Set(languageIds)
    const channelSet = new Set(channelIds)
    return (shows ?? []).filter((s) => {
      if (statusSet.size > 0 && !statusSet.has(s.status)) return false
      // 类别：一级与二级合并为一组，组内任一匹配（勾一级=涵盖其全部二级）
      if (cat1Set.size > 0 || cat2Set.size > 0) {
        const byCat1 = cat1Set.has(s.categoryLevel1Id)
        const byCat2 = s.categoryLevel2Id != null && cat2Set.has(s.categoryLevel2Id)
        if (!byCat1 && !byCat2) return false
      }
      // 地点：城市与场馆合并为一组，组内任一匹配（勾城市=涵盖其全部场馆）
      if (citySet.size > 0 || venueSet.size > 0) {
        if (!citySet.has(s.cityId) && !venueSet.has(s.venueId)) return false
      }
      if (yearSet.size > 0 && !yearSet.has(s.date.slice(0, 4))) return false
      if (languageSet.size > 0 && !(s.languageId != null && languageSet.has(s.languageId)))
        return false
      if (channelSet.size > 0 && !(s.ticketChannelId != null && channelSet.has(s.ticketChannelId)))
        return false
      if (terms.length === 0) return true
      // 搜索覆盖全部用户填写的内容、关联名称与日期；多个关键词需全部命中
      const hay = [
        s.title,
        s.seat,
        s.cast,
        s.content,
        s.review,
        s.notes,
        s.date,
        cityName(s.cityId),
        venueName(s.venueId),
        showCategoryName(s),
        languageName(s.languageId),
        channelName(s.ticketChannelId)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [
    shows,
    query,
    statuses,
    cat1Ids,
    cat2Ids,
    cityIds,
    venueIds,
    years,
    languageIds,
    channelIds,
    cities,
    venues,
    categories,
    languages,
    channels
  ])

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

  const yearOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of shows ?? []) {
      const y = s.date.slice(0, 4)
      if (y) set.add(y)
    }
    return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  }, [shows])

  // 左列角标：树状分组按「整选/半选的父级数」计数，其他分组按勾选项数计数
  const catPartialCount = level1.filter((p) => {
    const kids = level2ByParent.get(p.id) ?? []
    if (kids.length === 0) return false
    const checked = kids.filter((k) => cat2Ids.includes(k.id)).length
    return checked > 0 && checked < kids.length
  }).length
  const cityPartialCount = (cities ?? []).filter((c) => {
    const kids = venuesByCity.get(c.id) ?? []
    if (kids.length === 0) return false
    const checked = kids.filter((v) => venueIds.includes(v.id)).length
    return checked > 0 && checked < kids.length
  }).length
  const tabCounts: Record<FilterTab, number> = {
    status: statuses.length,
    category: cat1Ids.length + catPartialCount,
    place: cityIds.length + cityPartialCount,
    year: years.length,
    language: languageIds.length,
    channel: channelIds.length
  }
  const activeFilterCount = FILTER_TABS.filter((t) => tabCounts[t.key] > 0).length

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
    setStatuses([])
    setCat1Ids([])
    setCat2Ids([])
    setCityIds([])
    setVenueIds([])
    setLanguageIds([])
    setChannelIds([])
    setYears([])
  }

  // 勾选一级类别 → 同步勾选其全部二级；取消则同步取消
  function toggleCat1(id: string, on: boolean) {
    const kids = (level2ByParent.get(id) ?? []).map((c) => c.id)
    setCat1Ids((prev) => toggleIn(prev, id, on))
    if (kids.length === 0) return
    setCat2Ids((prev) =>
      on ? [...new Set([...prev, ...kids])] : prev.filter((v) => !kids.includes(v))
    )
  }

  // 勾选二级类别：全部二级都勾上时父级自动变为全选，部分勾选时父级为半选（不进入筛选条件）
  function toggleCat2(parentId: string, id: string, on: boolean) {
    const kids = (level2ByParent.get(parentId) ?? []).map((c) => c.id)
    const next = toggleIn(cat2Ids, id, on)
    setCat2Ids(next)
    const allChecked = kids.length > 0 && kids.every((k) => next.includes(k))
    setCat1Ids((prev) => toggleIn(prev, parentId, allChecked))
  }

  // 勾选城市 → 同步勾选其全部场馆；取消则同步取消
  function toggleCity(id: string, on: boolean) {
    const kids = (venuesByCity.get(id) ?? []).map((v) => v.id)
    setCityIds((prev) => toggleIn(prev, id, on))
    if (kids.length === 0) return
    setVenueIds((prev) =>
      on ? [...new Set([...prev, ...kids])] : prev.filter((v) => !kids.includes(v))
    )
  }

  // 勾选场馆：该城市全部场馆都勾上时城市自动全选，部分勾选时城市为半选
  function toggleVenue(cityId: string, id: string, on: boolean) {
    const kids = (venuesByCity.get(cityId) ?? []).map((v) => v.id)
    const next = toggleIn(venueIds, id, on)
    setVenueIds(next)
    const allChecked = kids.length > 0 && kids.every((k) => next.includes(k))
    setCityIds((prev) => toggleIn(prev, cityId, allChecked))
  }

  function MiniPoster({ show }: { show: Show }) {
    const poster = show.poster
    if (poster && (poster.display || poster.thumbnail)) {
      return <ImagePreview asset={poster} alt="" className="cal-poster-img" preferThumb />
    }
    const colors = coverColors(
      show.title,
      categories?.find((c) => c.id === show.categoryLevel1Id)?.name ?? ''
    )
    return (
      <span
        className="cal-poster-cover"
        style={{ background: `linear-gradient(155deg, ${colors[0]}, ${colors[1]})` }}
      >
        <span className={`cal-cover-title cal-cover-title-${coverSize(show.title)}`}>{show.title}</span>
      </span>
    )
  }

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    setSelectedDate(null)
    setDaySheetOpen(false)
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
          placeholder="搜索名称、阵容、评价、备注…"
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
          shows === undefined ? (
            <p className="muted">读取中…</p>
          ) : (
            <EmptyState title="没有符合条件的记录" hint="换个关键词，或先新增一条记录。" />
          )
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
                  onClick={() => {
                    // 日历本身已显示当天有无演出，无演出日期不弹抽屉
                    if (dayList.length === 0) return
                    setSelectedDate(date)
                    setDaySheetOpen(true)
                  }}
                >
                  <span className="cal-day-num">{Number(date.slice(-2))}</span>
                  {dayList.length > 0 && (
                    <span className="cal-dots">
                      {dayList.slice(0, 3).map((s) => (
                        <i
                          key={s.id}
                          className={`cal-dot ${
                            s.status === 'upcoming' ? 'cal-dot-upcoming' : 'cal-dot-watched'
                          }`}
                        />
                      ))}
                    </span>
                  )}
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
        </>
      ) : filtered.length === 0 ? (
        shows === undefined ? (
          <p className="muted">读取中…</p>
        ) : (
          <EmptyState title="没有符合条件的记录" hint="换个关键词，或先新增一条记录。" />
        )
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
          <div className="drawer drawer-filter" onClick={(e) => e.stopPropagation()}>
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
            <p className="drawer-sub">组内可多选（任一匹配）；不同筛选之间取交集，与搜索同时生效</p>
            <div className="drawer-body">
              <div className="filter-tabs">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`filter-tab ${filterTab === t.key ? 'on' : ''}`}
                    onClick={() => setFilterTab(t.key)}
                  >
                    <span>{t.label}</span>
                    {tabCounts[t.key] > 0 && (
                      <span className="filter-tab-count">{tabCounts[t.key]}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="filter-panel">
                {filterTab === 'status' && (
                  <>
                    <p className="filter-panel-hint">可同时勾选多种状态</p>
                    <label className="filter-item">
                      <span>待观看</span>
                      <TriCheckbox
                        checked={statuses.includes('upcoming')}
                        indeterminate={false}
                        onChange={(on) => setStatuses((prev) => toggleIn(prev, 'upcoming', on))}
                      />
                    </label>
                    <label className="filter-item">
                      <span>已观看</span>
                      <TriCheckbox
                        checked={statuses.includes('watched')}
                        indeterminate={false}
                        onChange={(on) => setStatuses((prev) => toggleIn(prev, 'watched', on))}
                      />
                    </label>
                  </>
                )}

                {filterTab === 'category' && (
                  <>
                    <p className="filter-panel-hint">勾选一级类别 = 涵盖它下面的全部二级</p>
                    {level1.length === 0 && (
                      <p className="filter-panel-empty">还没有类别，可在设置中添加</p>
                    )}
                    {level1.map((parent) => {
                      const kids = level2ByParent.get(parent.id) ?? []
                      const checkedCount = kids.filter((k) => cat2Ids.includes(k.id)).length
                      const allChecked =
                        kids.length > 0 ? checkedCount === kids.length : cat1Ids.includes(parent.id)
                      const partial =
                        kids.length > 0 && checkedCount > 0 && checkedCount < kids.length
                      return (
                        <Fragment key={parent.id}>
                          <label className="filter-item parent">
                            <span>{parent.name}</span>
                            <TriCheckbox
                              checked={allChecked}
                              indeterminate={partial}
                              onChange={(on) =>
                                kids.length > 0
                                  ? toggleCat1(parent.id, on)
                                  : setCat1Ids((prev) => toggleIn(prev, parent.id, on))
                              }
                            />
                          </label>
                          {kids.map((kid) => (
                            <label key={kid.id} className="filter-item child">
                              <span>{kid.name}</span>
                              <TriCheckbox
                                checked={cat2Ids.includes(kid.id)}
                                indeterminate={false}
                                onChange={(on) => toggleCat2(parent.id, kid.id, on)}
                              />
                            </label>
                          ))}
                        </Fragment>
                      )
                    })}
                  </>
                )}

                {filterTab === 'place' && (
                  <>
                    <p className="filter-panel-hint">勾选城市 = 涵盖该城市的全部场馆</p>
                    {[...(cities ?? [])].sort(byName).map((cityItem) => {
                      const kids = venuesByCity.get(cityItem.id) ?? []
                      const checkedCount = kids.filter((v) => venueIds.includes(v.id)).length
                      const allChecked =
                        kids.length > 0 ? checkedCount === kids.length : cityIds.includes(cityItem.id)
                      const partial =
                        kids.length > 0 && checkedCount > 0 && checkedCount < kids.length
                      return (
                        <Fragment key={cityItem.id}>
                          <label className="filter-item parent">
                            <span>{cityItem.name}</span>
                            <TriCheckbox
                              checked={allChecked}
                              indeterminate={partial}
                              onChange={(on) =>
                                kids.length > 0
                                  ? toggleCity(cityItem.id, on)
                                  : setCityIds((prev) => toggleIn(prev, cityItem.id, on))
                              }
                            />
                          </label>
                          {kids.map((venueItem) => (
                            <label key={venueItem.id} className="filter-item child">
                              <span>{venueItem.name}</span>
                              <TriCheckbox
                                checked={venueIds.includes(venueItem.id)}
                                indeterminate={false}
                                onChange={(on) => toggleVenue(cityItem.id, venueItem.id, on)}
                              />
                            </label>
                          ))}
                        </Fragment>
                      )
                    })}
                  </>
                )}

                {filterTab === 'year' && (
                  <>
                    <p className="filter-panel-hint">可同时勾选多个年份</p>
                    {yearOptions.map((y) => (
                      <label key={y} className="filter-item">
                        <span>{y} 年</span>
                        <TriCheckbox
                          checked={years.includes(y)}
                          indeterminate={false}
                          onChange={(on) => setYears((prev) => toggleIn(prev, y, on))}
                        />
                      </label>
                    ))}
                  </>
                )}

                {filterTab === 'language' && (
                  <>
                    <p className="filter-panel-hint">可同时勾选多种语言</p>
                    {(languages ?? []).length === 0 && (
                      <p className="filter-panel-empty">还没有语言，可在设置中添加</p>
                    )}
                    {(languages ?? []).map((item) => (
                      <label key={item.id} className="filter-item">
                        <span>{item.name}</span>
                        <TriCheckbox
                          checked={languageIds.includes(item.id)}
                          indeterminate={false}
                          onChange={(on) => setLanguageIds((prev) => toggleIn(prev, item.id, on))}
                        />
                      </label>
                    ))}
                  </>
                )}

                {filterTab === 'channel' && (
                  <>
                    <p className="filter-panel-hint">可同时勾选多个渠道</p>
                    {(channels ?? []).length === 0 && (
                      <p className="filter-panel-empty">还没有购票渠道，可在设置中添加</p>
                    )}
                    {(channels ?? []).map((item) => (
                      <label key={item.id} className="filter-item">
                        <span>{item.name}</span>
                        <TriCheckbox
                          checked={channelIds.includes(item.id)}
                          indeterminate={false}
                          onChange={(on) => setChannelIds((prev) => toggleIn(prev, item.id, on))}
                        />
                      </label>
                    ))}
                  </>
                )}
              </div>
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

      {daySheetOpen && selectedDate && (
        <div className="drawer-overlay" onClick={() => setDaySheetOpen(false)}>
          <div className="drawer day-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="day-sheet-head">
              <h3>{formatDateWithYear(selectedDate)}</h3>
              <span className="day-sheet-count">{dayShows.length} 场演出</span>
              <button
                type="button"
                className="day-sheet-close"
                onClick={() => setDaySheetOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="day-sheet-list">
              {dayShows.map((show) => {
                const poster = show.poster
                const colors = coverColors(
                  show.title,
                  categories?.find((c) => c.id === show.categoryLevel1Id)?.name ?? ''
                )
                return (
                  <Link key={show.id} to={`/shows/${show.id}`} className="day-sheet-item">
                    <span className="day-sheet-thumb">
                      {poster && (poster.display || poster.thumbnail) ? (
                        <ImagePreview asset={poster} alt="" className="day-sheet-thumb-img" preferThumb />
                      ) : (
                        <span
                          className="day-sheet-cover"
                          style={{
                            background: `linear-gradient(155deg, ${colors[0]}, ${colors[1]})`
                          }}
                        >
                          <span className={`cal-cover-title cal-cover-title-${coverSize(show.title)}`}>
                            {show.title}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="day-sheet-body">
                      <span className="day-sheet-name">{show.title}</span>
                      <span className="day-sheet-sub">
                        {showCategoryName(show)} · {cityName(show.cityId)} · {venueName(show.venueId)}
                      </span>
                    </span>
                    <span className="day-sheet-arrow">›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
