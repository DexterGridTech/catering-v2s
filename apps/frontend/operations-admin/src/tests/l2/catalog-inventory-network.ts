export type CatalogL2NetworkRequestBudget = {
  operationId: string;
  maxRequestCount: number;
};

export type CatalogL2NetworkDeclaration = {
  required?: string[];
  forbidden?: string[];
  backgroundAllowed?: string[];
  requests?: CatalogL2NetworkRequestBudget[];
};

export type CatalogL2NetworkObservation = {
  operationId: string;
  method: string;
  routeTemplate: string;
  pathname: string;
  status: number;
};

export type CatalogL2NetworkRow = {
  caseId: string;
  parameter: {
    operationIds?: string[];
    network?: CatalogL2NetworkDeclaration;
  };
};

export function assertCatalogL2NetworkClosure(
  row: CatalogL2NetworkRow,
  observations: readonly CatalogL2NetworkObservation[],
  expectedFailureOperationIds: ReadonlySet<string> = new Set(),
): void {
  const network = row.parameter.network ?? {};
  const required = new Set(network.required ?? row.parameter.operationIds ?? []);
  const backgroundAllowed = new Set(network.backgroundAllowed ?? []);
  const forbidden = new Set(network.forbidden ?? []);
  const declared = new Set([...required, ...backgroundAllowed, ...(row.parameter.operationIds ?? [])]);
  const byOperation = new Map<string, CatalogL2NetworkObservation[]>();

  for (const observation of observations) {
    const entries = byOperation.get(observation.operationId) ?? [];
    entries.push(observation);
    byOperation.set(observation.operationId, entries);
    if (forbidden.has(observation.operationId))
      throw new Error(`CATALOG_INVENTORY_L2_FORBIDDEN_OPERATION_OBSERVED:${row.caseId}:${observation.operationId}`);
    if (!declared.has(observation.operationId))
      throw new Error(`CATALOG_INVENTORY_L2_UNDECLARED_OPERATION_OBSERVED:${row.caseId}:${observation.operationId}`);
  }

  for (const operationId of required) {
    const entries = byOperation.get(operationId) ?? [];
    if (entries.length === 0)
      throw new Error(`CATALOG_INVENTORY_L2_REQUIRED_OPERATION_MISSING:${row.caseId}:${operationId}`);
    const hasSuccess = entries.some(entry => entry.status >= 200 && entry.status < 300);
    const hasFailure = entries.some(entry => entry.status >= 400 && entry.status < 600);
    const expectedFailure = expectedFailureOperationIds.has(operationId);
    if (!hasSuccess && !expectedFailure)
      throw new Error(
        `CATALOG_INVENTORY_L2_REQUIRED_OPERATION_NON_SUCCESS:${row.caseId}:${operationId}:${entries
          .map(entry => entry.status)
          .join(',')}`,
      );
    if (expectedFailure && !hasFailure)
      throw new Error(`CATALOG_INVENTORY_L2_EXPECTED_FAILURE_STATUS_MISSING:${row.caseId}:${operationId}`);
  }

  for (const budget of network.requests ?? []) {
    const count = byOperation.get(budget.operationId)?.length ?? 0;
    if (count > budget.maxRequestCount)
      throw new Error(
        `CATALOG_INVENTORY_L2_OPERATION_REQUEST_BUDGET_EXCEEDED:${row.caseId}:${budget.operationId}:${count}`,
      );
  }
}
