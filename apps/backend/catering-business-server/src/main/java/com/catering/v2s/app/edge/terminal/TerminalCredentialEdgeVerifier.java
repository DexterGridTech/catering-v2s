package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.platform.identity.GroupWorkspaceKey;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.terminalbinding.api.TerminalCredentialContext;
import com.catering.v2s.terminalbinding.api.TerminalCredentialParser;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Credential;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import java.util.Arrays;
import java.util.UUID;

/** Shared terminal-edge credential verification for read-only and update delivery endpoints. */
final class TerminalCredentialEdgeVerifier {
    private static final String AUTHORIZATION_PREFIX = "Terminal ";

    private TerminalCredentialEdgeVerifier() {}

    static Verification verify(TerminalCredentialVerificationApi credentials, String groupKey,
            String authorization, String terminalRef, String deviceId) {
        if (!GroupWorkspaceKey.isValid(groupKey) || terminalRef == null || deviceId == null
                || deviceId.isBlank() || deviceId.length() > 128 || authorization == null
                || !authorization.startsWith(AUTHORIZATION_PREFIX)) throw invalid();
        UUID terminal = uuid(terminalRef);
        try (TerminalCredentialContext context = TerminalCredentialParser.parseCredential(
                authorization.substring(AUTHORIZATION_PREFIX.length()))) {
            byte[] digest = context.secretDigest();
            try {
                Verification verification = credentials.verify(
                        new Credential(groupKey, terminal, context.generation(), digest, deviceId));
                if (verification.outcome() != Outcome.VERIFIED) throw problem(verification.outcome());
                if (!groupKey.equals(verification.groupWorkspaceKey())
                        || !terminal.equals(verification.terminalRef())) throw TerminalDataReadProblem.denied();
                return verification;
            } finally {
                Arrays.fill(digest, (byte) 0);
            }
        } catch (IllegalArgumentException malformed) {
            throw invalid(malformed);
        }
    }

    private static UUID uuid(String value) {
        try { return UUID.fromString(value); }
        catch (RuntimeException malformed) { throw invalid(malformed); }
    }

    private static InvalidEdgeRequestException invalid() {
        return new InvalidEdgeRequestException("terminal read request is invalid");
    }

    private static InvalidEdgeRequestException invalid(Throwable cause) {
        return new InvalidEdgeRequestException("terminal read request is invalid", cause);
    }

    private static TerminalDataReadProblem problem(Outcome outcome) {
        return switch (outcome) {
            case CREDENTIAL_INVALID, ACTIVATION_CANCELLED -> TerminalDataReadProblem.credentialInvalid();
            case GROUP_WORKSPACE_DISABLED -> TerminalDataReadProblem.workspaceDisabled();
            case TERMINAL_DISABLED -> TerminalDataReadProblem.terminalDisabled();
            case VERIFIED -> throw new IllegalStateException("verified outcome has no problem mapping");
        };
    }
}
