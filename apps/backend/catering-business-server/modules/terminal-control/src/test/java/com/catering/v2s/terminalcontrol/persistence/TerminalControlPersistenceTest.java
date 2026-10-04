package com.catering.v2s.terminalcontrol.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationStatus;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.TerminalReport;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class TerminalControlPersistenceTest {
    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void missingOwnerAcceptanceRowFailsInsteadOfInventingAcceptanceTime() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        var persistence = new TerminalControlPersistence(jdbc, new ObjectMapper());
        var report = new TerminalReport(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1, "tds-1", "session-1",
                OperationStatus.RECEIVED, Instant.parse("2026-10-05T00:00:00Z"), null, null);

        IllegalStateException failure = assertThrows(IllegalStateException.class, () -> persistence.accept(report));

        assertEquals("TERMINAL_CONTROL_REPORT_ACCEPTANCE_RESULT_MISSING", failure.getMessage());
    }
}
