import {
  collectCursorPages,
  type DescriptorOption,
  type DescriptorOptionSource,
  type DescriptorTreeNode,
} from '@catering-v2s/admin-ui-foundation';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogInventoryOperationId,
  type CatalogDictionaryView,
  type CatalogShapeManifestView,
  type InventoryTargetPage,
  type ProductionTagPage,
  type Uuid,
} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryClient} from '../../../app/api/OperationsTransport';
import {wireUuid} from '../../../app/api/wireUuid';

export const CATALOG_OPTION_OPERATION_IDS = [
  CATALOG_INVENTORY_OPERATION_IDS.getOperationsCatalogNavigation,
  CATALOG_INVENTORY_OPERATION_IDS.getOperationsCatalogDictionary,
  CATALOG_INVENTORY_OPERATION_IDS.getOperationsInventoryTargets,
  CATALOG_INVENTORY_OPERATION_IDS.getOperationsCatalogItem,
  CATALOG_INVENTORY_OPERATION_IDS.getOperationsProductionTags,
  CATALOG_INVENTORY_OPERATION_IDS.listOperationsCatalogAttributeDefinitions,
  CATALOG_INVENTORY_OPERATION_IDS.listOperationsCatalogOrderOptionDefinitions,
] as const satisfies readonly CatalogInventoryOperationId[];

export type CatalogOptionOperationId = (typeof CATALOG_OPTION_OPERATION_IDS)[number];
export type CatalogFieldRuntimeContext = {
  scope: {dataNodeRef: Uuid; brandRef?: string};
  readField: (fieldKeyOrPath: string) => unknown;
  readSection: (sectionPath: string) => unknown;
  sectionRevision: (sectionPath: string) => string | number;
};
export type CatalogCandidateRow = Record<string, unknown>;
export type CatalogCandidateOptionResult = {
  fingerprint: string;
  options: DescriptorOption[];
  rows: CatalogCandidateRow[];
  treeData: DescriptorTreeNode[];
  stale: boolean;
};
type EndpointSource = DescriptorOptionSource & {kind: 'endpoint'; operationId: CatalogOptionOperationId};
type CandidateExecutor = (source: EndpointSource, context: CatalogFieldRuntimeContext) => Promise<unknown>;
const CURSOR_OPTION_PAGE_SIZE = 50;

export function assertCatalogOptionBindingSet(manifest: Pick<CatalogShapeManifestView, 'fields'>): void {
  const discovered = new Set(
    manifest.fields
      .map(field => field.optionSourceRef)
      .filter(
        (source): source is NonNullable<CatalogShapeManifestView['fields'][number]['optionSourceRef']> =>
          source?.kind === 'endpoint',
      )
      .map(source => source.operationId)
      .filter((operationId): operationId is string => Boolean(operationId)),
  );
  const registered = new Set<string>(CATALOG_OPTION_OPERATION_IDS);
  if (discovered.size !== registered.size || [...discovered].some(operationId => !registered.has(operationId))) {
    throw new Error(`CATALOG_OPTION_OPERATION_BINDING_SET_MISMATCH:${[...discovered].sort().join(',')}`);
  }
}

export function catalogFieldFingerprint(source: DescriptorOptionSource, context: CatalogFieldRuntimeContext): string {
  const bindings = Object.fromEntries(
    Object.entries(source.contextBindings ?? {}).map(([key, value]) => [key, resolveBindingValue(value, context)]),
  );
  return JSON.stringify(
    sortValue({
      operationId: source.operationId ?? source.kind,
      path: resolveRecord(source.path, context),
      query: resolveRecord(source.query, context),
      headers: resolveRecord(source.headers, context),
      bindings,
      sectionRevision: context.sectionRevision(source.sectionPath ?? '*'),
      scope: context.scope,
    }),
  );
}

export function missingCatalogContextBindings(
  source: DescriptorOptionSource,
  context: CatalogFieldRuntimeContext,
): string[] {
  return Object.entries(source.contextBindings ?? {})
    .filter(([, binding]) => {
      const value = resolveBindingValue(binding, context);
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    })
    .map(([key]) => key);
}

export function createCatalogOptionResolver(
  execute: CandidateExecutor = executeCatalogEndpoint,
): (source: DescriptorOptionSource, context: CatalogFieldRuntimeContext) => Promise<CatalogCandidateOptionResult> {
  let latestToken = 0;
  return async (source, context) => {
    const fingerprint = catalogFieldFingerprint(source, context);
    const token = ++latestToken;
    if (missingCatalogContextBindings(source, context).length > 0) {
      return {fingerprint, options: [], rows: [], treeData: [], stale: false};
    }
    if (source.kind === 'local') {
      const rows = resolveSectionRows(source, context);
      const stale = token !== latestToken;
      return {
        fingerprint,
        options: stale ? [] : mapCandidateRows(rows, source),
        rows: stale ? [] : rows,
        treeData: stale ? [] : mapCandidateTree(rows, source),
        stale,
      };
    }
    if (source.kind !== 'endpoint' || !source.operationId) throw new Error('CATALOG_OPTION_SOURCE_ENDPOINT_REQUIRED');
    const response = await execute(source as EndpointSource, context);
    const stillCurrent = token === latestToken && fingerprint === catalogFieldFingerprint(source, context);
    const rows = readPath(response, source.itemsPath ?? '');
    const candidateRows = arrayRows(rows);
    return {
      fingerprint,
      options: stillCurrent ? mapCandidateRows(candidateRows, source) : [],
      rows: stillCurrent ? candidateRows : [],
      treeData: stillCurrent ? mapCandidateTree(candidateRows, source) : [],
      stale: !stillCurrent,
    };
  };
}

export const catalogOptionResolver = createCatalogOptionResolver();

async function collectCatalogCursorResponse<Response, Item>({
  firstResponse,
  readPage,
  getItems,
  getCursor,
  getTotal,
  replace,
  keyOf,
}: {
  firstResponse: Response;
  readPage: (cursor: string | undefined, pageSize: number) => Promise<Response>;
  getItems: (response: Response) => readonly Item[];
  getCursor: (response: Response) => string | null | undefined;
  getTotal: (response: Response) => number | null | undefined;
  replace: (response: Response, items: Item[], total: number) => Response;
  keyOf: (item: Item) => string;
}): Promise<Response> {
  const collected = await collectCursorPages({
    initialPage: {
      items: getItems(firstResponse),
      nextCursor: getCursor(firstResponse),
      total: getTotal(firstResponse),
      pageSize: CURSOR_OPTION_PAGE_SIZE,
    },
    readPage: async (cursor, pageSize) => {
      const response = await readPage(cursor, pageSize);
      return {
        items: getItems(response),
        nextCursor: getCursor(response),
        total: getTotal(response),
        pageSize,
      };
    },
    pageSize: CURSOR_OPTION_PAGE_SIZE,
    keyOf,
  });
  return replace(firstResponse, collected.items, collected.total);
}

async function executeCatalogEndpoint(source: EndpointSource, context: CatalogFieldRuntimeContext): Promise<unknown> {
  const path = resolveRecord(source.path, context);
  const query = resolveRecord(source.query, context);
  const headers = resolveHeaders(source.headers, context);
  switch (source.operationId) {
    case CATALOG_INVENTORY_OPERATION_IDS.getOperationsCatalogNavigation:
      return catalogInventoryClient.getOperationsCatalogNavigation(
        {},
        {query: {dataNodeRef: context.scope.dataNodeRef, viewKey: String(query.viewKey ?? 'ALL')}, headers},
      );
    case CATALOG_INVENTORY_OPERATION_IDS.getOperationsCatalogDictionary: {
      const readPage = (cursor?: string, pageSize = CURSOR_OPTION_PAGE_SIZE) =>
        catalogInventoryClient.getOperationsCatalogDictionary(
          {dictionaryKind: String(path.dictionaryKind ?? '')},
          {
            query: {
              dataNodeRef: context.scope.dataNodeRef,
              ...(query.parentEntryRef ? {parentEntryRef: wireUuid(String(query.parentEntryRef))} : {}),
              ...(cursor ? {cursor} : {}),
              pageSize,
            },
            headers,
          },
        );
      const firstResponse = await readPage();
      return collectCatalogCursorResponse<CatalogDictionaryView, CatalogDictionaryView['data']['entries'][number]>({
        firstResponse,
        readPage,
        getItems: response => response.data.entries,
        getCursor: response => response.data.cursor,
        getTotal: response => response.data.total,
        replace: (response, items, total) => ({
          ...response,
          data: {...response.data, entries: items, cursor: '', total},
        }),
        keyOf: entry => String(entry.entryRef),
      });
    }
    case CATALOG_INVENTORY_OPERATION_IDS.getOperationsInventoryTargets: {
      const readPage = (cursor?: string, pageSize = CURSOR_OPTION_PAGE_SIZE) =>
        catalogInventoryClient.getOperationsInventoryTargets(
          {},
          {
            query: {
              dataNodeRef: context.scope.dataNodeRef,
              ...(cursor ? {cursor} : {}),
              pageSize,
            },
            headers,
          },
        );
      const firstResponse = await readPage();
      return collectCatalogCursorResponse<InventoryTargetPage, InventoryTargetPage['data']['items'][number]>({
        firstResponse,
        readPage,
        getItems: response => response.data.items,
        getCursor: response => response.data.cursor,
        getTotal: response => response.data.total,
        replace: (response, items, total) => ({
          ...response,
          data: {...response.data, items, cursor: '', total},
        }),
        keyOf: item => String(item.targetRef),
      });
    }
    case CATALOG_INVENTORY_OPERATION_IDS.getOperationsCatalogItem:
      return catalogInventoryClient.getOperationsCatalogItem(
        {itemCode: String(path.itemCode ?? '')},
        {query: {dataNodeRef: context.scope.dataNodeRef}, headers},
      );
    case CATALOG_INVENTORY_OPERATION_IDS.getOperationsProductionTags: {
      const readPage = (cursor?: string, pageSize = CURSOR_OPTION_PAGE_SIZE) =>
        catalogInventoryClient.getOperationsProductionTags(
          {},
          {
            query: {
              dataNodeRef: context.scope.dataNodeRef,
              usage: 'BINDABLE_CANDIDATE',
              ...(cursor ? {cursor} : {}),
              pageSize,
            },
            headers,
          },
        );
      const firstResponse = await readPage();
      return collectCatalogCursorResponse<ProductionTagPage, ProductionTagPage['data']['entries'][number]>({
        firstResponse,
        readPage,
        getItems: response => response.data.entries,
        getCursor: response => response.data.cursor,
        getTotal: response => response.data.total,
        replace: (response, items, total) => ({
          ...response,
          data: {...response.data, entries: items, cursor: '', total},
        }),
        keyOf: tag => String(tag.tagRef),
      });
    }
    case CATALOG_INVENTORY_OPERATION_IDS.listOperationsCatalogAttributeDefinitions:
      return catalogInventoryClient.listOperationsCatalogAttributeDefinitions(
        {},
        {query: {dataNodeRef: context.scope.dataNodeRef}, headers},
      );
    case CATALOG_INVENTORY_OPERATION_IDS.listOperationsCatalogOrderOptionDefinitions:
      return catalogInventoryClient.listOperationsCatalogOrderOptionDefinitions(
        {},
        {query: {dataNodeRef: context.scope.dataNodeRef}, headers},
      );
    default:
      return assertNeverCatalogOperation(source.operationId);
  }
}

function assertNeverCatalogOperation(operationId: never): never {
  throw new Error(`CATALOG_OPTION_OPERATION_UNBOUND:${String(operationId)}`);
}

function resolveSectionRows(
  source: DescriptorOptionSource,
  context: CatalogFieldRuntimeContext,
): CatalogCandidateRow[] {
  if (!source.sectionPath) throw new Error('CATALOG_LOCAL_OPTION_SECTION_REQUIRED');
  const value = context.readSection(source.sectionPath);
  return flattenSectionRows(value, source.valueField);
}

function flattenSectionRows(value: unknown, valueField?: string): CatalogCandidateRow[] {
  if (Array.isArray(value)) return value.flatMap(entry => flattenSectionRows(entry, valueField));
  const row = candidateRow(value);
  if (!row) return [];
  if (!valueField || Object.prototype.hasOwnProperty.call(row, valueField)) return [row];
  return Object.values(row).flatMap(entry => flattenSectionRows(entry, valueField));
}

function arrayRows(value: unknown): CatalogCandidateRow[] {
  return Array.isArray(value)
    ? value.flatMap(entry => {
        const row = candidateRow(entry);
        return row ? [row] : [];
      })
    : [];
}

function mapCandidateRows(value: unknown, source: DescriptorOptionSource): DescriptorOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    const row = candidateRow(entry);
    const option = row ? mapCandidateOption(row, source) : undefined;
    return option ? [option] : [];
  });
}

export function mapCandidateTree(value: unknown, source: DescriptorOptionSource): DescriptorTreeNode[] {
  if (!source.parentField || !Array.isArray(value)) return [];
  const candidates = value.flatMap(entry => {
    const row = candidateRow(entry);
    const option = row ? mapCandidateOption(row, source) : undefined;
    if (!row || !option) return [];
    const parentValue = row[source.parentField!];
    return [
      {
        option,
        parentValue:
          parentValue === null || parentValue === undefined || parentValue === '' ? undefined : String(parentValue),
      },
    ];
  });
  const nodes = new Map<string, DescriptorTreeNode>();
  for (const candidate of candidates) {
    nodes.set(candidate.option.value, {
      key: candidate.option.value,
      value: candidate.option.value,
      title: candidate.option.label,
      disabled: candidate.option.disabled,
    });
  }
  const roots: DescriptorTreeNode[] = [];
  for (const candidate of candidates) {
    const node = nodes.get(candidate.option.value);
    if (!node) continue;
    const parent = candidate.parentValue ? nodes.get(candidate.parentValue) : undefined;
    if (parent && parent !== node) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function candidateRow(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function mapCandidateOption(
  row: Record<string, unknown>,
  source: DescriptorOptionSource,
): DescriptorOption | undefined {
  const rawValue = source.valueField ? row[source.valueField] : undefined;
  if (rawValue === undefined || rawValue === null || rawValue === '') return undefined;
  const label = source.labelParts?.length
    ? source.labelParts
        .map(part => row[part])
        .filter(part => part !== undefined && part !== null && part !== '')
        .map(String)
        .join(' · ')
    : String(source.labelField ? (row[source.labelField] ?? rawValue) : rawValue);
  return {
    value: String(rawValue),
    label: label || String(rawValue),
    disabled: matchesDisabledWhen(row, source.disabledWhen),
  };
}

function matchesDisabledWhen(row: Record<string, unknown>, expression: string | null | undefined): boolean {
  if (!expression) return false;
  const match = expression.match(/^([A-Za-z0-9_]+)<>["'](.*)["']$/);
  return Boolean(match && row[match[1]] !== match[2]);
}

function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === undefined || current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function resolveRecord(
  value: Record<string, unknown> | undefined,
  context: CatalogFieldRuntimeContext,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value ?? {}).map(([key, entry]) => [key, resolveBindingValue(entry, context)]),
  );
}

function resolveHeaders(
  value: Record<string, unknown> | undefined,
  context: CatalogFieldRuntimeContext,
): {'X-Workspace-Brand-Ref'?: string} | undefined {
  const resolved = resolveRecord(value, context);
  const brandRef =
    typeof resolved['X-Workspace-Brand-Ref'] === 'string' ? resolved['X-Workspace-Brand-Ref'] : context.scope.brandRef;
  return brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined;
}

function resolveBindingValue(value: unknown, context: CatalogFieldRuntimeContext): unknown {
  if (Array.isArray(value)) return value.map(entry => resolveBindingValue(entry, context));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.context === 'string') {
    if (record.context === 'scope.dataNodeRef') return context.scope.dataNodeRef;
    if (record.context === 'scope.brandRef') return context.scope.brandRef;
    return context.readField(record.context);
  }
  if (typeof record.fieldKey === 'string') return context.readField(record.fieldKey);
  return resolveRecord(record, context);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}
