package com.catering.v2s.organization.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetPlatformOrganizationHierarchyTreeBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getPlatformOrganizationHierarchyTree", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/GetPlatformOrganizationHierarchyTreeBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getPlatformOrganizationHierarchyTree\",\"GET\",\"/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy\",\"platform-admin\",\"organization\"]]", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/GetPlatformOrganizationHierarchyTreeBackendAcceptanceScenarioProvider.java#cleanup");
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

