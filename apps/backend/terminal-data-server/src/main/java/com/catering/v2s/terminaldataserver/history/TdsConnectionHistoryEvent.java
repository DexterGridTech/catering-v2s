package com.catering.v2s.terminaldataserver.history;

import com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepository.SessionIdentity;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Allowlisted append-only TDS connection history; deliberately contains no terminal credential or device id. */
public record TdsConnectionHistoryEvent(
        UUID eventId,
        long eventTimeEpochMillis,
        EventType eventType,
        UUID workspaceUuid,
        UUID terminalRef,
        String nodeId,
        String sessionId,
        long sessionSequence,
        Double rttMs,
        String closeReason) {

    public TdsConnectionHistoryEvent {
        Objects.requireNonNull(eventId, "eventId");
        if (eventTimeEpochMillis < 1) throw new IllegalArgumentException("TDS_HISTORY_EVENT_TIME_INVALID");
        Objects.requireNonNull(eventType, "eventType");
        Objects.requireNonNull(workspaceUuid, "workspaceUuid");
        Objects.requireNonNull(terminalRef, "terminalRef");
        requireText(nodeId, 128, "TDS_HISTORY_NODE_ID_INVALID");
        requireText(sessionId, 128, "TDS_HISTORY_SESSION_ID_INVALID");
        if (sessionSequence < 1) throw new IllegalArgumentException("TDS_HISTORY_SEQUENCE_INVALID");
        if (rttMs != null && (!Double.isFinite(rttMs) || rttMs < 0)) {
            throw new IllegalArgumentException("TDS_HISTORY_RTT_INVALID");
        }
        if (closeReason != null && (!closeReason.matches("[A-Z_]{1,48}"))) {
            throw new IllegalArgumentException("TDS_HISTORY_CLOSE_REASON_INVALID");
        }
        if (eventType == EventType.HEARTBEAT_RTT && (rttMs == null || closeReason != null)) {
            throw new IllegalArgumentException("TDS_HISTORY_RTT_SHAPE_INVALID");
        }
        if (eventType == EventType.CONNECTED && (rttMs != null || closeReason != null)) {
            throw new IllegalArgumentException("TDS_HISTORY_CONNECTED_SHAPE_INVALID");
        }
        if (eventType == EventType.DISCONNECTED && (rttMs != null || closeReason == null)) {
            throw new IllegalArgumentException("TDS_HISTORY_DISCONNECTED_SHAPE_INVALID");
        }
    }

    public static TdsConnectionHistoryEvent connected(SessionIdentity identity) {
        return from(identity, EventType.CONNECTED, null, null);
    }

    public static TdsConnectionHistoryEvent disconnected(SessionIdentity identity, String closeReason) {
        return from(identity, EventType.DISCONNECTED, null, closeReason);
    }

    public static TdsConnectionHistoryEvent heartbeat(SessionIdentity identity, double rttMs) {
        return from(identity, EventType.HEARTBEAT_RTT, rttMs, null);
    }

    private static TdsConnectionHistoryEvent from(
            SessionIdentity identity, EventType type, Double rttMs, String closeReason) {
        Objects.requireNonNull(identity, "identity");
        return new TdsConnectionHistoryEvent(
                UUID.randomUUID(),
                Instant.now().toEpochMilli(),
                type,
                identity.workspaceUuid(),
                identity.terminalRef(),
                identity.nodeId(),
                identity.sessionId(),
                identity.sequence(),
                rttMs,
                closeReason);
    }

    Map<String, Object> toDorisRow() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("event_id", eventId.toString());
        row.put("event_time_epoch_millis", eventTimeEpochMillis);
        row.put("event_type", eventType.name());
        row.put("workspace_uuid", workspaceUuid.toString());
        row.put("terminal_ref", terminalRef.toString());
        row.put("node_id", nodeId);
        row.put("session_id", sessionId);
        row.put("session_sequence", sessionSequence);
        row.put("rtt_ms", rttMs);
        row.put("close_reason", closeReason);
        return row;
    }

    private static void requireText(String value, int maximum, String code) {
        if (value == null || value.isBlank() || value.length() > maximum) throw new IllegalArgumentException(code);
    }

    public enum EventType {
        CONNECTED,
        DISCONNECTED,
        HEARTBEAT_RTT
    }
}
