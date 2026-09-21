package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.application.persistence.CatalogProductionTagOwnerPersistence;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ProductionTagReferenceReadbackTest {
    @Test
    void selectedRefsUseOneOwnerLocalSetReadAndPreserveInputOrder() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        when(jdbc.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class)))
                .thenReturn(List.of(
                        new com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi
                                .ProductionTagReferenceReadback(second, "SECOND", "Second", "ENABLED", 1),
                        new com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi
                                .ProductionTagReferenceReadback(first, "FIRST", "First", "ENABLED", 1)));
        CatalogProductionTagOwnerService service = new CatalogProductionTagOwnerService(
                new CatalogProductionTagOwnerPersistence(jdbc, () -> 1L), new ObjectMapper());

        var result = service.readTagReferencesByRefs("scope", "brand", List.of(first, second, first), "request");

        assertEquals(
                List.of(first, second),
                result.stream().map(value -> value.tagRef()).toList());
    }
}

