package com.catering.v2s.app.edge.problem;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.contract.application.ContractCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAssignmentScopeService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

class ContractProblemAdviceTypedOwnerMappingTest {
    private final ContractProblemAdvice advice = new ContractProblemAdvice();
    private final MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/test/problem");

    @Test
    void newlyReachableOwnerExceptionsHaveClosedTypedProblems() {
        assertProblem(advice.platformLoginNameConflict(new PlatformAuthenticationService.LoginNameConflictException(), request), HttpStatus.CONFLICT, "PLATFORM_IAM_LOGIN_NAME_CONFLICT");
        assertProblem(advice.invitationTerminal(new WorkspaceInvitationService.InvitationStateException(), request), HttpStatus.CONFLICT, "WORKSPACE_IAM_INVITATION_TERMINAL");
        assertProblem(advice.credentialLocked(new PlatformAuthenticationService.CredentialLockedException(), request), HttpStatus.LOCKED, "PLATFORM_IAM_CREDENTIAL_LOCKED");
        assertProblem(advice.rateLimited(new PlatformAuthenticationService.LoginRateLimitedException(), request), HttpStatus.TOO_MANY_REQUESTS, "PLATFORM_IAM_RATE_LIMITED");
        assertProblem(advice.rateLimited(new PlatformAuthenticationService.OtpRateLimitedException(), request), HttpStatus.TOO_MANY_REQUESTS, "PLATFORM_IAM_RATE_LIMITED");
        assertProblem(advice.rateLimited(new WorkspaceAuthenticationService.LoginRateLimitedException(), request), HttpStatus.TOO_MANY_REQUESTS, "WORKSPACE_IAM_RATE_LIMITED");
        assertProblem(advice.rateLimited(new WorkspaceAuthenticationService.OtpRateLimitedException(), request), HttpStatus.TOO_MANY_REQUESTS, "WORKSPACE_IAM_RATE_LIMITED");
        assertProblem(advice.resetOtpInvalid(new WorkspaceAuthenticationService.OtpInvalidException(), request), HttpStatus.UNPROCESSABLE_ENTITY, "WORKSPACE_IAM_OTP_INVALID");
        assertProblem(advice.ownerResultUnknown(new ContractCommandReceiptService.ContractReceiptCorruptException(new IllegalStateException("corrupt")), request), HttpStatus.INTERNAL_SERVER_ERROR, "PLATFORM_COMMON_RESULT_UNKNOWN");
        assertProblem(advice.ownerResultUnknown(new ExtensionCommandReceiptService.ExtensionReceiptCorruptException(new IllegalStateException("corrupt")), request), HttpStatus.INTERNAL_SERVER_ERROR, "PLATFORM_COMMON_RESULT_UNKNOWN");
        assertProblem(advice.conflict(new PlatformAuthenticationService.PlatformAdminVersionConflictException(), request), HttpStatus.CONFLICT, "PLATFORM_COMMON_VERSION_CONFLICT");
        assertProblem(advice.conflict(new WorkspaceAdministrationService.WorkspaceConflictException(), request), HttpStatus.CONFLICT, "PLATFORM_COMMON_VERSION_CONFLICT");
        assertProblem(advice.conflict(new PlatformAssetService.AssetIdempotencyConflictException(), request), HttpStatus.CONFLICT, "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT");
        assertProblem(advice.conflict(new ExtensionCommandReceiptService.ExtensionIdempotencyConflictException(), request), HttpStatus.CONFLICT, "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT");
        assertProblem(advice.headCompanyBrandAuthorizationInUse(new BusinessEntityService.HeadCompanyBrandAuthorizationInUseException(), request), HttpStatus.CONFLICT, "ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE");
        assertProblem(advice.notFound(new WorkspaceAssignmentScopeService.AssignmentScopeNotFoundException(), request), HttpStatus.NOT_FOUND, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertProblem(advice.notFound(new OrganizationTaskPathService.TaskPathNotFoundException(), request), HttpStatus.NOT_FOUND, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertProblem(advice.catalogAssetOwnerScopeForbidden(new PlatformAssetService.AssetOwnerScopeForbiddenException(), request), HttpStatus.FORBIDDEN, "SCOPE_FORBIDDEN");
        assertProblem(advice.multipartTooLarge(new MaxUploadSizeExceededException(5L * 1024 * 1024), request), HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR");
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
        assertTrue(declared.contains(ContractCommandReceiptService.ContractReceiptCorruptException.class));
        assertTrue(declared.contains(ExtensionCommandReceiptService.ExtensionReceiptCorruptException.class));
        assertTrue(declared.contains(MaxUploadSizeExceededException.class));
    }

    private static void assertProblem(ResponseEntity<ContractProblemAdvice.Problem> response, HttpStatus status, String code) {
        assertEquals(status, response.getStatusCode());
        assertEquals(code, response.getBody().errorCode());
        assertEquals(status.value(), response.getBody().status());
    }
}
