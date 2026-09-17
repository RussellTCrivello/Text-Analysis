/**
 * Overview charts — hand-rolled inline SVG (no chart-library weight for
 * glanceable widgets; the full recharts builder lives in Reports). Everything
 * here is data-driven and decorative-by-default: the numbers next to the
 * graphics carry the accessible truth.
 */
import React, { useId } from 'react'

export function Sparkline({
  values,
  width = 120,
  height = 30,
  color = 'var(--primary)',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const max = Math.max(1, ...values)
  const n = values.length
  if (n === 0) return null
  const step = n > 1 ? width / (n - 1) : width
  const pts = values.map((v, i) => {
    const x = i * step
    const y = height - 3 - (v / max) * (height - 7)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const area = `${line}L${width},${height}L0,${height}Z`
  const last = pts[pts.length - 1]
  const flat = values.every((v) => v === 0)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {!flat && <path d={area} fill={`url(#spark-${gid})`} stroke="none" />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={flat ? 0.35 : 1}
        style={{
          // One-shot draw-in on mount; reduced-motion users skip it globally.
          animation: flat ? undefined : 'drawLine 700ms cubic-bezier(0.22,1,0.36,1) both',
          strokeDasharray: width + height,
          '--spark-len': `${width + height}px`,
        } as React.CSSProperties}
      />
      {!flat && last && (
        <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      )}
    </svg>
  )
}

export interface DonutSlice {
  label: string
  value: number
  share: number
  color: string
}

export function MiniDonut({
  slices,
  size = 68,
  thickness = 9,
}: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = slices.reduce((n, s) => n + s.value, 0)
  let acc = 0
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth={thickness}
        opacity={0.6}
      />
      {total > 0 &&
        slices.map((s) => {
          const len = (s.value / total) * c
          const dash = `${Math.max(0, len - 1.5)} ${c - Math.max(0, len - 1.5)}`
          const offset = -acc
          acc += len
          return (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dasharray var(--t-slow) var(--ease-out)' }}
            />
          )
        })}
    </svg>
  )
}
