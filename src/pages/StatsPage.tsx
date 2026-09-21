import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { activeShows } from '../db/repositories'
import { useCachedLiveQuery } from '../lib/liveCache'
import { Chart } from '../components/Chart'
import { Select } from '../components/Select'
import { EmptyState, PageHeader, SectionTitle } from '../components/ui'
import {
  computeOverview,
  computePivot,
  flattenPivot,
  measureLabel,
  measureValue,
  PIVOT_DIM_LABELS
} from '../lib/stats'
import type { PivotDimKey, PivotMeasure, PivotNode, TimeGranularity } from '../lib/stats'
import { formatMoney, formatRatio, formatSignedMoney, paidRatio } from '../lib/format'

const DIM_KEYS: PivotDimKey[] = [
  'time',
  'cat1',
  'cat2',
  'city',
  'venue',
  'paidBucket',
  'ratioBucket'
]
const MAX_DIMS = 3
const PIE_MAX = 8
const STACK_MAX = 4
/** 图例字号与单条目估算（用于按容器宽度计算图例会占几行） */
const LEGEND_FONT = 11
const LEGEND_ITEM_GAP = 10
/** 图例行高：ECharts 的纵向行距约为图标高(8) + itemGap(10) + 余量，实测约 22px */
const LEGEND_ROW_H = 22

let measureCtx: CanvasRenderingContext2D | null | undefined

/** 用真实字体度量图例文字宽度（拿不到 canvas 时退化为按字符估算）。 */
function measureLegendText(text: string): number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d')
  }
  if (!measureCtx) {
    let fallback = 0
    for (const ch of text) {
      fallback += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? LEGEND_FONT : LEGEND_FONT * 0.75
    }
    return fallback
  }
  measureCtx.font = `${LEGEND_FONT}px -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  return measureCtx.measureText(text).width
}

/** 一个图例条目的总宽度：图标 + 图标与文字间距 + 文字 + 条目间距。 */
function legendItemWidth(text: string): number {
  // 乘 1.08 作为安全系数：不同设备/字体的实际字宽略有差异，宁可多留一行也不要压住图形
  return 8 + 5 + measureLegendText(text) * 1.08 + LEGEND_ITEM_GAP
}

/** 按容器宽度估算图例会占几行（贪心换行，与 ECharts 行为近似）。 */
function estimateLegendRows(items: string[], width: number): number {
  const available = Math.max(120, width - 16)
  let rows = 1
  let lineWidth = 0
  for (const item of items) {
    const w = legendItemWidth(item)
    if (lineWidth === 0) lineWidth = w
    else if (lineWidth + w <= available) lineWidth += w
    else {
      rows += 1
      lineWidth = w
    }
  }
  return rows
}

/** 次级维度排名：按 |度量| 之和取前 STACK_MAX 个，其余归入「其他」。 */
function rankSecondary(
  pivot: PivotNode,
  measure: PivotMeasure
): { kept: string[]; dropped: string[] } {
  const weight = new Map<string, number>()
  for (const p of pivot.children) {
    for (const c of p.children) {
      weight.set(c.name, (weight.get(c.name) ?? 0) + Math.abs(measureValue(c, measure) ?? 0))
    }
  }
  const sorted = [...weight.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')
  )
  return {
    kept: sorted.slice(0, STACK_MAX).map(([name]) => name),
    dropped: sorted.slice(STACK_MAX).map(([name]) => name)
  }
}

/** 图例的高度（含上下留白），用于给饼图让位。 */
function legendHeightOf(rows: number): number {
  return rows * LEGEND_ROW_H + 6
}

/** 饼图绘图区基准高度：图例占多少行都不压缩饼图本身。 */
const PIE_BASE_HEIGHT = 250

type ChartKind = 'bar' | 'line' | 'pie'

function availableChartKinds(dims: PivotDimKey[], measure: PivotMeasure): ChartKind[] {
  if (dims.length === 1) {
    if (dims[0] === 'time') return ['bar', 'line']
    // 平均评分、差价、实付率都不适合做占比，禁用饼图
    const noPie = measure === 'rating' || measure === 'diff' || measure === 'ratio'
    return noPie ? ['bar'] : ['bar', 'pie']
  }
  if (dims.length === 2) return ['bar', 'line']
  return []
}

function nodeValue(node: PivotNode, measure: PivotMeasure): number | null {
  return measureValue(node, measure)
}

/** 差价列的正负配色。 */
function diffTone(row: { cost: number; faceCost: number }): string {
  if (row.faceCost <= 0) return ''
  const diff = row.cost - row.faceCost
  return diff > 0 ? 'num-over' : diff < 0 ? 'num-under' : ''
}

function formatCell(
  row: { count: number; cost: number; faceCost: number; rating: number | null },
  measure: PivotMeasure
): string {
  if (measure === 'cost') return formatMoney(row.cost)
  if (measure === 'rating') return row.rating == null ? '—' : row.rating.toFixed(1)
  if (measure === 'diff') {
    if (row.count === 0) return formatMoney(0)
    return row.faceCost > 0 ? formatSignedMoney(row.cost - row.faceCost) : '—'
  }
  if (measure === 'ratio') return formatRatio(paidRatio(row.cost, row.faceCost))
  return String(row.count)
}

/** 图表 tooltip 里的数值格式；空值统一显示「—」，避免出现 null / undefined。 */
function formatMeasureValue(value: unknown, measure: PivotMeasure): string {
  if (value == null) return '—'
  if (measure === 'cost') return formatMoney(Number(value))
  if (measure === 'rating') return Number(value).toFixed(1)
  if (measure === 'diff') return formatSignedMoney(Number(value))
  if (measure === 'ratio') return formatRatio(Number(value))
  return String(value)
}

/**
 * 把若干节点合并成一个「其他」值：按度量各自的正确口径聚合，
 * 而不是把各组的比率 / 平均分直接相加。
 */
function aggregateNodes(nodes: PivotNode[], measure: PivotMeasure): number | null {
  // 空分组：比率算不出来（留空档），其余度量按 0 显示
  if (nodes.length === 0) return measure === 'ratio' ? null : 0
  const count = nodes.reduce((sum, n) => sum + n.count, 0)
  const cost = nodes.reduce((sum, n) => sum + n.cost, 0)
  const faceCost = nodes.reduce((sum, n) => sum + n.faceCost, 0)
  switch (measure) {
    case 'count':
      return count
    case 'cost':
      return cost
    case 'diff':
      return faceCost > 0 ? cost - faceCost : null
    case 'ratio':
      return faceCost > 0 ? (cost / faceCost) * 100 : null
    default: {
      const ratingSum = nodes.reduce((sum, n) => sum + n.ratingSum, 0)
      const ratingCount = nodes.reduce((sum, n) => sum + n.ratingCount, 0)
      return ratingCount ? ratingSum / ratingCount : 0
    }
  }
}

/** 差价 / 实付率度量时，明细表附带「票面合计 / 实付合计」两列便于核对。 */
const NEEDS_AMOUNT_COLUMNS: PivotMeasure[] = ['diff', 'ratio']

export default function StatsPage() {
  const isLight = document.documentElement.dataset.theme === 'light'
  const AMBER = isLight ? '#b07a35' : '#d9a05b'
  const AMBER_RAMP = isLight
    ? [
        '#b07a35',
        'rgba(176,122,53,0.72)',
        'rgba(176,122,53,0.5)',
        'rgba(176,122,53,0.34)',
        'rgba(176,122,53,0.24)',
        'rgba(176,122,53,0.18)'
      ]
    : [
        '#d9a05b',
        'rgba(217,160,91,0.72)',
        'rgba(217,160,91,0.5)',
        'rgba(217,160,91,0.34)',
        'rgba(217,160,91,0.24)',
        'rgba(217,160,91,0.18)'
      ]
  const axisLabel = { color: isLight ? 'rgba(46,40,28,0.55)' : 'rgba(245,239,230,0.55)', fontSize: 11 }
  const axisLine = { lineStyle: { color: isLight ? 'rgba(46,40,28,0.22)' : 'rgba(245,239,230,0.18)' } }
  const splitLine = { lineStyle: { color: isLight ? 'rgba(46,40,28,0.08)' : 'rgba(245,239,230,0.07)' } }
  const tooltipStyle = isLight
    ? {
        backgroundColor: 'rgba(255,253,248,0.97)',
        borderColor: 'rgba(82,68,47,0.2)',
        textStyle: { color: '#2e281c', fontSize: 12 }
      }
    : {
        backgroundColor: 'rgba(20,22,42,0.96)',
        borderColor: 'rgba(245,239,230,0.15)',
        textStyle: { color: '#F5EFE6', fontSize: 12 }
      }
  const pieBorder = isLight ? '#f6f2e9' : '#1A1A2E'
  const otherColor = isLight ? 'rgba(46,40,28,0.18)' : 'rgba(236,230,220,0.24)'

  const shows = useCachedLiveQuery('shows:active', () => activeShows())
  const categories = useCachedLiveQuery('categories', () => db.categories.toArray())
  const cities = useCachedLiveQuery('cities', () => db.cities.toArray())
  const venues = useCachedLiveQuery('venues', () => db.venues.toArray())

  const [dims, setDims] = useState<PivotDimKey[]>(['time', 'cat1'])
  const [granularity, setGranularity] = useState<TimeGranularity>('month')
  const [measure, setMeasure] = useState<PivotMeasure>('count')
  const [chartKind, setChartKind] = useState<ChartKind>('bar')
  const [overviewYear, setOverviewYear] = useState('all')
  const [pivotYear, setPivotYear] = useState('all')
  // 图表容器宽度：图例会占几行取决于宽度，需要由 Chart 回报后再算布局
  const [chartWidth, setChartWidth] = useState(358)

  const all = shows ?? []
  const yearOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of all) {
      const y = s.date.slice(0, 4)
      if (y) set.add(y)
    }
    const years = [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    return [{ value: 'all', label: '全部年份' }, ...years.map((y) => ({ value: y, label: y }))]
  }, [all])
  const overviewShows = useMemo(
    () => (overviewYear === 'all' ? all : all.filter((s) => s.date.slice(0, 4) === overviewYear)),
    [all, overviewYear]
  )
  const pivotShows = useMemo(
    () => (pivotYear === 'all' ? all : all.filter((s) => s.date.slice(0, 4) === pivotYear)),
    [all, pivotYear]
  )
  const stats = useMemo(
    () => computeOverview(overviewShows),
    [overviewShows]
  )
  const pivot = useMemo(
    () => computePivot(pivotShows, categories ?? [], cities ?? [], venues ?? [], dims, granularity, measure),
    [pivotShows, categories, cities, venues, dims, granularity, measure]
  )
  const rows = useMemo(() => flattenPivot(pivot, dims.length), [pivot, dims.length])

  const kinds = availableChartKinds(dims, measure)
  const effectiveKind = kinds.includes(chartKind) ? chartKind : 'bar'

  // 图例条目（与实际渲染保持一致）：饼图取扇区名，双维度取次级维度名
  const legendItems = useMemo(() => {
    if (dims.length === 0 || dims.length > 2) return []
    if (effectiveKind === 'pie') {
      const nodes = pivot.children
      const names = nodes.slice(0, PIE_MAX).map((n) => n.name)
      if (nodes.length > PIE_MAX) names.push('其他')
      return names
    }
    if (dims.length === 2) {
      const { kept, dropped } = rankSecondary(pivot, measure)
      return dropped.length > 0 ? [...kept, '其他'] : kept
    }
    return []
  }, [pivot, dims, measure, effectiveKind])
  const legendRows = legendItems.length > 0 ? estimateLegendRows(legendItems, chartWidth) : 1
  // 图例多一行就多给一行高度，绘图区不被压缩
  const chartHeight =
    effectiveKind === 'pie'
      ? PIE_BASE_HEIGHT + legendHeightOf(legendRows)
      : 280 + (legendRows - 1) * LEGEND_ROW_H

  function toggleDim(key: PivotDimKey) {
    setDims((prev) => {
      if (prev.includes(key)) return prev.filter((d) => d !== key)
      if (prev.length >= MAX_DIMS) return prev
      return [...prev, key]
    })
  }

  function pickMeasure(m: PivotMeasure) {
    setMeasure(m)
    if (m !== 'count' && m !== 'cost' && chartKind === 'pie') setChartKind('bar')
  }

  const chartOption = useMemo(() => {
    if (dims.length === 0 || dims.length > 2) return null

    const tooltip = {
      trigger: dims.length === 1 && effectiveKind === 'pie' ? ('item' as const) : ('axis' as const),
      ...tooltipStyle,
      valueFormatter: (value: unknown) => formatMeasureValue(value, measure)
    }
    // 实付率是百分比轴，差价是金额轴
    const valueAxisLabel =
      measure === 'ratio'
        ? { ...axisLabel, formatter: (value: number) => `${value}%` }
        : axisLabel
    const commonGrid = { left: 8, right: 8, top: 30, bottom: 0, containLabel: true }

    if (dims.length === 1) {
      const nodes = pivot.children
      const values = nodes.map((n) => nodeValue(n, measure))
      const isTime = dims[0] === 'time'

      if (effectiveKind === 'pie') {
        const keptNodes = nodes.slice(0, PIE_MAX)
        const restNodes = nodes.slice(PIE_MAX)
        const data = keptNodes.map((n, i) => ({
          name: n.name,
          value: nodeValue(n, measure) ?? 0,
          itemStyle: { color: AMBER_RAMP[i % AMBER_RAMP.length] }
        }))
        // 只要有被截断的分类就补「其他」，不按数值正负判断
        if (restNodes.length > 0) {
          data.push({
            name: '其他',
            value: restNodes.reduce((sum, n) => sum + (nodeValue(n, measure) ?? 0), 0),
            itemStyle: { color: otherColor }
          })
        }
        // D3：按图例行数加高图表，并把饼图圆心按「扣除图例后的高度」重新定位，避免图例压住饼图
        const available = chartHeight - legendHeightOf(legendRows)
        const outerRadius = Math.min(chartWidth, available) * 0.34
        return {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'item', ...tooltipStyle },
          legend: {
            data: data.map((d) => d.name),
            bottom: 0,
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: LEGEND_ITEM_GAP,
            padding: 0,
            textStyle: { color: isLight ? 'rgba(46,40,28,0.65)' : 'rgba(245,239,230,0.65)', fontSize: 11 }
          },
          series: [
            {
              type: 'pie',
              radius: [outerRadius * 0.6, outerRadius],
              center: ['50%', available / 2],
              itemStyle: { borderColor: pieBorder, borderWidth: 2 },
              label: { color: isLight ? 'rgba(46,40,28,0.7)' : 'rgba(245,239,230,0.7)', fontSize: 11 },
              data
            }
          ]
        }
      }

      return {
        backgroundColor: 'transparent',
        grid: commonGrid,
        tooltip,
        xAxis: {
          type: 'category',
          data: nodes.map((n) => n.name),
          axisLine,
          axisTick: { show: false },
          axisLabel
        },
        yAxis: {
          type: 'value',
          splitLine,
          axisLabel: valueAxisLabel,
          minInterval: measure === 'count' ? 1 : undefined
        },
        series: [
          {
            // 不给名字时 ECharts 的 tooltip 会把系列名渲染成 undefined
            name: measureLabel(measure),
            type: effectiveKind,
            data: values,
            smooth: effectiveKind === 'line',
            symbol: effectiveKind === 'line' ? 'circle' : undefined,
            symbolSize: 5,
            itemStyle: { color: AMBER, borderRadius: effectiveKind === 'bar' ? [6, 6, 0, 0] : 0 },
            barMaxWidth: isTime ? 22 : 28
          }
        ]
      }
    }

    // 双维度：主维度为 X 轴，次级维度 Top N（超出部分归入「其他」）
    const primary = pivot.children
    // 用绝对值排序：差价可能为负（折扣），不能让折扣多的分类被排到末尾
    const { kept, dropped } = rankSecondary(pivot, measure)
    const seriesDefs = kept.map((name) => ({ name, match: (c: PivotNode) => c.name === name }))
    if (dropped.length > 0) {
      // 只要有被截断的分类就必须补「其他」，否则它们会整类消失（差价为负时曾经如此）
      const droppedNames = new Set(dropped)
      seriesDefs.push({ name: '其他', match: (c: PivotNode) => droppedNames.has(c.name) })
    }
    // 只有可加的度量才堆叠；实付率 / 平均评分 / 差价用分组柱或折线，避免把比率相加
    const stacked = measure === 'count' || measure === 'cost'

    const series = seriesDefs.map((def, i) => ({
      name: def.name,
      type: effectiveKind,
      smooth: effectiveKind === 'line',
      symbol: effectiveKind === 'line' ? 'circle' : undefined,
      symbolSize: 5,
      stack: effectiveKind === 'bar' && stacked ? 'total' : undefined,
      itemStyle: { color: AMBER_RAMP[i % AMBER_RAMP.length], borderRadius: effectiveKind === 'bar' ? [3, 3, 0, 0] : 0 },
      data: primary.map((p) => aggregateNodes(p.children.filter(def.match), measure))
    }))

    return {
      backgroundColor: 'transparent',
      // 方案 A：图例占几行就往下让几行，图例不会压住绘图区
      grid: { ...commonGrid, top: 8 + legendRows * LEGEND_ROW_H },
      tooltip,
      legend: {
        data: seriesDefs.map((d) => d.name),
        top: 0,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: LEGEND_ITEM_GAP,
        padding: 0,
        textStyle: { color: isLight ? 'rgba(46,40,28,0.65)' : 'rgba(245,239,230,0.65)', fontSize: 11 }
      },
      xAxis: {
        type: 'category',
        data: primary.map((p) => p.name),
        axisLine,
        axisTick: { show: false },
        axisLabel
      },
      yAxis: {
        type: 'value',
        splitLine,
        axisLabel: valueAxisLabel,
        minInterval: measure === 'count' ? 1 : undefined
      },
      series
    }
  }, [pivot, dims, measure, effectiveKind, legendRows, chartHeight, chartWidth])

  const dimTitle = dims.map((d) => PIVOT_DIM_LABELS[d]).join(' × ')
  const chartTitle = dims.length ? `${dimTitle} · ${measureLabel(measure)}` : '透视分析'

  return (
    <div className="page">
      <PageHeader eyebrow="Statistics" title="统计" />

      {stats.total === 0 ? (
        shows === undefined ? (
          <p className="muted">读取中…</p>
        ) : (
          <EmptyState title="还没有记录" hint="新增第一条演出记录后，这里会出现统计与透视分析。" />
        )
      ) : (
        <>
          <section className="form-section">
            <SectionTitle
              kicker="Overview"
              action={
                <Select
                  value={overviewYear}
                  onChange={setOverviewYear}
                  options={yearOptions}
                  ariaLabel="概览年度筛选"
                />
              }
            >
              概览
            </SectionTitle>
            <div className="stat-grid">
              <div className="stat-card">
                <p className="stat-number">{stats.total}</p>
                <p className="stat-label">演出场次</p>
              </div>
              <div className="stat-card">
                <p className="stat-number">{stats.cityCount}</p>
                <p className="stat-label">城市</p>
              </div>
              <div className="stat-card">
                <p className="stat-number">{stats.venueCount}</p>
                <p className="stat-label">场馆</p>
              </div>
              <div className="stat-card">
                <p className="stat-number">{formatMoney(stats.totalCost)}</p>
                <p className="stat-label">总花费（实付）</p>
                {stats.totalFaceCost > 0 && (
                  <p className="stat-sub">
                    实付率 {formatRatio(paidRatio(stats.totalCost, stats.totalFaceCost))}
                  </p>
                )}
              </div>
              <div className="stat-card">
                <p className="stat-number">{stats.avgRating == null ? '—' : stats.avgRating.toFixed(1)}</p>
                <p className="stat-label">平均评分</p>
              </div>
              <div className="stat-card">
                <p className="stat-number">{stats.upcoming}</p>
                <p className="stat-label">待观看</p>
              </div>
            </div>
          </section>

          <section className="form-section">
            <SectionTitle
              kicker="Pivot"
              action={
                <Select
                  value={pivotYear}
                  onChange={setPivotYear}
                  options={yearOptions}
                  ariaLabel="透视分析年度筛选"
                />
              }
            >
              透视分析
            </SectionTitle>

            <div className="pivot-controls">
              <div className="pivot-field">
                <span className="pivot-label">维度</span>
                <div className="pivot-chips">
                  {DIM_KEYS.map((key) => {
                    const idx = dims.indexOf(key)
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`pivot-chip${idx >= 0 ? ' on' : ''}`}
                        onClick={() => toggleDim(key)}
                        aria-pressed={idx >= 0}
                      >
                        {idx >= 0 && <span className="pivot-chip-ord">{idx + 1}</span>}
                        {PIVOT_DIM_LABELS[key]}
                        {idx >= 0 && <span className="pivot-chip-x">✕</span>}
                      </button>
                    )
                  })}
                </div>
                <span className="pivot-hint">点击选择/取消，按选择顺序分组，最多 3 个</span>
              </div>

              {dims.includes('time') && (
                <div className="pivot-field">
                  <span className="pivot-label">时间粒度</span>
                  <div className="segmented">
                    <button
                      type="button"
                      className={granularity === 'year' ? 'seg-active' : ''}
                      onClick={() => setGranularity('year')}
                    >
                      年
                    </button>
                    <button
                      type="button"
                      className={granularity === 'month' ? 'seg-active' : ''}
                      onClick={() => setGranularity('month')}
                    >
                      月
                    </button>
                  </div>
                </div>
              )}

              <div className="pivot-field">
                <span className="pivot-label">度量</span>
                <div className="segmented">
                  <button type="button" className={measure === 'count' ? 'seg-active' : ''} onClick={() => pickMeasure('count')}>
                    场次
                  </button>
                  <button type="button" className={measure === 'cost' ? 'seg-active' : ''} onClick={() => pickMeasure('cost')}>
                    总花费（实付）
                  </button>
                  <button type="button" className={measure === 'rating' ? 'seg-active' : ''} onClick={() => pickMeasure('rating')}>
                    平均评分
                  </button>
                  <button type="button" className={measure === 'diff' ? 'seg-active' : ''} onClick={() => pickMeasure('diff')}>
                    差价
                  </button>
                  <button type="button" className={measure === 'ratio' ? 'seg-active' : ''} onClick={() => pickMeasure('ratio')}>
                    实付率
                  </button>
                </div>
              </div>

              {dims.length >= 1 && dims.length <= 2 && (
                <div className="pivot-field">
                  <span className="pivot-label">图表</span>
                  <div className="segmented">
                    <button
                      type="button"
                      className={effectiveKind === 'bar' ? 'seg-active' : ''}
                      onClick={() => setChartKind('bar')}
                      disabled={!kinds.includes('bar')}
                    >
                      柱状
                    </button>
                    <button
                      type="button"
                      className={effectiveKind === 'line' ? 'seg-active' : ''}
                      onClick={() => setChartKind('line')}
                      disabled={!kinds.includes('line')}
                    >
                      折线
                    </button>
                    <button
                      type="button"
                      className={effectiveKind === 'pie' ? 'seg-active' : ''}
                      onClick={() => setChartKind('pie')}
                      disabled={!kinds.includes('pie')}
                    >
                      饼图
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pivot-result">
              {dims.length === 0 ? (
                <p className="pivot-empty">请先选择至少一个维度。</p>
              ) : (
                <>
                  {dims.length >= 3 && <p className="pivot-empty">三个及以上维度仅展示层级明细表。</p>}
                  {chartOption && (
                    <div className="pivot-chart">
                      <div className="pivot-chart-head">
                        <span className="pivot-chart-title">{chartTitle}</span>
                        <span className="pivot-chart-notes">
                          {pivotYear !== 'all' && <span className="pivot-chart-note">{pivotYear} 年</span>}
                          {dims.length === 2 && <span className="pivot-chart-note">次级维度 Top {STACK_MAX}</span>}
                        </span>
                      </div>
                      <Chart option={chartOption} height={chartHeight} onWidth={setChartWidth} />
                    </div>
                  )}
                  <div className="pivot-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {dims.map((d) => (
                            <th key={d}>{PIVOT_DIM_LABELS[d]}</th>
                          ))}
                          <th className="num">{measureLabel(measure)}</th>
                          {NEEDS_AMOUNT_COLUMNS.includes(measure) && (
                            <>
                              <th className="num">票面合计</th>
                              <th className="num">实付合计</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.key} className={r.subtotal ? 'pivot-subtotal' : ''}>
                            {r.cells.map((cell, i) => (
                              <td key={i} className={i > 0 ? 'pivot-lv' : ''}>
                                {cell}
                              </td>
                            ))}
                            <td className={`num ${measure === 'diff' ? diffTone(r) : ''}`}>
                              {formatCell(r, measure)}
                            </td>
                            {NEEDS_AMOUNT_COLUMNS.includes(measure) && (
                              <>
                                <td className="num">{formatMoney(r.faceCost)}</td>
                                <td className="num">{formatMoney(r.cost)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
