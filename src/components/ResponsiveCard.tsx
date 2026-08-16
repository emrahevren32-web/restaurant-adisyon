import React from 'react'

export type ResponsiveCardDensity = 'compact' | 'comfortable'
export type ResponsiveCardElement = 'article' | 'section' | 'div' | 'button'

export type ResponsiveCardProps = React.HTMLAttributes<HTMLElement> & {
  as?: ResponsiveCardElement
  density?: ResponsiveCardDensity
  interactive?: boolean
}

export const ResponsiveCard = ({
  as = 'article',
  density = 'comfortable',
  interactive = false,
  className = '',
  children,
  ...props
}: ResponsiveCardProps) => (
  React.createElement(
    as,
    {
      ...props,
      className: [
        'responsive-card',
        `density-${density}`,
        interactive ? 'interactive' : '',
        className
      ].filter(Boolean).join(' ')
    },
    children
  )
)

export default ResponsiveCard

