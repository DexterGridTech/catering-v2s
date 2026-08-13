package com.catering.v2s.organization.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class UpdateOperationsOrganizationHeadCompanyBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("updateOperationsOrganizationHeadCompany", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/UpdateOperationsOrganizationHeadCompanyBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"updateOperationsOrganizationHeadCompany\",\"PATCH\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}\",\"operations-admin\",\"organization\"]]", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/UpdateOperationsOrganizationHeadCompanyBackendAcceptanceScenarioProvider.java#cleanup");
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

