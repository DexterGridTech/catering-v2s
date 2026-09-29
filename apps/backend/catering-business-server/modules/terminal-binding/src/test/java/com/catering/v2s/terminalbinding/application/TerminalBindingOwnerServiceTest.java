package com.catering.v2s.terminalbinding.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationCandidate;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OperationsCancelCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OperationsCancelGrant;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OperationsCancelOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.OperationsCancelTarget;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.TerminalVoidCommand;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.ActivationFacts;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.ActivationWrite;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.LockedBinding;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence.Receipt;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

class TerminalBindingOwnerServiceTest {
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID STORE = UUID.randomUUID();
    private static final UUID TERMINAL = UUID.randomUUID();
    private static final String GROUP_KEY = "group-1";
    private static final String DEVICE_ID = "device-1";
    private static final byte[] DIGEST = new byte[32];

    @Test
    void recognizedRetrySucceedsBeforeDisabledGroupAndDoesNotWriteOrReadStatusFacts() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        LockedBinding binding = activeBinding();
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(binding);
        when(persistence.readActivationFacts(candidate()))
                .thenReturn(new ActivationFacts("DISABLED", "VOIDED", STORE, "VOIDED", "laptop"));
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        var result = service.activateOrReplay(
                new ActivationCommand(candidate(), DEVICE_ID, DIGEST, AuditActor.terminalDevice()));

        assertEquals(ActivationOutcome.ACTIVATED, result.outcome());
        assertEquals(binding.generation(), result.bindingGeneration());
        verify(persistence, never()).readActivationFacts(candidate());
        verify(persistence, never()).notifyRevoked(TERMINAL, binding.generation());
        verifyNoInteractions(auditWriter);
    }

    @Test
    void nonRetryStillAppliesR14StatusPrecedenceBeforeAnyBindingWrite() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        ActivationCandidate candidate = candidate();
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        when(persistence.readActivationFacts(candidate))
                .thenReturn(new ActivationFacts("DISABLED", "VOIDED", STORE, "VOIDED", "laptop"));
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);
        byte[] differentDigest = new byte[32];
        differentDigest[0] = 1;

        var result = service.activateOrReplay(
                new ActivationCommand(candidate, "another-device", differentDigest, AuditActor.terminalDevice()));

        assertEquals(ActivationOutcome.GROUP_WORKSPACE_DISABLED, result.outcome());
        verify(persistence, never())
                .insertFirstActive(
                        any(UUID.class), anyString(), any(UUID.class), any(UUID.class), any(byte[].class), anyString());
        verify(persistence, never())
                .reactivate(any(UUID.class), anyString(), any(UUID.class), any(byte[].class), anyString());
        verifyNoInteractions(auditWriter);
    }

    @Test
    void activationAfterAnEndedBindingWritesActivatedAuditReason() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        ActivationCandidate candidate = candidate();
        LockedBinding endedBinding = new LockedBinding(
                "ENDED", 9, DIGEST, null, 1234, 5678L, "DEVICE_CANCELLED", 9L, DIGEST, 5678L, "DEVICE_CANCELLED");
        byte[] nextDigest = DIGEST.clone();
        nextDigest[0] = 1;
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(endedBinding);
        when(persistence.readActivationFacts(candidate))
                .thenReturn(new ActivationFacts("ENABLED", "ENABLED", STORE, "ENABLED", "laptop"));
        when(persistence.reactivate(eq(WORKSPACE), eq(GROUP_KEY), eq(TERMINAL), any(byte[].class), eq(DEVICE_ID)))
                .thenReturn(new ActivationWrite(10, 6789));
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        var result = service.activateOrReplay(
                new ActivationCommand(candidate, DEVICE_ID, nextDigest, AuditActor.terminalDevice()));

        assertEquals(ActivationOutcome.ACTIVATED, result.outcome());
        assertEquals(10, result.bindingGeneration());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditWriter).write(audit.capture());
        assertEquals("ACTIVATED", audit.getValue().changes().getLast().afterValue());
        assertEquals("TERMINAL_DEVICE", audit.getValue().actor().actorType());
        assertEquals("终端设备", audit.getValue().actor().displaySnapshot());
        verify(persistence, never()).notifyRevoked(TERMINAL, 9);
    }

    @Test
    void activeSameDeviceReactivationWritesReactivatedAuditReason() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        ActivationCandidate candidate = candidate();
        byte[] nextDigest = DIGEST.clone();
        nextDigest[0] = 1;
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        when(persistence.readActivationFacts(candidate))
                .thenReturn(new ActivationFacts("ENABLED", "ENABLED", STORE, "ENABLED", "laptop"));
        when(persistence.reactivate(eq(WORKSPACE), eq(GROUP_KEY), eq(TERMINAL), any(byte[].class), eq(DEVICE_ID)))
                .thenReturn(new ActivationWrite(10, 6789));
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        var result = service.activateOrReplay(
                new ActivationCommand(candidate, DEVICE_ID, nextDigest, AuditActor.terminalDevice()));

        assertEquals(ActivationOutcome.ACTIVATED, result.outcome());
        assertEquals(10, result.bindingGeneration());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditWriter).write(audit.capture());
        assertEquals("REACTIVATED", audit.getValue().changes().getLast().afterValue());
        assertEquals("TERMINAL_DEVICE", audit.getValue().actor().actorType());
        assertEquals("终端设备", audit.getValue().actor().displaySnapshot());
        verify(persistence).notifyRevoked(TERMINAL, 9);
    }

    @Test
    void deviceCancellationUsesOnlyCredentialPrecedenceAndWritesAuditBeforeRevocation() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        var facts = new TerminalBindingOwnerPersistence.AuthenticationFacts(
                WORKSPACE, "DISABLED", STORE, "DISABLED", "DISABLED", 9L, DIGEST, "ACTIVE", DEVICE_ID, 1234L);
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL)).thenReturn(facts, facts);
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        when(persistence.endActive(WORKSPACE, GROUP_KEY, TERMINAL, "DEVICE_CANCELLED"))
                .thenReturn(5678L);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        var outcome = service.cancelByDevice(new DeviceCancelCommand(GROUP_KEY, TERMINAL, 9, DIGEST, DEVICE_ID));

        assertEquals(DeviceCancelOutcome.CANCELLED, outcome);
        InOrder order = inOrder(persistence, auditWriter);
        order.verify(persistence).endActive(WORKSPACE, GROUP_KEY, TERMINAL, "DEVICE_CANCELLED");
        order.verify(auditWriter).write(any(AuditEvent.class));
        order.verify(persistence).notifyRevoked(TERMINAL, 9);

        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditWriter).write(audit.capture());
        assertEquals("TERMINAL_DEVICE", audit.getValue().actor().actorType());
        assertEquals("终端设备", audit.getValue().actor().displaySnapshot());
        assertEquals(
                List.of("bindingStatus", "generation", "reason"),
                audit.getValue().changes().stream()
                        .map(change -> change.fieldKey())
                        .toList());
        assertFalse(audit.getValue().changes().toString().contains(DEVICE_ID));
        assertEquals("DEVICE_CANCELLED", audit.getValue().changes().getLast().afterValue());
    }

    @Test
    void endedCurrentCredentialWithDifferentDeviceIsAlreadyCancelledWithoutWrites() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        var facts = new TerminalBindingOwnerPersistence.AuthenticationFacts(
                WORKSPACE, "DISABLED", STORE, "DISABLED", "DISABLED", 9L, DIGEST, "ENDED", null, 1234L);
        var endedBinding = new LockedBinding(
                "ENDED", 9, DIGEST, null, 1234, 5678L, "DEVICE_CANCELLED", 9L, DIGEST, 5678L, "DEVICE_CANCELLED");
        when(persistence.readAuthenticationFacts(GROUP_KEY, TERMINAL)).thenReturn(facts, facts);
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(endedBinding);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        var outcome =
                service.cancelByDevice(new DeviceCancelCommand(GROUP_KEY, TERMINAL, 9, DIGEST, "different-device"));

        assertEquals(DeviceCancelOutcome.ALREADY_CANCELLED, outcome);
        verify(persistence, never()).endActive(any(UUID.class), anyString(), any(UUID.class), anyString());
        verify(persistence, never()).notifyRevoked(any(UUID.class), anyLong());
        verify(persistence, never()).saveReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString());
        verifyNoInteractions(auditWriter);
    }

    @Test
    void operationsCancellationRejectsChangedGenerationWithoutReceiptOrMutation() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);
        OperationsCancelCommand command = operationsCommand(authorizedGrant(), 7, 8);

        var outcome = service.cancelByOperations(command);

        assertEquals(OperationsCancelOutcome.BINDING_CHANGED, outcome);
        verify(persistence).lockOperationsReceipt(WORKSPACE, GROUP_KEY, "request-1");
        verify(persistence).findReceipt(WORKSPACE, GROUP_KEY, "request-1");
        verify(persistence, never()).endActive(any(UUID.class), anyString(), any(UUID.class), anyString());
        verify(persistence, never()).saveReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString());
        verify(persistence, never()).notifyRevoked(any(UUID.class), anyLong());
        verifyNoInteractions(auditWriter);
    }

    @Test
    void authorizedOperationsCancellationEndsOnceAuditsAndStoresOnlySuccessfulReceipt() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        when(persistence.findReceipt(WORKSPACE, GROUP_KEY, "request-1")).thenReturn(null);
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        when(persistence.endActive(WORKSPACE, GROUP_KEY, TERMINAL, "OPERATIONS_CANCELLED"))
                .thenReturn(5678L);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        var outcome = service.cancelByOperations(operationsCommand(authorizedGrant(9), 9, 9));

        assertEquals(OperationsCancelOutcome.CANCELLED, outcome);
        InOrder order = inOrder(persistence, auditWriter);
        order.verify(persistence).lockOperationsReceipt(WORKSPACE, GROUP_KEY, "request-1");
        order.verify(persistence).findReceipt(WORKSPACE, GROUP_KEY, "request-1");
        order.verify(persistence).lockLatest(WORKSPACE, GROUP_KEY, TERMINAL);
        order.verify(persistence).endActive(WORKSPACE, GROUP_KEY, TERMINAL, "OPERATIONS_CANCELLED");
        order.verify(auditWriter).write(any(AuditEvent.class));
        order.verify(persistence).notifyRevoked(TERMINAL, 9L);
        order.verify(persistence).saveReceipt(eq(WORKSPACE), eq(GROUP_KEY), eq("request-1"), anyString(), anyString());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditWriter).write(audit.capture());
        assertEquals(
                "OPERATIONS_CANCELLED", audit.getValue().changes().getLast().afterValue());
        assertFalse(audit.getValue().changes().toString().contains(DEVICE_ID));
    }

    @Test
    void rejectedOperationsCancellationIsReevaluatedWithTheSameRequestAfterGenerationChanges() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        when(persistence.findReceipt(WORKSPACE, GROUP_KEY, "request-1")).thenReturn(null, null);
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding(9), activeBinding(10));
        when(persistence.endActive(WORKSPACE, GROUP_KEY, TERMINAL, "OPERATIONS_CANCELLED"))
                .thenReturn(5678L);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);
        OperationsCancelCommand sameRequest = operationsCommand(authorizedGrant(9), 9, 10);

        assertEquals(OperationsCancelOutcome.BINDING_CHANGED, service.cancelByOperations(sameRequest));
        assertEquals(OperationsCancelOutcome.CANCELLED, service.cancelByOperations(sameRequest));

        verify(persistence, times(2)).lockLatest(WORKSPACE, GROUP_KEY, TERMINAL);
        verify(persistence, times(2)).findReceipt(WORKSPACE, GROUP_KEY, "request-1");
        verify(persistence, times(1)).endActive(WORKSPACE, GROUP_KEY, TERMINAL, "OPERATIONS_CANCELLED");
        verify(persistence, times(1))
                .saveReceipt(eq(WORKSPACE), eq(GROUP_KEY), eq("request-1"), anyString(), anyString());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditWriter).write(audit.capture());
        assertEquals(
                "OPERATIONS_CANCELLED", audit.getValue().changes().getLast().afterValue());
        assertEquals(sameRequest.actor(), audit.getValue().actor());
    }

    @Test
    void terminalVoidWritesTerminalVoidedAuditReasonAndActor() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        when(persistence.readTerminalStatus(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn("VOIDED");
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        when(persistence.endActive(WORKSPACE, GROUP_KEY, TERMINAL, "TERMINAL_VOIDED"))
                .thenReturn(5678L);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);
        TerminalVoidCommand command = new TerminalVoidCommand(WORKSPACE, GROUP_KEY, TERMINAL, AuditActor.system());

        service.endForTerminalVoid(command);

        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditWriter).write(audit.capture());
        assertEquals("TERMINAL_VOIDED", audit.getValue().changes().getLast().afterValue());
        assertEquals(command.actor(), audit.getValue().actor());
        verify(persistence).notifyRevoked(TERMINAL, 9L);
    }

    @Test
    void successfulOperationsCancellationReplayRequiresFreshGrantButDoesNotRepeatEffects() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        when(persistence.findReceipt(WORKSPACE, GROUP_KEY, "request-1")).thenReturn(null);
        when(persistence.lockLatest(WORKSPACE, GROUP_KEY, TERMINAL)).thenReturn(activeBinding());
        when(persistence.endActive(WORKSPACE, GROUP_KEY, TERMINAL, "OPERATIONS_CANCELLED"))
                .thenReturn(5678L);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);
        OperationsCancelCommand command = operationsCommand(authorizedGrant(9), 9, 9);

        assertEquals(
                OperationsCancelOutcome.CANCELLED,
                service.cancelByOperations(operationsCommand(authorizedGrant(9), 9, 9)));

        ArgumentCaptor<String> requestHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> responseJson = ArgumentCaptor.forClass(String.class);
        verify(persistence)
                .saveReceipt(
                        eq(WORKSPACE), eq(GROUP_KEY), eq("request-1"), requestHash.capture(), responseJson.capture());
        doReturn(new Receipt(requestHash.getValue(), responseJson.getValue()))
                .when(persistence)
                .findReceipt(WORKSPACE, GROUP_KEY, "request-1");

        assertEquals(OperationsCancelOutcome.CANCELLED, service.cancelByOperations(command));

        verify(persistence, times(2)).lockOperationsReceipt(WORKSPACE, GROUP_KEY, "request-1");
        verify(persistence, times(2)).findReceipt(WORKSPACE, GROUP_KEY, "request-1");
        verify(persistence, times(1)).lockLatest(WORKSPACE, GROUP_KEY, TERMINAL);
        verify(persistence, times(1)).endActive(WORKSPACE, GROUP_KEY, TERMINAL, "OPERATIONS_CANCELLED");
        verify(persistence, times(1)).notifyRevoked(TERMINAL, 9L);
        verify(persistence, times(1))
                .saveReceipt(eq(WORKSPACE), eq(GROUP_KEY), eq("request-1"), anyString(), anyString());
        verify(auditWriter, times(1)).write(any(AuditEvent.class));
    }

    @Test
    void operationsCancellationRejectsWrongPurposeBeforeAnyReceiptAccess() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        OperationsCancelGrant wrongPurpose = new OperationsCancelGrant(
                WORKSPACE, GROUP_KEY, "REQ_POST_OPERATIONS_STORE_TERMINAL", "EDIT_STORE_TERMINAL", "STORE", STORE, 7L);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);

        assertThrows(
                TerminalBindingOwnerService.TerminalOperationsAuthorizationException.class,
                () -> service.cancelByOperations(operationsCommand(wrongPurpose, 7)));

        verifyNoInteractions(persistence, auditWriter);
    }

    @Test
    void operationsCancellationRejectsWrongTargetAndStaleContextBeforeAnyReceiptAccess() {
        TerminalBindingOwnerPersistence persistence = mock(TerminalBindingOwnerPersistence.class);
        AuditEventWriter auditWriter = mock(AuditEventWriter.class);
        TerminalBindingOwnerService service = new TerminalBindingOwnerService(persistence, auditWriter);
        OperationsCancelTarget wrongStoreTarget =
                new OperationsCancelTarget(WORKSPACE, GROUP_KEY, UUID.randomUUID(), TERMINAL);

        assertThrows(
                TerminalBindingOwnerService.TerminalOperationsAuthorizationException.class,
                () -> service.cancelByOperations(new OperationsCancelCommand(
                        wrongStoreTarget, authorizedGrant(), 7L, 9, "request-1", AuditActor.system())));
        assertThrows(
                TerminalBindingOwnerService.TerminalOperationsAuthorizationException.class,
                () -> service.cancelByOperations(operationsCommand(authorizedGrant(), 8)));

        verifyNoInteractions(persistence, auditWriter);
    }

    private static OperationsCancelCommand operationsCommand(OperationsCancelGrant grant, long contextVersion) {
        return operationsCommand(grant, contextVersion, 8);
    }

    private static OperationsCancelCommand operationsCommand(
            OperationsCancelGrant grant, long contextVersion, long expectedGeneration) {
        return new OperationsCancelCommand(
                new OperationsCancelTarget(WORKSPACE, GROUP_KEY, STORE, TERMINAL),
                grant,
                contextVersion,
                expectedGeneration,
                "request-1",
                AuditActor.system());
    }

    private static OperationsCancelGrant authorizedGrant() {
        return authorizedGrant(7L);
    }

    private static OperationsCancelGrant authorizedGrant(long contextVersion) {
        return new OperationsCancelGrant(
                WORKSPACE,
                GROUP_KEY,
                "REQ_CANCEL_OPERATIONS_STORE_TERMINAL_ACTIVATION",
                "EDIT_STORE_TERMINAL",
                "STORE",
                STORE,
                contextVersion);
    }

    private static ActivationCandidate candidate() {
        return new ActivationCandidate(WORKSPACE, GROUP_KEY, true, STORE, TERMINAL, "ENABLED", "laptop", "laptop");
    }

    private static LockedBinding activeBinding() {
        return activeBinding(9);
    }

    private static LockedBinding activeBinding(long generation) {
        return new LockedBinding("ACTIVE", generation, DIGEST, DEVICE_ID, 1234, null, null, null, null, null, null);
    }
}
