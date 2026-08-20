package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceCapabilityRequirementCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkspaceCapabilityScopeResolverTest {
    private final UUID workspace = UUID.randomUUID();
    private final UUID assignmentId = UUID.randomUUID();
    private final UUID assignmentNode = UUID.randomUUID();

    @Test
    void mapsOrgNodeEditFromServerResolvedRegionAndCarriesOwnerAncestorPredicate() {
        UUID target = UUID.randomUUID();
        WorkspaceCapabilityScopeResolver resolver = resolver("REGION", true);
        String expectedCapability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(
                        "ORG_NODE_EDIT", "REGION")
                .orElseThrow();

        var result = resolver.resolve(
                session(Set.of(expectedCapability)),
                "ORG_NODE_EDIT",
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", target));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, result.decision());
        assertEquals(expectedCapability, result.capabilityKey());
        assertNotNull(result.firstOwnerQueryPredicate());
        assertEquals(target, result.firstOwnerQueryPredicate().resourceId());
        assertEquals(assignmentNode, result.firstOwnerQueryPredicate().assignmentNodeId());
        assertEquals(
                List.of(assignmentNode, target),
                result.firstOwnerQueryPredicate().targetAncestorIds());
    }

    @Test
    void mapsOrgNodeEditFromServerResolvedProjectAndDeniesUnsupportedType() {
        WorkspaceCapabilityScopeResolver resolver = resolver("REGION", true);
        String projectCapability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(
                        "ORG_NODE_EDIT", "PROJECT")
                .orElseThrow();

        var project = resolver.resolve(
                session(Set.of(projectCapability)),
                "ORG_NODE_EDIT",
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", UUID.randomUUID()));
        var unsupported = resolver.resolve(
                session(Set.of(projectCapability)),
                "ORG_NODE_EDIT",
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("HEAD_COMPANY", UUID.randomUUID()));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, project.decision());
        assertEquals(projectCapability, project.capabilityKey());
        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, unsupported.decision());
        assertNull(unsupported.firstOwnerQueryPredicate());
    }

    @Test
    void deniesScopeOutAndUnregisteredRequirementBeforeAnOwnerQueryCanBeBuilt() {
        String capability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey("ORG_NODE_EDIT", "REGION")
                .orElseThrow();
        var scopeOut = resolver("REGION", false)
                .resolve(
                        session(Set.of(capability)),
                        "ORG_NODE_EDIT",
                        new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", UUID.randomUUID()));
        var unknown = resolver("REGION", true)
                .resolve(
                        session(Set.of(capability)),
                        "REQ_NOT_REGISTERED",
                        new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", UUID.randomUUID()));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, scopeOut.decision());
        assertNull(scopeOut.firstOwnerQueryPredicate());
        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, unknown.decision());
        assertNull(unknown.firstOwnerQueryPredicate());
    }

    @Test
    void provesOwnerPredicateForAllFivePgIamTargetTypes() {
        for (String targetType : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            String requirement = "REQ_CREATE_OPERATIONS_WORKSPACE_" + targetType + "_INVITATION";
            String capability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirement, targetType)
                    .orElseThrow();
            UUID target = UUID.randomUUID();
            var result = resolver(targetType, true)
                    .resolve(
                            session(Set.of(capability)),
                            requirement,
                            new WorkspaceCapabilityScopeResolver.ServerResolvedResource(targetType, target));
            assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, result.decision(), targetType);
            assertEquals(targetType, result.firstOwnerQueryPredicate().resourceType(), targetType);
            assertEquals(
                    List.of(assignmentNode, target),
                    result.firstOwnerQueryPredicate().targetAncestorIds(),
                    targetType);
        }
    }

    @Test
    void allowsOnlyTheHeadCompanyCreateCapabilityForAHeadCompanyAssignmentAgainstTheOwningGroup() {
        UUID groupId = UUID.randomUUID();
        WorkspaceAssignmentScopeLookup assignments = (workspaceUuid, groupWorkspaceKey, currentAssignmentId) ->
                new WorkspaceAssignmentScopeLookup.AssignmentScope("HEAD_COMPANY", assignmentNode);
        OrganizationTaskPathLookup taskPaths = new WorkspaceTestTaskPathLookup() {
            @Override
            public TaskPath requireTaskPath(
                    UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                return new TaskPath(targetType, targetId, List.of(targetId), "Group target");
            }

            @Override
            public boolean isScopeAllowed(
                    UUID workspaceUuid, String groupWorkspaceKey, String scopeType, UUID scopeId, TaskPath target) {
                return false;
            }
        };
        WorkspaceCapabilityScopeResolver resolver = new WorkspaceCapabilityScopeResolver(assignments, taskPaths);
        String createCapability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(
                        "REQ_CREATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY", "GROUP")
                .orElseThrow();

        var allowed = resolver.resolve(
                session(Set.of(createCapability)),
                "REQ_CREATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY",
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId));
        var denied = resolver.resolve(
                session(Set.of(createCapability)),
                "REQ_CREATE_OPERATIONS_ORGANIZATION_BRAND",
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("GROUP", groupId));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, allowed.decision());
        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, denied.decision());
    }

    @Test
    void statusTransitionUsesTheExplicitPersistedTargetPathWithoutChangingTheNormalLookup() {
        UUID target = UUID.randomUUID();
        String requirement = "REQ_TRANSITION_OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS";
        String capability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirement, "HEAD_COMPANY")
                .orElseThrow();
        WorkspaceAssignmentScopeLookup assignments = (workspaceUuid, groupWorkspaceKey, currentAssignmentId) ->
                new WorkspaceAssignmentScopeLookup.AssignmentScope("GROUP", assignmentNode);
        OrganizationTaskPathLookup taskPaths = new WorkspaceTestTaskPathLookup() {
            @Override
            public TaskPath requireTaskPath(
                    UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                throw new AssertionError("normal enabled-only lookup must not authorize a status transition");
            }

            @Override
            public TaskPath requireStatusTransitionTaskPath(
                    UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                return new TaskPath(
                        targetType, targetId, List.of(assignmentNode, targetId), "persisted disabled target");
            }

            @Override
            public boolean isScopeAllowed(
                    UUID workspaceUuid, String groupWorkspaceKey, String scopeType, UUID scopeId, TaskPath path) {
                return "GROUP".equals(scopeType)
                        && assignmentNode.equals(scopeId)
                        && path.ancestorIds().contains(scopeId);
            }
        };
        WorkspaceCapabilityScopeResolver resolver = new WorkspaceCapabilityScopeResolver(assignments, taskPaths);

        var result = resolver.resolveStatusTransition(
                session(Set.of(capability)),
                requirement,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("HEAD_COMPANY", target));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, result.decision());
        assertEquals(target, result.firstOwnerQueryPredicate().resourceId());
    }

    @Test
    void disabledStoreBusinessTargetUsesItsNarrowLookupAndRejectsOtherTargetTypes() {
        UUID target = UUID.randomUUID();
        String requirement = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL";
        String capability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirement, "STORE")
                .orElseThrow();
        WorkspaceAssignmentScopeLookup assignments = (workspaceUuid, groupWorkspaceKey, currentAssignmentId) ->
                new WorkspaceAssignmentScopeLookup.AssignmentScope("STORE", assignmentNode);
        OrganizationTaskPathLookup taskPaths = new WorkspaceTestTaskPathLookup() {
            @Override
            public TaskPath requireTaskPath(
                    UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                throw new AssertionError("disabled Store command must not use enabled-only lookup");
            }

            @Override
            public TaskPath requireTaskPathAllowingDisabledTarget(
                    UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                return new TaskPath(targetType, targetId, List.of(assignmentNode, targetId), "disabled Store");
            }

            @Override
            public boolean isScopeAllowed(
                    UUID workspaceUuid, String groupWorkspaceKey, String scopeType, UUID scopeId, TaskPath path) {
                return "STORE".equals(scopeType)
                        && assignmentNode.equals(scopeId)
                        && path.ancestorIds().contains(scopeId);
            }
        };
        WorkspaceCapabilityScopeResolver resolver = new WorkspaceCapabilityScopeResolver(assignments, taskPaths);

        var allowed = resolver.resolveIncludingDisabledStoreTarget(
                session(Set.of(capability)),
                requirement,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("STORE", target));
        var denied = resolver.resolveIncludingDisabledStoreTarget(
                session(Set.of(capability)),
                requirement,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", target));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, allowed.decision());
        assertEquals(target, allowed.firstOwnerQueryPredicate().resourceId());
        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, denied.decision());
        assertNull(denied.firstOwnerQueryPredicate());
    }

    private WorkspaceCapabilityScopeResolver resolver(String assignmentType, boolean allowed) {
        WorkspaceAssignmentScopeLookup assignments = (workspaceUuid, groupWorkspaceKey, currentAssignmentId) -> {
            assertEquals(workspace, workspaceUuid);
            assertEquals("scope-test", groupWorkspaceKey);
            assertEquals(assignmentId, currentAssignmentId);
            return new WorkspaceAssignmentScopeLookup.AssignmentScope(assignmentType, assignmentNode);
        };
        OrganizationTaskPathLookup taskPaths = new WorkspaceTestTaskPathLookup() {
            @Override
            public TaskPath requireTaskPath(
                    UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                return new TaskPath(targetType, targetId, List.of(assignmentNode, targetId), targetType + " target");
            }

            @Override
            public boolean isScopeAllowed(
                    UUID workspaceUuid, String groupWorkspaceKey, String scopeType, UUID scopeId, TaskPath target) {
                return allowed
                        && assignmentType.equals(scopeType)
                        && assignmentNode.equals(scopeId)
                        && target.ancestorIds().contains(scopeId);
            }
        };
        return new WorkspaceCapabilityScopeResolver(assignments, taskPaths);
    }

    private WorkspaceSessionReadback session(Set<String> capabilities) {
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspace,
                "scope-test",
                UUID.randomUUID(),
                assignmentId,
                com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback.ScopeContext.empty(),
                1L,
                1L,
                Set.of(),
                capabilities,
                "Scope tester");
    }
}
