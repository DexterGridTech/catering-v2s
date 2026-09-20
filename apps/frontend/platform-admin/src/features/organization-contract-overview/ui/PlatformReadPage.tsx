import {ProTable, type ProFormInstance} from '@ant-design/pro-components';
import {Alert, Button, Card, Descriptions, Empty, Input, Space, Spin, Tabs, Tag, Tree} from 'antd';
import {
  adminHierarchyCollator,
  adminListState,
  clearInvalidExtensionFilterFields,
  contextScopedQueryArgs,
  createExtensionFilterRecoveryState,
  createPageQueryIdentity,
  displayFieldValue,
  ExtensionFilterInvalidSummary,
  formatCanonicalDateTime,
  isExtensionDefinitionRevisionAtLeast,
  lifecycleColor,
  lifecycleLabel,
  reconcileExtensionFilterValues,
  NameCodeText,
  testId,
  ValidityStatus,
  useExtensionFilterInvalidFocus,
  useExtensionFilterStaleRecovery,
  useAsyncGenerationGuard,
  useDetailDrawer,
  useOverlayLock,
  usePageQuery,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {
  ContractOverviewItem,
  OrganizationHierarchyTreeNode,
  OrganizationOverviewItem,
  OrganizationOverviewStatus,
  StoreContractSortDirection,
  StoreContractSortKey,
  StoreContractStatus,
} from '../../../app/api/generated/platform-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {ContractOverviewDetailDrawer} from './ContractOverviewDetailDrawer';
import {OrganizationOverviewDetailDrawer} from './OrganizationOverviewDetailDrawer';
import {
  defaultOrganizationTabQueryState,
  filtersForOrganizationTab,
  organizationOverviewQuery,
  organizationOverviewStatusLabel,
  organizationOverviewStatusValueEnum,
  ownerFilterOptions,
  updateOrganizationTabQueryState,
  type OrganizationFilters,
  type OrganizationTab,
  type OrganizationTabQueryState,
} from './OrganizationOverviewFilters';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';
import {organizationOverviewExtensionItems} from './OrganizationOverviewPresentation';
import {usePlatformOrganizationCandidates} from '../../../app/queries/usePlatformOrganizationCandidates';
import {extensionListAndSearchColumns, extensionQueryValues} from './extensionList';
import {
  extensionListInvalidSummaryTestId,
  extensionListRecoveryNoticeTestId,
} from '../../../app/automation/extensionListTestIds';

type ContractFilters = {
  contractNo?: string;
  storeId?: string;
  phaseName?: string;
  tenantId?: string;
  itemCode?: string;
  status?: StoreContractStatus;
  extensionFilterValues?: Record<string, unknown>;
};

type ExtensionRecoveryFlags = {
  scopeKey: string;
  inProgress: boolean;
  failed: boolean;
};

const EMPTY_EXTENSION_RECOVERY_FLAGS: ExtensionRecoveryFlags = {
  scopeKey: '',
  inProgress: false,
  failed: false,
};

const organizationTabs: OrganizationTab[] = [
  {key: 'HIERARCHY', label: '组织架构', category: 'HIERARCHY'},
  {key: 'BRAND', label: '品牌', category: 'BUSINESS_ENTITY', type: 'BRAND'},
  {key: 'TENANT', label: '经营租户', category: 'BUSINESS_ENTITY', type: 'TENANT'},
  {key: 'HEAD_COMPANY', label: '总公司', category: 'BUSINESS_ENTITY', type: 'HEAD_COMPANY'},
  {key: 'STORE', label: '门店', category: 'STORE', type: 'STORE'},
];
export function PlatformReadPage({kind}: {kind: 'organization' | 'contracts'}) {
  return (
    <WorkspaceScope>
      {groupWorkspaceKey => (
        <PlatformReadForWorkspace
          key={`${groupWorkspaceKey}-${kind}`}
          groupWorkspaceKey={groupWorkspaceKey}
          kind={kind}
        />
      )}
    </WorkspaceScope>
  );
}

type OrganizationTreeData = {key: string; title: ReactNode; children: OrganizationTreeData[]};
type OrganizationHierarchyDetail = Omit<OrganizationOverviewItem, 'extensionFields'> & {
  extensionFields: ReturnType<typeof organizationOverviewExtensionItems>;
};

const hierarchyTypeLabels = {GROUP: '集团', REGION: '大区', PROJECT: '项目'} as const;
const hierarchyNameCollator = adminHierarchyCollator;

function hierarchyNodeTitle(
  type: keyof typeof hierarchyTypeLabels,
  name: string,
  code: string,
  status: OrganizationOverviewStatus,
): ReactNode {
  return (
    <span>
      <Tag color="cyan">{hierarchyTypeLabels[type]}</Tag>
      <span>{<NameCodeText name={name} code={code} />}</span>
      {status !== 'ENABLED' && <Tag color={lifecycleColor(status)}>{lifecycleLabel(status)}</Tag>}
    </span>
  );
}

function treeNodes(nodes: OrganizationHierarchyTreeNode[]): OrganizationTreeData[] {
  return [...nodes]
    .sort((left, right) => hierarchyNameCollator.compare(left.name, right.name))
    .map(node => ({
      key: node.id,
      title: hierarchyNodeTitle(node.type, node.name, node.code, node.status),
      children: treeNodes(node.children),
    }));
}

function hierarchySearchMatches(node: Pick<OrganizationHierarchyTreeNode, 'name' | 'code'>, query: string) {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  return (
    !normalized ||
    node.name.toLocaleLowerCase('zh-CN').includes(normalized) ||
    node.code.toLocaleLowerCase('zh-CN').includes(normalized)
  );
}

function filterHierarchyNodes(nodes: OrganizationHierarchyTreeNode[], query: string): OrganizationHierarchyTreeNode[] {
  return [...nodes]
    .sort((left, right) => hierarchyNameCollator.compare(left.name, right.name))
    .flatMap(node => {
      const children = filterHierarchyNodes(node.children, query);
      return hierarchySearchMatches(node, query) || children.length ? [{...node, children}] : [];
    });
}

function findHierarchyNode(
  nodes: OrganizationHierarchyTreeNode[],
  id: string,
): OrganizationHierarchyTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findHierarchyNode(node.children, id);
    if (child) return child;
  }
  return undefined;
}

function hierarchyDetailPresentation(item: OrganizationOverviewItem): OrganizationHierarchyDetail {
  return {
    ...item,
    extensionFields: (item.extensionFields ?? []).map(field => ({
      key: `extension-${field.name}`,
      label: field.name,
      children: displayFieldValue(field.value),
    })),
  };
}

function PlatformReadForWorkspace({
  groupWorkspaceKey,
  kind,
}: {
  groupWorkspaceKey: string;
  kind: 'organization' | 'contracts';
}) {
  const [organizationTab, setOrganizationTab] = useState('HIERARCHY');
  const [organizationTabStates, setOrganizationTabStates] = useState<Record<string, OrganizationTabQueryState>>({});
  const [contractFilters, setContractFilters] = useState<ContractFilters>({});
  const [contractStoreSearch, setContractStoreSearch] = useState('');
  const [contractTenantSearch, setContractTenantSearch] = useState('');
  const [extensionRecoveryNoticeScope, setExtensionRecoveryNoticeScope] = useState<string>();
  const [organizationExtensionRecoveryFlags, setOrganizationExtensionRecoveryFlags] =
    useState<ExtensionRecoveryFlags>(EMPTY_EXTENSION_RECOVERY_FLAGS);
  const [contractExtensionRecoveryFlags, setContractExtensionRecoveryFlags] =
    useState<ExtensionRecoveryFlags>(EMPTY_EXTENSION_RECOVERY_FLAGS);
  const organizationFilterFormRef = useRef<ProFormInstance | undefined>(undefined);
  const contractFilterFormRef = useRef<ProFormInstance | undefined>(undefined);
  const invalidFilterProblemRef = useRef<HTMLDivElement | null>(null);
  const organizationRecoveryState = useRef<ReturnType<typeof createExtensionFilterRecoveryState> | undefined>(
    undefined,
  );
  if (!organizationRecoveryState.current) organizationRecoveryState.current = createExtensionFilterRecoveryState();
  const contractRecoveryState = useRef<ReturnType<typeof createExtensionFilterRecoveryState> | undefined>(undefined);
  if (!contractRecoveryState.current) contractRecoveryState.current = createExtensionFilterRecoveryState();
  const [contractSort, setContractSort] = useState<StoreContractSortKey>('UPDATED_AT');
  const [contractDirection, setContractDirection] = useState<StoreContractSortDirection>('DESC');
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const organizationDetail = useDetailDrawer<OrganizationOverviewItem>();
  const [hierarchyDetail, setHierarchyDetail] = useState<OrganizationHierarchyDetail>();
  const [hierarchyNodeId, setHierarchyNodeId] = useState<string>();
  const [hierarchySearch, setHierarchySearch] = useState('');
  const contractDetail = useDetailDrawer<ContractOverviewItem>();
  const organizationDetailGeneration = useAsyncGenerationGuard();
  const contractDetailGeneration = useAsyncGenerationGuard();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  useOverlayLock(organizationDetail.isOpen || contractDetail.isOpen || Boolean(auditTarget));
  const tab = organizationTabs.find(item => item.key === organizationTab) ?? organizationTabs[0];
  const legalEntityTab = tab.category === 'BUSINESS_ENTITY' && (tab.type === 'TENANT' || tab.type === 'HEAD_COMPANY');
  const organizationTabState = organizationTabStates[tab.key] ?? defaultOrganizationTabQueryState;
  const context = useMemo(() => contextScopedQueryArgs({}, {groupWorkspaceKey}), [groupWorkspaceKey]);
  const organizationRecoveryScopeKey = `platform-organization:${context.groupWorkspaceKey}:${tab.key}`;
  const contractRecoveryScopeKey = `platform-contract:${context.groupWorkspaceKey}`;
  organizationRecoveryState.current.enterScope(organizationRecoveryScopeKey);
  contractRecoveryState.current.enterScope(contractRecoveryScopeKey);
  const currentOrganizationRecoveryFlags =
    organizationExtensionRecoveryFlags.scopeKey === organizationRecoveryScopeKey
      ? organizationExtensionRecoveryFlags
      : EMPTY_EXTENSION_RECOVERY_FLAGS;
  const currentContractRecoveryFlags =
    contractExtensionRecoveryFlags.scopeKey === contractRecoveryScopeKey
      ? contractExtensionRecoveryFlags
      : EMPTY_EXTENSION_RECOVERY_FLAGS;
  const organizationExtensionRecoveryInProgress = currentOrganizationRecoveryFlags.inProgress;
  const contractExtensionRecoveryInProgress = currentContractRecoveryFlags.inProgress;
  const organizationExtensionRecoveryFailed = currentOrganizationRecoveryFlags.failed;
  const contractExtensionRecoveryFailed = currentContractRecoveryFlags.failed;
  const organizationExtensionRecoveryBlocked =
    organizationExtensionRecoveryInProgress || organizationExtensionRecoveryFailed;
  const contractExtensionRecoveryBlocked = contractExtensionRecoveryInProgress || contractExtensionRecoveryFailed;
  useEffect(() => {
    organizationRecoveryState.current?.enterScope(organizationRecoveryScopeKey);
    setOrganizationExtensionRecoveryFlags({scopeKey: organizationRecoveryScopeKey, inProgress: false, failed: false});
    setExtensionRecoveryNoticeScope(current =>
      current?.startsWith('organization:') && current !== `organization:${tab.key}` ? undefined : current,
    );
    return () => organizationRecoveryState.current?.invalidate(organizationRecoveryScopeKey);
  }, [organizationRecoveryScopeKey, tab.key]);
  useEffect(() => {
    contractRecoveryState.current?.enterScope(contractRecoveryScopeKey);
    setContractExtensionRecoveryFlags({scopeKey: contractRecoveryScopeKey, inProgress: false, failed: false});
    setExtensionRecoveryNoticeScope(current => (current === 'contracts' ? undefined : current));
    return () => contractRecoveryState.current?.invalidate(contractRecoveryScopeKey);
  }, [contractRecoveryScopeKey]);
  const organizationQueryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: PLATFORM_ADMIN_OPERATION_IDS.getPlatformOrganizationOverviewPage,
        scope: {groupWorkspaceKey: context.groupWorkspaceKey, tab: tab.key},
        filters: organizationTabState.filters,
        sort: {sort: organizationTabState.sort, direction: organizationTabState.direction},
      }),
    [
      context.groupWorkspaceKey,
      organizationTabState.direction,
      organizationTabState.filters,
      organizationTabState.sort,
      tab.key,
    ],
  );
  const organizationPagination = usePageQuery({queryIdentity: organizationQueryIdentity, initialPageSize: 10});
  const contractQueryIdentity = useMemo(
    () =>
      createPageQueryIdentity({
        operationId: PLATFORM_ADMIN_OPERATION_IDS.getPlatformContractOverviewPage,
        scope: {groupWorkspaceKey: context.groupWorkspaceKey},
        filters: contractFilters,
        sort: {sort: contractSort, direction: contractDirection},
      }),
    [context.groupWorkspaceKey, contractDirection, contractFilters, contractSort],
  );
  const contractPagination = usePageQuery({queryIdentity: contractQueryIdentity, initialPageSize: 10});
  const organizationDefinitionRequest = useMemo(
    () =>
      platformAdminRtkRequest.getExtensionDefinition(
        {groupWorkspaceKey: context.groupWorkspaceKey, entityType: tab.type ?? ''},
        {},
      ),
    [context.groupWorkspaceKey, tab.type],
  );
  const contractDefinitionRequest = useMemo(
    () =>
      platformAdminRtkRequest.getExtensionDefinition(
        {groupWorkspaceKey: context.groupWorkspaceKey, entityType: 'CONTRACT'},
        {},
      ),
    [context.groupWorkspaceKey],
  );
  const organizationDefinitionQuery = platformRtk.useGetExtensionDefinitionQuery(organizationDefinitionRequest, {
    skip: kind !== 'organization' || tab.category === 'HIERARCHY' || !tab.type,
  });
  const contractDefinitionQuery = platformRtk.useGetExtensionDefinitionQuery(contractDefinitionRequest, {
    skip: kind !== 'contracts',
  });
  const workspaceDetailRequest = useMemo(
    () => platformAdminRtkRequest.getPlatformGroupWorkspaceDetail({groupWorkspaceKey: context.groupWorkspaceKey}, {}),
    [context.groupWorkspaceKey],
  );
  const organizationRequest = useMemo(
    () =>
      platformAdminRtkRequest.getPlatformOrganizationOverviewPage(
        {groupWorkspaceKey: context.groupWorkspaceKey},
        {
          query: organizationOverviewQuery(
            tab,
            organizationTabState.filters,
            organizationPagination.page,
            organizationPagination.pageSize,
            organizationTabState.sort,
            organizationTabState.direction,
            organizationDefinitionQuery.currentData,
          ),
        },
      ),
    [
      context.groupWorkspaceKey,
      organizationPagination.page,
      organizationPagination.pageSize,
      organizationTabState,
      tab,
      organizationDefinitionQuery.currentData,
    ],
  );
  const contractRequest = useMemo(() => {
    const {storeId, tenantId, extensionFilterValues: _extensionFilterValues, ...restFilters} = contractFilters;
    return platformAdminRtkRequest.getPlatformContractOverviewPage(
      {groupWorkspaceKey: context.groupWorkspaceKey},
      {
        query: {
          ...restFilters,
          ...(storeId ? {storeId: wireUuid(storeId)} : {}),
          ...(tenantId ? {tenantId: wireUuid(tenantId)} : {}),
          ...extensionQueryValues(contractDefinitionQuery.currentData, contractFilters.extensionFilterValues),
          sort: contractSort,
          direction: contractDirection,
          page: contractPagination.page,
          pageSize: contractPagination.pageSize,
        },
      },
    );
  }, [
    context.groupWorkspaceKey,
    contractDirection,
    contractFilters,
    contractPagination.page,
    contractPagination.pageSize,
    contractSort,
    contractDefinitionQuery.currentData,
  ]);
  const treeRequest = useMemo(
    () =>
      platformAdminRtkRequest.getPlatformOrganizationHierarchyTree({groupWorkspaceKey: context.groupWorkspaceKey}, {}),
    [context.groupWorkspaceKey],
  );
  const commercialGroupDefinitionRequest = useMemo(
    () =>
      platformAdminRtkRequest.getExtensionDefinition(
        {groupWorkspaceKey: context.groupWorkspaceKey, entityType: 'COMMERCIAL_GROUP'},
        {},
      ),
    [context.groupWorkspaceKey],
  );
  const organizationQuery = platformRtk.useGetPlatformOrganizationOverviewPageQuery(organizationRequest, {
    skip: kind !== 'organization' || tab.category === 'HIERARCHY' || organizationExtensionRecoveryBlocked,
  });
  const workspaceDetailQuery = platformRtk.useGetPlatformGroupWorkspaceDetailQuery(workspaceDetailRequest, {
    skip: kind !== 'organization' || tab.category !== 'HIERARCHY',
  });
  const workspaceIsInitialized = workspaceDetailQuery.data?.commercialGroup?.initialized === true;
  // A selected enabled workspace can legitimately be awaiting commercial-group
  // initialization. Its hierarchy has no owner root, so do not issue task reads
  // whose documented owner response is not-found for that state.
  const hierarchyQuery = platformRtk.useGetPlatformOrganizationHierarchyTreeQuery(treeRequest, {
    skip: kind !== 'organization' || tab.category !== 'HIERARCHY' || !workspaceIsInitialized,
  });
  const commercialGroupDefinitionQuery = platformRtk.useGetExtensionDefinitionQuery(commercialGroupDefinitionRequest, {
    skip: kind !== 'organization' || tab.category !== 'HIERARCHY' || !workspaceIsInitialized,
  });
  const contractQuery = platformRtk.useGetPlatformContractOverviewPageQuery(contractRequest, {
    skip: kind !== 'contracts' || contractExtensionRecoveryBlocked,
  });
  const organizationListProblem = organizationQuery.error ? platformProblemOf(organizationQuery.error) : undefined;
  const contractListProblem = contractQuery.error ? platformProblemOf(contractQuery.error) : undefined;
  const invalidFilterProblem =
    kind === 'contracts'
      ? contractListProblem?.errorCode === 'EXTENSION_FILTER_INVALID'
        ? contractListProblem
        : undefined
      : organizationListProblem?.errorCode === 'EXTENSION_FILTER_INVALID'
        ? organizationListProblem
        : undefined;
  const invalidFilterDefinitions =
    kind === 'contracts'
      ? contractDefinitionQuery.currentData?.definitions
      : organizationDefinitionQuery.currentData?.definitions;
  useExtensionFilterInvalidFocus(invalidFilterProblemRef, invalidFilterProblem?.invalidFields);
  if (organizationListProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
    organizationRecoveryState.current!.rememberStaleRevision(
      organizationRecoveryScopeKey,
      organizationListProblem.currentDefinitionRevision,
    );
  }
  if (contractListProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
    contractRecoveryState.current!.rememberStaleRevision(
      contractRecoveryScopeKey,
      contractListProblem.currentDefinitionRevision,
    );
  }
  const recoverOrganizationExtensionFilters = () => {
    const recovery = organizationRecoveryState.current!.begin(
      organizationRecoveryScopeKey,
      organizationListProblem?.currentDefinitionRevision,
    );
    const isCurrentRecovery = () => organizationRecoveryState.current!.isCurrent(recovery);
    const previousFields = organizationDefinitionQuery.currentData?.definitions;
    const previousValues = organizationTabState.filters.extensionFilterValues;
    const failRecovery = () => {
      if (!isCurrentRecovery()) return;
      setOrganizationExtensionRecoveryFlags({scopeKey: recovery.scopeKey, inProgress: false, failed: true});
    };
    setExtensionRecoveryNoticeScope(undefined);
    setOrganizationExtensionRecoveryFlags({scopeKey: recovery.scopeKey, inProgress: true, failed: false});
    void organizationDefinitionQuery
      .refetch()
      .then(result => {
        if (!isCurrentRecovery()) return;
        const definition = result.data;
        if (!definition || !isExtensionDefinitionRevisionAtLeast(definition, recovery.expectedRevision)) {
          failRecovery();
          return;
        }
        const retained = reconcileExtensionFilterValues(
          organizationFilterFormRef.current,
          previousFields,
          definition.definitions,
          previousValues,
        );
        setOrganizationTabStates(current => {
          const state = current[tab.key] ?? defaultOrganizationTabQueryState;
          const {extensionFilterValues: _extensionFilterValues, ...coreFilters} = state.filters;
          return updateOrganizationTabQueryState(current, tab.key, {
            filters: Object.keys(retained).length ? {...coreFilters, extensionFilterValues: retained} : coreFilters,
          });
        });
        organizationPagination.setPage(1);
        setExtensionRecoveryNoticeScope(`organization:${tab.key}`);
        setOrganizationExtensionRecoveryFlags({scopeKey: recovery.scopeKey, inProgress: false, failed: false});
      })
      .catch(failRecovery);
  };
  useExtensionFilterStaleRecovery({
    scopeKey: organizationRecoveryScopeKey,
    stale:
      kind === 'organization' &&
      tab.category !== 'HIERARCHY' &&
      organizationListProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE',
    staleRevision: organizationListProblem?.currentDefinitionRevision,
    recover: recoverOrganizationExtensionFilters,
  });
  const recoverContractExtensionFilters = () => {
    const recovery = contractRecoveryState.current!.begin(
      contractRecoveryScopeKey,
      contractListProblem?.currentDefinitionRevision,
    );
    const isCurrentRecovery = () => contractRecoveryState.current!.isCurrent(recovery);
    const previousFields = contractDefinitionQuery.currentData?.definitions;
    const previousValues = contractFilters.extensionFilterValues;
    const failRecovery = () => {
      if (!isCurrentRecovery()) return;
      setContractExtensionRecoveryFlags({scopeKey: recovery.scopeKey, inProgress: false, failed: true});
    };
    setExtensionRecoveryNoticeScope(undefined);
    setContractExtensionRecoveryFlags({scopeKey: recovery.scopeKey, inProgress: true, failed: false});
    void contractDefinitionQuery
      .refetch()
      .then(result => {
        if (!isCurrentRecovery()) return;
        const definition = result.data;
        if (!definition || !isExtensionDefinitionRevisionAtLeast(definition, recovery.expectedRevision)) {
          failRecovery();
          return;
        }
        const retained = reconcileExtensionFilterValues(
          contractFilterFormRef.current,
          previousFields,
          definition.definitions,
          previousValues,
        );
        setContractFilters(current => {
          const {extensionFilterValues: _extensionFilterValues, ...coreFilters} = current;
          return Object.keys(retained).length ? {...coreFilters, extensionFilterValues: retained} : coreFilters;
        });
        contractPagination.setPage(1);
        setExtensionRecoveryNoticeScope('contracts');
        setContractExtensionRecoveryFlags({scopeKey: recovery.scopeKey, inProgress: false, failed: false});
      })
      .catch(failRecovery);
  };
  useExtensionFilterStaleRecovery({
    scopeKey: contractRecoveryScopeKey,
    stale: kind === 'contracts' && contractListProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE',
    staleRevision: contractListProblem?.currentDefinitionRevision,
    recover: recoverContractExtensionFilters,
  });
  const clearInvalidFilterFields = () => {
    if (kind === 'contracts') {
      clearInvalidExtensionFilterFields(
        contractFilterFormRef.current,
        contractDefinitionQuery.currentData?.definitions,
        invalidFilterProblem?.invalidFields,
      );
      return;
    }
    clearInvalidExtensionFilterFields(
      organizationFilterFormRef.current,
      organizationDefinitionQuery.currentData?.definitions,
      invalidFilterProblem?.invalidFields,
    );
  };
  const contractStoreCandidates = usePlatformOrganizationCandidates({
    open: kind === 'contracts',
    groupWorkspaceKey: context.groupWorkspaceKey,
    subjectType: 'STORE',
    queryText: contractStoreSearch,
    selectedId: contractFilters.storeId,
  });
  const contractTenantCandidates = usePlatformOrganizationCandidates({
    open: kind === 'contracts',
    groupWorkspaceKey: context.groupWorkspaceKey,
    subjectType: 'TENANT',
    queryText: contractTenantSearch,
    selectedId: contractFilters.tenantId,
  });
  const [loadOrganizationDetail] = platformRtk.useLazyGetPlatformOrganizationOverviewDetailQuery();
  const [loadContractDetail] = platformRtk.useLazyGetPlatformContractOverviewDetailQuery();
  const openOrganizationDetail = (itemId: string, category = tab.category) => {
    const request = organizationDetailGeneration.begin();
    setProblem(undefined);
    if (category === 'HIERARCHY') setHierarchyNodeId(itemId);
    if (category !== 'HIERARCHY') organizationDetail.openLoading();
    void loadOrganizationDetail(
      platformAdminRtkRequest.getPlatformOrganizationOverviewDetail(
        {groupWorkspaceKey: context.groupWorkspaceKey, category, itemId},
        {},
      ),
    )
      .unwrap()
      .then(detail => {
        if (!organizationDetailGeneration.isCurrent(request)) return;
        if (category === 'HIERARCHY') setHierarchyDetail(hierarchyDetailPresentation(detail));
        else organizationDetail.open(detail);
      })
      .catch(error => {
        if (organizationDetailGeneration.isCurrent(request)) {
          organizationDetail.finishLoading();
          setProblem(platformProblemOf(error));
        }
      });
  };
  const openContractDetail = (contractId: string) => {
    const request = contractDetailGeneration.begin();
    setProblem(undefined);
    contractDetail.openLoading();
    void loadContractDetail(
      platformAdminRtkRequest.getPlatformContractOverviewDetail(
        {groupWorkspaceKey: context.groupWorkspaceKey, contractId},
        {},
      ),
    )
      .unwrap()
      .then(detail => {
        if (contractDetailGeneration.isCurrent(request)) contractDetail.open(detail);
      })
      .catch(error => {
        if (contractDetailGeneration.isCurrent(request)) {
          contractDetail.finishLoading();
          setProblem(platformProblemOf(error));
        }
      });
  };
  const closeOrganizationDetail = () => {
    organizationDetailGeneration.invalidate();
    organizationDetail.close();
  };
  const closeContractDetail = () => {
    contractDetailGeneration.invalidate();
    contractDetail.close();
  };
  const hierarchyError =
    workspaceDetailQuery.error ??
    (workspaceIsInitialized ? (hierarchyQuery.error ?? commercialGroupDefinitionQuery.error) : undefined);
  const queryError =
    kind === 'contracts'
      ? (contractQuery.error ?? contractDefinitionQuery.error)
      : tab.category === 'HIERARCHY'
        ? hierarchyError
        : (organizationQuery.error ?? organizationDefinitionQuery.error);
  const extensionDefinitionProblem =
    kind === 'contracts' && !contractListProblem && contractDefinitionQuery.error
      ? {title: '暂时无法获取合同字段配置', detail: '请重试。'}
      : kind === 'organization' &&
          tab.category !== 'HIERARCHY' &&
          !organizationListProblem &&
          organizationDefinitionQuery.error
        ? {title: `暂时无法获取${tab.label}字段配置`, detail: '请重试。'}
        : undefined;
  const extensionRecoveryProblem =
    kind === 'contracts' && contractExtensionRecoveryFailed
      ? {title: '暂时无法获取合同字段配置', detail: '请重试。'}
      : kind === 'organization' && tab.category !== 'HIERARCHY' && organizationExtensionRecoveryFailed
        ? {title: `暂时无法获取${tab.label}字段配置`, detail: '请重试。'}
        : undefined;
  const extensionRecoveryRetryAvailable =
    Boolean(extensionRecoveryProblem) ||
    (kind === 'contracts' && Boolean(contractListProblem || contractDefinitionQuery.error)) ||
    (kind === 'organization' &&
      tab.category !== 'HIERARCHY' &&
      Boolean(organizationListProblem || organizationDefinitionQuery.error));
  const retryExtensionRead = () => {
    if (kind === 'contracts') {
      if (extensionRecoveryProblem || contractListProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
        void recoverContractExtensionFilters();
      } else if (contractListProblem) {
        void contractQuery.refetch();
      } else if (contractDefinitionQuery.error) {
        void contractDefinitionQuery.refetch();
      }
      return;
    }
    if (extensionRecoveryProblem || organizationListProblem?.errorCode === 'EXTENSION_DEFINITION_REVISION_STALE') {
      void recoverOrganizationExtensionFilters();
    } else if (organizationListProblem) {
      void organizationQuery.refetch();
    } else if (organizationDefinitionQuery.error) {
      void organizationDefinitionQuery.refetch();
    }
  };
  const problem =
    extensionRecoveryProblem ??
    extensionDefinitionProblem ??
    (queryError ? platformProblemOf(queryError) : commandProblem);
  const organizationPage = organizationQuery.currentData;
  const contractPage = contractQuery.currentData;
  const hierarchyLoading =
    (workspaceDetailQuery.isLoading ||
      (workspaceIsInitialized && (hierarchyQuery.isLoading || commercialGroupDefinitionQuery.isLoading))) &&
    !queryError;
  // This is a presentation projection of two real owner readbacks, not a persisted or synthetic GROUP node.
  const workspaceDetail = workspaceDetailQuery.data;
  const hierarchyRoot = workspaceDetail?.commercialGroup?.root;
  const selectedHierarchyNode =
    hierarchyNodeId && hierarchyQuery.data
      ? findHierarchyNode(hierarchyQuery.data.regions, hierarchyNodeId)
      : undefined;
  const hierarchyRootProjection =
    workspaceDetail && hierarchyRoot && hierarchyQuery.data
      ? {
          id: hierarchyRoot.id,
          groupWorkspaceKey: hierarchyRoot.groupWorkspaceKey,
          category: 'HIERARCHY' as const,
          type: 'GROUP' as const,
          code: hierarchyRoot.groupCode,
          name: hierarchyRoot.groupName,
          path: [{id: hierarchyRoot.id, code: hierarchyRoot.groupCode, name: hierarchyRoot.groupName, resolved: true}],
          status: workspaceDetail.status,
          source: 'MANUAL' as const,
          version: hierarchyRoot.version,
          createdAt: hierarchyRoot.createdAt,
          updatedAt: hierarchyRoot.updatedAt,
          notes: undefined,
          unresolvedReferences: [],
          extensionFields: organizationOverviewExtensionItems(
            commercialGroupDefinitionQuery.data,
            hierarchyRoot.extensionValues,
          ),
        }
      : undefined;
  const filteredHierarchyRegions = hierarchyQuery.data
    ? filterHierarchyNodes(hierarchyQuery.data.regions, hierarchySearch)
    : [];
  const hierarchyRootMatchesSearch = hierarchyRootProjection
    ? hierarchySearchMatches(hierarchyRootProjection, hierarchySearch)
    : false;
  const hierarchyTreeData =
    hierarchyRootProjection &&
    (!hierarchySearch.trim() || hierarchyRootMatchesSearch || filteredHierarchyRegions.length)
      ? [
          {
            key: hierarchyRootProjection.id,
            title: hierarchyNodeTitle(
              'GROUP',
              hierarchyRootProjection.name,
              hierarchyRootProjection.code,
              hierarchyRootProjection.status,
            ),
            children: treeNodes(
              hierarchyRootMatchesSearch ? (hierarchyQuery?.data?.regions ?? []) : filteredHierarchyRegions,
            ),
          },
        ]
      : [];
  const displayedHierarchyDetail =
    hierarchyNodeId === hierarchyRootProjection?.id ? hierarchyRootProjection : hierarchyDetail;
  const organizationListState = adminListState({
    loading:
      organizationExtensionRecoveryInProgress ||
      (organizationQuery.isFetching && !organizationPage && !organizationQuery.error),
    failed:
      Boolean(organizationQuery.error) ||
      Boolean(organizationDefinitionQuery.error) ||
      organizationExtensionRecoveryFailed,
    emptyText: `暂无${tab.label}`,
    testIdPrefix: 'platform-organization-list',
  });
  const contractListState = adminListState({
    loading: contractExtensionRecoveryInProgress || (contractQuery.isFetching && !contractPage && !contractQuery.error),
    failed: Boolean(contractQuery.error) || Boolean(contractDefinitionQuery.error) || contractExtensionRecoveryFailed,
    emptyText: '暂无合同',
    testIdPrefix: 'platform-contract-list',
  });
  const updateOrganizationTabState = (key: string, patch: Partial<OrganizationTabQueryState>) => {
    setOrganizationTabStates(current => updateOrganizationTabQueryState(current, key, patch));
  };
  const submitOrganizationFilters = (next: OrganizationFilters) => {
    organizationRecoveryState.current?.invalidate(organizationRecoveryScopeKey);
    setOrganizationExtensionRecoveryFlags({scopeKey: organizationRecoveryScopeKey, inProgress: false, failed: false});
    updateOrganizationTabState(tab.key, {filters: filtersForOrganizationTab(tab, next)});
  };
  const resetOrganizationFilters = () => {
    setExtensionRecoveryNoticeScope(undefined);
    organizationRecoveryState.current?.invalidate(organizationRecoveryScopeKey);
    setOrganizationExtensionRecoveryFlags({scopeKey: organizationRecoveryScopeKey, inProgress: false, failed: false});
    updateOrganizationTabState(tab.key, {filters: {}});
  };
  const submitContractFilters = (next: ContractFilters) => {
    contractRecoveryState.current?.invalidate(contractRecoveryScopeKey);
    setContractExtensionRecoveryFlags({scopeKey: contractRecoveryScopeKey, inProgress: false, failed: false});
    setContractFilters(next);
  };
  const resetContractFilters = () => {
    setExtensionRecoveryNoticeScope(undefined);
    contractRecoveryState.current?.invalidate(contractRecoveryScopeKey);
    setContractExtensionRecoveryFlags({scopeKey: contractRecoveryScopeKey, inProgress: false, failed: false});
    setContractFilters({});
  };
  const changeOrganizationTab = (nextTab: string) => {
    if (nextTab !== organizationTab) {
      organizationDetailGeneration.invalidate();
      organizationDetail.close();
      setHierarchyDetail(undefined);
      setHierarchyNodeId(undefined);
    }
    organizationRecoveryState.current?.invalidate(organizationRecoveryScopeKey);
    setOrganizationExtensionRecoveryFlags({scopeKey: organizationRecoveryScopeKey, inProgress: false, failed: false});
    setOrganizationTab(nextTab);
  };
  const hierarchyPage = kind === 'organization' && tab.category === 'HIERARCHY';
  return (
    <div className={hierarchyPage ? 'platform-master-detail-page' : undefined}>
      {extensionRecoveryNoticeScope === (kind === 'contracts' ? 'contracts' : `organization:${tab.key}`) && (
        <Alert
          type="info"
          showIcon
          closable
          title="筛选条件已按最新字段配置更新"
          onClose={() => setExtensionRecoveryNoticeScope(undefined)}
          {...testId(
            extensionListRecoveryNoticeTestId(kind === 'contracts' ? 'platform-contract' : 'platform-organization'),
          )}
          style={{marginBottom: 12}}
        />
      )}
      {problem && (
        <div
          ref={invalidFilterProblemRef}
          tabIndex={invalidFilterProblem?.invalidFields?.length ? -1 : undefined}
          style={{outline: 'none'}}
        >
          <Alert
            type="error"
            showIcon
            title={problem.title}
            description={
              <>
                <div>{problem.detail}</div>
                <ExtensionFilterInvalidSummary
                  invalidFields={invalidFilterProblem?.invalidFields}
                  definitions={invalidFilterDefinitions}
                  onClear={clearInvalidFilterFields}
                  testIdPrefix={extensionListInvalidSummaryTestId(
                    kind === 'contracts' ? 'platform-contract' : 'platform-organization',
                  )}
                />
              </>
            }
            action={
              extensionRecoveryRetryAvailable ? (
                <Button onClick={retryExtensionRead} {...testId(`platform-${kind}-extension-recovery-retry`)}>
                  重试
                </Button>
              ) : undefined
            }
            style={{marginBottom: 12}}
            {...testId(`platform-${kind}-list-error`)}
          />
        </div>
      )}
      {kind === 'organization' && (
        <Tabs
          activeKey={organizationTab}
          onChange={changeOrganizationTab}
          items={organizationTabs.map(item => ({key: item.key, label: item.label}))}
          {...testId('platform-organization-tabs')}
        />
      )}
      {hierarchyPage && (
        <div className="platform-master-detail-layout">
          {hierarchyLoading ? (
            <Spin description={<span {...testId('platform-organization-hierarchy-loading')}>正在加载</span>} />
          ) : problem ? null : !workspaceIsInitialized ? (
            <Empty
              description={
                <span {...testId('platform-organization-hierarchy-uninitialized')}>当前集团空间尚未初始化商业集团</span>
              }
            />
          ) : !hierarchyQuery.data || !hierarchyRootProjection ? (
            <Empty description={<span {...testId('platform-organization-hierarchy-empty')}>暂无组织架构</span>} />
          ) : (
            <Card
              className="platform-master-detail-panel platform-master-detail-tree-panel"
              classNames={{body: 'platform-master-detail-tree-panel-body'}}
              size="small"
              title="组织架构"
            >
              <Input
                allowClear
                placeholder="按名称或编码搜索"
                value={hierarchySearch}
                onChange={event => setHierarchySearch(event.target.value)}
                {...testId('platform-organization-hierarchy-search')}
              />
              <div className="platform-master-detail-tree-scroll">
                {hierarchyTreeData.length ? (
                  <Tree
                    showLine
                    defaultExpandAll
                    selectedKeys={hierarchyNodeId ? [hierarchyNodeId] : []}
                    onSelect={keys => {
                      const id = String(keys[0] ?? '');
                      if (!id) return;
                      if (id === hierarchyRootProjection.id) {
                        setHierarchyNodeId(id);
                        setHierarchyDetail(hierarchyRootProjection);
                        return;
                      }
                      openOrganizationDetail(id, 'HIERARCHY');
                    }}
                    treeData={hierarchyTreeData}
                    {...testId('platform-organization-hierarchy-tree')}
                  />
                ) : (
                  <Empty description="未找到匹配的组织" />
                )}
              </div>
            </Card>
          )}
          <Card
            className="platform-master-detail-panel platform-master-detail-detail-panel"
            classNames={{body: 'platform-master-detail-detail-panel-body'}}
            size="small"
            title="组织详情"
          >
            <Descriptions
              bordered
              size="small"
              column={1}
              styles={{label: {width: 164}}}
              items={
                displayedHierarchyDetail
                  ? [
                      {key: 'name', label: '名称', children: displayedHierarchyDetail.name},
                      {key: 'code', label: '编码', children: displayedHierarchyDetail.code},
                      {
                        key: 'status',
                        label: '状态',
                        children: organizationOverviewStatusLabel(displayedHierarchyDetail.status),
                      },
                      {key: 'notes', label: '备注', children: displayFieldValue(displayedHierarchyDetail.notes)},
                      ...(displayedHierarchyDetail.type === 'PROJECT'
                        ? [
                            {
                              key: 'phases',
                              label: '项目分期名称',
                              children: selectedHierarchyNode?.phases?.join('、') || '—',
                            },
                          ]
                        : []),
                      {
                        key: 'updatedAt',
                        label: '更新时间',
                        children: formatCanonicalDateTime(displayedHierarchyDetail.updatedAt),
                      },
                      ...displayedHierarchyDetail.extensionFields,
                    ]
                  : [{key: 'empty', label: '提示', children: '请选择左侧组织查看详情。'}]
              }
            />
          </Card>
        </div>
      )}
      {kind === 'organization' && tab.category !== 'HIERARCHY' && (
        <div {...testId('platform-organization-table')}>
          <ProTable<OrganizationOverviewItem>
            size="small"
            key={tab.key}
            formRef={organizationFilterFormRef}
            rowKey="id"
            loading={organizationListState.loading}
            locale={organizationListState.locale}
            dataSource={
              organizationQuery.error || organizationDefinitionQuery.error || organizationExtensionRecoveryFailed
                ? []
                : (organizationPage?.items ?? [])
            }
            options={false}
            search={{
              labelWidth: 'auto',
              optionRender: searchConfig => [
                <Button
                  key="submit"
                  type="primary"
                  onClick={() => searchConfig.form?.submit()}
                  {...testId('platform-organization-filter-submit')}
                >
                  查询
                </Button>,
                <Button
                  key="reset"
                  onClick={() => {
                    searchConfig.form?.resetFields();
                    searchConfig.form?.setFieldsValue({
                      name: undefined,
                      code: undefined,
                      legalName: undefined,
                      unifiedSocialCreditCode: undefined,
                      status: undefined,
                      source: undefined,
                      projectId: undefined,
                      brandId: undefined,
                      tenantId: undefined,
                      headCompanyId: undefined,
                    });
                    resetOrganizationFilters();
                  }}
                  {...testId('platform-organization-filter-reset')}
                >
                  重置
                </Button>,
              ],
            }}
            form={{initialValues: organizationTabState.filters}}
            onSubmit={value => {
              setExtensionRecoveryNoticeScope(undefined);
              submitOrganizationFilters({
                name: value.name?.trim() || undefined,
                code: value.code?.trim() || undefined,
                legalName: value.legalName?.trim() || undefined,
                unifiedSocialCreditCode: value.unifiedSocialCreditCode?.trim() || undefined,
                status: value.status,
                source: value.source,
                projectId: value.projectId,
                brandId: value.brandId,
                tenantId: value.tenantId,
                headCompanyId: value.headCompanyId,
                extensionFilterValues: value.extensionFilterValues as Record<string, unknown>,
              });
            }}
            pagination={
              organizationPage
                ? {
                    current: organizationPagination.page,
                    pageSize: organizationPagination.pageSize,
                    total: organizationPage.metadata.total,
                    showSizeChanger: true,
                  }
                : false
            }
            onChange={(pagination, _, sorter, extra) => {
              if (extra.action === 'paginate') {
                if (pagination.pageSize !== organizationPagination.pageSize)
                  organizationPagination.setPageSize(pagination.pageSize ?? organizationPagination.pageSize);
                else organizationPagination.setPage(pagination.current ?? organizationPagination.page);
                return;
              }
              if (extra.action !== 'sort') return;
              const current = Array.isArray(sorter) ? sorter[0] : sorter;
              if (!current?.order) {
                updateOrganizationTabState(tab.key, {sort: 'UPDATED_AT', direction: 'DESC'});
                return;
              }
              const nextSort =
                current.columnKey === 'name' ? 'NAME' : current.columnKey === 'code' ? 'CODE' : 'UPDATED_AT';
              updateOrganizationTabState(tab.key, {
                sort: nextSort,
                direction: current.order === 'ascend' ? 'ASC' : 'DESC',
              });
            }}
            columns={[
              {
                key: 'name',
                title: '名称',
                dataIndex: 'name',
                sorter: true,
                fieldProps: {...testId('platform-organization-filter-name'), allowClear: true, placeholder: '输入名称'},
                render: (_, row) => (
                  <Button
                    type="link"
                    onClick={() => openOrganizationDetail(row.id)}
                    {...testId(`platform-organization-detail-${row.id}`)}
                  >
                    {row.name}
                  </Button>
                ),
              },
              {
                key: 'code',
                title: '编码',
                dataIndex: 'code',
                sorter: true,
                fieldProps: {...testId('platform-organization-filter-code'), allowClear: true, placeholder: '输入编码'},
              },
              ...(legalEntityTab
                ? [
                    {
                      key: 'legalName',
                      title: '法人公司',
                      dataIndex: 'legalName',
                      fieldProps: {
                        ...testId('platform-organization-filter-legal-name'),
                        allowClear: true,
                        placeholder: '输入法人公司',
                      },
                    },
                    {
                      key: 'unifiedSocialCreditCode',
                      title: '统一代码',
                      dataIndex: 'unifiedSocialCreditCode',
                      fieldProps: {
                        ...testId('platform-organization-filter-unified-code'),
                        allowClear: true,
                        placeholder: '输入统一代码',
                      },
                    },
                  ]
                : []),
              ...(tab.type === 'BRAND'
                ? [
                    {
                      title: '别名',
                      dataIndex: 'alias',
                      search: false,
                      render: (_: unknown, row: OrganizationOverviewItem) => displayFieldValue(row.alias),
                    },
                  ]
                : []),
              ...(tab.category === 'STORE'
                ? [
                    {
                      title: '项目',
                      dataIndex: 'projectId',
                      valueType: 'select' as const,
                      hideInTable: true,
                      fieldProps: {
                        ...testId('platform-organization-filter-project'),
                        allowClear: true,
                        showSearch: {optionFilterProp: 'label'},
                        options: ownerFilterOptions(organizationPage?.filterOptions, 'PROJECT'),
                        placeholder: '全部',
                      },
                    },
                    {
                      title: '品牌',
                      dataIndex: 'brandId',
                      valueType: 'select' as const,
                      hideInTable: true,
                      fieldProps: {
                        ...testId('platform-organization-filter-brand'),
                        allowClear: true,
                        showSearch: {optionFilterProp: 'label'},
                        options: ownerFilterOptions(organizationPage?.filterOptions, 'BRAND'),
                        placeholder: '全部',
                      },
                    },
                    {
                      title: '经营租户',
                      dataIndex: 'tenantId',
                      valueType: 'select' as const,
                      hideInTable: true,
                      fieldProps: {
                        ...testId('platform-organization-filter-tenant'),
                        allowClear: true,
                        showSearch: {optionFilterProp: 'label'},
                        options: ownerFilterOptions(organizationPage?.filterOptions, 'TENANT'),
                        placeholder: '全部',
                      },
                    },
                    {
                      title: '总公司',
                      dataIndex: 'headCompanyId',
                      valueType: 'select' as const,
                      hideInTable: true,
                      fieldProps: {
                        ...testId('platform-organization-filter-head-company'),
                        allowClear: true,
                        showSearch: {optionFilterProp: 'label'},
                        options: ownerFilterOptions(organizationPage?.filterOptions, 'HEAD_COMPANY'),
                        placeholder: '全部',
                      },
                    },
                    {
                      title: '项目',
                      dataIndex: 'project',
                      search: false,
                      render: (_: unknown, row: OrganizationOverviewItem) =>
                        row.project ? <NameCodeText name={row.project.name} code={row.project.code} /> : '—',
                    },
                    {
                      title: '品牌',
                      dataIndex: 'brand',
                      search: false,
                      render: (_: unknown, row: OrganizationOverviewItem) =>
                        row.brand ? <NameCodeText name={row.brand.name} code={row.brand.code} /> : '—',
                    },
                    {
                      title: '经营租户',
                      dataIndex: 'tenant',
                      search: false,
                      render: (_: unknown, row: OrganizationOverviewItem) =>
                        row.tenant ? <NameCodeText name={row.tenant.name} code={row.tenant.code} /> : '—',
                    },
                    {
                      title: '总公司',
                      dataIndex: 'headCompany',
                      search: false,
                      render: (_: unknown, row: OrganizationOverviewItem) =>
                        row.headCompany ? (
                          <NameCodeText name={row.headCompany.name} code={row.headCompany.code} />
                        ) : (
                          '未设置'
                        ),
                    },
                  ]
                : []),
              {
                title: '备注',
                dataIndex: 'notes',
                search: false,
                render: (_: unknown, row: OrganizationOverviewItem) => displayFieldValue(row.notes),
              },
              ...extensionListAndSearchColumns<OrganizationOverviewItem>(
                organizationDefinitionQuery.currentData,
                `platform-organization-filter-extension-${tab.type?.toLowerCase() ?? 'unknown'}`,
              ),
              {
                title: '状态',
                dataIndex: 'status',
                valueType: 'select',
                valueEnum: organizationOverviewStatusValueEnum,
                fieldProps: {...testId('platform-organization-filter-status'), allowClear: true, placeholder: '全部'},
                render: (_, row) => organizationOverviewStatusLabel(row.status),
              },
              {
                title: '来源',
                dataIndex: 'source',
                valueType: 'select',
                valueEnum: {MANUAL: {text: '人工维护'}, SYSTEM: {text: '系统生成'}},
                fieldProps: {...testId('platform-organization-filter-source'), allowClear: true, placeholder: '全部'},
              },
              {
                key: 'updatedAt',
                title: '更新时间',
                dataIndex: 'updatedAt',
                sorter: true,
                search: false,
                render: (_: unknown, row: OrganizationOverviewItem) => formatCanonicalDateTime(row.updatedAt),
              },
            ]}
          />
        </div>
      )}
      {kind === 'contracts' && (
        <div {...testId('platform-contract-table')}>
          <ProTable<ContractOverviewItem>
            size="small"
            rowKey={row => row.contractRef.id}
            formRef={contractFilterFormRef}
            loading={contractListState.loading}
            locale={contractListState.locale}
            dataSource={
              contractQuery.error || contractDefinitionQuery.error || contractExtensionRecoveryFailed
                ? []
                : (contractPage?.items ?? [])
            }
            options={false}
            search={{
              labelWidth: 'auto',
              optionRender: searchConfig => [
                <Button
                  key="submit"
                  type="primary"
                  onClick={() => searchConfig.form?.submit()}
                  {...testId('platform-contract-filter-submit')}
                >
                  查询
                </Button>,
                <Button
                  key="reset"
                  onClick={() => {
                    searchConfig.form?.resetFields();
                    searchConfig.form?.setFieldsValue({
                      contractNo: undefined,
                      storeId: undefined,
                      phaseName: undefined,
                      tenantId: undefined,
                      itemCode: undefined,
                      status: undefined,
                    });
                    setContractStoreSearch('');
                    setContractTenantSearch('');
                    resetContractFilters();
                  }}
                  {...testId('platform-contract-filter-reset')}
                >
                  重置
                </Button>,
              ],
            }}
            form={{initialValues: contractFilters}}
            onSubmit={value => {
              setExtensionRecoveryNoticeScope(undefined);
              submitContractFilters({
                contractNo: value.contractNo?.trim() || undefined,
                storeId: value.storeId,
                phaseName: value.phaseName?.trim() || undefined,
                tenantId: value.tenantId,
                itemCode: value.itemCode?.trim() || undefined,
                status: value.status,
                extensionFilterValues: value.extensionFilterValues as Record<string, unknown>,
              });
            }}
            pagination={
              contractPage
                ? {
                    current: contractPagination.page,
                    pageSize: contractPagination.pageSize,
                    total: contractPage.metadata.total,
                    showSizeChanger: true,
                  }
                : false
            }
            onChange={(pagination, _, sorter, extra) => {
              if (extra.action === 'paginate') {
                if (pagination.pageSize !== contractPagination.pageSize)
                  contractPagination.setPageSize(pagination.pageSize ?? contractPagination.pageSize);
                else contractPagination.setPage(pagination.current ?? contractPagination.page);
                return;
              }
              if (extra.action !== 'sort') return;
              const current = Array.isArray(sorter) ? sorter[0] : sorter;
              if (!current?.order) {
                setContractSort('UPDATED_AT');
                setContractDirection('DESC');
                return;
              }
              const nextSort =
                current.columnKey === 'contractNo'
                  ? 'CONTRACT_NO'
                  : current.columnKey === 'effectiveFrom'
                    ? 'EFFECTIVE_FROM'
                    : 'UPDATED_AT';
              setContractSort(nextSort);
              setContractDirection(current.order === 'ascend' ? 'ASC' : 'DESC');
            }}
            columns={[
              {
                key: 'contractNo',
                title: '合同编号',
                dataIndex: 'contractNo',
                sorter: true,
                fieldProps: {...testId('platform-contract-filter-number'), allowClear: true},
                render: (_, row) => (
                  <Button
                    type="link"
                    onClick={() => openContractDetail(row.contractRef.id)}
                    {...testId(`platform-contract-detail-${row.contractRef.id}`)}
                  >
                    {row.contractRef.code}
                  </Button>
                ),
              },
              {
                title: '门店',
                dataIndex: 'storeId',
                hideInTable: true,
                valueType: 'select',
                fieldProps: {
                  allowClear: true,
                  showSearch: {filterOption: false, onSearch: setContractStoreSearch},
                  onPopupScroll: contractStoreCandidates.onPopupScroll,
                  loading: contractStoreCandidates.isFetching,
                  options: contractStoreCandidates.items.map(item => ({
                    value: item.id,
                    label: <NameCodeText name={item.name} code={item.code} />,
                  })),
                  placeholder: '搜索门店名称或编码',
                  ...testId('platform-contract-filter-store'),
                },
              },
              {
                title: '分期',
                dataIndex: 'phaseName',
                hideInTable: true,
                fieldProps: {
                  ...testId('platform-contract-filter-phase'),
                  allowClear: true,
                  placeholder: '输入项目分期',
                },
              },
              {
                title: '经营租户',
                dataIndex: 'tenantId',
                hideInTable: true,
                valueType: 'select',
                fieldProps: {
                  allowClear: true,
                  showSearch: {filterOption: false, onSearch: setContractTenantSearch},
                  onPopupScroll: contractTenantCandidates.onPopupScroll,
                  loading: contractTenantCandidates.isFetching,
                  options: contractTenantCandidates.items.map(item => ({
                    value: item.id,
                    label: <NameCodeText name={item.name} code={item.code} />,
                  })),
                  placeholder: '搜索经营租户名称或编码',
                  ...testId('platform-contract-filter-tenant'),
                },
              },
              {
                title: '货号',
                dataIndex: 'itemCode',
                hideInTable: true,
                fieldProps: {
                  ...testId('platform-contract-filter-item-code'),
                  allowClear: true,
                  placeholder: '输入货号',
                },
              },
              {
                title: '项目',
                dataIndex: 'projectRef',
                search: false,
                render: (_, row) => <NameCodeText name={row.projectRef.name} code={row.projectRef.code} />,
              },
              {
                title: '门店',
                dataIndex: 'storeRef',
                search: false,
                render: (_, row) => <NameCodeText name={row.storeRef.name} code={row.storeRef.code} />,
              },
              {
                title: '分期',
                dataIndex: 'phaseName',
                search: false,
                render: (_, row) => row.phaseName || '未设置',
              },
              {
                title: '经营租户',
                dataIndex: 'tenantRef',
                search: false,
                render: (_, row) => <NameCodeText name={row.tenantRef.name} code={row.tenantRef.code} />,
              },
              {
                title: '起止日期',
                key: 'effectiveFrom',
                search: false,
                sorter: true,
                render: (_, row) => `${row.effectiveFrom} 至 ${row.effectiveTo ?? '长期'}`,
              },
              {
                title: '货号',
                dataIndex: 'items',
                search: false,
                render: (_, row) =>
                  row.items.length ? (
                    <Space direction="vertical" size={2}>
                      {row.items.map(item => (
                        <NameCodeText key={item.code} name={item.name} code={item.code} />
                      ))}
                    </Space>
                  ) : (
                    '—'
                  ),
              },
              {
                title: '货号数量',
                dataIndex: 'items',
                search: false,
                render: (_, row) => String(row.items?.length ?? 0),
              },
              ...extensionListAndSearchColumns<ContractOverviewItem>(
                contractDefinitionQuery.currentData,
                'platform-contract-filter-extension',
              ),
              {
                title: '状态',
                dataIndex: 'status',
                valueType: 'select',
                valueEnum: {VALID: {text: '有效'}, INVALID: {text: '已失效'}},
                fieldProps: {...testId('platform-contract-filter-status'), allowClear: true, placeholder: '全部'},
                render: (_, row) => <ValidityStatus status={row.status} />,
              },
              {
                key: 'updatedAt',
                title: '更新时间',
                dataIndex: 'updatedAt',
                sorter: true,
                search: false,
                render: (_: unknown, row: ContractOverviewItem) => formatCanonicalDateTime(row.updatedAt),
              },
            ]}
          />
        </div>
      )}
      <OrganizationOverviewDetailDrawer
        open={organizationDetail.isOpen}
        loading={organizationDetail.loading}
        problem={problem}
        item={organizationDetail.target}
        definition={organizationDefinitionQuery.currentData}
        onClose={closeOrganizationDetail}
      />
      <ContractOverviewDetailDrawer
        open={contractDetail.isOpen}
        loading={contractDetail.loading}
        problem={problem}
        item={contractDetail.target}
        definition={contractDefinitionQuery.currentData}
        onClose={closeContractDetail}
        onAudit={() =>
          contractDetail.target &&
          setAuditTarget({
            entityType: 'STORE_CONTRACT',
            entityId: contractDetail.target.contractRef.id,
            displayName: contractDetail.target.contractRef.code,
          })
        }
      />
      <PlatformAuditHistoryModal
        open={Boolean(auditTarget)}
        target={auditTarget}
        groupWorkspaceKey={groupWorkspaceKey}
        onClose={() => setAuditTarget(undefined)}
      />
    </div>
  );
}
