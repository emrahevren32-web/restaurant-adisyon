import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import type { Branch } from '../types'

export type TopbarWorkspaceControlProps = {
  isPlatformAdmin: boolean
  workspaceLabel: string
  branches: Branch[]
  activeBranchId: string
  hasSelectableBranch: boolean
  onActiveBranchChange: (branchId: string) => void
}

export const TopbarWorkspaceControl = ({
  isPlatformAdmin,
  workspaceLabel,
  branches,
  activeBranchId,
  hasSelectableBranch,
  onActiveBranchChange
}: TopbarWorkspaceControlProps) => {
  const [branchMenuOpen, setBranchMenuOpen] = React.useState(false)
  const branchSwitcherRef = React.useRef<HTMLDivElement | null>(null)
  const branchTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const branchOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const branchMenuId = React.useId()
  const selectedBranchIndex = branches.findIndex(branch => branch.id === activeBranchId)
  const activeBranch = selectedBranchIndex >= 0 ? branches[selectedBranchIndex] : branches[0]
  const branchDisabled = isPlatformAdmin || !hasSelectableBranch
  const scopeLabel = isPlatformAdmin ? 'Platform' : 'Aktif şube'
  const scopeValue = isPlatformAdmin
    ? workspaceLabel
    : hasSelectableBranch
      ? activeBranch?.name || 'Şube seç'
      : 'Yetkili şube yok'

  React.useEffect(() => {
    branchOptionRefs.current = branchOptionRefs.current.slice(0, branches.length)
  }, [branches.length])

  React.useEffect(() => {
    if(branchDisabled){
      setBranchMenuOpen(false)
    }
  }, [branchDisabled])

  React.useEffect(() => {
    if(!branchMenuOpen) return undefined

    const closeOnPointerDown = (event: PointerEvent) => {
      if(branchSwitcherRef.current?.contains(event.target as Node)) return
      setBranchMenuOpen(false)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if(event.key !== 'Escape') return
      setBranchMenuOpen(false)
      branchTriggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [branchMenuOpen])

  const focusBranchOption = (index: number) => {
    if(branches.length === 0) return
    const normalizedIndex = Math.min(Math.max(index, 0), branches.length - 1)
    window.requestAnimationFrame(() => {
      branchOptionRefs.current[normalizedIndex]?.focus()
    })
  }

  const openBranchMenu = (focusIndex = Math.max(selectedBranchIndex, 0)) => {
    if(branchDisabled) return
    setBranchMenuOpen(true)
    focusBranchOption(focusIndex)
  }

  const selectBranch = (branchId: string) => {
    onActiveBranchChange(branchId)
    setBranchMenuOpen(false)
    branchTriggerRef.current?.focus()
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if(event.key === 'ArrowDown'){
      event.preventDefault()
      openBranchMenu(Math.max(selectedBranchIndex, 0))
    }

    if(event.key === 'ArrowUp'){
      event.preventDefault()
      openBranchMenu(selectedBranchIndex >= 0 ? selectedBranchIndex : branches.length - 1)
    }
  }

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    branchId: string
  ) => {
    if(event.key === 'ArrowDown'){
      event.preventDefault()
      focusBranchOption((index + 1) % branches.length)
    }

    if(event.key === 'ArrowUp'){
      event.preventDefault()
      focusBranchOption((index - 1 + branches.length) % branches.length)
    }

    if(event.key === 'Home'){
      event.preventDefault()
      focusBranchOption(0)
    }

    if(event.key === 'End'){
      event.preventDefault()
      focusBranchOption(branches.length - 1)
    }

    if(event.key === 'Enter' || event.key === ' '){
      event.preventDefault()
      selectBranch(branchId)
    }
  }

  // One single scope control replaces the previous workspace-pill + branch-switcher
  // pair, which rendered the same value twice side by side.
  return React.createElement(
    'div',
    {
      className: 'topbar-scope',
      ref: branchSwitcherRef,
      'data-open': branchMenuOpen ? 'true' : undefined,
      'data-disabled': branchDisabled ? 'true' : undefined,
      'aria-label': 'Workspace ve şube seçimi'
    },
    React.createElement(
      'button',
      {
        type: 'button',
        ref: branchTriggerRef,
        className: 'topbar-scope-trigger',
        disabled: branchDisabled,
        title: `${scopeLabel}: ${scopeValue}`,
        'aria-label': `${scopeLabel}: ${scopeValue}`,
        'aria-haspopup': branchDisabled ? undefined : 'listbox',
        'aria-expanded': branchDisabled ? undefined : branchMenuOpen,
        'aria-controls': branchMenuOpen ? branchMenuId : undefined,
        onClick: () => setBranchMenuOpen(current => branchDisabled ? false : !current),
        onKeyDown: handleTriggerKeyDown
      },
      React.createElement(
        'span',
        { className: 'topbar-scope-icon', 'aria-hidden': true },
        React.createElement(AppIcon, { name: isPlatformAdmin ? 'company' : 'workspace', size: 'SM' })
      ),
      React.createElement(
        'span',
        { className: 'topbar-scope-copy' },
        React.createElement('small', null, scopeLabel),
        React.createElement('strong', null, scopeValue)
      ),
      branchDisabled
        ? null
        : React.createElement(
          'span',
          { className: 'topbar-scope-chevron', 'aria-hidden': true },
          React.createElement(AppIcon, { name: 'chevronDown', size: 'XS' })
        )
    ),
    branchMenuOpen && !branchDisabled
      ? React.createElement(
        'div',
        { id: branchMenuId, className: 'topbar-scope-menu', role: 'listbox', 'aria-label': 'Aktif şube seçenekleri' },
        React.createElement('span', { className: 'topbar-scope-menu-title' }, 'Şube seç'),
        branches.map((branch, index) => {
          const selected = branch.id === activeBranchId

          return React.createElement(
            'button',
            {
              type: 'button',
              key: branch.id,
              ref: (element: HTMLButtonElement | null) => {
                branchOptionRefs.current[index] = element
              },
              className: ['topbar-scope-option', selected ? 'selected' : ''].filter(Boolean).join(' '),
              role: 'option',
              'aria-selected': selected,
              onClick: () => selectBranch(branch.id),
              onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => handleOptionKeyDown(event, index, branch.id)
            },
            React.createElement('span', { className: 'topbar-scope-option-dot', 'aria-hidden': true }),
            React.createElement('span', { className: 'topbar-scope-option-label' }, branch.name)
          )
        })
      )
      : null
  )
}

export default TopbarWorkspaceControl
