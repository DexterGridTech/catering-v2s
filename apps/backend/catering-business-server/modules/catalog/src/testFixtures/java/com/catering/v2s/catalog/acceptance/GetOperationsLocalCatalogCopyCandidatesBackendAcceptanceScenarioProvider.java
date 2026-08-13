package com.catering.v2s.catalog.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetOperationsLocalCatalogCopyCandidatesBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getOperationsLocalCatalogCopyCandidates", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/GetOperationsLocalCatalogCopyCandidatesBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getOperationsLocalCatalogCopyCandidates\",\"GET\",\"/operations/catalog-inventory/copy/local/candidates\",\"operations-admin\",\"catalog\"]]", "apps/backend/catering-business-server/modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/GetOperationsLocalCatalogCopyCandidatesBackendAcceptanceScenarioProvider.java#cleanup");
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

