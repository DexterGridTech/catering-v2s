package com.catering.v2s.platform.foundation.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Objects;

/** Stateless SHA-256 to lowercase-hex conversion for request and content fingerprints. */
public final class Sha256Hex {
    private Sha256Hex() { }

    public static String digest(String value) {
        return digest(Objects.requireNonNull(value, "value").getBytes(StandardCharsets.UTF_8));
    }

    public static String digest(byte[] value) {
        Objects.requireNonNull(value, "value");
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (Exception failure) {
            throw new IllegalStateException("SHA-256 unavailable", failure);
        }
    }
}
