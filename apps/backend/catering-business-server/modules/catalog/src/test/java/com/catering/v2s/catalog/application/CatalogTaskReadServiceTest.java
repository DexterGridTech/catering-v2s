package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class CatalogTaskReadServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void itemReaderUsesTypedOwnerBoundaryAndNeverTheLegacyOperationIdRead() {
        CatalogOwnerApi owner = mock(CatalogOwnerApi.class);
        CatalogTaskReadService reads = new CatalogTaskReadService(owner);
        ObjectNode expected = mapper.createObjectNode().put("result", "typed");
        when(owner.readItem("node", "brand", "item", "request")).thenReturn(expected);

        assertSame(expected, reads.item("node", "brand", "item", "request"));

        verify(owner).readItem("node", "brand", "item", "request");
        verify(owner, never()).read(anyString(), anyString(), anyString(), any(ObjectNode.class), anyString());
    }
}
