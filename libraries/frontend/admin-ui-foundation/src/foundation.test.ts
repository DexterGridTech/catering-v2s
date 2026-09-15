import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement, type ReactElement, type ReactNode} from 'react';
import {platformHttpProtocol} from './http/platformHttpProtocol';
import {contextScopedQueryArgs} from './list/contextScopedQueryArgs';
import {updateDirtyRegistrations, updateOpenRegistrations} from './overlay/overlayLock';
import {
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  adminWideDetailDescriptionsProps,
  adminWideDrawerSurfaceProps,
} from './overlay/drawerSurface';
import {createAsyncGenerationGuard} from './behavior/asyncGeneration';
import {AdminErrorBoundary} from './behavior/AdminErrorBoundary';
import {createRefreshSignal} from './behavior/refreshSignal';
import {serializeJsonOrMultipartBody} from './http/wireRequestBody';
import {adminListState} from './list/adminListState';
import {formatCodeNamePath, formatNameCode, NameCodePathText, NameCodeText} from './presentation/nameCode';
import {activeInvitationPageUrl} from './presentation/activeInvitationPageUrl';
import {EllipsisTooltip} from './presentation/EllipsisTooltip';
import {ValidityStatus} from './presentation/validityStatus';
import {closedCodeLabel, isKnownClosedCode} from './presentation/closedCode';
import {wireUuid} from './http/wireUuid';
import {MOBILE_PATTERN} from './validation/mobilePattern';
import {collectCursorPages, mergeCursorCandidateItems} from './list/useCursorCandidates';
import {updateCursorStack} from './list/useCursorStack';
import {
  createExtensionFilterRecoveryState,
  createExtensionFilterStaleRecoveryGate,
  isExtensionDefinitionRevisionAtLeast,
} from './extension/staleRecovery';
import {
  ExtensionFilterInvalidSummary,
  formatExtensionFilterInvalidFields,
  readExtensionFilterInvalidFields,
} from './extension/invalidFilter';
import {CursorPagination} from './list/cursorPagination';
import {createContentIdempotencyKey, digestFileContent} from './behavior/contentIdempotencyKey';
import {
  createCursorQueryIdentity,
  createPageQueryIdentity,
  isCurrentQueryIdentity,
  normalizePage,
  normalizePageSize,
} from './list/usePageQuery';

describe('admin UI foundation contract and lifecycle primitives', () => {
  it('claims stale extension recovery once per scope while allowing a new scope', () => {
    const gate = createExtensionFilterStaleRecoveryGate();
    expect(gate.claim('brand:aurora', 2)).toBe(true);
    expect(gate.claim('brand:aurora', 2)).toBe(false);
    expect(gate.claim('brand:aurora', 3)).toBe(false);
    expect(gate.claim('tenant:aurora', 2)).toBe(true);
    expect(gate.claim('brand:aurora')).toBe(false);
    expect(gate.claim('brand:aurora')).toBe(false);
  });

  it('requires a usable definition revision at or above the stale lower bound', () => {
    expect(isExtensionDefinitionRevisionAtLeast({revision: 2}, 2)).toBe(true);
    expect(isExtensionDefinitionRevisionAtLeast({revision: 3}, 2)).toBe(true);
    expect(isExtensionDefinitionRevisionAtLeast({revision: 1}, 2)).toBe(false);
    expect(isExtensionDefinitionRevisionAtLeast(undefined, 2)).toBe(false);
    expect(isExtensionDefinitionRevisionAtLeast({revision: 2}, undefined)).toBe(false);
  });

  it('keeps the stale lower bound for manual retry and drops late callbacks after invalidation', () => {
    const recovery = createExtensionFilterRecoveryState();
    recovery.enterScope('organization:brand');
    recovery.rememberStaleRevision('organization:brand', 7);

    const automatic = recovery.begin('organization:brand', 7);
    expect(automatic.expectedRevision).toBe(7);
    recovery.invalidate('organization:brand');
    expect(recovery.isCurrent(automatic)).toBe(false);

    const manual = recovery.begin('organization:brand');
    expect(manual.expectedRevision).toBe(7);
    expect(recovery.isCurrent(manual)).toBe(true);

    recovery.rememberStaleRevision('organization:brand', 8);
    const retryAfterAnotherStale = recovery.begin('organization:brand');
    expect(retryAfterAnotherStale.expectedRevision).toBe(8);
    expect(recovery.isCurrent(manual)).toBe(false);

    recovery.enterScope('organization:tenant');
    expect(recovery.isCurrent(retryAfterAnotherStale)).toBe(false);
  });

  it('sanitizes invalid extension-filter details and maps them to field-scoped feedback', () => {
    const invalidFields = readExtensionFilterInvalidFields({
      invalidFields: [
        {fieldKey: 'brandLevel', reason: 'FIELD_DISABLED', expectedType: 'TEXT'},
        {fieldKey: 'missingKey', reason: 'UNKNOWN_FIELD_KEY'},
      ],
    });
    expect(invalidFields).toEqual([
      {fieldKey: 'brandLevel', reason: 'FIELD_DISABLED', expectedType: 'TEXT'},
      {fieldKey: 'missingKey', reason: 'UNKNOWN_FIELD_KEY', expectedType: undefined},
    ]);
    expect(formatExtensionFilterInvalidFields(invalidFields, [{key: 'brandLevel', label: '品牌等级'}])).toEqual([
      '品牌等级：字段已停用',
      '筛选条件：字段不存在或已被移除',
    ]);
    const reasonLabels: Record<string, string> = {
      DEFINITION_REVISION_REQUIRED: '缺少字段配置版本，请刷新字段配置',
      DEFINITION_REVISION_INVALID: '字段配置版本无效，请刷新字段配置',
      PERCENT_DECODE_INVALID: '筛选参数编码无效，请重试',
      QUERY_TOO_LONG: '筛选条件过长，请减少条件后重试',
      NUMBER_INVALID: '数字格式不正确',
      DATE_INVALID: '日期格式不正确',
      BOOLEAN_INVALID: '布尔值格式不正确',
    };
    const unscoped = readExtensionFilterInvalidFields({
      invalidFields: Object.keys(reasonLabels).map(reason => ({reason})),
    });
    expect(unscoped?.every(field => field.fieldKey === '')).toBe(true);
    expect(formatExtensionFilterInvalidFields(unscoped, undefined)).toEqual(
      Object.values(reasonLabels).map(label => `筛选条件：${label}`),
    );
    const markup = renderToStaticMarkup(
      createElement(ExtensionFilterInvalidSummary, {
        invalidFields,
        definitions: [{key: 'brandLevel', label: '品牌等级'}],
        testIdPrefix: 'extension-invalid-summary',
        onClear: () => undefined,
      }),
    );
    expect(markup).toContain('品牌等级：字段已停用');
    expect(markup).toContain('清理失效筛选');
    expect(markup).toContain('extension-invalid-summary-clear');
    expect(markup).not.toContain('brandLevel');
  });

  it('renders unknown closed-set values visibly and reports them as not actionable', () => {
    const labels = {ENABLED: '启用', DISABLED: '停用'} as const;
    expect(closedCodeLabel(labels, 'MYSTERY')).toBe('当前状态无法识别');
    expect(isKnownClosedCode(labels, 'MYSTERY')).toBe(false);
    expect(closedCodeLabel(labels, 'ENABLED')).toBe('启用');
    expect(isKnownClosedCode(labels, 'ENABLED')).toBe(true);
  });

  it('accepts only actual UUID values at generated-wire boundaries', () => {
    expect(wireUuid('00000000-0000-4000-8000-000000000001')).toBe('00000000-0000-4000-8000-000000000001');
    expect(() => wireUuid('CATALOG-001')).toThrow('WIRE_UUID_REQUIRED');
    expect(() => wireUuid('')).toThrow('WIRE_UUID_REQUIRED');
  });

  it('shares one mainland mobile validation pattern across admin forms', () => {
    expect(MOBILE_PATTERN.test('13812345678')).toBe(true);
    expect(MOBILE_PATTERN.test('1381234567')).toBe(false);
    expect(MOBILE_PATTERN.test('23812345678')).toBe(false);
  });

  it('derives set-value idempotency keys from operation and canonical JSON content', async () => {
    const first = await createContentIdempotencyKey('saveOperationsCatalogItem', {
      name: '河畔茶里',
      attributes: {b: 2, a: 1},
    });
    const sameContent = await createContentIdempotencyKey('saveOperationsCatalogItem', {
      attributes: {a: 1, b: 2},
      name: '河畔茶里',
    });
    const changedPayload = await createContentIdempotencyKey('saveOperationsCatalogItem', {
      name: '河畔茶里',
      attributes: {a: 2, b: 2},
    });
    const changedOperation = await createContentIdempotencyKey('createOperationsCatalogItem', {
      name: '河畔茶里',
      attributes: {a: 1, b: 2},
    });
    expect(first).toBe(sameContent);
    expect(first).not.toBe(changedPayload);
    expect(first).not.toBe(changedOperation);
    expect(first).toMatch(/^ui-content-[0-9a-f]{64}$/);
    await expect(createContentIdempotencyKey('saveOperationsCatalogItem', {value: new Date()})).rejects.toThrow(
      'IDEMPOTENCY_PAYLOAD_NOT_JSON',
    );
  });

  it('derives binary content digests for multipart idempotency projections', async () => {
    await expect(digestFileContent(new Blob(['hello']))).resolves.toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('moves cursor pages by truncating known history and appending only the owner cursor', () => {
    expect(updateCursorStack(['', 'cursor-2', 'cursor-3'], 1)).toEqual(['']);
    expect(updateCursorStack(['', 'cursor-2'], 3)).toEqual(['', 'cursor-2']);
    expect(updateCursorStack(['', 'cursor-2'], 3, 'cursor-3')).toEqual(['', 'cursor-2', 'cursor-3']);
  });

  it('renders sequential cursor controls without exposing arbitrary page jumps', () => {
    const markup = renderToStaticMarkup(
      createElement(CursorPagination, {
        state: {page: 2, canPrevious: true, goToPage: () => undefined},
        nextCursor: 'cursor-3',
        testIdPrefix: 'cursor-surface-pagination',
      }),
    );
    expect(markup).toContain('上一页');
    expect(markup).toContain('第 2 页');
    expect(markup).toContain('下一页');
    expect(markup).toContain('data-testid="cursor-surface-pagination"');
  });

  it('accumulates candidate pages without duplicate options', () => {
    const keyOf = (item: {id: string}) => item.id;
    expect(mergeCursorCandidateItems([{id: 'a'}, {id: 'b'}], [{id: 'b'}, {id: 'c'}], keyOf)).toEqual([
      {id: 'a'},
      {id: 'b'},
      {id: 'c'},
    ]);
  });

  it('collects cursor pages to completion, deduplicates rows, and preserves the full total', async () => {
    const calls: Array<{cursor?: string; pageSize: number}> = [];
    const pages = new Map<string | undefined, {items: Array<{id: string}>; cursor?: string; total: number}>([
      [undefined, {items: [{id: 'a'}, {id: 'b'}], cursor: 'next-2', total: 3}],
      ['next-2', {items: [{id: 'b'}, {id: 'c'}], total: 3}],
    ]);
    await expect(
      collectCursorPages<{id: string}>({
        pageSize: 2,
        keyOf: item => item.id,
        readPage: async (cursor, requestedPageSize) => {
          calls.push({cursor, pageSize: requestedPageSize});
          const page = pages.get(cursor);
          if (!page) throw new Error('missing test page');
          return {items: page.items, nextCursor: page.cursor, total: page.total};
        },
      }),
    ).resolves.toEqual({
      items: [{id: 'a'}, {id: 'b'}, {id: 'c'}],
      total: 3,
      pageSize: 2,
      pageCount: 2,
    });
    expect(calls).toEqual([
      {cursor: undefined, pageSize: 2},
      {cursor: 'next-2', pageSize: 2},
    ]);
  });

  it('fails closed when a cursor endpoint returns a continuation loop', async () => {
    await expect(
      collectCursorPages<string>({
        keyOf: item => item,
        readPage: async cursor => ({items: [cursor ?? 'first'], nextCursor: cursor ?? 'loop', total: 2}),
      }),
    ).rejects.toThrow('CURSOR_PAGE_LOOP');
  });

  it('builds a page identity from operation, scope, filters, sort, page, and page size', () => {
    const first = createPageQueryIdentity({
      operationId: 'getWorkspaceAccounts',
      scope: {workspace: 'workspace-a'},
      filters: {name: 'a', status: 'ACTIVE'},
      sort: [{field: 'name', order: 'ascend'}],
      page: 2,
      pageSize: 10,
    });
    const sameValuesDifferentObjectOrder = createPageQueryIdentity({
      operationId: 'getWorkspaceAccounts',
      scope: {workspace: 'workspace-a'},
      filters: {status: 'ACTIVE', name: 'a'},
      sort: [{field: 'name', order: 'ascend'}],
      page: 2,
      pageSize: 10,
    });
    expect(first).toBe(sameValuesDifferentObjectOrder);
    expect(first).not.toBe(createPageQueryIdentity({...JSON.parse(first), page: 1}));
  });

  it('resets page navigation when page size changes or a query identity changes', () => {
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(2.9)).toBe(2);
    expect(normalizePageSize(0)).toBe(1);
    const first = createPageQueryIdentity({operationId: 'list', scope: 'a', page: 3, pageSize: 20});
    const second = createPageQueryIdentity({operationId: 'list', scope: 'a', page: 1, pageSize: 50});
    expect(first).not.toBe(second);
  });

  it('keeps cursor identity separate from arbitrary page identity', () => {
    const cursor = createCursorQueryIdentity({operationId: 'list', scope: 'a', cursor: 'opaque-2', pageSize: 20});
    const page = createPageQueryIdentity({operationId: 'list', scope: 'a', page: 2, pageSize: 20});
    expect(cursor).not.toBe(page);
    expect(cursor).toContain('"mode":"cursor"');
  });

  it('rejects an old response after a newer query identity becomes current', () => {
    const oldQuery = createPageQueryIdentity({operationId: 'list', scope: 'a', page: 1, pageSize: 10});
    const newQuery = createPageQueryIdentity({operationId: 'list', scope: 'b', page: 1, pageSize: 10});
    expect(isCurrentQueryIdentity(oldQuery, newQuery)).toBe(false);
    expect(isCurrentQueryIdentity(newQuery, newQuery)).toBe(true);
  });

  it('renders a business name and code in the shared 名称(编码) form without inventing missing values', () => {
    expect(formatNameCode('极光商业集团', 'AURORA-GROUP')).toBe('极光商业集团(AURORA-GROUP)');
    expect(formatNameCode('极光商业集团', undefined)).toBe('极光商业集团');
    expect(formatNameCode(undefined, 'AURORA-GROUP')).toBe('AURORA-GROUP');
  });

  it('renders the code as a smaller tertiary visual while preserving owner path segments', () => {
    const display = renderToStaticMarkup(createElement(NameCodeText, {name: '河畔项目', code: 'RIVER'}));
    const emphasized = renderToStaticMarkup(
      createElement(NameCodeText, {name: '河畔项目', code: 'RIVER', emphasizeName: true}),
    );
    expect(display).toContain('河畔项目');
    expect(display).toContain('(RIVER)');
    expect(display).toContain('font-size:var(--ant-font-size-sm)');
    expect(display).toContain('color:var(--ant-color-text-tertiary)');
    expect(display).not.toContain('font-weight');
    expect(emphasized).toContain('font-weight:600');
    const path = renderToStaticMarkup(createElement(NameCodePathText, {value: 'EAST 东区 / RIVER 河畔项目'}));
    expect(path).toContain('东区');
    expect(path).toContain('(EAST)');
    expect(path).toContain('河畔项目');
    expect(path).toContain('(RIVER)');
    const structuredPath = renderToStaticMarkup(
      createElement(NameCodePathText, {
        nodes: [
          {ref: 'region-ref', code: 'EAST', name: '东区', nodeType: 'REGION'},
          {ref: 'project-ref', code: 'RIVER', name: '河畔项目', nodeType: 'PROJECT'},
        ],
      }),
    );
    expect(structuredPath).toContain('东区');
    expect(structuredPath).toContain('(EAST)');
    expect(structuredPath).toContain('河畔项目');
    expect(structuredPath).toContain('(RIVER)');
    expect(
      renderToStaticMarkup(
        createElement(NameCodePathText, {
          nodes: [{ref: 'missing-name', code: 'HIDDEN', name: '', nodeType: 'STORE'}],
        }),
      ),
    ).not.toContain('HIDDEN');
  });
  it('renders owner task paths segment by segment without rewriting malformed transport values', () => {
    expect(formatCodeNamePath('EAST 东区 / RIVER 河畔项目 / S-OP 河畔茶里店')).toBe(
      '东区(EAST) / 河畔项目(RIVER) / 河畔茶里店(S-OP)',
    );
    expect(formatCodeNamePath('无编码路径')).toBe('无编码路径');
  });

  it('renders contract validity with the shared dot-and-text vocabulary', () => {
    const valid = renderToStaticMarkup(createElement(ValidityStatus, {status: 'VALID'}));
    const invalid = renderToStaticMarkup(createElement(ValidityStatus, {status: 'INVALID'}));
    const missing = renderToStaticMarkup(createElement(ValidityStatus, {status: undefined}));
    expect(valid).toContain('ant-badge-status-processing');
    expect(valid).toContain('有效');
    expect(invalid).toContain('ant-badge-status-default');
    expect(invalid).toContain('已失效');
    expect(missing).toContain('—');
  });

  it('keeps complete human-readable text attached to an authored truncation boundary', () => {
    const tooltip = EllipsisTooltip({
      title: '东区(EAST) / 河畔项目(RIVER)',
      children: createElement('span', null, '东区(EAST) / 河畔项目(RIV...)'),
    }) as ReactElement<{title: ReactNode}>;
    expect(tooltip.props.title).toBe('东区(EAST) / 河畔项目(RIVER)');
  });

  it('exposes an invitation link only while the workspace-IAM owner reports it ACTIVE', () => {
    expect(
      activeInvitationPageUrl({
        status: 'ACTIVE',
        routeFacts: {groupWorkspaceKey: 'aurora group', invitationToken: 'token/one'},
      }),
    ).toBe('/operations/invitations/aurora%20group/token%2Fone');
    expect(
      activeInvitationPageUrl({status: 'ACTIVE', routeFacts: {groupWorkspaceKey: ' ', invitationToken: 'token'}}),
    ).toBeUndefined();
    for (const status of ['CANCELLED', 'EXPIRED', 'COMPLETED', 'UNKNOWN']) {
      expect(activeInvitationPageUrl({status})).toBeUndefined();
    }
    expect(activeInvitationPageUrl({status: 'ACTIVE'})).toBeUndefined();
  });
  it('exposes the generated shared HTTP protocol without local aliases', () => {
    expect(platformHttpProtocol.CORRELATION_ID).toBeTruthy();
    expect(platformHttpProtocol.REQUEST_ID).toBeTruthy();
    expect(new Set(Object.values(platformHttpProtocol)).size).toBe(Object.keys(platformHttpProtocol).length);
  });

  it('keeps server cache arguments scoped by the owner-confirmed context', () => {
    expect(
      contextScopedQueryArgs(
        {page: 2},
        {groupWorkspaceKey: 'space-a', identityKey: 'assignment-a', expectedContextVersion: 7},
      ),
    ).toEqual({page: 2, groupWorkspaceKey: 'space-a', identityKey: 'assignment-a', expectedContextVersion: 7});
  });

  it('holds the shell lock until every registered overlay closes', () => {
    const first = updateOpenRegistrations(new Set(), 'drawer-a', true);
    const both = updateOpenRegistrations(first, 'modal-b', true);
    const secondOnly = updateOpenRegistrations(both, 'drawer-a', false);
    expect([...secondOnly]).toEqual(['modal-b']);
    expect(updateOpenRegistrations(secondOnly, 'modal-b', false).size).toBe(0);
    expect(updateOpenRegistrations(secondOnly, 'modal-b', true)).toBe(secondOnly);
  });

  it('keeps a separate dirty-form lock so shell switches stay blocked until drafts are resolved', () => {
    const first = updateDirtyRegistrations(new Set(), 'form-a', true);
    const both = updateDirtyRegistrations(first, 'form-b', true);
    const secondOnly = updateDirtyRegistrations(both, 'form-a', false);
    expect([...secondOnly]).toEqual(['form-b']);
    expect(updateDirtyRegistrations(secondOnly, 'form-b', false).size).toBe(0);
    expect(updateDirtyRegistrations(secondOnly, 'form-b', true)).toBe(secondOnly);
  });

  it('freezes the cross-admin Drawer surface contract', () => {
    expect(adminDrawerSurfaceProps.styles?.body?.overflowY).toBe('auto');
    expect(adminDrawerSurfaceProps.styles?.body?.minHeight).toBe(0);
    expect(adminDrawerSurfaceProps.styles?.footer?.justifyContent).toBe('flex-end');
    expect(adminDrawerSurfaceProps.styles?.footer?.position).toBe('sticky');
  });

  it('freezes the compact single-column fact table used by persistent admin detail Drawers', () => {
    expect(adminDetailDescriptionsProps).toMatchObject({
      bordered: true,
      size: 'small',
      column: 1,
      styles: {label: {width: 164}},
    });
  });

  it('freezes the wide two-column catalog/inventory detail surface', () => {
    expect(adminWideDrawerSurfaceProps.width).toBe('min(1024px, calc(100vw - 48px))');
    expect(adminWideDetailDescriptionsProps).toMatchObject({
      bordered: true,
      size: 'small',
      column: 2,
      styles: {label: {width: 164}},
    });
  });

  it('rejects a late async response after a newer request generation begins', () => {
    const guard = createAsyncGenerationGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    guard.invalidate();
    expect(guard.isCurrent(second)).toBe(false);
  });

  it('normalizes a thrown non-Error value before rendering recovery UI', () => {
    const state = AdminErrorBoundary.getDerivedStateFromError({title: 'untyped transport failure'});
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('Unexpected UI error');
  });

  it('notifies each app-owned read model exactly once after a successful write', () => {
    const signal = createRefreshSignal();
    let notifications = 0;
    const unsubscribe = signal.subscribe(() => {
      notifications += 1;
    });
    const before = signal.snapshot();
    signal.publish();
    expect(signal.snapshot()).toBe(before + 1);
    expect(notifications).toBe(1);
    unsubscribe();
    signal.publish();
    expect(notifications).toBe(1);
  });

  it('uses JSON media type for generated JSON bodies while preserving multipart and explicit headers', () => {
    const jsonHeaders = new Headers();
    expect(serializeJsonOrMultipartBody({name: 'Aurora'}, jsonHeaders)).toBe('{"name":"Aurora"}');
    expect(jsonHeaders.get('Content-Type')).toBe('application/json');
    const explicitHeaders = new Headers({'Content-Type': 'application/problem+json'});
    serializeJsonOrMultipartBody({name: 'Aurora'}, explicitHeaders);
    expect(explicitHeaders.get('Content-Type')).toBe('application/problem+json');
    const multipartHeaders = new Headers();
    expect(
      serializeJsonOrMultipartBody({file: new Blob(['x'], {type: 'text/plain'})}, multipartHeaders),
    ).toBeInstanceOf(FormData);
    expect(multipartHeaders.has('Content-Type')).toBe(false);
  });

  it('keeps loading, failure and empty table states mutually exclusive and locatable', () => {
    const loading = adminListState({loading: true, failed: false, emptyText: '暂无记录', testIdPrefix: 'example-list'});
    const failed = adminListState({loading: false, failed: true, emptyText: '暂无记录', testIdPrefix: 'example-list'});
    const empty = adminListState({loading: false, failed: false, emptyText: '暂无记录', testIdPrefix: 'example-list'});
    expect(loading.loading).toMatchObject({spinning: true});
    expect(loading.locale.emptyText).toBeNull();
    expect(failed.loading).toBe(false);
    expect(failed.locale.emptyText).toBeNull();
    expect(empty.locale.emptyText).toBeTruthy();
  });
});
