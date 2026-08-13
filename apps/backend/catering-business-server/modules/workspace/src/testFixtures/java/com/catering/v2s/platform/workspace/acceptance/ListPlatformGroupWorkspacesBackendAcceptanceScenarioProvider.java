package com.catering.v2s.platform.workspace.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class ListPlatformGroupWorkspacesBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("listPlatformGroupWorkspaces", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/workspace/src/testFixtures/java/com/catering/v2s/platform/workspace/acceptance/ListPlatformGroupWorkspacesBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"listPlatformGroupWorkspaces\",\"GET\",\"/api/platform/group-workspaces\",\"platform-admin\",\"platform-workspace\"]]", "apps/backend/catering-business-server/modules/workspace/src/testFixtures/java/com/catering/v2s/platform/workspace/acceptance/ListPlatformGroupWorkspacesBackendAcceptanceScenarioProvider.java#cleanup");
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

