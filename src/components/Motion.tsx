import React from 'react'
import {
  getMotionDurationVariable,
  getMotionEasingVariable,
  type MotionDurationToken,
  type MotionEasingToken
} from '../design-system/MotionTokens'

export type MotionPreference = 'system' | 'standard' | 'reduced'

export type MotionProviderProps = {
  children: React.ReactNode
  preference?: MotionPreference
}

export type MotionContextValue = {
  preference: MotionPreference
  reducedMotion: boolean
}

export type MotionElement =
  | 'div'
  | 'section'
  | 'article'
  | 'span'
  | 'main'
  | 'aside'
  | 'header'
  | 'footer'

export type MotionTransitionProps = React.HTMLAttributes<HTMLElement> & {
  as?: MotionElement
  show?: boolean
  duration?: MotionDurationToken
  easing?: MotionEasingToken
  delay?: MotionDurationToken
}

export type SlideTransitionProps = MotionTransitionProps & {
  direction?: 'up' | 'right' | 'down' | 'left'
}

export type ScaleTransitionProps = MotionTransitionProps & {
  origin?: 'center' | 'top' | 'right' | 'bottom' | 'left'
}

export type PremiumHoverProps = React.HTMLAttributes<HTMLElement> & {
  as?: MotionElement
  disabled?: boolean
  intensity?: 'subtle' | 'normal' | 'strong'
}

export type PremiumFocusProps = React.HTMLAttributes<HTMLElement> & {
  as?: MotionElement
  focusWithin?: boolean
}

type MotionComponentStyle = React.CSSProperties & {
  '--motion-component-duration'?: string
  '--motion-component-easing'?: string
  '--motion-component-delay'?: string
  '--motion-hover-lift'?: string
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const MotionContext = React.createContext<MotionContextValue>({
  preference: 'system',
  reducedMotion: false
})

const hasWindow = () => typeof window !== 'undefined'

const getSystemReducedMotion = () => (
  hasWindow() && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches)
)

const joinClassNames = (...classNames: Array<string | undefined | false>) => (
  classNames.filter(Boolean).join(' ')
)

const createTransitionStyle = ({
  duration,
  easing,
  delay,
  style
}: {
  duration: MotionDurationToken
  easing: MotionEasingToken
  delay?: MotionDurationToken
  style?: React.CSSProperties
}): MotionComponentStyle => {
  const motionStyle = {
    ...style,
    '--motion-component-duration': getMotionDurationVariable(duration),
    '--motion-component-easing': getMotionEasingVariable(easing)
  } as MotionComponentStyle

  if(delay){
    motionStyle['--motion-component-delay'] = getMotionDurationVariable(delay)
  }

  return motionStyle
}

export const useMotionPreference = () => React.useContext(MotionContext)

export const MotionProvider = ({
  children,
  preference = 'system'
}: MotionProviderProps) => {
  const [systemReducedMotion, setSystemReducedMotion] = React.useState(getSystemReducedMotion)
  const reducedMotion = preference === 'reduced'
    || (preference === 'system' && systemReducedMotion)

  React.useEffect(() => {
    if(!hasWindow()) return undefined

    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const syncPreference = () => setSystemReducedMotion(query.matches)

    syncPreference()
    if(query.addEventListener){
      query.addEventListener('change', syncPreference)
      return () => query.removeEventListener('change', syncPreference)
    }

    query.addListener(syncPreference)
    return () => query.removeListener(syncPreference)
  }, [])

  React.useEffect(() => {
    if(typeof document === 'undefined') return undefined

    const rootElement = document.documentElement
    const previousPreference = rootElement.dataset.motionPreference
    rootElement.dataset.motionPreference = reducedMotion ? 'reduced' : 'standard'

    return () => {
      if(previousPreference){
        rootElement.dataset.motionPreference = previousPreference
        return
      }

      delete rootElement.dataset.motionPreference
    }
  }, [reducedMotion])

  const value = React.useMemo<MotionContextValue>(() => ({
    preference,
    reducedMotion
  }), [preference, reducedMotion])

  return (
    <MotionContext.Provider value={value}>
      {children}
    </MotionContext.Provider>
  )
}

export const FadeTransition = ({
  as = 'div',
  show = true,
  duration = 'normal',
  easing = 'easeOut',
  delay,
  className = '',
  style,
  children,
  ...props
}: MotionTransitionProps) => {
  if(!show) return null

  return React.createElement(
    as,
    {
      ...props,
      className: joinClassNames('motion-fade-transition', className),
      'data-motion-state': 'enter',
      style: createTransitionStyle({ duration, easing, delay, style })
    },
    children
  )
}

export const SlideTransition = ({
  as = 'div',
  show = true,
  duration = 'normal',
  easing = 'easeOut',
  delay,
  direction = 'up',
  className = '',
  style,
  children,
  ...props
}: SlideTransitionProps) => {
  if(!show) return null

  return React.createElement(
    as,
    {
      ...props,
      className: joinClassNames('motion-slide-transition', className),
      'data-motion-state': 'enter',
      'data-motion-direction': direction,
      style: createTransitionStyle({ duration, easing, delay, style })
    },
    children
  )
}

export const ScaleTransition = ({
  as = 'div',
  show = true,
  duration = 'normal',
  easing = 'spring',
  delay,
  origin = 'center',
  className = '',
  style,
  children,
  ...props
}: ScaleTransitionProps) => {
  if(!show) return null

  return React.createElement(
    as,
    {
      ...props,
      className: joinClassNames('motion-scale-transition', className),
      'data-motion-state': 'enter',
      'data-motion-origin': origin,
      style: createTransitionStyle({ duration, easing, delay, style })
    },
    children
  )
}

export const PremiumHover = ({
  as = 'div',
  disabled = false,
  intensity = 'normal',
  className = '',
  style,
  children,
  ...props
}: PremiumHoverProps) => {
  const liftByIntensity: Record<NonNullable<PremiumHoverProps['intensity']>, string> = {
    subtle: 'calc(var(--space-2) / 2)',
    normal: 'var(--space-2)',
    strong: 'var(--space-4)'
  }
  const motionStyle = {
    ...style,
    '--motion-hover-lift': liftByIntensity[intensity]
  } as MotionComponentStyle

  return React.createElement(
    as,
    {
      ...props,
      className: joinClassNames('premium-hover', `hover-${intensity}`, disabled ? 'is-disabled' : '', className),
      'aria-disabled': disabled || undefined,
      style: motionStyle
    },
    children
  )
}

export const PremiumFocus = ({
  as = 'div',
  focusWithin = true,
  className = '',
  children,
  ...props
}: PremiumFocusProps) => (
  React.createElement(
    as,
    {
      ...props,
      className: joinClassNames('premium-focus', focusWithin ? 'focus-within' : '', className)
    },
    children
  )
)

export default MotionProvider
