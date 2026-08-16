import React from 'react'
import type {
  PremiumElevationLevel,
  PremiumGlassSurface,
  PremiumSurfaceLevel
} from '../design-system/PremiumThemeTokens'
import type { PremiumSurfaceElement } from '../design-system/ThemeUtilities'
import { ThemeTokenProvider } from './ThemeTokenProvider'

export type SurfaceProviderProps = React.HTMLAttributes<HTMLElement> & {
  as?: PremiumSurfaceElement
  level?: PremiumSurfaceLevel
  elevation?: PremiumElevationLevel
  glass?: PremiumGlassSurface
}

const SurfaceLevelContext = React.createContext<PremiumSurfaceLevel>(1)

export const SurfaceProvider = ({
  as = 'section',
  level = 1,
  elevation,
  glass,
  children,
  ...props
}: SurfaceProviderProps) => (
  <SurfaceLevelContext.Provider value={level}>
    <ThemeTokenProvider
      {...props}
      as={as}
      surface={level}
      elevation={elevation}
      glass={glass}
    >
      {children}
    </ThemeTokenProvider>
  </SurfaceLevelContext.Provider>
)

export const useSurfaceLevel = () => React.useContext(SurfaceLevelContext)

export default SurfaceProvider

