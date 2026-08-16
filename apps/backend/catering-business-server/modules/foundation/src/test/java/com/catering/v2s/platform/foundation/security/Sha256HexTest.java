package com.catering.v2s.platform.foundation.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class Sha256HexTest {
    @Test
    void usesTheStableLowercaseSha256HexEncoding() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Sha256Hex.digest("abc"));
        assertEquals(
                Sha256Hex.digest("abc"), Sha256Hex.digest("abc".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    @Test
    void rejectsNullInputsInsteadOfInventingAHash() {
        assertThrows(NullPointerException.class, () -> Sha256Hex.digest((String) null));
        assertThrows(NullPointerException.class, () -> Sha256Hex.digest((byte[]) null));
    }
}
