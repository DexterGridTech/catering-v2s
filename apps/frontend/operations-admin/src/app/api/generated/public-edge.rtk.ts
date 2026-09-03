// Generated from accepted R5 edge catalog; do not edit.

import type {BaseQueryFn, EndpointBuilder, FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta} from "@reduxjs/toolkit/query";
import type {FaceOperationContracts, FaceOperationOptions, FaceOperationRequest} from "./public-edge";

type EdgeBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>;
export type PublicOperationId = keyof FaceOperationContracts;
export type PublicRtkWireRequest = <I extends PublicOperationId>(request: FaceOperationRequest<I>) => FetchArgs & {requiresSession: FaceOperationContracts[I]["requiresSession"]};
export type PublicRtkTagType = "wire" | "catalogInventory" | "salesMenu";

/**
 * Operation-shaped request constructors for RTK hooks. Consumers supply only
 * typed path parameters and operation options; catalog id, method and path are
 * frozen here rather than handwritten in pages.
 */
export const publicRtkRequest = {
    acceptPublicInvitation: (pathParameters: FaceOperationContracts["acceptPublicInvitation"]["path"], options: FaceOperationOptions<"acceptPublicInvitation">): FaceOperationRequest<"acceptPublicInvitation"> => ({
      operationId: "acceptPublicInvitation",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    completeOperationsPasswordRecovery: (pathParameters: FaceOperationContracts["completeOperationsPasswordRecovery"]["path"], options: FaceOperationOptions<"completeOperationsPasswordRecovery">): FaceOperationRequest<"completeOperationsPasswordRecovery"> => ({
      operationId: "completeOperationsPasswordRecovery",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    completePublicInvitation: (pathParameters: FaceOperationContracts["completePublicInvitation"]["path"], options: FaceOperationOptions<"completePublicInvitation">): FaceOperationRequest<"completePublicInvitation"> => ({
      operationId: "completePublicInvitation",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getPublicAssetContent: (pathParameters: FaceOperationContracts["getPublicAssetContent"]["path"], options: FaceOperationOptions<"getPublicAssetContent">): FaceOperationRequest<"getPublicAssetContent"> => ({
      operationId: "getPublicAssetContent",
      method: "GET",
      path: "/api/public/assets/{assetRef}/content",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getPublicInvitationCompletion: (pathParameters: FaceOperationContracts["getPublicInvitationCompletion"]["path"], options: FaceOperationOptions<"getPublicInvitationCompletion">): FaceOperationRequest<"getPublicInvitationCompletion"> => ({
      operationId: "getPublicInvitationCompletion",
      method: "GET",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    getPublicInvitationView: (pathParameters: FaceOperationContracts["getPublicInvitationView"]["path"], options: FaceOperationOptions<"getPublicInvitationView">): FaceOperationRequest<"getPublicInvitationView"> => ({
      operationId: "getPublicInvitationView",
      method: "GET",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    savePublicInvitationCredentials: (pathParameters: FaceOperationContracts["savePublicInvitationCredentials"]["path"], options: FaceOperationOptions<"savePublicInvitationCredentials">): FaceOperationRequest<"savePublicInvitationCredentials"> => ({
      operationId: "savePublicInvitationCredentials",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    sendOperationsPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["sendOperationsPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"sendOperationsPasswordRecoveryOtp">): FaceOperationRequest<"sendOperationsPasswordRecoveryOtp"> => ({
      operationId: "sendOperationsPasswordRecoveryOtp",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    sendPublicInvitationOtp: (pathParameters: FaceOperationContracts["sendPublicInvitationOtp"]["path"], options: FaceOperationOptions<"sendPublicInvitationOtp">): FaceOperationRequest<"sendPublicInvitationOtp"> => ({
      operationId: "sendPublicInvitationOtp",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    startOperationsPasswordRecovery: (pathParameters: FaceOperationContracts["startOperationsPasswordRecovery"]["path"], options: FaceOperationOptions<"startOperationsPasswordRecovery">): FaceOperationRequest<"startOperationsPasswordRecovery"> => ({
      operationId: "startOperationsPasswordRecovery",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    verifyOperationsPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["verifyOperationsPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"verifyOperationsPasswordRecoveryOtp">): FaceOperationRequest<"verifyOperationsPasswordRecoveryOtp"> => ({
      operationId: "verifyOperationsPasswordRecoveryOtp",
      method: "POST",
      path: "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    verifyPublicInvitationOtp: (pathParameters: FaceOperationContracts["verifyPublicInvitationOtp"]["path"], options: FaceOperationOptions<"verifyPublicInvitationOtp">): FaceOperationRequest<"verifyPublicInvitationOtp"> => ({
      operationId: "verifyPublicInvitationOtp",
      method: "POST",
      path: "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    })
} as const;

/**
 * Operation-shaped RTK definitions generated from the face catalog.  The app
 * supplies only HTTP encoding; it cannot invent paths, methods or endpoint ids.
 */
export function createPublicRtkEndpoints<TagTypes extends PublicRtkTagType = "wire">(
  build: EndpointBuilder<EdgeBaseQuery, TagTypes, string>,
  toWireRequest: PublicRtkWireRequest,
) {
  return {
    acceptPublicInvitation: build.mutation<FaceOperationContracts["acceptPublicInvitation"]["response"], FaceOperationRequest<"acceptPublicInvitation">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    completeOperationsPasswordRecovery: build.mutation<FaceOperationContracts["completeOperationsPasswordRecovery"]["response"], FaceOperationRequest<"completeOperationsPasswordRecovery">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    completePublicInvitation: build.mutation<FaceOperationContracts["completePublicInvitation"]["response"], FaceOperationRequest<"completePublicInvitation">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    getPublicAssetContent: build.query<FaceOperationContracts["getPublicAssetContent"]["response"], FaceOperationRequest<"getPublicAssetContent">>({
      query: (request) => toWireRequest(request),
      providesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    getPublicInvitationCompletion: build.query<FaceOperationContracts["getPublicInvitationCompletion"]["response"], FaceOperationRequest<"getPublicInvitationCompletion">>({
      query: (request) => toWireRequest(request),
      providesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    getPublicInvitationView: build.query<FaceOperationContracts["getPublicInvitationView"]["response"], FaceOperationRequest<"getPublicInvitationView">>({
      query: (request) => toWireRequest(request),
      providesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    savePublicInvitationCredentials: build.mutation<FaceOperationContracts["savePublicInvitationCredentials"]["response"], FaceOperationRequest<"savePublicInvitationCredentials">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    sendOperationsPasswordRecoveryOtp: build.mutation<FaceOperationContracts["sendOperationsPasswordRecoveryOtp"]["response"], FaceOperationRequest<"sendOperationsPasswordRecoveryOtp">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    sendPublicInvitationOtp: build.mutation<FaceOperationContracts["sendPublicInvitationOtp"]["response"], FaceOperationRequest<"sendPublicInvitationOtp">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    startOperationsPasswordRecovery: build.mutation<FaceOperationContracts["startOperationsPasswordRecovery"]["response"], FaceOperationRequest<"startOperationsPasswordRecovery">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    verifyOperationsPasswordRecoveryOtp: build.mutation<FaceOperationContracts["verifyOperationsPasswordRecoveryOtp"]["response"], FaceOperationRequest<"verifyOperationsPasswordRecoveryOtp">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    }),
    verifyPublicInvitationOtp: build.mutation<FaceOperationContracts["verifyPublicInvitationOtp"]["response"], FaceOperationRequest<"verifyPublicInvitationOtp">>({
      query: (request) => toWireRequest(request),
      invalidatesTags: (_result, _error, request) => [{type: "wire" as Extract<TagTypes, "wire">, id: request.operationId}, {type: "wire" as Extract<TagTypes, "wire">, id: "LIST"}],
    })
  };
}
