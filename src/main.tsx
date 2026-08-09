import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyColorPaletteSystem } from './design-system/ColorPalette'
import { applyIconographySystem } from './design-system/IconSystem'
import { applyTypographySystem } from './design-system/Typography'
import './styles.css'

applyColorPaletteSystem()
applyIconographySystem()
applyTypographySystem()

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(<App />)
