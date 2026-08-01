package com.catering.v2s.platform.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class PlatformAdministratorPageRequestTest {
    @Test void ownerUsesTheSameAdministratorPredicateForCountAndBoundedSortedRead() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new PlatformAuthenticationService(jdbc, () -> 1L);

        var page = service.pageAdministrators("Dexter", "dext", "ENABLED", 2, 50, "UPDATED_AT", "DESC");

        assertEquals(73, page.total());
        assertEquals(2, page.page());
        assertEquals(50, page.pageSize());
        assertEquals("UPDATED_AT", page.sortKey());
        assertEquals("DESC", page.sortDirection());
        assertEquals(normalizeSql(jdbc.countSql.substring(jdbc.countSql.indexOf("WHERE "))), normalizeSql(jdbc.listSql.substring(jdbc.listSql.lastIndexOf("WHERE "), jdbc.listSql.lastIndexOf("ORDER BY"))));
        assertEquals(6, jdbc.countArgs.length);
        assertEquals(8, jdbc.listArgs.length);
        assertEquals(50L, jdbc.listArgs[6]);
        assertEquals(50L, jdbc.listArgs[7]);
        assertEquals(1, occurrences(jdbc.listSql, "ORDER BY a.updated_at_epoch_millis DESC, a.id ASC"));
        assertEquals(1, occurrences(jdbc.listSql, "LIMIT ? OFFSET ?"));
    }

    @Test void rejectsUnboundedOrUnclosedAdministratorPageRequestsBeforeQuerying() {
        var service = new PlatformAuthenticationService(new RecordingJdbcTemplate(), () -> 1L);
        assertThrows(PlatformAuthenticationService.InvalidAdministratorInputException.class, () -> service.pageAdministrators(null, null, null, 0, 20, "USER_NAME", "ASC"));
        assertThrows(PlatformAuthenticationService.InvalidAdministratorInputException.class, () -> service.pageAdministrators(null, null, "PENDING", 1, 20, "USER_NAME", "ASC"));
        assertThrows(PlatformAuthenticationService.InvalidAdministratorInputException.class, () -> service.pageAdministrators(null, null, null, 1, 101, "USER_NAME", "ASC"));
        assertThrows(PlatformAuthenticationService.InvalidAdministratorInputException.class, () -> service.pageAdministrators(null, null, null, 1, 20, "UPDATED_AT; DROP", "ASC"));
    }

    private static int occurrences(String value, String token) { return value.split(java.util.regex.Pattern.quote(token), -1).length - 1; }
    private static String normalizeSql(String value) { return value.replaceAll("\\s+", " ").trim(); }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql; private Object[] countArgs; private String listSql; private Object[] listArgs;
        @Override public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) { countSql = sql; countArgs = args; return requiredType.cast(73L); }
        @Override public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) { listSql = sql; listArgs = args; return List.of(); }
    }
}
