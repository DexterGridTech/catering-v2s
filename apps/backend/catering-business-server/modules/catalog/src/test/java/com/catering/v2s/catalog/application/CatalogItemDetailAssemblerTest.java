package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogItemDetailAssemblerTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final CatalogItemDetailAssembler assembler = new CatalogItemDetailAssembler(mapper);

    @Test
    void sourceFactUsesTheAlreadyReadScopeFact() {
        var rule = CatalogInventoryShapeManifest.SHAPE_RULES.stream()
                .filter(value -> value.shapeKey() == CatalogInventoryShapeManifest.ShapeKey.STANDARD_SALE_COUNTED)
                .findFirst()
                .orElseThrow();
        ObjectNode sections = mapper.createObjectNode();
        sections.putArray("skus");
        ArrayNode composites = mapper.createArrayNode();

        ObjectNode selfManaged = assembler.itemDetail(facts(null), rule, sections, Map.of(), Map.of(), composites);
        ObjectNode copied = assembler.itemDetail(facts("source-scope"), rule, sections, Map.of(), Map.of(), composites);

        assertEquals("SELF_MANAGED", selfManaged.path("source").asText());
        assertEquals(
                "SELF_MANAGED", selfManaged.path("lifecycle").path("source").asText());
        assertEquals("COPIED", copied.path("source").asText());
        assertEquals("COPIED", copied.path("lifecycle").path("source").asText());
    }

    private static CatalogItemDetailAssembler.ItemFacts facts(String sourceScopeRef) {
        return new CatalogItemDetailAssembler.ItemFacts(
                UUID.fromString("00000000-0000-0000-0000-000000000001"),
                "ITEM-1",
                "Item one",
                null,
                "STANDARD_SALE_COUNTED",
                "ENABLED",
                3,
                10,
                sourceScopeRef);
    }
}
