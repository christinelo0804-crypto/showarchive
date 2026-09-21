import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { activeShows, draftShows } from '../db/repositories'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { Timeline } from '../components/Timeline'
import { PosterThumb } from '../components/PosterThumb'
import { useCachedLiveQuery } from '../lib/liveCache'
import { persistBrowseState, previousRoutePathname, readBrowseState } from '../lib/scrollRestore'
import { consumeShowsLanding, onShowsLanding } from '../lib/showsLanding'
import { coverColors, coverSize } from '../lib/posterCover'
import { formatDateWithYear, formatMoney } from '../lib/format'
import { PRICE_BUCKETS } from '../lib/stats'
import type { Category, Show, Venue } from '../types'

type ViewMode = 'list' | 'calendar' | 'timeline'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** 价格快捷档位：与统计页「实付价区间」维度共用同一套阈值。 */
const PRICE_STEP = 10

const PRICE_PRESETS = PRICE_BUCKETS.map((bucket, i) => ({
  label: bucket.label,
  min: i === 0 ? null : PRICE_BUCKETS[i - 1].max,
  max: Number.isFinite(bucket.max) ? bucket.max : null
}))

/** 筛选抽屉的分组（两列布局的左列）。 */
type FilterTab =
  | 'status'
  | 'category'
  | 'place'
  | 'time'
  | 'price'
  | 'rating'
  | 'language'
  | 'channel'

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'status', label: '状态' },
  { key: 'category', label: '类别' },
  { key: 'place', label: '地点' },
  { key: 'time', label: '时间' },
  { key: 'price', label: '价格' },
  { key: 'rating', label: '评分' },
  { key: 'language', label: '语言' },
  { key: 'channel', label: '购票渠道' }
]

/** 评分筛选档位（半星步进）与「未评分」。 */
const RATING_LEVELS = ['5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1', '0.5']

/** 评分星标（半星用半填充显示）。 */
function RatingStars({ value }: { value: number }) {
  return (
    <span className="filter-stars">
      {[1, 2, 3, 4, 5].map((i) => {
        const cls = value >= i ? 'on' : value >= i - 0.5 ? 'half' : ''
        return (
          <span key={i} className={`filter-star${cls ? ` filter-star-${cls}` : ''}`}>
            ★
          </span>
        )
      })}
    </span>
  )
}

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
  languageUnset: boolean
  channelUnset: boolean
  years: string[]
  months: string[]
  priceMin: number | null
  priceMax: number | null
  priceUnset: boolean
  ratingLevels: string[]
  ratingMode: 'gte' | 'exact'
  year: number
  month: number
  selectedDate: string | null
  savedAt: number
}
let showsBrowseCache: ShowsBrowseState | null = null

export default function ShowsPage() {
  // 恢复上次浏览状态的判断：不依赖路由跟踪（真机上不可靠），
  // 只排除「从新增/编辑表单返回」的情况，并要求记录足够新（5 分钟内）。
  const prevRoute = previousRoutePathname()
  const fromForm = /^\/(new|shows\/[^/]+\/edit)/.test(prevRoute)
  // 记录来源：模块缓存（快）优先，否则用 sessionStorage（可跨页面重载保留）
  const storedBrowse = readBrowseState<ShowsBrowseState>('shows')
  const candidates = [showsBrowseCache, storedBrowse?.state]
    .filter((item): item is ShowsBrowseState => item != null)
    .filter((item) => Date.now() - item.savedAt < 5 * 60 * 1000)
    .sort((a, b) => b.savedAt - a.savedAt)
  const record = candidates[0] ?? null
  const shouldRestore = !fromForm && record != null
  const cached = shouldRestore ? record : null
  const [view, setView] = useState<ViewMode>(cached?.view ?? 'list')
  const [query, setQuery] = useState(cached?.query ?? '')
  const [statuses, setStatuses] = useState<string[]>(cached?.statuses ?? [])
  const [cat1Ids, setCat1Ids] = useState<string[]>(cached?.cat1Ids ?? [])
  const [cat2Ids, setCat2Ids] = useState<string[]>(cached?.cat2Ids ?? [])
  const [cityIds, setCityIds] = useState<string[]>(cached?.cityIds ?? [])
  const [venueIds, setVenueIds] = useState<string[]>(cached?.venueIds ?? [])
  const [languageIds, setLanguageIds] = useState<string[]>(cached?.languageIds ?? [])
  const [channelIds, setChannelIds] = useState<string[]>(cached?.channelIds ?? [])
  const [languageUnset, setLanguageUnset] = useState(cached?.languageUnset ?? false)
  const [channelUnset, setChannelUnset] = useState(cached?.channelUnset ?? false)
  const [years, setYears] = useState<string[]>(cached?.years ?? [])
  const [months, setMonths] = useState<string[]>(cached?.months ?? [])
  const [priceMin, setPriceMin] = useState<number | null>(cached?.priceMin ?? null)
  const [priceMax, setPriceMax] = useState<number | null>(cached?.priceMax ?? null)
  const [priceUnset, setPriceUnset] = useState(cached?.priceUnset ?? false)
  const [ratingLevels, setRatingLevels] = useState<string[]>(cached?.ratingLevels ?? [])
  const [ratingMode, setRatingMode] = useState<'gte' | 'exact'>(cached?.ratingMode ?? 'gte')
  // 父级展开状态（按 id 记录）；未手动设置过的父级，有勾选子级时默认展开
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({})
  const [filterTab, setFilterTab] = useState<FilterTab>('status')
  const [filterOpen, setFilterOpen] = useState(false)
  const [year, setYear] = useState(() => cached?.year ?? new Date().getFullYear())
  const [month, setMonth] = useState(() => cached?.month ?? new Date().getMonth())
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const [monthMenuOpen, setMonthMenuOpen] = useState(false)
  const calendarMenuRef = useRef<HTMLHeadingElement | null>(null)
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
    languageUnset,
    channelUnset,
    years,
    months,
    priceMin,
    priceMax,
    priceUnset,
    ratingLevels,
    ratingMode,
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
    languageUnset,
    channelUnset,
    years,
    months,
    priceMin,
    priceMax,
    priceUnset,
    ratingLevels,
    ratingMode,
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

  // 持续保存浏览状态（视图模式 / 搜索 / 筛选 / 日历年月），从详情页返回时恢复
  useEffect(() => {
    showsBrowseCache = { ...stateRef.current, savedAt: Date.now() }
    persistBrowseState('shows', showsBrowseCache)
  })

  // 提醒弹窗跳转过来时：只保留「待观看 + 已过期」状态筛选，清掉其他条件
  useEffect(() => {
    const applyLanding = (statusList: string[]) => {
      setStatuses(statusList)
      setCat1Ids([])
      setCat2Ids([])
      setCityIds([])
      setVenueIds([])
      setYears([])
      setMonths([])
      setPriceMin(null)
      setPriceMax(null)
      setPriceUnset(false)
      setRatingLevels([])
      setLanguageIds([])
      setChannelIds([])
      setQuery('')
      setView('list')
    }
    const landing = consumeShowsLanding()
    if (landing) applyLanding(landing.statuses)
    return onShowsLanding((next) => applyLanding(next.statuses))
  }, [])

  // 从详情页返回时恢复滚动位置：绘制前先放回，并在随后约 1.6 秒内守住
  // （iOS 的滚动恢复可能稍后才把容器重置为 0；用户主动滚动后立即停止干预）
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
  // 语言与购票渠道：按拼音首字母排序（zh-CN 的 localeCompare 即按拼音）
  const languagesSorted = [...(languages ?? [])].sort(byName)
  const channelsSorted = [...(channels ?? [])].sort(byName)
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
  /**
   * 「未填写二级类别」是挂在对应一级类别下的子项（一级类别是必填项，
   * 所以它不能作为树表里的一级条目出现）。只在一级类别下真的存在
   * 这类记录时才展示，避免出现选了永远为空的筛选项。
   */
  const unsetCat2ByParent = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of shows ?? []) {
      if (s.categoryLevel2Id != null) continue
      map.set(s.categoryLevel1Id, (map.get(s.categoryLevel1Id) ?? 0) + 1)
    }
    return map
  }, [shows])
  const cat2UnsetId = (parentId: string) => `unset:${parentId}`
  /** 某个一级类别在筛选树里的全部子项 id：真实二级 + 可能的「未填写」 */
  const categoryChildIds = (parentId: string) => [
    ...(level2ByParent.get(parentId) ?? []).map((c) => c.id),
    ...((unsetCat2ByParent.get(parentId) ?? 0) > 0 ? [cat2UnsetId(parentId)] : [])
  ]
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
    const monthSet = new Set(months)
    const languageSet = new Set(languageIds)
    const channelSet = new Set(channelIds)
    // 评分：'none' 表示未评分；其余为半星档位，按「及以上」或「精确」匹配
    const wantUnrated = ratingLevels.includes('none')
    const ratingTargets = ratingLevels.filter((v) => v !== 'none').map(Number)
    return (shows ?? []).filter((s) => {
      if (statusSet.size > 0 && !statusSet.has(s.status)) return false
      // 类别：一级、二级、二级未填写合并为一组，组内任一匹配（勾一级=涵盖其全部二级）
      if (cat1Set.size > 0 || cat2Set.size > 0) {
        const byCat1 = cat1Set.has(s.categoryLevel1Id)
        const byCat2 = s.categoryLevel2Id != null && cat2Set.has(s.categoryLevel2Id)
        const byCat2Unset =
          s.categoryLevel2Id == null && cat2Set.has(`unset:${s.categoryLevel1Id}`)
        if (!byCat1 && !byCat2 && !byCat2Unset) return false
      }
      // 地点：城市与场馆合并为一组，组内任一匹配（勾城市=涵盖其全部场馆）
      if (citySet.size > 0 || venueSet.size > 0) {
        if (!citySet.has(s.cityId) && !venueSet.has(s.venueId)) return false
      }
      // 时间：年份与月份合并为一组，组内任一匹配（勾年份 = 涵盖该年有演出的全部月份）
      if (yearSet.size > 0 || monthSet.size > 0) {
        if (!yearSet.has(s.date.slice(0, 4)) && !monthSet.has(s.date.slice(0, 7))) return false
      }
      // 价格：区间与「未填写」同组取并集
      const hasPriceRange = priceMin != null || priceMax != null
      if (hasPriceRange || priceUnset) {
        if (s.paidPrice == null) {
          if (!priceUnset) return false
        } else {
          // 只勾了「未填写」时，有价格的记录排除
          if (!hasPriceRange) return false
          if (priceMin != null && s.paidPrice < priceMin) return false
          if (priceMax != null && s.paidPrice > priceMax) return false
        }
      }
      // 语言 / 购票渠道：具体项与「未填写」同组取并集
      if (languageSet.size > 0 || languageUnset) {
        const byLanguage = s.languageId != null && languageSet.has(s.languageId)
        const byLanguageUnset = languageUnset && s.languageId == null
        if (!byLanguage && !byLanguageUnset) return false
      }
      if (channelSet.size > 0 || channelUnset) {
        const byChannel = s.ticketChannelId != null && channelSet.has(s.ticketChannelId)
        const byChannelUnset = channelUnset && s.ticketChannelId == null
        if (!byChannel && !byChannelUnset) return false
      }
      if (ratingLevels.length > 0) {
        if (s.rating == null) {
          if (!wantUnrated) return false
        } else {
          const hit =
            ratingTargets.length > 0 &&
            (ratingMode === 'gte'
              ? ratingTargets.some((lv) => s.rating! >= lv)
              : ratingTargets.some((lv) => Math.abs(s.rating! - lv) < 0.001))
          if (!hit) return false
        }
      }
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
        s.faceForeignAmount != null ? String(s.faceForeignAmount) : '',
        s.paidForeignAmount != null ? String(s.paidForeignAmount) : '',
        s.faceForeignCurrency,
        s.paidForeignCurrency,
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
    months,
    priceMin,
    priceMax,
    priceUnset,
    ratingLevels,
    ratingMode,
    languageIds,
    languageUnset,
    channelIds,
    channelUnset,
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

  /**
   * 时间筛选的树：年份父级（从新到旧）→ 该年「有演出」的月份子级（从小到大）。
   * 只列出真的存在演出记录的月份，空月份不出现。
   */
  const monthsByYear = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const s of shows ?? []) {
      const y = s.date.slice(0, 4)
      if (!y) continue
      const set = map.get(y) ?? new Set<string>()
      const m = s.date.slice(0, 7)
      if (m.length === 7) set.add(m)
      map.set(y, set)
    }
    return new Map(
      [...map.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
        .map(([y, set]) => [y, [...set].sort()] as [string, string[]])
    )
  }, [shows])

  /** 月历年份下拉的候选年份：演出数据覆盖的区间（含今年与当前正在浏览的年份），从新到旧。 */
  const calendarYearOptions = useMemo(() => {
    const dataYears: number[] = []
    for (const s of shows ?? []) {
      const y = Number(s.date.slice(0, 4))
      if (Number.isFinite(y) && y > 0) dataYears.push(y)
    }
    const thisYear = new Date().getFullYear()
    const bounds = dataYears.length > 0 ? [...dataYears, thisYear, year] : [thisYear, year]
    const latest = Math.max(...bounds)
    const earliest = Math.min(...bounds)
    const list: number[] = []
    for (let y = latest; y >= earliest; y--) list.push(y)
    return list
  }, [shows, year])

  // 左列角标：树状分组按「整选/半选的父级数」计数，其他分组按勾选项数计数
  const catPartialParents = level1
    .map((p) => p.id)
    .filter((parentId) => {
      const kids = categoryChildIds(parentId)
      if (kids.length === 0) return false
      const checked = kids.filter((k) => cat2Ids.includes(k)).length
      return checked > 0 && checked < kids.length
    })
  const catPartialCount = catPartialParents.length
  /** 只勾了某个父级下的「未填写」时，父级本身没被选中，要单独计入角标（避免重复计算） */
  const cat2ExtraUnsetCount = cat2Ids.filter(
    (id) =>
      id.startsWith('unset:') &&
      !cat1Ids.includes(id.slice('unset:'.length)) &&
      !catPartialParents.includes(id.slice('unset:'.length))
  ).length
  const cityPartialCount = (cities ?? []).filter((c) => {
    const kids = venuesByCity.get(c.id) ?? []
    if (kids.length === 0) return false
    const checked = kids.filter((v) => venueIds.includes(v.id)).length
    return checked > 0 && checked < kids.length
  }).length
  const timePartialCount = [...monthsByYear.values()].filter((list) => {
    const checked = list.filter((m) => months.includes(m)).length
    return checked > 0 && checked < list.length
  }).length

  // 价格筛选：滑块上限取数据里最高实付价向上取整到 500 的倍数（至少 2000，保证快捷档位够用）
  const priceSliderMax = useMemo(() => {
    let maxPaid = 0
    for (const s of shows ?? []) {
      if (s.paidPrice != null && s.paidPrice > maxPaid) maxPaid = s.paidPrice
    }
    return Math.max(2000, Math.ceil(maxPaid / 500) * 500)
  }, [shows])
  const priceActive = priceMin != null || priceMax != null
  const [dragKnob, setDragKnob] = useState<'min' | 'max' | null>(null)
  const priceRangeRef = useRef<HTMLDivElement | null>(null)
  const sliderMinValue = Math.min(priceMin ?? 0, priceSliderMax)
  const sliderMaxValue = Math.min(priceMax ?? priceSliderMax, priceSliderMax)
  const sliderMinPct = (sliderMinValue / priceSliderMax) * 100
  const sliderMaxPct = (sliderMaxValue / priceSliderMax) * 100
  const unpricedCount = (shows ?? []).filter((s) => s.paidPrice == null).length
  const priceRangeText = priceActive
    ? `${formatMoney(sliderMinValue)} — ${
        priceMax == null ? `¥${priceSliderMax.toLocaleString('zh-CN')}+` : formatMoney(priceMax)
      }`
    : `¥0 — ¥${priceSliderMax.toLocaleString('zh-CN')}+`

  function applyPriceRange(min: number | null, max: number | null) {
    setPriceMin(min)
    setPriceMax(max)
  }

  /** 拖动滑块：两侧互相约束，至少留出 1 元间距。 */
  function handlePriceSlider(which: 'min' | 'max', raw: number) {
    if (which === 'min') setPriceMin(Math.max(0, Math.min(raw, sliderMaxValue - PRICE_STEP)))
    else setPriceMax(Math.max(sliderMinValue + PRICE_STEP, Math.min(raw, priceSliderMax)))
  }

  /** 自绘双滑块：按下位置靠近哪个滑块就拖哪个，点空白处直接跳转。 */
  function priceValueFromX(clientX: number): number {
    const el = priceRangeRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round((ratio * priceSliderMax) / PRICE_STEP) * PRICE_STEP
  }

  function handleRangeDown(e: React.PointerEvent<HTMLDivElement>) {
    const value = priceValueFromX(e.clientX)
    const which =
      Math.abs(value - sliderMinValue) <= Math.abs(value - sliderMaxValue) ? 'min' : 'max'
    setDragKnob(which)
    e.currentTarget.setPointerCapture(e.pointerId)
    handlePriceSlider(which, value)
  }

  function handleRangeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragKnob) return
    handlePriceSlider(dragKnob, priceValueFromX(e.clientX))
  }

  function handleRangeUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDragKnob(null)
  }

  function handlePriceInput(which: 'min' | 'max', raw: string) {
    if (raw.trim() === '') {
      if (which === 'min') setPriceMin(null)
      else setPriceMax(null)
      return
    }
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    const next = Math.max(0, value)
    if (which === 'min') setPriceMin(next)
    else setPriceMax(next)
  }
  const tabCounts: Record<FilterTab, number> = {
    status: statuses.length,
    // 「未填写」子项已计入 cat2Ids，但被选中的父级会连带勾上它，避免重复计数
    category: cat1Ids.length + catPartialCount + cat2ExtraUnsetCount,
    place: cityIds.length + cityPartialCount,
    time: years.length + timePartialCount,
    price: priceMin != null || priceMax != null || priceUnset ? 1 : 0,
    rating: ratingLevels.length,
    language: languageIds.length + (languageUnset ? 1 : 0),
    channel: channelIds.length + (channelUnset ? 1 : 0)
  }
  const activeFilterCount = FILTER_TABS.filter((t) => tabCounts[t.key] > 0).length

  /** 父级是否展开：手动设置优先，否则有勾选子级时自动展开。 */
  function isParentExpanded(id: string, hasCheckedChild: boolean): boolean {
    const manual = expandedParents[id]
    return manual === undefined ? hasCheckedChild : manual
  }

  function toggleParentExpanded(id: string, currentlyOpen: boolean) {
    setExpandedParents((prev) => ({ ...prev, [id]: !currentlyOpen }))
  }
  // 当前条件下的演出数量：无任何筛选/搜索时显示总数
  const totalCount = (shows ?? []).length
  const hasConditions = activeFilterCount > 0 || query.trim() !== ''

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
    setMonths([])
    setPriceMin(null)
    setPriceMax(null)
    setPriceUnset(false)
    setRatingLevels([])
    setLanguageUnset(false)
    setChannelUnset(false)
  }

  // 勾选一级类别 → 同步勾选它下面的全部二级（含「未填写」）；取消则同步取消
  function toggleCat1(id: string, on: boolean) {
    const kids = categoryChildIds(id)
    setCat1Ids((prev) => toggleIn(prev, id, on))
    if (kids.length === 0) return
    setCat2Ids((prev) =>
      on ? [...new Set([...prev, ...kids])] : prev.filter((v) => !kids.includes(v))
    )
  }

  // 勾选二级类别：该父级下全部二级 +「未填写」都勾上时父级才是全选，部分勾选为半选
  function toggleCat2(parentId: string, id: string, on: boolean) {
    const kids = categoryChildIds(parentId)
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

  // 勾选年份 → 同步勾选该年有演出的全部月份；取消则同步取消
  function toggleYear(yearKey: string, on: boolean) {
    const kids = monthsByYear.get(yearKey) ?? []
    setYears((prev) => toggleIn(prev, yearKey, on))
    if (kids.length === 0) return
    setMonths((prev) =>
      on ? [...new Set([...prev, ...kids])] : prev.filter((v) => !kids.includes(v))
    )
  }

  // 勾选月份：该年有演出的月份全部勾上时父级自动全选，部分勾选时父级为半选
  function toggleMonth(yearKey: string, monthKey: string, on: boolean) {
    const kids = monthsByYear.get(yearKey) ?? []
    const next = toggleIn(months, monthKey, on)
    setMonths(next)
    const allChecked = kids.length > 0 && kids.every((k) => next.includes(k))
    setYears((prev) => toggleIn(prev, yearKey, allChecked))
  }

  function MiniPoster({ show }: { show: Show }) {
    const poster = show.poster
    if (poster && (poster.display || poster.thumbnail)) {
      return (
        <PosterThumb
          poster={poster}
          posterCrop={show.posterCrop}
          title={show.title}
          className="cal-poster-img"
        />
      )
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
    setYearMenuOpen(false)
    setMonthMenuOpen(false)
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    setSelectedDate(null)
    setDaySheetOpen(false)
  }

  // 月历：当前是否已经在看本月；「回到今天」跳到本月并清除选中日期
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  function goToday() {
    setYearMenuOpen(false)
    setMonthMenuOpen(false)
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelectedDate(null)
    setDaySheetOpen(false)
  }

  /** 年份下拉：切换年份时保持当前月份，避免跳年后再手动翻月。 */
  function pickYear(nextYear: number) {
    setYearMenuOpen(false)
    setMonthMenuOpen(false)
    if (nextYear === year) return
    setYear(nextYear)
    setSelectedDate(null)
    setDaySheetOpen(false)
  }

  /** 月份下拉：切换月份时保持当前年份。 */
  function pickMonth(nextMonth: number) {
    setMonthMenuOpen(false)
    if (nextMonth === month) return
    setMonth(nextMonth)
    setSelectedDate(null)
    setDaySheetOpen(false)
  }

  // 年份 / 月份下拉：点击外部或按 Esc 关闭
  useEffect(() => {
    if (!yearMenuOpen && !monthMenuOpen) return
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(e.target as Node)) {
        setYearMenuOpen(false)
        setMonthMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setYearMenuOpen(false)
        setMonthMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [yearMenuOpen, monthMenuOpen])

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

      <div className="show-count">
        {hasConditions ? (
          <>
            筛选后 <b>{filtered.length}</b> 场 · 共 {totalCount} 场
          </>
        ) : (
          <>
            共 <b>{totalCount}</b> 场
          </>
        )}
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
                  {show.status === 'upcoming' ? '待观看' : show.status === 'expired' ? '已过期' : '已观看'}
                </span>
              </Link>
            ))}
          </div>
        )
      ) : view === 'calendar' ? (
        <>
          <div className="calendar-head">
            <h2 className="calendar-title" ref={calendarMenuRef}>
              <span className="calendar-year-wrap">
                <button
                  type="button"
                  className="calendar-year"
                  onClick={() => {
                    setMonthMenuOpen(false)
                    setYearMenuOpen((o) => !o)
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={yearMenuOpen}
                  aria-label="选择年份"
                >
                  {year} <span className="calendar-year-chev">▾</span>
                </button>
                {yearMenuOpen && (
                  <span className="calendar-year-menu" role="listbox" aria-label="年份">
                    {calendarYearOptions.map((y) => (
                      <button
                        key={y}
                        type="button"
                        role="option"
                        aria-selected={y === year}
                        className={`calendar-year-opt ${y === year ? 'on' : ''}`}
                        onClick={() => pickYear(y)}
                      >
                        {y} 年
                      </button>
                    ))}
                  </span>
                )}
              </span>{' '}
              年
              <span className="calendar-month-wrap">
                <button
                  type="button"
                  className="calendar-month"
                  onClick={() => {
                    setYearMenuOpen(false)
                    setMonthMenuOpen((o) => !o)
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={monthMenuOpen}
                  aria-label="选择月份"
                >
                  {month + 1} <span className="calendar-month-chev">▾</span>
                </button>
                {monthMenuOpen && (
                  <span className="calendar-month-menu" role="listbox" aria-label="月份">
                    {MONTH_NUMBERS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="option"
                        aria-selected={m - 1 === month}
                        className={`calendar-month-opt ${m - 1 === month ? 'on' : ''}`}
                        onClick={() => pickMonth(m - 1)}
                      >
                        {m} 月
                      </button>
                    ))}
                  </span>
                )}
              </span>
              月
            </h2>
            <div className="calendar-actions">
              <button
                type="button"
                className="calendar-today"
                onClick={goToday}
                disabled={isCurrentMonth}
              >
                回到今天
              </button>
              <div className="calendar-nav">
                <button type="button" className="icon-btn" onClick={() => changeMonth(-1)} aria-label="上个月">
                  ‹
                </button>
                <button type="button" className="icon-btn" onClick={() => changeMonth(1)} aria-label="下个月">
                  ›
                </button>
              </div>
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
                            s.status === 'upcoming'
                              ? 'cal-dot-upcoming'
                              : s.status === 'expired'
                                ? 'cal-dot-expired'
                                : 'cal-dot-watched'
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
              <span className="drawer-count">
                符合条件 <b>{filtered.length}</b> 场
              </span>
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
                    <label className="filter-item">
                      <span className="filter-expired-label">已过期</span>
                      <TriCheckbox
                        checked={statuses.includes('expired')}
                        indeterminate={false}
                        onChange={(on) => setStatuses((prev) => toggleIn(prev, 'expired', on))}
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
                      const childIds = categoryChildIds(parent.id)
                      const hasUnsetChild = (unsetCat2ByParent.get(parent.id) ?? 0) > 0
                      const checkedCount = childIds.filter((id) => cat2Ids.includes(id)).length
                      const allChecked =
                        childIds.length > 0
                          ? checkedCount === childIds.length
                          : cat1Ids.includes(parent.id)
                      const partial =
                        childIds.length > 0 && checkedCount > 0 && checkedCount < childIds.length
                      const open = isParentExpanded(parent.id, checkedCount > 0)
                      return (
                        <Fragment key={parent.id}>
                          <label className="filter-item parent">
                            {childIds.length > 0 ? (
                              <button
                                type="button"
                                className={`filter-expand${open ? ' open' : ''}`}
                                aria-label={open ? '收起' : '展开'}
                                aria-expanded={open}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleParentExpanded(parent.id, open)
                                }}
                              >
                                ›
                              </button>
                            ) : (
                              <span className="filter-expand filter-expand-empty" />
                            )}
                            <span className="filter-parent-name">{parent.name}</span>
                            <TriCheckbox
                              checked={allChecked}
                              indeterminate={partial}
                              onChange={(on) =>
                                childIds.length > 0
                                  ? toggleCat1(parent.id, on)
                                  : setCat1Ids((prev) => toggleIn(prev, parent.id, on))
                              }
                            />
                          </label>
                          {open && kids.map((kid) => (
                            <label key={kid.id} className="filter-item child">
                              <span>{kid.name}</span>
                              <TriCheckbox
                                checked={cat2Ids.includes(kid.id)}
                                indeterminate={false}
                                onChange={(on) => toggleCat2(parent.id, kid.id, on)}
                              />
                            </label>
                          ))}
                          {open && hasUnsetChild && (
                            <label className="filter-item child">
                              <span>未填写</span>
                              <TriCheckbox
                                checked={cat2Ids.includes(cat2UnsetId(parent.id))}
                                indeterminate={false}
                                onChange={(on) =>
                                  toggleCat2(parent.id, cat2UnsetId(parent.id), on)
                                }
                              />
                            </label>
                          )}
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
                      const open = isParentExpanded(cityItem.id, checkedCount > 0)
                      return (
                        <Fragment key={cityItem.id}>
                          <label className="filter-item parent">
                            {kids.length > 0 ? (
                              <button
                                type="button"
                                className={`filter-expand${open ? ' open' : ''}`}
                                aria-label={open ? '收起' : '展开'}
                                aria-expanded={open}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleParentExpanded(cityItem.id, open)
                                }}
                              >
                                ›
                              </button>
                            ) : (
                              <span className="filter-expand filter-expand-empty" />
                            )}
                            <span className="filter-parent-name">{cityItem.name}</span>
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
                          {open && kids.map((venueItem) => (
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

                {filterTab === 'time' && (
                  <>
                    <p className="filter-panel-hint">勾选年份 = 涵盖该年有演出的全部月份</p>
                    {monthsByYear.size === 0 && (
                      <p className="filter-panel-empty">还没有演出记录，暂无时间可筛选</p>
                    )}
                    {[...monthsByYear.entries()].map(([yearKey, monthList]) => {
                      const checkedCount = monthList.filter((m) => months.includes(m)).length
                      const allChecked =
                        monthList.length > 0
                          ? checkedCount === monthList.length
                          : years.includes(yearKey)
                      const partial = checkedCount > 0 && checkedCount < monthList.length
                      const open = isParentExpanded(yearKey, checkedCount > 0)
                      return (
                        <Fragment key={yearKey}>
                          <label className="filter-item parent">
                            {monthList.length > 0 ? (
                              <button
                                type="button"
                                className={`filter-expand${open ? ' open' : ''}`}
                                aria-label={open ? '收起' : '展开'}
                                aria-expanded={open}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleParentExpanded(yearKey, open)
                                }}
                              >
                                ›
                              </button>
                            ) : (
                              <span className="filter-expand filter-expand-empty" />
                            )}
                            <span className="filter-parent-name">{yearKey} 年</span>
                            <TriCheckbox
                              checked={allChecked}
                              indeterminate={partial}
                              onChange={(on) => toggleYear(yearKey, on)}
                            />
                          </label>
                          {open && monthList.map((monthKey) => (
                            <label key={monthKey} className="filter-item child">
                              <span>{Number(monthKey.slice(5))} 月</span>
                              <TriCheckbox
                                checked={months.includes(monthKey)}
                                indeterminate={false}
                                onChange={(on) => toggleMonth(yearKey, monthKey, on)}
                              />
                            </label>
                          ))}
                        </Fragment>
                      )
                    })}
                  </>
                )}

                {filterTab === 'price' && (
                  <>
                    <p className="filter-panel-hint">
                      按人民币实付价格筛选；勾「未填写」可看没填实付价格的记录
                    </p>
                    <p className={`price-range-readout${priceActive ? '' : ' idle'}`}>
                      {priceRangeText}
                    </p>
                    <div
                      className={`price-range${dragKnob ? ' dragging' : ''}`}
                      ref={priceRangeRef}
                      onPointerDown={handleRangeDown}
                      onPointerMove={handleRangeMove}
                      onPointerUp={handleRangeUp}
                      onPointerCancel={handleRangeUp}
                    >
                      <span className="price-range-track" />
                      <span
                        className="price-range-fill"
                        style={{ left: `${sliderMinPct}%`, right: `${100 - sliderMaxPct}%` }}
                      />
                      <span
                        role="slider"
                        tabIndex={0}
                        aria-label="最低实付价"
                        aria-valuemin={0}
                        aria-valuemax={priceSliderMax}
                        aria-valuenow={sliderMinValue}
                        className="price-range-knob"
                        style={{ left: `${sliderMinPct}%` }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                            e.preventDefault()
                            handlePriceSlider('min', sliderMinValue - PRICE_STEP)
                          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                            e.preventDefault()
                            handlePriceSlider('min', sliderMinValue + PRICE_STEP)
                          }
                        }}
                      />
                      <span
                        role="slider"
                        tabIndex={0}
                        aria-label="最高实付价"
                        aria-valuemin={0}
                        aria-valuemax={priceSliderMax}
                        aria-valuenow={sliderMaxValue}
                        className="price-range-knob"
                        style={{ left: `${sliderMaxPct}%` }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                            e.preventDefault()
                            handlePriceSlider('max', sliderMaxValue - PRICE_STEP)
                          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                            e.preventDefault()
                            handlePriceSlider('max', sliderMaxValue + PRICE_STEP)
                          }
                        }}
                      />
                    </div>
                    <div className="price-inputs">
                      <label className="price-input">
                        <span>¥</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={priceMin ?? ''}
                          placeholder="最低"
                          aria-label="最低实付价（输入）"
                          onChange={(e) => handlePriceInput('min', e.target.value)}
                        />
                      </label>
                      <label className="price-input">
                        <span>¥</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={priceMax ?? ''}
                          placeholder="最高"
                          aria-label="最高实付价（输入）"
                          onChange={(e) => handlePriceInput('max', e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="price-presets">
                      {PRICE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className={`price-preset${
                            priceMin === preset.min && priceMax === preset.max ? ' on' : ''
                          }`}
                          onClick={() => applyPriceRange(preset.min, preset.max)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <label className="price-toggle">
                      <span>
                        未填写
                        <small>
                          {priceUnset
                            ? `已勾选：${unpricedCount} 场未填实付价格的记录会一起显示`
                            : `未勾选：${unpricedCount} 场未填实付价格的记录不会出现`}
                        </small>
                      </span>
                      <TriCheckbox
                        checked={priceUnset}
                        indeterminate={false}
                        onChange={(on) => setPriceUnset(on)}
                      />
                    </label>
                  </>
                )}

                {filterTab === 'rating' && (
                  <>
                    <div className="panel-seg">
                      <button
                        type="button"
                        className={ratingMode === 'gte' ? 'on' : ''}
                        onClick={() => setRatingMode('gte')}
                      >
                        及以上
                      </button>
                      <button
                        type="button"
                        className={ratingMode === 'exact' ? 'on' : ''}
                        onClick={() => setRatingMode('exact')}
                      >
                        精确
                      </button>
                    </div>
                    <p className="filter-panel-hint">
                      {ratingMode === 'gte'
                        ? '勾 4.5 = 4.5 星及更高（含 5 星）'
                        : '勾 4.5 = 只显示 4.5 星'}
                    </p>
                    {RATING_LEVELS.map((lv) => (
                      <label key={lv} className="filter-item">
                        <span className="filter-item-with-stars">
                          <span className="filter-rating-value">{lv}</span>
                          <RatingStars value={Number(lv)} />
                        </span>
                        <TriCheckbox
                          checked={ratingLevels.includes(lv)}
                          indeterminate={false}
                          onChange={(on) => setRatingLevels((prev) => toggleIn(prev, lv, on))}
                        />
                      </label>
                    ))}
                    <label className="filter-item">
                      <span className="filter-unrated">未评分</span>
                      <TriCheckbox
                        checked={ratingLevels.includes('none')}
                        indeterminate={false}
                        onChange={(on) => setRatingLevels((prev) => toggleIn(prev, 'none', on))}
                      />
                    </label>
                  </>
                )}

                {filterTab === 'language' && (
                  <>
                    <p className="filter-panel-hint">可同时勾选多种语言</p>
                    {languagesSorted.length === 0 && (
                      <p className="filter-panel-empty">还没有语言，可在设置中添加</p>
                    )}
                    {languagesSorted.map((item) => (
                      <label key={item.id} className="filter-item">
                        <span>{item.name}</span>
                        <TriCheckbox
                          checked={languageIds.includes(item.id)}
                          indeterminate={false}
                          onChange={(on) => setLanguageIds((prev) => toggleIn(prev, item.id, on))}
                        />
                      </label>
                    ))}
                    <label className="filter-item">
                      <span>未填写</span>
                      <TriCheckbox
                        checked={languageUnset}
                        indeterminate={false}
                        onChange={(on) => setLanguageUnset(on)}
                      />
                    </label>
                  </>
                )}

                {filterTab === 'channel' && (
                  <>
                    <p className="filter-panel-hint">可同时勾选多个渠道</p>
                    {channelsSorted.length === 0 && (
                      <p className="filter-panel-empty">还没有购票渠道，可在设置中添加</p>
                    )}
                    {channelsSorted.map((item) => (
                      <label key={item.id} className="filter-item">
                        <span>{item.name}</span>
                        <TriCheckbox
                          checked={channelIds.includes(item.id)}
                          indeterminate={false}
                          onChange={(on) => setChannelIds((prev) => toggleIn(prev, item.id, on))}
                        />
                      </label>
                    ))}
                    <label className="filter-item">
                      <span>未填写</span>
                      <TriCheckbox
                        checked={channelUnset}
                        indeterminate={false}
                        onChange={(on) => setChannelUnset(on)}
                      />
                    </label>
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
                        <PosterThumb
                          poster={poster}
                          posterCrop={show.posterCrop}
                          title={show.title}
                          className="day-sheet-thumb-img"
                        />
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
                    <span className={`status-chip status-${show.status}`}>
                      {show.status === 'upcoming'
                        ? '待观看'
                        : show.status === 'expired'
                          ? '已过期'
                          : '已观看'}
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
