export type ShadowTokenName =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | 'floating'
  | 'overlay'
  | 'modal'
  | 'dropdown'
  | 'tooltip'
  | 'toast'

export const SHADOW_TOKEN_NAMES: ShadowTokenName[] = [
  'none',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
  'floating',
  'overlay',
  'modal',
  'dropdown',
  'tooltip',
  'toast'
]

export type ShadowTokenMap = Record<ShadowTokenName, string>

export const getShadowTokenVariable = (token: ShadowTokenName) => (
  `var(--shadow-${token})`
)

export const createShadowTokenCssVariables = (tokens: ShadowTokenMap) => (
  SHADOW_TOKEN_NAMES
    .map(token => `--shadow-${token}:${tokens[token]};`)
    .join('')
)
