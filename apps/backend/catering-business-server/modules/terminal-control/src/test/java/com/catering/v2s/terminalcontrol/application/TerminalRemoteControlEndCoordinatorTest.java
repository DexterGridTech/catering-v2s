package com.catering.v2s.terminalcontrol.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationOutcome;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvocationResult;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.EndCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.EndReadback;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.State;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class TerminalRemoteControlEndCoordinatorTest {
    @Test
    void endCommitsOwnerFactBeforeStableTerminalStopAndRoomCleanup() {
        TerminalRemoteControlOwnerApi owner = mock(TerminalRemoteControlOwnerApi.class);
        TerminalControlOwnerApi terminal = mock(TerminalControlOwnerApi.class);
        LiveKitRemoteControlRoomTerminator rooms = mock(LiveKitRemoteControlRoomTerminator.class);
        TerminalRemoteControlEndCoordinator coordinator =
                new TerminalRemoteControlEndCoordinator(owner, terminal, rooms, new ObjectMapper());
        EndCommand command = new EndCommand(UUID.randomUUID(), "acceptance-workspace", UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), 1, UUID.randomUUID(), UUID.randomUUID(), "ADMIN_ENDED", null, null);
        EndReadback ended = new EndReadback(UUID.randomUUID(), State.ENDED, "ADMIN_ENDED", Instant.now(),
                "rc_test-room", List.of("endpoint-test"), "acceptance-workspace", UUID.randomUUID(), 4);
        when(owner.end(command)).thenReturn(ended);
        when(terminal.invokeOnline(any())).thenReturn(new InvocationResult(InvocationOutcome.QUEUED, null));
        when(rooms.endRoom(ended.roomName(), ended.participantIdentities()))
                .thenReturn(new LiveKitRemoteControlRoomTerminator.CleanupResult(1, true, 0));

        assertSame(ended, coordinator.end(command));
        assertSame(ended, coordinator.end(command));

        ArgumentCaptor<InvokeOnlineCommand> commands = ArgumentCaptor.forClass(InvokeOnlineCommand.class);
        verify(terminal, times(2)).invokeOnline(commands.capture());
        InvokeOnlineCommand first = commands.getAllValues().get(0);
        InvokeOnlineCommand replay = commands.getAllValues().get(1);
        assertEquals("kernel.base.remote-control.stop-remote-control", first.commandName());
        assertEquals(ended.sessionId().toString(), first.parameters().path("sessionId").asText());
        assertEquals(first.operationId(), replay.operationId(), "replay must address the same online stop fact");
        assertEquals(first.requestId(), replay.requestId(), "replay must not create a second stop request");
        verify(owner, times(2)).end(command);
        verify(rooms, times(2)).endRoom(ended.roomName(), ended.participantIdentities());
    }

    @Test
    void terminalStopFailureDoesNotUndoEndedFactOrSkipRoomCleanup() {
        TerminalRemoteControlOwnerApi owner = mock(TerminalRemoteControlOwnerApi.class);
        TerminalControlOwnerApi terminal = mock(TerminalControlOwnerApi.class);
        LiveKitRemoteControlRoomTerminator rooms = mock(LiveKitRemoteControlRoomTerminator.class);
        TerminalRemoteControlEndCoordinator coordinator =
                new TerminalRemoteControlEndCoordinator(owner, terminal, rooms, new ObjectMapper());
        EndCommand command = new EndCommand(UUID.randomUUID(), "acceptance-workspace", UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), 1, UUID.randomUUID(), UUID.randomUUID(), "ADMIN_ENDED", null, null);
        EndReadback ended = new EndReadback(UUID.randomUUID(), State.ENDED, "ADMIN_ENDED", Instant.now(),
                "rc_test-room", List.of(), "acceptance-workspace", UUID.randomUUID(), 4);
        when(owner.end(command)).thenReturn(ended);
        doThrow(new IllegalStateException("secret-bearing failure text")).when(terminal).invokeOnline(any());
        when(rooms.endRoom(ended.roomName(), ended.participantIdentities()))
                .thenReturn(new LiveKitRemoteControlRoomTerminator.CleanupResult(0, true, 0));

        assertSame(ended, coordinator.end(command));

        verify(rooms).endRoom(ended.roomName(), ended.participantIdentities());
    }
}
