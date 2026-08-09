export type MotionDurationToken =
  | 'instant'
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
  | 'navigation'
  | 'surface'
  | 'focus'
  | 'page'
  | 'overlay'
  | 'feedback'
  | 'transform'
  | 'colors'

export const MOTION_DURATION_KEYS: MotionDurationToken[] = [
  'instant',
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
  'navigation',
  'surface',
  'focus',
  'page',
  'overlay',
  'feedback',
  'transform',
  'colors'
]

export const MOTION_DURATIONS: Record<MotionDurationToken, string> = {
  instant: '1ms',
  fast: '140ms',
  normal: '220ms',
  slow: '360ms',
  slower: '520ms',
  loading: '1150ms',
  attention: '1200ms',
  spinner: '850ms'
}

export const MOTION_EASINGS: Record<MotionEasingToken, string> = {
  ease: 'cubic-bezier(.2, 0, 0, 1)',
  easeIn: 'cubic-bezier(.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, .2, 1)',
  easeInOut: 'cubic-bezier(.4, 0, .2, 1)',
  standard: 'cubic-bezier(.2, 0, 0, 1)',
  productive: 'cubic-bezier(.2, .8, .2, 1)',
  spring: 'cubic-bezier(.16, 1, .3, 1)',
  linear: 'linear'
}

export const MOTION_TRANSITIONS: Record<MotionTransitionToken, string> = {
  interactive: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'color var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  navigation: [
    'grid-template-columns var(--motion-normal) var(--motion-ease-standard)',
    'width var(--motion-normal) var(--motion-ease-standard)',
    'max-height var(--motion-slow) var(--motion-ease-standard)',
    'opacity var(--motion-normal) var(--motion-ease-standard)',
    'padding var(--motion-normal) var(--motion-ease-standard)',
    'transform var(--motion-normal) var(--motion-ease-standard)'
  ].join(', '),
  surface: [
    'background var(--motion-fast) var(--motion-ease-standard)',
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'transform var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  focus: [
    'border-color var(--motion-fast) var(--motion-ease-standard)',
    'box-shadow var(--motion-fast) var(--motion-ease-standard)',
    'outline-color var(--motion-fast) var(--motion-ease-standard)'
  ].join(', '),
  page: [
    'opacity var(--motion-normal) var(--motion-ease-out)',
    'transform var(--motion-normal) var(--motion-ease-out)'
  ].join(', '),
  overlay: [
    'opacity var(--motion-fast) var(--motion-ease-out)',
    'backdrop-filter var(--motion-fast) var(--motion-ease-out)'
  ].join(', '),
  feedback: [
    'opacity var(--motion-normal) var(--motion-ease-out)',
    'transform var(--motion-normal) var(--motion-ease-out)'
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
  '--motion-medium:var(--motion-normal);',
  '--motion-duration-fast:var(--motion-fast);',
  '--motion-duration-normal:var(--motion-normal);',
  '--motion-duration-slow:var(--motion-slow);',
  '--motion-ease-emphasized:var(--motion-ease-spring);',
  '--motion-hover-lift:var(--space-2);',
  '--motion-press-scale:.985;',
  '--motion-focus-offset:var(--space-2);'
].join('')

export const createMotionTokenCssVariables = () => [
  createMotionDurationCssVariables(),
  createMotionEasingCssVariables(),
  createMotionTransitionCssVariables(),
  createCompatibilityMotionCssVariables()
].join('')
