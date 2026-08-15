package com.catering.v2s.audit.contract;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Pure JDBC row projection shared by owner-local audit history readers. */
public final class AuditHistoryResultSetReader {
    private AuditHistoryResultSetReader() { }

    public static TargetProjection readTarget(ResultSet rows) throws SQLException {
        boolean targetExists = false;
        long total = 0;
        List<AuditHistoryItem> items = new ArrayList<>();
        while (rows.next()) {
            targetExists = rows.getBoolean("target_exists");
            total = rows.getLong("total");
            addItem(rows, items, "event_id");
        }
        return new TargetProjection(targetExists, List.copyOf(items), total);
    }

    public static ItemsProjection readItems(ResultSet rows) throws SQLException {
        long total = 0;
        List<AuditHistoryItem> items = new ArrayList<>();
        while (rows.next()) {
            total = rows.getLong("total");
            addItem(rows, items, "event_id");
        }
        return new ItemsProjection(List.copyOf(items), total);
    }

    public static AuthorizedProjection readAuthorized(ResultSet rows) throws SQLException {
        boolean found = false;
        boolean authorized = false;
        long total = 0;
        List<AuditHistoryItem> items = new ArrayList<>();
        while (rows.next()) {
            found = rows.getBoolean("found");
            authorized = rows.getBoolean("authorized");
            total = rows.getLong("total");
            addItem(rows, items, "audit_id");
        }
        return new AuthorizedProjection(found, authorized, List.copyOf(items), total);
    }

    private static void addItem(ResultSet rows, List<AuditHistoryItem> items, String idColumn) throws SQLException {
        UUID id = rows.getObject(idColumn, UUID.class);
        if (id != null) {
            items.add(new AuditHistoryItem(
                id,
                rows.getLong("occurred_at_epoch_millis"),
                rows.getString("actor_display_snapshot"),
                rows.getString("action"),
                new AuditTarget(rows.getString("entity_type"), rows.getString("entity_ref_text")),
                AuditChangeJson.read(rows.getString("changes_json"))
            ));
        }
    }

    public record TargetProjection(boolean targetExists, List<AuditHistoryItem> items, long total) { }

    public record ItemsProjection(List<AuditHistoryItem> items, long total) { }

    public record AuthorizedProjection(boolean found, boolean authorized, List<AuditHistoryItem> items, long total) { }
}
