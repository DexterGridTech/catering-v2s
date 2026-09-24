package com.catering.v2s.storeterminal.domain;

import java.util.Objects;

/** Eight-character store terminal activation code with an intentionally redacted diagnostic form. */
public final class ActivationCode {
    private final String value;

    private ActivationCode(String value) {
        this.value = value;
    }

    public static ActivationCode of(String value) {
        Objects.requireNonNull(value, "value");
        if (!value.matches("[0-9]{8}"))
            throw new IllegalArgumentException("activation code must be eight ASCII digits");
        return new ActivationCode(value);
    }

    /** Explicitly reveals the value for owner persistence or the authorized detail response only. */
    public String value() {
        return value;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof ActivationCode code && value.equals(code.value);
    }

    @Override
    public int hashCode() {
        return value.hashCode();
    }

    @Override
    public String toString() {
        return "ActivationCode[redacted]";
    }
}
