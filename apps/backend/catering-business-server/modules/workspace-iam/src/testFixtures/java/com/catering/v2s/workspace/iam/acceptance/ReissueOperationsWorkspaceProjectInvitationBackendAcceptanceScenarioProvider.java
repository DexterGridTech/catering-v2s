package com.catering.v2s.workspace.iam.acceptance;

import com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider;

/** Source-bound scenario declaration generated from the admitted backend-acceptance registry. */
public final class ReissueOperationsWorkspaceProjectInvitationBackendAcceptanceScenarioProvider implements BackendAcceptanceScenarioProvider {
    @Override
    public Scenario scenario() {
        return new DeclaredScenario("reissueOperationsWorkspaceProjectInvitation", "RUN_SCOPED", "GENERATED_OPERATION_REQUEST_BUILDER", "apps/backend/catering-business-server/modules/workspace-iam/src/testFixtures/java/com/catering/v2s/workspace/iam/acceptance/ReissueOperationsWorkspaceProjectInvitationBackendAcceptanceScenarioProvider.java#businessOracle", "contracts/registry/backend-acceptance-accepted-baseline.json#operations[identityKey=[\"reissueOperationsWorkspaceProjectInvitation\",\"POST\",\"/api/operations/group-workspaces/{groupWorkspaceKey}/user-management/project/invitations/{invitationId}/reissue\",\"operations-admin\",\"workspace-iam\"]]", "apps/backend/catering-business-server/modules/workspace-iam/src/testFixtures/java/com/catering/v2s/workspace/iam/acceptance/ReissueOperationsWorkspaceProjectInvitationBackendAcceptanceScenarioProvider.java#cleanup");
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

