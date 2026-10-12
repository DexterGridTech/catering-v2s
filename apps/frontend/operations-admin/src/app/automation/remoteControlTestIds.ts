export const remoteControlTestIds = {
  onlineStatus: (terminalRef: string) => `operations-remote-control-online-${terminalRef}`,
  detailActions: (terminalRef: string) => `operations-remote-control-actions-${terminalRef}`,
  start: (terminalRef: string) => `operations-remote-control-start-${terminalRef}`,
  workArea: 'operations-remote-control-workspace',
  screen: (slot: 'main' | 'secondary') => `operations-remote-control-screen-${slot}`,
  status: 'operations-remote-control-status',
  end: 'operations-remote-control-end',
  close: 'operations-remote-control-close',
  restart: 'operations-remote-control-restart',
} as const;
