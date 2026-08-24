const toCssVariableName = (value: string) => (
  value
    .replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US')
)

export const VISUAL_POLISH_TOKENS = {
  surfaceGradient: 'linear-gradient(180deg, var(--theme-surface-0, var(--surface)), var(--theme-surface-1, var(--surface-raised)))',
  surfaceGradientSoft: 'linear-gradient(135deg, var(--theme-app-bg, var(--background)), var(--theme-surface-2, var(--surface-muted)))',
  surfaceGradientRaised: 'linear-gradient(180deg, var(--theme-elevation-2-background, var(--surface-raised)), var(--theme-surface-0, var(--surface)))',
  glassGradient: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-glass-card-background, var(--glass-card-bg)) 84%, transparent), color-mix(in srgb, var(--theme-surface-2, var(--surface-muted)) 68%, transparent))',
  glassGradientStrong: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-glass-modal-background, var(--glass-modal-bg)) 92%, transparent), color-mix(in srgb, var(--theme-surface-3, var(--surface-subtle)) 72%, transparent))',
  accentGradient: 'linear-gradient(135deg, var(--theme-semantic-primary-base, var(--accent)), var(--theme-semantic-info-base, var(--info)))',
  accentSoftGradient: 'linear-gradient(135deg, var(--theme-semantic-primary-soft, var(--accent-soft)), color-mix(in srgb, var(--theme-semantic-info-soft, var(--info-soft)) 68%, transparent))',
  successGradient: 'linear-gradient(135deg, var(--theme-semantic-success-soft, var(--success-soft)), color-mix(in srgb, var(--theme-surface-1, var(--surface)) 74%, transparent))',
  warningGradient: 'linear-gradient(135deg, var(--theme-semantic-warning-soft, var(--warning-soft)), color-mix(in srgb, var(--theme-surface-1, var(--surface)) 74%, transparent))',
  dangerGradient: 'linear-gradient(135deg, var(--theme-semantic-danger-soft, var(--danger-soft)), color-mix(in srgb, var(--theme-surface-1, var(--surface)) 74%, transparent))',
  border: 'color-mix(in srgb, var(--theme-border-subtle, var(--line-soft)) 48%, transparent)',
  borderStrong: 'color-mix(in srgb, var(--theme-border-default, var(--line)) 66%, transparent)',
  borderAccent: 'var(--theme-semantic-primary-line, var(--accent-line))',
  divider: 'color-mix(in srgb, var(--theme-border-subtle, var(--line-soft)) 42%, transparent)',
  focusRing: 'var(--theme-state-focus-ring, var(--shadow-input-focus))',
  elevationRest: 'var(--theme-shadow-sm, var(--shadow-card))',
  elevationHover: 'var(--theme-shadow-md, var(--shadow-button-hover))',
  elevationFloating: 'var(--theme-shadow-floating, var(--shadow-floating))',
  elevationOverlay: 'var(--theme-shadow-overlay, var(--shadow-overlay))',
  blurGlass: 'var(--theme-blur-glass, var(--blur-glass, saturate(150%) blur(18px)))',
  radiusSurface: 'var(--theme-radius-surface, var(--radius-card))',
  radiusControl: 'var(--theme-radius-control, var(--radius-button))',
  radiusModal: 'var(--theme-radius-modal, var(--radius-modal))',
  radiusPill: 'var(--theme-radius-pill, var(--radius-full))',
  controlHeight: '36px',
  controlHeightCompact: '30px',
  sidebarWidth: '260px',
  sidebarCollapsedWidth: '68px',
  sidebarPadding: 'var(--space-12) var(--space-8)',
  sidebarItemHeight: '34px',
  sidebarGroupGap: 'var(--space-6)',
  topbarHeight: '58px',
  topbarGap: 'var(--space-8)',
  toolbarHeight: 'var(--topbar-height)',
  iconFrameSm: 'var(--icon-frame-sm)',
  iconFrameMd: 'var(--icon-frame-md)',
  iconFrameLg: 'var(--icon-frame-lg)',
  sectionGap: 'var(--layout-section-gap, var(--responsive-section-gap, var(--space-20)))',
  gridGap: 'var(--layout-widget-gap, var(--responsive-grid-gap, var(--space-16)))',
  cardPadding: 'var(--layout-card-padding, var(--responsive-card-padding, var(--space-20)))',
  cardPaddingCompact: 'var(--space-12)',
  inlineGap: 'var(--space-8)',
  stackGap: 'var(--space-12)',
  cardContentGap: 'var(--layout-card-gap, var(--space-16))',
  typographyHeading: 'var(--theme-typography-heading, var(--font-family-sans))',
  typographyBody: 'var(--theme-typography-body, var(--font-family-sans))',
  titleWeight: 'var(--font-weight-850)',
  bodyWeight: 'var(--font-weight-500)',
  labelWeight: 'var(--font-weight-800)',
  transitionSurface: 'var(--theme-motion-surface, var(--motion-transition-surface))',
  transitionInteractive: 'var(--motion-transition-interactive)',
  transitionFocus: 'var(--theme-motion-focus, var(--motion-transition-focus))',
  hoverLift: 'var(--motion-hover-lift, 2px)',
  sheen: 'inset 0 1px 0 color-mix(in srgb, var(--theme-color-white, var(--surface)) 22%, transparent)',
  disabledOpacity: '.62'
} as const

export type VisualPolishTokenName = keyof typeof VISUAL_POLISH_TOKENS

export const createVisualPolishTokenCssVariables = () => (
  Object.entries(VISUAL_POLISH_TOKENS)
    .map(([key, value]) => `--polish-${toCssVariableName(key)}:${value};`)
    .join('')
)
