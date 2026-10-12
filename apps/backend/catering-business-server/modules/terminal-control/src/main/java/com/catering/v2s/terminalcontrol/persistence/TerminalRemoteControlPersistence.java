package com.catering.v2s.terminalcontrol.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Explicit session-owner SQL. It never reads or writes the media payload or token. */
@Repository
public class TerminalRemoteControlPersistence {
    private static final String READ_BINDING = """
            SELECT b.workspace_uuid,t.store_ref,b.generation,b.bound_device_id
            FROM terminal_binding.latest_binding b
            JOIN store_terminal.terminal t ON t.workspace_uuid=b.workspace_uuid
             AND t.group_workspace_key=b.group_workspace_key AND t.terminal_ref=b.terminal_ref
            JOIN platform_workspace.group_workspace w ON w.group_workspace_key=b.group_workspace_key
            WHERE b.workspace_uuid=? AND b.group_workspace_key=? AND b.terminal_ref=? AND b.generation=?
              AND b.binding_status='ACTIVE' AND t.status='ENABLED' AND w.status='ENABLED'
            """;
    private static final String READ_CURRENT_BINDING = """
            SELECT b.workspace_uuid,t.store_ref,b.generation,b.bound_device_id
            FROM terminal_binding.latest_binding b
            JOIN store_terminal.terminal t ON t.workspace_uuid=b.workspace_uuid
             AND t.group_workspace_key=b.group_workspace_key AND t.terminal_ref=b.terminal_ref
            JOIN platform_workspace.group_workspace w ON w.group_workspace_key=b.group_workspace_key
            WHERE b.workspace_uuid=? AND b.group_workspace_key=? AND b.terminal_ref=?
              AND b.binding_status='ACTIVE' AND t.status='ENABLED' AND w.status='ENABLED'
            """;
    private static final String READ_TARGET = """
            SELECT node_id,session_id,session_sequence
            FROM terminal_connection.latest_state
            WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?
              AND disconnected_at_epoch_millis IS NULL
            """;
    private static final String SELECT_FIELDS = """
            SELECT session_id,workspace_uuid,group_workspace_key,project_ref,store_ref,terminal_ref,
                   binding_generation,device_identity,target_node_id,target_session_id,target_session_sequence,
                   actor_account_ref,actor_session_ref,request_id,start_operation_id,topology_kind,
                   peer_module_name,peer_node_id,state,reason,
                   description_json::text,ready_screens_json::text,started_at,deadline_at,lease_expires_at,ended_at
            FROM terminal_control.remote_session
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public TerminalRemoteControlPersistence(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public void lockTerminal(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef) {
        AdvisoryLock.acquire(jdbc, "terminal-remote-control", workspaceUuid + ":" + groupWorkspaceKey,
                terminalRef.toString());
    }

    public BindingIdentity readActiveBinding(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef,
            long generation) {
        List<BindingIdentity> rows = jdbc.query(READ_BINDING, (rs, row) -> new BindingIdentity(
                rs.getObject("workspace_uuid", UUID.class), rs.getObject("store_ref", UUID.class),
                rs.getLong("generation"), rs.getString("bound_device_id")), workspaceUuid, groupWorkspaceKey,
                terminalRef, generation);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public BindingIdentity readCurrentActiveBinding(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef) {
        List<BindingIdentity> rows = jdbc.query(READ_CURRENT_BINDING, (rs, row) -> new BindingIdentity(
                rs.getObject("workspace_uuid", UUID.class), rs.getObject("store_ref", UUID.class),
                rs.getLong("generation"), rs.getString("bound_device_id")), workspaceUuid, groupWorkspaceKey, terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public OnlineTarget readOnlineTarget(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef) {
        List<OnlineTarget> rows = jdbc.query(READ_TARGET, (rs, row) -> new OnlineTarget(
                rs.getString("node_id"), rs.getString("session_id"), rs.getLong("session_sequence")),
                workspaceUuid, groupWorkspaceKey, terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public RemoteSession findByRequest(UUID workspaceUuid, UUID accountRef, UUID requestId, boolean forUpdate) {
        return one(SELECT_FIELDS + " WHERE workspace_uuid=? AND actor_account_ref=? AND request_id=?"
                + (forUpdate ? " FOR UPDATE" : ""), workspaceUuid, accountRef, requestId);
    }

    public RemoteSession findForScope(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            UUID terminalRef, UUID sessionId, UUID accountRef, boolean forUpdate) {
        return one(SELECT_FIELDS + " WHERE session_id=? AND workspace_uuid=? AND group_workspace_key=? AND project_ref=?"
                + " AND terminal_ref=? AND actor_account_ref=?" + (forUpdate ? " FOR UPDATE" : ""),
                sessionId, workspaceUuid, groupWorkspaceKey, projectRef, terminalRef, accountRef);
    }

    public RemoteSession findById(UUID sessionId, boolean forUpdate) {
        return one(SELECT_FIELDS + " WHERE session_id=?" + (forUpdate ? " FOR UPDATE" : ""), sessionId);
    }

    public RemoteSession findActiveForTerminal(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef,
            boolean forUpdate) {
        String sql = SELECT_FIELDS
                + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? AND state IN ('STARTING','ACTIVE')"
                + " ORDER BY started_at DESC LIMIT 1" + (forUpdate ? " FOR UPDATE" : "");
        return one(sql, workspaceUuid, groupWorkspaceKey, terminalRef);
    }

    public void insertStart(StartRecord session) {
        jdbc.update("""
                INSERT INTO terminal_control.remote_session(
                  session_id,workspace_uuid,group_workspace_key,project_ref,store_ref,terminal_ref,binding_generation,
                  device_identity,target_node_id,target_session_id,target_session_sequence,actor_account_ref,
                  actor_session_ref,request_id,start_operation_id,state,started_at,deadline_at,lease_expires_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'STARTING',clock_timestamp(),
                        clock_timestamp()+INTERVAL '30 seconds',clock_timestamp()+INTERVAL '30 seconds')
                """, session.sessionId(), session.workspaceUuid(), session.groupWorkspaceKey(), session.projectRef(),
                session.storeRef(), session.terminalRef(), session.bindingGeneration(), session.deviceIdentity(),
                session.targetNodeId(), session.targetSessionId(), session.targetSessionSequence(),
                session.actorAccountRef(), session.actorSessionRef(), session.requestId(), session.startOperationId());
    }

    public boolean setDescription(UUID sessionId, String topologyKind, String peerModule, String peerNode,
            JsonNode description) {
        return jdbc.update("""
            UPDATE terminal_control.remote_session
                SET topology_kind=?, peer_module_name=?, peer_node_id=?, description_json=?::jsonb
                WHERE session_id=? AND state='STARTING' AND description_json IS NULL
                """, topologyKind, peerModule, peerNode, write(description), sessionId) == 1;
    }

    public boolean updateStatus(UUID sessionId, String state, String reason, JsonNode readyScreens,
            boolean renewLease, boolean end) {
        return jdbc.update("""
                UPDATE terminal_control.remote_session
                SET state=?, reason=?, ready_screens_json=?::jsonb,
                    lease_expires_at=CASE WHEN ? THEN clock_timestamp()+INTERVAL '30 seconds' ELSE lease_expires_at END,
                    ended_at=CASE WHEN ? THEN COALESCE(ended_at,clock_timestamp()) ELSE ended_at END
                WHERE session_id=? AND state<>'ENDED'
                """, state, reason, write(readyScreens), renewLease, end, sessionId) == 1;
    }

    public boolean endExpired(UUID sessionId, String reason) {
        return jdbc.update("""
                UPDATE terminal_control.remote_session
                SET state='ENDED', reason=?, ended_at=COALESCE(ended_at,
                    CASE WHEN state='STARTING' THEN deadline_at ELSE lease_expires_at END)
                WHERE session_id=? AND state IN ('STARTING','ACTIVE')
                  AND ((state='STARTING' AND deadline_at<=clock_timestamp())
                    OR (state='ACTIVE' AND lease_expires_at<=clock_timestamp()))
                """, reason, sessionId) == 1;
    }

    public Instant databaseNow() {
        Timestamp value = jdbc.queryForObject("SELECT clock_timestamp()", Timestamp.class);
        return Objects.requireNonNull(value, "database time").toInstant();
    }

    public String write(JsonNode value) {
        try { return json.writeValueAsString(Objects.requireNonNull(value, "json value")); }
        catch (JsonProcessingException invalid) { throw new IllegalArgumentException("remote-control JSON invalid", invalid); }
    }

    private RemoteSession one(String sql, Object... args) {
        List<RemoteSession> rows = jdbc.query(sql, this::map, args);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private RemoteSession map(ResultSet rs, int row) throws SQLException {
        return new RemoteSession(rs.getObject("session_id", UUID.class), rs.getObject("workspace_uuid", UUID.class),
                rs.getString("group_workspace_key"), rs.getObject("project_ref", UUID.class),
                rs.getObject("store_ref", UUID.class), rs.getObject("terminal_ref", UUID.class),
                rs.getLong("binding_generation"), rs.getString("device_identity"), rs.getString("target_node_id"),
                rs.getString("target_session_id"), rs.getLong("target_session_sequence"),
                rs.getObject("actor_account_ref", UUID.class), rs.getObject("actor_session_ref", UUID.class),
                rs.getObject("request_id", UUID.class), rs.getObject("start_operation_id", UUID.class),
                rs.getString("topology_kind"), rs.getString("peer_module_name"), rs.getString("peer_node_id"),
                rs.getString("state"), rs.getString("reason"), parseNullable(rs.getString("description_json")),
                parse(rs.getString("ready_screens_json")), rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("deadline_at").toInstant(), rs.getTimestamp("lease_expires_at").toInstant(),
                rs.getTimestamp("ended_at") == null ? null : rs.getTimestamp("ended_at").toInstant());
    }

    private JsonNode parse(String value) {
        try { return json.readTree(value); }
        catch (JsonProcessingException invalid) { throw new IllegalStateException("remote-control JSON corrupt", invalid); }
    }

    private JsonNode parseNullable(String value) { return value == null ? null : parse(value); }

    public record BindingIdentity(UUID workspaceUuid, UUID storeRef, long generation, String deviceIdentity) {}
    public record OnlineTarget(String nodeId, String sessionId, long sequence) {}
    public record StartRecord(UUID sessionId, UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            UUID storeRef, UUID terminalRef, long bindingGeneration, String deviceIdentity, String targetNodeId,
            String targetSessionId, long targetSessionSequence, UUID actorAccountRef, UUID actorSessionRef,
            UUID requestId, UUID startOperationId) {}
    public record RemoteSession(UUID sessionId, UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            UUID storeRef, UUID terminalRef, long bindingGeneration, String deviceIdentity, String targetNodeId,
            String targetSessionId, long targetSessionSequence, UUID actorAccountRef, UUID actorSessionRef,
            UUID requestId, UUID startOperationId, String topologyKind, String peerModule, String peerNode,
            String state, String reason, JsonNode description,
            JsonNode readyScreens, Instant startedAt, Instant deadlineAt, Instant leaseExpiresAt, Instant endedAt) {}
}
