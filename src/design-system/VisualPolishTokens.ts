const toCssVariableName = (value: string) => (
  value
    .replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US')
)

export const VISUAL_POLISH_TOKENS = {
  surfaceGradient: 'linear-gradient(180deg, var(--theme-elevation-1-background, var(--surface-raised)), var(--theme-surface-1, var(--surface)))',
  surfaceGradientSoft: 'linear-gradient(135deg, var(--theme-surface-1, var(--surface)), var(--theme-surface-2, var(--surface-muted)))',
  surfaceGradientRaised: 'linear-gradient(180deg, var(--theme-elevation-2-background, var(--surface-raised)), var(--theme-card-background, var(--card)))',
  glassGradient: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-glass-card-background, var(--glass-card-bg)) 92%, transparent), color-mix(in srgb, var(--theme-surface-2, var(--surface-muted)) 72%, transparent))',
  glassGradientStrong: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-glass-modal-background, var(--glass-modal-bg)) 96%, transparent), color-mix(in srgb, var(--theme-surface-3, var(--surface-subtle)) 76%, transparent))',
  accentGradient: 'linear-gradient(135deg, var(--theme-semantic-primary-base, var(--accent)), var(--theme-semantic-info-base, var(--info)))',
  accentSoftGradient: 'linear-gradient(135deg, var(--theme-semantic-primary-soft, var(--accent-soft)), color-mix(in srgb, var(--theme-semantic-info-soft, var(--info-soft)) 68%, transparent))',
  successGradient: 'linear-gradient(135deg, var(--theme-semantic-success-soft, var(--success-soft)), color-mix(in srgb, var(--theme-surface-1, var(--surface)) 74%, transparent))',
  warningGradient: 'linear-gradient(135deg, var(--theme-semantic-warning-soft, var(--warning-soft)), color-mix(in srgb, var(--theme-surface-1, var(--surface)) 74%, transparent))',
  dangerGradient: 'linear-gradient(135deg, var(--theme-semantic-danger-soft, var(--danger-soft)), color-mix(in srgb, var(--theme-surface-1, var(--surface)) 74%, transparent))',
  border: 'var(--theme-border-subtle, var(--line-soft))',
  borderStrong: 'var(--theme-border-default, var(--line))',
  borderAccent: 'var(--theme-semantic-primary-line, var(--accent-line))',
  divider: 'var(--theme-border-subtle, var(--line-soft))',
  focusRing: 'var(--theme-state-focus-ring, var(--shadow-input-focus))',
  elevationRest: 'var(--theme-elevation-1-shadow, var(--shadow-card))',
  elevationHover: 'var(--theme-elevation-2-shadow, var(--shadow-button-hover))',
  elevationFloating: 'var(--theme-shadow-floating, var(--shadow-floating))',
  elevationOverlay: 'var(--theme-shadow-overlay, var(--shadow-overlay))',
  blurGlass: 'var(--theme-blur-glass, var(--blur-glass, saturate(150%) blur(18px)))',
  radiusSurface: 'var(--theme-radius-surface, var(--radius-card))',
  radiusControl: 'var(--theme-radius-control, var(--radius-button))',
  radiusModal: 'var(--theme-radius-modal, var(--radius-modal))',
  radiusPill: 'var(--theme-radius-pill, var(--radius-full))',
  controlHeight: 'var(--touch-target)',
  controlHeightCompact: 'var(--touch-target-sm)',
  toolbarHeight: 'var(--topbar-height)',
  iconFrameSm: 'var(--icon-frame-sm)',
  iconFrameMd: 'var(--icon-frame-md)',
  iconFrameLg: 'var(--icon-frame-lg)',
  sectionGap: 'var(--responsive-section-gap, var(--space-16))',
  gridGap: 'var(--responsive-grid-gap, var(--space-16))',
  cardPadding: 'var(--responsive-card-padding, var(--space-16))',
  cardPaddingCompact: 'var(--space-12)',
  inlineGap: 'var(--space-8)',
  stackGap: 'var(--space-12)',
  typographyHeading: 'var(--theme-typography-heading, var(--font-family-sans))',
  typographyBody: 'var(--theme-typography-body, var(--font-family-sans))',
  titleWeight: 'var(--font-weight-850)',
  bodyWeight: 'var(--font-weight-500)',
  labelWeight: 'var(--font-weight-800)',
  transitionSurface: 'var(--theme-motion-surface, var(--motion-transition-surface))',
  transitionInteractive: 'var(--motion-transition-interactive)',
  transitionFocus: 'var(--theme-motion-focus, var(--motion-transition-focus))',
  hoverLift: 'var(--motion-hover-lift, var(--space-2))',
  sheen: 'inset 0 1px 0 color-mix(in srgb, var(--theme-color-white, var(--surface)) 42%, transparent)',
  disabledOpacity: '.62'
} as const

export type VisualPolishTokenName = keyof typeof VISUAL_POLISH_TOKENS

export const createVisualPolishTokenCssVariables = () => (
  Object.entries(VISUAL_POLISH_TOKENS)
    .map(([key, value]) => `--polish-${toCssVariableName(key)}:${value};`)
    .join('')
)
