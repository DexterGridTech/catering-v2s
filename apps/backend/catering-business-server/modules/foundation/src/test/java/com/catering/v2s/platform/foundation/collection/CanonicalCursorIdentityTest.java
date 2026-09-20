package com.catering.v2s.platform.foundation.collection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class CanonicalCursorIdentityTest {
    @Test
    void preservesDelimiterCharactersAndNullAsDistinctComponents() {
        String first = CanonicalCursorIdentity.encode("a\u001fb", "c", null);
        String second = CanonicalCursorIdentity.encode("a", "b\u001fc", null);

        assertNotEquals(first, second);
        assertEquals(Arrays.asList("a\u001fb", "c", null), CanonicalCursorIdentity.decode(first, 3));
        assertEquals(Arrays.asList("a", "b\u001fc", null), CanonicalCursorIdentity.decode(second, 3));
    }
}
