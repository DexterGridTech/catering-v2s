package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.InvitationTargetRef;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.InvitationTargetType;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.PlatformInvitationCandidatePage;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.PlatformInvitationCandidateQuery;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class OrganizationAssignmentCandidateServiceTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformCandidatesUseExactlyOneBoundedOrganizationProjection() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        OrganizationAssignmentCandidateService service = service(jdbc);

        PlatformInvitationCandidatePage actual = service.platformInvitationCandidates(
                UUID.randomUUID(),
                "workspace-key",
                new PlatformInvitationCandidateQuery(InvitationTargetType.STORE, "north", 1, 20));

        assertEquals(List.of(), actual.items());
        assertEquals(0L, actual.total());
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void roleTargetRequiresOneEnabledTypedOrganizationTarget() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        OrganizationAssignmentCandidateService service = service(jdbc);

        assertThrows(
                OrganizationTaskPathService.TaskPathNotFoundException.class,
                () -> service.requireEnabledInvitationTarget(
                        UUID.randomUUID(),
                        "workspace-key",
                        new InvitationTargetRef(InvitationTargetType.PROJECT, UUID.randomUUID())));
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    void typedCandidateInputsRejectInvalidPageAndNullTargetReference() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new PlatformInvitationCandidateQuery(InvitationTargetType.REGION, null, 0, 20));
        assertThrows(NullPointerException.class, () -> new InvitationTargetRef(InvitationTargetType.REGION, null));
    }

    private static OrganizationAssignmentCandidateService service(JdbcTemplate jdbc) {
        return new OrganizationAssignmentCandidateService(
                jdbc, mock(CommercialGroupLookup.class), mock(OrganizationTaskPathLookup.class));
    }
}
