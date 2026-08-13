package com.catering.v2s.catalog.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class UpdateOperationsCatalogDictionaryEntryBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("updateOperationsCatalogDictionaryEntry", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/UpdateOperationsCatalogDictionaryEntryBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"updateOperationsCatalogDictionaryEntry\",\"PATCH\",\"/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}\",\"operations-admin\",\"catalog\"]]", "apps/backend/catering-business-server/modules/catalog/src/testFixtures/java/com/catering/v2s/catalog/acceptance/UpdateOperationsCatalogDictionaryEntryBackendAcceptanceScenarioProvider.java#cleanup");
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

