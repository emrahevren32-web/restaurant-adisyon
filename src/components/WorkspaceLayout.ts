import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import { FadeTransition } from './Motion'
import NavigationBreadcrumb, { type NavigationBreadcrumbItem } from './NavigationBreadcrumb'

export type WorkspaceLayoutProps = {
  title: string
  subtitle?: React.ReactNode
  breadcrumbs?: NavigationBreadcrumbItem[]
  context?: React.ReactNode
  status?: React.ReactNode
  navigationKey?: string
  navigation?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

export const WorkspaceLayout = ({
  title,
  subtitle,
  breadcrumbs = [],
  context,
  status,
  navigationKey,
  navigation,
  children,
  footer
}: WorkspaceLayoutProps) => {
  const titleId = `workspace-title-${(navigationKey || title).replace(/[^a-z0-9_-]/gi, '-').toLocaleLowerCase('en-US')}`
  const subtitleId = subtitle ? `${titleId}-description` : undefined
  const hasHeaderAside = Boolean(status || navigation)

  return React.createElement(
    'main',
    {
      id: 'workspace-main-content',
      className: 'app-content',
      'aria-labelledby': titleId,
      'aria-describedby': subtitleId,
      'data-enterprise-layout': 'workspace',
      'data-skip-target': 'main',
      tabIndex: -1
    },
    React.createElement(
      'div',
      { className: 'workspace-scroll-region' },
      React.createElement(
        'div',
        {
          className: 'workspace-layout',
          'data-workspace-title': title,
          'data-layout-grid': 'enterprise'
        },
        React.createElement(
          'header',
          {
            className: 'workspace-header enterprise-workspace-header',
            'aria-labelledby': titleId
          },
          React.createElement(
            'div',
            { className: 'workspace-header-main' },
            breadcrumbs.length > 0
              ? React.createElement(NavigationBreadcrumb, {
                items: breadcrumbs,
                className: 'workspace-header-breadcrumb'
              })
              : null,
            React.createElement(
              'div',
              { className: 'workspace-header-title-row' },
              React.createElement(
                'span',
                { className: 'workspace-header-icon', 'aria-hidden': true },
                React.createElement(AppIcon, { name: 'workspace', size: 'SM' })
              ),
              React.createElement(
                'div',
                { className: 'workspace-header-copy' },
                React.createElement('span', { className: 'workspace-header-kicker' }, 'Workspace'),
                React.createElement('h1', { id: titleId }, title),
                subtitle
                  ? React.createElement('p', { id: subtitleId }, subtitle)
                  : null
              )
            )
          ),
          context
            ? React.createElement(
              'div',
              { className: 'workspace-header-context', 'aria-label': 'Sayfa bağlamı' },
              context
            )
            : null,
          hasHeaderAside
            ? React.createElement(
              'div',
              { className: 'workspace-header-aside' },
              status
                ? React.createElement(
                  'div',
                  { className: 'workspace-header-status', 'aria-label': 'Sayfa durumu' },
                  status
                )
                : null,
              navigation
                ? React.createElement(
                  'div',
                  { className: 'workspace-header-actions', 'aria-label': 'Hızlı sayfa aksiyonları' },
                  navigation
                )
                : null
            )
            : null
        ),
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
}

export default WorkspaceLayout
