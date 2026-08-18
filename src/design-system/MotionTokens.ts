export type MotionDurationToken =
  | 'instant'
  | 'micro'
  | 'fast'
  | 'normal'
  | 'slow'
  | 'slower'
  | 'loading'
  | 'attention'
  | 'spinner'

export type MotionEasingToken =
  | 'ease'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'standard'
  | 'productive'
  | 'spring'
  | 'linear'

export type MotionTransitionToken =
  | 'interactive'
  | 'button'
  | 'press'
  | 'navigation'
  | 'sidebar'
  | 'surface'
  | 'focus'
  | 'page'
  | 'overlay'
  | 'modal'
  | 'drawer'
  | 'dialog'
  | 'dropdown'
  | 'tooltip'
  | 'menu'
  | 'accordion'
  | 'collapse'
  | 'tab'
  | 'table'
  | 'form'
  | 'feedback'
  | 'loading'
  | 'skeleton'
  | 'selection'
  | 'transform'
  | 'colors'

export const MOTION_DURATION_KEYS: MotionDurationToken[] = [
  'instant',
  'micro',
  'fast',
  'normal',
  'slow',
  'slower',
  'loading',
  'attention',
  'spinner'
]

export const MOTION_EASING_KEYS: MotionEasingToken[] = [
  'ease',
  'easeIn',
  'easeOut',
  'easeInOut',
  'standard',
  'productive',
  'spring',
  'linear'
]

export const MOTION_TRANSITION_KEYS: MotionTransitionToken[] = [
  'interactive',
  'button',
  'press',
  'navigation',
  'sidebar',
  'surface',
  'focus',
  'page',
  'overlay',
  'modal',
  'drawer',
  'dialog',
  'dropdown',
  'tooltip',
  'menu',
  'accordion',
  'collapse',
  'tab',
  'table',
  'form',
  'feedback',
  'loading',
  'skeleton',
  'selection',
  'transform',
  'colors'
]

export const MOTION_DURATIONS: Record<MotionDurationToken, string> = {
  instant: '1ms',
  micro: '100ms',
  fast: '150ms',
  normal: '200ms',
  slow: '250ms',
  slower: '300ms',
  loading: '1150ms',
  attention: '1200ms',
  spinner: '850ms'
}

export const MOTION_EASINGS: Record<MotionEasingToken, string> = {
  ease: 'cubic-bezier(.2, 0, 0, 1)',
  easeIn: 'cubic-bezier(.32, 0, .67, 0)',
  easeOut: 'cubic-bezier(.22, 1, .36, 1)',
  easeInOut: 'cubic-bezier(.65, 0, .35, 1)',
  standard: 'cubic-bezier(.2, 0, 0, 1)',
  productive: 'cubic-bezier(.16, 1, .3, 1)',
  spring: 'cubic-bezier(.16, 1, .3, 1)',
  linear: 'linear'
}

export const MOTION_TRANSITIONS: Record<MotionTransitionToken, string> = {
  interactive: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)',
    'opacity var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  button: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)',
    'opacity var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-micro) var(--motion-ease-standard)'
  ].join(', '),
  press: [
    'box-shadow var(--motion-micro) var(--motion-ease-standard)',
    'opacity var(--motion-micro) var(--motion-ease-standard)',
    'transform var(--motion-micro) var(--motion-ease-standard)'
  ].join(', '),
  navigation: [
    'grid-template-columns var(--motion-slow) var(--motion-ease-standard)',
    'width var(--motion-slow) var(--motion-ease-standard)',
    'max-height var(--motion-slower) var(--motion-ease-standard)',
    'opacity var(--motion-normal) var(--motion-ease-standard)',
    'padding var(--motion-normal) var(--motion-ease-standard)',
    'transform var(--motion-slow) var(--motion-ease-standard)'
  ].join(', '),
  sidebar: [
    'background var(--motion-normal) var(--motion-ease-standard)',
    'box-shadow var(--motion-normal) var(--motion-ease-standard)',
    'grid-template-columns var(--motion-slow) var(--motion-ease-standard)',
    'opacity var(--motion-normal) var(--motion-ease-standard)',
    'padding var(--motion-normal) var(--motion-ease-standard)',
    'transform var(--motion-slow) var(--motion-ease-standard)',
    'width var(--motion-slow) var(--motion-ease-standard)'
  ].join(', '),
  surface: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  focus: [
    'border-color var(--motion-micro) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'outline-color var(--motion-micro) var(--motion-ease-standard)'
  ].join(', '),
  page: [
    'opacity var(--motion-slow) var(--motion-ease-out)',
    'transform var(--motion-slow) var(--motion-ease-out)'
  ].join(', '),
  overlay: [
    'opacity var(--motion-normal) var(--motion-ease-out)',
    'backdrop-filter var(--motion-normal) var(--motion-ease-out)'
  ].join(', '),
  modal: [
    'opacity var(--motion-slow) var(--motion-ease-spring)',
    'transform var(--motion-slow) var(--motion-ease-spring)'
  ].join(', '),
  drawer: [
    'opacity var(--motion-slower) var(--motion-ease-spring)',
    'transform var(--motion-slower) var(--motion-ease-spring)'
  ].join(', '),
  dialog: [
    'opacity var(--motion-slow) var(--motion-ease-spring)',
    'transform var(--motion-slow) var(--motion-ease-spring)'
  ].join(', '),
  dropdown: [
    'opacity var(--motion-normal) var(--motion-ease-spring)',
    'transform var(--motion-normal) var(--motion-ease-spring)',
    'visibility var(--motion-normal) var(--motion-ease-standard)'
  ].join(', '),
  tooltip: [
    'opacity var(--motion-fast) var(--motion-ease-out)',
    'transform var(--motion-fast) var(--motion-ease-out)',
    'visibility var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  menu: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'opacity var(--motion-normal) var(--motion-ease-spring)',
    'transform var(--motion-normal) var(--motion-ease-spring)'
  ].join(', '),
  accordion: [
    'grid-template-rows var(--motion-slow) var(--motion-ease-standard)',
    'max-height var(--motion-slower) var(--motion-ease-standard)',
    'opacity var(--motion-normal) var(--motion-ease-standard)',
    'padding var(--motion-normal) var(--motion-ease-standard)',
    'transform var(--motion-normal) var(--motion-ease-standard)'
  ].join(', '),
  collapse: [
    'max-height var(--motion-slower) var(--motion-ease-standard)',
    'opacity var(--motion-normal) var(--motion-ease-standard)',
    'padding var(--motion-normal) var(--motion-ease-standard)',
    'visibility var(--motion-normal) var(--motion-ease-standard)'
  ].join(', '),
  tab: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  table: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  form: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  feedback: [
    'opacity var(--motion-slow) var(--motion-ease-out)',
    'transform var(--motion-slow) var(--motion-ease-out)'
  ].join(', '),
  loading: [
    'opacity var(--motion-normal) var(--motion-ease-in-out)',
    'transform var(--motion-normal) var(--motion-ease-in-out)'
  ].join(', '),
  skeleton: [
    'background-position var(--motion-loading) var(--motion-ease-in-out)',
    'opacity var(--motion-normal) var(--motion-ease-in-out)'
  ].join(', '),
  selection: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  transform: 'transform var(--motion-fast) var(--motion-ease-standard)',
  colors: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)'
  ].join(', ')
}

const toCssVariableName = (name: string) => (
  name.replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
)

export const getMotionDurationVariable = (token: MotionDurationToken) => (
  `var(--motion-${toCssVariableName(token)})`
)

export const getMotionEasingVariable = (token: MotionEasingToken) => {
  const suffix = token === 'ease' ? '' : `-${toCssVariableName(token)}`
  return `var(--motion-ease${suffix})`
}

export const getMotionTransitionVariable = (token: MotionTransitionToken) => (
  `var(--motion-transition-${toCssVariableName(token)})`
)

const createMotionDurationCssVariables = () => (
  MOTION_DURATION_KEYS
    .map(token => `--motion-${toCssVariableName(token)}:${MOTION_DURATIONS[token]};`)
    .join('')
)

const createMotionEasingCssVariables = () => (
  MOTION_EASING_KEYS
    .map(token => {
      const suffix = token === 'ease' ? '' : `-${toCssVariableName(token)}`
      return `--motion-ease${suffix}:${MOTION_EASINGS[token]};`
    })
    .join('')
)

const createMotionTransitionCssVariables = () => (
  MOTION_TRANSITION_KEYS
    .map(token => `--motion-transition-${toCssVariableName(token)}:${MOTION_TRANSITIONS[token]};`)
    .join('')
)

const createCompatibilityMotionCssVariables = () => [
  '--motion-duration-micro:var(--motion-micro);',
  '--motion-medium:var(--motion-normal);',
  '--motion-duration-fast:var(--motion-fast);',
  '--motion-duration-normal:var(--motion-normal);',
  '--motion-duration-slow:var(--motion-slow);',
  '--motion-duration-slower:var(--motion-slower);',
  '--motion-ease-emphasized:var(--motion-ease-spring);',
  '--motion-hover-lift:1px;',
  '--motion-hover-lift-strong:2px;',
  '--motion-press-scale:.985;',
  '--motion-focus-offset:2px;',
  '--motion-enter-distance:var(--space-8);',
  '--motion-enter-distance-sm:var(--space-4);',
  '--motion-enter-distance-lg:var(--space-16);',
  '--motion-transition-hover:var(--motion-transition-interactive);',
  '--motion-transition-button-hover:var(--motion-transition-button);'
].join('')

export const createMotionTokenCssVariables = () => [
  createMotionDurationCssVariables(),
  createMotionEasingCssVariables(),
  createMotionTransitionCssVariables(),
  createCompatibilityMotionCssVariables()
].join('')
