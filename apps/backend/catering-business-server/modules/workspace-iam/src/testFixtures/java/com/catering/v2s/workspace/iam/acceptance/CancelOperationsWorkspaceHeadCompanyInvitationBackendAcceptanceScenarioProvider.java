package com.catering.v2s.workspace.iam.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class CancelOperationsWorkspaceHeadCompanyInvitationBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("cancelOperationsWorkspaceHeadCompanyInvitation", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/workspace-iam/src/testFixtures/java/com/catering/v2s/workspace/iam/acceptance/CancelOperationsWorkspaceHeadCompanyInvitationBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"cancelOperationsWorkspaceHeadCompanyInvitation\",\"POST\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/head-company/invitations/{invitationId}/cancel\",\"operations-admin\",\"workspace-iam\"]]", "apps/backend/catering-business-server/modules/workspace-iam/src/testFixtures/java/com/catering/v2s/workspace/iam/acceptance/CancelOperationsWorkspaceHeadCompanyInvitationBackendAcceptanceScenarioProvider.java#cleanup");
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

