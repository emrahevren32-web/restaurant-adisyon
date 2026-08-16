import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyBorderRadiusSystem } from './design-system/BorderRadiusSystem'
import { applyColorPaletteSystem } from './design-system/ColorPalette'
import { applyPremiumThemeEngine } from './design-system/ColorTokenService'
import { applyIconographySystem } from './design-system/IconSystem'
import { applyMotionSystem } from './design-system/MotionSystem'
import { applyShadowSystem } from './design-system/ShadowSystem'
import { applySpacingSystem } from './design-system/SpacingSystem'
import { applyTypographySystem } from './design-system/Typography'
import { MotionProvider } from './components/Motion'
import { ThemeProvider } from './components/ThemeProvider'
import './styles.css'

applyColorPaletteSystem()
applySpacingSystem()
applyShadowSystem()
applyBorderRadiusSystem()
applyIconographySystem()
applyTypographySystem()
applyMotionSystem()
applyPremiumThemeEngine()

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <ThemeProvider>
    <MotionProvider>
      <App />
    </MotionProvider>
  </ThemeProvider>
)
