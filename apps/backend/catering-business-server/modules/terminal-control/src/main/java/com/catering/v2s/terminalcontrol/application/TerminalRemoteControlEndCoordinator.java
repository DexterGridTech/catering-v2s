package com.catering.v2s.terminalcontrol.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.EndCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.EndReadback;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Ends persisted control first, then asks the terminal and LiveKit to release this session. */
@Component
public final class TerminalRemoteControlEndCoordinator {
    private static final Logger log = LoggerFactory.getLogger(TerminalRemoteControlEndCoordinator.class);

    private final TerminalRemoteControlOwnerApi owner;
    private final TerminalControlOwnerApi terminal;
    private final LiveKitRemoteControlRoomTerminator rooms;
    private final ObjectMapper json;

    public TerminalRemoteControlEndCoordinator(TerminalRemoteControlOwnerApi owner,
            TerminalControlOwnerApi terminal, LiveKitRemoteControlRoomTerminator rooms, ObjectMapper json) {
        this.owner = owner;
        this.terminal = terminal;
        this.rooms = rooms;
        this.json = json;
    }

    public EndReadback end(EndCommand command) {
        EndReadback ended = owner.end(command);
        String stopOutcome = requestTerminalStop(ended);
        var cleanup = rooms.endRoom(ended.roomName(), ended.participantIdentities());
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_END_CLEANUP")
                .addKeyValue("sessionId", ended.sessionId())
                .addKeyValue("terminalStop", stopOutcome)
                .addKeyValue("participantsRemoved", cleanup.participantsRemoved())
                .addKeyValue("roomDeleted", cleanup.roomDeleted())
                .addKeyValue("cleanupFailures", cleanup.failures())
                .log("event=TERMINAL_REMOTE_CONTROL_END_CLEANUP");
        return ended;
    }

    private String requestTerminalStop(EndReadback ended) {
        UUID operationId = stableId("remote-control-stop-operation", ended.sessionId());
        UUID requestId = stableId("remote-control-stop-request", ended.sessionId());
        ObjectNode parameters = json.createObjectNode();
        parameters.put("sessionId", ended.sessionId().toString());
        parameters.put("reason", ended.reason());
        try {
            var result = terminal.invokeOnline(new InvokeOnlineCommand(operationId, requestId,
                    ended.groupWorkspaceKey(), ended.terminalRef(), ended.bindingGeneration(),
                    "kernel.base.remote-control.stop-remote-control", parameters));
            log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_STOP_DISPATCH")
                    .addKeyValue("sessionId", ended.sessionId())
                    .addKeyValue("operationId", operationId)
                    .addKeyValue("outcome", result.outcome())
                    .log("event=TERMINAL_REMOTE_CONTROL_STOP_DISPATCH");
            return result.outcome().name();
        } catch (RuntimeException failure) {
            log.atWarn().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_STOP_DISPATCH_FAILED")
                    .addKeyValue("sessionId", ended.sessionId())
                    .addKeyValue("failureType", failure.getClass().getSimpleName())
                    .log("event=TERMINAL_REMOTE_CONTROL_STOP_DISPATCH_FAILED");
            return "FAILED";
        }
    }

    private static UUID stableId(String purpose, UUID sessionId) {
        return UUID.nameUUIDFromBytes((purpose + ":" + sessionId).getBytes(StandardCharsets.UTF_8));
    }
}
