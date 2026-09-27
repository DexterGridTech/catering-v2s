package com.catering.v2s.terminalbinding.domain;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Objects;

/** Computes the only credential representation stored by terminal-binding. */
public final class TerminalCredentialDigest {
    private TerminalCredentialDigest() {}

    public static byte[] sha256(byte[] secret) {
        Objects.requireNonNull(secret, "secret");
        if (secret.length != 32) throw new IllegalArgumentException("credential secret length is invalid");
        try {
            return Arrays.copyOf(MessageDigest.getInstance("SHA-256").digest(secret), 32);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }
}
