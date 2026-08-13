package com.catering.v2s.platform.admin.iam.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetPlatformAdminDetailBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getPlatformAdminDetail", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/GetPlatformAdminDetailBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getPlatformAdminDetail\",\"GET\",\"/api/platform/admin-users/{platformAdminId}\",\"platform-admin\",\"platform-iam\"]]", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/GetPlatformAdminDetailBackendAcceptanceScenarioProvider.java#cleanup");
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

