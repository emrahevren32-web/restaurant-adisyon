import React from 'react'
import { AppIcon } from '../design-system/IconSystem'

export type SidebarLayoutProps = {
  brand: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  collapsed?: boolean
  mobileOpen?: boolean
  onToggleCollapsed?: () => void
  onCloseMobile?: () => void
}

export const SidebarLayout = ({
  brand,
  children,
  footer,
  collapsed = false,
  mobileOpen = false,
  onToggleCollapsed,
  onCloseMobile
}: SidebarLayoutProps) => (
  React.createElement(
    'aside',
    {
      id: 'app-sidebar',
      className: ['side-nav', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : ''].filter(Boolean).join(' '),
      'aria-label': 'Ana menü',
      'data-onboarding-target': 'side-menu',
      'data-sidebar-state': collapsed ? 'collapsed' : 'expanded',
      'data-mobile-state': mobileOpen ? 'open' : 'closed',
      role: 'navigation'
    },
    React.createElement(
      'div',
      { className: 'side-nav-shell-header' },
      brand,
      React.createElement(
        'div',
        { className: 'side-nav-shell-actions' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'side-nav-collapse-btn',
            'aria-label': collapsed ? 'Menüyü genişlet' : 'Menüyü daralt',
            'aria-expanded': !collapsed,
            title: collapsed ? 'Menüyü genişlet' : 'Menüyü daralt',
            onClick: onToggleCollapsed
          },
          React.createElement(AppIcon, { name: collapsed ? 'chevronRight' : 'chevronLeft', size: 'XS' })
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'side-nav-mobile-close',
            'aria-label': 'Menüyü kapat',
            title: 'Menüyü kapat',
            onClick: onCloseMobile
          },
          React.createElement(AppIcon, { name: 'close', size: 'XS' })
        )
      )
    ),
    React.createElement(
      'div',
      { className: 'side-nav-groups' },
      children
    ),
    footer
      ? React.createElement('div', { className: 'side-nav-footer' }, footer)
      : null
  )
)

export default SidebarLayout
