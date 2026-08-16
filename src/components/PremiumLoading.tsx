import React from 'react'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'

export type PremiumLoadingSize = 'small' | 'medium' | 'large'
export type PremiumLoadingTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type PremiumProgressStatus = 'idle' | 'running' | 'success' | 'warning' | 'danger' | 'error' | 'cancelled'
export type PremiumProgressKind = 'default' | 'page' | 'table' | 'card' | 'widget' | 'upload' | 'download'

export type PremiumSkeletonVariant =
  | 'line'
  | 'text'
  | 'title'
  | 'avatar'
  | 'button'
  | 'card'
  | 'table'
  | 'form'
  | 'dashboard'
  | 'widget'

export type PremiumSkeletonProps = {
  variant?: PremiumSkeletonVariant
  lines?: number
  rows?: number
  columns?: number
  animated?: boolean
  width?: number | string
  height?: number | string
  label?: string
  className?: string
  style?: React.CSSProperties
}

export type PremiumSpinnerProps = {
  size?: PremiumLoadingSize
  tone?: PremiumLoadingTone
  label?: React.ReactNode
  showLabel?: boolean
  className?: string
}

export type PremiumLinearProgressProps = {
  value?: number
  max?: number
  indeterminate?: boolean
  status?: PremiumProgressStatus
  tone?: PremiumLoadingTone
  label?: React.ReactNode
  description?: React.ReactNode
  statusLabel?: React.ReactNode
  showValue?: boolean
  size?: PremiumLoadingSize
  className?: string
}

export type PremiumCircularProgressProps = {
  value?: number
  max?: number
  indeterminate?: boolean
  status?: PremiumProgressStatus
  tone?: PremiumLoadingTone
  label?: React.ReactNode
  statusLabel?: React.ReactNode
  showValue?: boolean
  size?: PremiumLoadingSize
  className?: string
}

export type PremiumProgressProps = Omit<PremiumLinearProgressProps, 'label'> & {
  title?: React.ReactNode
  label?: React.ReactNode
  kind?: PremiumProgressKind
  variant?: 'linear' | 'circular'
  children?: React.ReactNode
}

export type PremiumLoadingOverlayProps = {
  open?: boolean
  label?: React.ReactNode
  description?: React.ReactNode
  progress?: number
  status?: PremiumProgressStatus
  tone?: PremiumLoadingTone
  size?: PremiumLoadingSize
  mode?: 'fullscreen' | 'container' | 'inline'
  showProgress?: boolean
  indeterminate?: boolean
  className?: string
  children?: React.ReactNode
}

type CssVars = React.CSSProperties & {
  '--premium-skeleton-width'?: string
  '--premium-skeleton-height'?: string
  '--premium-skeleton-columns'?: number
  '--premium-progress-value'?: string
}

const statusLabels: Record<PremiumProgressStatus, string> = {
  idle: 'Beklemede',
  running: 'Isleniyor',
  success: 'Tamamlandi',
  warning: 'Izleniyor',
  danger: 'Kritik',
  error: 'Hata',
  cancelled: 'Iptal'
}

const statusToneMap: Record<PremiumProgressStatus, PremiumLoadingTone> = {
  idle: 'neutral',
  running: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  error: 'danger',
  cancelled: 'warning'
}

const kindIconMap: Record<PremiumProgressKind, AppIconProps['name']> = {
  default: 'refresh',
  page: 'dashboard',
  table: 'reports',
  card: 'document',
  widget: 'module',
  upload: 'upload',
  download: 'download'
}

const statusIconMap: Partial<Record<PremiumProgressStatus, AppIconProps['name']>> = {
  success: 'success',
  warning: 'warning',
  danger: 'warning',
  error: 'error',
  cancelled: 'minus'
}

const clampPercent = (value = 0, max = 100) => {
  const safeMax = Math.max(1, max)
  const normalized = (Number.isFinite(value) ? value : 0) / safeMax * 100
  return Math.min(100, Math.max(0, Math.round(normalized)))
}

const toCssSize = (value?: number | string) => {
  if(value === undefined) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

const getTone = (status?: PremiumProgressStatus, tone?: PremiumLoadingTone) => (
  tone || (status ? statusToneMap[status] : 'info')
)

const joinClassNames = (...classNames: Array<string | undefined | false>) => (
  classNames.filter(Boolean).join(' ')
)

const createSkeletonStyle = ({
  width,
  height,
  columns,
  style
}: {
  width?: number | string
  height?: number | string
  columns?: number
  style?: React.CSSProperties
}) => ({
  ...style,
  ...(width !== undefined ? { '--premium-skeleton-width': toCssSize(width) } : {}),
  ...(height !== undefined ? { '--premium-skeleton-height': toCssSize(height) } : {}),
  ...(columns !== undefined ? { '--premium-skeleton-columns': Math.max(1, columns) } : {})
}) as CssVars

const SkeletonLine = ({
  variant = 'line',
  animated = true,
  width,
  height,
  className = '',
  style
}: Pick<PremiumSkeletonProps, 'variant' | 'animated' | 'width' | 'height' | 'className' | 'style'>) => (
  <span
    className={joinClassNames('premium-skeleton', `premium-skeleton-${variant}`, animated ? '' : 'no-animation', className)}
    style={createSkeletonStyle({ width, height, style })}
    aria-hidden="true"
  />
)

export const PremiumSkeleton = ({
  variant = 'text',
  lines = 3,
  rows = 5,
  columns = 4,
  animated = true,
  width,
  height,
  label,
  className = '',
  style
}: PremiumSkeletonProps) => {
  const accessibleProps = label
    ? { role: 'status' as const, 'aria-live': 'polite' as const, 'aria-label': label }
    : { 'aria-hidden': true as const }

  if(['line', 'text', 'title', 'avatar', 'button'].includes(variant)){
    const lineCount = variant === 'text' ? Math.max(1, lines) : 1

    if(lineCount === 1){
      return (
        <span
          {...accessibleProps}
          className={joinClassNames('premium-skeleton', `premium-skeleton-${variant}`, animated ? '' : 'no-animation', className)}
          style={createSkeletonStyle({ width, height, style })}
        />
      )
    }

    return (
      <span
        {...accessibleProps}
        className={joinClassNames('premium-skeleton-stack', animated ? '' : 'no-animation', className)}
        style={style}
      >
        {Array.from({ length: lineCount }).map((_, index) => (
          <SkeletonLine
            key={index}
            variant="line"
            animated={animated}
            width={index === lineCount - 1 ? width || '68%' : width}
            height={height}
          />
        ))}
      </span>
    )
  }

  if(variant === 'table'){
    return (
      <div
        {...accessibleProps}
        className={joinClassNames('premium-skeleton-block', 'premium-skeleton-table', animated ? '' : 'no-animation', className)}
        style={createSkeletonStyle({ columns, style })}
      >
        {Array.from({ length: Math.max(1, rows) }).map((_, rowIndex) => (
          <div className="premium-skeleton-table-row" key={rowIndex}>
            {Array.from({ length: Math.max(1, columns) }).map((__, columnIndex) => (
              <SkeletonLine
                key={`${rowIndex}-${columnIndex}`}
                variant="line"
                animated={animated}
                width={columnIndex === 0 ? '74%' : columnIndex === columns - 1 ? '52%' : '88%'}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if(variant === 'form'){
    return (
      <div
        {...accessibleProps}
        className={joinClassNames('premium-skeleton-block', 'premium-skeleton-form', animated ? '' : 'no-animation', className)}
        style={style}
      >
        {Array.from({ length: Math.max(1, rows) }).map((_, index) => (
          <div className="premium-skeleton-form-field" key={index}>
            <SkeletonLine variant="line" animated={animated} width="36%" height={10} />
            <SkeletonLine variant="button" animated={animated} width="100%" />
          </div>
        ))}
      </div>
    )
  }

  if(variant === 'dashboard'){
    return (
      <section
        {...accessibleProps}
        className={joinClassNames('premium-skeleton-block', 'premium-skeleton-dashboard', animated ? '' : 'no-animation', className)}
        style={style}
      >
        <div className="premium-skeleton-hero">
          <SkeletonLine variant="line" animated={animated} width="24%" />
          <SkeletonLine variant="title" animated={animated} width="46%" />
          <SkeletonLine variant="line" animated={animated} width="68%" />
        </div>
        <div className="premium-skeleton-kpi-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="premium-skeleton-card premium-skeleton-kpi" key={index}>
              <SkeletonLine variant="avatar" animated={animated} />
              <SkeletonLine variant="title" animated={animated} width="54%" />
              <SkeletonLine variant="line" animated={animated} width="72%" />
            </div>
          ))}
        </div>
        <PremiumSkeleton variant="table" rows={rows} columns={columns} animated={animated} />
      </section>
    )
  }

  return (
    <div
      {...accessibleProps}
      className={joinClassNames('premium-skeleton-block', `premium-skeleton-${variant}`, animated ? '' : 'no-animation', className)}
      style={style}
    >
      <SkeletonLine variant="line" animated={animated} width="36%" />
      <SkeletonLine variant="title" animated={animated} width="62%" />
      <SkeletonLine variant="line" animated={animated} width="88%" />
      <SkeletonLine variant="line" animated={animated} width="70%" />
    </div>
  )
}

export const PremiumSpinner = ({
  size = 'medium',
  tone = 'info',
  label = 'Yukleniyor',
  showLabel = false,
  className = ''
}: PremiumSpinnerProps) => (
  <span
    className={joinClassNames('premium-spinner', `size-${size}`, `tone-${tone}`, showLabel ? 'with-label' : '', className)}
    role="status"
    aria-live="polite"
    aria-label={showLabel ? undefined : String(label)}
  >
    <span className="premium-spinner-ring" aria-hidden="true" />
    {showLabel && <span className="premium-spinner-label">{label}</span>}
  </span>
)

export const PremiumLinearProgress = ({
  value = 0,
  max = 100,
  indeterminate = false,
  status = indeterminate ? 'running' : 'idle',
  tone,
  label,
  description,
  statusLabel,
  showValue = true,
  size = 'medium',
  className = ''
}: PremiumLinearProgressProps) => {
  const percent = clampPercent(value, max)
  const resolvedTone = getTone(status, tone)
  const progressLabel = label || 'Ilerleme'
  const visibleStatus = statusLabel || statusLabels[status]
  const style = { '--premium-progress-value': `${percent}%` } as CssVars

  return (
    <div className={joinClassNames('premium-linear-progress', `size-${size}`, `tone-${resolvedTone}`, `status-${status}`, indeterminate ? 'indeterminate' : '', className)}>
      {(label || showValue || visibleStatus) && (
        <div className="premium-progress-header">
          <span className="premium-progress-label">{progressLabel}</span>
          <span className="premium-progress-meta">
            {visibleStatus && <em>{visibleStatus}</em>}
            {showValue && !indeterminate && <strong>{percent}%</strong>}
          </span>
        </div>
      )}
      <div
        className="premium-progress-track"
        role="progressbar"
        aria-label={String(progressLabel)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : percent}
        style={style}
      >
        <span className="premium-progress-bar" />
      </div>
      {description && <small className="premium-progress-description">{description}</small>}
    </div>
  )
}

export const PremiumCircularProgress = ({
  value = 0,
  max = 100,
  indeterminate = false,
  status = indeterminate ? 'running' : 'idle',
  tone,
  label = 'Ilerleme',
  statusLabel,
  showValue = true,
  size = 'medium',
  className = ''
}: PremiumCircularProgressProps) => {
  const percent = clampPercent(value, max)
  const resolvedTone = getTone(status, tone)
  const style = { '--premium-progress-value': `${percent}%` } as CssVars

  return (
    <span className={joinClassNames('premium-circular-progress', `size-${size}`, `tone-${resolvedTone}`, `status-${status}`, indeterminate ? 'indeterminate' : '', className)}>
      <span
        className="premium-circular-progress-ring"
        role="progressbar"
        aria-label={String(label)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : percent}
        style={style}
      >
        {showValue && !indeterminate && <span className="premium-circular-progress-value">{percent}%</span>}
        {indeterminate && <span className="premium-circular-progress-value">{statusLabel || statusLabels[status]}</span>}
      </span>
    </span>
  )
}

export const PremiumProgress = ({
  kind = 'default',
  variant = 'linear',
  title,
  label,
  description,
  value = 0,
  max = 100,
  status = 'running',
  tone,
  indeterminate,
  showValue = true,
  size = 'medium',
  statusLabel,
  className = '',
  children
}: PremiumProgressProps) => {
  const resolvedTone = getTone(status, tone)
  const iconName = statusIconMap[status] || kindIconMap[kind]
  const progressLabel = label || title || 'Ilerleme'

  return (
    <section className={joinClassNames('premium-progress', `variant-${variant}`, `kind-${kind}`, `tone-${resolvedTone}`, `status-${status}`, className)} aria-live="polite">
      <span className="premium-progress-icon" aria-hidden="true">
        <AppIcon name={iconName} size="MD" />
      </span>
      <div className="premium-progress-content">
        {(title || description) && (
          <div className="premium-progress-copy">
            {title && <strong>{title}</strong>}
            {description && <p>{description}</p>}
          </div>
        )}
        {variant === 'circular' ? (
          <PremiumCircularProgress
            value={value}
            max={max}
            status={status}
            tone={resolvedTone}
            indeterminate={indeterminate}
            showValue={showValue}
            size={size}
            label={progressLabel}
            statusLabel={statusLabel}
          />
        ) : (
          <PremiumLinearProgress
            value={value}
            max={max}
            status={status}
            tone={resolvedTone}
            indeterminate={indeterminate}
            showValue={showValue}
            size={size}
            label={progressLabel}
            statusLabel={statusLabel}
          />
        )}
        {children && <div className="premium-progress-extra">{children}</div>}
      </div>
    </section>
  )
}

export const PremiumLoadingOverlay = ({
  open = true,
  label = 'Yukleniyor',
  description,
  progress,
  status = progress === undefined ? 'running' : 'idle',
  tone,
  size = 'large',
  mode = 'fullscreen',
  showProgress = progress !== undefined,
  indeterminate = progress === undefined,
  className = '',
  children
}: PremiumLoadingOverlayProps) => {
  if(!open) return null

  const resolvedTone = getTone(status, tone)

  return (
    <div className={joinClassNames('premium-loading-overlay', `mode-${mode}`, `tone-${resolvedTone}`, className)} role="status" aria-live="polite" aria-label={String(label)}>
      <div className="premium-loading-overlay-shell">
        <PremiumSpinner size={size} tone={resolvedTone} label={label} />
        <div className="premium-loading-overlay-copy">
          <strong>{label}</strong>
          {description && <p>{description}</p>}
        </div>
        {showProgress && (
          <PremiumLinearProgress
            value={progress || 0}
            status={status}
            tone={resolvedTone}
            indeterminate={indeterminate}
            label={label}
            showValue={!indeterminate}
            size="medium"
          />
        )}
        {children && <div className="premium-loading-overlay-actions">{children}</div>}
      </div>
    </div>
  )
}

export default PremiumSkeleton
