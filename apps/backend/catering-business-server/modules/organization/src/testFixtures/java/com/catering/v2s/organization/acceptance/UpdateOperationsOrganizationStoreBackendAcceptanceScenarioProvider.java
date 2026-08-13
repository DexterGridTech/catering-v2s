package com.catering.v2s.organization.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class UpdateOperationsOrganizationStoreBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("updateOperationsOrganizationStore", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/UpdateOperationsOrganizationStoreBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"updateOperationsOrganizationStore\",\"PATCH\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}\",\"operations-admin\",\"organization\"]]", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/UpdateOperationsOrganizationStoreBackendAcceptanceScenarioProvider.java#cleanup");
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

