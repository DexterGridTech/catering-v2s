package com.catering.v2s.platform.workspace.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceAdministrationPersistence;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class WorkspaceAdministrationPageRequestTest {
    @Test
    void normalizesOptionalFiltersAndRetainsBoundedPaging() {
        var request = new WorkspaceAdministrationPageRequest(
                "  North  ", "  north-1 ", "  North Operations ", "ENABLED", 3, 20, "UPDATED_AT", "DESC");
        assertEquals("North", request.name());
        assertEquals("north-1", request.groupWorkspaceKey());
        assertEquals("North Operations", request.operationsTitle());
        assertEquals(40, request.offset());
        assertNull(new WorkspaceAdministrationPageRequest(" ", null, null, null, 1, 1, "NAME", "ASC").name());
    }

    @Test
    void rejectsUnboundedOrUnclosedListRequests() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new WorkspaceAdministrationPageRequest(null, null, null, null, 0, 20, "NAME", "ASC"));
        assertThrows(
                IllegalArgumentException.class,
                () -> new WorkspaceAdministrationPageRequest(null, null, null, "PENDING", 1, 20, "NAME", "ASC"));
        assertThrows(
                IllegalArgumentException.class,
                () -> new WorkspaceAdministrationPageRequest(null, null, null, null, 1, 101, "NAME", "ASC"));
        assertThrows(
                IllegalArgumentException.class,
                () -> new WorkspaceAdministrationPageRequest(null, null, null, null, 1, 20, "NAME; DROP", "ASC"));
    }

    @Test
    void ownerPerformsTheFilteredWindowCountAndBoundedSortedReadWithoutOrganizationLookup() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceAdministrationService(
                new WorkspaceAdministrationPersistence(jdbc), null, null, null, null);

        var page = service.list(new WorkspaceAdministrationPageRequest(
                "North", "north-1", "Operations", "ENABLED", 3, 20, "UPDATED_AT", "DESC"));

        assertEquals(0, page.total());
        assertEquals(3, page.page());
        assertEquals(20, page.pageSize());
        assertEquals("UPDATED_AT", page.sortKey());
        assertEquals("DESC", page.sortDirection());
        assertEquals(10, jdbc.listArgs.length);
        assertEquals(20L, jdbc.listArgs[8]);
        assertEquals(40L, jdbc.listArgs[9]);
        assertEquals(4, occurrences(jdbc.listSql, "CAST(? AS text) IS NULL"));
        assertEquals(1, occurrences(jdbc.listSql, "count(*) OVER() AS total_count"));
        assertEquals(0, occurrences(jdbc.listSql, "organization."));
        assertEquals(0, occurrences(jdbc.listSql, "EXISTS"));
        assertEquals(1, occurrences(jdbc.listSql, "LIMIT ? OFFSET ?"));
        assertEquals(1, occurrences(jdbc.listSql, "ORDER BY updated_at_epoch_millis DESC, group_workspace_key ASC"));
        assertEquals(0, occurrences(jdbc.listSql, "ORDER BY UPDATED_AT"));
        assertEquals(1, jdbc.queryCalls);
        assertNull(jdbc.countSql);
    }

    private static int occurrences(String value, String token) {
        return value.split(java.util.regex.Pattern.quote(token), -1).length - 1;
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String listSql;
        private String countSql;
        private Object[] listArgs;
        private Object[] countArgs;
        private int queryCalls;

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countSql = sql;
            countArgs = args;
            return requiredType.cast(73L);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            queryCalls++;
            listSql = sql;
            listArgs = args;
            return List.of();
        }
    }
}
