package com.catering.v2s.platform.workspace.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class TransitionPlatformGroupWorkspaceStatusBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("transitionPlatformGroupWorkspaceStatus", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/workspace/src/testFixtures/java/com/catering/v2s/platform/workspace/acceptance/TransitionPlatformGroupWorkspaceStatusBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"transitionPlatformGroupWorkspaceStatus\",\"POST\",\"/api/platform/group-workspaces/{groupWorkspaceKey}/status\",\"platform-admin\",\"platform-workspace\"]]", "apps/backend/catering-business-server/modules/workspace/src/testFixtures/java/com/catering/v2s/platform/workspace/acceptance/TransitionPlatformGroupWorkspaceStatusBackendAcceptanceScenarioProvider.java#cleanup");
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

