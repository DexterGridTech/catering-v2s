import * as React from 'react';
import dayjs from 'dayjs';
import {afterEach, describe, expect, it, vi} from 'vitest';

const harness = vi.hoisted(() => {
  const definition = {
    entityType: 'REGION',
    revision: 1,
    definitions: [
      {key: 'flag', label: 'Flag', type: 'BOOLEAN', status: 'ENABLED', displayOrder: 1},
      {key: 'amount', label: 'Amount', type: 'NUMBER', status: 'ENABLED', displayOrder: 2},
      {key: 'day', label: 'Day', type: 'DATE', status: 'ENABLED', displayOrder: 3},
      {key: 'clearMe', label: 'Clear me', type: 'TEXT', status: 'ENABLED', displayOrder: 4},
      {key: 'unchanged', label: 'Unchanged', type: 'TEXT', status: 'ENABLED', displayOrder: 5},
      {key: 'retired', label: 'Retired', type: 'TEXT', status: 'DISABLED', displayOrder: 6},
    ],
  };
  return {
    definition,
    calls: [] as Array<{method: string; args: unknown[]}>,
    form: {
      resetFields: () => undefined,
      setFieldValue: () => undefined,
      setFieldsValue: () => undefined,
      submit: () => undefined,
    },
  };
});

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => ({current: initial}),
    useState: (initial: unknown) => [initial, () => undefined],
  };
});

vi.mock('antd', () => {
  const component = () => null;
  const form = Object.assign(() => null, {
    Item: component,
    List: component,
    useForm: () => [harness.form],
    useWatch: (name: string) => (name === 'operatingRuleSwitches' ? {} : undefined),
  });
  return {
    Alert: component,
    Button: component,
    Card: component,
    DatePicker: component,
    Drawer: component,
    Form: form,
    Input: Object.assign(component, {TextArea: component}),
    InputNumber: component,
    Select: component,
    Space: component,
    Switch: component,
    Typography: {Text: component, Title: component},
  };
});

vi.mock('@catering-v2s/admin-ui-foundation', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/admin-ui-foundation')>();
  const lifecycle = {
    submitting: false,
    dirty: false,
    getIdempotencyKey: () => 'extension-request-test-key',
    setSubmitting: () => undefined,
    setDirty: () => undefined,
    closeAfterSuccess: () => undefined,
    requestClose: () => undefined,
    afterOpenChange: () => undefined,
    reset: () => undefined,
    markBusinessIntentChanged: () => undefined,
  };
  return {
    ...actual,
    useDrawerFormLifecycle: () => lifecycle,
    useOverlayLock: () => undefined,
  };
});

vi.mock('../../../app/api/OperationsTransport', () => ({
  operationsClient: new Proxy(
    {},
    {
      get: (_target, method) =>
        (...args: unknown[]) => {
          harness.calls.push({method: String(method), args});
          return Promise.resolve({
            id: 'saved-id',
            nodeType: 'REGION',
            parentId: 'parent-id',
            code: 'SAVED',
            name: 'Saved',
            notes: null,
            status: 'ENABLED',
            phases: [],
            revision: 2,
            extensionRuleRevision: 1,
            extensionValues: {},
            items: [],
          });
        },
    },
  ),
  operationsProblemOf: () => ({detail: 'unexpected test error', errorCode: 'UNKNOWN'}),
  operationsRtk: new Proxy(
    {},
    {get: () => () => ({data: harness.definition, currentData: harness.definition, isFetching: false})},
  ),
}));

vi.mock('../../../app/api/generated/operations-edge.rtk', () => ({
  operationsAdminRtkRequest: new Proxy({}, {get: () => (..._args: unknown[]) => ({})}),
}));

vi.mock('../../../app/queries/useOrganizationCandidates', () => ({
  useOrganizationCandidates: () => ({
    data: [],
    currentData: [],
    isFetching: false,
    items: [],
    stores: [],
    onPopupScroll: () => undefined,
    setStoreSearch: () => undefined,
  }),
}));

vi.mock('../../contract-management/ui/useContractStoreCandidates', () => ({
  useContractStoreCandidates: () => ({
    data: {
      project: {id: 'project-id', name: 'Project', code: 'P'},
      stores: [],
      selectedStoreTenant: {id: 'tenant-id', name: 'Tenant', code: 'T'},
    },
    currentData: {stores: []},
    stores: [],
    setStoreSearch: () => undefined,
  }),
}));

vi.mock('../../organization-structure/ui/OrganizationExtensionFields', () => ({
  OrganizationExtensionFields: () => null,
  useOrganizationExtensionDefinition: () => ({data: harness.definition, currentData: harness.definition, isFetching: false}),
}));

import {Form} from 'antd';
import {RegionCreateDrawer} from '../../organization-structure/ui/RegionCreateDrawer';
import {ProjectCreateDrawer} from '../../organization-structure/ui/ProjectCreateDrawer';
import {OrganizationEditDrawer} from '../../organization-structure/ui/OrganizationEditDrawer';
import {CommercialGroupEditDrawer} from '../../organization-structure/ui/CommercialGroupEditDrawer';
import {BusinessEntityCreateDrawer} from '../../business-entity-management/ui/BusinessEntityCreateDrawer';
import {BusinessEntityEditDrawer} from '../../business-entity-management/ui/BusinessEntityEditDrawer';
import {StoreCreateDrawer} from '../../store-management/ui/StoreCreateDrawer';
import {StoreEditDrawer} from '../../store-management/ui/StoreEditDrawer';
import {ContractCreateDrawer} from '../../contract-management/ui/ContractCreateDrawer';
import {ContractEditDrawer} from '../../contract-management/ui/ContractEditDrawer';

const queryContext = {
  groupWorkspaceKey: 'workspace-a',
  expectedContextVersion: 4,
  scopeRef: 'project-id',
} as never;
const currentValues = {flag: true, amount: 2, day: '2026-10-01', clearMe: 'existing', unchanged: 'same', retired: 'stored'};
const extensionValues = {
  flag: false,
  amount: 0,
  day: dayjs('2026-10-15'),
  clearMe: undefined,
  unchanged: 'same',
  retired: 'edited',
};
const expectedCreate = {flag: false, amount: 0, day: '2026-10-15', unchanged: 'same'};
const expectedUpdate = {flag: false, amount: 0, day: '2026-10-15', clearMe: null};
const sharedFormValues = {code: ' CODE ', name: ' Name ', notes: ' Note ', extensionValues};
const currentNode = {
  id: 'node-id', nodeType: 'REGION', parentId: 'parent-id', code: 'OLD', name: 'Old', notes: null,
  status: 'ENABLED', phases: [], revision: 3, extensionValues: currentValues,
};
const businessEntity = {
  id: 'entity-id', status: 'ENABLED', revision: 3, code: 'OLD', name: 'Old', alias: 'A',
  legalName: 'Legal', unifiedSocialCreditCode: 'USCC', remark: null, extensionValues: currentValues,
};
const store = {
  id: 'store-id', revision: 3, extensionRuleRevision: 1, name: 'Store', notes: null,
  project: {id: 'project-id', name: 'Project', code: 'P'},
  brand: {id: 'brand-id', name: 'Brand', code: 'B'}, tenant: {id: 'tenant-id', name: 'Tenant', code: 'T'},
  headCompany: null, operatingRuleSwitches: {}, extensionValues: currentValues,
};
const contract = {
  id: 'contract-id', revision: 3, store: {id: 'store-id', name: 'Store', code: 'S'},
  tenant: {id: 'tenant-id', name: 'Tenant', code: 'T'}, contractNo: 'C-1', phaseName: 'Phase',
  effectiveFrom: '2026-01-01', effectiveTo: null, note: null, items: [], extensionValues: currentValues,
};

function findForm(node: unknown): React.ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findForm(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!React.isValidElement(node)) return undefined;
  if (node.type === Form) return node;
  return findForm((node.props as {children?: unknown}).children);
}

async function submitDrawer(component: (props: never) => React.ReactNode, props: unknown, values: unknown) {
  const tree = component(props as never);
  const form = findForm(tree);
  expect(form, 'drawer must render the actual submit Form').toBeDefined();
  const onFinish = (form?.props as {onFinish?: (input: unknown) => unknown}).onFinish;
  expect(onFinish, 'actual drawer Form must provide onFinish').toBeTypeOf('function');
  onFinish?.(values);
  await Promise.resolve();
  await Promise.resolve();
}

function expectExtensionRequest(method: string, expected: Record<string, unknown>) {
  const call = harness.calls.at(-1);
  expect(call?.method).toBe(method);
  const request = call?.args[1] as {body?: {extensionValues?: unknown}} | undefined;
  expect(request?.body?.extensionValues).toEqual(expected);
}

afterEach(() => harness.calls.splice(0));

describe('extension values in real drawer requests', () => {
  it('serializes the object actually sent by all fourteen create and update operations', async () => {
    const cases: Array<{
      component: (props: never) => React.ReactNode;
      props: object;
      values: object;
      method: string;
      expected: Record<string, unknown>;
    }> = [
      {component: RegionCreateDrawer, props: {open: true, commercialGroup: {id: 'group', name: 'Group', code: 'G'}, queryContext, onClose: () => undefined, onCreated: () => undefined}, values: sharedFormValues, method: 'createOperationsOrganizationRegion', expected: expectedCreate},
      {component: ProjectCreateDrawer, props: {open: true, region: {id: 'region', name: 'Region', code: 'R'}, queryContext, onClose: () => undefined, onCreated: () => undefined}, values: {...sharedFormValues, phaseDrafts: []}, method: 'createOperationsOrganizationProject', expected: expectedCreate},
      {component: OrganizationEditDrawer, props: {node: currentNode, parentName: 'Parent', queryContext, onClose: () => undefined, onUpdated: () => undefined}, values: sharedFormValues, method: 'updateOperationsOrganizationNode', expected: expectedUpdate},
      {component: CommercialGroupEditDrawer, props: {group: {...currentNode, id: 'group-id'}, queryContext, onClose: () => undefined, onUpdated: () => undefined}, values: sharedFormValues, method: 'updateOperationsCommercialGroup', expected: expectedUpdate},
      ...(['BRAND', 'TENANT', 'HEAD_COMPANY'] as const).map(kind => ({component: BusinessEntityCreateDrawer, props: {open: true, kind, queryContext, onClose: () => undefined, onCreated: () => undefined}, values: sharedFormValues, method: `createOperationsOrganization${kind === 'HEAD_COMPANY' ? 'HeadCompany' : kind[0] + kind.slice(1).toLowerCase()}`, expected: expectedCreate})),
      ...(['BRAND', 'TENANT', 'HEAD_COMPANY'] as const).map(kind => ({component: BusinessEntityEditDrawer, props: {entity: businessEntity, kind, queryContext, onClose: () => undefined, onUpdated: () => undefined}, values: sharedFormValues, method: `updateOperationsOrganization${kind === 'HEAD_COMPANY' ? 'HeadCompany' : kind[0] + kind.slice(1).toLowerCase()}`, expected: expectedUpdate})),
      {component: StoreCreateDrawer, props: {open: true, queryContext, onClose: () => undefined, onCreated: () => undefined}, values: {...sharedFormValues, brandId: 'brand-id', tenantId: 'tenant-id'}, method: 'createOperationsOrganizationStore', expected: expectedCreate},
      {component: StoreEditDrawer, props: {store, queryContext, onClose: () => undefined, onUpdated: () => undefined}, values: {...sharedFormValues, operatingRuleSwitches: {}}, method: 'updateOperationsOrganizationStore', expected: expectedUpdate},
      {component: ContractCreateDrawer, props: {open: true, queryContext, onClose: () => undefined, onCreated: () => undefined}, values: {...sharedFormValues, storeId: 'store-id', phaseName: 'Phase', contractNo: 'C-1', effectiveFrom: '2026-01-01', items: []}, method: 'createOperationsContract', expected: expectedCreate},
      {component: ContractEditDrawer, props: {contract, queryContext, onClose: () => undefined, onUpdated: () => undefined, onConflict: () => undefined}, values: {...sharedFormValues, phaseName: 'Phase', effectiveFrom: '2026-01-01', items: []}, method: 'updateOperationsContract', expected: expectedUpdate},
    ];

    expect(cases).toHaveLength(14);
    for (const testCase of cases) {
      harness.calls.splice(0);
      await submitDrawer(testCase.component, testCase.props, testCase.values);
      expect(harness.calls).toHaveLength(1);
      expectExtensionRequest(testCase.method, testCase.expected);
    }
  });
});
