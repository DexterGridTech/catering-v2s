package com.catering.v2s.terminalcontrol.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class TerminalRemoteControlPersistenceTest {
    @Test
    void expirationUsesTheDeadlineForStartingAndLeaseExpiryForActive() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AtomicReference<String> executedSql = new AtomicReference<>();
        when(jdbc.update(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            executedSql.set(invocation.getArgument(0));
            return 1;
        });
        var persistence = new TerminalRemoteControlPersistence(jdbc, new ObjectMapper());

        assertTrue(persistence.endExpired(UUID.randomUUID(), "LEASE_EXPIRED"));

        assertTrue(executedSql.get().contains(
                        "CASE WHEN state='STARTING' THEN deadline_at ELSE lease_expires_at END"),
                "STARTING expires at its deadline and ACTIVE expires at its lease boundary");
    }
}
