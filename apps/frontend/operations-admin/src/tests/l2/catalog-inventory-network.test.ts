import {describe, expect, it} from 'vitest';
import {assertCatalogL2NetworkClosure, type CatalogL2NetworkRow} from './catalog-inventory-network';

const observation = (operationId: string, status: number) => ({
  operationId,
  method: 'GET',
  routeTemplate: `/operations/${operationId}`,
  pathname: `/operations/${operationId}`,
  status,
});

const row: CatalogL2NetworkRow = {
  caseId: 'catalog-governance-failure',
  parameter: {
    network: {
      required: ['getOperationsCatalogItem'],
      forbidden: ['transitionOperationsCatalogItemStatus'],
      requests: [{operationId: 'getOperationsCatalogItem', maxRequestCount: 1}],
    },
  },
};

describe('catalog L2 network closure', () => {
  it('accepts a required successful read with no forbidden operation', () => {
    expect(() => assertCatalogL2NetworkClosure(row, [observation('getOperationsCatalogItem', 200)])).not.toThrow();
  });

  it('red mutation rejects an observed forbidden lifecycle operation', () => {
    expect(() =>
      assertCatalogL2NetworkClosure(row, [
        observation('getOperationsCatalogItem', 200),
        observation('transitionOperationsCatalogItemStatus', 204),
      ]),
    ).toThrow('CATALOG_INVENTORY_L2_FORBIDDEN_OPERATION_OBSERVED');
  });

  it('red mutation rejects an expected failure that did not return a failure status', () => {
    expect(() =>
      assertCatalogL2NetworkClosure(
        {
          caseId: 'catalog-create-failure',
          parameter: {
            network: {
              required: ['createOperationsCatalogItem'],
              requests: [{operationId: 'createOperationsCatalogItem', maxRequestCount: 1}],
            },
          },
        },
        [observation('createOperationsCatalogItem', 204)],
        new Set(['createOperationsCatalogItem']),
      ),
    ).toThrow('CATALOG_INVENTORY_L2_EXPECTED_FAILURE_STATUS_MISSING');
  });

  it('red mutation rejects an unexpected non-success required operation', () => {
    expect(() => assertCatalogL2NetworkClosure(row, [observation('getOperationsCatalogItem', 500)])).toThrow(
      'CATALOG_INVENTORY_L2_REQUIRED_OPERATION_NON_SUCCESS',
    );
  });
});
