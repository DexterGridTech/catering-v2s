package com.catering.v2s.organization.application.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionFilterQuery;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class BusinessEntityTaskReadPersistenceTest {
    @Test
    void filteredBusinessEntityPageKeepsExtensionValuesAsJsonbForCountAndPagePredicates() {
        var jdbc = new RecordingJdbcTemplate();
        UUID workspaceUuid = UUID.randomUUID();
        ExtensionDefinitionReadback definition = new ExtensionDefinitionReadback(
                "workspace-a",
                "BRAND",
                7,
                1,
                List.of(new ExtensionDefinitionReadback.Field(
                        "brandText", "Brand text", "TEXT", false, true, false, List.of(), "ENABLED", 0, null)),
                "ENABLED",
                List.of());
        ExtensionFilterQuery.Prepared filter = ExtensionFilterQuery.prepare(
                (workspace, groupWorkspaceKey, hostType) -> definition,
                workspaceUuid,
                "workspace-a",
                "BRAND",
                "[{\"fieldKey\":\"brandText\",\"type\":\"TEXT\",\"value\":\"alpha\"}]",
                "7");

        new BusinessEntityTaskReadPersistence(jdbc)
                .pageBusinessEntities(
                        workspaceUuid,
                        "workspace-a",
                        "BRAND",
                        null,
                        null,
                        null,
                        null,
                        null,
                        "UPDATED_AT",
                        "DESC",
                        1,
                        20,
                        false,
                        filter);

        assertTrue(jdbc.countSql.contains("extension_values ->> ?"));
        assertTrue(jdbc.listSql.contains("extension_values ->> ?"));
        assertFalse(jdbc.countSql.contains("extension_values::text"));
        assertFalse(jdbc.listSql.contains("extension_values::text"));
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private String countSql;
        private String listSql;

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countSql = sql;
            return requiredType.cast(0L);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            listSql = sql;
            return List.of();
        }
    }
}
