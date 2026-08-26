package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class CatalogIdentificationPreparationFactsTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final CatalogIdentifierFacts identifiers = new CatalogIdentifierFacts(new JdbcTemplate(), mapper);
    private final CatalogPreparationFacts preparation = new CatalogPreparationFacts(new JdbcTemplate(), mapper);

    @Test
    void identifierFactsPreserveLeadingZerosAndNormalizeOnlyMnemonicForDuplicateChecks() {
        ArrayNode item = mapper.createArrayNode();
        item.add(identifier("BARCODE", " 000123 "));
        item.add(identifier("MNEMONIC", "Kitchen"));
        assertDoesNotThrow(() -> identifiers.validatePayload(item, Map.of()));

        ArrayNode duplicateMnemonic = mapper.createArrayNode();
        duplicateMnemonic.add(identifier("MNEMONIC", "Kitchen"));
        duplicateMnemonic.add(identifier("MNEMONIC", "KITCHEN"));
        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class, () -> identifiers.validatePayload(duplicateMnemonic, Map.of()));
        assertEquals("CATALOG_IDENTIFIER_DUPLICATE", failure.code());
    }

    @Test
    void identifierFactsRejectUnknownTypeInvalidLengthAndUnicodeControlCharacters() {
        CatalogOwnerApi.Problem typeFailure = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> identifiers.validatePayload(array(identifier("BARCODE4", "123")), Map.of()));
        assertEquals("CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED", typeFailure.code());

        CatalogOwnerApi.Problem lengthFailure = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> identifiers.validatePayload(array(identifier("BARCODE", "x".repeat(161))), Map.of()));
        assertEquals("CATALOG_IDENTIFIER_VALUE_INVALID", lengthFailure.code());

        CatalogOwnerApi.Problem controlFailure = assertThrows(
                CatalogOwnerApi.Problem.class,
                () -> identifiers.validatePayload(array(identifier("BARCODE", "A\u0001B")), Map.of()));
        assertEquals("CATALOG_IDENTIFIER_VALUE_INVALID", controlFailure.code());
    }

    @Test
    void identifierFactsProduceStableUuidRefsForReadback() {
        UUID itemRef = UUID.fromString("11111111-1111-4111-8111-111111111111");
        UUID ownerRef = itemRef;

        UUID first = CatalogIdentifierFacts.deterministicRef(
                itemRef, "CATALOG_ITEM", ownerRef, 0, "BARCODE", "690100000301");
        UUID second = CatalogIdentifierFacts.deterministicRef(
                itemRef, "CATALOG_ITEM", ownerRef, 0, "BARCODE", "690100000301");

        assertEquals(first, second);
        assertDoesNotThrow(() -> UUID.fromString(first.toString()));
    }

    @Test
    void preparationFactsKeepProfileAndEffectStructuresClosedAndDurationsNonNegativeIntegers() {
        ObjectNode profile = mapper.createObjectNode();
        profile.put("productionDisplayName", "热厨制作");
        profile.put("estimatedPreparationSeconds", 100000);
        profile.put("preparationNotes", "按默认流程制作");
        assertDoesNotThrow(() -> preparation.validateProfile(profile));

        ObjectNode effect = mapper.createObjectNode();
        effect.put("instruction", "最后加冰");
        effect.put("preparationSecondsDelta", 3);
        assertDoesNotThrow(() -> preparation.validateEffect(effect));

        ObjectNode unknown = profile.deepCopy();
        unknown.putArray("productionTagRefs").add(UUID.randomUUID().toString());
        CatalogOwnerApi.Problem unknownFailure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> preparation.validateProfile(unknown));
        assertEquals("CATALOG_PREPARATION_UNKNOWN_FIELD", unknownFailure.code());

        ObjectNode effectWithTag = effect.deepCopy();
        effectWithTag.putArray("addProductionTagRefs").add(UUID.randomUUID().toString());
        CatalogOwnerApi.Problem effectTagFailure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> preparation.validateEffect(effectWithTag));
        assertEquals("CATALOG_PREPARATION_UNKNOWN_FIELD", effectTagFailure.code());

        ObjectNode negative = effect.deepCopy();
        negative.put("preparationSecondsDelta", -1);
        CatalogOwnerApi.Problem negativeFailure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> preparation.validateEffect(negative));
        assertEquals("CATALOG_PREPARATION_DURATION_INVALID", negativeFailure.code());

        ObjectNode fractional = profile.deepCopy();
        fractional.put("estimatedPreparationSeconds", 1.5);
        CatalogOwnerApi.Problem fractionalFailure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> preparation.validateProfile(fractional));
        assertEquals("CATALOG_PREPARATION_DURATION_INVALID", fractionalFailure.code());
    }

    @Test
    void skuOverrideRequiresCompleteProfileAndClearUsesInheritanceMode() {
        ObjectNode inherit = mapper.createObjectNode().put("mode", "INHERIT_ITEM");
        inherit.putNull("profile");
        assertDoesNotThrow(() -> preparation.validateOverride(inherit));

        ObjectNode missingProfile = mapper.createObjectNode().put("mode", "OVERRIDE");
        missingProfile.putNull("profile");
        CatalogOwnerApi.Problem missingProfileFailure =
                assertThrows(CatalogOwnerApi.Problem.class, () -> preparation.validateOverride(missingProfile));
        assertEquals("CATALOG_PREPARATION_TARGET_MISMATCH", missingProfileFailure.code());
    }

    private ObjectNode identifier(String type, String value) {
        return mapper.createObjectNode().put("identifierType", type).put("identifierValue", value);
    }

    private ArrayNode array(ObjectNode value) {
        ArrayNode result = mapper.createArrayNode();
        result.add(value);
        return result;
    }
}
