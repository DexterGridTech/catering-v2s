package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkspaceReadAuthorizationFactsTest {
    @Test
    void projectsOnlyImmutableRequestLocalAuthorizationAndVisibilityFacts() {
        UUID sessionId = UUID.randomUUID();
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        UUID regionId = UUID.randomUUID();
        var region = new OrganizationVisibilityLookup.VisibleDataNodeCandidate(
                "REGION", regionId, "Region", "R-1", List.of("Region"), regionId, null, null, null);
        var facts = new WorkspaceReadAuthorizationFacts(
                sessionId,
                workspaceId,
                "workspace-a",
                accountId,
                assignmentId,
                roleId,
                "REGION",
                regionId,
                4L,
                9L,
                "Operator",
                Set.of("page.catalog"),
                Set.of("catalog.edit"),
                new OrganizationVisibilityLookup.VisibleOrganizationFacts(
                        List.of(region), new OrganizationVisibilityLookup.ScopeContext(region, null, null, null)));

        assertEquals(sessionId, facts.sessionReadback().sessionId());
        assertEquals(regionId, facts.sessionReadback().scopeContext().region().dataNodeId());
        assertThrows(UnsupportedOperationException.class, () -> facts.pageAccessKeys()
                .add("page.other"));
        assertThrows(UnsupportedOperationException.class, () -> facts.actionCapabilityKeys()
                .add("catalog.other"));
    }
}
