package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Organization-owned candidate enumeration for workspace-IAM assignment tasks. */
public interface OrganizationAssignmentCandidateLookup {
    List<AssignmentCandidate> listEnabled(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String serviceNodeType
    );

    /**
     * Platform invitation-target page with its total carried by the same bounded owner query.
     * This is presentation data only: it never grants a workspace-IAM role or command authority.
     */
    default PlatformInvitationCandidatePage platformInvitationCandidates(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        PlatformInvitationCandidateQuery query
    ) {
        throw new UnsupportedOperationException("platform invitation candidates are unavailable");
    }

    /**
     * Resolves exactly one enabled invitation target for the ROLE candidate branch.
     * The returned display path is not an authority grant and cannot be used by a command.
     */
    default EnabledInvitationTarget requireEnabledInvitationTarget(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        InvitationTargetRef target
    ) {
        throw new UnsupportedOperationException("enabled invitation target is unavailable");
    }

    record AssignmentCandidate(String serviceNodeType, UUID organizationRef, String path) {
    }

    enum InvitationTargetType {
        GROUP,
        REGION,
        PROJECT,
        HEAD_COMPANY,
        STORE
    }

    record InvitationTargetRef(InvitationTargetType targetType, UUID targetId) {
        public InvitationTargetRef {
            Objects.requireNonNull(targetType, "targetType");
            Objects.requireNonNull(targetId, "targetId");
        }
    }

    record PlatformInvitationCandidateQuery(
        InvitationTargetType targetType,
        String queryText,
        int page,
        int pageSize
    ) {
        public PlatformInvitationCandidateQuery {
            Objects.requireNonNull(targetType, "targetType");
            if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid invitation candidate page");
        }
    }

    record PlatformInvitationCandidatePage(List<AssignmentCandidate> items, long total, int page, int pageSize) {
        public PlatformInvitationCandidatePage {
            items = List.copyOf(items);
            if (total < 0 || page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid invitation candidate result");
        }
    }

    record EnabledInvitationTarget(InvitationTargetRef target, String displayPath) {
        public EnabledInvitationTarget {
            Objects.requireNonNull(target, "target");
            if (displayPath == null || displayPath.isBlank()) throw new IllegalArgumentException("displayPath");
        }
    }
}
