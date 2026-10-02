package com.catering.v2s.terminaldataserver.state;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Persists only the latest TDS session state and coalesced heartbeat facts. */
@Repository
public class TdsConnectionStateRepository {
    private static final String OPEN_SESSION =
            """
            WITH next_state AS (
                SELECT nextval('terminal_connection.session_sequence') AS session_sequence,
                       floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_epoch_millis
            ), written AS (
                INSERT INTO terminal_connection.latest_state(
                    workspace_uuid, group_workspace_key, terminal_ref, node_id, session_id,
                    session_sequence, connected_at_epoch_millis, disconnected_at_epoch_millis,
                    last_activity_at_epoch_millis, last_rtt_ms, close_reason)
                SELECT ?, ?, ?, ?, ?, next_state.session_sequence, next_state.now_epoch_millis,
                       NULL, next_state.now_epoch_millis, 0, NULL
                FROM next_state
                ON CONFLICT (workspace_uuid, group_workspace_key, terminal_ref) DO UPDATE SET
                    node_id = EXCLUDED.node_id,
                    session_id = EXCLUDED.session_id,
                    session_sequence = EXCLUDED.session_sequence,
                    connected_at_epoch_millis = EXCLUDED.connected_at_epoch_millis,
                    disconnected_at_epoch_millis = NULL,
                    last_activity_at_epoch_millis = EXCLUDED.last_activity_at_epoch_millis,
                    last_rtt_ms = 0,
                    close_reason = NULL
                WHERE terminal_connection.latest_state.session_sequence < EXCLUDED.session_sequence
                RETURNING workspace_uuid, group_workspace_key, terminal_ref,
                          session_sequence, connected_at_epoch_millis
            ), notified AS (
                SELECT pg_notify(
                    'terminal_binding_events',
                    json_build_object('v', 1, 'kind', 'SESSION_OPEN', 'terminalRef', written.terminal_ref)::text)
                FROM written
            )
            SELECT written.session_sequence, written.connected_at_epoch_millis
            FROM written CROSS JOIN notified
            """;

    private static final String WRITE_HEARTBEAT =
            """
            UPDATE terminal_connection.latest_state
            SET last_activity_at_epoch_millis = floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
                last_rtt_ms = ?
            WHERE workspace_uuid = ? AND group_workspace_key = ? AND terminal_ref = ?
              AND node_id = ? AND session_id = ? AND session_sequence = ?
              AND disconnected_at_epoch_millis IS NULL
            """;

    private static final String WRITE_DISCONNECT =
            """
            UPDATE terminal_connection.latest_state
            SET disconnected_at_epoch_millis = floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
                last_activity_at_epoch_millis = floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
                close_reason = ?
            WHERE workspace_uuid = ? AND group_workspace_key = ? AND terminal_ref = ?
              AND node_id = ? AND session_id = ? AND session_sequence = ?
              AND disconnected_at_epoch_millis IS NULL
            """;

    private static final String READ_LATEST_SESSION =
            """
            SELECT session_sequence, disconnected_at_epoch_millis
            FROM terminal_connection.latest_state
            WHERE workspace_uuid = ? AND group_workspace_key = ? AND terminal_ref = ?
            """;

    private static final String READ_CURRENT_SESSIONS = "WITH requested(group_workspace_key, terminal_ref) AS ("
            + "SELECT * FROM unnest(CAST(? AS varchar[]), CAST(? AS uuid[])) "
            + "AS requested_keys(group_workspace_key, terminal_ref)) "
            + "SELECT requested.group_workspace_key, requested.terminal_ref, state.workspace_uuid, "
            + "state.node_id, state.session_id, state.session_sequence, state.disconnected_at_epoch_millis "
            + "FROM requested LEFT JOIN terminal_connection.latest_state state "
            + "ON state.group_workspace_key=requested.group_workspace_key "
            + "AND state.terminal_ref=requested.terminal_ref";

    private static final String READ_CURRENT_SESSION =
            "SELECT workspace_uuid, group_workspace_key, terminal_ref, node_id, session_id, session_sequence, "
                    + "disconnected_at_epoch_millis FROM terminal_connection.latest_state "
                    + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?";

    private static final RowMapper<OpenedSession> OPENED_SESSION_MAPPER = (result, rowNumber) ->
            new OpenedSession(result.getLong("session_sequence"), result.getLong("connected_at_epoch_millis"));

    private final JdbcTemplate jdbcTemplate;

    public TdsConnectionStateRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = Objects.requireNonNull(jdbcTemplate, "jdbcTemplate");
    }

    public Optional<SessionIdentity> open(Verification verification, String nodeId, String sessionId) {
        if (verification == null || verification.outcome() != Outcome.VERIFIED) {
            throw new IllegalArgumentException("TDS_SESSION_VERIFICATION_INVALID");
        }
        requireText(nodeId, "nodeId", 128);
        requireText(sessionId, "sessionId", 128);
        Collection<OpenedSession> opened = jdbcTemplate.query(
                OPEN_SESSION,
                OPENED_SESSION_MAPPER,
                verification.workspaceUuid(),
                verification.groupWorkspaceKey(),
                verification.terminalRef(),
                nodeId,
                sessionId);
        if (opened.isEmpty()) return Optional.empty();
        if (opened.size() != 1) throw new IllegalStateException("TDS_SESSION_STATE_OPEN_FAILED");
        OpenedSession row = opened.iterator().next();
        return Optional.of(new SessionIdentity(
                verification.workspaceUuid(),
                verification.groupWorkspaceKey(),
                verification.terminalRef(),
                nodeId,
                sessionId,
                row.sequence(),
                Instant.ofEpochMilli(row.connectedAtEpochMillis())));
    }

    public Map<BindingKey, CurrentSessionState> readCurrentSessions(Connection connection, Collection<BindingKey> keys)
            throws SQLException {
        if (keys.isEmpty()) return Map.of();
        String[] groupWorkspaceKeys =
                keys.stream().map(BindingKey::groupWorkspaceKey).toArray(String[]::new);
        UUID[] terminalRefs = keys.stream().map(BindingKey::terminalRef).toArray(UUID[]::new);
        Map<BindingKey, CurrentSessionState> sessions = new HashMap<>();
        Array groupWorkspaceKeyArray = connection.createArrayOf("varchar", groupWorkspaceKeys);
        try {
            Array terminalRefArray = connection.createArrayOf("uuid", terminalRefs);
            try {
                try (PreparedStatement statement = connection.prepareStatement(READ_CURRENT_SESSIONS)) {
                    statement.setArray(1, groupWorkspaceKeyArray);
                    statement.setArray(2, terminalRefArray);
                    try (java.sql.ResultSet rows = statement.executeQuery()) {
                        while (rows.next()) {
                            UUID workspaceUuid = rows.getObject("workspace_uuid", UUID.class);
                            if (workspaceUuid == null) continue;
                            BindingKey key = new BindingKey(
                                    rows.getString("group_workspace_key"), rows.getObject("terminal_ref", UUID.class));
                            sessions.put(
                                    key,
                                    new CurrentSessionState(
                                            key,
                                            workspaceUuid,
                                            rows.getString("node_id"),
                                            rows.getString("session_id"),
                                            rows.getLong("session_sequence"),
                                            rows.getObject("disconnected_at_epoch_millis", Long.class)));
                        }
                    }
                }
            } finally {
                terminalRefArray.free();
            }
        } finally {
            groupWorkspaceKeyArray.free();
        }
        return Map.copyOf(sessions);
    }

    public Optional<CurrentSessionState> readCurrentSession(SessionIdentity identity) {
        Objects.requireNonNull(identity, "identity");
        return jdbcTemplate.query(
                READ_CURRENT_SESSION,
                rows -> rows.next()
                        ? Optional.of(new CurrentSessionState(
                                new BindingKey(identity.groupWorkspaceKey(), identity.terminalRef()),
                                rows.getObject("workspace_uuid", UUID.class),
                                rows.getString("node_id"),
                                rows.getString("session_id"),
                                rows.getLong("session_sequence"),
                                rows.getObject("disconnected_at_epoch_millis", Long.class)))
                        : Optional.empty(),
                identity.workspaceUuid(),
                identity.groupWorkspaceKey(),
                identity.terminalRef());
    }

    public int writeHeartbeats(Collection<Heartbeat> heartbeats) {
        if (heartbeats.isEmpty()) return 0;
        int[][] counts = jdbcTemplate.batchUpdate(
                WRITE_HEARTBEAT, heartbeats, heartbeats.size(), (PreparedStatement statement, Heartbeat heartbeat) -> {
                    statement.setDouble(1, heartbeat.lastRttMs());
                    bindIdentity(statement, heartbeat.session(), 2);
                });
        int updated = 0;
        for (int[] batch : counts) {
            for (int count : batch) {
                if (count > 0 || count == Statement.SUCCESS_NO_INFO) updated++;
            }
        }
        return updated;
    }

    public boolean writeDisconnect(SessionIdentity session, String closeReason) {
        requireText(closeReason, "closeReason", 48);
        if (!closeReason.matches("[A-Z_]+")) throw new IllegalArgumentException("TDS_CLOSE_REASON_INVALID");
        int updated = jdbcTemplate.update(WRITE_DISCONNECT, statement -> {
            statement.setString(1, closeReason);
            bindIdentity(statement, session, 2);
        });
        if (updated == 1) return true;

        LatestSession latest = jdbcTemplate.query(
                READ_LATEST_SESSION,
                result -> result.next()
                        ? new LatestSession(
                                result.getLong("session_sequence"),
                                result.getObject("disconnected_at_epoch_millis", Long.class))
                        : null,
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                session.terminalRef());
        if (latest != null
                && (latest.sequence() > session.sequence()
                        || latest.sequence() == session.sequence() && latest.disconnectedAtEpochMillis() != null)) {
            return true;
        }
        throw new IllegalStateException("TDS_SESSION_STATE_DISCONNECT_NOT_PERSISTED");
    }

    public Map<BindingKey, CurrentBinding> readCurrentBindings(Connection connection, Collection<BindingKey> keys)
            throws SQLException {
        if (keys.isEmpty()) return Map.of();
        String sql = "WITH requested(group_workspace_key, terminal_ref) AS ("
                + "SELECT * FROM unnest(CAST(? AS varchar[]), CAST(? AS uuid[])) "
                + "AS requested_keys(group_workspace_key, terminal_ref)) "
                + "SELECT requested.group_workspace_key, requested.terminal_ref, binding.workspace_uuid, "
                + "binding.generation, binding.binding_status "
                + "FROM requested LEFT JOIN terminal_binding.latest_binding binding "
                + "ON binding.group_workspace_key=requested.group_workspace_key "
                + "AND binding.terminal_ref=requested.terminal_ref";
        String[] groupWorkspaceKeys =
                keys.stream().map(BindingKey::groupWorkspaceKey).toArray(String[]::new);
        UUID[] terminalRefs = keys.stream().map(BindingKey::terminalRef).toArray(UUID[]::new);
        Map<BindingKey, CurrentBinding> current = new HashMap<>();
        Array groupWorkspaceKeyArray = connection.createArrayOf("varchar", groupWorkspaceKeys);
        try {
            Array terminalRefArray = connection.createArrayOf("uuid", terminalRefs);
            try {
                try (PreparedStatement statement = connection.prepareStatement(sql)) {
                    statement.setArray(1, groupWorkspaceKeyArray);
                    statement.setArray(2, terminalRefArray);
                    try (java.sql.ResultSet rows = statement.executeQuery()) {
                        while (rows.next()) {
                            BindingKey key = new BindingKey(
                                    rows.getString("group_workspace_key"), rows.getObject("terminal_ref", UUID.class));
                            current.put(
                                    key,
                                    new CurrentBinding(
                                            key,
                                            rows.getObject("workspace_uuid", UUID.class),
                                            rows.getObject("generation", Long.class),
                                            rows.getString("binding_status")));
                        }
                    }
                }
            } finally {
                terminalRefArray.free();
            }
        } finally {
            groupWorkspaceKeyArray.free();
        }
        return Map.copyOf(current);
    }

    private static void bindIdentity(PreparedStatement statement, SessionIdentity session, int startIndex)
            throws java.sql.SQLException {
        statement.setObject(startIndex, session.workspaceUuid());
        statement.setString(startIndex + 1, session.groupWorkspaceKey());
        statement.setObject(startIndex + 2, session.terminalRef());
        statement.setString(startIndex + 3, session.nodeId());
        statement.setString(startIndex + 4, session.sessionId());
        statement.setLong(startIndex + 5, session.sequence());
    }

    private static void requireText(String value, String name, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }

    public record SessionIdentity(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID terminalRef,
            String nodeId,
            String sessionId,
            long sequence,
            Instant connectedAt) {
        public SessionIdentity {
            Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            requireText(groupWorkspaceKey, "groupWorkspaceKey", 64);
            Objects.requireNonNull(terminalRef, "terminalRef");
            requireText(nodeId, "nodeId", 128);
            requireText(sessionId, "sessionId", 128);
            if (sequence < 1) throw new IllegalArgumentException("sequence is invalid");
            Objects.requireNonNull(connectedAt, "connectedAt");
        }
    }

    public record BindingKey(String groupWorkspaceKey, UUID terminalRef) {
        public BindingKey {
            requireText(groupWorkspaceKey, "groupWorkspaceKey", 64);
            Objects.requireNonNull(terminalRef, "terminalRef");
        }
    }

    public record CurrentBinding(BindingKey key, UUID workspaceUuid, Long generation, String bindingStatus) {
        public CurrentBinding {
            Objects.requireNonNull(key, "key");
            if (generation == null) {
                if (workspaceUuid != null || bindingStatus != null) {
                    throw new IllegalArgumentException("missing binding result has facts");
                }
            } else if (workspaceUuid == null || bindingStatus == null || generation < 1) {
                throw new IllegalArgumentException("current binding result is invalid");
            }
        }
    }

    public record CurrentSessionState(
            BindingKey key,
            UUID workspaceUuid,
            String nodeId,
            String sessionId,
            long sequence,
            Long disconnectedAtEpochMillis) {
        public CurrentSessionState {
            Objects.requireNonNull(key, "key");
            Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            requireText(nodeId, "nodeId", 128);
            requireText(sessionId, "sessionId", 128);
            if (sequence < 1) throw new IllegalArgumentException("sequence is invalid");
        }

        public boolean isOpen() {
            return disconnectedAtEpochMillis == null;
        }

        public boolean matches(SessionIdentity identity) {
            return key.groupWorkspaceKey().equals(identity.groupWorkspaceKey())
                    && key.terminalRef().equals(identity.terminalRef())
                    && workspaceUuid.equals(identity.workspaceUuid())
                    && nodeId.equals(identity.nodeId())
                    && sessionId.equals(identity.sessionId())
                    && sequence == identity.sequence();
        }
    }

    public record Heartbeat(SessionIdentity session, double lastRttMs) {
        public Heartbeat {
            Objects.requireNonNull(session, "session");
            if (!Double.isFinite(lastRttMs) || lastRttMs < 0) {
                throw new IllegalArgumentException("lastRttMs is invalid");
            }
        }
    }

    private record OpenedSession(long sequence, long connectedAtEpochMillis) {}

    private record LatestSession(long sequence, Long disconnectedAtEpochMillis) {}
}
