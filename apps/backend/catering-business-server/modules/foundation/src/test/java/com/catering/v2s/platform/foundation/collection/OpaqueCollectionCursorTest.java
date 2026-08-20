package com.catering.v2s.platform.foundation.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class OpaqueCollectionCursorTest {
    private static final UUID TIE_BREAKER = UUID.fromString("11111111-1111-4111-8111-111111111111");

    @Test
    void roundTripPreservesFrontierAndHidesQueryShape() {
        String token = OpaqueCollectionCursor.encode("dictionary|scope|brand|20", "CODE-20", TIE_BREAKER);

        OpaqueCollectionCursor.Position position = OpaqueCollectionCursor.decode(token, "dictionary|scope|brand|20");

        assertEquals("CODE-20", position.sortKey());
        assertEquals(TIE_BREAKER, position.tieBreaker());
        assertEquals(-1, token.indexOf("dictionary|scope|brand|20"));
    }

    @Test
    void rejectsCursorForDifferentQueryIdentity() {
        String token = OpaqueCollectionCursor.encode("dictionary|scope|brand|20", "CODE-20", TIE_BREAKER);

        assertThrows(
                OpaqueCollectionCursor.InvalidCursor.class,
                () -> OpaqueCollectionCursor.decode(token, "dictionary|other-brand|20"));
    }

    @Test
    void blankCursorMeansFirstPage() {
        assertNull(OpaqueCollectionCursor.decode(null, "dictionary|scope|brand|20"));
        assertNull(OpaqueCollectionCursor.decode("", "dictionary|scope|brand|20"));
    }
}
