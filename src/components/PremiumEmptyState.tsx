import React from 'react'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'

export type PremiumEmptyStateTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type PremiumEmptyStateSize = 'compact' | 'comfortable' | 'hero'

export type PremiumEmptyStateAction = {
  key: string
  label: React.ReactNode
  icon?: AppIconProps['name']
  tone?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  onClick?: () => void
}

export type PremiumEmptyStateProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  iconSource?: string
  eyebrow?: React.ReactNode
  tone?: PremiumEmptyStateTone
  size?: PremiumEmptyStateSize
  actions?: PremiumEmptyStateAction[]
  children?: React.ReactNode
  className?: string
  dataOnboardingTarget?: string
}

const toneClass = (tone: PremiumEmptyStateTone) => `tone-${tone}`

const getActionClassName = (tone?: PremiumEmptyStateAction['tone']) => {
  if(tone === 'primary') return 'btn primary'
  if(tone === 'ghost') return 'btn ghost'
  return 'btn'
}

export const PremiumEmptyState = ({
  title = 'Kayit bulunamadi',
  description = 'Bu alan icin gosterilecek icerik yok.',
  icon = 'empty',
  iconSource,
  eyebrow,
  tone = 'info',
  size = 'comfortable',
  actions = [],
  children,
  className = '',
  dataOnboardingTarget
}: PremiumEmptyStateProps) => (
  <section
    className={['premium-empty-state', toneClass(tone), `size-${size}`, className].filter(Boolean).join(' ')}
    data-onboarding-target={dataOnboardingTarget}
  >
    <span className="premium-empty-state-visual" aria-hidden="true">
      <AppIcon name={iconSource ? undefined : icon} source={iconSource} size={size === 'hero' ? 'XXL' : 'LG'} />
    </span>
    <div className="premium-empty-state-copy">
      {eyebrow && <span className="premium-empty-state-eyebrow">{eyebrow}</span>}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {children && <div className="premium-empty-state-extra">{children}</div>}
      {actions.length > 0 && (
        <div className="premium-empty-state-actions">
          {actions.map(action => (
            <button
              className={getActionClassName(action.tone)}
              type="button"
              key={action.key}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.icon && <AppIcon name={action.icon} size="SM" />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </section>
)

export default PremiumEmptyState
