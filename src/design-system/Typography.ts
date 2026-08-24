export type TypographyViewport = 'desktop' | 'tablet' | 'mobile'

export type TypographyTokenName =
  | 'displayXl'
  | 'displayLarge'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'title'
  | 'subtitle'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'overline'
  | 'label'
  | 'button'
  | 'badge'
  | 'tableHeader'
  | 'tableCell'

export type TypographyToken = {
  cssName: string
  fontSize: Record<TypographyViewport, string>
  fontWeight: number
  lineHeight: string
  letterSpacing: string
  textTransform: 'none' | 'uppercase'
}

export type TypographyCssProperties = {
  fontFamily: string
  fontSize: string
  fontWeight: number
  lineHeight: string
  letterSpacing: string
  textTransform: TypographyToken['textTransform']
}

export const TYPOGRAPHY_FONT_FAMILY = {
  sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
} as const

export const TYPOGRAPHY_BREAKPOINTS = {
  tablet: 980,
  mobile: 560
} as const

export const TYPOGRAPHY_TOKENS: Record<TypographyTokenName, TypographyToken> = {
  displayXl: {
    cssName: 'display-xl',
    fontSize: { desktop: '34px', tablet: '31px', mobile: '27px' },
    fontWeight: 800,
    lineHeight: '1.08',
    letterSpacing: '-0.02em',
    textTransform: 'none'
  },
  displayLarge: {
    cssName: 'display-large',
    fontSize: { desktop: '29px', tablet: '27px', mobile: '25px' },
    fontWeight: 780,
    lineHeight: '1.1',
    letterSpacing: '-0.018em',
    textTransform: 'none'
  },
  h1: {
    cssName: 'h1',
    fontSize: { desktop: '25px', tablet: '24px', mobile: '22px' },
    fontWeight: 760,
    lineHeight: '1.14',
    letterSpacing: '-0.015em',
    textTransform: 'none'
  },
  h2: {
    cssName: 'h2',
    fontSize: { desktop: '21px', tablet: '20px', mobile: '19px' },
    fontWeight: 730,
    lineHeight: '1.18',
    letterSpacing: '-0.012em',
    textTransform: 'none'
  },
  h3: {
    cssName: 'h3',
    fontSize: { desktop: '18px', tablet: '17px', mobile: '16px' },
    fontWeight: 710,
    lineHeight: '1.22',
    letterSpacing: '-0.008em',
    textTransform: 'none'
  },
  h4: {
    cssName: 'h4',
    fontSize: { desktop: '16px', tablet: '15px', mobile: '15px' },
    fontWeight: 700,
    lineHeight: '1.25',
    letterSpacing: '-0.005em',
    textTransform: 'none'
  },
  title: {
    cssName: 'title',
    fontSize: { desktop: '15px', tablet: '15px', mobile: '14px' },
    fontWeight: 690,
    lineHeight: '1.3',
    letterSpacing: '0',
    textTransform: 'none'
  },
  subtitle: {
    cssName: 'subtitle',
    fontSize: { desktop: '14px', tablet: '14px', mobile: '13px' },
    fontWeight: 700,
    lineHeight: '1.4',
    letterSpacing: '0',
    textTransform: 'none'
  },
  bodyLarge: {
    cssName: 'body-large',
    fontSize: { desktop: '14px', tablet: '14px', mobile: '13px' },
    fontWeight: 500,
    lineHeight: '1.5',
    letterSpacing: '0',
    textTransform: 'none'
  },
  body: {
    cssName: 'body',
    fontSize: { desktop: '13px', tablet: '13px', mobile: '13px' },
    fontWeight: 500,
    lineHeight: '1.45',
    letterSpacing: '0',
    textTransform: 'none'
  },
  bodySmall: {
    cssName: 'body-small',
    fontSize: { desktop: '12px', tablet: '12px', mobile: '12px' },
    fontWeight: 500,
    lineHeight: '1.45',
    letterSpacing: '0',
    textTransform: 'none'
  },
  caption: {
    cssName: 'caption',
    fontSize: { desktop: '11px', tablet: '11px', mobile: '11px' },
    fontWeight: 700,
    lineHeight: '1.35',
    letterSpacing: '0',
    textTransform: 'none'
  },
  overline: {
    cssName: 'overline',
    fontSize: { desktop: '11px', tablet: '11px', mobile: '10px' },
    fontWeight: 700,
    lineHeight: '1.25',
    letterSpacing: '0',
    textTransform: 'none'
  },
  label: {
    cssName: 'label',
    fontSize: { desktop: '11px', tablet: '11px', mobile: '11px' },
    fontWeight: 700,
    lineHeight: '1.25',
    letterSpacing: '0',
    textTransform: 'none'
  },
  button: {
    cssName: 'button',
    fontSize: { desktop: '13px', tablet: '13px', mobile: '13px' },
    fontWeight: 700,
    lineHeight: '1.2',
    letterSpacing: '0',
    textTransform: 'none'
  },
  badge: {
    cssName: 'badge',
    fontSize: { desktop: '11px', tablet: '11px', mobile: '11px' },
    fontWeight: 720,
    lineHeight: '1.2',
    letterSpacing: '0',
    textTransform: 'none'
  },
  tableHeader: {
    cssName: 'table-header',
    fontSize: { desktop: '11px', tablet: '11px', mobile: '10px' },
    fontWeight: 700,
    lineHeight: '1.25',
    letterSpacing: '0',
    textTransform: 'none'
  },
  tableCell: {
    cssName: 'table-cell',
    fontSize: { desktop: '12px', tablet: '12px', mobile: '12px' },
    fontWeight: 500,
    lineHeight: '1.35',
    letterSpacing: '0',
    textTransform: 'none'
  }
}

export const TYPOGRAPHY_ROLE_TOKENS = {
  dashboardMetric: 'h3',
  cardTitle: 'title',
  formLabel: 'label',
  formInput: 'body',
  modalTitle: 'h3',
  drawerTitle: 'h3',
  sidebarItem: 'bodySmall',
  navbarItem: 'bodySmall',
  toastTitle: 'body',
  toastBody: 'bodySmall',
  tooltip: 'caption',
  notificationTitle: 'body',
  notificationBody: 'bodySmall',
  tableHeader: 'tableHeader',
  tableCell: 'tableCell'
} satisfies Record<string, TypographyTokenName>

const SIZE_ALIASES: Record<number, TypographyTokenName> = {
  10: 'overline',
  11: 'overline',
  12: 'caption',
  13: 'bodySmall',
  14: 'body',
  15: 'bodyLarge',
  16: 'subtitle',
  17: 'title',
  18: 'title',
  20: 'h4',
  21: 'h4',
  22: 'h3',
  23: 'h3',
  24: 'h3',
  25: 'h3',
  26: 'h2',
  28: 'h2',
  30: 'h2',
  31: 'h2',
  34: 'h1',
  38: 'h1',
  42: 'h1',
  46: 'displayLarge',
  54: 'displayLarge',
  64: 'displayXl'
}

const WEIGHT_ALIASES = [400, 450, 500, 550, 600, 650, 700, 750, 760, 780, 800, 850, 900, 950] as const
const LINE_HEIGHT_ALIASES = ['1', '1.02', '1.1', '1.12', '1.14', '1.15', '1.16', '1.18', '1.2', '1.22', '1.24', '1.25', '1.28', '1.3', '1.35', '1.4', '1.45', '1.48', '1.5', '1.55', '1.6'] as const

const getLineHeightAliasName = (value: string) => value.replace('.', '-')

const createScaleVariables = (viewport: TypographyViewport) => (
  Object.entries(TYPOGRAPHY_TOKENS).flatMap(([, token]) => [
    `--type-${token.cssName}-size:${token.fontSize[viewport]};`,
    `--type-${token.cssName}-weight:${token.fontWeight};`,
    `--type-${token.cssName}-line-height:${token.lineHeight};`,
    `--type-${token.cssName}-letter-spacing:${token.letterSpacing};`,
    `--type-${token.cssName}-text-transform:${token.textTransform};`,
    `--type-${token.cssName}-font:var(--type-${token.cssName}-weight) var(--type-${token.cssName}-size)/var(--type-${token.cssName}-line-height) var(--type-font-family-sans);`
  ]).join('')
)

const createAliasVariables = () => [
  ...Object.entries(SIZE_ALIASES).map(([size, tokenName]) => (
    `--font-size-${size}:var(--type-${TYPOGRAPHY_TOKENS[tokenName].cssName}-size);`
  )),
  ...WEIGHT_ALIASES.map(weight => (
    `--font-weight-${weight}:${weight === 950 ? 900 : weight};`
  )),
  ...LINE_HEIGHT_ALIASES.map(lineHeight => (
    `--line-height-${getLineHeightAliasName(lineHeight)}:${lineHeight};`
  )),
  '--letter-spacing-none:0;',
  '--letter-spacing-04:.04em;',
  '--letter-spacing-08:.08em;'
].join('')

export const createTypographyCssVariables = (viewport: TypographyViewport = 'desktop') => [
  `--type-font-family-sans:${TYPOGRAPHY_FONT_FAMILY.sans};`,
  `--type-font-family-mono:${TYPOGRAPHY_FONT_FAMILY.mono};`,
  createScaleVariables(viewport),
  createAliasVariables()
].join('')

export const createTypographySystemCss = () => `
:root{${createTypographyCssVariables('desktop')}}
@media (max-width:${TYPOGRAPHY_BREAKPOINTS.tablet}px){:root{${createScaleVariables('tablet')}}}
@media (max-width:${TYPOGRAPHY_BREAKPOINTS.mobile}px){:root{${createScaleVariables('mobile')}}}
@media (prefers-color-scheme:dark){:root{--type-body-weight:550;--type-body-large-weight:550;--type-body-small-weight:650;--font-weight-750:780;--font-weight-850:870;}}
`.trim()

export const getTypographyToken = (tokenName: TypographyTokenName) => TYPOGRAPHY_TOKENS[tokenName]

export const getTypographyClassName = (tokenName: TypographyTokenName) => (
  `type-${TYPOGRAPHY_TOKENS[tokenName].cssName}`
)

export const createTypographyStyle = (
  tokenName: TypographyTokenName,
  viewport: TypographyViewport = 'desktop'
): TypographyCssProperties => {
  const token = getTypographyToken(tokenName)
  return {
    fontFamily: TYPOGRAPHY_FONT_FAMILY.sans,
    fontSize: token.fontSize[viewport],
    fontWeight: token.fontWeight,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    textTransform: token.textTransform
  }
}

export const applyTypographySystem = (targetDocument: Document = document) => {
  const styleId = 'miyop-typography-system'
  const existingStyle = targetDocument.getElementById(styleId)
  const cssText = createTypographySystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = styleId
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
