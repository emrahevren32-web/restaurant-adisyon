import React from 'react'

/**
 * Inline-SVG chart primitives — no charting dependency, no bundle cost.
 *
 * Mark specs are fixed here so every chart in the product reads as one system:
 *   · lines 2px, round join/cap        · markers r>=4 with a 2px surface ring
 *   · area fill ~10% opacity           · gridlines hairline, solid, recessive
 *   · a legend whenever there are two series, plus direct end-labels
 *   · text always wears text tokens — never the series color
 *
 * Series colours come from CSS custom properties (--chart-s1 / --chart-s2) so
 * light and dark are separately chosen steps rather than an automatic flip.
 * Both palettes were validated for lightness band, chroma floor, CVD separation
 * and contrast before being written into styles.css.
 */

/* ── shared ─────────────────────────────────────────────────────────────── */

const useElementWidth = (fallback = 640) => {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState(fallback)

  React.useEffect(() => {
    const element = ref.current
    if(!element) return undefined
    if(typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0]?.contentRect.width || 0)
      if(next > 0) setWidth(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

const buildPath = (points: Array<{ x: number; y: number }>) => (
  points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
)

/** Axis ticks on clean round numbers rather than raw data extremes. */
const niceCeiling = (value: number) => {
  if(value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

const formatCompact = (value: number) => (
  Math.abs(value) >= 1000
    ? `${(value / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B`
    : value.toLocaleString('tr-TR')
)

/* ── Sparkline ──────────────────────────────────────────────────────────── */

export type SparklineProps = {
  points: number[]
  width?: number
  height?: number
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  ariaLabel?: string
}

/**
 * Trend shape only — no axes, no labels. The line stays in the de-emphasis hue
 * and only the current point carries the accent, so a row of stat tiles reads
 * as texture until you look at one.
 */
export const Sparkline = ({
  points,
  width = 96,
  height = 28,
  tone = 'neutral',
  ariaLabel
}: SparklineProps) => {
  if(points.length < 2) return null

  const padding = 4
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const stepX = (width - padding * 2) / (points.length - 1)

  const coordinates = points.map((value, index) => ({
    x: padding + index * stepX,
    y: padding + (1 - (value - min) / span) * (height - padding * 2)
  }))
  const last = coordinates[coordinates.length - 1]

  return (
    <svg
      className={`chart-sparkline is-${tone}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path
        d={buildPath(coordinates)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />
      {/* current period in the accent, with a surface ring so it reads over the line */}
      <circle cx={last.x} cy={last.y} r={4} className="chart-sparkline-head" strokeWidth={2} />
    </svg>
  )
}

/* ── Meter ──────────────────────────────────────────────────────────────── */

export type MeterProps = {
  value: number
  label: React.ReactNode
  detail?: React.ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

/**
 * A single ratio against a limit. A track plus a fill beats a donut: it is
 * directly comparable down a column, and the value stays readable at any size.
 */
export const Meter = ({ value, label, detail, tone = 'neutral' }: MeterProps) => {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <div className={`chart-meter is-${tone}`}>
      <div className="chart-meter-head">
        <span className="chart-meter-label">{label}</span>
        <strong className="chart-meter-value">%{clamped}</strong>
      </div>
      <div
        className="chart-meter-track"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <span className="chart-meter-fill" style={{ width: `${clamped}%` }} />
      </div>
      {detail && <span className="chart-meter-detail">{detail}</span>}
    </div>
  )
}

/* ── TrendChart ─────────────────────────────────────────────────────────── */

export type TrendSeries = {
  key: string
  label: string
  points: number[]
}

export type TrendChartProps = {
  series: TrendSeries[]
  labels: string[]
  height?: number
  valueSuffix?: string
}

type HoverState = { index: number; x: number } | null

/**
 * Up to two series over time, with a crosshair + tooltip. An HTML/SVG chart is
 * interactive by nature, so the hover layer ships by default rather than being
 * an enhancement.
 */
export const TrendChart = ({
  series,
  labels,
  height = 240,
  valueSuffix = ''
}: TrendChartProps) => {
  const { ref, width } = useElementWidth()
  const [hover, setHover] = React.useState<HoverState>(null)

  const padding = { top: 16, right: 56, bottom: 28, left: 44 }
  const plotWidth = Math.max(80, width - padding.left - padding.right)
  const plotHeight = Math.max(60, height - padding.top - padding.bottom)

  const allValues = series.flatMap(entry => entry.points)
  const maxValue = niceCeiling(Math.max(1, ...allValues))
  const count = Math.max(labels.length, ...series.map(entry => entry.points.length))
  const stepX = count > 1 ? plotWidth / (count - 1) : 0

  const toX = (index: number) => padding.left + index * stepX
  const toY = (value: number) => padding.top + (1 - value / maxValue) * plotHeight

  const ticks = [0, 0.5, 1].map(ratio => Math.round(maxValue * ratio))

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if(count < 2) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left - padding.left
    const index = Math.min(count - 1, Math.max(0, Math.round(relativeX / stepX)))
    setHover({ index, x: toX(index) })
  }

  const tooltipOnLeft = hover ? hover.x > padding.left + plotWidth * 0.6 : false

  return (
    <div className="chart-trend" ref={ref}>
      <svg
        className="chart-trend-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${series.map(entry => entry.label).join(' ve ')} son ${count} gün`}
      >
        {/* recessive hairline grid — solid, never dashed */}
        {ticks.map(tick => (
          <g key={tick}>
            <line
              className="chart-grid-line"
              x1={padding.left}
              x2={padding.left + plotWidth}
              y1={toY(tick)}
              y2={toY(tick)}
            />
            <text className="chart-axis-text" x={padding.left - 10} y={toY(tick)} textAnchor="end" dominantBaseline="middle">
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        {/* x labels — first, middle, last only; a tick per day is unreadable */}
        {[0, Math.floor((count - 1) / 2), count - 1].map(index => (
          labels[index] ? (
            <text
              key={`x-${index}`}
              className="chart-axis-text"
              x={toX(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
            >
              {labels[index]}
            </text>
          ) : null
        ))}

        {hover && (
          <line
            className="chart-crosshair"
            x1={hover.x}
            x2={hover.x}
            y1={padding.top}
            y2={padding.top + plotHeight}
          />
        )}

        {series.map((entry, seriesIndex) => {
          const coordinates = entry.points.map((value, index) => ({ x: toX(index), y: toY(value) }))
          if(coordinates.length === 0) return null
          const last = coordinates[coordinates.length - 1]
          const areaPath = `${buildPath(coordinates)} L${last.x} ${padding.top + plotHeight} L${coordinates[0].x} ${padding.top + plotHeight} Z`

          return (
            <g key={entry.key} className={`chart-series chart-series-${seriesIndex + 1}`}>
              {series.length === 1 && <path className="chart-area" d={areaPath} />}
              <path className="chart-line" d={buildPath(coordinates)} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {/* direct end-label: identity without forcing a colour-match to the legend */}
              <circle className="chart-end-dot" cx={last.x} cy={last.y} r={4} strokeWidth={2} />
              <text className="chart-end-label" x={last.x + 10} y={last.y} dominantBaseline="middle">
                {formatCompact(entry.points[entry.points.length - 1])}{valueSuffix}
              </text>
              {hover && coordinates[hover.index] && (
                <circle
                  className="chart-hover-dot"
                  cx={coordinates[hover.index].x}
                  cy={coordinates[hover.index].y}
                  r={5}
                  strokeWidth={2}
                />
              )}
            </g>
          )
        })}
      </svg>

      {hover && (
        <div
          className="chart-tooltip"
          style={{
            left: tooltipOnLeft ? undefined : hover.x + 14,
            right: tooltipOnLeft ? width - hover.x + 14 : undefined,
            top: padding.top
          }}
        >
          <span className="chart-tooltip-title">{labels[hover.index]}</span>
          {series.map((entry, seriesIndex) => (
            <span className="chart-tooltip-row" key={entry.key}>
              <span className={`chart-key chart-key-${seriesIndex + 1}`} aria-hidden="true" />
              <span className="chart-tooltip-label">{entry.label}</span>
              <strong>{formatCompact(entry.points[hover.index] ?? 0)}{valueSuffix}</strong>
            </span>
          ))}
        </div>
      )}

      {/* legend is mandatory from two series up */}
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((entry, seriesIndex) => (
            <span className="chart-legend-item" key={entry.key}>
              <span className={`chart-key chart-key-${seriesIndex + 1}`} aria-hidden="true" />
              {entry.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrendChart
