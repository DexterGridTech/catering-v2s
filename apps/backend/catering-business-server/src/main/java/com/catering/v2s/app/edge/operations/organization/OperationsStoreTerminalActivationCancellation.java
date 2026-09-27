package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Coordinates the authorized store-target judgment and terminal-binding cancellation in one transaction. */
@Component
public class OperationsStoreTerminalActivationCancellation {
    public static final String OPERATION_ID = "cancelOperationsStoreTerminalActivation";
    private static final String REQUIREMENT_ID = "REQ_CANCEL_OPERATIONS_STORE_TERMINAL_ACTIVATION";
    private static final String CAPABILITY = "EDIT_STORE_TERMINAL";

    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final StoreTerminalOwnerApi storeTerminals;
    private final TerminalBindingOwnerApi terminalBindings;

    public OperationsStoreTerminalActivationCancellation(
            WorkspaceCapabilityScopeResolver capabilityScopes,
            StoreTerminalOwnerApi storeTerminals,
            TerminalBindingOwnerApi terminalBindings) {
        this.capabilityScopes = Objects.requireNonNull(capabilityScopes, "capabilityScopes");
        this.storeTerminals = Objects.requireNonNull(storeTerminals, "storeTerminals");
        this.terminalBindings = Objects.requireNonNull(terminalBindings, "terminalBindings");
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public TerminalBindingOwnerApi.OperationsCancelOutcome execute(
            WorkspaceSessionReadback session,
            UUID storeRef,
            UUID terminalRef,
            long expectedGeneration,
            String idempotencyKey,
            AuditActor actor) {
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(storeRef, "storeRef");
        Objects.requireNonNull(terminalRef, "terminalRef");
        Objects.requireNonNull(actor, "actor");

        var resolution = capabilityScopes.resolveGeneratedOperation(
                session,
                REQUIREMENT_ID,
                CAPABILITY,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.STORE, storeRef));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }

        var serverGrant = resolution.ownerScopeGrant(REQUIREMENT_ID);
        var target = storeTerminals.resolveOperationsActivationCancellationTarget(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                storeRef,
                terminalRef,
                session.contextVersion(),
                serverGrant);
        var bindingTarget = new TerminalBindingOwnerApi.OperationsCancelTarget(
                target.workspaceUuid(), target.groupWorkspaceKey(), target.storeRef(), target.terminalRef());
        var bindingGrant = new TerminalBindingOwnerApi.OperationsCancelGrant(
                serverGrant.workspaceUuid(),
                serverGrant.groupWorkspaceKey(),
                serverGrant.requirementId(),
                serverGrant.capabilityKey(),
                serverGrant.targetType(),
                serverGrant.targetId(),
                serverGrant.expectedContextVersion());
        return terminalBindings.cancelByOperations(new TerminalBindingOwnerApi.OperationsCancelCommand(
                bindingTarget, bindingGrant, session.contextVersion(), expectedGeneration, idempotencyKey, actor));
    }
}
