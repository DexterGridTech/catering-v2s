package com.catering.v2s.terminalbinding.api;

import java.util.Arrays;

/** Edge-resolved terminal credential identity passed to device-cancel application work. */
public record TerminalCredentialContext(long generation, byte[] secretDigest) implements AutoCloseable {
    public TerminalCredentialContext {
        if (generation < 1) throw new IllegalArgumentException("generation is invalid");
        if (secretDigest == null || secretDigest.length != 32) {
            throw new IllegalArgumentException("secretDigest is invalid");
        }
        secretDigest = secretDigest.clone();
    }

    @Override
    public byte[] secretDigest() {
        return secretDigest.clone();
    }

    @Override
    public void close() {
        Arrays.fill(secretDigest, (byte) 0);
    }

    @Override
    public String toString() {
        return "TerminalCredentialContext[generation=" + generation + ", secretDigest=redacted]";
    }
}
