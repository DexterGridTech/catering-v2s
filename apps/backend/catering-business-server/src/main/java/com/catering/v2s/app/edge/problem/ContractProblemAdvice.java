package com.catering.v2s.app.edge.problem;

import com.catering.v2s.contract.application.ContractCommandService;
import com.catering.v2s.contract.application.ContractCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.BusinessEntityCommandReceiptService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationHierarchyCommandReceiptService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.platform.workspace.application.WorkspaceCommandReceiptService;
import com.catering.v2s.platform.iam.application.PlatformCommandReceiptService;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.WorkspaceAssignmentScopeService;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamCommandReceiptService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordResetService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityDiagnosticRequestState;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Contract-level fallback for R5 owner adapters. Controller-local R3 compatibility handlers retain precedence. */
@Order
@RestControllerAdvice
public final class ContractProblemAdvice {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Problem> multipartTooLarge(MaxUploadSizeExceededException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "上传文件超过商品图片大小限制", request);
    }

    @ExceptionHandler({CatalogOwnerApi.Problem.class, InventoryOwnerApi.Problem.class, ProductionTagOwnerApi.Problem.class})
    ResponseEntity<Problem> catalogInventory(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof CatalogOwnerApi.Problem catalog ? catalog.code()
            : exception instanceof InventoryOwnerApi.Problem inventory ? inventory.code()
            : ((ProductionTagOwnerApi.Problem) exception).code();
        int status = exception instanceof CatalogOwnerApi.Problem catalog ? catalog.status()
            : exception instanceof InventoryOwnerApi.Problem inventory ? inventory.status()
            : ((ProductionTagOwnerApi.Problem) exception).status();
        return problem(HttpStatus.valueOf(status), code, "商品、生产标签或库存操作不满足 owner 约束", request);
    }

    @ExceptionHandler(PlatformAssetService.AssetOwnerScopeForbiddenException.class)
    ResponseEntity<Problem> catalogAssetOwnerScopeForbidden(PlatformAssetService.AssetOwnerScopeForbiddenException exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "SCOPE_FORBIDDEN", "商品图片资产操作不满足 owner 约束", request);
    }

    @ExceptionHandler({
        ContractCommandService.ContractNotFoundException.class,
        ExtensionDefinitionService.DefinitionNotFoundException.class,
        BusinessEntityService.OrganizationNotFoundException.class,
        OrganizationHierarchyService.OrganizationNotFoundException.class,
        OrganizationTaskPathService.TaskPathNotFoundException.class,
        WorkspaceAccountService.AccountNotFoundException.class,
        WorkspaceInvitationService.InvitationNotFoundException.class,
        WorkspaceRoleService.RoleNotFoundException.class,
        WorkspaceAssignmentScopeService.AssignmentScopeNotFoundException.class,
        WorkspaceAdministrationService.WorkspaceNotFoundException.class,
        PlatformAssetService.AssetNotFoundException.class,
        PlatformAuthenticationService.PlatformAdminNotFoundException.class
    })
    ResponseEntity<Problem> notFound(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof WorkspaceInvitationService.InvitationNotFoundException ? "WORKSPACE_IAM_INVITATION_NOT_FOUND"
            : exception instanceof PlatformAssetService.AssetNotFoundException ? "PLATFORM_ASSET_NOT_FOUND"
            : "PLATFORM_COMMON_RESOURCE_NOT_FOUND";
        return problem(HttpStatus.NOT_FOUND, code, "请求的 owner 资源不存在", request);
    }

    /** Must stay more specific than the organization conflict fallback: no store reference detail crosses the edge. */
    @ExceptionHandler(BusinessEntityService.HeadCompanyBrandAuthorizationInUseException.class)
    ResponseEntity<Problem> headCompanyBrandAuthorizationInUse(BusinessEntityService.HeadCompanyBrandAuthorizationInUseException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE", "该经营品牌仍被门店使用，暂不能移除", request);
    }

    @ExceptionHandler({
        ContractCommandService.ContractConflictException.class,
        ContractCommandReceiptService.ContractIdempotencyConflictException.class,
        ExtensionCommandReceiptService.ExtensionIdempotencyConflictException.class,
        ExtensionDefinitionService.DefinitionVersionConflictException.class,
        BusinessEntityService.OrganizationDuplicateException.class,
        BusinessEntityService.OrganizationCodeConflictException.class,
        BusinessEntityService.OrganizationNameConflictException.class,
        BusinessEntityService.OrganizationConflictException.class,
        OrganizationHierarchyService.OrganizationConflictException.class,
        WorkspaceAccountService.AccountConflictException.class,
        WorkspaceAuthenticationService.SessionConflictException.class,
        WorkspaceRoleService.RoleConflictException.class,
        WorkspaceRoleService.RoleCapabilityCatalogDriftException.class,
        WorkspaceAdministrationService.WorkspaceConflictException.class,
        WorkspaceAdministrationService.WorkspaceVersionConflictException.class,
        PlatformAuthenticationService.PlatformAdminVersionConflictException.class,
        WorkspaceCommandReceiptService.WorkspaceIdempotencyConflictException.class,
        WorkspaceIamCommandReceiptService.WorkspaceIamIdempotencyConflictException.class,
        PlatformCommandReceiptService.PlatformIdempotencyConflictException.class,
        PlatformAssetService.AssetIdempotencyConflictException.class,
        OrganizationHierarchyCommandReceiptService.OrganizationIdempotencyConflictException.class,
        BusinessEntityCommandReceiptService.BusinessEntityIdempotencyConflictException.class
    })
    ResponseEntity<Problem> conflict(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof ContractCommandReceiptService.ContractIdempotencyConflictException || exception instanceof ExtensionCommandReceiptService.ExtensionIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : exception instanceof BusinessEntityService.OrganizationNameConflictException ? "ORGANIZATION_BUSINESS_ENTITY_NAME_CONFLICT"
            : exception instanceof BusinessEntityService.OrganizationDuplicateException || exception instanceof BusinessEntityService.OrganizationCodeConflictException ? "ORGANIZATION_BUSINESS_ENTITY_CODE_CONFLICT"
            : exception instanceof ContractCommandService.ContractConflictException ? "CONTRACT_VERSION_CONFLICT"
            : exception instanceof ExtensionDefinitionService.DefinitionVersionConflictException ? "EXTENSION_DEFINITION_VERSION_CONFLICT"
            : exception instanceof WorkspaceAuthenticationService.SessionConflictException ? "PLATFORM_COMMON_CONTEXT_STALE"
            : exception instanceof WorkspaceRoleService.RoleCapabilityCatalogDriftException ? "WORKSPACE_IAM_ROLE_CAPABILITY_CATALOG_DRIFT"
            : exception instanceof WorkspaceCommandReceiptService.WorkspaceIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : exception instanceof WorkspaceIamCommandReceiptService.WorkspaceIamIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : exception instanceof PlatformCommandReceiptService.PlatformIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : exception instanceof PlatformAssetService.AssetIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : exception instanceof OrganizationHierarchyCommandReceiptService.OrganizationIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : exception instanceof BusinessEntityCommandReceiptService.BusinessEntityIdempotencyConflictException ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
            : "PLATFORM_COMMON_VERSION_CONFLICT";
        return problem(HttpStatus.CONFLICT, code, "owner readback 已变化，请重新读取后再操作", request);
    }

    @ExceptionHandler(PlatformAuthenticationService.LoginNameConflictException.class)
    ResponseEntity<Problem> platformLoginNameConflict(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "PLATFORM_IAM_LOGIN_NAME_CONFLICT", "登录名已被占用", request);
    }

    @ExceptionHandler(WorkspaceInvitationService.InvitationStateException.class)
    ResponseEntity<Problem> invitationTerminal(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "WORKSPACE_IAM_INVITATION_TERMINAL", "邀请流程状态不可用或已结束", request);
    }

    @ExceptionHandler(WorkspacePasswordResetService.ResetStateException.class)
    ResponseEntity<Problem> workspaceCredentialResetUnavailable(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "WORKSPACE_IAM_CREDENTIAL_RESET_UNAVAILABLE", "账号状态已变化，请重新读取后再重置登录凭据", request);
    }

    @ExceptionHandler({
        InvalidEdgeRequestException.class,
        ContractCommandService.ContractValidationException.class,
        ExtensionDefinitionService.DefinitionInvalidException.class,
        BusinessEntityService.OrganizationValidationException.class,
        OrganizationHierarchyService.OrganizationValidationException.class,
        WorkspaceInvitationService.InvitationValidationException.class,
        WorkspaceUserService.PageValidationException.class,
        WorkspaceRoleService.RoleValidationException.class,
        WorkspaceAdministrationService.WorkspaceInputInvalidException.class,
        PlatformAssetService.AssetInputInvalidException.class,
        PlatformAssetService.AssetClaimRejectedException.class,
        PlatformAssetService.AssetStorageUnavailableException.class,
        PlatformAuthenticationService.InvalidAdministratorStatusException.class,
        PlatformAuthenticationService.InvalidAdministratorInputException.class,
        PlatformAuthenticationService.AdministratorDeactivationForbiddenException.class
    })
    ResponseEntity<Problem> invalid(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof PlatformAssetService.AssetStorageUnavailableException ? "PLATFORM_COMMON_RESULT_UNKNOWN"
            : exception instanceof ExtensionDefinitionService.DefinitionInvalidException ? "EXTENSION_DEFINITION_INVALID"
            : exception instanceof WorkspaceRoleService.RoleCapabilityUnknownException ? "WORKSPACE_IAM_ROLE_CAPABILITY_UNKNOWN"
            : exception instanceof WorkspaceRoleService.PageAccessCatalogMismatchException ? "WORKSPACE_IAM_PAGE_ACCESS_CATALOG_MISMATCH"
            : exception instanceof WorkspaceUserService.PageValidationException ? "PLATFORM_COMMON_VALIDATION_FAILED"
            : exception instanceof WorkspaceRoleService.RoleValidationException ? "WORKSPACE_IAM_ROLE_CAPABILITY_INCOMPATIBLE"
            : "PLATFORM_COMMON_VALIDATION_FAILED";
        return problem(exception instanceof PlatformAssetService.AssetStorageUnavailableException ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.UNPROCESSABLE_ENTITY, code, exception instanceof PlatformAssetService.AssetStorageUnavailableException ? "静态资源存储暂时不可用" : "请求不满足 owner 约束", request);
    }

    @ExceptionHandler(OrganizationCommandService.OrganizationCommandException.class)
    ResponseEntity<Problem> organizationCommand(OrganizationCommandService.OrganizationCommandException exception, HttpServletRequest request) {
        String code = switch (exception.problem()) {
            case COMMERCIAL_GROUP_NOT_INITIALIZED -> "ORGANIZATION_COMMERCIAL_GROUP_NOT_INITIALIZED";
            case COMMERCIAL_GROUP_REQUIRED -> "ORGANIZATION_COMMERCIAL_GROUP_REQUIRED";
            case COMMERCIAL_GROUP_ALREADY_INITIALIZED -> "COMMERCIAL_GROUP_ALREADY_INITIALIZED";
            case IDEMPOTENCY_CONFLICT -> "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT";
            case VALIDATION_FAILED -> "PLATFORM_COMMON_VALIDATION_FAILED";
        };
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, code, "组织根前提不满足", request);
    }

    @ExceptionHandler({
        PlatformAuthenticationService.InvalidCredentialsException.class,
        WorkspaceAuthenticationService.InvalidCredentialsException.class
    })
    ResponseEntity<Problem> invalidCredentials(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, exception instanceof PlatformAuthenticationService.InvalidCredentialsException ? "PLATFORM_IAM_INVALID_CREDENTIALS" : "WORKSPACE_IAM_INVALID_CREDENTIALS", "登录名或密码不正确", request);
    }

    @ExceptionHandler({PlatformAuthenticationService.SessionExpiredException.class, WorkspaceAuthenticationService.SessionInvalidException.class})
    ResponseEntity<Problem> unauthenticated(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, exception instanceof PlatformAuthenticationService.SessionExpiredException ? "PLATFORM_IAM_SESSION_EXPIRED" : "PLATFORM_COMMON_AUTHENTICATION_REQUIRED", "会话不可用或已过期", request);
    }

    @ExceptionHandler(WorkspaceAuthenticationService.PasswordChangeRequiredException.class)
    ResponseEntity<Problem> passwordChangeRequired(WorkspaceAuthenticationService.PasswordChangeRequiredException exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "WORKSPACE_IAM_PASSWORD_CHANGE_REQUIRED", "请先修改登录密码", request);
    }

    @ExceptionHandler({PlatformAuthenticationService.AccountDisabledException.class, WorkspaceAuthenticationService.AccountDisabledException.class, WorkspaceAuthenticationService.WorkspaceDisabledException.class, WorkspaceAdministrationService.WorkspaceDisabledException.class, WorkspaceAdministrationService.WorkspaceStatusInvalidException.class, WorkspaceAccountService.WorkspaceDisabledException.class, WorkspaceRoleService.WorkspaceDisabledException.class})
    ResponseEntity<Problem> disabled(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof PlatformAuthenticationService.AccountDisabledException ? "PLATFORM_IAM_ACCOUNT_DISABLED"
            : exception instanceof WorkspaceAuthenticationService.AccountDisabledException ? "WORKSPACE_IAM_ACCOUNT_DISABLED"
            : exception instanceof WorkspaceAuthenticationService.WorkspaceDisabledException ? "WORKSPACE_IAM_WORKSPACE_DISABLED"
            : exception instanceof WorkspaceAdministrationService.WorkspaceDisabledException || exception instanceof WorkspaceAccountService.WorkspaceDisabledException || exception instanceof WorkspaceRoleService.WorkspaceDisabledException ? "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED"
            : "PLATFORM_WORKSPACE_STATUS_TRANSITION_INVALID";
        return problem(HttpStatus.FORBIDDEN, code, "当前主体不可执行该操作", request);
    }

    @ExceptionHandler({
        WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class,
        WorkspaceUserService.TaskScopeDeniedException.class,
        ContractCommandService.ContractAuthorizationException.class,
        BusinessEntityService.OrganizationAuthorizationException.class,
        OrganizationHierarchyService.OrganizationAuthorizationException.class
    })
    ResponseEntity<Problem> accessDenied(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "PLATFORM_COMMON_ACCESS_DENIED", "当前主体无权执行该操作", request);
    }

    @ExceptionHandler({PlatformAuthenticationService.CredentialLockedException.class, WorkspaceAuthenticationService.CredentialLockedException.class})
    ResponseEntity<Problem> credentialLocked(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.LOCKED, exception instanceof PlatformAuthenticationService.CredentialLockedException ? "PLATFORM_IAM_CREDENTIAL_LOCKED" : "WORKSPACE_IAM_CREDENTIAL_LOCKED", "凭据已被临时锁定", request);
    }

    @ExceptionHandler({PlatformAuthenticationService.LoginRateLimitedException.class, PlatformAuthenticationService.OtpRateLimitedException.class, WorkspaceAuthenticationService.LoginRateLimitedException.class, WorkspaceAuthenticationService.OtpRateLimitedException.class})
    ResponseEntity<Problem> rateLimited(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof PlatformAuthenticationService.LoginRateLimitedException || exception instanceof PlatformAuthenticationService.OtpRateLimitedException ? "PLATFORM_IAM_RATE_LIMITED" : "WORKSPACE_IAM_RATE_LIMITED";
        return problem(HttpStatus.TOO_MANY_REQUESTS, code, "尝试次数过多，请稍后再试", request);
    }

    @ExceptionHandler({PlatformAuthenticationService.OtpInvalidException.class, PlatformAuthenticationService.RecoveryFlowInvalidException.class})
    ResponseEntity<Problem> platformRecoveryInvalid(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, "PLATFORM_IAM_INVALID_CREDENTIALS", "验证码或恢复流程不可用", request);
    }

    @ExceptionHandler({WorkspaceAuthenticationService.OtpInvalidException.class, WorkspacePasswordRecoveryService.OtpInvalidException.class})
    ResponseEntity<Problem> resetOtpInvalid(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, "WORKSPACE_IAM_OTP_INVALID", "验证码不可用或已失效", request);
    }

    @ExceptionHandler(WorkspacePasswordRecoveryService.RecoveryStateException.class)
    ResponseEntity<Problem> operationsRecoveryState(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "WORKSPACE_IAM_GRANT_INVALID", "找回流程状态不可用或已失效", request);
    }

    @ExceptionHandler({
        ContractCommandReceiptService.ContractReceiptCorruptException.class,
        BusinessEntityCommandReceiptService.BusinessEntityReceiptCorruptException.class,
        OrganizationHierarchyCommandReceiptService.OrganizationReceiptCorruptException.class,
        PlatformCommandReceiptService.PlatformReceiptCorruptException.class,
        WorkspaceCommandReceiptService.WorkspaceReceiptCorruptException.class,
        WorkspaceIamCommandReceiptService.WorkspaceIamReceiptCorruptException.class,
        ExtensionCommandReceiptService.ExtensionReceiptCorruptException.class
    })
    ResponseEntity<Problem> ownerResultUnknown(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "PLATFORM_COMMON_RESULT_UNKNOWN", "owner 命令结果暂时无法确认，请使用同一幂等键重试或查询", request);
    }

    public static ResponseEntity<Problem> problem(HttpStatus status, String code, String detail, HttpServletRequest request) {
        PublicSecurityDiagnosticRequestState.freezeFailure(request, status.value(), code);
        RequestCompletionDiagnosticState.freezeFailure(request, code);
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(request);
        String correlationId = completion == null
            ? PublicSecurityDiagnosticRequestState.correlationId(request)
            : completion.correlationId();
        return ResponseEntity.status(status).contentType(MediaType.valueOf("application/problem+json"))
            .body(new Problem("about:blank", code, status.value(), detail, request.getRequestURI(), code, correlationId));
    }

    public static ResponseEntity<Problem> problem(HttpStatus status, String code, String detail, EdgeRequestContext request) {
        String correlationId = request.correlationId();
        if (correlationId == null || correlationId.isBlank()) correlationId = UUID.randomUUID().toString();
        return ResponseEntity.status(status).contentType(MediaType.valueOf("application/problem+json"))
            .body(new Problem("about:blank", code, status.value(), detail, "", code, correlationId));
    }

    public record Problem(String type, String title, int status, String detail, String instance, String errorCode, String correlationId) { }
}
