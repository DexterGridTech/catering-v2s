package com.catering.v2s.terminalbinding.application;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Credential;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads current terminal and binding facts for the business edge and TDS without exposing command APIs. */
@Service
public class TerminalCredentialVerificationService implements TerminalCredentialVerificationApi {
    private final TerminalBindingOwnerPersistence persistence;

    public TerminalCredentialVerificationService(TerminalBindingOwnerPersistence persistence) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
    }

    @Override
    @Transactional(readOnly = true)
    public Verification verify(Credential credential) {
        Objects.requireNonNull(credential, "credential");
        var facts = persistence.readAuthenticationFacts(credential.groupWorkspaceKey(), credential.terminalRef());
        TerminalCredentialDecision.Disposition disposition = TerminalCredentialDecision.classify(
                credential.generation(), credential.secretDigest(), credential.deviceId(), facts);
        if (disposition == TerminalCredentialDecision.Disposition.INVALID) {
            return Verification.rejected(Outcome.CREDENTIAL_INVALID);
        }
        if (disposition == TerminalCredentialDecision.Disposition.CANCELLED) {
            return Verification.rejected(Outcome.ACTIVATION_CANCELLED);
        }
        if (!"ENABLED".equals(facts.groupStatus())) {
            return Verification.rejected(Outcome.GROUP_WORKSPACE_DISABLED);
        }
        if (!"ENABLED".equals(facts.terminalStatus())) {
            return Verification.rejected(Outcome.TERMINAL_DISABLED);
        }
        return new Verification(
                Outcome.VERIFIED,
                facts.workspaceUuid(),
                credential.groupWorkspaceKey(),
                facts.storeRef(),
                credential.terminalRef(),
                facts.generation(),
                facts.activatedAtEpochMillis());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isCurrentActiveBinding(java.util.UUID workspaceUuid, String groupWorkspaceKey,
            java.util.UUID terminalRef, long generation) {
        var facts = persistence.readAuthenticationFacts(groupWorkspaceKey, terminalRef);
        return facts != null && workspaceUuid.equals(facts.workspaceUuid()) && facts.generation() != null
                && facts.generation() == generation && "ACTIVE".equals(facts.bindingStatus())
                && "ENABLED".equals(facts.groupStatus()) && "ENABLED".equals(facts.terminalStatus())
                && "ENABLED".equals(facts.storeStatus());
    }
}
