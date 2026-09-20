package com.catering.v2s.platform.foundation.persistence;

import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Objects;

/**
 * Shared, owner-neutral parts of the command receipt protocol.
 *
 * <p>This class deliberately owns no receipt table, transaction, problem code, or readback type. Those facts stay in
 * the owner module; this helper only prevents every owner from reimplementing the byte-level hash and JSON boundary.
 */
public final class CommandReceiptSupport {
    private CommandReceiptSupport() {}

    /**
     * The owner persistence still owns its table and SQL, but every insert-as-claim implementation must interpret
     * the affected-row count identically.  A single inserted row is the claim; no row means that another transaction
     * already owns the key.  Anything else is a broken persistence contract, not a business result.
     */
    public enum ClaimOutcome {
        CLAIMED,
        EXISTING
    }

    public static ClaimOutcome claimOutcome(int affectedRows) {
        return switch (affectedRows) {
            case 1 -> ClaimOutcome.CLAIMED;
            case 0 -> ClaimOutcome.EXISTING;
            default -> throw new IllegalStateException("command receipt claim affected an unexpected row count");
        };
    }

    public static String requestHash(String canonicalRequest) {
        Objects.requireNonNull(canonicalRequest, "canonicalRequest");
        return Sha256Hex.digest(canonicalRequest);
    }

    public static String serialize(ObjectMapper mapper, Object value, String failureMessage) {
        Objects.requireNonNull(mapper, "mapper");
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException(failureMessage, failure);
        }
    }

    /** A nullable response is a valid historical claim-only receipt, not JSON corruption. */
    public static String serializeNullable(ObjectMapper mapper, Object value, String failureMessage) {
        return value == null ? null : serialize(mapper, value, failureMessage);
    }

    public static <T> T deserialize(ObjectMapper mapper, String json, Class<T> responseType, String failureMessage) {
        Objects.requireNonNull(mapper, "mapper");
        Objects.requireNonNull(responseType, "responseType");
        try {
            return mapper.readValue(json, responseType);
        } catch (Exception failure) {
            throw new IllegalStateException(failureMessage, failure);
        }
    }

    /**
     * Replays a historical claim-only receipt without entering the corrupt-receipt branch.  Owners decide what a
     * null replay means to their readback contract; this helper only preserves the protocol distinction.
     */
    public static <T> T deserializeNullable(
            ObjectMapper mapper, String json, Class<T> responseType, String failureMessage) {
        return json == null ? null : deserialize(mapper, json, responseType, failureMessage);
    }
}
