import React from 'react'

export type ApplicationShellProps = {
  sidebar: React.ReactNode
  topbar: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  sidebarCollapsed?: boolean
  mobileSidebarOpen?: boolean
  onCloseMobileSidebar?: () => void
}

export const ApplicationShell = ({
  sidebar,
  topbar,
  children,
  footer,
  sidebarCollapsed = false,
  mobileSidebarOpen = false,
  onCloseMobileSidebar
}: ApplicationShellProps) => (
  React.createElement(
    'div',
    {
      className: [
        'app-shell',
        sidebarCollapsed ? 'sidebar-collapsed' : '',
        mobileSidebarOpen ? 'mobile-sidebar-open' : ''
      ].filter(Boolean).join(' '),
      'data-sidebar-state': sidebarCollapsed ? 'collapsed' : 'expanded'
    },
    React.createElement(
      'div',
      { className: 'app-layout' },
      sidebar,
      React.createElement(
        'div',
        { className: 'app-main' },
        topbar,
        children,
        footer
      )
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'mobile-sidebar-backdrop',
        'aria-label': 'Menüyü kapat',
        hidden: !mobileSidebarOpen,
        onClick: onCloseMobileSidebar
      }
    )
  )
)

export default ApplicationShell
