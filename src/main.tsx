import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyColorPaletteSystem } from './design-system/ColorPalette'
import { applyTypographySystem } from './design-system/Typography'
import './styles.css'

applyColorPaletteSystem()
applyTypographySystem()

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(<App />)
