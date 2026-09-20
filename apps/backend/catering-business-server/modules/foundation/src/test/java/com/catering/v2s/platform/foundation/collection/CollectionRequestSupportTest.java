package com.catering.v2s.platform.foundation.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CollectionRequestSupportTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void parsesOptionalPageSizeCursorAndBooleanAtOneBoundary() throws Exception {
        var request = MAPPER.readTree("{\"pageSize\":20,\"cursor\":\"4\",\"enabled\":true}");

        assertEquals(20, CollectionRequestSupport.pageSize(request, "pageSize", 10));
        assertEquals(4L, CollectionRequestSupport.cursor(request, "cursor"));
        assertTrue(CollectionRequestSupport.booleanValue(request, "enabled", false));
        assertEquals("4", CollectionRequestSupport.optional(request, "cursor"));
    }

    @Test
    void keepsDefaultsAndRejectsInvalidValuesWithTheField() throws Exception {
        var empty = MAPPER.readTree("{}");
        assertEquals(10, CollectionRequestSupport.pageSize(empty, "pageSize", 10));
        assertEquals(0L, CollectionRequestSupport.cursor(empty, "cursor"));
        assertFalse(CollectionRequestSupport.booleanValue(empty, "enabled", false));

        var invalid = MAPPER.readTree("{\"pageSize\":101}");
        var failure = assertThrows(
                CollectionRequestSupport.InvalidRequestValue.class,
                () -> CollectionRequestSupport.pageSize(invalid, "pageSize", 10));
        assertEquals("pageSize", failure.field());
    }
}
