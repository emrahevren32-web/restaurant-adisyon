import React from 'react'
import { AppIcon } from '../design-system/IconSystem'

export type NavigationQuickAccessItem = {
  key: string
  label: string
  icon: string
  active?: boolean
  onOpen: () => void
}

export type NavigationQuickAccessProps = {
  items: NavigationQuickAccessItem[]
  activeLabel: string
}

export const NavigationQuickAccess = ({
  items,
  activeLabel
}: NavigationQuickAccessProps) => {
  if(items.length === 0) return null

  return React.createElement(
    'nav',
    { className: 'navigation-quick-access', 'aria-label': 'Hızlı erişim' },
    React.createElement(
      'div',
      { className: 'navigation-quick-access-label' },
      React.createElement(AppIcon, { name: 'workspace', size: 'XS' }),
      React.createElement('span', null, 'Hızlı erişim'),
      React.createElement('strong', null, activeLabel)
    ),
    React.createElement(
      'div',
      { className: 'navigation-quick-access-list' },
      items.map(item => (
        React.createElement(
          'button',
          {
            key: item.key,
            type: 'button',
            className: ['navigation-quick-access-item', item.active ? 'active' : ''].filter(Boolean).join(' '),
            'aria-current': item.active ? 'page' : undefined,
            onClick: item.onOpen
          },
          React.createElement(
            'span',
            { className: 'navigation-quick-access-icon', 'aria-hidden': true },
            React.createElement(AppIcon, { source: item.icon, label: item.label, size: 'XS' })
          ),
          React.createElement('span', null, item.label)
        )
      ))
    )
  )
}

export default NavigationQuickAccess
