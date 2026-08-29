import type { Category, City, Show, Venue } from '../types'

export interface ShowOverview {
  total: number
  cityCount: number
  venueCount: number
  totalCost: number
  avgRating: number | null
  upcoming: number
}

/** 概览统计：全部数据的场次 / 城市 / 场馆 / 花费 / 评分 / 待观看。 */
export function computeOverview(shows: Show[]): ShowOverview {
  const citySet = new Set<string>()
  const venueSet = new Set<string>()
  let totalCost = 0
  let ratingSum = 0
  let ratingCount = 0
  let upcoming = 0

  for (const s of shows) {
    citySet.add(s.cityId)
    venueSet.add(s.venueId)
    totalCost += s.paidPrice ?? 0
    if (s.rating != null) {
      ratingSum += s.rating
      ratingCount++
    }
    if (s.status === 'upcoming') upcoming++
  }

  return {
    total: shows.length,
    cityCount: citySet.size,
    venueCount: venueSet.size,
    totalCost,
    avgRating: ratingCount ? ratingSum / ratingCount : null,
    upcoming
  }
}

export type PivotDimKey = 'time' | 'cat1' | 'cat2' | 'city' | 'venue'
export type PivotMeasure = 'count' | 'cost' | 'rating'
export type TimeGranularity = 'year' | 'month'

export interface PivotNode {
  name: string
  count: number
  cost: number
  ratingSum: number
  ratingCount: number
  children: PivotNode[]
}

export function measureValue(node: PivotNode, measure: PivotMeasure): number {
  if (measure === 'cost') return node.cost
  if (measure === 'rating') return node.ratingCount ? node.ratingSum / node.ratingCount : 0
  return node.count
}

export function measureLabel(measure: PivotMeasure): string {
  if (measure === 'cost') return '总花费（实付）'
  if (measure === 'rating') return '平均评分'
  return '场次'
}

export const PIVOT_DIM_LABELS: Record<PivotDimKey, string> = {
  time: '时间',
  cat1: '一级类别',
  cat2: '二级类别',
  city: '城市',
  venue: '场馆'
}

function zeroNode(name: string): PivotNode {
  return { name, count: 0, cost: 0, ratingSum: 0, ratingCount: 0, children: [] }
}

/** 时间作为主维度时，把缺失的年/月补成 0 值节点，保证时间轴连续。 */
function fillTimeGaps(root: PivotNode, granularity: TimeGranularity): void {
  if (root.children.length === 0) return
  const names = root.children.map((c) => c.name)
  const years = new Set<number>()
  for (const n of names) {
    const y = Number(n.slice(0, 4))
    if (!Number.isNaN(y)) years.add(y)
  }
  if (years.size === 0) return
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  const seen = new Set(names)
  if (granularity === 'year') {
    // 年粒度：从有演出的最早年份开始，逐年补全到最近年份
    for (let y = minYear; y <= maxYear; y++) {
      const key = String(y)
      if (!seen.has(key)) root.children.push(zeroNode(key))
    }
    return
  }
  // 月粒度：从有演出的最早年份的 1 月起，到最近年份的 12 月止，每年 12 个月全部展示
  for (let y = minYear; y <= maxYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (!seen.has(key)) root.children.push(zeroNode(key))
    }
  }
}

/** 按选中的维度组合做树形聚合；非时间维度按度量降序，时间维度按时间升序。 */
export function computePivot(
  shows: Show[],
  categories: Category[],
  cities: City[],
  venues: Venue[],
  dims: PivotDimKey[],
  granularity: TimeGranularity,
  measure: PivotMeasure
): PivotNode {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '未分类'
  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? '未知城市'
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? '未知场馆'

  const resolve: Record<PivotDimKey, (s: Show) => string> = {
    time: (s) => (granularity === 'year' ? s.date.slice(0, 4) : s.date.slice(0, 7)),
    cat1: (s) => catName(s.categoryLevel1Id),
    cat2: (s) => (s.categoryLevel2Id ? catName(s.categoryLevel2Id) : '未分类'),
    city: (s) => cityName(s.cityId),
    venue: (s) => venueName(s.venueId)
  }

  const root: PivotNode = { name: '', count: 0, cost: 0, ratingSum: 0, ratingCount: 0, children: [] }

  for (const s of shows) {
    let node = root
    for (const dim of dims) {
      const name = resolve[dim](s)
      let child = node.children.find((c) => c.name === name)
      if (!child) {
        child = { name, count: 0, cost: 0, ratingSum: 0, ratingCount: 0, children: [] }
        node.children.push(child)
    }
    node = child
  }
  node.count++
  node.cost += s.paidPrice ?? 0
  if (s.rating != null) {
    node.ratingSum += s.rating
    node.ratingCount++
  }
  }

  // 时间作为主维度（图表 X 轴）时补全缺失的年/月，无数据的时间点以 0 展示
  if (dims[0] === 'time') fillTimeGaps(root, granularity)

  const sortLevel = (node: PivotNode, depth: number) => {
    const isTime = dims[depth] === 'time'
    node.children.sort((a, b) => {
      if (isTime) return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      const diff = measureValue(b, measure) - measureValue(a, measure)
      if (diff !== 0) return diff
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    node.children.forEach((c) => sortLevel(c, depth + 1))
  }
  sortLevel(root, 0)

  const aggregate = (node: PivotNode) => {
    node.children.forEach(aggregate)
    if (node.children.length > 0) {
      node.count = node.children.reduce((sum, c) => sum + c.count, 0)
      node.cost = node.children.reduce((sum, c) => sum + c.cost, 0)
      node.ratingSum = node.children.reduce((sum, c) => sum + c.ratingSum, 0)
      node.ratingCount = node.children.reduce((sum, c) => sum + c.ratingCount, 0)
    }
  }
  aggregate(root)

  return root
}

export interface PivotTableRow {
  key: string
  cells: string[]
  count: number
  cost: number
  rating: number | null
  subtotal: boolean
}

/** 把树展平为层级表格行：叶子行 + 分组小计 + 总计。 */
export function flattenPivot(root: PivotNode, dimCount: number): PivotTableRow[] {
  const rows: PivotTableRow[] = []
  const walk = (node: PivotNode, depth: number, prefix: string[]) => {
    if (node.children.length === 0) {
      const cells = [...prefix, node.name]
      while (cells.length < dimCount) cells.push('')
      rows.push({
        key: [...prefix, node.name].join('/'),
        cells,
        count: node.count,
        cost: node.cost,
        rating: node.ratingCount ? node.ratingSum / node.ratingCount : null,
        subtotal: false
      })
      return
    }
    for (const child of node.children) walk(child, depth + 1, [...prefix, node.name])
    if (depth > 0) {
      const cells = [...prefix, `${node.name} 小计`]
      while (cells.length < dimCount) cells.push('')
      rows.push({
        key: [...prefix, node.name, '$sub'].join('/'),
        cells,
        count: node.count,
        cost: node.cost,
        rating: node.ratingCount ? node.ratingSum / node.ratingCount : null,
        subtotal: true
      })
    }
  }
  for (const child of root.children) walk(child, 1, [])
  const totalCells = ['总计']
  while (totalCells.length < dimCount) totalCells.push('')
  rows.push({
    key: '$total',
    cells: totalCells,
    count: root.count,
    cost: root.cost,
    rating: root.ratingCount ? root.ratingSum / root.ratingCount : null,
    subtotal: true
  })
  return rows
}
