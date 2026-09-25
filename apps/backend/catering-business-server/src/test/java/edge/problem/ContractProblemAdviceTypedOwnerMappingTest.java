package com.catering.v2s.app.edge.problem;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.diagnostic.EdgeRouteFaceRegistry;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.contract.application.ContractCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.storeterminal.application.StoreTerminalAuditHistoryService;
import com.catering.v2s.storeterminal.application.StoreTerminalOwnerService;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAssignmentScopeService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

class ContractProblemAdviceTypedOwnerMappingTest {
    private final ContractProblemAdvice advice = new ContractProblemAdvice();
    private final MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/test/problem");

    @Test
    void newlyReachableOwnerExceptionsHaveClosedTypedProblems() {
        assertProblem(
                advice.platformLoginNameConflict(
                        new PlatformAuthenticationService.LoginNameConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_IAM_LOGIN_NAME_CONFLICT");
        assertProblem(
                advice.invitationTerminal(new WorkspaceInvitationService.InvitationStateException(), request),
                HttpStatus.CONFLICT,
                "WORKSPACE_IAM_INVITATION_TERMINAL");
        assertProblem(
                advice.accountNotBindable(new WorkspaceInvitationService.AccountNotBindableException(), request),
                HttpStatus.UNPROCESSABLE_ENTITY,
                "ACCOUNT_NOT_BINDABLE");
        assertProblem(
                advice.credentialLocked(new PlatformAuthenticationService.CredentialLockedException(), request),
                HttpStatus.LOCKED,
                "PLATFORM_IAM_CREDENTIAL_LOCKED");
        assertProblem(
                advice.rateLimited(new PlatformAuthenticationService.LoginRateLimitedException(), request),
                HttpStatus.TOO_MANY_REQUESTS,
                "PLATFORM_IAM_RATE_LIMITED");
        assertProblem(
                advice.rateLimited(new PlatformAuthenticationService.OtpRateLimitedException(), request),
                HttpStatus.TOO_MANY_REQUESTS,
                "PLATFORM_IAM_RATE_LIMITED");
        assertProblem(
                advice.rateLimited(new WorkspaceAuthenticationService.LoginRateLimitedException(), request),
                HttpStatus.TOO_MANY_REQUESTS,
                "WORKSPACE_IAM_RATE_LIMITED");
        assertProblem(
                advice.rateLimited(new WorkspaceAuthenticationService.OtpRateLimitedException(), request),
                HttpStatus.TOO_MANY_REQUESTS,
                "WORKSPACE_IAM_RATE_LIMITED");
        assertProblem(
                advice.resetOtpInvalid(new WorkspaceAuthenticationService.OtpInvalidException(), request),
                HttpStatus.UNPROCESSABLE_ENTITY,
                "WORKSPACE_IAM_OTP_INVALID");
        assertProblem(
                advice.ownerResultUnknown(
                        new ContractCommandReceiptService.ContractReceiptCorruptException(
                                new IllegalStateException("corrupt")),
                        request),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN");
        assertProblem(
                advice.ownerResultUnknown(
                        new ExtensionCommandReceiptService.ExtensionReceiptCorruptException(
                                new IllegalStateException("corrupt")),
                        request),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN");
        assertProblem(
                advice.ownerResultUnknown(new DuplicateKeyException("duplicate"), request),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN");
        assertProblem(
                advice.conflict(new PlatformAuthenticationService.PlatformAdminVersionConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_COMMON_VERSION_CONFLICT");
        assertProblem(
                advice.conflict(new WorkspaceAdministrationService.WorkspaceConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_COMMON_VERSION_CONFLICT");
        assertProblem(
                advice.conflict(new PlatformAssetService.AssetIdempotencyConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT");
        assertProblem(
                advice.conflict(new ExtensionCommandReceiptService.ExtensionIdempotencyConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT");
        assertProblem(
                advice.headCompanyBrandAuthorizationInUse(
                        new BusinessEntityService.HeadCompanyBrandAuthorizationInUseException(), request),
                HttpStatus.CONFLICT,
                "ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE");
        assertProblem(
                advice.notFound(new WorkspaceAssignmentScopeService.AssignmentScopeNotFoundException(), request),
                HttpStatus.NOT_FOUND,
                "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertProblem(
                advice.notFound(new OrganizationTaskPathService.TaskPathNotFoundException(), request),
                HttpStatus.NOT_FOUND,
                "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertProblem(
                advice.notFound(new StoreTerminalAuditHistoryService.TerminalNotFoundException(), request),
                HttpStatus.NOT_FOUND,
                "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertProblem(
                advice.accessDenied(new StoreTerminalAuditHistoryService.TerminalAuthorizationException(), request),
                HttpStatus.FORBIDDEN,
                "PLATFORM_COMMON_ACCESS_DENIED");
        assertProblem(
                advice.notFound(new StoreTerminalOwnerService.TerminalNotFoundException(), request),
                HttpStatus.NOT_FOUND,
                "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertProblem(
                advice.accessDenied(new StoreTerminalOwnerService.TerminalAuthorizationException(), request),
                HttpStatus.FORBIDDEN,
                "PLATFORM_COMMON_ACCESS_DENIED");
        assertProblem(
                advice.storeTerminalUnavailable(
                        new StoreTerminalOwnerService.TerminalStoreUnavailableException(), request),
                HttpStatus.FORBIDDEN,
                "PLATFORM_COMMON_ACCESS_DENIED");
        assertProblem(
                advice.storeTerminalConflict(new StoreTerminalOwnerService.TerminalVoidedImmutableException(), request),
                HttpStatus.CONFLICT,
                "STORE_TERMINAL_VOIDED_IMMUTABLE");
        assertProblem(
                advice.storeTerminalConflict(
                        new StoreTerminalOwnerService.TerminalStatusTransitionInvalidException(), request),
                HttpStatus.CONFLICT,
                "STORE_TERMINAL_STATUS_TRANSITION_INVALID");
        assertProblem(
                advice.storeTerminalConflict(new StoreTerminalOwnerService.TerminalVersionConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_COMMON_VERSION_CONFLICT");
        assertProblem(
                advice.storeTerminalConflict(new StoreTerminalOwnerService.IdempotencyConflictException(), request),
                HttpStatus.CONFLICT,
                "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT");
        assertProblem(
                advice.storeTerminalInvalid(new StoreTerminalOwnerService.TerminalReferenceInvalidException(), request),
                HttpStatus.UNPROCESSABLE_ENTITY,
                "STORE_TERMINAL_REFERENCE_INVALID");
        assertProblem(
                advice.storeTerminalInvalid(new StoreTerminalOwnerService.InvalidTerminalRequestException(), request),
                HttpStatus.UNPROCESSABLE_ENTITY,
                "STORE_TERMINAL_RULE_INVALID");
        assertProblem(
                advice.storeTerminalInvalid(new StoreTerminalOwnerService.InvalidTerminalInputException(), request),
                HttpStatus.BAD_REQUEST,
                "PLATFORM_COMMON_VALIDATION_FAILED");
        assertProblem(
                advice.storeTerminalResultUnknown(
                        new StoreTerminalOwnerService.ReceiptCorruptException(new IllegalStateException("corrupt")),
                        request),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN");
        assertProblem(
                advice.catalogAssetOwnerScopeForbidden(
                        new PlatformAssetService.AssetOwnerScopeForbiddenException(), request),
                HttpStatus.FORBIDDEN,
                "SCOPE_FORBIDDEN");
        assertProblem(
                advice.assetInvariantViolation(
                        new PlatformAssetService.AssetInvariantViolationException("owner.metadata-conflict"), request),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION");
        assertProblem(
                advice.catalogScopeForbidden(
                        new CommandExecutionContextResolver.CatalogScopeForbiddenException(
                                new IllegalStateException("scope")),
                        request),
                HttpStatus.FORBIDDEN,
                "SCOPE_FORBIDDEN");
        assertProblem(
                advice.catalogManagementDisabled(
                        new StoreOperatingRuleGate.CatalogManagementDisabledException(
                                StoreOperatingRuleGate.CatalogManagementDisabledException.Reason.DISABLED),
                        request),
                HttpStatus.FORBIDDEN,
                "ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED");
        assertProblem(
                advice.invalid(
                        new BusinessEntityService.OrganizationOperatingRuleValidationException(
                                new IllegalArgumentException("invalid operating rule")),
                        request),
                HttpStatus.UNPROCESSABLE_ENTITY,
                "ORGANIZATION_STORE_OPERATING_RULES_INVALID");
        assertProblem(
                advice.multipartTooLarge(new MaxUploadSizeExceededException(5L * 1024 * 1024), request),
                HttpStatus.UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR");
        assertProblem(
                advice.malformedRequest(new HttpMessageNotReadableException("invalid UUID", null), request),
                HttpStatus.BAD_REQUEST,
                "PLATFORM_COMMON_VALIDATION_FAILED");
    }

    @Test
    void storageFailureKeepsSafeDependencyFactsAndMapsToGenericServerProblem() {
        var adapterFailure = new com.catering.v2s.platform.asset.application.AssetObjectStorageUnavailableException(
                "object.put",
                new IllegalStateException("provider response text is not logged"),
                503,
                "ServiceUnavailable");
        var ownerFailure = new PlatformAssetService.AssetStorageUnavailableException(
                "object.put", adapterFailure, adapterFailure.httpStatus(), adapterFailure.serviceErrorCode());
        assertEquals("object.put", ownerFailure.storageOperation());
        assertEquals(503, ownerFailure.storageHttpStatus());
        assertEquals("ServiceUnavailable", ownerFailure.storageErrorCode());
        assertProblem(
                advice.invalid(ownerFailure, request),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN");
    }

    @Test
    void categoryMoveBoundaryKeepsAnActionableSafeContractDetail() {
        var response = advice.catalogInventory(
                new CatalogOwnerApi.Problem("MOVE_BOUNDARY", 422, "internal owner detail"), request);

        assertProblem(response, HttpStatus.UNPROCESSABLE_ENTITY, "MOVE_BOUNDARY");
        assertEquals("分类已位于当前层级边界", response.getBody().detail());
        assertFalse(response.getBody().detail().contains("internal owner detail"));
    }

    @Test
    void referenceBlockersKeepTheirCuratedRelationExplanationWhileOtherOwnerDetailsStayGeneric() {
        var referenceBlocked = advice.catalogInventory(
                new CatalogOwnerApi.Problem(
                        "REFERENCE_BLOCKS" + "_VOID",
                        422,
                        "product SKU is still referenced by inventory facts: 库存对象 x1"),
                request);
        var genericValidation = advice.catalogInventory(
                new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "internal validation detail"), request);

        assertProblem(referenceBlocked, HttpStatus.UNPROCESSABLE_ENTITY, "REFERENCE_BLOCKS_VOID");
        assertEquals(
                "product SKU is still referenced by inventory facts: 库存对象 x1",
                referenceBlocked.getBody().detail());
        assertFalse(referenceBlocked.getBody().detail().contains("stock_target"));
        assertFalse(referenceBlocked.getBody().detail().contains("product_sku_ref"));
        assertProblem(genericValidation, HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR");
        assertEquals(
                "请求中的业务信息不完整或不符合规则",
                /* format-wrap */
                genericValidation.getBody().detail());
        assertFalse(genericValidation.getBody().detail().contains("internal validation detail"));
    }

    @Test
    void storageFailureDiagnosticRendersSafeFactsForPlainConsoleLogs() {
        var adapterFailure = new com.catering.v2s.platform.asset.application.AssetObjectStorageUnavailableException(
                "object.stat",
                new IllegalStateException("provider response text must not be logged"),
                404,
                "NoSuchBucket");
        var ownerFailure = new PlatformAssetService.AssetStorageUnavailableException(
                "object.stat", adapterFailure, adapterFailure.httpStatus(), adapterFailure.serviceErrorCode());

        String rendered =
                ContractProblemAdvice.renderAssetStorageFailure(ownerFailure, null, adapterFailure.getCause());

        assertTrue(rendered.contains("event=PLATFORM_ASSET_STORAGE_FAILURE"));
        assertTrue(rendered.contains("storageOperation=object.stat"));
        assertTrue(rendered.contains("httpStatus=404"));
        assertTrue(rendered.contains("serviceErrorCode=NoSuchBucket"));
        assertTrue(rendered.contains("rootCauseType=IllegalStateException"));
        assertFalse(rendered.contains("provider response text must not be logged"));
    }

    @Test
    void catalogAssetStageUsesItsOwnApprovedProcessingFailureInsteadOfPlatformProblemSemantics() {
        var catalogRequest = new MockHttpServletRequest("POST", "/api/operations/catalog-inventory/assets/stage");
        RequestCompletionDiagnosticState.getOrCreate(
                catalogRequest,
                new MockHttpServletResponse(),
                new EdgeRouteFaceRegistry.Definition(
                        "stageOperationsCatalogAsset",
                        "POST",
                        "/api/operations/catalog-inventory/assets/stage",
                        "asset",
                        "operations-admin"));

        assertProblem(
                advice.assetInvariantViolation(
                        new PlatformAssetService.AssetInvariantViolationException("owner.metadata-conflict"),
                        catalogRequest),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "ASSET_PROCESSING_FAILED");
        assertProblem(
                advice.invalid(
                        new PlatformAssetService.AssetStorageUnavailableException(
                                "object.put", new IllegalStateException("unavailable")),
                        catalogRequest),
                HttpStatus.INTERNAL_SERVER_ERROR,
                "ASSET_PROCESSING_FAILED");
    }

    @Test
    void noCatchAllExceptionTypeCanTurnUnknownOwnerFailuresIntoTypedSuccess() {
        Set<Class<?>> declared = Arrays.stream(ContractProblemAdvice.class.getDeclaredMethods())
                .flatMap(method -> Arrays.stream(method.getAnnotationsByType(ExceptionHandler.class)))
                .flatMap(annotation -> Arrays.stream(annotation.value()))
                .collect(Collectors.toSet());

        assertFalse(declared.contains(RuntimeException.class));
        assertFalse(declared.contains(Exception.class));
        assertFalse(declared.contains(Throwable.class));
        assertTrue(declared.contains(WorkspaceAuthenticationService.OtpInvalidException.class));
        assertTrue(declared.contains(WorkspaceInvitationService.InvitationStateException.class));
        assertTrue(declared.contains(BusinessEntityService.HeadCompanyBrandAuthorizationInUseException.class));
        assertTrue(declared.contains(PlatformAssetService.AssetOwnerScopeForbiddenException.class));
        assertTrue(declared.contains(PlatformAssetService.AssetInvariantViolationException.class));
        assertTrue(declared.contains(CommandExecutionContextResolver.CatalogScopeForbiddenException.class));
        assertTrue(declared.contains(ContractCommandReceiptService.ContractReceiptCorruptException.class));
        assertTrue(declared.contains(StoreTerminalAuditHistoryService.TerminalNotFoundException.class));
        assertTrue(declared.contains(StoreTerminalAuditHistoryService.TerminalAuthorizationException.class));
        assertTrue(declared.contains(ExtensionCommandReceiptService.ExtensionReceiptCorruptException.class));
        assertTrue(declared.contains(DuplicateKeyException.class));
        assertTrue(declared.contains(MaxUploadSizeExceededException.class));
        assertTrue(declared.contains(HttpMessageNotReadableException.class));
    }

    private static void assertProblem(
            ResponseEntity<ContractProblemAdvice.Problem> response, HttpStatus status, String code) {
        assertEquals(status.value(), response.getStatusCode().value());
        assertEquals(code, response.getBody().errorCode());
        assertEquals(status.value(), response.getBody().status());
    }
}
