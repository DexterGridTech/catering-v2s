package com.catering.v2s.storeterminal.persistence;

import com.catering.v2s.platform.foundation.collection.CanonicalCursorIdentity;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TerminalBinding;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TerminalPage;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TerminalSummary;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Persistence for the owner aggregate and its transaction-scoped command receipts. */
@Repository
public class StoreTerminalOwnerPersistence {
    private static final RowMapper<TerminalRow> TERMINAL_ROW = StoreTerminalOwnerPersistence::terminalRow;
    private static final RowMapper<TerminalDetailRow> TERMINAL_DETAIL_ROW =
            StoreTerminalOwnerPersistence::terminalDetailRow;
    private final JdbcTemplate jdbc;

    public StoreTerminalOwnerPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public UUID findWorkspaceUuid(String groupKey) {
        List<UUID> rows = jdbc.query(
                "SELECT workspace_uuid FROM platform_workspace.group_workspace WHERE group_workspace_key=?",
                (result, ignored) -> result.getObject("workspace_uuid", UUID.class),
                groupKey);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public TerminalRow lockByActivationCode(UUID workspaceUuid, String groupKey, String activationCode) {
        List<TerminalRow> rows = jdbc.query(
                "SELECT terminal_ref, workspace_uuid, group_workspace_key, store_ref, name, name_normalized, "
                        + "device_type, status, version, activation_code, configuration::text AS configuration_json, "
                        + "created_at_epoch_millis, updated_at_epoch_millis FROM store_terminal.terminal "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND activation_code=? FOR UPDATE",
                TERMINAL_ROW,
                workspaceUuid,
                groupKey,
                activationCode);
        if (rows.size() > 1) throw new IllegalStateException("activation code uniqueness invariant violated");
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public TerminalRow find(UUID workspaceUuid, String groupKey, UUID storeRef, UUID terminalRef) {
        List<TerminalRow> rows = jdbc.query(
                StoreTerminalOwnerPersistenceSql.SELECT_DETAIL,
                TERMINAL_ROW,
                workspaceUuid,
                groupKey,
                storeRef,
                terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public UUID findStoreRef(UUID workspaceUuid, String groupKey, UUID terminalRef) {
        List<UUID> rows = jdbc.query(
                StoreTerminalOwnerPersistenceSql.SELECT_TERMINAL_STORE,
                (result, ignored) -> result.getObject("store_ref", UUID.class),
                workspaceUuid,
                groupKey,
                terminalRef);
        if (rows.size() > 1) throw new IllegalStateException("terminal identity is not unique in its workspace");
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public TerminalDetailRow findDetail(UUID workspaceUuid, String groupKey, UUID storeRef, UUID terminalRef) {
        List<TerminalDetailRow> rows = jdbc.query(
                StoreTerminalOwnerPersistenceSql.SELECT_DETAIL_WITH_BINDING,
                TERMINAL_DETAIL_ROW,
                workspaceUuid,
                groupKey,
                storeRef,
                terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public TerminalRow lock(UUID workspaceUuid, String groupKey, UUID storeRef, UUID terminalRef) {
        List<TerminalRow> rows = jdbc.query(
                StoreTerminalOwnerPersistenceSql.SELECT_DETAIL_FOR_UPDATE,
                TERMINAL_ROW,
                workspaceUuid,
                groupKey,
                storeRef,
                terminalRef);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public TerminalPage list(
            UUID workspaceUuid, String groupKey, UUID storeRef, String query, String cursor, int pageSize) {
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("terminal page size is invalid");
        String search = query == null || query.isBlank() ? "" : query.trim().toLowerCase(Locale.ROOT);
        String identity = CanonicalCursorIdentity.encode(
                "store-terminal-list",
                workspaceUuid.toString(),
                groupKey,
                storeRef.toString(),
                search,
                Integer.toString(pageSize),
                "name_normalized,terminal_ref");
        OpaqueCollectionCursor.Position position = OpaqueCollectionCursor.decode(cursor, identity);
        String filter = "workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND status <> 'VOIDED'";
        List<Object> filterArgs = new ArrayList<>(List.of(workspaceUuid, groupKey, storeRef));
        if (!search.isEmpty()) {
            filter += " AND name_normalized LIKE ? ESCAPE '!'";
            filterArgs.add(containsPattern(search));
        }
        Long total = jdbc.queryForObject(
                "SELECT count(*) FROM store_terminal.terminal WHERE " + filter, Long.class, filterArgs.toArray());
        String frontier = "";
        List<Object> pageArgs = new ArrayList<>(filterArgs);
        if (position != null) {
            UUID tie;
            try {
                tie = position.tieBreaker();
                if (position.sortKey() == null || position.sortKey().isBlank()) throw new IllegalArgumentException();
            } catch (RuntimeException invalid) {
                throw new IllegalArgumentException("terminal cursor is invalid", invalid);
            }
            frontier = " AND (name_normalized > ? OR (name_normalized = ? AND terminal_ref > ?))";
            pageArgs.add(position.sortKey());
            pageArgs.add(position.sortKey());
            pageArgs.add(tie);
        }
        pageArgs.add(pageSize + 1);
        List<TerminalRow> rows = jdbc.query(
                "SELECT terminal_ref, workspace_uuid, group_workspace_key, store_ref, name, name_normalized, "
                        + "device_type, status, version, activation_code, configuration::text AS configuration_json, "
                        + "created_at_epoch_millis, updated_at_epoch_millis FROM store_terminal.terminal WHERE "
                        + filter + frontier + " ORDER BY name_normalized, terminal_ref LIMIT ?",
                TERMINAL_ROW,
                pageArgs.toArray());
        boolean hasNext = rows.size() > pageSize;
        if (hasNext) rows = new ArrayList<>(rows.subList(0, pageSize));
        List<TerminalSummary> items = rows.stream()
                .map(row -> new TerminalSummary(
                        row.terminalRef(), row.name(), row.deviceType(), row.status(), row.version(), row.updatedAt()))
                .toList();
        String next = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity,
                        rows.getLast().nameNormalized(),
                        rows.getLast().terminalRef())
                : null;
        return new TerminalPage(items, next, total == null ? 0 : total);
    }

    /** Serializes exact request replay while leaving all writes in the caller's REQUIRED transaction. */
    public Receipt findReceipt(UUID workspaceUuid, String groupKey, String idempotencyKey) {
        AdvisoryLock.acquireHashTextPair(
                jdbc, workspaceUuid + ":" + groupKey, "store-terminal-receipt:" + idempotencyKey);
        List<Receipt> rows = jdbc.query(
                StoreTerminalOwnerPersistenceSql.FIND_RECEIPT,
                (result, ignored) -> new Receipt(result.getString("request_hash"), result.getString("response_json")),
                workspaceUuid,
                groupKey,
                idempotencyKey);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void insertReceipt(
            UUID workspaceUuid,
            String groupKey,
            String idempotencyKey,
            String requestHash,
            String responseJson,
            long now) {
        jdbc.update(
                StoreTerminalOwnerPersistenceSql.INSERT_RECEIPT,
                UUID.randomUUID(),
                workspaceUuid,
                groupKey,
                idempotencyKey,
                requestHash,
                responseJson,
                now);
    }

    public boolean insert(
            UUID terminalRef,
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            String name,
            String nameNormalized,
            String deviceType,
            String activationCode,
            String configurationJson,
            long now) {
        List<UUID> rows = jdbc.query(
                StoreTerminalOwnerPersistenceSql.INSERT_TERMINAL,
                (result, ignored) -> result.getObject("terminal_ref", UUID.class),
                terminalRef,
                workspaceUuid,
                groupKey,
                storeRef,
                name,
                nameNormalized,
                deviceType,
                activationCode,
                configurationJson,
                now,
                now);
        return !rows.isEmpty();
    }

    public int replace(
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            UUID terminalRef,
            String name,
            String nameNormalized,
            String configurationJson,
            long expectedVersion,
            long now) {
        return jdbc.update(
                StoreTerminalOwnerPersistenceSql.REPLACE_TERMINAL,
                name,
                nameNormalized,
                configurationJson,
                now,
                workspaceUuid,
                groupKey,
                storeRef,
                terminalRef,
                expectedVersion);
    }

    public int transition(
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            UUID terminalRef,
            String status,
            long expectedVersion,
            long now) {
        return jdbc.update(
                StoreTerminalOwnerPersistenceSql.TRANSITION_STATUS,
                status,
                now,
                workspaceUuid,
                groupKey,
                storeRef,
                terminalRef,
                expectedVersion);
    }

    public void lockNames(UUID workspaceUuid, String groupKey, UUID storeRef, List<String> normalizedNames) {
        normalizedNames.stream()
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .sorted(Comparator.naturalOrder())
                .forEach(name -> AdvisoryLock.acquireHashTextPair(
                        jdbc, workspaceUuid + ":" + groupKey, "store-terminal-name:" + storeRef + ":" + name));
    }

    public record Receipt(String requestHash, String responseJson) {}

    public record TerminalDetailRow(TerminalRow terminal, TerminalBinding binding) {}

    public record TerminalRow(
            UUID terminalRef,
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            String name,
            String nameNormalized,
            String deviceType,
            String status,
            long version,
            String activationCode,
            String configurationJson,
            long createdAt,
            long updatedAt) {
        @Override
        public String toString() {
            return "TerminalRow[terminalRef=" + terminalRef + ", workspaceUuid=" + workspaceUuid
                    + ", groupKey=" + groupKey + ", storeRef=" + storeRef + ", status=" + status
                    + ", version=" + version + ", activationCode=redacted]";
        }
    }

    private static TerminalRow terminalRow(ResultSet result, int ignored) throws SQLException {
        return new TerminalRow(
                result.getObject("terminal_ref", UUID.class),
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("store_ref", UUID.class),
                result.getString("name"),
                result.getString("name_normalized"),
                result.getString("device_type"),
                result.getString("status"),
                result.getLong("version"),
                result.getString("activation_code"),
                result.getString("configuration_json"),
                result.getLong("created_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"));
    }

    private static TerminalDetailRow terminalDetailRow(ResultSet result, int ignored) throws SQLException {
        TerminalRow terminal = terminalRow(result, ignored);
        String status = result.getString("binding_status");
        TerminalBinding binding = "ACTIVE".equals(status)
                ? TerminalBinding.active(result.getLong("binding_activated_at"), result.getLong("binding_generation"))
                : TerminalBinding.inactive();
        return new TerminalDetailRow(terminal, binding);
    }

    private static String containsPattern(String value) {
        return "%" + value.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }
}
