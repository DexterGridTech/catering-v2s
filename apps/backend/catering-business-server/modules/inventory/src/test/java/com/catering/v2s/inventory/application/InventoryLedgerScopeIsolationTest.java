package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class InventoryLedgerScopeIsolationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void legacyLedgerReadMustResolveTargetWithinRequestedScopeBeforeReadingLedger() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID targetRef = UUID.randomUUID();
        doThrow(new EmptyResultDataAccessException(1))
                .when(jdbc)
                .queryForObject(
                        argThat(sql -> sql.startsWith("SELECT target_ref,item_ref")),
                        any(RowMapper.class),
                        eq("store-a"),
                        eq("brand-a"),
                        eq(targetRef));
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);

        InventoryOwnerApi.Problem failure = assertThrows(
                InventoryOwnerApi.Problem.class,
                () -> service.read(
                        "getOperationsInventoryTargetLedger",
                        "store-a",
                        "brand-a",
                        mapper.createObjectNode()
                                .put("targetRef", targetRef.toString())
                                .put("pageSize", 20),
                        "request-1",
                        "STORE"));

        assertEquals("NOT_FOUND", failure.code());
    }

    @Test
    void typedLedgerReadMustResolveTargetWithinRequestedScope() {
        InventoryOwnerApi.Problem failure = assertMissingTarget(service -> service.readTargetLedger(
                "store-a", "brand-a", UUID.randomUUID().toString(), mapper.createObjectNode(), "request-2", "STORE"));
        assertEquals("NOT_FOUND", failure.code());
    }

    @Test
    void typedChangeSummaryMustResolveTargetWithinRequestedScope() {
        InventoryOwnerApi.Problem failure = assertMissingTarget(service -> service.readTargetChangeSummary(
                "store-a", "brand-a", UUID.randomUUID().toString(), "TODAY", "STORE"));
        assertEquals("NOT_FOUND", failure.code());
    }

    @Test
    void typedBusinessHistoryMustResolveTargetWithinRequestedScope() {
        InventoryOwnerApi.Problem failure = assertMissingTarget(service -> service.readTargetBusinessHistory(
                "store-a", "brand-a", UUID.randomUUID().toString(), mapper.createObjectNode(), "request-3", "STORE"));
        assertEquals("NOT_FOUND", failure.code());
    }

    private InventoryOwnerApi.Problem assertMissingTarget(java.util.function.Consumer<InventoryOwnerService> read) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doThrow(new EmptyResultDataAccessException(1))
                .when(jdbc)
                .queryForObject(
                        argThat(sql -> sql.startsWith("SELECT target_ref,item_ref")),
                        any(RowMapper.class),
                        eq("store-a"),
                        eq("brand-a"),
                        any(UUID.class));
        InventoryOwnerService service = new InventoryOwnerService(jdbc, mapper, () -> 1L);
        return assertThrows(InventoryOwnerApi.Problem.class, () -> read.accept(service));
    }
}
