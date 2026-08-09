import React from 'react'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'

export type PremiumValidationState = 'success' | 'warning' | 'error' | 'info'
export type PremiumFormDensity = 'comfortable' | 'compact'
export type PremiumFormSectionColumns = 'one' | 'two' | 'three'
export type PremiumFormActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export type PremiumFieldChromeProps = {
  id?: string
  label?: React.ReactNode
  description?: React.ReactNode
  helperText?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  required?: boolean
  disabled?: boolean
  hideLabel?: boolean
  className?: string
  children: (field: {
    controlId: string
    describedBy?: string
    invalid?: boolean
  }) => React.ReactNode
}

export type PremiumInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: React.ReactNode
  description?: React.ReactNode
  helperText?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  leadingIcon?: AppIconProps['name']
  trailing?: React.ReactNode
  hideLabel?: boolean
  wrapperClassName?: string
}

export type PremiumSelectOption = {
  value: string | number
  label: React.ReactNode
  disabled?: boolean
}

export type PremiumSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode
  description?: React.ReactNode
  helperText?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  options?: PremiumSelectOption[]
  hideLabel?: boolean
  wrapperClassName?: string
}

export type PremiumTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode
  description?: React.ReactNode
  helperText?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  hideLabel?: boolean
  wrapperClassName?: string
}

export type PremiumCheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: React.ReactNode
  description?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  wrapperClassName?: string
}

export type PremiumSwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: React.ReactNode
  description?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  wrapperClassName?: string
}

export type PremiumRadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  label: React.ReactNode
  description?: React.ReactNode
  validationText?: React.ReactNode
  validationState?: PremiumValidationState
  wrapperClassName?: string
}

export type PremiumDatePickerProps = Omit<PremiumInputProps, 'type'> & {
  mode?: 'date' | 'time' | 'datetime-local'
}

export type PremiumFormSectionProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  actions?: React.ReactNode
  columns?: PremiumFormSectionColumns
  density?: PremiumFormDensity
  className?: string
  children: React.ReactNode
}

export type PremiumFormAction = {
  key: string
  label: string
  icon?: AppIconProps['name']
  variant?: PremiumFormActionVariant
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: () => void
}

export type PremiumFormActionsProps = {
  actions?: PremiumFormAction[]
  align?: 'start' | 'end' | 'between'
  sticky?: boolean
  className?: string
  children?: React.ReactNode
}

export type PremiumTagProps = {
  label: React.ReactNode
  tone?: PremiumValidationState | 'neutral'
  removable?: boolean
  onRemove?: () => void
  className?: string
}

const validationIconMap: Record<PremiumValidationState, AppIconProps['name']> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info'
}

const validationClass = (state?: PremiumValidationState) => state ? `is-${state}` : ''

const joinIds = (...ids: Array<string | undefined>) => {
  const value = ids.filter(Boolean).join(' ')
  return value || undefined
}

export const PremiumFieldChrome = ({
  id,
  label,
  description,
  helperText,
  validationText,
  validationState,
  required,
  disabled,
  hideLabel = false,
  className = '',
  children
}: PremiumFieldChromeProps) => {
  const generatedId = React.useId()
  const controlId = id || generatedId
  const descriptionId = description ? `${controlId}-description` : undefined
  const helperId = helperText ? `${controlId}-helper` : undefined
  const validationId = validationText ? `${controlId}-validation` : undefined
  const describedBy = joinIds(descriptionId, helperId, validationId)

  return (
    <div className={['premium-form-field', validationClass(validationState), disabled ? 'is-disabled' : '', className].filter(Boolean).join(' ')}>
      {label && (
        <label className={hideLabel ? 'premium-sr-only' : 'premium-field-label'} htmlFor={controlId}>
          <span>{label}</span>
          {required && <em aria-hidden="true">*</em>}
        </label>
      )}
      {description && <p className="premium-field-description" id={descriptionId}>{description}</p>}
      {children({ controlId, describedBy, invalid: validationState === 'error' })}
      {(helperText || validationText) && (
        <div className="premium-field-messages">
          {helperText && <small id={helperId}>{helperText}</small>}
          {validationText && (
            <strong className="premium-field-validation" id={validationId}>
              {validationState && <AppIcon name={validationIconMap[validationState]} size="XS" />}
              {validationText}
            </strong>
          )}
        </div>
      )}
    </div>
  )
}

export const PremiumInput = ({
  label,
  description,
  helperText,
  validationText,
  validationState,
  leadingIcon,
  trailing,
  hideLabel,
  wrapperClassName = '',
  id,
  required,
  disabled,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: PremiumInputProps) => (
  <PremiumFieldChrome
    id={id}
    label={label}
    description={description}
    helperText={helperText}
    validationText={validationText}
    validationState={validationState}
    required={required}
    disabled={disabled}
    hideLabel={hideLabel}
    className={wrapperClassName}
  >
    {({ controlId, describedBy, invalid }) => (
      <div className={['premium-control-frame', leadingIcon ? 'has-leading-icon' : '', trailing ? 'has-trailing-content' : ''].filter(Boolean).join(' ')}>
        {leadingIcon && <AppIcon name={leadingIcon} size="SM" className="premium-control-icon" />}
        <input
          {...props}
          id={controlId}
          required={required}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={joinIds(ariaDescribedBy, describedBy)}
          className={['premium-input-control', className].filter(Boolean).join(' ')}
        />
        {trailing && <span className="premium-control-trailing">{trailing}</span>}
      </div>
    )}
  </PremiumFieldChrome>
)

export const PremiumSelect = ({
  label,
  description,
  helperText,
  validationText,
  validationState,
  options,
  children,
  hideLabel,
  wrapperClassName = '',
  id,
  required,
  disabled,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: PremiumSelectProps) => (
  <PremiumFieldChrome
    id={id}
    label={label}
    description={description}
    helperText={helperText}
    validationText={validationText}
    validationState={validationState}
    required={required}
    disabled={disabled}
    hideLabel={hideLabel}
    className={wrapperClassName}
  >
    {({ controlId, describedBy, invalid }) => (
      <div className="premium-control-frame premium-select-frame">
        <select
          {...props}
          id={controlId}
          required={required}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={joinIds(ariaDescribedBy, describedBy)}
          className={['premium-select-control', className].filter(Boolean).join(' ')}
        >
          {options?.map(option => (
            <option key={String(option.value)} value={option.value} disabled={option.disabled}>{option.label}</option>
          ))}
          {children}
        </select>
      </div>
    )}
  </PremiumFieldChrome>
)

export const PremiumTextarea = ({
  label,
  description,
  helperText,
  validationText,
  validationState,
  hideLabel,
  wrapperClassName = '',
  id,
  required,
  disabled,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: PremiumTextareaProps) => (
  <PremiumFieldChrome
    id={id}
    label={label}
    description={description}
    helperText={helperText}
    validationText={validationText}
    validationState={validationState}
    required={required}
    disabled={disabled}
    hideLabel={hideLabel}
    className={wrapperClassName}
  >
    {({ controlId, describedBy, invalid }) => (
      <textarea
        {...props}
        id={controlId}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={joinIds(ariaDescribedBy, describedBy)}
        className={['premium-textarea-control', className].filter(Boolean).join(' ')}
      />
    )}
  </PremiumFieldChrome>
)

export const PremiumCheckbox = ({
  label,
  description,
  validationText,
  validationState,
  wrapperClassName = '',
  id,
  disabled,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: PremiumCheckboxProps) => {
  const generatedId = React.useId()
  const controlId = id || generatedId
  const descriptionId = description ? `${controlId}-description` : undefined
  const validationId = validationText ? `${controlId}-validation` : undefined

  return (
    <div className={['premium-check-field', validationClass(validationState), disabled ? 'is-disabled' : '', wrapperClassName].filter(Boolean).join(' ')}>
      <label htmlFor={controlId}>
        <input
          {...props}
          id={controlId}
          type="checkbox"
          disabled={disabled}
          aria-invalid={validationState === 'error' || undefined}
          aria-describedby={joinIds(ariaDescribedBy, descriptionId, validationId)}
          className={className}
        />
        <span>
          <strong>{label}</strong>
          {description && <small id={descriptionId}>{description}</small>}
        </span>
      </label>
      {validationText && <strong className="premium-field-validation" id={validationId}>{validationState && <AppIcon name={validationIconMap[validationState]} size="XS" />}{validationText}</strong>}
    </div>
  )
}

export const PremiumRadio = ({
  label,
  description,
  validationText,
  validationState,
  wrapperClassName = '',
  id,
  disabled,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: PremiumRadioProps) => {
  const generatedId = React.useId()
  const controlId = id || generatedId
  const descriptionId = description ? `${controlId}-description` : undefined
  const validationId = validationText ? `${controlId}-validation` : undefined

  return (
    <div className={['premium-check-field premium-radio-field', validationClass(validationState), disabled ? 'is-disabled' : '', wrapperClassName].filter(Boolean).join(' ')}>
      <label htmlFor={controlId}>
        <input
          {...props}
          id={controlId}
          type="radio"
          disabled={disabled}
          aria-invalid={validationState === 'error' || undefined}
          aria-describedby={joinIds(ariaDescribedBy, descriptionId, validationId)}
          className={className}
        />
        <span>
          <strong>{label}</strong>
          {description && <small id={descriptionId}>{description}</small>}
        </span>
      </label>
      {validationText && <strong className="premium-field-validation" id={validationId}>{validationState && <AppIcon name={validationIconMap[validationState]} size="XS" />}{validationText}</strong>}
    </div>
  )
}

export const PremiumSwitch = ({
  label,
  description,
  validationText,
  validationState,
  wrapperClassName = '',
  id,
  disabled,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: PremiumSwitchProps) => {
  const generatedId = React.useId()
  const controlId = id || generatedId
  const descriptionId = description ? `${controlId}-description` : undefined
  const validationId = validationText ? `${controlId}-validation` : undefined

  return (
    <div className={['premium-switch-field', validationClass(validationState), disabled ? 'is-disabled' : '', wrapperClassName].filter(Boolean).join(' ')}>
      <label htmlFor={controlId}>
        <input
          {...props}
          id={controlId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-invalid={validationState === 'error' || undefined}
          aria-describedby={joinIds(ariaDescribedBy, descriptionId, validationId)}
          className={className}
        />
        <span className="premium-switch-track" aria-hidden="true"><i /></span>
        <span className="premium-switch-copy">
          <strong>{label}</strong>
          {description && <small id={descriptionId}>{description}</small>}
        </span>
      </label>
      {validationText && <strong className="premium-field-validation" id={validationId}>{validationState && <AppIcon name={validationIconMap[validationState]} size="XS" />}{validationText}</strong>}
    </div>
  )
}

export const PremiumDatePicker = ({ mode = 'date', ...props }: PremiumDatePickerProps) => (
  <PremiumInput {...props} type={mode} leadingIcon={props.leadingIcon || 'calendar'} />
)

export const PremiumFormSection = ({
  title,
  description,
  icon,
  actions,
  columns = 'two',
  density = 'comfortable',
  className = '',
  children
}: PremiumFormSectionProps) => (
  <section className={['premium-form-section', `columns-${columns}`, density, className].filter(Boolean).join(' ')}>
    {(title || description || icon || actions) && (
      <div className="premium-form-section-header">
        {(icon || title || description) && (
          <div className="premium-form-section-title">
            {icon && <span aria-hidden="true"><AppIcon name={icon} size="MD" /></span>}
            <div>
              {title && <h3>{title}</h3>}
              {description && <p>{description}</p>}
            </div>
          </div>
        )}
        {actions && <div className="premium-form-section-actions">{actions}</div>}
      </div>
    )}
    <div className="premium-form-grid">{children}</div>
  </section>
)

export const PremiumFormActions = ({
  actions = [],
  align = 'end',
  sticky = false,
  className = '',
  children
}: PremiumFormActionsProps) => (
  <div className={['premium-form-actions', `align-${align}`, sticky ? 'sticky' : '', className].filter(Boolean).join(' ')}>
    {children}
    {actions.map(action => (
      <button
        className={['btn', `btn-${action.variant || 'secondary'}`].filter(Boolean).join(' ')}
        type={action.type || 'button'}
        key={action.key}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.icon && <AppIcon name={action.icon} size="SM" />}
        {action.label}
      </button>
    ))}
  </div>
)

export const PremiumTag = ({
  label,
  tone = 'neutral',
  removable = false,
  onRemove,
  className = ''
}: PremiumTagProps) => (
  <span className={['premium-tag', tone, className].filter(Boolean).join(' ')}>
    {label}
    {removable && (
      <button type="button" aria-label={`${String(label)} etiketini kaldır`} onClick={onRemove}>
        <AppIcon name="close" size="XS" />
      </button>
    )}
  </span>
)

export default PremiumInput
