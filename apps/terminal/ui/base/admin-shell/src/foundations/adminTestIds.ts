const sectionTestIds = Object.freeze({
  platformPorts: 'terminal.admin:section:platform-ports',
  runtime: 'terminal.admin:section:runtime',
  displayContext: 'terminal.admin:section:display-context',
  sampleConsole: 'terminal.admin:section:sample-console',
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
  section: (partKey: string): string => {
    if (partKey === 'admin.console.platform-ports') return sectionTestIds.platformPorts
    if (partKey === 'admin.console.runtime') return sectionTestIds.runtime
    if (partKey === 'admin.console.display-context') return sectionTestIds.displayContext
    if (partKey === 'sample.console.admin-test') return sectionTestIds.sampleConsole
    return `terminal.admin:section:${partKey}`
  },
})
