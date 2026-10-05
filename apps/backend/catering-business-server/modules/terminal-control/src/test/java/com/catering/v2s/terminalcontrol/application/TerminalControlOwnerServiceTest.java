package com.catering.v2s.terminalcontrol.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationOutcome;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationStatus;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationView;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.PersistenceUnavailableException;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.TerminalReport;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence.BindingTarget;
import com.catering.v2s.terminalcontrol.persistence.TerminalControlPersistence.OnlineSession;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

class TerminalControlOwnerServiceTest {
    private final TerminalControlPersistence persistence = mock(TerminalControlPersistence.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final TerminalControlOwnerService service = new TerminalControlOwnerService(persistence, mapper);

    private final UUID operationId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();
    private final UUID terminalRef = UUID.randomUUID();
    private final UUID workspaceUuid = UUID.randomUUID();
    private final UUID storeRef = UUID.randomUUID();
    private InvokeOnlineCommand command;
    private BindingTarget binding;
    private OnlineSession session;

    @BeforeEach
    void setUp() throws Exception {
        command = new InvokeOnlineCommand(
                operationId,
                requestId,
                "mixc",
                terminalRef,
                3,
                "helloWorld",
                mapper.readTree("{\"greeting\":\"hello\"}"));
        binding = new BindingTarget(workspaceUuid, storeRef);
        session = new OnlineSession("tds-1", "session-1", 12);
    }

    @Test
    void commitsIntentBeforeNotifyingAndReturnsTheCommittedOperation() {
        OperationView queued = operation(OperationStatus.QUEUED, "tds-1", "session-1");
        when(persistence.readOperation(operationId)).thenReturn(null, queued);
        when(persistence.readActiveBinding("mixc", terminalRef, 3)).thenReturn(binding);
        when(persistence.readOnlineSession(workspaceUuid, "mixc", terminalRef)).thenReturn(session);
        when(persistence.insertQueued(command, binding, session)).thenReturn(true);

        var result = service.invokeOnline(command);

        assertEquals(InvocationOutcome.QUEUED, result.outcome());
        assertSame(queued, result.operation());
        var order = inOrder(persistence);
        order.verify(persistence).insertQueued(command, binding, session);
        order.verify(persistence).notifyTarget(operationId);
        order.verify(persistence).readOperation(operationId);
    }

    @Test
    void recordsOfflineRefusalWithoutNotificationOrDeferredDispatch() {
        OperationView offline = operation(OperationStatus.NOT_SENT, null, null);
        when(persistence.readOperation(operationId)).thenReturn(null, offline);
        when(persistence.readActiveBinding("mixc", terminalRef, 3)).thenReturn(binding);
        when(persistence.readOnlineSession(workspaceUuid, "mixc", terminalRef)).thenReturn(null);
        when(persistence.insertOffline(command, binding)).thenReturn(true);

        var result = service.invokeOnline(command);

        assertEquals(InvocationOutcome.OFFLINE, result.outcome());
        assertSame(offline, result.operation());
        verify(persistence).insertOffline(command, binding);
        verify(persistence, never()).notifyTarget(operationId);
        verify(persistence, never()).insertQueued(command, binding, session);
    }

    @Test
    void rejectsOversizedWireCommandBeforeReadingBindingOrWritingIntent() throws Exception {
        var oversized = new InvokeOnlineCommand(
                operationId,
                requestId,
                "mixc",
                terminalRef,
                3,
                "helloWorld",
                mapper.readTree("{\"large\":\"" + "x".repeat(66_000) + "\"}"));

        var result = service.invokeOnline(oversized);

        assertEquals(InvocationOutcome.COMMAND_TOO_LARGE, result.outcome());
        assertNull(result.operation());
        verifyNoInteractions(persistence);
    }

    @Test
    void returnsExistingOperationWithoutSecondDispatch() {
        OperationView existing = operation(OperationStatus.STARTED, "tds-1", "session-1");
        when(persistence.readOperation(operationId)).thenReturn(existing);

        var result = service.invokeOnline(command);

        assertEquals(InvocationOutcome.ALREADY_EXISTS, result.outcome());
        assertSame(existing, result.operation());
        verify(persistence, never()).notifyTarget(operationId);
        verify(persistence, never()).insertQueued(command, binding, session);
    }

    @Test
    void firstIntentInsertFailureIsTypedAndNeverNotifies() {
        when(persistence.readOperation(operationId)).thenReturn(null);
        when(persistence.readActiveBinding("mixc", terminalRef, 3)).thenReturn(binding);
        when(persistence.readOnlineSession(workspaceUuid, "mixc", terminalRef)).thenReturn(session);
        when(persistence.insertQueued(command, binding, session))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        PersistenceUnavailableException failure =
                assertThrows(PersistenceUnavailableException.class, () -> service.invokeOnline(command));

        assertEquals(PersistenceUnavailableException.CODE, failure.getMessage());
        verify(persistence, never()).notifyTarget(operationId);
    }

    @Test
    void operationReadFailureIsTypedInsteadOfLookingLikeMissingHistory() {
        when(persistence.readOperation(operationId))
                .thenThrow(new DataAccessResourceFailureException("database unavailable"));

        PersistenceUnavailableException failure =
                assertThrows(PersistenceUnavailableException.class, () -> service.readOperation(operationId));

        assertEquals(PersistenceUnavailableException.CODE, failure.getMessage());
    }

    @Test
    void resultPersistenceFailureDoesNotReturnAnAcknowledgement() throws Exception {
        TerminalReport report = new TerminalReport(
                UUID.randomUUID(),
                operationId,
                requestId,
                3,
                "tds-1",
                "session-1",
                OperationStatus.COMPLETED,
                Instant.parse("2026-10-05T00:00:00Z"),
                mapper.readTree("{\"done\":true}"),
                null);
        when(persistence.accept(report)).thenThrow(new DataAccessResourceFailureException("database unavailable"));

        PersistenceUnavailableException failure =
                assertThrows(PersistenceUnavailableException.class, () -> service.acceptTerminalReport(report));

        assertEquals(PersistenceUnavailableException.CODE, failure.getMessage());
    }

    private OperationView operation(OperationStatus status, String nodeId, String sessionId) {
        return new OperationView(
                operationId,
                requestId,
                workspaceUuid,
                "mixc",
                storeRef,
                terminalRef,
                3,
                nodeId,
                sessionId,
                status,
                "helloWorld",
                command.parameters(),
                null,
                null,
                Instant.parse("2026-10-04T12:00:00Z"),
                Instant.parse("2026-10-04T12:00:00Z"));
    }
}
