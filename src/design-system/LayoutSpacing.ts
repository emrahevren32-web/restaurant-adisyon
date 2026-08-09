import {
  SPACING_TOKENS,
  getSpacingVariable,
  type SpacingToken
} from './SpacingTokens'

export type SpacingBreakpoint = 'desktop' | 'tablet' | 'mobile'

export type LayoutSpacingName =
  | 'pagePadding'
  | 'sectionGap'
  | 'cardGap'
  | 'cardPadding'
  | 'formGap'
  | 'inputGap'
  | 'buttonGap'
  | 'tableCellPadding'
  | 'modalPadding'
  | 'drawerPadding'
  | 'sidebarPadding'
  | 'navbarPadding'
  | 'widgetGap'

export type LayoutSpacingScale = Record<LayoutSpacingName, SpacingToken>

export const LAYOUT_SPACING: Record<SpacingBreakpoint, LayoutSpacingScale> = {
  desktop: {
    pagePadding: '24',
    sectionGap: '20',
    cardGap: '16',
    cardPadding: '20',
    formGap: '12',
    inputGap: '8',
    buttonGap: '8',
    tableCellPadding: '12',
    modalPadding: '24',
    drawerPadding: '24',
    sidebarPadding: '16',
    navbarPadding: '24',
    widgetGap: '12'
  },
  tablet: {
    pagePadding: '20',
    sectionGap: '16',
    cardGap: '12',
    cardPadding: '16',
    formGap: '12',
    inputGap: '8',
    buttonGap: '8',
    tableCellPadding: '8',
    modalPadding: '20',
    drawerPadding: '20',
    sidebarPadding: '12',
    navbarPadding: '20',
    widgetGap: '12'
  },
  mobile: {
    pagePadding: '12',
    sectionGap: '12',
    cardGap: '8',
    cardPadding: '12',
    formGap: '8',
    inputGap: '8',
    buttonGap: '8',
    tableCellPadding: '8',
    modalPadding: '16',
    drawerPadding: '16',
    sidebarPadding: '12',
    navbarPadding: '12',
    widgetGap: '8'
  }
}

export const PRINT_SPACING_VALUES = {
  space0: SPACING_TOKENS[0],
  space2: SPACING_TOKENS[2],
  space4: SPACING_TOKENS[4],
  space8: SPACING_TOKENS[8],
  space12: SPACING_TOKENS[12],
  space16: SPACING_TOKENS[16],
  space20: SPACING_TOKENS[20],
  space24: SPACING_TOKENS[24],
  space32: SPACING_TOKENS[32],
  space40: SPACING_TOKENS[40],
  space48: SPACING_TOKENS[48],
  space56: SPACING_TOKENS[56],
  space64: SPACING_TOKENS[64],
  space80: SPACING_TOKENS[80],
  space96: SPACING_TOKENS[96],
  space128: SPACING_TOKENS[128],
  pagePadding: SPACING_TOKENS[24],
  compactPagePadding: SPACING_TOKENS[16],
  sectionGap: SPACING_TOKENS[20],
  cardGap: SPACING_TOKENS[12],
  cardPadding: SPACING_TOKENS[12],
  tableCellPadding: SPACING_TOKENS[8],
  pillPadding: `${SPACING_TOKENS[4]} ${SPACING_TOKENS[12]}`
} as const

const toCssVariableName = (name: string) => (
  name.replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
)

export const createLayoutSpacingCssVariables = (breakpoint: SpacingBreakpoint = 'desktop') => (
  Object.entries(LAYOUT_SPACING[breakpoint])
    .map(([name, token]) => `--layout-${toCssVariableName(name)}:${getSpacingVariable(token)};`)
    .join('')
)

export const getLayoutSpacingVariable = (name: LayoutSpacingName) => (
  `var(--layout-${toCssVariableName(name)})`
)
