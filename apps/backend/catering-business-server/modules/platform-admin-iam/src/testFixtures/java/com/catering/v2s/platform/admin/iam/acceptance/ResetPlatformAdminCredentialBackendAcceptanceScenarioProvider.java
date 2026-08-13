package com.catering.v2s.platform.admin.iam.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class ResetPlatformAdminCredentialBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("resetPlatformAdminCredential", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/ResetPlatformAdminCredentialBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"resetPlatformAdminCredential\",\"POST\",\"/api/platform/admin-users/{platformAdminId}/credential-reset\",\"platform-admin\",\"platform-iam\"]]", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/ResetPlatformAdminCredentialBackendAcceptanceScenarioProvider.java#cleanup");
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

