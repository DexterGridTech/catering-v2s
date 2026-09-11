// Generated from accepted R5 edge catalog; do not edit.

export const PUBLIC_OPERATIONS = [
  {
    "operationId": "acceptPublicInvitation",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "completeOperationsPasswordRecovery",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "completePublicInvitation",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "getPublicAssetContent",
    "method": "GET",
    "path": "/api/public/assets/{assetRef}/content",
    "owner": "platform-asset",
    "requiresSession": false
  },
  {
    "operationId": "getPublicInvitationCompletion",
    "method": "GET",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "getPublicInvitationView",
    "method": "GET",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "savePublicInvitationCredentials",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "sendOperationsPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "sendPublicInvitationOtp",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "startOperationsPasswordRecovery",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "verifyOperationsPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify",
    "owner": "workspace-iam",
    "requiresSession": false
  },
  {
    "operationId": "verifyPublicInvitationOtp",
    "method": "POST",
    "path": "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify",
    "owner": "workspace-iam",
    "requiresSession": false
  }
] as const;

export const PUBLIC_DATABASE_OPERATION_BUDGETS = {
  "acceptPublicInvitation": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "completeOperationsPasswordRecovery": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "completePublicInvitation": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "getPublicAssetContent": {
    "kind": "FIXED",
    "max": 4,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 4,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "getPublicInvitationCompletion": {
    "kind": "FIXED",
    "max": 5,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 5,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "getPublicInvitationView": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "savePublicInvitationCredentials": {
    "kind": "FIXED",
    "max": 9,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 9,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "sendOperationsPasswordRecoveryOtp": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "sendPublicInvitationOtp": {
    "kind": "FIXED",
    "max": 9,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 9,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "startOperationsPasswordRecovery": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "verifyOperationsPasswordRecoveryOtp": {
    "kind": "FIXED",
    "max": 22,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 22,
        "reason": "current managed acceptance program maximum"
      }
    ]
  },
  "verifyPublicInvitationOtp": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "current managed acceptance program maximum"
      }
    ]
  }
} as const;

export const PUBLIC_OPERATION_IDS = {
  "acceptPublicInvitation": "acceptPublicInvitation",
  "completeOperationsPasswordRecovery": "completeOperationsPasswordRecovery",
  "completePublicInvitation": "completePublicInvitation",
  "getPublicAssetContent": "getPublicAssetContent",
  "getPublicInvitationCompletion": "getPublicInvitationCompletion",
  "getPublicInvitationView": "getPublicInvitationView",
  "savePublicInvitationCredentials": "savePublicInvitationCredentials",
  "sendOperationsPasswordRecoveryOtp": "sendOperationsPasswordRecoveryOtp",
  "sendPublicInvitationOtp": "sendPublicInvitationOtp",
  "startOperationsPasswordRecovery": "startOperationsPasswordRecovery",
  "verifyOperationsPasswordRecoveryOtp": "verifyOperationsPasswordRecoveryOtp",
  "verifyPublicInvitationOtp": "verifyPublicInvitationOtp"
} as const;

export const EDGE_PROBLEM_CODES = [
  "ACCOUNT_NOT_BINDABLE",
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
  "WORKSPACE_IAM_RATE_LIMITED",
  "WORKSPACE_IAM_RESULT_UNKNOWN"
] as const;
export type EdgeProblemCode = (typeof EDGE_PROBLEM_CODES)[number];
export type PublicOperationId = (typeof PUBLIC_OPERATIONS)[number]["operationId"];



export type Uuid = string & { readonly __uuid: "Uuid" };

export type AccountPresenceStatus = "ABSENT" | "ENABLED" | "DISABLED" | "VOIDED";

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

export type OrganizationPathNode = {
  ref: string & { readonly __uuid: "Uuid" };
  code: string;
  name: string;
  nodeType: ServiceNodeType;
};

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: (string) | null;
  errorCode: EdgeProblemCode;
  correlationId: string;
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
  accountExists: AccountPresenceStatus;
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
  accountExists: AccountPresenceStatus;
  userNameReady: boolean;
  loginNameReady: boolean;
  passwordReady: boolean;
  nextStep: "COMPLETE_CREDENTIALS" | "FINALIZE";
};

export type PublicInvitationView = {
  invitationId: string;
  groupWorkspaceKey: string;
  operationsTitle: string;
  targetOrganizationType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  roleNames: Array<string>;
  maskedMobile: string;
  status: WorkspaceInvitationStatus;
  expiresAt: EpochMillis;
  workspaceName: string;
  nextStep: "ACCEPT" | "VERIFY_MOBILE" | "FINALIZE" | "TERMINAL";
  logoUrl?: (string) | null;
  targetOrganizationPathNodes: Array<OrganizationPathNode>;
};

export type ServiceNodeType = "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";

export type WorkspaceInvitationStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "COMPLETED";

export type FaceOperationContracts = {
  "acceptPublicInvitation": {
    request: NoBody;
    response: PublicInvitationAcceptIntent;
    requestRequired: false;
    requiresSession: false;
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
    requiresSession: false;
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
    requiresSession: false;
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
  "getPublicAssetContent": {
    request: NoBody;
    response: PublicAssetReference;
    requestRequired: false;
    requiresSession: false;
    path: {
    assetRef: string & { readonly __uuid: "Uuid" };
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
    requiresSession: false;
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
    requiresSession: false;
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
    requiresSession: false;
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
    requiresSession: false;
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
    requiresSession: false;
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
  "startOperationsPasswordRecovery": {
    request: OperationsPasswordRecoveryStartRequest;
    response: OperationsPasswordRecoveryStartResponse;
    requestRequired: true;
    requiresSession: false;
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
    requiresSession: false;
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
    requiresSession: false;
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
  requiresSession: FaceOperationContracts[I]["requiresSession"];
};
export type FaceExecutor = <I extends PublicOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;

export function createPublicClient(execute: FaceExecutor) {
  return {
    acceptPublicInvitation: (pathParameters: FaceOperationContracts["acceptPublicInvitation"]["path"], options: FaceOperationOptions<"acceptPublicInvitation">) => execute({
      operationId: "acceptPublicInvitation",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    completeOperationsPasswordRecovery: (pathParameters: FaceOperationContracts["completeOperationsPasswordRecovery"]["path"], options: FaceOperationOptions<"completeOperationsPasswordRecovery">) => execute({
      operationId: "completeOperationsPasswordRecovery",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    completePublicInvitation: (pathParameters: FaceOperationContracts["completePublicInvitation"]["path"], options: FaceOperationOptions<"completePublicInvitation">) => execute({
      operationId: "completePublicInvitation",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getPublicAssetContent: (pathParameters: FaceOperationContracts["getPublicAssetContent"]["path"], options: FaceOperationOptions<"getPublicAssetContent">) => execute({
      operationId: "getPublicAssetContent",
      method: "GET",
      path: "/api/public/assets/{assetRef}/content",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getPublicInvitationCompletion: (pathParameters: FaceOperationContracts["getPublicInvitationCompletion"]["path"], options: FaceOperationOptions<"getPublicInvitationCompletion">) => execute({
      operationId: "getPublicInvitationCompletion",
      method: "GET",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getPublicInvitationView: (pathParameters: FaceOperationContracts["getPublicInvitationView"]["path"], options: FaceOperationOptions<"getPublicInvitationView">) => execute({
      operationId: "getPublicInvitationView",
      method: "GET",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    savePublicInvitationCredentials: (pathParameters: FaceOperationContracts["savePublicInvitationCredentials"]["path"], options: FaceOperationOptions<"savePublicInvitationCredentials">) => execute({
      operationId: "savePublicInvitationCredentials",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    sendOperationsPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["sendOperationsPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"sendOperationsPasswordRecoveryOtp">) => execute({
      operationId: "sendOperationsPasswordRecoveryOtp",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    sendPublicInvitationOtp: (pathParameters: FaceOperationContracts["sendPublicInvitationOtp"]["path"], options: FaceOperationOptions<"sendPublicInvitationOtp">) => execute({
      operationId: "sendPublicInvitationOtp",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    startOperationsPasswordRecovery: (pathParameters: FaceOperationContracts["startOperationsPasswordRecovery"]["path"], options: FaceOperationOptions<"startOperationsPasswordRecovery">) => execute({
      operationId: "startOperationsPasswordRecovery",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    verifyOperationsPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["verifyOperationsPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"verifyOperationsPasswordRecoveryOtp">) => execute({
      operationId: "verifyOperationsPasswordRecoveryOtp",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    verifyPublicInvitationOtp: (pathParameters: FaceOperationContracts["verifyPublicInvitationOtp"]["path"], options: FaceOperationOptions<"verifyPublicInvitationOtp">) => execute({
      operationId: "verifyPublicInvitationOtp",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    })
  } as const;
}
