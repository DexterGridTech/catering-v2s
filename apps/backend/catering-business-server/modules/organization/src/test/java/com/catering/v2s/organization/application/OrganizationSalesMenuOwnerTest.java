package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class OrganizationSalesMenuOwnerTest {
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final String GROUP = "sales-menu-group";

    @Test
    void requireSalesMenuStoreReturnsOnlyPersistedStoreFactsAndLeavesTimezoneAbsent() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID storeRef = UUID.randomUUID();
        UUID brandRef = UUID.randomUUID();
        ResultSet row = mock(ResultSet.class);
        when(row.next()).thenReturn(true);
        when(row.getObject("store_ref", UUID.class)).thenReturn(storeRef);
        when(row.getString("status")).thenReturn("DISABLED");
        when(row.getObject("brand_id", UUID.class)).thenReturn(brandRef);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    return extractor.extractData(row);
                });

        OrganizationOwnerApi.SalesMenuStoreJudgment judgment =
                service(jdbc).requireSalesMenuStore(WORKSPACE, GROUP, storeRef);

        assertEquals(storeRef, judgment.storeRef());
        assertEquals("DISABLED", judgment.status());
        assertNull(judgment.timezone());
        assertEquals(storeRef.toString(), judgment.dataNodeRef());
        assertEquals(brandRef.toString(), judgment.brandRef());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> setter = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc).query(sql.capture(), setter.capture(), any(ResultSetExtractor.class));
        assertTrue(sql.getValue().contains("store.id AS store_ref"));
        assertTrue(sql.getValue().contains("store.status"));
        assertTrue(sql.getValue().contains("store.brand_id"));
        assertTrue(sql.getValue().contains("store.workspace_uuid=?"));
        assertTrue(sql.getValue().contains("store.group_workspace_key=?"));
        assertTrue(!sql.getValue().contains("timezone"));
        PreparedStatement statement = mock(PreparedStatement.class);
        setter.getValue().setValues(statement);
        verify(statement).setObject(1, storeRef);
        verify(statement).setObject(2, WORKSPACE);
        verify(statement).setString(3, GROUP);
    }

    @Test
    void requireSalesMenuStoreDoesNotTurnAStoreOutsideTheRequestedWorkspaceIntoAValidTarget() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    ResultSet empty = mock(ResultSet.class);
                    when(empty.next()).thenReturn(false);
                    return extractor.extractData(empty);
                });

        assertThrows(BusinessEntityService.OrganizationNotFoundException.class, () -> service(jdbc)
                .requireSalesMenuStore(WORKSPACE, GROUP, UUID.randomUUID()));
    }

    @Test
    void invalidStoreJudgmentScopeIsRejectedBeforeTheOwnerQuery() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        assertThrows(BusinessEntityService.OrganizationValidationException.class, () -> service(jdbc)
                .requireSalesMenuStore(WORKSPACE, " ", UUID.randomUUID()));
        verifyNoInteractions(jdbc);
    }

    private static BusinessEntityService service(JdbcTemplate jdbc) {
        return new BusinessEntityService(
                jdbc,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(ExtensionDefinitionLookup.class),
                mock(OrganizationNodeLookup.class));
    }
}
