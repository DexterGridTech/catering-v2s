package com.catering.v2s.inventory.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetOperationsInventoryTargetConsumptionReferencesBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getOperationsInventoryTargetConsumptionReferences", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/inventory/src/testFixtures/java/com/catering/v2s/inventory/acceptance/GetOperationsInventoryTargetConsumptionReferencesBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getOperationsInventoryTargetConsumptionReferences\",\"GET\",\"/operations/catalog-inventory/inventory-targets/{targetRef}/consumption-references\",\"operations-admin\",\"inventory\"]]", "apps/backend/catering-business-server/modules/inventory/src/testFixtures/java/com/catering/v2s/inventory/acceptance/GetOperationsInventoryTargetConsumptionReferencesBackendAcceptanceScenarioProvider.java#cleanup");
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

