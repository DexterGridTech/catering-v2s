package com.catering.v2s.catalog.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class ExecuteOperationsLocalCatalogCopyBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("executeOperationsLocalCatalogCopy", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/ExecuteOperationsLocalCatalogCopyBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"executeOperationsLocalCatalogCopy\",\"POST\",\"/operations/catalog-inventory/copy/local/execute\",\"operations-admin\",\"catalog\"]]", "apps/backend/catering-business-server/modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/ExecuteOperationsLocalCatalogCopyBackendAcceptanceScenarioProvider.java#cleanup");
    }

    private record DeclaredScenario(
            String operationId,
            String namespaceOwnership,
            String requestBuilder,
            String businessOracle,
            String performanceCriterion,
            String cleanup) implements Scenario {
    }
}

