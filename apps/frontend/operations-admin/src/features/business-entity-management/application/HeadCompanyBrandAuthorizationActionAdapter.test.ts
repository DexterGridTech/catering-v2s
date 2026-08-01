import {describe, expect, it, vi} from 'vitest';
import {ApiFailure} from '../../../app/api/OperationsTransport';
import type {HeadCompany} from '../../../app/api/generated/operations-edge';
import {HeadCompanyBrandAuthorizationActionAdapter} from './HeadCompanyBrandAuthorizationActionAdapter';

const context = {groupWorkspaceKey: 'group-a', expectedContextVersion: 7, headCompanyId: 'head-company-a'};
const detail = (brandIds: string[]): HeadCompany => ({
  id: context.headCompanyId,
  groupWorkspaceKey: context.groupWorkspaceKey,
  code: 'HEAD-A',
  name: '总公司 A',
  legalName: '总公司 A',
  unifiedSocialCreditCode: '913100000000000001',
  authorizedBrands: brandIds.map((id) => ({id, code: id, name: id, status: 'ENABLED'})),
  extensionValues: {},
  extensionRuleRevision: 1,
  status: 'ENABLED',
  revision: 3,
  createdAt: 1,
  updatedAt: 1,
});

function api(overrides: Record<string, unknown> = {}) {
  return {
    getOperationsOrganizationHeadCompany: vi.fn(async () => detail([])),
    getOperationsOrganizationBrands: vi.fn(),
    addOperationsOrganizationHeadCompanyBrandAuthorization: vi.fn(async () => undefined),
    removeOperationsOrganizationHeadCompanyBrandAuthorization: vi.fn(async () => undefined),
    ...overrides,
  } as any;
}

describe('HeadCompanyBrandAuthorizationActionAdapter', () => {
  it('uses one generated add command and replaces visible truth with fresh owner detail', async () => {
    const client = api({getOperationsOrganizationHeadCompany: vi.fn(async () => detail(['brand-a']))});
    const result = await new HeadCompanyBrandAuthorizationActionAdapter(client).add(context, {brandId: 'brand-a', idempotencyKey: 'intent-a'});

    expect(result).toEqual({kind: 'readback', headCompany: detail(['brand-a']), replayed: false});
    expect(client.addOperationsOrganizationHeadCompanyBrandAuthorization).toHaveBeenCalledTimes(1);
    expect(client.addOperationsOrganizationHeadCompanyBrandAuthorization).toHaveBeenCalledWith(
      {groupWorkspaceKey: 'group-a', headCompanyId: 'head-company-a'},
      {body: {brandId: 'brand-a'}, headers: {'Idempotency-Key': 'intent-a'}},
    );
  });

  it('replays exactly once with the same key only after an unknown add remains absent in fresh owner detail', async () => {
    const add = vi.fn()
      .mockRejectedValueOnce(new ApiFailure({type: 'about:blank', title: 'unknown', status: 0, detail: 'unknown', errorCode: 'PLATFORM_COMMON_RESULT_UNKNOWN', correlationId: 'c'}))
      .mockResolvedValueOnce(undefined);
    const getDetail = vi.fn()
      .mockResolvedValueOnce(detail([]))
      .mockResolvedValueOnce(detail(['brand-a']));
    const client = api({addOperationsOrganizationHeadCompanyBrandAuthorization: add, getOperationsOrganizationHeadCompany: getDetail});

    const result = await new HeadCompanyBrandAuthorizationActionAdapter(client).add(context, {brandId: 'brand-a', idempotencyKey: 'intent-a'});

    expect(result).toEqual({kind: 'readback', headCompany: detail(['brand-a']), replayed: true});
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[1].headers['Idempotency-Key'])).toEqual(['intent-a', 'intent-a']);
  });

  it('keeps the owner-confirmed view and never replays a determined in-use conflict', async () => {
    const remove = vi.fn().mockRejectedValue(new ApiFailure({type: 'about:blank', title: 'conflict', status: 409, detail: 'safe', errorCode: 'ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE', correlationId: 'c'}));
    const client = api({removeOperationsOrganizationHeadCompanyBrandAuthorization: remove});

    const result = await new HeadCompanyBrandAuthorizationActionAdapter(client).remove(context, {brandId: 'brand-a', idempotencyKey: 'intent-b'});

    expect(result).toEqual({kind: 'failure', errorCode: 'ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE'});
    expect(remove).toHaveBeenCalledTimes(1);
    expect(client.getOperationsOrganizationHeadCompany).not.toHaveBeenCalled();
  });
});
