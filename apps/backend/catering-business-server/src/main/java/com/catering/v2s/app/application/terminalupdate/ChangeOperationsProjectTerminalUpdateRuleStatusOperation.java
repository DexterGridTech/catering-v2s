package com.catering.v2s.app.application.terminalupdate;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleStatusRequest;
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

/** M1 operations entry for changing a project-owned rule's enabled state. */
@Component
public class ChangeOperationsProjectTerminalUpdateRuleStatusOperation {
    public static final String OPERATION_ID = "changeOperationsProjectTerminalUpdateRuleStatus";
    private static final String REQUIREMENT = "REQ_CHANGE_OPERATIONS_PROJECT_TERMINAL_UPDATE_RULE_STATUS";

    private final CommandExecutionContextResolver contexts;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final TerminalUpdateRuleOwnerApi rules;

    public ChangeOperationsProjectTerminalUpdateRuleStatusOperation(
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

        TerminalUpdateRuleStatusRequest request = Objects.requireNonNull(invocation.request(), "request");
        return TerminalUpdateRuleWire.from(rules.changeStatus(new TerminalUpdateRuleOwnerApi.ChangeRuleStatus(
                session.workspaceUuid(), invocation.groupWorkspaceKey(), invocation.projectRef(), invocation.ruleRef(),
                request.revision(), request.status(), request.reason(), session.contextVersion(), invocation.idempotencyKey(),
                new AuditActor("WORKSPACE_ACCOUNT", session.accountId(), session.accountDisplayName()))));
    }

    public record Invocation(
            TerminalUpdateRuleStatusRequest request,
            String sessionCredential,
            String groupWorkspaceKey,
            UUID projectRef,
            UUID ruleRef,
            long expectedContextVersion,
            String correlationId,
            String requestId,
            String idempotencyKey) {}
}
