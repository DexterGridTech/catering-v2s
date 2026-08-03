package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class WorkspacePlatformAccountPageRequestTest {
    @Test void ownerUsesTheSameSameAssignmentPredicateForCountAndBoundedAccountRead() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceUserService(jdbc, null, null, null);
        var organizationRef = UUID.randomUUID();

        var page = service.pageForPlatform(UUID.randomUUID(), "workspace-a", "Dexter", "138", "dexter", "Operator", "ENABLED", "STORE", organizationRef, 2, 50, "LAST_LOGIN_AT", "DESC");

        assertEquals(73, page.total());
        assertEquals(2, page.page());
        assertEquals(50, page.pageSize());
        assertEquals(jdbc.countSql.replace("SELECT COUNT(*)", ""), jdbc.listSql.substring(jdbc.listSql.indexOf(" FROM workspace_iam.workspace_account"), jdbc.listSql.indexOf(" ORDER BY")));
        assertEquals(21, jdbc.countArgs.length);
        assertEquals(23, jdbc.listArgs.length);
        assertEquals(50, jdbc.listArgs[21]);
        assertEquals(50, jdbc.listArgs[22]);
        assertEquals(1, occurrences(jdbc.listSql, "LIMIT ? OFFSET ?"));
        assertTrue(jdbc.countSql.contains("EXISTS (SELECT 1 FROM workspace_iam.role_assignment assignment"));
        assertTrue(jdbc.countSql.contains("assignment.service_node_type=?"));
        assertTrue(jdbc.countSql.contains("assignment.service_node_id=?"));
        assertTrue(jdbc.countSql.contains("role.name ILIKE"));
        assertTrue(jdbc.listSql.contains("MAX(authenticated_at_epoch_millis) AS last_login_at"));
        assertTrue(jdbc.listSql.contains("ORDER BY COALESCE(login.last_login_at, -1) DESC, a.id ASC"));
    }

    @Test void rejectsInvalidPlatformAccountPageBeforeQuerying() {
        var service = new WorkspaceUserService(new RecordingJdbcTemplate(), null, null, null);
        assertThrows(WorkspaceAccountService.AccountNotFoundException.class, () -> service.pageForPlatform(UUID.randomUUID(), "workspace-a", null, null, null, null, "PENDING", 1, 20));
        assertThrows(WorkspaceAccountService.AccountNotFoundException.class, () -> service.pageForPlatform(UUID.randomUUID(), "workspace-a", null, null, null, null, null, 0, 20));
    }

    @Test void ownerTypesEveryOptionalPlatformFilterBeforeItsNullGuard() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceUserService(jdbc, null, null, null);

        service.pageForPlatform(UUID.randomUUID(), "workspace-a", null, null, null, null, null, 1, 20);

        assertEquals(8, occurrences(jdbc.countSql, "CAST(? AS text) IS NULL"));
        assertEquals(2, occurrences(jdbc.countSql, "CAST(? AS uuid) IS NULL"));
        assertEquals(jdbc.countSql.replace("SELECT COUNT(*)", ""), jdbc.listSql.substring(jdbc.listSql.indexOf(" FROM workspace_iam.workspace_account"), jdbc.listSql.indexOf(" ORDER BY")));
    }

    private static int occurrences(String value, String token) { return value.split(java.util.regex.Pattern.quote(token), -1).length - 1; }
    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql; private Object[] countArgs; private String listSql; private Object[] listArgs;
        @Override public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) { countSql = sql; countArgs = args; return requiredType.cast(73L); }
        @Override public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) { listSql = sql; listArgs = args; return List.of(); }
    }
}
