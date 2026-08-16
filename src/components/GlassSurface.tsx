import React from 'react'
import type {
  PremiumElevationLevel,
  PremiumGlassSurface
} from '../design-system/PremiumThemeTokens'
import type { PremiumSurfaceElement } from '../design-system/ThemeUtilities'
import { ThemeTokenProvider } from './ThemeTokenProvider'

export type GlassSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  as?: PremiumSurfaceElement
  variant?: PremiumGlassSurface
  elevation?: PremiumElevationLevel
}

export const GlassSurface = ({
  as = 'div',
  variant = 'card',
  elevation = 2,
  children,
  ...props
}: GlassSurfaceProps) => (
  <ThemeTokenProvider
    {...props}
    as={as}
    glass={variant}
    elevation={elevation}
  >
    {children}
  </ThemeTokenProvider>
)

export default GlassSurface

