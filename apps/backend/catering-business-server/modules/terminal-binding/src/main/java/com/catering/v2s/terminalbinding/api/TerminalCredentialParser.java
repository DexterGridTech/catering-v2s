package com.catering.v2s.terminalbinding.api;

import com.catering.v2s.terminalbinding.domain.TerminalCredentialDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure Java parser for canonical base64url secrets and the generation.secret credential form. */
public final class TerminalCredentialParser {
    private static final Pattern SECRET = Pattern.compile("[A-Za-z0-9_-]{43}");
    private static final Pattern CREDENTIAL = Pattern.compile("([1-9][0-9]{0,18})\\.([A-Za-z0-9_-]{43})");

    private TerminalCredentialParser() {}

    public static byte[] parseSecretDigest(String encodedSecret) {
        byte[] secret = decodeSecret(encodedSecret);
        try {
            return TerminalCredentialDigest.sha256(secret);
        } finally {
            Arrays.fill(secret, (byte) 0);
        }
    }

    public static TerminalCredentialContext parseCredential(String serializedCredential) {
        Matcher matcher = CREDENTIAL.matcher(serializedCredential == null ? "" : serializedCredential);
        if (!matcher.matches()) throw invalidCredential();
        long generation = parseGeneration(matcher.group(1));
        byte[] digest = parseSecretDigest(matcher.group(2));
        try {
            return new TerminalCredentialContext(generation, digest);
        } finally {
            Arrays.fill(digest, (byte) 0);
        }
    }

    private static byte[] decodeSecret(String encodedSecret) {
        if (encodedSecret == null || !SECRET.matcher(encodedSecret).matches()) throw invalidCredential();
        byte[] secret = Base64.getUrlDecoder().decode(encodedSecret);
        if (secret.length != 32
                || !Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString(secret)
                        .equals(encodedSecret)) {
            Arrays.fill(secret, (byte) 0);
            throw invalidCredential();
        }
        return secret;
    }

    private static long parseGeneration(String digits) {
        long generation = 0;
        for (int index = 0; index < digits.length(); index++) {
            int digit = digits.charAt(index) - '0';
            if (generation > (Long.MAX_VALUE - digit) / 10) throw invalidCredential();
            generation = generation * 10 + digit;
        }
        return generation;
    }

    private static IllegalArgumentException invalidCredential() {
        return new IllegalArgumentException("terminal credential is invalid");
    }
}
