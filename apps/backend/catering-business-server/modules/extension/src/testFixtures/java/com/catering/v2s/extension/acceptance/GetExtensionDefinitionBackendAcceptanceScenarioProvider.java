package com.catering.v2s.extension.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetExtensionDefinitionBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getExtensionDefinition", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/extension/src/testFixtures/java/com/catering/v2s/extension/acceptance/GetExtensionDefinitionBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getExtensionDefinition\",\"GET\",\"/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}\",\"platform-admin\",\"extension\"]]", "apps/backend/catering-business-server/modules/extension/src/testFixtures/java/com/catering/v2s/extension/acceptance/GetExtensionDefinitionBackendAcceptanceScenarioProvider.java#cleanup");
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

