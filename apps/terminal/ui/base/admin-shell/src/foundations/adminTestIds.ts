const sectionTestIds = Object.freeze({
  platformPorts: 'terminal.admin:section:platform-ports',
  runtime: 'terminal.admin:section:runtime',
  topology: 'terminal.admin:section:topology',
  sampleConsole: 'terminal.admin:section:sample-console',
})

const portsTestIds = Object.freeze({
  section: sectionTestIds.platformPorts,
  title: 'terminal.admin:ports:title',
  overallStatus: 'terminal.admin:ports:overall-status',
  summary: Object.freeze({
    available: 'terminal.admin:ports:summary:available',
    unavailable: 'terminal.admin:ports:summary:unavailable',
    undeclared: 'terminal.admin:ports:summary:undeclared',
    ratioBar: 'terminal.admin:ports:summary:ratio-bar',
    grid: 'terminal.admin:ports:summary-grid',
  }),
  category: (category: string, field: 'row' | 'status' | 'count' | 'expand' | 'empty') => `terminal.admin:ports:category:${category}:${field}`,
  item: (unitKey: string, field: 'name' | 'status' | 'reason' | 'source') => `terminal.admin:ports:item:${unitKey}:${field}`,
})

const runtimeTestIds = Object.freeze({
  section: sectionTestIds.runtime,
  title: 'terminal.admin:runtime:title',
  overallStatus: 'terminal.admin:runtime:overall-status',
  physicalDisplayCount: 'terminal.admin:runtime:physical-display-count',
  surfaceMap: 'terminal.admin:runtime:surface-map',
  surface: (surfaceKey: string, field: 'shape' | 'aspect-ratio' | 'role' | 'current' | 'logical-size' | 'physical-size' | 'ready-state') => `terminal.admin:runtime:surface:${surfaceKey}:${field}`,
  legend: 'terminal.admin:runtime:surface:legend',
  mobileSingleSurfaceBoundary: 'terminal.admin:runtime:mobile:single-surface-boundary',
  displayFactsError: 'terminal.admin:runtime:display-facts-error',
})

const topologyTestIds = Object.freeze({
  section: sectionTestIds.topology,
  scroll: 'terminal.admin:topology:scroll',
  title: 'terminal.admin:topology:title',
  role: 'terminal.admin:topology:role',
  goalChoice: 'terminal.admin:topology:goal-choice',
  goalHost: 'terminal.admin:topology:goal:host',
  goalSlave: 'terminal.admin:topology:goal:slave',
  hostService: 'terminal.admin:topology:host-service',
  hostServiceState: 'terminal.admin:topology:host-service:state',
  hostIp: 'terminal.admin:topology:host-ip',
  pairing: 'terminal.admin:topology:pairing',
  pairResult: 'terminal.admin:topology:pair-result',
  pairState: 'terminal.admin:topology:pair-state',
  reachability: 'terminal.admin:topology:reachability',
  counterparty: 'terminal.admin:topology:counterparty',
  actionGroup: 'terminal.admin:topology:action-group',
  action: (action: string) => `terminal.admin:topology:action:${action}`,
  operationFeedback: 'terminal.admin:topology:operation-feedback',
  failureReason: 'terminal.admin:topology:failure:reason',
  retry: 'terminal.admin:topology:retry',
  form: 'terminal.admin:topology:form',
  displayCount: 'terminal.admin:topology:display-count',
  paired: 'terminal.admin:topology:paired',
  reachable: 'terminal.admin:topology:reachable',
  status: 'terminal.admin:topology:host-status',
  pageGate: 'terminal.admin:topology:page-gate',
  pageGateReason: 'terminal.admin:topology:page-gate-reason',
  formField: 'terminal.admin:topology:form-field',
  host: 'terminal.admin:topology:host',
  pair: 'terminal.admin:topology:pair',
  unpair: 'terminal.admin:topology:unpair',
  enable: 'terminal.admin:topology:enable',
  reason: 'terminal.admin:topology:reason',
  alert: 'terminal.admin:topology:alert',
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
  panel: Object.freeze({
    frame: 'terminal.admin:shell:panel',
    header: 'terminal.admin:shell:header',
    brand: 'terminal.admin:shell:brand',
    body: 'terminal.admin:shell:body',
    status: 'terminal.admin:shell:overall-status',
    empty: 'terminal.admin:panel:empty',
    loading: 'terminal.admin:panel:loading',
    error: 'terminal.admin:panel:error',
    retry: 'terminal.admin:panel:retry',
  }),
  content: 'terminal.admin:content',
  password: 'terminal.admin:password',
  passwordInput: 'terminal.admin:password-input',
  debugPassword: 'terminal.admin:debug-password',
  verify: 'terminal.admin:verify',
  close: 'terminal.admin:close',
  sections: sectionTestIds,
  ports: portsTestIds,
  runtime: runtimeTestIds,
  topology: topologyTestIds,
  section: (partKey: string): string => {
    if (partKey === 'admin.console.platform-ports') return sectionTestIds.platformPorts
    if (partKey === 'admin.console.runtime') return sectionTestIds.runtime
    if (partKey === 'admin.console.topology') return sectionTestIds.topology
    if (partKey === 'sample.console.admin-test') return sectionTestIds.sampleConsole
    return `terminal.admin:section:${partKey}`
  },
})
