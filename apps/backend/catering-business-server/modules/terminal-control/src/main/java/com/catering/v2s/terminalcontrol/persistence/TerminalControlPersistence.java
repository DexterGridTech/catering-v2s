package com.catering.v2s.terminalcontrol.persistence;

import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.ClaimedOperation;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.InvokeOnlineCommand;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationStatus;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.OperationView;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.ReportAcceptance;
import com.catering.v2s.terminalcontrol.api.TerminalControlOwnerApi.TerminalReport;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.stereotype.Repository;

/** Explicit terminal-control task queries; this owner alone writes its operation table. */
@Repository
public class TerminalControlPersistence {
    private static final String READ_ACTIVE_BINDING = """
            SELECT b.workspace_uuid, t.store_ref
            FROM terminal_binding.latest_binding b
            JOIN store_terminal.terminal t
              ON t.workspace_uuid=b.workspace_uuid AND t.group_workspace_key=b.group_workspace_key
             AND t.terminal_ref=b.terminal_ref
            JOIN platform_workspace.group_workspace w ON w.group_workspace_key=b.group_workspace_key
            WHERE b.group_workspace_key=? AND b.terminal_ref=? AND b.generation=?
              AND b.binding_status='ACTIVE' AND t.status='ENABLED' AND w.status='ENABLED'
            """;
    private static final String READ_ONLINE_SESSION = """
            SELECT node_id, session_id, session_sequence
            FROM terminal_connection.latest_state
            WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?
              AND disconnected_at_epoch_millis IS NULL
            """;
    private static final String INSERT_OPERATION = """
            INSERT INTO terminal_control.online_operation(
              operation_id, request_id, workspace_uuid, group_workspace_key, store_ref, terminal_ref,
              binding_generation, target_node_id, target_session_id, target_session_sequence,
              status, command_name, parameters, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, clock_timestamp(), clock_timestamp())
            ON CONFLICT (operation_id) DO NOTHING
            """;
    private static final String MARK_OFFLINE = """
            INSERT INTO terminal_control.online_operation(
              operation_id, request_id, workspace_uuid, group_workspace_key, store_ref, terminal_ref,
              binding_generation, status, command_name, parameters, error_code, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'NOT_SENT', ?, ?::jsonb, 'TERMINAL_OFFLINE', clock_timestamp(), clock_timestamp())
            ON CONFLICT (operation_id) DO NOTHING
            """;
    private static final String READ_OPERATION = """
            SELECT operation_id, request_id, workspace_uuid, group_workspace_key, store_ref, terminal_ref,
                   binding_generation, target_node_id, target_session_id, status, command_name, parameters,
                   result, error_code, created_at, updated_at
            FROM terminal_control.online_operation WHERE operation_id=?
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public TerminalControlPersistence(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
    }

    public BindingTarget readActiveBinding(String groupWorkspaceKey, UUID terminalRef, long generation) {
        List<BindingTarget> matches = jdbc.query(READ_ACTIVE_BINDING, (rows, row) ->
                new BindingTarget(rows.getObject("workspace_uuid", UUID.class), rows.getObject("store_ref", UUID.class)),
                groupWorkspaceKey, terminalRef, generation);
        return matches.isEmpty() ? null : matches.getFirst();
    }

    public OnlineSession readOnlineSession(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef) {
        List<OnlineSession> matches = jdbc.query(READ_ONLINE_SESSION, (rows, row) ->
                new OnlineSession(rows.getString("node_id"), rows.getString("session_id"), rows.getLong("session_sequence")),
                workspaceUuid, groupWorkspaceKey, terminalRef);
        return matches.isEmpty() ? null : matches.getFirst();
    }

    public boolean insertQueued(InvokeOnlineCommand command, BindingTarget binding, OnlineSession session) {
        return jdbc.update(INSERT_OPERATION,
                command.operationId(), command.requestId(), binding.workspaceUuid(), command.groupWorkspaceKey(),
                binding.storeRef(), command.terminalRef(), command.bindingGeneration(), session.nodeId(),
                session.sessionId(), session.sequence(), OperationStatus.QUEUED.name(), command.commandName(), write(command.parameters())) == 1;
    }

    public boolean insertOffline(InvokeOnlineCommand command, BindingTarget binding) {
        return jdbc.update(MARK_OFFLINE,
                command.operationId(), command.requestId(), binding.workspaceUuid(), command.groupWorkspaceKey(),
                binding.storeRef(), command.terminalRef(), command.bindingGeneration(), command.commandName(),
                write(command.parameters())) == 1;
    }

    public void notifyTarget(UUID operationId) {
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            try (var statement = connection.prepareStatement("SELECT pg_notify('terminal_control_events', ?)");) {
                statement.setString(1, operationId.toString());
                statement.execute();
            }
            return null;
        });
    }

    public OperationView readOperation(UUID operationId) {
        List<OperationView> matches = jdbc.query(READ_OPERATION, this::mapOperation, operationId);
        return matches.isEmpty() ? null : matches.getFirst();
    }

    public ClaimedOperation claim(UUID operationId, String nodeId) {
        List<ClaimedOperation> matches = jdbc.query(
                "SELECT operation_id, request_id, terminal_ref, binding_generation, target_session_id, "
                        + "command_name, parameters FROM terminal_control.claim_online_operation(?, ?)",
                (rows, row) -> new ClaimedOperation(
                        rows.getObject("operation_id", UUID.class), rows.getObject("request_id", UUID.class),
                        rows.getObject("terminal_ref", UUID.class), rows.getLong("binding_generation"),
                        rows.getString("target_session_id"), rows.getString("command_name"),
                        parse(rows.getString("parameters"))),
                operationId, nodeId);
        return matches.isEmpty() ? null : matches.getFirst();
    }

    public ReportAcceptance accept(TerminalReport report) {
        List<ReportAcceptance> matches = jdbc.query(
                "SELECT accepted, accepted_at FROM terminal_control.accept_terminal_report("
                        + "?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
                (rows, row) -> new ReportAcceptance(rows.getBoolean("accepted"), rows.getTimestamp("accepted_at").toInstant()),
                report.reportId(), report.operationId(), report.requestId(), report.bindingGeneration(),
                report.nodeId(), report.sessionId(), report.phase().name(), java.sql.Timestamp.from(report.occurredAt()),
                report.result() == null ? null : write(report.result()), report.errorCode());
        if (matches.isEmpty()) {
            throw new IllegalStateException("TERMINAL_CONTROL_REPORT_ACCEPTANCE_RESULT_MISSING");
        }
        return matches.getFirst();
    }

    private OperationView mapOperation(ResultSet rows, int row) throws SQLException {
        return new OperationView(
                rows.getObject("operation_id", UUID.class), rows.getObject("request_id", UUID.class),
                rows.getObject("workspace_uuid", UUID.class), rows.getString("group_workspace_key"),
                rows.getObject("store_ref", UUID.class), rows.getObject("terminal_ref", UUID.class),
                rows.getLong("binding_generation"), rows.getString("target_node_id"), rows.getString("target_session_id"),
                OperationStatus.valueOf(rows.getString("status")), rows.getString("command_name"),
                parseNullable(rows.getString("parameters")), parseNullable(rows.getString("result")), rows.getString("error_code"),
                rows.getTimestamp("created_at").toInstant(), rows.getTimestamp("updated_at").toInstant());
    }

    private String write(JsonNode value) {
        try { return json.writeValueAsString(value); }
        catch (JsonProcessingException invalid) { throw new IllegalArgumentException("terminal operation JSON is invalid", invalid); }
    }

    private JsonNode parse(String value) {
        try { return json.readTree(value); }
        catch (JsonProcessingException invalid) { throw new IllegalStateException("terminal operation JSON is corrupt", invalid); }
    }

    private JsonNode parseNullable(String value) { return value == null ? null : parse(value); }

    public record BindingTarget(UUID workspaceUuid, UUID storeRef) {}
    public record OnlineSession(String nodeId, String sessionId, long sequence) {}
}
