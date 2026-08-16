import React from 'react'
import {
  getElevationClassName,
  getGlassClassName,
  getSurfaceClassName,
  type PremiumSurfaceElement
} from '../design-system/ThemeUtilities'
import type {
  PremiumElevationLevel,
  PremiumGlassSurface,
  PremiumSurfaceLevel
} from '../design-system/PremiumThemeTokens'

export type ThemeTokenProviderProps = React.HTMLAttributes<HTMLElement> & {
  as?: PremiumSurfaceElement
  surface?: PremiumSurfaceLevel
  elevation?: PremiumElevationLevel
  glass?: PremiumGlassSurface
}

export const ThemeTokenProvider = ({
  as = 'div',
  surface,
  elevation,
  glass,
  className = '',
  children,
  ...props
}: ThemeTokenProviderProps) => {
  const classNames = [
    surface !== undefined ? getSurfaceClassName(surface) : '',
    elevation !== undefined ? getElevationClassName(elevation) : '',
    glass ? getGlassClassName(glass) : '',
    className
  ].filter(Boolean).join(' ')

  return React.createElement(
    as,
    {
      ...props,
      className: classNames || undefined
    },
    children
  )
}

export default ThemeTokenProvider

