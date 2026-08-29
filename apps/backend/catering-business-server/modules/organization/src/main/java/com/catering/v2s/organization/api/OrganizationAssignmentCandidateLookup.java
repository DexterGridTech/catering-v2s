package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Organization-owned candidate enumeration for workspace-IAM assignment tasks. */
public interface OrganizationAssignmentCandidateLookup {
    List<AssignmentCandidate> listEnabled(UUID workspaceUuid, String groupWorkspaceKey, String serviceNodeType);

    /**
     * Platform invitation-target page with its total carried by the same bounded owner query. This is presentation data
     * only: it never grants a workspace-IAM role or command authority.
     */
    default PlatformInvitationCandidatePage platformInvitationCandidates(
            UUID workspaceUuid, String groupWorkspaceKey, PlatformInvitationCandidateQuery query) {
        throw new UnsupportedOperationException("platform invitation candidates are unavailable");
    }

    /**
     * Operations invitation candidates are scoped by the already-resolved user-management page. The scope is a
     * candidate boundary, not an authority grant, and the owner performs filtering, counting, sorting, and paging.
     */
    default OperationsInvitationCandidatePage operationsInvitationCandidates(
            UUID workspaceUuid, String groupWorkspaceKey, OperationsInvitationCandidateQuery query) {
        throw new UnsupportedOperationException("operations invitation candidates are unavailable");
    }

    /**
     * Resolves exactly one enabled invitation target for the ROLE candidate branch. The returned display path is not an
     * authority grant and cannot be used by a command.
     */
    default EnabledInvitationTarget requireEnabledInvitationTarget(
            UUID workspaceUuid, String groupWorkspaceKey, InvitationTargetRef target) {
        throw new UnsupportedOperationException("enabled invitation target is unavailable");
    }

    record AssignmentCandidate(
            String serviceNodeType,
            UUID organizationRef,
            String path,
            List<OrganizationTaskPathLookup.TaskPathNode> pathNodes) {
        public AssignmentCandidate {
            pathNodes = List.copyOf(pathNodes);
        }

        /** Legacy callers keep the old display projection until their consumer is migrated. */
        public AssignmentCandidate(String serviceNodeType, UUID organizationRef, String path) {
            this(serviceNodeType, organizationRef, path, List.of());
        }
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

    record PlatformInvitationCandidateQuery(InvitationTargetType targetType, String queryText, int page, int pageSize) {
        public PlatformInvitationCandidateQuery {
            Objects.requireNonNull(targetType, "targetType");
            if (page < 1 || pageSize < 1 || pageSize > 100)
                throw new IllegalArgumentException("invalid invitation candidate page");
        }
    }

    record PlatformInvitationCandidatePage(List<AssignmentCandidate> items, long total, int page, int pageSize) {
        public PlatformInvitationCandidatePage {
            items = List.copyOf(items);
            if (total < 0 || page < 1 || pageSize < 1 || pageSize > 100)
                throw new IllegalArgumentException("invalid invitation candidate result");
        }
    }

    record OperationsInvitationCandidateQuery(
            InvitationTargetType targetType,
            String scopeTargetType,
            UUID scopeTargetId,
            String queryText,
            int page,
            int pageSize) {
        public OperationsInvitationCandidateQuery {
            Objects.requireNonNull(targetType, "targetType");
            Objects.requireNonNull(scopeTargetType, "scopeTargetType");
            Objects.requireNonNull(scopeTargetId, "scopeTargetId");
            if (page < 1 || pageSize < 1 || pageSize > 100) {
                throw new IllegalArgumentException("invalid operations invitation candidate page");
            }
            boolean compatibleScope =
                    switch (targetType) {
                        case GROUP -> "GROUP".equals(scopeTargetType);
                        case REGION -> "REGION".equals(scopeTargetType);
                        case PROJECT -> "PROJECT".equals(scopeTargetType);
                        case HEAD_COMPANY -> "GROUP".equals(scopeTargetType) || "HEAD_COMPANY".equals(scopeTargetType);
                        case STORE -> "STORE".equals(scopeTargetType);
                    };
            if (!compatibleScope) throw new IllegalArgumentException("invalid operations invitation candidate scope");
        }

        public UUID effectiveCandidateScopeId() {
            return targetType.name().equals(scopeTargetType) ? scopeTargetId : null;
        }
    }

    record OperationsInvitationCandidatePage(List<AssignmentCandidate> items, long total, int page, int pageSize) {
        public OperationsInvitationCandidatePage {
            items = List.copyOf(items);
            if (total < 0 || page < 1 || pageSize < 1 || pageSize > 100)
                throw new IllegalArgumentException("invalid operations invitation candidate result");
        }
    }

    record EnabledInvitationTarget(InvitationTargetRef target, String displayPath) {
        public EnabledInvitationTarget {
            Objects.requireNonNull(target, "target");
            if (displayPath == null || displayPath.isBlank()) throw new IllegalArgumentException("displayPath");
        }
    }
}
