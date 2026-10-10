package com.catering.v2s.app.application.terminalupdate;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleCreateRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleDetail;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** M1 operations entry for creating a project-owned terminal update rule. */
@Component
public class CreateOperationsProjectTerminalUpdateRuleOperation {
    public static final String OPERATION_ID = "createOperationsProjectTerminalUpdateRule";
    private static final String REQUIREMENT = "REQ_CREATE_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE";

    private final CommandExecutionContextResolver contexts;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final TerminalUpdateRuleOwnerApi rules;

    public CreateOperationsProjectTerminalUpdateRuleOperation(
            CommandExecutionContextResolver contexts,
            WorkspaceCapabilityScopeResolver capabilityScopes,
            TerminalUpdateRuleOwnerApi rules) {
        this.contexts = Objects.requireNonNull(contexts, "contexts");
        this.capabilityScopes = Objects.requireNonNull(capabilityScopes, "capabilityScopes");
        this.rules = Objects.requireNonNull(rules, "rules");
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public TerminalUpdateRuleDetail execute(Invocation invocation) {
        var facts = contexts.resolveOperations(invocation.sessionCredential(), invocation.groupWorkspaceKey());
        var session = facts.sessionReadback();
        if (session.contextVersion() != invocation.expectedContextVersion())
            throw new com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService.SessionConflictException();
        var authorization = capabilityScopes.resolveGeneratedOperation(
                session,
                REQUIREMENT,
                WorkspaceAuthorizationCatalog.CapabilityKeys.MANAGE_PROJECT_TERMINAL_VERSION,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource("PROJECT", invocation.projectRef()));
        if (authorization.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService.AuthorizationDeniedException();

        TerminalUpdateRuleCreateRequest request = Objects.requireNonNull(invocation.request(), "request");
        return TerminalUpdateRuleWire.from(rules.create(new TerminalUpdateRuleOwnerApi.CreateRule(
                session.workspaceUuid(), invocation.groupWorkspaceKey(), invocation.projectRef(), request.targetMode(),
                request.storeRefs(), request.fullArtifactRef(), request.hotArtifactRef(), request.status(),
                request.nSeconds(), request.hotStrategy(), request.mSeconds(), request.description(),
                session.contextVersion(), invocation.idempotencyKey(),
                new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName()),
                authorization.ownerScopeGrant(REQUIREMENT))));
    }

    public record Invocation(
            TerminalUpdateRuleCreateRequest request,
            String sessionCredential,
            String groupWorkspaceKey,
            UUID projectRef,
            long expectedContextVersion,
            String correlationId,
            String requestId,
            String idempotencyKey) {}
}
