package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalActivationRequest;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.storeterminal.domain.ActivationCode;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.terminalbinding.domain.TerminalCredentialDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.Objects;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Coordinates the public activation protocol across the terminal and binding owners. */
@Component
public class ActivateTerminalOperation {
    private final StoreTerminalOwnerApi storeTerminals;
    private final TerminalBindingOwnerApi terminalBindings;

    public ActivateTerminalOperation(StoreTerminalOwnerApi storeTerminals, TerminalBindingOwnerApi terminalBindings) {
        this.storeTerminals = Objects.requireNonNull(storeTerminals, "storeTerminals");
        this.terminalBindings = Objects.requireNonNull(terminalBindings, "terminalBindings");
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public TerminalBindingOwnerApi.ActivationResult execute(
            String groupWorkspaceKey, TerminalActivationRequest request) {
        requireText(groupWorkspaceKey, 128, "groupWorkspaceKey");
        Objects.requireNonNull(request, "request");
        ActivationCode activationCode = activationCode(request.activationCode());
        String deviceId = requireText(request.deviceId(), 128, "deviceId");
        String surfaceForm = request.surfaceForm();
        if (!"laptop".equals(surfaceForm) && !"mobile".equals(surfaceForm)) {
            throw invalidRequest();
        }
        requireText(request.appVersion(), 64, "appVersion");
        byte[] secret = decodeSecret(request.credentialSecret());
        byte[] digest = TerminalCredentialDigest.sha256(secret);
        Arrays.fill(secret, (byte) 0);
        try {
            StoreTerminalOwnerApi.ActivationCandidate storeCandidate =
                    storeTerminals.lockActivationCandidate(groupWorkspaceKey, activationCode, surfaceForm);
            if (storeCandidate == null) {
                return TerminalBindingOwnerApi.ActivationResult.rejected(
                        TerminalBindingOwnerApi.ActivationOutcome.RESOURCE_NOT_FOUND);
            }
            var candidate = new TerminalBindingOwnerApi.ActivationCandidate(
                    storeCandidate.workspaceUuid(),
                    storeCandidate.groupWorkspaceKey(),
                    storeCandidate.activationCodeFound(),
                    storeCandidate.storeRef(),
                    storeCandidate.terminalRef(),
                    storeCandidate.terminalStatus(),
                    storeCandidate.deviceType(),
                    storeCandidate.surfaceForm());
            return terminalBindings.activateOrReplay(new TerminalBindingOwnerApi.ActivationCommand(
                    candidate, deviceId, digest, AuditActor.terminalDevice()));
        } finally {
            Arrays.fill(digest, (byte) 0);
        }
    }

    private static ActivationCode activationCode(String value) {
        if (value == null || !value.matches("[0-9]{8}")) throw invalidRequest();
        return ActivationCode.of(value);
    }

    private static byte[] decodeSecret(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{43}")) throw invalidRequest();
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(value);
            if (decoded.length != 32
                    || !Base64.getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(decoded)
                            .equals(value)) {
                Arrays.fill(decoded, (byte) 0);
                throw invalidRequest();
            }
            return decoded;
        } catch (IllegalArgumentException malformed) {
            throw invalidRequest(malformed);
        }
    }

    private static String requireText(String value, int maxLength, String field) {
        if (value == null || value.isBlank() || value.length() > maxLength) throw invalidRequest();
        return value;
    }

    private static InvalidEdgeRequestException invalidRequest() {
        return new InvalidEdgeRequestException("terminal activation request is invalid");
    }

    private static InvalidEdgeRequestException invalidRequest(Throwable cause) {
        return new InvalidEdgeRequestException("terminal activation request is invalid", cause);
    }
}
