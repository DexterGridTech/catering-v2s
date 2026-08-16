package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class InventoryTaskReadServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void targetReaderUsesTypedOwnerBoundaryAndNeverTheLegacyOperationIdRead() {
        InventoryOwnerApi owner = mock(InventoryOwnerApi.class);
        InventoryTaskReadService reads = new InventoryTaskReadService(owner);
        ObjectNode expected = mapper.createObjectNode().put("result", "typed");
        when(owner.readTarget("node", "brand", "target", "request", "STORE")).thenReturn(expected);

        assertSame(expected, reads.target("node", "brand", "target", "request", "STORE"));

        verify(owner).readTarget("node", "brand", "target", "request", "STORE");
        verify(owner, never())
                .read(anyString(), anyString(), anyString(), any(ObjectNode.class), anyString(), anyString());
    }
}
