package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class StoreCandidateTaskReadServiceTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformContractCandidatesUseOneBoundedOwnerProjection() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(
                jdbc, mock(WorkspaceAssignmentScopeLookup.class), mock(OrganizationTaskPathLookup.class));

        StoreCandidateTaskReadService.CandidatePage page = service.platformContractCandidatePage(
                UUID.randomUUID(),
                "candidate-scope",
                new StoreCandidateTaskReadService.PlatformContractCandidateQuery(
                        StoreCandidateTaskReadService.PlatformContractCandidateSubject.STORE,
                        "north",
                        1,
                        20,
                        null,
                        UUID.randomUUID()));

        assertEquals(0L, page.metadata().total());
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformExternalBindingCandidatesUseTheOrganizationOwnerForEveryBindableType() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(
                jdbc, mock(WorkspaceAssignmentScopeLookup.class), mock(OrganizationTaskPathLookup.class));

        for (StoreCandidateTaskReadService.PlatformContractCandidateSubject subject : List.of(
                StoreCandidateTaskReadService.PlatformContractCandidateSubject.COMMERCIAL_GROUP,
                StoreCandidateTaskReadService.PlatformContractCandidateSubject.REGION,
                StoreCandidateTaskReadService.PlatformContractCandidateSubject.PROJECT,
                StoreCandidateTaskReadService.PlatformContractCandidateSubject.HEAD_COMPANY,
                StoreCandidateTaskReadService.PlatformContractCandidateSubject.STORE)) {
            service.platformExternalBindingCandidatePage(
                    UUID.randomUUID(),
                    "candidate-scope",
                    new StoreCandidateTaskReadService.PlatformContractCandidateQuery(
                            subject, null, 1, 20, null, null));
        }

        verify(jdbc, org.mockito.Mockito.times(5)).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    void associationCandidatesDoNotResolveVisibleScope() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceAssignmentScopeLookup assignments = mock(WorkspaceAssignmentScopeLookup.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        UUID brandId = UUID.randomUUID();
        List<StoreCandidateTaskReadService.Candidate> brands =
                List.of(new StoreCandidateTaskReadService.Candidate(brandId, "BR-01", "Brand", null));
        stubCandidateRows(jdbc, List.of(new CandidateRow(brandId, "BR-01", "Brand", 1L, 1L, false)));
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(jdbc, assignments, taskPaths);

        StoreCandidateTaskReadService.CandidatePage page = service.candidatePage(
                UUID.randomUUID(),
                "candidate-scope",
                UUID.randomUUID(),
                null,
                "BRAND",
                null,
                1,
                20,
                null,
                null,
                null,
                null);

        assertEquals(brands, page.items());
        verifyNoInteractions(assignments, taskPaths);
    }

    @Test
    void selectedCandidateDoesNotReplaceCurrentPageMember() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID firstId = UUID.randomUUID();
        UUID selectedId = UUID.randomUUID();
        stubCandidateRows(
                jdbc,
                List.of(
                        new CandidateRow(firstId, "BR-01", "First", 2L, 1L, true),
                        new CandidateRow(selectedId, "BR-02", "Selected", 2L, 2L, true)));
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(
                jdbc, mock(WorkspaceAssignmentScopeLookup.class), mock(OrganizationTaskPathLookup.class));

        StoreCandidateTaskReadService.CandidatePage page = service.candidatePage(
                UUID.randomUUID(),
                "candidate-scope",
                UUID.randomUUID(),
                null,
                "BRAND",
                null,
                1,
                1,
                selectedId,
                null,
                null,
                null);

        assertEquals(2L, page.metadata().total());
        assertEquals(
                List.of(new StoreCandidateTaskReadService.Candidate(firstId, "BR-01", "First", null)), page.items());
    }

    @Test
    void primaryStoreCandidatesAreLimitedToVisibleProjects() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceAssignmentScopeLookup assignments = mock(WorkspaceAssignmentScopeLookup.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        StoreCandidateTaskReadService service = new StoreCandidateTaskReadService(jdbc, assignments, taskPaths);

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> service.candidatePage(
                        UUID.randomUUID(),
                        "candidate-scope",
                        UUID.randomUUID(),
                        null,
                        "STORE",
                        null,
                        1,
                        20,
                        null,
                        UUID.randomUUID(),
                        null,
                        null));

        verifyNoInteractions(jdbc, taskPaths);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void stubCandidateRows(JdbcTemplate jdbc, List<CandidateRow> rows) {
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper mapper = invocation.getArgument(1);
            return rows.stream().map(row -> mapRow(mapper, row)).toList();
        });
    }

    private static Object mapRow(RowMapper<?> mapper, CandidateRow candidate) {
        try {
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getObject("id", UUID.class)).thenReturn(candidate.id());
            when(resultSet.getString("code")).thenReturn(candidate.code());
            when(resultSet.getString("name")).thenReturn(candidate.name());
            when(resultSet.getLong("total")).thenReturn(candidate.total());
            when(resultSet.getLong("page_rank")).thenReturn(candidate.pageRank());
            when(resultSet.getBoolean("selected_exists")).thenReturn(candidate.selectedExists());
            return mapper.mapRow(resultSet, 0);
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private record CandidateRow(UUID id, String code, String name, long total, long pageRank, boolean selectedExists) {}
}
