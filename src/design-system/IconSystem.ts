import React from 'react'
import {
  APP_ICON_REGISTRY,
  resolveAppIconName,
  type AppIconName,
  type AppIconResolveInput
} from './AppIcons'
import {
  createIconTokenCssVariables,
  getIconColorValue,
  getIconSizeVariable,
  getIconStrokeWidth,
  type IconColorToken,
  type IconSizeToken
} from './IconTokens'

const ICON_STYLE_ELEMENT_ID = 'miyop-iconography-system'

export type AppIconProps = Omit<React.ComponentPropsWithoutRef<'svg'>, 'color' | 'name'> & {
  name?: AppIconName
  source?: string
  label?: string
  context?: string
  size?: IconSizeToken
  color?: IconColorToken | 'currentColor'
  decorative?: boolean
  ariaLabel?: string
}

const createIconResolveInput = ({
  name,
  source,
  label,
  context
}: Pick<AppIconProps, 'name' | 'source' | 'label' | 'context'>): AppIconResolveInput => ({
  name,
  source,
  label,
  context
})

export const AppIcon = ({
  name,
  source,
  label,
  context,
  size = 'MD',
  color = 'currentColor',
  decorative = true,
  ariaLabel,
  className = '',
  style,
  strokeWidth,
  ...rest
}: AppIconProps) => {
  const iconName = resolveAppIconName(createIconResolveInput({ name, source, label, context }))
  const IconComponent = APP_ICON_REGISTRY[iconName]
  const cssSize = getIconSizeVariable(size)
  const resolvedColor = color === 'currentColor' ? 'currentColor' : getIconColorValue(color)
  const accessibilityProps = decorative
    ? { 'aria-hidden': true, focusable: false }
    : { role: 'img', 'aria-label': ariaLabel || label || iconName }

  return React.createElement(IconComponent, {
    ...rest,
    ...accessibilityProps,
    className: ['app-icon', `app-icon-${size.toLocaleLowerCase('en-US')}`, className].filter(Boolean).join(' '),
    size: undefined,
    strokeWidth: strokeWidth || getIconStrokeWidth(size),
    style: {
      width: cssSize,
      height: cssSize,
      color: resolvedColor,
      ...style
    }
  })
}

export const createIconographySystemCss = () => `
:root{${createIconTokenCssVariables()}}
.app-icon{display:inline-block;flex:0 0 auto;vertical-align:middle;color:currentColor;stroke:currentColor}
.app-icon[aria-hidden="true"]{pointer-events:none}
`.trim()

export const applyIconographySystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(ICON_STYLE_ELEMENT_ID)
  const cssText = createIconographySystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = ICON_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
