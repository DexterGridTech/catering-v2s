package com.catering.v2s.platform.access;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Verifies the provider-owned short-lived edge context before any controller work. */
public final class EdgeContextVerifier {
    private static final String VERSION = "v1";
    private static final String FACE = "platform-admin";

    public PlatformExecutionContext verify(String edgeAuth, String expectedFace, String secret) {
        if (secret == null || secret.isBlank()) {
            throw new InvalidEdgeContextException("edge verification secret is unavailable");
        }
        if (!FACE.equals(expectedFace)) {
            throw new InvalidEdgeContextException("unsupported consumer face");
        }
        String[] parts = edgeAuth == null ? new String[0] : edgeAuth.split("\\.", -1);
        if (parts.length != 3 || !VERSION.equals(parts[0])) {
            throw new InvalidEdgeContextException("edge context shape is invalid");
        }
        String payload = decode(parts[1]);
        String expectedSignature = sign(parts[1], secret);
        if (!MessageDigest.isEqual(
                parts[2].getBytes(StandardCharsets.UTF_8), expectedSignature.getBytes(StandardCharsets.UTF_8))) {
            throw new InvalidEdgeContextException("edge context signature is invalid");
        }
        String[] fields = payload.split("\\|", -1);
        if (fields.length != 4) {
            throw new InvalidEdgeContextException("edge context payload is invalid");
        }
        Instant expiresAt;
        try {
            expiresAt = Instant.ofEpochSecond(Long.parseLong(fields[2]));
        } catch (RuntimeException exception) {
            throw new InvalidEdgeContextException("edge context expiry is invalid", exception);
        }
        if (!FACE.equals(fields[1]) || !expiresAt.isAfter(Instant.now())) {
            throw new InvalidEdgeContextException("edge context is expired or face does not match");
        }
        return new PlatformExecutionContext(fields[0], fields[1], expiresAt, fields[3]);
    }

    private static String decode(String value) {
        try {
            return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            throw new InvalidEdgeContextException("edge context encoding is invalid", exception);
        }
    }

    private static String sign(String encodedPayload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(mac.doFinal(encodedPayload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("edge context verifier unavailable", exception);
        }
    }

    public static String encodeForControlledProvider(
            String subject, Instant expiresAt, String correlationId, String secret) {
        String payload = String.join("|", subject, FACE, Long.toString(expiresAt.getEpochSecond()), correlationId);
        String encoded =
                Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return VERSION + "." + encoded + "." + sign(encoded, secret);
    }

    public static final class InvalidEdgeContextException extends RuntimeException {
        public InvalidEdgeContextException(String message) {
            super(message);
        }

        public InvalidEdgeContextException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
