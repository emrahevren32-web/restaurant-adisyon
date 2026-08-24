import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import type { User } from '../types'

export type TopbarProfileMenuProps = {
  currentUser: User
  initials: string
  onOpenMyProfile?: () => void
  onOpenCompanyProfile?: () => void
  onStartOnboarding?: () => void
  onLogout: () => void
}

export const TopbarProfileMenu = ({
  currentUser,
  initials,
  onOpenMyProfile,
  onOpenCompanyProfile,
  onStartOnboarding,
  onLogout
}: TopbarProfileMenuProps) => {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const menuId = React.useId()

  React.useEffect(() => {
    if(!open) return undefined

    const closeOnPointerDown = (event: PointerEvent) => {
      if(rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if(event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const userName = currentUser.fullName || currentUser.username

  return React.createElement(
    'div',
    { className: 'topbar-profile-menu', ref: rootRef, 'data-onboarding-target': 'profile' },
    React.createElement(
      'button',
      {
        type: 'button',
        ref: triggerRef,
        className: ['topbar-user-card', 'enterprise-field', open ? 'active' : ''].filter(Boolean).join(' '),
        'aria-label': 'Kullanıcı menüsü',
        'aria-haspopup': 'menu',
        'aria-controls': open ? menuId : undefined,
        'aria-expanded': open,
        title: 'Kullanıcı menüsü',
        onClick: () => setOpen(current => !current)
      },
      React.createElement('span', { className: 'topbar-user-avatar', 'aria-hidden': true }, initials),
      React.createElement(
        'span',
        { className: 'topbar-user-meta' },
        React.createElement('strong', null, userName),
        React.createElement('span', null, currentUser.role)
      ),
      React.createElement(
        'span',
        { className: 'topbar-user-chevron', 'aria-hidden': true },
        React.createElement(AppIcon, { name: 'chevronDown', size: 'XS' })
      )
    ),
    open
      ? React.createElement(
        'div',
        { id: menuId, className: 'topbar-profile-panel', role: 'menu', 'aria-label': 'Profil işlemleri' },
        React.createElement(
          'div',
          { className: 'topbar-profile-panel-header' },
          React.createElement('span', { className: 'topbar-user-avatar large', 'aria-hidden': true }, initials),
          React.createElement(
            'div',
            { className: 'topbar-profile-panel-identity' },
            React.createElement('strong', null, userName),
            React.createElement('span', null, currentUser.role)
          )
        ),
        onOpenMyProfile
          ? React.createElement(
            'button',
            {
              type: 'button',
              className: 'topbar-profile-action',
              role: 'menuitem',
              onClick: () => {
                setOpen(false)
                onOpenMyProfile()
              }
            },
            React.createElement(AppIcon, { name: 'user', size: 'SM' }),
            React.createElement('span', null, 'Profilim')
          )
          : null,
        // company-level settings are an admin concern, so the entry only
        // appears for users who can actually act on that screen
        onOpenCompanyProfile && currentUser.role === 'Admin'
          ? React.createElement(
            'button',
            {
              type: 'button',
              className: 'topbar-profile-action',
              role: 'menuitem',
              onClick: () => {
                setOpen(false)
                onOpenCompanyProfile()
              }
            },
            React.createElement(AppIcon, { name: 'company', size: 'SM' }),
            React.createElement('span', null, 'Şirket Profili')
          )
          : null,
        onStartOnboarding
          ? React.createElement(
            'button',
            {
              type: 'button',
              className: 'topbar-profile-action',
              role: 'menuitem',
              onClick: () => {
                setOpen(false)
                onStartOnboarding()
              }
            },
            React.createElement(AppIcon, { name: 'help', size: 'SM' }),
            React.createElement('span', null, 'Yardım')
          )
          : null,
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'topbar-profile-action danger',
            role: 'menuitem',
            onClick: () => {
              setOpen(false)
              onLogout()
            }
          },
          React.createElement(AppIcon, { name: 'logout', size: 'SM' }),
          React.createElement('span', null, 'Çıkış')
        )
      )
      : null
  )
}

export default TopbarProfileMenu
