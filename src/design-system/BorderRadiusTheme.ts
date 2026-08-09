import {
  BORDER_RADIUS_TOKENS,
  type BorderRadiusTokenName
} from './BorderRadiusTokens'

export type SemanticBorderRadiusName =
  | 'button'
  | 'input'
  | 'card'
  | 'widget'
  | 'modal'
  | 'drawer'
  | 'sidebar'
  | 'navbar'
  | 'tooltip'
  | 'toast'
  | 'badge'
  | 'avatar'
  | 'image'
  | 'table'

export const SEMANTIC_BORDER_RADIUS: Record<SemanticBorderRadiusName, BorderRadiusTokenName> = {
  button: 'lg',
  input: 'lg',
  card: 'lg',
  widget: 'lg',
  modal: 'lg',
  drawer: 'lg',
  sidebar: 'lg',
  navbar: 'none',
  tooltip: 'sm',
  toast: 'lg',
  badge: 'full',
  avatar: 'circle',
  image: 'lg',
  table: 'lg'
}

export const PRINT_RADIUS_VALUES = {
  none: BORDER_RADIUS_TOKENS.none,
  xs: BORDER_RADIUS_TOKENS.xs,
  sm: BORDER_RADIUS_TOKENS.sm,
  md: BORDER_RADIUS_TOKENS.md,
  lg: BORDER_RADIUS_TOKENS.lg,
  xl: BORDER_RADIUS_TOKENS.xl,
  xxl: BORDER_RADIUS_TOKENS.xxl,
  full: BORDER_RADIUS_TOKENS.full,
  circle: BORDER_RADIUS_TOKENS.circle,
  sheet: BORDER_RADIUS_TOKENS.lg,
  card: BORDER_RADIUS_TOKENS.lg,
  box: BORDER_RADIUS_TOKENS.md,
  badge: BORDER_RADIUS_TOKENS.full,
  field: BORDER_RADIUS_TOKENS.sm,
  labelField: BORDER_RADIUS_TOKENS.xs
} as const
