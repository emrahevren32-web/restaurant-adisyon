import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import { PremiumEmptyState } from './PremiumEmptyState'
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
  <section
    className={['dashboard-experience-header', 'dashboard-operational-toolbar', className].filter(Boolean).join(' ')}
    data-onboarding-target={dataOnboardingTarget}
  >
    <div className="dashboard-operational-title-cluster">
      <span className="dashboard-operational-icon" aria-hidden="true">
        <AppIcon source={icon} label={String(title)} context="dashboard header" size="SM" />
      </span>
      <div className="dashboard-operational-copy">
        <div className="dashboard-operational-title-row">
          <h2>{title}</h2>
          {eyebrow && <span className="dashboard-operational-eyebrow">{eyebrow}</span>}
        </div>
        {description && <p className="dashboard-operational-desc">{description}</p>}
      </div>
    </div>
    {(meta.length > 0 || actions.length > 0 || children) && (
      <div className="dashboard-operational-actions-cluster">
        {meta.length > 0 && (
          <div className="dashboard-operational-meta-list">
            {meta.map(item => (
              <span className={['dashboard-operational-meta-pill', item.tone || 'neutral'].join(' ')} key={item.key}>
                {item.icon && <AppIcon source={item.icon} label={String(item.label)} context="dashboard meta" size="XS" />}
                {item.label}
              </span>
            ))}
          </div>
        )}
        {(actions.length > 0 || children) && (
          <div className="dashboard-operational-actions" data-action-count={actions.length}>
            {actions.map(action => (
              <button
                className={['btn', action.tone === 'primary' ? 'primary' : 'secondary'].filter(Boolean).join(' ')}
                type="button"
                key={action.key}
                data-action-tone={action.tone || 'default'}
                onClick={action.onClick}
              >
                {action.icon && <AppIcon source={action.icon} label={action.label} context="dashboard action" size="XS" />}
                <span>{action.label}</span>
              </button>
            ))}
            {children}
          </div>
        )}
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
  <article className={['metric-card', 'dashboard-kpi-card', 'operational-kpi-card', tone, compact ? 'compact' : ''].filter(Boolean).join(' ')}>
    <div className="operational-kpi-header">
      <span className="operational-kpi-label">{label}</span>
      {trend ? (
        <span className={['operational-kpi-trend', tone].join(' ')}>{trend}</span>
      ) : (
        <span className="operational-kpi-icon" aria-hidden="true">
          <AppIcon source={icon} label={String(label)} context="dashboard kpi" size="XS" />
        </span>
      )}
    </div>
    <div className="operational-kpi-body">
      <strong className="operational-kpi-value">{value}</strong>
      {detail && <span className="operational-kpi-detail">{detail}</span>}
    </div>
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
  compact = true,
  className = '',
  dataOnboardingTarget
}: DashboardEmptyStateProps) => (
  <PremiumEmptyState
    title={title}
    description={description}
    iconSource={icon}
    size={compact ? 'compact' : 'comfortable'}
    className={['dashboard-experience-empty-state', 'operational-empty-state', compact ? 'compact' : '', className].filter(Boolean).join(' ')}
    dataOnboardingTarget={dataOnboardingTarget}
  >
    {actions && <div className="dashboard-experience-empty-actions">{actions}</div>}
  </PremiumEmptyState>
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
  <section className={['operational-panel', className, loading ? 'loading' : ''].filter(Boolean).join(' ')}>
    <div className="section-header compact operational-panel-header">
      <div>
        <h3>{title}</h3>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="operational-panel-action">{action}</div>}
    </div>
    {loading ? <PremiumSkeleton variant="widget" className="dashboard-experience-widget-loading" /> : children}
  </section>
)

export default DashboardExperienceHeader
