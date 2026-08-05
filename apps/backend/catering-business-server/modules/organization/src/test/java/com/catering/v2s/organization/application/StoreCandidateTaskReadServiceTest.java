package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class StoreCandidateTaskReadServiceTest {
    @Test
    void associationCandidatesDoNotResolveVisibleScope() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceAssignmentScopeLookup assignments = mock(WorkspaceAssignmentScopeLookup.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        @SuppressWarnings({"unchecked", "rawtypes"})
        List<StoreCandidateTaskReadService.Candidate> brands = List.of(new StoreCandidateTaskReadService.Candidate(UUID.randomUUID(), "BR-01", "Brand", null));
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(brands);
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(jdbc, assignments, taskPaths);

        StoreCandidateTaskReadService.CandidatePage page = service.candidatePage(UUID.randomUUID(), "candidate-scope", UUID.randomUUID(), null, "BRAND", null, 1, 20, null, null, null, null);

        assertEquals(brands, page.items());
        verifyNoInteractions(assignments, taskPaths);
    }

    @Test
    void primaryStoreCandidatesAreLimitedToVisibleProjects() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceAssignmentScopeLookup assignments = mock(WorkspaceAssignmentScopeLookup.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(jdbc, assignments, taskPaths);

        assertThrows(BusinessEntityService.OrganizationNotFoundException.class, () -> service.candidatePage(UUID.randomUUID(), "candidate-scope", UUID.randomUUID(), null, "STORE", null, 1, 20, null, UUID.randomUUID(), null, null));

        verifyNoInteractions(jdbc, taskPaths);
    }
}
