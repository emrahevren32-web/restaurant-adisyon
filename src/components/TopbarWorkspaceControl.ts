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
}: TopbarWorkspaceControlProps) => (
  React.createElement(
    'div',
    { className: 'topbar-workspace-control', 'aria-label': 'Workspace ve şube seçimi' },
    React.createElement(
      'span',
      { className: 'topbar-workspace-pill', title: workspaceLabel },
      React.createElement(
        'span',
        { className: 'topbar-workspace-icon', 'aria-hidden': true },
        React.createElement(AppIcon, { name: 'workspace', size: 'XS' })
      ),
      React.createElement(
        'span',
        { className: 'topbar-workspace-copy' },
        React.createElement('small', null, isPlatformAdmin ? 'Platform' : 'Workspace'),
        React.createElement('strong', null, workspaceLabel)
      )
    ),
    React.createElement(
      'label',
      { className: 'branch-switcher' },
      React.createElement('span', null, isPlatformAdmin ? 'Kapsam' : 'Aktif Şube'),
      isPlatformAdmin
        ? React.createElement(
          'select',
          { value: 'platform', disabled: true, 'aria-label': 'Platform kapsamı' },
          React.createElement('option', { value: 'platform' }, 'EVREN360 Platform')
        )
        : React.createElement(
          'select',
          {
            value: hasSelectableBranch ? activeBranchId : '',
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onActiveBranchChange(event.target.value),
            disabled: !hasSelectableBranch,
            'aria-label': 'Aktif şube'
          },
          !hasSelectableBranch
            ? React.createElement('option', { value: '' }, 'Yetkili şube yok')
            : null,
          branches.map(branch => (
            React.createElement('option', { key: branch.id, value: branch.id }, branch.name)
          ))
        )
    )
  )
)

export default TopbarWorkspaceControl
