package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class WorkspaceRolePageRequestTest {
    @Test void ownerUsesOnePredicateForCountAndBoundedRoleRead() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceRoleService(jdbc, null);

        var page = service.page(UUID.randomUUID(), "workspace-a", "operator", "PROJECT", "ENABLED", 3, 20);

        assertEquals(73, page.total());
        assertEquals(3, page.page());
        assertEquals(20, page.pageSize());
        assertEquals(jdbc.countSql.replace("SELECT COUNT(*)", ""), jdbc.listSql.substring(jdbc.listSql.indexOf(" FROM workspace_iam.workspace_role"), jdbc.listSql.indexOf(" ORDER BY")));
        assertEquals(8, jdbc.countArgs.length);
        assertEquals(10, jdbc.listArgs.length);
        assertEquals(20, jdbc.listArgs[8]);
        assertEquals(40, jdbc.listArgs[9]);
        assertEquals(1, occurrences(jdbc.listSql, "LIMIT ? OFFSET ?"));
        assertEquals(3, occurrences(jdbc.listSql, "CAST(? AS text) IS NULL"));
    }

    @Test void rejectsInvalidRolePageInputsBeforeAnyQuery() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceRoleService(jdbc, null);

        assertThrows(WorkspaceRoleService.RoleValidationException.class, () -> service.page(UUID.randomUUID(), "workspace-a", null, "UNKNOWN", null, 1, 20));
        assertThrows(WorkspaceRoleService.RoleValidationException.class, () -> service.page(UUID.randomUUID(), "workspace-a", null, null, "PENDING", 1, 20));
        assertThrows(WorkspaceRoleService.RoleValidationException.class, () -> service.page(UUID.randomUUID(), "workspace-a", null, null, null, 0, 20));
        assertThrows(WorkspaceRoleService.RoleValidationException.class, () -> service.page(UUID.randomUUID(), "workspace-a", null, null, null, 1, 101));
    }

    private static int occurrences(String value, String token) { return value.split(java.util.regex.Pattern.quote(token), -1).length - 1; }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql; private Object[] countArgs; private String listSql; private Object[] listArgs;
        @Override public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) { countSql = sql; countArgs = args; return requiredType.cast(73L); }
        @Override public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) { listSql = sql; listArgs = args; return List.of(); }
    }
}
