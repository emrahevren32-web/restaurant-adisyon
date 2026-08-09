export type BorderRadiusTokenName =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | 'full'
  | 'circle'

export const BORDER_RADIUS_TOKEN_NAMES: BorderRadiusTokenName[] = [
  'none',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
  'full',
  'circle'
]

export type BorderRadiusTokenMap = Record<BorderRadiusTokenName, string>

export const BORDER_RADIUS_TOKENS: BorderRadiusTokenMap = {
  none: '0',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  xxl: '16px',
  full: '999px',
  circle: '50%'
}

export const getBorderRadiusToken = (token: BorderRadiusTokenName) => (
  BORDER_RADIUS_TOKENS[token]
)

export const getBorderRadiusVariable = (token: BorderRadiusTokenName) => (
  `var(--radius-${token})`
)

export const createBorderRadiusTokenCssVariables = () => (
  BORDER_RADIUS_TOKEN_NAMES
    .map(token => `--radius-${token}:${BORDER_RADIUS_TOKENS[token]};`)
    .join('')
)
