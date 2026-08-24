import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import type { NavigationBreadcrumbItem } from './NavigationBreadcrumb'

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
  sidebarCollapsed?: boolean
  workspaceControl: React.ReactNode
  onSearchChange: (value: string) => void
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onOpenMobileNav: () => void
  onToggleSidebar?: () => void
  onToggleTheme: () => void
  children: React.ReactNode
}

/**
 * Enterprise application bar.
 *
 * Three fixed zones on one row — nothing wraps, every control shares the same
 * height, so the bar keeps a stable rhythm at any viewport width:
 *
 *   [ menu ][ page title ]   [ search ]   [ scope ][ tools ][ profile ]
 */
export const TopbarLayout = ({
  title,
  breadcrumbs: _breadcrumbs = [],
  searchValue,
  searchPlaceholder = 'Ekran, modül veya işlem ara',
  brandLabel = 'MİYOP',
  themeMode,
  mobileSidebarOpen = false,
  sidebarCollapsed = false,
  workspaceControl,
  onSearchChange,
  onSearchSubmit,
  onOpenMobileNav,
  onToggleSidebar,
  onToggleTheme,
  children
}: TopbarLayoutProps) => (
  React.createElement(
    'header',
    {
      className: 'topbar enterprise-topbar topbar-v2',
      'aria-label': 'Workspace üst navigasyon'
    },

    /* ── Zone 1 — navigation trigger + current screen ─────────────── */
    React.createElement(
      'div',
      { className: 'topbar-zone topbar-zone-start', 'data-topbar-zone': 'left' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'topbar-icon-btn topbar-mobile-menu',
          'aria-controls': 'app-sidebar',
          'aria-expanded': mobileSidebarOpen,
          'aria-label': 'Ana menüyü aç',
          title: 'Ana menü',
          onClick: onOpenMobileNav
        },
        React.createElement(AppIcon, { name: 'module', size: 'SM' })
      ),
      onToggleSidebar
        ? React.createElement(
          'button',
          {
            type: 'button',
            className: 'topbar-icon-btn topbar-rail-toggle',
            'aria-controls': 'app-sidebar',
            'aria-expanded': !sidebarCollapsed,
            'aria-label': sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt',
            title: sidebarCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt',
            onClick: onToggleSidebar
          },
          React.createElement(AppIcon, { name: 'module', size: 'SM' })
        )
        : null,
      React.createElement(
        'span',
        { className: 'topbar-brand-mark', 'aria-label': brandLabel, title: brandLabel },
        React.createElement(AppIcon, { name: 'company', size: 'SM', decorative: true })
      ),
      React.createElement(
        'div',
        { className: 'topbar-title topbar-page-context' },
        React.createElement('strong', { title }, title)
      )
    ),

    /* ── Zone 2 — global search ───────────────────────────────────── */
    React.createElement(
      'div',
      { className: 'topbar-zone topbar-zone-center', 'data-topbar-zone': 'center' },
      React.createElement(
        'form',
        {
          className: 'topbar-search topbar-command-search',
          role: 'search',
          'aria-label': 'Global arama',
          'data-onboarding-target': 'global-search',
          onSubmit: onSearchSubmit
        },
        React.createElement(
          'span',
          { className: 'topbar-search-icon', 'aria-hidden': true },
          React.createElement(AppIcon, { name: 'search', size: 'SM' })
        ),
        React.createElement('input', {
          type: 'search',
          value: searchValue,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value),
          placeholder: searchPlaceholder,
          'aria-label': 'Global arama',
          autoComplete: 'off'
        })
      )
    ),

    /* ── Zone 3 — scope, tools, profile ───────────────────────────── */
    React.createElement(
      'div',
      {
        className: 'topbar-zone topbar-zone-end topbar-actions',
        'aria-label': 'Workspace ve kullanıcı aksiyonları',
        'data-topbar-zone': 'right'
      },
      React.createElement('div', { className: 'topbar-scope-slot' }, workspaceControl),
      React.createElement('span', { className: 'topbar-divider', 'aria-hidden': true }),
      React.createElement(
        'div',
        { className: 'topbar-tools', 'aria-label': 'Sistem aksiyonları' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'topbar-icon-btn topbar-theme-btn',
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
)

export default TopbarLayout
