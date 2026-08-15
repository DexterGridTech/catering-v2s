import {
  operationsClient,
  operationsProblemOf,
  type ApiProblem,
} from '../../../app/api/OperationsTransport';
import type {BrandPage, HeadCompany} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';

type OperationsClient = typeof operationsClient;

export type HeadCompanyBrandAuthorizationContext = {
  groupWorkspaceKey: string;
  expectedContextVersion: number;
  headCompanyId: string;
};

export type HeadCompanyBrandAuthorizationResult =
  | {kind: 'readback'; headCompany: HeadCompany; replayed: boolean}
  | {kind: 'failure'; errorCode: ApiProblem['errorCode']};

type BrandAuthorizationIntent = {
  brandId: string;
  idempotencyKey: string;
};

/**
 * The sole nonvisual command boundary for the IA04 per-brand authorization task.
 * It has no cache or UI state: owner detail remains the only visible membership truth.
 */
export class HeadCompanyBrandAuthorizationActionAdapter {
  constructor(private readonly client: OperationsClient = operationsClient) {}

  searchEnabledBrands(
    context: Pick<HeadCompanyBrandAuthorizationContext, 'groupWorkspaceKey' | 'expectedContextVersion'>,
    queryText: string | undefined,
    page = 1,
    pageSize = 20,
  ): Promise<BrandPage> {
    return this.client.getOperationsOrganizationBrands(
      {groupWorkspaceKey: context.groupWorkspaceKey},
      {
        query: {
          expectedContextVersion: context.expectedContextVersion,
          queryText: queryText?.trim() || undefined,
          status: 'ENABLED',
          page,
          pageSize,
        },
      },
    );
  }

  add(context: HeadCompanyBrandAuthorizationContext, intent: BrandAuthorizationIntent) {
    return this.execute(context, intent, 'add');
  }

  remove(context: HeadCompanyBrandAuthorizationContext, intent: BrandAuthorizationIntent) {
    return this.execute(context, intent, 'remove');
  }

  private async execute(
    context: HeadCompanyBrandAuthorizationContext,
    intent: BrandAuthorizationIntent,
    action: 'add' | 'remove',
  ): Promise<HeadCompanyBrandAuthorizationResult> {
    try {
      await this.command(context, intent, action);
      return {kind: 'readback', headCompany: await this.readDetail(context), replayed: false};
    } catch (error) {
      const failure = operationsProblemOf(error);
      if (!isUnknownOutcome(failure.errorCode)) return {kind: 'failure', errorCode: failure.errorCode};

      let afterUnknown: HeadCompany;
      try {
        afterUnknown = await this.readDetail(context);
      } catch (readError) {
        return {kind: 'failure', errorCode: operationsProblemOf(readError).errorCode};
      }
      if (membershipMatches(afterUnknown, intent.brandId, action)) {
        return {kind: 'readback', headCompany: afterUnknown, replayed: false};
      }

      try {
        await this.command(context, intent, action);
        return {kind: 'readback', headCompany: await this.readDetail(context), replayed: true};
      } catch (replayError) {
        return {kind: 'failure', errorCode: operationsProblemOf(replayError).errorCode};
      }
    }
  }

  private readDetail(context: HeadCompanyBrandAuthorizationContext) {
    return this.client.getOperationsOrganizationHeadCompany(
      {groupWorkspaceKey: context.groupWorkspaceKey, headCompanyId: context.headCompanyId},
      {query: {expectedContextVersion: context.expectedContextVersion}},
    );
  }

  private command(
    context: HeadCompanyBrandAuthorizationContext,
    intent: BrandAuthorizationIntent,
    action: 'add' | 'remove',
  ) {
    const path = {groupWorkspaceKey: context.groupWorkspaceKey, headCompanyId: context.headCompanyId};
    const headers = {'Idempotency-Key': intent.idempotencyKey};
    return action === 'add'
      ? this.client.addOperationsOrganizationHeadCompanyBrandAuthorization(path, {body: {brandId: wireUuid(intent.brandId)}, headers})
      : this.client.removeOperationsOrganizationHeadCompanyBrandAuthorization({...path, brandId: wireUuid(intent.brandId)}, {headers});
  }
}

function membershipMatches(headCompany: HeadCompany, brandId: string, action: 'add' | 'remove') {
  const present = headCompany.authorizedBrands.some((brand) => brand.id === brandId);
  return action === 'add' ? present : !present;
}

function isUnknownOutcome(errorCode: ApiProblem['errorCode']) {
  return errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN' || errorCode === 'NETWORK_ERROR';
}
