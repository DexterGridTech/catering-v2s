package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class WorkspaceRolePageRequestTest {
    @Test
    void ownerUsesOnePredicateForCountAndBoundedRoleRead() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceRoleService(jdbc, null);

        var page = service.page(
                UUID.randomUUID(), "workspace-a", "operator", "PROJECT", "ENABLED", 3, 20, "UPDATED_AT", "DESC");

        assertEquals(73, page.total());
        assertEquals(3, page.page());
        assertEquals(20, page.pageSize());
        assertTrue(jdbc.querySql.contains("WITH filtered AS MATERIALIZED"));
        assertTrue(jdbc.querySql.contains("COUNT(*) OVER () AS total"));
        assertTrue(jdbc.querySql.contains("FROM filtered"));
        assertEquals(1, occurrences(jdbc.querySql, "FROM workspace_iam.workspace_role WHERE"));
        assertEquals(10, jdbc.queryArgs.length);
        assertEquals(20, jdbc.queryArgs[8]);
        assertEquals(40, jdbc.queryArgs[9]);
        assertEquals(1, occurrences(jdbc.querySql, "LIMIT ? OFFSET ?"));
        assertEquals(3, occurrences(jdbc.querySql, "CAST(? AS text) IS NULL"));
        assertTrue(jdbc.querySql.contains("ORDER BY updated_at_epoch_millis DESC, id ASC"));
    }

    @Test
    void rejectsInvalidRolePageInputsBeforeAnyQuery() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceRoleService(jdbc, null);

        assertThrows(
                WorkspaceRoleService.RoleValidationException.class,
                () -> service.page(UUID.randomUUID(), "workspace-a", null, "UNKNOWN", null, 1, 20, "NAME", "ASC"));
        assertThrows(
                WorkspaceRoleService.RoleValidationException.class,
                () -> service.page(UUID.randomUUID(), "workspace-a", null, null, "PENDING", 1, 20, "NAME", "ASC"));
        assertThrows(
                WorkspaceRoleService.RoleValidationException.class,
                () -> service.page(UUID.randomUUID(), "workspace-a", null, null, null, 0, 20, "NAME", "ASC"));
        assertThrows(
                WorkspaceRoleService.RoleValidationException.class,
                () -> service.page(UUID.randomUUID(), "workspace-a", null, null, null, 1, 101, "NAME", "ASC"));
        assertThrows(
                WorkspaceRoleService.RoleValidationException.class,
                () -> service.page(UUID.randomUUID(), "workspace-a", null, null, null, 1, 20, "STATUS", "ASC"));
        assertThrows(
                WorkspaceRoleService.RoleValidationException.class,
                () -> service.page(UUID.randomUUID(), "workspace-a", null, null, null, 1, 20, "NAME", "SIDEWAYS"));
    }

    @Test
    void defaultsRoleSortToNameAscendingWithStableIdTieBreaker() {
        var jdbc = new RecordingJdbcTemplate();
        var service = new WorkspaceRoleService(jdbc, null);

        service.page(UUID.randomUUID(), "workspace-a", null, null, null, 1, 20, null, null);

        assertTrue(jdbc.querySql.contains("ORDER BY name ASC, id ASC"));
    }

    private static int occurrences(String value, String token) {
        return value.split(java.util.regex.Pattern.quote(token), -1).length - 1;
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String querySql;
        private Object[] queryArgs;

        @Override
        public <T> T query(String sql, PreparedStatementSetter setter, ResultSetExtractor<T> extractor) {
            querySql = sql;
            Map<Integer, Object> bound = new TreeMap<>();
            PreparedStatement statement = (PreparedStatement) Proxy.newProxyInstance(
                    PreparedStatement.class.getClassLoader(),
                    new Class<?>[] {PreparedStatement.class},
                    (proxy, method, args) -> {
                        if (method.getName().startsWith("set")
                                && args != null
                                && args.length >= 2
                                && args[0] instanceof Integer index) {
                            bound.put(index, args[1]);
                        }
                        return defaultValue(method.getReturnType());
                    });
            ResultSet result = (ResultSet) Proxy.newProxyInstance(
                    ResultSet.class.getClassLoader(), new Class<?>[] {ResultSet.class}, new ResultSetHandler());
            try {
                setter.setValues(statement);
                queryArgs = bound.values().toArray();
                return extractor.extractData(result);
            } catch (SQLException exception) {
                throw new IllegalStateException(exception);
            }
        }

        private static Object defaultValue(Class<?> type) {
            if (!type.isPrimitive()) return null;
            if (type == boolean.class) return false;
            if (type == byte.class) return (byte) 0;
            if (type == short.class) return (short) 0;
            if (type == int.class) return 0;
            if (type == long.class) return 0L;
            if (type == float.class) return 0F;
            if (type == double.class) return 0D;
            if (type == char.class) return '\0';
            return null;
        }

        private static final class ResultSetHandler implements java.lang.reflect.InvocationHandler {
            private int row;

            @Override
            public Object invoke(Object proxy, java.lang.reflect.Method method, Object[] args) {
                if ("next".equals(method.getName())) return row++ == 0;
                if ("getLong".equals(method.getName())) return 73L;
                if ("getObject".equals(method.getName())) return null;
                return defaultValue(method.getReturnType());
            }
        }
    }
}
