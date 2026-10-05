package com.catering.v2s.terminalcontrol.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationStatus;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationView;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.TerminalReport;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class TerminalControlPersistenceTest {
    @Test
    void claimedOperationWithoutReportProjectsUnknownOutcomeAndRetainsClaimedPhase() {
        var claimed = new OperationView(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "group-a",
                UUID.randomUUID(),
                UUID.randomUUID(),
                1,
                "tds-1",
                "session-1",
                OperationStatus.CLAIMED,
                "helloWorldCommand",
                null,
                null,
                null,
                Instant.parse("2026-10-05T00:00:00Z"),
                Instant.parse("2026-10-05T00:00:01Z"));

        assertEquals(OperationStatus.CLAIMED, claimed.status());
        assertEquals(OperationStatus.UNKNOWN, claimed.outcome());
        SimpleModule instantSerializer = new SimpleModule();
        instantSerializer.addSerializer(Instant.class, new JsonSerializer<>() {
            @Override
            public void serialize(Instant value, JsonGenerator generator, SerializerProvider serializers)
                    throws IOException {
                generator.writeString(value.toString());
            }
        });
        String serializedOutcome = new ObjectMapper()
                .registerModule(instantSerializer)
                .valueToTree(claimed)
                .path("outcome")
                .asText();
        assertEquals("UNKNOWN", serializedOutcome);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    @Test
    void missingOwnerAcceptanceRowFailsInsteadOfInventingAcceptanceTime() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        var persistence = new TerminalControlPersistence(jdbc, new ObjectMapper());
        var report = new TerminalReport(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                1,
                "tds-1",
                "session-1",
                OperationStatus.RECEIVED,
                Instant.parse("2026-10-05T00:00:00Z"),
                null,
                null);

        IllegalStateException failure = assertThrows(IllegalStateException.class, () -> persistence.accept(report));

        assertEquals("TERMINAL_CONTROL_REPORT_ACCEPTANCE_RESULT_MISSING", failure.getMessage());
    }
}
