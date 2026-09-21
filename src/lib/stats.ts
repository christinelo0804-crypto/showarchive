import type { Category, City, Show, Venue } from '../types'
import { paidRatio } from './format'

export interface ShowOverview {
  total: number
  cityCount: number
  venueCount: number
  totalCost: number
  /** 票面合计（用于概览里的实付率） */
  totalFaceCost: number
  avgRating: number | null
  upcoming: number
}

/** 概览统计：全部数据的场次 / 城市 / 场馆 / 花费 / 评分 / 待观看。 */
export function computeOverview(shows: Show[]): ShowOverview {
  const citySet = new Set<string>()
  const venueSet = new Set<string>()
  let totalCost = 0
  let totalFaceCost = 0
  let ratingSum = 0
  let ratingCount = 0
  let upcoming = 0

  for (const s of shows) {
    citySet.add(s.cityId)
    venueSet.add(s.venueId)
    totalCost += s.paidPrice ?? 0
    totalFaceCost += s.faceValue ?? 0
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
    totalFaceCost,
    avgRating: ratingCount ? ratingSum / ratingCount : null,
    upcoming
  }
}

/** 价格档位：价格筛选与透视的「实付价区间」维度共用同一套。 */
export const PRICE_BUCKETS = [
  { label: '≤200', max: 200 },
  { label: '200–500', max: 500 },
  { label: '500–1000', max: 1000 },
  { label: '1000–2000', max: 2000 },
  { label: '>2000', max: Number.POSITIVE_INFINITY }
]
export const PRICE_UNSPECIFIED = '未填价格'
export const PRICE_BUCKET_LABELS = [...PRICE_BUCKETS.map((b) => b.label), PRICE_UNSPECIFIED]

export function priceBucketLabel(value?: number): string {
  if (value == null) return PRICE_UNSPECIFIED
  for (const bucket of PRICE_BUCKETS) if (value <= bucket.max) return bucket.label
  return PRICE_UNSPECIFIED
}

/** 实付率区间：默认五档 + 无法计算的兜底档。 */
export const RATIO_BUCKET_LABELS = ['<80%', '80–99.9%', '100%', '100.1–120%', '>120%', '无票面价']

export function ratioBucketLabel(paid?: number, face?: number): string {
  const ratio = paidRatio(paid, face)
  if (ratio == null) return '无票面价'
  if (ratio < 80) return '<80%'
  if (ratio < 100) return '80–99.9%'
  if (ratio <= 100) return '100%'
  if (ratio <= 120) return '100.1–120%'
  return '>120%'
}

export type PivotDimKey =
  | 'time'
  | 'cat1'
  | 'cat2'
  | 'city'
  | 'venue'
  | 'paidBucket'
  | 'ratioBucket'
export type PivotMeasure = 'count' | 'cost' | 'rating' | 'diff' | 'ratio'
export type TimeGranularity = 'year' | 'month'

export interface PivotNode {
  name: string
  count: number
  cost: number
  faceCost: number
  ratingSum: number
  ratingCount: number
  children: PivotNode[]
}

export function measureValue(node: PivotNode, measure: PivotMeasure): number | null {
  if (measure === 'cost') return node.cost
  if (measure === 'rating') return node.ratingCount ? node.ratingSum / node.ratingCount : 0
  if (measure === 'diff') {
    // 时间维度上补出来的空月份：没有记录就是 0，保持时间轴连续
    if (node.count === 0) return 0
    // 有记录但整组没有票面时算不出来，与实付率保持一致
    return node.faceCost > 0 ? node.cost - node.faceCost : null
  }
  if (measure === 'ratio') return node.faceCost > 0 ? (node.cost / node.faceCost) * 100 : null
  return node.count
}

export function measureLabel(measure: PivotMeasure): string {
  if (measure === 'cost') return '总花费（实付）'
  if (measure === 'rating') return '平均评分'
  if (measure === 'diff') return '差价'
  if (measure === 'ratio') return '实付率'
  return '场次'
}

export const PIVOT_DIM_LABELS: Record<PivotDimKey, string> = {
  time: '时间',
  cat1: '一级类别',
  cat2: '二级类别',
  city: '城市',
  venue: '场馆',
  paidBucket: '实付价区间',
  ratioBucket: '实付率区间'
}

function zeroNode(name: string): PivotNode {
  return { name, count: 0, cost: 0, faceCost: 0, ratingSum: 0, ratingCount: 0, children: [] }
}

/** 区间类维度的固定排序序号（不按度量大小排）。 */
function bucketOrder(dim: PivotDimKey, name: string): number | null {
  const list = dim === 'paidBucket' ? PRICE_BUCKET_LABELS : dim === 'ratioBucket' ? RATIO_BUCKET_LABELS : null
  if (!list) return null
  const index = list.indexOf(name)
  return index < 0 ? list.length : index
}

/** 区间维度作为主维度时，把没有记录的档位补成 0，保证分布完整。 */
function fillBucketGaps(root: PivotNode, dim: PivotDimKey): void {
  const list = dim === 'paidBucket' ? PRICE_BUCKET_LABELS : dim === 'ratioBucket' ? RATIO_BUCKET_LABELS : null
  if (!list) return
  const seen = new Set(root.children.map((c) => c.name))
  for (const label of list) {
    if (!seen.has(label)) root.children.push(zeroNode(label))
  }
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
    venue: (s) => venueName(s.venueId),
    paidBucket: (s) => priceBucketLabel(s.paidPrice),
    ratioBucket: (s) => ratioBucketLabel(s.paidPrice, s.faceValue)
  }

  const root: PivotNode = {
    name: '',
    count: 0,
    cost: 0,
    faceCost: 0,
    ratingSum: 0,
    ratingCount: 0,
    children: []
  }

  for (const s of shows) {
    let node = root
    for (const dim of dims) {
      const name = resolve[dim](s)
      let child = node.children.find((c) => c.name === name)
      if (!child) {
        child = {
          name,
          count: 0,
          cost: 0,
          faceCost: 0,
          ratingSum: 0,
          ratingCount: 0,
          children: []
        }
        node.children.push(child)
    }
    node = child
  }
  node.count++
  node.cost += s.paidPrice ?? 0
  node.faceCost += s.faceValue ?? 0
  if (s.rating != null) {
    node.ratingSum += s.rating
    node.ratingCount++
  }
  }

  // 时间作为主维度（图表 X 轴）时补全缺失的年/月，无数据的时间点以 0 展示
  if (dims[0] === 'time') fillTimeGaps(root, granularity)
  // 区间维度作为主维度时补全缺失档位，分布图才完整
  if (dims[0] === 'paidBucket' || dims[0] === 'ratioBucket') fillBucketGaps(root, dims[0])

  const sortLevel = (node: PivotNode, depth: number) => {
    const dim = dims[depth]
    const isTime = dim === 'time'
    node.children.sort((a, b) => {
      if (isTime) return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      const orderA = bucketOrder(dim, a.name)
      if (orderA != null) {
        const orderB = bucketOrder(dim, b.name) ?? orderA
        return orderA - orderB
      }
      const diff = (measureValue(b, measure) ?? -Infinity) - (measureValue(a, measure) ?? -Infinity)
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
      node.faceCost = node.children.reduce((sum, c) => sum + c.faceCost, 0)
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
  faceCost: number
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
        faceCost: node.faceCost,
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
        faceCost: node.faceCost,
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
    faceCost: root.faceCost,
    rating: root.ratingCount ? root.ratingSum / root.ratingCount : null,
    subtotal: true
  })
  return rows
}
