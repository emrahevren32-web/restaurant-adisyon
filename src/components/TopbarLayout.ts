import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import NavigationBreadcrumb, { type NavigationBreadcrumbItem } from './NavigationBreadcrumb'

export type TopbarBreadcrumbItem = NavigationBreadcrumbItem

export type TopbarLayoutProps = {
  title: string
  eyebrow?: string
  breadcrumbs?: TopbarBreadcrumbItem[]
  searchValue: string
  searchPlaceholder?: string
  brandLabel?: string
  themeMode: 'light' | 'dark'
  mobileSidebarOpen?: boolean
  workspaceControl: React.ReactNode
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
  brandLabel = 'MİYOP',
  themeMode,
  mobileSidebarOpen = false,
  workspaceControl,
  onSearchChange,
  onSearchSubmit,
  onOpenMobileNav,
  onToggleTheme,
  children
}: TopbarLayoutProps) => (
  React.createElement(
    'header',
    { className: 'topbar enterprise-topbar' },
    React.createElement(
      'div',
      { className: 'topbar-leading topbar-context-zone' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'topbar-mobile-menu',
          'aria-controls': 'app-sidebar',
          'aria-expanded': mobileSidebarOpen,
          'aria-label': 'Ana menüyü aç',
          title: 'Ana menüyü aç',
          onClick: onOpenMobileNav
        },
        React.createElement(AppIcon, { name: 'workspace', size: 'SM' })
      ),
      React.createElement(
        'span',
        { className: 'topbar-brand-mark', 'aria-label': brandLabel, title: brandLabel },
        React.createElement(AppIcon, { name: 'company', size: 'SM', decorative: true })
      ),
      React.createElement(
        'div',
        { className: 'topbar-title' },
        React.createElement(NavigationBreadcrumb, { items: breadcrumbs, className: 'topbar-breadcrumb' }),
        React.createElement('span', { className: 'topbar-eyebrow' }, eyebrow),
        React.createElement('strong', null, title)
      )
    ),
    React.createElement(
      'form',
      { className: 'topbar-search topbar-command-search', role: 'search', 'data-onboarding-target': 'global-search', onSubmit: onSearchSubmit },
      React.createElement(
        'span',
        { className: 'topbar-search-icon', 'aria-hidden': true },
        React.createElement(AppIcon, { name: 'search', size: 'SM' })
      ),
      React.createElement('input', {
        value: searchValue,
        onChange: event => onSearchChange(event.target.value),
        placeholder: searchPlaceholder,
        'aria-label': 'Global arama',
        autoComplete: 'off'
      })
    ),
    React.createElement(
      'div',
      { className: 'topbar-actions topbar-action-zone' },
      React.createElement('div', { className: 'topbar-workspace-slot' }, workspaceControl),
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
