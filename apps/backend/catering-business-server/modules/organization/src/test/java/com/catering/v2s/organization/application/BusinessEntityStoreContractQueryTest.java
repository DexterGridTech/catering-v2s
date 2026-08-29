package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.StoreContractLookup.StoreContractContext;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class BusinessEntityStoreContractQueryTest {
    @Test
    void requireStoreContractContextLoadsStoreAndPhasesWithOneOwnerRead() {
        UUID storeId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        var jdbc = new RecordingJdbcTemplate(storeId, tenantId, projectId);

        StoreContractContext context = new BusinessEntityService(
                        jdbc, () -> 1L, mock(ExtensionDefinitionLookup.class), mock(OrganizationNodeLookup.class))
                .requireStoreContractContext(UUID.randomUUID(), "group", storeId);

        assertEquals(storeId, context.storeId());
        assertEquals(tenantId, context.tenantId());
        assertEquals(projectId, context.projectId());
        assertEquals("ENABLED", context.storeStatus());
        assertEquals("ENABLED", context.tenantStatus());
        assertEquals(List.of("phase-1", "phase-2"), context.projectPhaseNames());
        assertEquals(1, jdbc.queryCount);
        assertTrue(jdbc.sql.contains("JOIN organization.tenant"));
        assertTrue(jdbc.sql.contains("LEFT JOIN organization.project_phase_name"));
    }

    private static final class RecordingJdbcTemplate extends JdbcTemplate {
        private final UUID storeId;
        private final UUID tenantId;
        private final UUID projectId;
        private int queryCount;
        private String sql;

        private RecordingJdbcTemplate(UUID storeId, UUID tenantId, UUID projectId) {
            this.storeId = storeId;
            this.tenantId = tenantId;
            this.projectId = projectId;
        }

        @Override
        public <T> T query(String sql, PreparedStatementSetter setter, ResultSetExtractor<T> extractor) {
            queryCount++;
            this.sql = sql;
            ResultSet result = mock(ResultSet.class);
            try {
                when(result.next()).thenReturn(true, true, false);
                when(result.getObject("tenant_id", UUID.class)).thenReturn(tenantId);
                when(result.getObject("project_id", UUID.class)).thenReturn(projectId);
                when(result.getString("status")).thenReturn("ENABLED");
                when(result.getString("tenant_status")).thenReturn("ENABLED");
                when(result.getString("phase_name")).thenReturn("phase-1", "phase-2");
                return extractor.extractData(result);
            } catch (Exception exception) {
                throw new AssertionError(exception);
            }
        }
    }
}
