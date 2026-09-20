export type AdminShellProps = Readonly<{
  readonly onClose: () => void
}>

export type AdminPanelStatus = Readonly<{
  readonly tone: 'ok' | 'warn' | 'error' | 'neutral'
  readonly label: string
}>
