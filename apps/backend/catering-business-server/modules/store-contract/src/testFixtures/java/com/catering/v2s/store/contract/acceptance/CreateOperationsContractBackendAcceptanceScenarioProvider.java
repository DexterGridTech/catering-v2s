package com.catering.v2s.store.contract.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class CreateOperationsContractBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("createOperationsContract", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/store-contract/src/testFixtures/java/com/catering/v2s/store/contract/acceptance/CreateOperationsContractBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"createOperationsContract\",\"POST\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/contracts\",\"operations-admin\",\"contract\"]]", "apps/backend/catering-business-server/modules/store-contract/src/testFixtures/java/com/catering/v2s/store/contract/acceptance/CreateOperationsContractBackendAcceptanceScenarioProvider.java#cleanup");
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

