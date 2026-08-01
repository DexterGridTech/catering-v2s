package com.catering.v2s.organization.api;

import java.util.List;
import java.util.UUID;

/** Organization-owned candidate enumeration for workspace-IAM assignment tasks. */
public interface OrganizationAssignmentCandidateLookup {
    List<AssignmentCandidate> listEnabled(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String serviceNodeType
    );

    record AssignmentCandidate(String serviceNodeType, UUID organizationRef, String path) {
    }
}
