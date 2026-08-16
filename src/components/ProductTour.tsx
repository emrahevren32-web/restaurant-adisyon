import React from 'react'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'

export type ProductTourStep = {
  key: string
  title: React.ReactNode
  description: React.ReactNode
  target?: string
  icon?: AppIconProps['name']
  badge?: React.ReactNode
}

export type ProductTourProviderProps = {
  open: boolean
  steps: ProductTourStep[]
  activeIndex: number
  welcome?: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: () => void
  className?: string
}

export type TourStepProps = {
  step: ProductTourStep
  activeIndex: number
  total: number
  welcome?: boolean
  ready?: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: () => void
}

export type FeatureHighlightTone = 'info' | 'success' | 'warning' | 'danger'

export type FeatureHighlightProps = {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  icon?: AppIconProps['name']
  tone?: FeatureHighlightTone
  actions?: React.ReactNode
  className?: string
}

export type GettingStartedStep = {
  key: string
  label: React.ReactNode
  done?: boolean
}

export type GettingStartedCardProps = {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  steps?: GettingStartedStep[]
  actionLabel?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  onAction?: () => void
  className?: string
}

export type QuickTipProps = {
  title?: React.ReactNode
  children: React.ReactNode
  icon?: AppIconProps['name']
  tone?: FeatureHighlightTone | 'neutral'
  dismissible?: boolean
  className?: string
}

const getReducedMotion = () => (
  document.documentElement.dataset.motionPreference === 'reduced'
  || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
)

const getTargetSelector = (target: string) => `[data-onboarding-target="${target}"]`

const clearHighlights = () => {
  document.querySelectorAll('.product-tour-highlight').forEach(element => {
    element.classList.remove('product-tour-highlight')
  })
}

export const TourStep = ({
  step,
  activeIndex,
  total,
  welcome = false,
  ready = false,
  onBack,
  onNext,
  onSkip,
  onFinish
}: TourStepProps) => {
  const progressValue = total <= 1 ? 100 : Math.round(((activeIndex + 1) / total) * 100)

  return (
    <section className="product-tour-card" role="dialog" aria-modal="false" aria-label="MIYOP product tour" tabIndex={-1}>
      <div className="product-tour-card-header">
        <span className="status-pill info-pill">
          {step.badge || (welcome ? 'Hos Geldiniz' : `Adim ${activeIndex + 1}/${total}`)}
        </span>
        <button className="btn ghost product-tour-close" type="button" onClick={onSkip}>Atla</button>
      </div>
      <div className="product-tour-copy">
        <span className="product-tour-icon" aria-hidden="true">
          <AppIcon name={step.icon || 'help'} size="MD" />
        </span>
        <div>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </div>
      </div>
      {!welcome && (
        <div className="product-tour-progress" role="progressbar" aria-label="Tur ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
          <span style={{ width: `${progressValue}%` }} />
        </div>
      )}
      <div className="product-tour-actions">
        {!welcome && (
          <button className="btn" type="button" onClick={onBack}>
            Geri
          </button>
        )}
        {ready ? (
          <button className="btn primary" type="button" onClick={onFinish}>
            Bitir
          </button>
        ) : (
          <button className="btn primary" type="button" onClick={onNext}>
            {welcome ? 'Rehberi Baslat' : 'Devam Et'}
          </button>
        )}
      </div>
    </section>
  )
}

export const ProductTourProvider = ({
  open,
  steps,
  activeIndex,
  welcome,
  onBack,
  onNext,
  onSkip,
  onFinish,
  className = ''
}: ProductTourProviderProps) => {
  const activeStep = steps[activeIndex] || steps[0]
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const ready = activeIndex >= steps.length - 1

  React.useEffect(() => {
    if(!open) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if(event.key === 'Escape') onSkip()
      if(event.key === 'ArrowRight') onNext()
      if(event.key === 'ArrowLeft' && !welcome) onBack()
    }

    document.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => cardRef.current?.focus(), 0)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onBack, onNext, onSkip, open, welcome])

  React.useEffect(() => {
    clearHighlights()
    if(!open || !activeStep?.target) return undefined

    const timer = window.setTimeout(() => {
      const target = document.querySelector(getTargetSelector(activeStep.target || ''))
      target?.classList.add('product-tour-highlight')
      target?.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: getReducedMotion() ? 'auto' : 'smooth'
      })
    }, getReducedMotion() ? 0 : 160)

    return () => {
      window.clearTimeout(timer)
      clearHighlights()
    }
  }, [activeStep, open])

  React.useEffect(() => {
    if(open) return undefined
    clearHighlights()
    return undefined
  }, [open])

  if(!open || !activeStep) return null

  return (
    <div className={['product-tour-shell', welcome ? 'welcome' : 'guided', className].filter(Boolean).join(' ')} role="presentation">
      <div className="product-tour-scrim" />
      <div ref={cardRef} tabIndex={-1}>
        <TourStep
          step={activeStep}
          activeIndex={activeIndex}
          total={steps.length}
          welcome={welcome}
          ready={ready}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          onFinish={onFinish}
        />
      </div>
    </div>
  )
}

export const FeatureHighlight = ({
  title,
  description,
  badge = "What's New",
  icon = 'info',
  tone = 'info',
  actions,
  className = ''
}: FeatureHighlightProps) => (
  <section className={['feature-highlight', `tone-${tone}`, className].filter(Boolean).join(' ')}>
    <span className="feature-highlight-icon" aria-hidden="true">
      <AppIcon name={icon} size="MD" />
    </span>
    <div className="feature-highlight-copy">
      <span>{badge}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="feature-highlight-actions">{actions}</div>}
  </section>
)

export const GettingStartedCard = ({
  title,
  description,
  icon = 'workspace',
  steps = [],
  actionLabel,
  badge,
  disabled = false,
  onAction,
  className = ''
}: GettingStartedCardProps) => (
  <article className={['getting-started-card', disabled ? 'disabled' : '', className].filter(Boolean).join(' ')}>
    <div className="getting-started-card-header">
      <span className="getting-started-card-icon" aria-hidden="true">
        <AppIcon name={icon} size="MD" />
      </span>
      {badge && <span className="getting-started-card-badge">{badge}</span>}
    </div>
    <div className="getting-started-card-copy">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
    {steps.length > 0 && (
      <ul className="getting-started-steps">
        {steps.map(step => (
          <li className={step.done ? 'done' : ''} key={step.key}>
            <span aria-hidden="true">{step.done && <AppIcon name="success" size="XS" />}</span>
            <strong>{step.label}</strong>
          </li>
        ))}
      </ul>
    )}
    {actionLabel && (
      <button className="btn primary" type="button" disabled={disabled || !onAction} onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </article>
)

export const QuickTip = ({
  title = 'Quick Tip',
  children,
  icon = 'help',
  tone = 'info',
  dismissible = false,
  className = ''
}: QuickTipProps) => {
  const [visible, setVisible] = React.useState(true)
  if(!visible) return null

  return (
    <aside className={['quick-tip', `tone-${tone}`, className].filter(Boolean).join(' ')} role="note">
      <span className="quick-tip-icon" aria-hidden="true">
        <AppIcon name={icon} size="SM" />
      </span>
      <div className="quick-tip-copy">
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
      {dismissible && (
        <button className="quick-tip-close" type="button" aria-label="Ipucunu kapat" onClick={() => setVisible(false)}>
          <AppIcon name="close" size="XS" />
        </button>
      )}
    </aside>
  )
}

export default ProductTourProvider
