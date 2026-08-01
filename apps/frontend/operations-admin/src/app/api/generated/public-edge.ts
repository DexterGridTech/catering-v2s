// Generated from accepted R5 edge catalog; do not edit.

export const PUBLIC_OPERATIONS = [
  {
    "operationId": "acceptPublicInvitation",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
    "owner": "workspace-iam"
  },
  {
    "operationId": "completeOperationsPasswordRecovery",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete",
    "owner": "workspace-iam"
  },
  {
    "operationId": "completePublicInvitation",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete",
    "owner": "workspace-iam"
  },
  {
    "operationId": "completeWorkspacePasswordReset",
    "method": "POST",
    "path": "/api/public/password-reset/{resetGenerationKey}/complete",
    "owner": "workspace-iam"
  },
  {
    "operationId": "getPublicAssetContent",
    "method": "GET",
    "path": "/api/public/assets/{assetRef}/content",
    "owner": "platform-asset"
  },
  {
    "operationId": "getPublicInvitationCompletion",
    "method": "GET",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion",
    "owner": "workspace-iam"
  },
  {
    "operationId": "getPublicInvitationView",
    "method": "GET",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
    "owner": "workspace-iam"
  },
  {
    "operationId": "savePublicInvitationCredentials",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials",
    "owner": "workspace-iam"
  },
  {
    "operationId": "sendOperationsPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send",
    "owner": "workspace-iam"
  },
  {
    "operationId": "sendPublicInvitationOtp",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send",
    "owner": "workspace-iam"
  },
  {
    "operationId": "sendWorkspacePasswordResetOtp",
    "method": "POST",
    "path": "/api/public/password-reset/{resetGenerationKey}/otp/send",
    "owner": "workspace-iam"
  },
  {
    "operationId": "startOperationsPasswordRecovery",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start",
    "owner": "workspace-iam"
  },
  {
    "operationId": "verifyOperationsPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify",
    "owner": "workspace-iam"
  },
  {
    "operationId": "verifyPublicInvitationOtp",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify",
    "owner": "workspace-iam"
  },
  {
    "operationId": "verifyWorkspacePasswordResetOtp",
    "method": "POST",
    "path": "/api/public/password-reset/{resetGenerationKey}/otp/verify",
    "owner": "workspace-iam"
  }
] as const;

export const PUBLIC_OPERATION_IDS = {
  "acceptPublicInvitation": "acceptPublicInvitation",
  "completeOperationsPasswordRecovery": "completeOperationsPasswordRecovery",
  "completePublicInvitation": "completePublicInvitation",
  "completeWorkspacePasswordReset": "completeWorkspacePasswordReset",
  "getPublicAssetContent": "getPublicAssetContent",
  "getPublicInvitationCompletion": "getPublicInvitationCompletion",
  "getPublicInvitationView": "getPublicInvitationView",
  "savePublicInvitationCredentials": "savePublicInvitationCredentials",
  "sendOperationsPasswordRecoveryOtp": "sendOperationsPasswordRecoveryOtp",
  "sendPublicInvitationOtp": "sendPublicInvitationOtp",
  "sendWorkspacePasswordResetOtp": "sendWorkspacePasswordResetOtp",
  "startOperationsPasswordRecovery": "startOperationsPasswordRecovery",
  "verifyOperationsPasswordRecoveryOtp": "verifyOperationsPasswordRecoveryOtp",
  "verifyPublicInvitationOtp": "verifyPublicInvitationOtp",
  "verifyWorkspacePasswordResetOtp": "verifyWorkspacePasswordResetOtp"
} as const;

export const EDGE_PROBLEM_CODES = [
  "PLATFORM_ASSET_NOT_ACTIVE",
  "PLATFORM_ASSET_NOT_FOUND",
  "PLATFORM_ASSET_USAGE_DENIED",
  "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT",
  "PLATFORM_COMMON_RESULT_UNKNOWN",
  "WORKSPACE_IAM_ASSIGNMENT_CONFLICT",
  "WORKSPACE_IAM_CREDENTIAL_NOT_READY",
  "WORKSPACE_IAM_GRANT_INVALID",
  "WORKSPACE_IAM_INVITATION_EXPIRED",
  "WORKSPACE_IAM_INVITATION_NOT_FOUND",
  "WORKSPACE_IAM_INVITATION_TERMINAL",
  "WORKSPACE_IAM_OTP_INVALID",
  "WORKSPACE_IAM_PASSWORD_POLICY_FAILED",
  "WORKSPACE_IAM_PASSWORD_RESET_GENERATION_INVALID",
  "WORKSPACE_IAM_PASSWORD_RESET_MOBILE_MISMATCH",
  "WORKSPACE_IAM_PASSWORD_RESET_REPLAYED",
  "WORKSPACE_IAM_RATE_LIMITED",
  "WORKSPACE_IAM_RESET_EXPIRED",
  "WORKSPACE_IAM_RESET_NOT_FOUND",
  "WORKSPACE_IAM_RESULT_UNKNOWN"
] as const;
export type EdgeProblemCode = (typeof EDGE_PROBLEM_CODES)[number];
export type PublicOperationId = (typeof PUBLIC_OPERATIONS)[number]["operationId"];



export type EpochMillis = number;

export type NoBody = Record<string, never>;

export type OperationsPasswordRecoveryCompleteRequest = {
  newPassword: string;
};

export type OperationsPasswordRecoveryCompletion = {
  status: "COMPLETED";
  sessionsRevoked: boolean;
};

export type OperationsPasswordRecoveryOtpSendRequest = Record<string, never>;

export type OperationsPasswordRecoveryOtpSendResponse = {
  expiresAt: EpochMillis;
  debugVerificationCode?: (string) | null;
};

export type OperationsPasswordRecoveryOtpVerifyRequest = {
  code: string;
};

export type OperationsPasswordRecoveryStartRequest = {
  loginName: string;
  mobile: string;
};

export type OperationsPasswordRecoveryStartResponse = {
  workspaceName: string;
  operationsTitle: string;
  logoUrl?: (string) | null;
};

export type OperationsPasswordRecoveryVerification = {
  status: "VERIFIED";
};

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: (string) | null;
  errorCode: EdgeProblemCode;
  correlationId: string;
  brandAuthorizationBlockers?: {
  visibleStores: Array<{
  id: string;
  code: string;
  name: string;
}>;
};
};

export type PublicAssetReference = {
  publicUrl: string;
  contentType: "image/png" | "image/jpeg" | "image/webp" | "video/mp4";
  sha256: string;
};

export type PublicInvitationAcceptIntent = {
  nextStep: "VERIFY_MOBILE";
};

export type PublicInvitationCompletion = {
  invitationId: string;
  status: "COMPLETED";
  message: string;
  loginPath: string;
};

export type PublicInvitationCredentialRequest = {
  verificationGrant: string;
  userName: string;
  loginName: string;
  password: string;
};

export type PublicInvitationCredentialResponse = {
  verificationGrant: string;
  accountExists: boolean;
  userNameReady: boolean;
  loginNameReady: boolean;
  passwordReady: boolean;
  nextStep: "COMPLETE_CREDENTIALS" | "FINALIZE";
};

export type PublicInvitationOtpSendRequest = {
  mobile: string;
};

export type PublicInvitationOtpSendResponse = {
  verificationId: string;
  expiresAt: EpochMillis;
  debugVerificationCode?: (string) | null;
};

export type PublicInvitationOtpVerifyRequest = {
  mobile: string;
  code: string;
};

export type PublicInvitationReadiness = {
  verificationGrant: string;
  accountExists: boolean;
  userNameReady: boolean;
  loginNameReady: boolean;
  passwordReady: boolean;
  nextStep: "COMPLETE_CREDENTIALS" | "FINALIZE";
};

export type PublicInvitationView = {
  invitationId: string;
  groupWorkspaceKey: string;
  workspaceName: string;
  operationsTitle: string;
  logoUrl?: (string) | null;
  targetOrganizationType: ServiceNodeType;
  targetOrganizationPath: string;
  roleNames: Array<string>;
  maskedMobile: string;
  status: WorkspaceInvitationStatus;
  expiresAt: EpochMillis;
};

export type ServiceNodeType = "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";

export type WorkspaceInvitationStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "COMPLETED";

export type WorkspacePasswordResetCompleteRequest = {
  passwordResetGrant: string;
  password: string;
};

export type WorkspacePasswordResetCompletion = {
  status: "COMPLETED";
  loginName: string;
  message: string;
  loginPath: string;
  sessionsRevoked: boolean;
};

export type WorkspacePasswordResetOtpSendRequest = {
  mobile: string;
};

export type WorkspacePasswordResetOtpSendResponse = {
  expiresAt: EpochMillis;
};

export type WorkspacePasswordResetOtpVerifyRequest = {
  mobile: string;
  code: string;
};

export type WorkspacePasswordResetReadiness = {
  passwordResetGrant: string;
  loginName: string;
  nextStep: "SET_PASSWORD";
};

export type FaceOperationContracts = {
  "acceptPublicInvitation": {
    request: NoBody;
    response: PublicInvitationAcceptIntent;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "completeOperationsPasswordRecovery": {
    request: OperationsPasswordRecoveryCompleteRequest;
    response: OperationsPasswordRecoveryCompletion;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "completePublicInvitation": {
    request: NoBody;
    response: PublicInvitationCompletion;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "completeWorkspacePasswordReset": {
    request: WorkspacePasswordResetCompleteRequest;
    response: WorkspacePasswordResetCompletion;
    requestRequired: true;
    path: {
    resetGenerationKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "getPublicAssetContent": {
    request: NoBody;
    response: PublicAssetReference;
    requestRequired: false;
    path: {
    assetRef: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPublicInvitationCompletion": {
    request: NoBody;
    response: PublicInvitationCompletion;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPublicInvitationView": {
    request: NoBody;
    response: PublicInvitationView;
    requestRequired: false;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "savePublicInvitationCredentials": {
    request: PublicInvitationCredentialRequest;
    response: PublicInvitationCredentialResponse;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendOperationsPasswordRecoveryOtp": {
    request: OperationsPasswordRecoveryOtpSendRequest;
    response: OperationsPasswordRecoveryOtpSendResponse;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendPublicInvitationOtp": {
    request: PublicInvitationOtpSendRequest;
    response: PublicInvitationOtpSendResponse;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendWorkspacePasswordResetOtp": {
    request: WorkspacePasswordResetOtpSendRequest;
    response: WorkspacePasswordResetOtpSendResponse;
    requestRequired: true;
    path: {
    resetGenerationKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "startOperationsPasswordRecovery": {
    request: OperationsPasswordRecoveryStartRequest;
    response: OperationsPasswordRecoveryStartResponse;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyOperationsPasswordRecoveryOtp": {
    request: OperationsPasswordRecoveryOtpVerifyRequest;
    response: OperationsPasswordRecoveryVerification;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyPublicInvitationOtp": {
    request: PublicInvitationOtpVerifyRequest;
    response: PublicInvitationReadiness;
    requestRequired: true;
    path: {
    groupWorkspaceKey: string;
    invitationToken: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyWorkspacePasswordResetOtp": {
    request: WorkspacePasswordResetOtpVerifyRequest;
    response: WorkspacePasswordResetReadiness;
    requestRequired: true;
    path: {
    resetGenerationKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
};

type RequestPart<I extends PublicOperationId> = FaceOperationContracts[I]["requestRequired"] extends true
  ? {body: FaceOperationContracts[I]["request"]}
  : {body?: never};
type QueryPart<I extends PublicOperationId> = FaceOperationContracts[I]["queryRequired"] extends true
  ? {query: FaceOperationContracts[I]["query"]}
  : {query?: FaceOperationContracts[I]["query"]};
type HeaderPart<I extends PublicOperationId> = FaceOperationContracts[I]["headersRequired"] extends true
  ? {headers: FaceOperationContracts[I]["headers"]}
  : {headers?: never};
export type FaceOperationOptions<I extends PublicOperationId> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;
export type FaceOperationRequest<I extends PublicOperationId> = FaceOperationOptions<I> & {
  operationId: I;
  method: (typeof PUBLIC_OPERATIONS)[number]["method"];
  path: (typeof PUBLIC_OPERATIONS)[number]["path"];
  pathParameters: FaceOperationContracts[I]["path"];
};
export type FaceExecutor = <I extends PublicOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;

export function createPublicClient(execute: FaceExecutor) {
  return {
    acceptPublicInvitation: (pathParameters: FaceOperationContracts["acceptPublicInvitation"]["path"], options: FaceOperationOptions<"acceptPublicInvitation">) => execute({
      operationId: "acceptPublicInvitation",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
      pathParameters,
      ...options,
    }),
    completeOperationsPasswordRecovery: (pathParameters: FaceOperationContracts["completeOperationsPasswordRecovery"]["path"], options: FaceOperationOptions<"completeOperationsPasswordRecovery">) => execute({
      operationId: "completeOperationsPasswordRecovery",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete",
      pathParameters,
      ...options,
    }),
    completePublicInvitation: (pathParameters: FaceOperationContracts["completePublicInvitation"]["path"], options: FaceOperationOptions<"completePublicInvitation">) => execute({
      operationId: "completePublicInvitation",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete",
      pathParameters,
      ...options,
    }),
    completeWorkspacePasswordReset: (pathParameters: FaceOperationContracts["completeWorkspacePasswordReset"]["path"], options: FaceOperationOptions<"completeWorkspacePasswordReset">) => execute({
      operationId: "completeWorkspacePasswordReset",
      method: "POST",
      path: "/api/public/password-reset/{resetGenerationKey}/complete",
      pathParameters,
      ...options,
    }),
    getPublicAssetContent: (pathParameters: FaceOperationContracts["getPublicAssetContent"]["path"], options: FaceOperationOptions<"getPublicAssetContent">) => execute({
      operationId: "getPublicAssetContent",
      method: "GET",
      path: "/api/public/assets/{assetRef}/content",
      pathParameters,
      ...options,
    }),
    getPublicInvitationCompletion: (pathParameters: FaceOperationContracts["getPublicInvitationCompletion"]["path"], options: FaceOperationOptions<"getPublicInvitationCompletion">) => execute({
      operationId: "getPublicInvitationCompletion",
      method: "GET",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion",
      pathParameters,
      ...options,
    }),
    getPublicInvitationView: (pathParameters: FaceOperationContracts["getPublicInvitationView"]["path"], options: FaceOperationOptions<"getPublicInvitationView">) => execute({
      operationId: "getPublicInvitationView",
      method: "GET",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
      pathParameters,
      ...options,
    }),
    savePublicInvitationCredentials: (pathParameters: FaceOperationContracts["savePublicInvitationCredentials"]["path"], options: FaceOperationOptions<"savePublicInvitationCredentials">) => execute({
      operationId: "savePublicInvitationCredentials",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials",
      pathParameters,
      ...options,
    }),
    sendOperationsPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["sendOperationsPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"sendOperationsPasswordRecoveryOtp">) => execute({
      operationId: "sendOperationsPasswordRecoveryOtp",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send",
      pathParameters,
      ...options,
    }),
    sendPublicInvitationOtp: (pathParameters: FaceOperationContracts["sendPublicInvitationOtp"]["path"], options: FaceOperationOptions<"sendPublicInvitationOtp">) => execute({
      operationId: "sendPublicInvitationOtp",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send",
      pathParameters,
      ...options,
    }),
    sendWorkspacePasswordResetOtp: (pathParameters: FaceOperationContracts["sendWorkspacePasswordResetOtp"]["path"], options: FaceOperationOptions<"sendWorkspacePasswordResetOtp">) => execute({
      operationId: "sendWorkspacePasswordResetOtp",
      method: "POST",
      path: "/api/public/password-reset/{resetGenerationKey}/otp/send",
      pathParameters,
      ...options,
    }),
    startOperationsPasswordRecovery: (pathParameters: FaceOperationContracts["startOperationsPasswordRecovery"]["path"], options: FaceOperationOptions<"startOperationsPasswordRecovery">) => execute({
      operationId: "startOperationsPasswordRecovery",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start",
      pathParameters,
      ...options,
    }),
    verifyOperationsPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["verifyOperationsPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"verifyOperationsPasswordRecoveryOtp">) => execute({
      operationId: "verifyOperationsPasswordRecoveryOtp",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify",
      pathParameters,
      ...options,
    }),
    verifyPublicInvitationOtp: (pathParameters: FaceOperationContracts["verifyPublicInvitationOtp"]["path"], options: FaceOperationOptions<"verifyPublicInvitationOtp">) => execute({
      operationId: "verifyPublicInvitationOtp",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify",
      pathParameters,
      ...options,
    }),
    verifyWorkspacePasswordResetOtp: (pathParameters: FaceOperationContracts["verifyWorkspacePasswordResetOtp"]["path"], options: FaceOperationOptions<"verifyWorkspacePasswordResetOtp">) => execute({
      operationId: "verifyWorkspacePasswordResetOtp",
      method: "POST",
      path: "/api/public/password-reset/{resetGenerationKey}/otp/verify",
      pathParameters,
      ...options,
    })
  } as const;
}
