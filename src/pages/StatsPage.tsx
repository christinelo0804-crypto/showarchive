import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { activeShows } from '../db/repositories'
import { Chart } from '../components/Chart'
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
import { formatMoney } from '../lib/format'

const DIM_KEYS: PivotDimKey[] = ['time', 'cat1', 'cat2', 'city', 'venue']
const MAX_DIMS = 3
const PIE_MAX = 8
const STACK_MAX = 4

type ChartKind = 'bar' | 'line' | 'pie'

function availableChartKinds(dims: PivotDimKey[], measure: PivotMeasure): ChartKind[] {
  if (dims.length === 1) {
    if (dims[0] === 'time') return ['bar', 'line']
    return measure === 'rating' ? ['bar'] : ['bar', 'pie']
  }
  if (dims.length === 2) return ['bar', 'line']
  return []
}

function nodeValue(node: PivotNode, measure: PivotMeasure): number {
  return measureValue(node, measure)
}

function formatCell(row: { count: number; cost: number; rating: number | null }, measure: PivotMeasure): string {
  if (measure === 'cost') return formatMoney(row.cost)
  if (measure === 'rating') return row.rating == null ? '—' : row.rating.toFixed(1)
  return String(row.count)
}

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

  const shows = useLiveQuery(() => activeShows(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const cities = useLiveQuery(() => db.cities.toArray(), [])
  const venues = useLiveQuery(() => db.venues.toArray(), [])

  const [dims, setDims] = useState<PivotDimKey[]>(['time', 'cat1'])
  const [granularity, setGranularity] = useState<TimeGranularity>('month')
  const [measure, setMeasure] = useState<PivotMeasure>('count')
  const [chartKind, setChartKind] = useState<ChartKind>('bar')

  const all = shows ?? []
  const stats = useMemo(
    () => computeOverview(all),
    [all]
  )
  const pivot = useMemo(
    () => computePivot(all, categories ?? [], cities ?? [], venues ?? [], dims, granularity, measure),
    [all, categories, cities, venues, dims, granularity, measure]
  )
  const rows = useMemo(() => flattenPivot(pivot, dims.length), [pivot, dims.length])

  const kinds = availableChartKinds(dims, measure)
  const effectiveKind = kinds.includes(chartKind) ? chartKind : 'bar'

  function toggleDim(key: PivotDimKey) {
    setDims((prev) => {
      if (prev.includes(key)) return prev.filter((d) => d !== key)
      if (prev.length >= MAX_DIMS) return prev
      return [...prev, key]
    })
  }

  function pickMeasure(m: PivotMeasure) {
    setMeasure(m)
    if (m === 'rating' && chartKind === 'pie') setChartKind('bar')
  }

  const chartOption = useMemo(() => {
    if (dims.length === 0 || dims.length > 2) return null

    const tooltip = {
      trigger: dims.length === 1 && effectiveKind === 'pie' ? ('item' as const) : ('axis' as const),
      ...tooltipStyle,
      valueFormatter: (value: unknown) =>
        measure === 'cost' ? formatMoney(Number(value)) : measure === 'rating' ? Number(value).toFixed(1) : String(value)
    }
    const commonGrid = { left: 8, right: 8, top: 30, bottom: 0, containLabel: true }

    if (dims.length === 1) {
      const nodes = pivot.children
      const values = nodes.map((n) => nodeValue(n, measure))
      const isTime = dims[0] === 'time'

      if (effectiveKind === 'pie') {
        const top = nodes.slice(0, PIE_MAX)
        const rest = nodes.slice(PIE_MAX).reduce((sum, n) => sum + nodeValue(n, measure), 0)
        const data = top.map((n, i) => ({
          name: n.name,
          value: nodeValue(n, measure),
          itemStyle: { color: AMBER_RAMP[i % AMBER_RAMP.length] }
        }))
        if (rest > 0) data.push({ name: '其他', value: rest, itemStyle: { color: otherColor } })
        return {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'item', ...tooltipStyle },
          legend: {
            bottom: 0,
            icon: 'circle',
            textStyle: { color: isLight ? 'rgba(46,40,28,0.65)' : 'rgba(245,239,230,0.65)', fontSize: 11 }
          },
          series: [
            {
              type: 'pie',
              radius: ['40%', '66%'],
              center: ['50%', '44%'],
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
        yAxis: { type: 'value', splitLine, axisLabel, minInterval: measure === 'count' ? 1 : undefined },
        series: [
          {
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

    // 双维度：主维度为 X 轴，次级维度 Top N 堆叠 / 多线
    const primary = pivot.children
    const secondaryMap = new Map<string, { name: string; total: number }>()
    for (const p of primary) {
      for (const c of p.children) {
        const cur = secondaryMap.get(c.name) ?? { name: c.name, total: 0 }
        cur.total += nodeValue(c, measure)
        secondaryMap.set(c.name, cur)
      }
    }
    const sorted = [...secondaryMap.values()].sort((a, b) => b.total - a.total)
    const top = sorted.slice(0, STACK_MAX)
    const restTotal = sorted.slice(STACK_MAX).reduce((sum, s) => sum + s.total, 0)
    if (restTotal > 0) top.push({ name: '其他', total: restTotal })
    const secondary = top.map((t) => t.name)
    const stacked = measure !== 'rating'

    const series = secondary.map((name, i) => ({
      name,
      type: effectiveKind,
      smooth: effectiveKind === 'line',
      symbol: effectiveKind === 'line' ? 'circle' : undefined,
      symbolSize: 5,
      stack: effectiveKind === 'bar' && stacked ? 'total' : undefined,
      itemStyle: { color: AMBER_RAMP[i % AMBER_RAMP.length], borderRadius: effectiveKind === 'bar' ? [3, 3, 0, 0] : 0 },
      data: primary.map((p) => {
        if (name === '其他') {
          const kept = new Set(top.slice(0, STACK_MAX).map((t) => t.name))
          return p.children.filter((c) => !kept.has(c.name)).reduce((sum, c) => sum + nodeValue(c, measure), 0)
        }
        const child = p.children.find((c) => c.name === name)
        return child ? nodeValue(child, measure) : 0
      })
    }))

    return {
      backgroundColor: 'transparent',
      grid: commonGrid,
      tooltip,
      legend: {
        top: 0,
        icon: 'circle',
        textStyle: { color: isLight ? 'rgba(46,40,28,0.65)' : 'rgba(245,239,230,0.65)', fontSize: 11 }
      },
      xAxis: {
        type: 'category',
        data: primary.map((p) => p.name),
        axisLine,
        axisTick: { show: false },
        axisLabel
      },
      yAxis: { type: 'value', splitLine, axisLabel, minInterval: measure === 'count' ? 1 : undefined },
      series
    }
  }, [pivot, dims, measure, effectiveKind])

  const dimTitle = dims.map((d) => PIVOT_DIM_LABELS[d]).join(' × ')
  const chartTitle = dims.length ? `${dimTitle} · ${measureLabel(measure)}` : '透视分析'

  return (
    <div className="page">
      <PageHeader eyebrow="Statistics" title="统计" />

      {stats.total === 0 ? (
        <EmptyState title="还没有记录" hint="新增第一条演出记录后，这里会出现统计与透视分析。" />
      ) : (
        <>
          <section className="form-section">
            <SectionTitle kicker="Overview">概览</SectionTitle>
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
            <SectionTitle kicker="Pivot">透视分析</SectionTitle>

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
                        {dims.length === 2 && <span className="pivot-chart-note">次级维度 Top {STACK_MAX}</span>}
                      </div>
                      <Chart option={chartOption} height={280} />
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
                            <td className="num">{formatCell(r, measure)}</td>
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
