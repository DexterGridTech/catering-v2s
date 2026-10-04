package com.catering.v2s.terminaldataserver.remote;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Calls only terminal-control's two granted functions; it never reads or writes the owner table. */
@Repository
public class TdsTerminalControlRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public TdsTerminalControlRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public ClaimedOperation claim(UUID operationId, String nodeId) {
        List<ClaimedOperation> rows = jdbc.query(
                "SELECT operation_id, request_id, terminal_ref, binding_generation, target_session_id, "
                        + "command_name, parameters FROM terminal_control.claim_online_operation(?, ?)",
                (result, row) -> new ClaimedOperation(
                        result.getObject("operation_id", UUID.class), result.getObject("request_id", UUID.class),
                        result.getObject("terminal_ref", UUID.class), result.getLong("binding_generation"),
                        result.getString("target_session_id"), result.getString("command_name"),
                        parse(result.getString("parameters"))),
                operationId, nodeId);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public boolean report(
            UUID reportId,
            UUID operationId,
            UUID requestId,
            long bindingGeneration,
            String sessionId,
            String nodeId,
            String phase,
            Instant occurredAt,
            JsonNode result,
            String errorCode) {
        List<Boolean> rows = jdbc.query(
                "SELECT accepted FROM terminal_control.accept_terminal_report("
                        + "?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
                (row, rowNumber) -> row.getBoolean("accepted"),
                reportId, operationId, requestId, bindingGeneration,
                nodeId, sessionId, phase, Timestamp.from(occurredAt),
                result == null ? null : write(result), errorCode);
        return !rows.isEmpty() && rows.getFirst();
    }

    private JsonNode parse(String value) {
        try {
            return mapper.readTree(value);
        } catch (JacksonException invalid) {
            throw new IllegalStateException("TDS_TERMINAL_CONTROL_PARAMETERS_INVALID", invalid);
        }
    }

    private String write(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JacksonException invalid) {
            throw new IllegalArgumentException("TDS_TERMINAL_CONTROL_RESULT_INVALID", invalid);
        }
    }

    public record ClaimedOperation(
            UUID operationId,
            UUID requestId,
            UUID terminalRef,
            long bindingGeneration,
            String targetSessionId,
            String commandName,
            JsonNode parameters) {}
}
