package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditHistoryItem;
import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.CommercialGroupInitializationAuditLookup;
import com.catering.v2s.platform.workspace.application.persistence.PlatformWorkspaceAuditHistoryPersistence;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class PlatformWorkspaceAuditHistoryServiceTest {
    @Test
    void mergesOwnerAndOrganizationHistoryInAuthoritativeOrder() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CommercialGroupInitializationAuditLookup commercialGroupAudit =
                mock(CommercialGroupInitializationAuditLookup.class);
        UUID workspaceUuid = UUID.randomUUID();
        AuditReadScope scope = new AuditReadScope(workspaceUuid, "workspace-key");
        UUID ownerId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        ResultSet rows = mock(ResultSet.class);
        when(rows.next()).thenReturn(true, false);
        when(rows.getBoolean("target_exists")).thenReturn(true);
        when(rows.getString("audit_ref")).thenReturn("41");
        when(rows.getLong("total")).thenReturn(1L);
        when(rows.getObject("event_id", UUID.class)).thenReturn(ownerId);
        when(rows.getLong("occurred_at_epoch_millis")).thenReturn(20L);
        when(rows.getString("actor_display_snapshot")).thenReturn("owner");
        when(rows.getString("action")).thenReturn("OWNER_ACTION");
        when(rows.getString("entity_type")).thenReturn("GROUP_WORKSPACE");
        when(rows.getString("entity_ref_text")).thenReturn("41");
        when(rows.getString("changes_json")).thenReturn("[]");
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    return extractor.extractData(rows);
                });
        AuditHistoryItem organizationItem = new AuditHistoryItem(
                organizationId,
                30L,
                "organization",
                "ORGANIZATION_ACTION",
                new AuditTarget("COMMERCIAL_GROUP", "7"),
                List.of());
        when(commercialGroupAudit.readInitializationForGroupWorkspace(scope, "41", 1, 1))
                .thenReturn(new AuditHistoryPage(List.of(organizationItem), 1, 1, 1));

        AuditHistoryPage actual = new PlatformWorkspaceAuditHistoryService(
                        new PlatformWorkspaceAuditHistoryPersistence(jdbc), commercialGroupAudit)
                .readGroupWorkspace(scope, "workspace-key", 1, 20);

        assertEquals(
                List.of(organizationItem.id(), ownerId),
                actual.items().stream().map(AuditHistoryItem::id).toList());
        assertEquals(2, actual.total());
        verify(commercialGroupAudit).readInitializationForGroupWorkspace(scope, "41", 1, 1);
    }
}
