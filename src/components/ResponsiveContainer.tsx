import React from 'react'

export type ResponsiveContainerSize = 'page' | 'content' | 'wide' | 'full'
export type ResponsiveContainerPadding = 'none' | 'compact' | 'comfortable'
export type ResponsiveContainerElement = 'div' | 'section' | 'main' | 'article' | 'header' | 'footer'

export type ResponsiveContainerProps = React.HTMLAttributes<HTMLElement> & {
  as?: ResponsiveContainerElement
  size?: ResponsiveContainerSize
  padding?: ResponsiveContainerPadding
}

export const ResponsiveContainer = ({
  as = 'div',
  size = 'page',
  padding = 'comfortable',
  className = '',
  children,
  ...props
}: ResponsiveContainerProps) => (
  React.createElement(
    as,
    {
      ...props,
      className: [
        'responsive-container',
        `size-${size}`,
        `padding-${padding}`,
        className
      ].filter(Boolean).join(' ')
    },
    children
  )
)

export default ResponsiveContainer

