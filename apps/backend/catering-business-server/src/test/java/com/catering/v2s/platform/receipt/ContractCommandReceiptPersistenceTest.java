package com.catering.v2s.platform.receipt;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.catering.v2s.contract.application.persistence.ContractCommandReceiptPersistence;
import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;

class ContractCommandReceiptPersistenceTest {
    @Test
    void findUsesTheSharedTransactionLockAndAPlainOwnerRead() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        whenQueryReturnsEmpty(jdbc);
        UUID workspace = UUID.randomUUID();
        String key = "contract-lock-proof-01";

        ContractCommandReceiptPersistence persistence = new ContractCommandReceiptPersistence(jdbc);
        assertTrue(persistence.find(workspace, key) == null);

        verify(jdbc).queryForList(contains("pg_advisory_xact_lock"), eq(workspace.toString()), eq(key));
        org.mockito.ArgumentCaptor<String> sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        assertFalse(sql.getValue().contains("pg_advisory_xact_lock"));
        assertTrue(sql.getValue().contains("FROM contract.contract_command_receipt"));
    }

    private static void whenQueryReturnsEmpty(JdbcTemplate jdbc) throws Exception {
        org.mockito.Mockito.when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of());
        doAnswer(invocation -> {
                    ResultSetExtractor<?> extractor = invocation.getArgument(2);
                    ResultSet result = mock(ResultSet.class);
                    org.mockito.Mockito.when(result.next()).thenReturn(false);
                    return extractor.extractData(result);
                })
                .when(jdbc)
                .query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
    }
}
