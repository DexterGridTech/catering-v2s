package com.catering.v2s.storeterminal.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.audit.contract.AuditValueState;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class StoreTerminalAuditEventWriterTest {
    @Test
    void writesOnlyToItsOwnerTableUsingTheSharedAuditWireFormat() {
        RecordingJdbcTemplate jdbc = new RecordingJdbcTemplate();
        StoreTerminalAuditEventWriter writer = new StoreTerminalAuditEventWriter(jdbc);
        UUID eventId = UUID.randomUUID();
        UUID workspaceId = UUID.randomUUID();
        String label = "激活码";
        String issued = "已签发";
        AuditChange activationCodeIssue =
                new AuditChange("activationCode", label, AuditValueState.MISSING, null, AuditValueState.VALUE, issued);

        int updated = writer.write(new AuditEvent(
                eventId,
                workspaceId,
                "workspace",
                new AuditTarget("STORE_TERMINAL", "terminal-1"),
                AuditActor.system(),
                "TERMINAL_CREATED",
                10L,
                List.of(activationCodeIssue)));

        assertEquals(1, updated);
        assertTrue(jdbc.sql.startsWith("INSERT INTO store_terminal.audit_event"));
        assertEquals(eventId, jdbc.arguments[0]);
        assertEquals(workspaceId, jdbc.arguments[1]);
        assertEquals("workspace", jdbc.arguments[2]);
        assertEquals("STORE_TERMINAL", jdbc.arguments[3]);
        assertEquals("SYSTEM", jdbc.arguments[5]);
        assertEquals("TERMINAL_CREATED", jdbc.arguments[8]);
        assertEquals(10L, jdbc.arguments[9]);
        assertEquals(
                "[{\"fieldKey\":\"activationCode\",\"fieldLabelSnapshot\":\"激活码\","
                        + "\"beforeState\":\"MISSING\",\"afterState\":\"VALUE\",\"afterValue\":\"已签发\"}]",
                jdbc.arguments[10]);
    }

    @Test
    void rejectsEventsOwnedByAnotherEntity() {
        RecordingJdbcTemplate jdbc = new RecordingJdbcTemplate();
        StoreTerminalAuditEventWriter writer = new StoreTerminalAuditEventWriter(jdbc);
        AuditEvent event = new AuditEvent(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "workspace",
                new AuditTarget("STORE", "store-1"),
                AuditActor.system(),
                "STORE_UPDATED",
                10L,
                List.of());

        assertThrows(IllegalArgumentException.class, () -> writer.write(event));
        assertNull(jdbc.sql);
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
