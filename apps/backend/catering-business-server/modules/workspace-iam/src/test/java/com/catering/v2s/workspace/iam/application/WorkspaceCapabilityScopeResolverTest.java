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
        String expectedCapability = WorkspaceCapabilityRequirementCatalog
            .resolveCapabilityKey("ORG_NODE_EDIT", "REGION")
            .orElseThrow();

        var result = resolver.resolve(session(Set.of(expectedCapability)), "ORG_NODE_EDIT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", target));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, result.decision());
        assertEquals(expectedCapability, result.capabilityKey());
        assertNotNull(result.firstOwnerQueryPredicate());
        assertEquals(target, result.firstOwnerQueryPredicate().resourceId());
        assertEquals(assignmentNode, result.firstOwnerQueryPredicate().assignmentNodeId());
        assertEquals(List.of(assignmentNode, target), result.firstOwnerQueryPredicate().targetAncestorIds());
    }

    @Test
    void mapsOrgNodeEditFromServerResolvedProjectAndDeniesUnsupportedType() {
        WorkspaceCapabilityScopeResolver resolver = resolver("REGION", true);
        String projectCapability = WorkspaceCapabilityRequirementCatalog
            .resolveCapabilityKey("ORG_NODE_EDIT", "PROJECT")
            .orElseThrow();

        var project = resolver.resolve(session(Set.of(projectCapability)), "ORG_NODE_EDIT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", UUID.randomUUID()));
        var unsupported = resolver.resolve(session(Set.of(projectCapability)), "ORG_NODE_EDIT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("HEAD_COMPANY", UUID.randomUUID()));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, project.decision());
        assertEquals(projectCapability, project.capabilityKey());
        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, unsupported.decision());
        assertNull(unsupported.firstOwnerQueryPredicate());
    }

    @Test
    void deniesScopeOutAndUnregisteredRequirementBeforeAnOwnerQueryCanBeBuilt() {
        String capability = WorkspaceCapabilityRequirementCatalog
            .resolveCapabilityKey("ORG_NODE_EDIT", "REGION")
            .orElseThrow();
        var scopeOut = resolver("REGION", false).resolve(session(Set.of(capability)), "ORG_NODE_EDIT", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", UUID.randomUUID()));
        var unknown = resolver("REGION", true).resolve(session(Set.of(capability)), "REQ_NOT_REGISTERED", new WorkspaceCapabilityScopeResolver.ServerResolvedResource("REGION", UUID.randomUUID()));

        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, scopeOut.decision());
        assertNull(scopeOut.firstOwnerQueryPredicate());
        assertEquals(WorkspaceCapabilityScopeResolver.Decision.DENY, unknown.decision());
        assertNull(unknown.firstOwnerQueryPredicate());
    }

    @Test
    void provesOwnerPredicateForAllFivePgIamTargetTypes() {
        for (String targetType : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            String requirement = "REQ_CREATE_OPERATIONS_WORKSPACE_" + targetType + "_INVITATION";
            String capability = WorkspaceCapabilityRequirementCatalog.resolveCapabilityKey(requirement, targetType).orElseThrow();
            UUID target = UUID.randomUUID();
            var result = resolver(targetType, true).resolve(session(Set.of(capability)), requirement, new WorkspaceCapabilityScopeResolver.ServerResolvedResource(targetType, target));
            assertEquals(WorkspaceCapabilityScopeResolver.Decision.ALLOW, result.decision(), targetType);
            assertEquals(targetType, result.firstOwnerQueryPredicate().resourceType(), targetType);
            assertEquals(List.of(assignmentNode, target), result.firstOwnerQueryPredicate().targetAncestorIds(), targetType);
        }
    }

    private WorkspaceCapabilityScopeResolver resolver(String assignmentType, boolean allowed) {
        WorkspaceAssignmentScopeLookup assignments = (workspaceUuid, groupWorkspaceKey, currentAssignmentId) -> {
            assertEquals(workspace, workspaceUuid);
            assertEquals("scope-test", groupWorkspaceKey);
            assertEquals(assignmentId, currentAssignmentId);
            return new WorkspaceAssignmentScopeLookup.AssignmentScope(assignmentType, assignmentNode);
        };
        OrganizationTaskPathLookup taskPaths = new OrganizationTaskPathLookup() {
            @Override public TaskPath requireTaskPath(UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID targetId) {
                return new TaskPath(targetType, targetId, List.of(assignmentNode, targetId), targetType + " target");
            }
            @Override public boolean isScopeAllowed(UUID workspaceUuid, String groupWorkspaceKey, String scopeType, UUID scopeId, TaskPath target) {
                return allowed && assignmentType.equals(scopeType) && assignmentNode.equals(scopeId) && target.ancestorIds().contains(scopeId);
            }
        };
        return new WorkspaceCapabilityScopeResolver(assignments, taskPaths);
    }

    private WorkspaceSessionReadback session(Set<String> capabilities) {
        return new WorkspaceSessionReadback(UUID.randomUUID(), workspace, "scope-test", UUID.randomUUID(), assignmentId, null, 1L, 1L, Set.of(), capabilities, "Scope tester");
    }
}
