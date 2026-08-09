import React from 'react'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'

export type PremiumCardTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
export type PremiumCardPadding = 'none' | 'compact' | 'comfortable'

export type PremiumCardHeaderProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  icon?: AppIconProps['name']
  tone?: PremiumCardTone
  actions?: React.ReactNode
  className?: string
}

export type PremiumCardFooterProps = {
  children: React.ReactNode
  align?: 'start' | 'end' | 'between'
  className?: string
}

export type PremiumCardProps = Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
  title?: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  icon?: AppIconProps['name']
  actions?: React.ReactNode
  footer?: React.ReactNode
  tone?: PremiumCardTone
  padding?: PremiumCardPadding
  interactive?: boolean
  loading?: boolean
  children?: React.ReactNode
}

export type PremiumWidgetProps = Omit<PremiumCardProps, 'loading'> & {
  loading?: boolean
  empty?: boolean
  emptyTitle?: React.ReactNode
  emptyDescription?: React.ReactNode
}

export type PremiumKpiCardProps = {
  label: React.ReactNode
  value: React.ReactNode
  description?: React.ReactNode
  trend?: React.ReactNode
  badge?: React.ReactNode
  icon?: AppIconProps['name']
  tone?: PremiumCardTone
  className?: string
}

export type PremiumStatCardProps = PremiumKpiCardProps & {
  chart?: React.ReactNode
  footer?: React.ReactNode
}

export type PremiumInfoCardProps = {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  tone?: PremiumCardTone
  actions?: React.ReactNode
  className?: string
}

export type PremiumActionCardProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> & {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  actionLabel?: React.ReactNode
  tone?: PremiumCardTone
}

export type PremiumEmptyCardProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  action?: React.ReactNode
  compact?: boolean
  className?: string
}

const toneClass = (tone?: PremiumCardTone) => tone && tone !== 'neutral' ? tone : 'neutral'

export const PremiumCardHeader = ({
  title,
  description,
  eyebrow,
  icon,
  tone = 'neutral',
  actions,
  className = ''
}: PremiumCardHeaderProps) => (
  <header className={['premium-card-header', toneClass(tone), className].filter(Boolean).join(' ')}>
    {(icon || title || description || eyebrow) && (
      <div className="premium-card-heading">
        {icon && (
          <span className="premium-card-icon" aria-hidden="true">
            <AppIcon name={icon} size="MD" />
          </span>
        )}
        <div>
          {eyebrow && <span className="premium-card-eyebrow">{eyebrow}</span>}
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      </div>
    )}
    {actions && <div className="premium-card-actions">{actions}</div>}
  </header>
)

export const PremiumCardFooter = ({
  children,
  align = 'end',
  className = ''
}: PremiumCardFooterProps) => (
  <footer className={['premium-card-footer', `align-${align}`, className].filter(Boolean).join(' ')}>
    {children}
  </footer>
)

export const PremiumCard = ({
  title,
  description,
  eyebrow,
  icon,
  actions,
  footer,
  tone = 'neutral',
  padding = 'comfortable',
  interactive = false,
  loading = false,
  children,
  className = '',
  ...props
}: PremiumCardProps) => (
  <article
    {...props}
    className={['premium-card', toneClass(tone), `padding-${padding}`, interactive ? 'interactive' : '', loading ? 'loading' : '', className].filter(Boolean).join(' ')}
  >
    {(title || description || eyebrow || icon || actions) && (
      <PremiumCardHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        icon={icon}
        tone={tone}
        actions={actions}
      />
    )}
    <div className="premium-card-body">
      {loading ? <PremiumCardLoading /> : children}
    </div>
    {footer && <PremiumCardFooter>{footer}</PremiumCardFooter>}
  </article>
)

export const PremiumWidget = ({
  loading = false,
  empty = false,
  emptyTitle,
  emptyDescription,
  children,
  icon = 'dashboard',
  ...props
}: PremiumWidgetProps) => (
  <PremiumCard {...props} icon={icon} className={['premium-widget', props.className || ''].filter(Boolean).join(' ')}>
    {loading ? (
      <PremiumCardLoading />
    ) : empty ? (
      <PremiumEmptyCard title={emptyTitle} description={emptyDescription} compact />
    ) : children}
  </PremiumCard>
)

export const PremiumKpiCard = ({
  label,
  value,
  description,
  trend,
  badge,
  icon = 'dashboard',
  tone = 'neutral',
  className = ''
}: PremiumKpiCardProps) => (
  <article className={['premium-card', 'premium-kpi-card', toneClass(tone), className].filter(Boolean).join(' ')}>
    <div className="premium-kpi-topline">
      <span className="premium-card-icon" aria-hidden="true">
        <AppIcon name={icon} size="MD" />
      </span>
      {(badge || trend) && <span className="premium-kpi-badge">{badge || trend}</span>}
    </div>
    <span className="premium-kpi-label">{label}</span>
    <strong className="premium-kpi-value">{value}</strong>
    {description && <small className="premium-kpi-description">{description}</small>}
  </article>
)

export const PremiumStatCard = ({
  label,
  value,
  description,
  trend,
  badge,
  icon = 'dashboard',
  tone = 'neutral',
  className = '',
  chart,
  footer
}: PremiumStatCardProps) => (
  <article className={['premium-card', 'premium-stat-card', toneClass(tone), className].filter(Boolean).join(' ')}>
    <div className="premium-stat-card-metric">
      <div className="premium-kpi-topline">
        <span className="premium-card-icon" aria-hidden="true">
          <AppIcon name={icon} size="MD" />
        </span>
        {(badge || trend) && <span className="premium-kpi-badge">{badge || trend}</span>}
      </div>
      <span className="premium-kpi-label">{label}</span>
      <strong className="premium-kpi-value">{value}</strong>
      {description && <small className="premium-kpi-description">{description}</small>}
    </div>
    {chart && <div className="premium-stat-chart">{chart}</div>}
    {footer && <PremiumCardFooter align="between">{footer}</PremiumCardFooter>}
  </article>
)

export const PremiumInfoCard = ({
  title,
  description,
  icon = 'info',
  tone = 'info',
  actions,
  className = ''
}: PremiumInfoCardProps) => (
  <PremiumCard title={title} description={description} icon={icon} tone={tone} actions={actions} className={['premium-info-card', className].filter(Boolean).join(' ')} />
)

export const PremiumActionCard = ({
  title,
  description,
  icon = 'plus',
  actionLabel,
  tone = 'neutral',
  className = '',
  ...props
}: PremiumActionCardProps) => (
  <button
    {...props}
    type={props.type || 'button'}
    className={['premium-card', 'premium-action-card', toneClass(tone), className].filter(Boolean).join(' ')}
  >
    <span className="premium-card-icon" aria-hidden="true">
      <AppIcon name={icon} size="LG" />
    </span>
    <span className="premium-action-copy">
      <strong>{title}</strong>
      {description && <small>{description}</small>}
    </span>
    {actionLabel && <span className="premium-action-label">{actionLabel}</span>}
  </button>
)

export const PremiumEmptyCard = ({
  title = 'Kayıt bulunamadı',
  description = 'Bu alan için gösterilecek içerik yok.',
  icon = 'empty',
  action,
  compact = false,
  className = ''
}: PremiumEmptyCardProps) => (
  <section className={['premium-card', 'premium-empty-card', compact ? 'compact' : '', className].filter(Boolean).join(' ')}>
    <span className="premium-card-icon" aria-hidden="true">
      <AppIcon name={icon} size={compact ? 'MD' : 'LG'} />
    </span>
    <div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="premium-empty-actions">{action}</div>}
    </div>
  </section>
)

export const PremiumCardLoading = () => (
  <div className="premium-card-loading" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
)

export default PremiumCard
