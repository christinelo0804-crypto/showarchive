import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

export function Chart({
  option,
  height = 280,
  onWidth
}: {
  option: EChartsCoreOption
  height?: number
  /** 容器宽度变化时回调：图例换行数依赖容器宽度，需要由上层重算布局 */
  onWidth?: (width: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null)
  const onWidthRef = useRef(onWidth)
  onWidthRef.current = onWidth

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = echarts.init(el)
    chartRef.current = chart
    onWidthRef.current?.(el.clientWidth)
    const observer = new ResizeObserver(() => {
      chart.resize()
      onWidthRef.current?.(el.clientWidth)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={containerRef} style={{ width: '100%', height }} />
}
