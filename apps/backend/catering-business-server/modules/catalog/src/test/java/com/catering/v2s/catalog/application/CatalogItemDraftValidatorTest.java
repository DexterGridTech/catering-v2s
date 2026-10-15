package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class CatalogItemDraftValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final CatalogItemDraftValidator validator = new CatalogItemDraftValidator(mapper);

    @Test
    void shapePredicatesKeepIdentifierAndPreparationRules() {
        assertTrue(CatalogItemDraftValidator.identifierAllowed("STANDARD_SALE_COUNTED", "CATALOG_ITEM", "BARCODE"));
        assertTrue(CatalogItemDraftValidator.preparationAllowed("SKU_VARIANT_SALE_COUNTED", "SKU"));
        assertFalse(CatalogItemDraftValidator.identifierAllowed("BENEFIT_SHELL", "CATALOG_ITEM", "MNEMONIC"));
        assertFalse(CatalogItemDraftValidator.preparationAllowed("MATERIAL", "ITEM"));
    }

    @Test
    void derivedFieldsRejectClientValueThatConflictsWithShape() {
        var rule = CatalogInventoryShapeManifest.SHAPE_RULES.stream()
                .filter(value -> value.shapeKey() == CatalogInventoryShapeManifest.ShapeKey.STANDARD_SALE_COUNTED)
                .findFirst()
                .orElseThrow();
        ObjectNode draft = mapper.createObjectNode().put("itemKind", "CLIENT_OVERRIDE");

        CatalogOwnerApi.Problem failure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> validator.validateClientDerivedFields(draft, rule));
        assertEquals("SHAPE_DERIVATION_CONFLICT", failure.code());
        assertEquals(422, failure.status());
    }

    @Test
    void skuCombinationRejectsDuplicateActiveCombinationWithoutChangingProblem() {
        var rule = CatalogInventoryShapeManifest.SHAPE_RULES.stream()
                .filter(value -> value.shapeKey() == CatalogInventoryShapeManifest.ShapeKey.SKU_VARIANT_SALE_COUNTED)
                .findFirst()
                .orElseThrow();
        ArrayNode axes = mapper.createArrayNode();
        axes.addObject()
                .put("attributeRef", "color")
                .putArray("values")
                .addObject()
                .put("valueRef", "red");
        ArrayNode skus = mapper.createArrayNode();
        for (int i = 0; i < 2; i++) {
            ObjectNode sku = skus.addObject().put("variantCombinationDigest", "same");
            sku.putArray("attributeValueRefs")
                    .addObject()
                    .put("attributeRef", "color")
                    .put("attributeValueRef", "red");
        }

        CatalogOwnerApi.Problem failure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> validator.validateSkuCombinations(skus, axes, rule));
        assertEquals("DUPLICATE_VARIANT_COMBINATION", failure.code());
        assertEquals(409, failure.status());
    }
}
