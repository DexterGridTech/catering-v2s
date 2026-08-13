package com.catering.v2s.platform.admin.iam.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class ChangeCurrentPlatformPasswordBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("changeCurrentPlatformPassword", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/ChangeCurrentPlatformPasswordBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"changeCurrentPlatformPassword\",\"POST\",\"/api/platform/auth/password\",\"platform-admin\",\"platform-iam\"]]", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/ChangeCurrentPlatformPasswordBackendAcceptanceScenarioProvider.java#cleanup");
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

