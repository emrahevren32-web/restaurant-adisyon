import React from 'react'

export type ApplicationShellProps = {
  sidebar: React.ReactNode
  topbar: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  sidebarCollapsed?: boolean
  mobileSidebarOpen?: boolean
  onOpenMobileSidebar?: () => void
  onCloseMobileSidebar?: () => void
}

const NAVIGATION_SWIPE_EDGE = 36
const NAVIGATION_SWIPE_DISTANCE = 56
const NAVIGATION_SWIPE_VERTICAL_LIMIT = 48

type NavigationSwipeStart = {
  x: number
  y: number
}

const isNavigationTouchPointer = (event: React.PointerEvent<HTMLElement>) => (
  event.pointerType === 'touch' || event.pointerType === 'pen'
)

export const ApplicationShell = ({
  sidebar,
  topbar,
  children,
  footer,
  sidebarCollapsed = false,
  mobileSidebarOpen = false,
  onOpenMobileSidebar,
  onCloseMobileSidebar
}: ApplicationShellProps) => {
  const swipeStartRef = React.useRef<NavigationSwipeStart | null>(null)

  const handleSwipeStart = (event: React.PointerEvent<HTMLElement>) => {
    if(!isNavigationTouchPointer(event)) return
    if(!mobileSidebarOpen && event.clientX > NAVIGATION_SWIPE_EDGE) return

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some touch surfaces do not expose pointer capture consistently.
    }

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY
    }
  }

  const handleSwipeEnd = (event: React.PointerEvent<HTMLElement>) => {
    const swipeStart = swipeStartRef.current
    swipeStartRef.current = null
    if(!swipeStart) return

    const deltaX = event.clientX - swipeStart.x
    const deltaY = Math.abs(event.clientY - swipeStart.y)
    if(deltaY > NAVIGATION_SWIPE_VERTICAL_LIMIT) return

    if(mobileSidebarOpen && deltaX < -NAVIGATION_SWIPE_DISTANCE){
      onCloseMobileSidebar?.()
      return
    }

    if(!mobileSidebarOpen && deltaX > NAVIGATION_SWIPE_DISTANCE){
      onOpenMobileSidebar?.()
    }
  }

  const resetSwipe = () => {
    swipeStartRef.current = null
  }

  return React.createElement(
    'div',
    {
      className: [
        'app-shell',
        'enterprise-shell',
        sidebarCollapsed ? 'sidebar-collapsed' : '',
        mobileSidebarOpen ? 'mobile-sidebar-open' : ''
      ].filter(Boolean).join(' '),
      'data-sidebar-state': sidebarCollapsed ? 'collapsed' : 'expanded',
      'data-mobile-sidebar': mobileSidebarOpen ? 'open' : 'closed',
      onPointerDown: mobileSidebarOpen ? handleSwipeStart : undefined,
      onPointerUp: mobileSidebarOpen ? handleSwipeEnd : undefined,
      onPointerCancel: resetSwipe
    },
    React.createElement(
      'a',
      {
        className: 'skip-navigation-link',
        href: '#workspace-main-content'
      },
      'Icerige gec'
    ),
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
      'div',
      {
        className: 'mobile-sidebar-swipe-zone',
        'aria-hidden': true,
        onPointerDown: handleSwipeStart,
        onPointerUp: handleSwipeEnd,
        onPointerCancel: resetSwipe
      }
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'mobile-sidebar-backdrop',
        'aria-label': 'Menüyü kapat',
        'aria-controls': 'app-sidebar',
        'aria-expanded': mobileSidebarOpen,
        hidden: !mobileSidebarOpen,
        onClick: onCloseMobileSidebar
      }
    )
  )
}

export default ApplicationShell
