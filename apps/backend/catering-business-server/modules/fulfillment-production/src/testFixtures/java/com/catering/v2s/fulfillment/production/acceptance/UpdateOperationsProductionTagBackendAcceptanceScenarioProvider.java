package com.catering.v2s.fulfillment.production.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class UpdateOperationsProductionTagBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("updateOperationsProductionTag", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/fulfillment-production/src/testFixtures/java/com/catering/v2s/fulfillment/production/acceptance/UpdateOperationsProductionTagBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"updateOperationsProductionTag\",\"PATCH\",\"/operations/catalog-inventory/production-tags/{tagCode}\",\"operations-admin\",\"fulfillment-production\"]]", "apps/backend/catering-business-server/modules/fulfillment-production/src/testFixtures/java/com/catering/v2s/fulfillment/production/acceptance/UpdateOperationsProductionTagBackendAcceptanceScenarioProvider.java#cleanup");
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

