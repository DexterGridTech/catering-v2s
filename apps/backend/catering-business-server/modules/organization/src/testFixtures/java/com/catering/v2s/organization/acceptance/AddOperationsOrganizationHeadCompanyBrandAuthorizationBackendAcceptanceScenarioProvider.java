package com.catering.v2s.organization.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class AddOperationsOrganizationHeadCompanyBrandAuthorizationBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("addOperationsOrganizationHeadCompanyBrandAuthorization", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/AddOperationsOrganizationHeadCompanyBrandAuthorizationBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"addOperationsOrganizationHeadCompanyBrandAuthorization\",\"POST\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations\",\"operations-admin\",\"organization\"]]", "apps/backend/catering-business-server/modules/organization/src/testFixtures/java/com/catering/v2s/organization/acceptance/AddOperationsOrganizationHeadCompanyBrandAuthorizationBackendAcceptanceScenarioProvider.java#cleanup");
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

