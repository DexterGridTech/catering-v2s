package com.catering.v2s.store.contract.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class GetOperationsContractExtensionDefinitionBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("getOperationsContractExtensionDefinition", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/store-contract/src/testFixtures/java/com/catering/v2s/store/contract/acceptance/GetOperationsContractExtensionDefinitionBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"getOperationsContractExtensionDefinition\",\"GET\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/contracts/extension-definition\",\"operations-admin\",\"contract\"]]", "apps/backend/catering-business-server/modules/store-contract/src/testFixtures/java/com/catering/v2s/store/contract/acceptance/GetOperationsContractExtensionDefinitionBackendAcceptanceScenarioProvider.java#cleanup");
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

