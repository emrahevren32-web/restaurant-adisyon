import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTypographySystem } from './design-system/Typography'
import './styles.css'

applyTypographySystem()

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(<App />)
