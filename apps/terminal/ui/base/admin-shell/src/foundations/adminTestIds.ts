const sectionTestIds = Object.freeze({
  platformPorts: 'terminal.admin:section:platform-ports',
  runtime: 'terminal.admin:section:runtime',
  displayContext: 'terminal.admin:section:display-context',
  topology: 'terminal.admin:section:topology',
  sampleConsole: 'terminal.admin:section:sample-console',
})

const topologyTestIds = Object.freeze({
  section: sectionTestIds.topology,
  scroll: 'terminal.admin:topology:scroll',
  title: 'terminal.admin:topology:title',
  form: 'terminal.admin:topology:form',
  displayCount: 'terminal.admin:topology:display-count',
  paired: 'terminal.admin:topology:paired',
  reachable: 'terminal.admin:topology:reachable',
  status: 'terminal.admin:topology:host-status',
  formField: 'terminal.admin:topology:form-field',
  host: 'terminal.admin:topology:host',
  query: 'terminal.admin:topology:query',
  identity: 'terminal.admin:topology:identity',
  pair: 'terminal.admin:topology:pair',
  unpair: 'terminal.admin:topology:unpair',
  enable: 'terminal.admin:topology:enable',
  reason: 'terminal.admin:topology:reason',
  alert: 'terminal.admin:topology:alert',
  queryReason: 'terminal.admin:topology:query-reason',
  pairReason: 'terminal.admin:topology:pair-reason',
  powerConfirmation: Object.freeze({
    root: 'terminal.admin:power-confirmation',
    card: 'terminal.admin:power-confirmation:card',
    title: 'terminal.admin:power-confirmation:title',
    message: 'terminal.admin:power-confirmation:message',
    actions: 'terminal.admin:power-confirmation:actions',
    confirm: 'terminal.admin:power-confirmation:confirm',
    cancel: 'terminal.admin:power-confirmation:cancel',
  }),
})

export const adminTestIds = Object.freeze({
  launcher: 'terminal.admin:launcher',
  login: 'terminal.admin:login',
  shell: 'terminal.admin:shell',
  content: 'terminal.admin:content',
  password: 'terminal.admin:password',
  passwordInput: 'terminal.admin:password-input',
  debugPassword: 'terminal.admin:debug-password',
  verify: 'terminal.admin:verify',
  close: 'terminal.admin:close',
  sections: sectionTestIds,
  topology: topologyTestIds,
  section: (partKey: string): string => {
    if (partKey === 'admin.console.platform-ports') return sectionTestIds.platformPorts
    if (partKey === 'admin.console.runtime') return sectionTestIds.runtime
    if (partKey === 'admin.console.display-context') return sectionTestIds.displayContext
    if (partKey === 'admin.console.topology') return sectionTestIds.topology
    if (partKey === 'sample.console.admin-test') return sectionTestIds.sampleConsole
    return `terminal.admin:section:${partKey}`
  },
})
