import React from 'react'
import { FadeTransition } from './Motion'

export type WorkspaceLayoutProps = {
  title: string
  navigationKey?: string
  navigation?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

export const WorkspaceLayout = ({
  title,
  navigationKey,
  navigation,
  children,
  footer
}: WorkspaceLayoutProps) => (
  React.createElement(
    'main',
    { className: 'app-content', 'aria-label': `${title} çalışma alanı`, tabIndex: -1 },
    React.createElement(
      'div',
      { className: 'workspace-scroll-region' },
      React.createElement(
        'div',
        { className: 'workspace-layout', 'data-workspace-title': title },
        navigation,
        React.createElement(
          FadeTransition,
          {
            as: 'div',
            className: 'workspace-content-shell',
            duration: 'normal',
            easing: 'easeOut',
            key: navigationKey || title
          },
          React.createElement('div', { className: 'workspace-content' }, children)
        ),
        footer
          ? React.createElement('footer', { className: 'workspace-footer' }, footer)
          : null
      )
    )
  )
)

export default WorkspaceLayout
