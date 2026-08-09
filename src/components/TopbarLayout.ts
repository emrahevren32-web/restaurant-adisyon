import React from 'react'
import { AppIcon } from '../design-system/IconSystem'

export type TopbarBreadcrumbItem = {
  label: string
  current?: boolean
}

export type TopbarLayoutProps = {
  title: string
  eyebrow?: string
  breadcrumbs?: TopbarBreadcrumbItem[]
  searchValue: string
  searchPlaceholder?: string
  workspaceLabel: string
  themeMode: 'light' | 'dark'
  onSearchChange: (value: string) => void
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onOpenMobileNav: () => void
  onToggleTheme: () => void
  children: React.ReactNode
}

export const TopbarLayout = ({
  title,
  eyebrow = 'Aktif ekran',
  breadcrumbs = [],
  searchValue,
  searchPlaceholder = 'Ekran, modül veya işlem ara',
  workspaceLabel,
  themeMode,
  onSearchChange,
  onSearchSubmit,
  onOpenMobileNav,
  onToggleTheme,
  children
}: TopbarLayoutProps) => (
  React.createElement(
    'header',
    { className: 'topbar' },
    React.createElement(
      'div',
      { className: 'topbar-leading' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'topbar-mobile-menu',
          'aria-label': 'Ana menüyü aç',
          title: 'Ana menüyü aç',
          onClick: onOpenMobileNav
        },
        React.createElement(AppIcon, { name: 'workspace', size: 'SM' })
      ),
      React.createElement(
        'div',
        { className: 'topbar-title' },
        React.createElement('span', { className: 'topbar-eyebrow' }, eyebrow),
        breadcrumbs.length > 0
          ? React.createElement(
            'nav',
            { className: 'topbar-breadcrumb', 'aria-label': 'Breadcrumb' },
            breadcrumbs.map((item, index) => (
              React.createElement(
                'span',
                {
                  key: `${item.label}-${index}`,
                  className: item.current ? 'current' : undefined,
                  'aria-current': item.current ? 'page' : undefined
                },
                item.label
              )
            ))
          )
          : null,
        React.createElement('strong', null, title)
      )
    ),
    React.createElement(
      'form',
      { className: 'topbar-search', role: 'search', onSubmit: onSearchSubmit },
      React.createElement(AppIcon, { name: 'search', size: 'SM' }),
      React.createElement('input', {
        value: searchValue,
        onChange: event => onSearchChange(event.target.value),
        placeholder: searchPlaceholder,
        'aria-label': 'Global arama'
      })
    ),
    React.createElement(
      'div',
      { className: 'topbar-actions' },
      React.createElement(
        'span',
        { className: 'topbar-workspace-pill', title: workspaceLabel },
        React.createElement(AppIcon, { name: 'workspace', size: 'XS' }),
        React.createElement('span', null, workspaceLabel)
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'topbar-theme-btn',
          'aria-label': themeMode === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç',
          title: themeMode === 'dark' ? 'Açık tema' : 'Koyu tema',
          onClick: onToggleTheme
        },
        React.createElement(AppIcon, { name: 'theme', size: 'SM' })
      ),
      children
    )
  )
)

export default TopbarLayout
