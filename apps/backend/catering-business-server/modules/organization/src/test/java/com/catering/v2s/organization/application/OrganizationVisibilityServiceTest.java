package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

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

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void selectedDisabledStoreRemainsReadableButIsNotASelectionCandidate() {
        UUID workspaceId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0, String.class);
            RowMapper mapper = invocation.getArgument(1, RowMapper.class);
            if (sql.contains("organization.organization_node")) {
                return List.of(mapper.mapRow(hierarchyRow(projectId), 0));
            }
            if (sql.contains("organization.store")) {
                return List.of(mapper.mapRow(storeRow(storeId, projectId), 0));
            }
            return List.of();
        });

        OrganizationVisibilityLookup.VisibleOrganizationFacts facts = new OrganizationVisibilityService(jdbc)
                .resolveSessionEntryFacts(
                        workspaceId, "visibility-test", ServiceNodeTypes.GROUP, null, null, projectId, storeId, null);

        assertNotNull(facts.scopeContext().store(), "a persisted disabled selection remains a readable scope");
        assertEquals(storeId, facts.scopeContext().store().dataNodeId());
        assertFalse(
                facts.candidates().stream().anyMatch(candidate -> storeId.equals(candidate.dataNodeId())),
                "a disabled store remains unavailable for a new selection");
    }

    private static java.sql.ResultSet hierarchyRow(UUID projectId) throws Exception {
        java.sql.ResultSet row = mock(java.sql.ResultSet.class);
        when(row.getObject(1, UUID.class)).thenReturn(projectId);
        when(row.getString(2)).thenReturn(ServiceNodeTypes.PROJECT);
        when(row.getString(3)).thenReturn("PROJECT-01");
        when(row.getString(4)).thenReturn("Project");
        when(row.getObject(5, UUID.class)).thenReturn(null);
        when(row.getString(6)).thenReturn("ENABLED");
        return row;
    }

    private static java.sql.ResultSet storeRow(UUID storeId, UUID projectId) throws Exception {
        java.sql.ResultSet row = mock(java.sql.ResultSet.class);
        when(row.getObject(1, UUID.class)).thenReturn(storeId);
        when(row.getString(2)).thenReturn("STORE-01");
        when(row.getString(3)).thenReturn("Store");
        when(row.getObject(4, UUID.class)).thenReturn(projectId);
        when(row.getObject(5, UUID.class)).thenReturn(null);
        when(row.getString(6)).thenReturn("DISABLED");
        return row;
    }
}
