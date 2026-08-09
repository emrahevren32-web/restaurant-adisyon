export type IconSizeToken = 'XS' | 'SM' | 'MD' | 'LG' | 'XL' | 'XXL'

export type IconColorToken =
  | 'default'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'inverse'

export type IconTokenDefinition = {
  size: number
  frame: number
  strokeWidth: number
}

export const ICON_SIZE_TOKENS: Record<IconSizeToken, IconTokenDefinition> = {
  XS: { size: 12, frame: 24, strokeWidth: 2 },
  SM: { size: 16, frame: 28, strokeWidth: 2 },
  MD: { size: 20, frame: 34, strokeWidth: 2 },
  LG: { size: 24, frame: 38, strokeWidth: 2 },
  XL: { size: 32, frame: 46, strokeWidth: 1.9 },
  XXL: { size: 48, frame: 72, strokeWidth: 1.8 }
}

export const ICON_COLOR_TOKENS: Record<IconColorToken, string> = {
  default: 'var(--color-icon)',
  muted: 'var(--color-icon-muted)',
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  inverse: 'var(--color-white)'
}

const toIconCssKey = (size: IconSizeToken) => size.toLocaleLowerCase('en-US')

export const getIconSizeVariable = (size: IconSizeToken = 'MD') => (
  `var(--icon-size-${toIconCssKey(size)})`
)

export const getIconFrameVariable = (size: IconSizeToken = 'MD') => (
  `var(--icon-frame-${toIconCssKey(size)})`
)

export const getIconStrokeWidth = (size: IconSizeToken = 'MD') => ICON_SIZE_TOKENS[size].strokeWidth

export const getIconColorValue = (color: IconColorToken = 'default') => ICON_COLOR_TOKENS[color]

export const createIconTokenCssVariables = () => {
  const sizeVariables = Object.entries(ICON_SIZE_TOKENS).flatMap(([size, token]) => {
    const cssKey = toIconCssKey(size as IconSizeToken)
    return [
      `--icon-size-${cssKey}:${token.size}px;`,
      `--icon-frame-${cssKey}:${token.frame}px;`,
      `--icon-stroke-${cssKey}:${token.strokeWidth};`
    ]
  })

  const colorVariables = Object.entries(ICON_COLOR_TOKENS).map(([name, value]) => (
    `--icon-color-${name}:${value};`
  ))

  return [...sizeVariables, ...colorVariables].join('')
}
