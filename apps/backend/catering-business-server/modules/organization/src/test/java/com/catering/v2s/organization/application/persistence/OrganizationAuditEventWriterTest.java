package com.catering.v2s.organization.application.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditValueState;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class OrganizationAuditEventWriterTest {
    @Test
    void writesStructuredEventThroughOrganizationOwnedInsert() {
        RecordingJdbcTemplate jdbc = new RecordingJdbcTemplate();
        OrganizationAuditEventWriter writer = new OrganizationAuditEventWriter(jdbc);
        UUID eventId = UUID.randomUUID();
        UUID workspaceId = UUID.randomUUID();

        writer.write(new AuditEvent(
                eventId,
                workspaceId,
                "workspace",
                new com.catering.v2s.audit.contract.AuditTarget("STORE", "store-1"),
                AuditActor.system(),
                "UPDATED",
                10L,
                // spotless:off
                List.of(new AuditChange("name", "名称", AuditValueState.VALUE, "旧", AuditValueState.VALUE,
                    "新"))));
                // spotless:on

        assertTrue(jdbc.sql.startsWith("INSERT INTO organization.audit_event"));
        assertEquals(eventId, jdbc.arguments[0]);
        assertEquals(workspaceId, jdbc.arguments[1]);
        assertEquals("workspace", jdbc.arguments[2]);
        assertEquals("STORE", jdbc.arguments[3]);
        assertEquals("store-1", jdbc.arguments[4]);
        assertEquals("SYSTEM", jdbc.arguments[5]);
        assertEquals("UPDATED", jdbc.arguments[8]);
        assertEquals(10L, jdbc.arguments[9]);
        assertEquals(
                ("[{\"fieldKey\":\"name\",\"fieldLabelSnapshot\":\"名称\",\"beforeState"
                        + "\":\"VALUE\",\"beforeValue\":\"旧\",\"afterState\":\"VALUE\",\"afterVal"
                        + "ue\":\"新\"}]"),
                jdbc.arguments[10]);
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String sql;
        private Object[] arguments;

        @Override
        public int update(String sql, Object... args) {
            this.sql = sql;
            this.arguments = args;
            return 1;
        }
    }
}
