package com.catering.v2s.fulfillment.production.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
                        new com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi
                                .ProductionTagReferenceReadback(second, "SECOND", "Second", "ENABLED", 1),
                        new com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi
                                .ProductionTagReferenceReadback(first, "FIRST", "First", "ENABLED", 1)));
        ProductionTagOwnerService service = new ProductionTagOwnerService(jdbc, new ObjectMapper(), () -> 1L);

        var result = service.readTagReferencesByRefs("scope", "brand", List.of(first, second, first), "request");

        assertEquals(
                List.of(first, second),
                result.stream().map(value -> value.tagRef()).toList());
    }
}
