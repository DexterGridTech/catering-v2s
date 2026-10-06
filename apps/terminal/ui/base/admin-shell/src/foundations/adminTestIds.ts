import {createTestId, deriveTestId, type TestId} from '@catering-v2s/ui-base-primitives/test-id';
import {moduleName} from '../moduleName';

const adminTestId = (key: string) => createTestId(moduleName, 'automation', {element: 'node', key: key});

const sectionTestIds = Object.freeze({
  platformPorts: adminTestId('terminal.admin:section:platform-ports'),
  runtime: adminTestId('terminal.admin:section:runtime'),
  topology: adminTestId('terminal.admin:section:topology'),
  sampleConsole: adminTestId('terminal.admin:section:sample-console'),
});

const portsTestIds = Object.freeze({
  section: sectionTestIds.platformPorts,
  contentRoot: adminTestId('terminal.admin:ports:content-root'),
  title: adminTestId('terminal.admin:ports:title'),
  overallStatus: adminTestId('terminal.admin:ports:overall-status'),
  summary: Object.freeze({
    available: adminTestId('terminal.admin:ports:summary:available'),
    unavailable: adminTestId('terminal.admin:ports:summary:unavailable'),
    undeclared: adminTestId('terminal.admin:ports:summary:undeclared'),
    ratioBar: adminTestId('terminal.admin:ports:summary:ratio-bar'),
    grid: adminTestId('terminal.admin:ports:summary-grid'),
  }),
  category: (category: string, field: 'row' | 'status' | 'count' | 'expand' | 'empty') =>
    adminTestId(`ports:category:${category}:${field}`),
  item: (unitKey: string, field: 'name' | 'status' | 'reason' | 'source') =>
    adminTestId(`ports:item:${unitKey}:${field}`),
});

const runtimeTestIds = Object.freeze({
  section: sectionTestIds.runtime,
  contentRoot: adminTestId('terminal.admin:runtime:content-root'),
  title: adminTestId('terminal.admin:runtime:title'),
  overallStatus: adminTestId('terminal.admin:runtime:overall-status'),
  physicalDisplayCount: adminTestId('terminal.admin:runtime:physical-display-count'),
  surfaceMap: adminTestId('terminal.admin:runtime:surface-map'),
  surface: (
    surfaceKey: string,
    field: 'shape' | 'aspect-ratio' | 'role' | 'current' | 'logical-size' | 'physical-size' | 'ready-state',
  ) => adminTestId(`runtime:surface:${surfaceKey}:${field}`),
  legend: adminTestId('terminal.admin:runtime:surface:legend'),
  mobileSingleSurfaceBoundary: adminTestId('terminal.admin:runtime:mobile:single-surface-boundary'),
  displayFactsError: adminTestId('terminal.admin:runtime:display-facts-error'),
  automation: Object.freeze({
    enabled: adminTestId('terminal.admin:runtime:automation-enabled'),
    address: adminTestId('terminal.admin:runtime:automation-address'),
  }),
});

const topologyTestIds = Object.freeze({
  section: sectionTestIds.topology,
  contentRoot: adminTestId('terminal.admin:topology:content-root'),
  scroll: adminTestId('terminal.admin:topology:scroll'),
  title: adminTestId('terminal.admin:topology:title'),
  role: adminTestId('terminal.admin:topology:role'),
  goalChoice: adminTestId('terminal.admin:topology:goal-choice'),
  goalHost: adminTestId('terminal.admin:topology:goal:host'),
  goalSlave: adminTestId('terminal.admin:topology:goal:slave'),
  hostService: adminTestId('terminal.admin:topology:host-service'),
  hostServiceState: adminTestId('terminal.admin:topology:host-service:state'),
  hostIp: adminTestId('terminal.admin:topology:host-ip'),
  pairing: adminTestId('terminal.admin:topology:pairing'),
  pairResult: adminTestId('terminal.admin:topology:pair-result'),
  pairState: adminTestId('terminal.admin:topology:pair-state'),
  reachability: adminTestId('terminal.admin:topology:reachability'),
  counterparty: adminTestId('terminal.admin:topology:counterparty'),
  actionGroup: adminTestId('terminal.admin:topology:action-group'),
  action: (action: string) => adminTestId(`topology:action:${action}`),
  operationFeedback: adminTestId('terminal.admin:topology:operation-feedback'),
  failureReason: adminTestId('terminal.admin:topology:failure:reason'),
  retry: adminTestId('terminal.admin:topology:retry'),
  form: adminTestId('terminal.admin:topology:form'),
  displayCount: adminTestId('terminal.admin:topology:display-count'),
  paired: adminTestId('terminal.admin:topology:paired'),
  reachable: adminTestId('terminal.admin:topology:reachable'),
  status: adminTestId('terminal.admin:topology:host-status'),
  pageGate: adminTestId('terminal.admin:topology:page-gate'),
  pageGateReason: adminTestId('terminal.admin:topology:page-gate-reason'),
  formField: adminTestId('terminal.admin:topology:form-field'),
  host: adminTestId('terminal.admin:topology:host'),
  pair: adminTestId('terminal.admin:topology:pair'),
  unpair: adminTestId('terminal.admin:topology:unpair'),
  enable: adminTestId('terminal.admin:topology:enable'),
  reason: adminTestId('terminal.admin:topology:reason'),
  alert: adminTestId('terminal.admin:topology:alert'),
  pairReason: adminTestId('terminal.admin:topology:pair-reason'),
  powerConfirmation: Object.freeze({
    root: adminTestId('terminal.admin:power-confirmation'),
    card: adminTestId('terminal.admin:power-confirmation:card'),
    title: adminTestId('terminal.admin:power-confirmation:title'),
    message: adminTestId('terminal.admin:power-confirmation:message'),
    actions: adminTestId('terminal.admin:power-confirmation:actions'),
    confirm: adminTestId('terminal.admin:power-confirmation:confirm'),
    cancel: adminTestId('terminal.admin:power-confirmation:cancel'),
  }),
});

export const adminTestIds = Object.freeze({
  launcher: adminTestId('terminal.admin:launcher'),
  login: adminTestId('terminal.admin:login'),
  shell: adminTestId('terminal.admin:shell'),
  panel: Object.freeze({
    frame: adminTestId('terminal.admin:shell:panel'),
    header: adminTestId('terminal.admin:shell:header'),
    brand: adminTestId('terminal.admin:shell:brand'),
    body: adminTestId('terminal.admin:shell:body'),
    status: adminTestId('terminal.admin:shell:overall-status'),
    empty: adminTestId('terminal.admin:panel:empty'),
    loading: adminTestId('terminal.admin:panel:loading'),
    error: adminTestId('terminal.admin:panel:error'),
    retry: adminTestId('terminal.admin:panel:retry'),
  }),
  content: adminTestId('terminal.admin:content'),
  password: adminTestId('terminal.admin:password'),
  passwordInput: adminTestId('terminal.admin:password-input'),
  debugPassword: adminTestId('terminal.admin:debug-password'),
  verify: adminTestId('terminal.admin:verify'),
  close: adminTestId('terminal.admin:close'),
  sections: sectionTestIds,
  ports: portsTestIds,
  runtime: runtimeTestIds,
  topology: topologyTestIds,
  node: adminTestId,
  child: (parent: TestId, element: string, key?: string): TestId => deriveTestId(parent, element, key)!,
  section: (partKey: string): TestId => {
    if (partKey === 'admin.console.platform-ports') return sectionTestIds.platformPorts;
    if (partKey === 'admin.console.runtime') return sectionTestIds.runtime;
    if (partKey === 'admin.console.topology') return sectionTestIds.topology;
    if (partKey === 'sample.console.admin-test') return sectionTestIds.sampleConsole;
    return adminTestId(`section:${partKey}`);
  },
});
