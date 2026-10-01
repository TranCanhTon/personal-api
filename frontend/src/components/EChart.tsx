import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

echarts.use([BarChart, LineChart, ScatterChart, CustomChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer])

export type ChartOption = echarts.EChartsCoreOption

type Props = {
  option: ChartOption
  label: string
  height?: number
  /** Called with the hovered category index (x axis), or null when the pointer leaves the chart */
  onHover?: (index: number | null) => void
}

export function EChart({ option, label, height = 260, onHover }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  // Latest callback, so the chart's event listeners (set up once) never call a stale one
  const hover = useRef(onHover)
  useEffect(() => {
    hover.current = onHover
  }, [onHover])

  useEffect(() => {
    const el = ref.current!
    const instance = echarts.init(el, null, { renderer: 'svg' })
    chart.current = instance
    const ro = new ResizeObserver(() => instance.resize())
    ro.observe(el)
    instance.on('updateAxisPointer', (e) => {
      const info = (e as { axesInfo?: { axisDim: string; value: number }[] }).axesInfo?.find((a) => a.axisDim === 'x')
      hover.current?.(info ? info.value : null)
    })
    instance.on('globalout', () => hover.current?.(null))
    return () => {
      ro.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true })
  }, [option])

  return <div ref={ref} role="img" aria-label={label} style={{ height, width: '100%' }} />
}
