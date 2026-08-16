import React from 'react'

export type ResponsiveGridColumns = number | {
  wide?: number
  desktop?: number
  laptop?: number
  tablet?: number
  mobile?: number
  compact?: number
}

export type ResponsiveGridGap = 'compact' | 'comfortable' | 'spacious'
export type ResponsiveGridElement = 'div' | 'section' | 'ul' | 'ol'

export type ResponsiveGridProps = React.HTMLAttributes<HTMLElement> & {
  as?: ResponsiveGridElement
  columns?: ResponsiveGridColumns
  minColumnWidth?: string
  gap?: ResponsiveGridGap
  fit?: 'fixed' | 'auto-fit' | 'auto-fill'
}

type ResponsiveStyle = React.CSSProperties & Record<string, string | number | undefined>

const createColumnStyle = (
  columns: ResponsiveGridColumns,
  minColumnWidth?: string
): ResponsiveStyle => {
  const style: ResponsiveStyle = {}

  if(typeof columns === 'number'){
    style['--responsive-grid-wide-columns'] = columns
    style['--responsive-grid-desktop-columns'] = columns
    style['--responsive-grid-laptop-columns'] = Math.min(columns, 8)
    style['--responsive-grid-tablet-columns'] = Math.min(columns, 4)
    style['--responsive-grid-mobile-columns'] = Math.min(columns, 2)
    style['--responsive-grid-compact-columns'] = 1
  } else {
    Object.entries(columns).forEach(([key, value]) => {
      style[`--responsive-grid-${key}-columns`] = value
    })
  }

  if(minColumnWidth) style['--responsive-grid-min-column'] = minColumnWidth

  return style
}

export const ResponsiveGrid = ({
  as = 'div',
  columns = 4,
  minColumnWidth,
  gap = 'comfortable',
  fit = 'fixed',
  className = '',
  style,
  children,
  ...props
}: ResponsiveGridProps) => (
  React.createElement(
    as,
    {
      ...props,
      style: {
        ...createColumnStyle(columns, minColumnWidth),
        ...style
      },
      className: [
        'responsive-grid',
        `gap-${gap}`,
        `fit-${fit}`,
        className
      ].filter(Boolean).join(' ')
    },
    children
  )
)

export default ResponsiveGrid

