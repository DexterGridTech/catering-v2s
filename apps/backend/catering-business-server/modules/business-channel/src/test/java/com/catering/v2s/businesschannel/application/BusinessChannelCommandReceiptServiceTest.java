package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class BusinessChannelCommandReceiptServiceTest {
    @Test
    void invalidIdempotencyKeyIsTypedAndRejectedBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BusinessChannelCommandReceiptService receipts = new BusinessChannelCommandReceiptService(jdbc, () -> 1L);

        BusinessChannelCommandApi.Problem problem = assertThrows(
                BusinessChannelCommandApi.Problem.class,
                () -> receipts.execute(
                        UUID.randomUUID(),
                        "workspace-key",
                        "too-short",
                        "createOperationsBusinessChannel",
                        "request",
                        String.class,
                        () -> "response"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }
}
