package com.catering.v2s.generated.operationbindings.workspaceiam;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for workspace-iam. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class WorkspaceIamOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.PublicInvitationAcceptIntent acceptPublicInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceGroupInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceHeadCompanyInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceProjectInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceRegionInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceStoreInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.PlatformWorkspaceInvitation cancelWorkspaceInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceInvitationCancelRequest request);
    OperationBindingTypes.Wire.WorkspaceCurrentPasswordChangeResult changeCurrentWorkspacePassword(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceCurrentPasswordChangeRequest request);
    OperationBindingTypes.Wire.OperationsPasswordRecoveryCompletion completeOperationsPasswordRecovery(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryCompleteRequest request);
    OperationBindingTypes.Wire.PublicInvitationCompletion completePublicInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceGroupInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceHeadCompanyInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceProjectInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceRegionInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceStoreInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request);
    OperationBindingTypes.Wire.PlatformWorkspaceInvitation createWorkspaceInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceInvitationCreateRequest request);
    OperationBindingTypes.Wire.WorkspaceRole createWorkspaceRole(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceRoleCreateRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitationCandidatePage getOperationsWorkspaceGroupInvitationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationPage getOperationsWorkspaceGroupInvitations(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUserPage getOperationsWorkspaceGroupUser(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUser getOperationsWorkspaceGroupUserAccount(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationCandidatePage getOperationsWorkspaceHeadCompanyInvitationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationPage getOperationsWorkspaceHeadCompanyInvitations(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUserPage getOperationsWorkspaceHeadCompanyUser(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUser getOperationsWorkspaceHeadCompanyUserAccount(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceLoginEntry getOperationsWorkspaceLoginEntry(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationCandidatePage getOperationsWorkspaceProjectInvitationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationPage getOperationsWorkspaceProjectInvitations(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUserPage getOperationsWorkspaceProjectUser(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUser getOperationsWorkspaceProjectUserAccount(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationCandidatePage getOperationsWorkspaceRegionInvitationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationPage getOperationsWorkspaceRegionInvitations(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUserPage getOperationsWorkspaceRegionUser(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUser getOperationsWorkspaceRegionUserAccount(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceSessionEntry getOperationsWorkspaceSessionEntry(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationCandidatePage getOperationsWorkspaceStoreInvitationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationPage getOperationsWorkspaceStoreInvitations(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUserPage getOperationsWorkspaceStoreUser(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceUser getOperationsWorkspaceStoreUserAccount(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PublicInvitationCompletion getPublicInvitationCompletion(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PublicInvitationView getPublicInvitationView(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceAccount getWorkspaceAccount(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceAccountPage getWorkspaceAccounts(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PlatformWorkspaceInvitation getWorkspaceInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceInvitationCandidatePage getWorkspaceInvitationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PlatformWorkspaceInvitationPage getWorkspaceInvitations(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceRole getWorkspaceRole(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceRolePage getWorkspaceRoles(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.NoContent operationsWorkspaceLogout(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.WorkspaceSessionEntry operationsWorkspacePasswordLogin(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspacePasswordLoginRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceGroupInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceHeadCompanyInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceProjectInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceRegionInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceStoreInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request);
    OperationBindingTypes.Wire.PlatformWorkspaceInvitation reissueWorkspaceInvitation(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceInvitationReissueRequest request);
    OperationBindingTypes.Wire.WorkspaceCredentialResetResult requestWorkspaceCredentialReset(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceCredentialResetRequest request);
    OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceGroupUserAssignment(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request);
    OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceHeadCompanyUserAssignment(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request);
    OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceProjectUserAssignment(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request);
    OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceRegionUserAssignment(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request);
    OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceStoreUserAssignment(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request);
    OperationBindingTypes.Wire.WorkspaceAssignmentRevokeResult revokePlatformWorkspaceAssignment(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceAssignmentRevokeRequest request);
    OperationBindingTypes.Wire.PublicInvitationCredentialResponse savePublicInvitationCredentials(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.PublicInvitationCredentialRequest request);
    OperationBindingTypes.Wire.WorkspaceSessionEntry selectOperationsWorkspaceSessionContext(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceSelectContextRequest request);
    OperationBindingTypes.Wire.WorkspaceSessionEntry selectOperationsWorkspaceSessionDataNode(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceSelectDataNodeRequest request);
    OperationBindingTypes.Wire.OperationsPasswordRecoveryOtpSendResponse sendOperationsPasswordRecoveryOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryOtpSendRequest request);
    OperationBindingTypes.Wire.WorkspaceOtpSendResponse sendOperationsWorkspaceOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceOtpSendRequest request);
    OperationBindingTypes.Wire.PublicInvitationOtpSendResponse sendPublicInvitationOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.PublicInvitationOtpSendRequest request);
    OperationBindingTypes.Wire.OperationsPasswordRecoveryStartResponse startOperationsPasswordRecovery(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryStartRequest request);
    OperationBindingTypes.Wire.WorkspaceAccount transitionWorkspaceAccountStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceAccountStatusTransitionRequest request);
    OperationBindingTypes.Wire.WorkspaceRole transitionWorkspaceRoleStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceRoleStatusTransitionRequest request);
    OperationBindingTypes.Wire.WorkspaceRole updateWorkspaceRole(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceRoleUpdateRequest request);
    OperationBindingTypes.Wire.OperationsPasswordRecoveryVerification verifyOperationsPasswordRecoveryOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryOtpVerifyRequest request);
    OperationBindingTypes.Wire.WorkspaceSessionEntry verifyOperationsWorkspaceOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceOtpVerifyRequest request);
    OperationBindingTypes.Wire.PublicInvitationReadiness verifyPublicInvitationOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.PublicInvitationOtpVerifyRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public WorkspaceIamOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor ACCEPT_PUBLIC_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("acceptPublicInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_OPERATIONS_WORKSPACE_GROUP_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelOperationsWorkspaceGroupInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelOperationsWorkspaceHeadCompanyInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_OPERATIONS_WORKSPACE_PROJECT_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelOperationsWorkspaceProjectInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_OPERATIONS_WORKSPACE_REGION_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelOperationsWorkspaceRegionInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_OPERATIONS_WORKSPACE_STORE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelOperationsWorkspaceStoreInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CANCEL_WORKSPACE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("cancelWorkspaceInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CHANGE_CURRENT_WORKSPACE_PASSWORD_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("changeCurrentWorkspacePassword", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor COMPLETE_OPERATIONS_PASSWORD_RECOVERY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("completeOperationsPasswordRecovery", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor COMPLETE_PUBLIC_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("completePublicInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_WORKSPACE_GROUP_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsWorkspaceGroupInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsWorkspaceHeadCompanyInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_WORKSPACE_PROJECT_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsWorkspaceProjectInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_WORKSPACE_REGION_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsWorkspaceRegionInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_WORKSPACE_STORE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsWorkspaceStoreInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_WORKSPACE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createWorkspaceInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_WORKSPACE_ROLE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createWorkspaceRole", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_GROUP_INVITATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceGroupInvitationCandidates", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_GROUP_INVITATIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceGroupInvitations", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_GROUP_USER_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceGroupUser", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_GROUP_USER_ACCOUNT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceGroupUserAccount", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceHeadCompanyInvitationCandidates", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceHeadCompanyInvitations", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceHeadCompanyUser", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ACCOUNT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceHeadCompanyUserAccount", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_LOGIN_ENTRY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceLoginEntry", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceProjectInvitationCandidates", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_PROJECT_INVITATIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceProjectInvitations", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_PROJECT_USER_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceProjectUser", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_PROJECT_USER_ACCOUNT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceProjectUserAccount", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_REGION_INVITATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceRegionInvitationCandidates", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_REGION_INVITATIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceRegionInvitations", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_REGION_USER_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceRegionUser", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_REGION_USER_ACCOUNT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceRegionUserAccount", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_SESSION_ENTRY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceSessionEntry", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_STORE_INVITATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceStoreInvitationCandidates", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_STORE_INVITATIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceStoreInvitations", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_STORE_USER_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceStoreUser", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_WORKSPACE_STORE_USER_ACCOUNT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsWorkspaceStoreUserAccount", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PUBLIC_INVITATION_COMPLETION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPublicInvitationCompletion", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PUBLIC_INVITATION_VIEW_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPublicInvitationView", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_ACCOUNT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceAccount", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_ACCOUNTS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceAccounts", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_INVITATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceInvitationCandidates", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_INVITATIONS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceInvitations", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_ROLE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceRole", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_WORKSPACE_ROLES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getWorkspaceRoles", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor OPERATIONS_WORKSPACE_LOGOUT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("operationsWorkspaceLogout", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor OPERATIONS_WORKSPACE_PASSWORD_LOGIN_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("operationsWorkspacePasswordLogin", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REISSUE_OPERATIONS_WORKSPACE_GROUP_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reissueOperationsWorkspaceGroupInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REISSUE_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reissueOperationsWorkspaceHeadCompanyInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REISSUE_OPERATIONS_WORKSPACE_PROJECT_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reissueOperationsWorkspaceProjectInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REISSUE_OPERATIONS_WORKSPACE_REGION_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reissueOperationsWorkspaceRegionInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REISSUE_OPERATIONS_WORKSPACE_STORE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reissueOperationsWorkspaceStoreInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REISSUE_WORKSPACE_INVITATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("reissueWorkspaceInvitation", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REQUEST_WORKSPACE_CREDENTIAL_RESET_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("requestWorkspaceCredentialReset", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REVOKE_OPERATIONS_WORKSPACE_GROUP_USER_ASSIGNMENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("revokeOperationsWorkspaceGroupUserAssignment", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REVOKE_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ASSIGNMENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("revokeOperationsWorkspaceHeadCompanyUserAssignment", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REVOKE_OPERATIONS_WORKSPACE_PROJECT_USER_ASSIGNMENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("revokeOperationsWorkspaceProjectUserAssignment", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REVOKE_OPERATIONS_WORKSPACE_REGION_USER_ASSIGNMENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("revokeOperationsWorkspaceRegionUserAssignment", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REVOKE_OPERATIONS_WORKSPACE_STORE_USER_ASSIGNMENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("revokeOperationsWorkspaceStoreUserAssignment", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REVOKE_PLATFORM_WORKSPACE_ASSIGNMENT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("revokePlatformWorkspaceAssignment", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SAVE_PUBLIC_INVITATION_CREDENTIALS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("savePublicInvitationCredentials", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SELECT_OPERATIONS_WORKSPACE_SESSION_CONTEXT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("selectOperationsWorkspaceSessionContext", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SELECT_OPERATIONS_WORKSPACE_SESSION_DATA_NODE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("selectOperationsWorkspaceSessionDataNode", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SEND_OPERATIONS_PASSWORD_RECOVERY_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("sendOperationsPasswordRecoveryOtp", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SEND_OPERATIONS_WORKSPACE_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("sendOperationsWorkspaceOtp", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SEND_PUBLIC_INVITATION_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("sendPublicInvitationOtp", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor START_OPERATIONS_PASSWORD_RECOVERY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("startOperationsPasswordRecovery", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_WORKSPACE_ACCOUNT_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionWorkspaceAccountStatus", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_WORKSPACE_ROLE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionWorkspaceRoleStatus", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_WORKSPACE_ROLE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateWorkspaceRole", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor VERIFY_OPERATIONS_PASSWORD_RECOVERY_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("verifyOperationsPasswordRecoveryOtp", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor VERIFY_OPERATIONS_WORKSPACE_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("verifyOperationsWorkspaceOtp", "workspace-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor VERIFY_PUBLIC_INVITATION_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("verifyPublicInvitationOtp", "workspace-iam", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsWorkspaceGroupInvitationCandidates" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_GROUP_INVITATION_CANDIDATES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceGroupInvitations" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_GROUP_INVITATIONS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceGroupUser" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_GROUP_USER_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceGroupUserAccount" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_GROUP_USER_ACCOUNT_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceHeadCompanyInvitationCandidates" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANDIDATES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceHeadCompanyInvitations" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATIONS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceHeadCompanyUser" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceHeadCompanyUserAccount" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ACCOUNT_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceLoginEntry" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_LOGIN_ENTRY_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceProjectInvitationCandidates" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANDIDATES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceProjectInvitations" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_PROJECT_INVITATIONS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceProjectUser" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_PROJECT_USER_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceProjectUserAccount" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_PROJECT_USER_ACCOUNT_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceRegionInvitationCandidates" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_REGION_INVITATION_CANDIDATES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceRegionInvitations" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_REGION_INVITATIONS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceRegionUser" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_REGION_USER_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceRegionUserAccount" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_REGION_USER_ACCOUNT_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceSessionEntry" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_SESSION_ENTRY_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceStoreInvitationCandidates" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_STORE_INVITATION_CANDIDATES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceStoreInvitations" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_STORE_INVITATIONS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceStoreUser" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_STORE_USER_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsWorkspaceStoreUserAccount" -> { if (descriptor != GET_OPERATIONS_WORKSPACE_STORE_USER_ACCOUNT_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPublicInvitationCompletion" -> { if (descriptor != GET_PUBLIC_INVITATION_COMPLETION_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPublicInvitationView" -> { if (descriptor != GET_PUBLIC_INVITATION_VIEW_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceAccount" -> { if (descriptor != GET_WORKSPACE_ACCOUNT_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceAccounts" -> { if (descriptor != GET_WORKSPACE_ACCOUNTS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceInvitation" -> { if (descriptor != GET_WORKSPACE_INVITATION_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceInvitationCandidates" -> { if (descriptor != GET_WORKSPACE_INVITATION_CANDIDATES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceInvitations" -> { if (descriptor != GET_WORKSPACE_INVITATIONS_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceRole" -> { if (descriptor != GET_WORKSPACE_ROLE_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getWorkspaceRoles" -> { if (descriptor != GET_WORKSPACE_ROLES_DESCRIPTOR || !"workspace-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsWorkspaceGroupInvitationCandidates" -> adapters.getOperationsWorkspaceGroupInvitationCandidates(GET_OPERATIONS_WORKSPACE_GROUP_INVITATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceGroupInvitations" -> adapters.getOperationsWorkspaceGroupInvitations(GET_OPERATIONS_WORKSPACE_GROUP_INVITATIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceGroupUser" -> adapters.getOperationsWorkspaceGroupUser(GET_OPERATIONS_WORKSPACE_GROUP_USER_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceGroupUserAccount" -> adapters.getOperationsWorkspaceGroupUserAccount(GET_OPERATIONS_WORKSPACE_GROUP_USER_ACCOUNT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceHeadCompanyInvitationCandidates" -> adapters.getOperationsWorkspaceHeadCompanyInvitationCandidates(GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceHeadCompanyInvitations" -> adapters.getOperationsWorkspaceHeadCompanyInvitations(GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceHeadCompanyUser" -> adapters.getOperationsWorkspaceHeadCompanyUser(GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceHeadCompanyUserAccount" -> adapters.getOperationsWorkspaceHeadCompanyUserAccount(GET_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ACCOUNT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceLoginEntry" -> adapters.getOperationsWorkspaceLoginEntry(GET_OPERATIONS_WORKSPACE_LOGIN_ENTRY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceProjectInvitationCandidates" -> adapters.getOperationsWorkspaceProjectInvitationCandidates(GET_OPERATIONS_WORKSPACE_PROJECT_INVITATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceProjectInvitations" -> adapters.getOperationsWorkspaceProjectInvitations(GET_OPERATIONS_WORKSPACE_PROJECT_INVITATIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceProjectUser" -> adapters.getOperationsWorkspaceProjectUser(GET_OPERATIONS_WORKSPACE_PROJECT_USER_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceProjectUserAccount" -> adapters.getOperationsWorkspaceProjectUserAccount(GET_OPERATIONS_WORKSPACE_PROJECT_USER_ACCOUNT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceRegionInvitationCandidates" -> adapters.getOperationsWorkspaceRegionInvitationCandidates(GET_OPERATIONS_WORKSPACE_REGION_INVITATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceRegionInvitations" -> adapters.getOperationsWorkspaceRegionInvitations(GET_OPERATIONS_WORKSPACE_REGION_INVITATIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceRegionUser" -> adapters.getOperationsWorkspaceRegionUser(GET_OPERATIONS_WORKSPACE_REGION_USER_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceRegionUserAccount" -> adapters.getOperationsWorkspaceRegionUserAccount(GET_OPERATIONS_WORKSPACE_REGION_USER_ACCOUNT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceSessionEntry" -> adapters.getOperationsWorkspaceSessionEntry(GET_OPERATIONS_WORKSPACE_SESSION_ENTRY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceStoreInvitationCandidates" -> adapters.getOperationsWorkspaceStoreInvitationCandidates(GET_OPERATIONS_WORKSPACE_STORE_INVITATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceStoreInvitations" -> adapters.getOperationsWorkspaceStoreInvitations(GET_OPERATIONS_WORKSPACE_STORE_INVITATIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceStoreUser" -> adapters.getOperationsWorkspaceStoreUser(GET_OPERATIONS_WORKSPACE_STORE_USER_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsWorkspaceStoreUserAccount" -> adapters.getOperationsWorkspaceStoreUserAccount(GET_OPERATIONS_WORKSPACE_STORE_USER_ACCOUNT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPublicInvitationCompletion" -> adapters.getPublicInvitationCompletion(GET_PUBLIC_INVITATION_COMPLETION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPublicInvitationView" -> adapters.getPublicInvitationView(GET_PUBLIC_INVITATION_VIEW_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceAccount" -> adapters.getWorkspaceAccount(GET_WORKSPACE_ACCOUNT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceAccounts" -> adapters.getWorkspaceAccounts(GET_WORKSPACE_ACCOUNTS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceInvitation" -> adapters.getWorkspaceInvitation(GET_WORKSPACE_INVITATION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceInvitationCandidates" -> adapters.getWorkspaceInvitationCandidates(GET_WORKSPACE_INVITATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceInvitations" -> adapters.getWorkspaceInvitations(GET_WORKSPACE_INVITATIONS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceRole" -> adapters.getWorkspaceRole(GET_WORKSPACE_ROLE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getWorkspaceRoles" -> adapters.getWorkspaceRoles(GET_WORKSPACE_ROLES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }

  public OperationBindingTypes.Wire.PublicInvitationAcceptIntent acceptPublicInvitation(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.acceptPublicInvitation(ACCEPT_PUBLIC_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceGroupInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.cancelOperationsWorkspaceGroupInvitation(CANCEL_OPERATIONS_WORKSPACE_GROUP_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceHeadCompanyInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.cancelOperationsWorkspaceHeadCompanyInvitation(CANCEL_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceProjectInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.cancelOperationsWorkspaceProjectInvitation(CANCEL_OPERATIONS_WORKSPACE_PROJECT_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceRegionInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.cancelOperationsWorkspaceRegionInvitation(CANCEL_OPERATIONS_WORKSPACE_REGION_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation cancelOperationsWorkspaceStoreInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.cancelOperationsWorkspaceStoreInvitation(CANCEL_OPERATIONS_WORKSPACE_STORE_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformWorkspaceInvitation cancelWorkspaceInvitation(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceInvitationCancelRequest request) {
    return adapters.cancelWorkspaceInvitation(CANCEL_WORKSPACE_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceCurrentPasswordChangeResult changeCurrentWorkspacePassword(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceCurrentPasswordChangeRequest request) {
    return adapters.changeCurrentWorkspacePassword(CHANGE_CURRENT_WORKSPACE_PASSWORD_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OperationsPasswordRecoveryCompletion completeOperationsPasswordRecovery(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryCompleteRequest request) {
    return adapters.completeOperationsPasswordRecovery(COMPLETE_OPERATIONS_PASSWORD_RECOVERY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PublicInvitationCompletion completePublicInvitation(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.completePublicInvitation(COMPLETE_PUBLIC_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceGroupInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request) {
    return adapters.createOperationsWorkspaceGroupInvitation(CREATE_OPERATIONS_WORKSPACE_GROUP_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceHeadCompanyInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request) {
    return adapters.createOperationsWorkspaceHeadCompanyInvitation(CREATE_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceProjectInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request) {
    return adapters.createOperationsWorkspaceProjectInvitation(CREATE_OPERATIONS_WORKSPACE_PROJECT_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceRegionInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request) {
    return adapters.createOperationsWorkspaceRegionInvitation(CREATE_OPERATIONS_WORKSPACE_REGION_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation createOperationsWorkspaceStoreInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationCreateRequest request) {
    return adapters.createOperationsWorkspaceStoreInvitation(CREATE_OPERATIONS_WORKSPACE_STORE_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformWorkspaceInvitation createWorkspaceInvitation(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceInvitationCreateRequest request) {
    return adapters.createWorkspaceInvitation(CREATE_WORKSPACE_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceRole createWorkspaceRole(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceRoleCreateRequest request) {
    return adapters.createWorkspaceRole(CREATE_WORKSPACE_ROLE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.NoContent operationsWorkspaceLogout(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.operationsWorkspaceLogout(OPERATIONS_WORKSPACE_LOGOUT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceSessionEntry operationsWorkspacePasswordLogin(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspacePasswordLoginRequest request) {
    return adapters.operationsWorkspacePasswordLogin(OPERATIONS_WORKSPACE_PASSWORD_LOGIN_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceGroupInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.reissueOperationsWorkspaceGroupInvitation(REISSUE_OPERATIONS_WORKSPACE_GROUP_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceHeadCompanyInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.reissueOperationsWorkspaceHeadCompanyInvitation(REISSUE_OPERATIONS_WORKSPACE_HEAD_COMPANY_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceProjectInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.reissueOperationsWorkspaceProjectInvitation(REISSUE_OPERATIONS_WORKSPACE_PROJECT_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceRegionInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.reissueOperationsWorkspaceRegionInvitation(REISSUE_OPERATIONS_WORKSPACE_REGION_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceInvitation reissueOperationsWorkspaceStoreInvitation(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceOperationsInvitationActionRequest request) {
    return adapters.reissueOperationsWorkspaceStoreInvitation(REISSUE_OPERATIONS_WORKSPACE_STORE_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformWorkspaceInvitation reissueWorkspaceInvitation(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceInvitationReissueRequest request) {
    return adapters.reissueWorkspaceInvitation(REISSUE_WORKSPACE_INVITATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceCredentialResetResult requestWorkspaceCredentialReset(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceCredentialResetRequest request) {
    return adapters.requestWorkspaceCredentialReset(REQUEST_WORKSPACE_CREDENTIAL_RESET_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceGroupUserAssignment(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request) {
    return adapters.revokeOperationsWorkspaceGroupUserAssignment(REVOKE_OPERATIONS_WORKSPACE_GROUP_USER_ASSIGNMENT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceHeadCompanyUserAssignment(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request) {
    return adapters.revokeOperationsWorkspaceHeadCompanyUserAssignment(REVOKE_OPERATIONS_WORKSPACE_HEAD_COMPANY_USER_ASSIGNMENT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceProjectUserAssignment(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request) {
    return adapters.revokeOperationsWorkspaceProjectUserAssignment(REVOKE_OPERATIONS_WORKSPACE_PROJECT_USER_ASSIGNMENT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceRegionUserAssignment(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request) {
    return adapters.revokeOperationsWorkspaceRegionUserAssignment(REVOKE_OPERATIONS_WORKSPACE_REGION_USER_ASSIGNMENT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceUserRevokeResult revokeOperationsWorkspaceStoreUserAssignment(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.WorkspaceUserRevokeRequest request) {
    return adapters.revokeOperationsWorkspaceStoreUserAssignment(REVOKE_OPERATIONS_WORKSPACE_STORE_USER_ASSIGNMENT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceAssignmentRevokeResult revokePlatformWorkspaceAssignment(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceAssignmentRevokeRequest request) {
    return adapters.revokePlatformWorkspaceAssignment(REVOKE_PLATFORM_WORKSPACE_ASSIGNMENT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PublicInvitationCredentialResponse savePublicInvitationCredentials(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.PublicInvitationCredentialRequest request) {
    return adapters.savePublicInvitationCredentials(SAVE_PUBLIC_INVITATION_CREDENTIALS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceSessionEntry selectOperationsWorkspaceSessionContext(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceSelectContextRequest request) {
    return adapters.selectOperationsWorkspaceSessionContext(SELECT_OPERATIONS_WORKSPACE_SESSION_CONTEXT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceSessionEntry selectOperationsWorkspaceSessionDataNode(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceSelectDataNodeRequest request) {
    return adapters.selectOperationsWorkspaceSessionDataNode(SELECT_OPERATIONS_WORKSPACE_SESSION_DATA_NODE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OperationsPasswordRecoveryOtpSendResponse sendOperationsPasswordRecoveryOtp(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryOtpSendRequest request) {
    return adapters.sendOperationsPasswordRecoveryOtp(SEND_OPERATIONS_PASSWORD_RECOVERY_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceOtpSendResponse sendOperationsWorkspaceOtp(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceOtpSendRequest request) {
    return adapters.sendOperationsWorkspaceOtp(SEND_OPERATIONS_WORKSPACE_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PublicInvitationOtpSendResponse sendPublicInvitationOtp(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.PublicInvitationOtpSendRequest request) {
    return adapters.sendPublicInvitationOtp(SEND_PUBLIC_INVITATION_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OperationsPasswordRecoveryStartResponse startOperationsPasswordRecovery(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryStartRequest request) {
    return adapters.startOperationsPasswordRecovery(START_OPERATIONS_PASSWORD_RECOVERY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceAccount transitionWorkspaceAccountStatus(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceAccountStatusTransitionRequest request) {
    return adapters.transitionWorkspaceAccountStatus(TRANSITION_WORKSPACE_ACCOUNT_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceRole transitionWorkspaceRoleStatus(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceRoleStatusTransitionRequest request) {
    return adapters.transitionWorkspaceRoleStatus(TRANSITION_WORKSPACE_ROLE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceRole updateWorkspaceRole(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.WorkspaceRoleUpdateRequest request) {
    return adapters.updateWorkspaceRole(UPDATE_WORKSPACE_ROLE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OperationsPasswordRecoveryVerification verifyOperationsPasswordRecoveryOtp(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.OperationsPasswordRecoveryOtpVerifyRequest request) {
    return adapters.verifyOperationsPasswordRecoveryOtp(VERIFY_OPERATIONS_PASSWORD_RECOVERY_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.WorkspaceSessionEntry verifyOperationsWorkspaceOtp(OperationBindingTypes.WorkspaceProtocolContext context, OperationBindingTypes.Wire.WorkspaceOtpVerifyRequest request) {
    return adapters.verifyOperationsWorkspaceOtp(VERIFY_OPERATIONS_WORKSPACE_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PublicInvitationReadiness verifyPublicInvitationOtp(OperationBindingTypes.PublicProtocolCommandContext context, OperationBindingTypes.Wire.PublicInvitationOtpVerifyRequest request) {
    return adapters.verifyPublicInvitationOtp(VERIFY_PUBLIC_INVITATION_OTP_DESCRIPTOR, context, request);
  }
}
