import React from 'react'

export type WorkspaceLayoutProps = {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const WorkspaceLayout = ({
  title,
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
        React.createElement(
          'div',
          { className: 'workspace-content-shell' },
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
