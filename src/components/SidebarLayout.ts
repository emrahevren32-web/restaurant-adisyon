import React from 'react'
import { AppIcon } from '../design-system/IconSystem'

export type SidebarLayoutProps = {
  brand: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** Rendered narrow — icons only. */
  collapsed?: boolean
  /** The rail mode is active (unpinned), whether or not it is currently peeked open. */
  rail?: boolean
  /** Temporarily revealed by hover or keyboard focus. */
  peeked?: boolean
  /** The persisted user choice. */
  pinned?: boolean
  mobileOpen?: boolean
  onTogglePinned?: () => void
  onPeekStart?: () => void
  onPeekEnd?: () => void
  onCloseMobile?: () => void
}

export const SidebarLayout = ({
  brand,
  children,
  footer,
  collapsed = false,
  rail = false,
  peeked = false,
  pinned = true,
  mobileOpen = false,
  onTogglePinned,
  onPeekStart,
  onPeekEnd,
  onCloseMobile
}: SidebarLayoutProps) => {
  const pinLabel = pinned ? 'Menüyü daralt' : 'Menüyü sabitle'

  return React.createElement(
    'aside',
    {
      id: 'app-sidebar',
      className: [
        'side-nav',
        collapsed ? 'collapsed' : '',
        rail ? 'rail' : '',
        peeked ? 'peeked' : '',
        pinned ? 'pinned' : '',
        mobileOpen ? 'mobile-open' : ''
      ].filter(Boolean).join(' '),
      'aria-label': 'Ana menü',
      'data-onboarding-target': 'side-menu',
      'data-sidebar-state': collapsed ? 'collapsed' : 'expanded',
      'data-sidebar-mode': rail ? (peeked ? 'peeked' : 'rail') : 'pinned',
      'data-mobile-state': mobileOpen ? 'open' : 'closed',
      role: 'navigation',
      // Pointer and keyboard both reveal the rail, so it is reachable without a mouse.
      onMouseEnter: rail ? onPeekStart : undefined,
      onMouseLeave: rail ? onPeekEnd : undefined,
      onFocusCapture: rail ? onPeekStart : undefined,
      onBlurCapture: rail
        ? (event: React.FocusEvent<HTMLElement>) => {
          if(event.currentTarget.contains(event.relatedTarget as Node | null)) return
          onPeekEnd?.()
        }
        : undefined
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
            className: ['side-nav-pin-btn', pinned ? 'is-pinned' : ''].filter(Boolean).join(' '),
            'aria-label': pinLabel,
            'aria-pressed': pinned,
            title: pinLabel,
            onClick: onTogglePinned
          },
          React.createElement(AppIcon, { name: pinned ? 'pinOff' : 'pin', size: 'XS' })
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
      { className: 'side-nav-body' },
      React.createElement(
        'div',
        { className: 'side-nav-scroll' },
        React.createElement(
          'div',
          { className: 'side-nav-groups' },
          children
        )
      )
    ),
    footer
      ? React.createElement('div', { className: 'side-nav-footer' }, footer)
      : null
  )
}

export default SidebarLayout
