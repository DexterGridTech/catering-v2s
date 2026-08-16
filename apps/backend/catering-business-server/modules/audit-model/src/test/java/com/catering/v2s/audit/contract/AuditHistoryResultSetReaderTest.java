package com.catering.v2s.audit.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AuditHistoryResultSetReaderTest {
    private static final UUID EVENT_ID = UUID.randomUUID();
    private static final String CHANGES = "[{\"fieldKey\":\"name\",\"after\":\"updated\"}]";

    @Test
    void projectsTargetRowsWithoutChangingAuditValues() throws Exception {
        AuditHistoryResultSetReader.TargetProjection projection =
                AuditHistoryResultSetReader.readTarget(resultSet(Row.target(EVENT_ID, 1L)));

        assertTrue(projection.targetExists());
        assertEquals(1L, projection.total());
        assertEquals(EVENT_ID, projection.items().getFirst().id());
        assertEquals(
                "updated", projection.items().getFirst().changes().getFirst().afterValue());
    }

    @Test
    void projectsEmptyItemRowsAndAuthorizationFacts() throws Exception {
        AuditHistoryResultSetReader.ItemsProjection items =
                AuditHistoryResultSetReader.readItems(resultSet(Row.empty(0L)));
        AuditHistoryResultSetReader.AuthorizedProjection authorized =
                AuditHistoryResultSetReader.readAuthorized(resultSet(Row.authorized(true, false, 0L)));

        assertTrue(items.items().isEmpty());
        assertEquals(0L, items.total());
        assertTrue(authorized.found());
        assertFalse(authorized.authorized());
        assertEquals(0L, authorized.total());
    }

    private record Row(
            boolean targetExists,
            long total,
            UUID eventId,
            boolean found,
            boolean authorized,
            UUID auditId,
            long occurredAtEpochMillis,
            String actorDisplaySnapshot,
            String action,
            String entityType,
            String entityRefText,
            String changesJson) {
        private static Row target(UUID eventId, long total) {
            return new Row(
                    true, total, eventId, false, false, null, 1L, "tester", "UPDATED", "BRAND", "brand-1", CHANGES);
        }

        private static Row empty(long total) {
            return new Row(
                    false, total, null, false, false, null, 1L, "tester", "UPDATED", "BRAND", "brand-1", CHANGES);
        }

        private static Row authorized(boolean found, boolean authorized, long total) {
            return new Row(
                    false, total, null, found, authorized, null, 1L, "tester", "UPDATED", "BRAND", "brand-1", CHANGES);
        }
    }

    private static ResultSet resultSet(Row... rows) {
        List<Row> values = List.of(rows);
        int[] index = {-1};
        return (ResultSet) Proxy.newProxyInstance(
                AuditHistoryResultSetReaderTest.class.getClassLoader(),
                new Class<?>[] {ResultSet.class},
                (proxy, method, args) -> {
                    if ("next".equals(method.getName())) {
                        index[0]++;
                        return index[0] < values.size();
                    }
                    String column = (String) args[0];
                    Row row = values.get(index[0]);
                    if ("getObject".equals(method.getName())) return objectValue(row, column);
                    if ("getLong".equals(method.getName())) return longValue(row, column);
                    if ("getBoolean".equals(method.getName())) return booleanValue(row, column);
                    if ("getString".equals(method.getName())) return stringValue(row, column);
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    private static Object objectValue(Row row, String column) {
        return switch (column) {
            case "event_id" -> row.eventId();
            case "audit_id" -> row.auditId();
            default -> throw new IllegalArgumentException(column);
        };
    }

    private static long longValue(Row row, String column) {
        return switch (column) {
            case "total" -> row.total();
            case "occurred_at_epoch_millis" -> row.occurredAtEpochMillis();
            default -> throw new IllegalArgumentException(column);
        };
    }

    private static boolean booleanValue(Row row, String column) {
        return switch (column) {
            case "target_exists" -> row.targetExists();
            case "found" -> row.found();
            case "authorized" -> row.authorized();
            default -> throw new IllegalArgumentException(column);
        };
    }

    private static String stringValue(Row row, String column) {
        return switch (column) {
            case "actor_display_snapshot" -> row.actorDisplaySnapshot();
            case "action" -> row.action();
            case "entity_type" -> row.entityType();
            case "entity_ref_text" -> row.entityRefText();
            case "changes_json" -> row.changesJson();
            default -> throw new IllegalArgumentException(column);
        };
    }
}
