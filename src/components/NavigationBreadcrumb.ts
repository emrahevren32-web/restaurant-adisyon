import React from 'react'
import { AppIcon } from '../design-system/IconSystem'

export type NavigationBreadcrumbItem = {
  label: string
  current?: boolean
  icon?: 'home' | 'workspace' | 'module'
}

export type NavigationBreadcrumbProps = {
  items: NavigationBreadcrumbItem[]
  className?: string
}

export const NavigationBreadcrumb = ({
  items,
  className = ''
}: NavigationBreadcrumbProps) => {
  if(items.length === 0) return null

  return React.createElement(
    'nav',
    {
      className: ['navigation-breadcrumb', className].filter(Boolean).join(' '),
      'aria-label': 'Breadcrumb'
    },
    React.createElement(
      'ol',
      null,
      items.map((item, index) => (
        React.createElement(
          'li',
          {
            key: `${item.label}-${index}`,
            className: item.current ? 'current' : undefined,
            'aria-current': item.current ? 'page' : undefined
          },
          React.createElement(
            'span',
            { className: 'navigation-breadcrumb-icon', 'aria-hidden': true },
            React.createElement(AppIcon, { name: item.icon || (index === 0 ? 'home' : 'workspace'), size: 'XS' })
          ),
          React.createElement('span', null, item.label)
        )
      ))
    )
  )
}

export default NavigationBreadcrumb
