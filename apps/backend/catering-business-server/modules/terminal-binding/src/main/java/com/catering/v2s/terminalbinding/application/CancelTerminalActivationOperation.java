package com.catering.v2s.terminalbinding.application;

import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelOutcome;
import com.catering.v2s.terminalbinding.domain.TerminalCredentialDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Authenticates the terminal credential syntax before calling the binding owner command. */
@Component
public class CancelTerminalActivationOperation {
    private static final String AUTHORIZATION_PREFIX = "Terminal ";

    private final TerminalBindingOwnerApi terminalBindings;

    public CancelTerminalActivationOperation(TerminalBindingOwnerApi terminalBindings) {
        this.terminalBindings = Objects.requireNonNull(terminalBindings, "terminalBindings");
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public DeviceCancelOutcome execute(
            String groupWorkspaceKey, UUID terminalRef, String deviceId, List<String> authorizationValues) {
        ParsedCredential credential = parse(authorizationValues);
        if (credential == null) return DeviceCancelOutcome.CREDENTIAL_INVALID;
        try {
            return terminalBindings.cancelByDevice(new DeviceCancelCommand(
                    groupWorkspaceKey, terminalRef, credential.generation(), credential.digest(), deviceId));
        } finally {
            Arrays.fill(credential.digest(), (byte) 0);
        }
    }

    private static ParsedCredential parse(List<String> authorizationValues) {
        if (authorizationValues == null || authorizationValues.size() != 1) return null;
        String header = authorizationValues.get(0);
        if (header == null || !header.startsWith(AUTHORIZATION_PREFIX)) return null;
        String value = header.substring(AUTHORIZATION_PREFIX.length());
        int separator = value.indexOf('.');
        if (separator <= 0 || separator != value.lastIndexOf('.')) return null;

        long generation;
        String generationText = value.substring(0, separator);
        if (!generationText.matches("[1-9][0-9]{0,18}")) return null;
        try {
            generation = Long.parseLong(generationText);
        } catch (NumberFormatException malformed) {
            return null;
        }
        byte[] secret = decodeSecret(value.substring(separator + 1));
        if (secret == null) return null;
        try {
            return new ParsedCredential(generation, TerminalCredentialDigest.sha256(secret));
        } finally {
            Arrays.fill(secret, (byte) 0);
        }
    }

    private static byte[] decodeSecret(String value) {
        if (!value.matches("[A-Za-z0-9_-]{43}")) return null;
        try {
            byte[] secret = Base64.getUrlDecoder().decode(value);
            if (secret.length != 32
                    || !Base64.getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(secret)
                            .equals(value)) {
                Arrays.fill(secret, (byte) 0);
                return null;
            }
            return secret;
        } catch (IllegalArgumentException malformed) {
            return null;
        }
    }

    private record ParsedCredential(long generation, byte[] digest) {}
}
