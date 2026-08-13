package com.catering.v2s.platform.asset.acceptance;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class StagePlatformAssetBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("stagePlatformAsset", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/asset/src/testFixtures/java/com/catering/v2s/platform/asset/acceptance/StagePlatformAssetBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"stagePlatformAsset\",\"POST\",\"/api/platform/assets/staging\",\"platform-admin\",\"platform-asset\"]]", "apps/backend/catering-business-server/modules/asset/src/testFixtures/java/com/catering/v2s/platform/asset/acceptance/StagePlatformAssetBackendAcceptanceScenarioProvider.java#cleanup");
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

