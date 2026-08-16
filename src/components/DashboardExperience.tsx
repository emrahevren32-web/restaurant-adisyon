import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import { PremiumSkeleton } from './PremiumLoading'

export type DashboardKpiTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export type DashboardHeaderAction = {
  key: string
  label: string
  icon?: string
  tone?: 'primary' | 'default'
  onClick: () => void
}

export type DashboardHeaderMeta = {
  key: string
  label: React.ReactNode
  icon?: string
  tone?: DashboardKpiTone
}

export type DashboardExperienceHeaderProps = {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  icon?: string
  className?: string
  dataOnboardingTarget?: string
  meta?: DashboardHeaderMeta[]
  actions?: DashboardHeaderAction[]
  children?: React.ReactNode
}

export const DashboardExperienceHeader = ({
  eyebrow,
  title,
  description,
  icon = 'dashboard',
  className = '',
  dataOnboardingTarget,
  meta = [],
  actions = [],
  children
}: DashboardExperienceHeaderProps) => (
  <section className={['dashboard-experience-header', className].filter(Boolean).join(' ')} data-onboarding-target={dataOnboardingTarget}>
    <div className="dashboard-experience-header-copy">
      <span className="dashboard-experience-header-icon" aria-hidden="true">
        <AppIcon source={icon} label={String(title)} context="dashboard header" size="LG" />
      </span>
      <div>
        {eyebrow && <span className="dashboard-experience-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {meta.length > 0 && (
          <div className="dashboard-experience-meta">
            {meta.map(item => (
              <span className={['dashboard-experience-meta-pill', item.tone || 'neutral'].join(' ')} key={item.key}>
                {item.icon && <AppIcon source={item.icon} label={String(item.label)} context="dashboard meta" size="XS" />}
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
    {(actions.length > 0 || children) && (
      <div className="dashboard-experience-actions">
        {actions.map(action => (
          <button
            className={['btn', action.tone === 'primary' ? 'primary dashboard-experience-action-primary' : 'dashboard-experience-action'].filter(Boolean).join(' ')}
            type="button"
            key={action.key}
            onClick={action.onClick}
          >
            {action.icon && <AppIcon source={action.icon} label={action.label} context="dashboard action" size="SM" />}
            {action.label}
          </button>
        ))}
        {children}
      </div>
    )}
  </section>
)

export type DashboardKpiCardProps = {
  label: React.ReactNode
  value: React.ReactNode
  detail?: React.ReactNode
  tone?: DashboardKpiTone
  icon?: string
  trend?: React.ReactNode
  compact?: boolean
}

export const DashboardKpiCard = ({
  label,
  value,
  detail,
  tone = 'neutral',
  icon = 'dashboard',
  trend,
  compact = false
}: DashboardKpiCardProps) => (
  <article className={['metric-card', 'dashboard-kpi-card', 'dashboard-experience-kpi-card', tone, compact ? 'compact' : ''].filter(Boolean).join(' ')}>
    <div className="dashboard-experience-kpi-topline">
      <span className="dashboard-experience-kpi-icon" aria-hidden="true">
        <AppIcon source={icon} label={String(label)} context="dashboard kpi" size="MD" />
      </span>
      {trend && <span className="dashboard-experience-kpi-trend">{trend}</span>}
    </div>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail && <small>{detail}</small>}
  </article>
)

export type DashboardEmptyStateProps = {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: string
  actions?: React.ReactNode
  compact?: boolean
  className?: string
  dataOnboardingTarget?: string
}

export const DashboardEmptyState = ({
  title,
  description,
  icon = 'dashboard',
  actions,
  compact = false,
  className = '',
  dataOnboardingTarget
}: DashboardEmptyStateProps) => (
  <section className={['dashboard-experience-empty-state', compact ? 'compact' : '', className].filter(Boolean).join(' ')} data-onboarding-target={dataOnboardingTarget}>
    <span className="dashboard-experience-empty-icon" aria-hidden="true">
      <AppIcon source={icon} label={String(title)} context="dashboard empty state" size={compact ? 'LG' : 'XXL'} />
    </span>
    <div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actions && <div className="dashboard-experience-empty-actions">{actions}</div>}
    </div>
  </section>
)

export type DashboardWidgetPanelProps = {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  loading?: boolean
}

export const DashboardWidgetPanel = ({
  title,
  description,
  action,
  children,
  className = '',
  loading = false
}: DashboardWidgetPanelProps) => (
  <section className={['card', 'dashboard-experience-widget', className, loading ? 'loading' : ''].filter(Boolean).join(' ')}>
    <div className="section-header compact dashboard-experience-widget-header">
      <div>
        <h3>{title}</h3>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="dashboard-experience-widget-action">{action}</div>}
    </div>
    {loading ? <PremiumSkeleton variant="widget" className="dashboard-experience-widget-loading" /> : children}
  </section>
)

export default DashboardExperienceHeader
