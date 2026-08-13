package com.catering.v2s.extension.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetExtensionEntityCatalogBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getExtensionEntityCatalog", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/extension/src/testFixtures/java/com/catering/v2s/extension/acceptance/GetExtensionEntityCatalogBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getExtensionEntityCatalog\",\"GET\",\"/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions\",\"platform-admin\",\"extension\"]]", "apps/backend/catering-business-server/modules/extension/src/testFixtures/java/com/catering/v2s/extension/acceptance/GetExtensionEntityCatalogBackendAcceptanceScenarioProvider.java#cleanup");
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

