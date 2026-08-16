import React from 'react'

export type ResponsiveLayoutVariant = 'stack' | 'split' | 'sidebar' | 'dashboard'
export type ResponsiveLayoutElement = 'div' | 'section' | 'main' | 'article'

export type ResponsiveLayoutProps = React.HTMLAttributes<HTMLElement> & {
  as?: ResponsiveLayoutElement
  variant?: ResponsiveLayoutVariant
  sidebarWidth?: string
  gap?: 'compact' | 'comfortable' | 'spacious'
}

type ResponsiveLayoutStyle = React.CSSProperties & Record<string, string | number | undefined>

export const ResponsiveLayout = ({
  as = 'section',
  variant = 'stack',
  sidebarWidth,
  gap = 'comfortable',
  className = '',
  style,
  children,
  ...props
}: ResponsiveLayoutProps) => {
  const responsiveStyle = {
    ...style
  } as ResponsiveLayoutStyle
  if(sidebarWidth) responsiveStyle['--responsive-layout-sidebar-width'] = sidebarWidth

  return React.createElement(
    as,
    {
      ...props,
      style: responsiveStyle,
      className: [
        'responsive-layout',
        `variant-${variant}`,
        `gap-${gap}`,
        className
      ].filter(Boolean).join(' ')
    },
    children
  )
}

export default ResponsiveLayout
