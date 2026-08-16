package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OrganizationVisibilityServiceTest {
    @Test
    void visibleFactsCopyTheCandidateCollectionForOneInvocation() {
        UUID regionId = UUID.randomUUID();
        var candidates = new ArrayList<>(List.of(new OrganizationVisibilityLookup.VisibleDataNodeCandidate(
                "REGION", regionId, "Region", "R-1", List.of("Region"), regionId, null, null, null)));
        var facts = new OrganizationVisibilityLookup.VisibleOrganizationFacts(
                candidates, new OrganizationVisibilityLookup.ScopeContext(candidates.getFirst(), null, null, null));

        candidates.clear();

        assertEquals(1, facts.candidates().size());
        assertEquals(regionId, facts.scopeContext().region().dataNodeId());
    }
}
