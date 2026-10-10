package com.catering.v2s.terminalbinding.application;

import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelCommand;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelOutcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialContext;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Executes device cancellation with the edge-resolved terminal credential context. */
@Component
public class CancelTerminalActivationOperation {
    private final TerminalBindingOwnerApi terminalBindings;

    public CancelTerminalActivationOperation(TerminalBindingOwnerApi terminalBindings) {
        this.terminalBindings = Objects.requireNonNull(terminalBindings, "terminalBindings");
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public DeviceCancelOutcome execute(
            String groupWorkspaceKey, UUID terminalRef, TerminalCredentialContext credential) {
        if (credential == null) return DeviceCancelOutcome.CREDENTIAL_INVALID;
        byte[] digest = credential.secretDigest();
        try {
            return terminalBindings.cancelByDevice(
                    new DeviceCancelCommand(groupWorkspaceKey, terminalRef, credential.generation(), digest));
        } finally {
            Arrays.fill(digest, (byte) 0);
        }
    }
}
