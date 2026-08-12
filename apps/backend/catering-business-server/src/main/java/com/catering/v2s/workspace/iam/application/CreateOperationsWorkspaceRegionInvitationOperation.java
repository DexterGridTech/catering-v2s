package com.catering.v2s.workspace.iam.application;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceOperationsCommandApi;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
@Component public class CreateOperationsWorkspaceRegionInvitationOperation {
 public static final String OPERATION_ID = "createOperationsWorkspaceRegionInvitation"; private final WorkspaceOperationsCommandApi commands;
 public CreateOperationsWorkspaceRegionInvitationOperation(WorkspaceOperationsCommandApi commands){this.commands=commands;}
 @Transactional(propagation=Propagation.REQUIRED) public WorkspaceInvitationService.ManagementInvitationView execute(WorkspaceCommandAuthorizationFacts facts, WorkspaceOperationsInvitationCreateRequest request, AuditActor actor){return commands.createInvitation(new WorkspaceOperationsCommandApi.InvitationCreateCommand(facts,ServiceNodeTypes.REGION,uuid(request.scopeRef()),request.mobile(),request.roleIds().stream().map(UUID::fromString).toList(),request.idempotencyKey(),actor));}
 private static UUID uuid(String value){return value==null||value.isBlank()?null:UUID.fromString(value);}
}
