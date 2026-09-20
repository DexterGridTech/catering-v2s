import {describe, expect, it} from 'vitest';
import {assertSalesMenuL2NetworkClosure, type SalesMenuL2NetworkRow} from './sales-menu-network';

const observation = (operationId: string, status: number) => ({operationId, status});

const row: SalesMenuL2NetworkRow = {
  caseId: 'sales-menu-network-closure',
  parameter: {
    operationIds: ['getOperationsSalesMenu'],
    network: {
      required: ['getOperationsSalesMenu'],
      forbidden: ['transitionOperationsSalesMenuStatus'],
      requests: [{operationId: 'getOperationsSalesMenu', maxRequestCount: 1}],
    },
  },
};

describe('sales menu L2 network closure', () => {
  it('accepts a required successful operation', () => {
    expect(() => assertSalesMenuL2NetworkClosure(row, [observation('getOperationsSalesMenu', 200)])).not.toThrow();
  });

  it('red mutation rejects an observed forbidden operation', () => {
    expect(() =>
      assertSalesMenuL2NetworkClosure(row, [
        observation('getOperationsSalesMenu', 200),
        observation('transitionOperationsSalesMenuStatus', 204),
      ]),
    ).toThrow('SALES_MENU_L2_FORBIDDEN_OPERATION_OBSERVED');
  });

  it('red mutation rejects an expected failure without a failure status', () => {
    expect(() =>
      assertSalesMenuL2NetworkClosure(
        {
          caseId: 'sales-menu-create-failure',
          parameter: {network: {required: ['createOperationsSalesMenu']}},
        },
        [observation('createOperationsSalesMenu', 204)],
        new Set(['createOperationsSalesMenu']),
      ),
    ).toThrow('SALES_MENU_L2_EXPECTED_FAILURE_STATUS_MISSING');
  });

  it('red mutation rejects an unexpected non-success required operation', () => {
    expect(() => assertSalesMenuL2NetworkClosure(row, [observation('getOperationsSalesMenu', 500)])).toThrow(
      'SALES_MENU_L2_REQUIRED_OPERATION_NON_SUCCESS',
    );
  });

  it('red mutation rejects a request budget overflow', () => {
    expect(() =>
      assertSalesMenuL2NetworkClosure(row, [
        observation('getOperationsSalesMenu', 200),
        observation('getOperationsSalesMenu', 200),
      ]),
    ).toThrow('SALES_MENU_L2_OPERATION_REQUEST_BUDGET_EXCEEDED');
  });
});
