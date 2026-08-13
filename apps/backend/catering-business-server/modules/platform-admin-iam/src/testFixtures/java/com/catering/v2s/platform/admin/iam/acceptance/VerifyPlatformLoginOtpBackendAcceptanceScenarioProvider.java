package com.catering.v2s.platform.admin.iam.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class VerifyPlatformLoginOtpBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("verifyPlatformLoginOtp", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/VerifyPlatformLoginOtpBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"verifyPlatformLoginOtp\",\"POST\",\"/api/platform/auth/login-otp/verify\",\"platform-admin\",\"platform-iam\"]]", "apps/backend/catering-business-server/modules/platform-admin-iam/src/testFixtures/java/com/catering/v2s/platform/admin/iam/acceptance/VerifyPlatformLoginOtpBackendAcceptanceScenarioProvider.java#cleanup");
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

