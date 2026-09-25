package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class BusinessChannelCommandReceiptServiceTest {
    @Test
    void invalidIdempotencyKeyIsTypedAndRejectedBeforeDatabaseAccess() {
        BusinessChannelCommandReceiptPersistence persistence = mock(BusinessChannelCommandReceiptPersistence.class);
        BusinessChannelCommandReceiptService receipts = new BusinessChannelCommandReceiptService(persistence, () -> 1L);

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
        verifyNoInteractions(persistence);
    }

    @Test
    void replayReturnsTheStoredResponseWithoutExecutingTheCommandAgain() throws Exception {
        BusinessChannelCommandReceiptPersistence persistence = mock(BusinessChannelCommandReceiptPersistence.class);
        when(persistence.find(any(UUID.class), anyString(), anyString()))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(new BusinessChannelCommandReceiptPersistence.Receipt(
                        Sha256Hex.digest("request"), "\"response\"")));

        BusinessChannelCommandReceiptService receipts = new BusinessChannelCommandReceiptService(persistence, () -> 1L);
        UUID workspace = UUID.randomUUID();
        AtomicInteger executions = new AtomicInteger();
        String first = receipts.execute(
                workspace,
                "workspace-key",
                "receipt-replay-0001",
                "createOperationsBusinessChannel",
                "request",
                String.class,
                () -> {
                    executions.incrementAndGet();
                    return "response";
                });
        String replay = receipts.execute(
                workspace,
                "workspace-key",
                "receipt-replay-0001",
                "createOperationsBusinessChannel",
                "request",
                String.class,
                () -> fail("receipt replay must not execute the command again"));

        assertEquals("response", first);
        assertEquals("response", replay);
        assertEquals(1, executions.get());
        verify(persistence, times(1))
                .insert(
                        any(UUID.class),
                        eq(workspace),
                        eq("workspace-key"),
                        eq("receipt-replay-0001"),
                        eq("createOperationsBusinessChannel"),
                        eq(Sha256Hex.digest("request")),
                        eq("\"response\""),
                        anyLong());
    }

    @Test
    void differentRequestForTheSameIdempotencyKeyIsRejectedBeforeCommandExecution() throws Exception {
        BusinessChannelCommandReceiptPersistence persistence = mock(BusinessChannelCommandReceiptPersistence.class);
        when(persistence.find(any(UUID.class), anyString(), anyString()))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(new BusinessChannelCommandReceiptPersistence.Receipt(
                        Sha256Hex.digest("request-a"), "\"stored-response\"")));

        BusinessChannelCommandReceiptService receipts = new BusinessChannelCommandReceiptService(persistence, () -> 1L);
        UUID workspace = UUID.randomUUID();
        receipts.execute(
                workspace,
                "workspace-key",
                "receipt-conflict-001",
                "createOperationsBusinessChannel",
                "request-a",
                String.class,
                () -> "stored-response");

        BusinessChannelCommandApi.Problem problem = assertThrows(
                BusinessChannelCommandApi.Problem.class,
                () -> receipts.execute(
                        workspace,
                        "workspace-key",
                        "receipt-conflict-001",
                        "createOperationsBusinessChannel",
                        "request-b",
                        String.class,
                        () -> fail("idempotency conflict must reject before command execution")));

        assertEquals("IDEMPOTENCY_CONFLICT", problem.code());
        verify(persistence, times(1))
                .insert(
                        any(UUID.class),
                        eq(workspace),
                        eq("workspace-key"),
                        eq("receipt-conflict-001"),
                        eq("createOperationsBusinessChannel"),
                        eq(Sha256Hex.digest("request-a")),
                        eq("\"stored-response\""),
                        anyLong());
    }

    @Test
    void corruptStoredResponseIsTypedBeforeReturningAReplay() throws Exception {
        BusinessChannelCommandReceiptPersistence persistence = mock(BusinessChannelCommandReceiptPersistence.class);
        when(persistence.find(any(UUID.class), anyString(), anyString()))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(
                        new BusinessChannelCommandReceiptPersistence.Receipt(Sha256Hex.digest("request"), "not-json")));

        BusinessChannelCommandReceiptService receipts = new BusinessChannelCommandReceiptService(persistence, () -> 1L);
        UUID workspace = UUID.randomUUID();
        receipts.execute(
                workspace,
                "workspace-key",
                "receipt-corrupt-001",
                "createOperationsBusinessChannel",
                "request",
                String.class,
                () -> "fresh-response");

        BusinessChannelCommandApi.Problem problem = assertThrows(
                BusinessChannelCommandApi.Problem.class,
                () -> receipts.execute(
                        workspace,
                        "workspace-key",
                        "receipt-corrupt-001",
                        "createOperationsBusinessChannel",
                        "request",
                        String.class,
                        () -> fail("corrupt replay must fail before command execution")));

        assertEquals("RECEIPT_CORRUPT", problem.code());
        verify(persistence, times(1))
                .insert(
                        any(UUID.class),
                        eq(workspace),
                        eq("workspace-key"),
                        eq("receipt-corrupt-001"),
                        eq("createOperationsBusinessChannel"),
                        eq(Sha256Hex.digest("request")),
                        eq("\"fresh-response\""),
                        anyLong());
    }

    @Test
    void nullHistoricalResponseIsAClaimOnlyReplayAndDoesNotRunTheCommand() throws Exception {
        BusinessChannelCommandReceiptPersistence persistence = mock(BusinessChannelCommandReceiptPersistence.class);
        when(persistence.find(any(UUID.class), anyString(), anyString()))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(
                        new BusinessChannelCommandReceiptPersistence.Receipt(Sha256Hex.digest("request"), null)));

        BusinessChannelCommandReceiptService receipts = new BusinessChannelCommandReceiptService(persistence, () -> 1L);
        UUID workspace = UUID.randomUUID();
        AtomicInteger executions = new AtomicInteger();
        receipts.execute(
                workspace,
                "workspace-key",
                "receipt-null-0001",
                "createOperationsBusinessChannel",
                "request",
                String.class,
                () -> {
                    executions.incrementAndGet();
                    return "response";
                });
        String replay = receipts.execute(
                workspace,
                "workspace-key",
                "receipt-null-0001",
                "createOperationsBusinessChannel",
                "request",
                String.class,
                () -> fail("claim-only replay must not execute the command again"));

        org.junit.jupiter.api.Assertions.assertNull(replay);
        assertEquals(1, executions.get());
    }
}
