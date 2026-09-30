package com.catering.v2s.terminalbinding.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationCandidate;
import java.sql.PreparedStatement;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for current terminal-binding state and its transaction-owned receipt. */
@Repository
public class TerminalBindingOwnerPersistence {
    private static final RowMapper<LockedBinding> LOCKED_BINDING = (result, ignored) -> new LockedBinding(
            result.getString("binding_status"),
            result.getLong("generation"),
            result.getBytes("credential_digest"),
            result.getString("bound_device_id"),
            result.getLong("activated_at_epoch_millis"),
            nullableLong(result, "ended_at_epoch_millis"),
            result.getString("end_reason"),
            nullableLong(result, "most_recent_ended_generation"),
            result.getBytes("most_recent_ended_credential_digest"),
            nullableLong(result, "most_recent_ended_at_epoch_millis"),
            result.getString("most_recent_ended_reason"));

    private static final RowMapper<AuthenticationFacts> AUTHENTICATION_FACTS =
            (result, ignored) -> new AuthenticationFacts(
                    result.getObject("workspace_uuid", UUID.class),
                    result.getString("group_status"),
                    result.getObject("store_ref", UUID.class),
                    result.getString("store_status"),
                    result.getString("terminal_status"),
                    nullableLong(result, "generation"),
                    result.getBytes("credential_digest"),
                    result.getString("binding_status"),
                    result.getString("bound_device_id"),
                    nullableLong(result, "activated_at_epoch_millis"));

    private final JdbcTemplate jdbc;

    public TerminalBindingOwnerPersistence(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public ActivationFacts readActivationFacts(ActivationCandidate candidate) {
        if (!candidate.activationCodeFound()) {
            List<String> rows = jdbc.query(
                    "SELECT status FROM platform_workspace.group_workspace "
                            + "WHERE workspace_uuid=? AND group_workspace_key=?",
                    (result, ignored) -> result.getString("status"),
                    candidate.workspaceUuid(),
                    candidate.groupWorkspaceKey());
            return rows.isEmpty() ? null : new ActivationFacts(rows.getFirst(), null, null, null, null);
        }
        List<ActivationFacts> rows = jdbc.query(
                """
                SELECT workspace.status AS group_status, store.status AS store_status,
                       terminal.store_ref, terminal.status AS terminal_status, terminal.device_type
                FROM platform_workspace.group_workspace workspace
                JOIN store_terminal.terminal terminal
                  ON terminal.workspace_uuid=workspace.workspace_uuid
                 AND terminal.group_workspace_key=workspace.group_workspace_key
                JOIN organization.store store
                  ON store.workspace_uuid=terminal.workspace_uuid
                 AND store.group_workspace_key=terminal.group_workspace_key
                 AND store.id=terminal.store_ref
                WHERE workspace.workspace_uuid=? AND workspace.group_workspace_key=?
                  AND terminal.terminal_ref=?
                """,
                (result, ignored) -> new ActivationFacts(
                        result.getString("group_status"),
                        result.getString("store_status"),
                        result.getObject("store_ref", UUID.class),
                        result.getString("terminal_status"),
                        result.getString("device_type")),
                candidate.workspaceUuid(),
                candidate.groupWorkspaceKey(),
                candidate.terminalRef());
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public LockedBinding lockLatest(UUID workspaceUuid, String groupKey, UUID terminalRef) {
        List<LockedBinding> rows = jdbc.query(
                "SELECT binding_status, generation, credential_digest, bound_device_id, activated_at_epoch_millis, "
                        + "ended_at_epoch_millis, end_reason, most_recent_ended_generation, "
                        + "most_recent_ended_credential_digest, most_recent_ended_at_epoch_millis, "
                        + "most_recent_ended_reason FROM terminal_binding.latest_binding "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? FOR UPDATE",
                LOCKED_BINDING,
                workspaceUuid,
                groupKey,
                terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public ActivationWrite insertFirstActive(
            UUID workspaceUuid, String groupKey, UUID terminalRef, byte[] digest, String deviceId) {
        List<ActivationWrite> rows = jdbc.query(
                """
                WITH activation_clock AS (
                  SELECT floor(extract(epoch FROM transaction_timestamp()) * 1000)::bigint AS activated_at
                )
                INSERT INTO terminal_binding.latest_binding(
                  workspace_uuid, group_workspace_key, terminal_ref, generation, credential_digest,
                  binding_status, bound_device_id, activated_at_epoch_millis
                )
                SELECT ?, ?, ?, 1, ?, 'ACTIVE', ?, activation_clock.activated_at FROM activation_clock
                RETURNING generation, activated_at_epoch_millis
                """,
                (result, ignored) ->
                        new ActivationWrite(result.getLong("generation"), result.getLong("activated_at_epoch_millis")),
                workspaceUuid,
                groupKey,
                terminalRef,
                digest,
                deviceId);
        if (rows.size() != 1) throw new IllegalStateException("terminal-binding insert returned no row");
        return rows.getFirst();
    }

    public ActivationWrite reactivate(
            UUID workspaceUuid, String groupKey, UUID terminalRef, byte[] digest, String deviceId) {
        List<ActivationWrite> rows = jdbc.query(
                """
                WITH activation_clock AS (
                  SELECT floor(extract(epoch FROM transaction_timestamp()) * 1000)::bigint AS activated_at
                )
                UPDATE terminal_binding.latest_binding binding
                SET most_recent_ended_generation = CASE WHEN binding.binding_status='ACTIVE'
                      THEN binding.generation ELSE binding.most_recent_ended_generation END,
                    most_recent_ended_credential_digest = CASE WHEN binding.binding_status='ACTIVE'
                      THEN binding.credential_digest ELSE binding.most_recent_ended_credential_digest END,
                    most_recent_ended_at_epoch_millis = CASE WHEN binding.binding_status='ACTIVE'
                      THEN activation_clock.activated_at ELSE binding.most_recent_ended_at_epoch_millis END,
                    most_recent_ended_reason = CASE WHEN binding.binding_status='ACTIVE'
                      THEN 'REACTIVATED' ELSE binding.most_recent_ended_reason END,
                    generation = binding.generation + 1,
                    credential_digest = ?,
                    binding_status = 'ACTIVE',
                    bound_device_id = ?,
                    activated_at_epoch_millis = activation_clock.activated_at,
                    ended_at_epoch_millis = NULL,
                    end_reason = NULL
                FROM activation_clock
                WHERE binding.workspace_uuid=? AND binding.group_workspace_key=? AND binding.terminal_ref=?
                RETURNING binding.generation, binding.activated_at_epoch_millis
                """,
                (result, ignored) ->
                        new ActivationWrite(result.getLong("generation"), result.getLong("activated_at_epoch_millis")),
                digest,
                deviceId,
                workspaceUuid,
                groupKey,
                terminalRef);
        if (rows.size() != 1) throw new IllegalStateException("locked terminal binding was not reactivated");
        return rows.getFirst();
    }

    public Long endActive(UUID workspaceUuid, String groupKey, UUID terminalRef, String endReason) {
        List<Long> rows = jdbc.query(
                """
                WITH ended_clock AS (
                  SELECT floor(extract(epoch FROM transaction_timestamp()) * 1000)::bigint AS ended_at
                )
                UPDATE terminal_binding.latest_binding binding
                SET binding_status='ENDED',
                    bound_device_id=NULL,
                    ended_at_epoch_millis=ended_clock.ended_at,
                    end_reason=?,
                    most_recent_ended_generation=binding.generation,
                    most_recent_ended_credential_digest=binding.credential_digest,
                    most_recent_ended_at_epoch_millis=ended_clock.ended_at,
                    most_recent_ended_reason=?
                FROM ended_clock
                WHERE binding.workspace_uuid=? AND binding.group_workspace_key=? AND binding.terminal_ref=?
                  AND binding.binding_status='ACTIVE'
                RETURNING binding.ended_at_epoch_millis
                """,
                (result, ignored) -> result.getLong("ended_at_epoch_millis"),
                endReason,
                endReason,
                workspaceUuid,
                groupKey,
                terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public AuthenticationFacts readAuthenticationFacts(String groupKey, UUID terminalRef) {
        List<AuthenticationFacts> rows = jdbc.query(
                """
                SELECT workspace.workspace_uuid, workspace.status AS group_status,
                       terminal.store_ref, store.status AS store_status, terminal.status AS terminal_status,
                       binding.generation, binding.credential_digest, binding.binding_status,
                       binding.bound_device_id, binding.activated_at_epoch_millis
                FROM platform_workspace.group_workspace workspace
                LEFT JOIN store_terminal.terminal terminal
                  ON terminal.workspace_uuid=workspace.workspace_uuid
                 AND terminal.group_workspace_key=workspace.group_workspace_key
                 AND terminal.terminal_ref=?
                LEFT JOIN organization.store store
                  ON store.workspace_uuid=terminal.workspace_uuid
                 AND store.group_workspace_key=terminal.group_workspace_key
                 AND store.id=terminal.store_ref
                LEFT JOIN terminal_binding.latest_binding binding
                  ON binding.workspace_uuid=terminal.workspace_uuid
                 AND binding.group_workspace_key=terminal.group_workspace_key
                 AND binding.terminal_ref=terminal.terminal_ref
                WHERE workspace.group_workspace_key=?
                """,
                AUTHENTICATION_FACTS,
                terminalRef,
                groupKey);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void lockOperationsReceipt(UUID workspaceUuid, String groupKey, String idempotencyKey) {
        AdvisoryLock.acquireHashTextPair(
                jdbc, workspaceUuid + ":" + groupKey, "terminal-binding-receipt:" + idempotencyKey);
    }

    public Receipt findReceipt(UUID workspaceUuid, String groupKey, String idempotencyKey) {
        List<Receipt> rows = jdbc.query(
                "SELECT request_hash, response_json::text AS response_json "
                        + "FROM terminal_binding.command_receipt "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND idempotency_key=?",
                (result, ignored) -> new Receipt(result.getString("request_hash"), result.getString("response_json")),
                workspaceUuid,
                groupKey,
                idempotencyKey);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void saveReceipt(
            UUID workspaceUuid, String groupKey, String idempotencyKey, String requestHash, String responseJson) {
        jdbc.update(
                "INSERT INTO terminal_binding.command_receipt(" + "receipt_ref, workspace_uuid, group_workspace_key, "
                        + "idempotency_key, request_hash, response_json, created_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, ?::jsonb, "
                        + "floor(extract(epoch FROM transaction_timestamp()) * 1000)::bigint)",
                UUID.randomUUID(),
                workspaceUuid,
                groupKey,
                idempotencyKey,
                requestHash,
                responseJson);
    }

    public String readTerminalStatus(UUID workspaceUuid, String groupKey, UUID terminalRef) {
        List<String> rows = jdbc.query(
                "SELECT status FROM store_terminal.terminal "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                (result, ignored) -> result.getString("status"),
                workspaceUuid,
                groupKey,
                terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void notifyRevoked(UUID terminalRef, long revokedGeneration) {
        String payload =
                "{\"v\":1,\"terminalRef\":\"" + terminalRef + "\",\"revokedGeneration\":" + revokedGeneration + "}";
        jdbc.execute(
                (PreparedStatementCreator) connection -> {
                    PreparedStatement statement = connection.prepareStatement("SELECT pg_notify(?, ?)");
                    statement.setString(1, "terminal_binding_events");
                    statement.setString(2, payload);
                    return statement;
                },
                PreparedStatement::execute);
    }

    private static Long nullableLong(java.sql.ResultSet result, String column) throws java.sql.SQLException {
        long value = result.getLong(column);
        return result.wasNull() ? null : value;
    }

    public record ActivationFacts(
            String groupStatus, String storeStatus, UUID storeRef, String terminalStatus, String deviceType) {}

    public record ActivationWrite(long generation, long activatedAtEpochMillis) {}

    public record AuthenticationFacts(
            UUID workspaceUuid,
            String groupStatus,
            UUID storeRef,
            String storeStatus,
            String terminalStatus,
            Long generation,
            byte[] credentialDigest,
            String bindingStatus,
            String boundDeviceId,
            Long activatedAtEpochMillis) {
        public AuthenticationFacts {
            credentialDigest =
                    credentialDigest == null ? null : Arrays.copyOf(credentialDigest, credentialDigest.length);
        }

        @Override
        public byte[] credentialDigest() {
            return credentialDigest == null ? null : credentialDigest.clone();
        }

        @Override
        public String toString() {
            return "AuthenticationFacts[workspaceUuid=" + workspaceUuid + ", groupStatus=" + groupStatus
                    + ", storeRef=" + storeRef + ", storeStatus=" + storeStatus + ", terminalStatus="
                    + terminalStatus + ", generation=" + generation + ", credentialDigest=redacted]";
        }
    }

    public record LockedBinding(
            String status,
            long generation,
            byte[] credentialDigest,
            String boundDeviceId,
            long activatedAtEpochMillis,
            Long endedAtEpochMillis,
            String endReason,
            Long mostRecentEndedGeneration,
            byte[] mostRecentEndedCredentialDigest,
            Long mostRecentEndedAtEpochMillis,
            String mostRecentEndedReason) {
        public LockedBinding {
            credentialDigest = Arrays.copyOf(credentialDigest, credentialDigest.length);
            mostRecentEndedCredentialDigest = mostRecentEndedCredentialDigest == null
                    ? null
                    : Arrays.copyOf(mostRecentEndedCredentialDigest, mostRecentEndedCredentialDigest.length);
        }

        @Override
        public byte[] credentialDigest() {
            return credentialDigest.clone();
        }

        @Override
        public byte[] mostRecentEndedCredentialDigest() {
            return mostRecentEndedCredentialDigest == null ? null : mostRecentEndedCredentialDigest.clone();
        }

        @Override
        public String toString() {
            return "LockedBinding[status=" + status + ", generation=" + generation + ", credentialDigest=redacted, "
                    + "boundDeviceId=redacted, mostRecentEndedCredentialDigest=redacted]";
        }
    }

    public record Receipt(String requestHash, String responseJson) {}
}
