import React from 'react'

export type ResponsiveTableMode = 'scroll' | 'cards' | 'hybrid'

export type ResponsiveTableProps = React.HTMLAttributes<HTMLDivElement> & {
  mode?: ResponsiveTableMode
  minWidth?: string
}

type ResponsiveTableStyle = React.CSSProperties & Record<string, string | number | undefined>

export const ResponsiveTable = ({
  mode = 'hybrid',
  minWidth,
  className = '',
  style,
  children,
  ...props
}: ResponsiveTableProps) => {
  const responsiveStyle = {
    ...style
  } as ResponsiveTableStyle
  if(minWidth) responsiveStyle['--responsive-table-min-width'] = minWidth

  return (
    <div
      {...props}
      className={['responsive-table', `mode-${mode}`, className].filter(Boolean).join(' ')}
      style={responsiveStyle}
      tabIndex={props.tabIndex ?? 0}
    >
      {children}
    </div>
  )
}

export default ResponsiveTable
