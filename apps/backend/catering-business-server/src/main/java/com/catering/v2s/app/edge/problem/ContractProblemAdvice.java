package com.catering.v2s.app.edge.problem;

import com.catering.v2s.app.edge.diagnostic.HttpRequestMetricsInterceptor;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityDiagnosticRequestState;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.app.edge.operations.organization.OperationsTerminalActivationProblem;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.terminal.TerminalActivationProblem;
import com.catering.v2s.app.edge.terminal.TerminalDataReadProblem;
import com.catering.v2s.app.edge.terminal.TerminalDeviceCredentialProblem;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.contract.application.ContractCommandReceiptService;
import com.catering.v2s.contract.application.ContractCommandService;
import com.catering.v2s.extension.api.ExtensionFilterQuery;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.organization.application.BusinessEntityCommandReceiptService;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OrganizationCommandService;
import com.catering.v2s.organization.application.OrganizationHierarchyCommandReceiptService;
import com.catering.v2s.organization.application.OrganizationHierarchyService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.organization.application.StoreOperatingRuleCodec;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.asset.application.PlatformAssetService.AssetIdempotencyConflictException;
import com.catering.v2s.platform.foundation.contract.OwnerProblem;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.iam.application.PlatformCommandReceiptService;
import com.catering.v2s.platform.iam.application.PlatformCommandReceiptService.PlatformIdempotencyConflictException;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.platform.workspace.application.WorkspaceCommandReceiptService;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.storeterminal.application.StoreTerminalAuditHistoryService;
import com.catering.v2s.storeterminal.application.StoreTerminalOwnerService;
import com.catering.v2s.storeterminal.domain.PrinterSpecification;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi;
import com.catering.v2s.terminalbinding.application.TerminalBindingOwnerService;
import com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactOwnerService;
import com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerService;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAccountService;
import com.catering.v2s.workspace.iam.application.WorkspaceAssignmentScopeService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService.SessionConflictException;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamCommandReceiptService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordResetService;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService.RoleCapabilityCatalogDriftException;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Contract-level fallback for R5 owner adapters. Controller-local R3 compatibility handlers retain precedence. */
@Order
@RestControllerAdvice
public final class ContractProblemAdvice {
    private static final String SALES_MENU_OWNER_REJECTED = "销售菜单 owner 不接受该请求";

    private static final Logger log = LoggerFactory.getLogger(ContractProblemAdvice.class);
    private static final ObjectMapper DETAILS_JSON = new ObjectMapper();
    private static final tools.jackson.databind.ObjectMapper RESPONSE_JSON = new tools.jackson.databind.ObjectMapper();

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Problem> multipartTooLarge(MaxUploadSizeExceededException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                "上传文件超过商品图片大小限制",
                /* format-wrap */
                request);
    }

    @ExceptionHandler({
        CatalogOwnerApi.Problem.class,
        InventoryOwnerApi.Problem.class,
        CatalogProductionTagOwnerApi.Problem.class
    })
    ResponseEntity<Problem> catalogInventory(RuntimeException exception, HttpServletRequest request) {
        OwnerProblem ownerProblem = (OwnerProblem) exception;
        String code = ownerProblem.code();
        int status = ownerProblem.status();
        log.atWarn()
                .addKeyValue("event", "CATALOG_OWNER_PROBLEM")
                .addKeyValue("code", code)
                .addKeyValue("status", status)
                .addKeyValue("exceptionType", exception.getClass().getSimpleName())
                .addKeyValue(
                        "causeType",
                        exception.getCause() == null
                                ? "none"
                                : exception.getCause().getClass().getSimpleName())
                // A typed owner problem commonly has no nested cause.  Logging only its
                // cause therefore removes the very stack that identifies the rejected
                // owner boundary; the response remains the same generic, safe problem.
                .setCause(exception)
                .log(
                        "catalog-inventory owner problem code={} status={} exceptionType={} causeType={}",
                        code,
                        status,
                        exception.getClass().getSimpleName(),
                        exception.getCause() == null
                                ? "none"
                                : exception.getCause().getClass().getSimpleName());
        String detail = catalogInventoryDetail(code, exception);
        JsonNode details = ownerProblem.details();
        return problem(HttpStatus.valueOf(status), code, detail, request, details);
    }

    @ExceptionHandler(StoreOperatingRuleGate.CatalogManagementDisabledException.class)
    ResponseEntity<Problem> catalogManagementDisabled(
            StoreOperatingRuleGate.CatalogManagementDisabledException exception, HttpServletRequest request) {
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(request);
        log.atWarn()
                .addKeyValue("event", "STORE_CATALOG_MANAGEMENT_DISABLED")
                .addKeyValue("phase", "OWNER_GATE")
                .addKeyValue("outcome", "FAILED")
                .addKeyValue("reason", exception.reason().name())
                .addKeyValue("storeRefHash", exception.storeRefHash())
                .addKeyValue("correlationId", completion == null ? "unavailable" : completion.correlationId())
                .addKeyValue("requestId", completion == null ? "unavailable" : completion.requestId())
                .addKeyValue("operationId", completion == null ? "unavailable" : completion.operationId())
                .log(
                        "store-catalog-management-disabled event=STORE_CATALOG_MANAGEMENT_DISABLED phase=OWNER_GATE "
                                + "outcome=FAILED reason={} storeRefHash={}",
                        exception.reason().name(),
                        exception.storeRefHash());
        return problem(
                HttpStatus.FORBIDDEN,
                StoreOperatingRuleGate.CATALOG_MANAGEMENT_DISABLED_CODE,
                "功能尚未开启，需项目对门店授权",
                request);
    }

    /**
     * Reference blockers are the one typed owner family whose client contract requires the affected user to know which
     * live relation must be removed. The finite owner denominator is kept under REFERENCE_BLOCKS_VOID/DELETE; all other
     * owner messages stay edge-generic.
     */
    private static String catalogInventoryDetail(String code, RuntimeException exception) {
        if ("RESULT_UNKNOWN".equals(code)
                && exception.getMessage() != null
                && !exception.getMessage().isBlank()) {
            return exception.getMessage();
        }
        return switch (code) {
            case "MOVE_BOUNDARY" -> "分类已位于当前层级边界";
            case "REFERENCE_BLOCKS_VOID", "REFERENCE_BLOCKS_DELETE" -> {
                String detail = exception.getMessage();
                yield detail == null || detail.isBlank()
                        ? "当前事实仍被业务引用，不能执行该"
                                /* format-wrap */
                                + "操作"
                        : detail;
            }
            case "REFERENCE_MAPPING_UNRESOLVED" -> {
                String detail = exception.getMessage();
                String fallback = "复制所需的商品、点单选项或库存关系无法确定";
                yield detail == null || detail.isBlank() ? fallback : detail;
            }
            case "VALIDATION_ERROR" -> "请求中的业务信息不完整或不符合规则";
            default -> "商品、生产标签或库存操作不满足 owner 约束";
        };
    }

    @ExceptionHandler(CollaborationCommandApi.Problem.class)
    ResponseEntity<Problem> collaborationProblem(
            CollaborationCommandApi.Problem exception, HttpServletRequest request) {
        return problem(
                HttpStatus.valueOf(exception.status()),
                exception.code(),
                "collaboration owner rejected request",
                request);
    }

    @ExceptionHandler(BusinessChannelCommandApi.Problem.class)
    ResponseEntity<Problem> businessChannelProblem(
            BusinessChannelCommandApi.Problem exception, HttpServletRequest request) {
        return problem(
                HttpStatus.valueOf(exception.status()),
                exception.code(),
                "business-channel owner rejected request",
                request);
    }

    @ExceptionHandler(SalesMenuOwnerApi.Problem.class)
    ResponseEntity<Problem> salesMenuProblem(SalesMenuOwnerApi.Problem exception, HttpServletRequest request) {
        return problem(HttpStatus.valueOf(exception.status()), exception.code(), SALES_MENU_OWNER_REJECTED, request);
    }

    @ExceptionHandler(PlatformAssetService.AssetOwnerScopeForbiddenException.class)
    ResponseEntity<Problem> catalogAssetOwnerScopeForbidden(
            PlatformAssetService.AssetOwnerScopeForbiddenException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.FORBIDDEN,
                "SCOPE_FORBIDDEN",
                "商品图片资产操作不满足 owner 约束",
                /* format-wrap */
                request);
    }

    @ExceptionHandler(PlatformAssetService.AssetInvariantViolationException.class)
    ResponseEntity<Problem> assetInvariantViolation(
            PlatformAssetService.AssetInvariantViolationException exception, HttpServletRequest request) {
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(request);
        String errorCode = assetOwnerFailureCode(completion);
        log.atError()
                .addKeyValue("event", "PLATFORM_ASSET_OWNER_INVARIANT_VIOLATION")
                .addKeyValue("phase", "OWNER")
                .addKeyValue("outcome", "FAILED")
                .addKeyValue("correlationId", completion == null ? "unavailable" : completion.correlationId())
                .addKeyValue("requestId", completion == null ? "unavailable" : completion.requestId())
                .addKeyValue("operationId", completion == null ? "unavailable" : completion.operationId())
                .addKeyValue("owner", completion == null ? "platform-asset" : completion.owner())
                .addKeyValue("ownerOperation", exception.ownerOperation())
                .addKeyValue("errorCode", errorCode)
                .log(
                        "platform-asset-owner-invariant event=PLATFORM_ASSET_OWNER_INVARIANT_VIOLATION phase=OWNER "
                                + "outcome=FAILED ownerOperation={} errorCode={}",
                        exception.ownerOperation(),
                        errorCode);
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                errorCode,
                "静态资源 owner 状态不满足既定约束",
                /* format-wrap */
                request);
    }

    @ExceptionHandler(CommandExecutionContextResolver.CatalogScopeForbiddenException.class)
    ResponseEntity<Problem> catalogScopeForbidden(
            CommandExecutionContextResolver.CatalogScopeForbiddenException exception, HttpServletRequest request) {
        // Keep the public problem code stable while preserving the finite, payload-free denial branch in the
        // run-scoped completion event. This is the diagnostic join key for a denied catalog command.
        RequestCompletionDiagnosticState.freezeFailure(
                request, "CATALOG_SCOPE_REJECTED:" + exception.denialReason().name());
        HttpRequestMetricsInterceptor.freezeFailure(
                request, "CATALOG_SCOPE_REJECTED:" + exception.denialReason().name());
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(request);
        log.atWarn()
                .addKeyValue("event", "CATALOG_SCOPE_REJECTED")
                .addKeyValue("phase", "SCOPE")
                .addKeyValue("outcome", "FAILED")
                .addKeyValue("reason", exception.denialReason().name())
                .addKeyValue("correlationId", completion == null ? "unavailable" : completion.correlationId())
                .addKeyValue("requestId", completion == null ? "unavailable" : completion.requestId())
                .addKeyValue("operationId", completion == null ? "unavailable" : completion.operationId())
                .log(
                        "catalog-scope-rejected event=CATALOG_SCOPE_REJECTED phase=SCOPE outcome=FAILED reason={}",
                        exception.denialReason().name());
        return problem(
                HttpStatus.FORBIDDEN,
                "SCOPE_FORBIDDEN",
                "已认证会话不具备该商品、库存或生产标签操作范围",
                /* format-wrap */
                request);
    }

    @ExceptionHandler({
        ContractCommandService.ContractNotFoundException.class,
        StoreTerminalAuditHistoryService.TerminalNotFoundException.class,
        StoreTerminalOwnerService.TerminalNotFoundException.class,
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
        PlatformAuthenticationService.PlatformAdminNotFoundException.class,
        TerminalUpdateArtifactOwnerService.TerminalUpdateArtifactNotFoundException.class,
        TerminalUpdateRuleOwnerService.TerminalUpdateRuleNotFoundException.class
    })
    ResponseEntity<Problem> notFound(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof WorkspaceInvitationService.InvitationNotFoundException
                ? "WORKSPACE_IAM_INVITATION_NOT_FOUND"
                : exception instanceof PlatformAssetService.AssetNotFoundException
                        ? "PLATFORM_ASSET_NOT_FOUND"
                        : "PLATFORM_COMMON_RESOURCE_NOT_FOUND";
        return problem(HttpStatus.NOT_FOUND, code, "请求的 owner 资源不存在", request);
    }

    @ExceptionHandler({
        TerminalUpdateRuleOwnerService.TerminalUpdateRuleStaleStateException.class,
        TerminalUpdateRuleOwnerService.TerminalUpdateRuleIdempotencyConflictException.class
    })
    ResponseEntity<Problem> terminalUpdateRuleConflict(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof TerminalUpdateRuleOwnerService.TerminalUpdateRuleIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : "PLATFORM_COMMON_VERSION_CONFLICT";
        return problem(HttpStatus.CONFLICT, code, "规则已变化，请重新读取后再操作", request);
    }

    @ExceptionHandler({
        TerminalUpdateRuleOwnerService.TerminalUpdateRuleInvalidException.class,
        TerminalUpdateRuleOwnerService.TerminalUpdateRuleTargetInvalidException.class,
        TerminalUpdateRuleOwnerService.TerminalUpdateRuleScopeMismatchException.class
    })
    ResponseEntity<Problem> terminalUpdateRuleInvalid(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof TerminalUpdateRuleOwnerService.TerminalUpdateRuleTargetInvalidException
                ? "TERMINAL_UPDATE_RULE_TARGET_INVALID"
                : exception instanceof TerminalUpdateRuleOwnerService.TerminalUpdateRuleScopeMismatchException
                        ? "TERMINAL_UPDATE_SCOPE_MISMATCH"
                        : "PLATFORM_COMMON_VALIDATION_FAILED";
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, code, "终端更新规则不满足 owner 约束", request);
    }

    /** Must stay more specific than the organization conflict fallback: no store reference detail crosses the edge. */
    @ExceptionHandler(BusinessEntityService.HeadCompanyBrandAuthorizationInUseException.class)
    ResponseEntity<Problem> headCompanyBrandAuthorizationInUse(
            BusinessEntityService.HeadCompanyBrandAuthorizationInUseException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.CONFLICT,
                "ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE",
                "该经营品牌仍被门店使用，暂不能移除",
                request);
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
        SessionConflictException.class,
        WorkspaceRoleService.RoleConflictException.class,
        RoleCapabilityCatalogDriftException.class,
        WorkspaceAdministrationService.WorkspaceConflictException.class,
        WorkspaceAdministrationService.WorkspaceVersionConflictException.class,
        PlatformAuthenticationService.PlatformAdminVersionConflictException.class,
        WorkspaceCommandReceiptService.WorkspaceIdempotencyConflictException.class,
        WorkspaceIamCommandReceiptService.WorkspaceIamIdempotencyConflictException.class,
        PlatformIdempotencyConflictException.class,
        AssetIdempotencyConflictException.class,
        OrganizationHierarchyCommandReceiptService.OrganizationIdempotencyConflictException.class,
        BusinessEntityCommandReceiptService.BusinessEntityIdempotencyConflictException.class
    })
    ResponseEntity<Problem> conflict(RuntimeException exception, HttpServletRequest request) {
        // spotless:off
        String code =
                exception instanceof ContractCommandReceiptService.ContractIdempotencyConflictException
                        || exception instanceof ExtensionCommandReceiptService.ExtensionIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : exception instanceof BusinessEntityService.OrganizationNameConflictException
                ? "ORGANIZATION_BUSINESS_ENTITY_NAME_CONFLICT"
                : exception instanceof BusinessEntityService.OrganizationDuplicateException
                        || exception instanceof BusinessEntityService.OrganizationCodeConflictException
                ? "ORGANIZATION_BUSINESS_ENTITY_CODE_CONFLICT"
                : exception instanceof ContractCommandService.ContractConflictException
                ? "CONTRACT_VERSION_CONFLICT"
                : exception instanceof ExtensionDefinitionService.DefinitionVersionConflictException
                ? "EXTENSION_DEFINITION_VERSION_CONFLICT"
                : exception instanceof SessionConflictException
                ? "PLATFORM_COMMON_CONTEXT_STALE"
                : exception instanceof RoleCapabilityCatalogDriftException
                ? "WORKSPACE_IAM_ROLE_CAPABILITY_CATALOG_DRIFT"
                : exception instanceof WorkspaceCommandReceiptService.WorkspaceIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : exception instanceof WorkspaceIamCommandReceiptService.WorkspaceIamIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : exception instanceof PlatformIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : exception instanceof AssetIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : exception instanceof OrganizationHierarchyCommandReceiptService
                        .OrganizationIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : exception instanceof BusinessEntityCommandReceiptService.BusinessEntityIdempotencyConflictException
                ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                : "PLATFORM_COMMON_VERSION_CONFLICT";
        // spotless:on
        return problem(HttpStatus.CONFLICT, code, "owner readback 已变化，请重新读取后再操作", request);
    }

    @ExceptionHandler(ExtensionFilterQuery.DefinitionRevisionStaleException.class)
    ResponseEntity<Problem> extensionDefinitionRevisionStale(
            ExtensionFilterQuery.DefinitionRevisionStaleException exception, HttpServletRequest request) {
        ObjectNode details = DETAILS_JSON.createObjectNode();
        details.put("currentDefinitionRevision", exception.currentRevision());
        details.put("retryable", true);
        return problem(
                // spotless:off
                HttpStatus.CONFLICT, "EXTENSION_DEFINITION_REVISION_STALE",
                    "扩展字段定义已更新，请重新读取后再筛选", request, details);
                // spotless:on
    }

    @ExceptionHandler(ExtensionFilterQuery.InvalidFilterException.class)
    ResponseEntity<Problem> extensionFilterInvalid(
            ExtensionFilterQuery.InvalidFilterException exception, HttpServletRequest request) {
        ArrayNode reasons = DETAILS_JSON.createArrayNode();
        for (ExtensionFilterQuery.InvalidReason reason : exception.reasons()) {
            ObjectNode item = reasons.addObject();
            if (reason.fieldKey() != null) item.put("fieldKey", reason.fieldKey());
            item.put("reason", reason.reason());
            if (reason.expectedType() != null) item.put("expectedType", reason.expectedType());
        }
        ObjectNode details = DETAILS_JSON.createObjectNode();
        details.set("invalidFields", reasons);
        // spotless:off
        return problem(HttpStatus.BAD_REQUEST, "EXTENSION_FILTER_INVALID",
            "扩展字段筛选条件不符合当前字段定义", request, details);
        // spotless:on
    }

    @ExceptionHandler(PlatformAuthenticationService.LoginNameConflictException.class)
    ResponseEntity<Problem> platformLoginNameConflict(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "PLATFORM_IAM_LOGIN_NAME_CONFLICT", "登录名已被占用", request);
    }

    @ExceptionHandler(WorkspaceInvitationService.InvitationStateException.class)
    ResponseEntity<Problem> invitationTerminal(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.CONFLICT,
                "WORKSPACE_IAM_INVITATION_TERMINAL",
                "邀请流程状态不可用或已结束",
                /* format-wrap */
                request);
    }

    @ExceptionHandler(WorkspaceInvitationService.AccountNotBindableException.class)
    ResponseEntity<Problem> accountNotBindable(RuntimeException exception, HttpServletRequest request) {
        // spotless:off
        return problem(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "ACCOUNT_NOT_BINDABLE",
                "该账号当前不可接受邀请，请联系空间管理员",
                request);
        // spotless:on
    }

    @ExceptionHandler(WorkspacePasswordResetService.ResetStateException.class)
    ResponseEntity<Problem> workspaceCredentialResetUnavailable(
            RuntimeException exception, HttpServletRequest request) {
        String errorCode = "WORKSPACE_IAM_CREDENTIAL_RESET_UNAVAILABLE";
        String detail = "账号状态已变化，请重新读取后再重置登录凭据";
        return problem(HttpStatus.CONFLICT, errorCode, detail, request);
    }

    @ExceptionHandler({
        InvalidEdgeRequestException.class,
        ContractCommandService.ContractValidationException.class,
        ExtensionDefinitionService.DefinitionInvalidException.class,
        OrganizationOverviewTaskReadService.QueryValidationException.class,
        StoreOperatingRuleCodec.InvalidValuesException.class,
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
        if (request.getRequestURI() != null && request.getRequestURI().contains("/terminals")) {
            log.atWarn()
                    .addKeyValue("event", "STORE_TERMINAL_GENERIC_INVALID_REQUEST")
                    .addKeyValue("exceptionType", safeType(exception))
                    .addKeyValue("rootCauseType", safeType(rootCause(exception)))
                    .log("store-terminal request reached generic invalid mapping");
        }
        PlatformAssetService.AssetStorageUnavailableException storageFailure =
                exception instanceof PlatformAssetService.AssetStorageUnavailableException failure ? failure : null;
        if (storageFailure != null) logAssetStorageFailure(storageFailure, request);
        String code = storageFailure != null
                ? assetStorageFailureCode(RequestCompletionDiagnosticState.find(request))
                : exception instanceof ExtensionDefinitionService.DefinitionInvalidException
                        ? "EXTENSION_DEFINITION_INVALID"
                        : exception instanceof BusinessEntityService.OrganizationOperatingRuleValidationException
                                ? "ORGANIZATION_STORE_OPERATING_RULES_INVALID"
                                : exception instanceof WorkspaceRoleService.RoleCapabilityUnknownException
                                        ? "WORKSPACE_IAM_ROLE_CAPABILITY_UNKNOWN"
                                        : exception instanceof WorkspaceRoleService.PageAccessCatalogMismatchException
                                                ? "WORKSPACE_IAM_PAGE_ACCESS_CATALOG_MISMATCH"
                                                : exception instanceof WorkspaceUserService.PageValidationException
                                                        ? "PLATFORM_COMMON_VALIDATION_FAILED"
                                                        : exception
                                                                        instanceof
                                                                        WorkspaceRoleService.RoleValidationException
                                                                ? "WORKSPACE_IAM_ROLE_CAPABILITY_INCOMPATIBLE"
                                                                : "PLATFORM_COMMON_VALIDATION_FAILED";
        return problem(
                storageFailure != null ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.UNPROCESSABLE_ENTITY,
                code,
                storageFailure != null ? "静态资源存储暂时不可用" : "请求不满足 owner 约束",
                request);
    }

    /** UUID-typed transport fields fail during Jackson binding and therefore use the contract's 400 shape. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Problem> malformedRequest(HttpMessageNotReadableException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.BAD_REQUEST,
                "PLATFORM_COMMON_VALIDATION_FAILED",
                "请求体或参数格式不正确",
                /* format-wrap */
                request);
    }

    private void logAssetStorageFailure(
            PlatformAssetService.AssetStorageUnavailableException failure, HttpServletRequest request) {
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(request);
        Throwable root = rootCause(failure);
        String errorCode = assetStorageFailureCode(completion);
        log.atWarn()
                .addKeyValue("event", "PLATFORM_ASSET_STORAGE_FAILURE")
                .addKeyValue("phase", "OWNER")
                .addKeyValue("outcome", "FAILED")
                .addKeyValue("dependency", dependencyFor(failure.storageOperation()))
                .addKeyValue("correlationId", completion == null ? "unavailable" : completion.correlationId())
                .addKeyValue("requestId", completion == null ? "unavailable" : completion.requestId())
                .addKeyValue("operationId", completion == null ? "unavailable" : completion.operationId())
                .addKeyValue("routeTemplate", completion == null ? "unavailable" : completion.routeTemplate())
                .addKeyValue("owner", completion == null ? "platform-asset" : completion.owner())
                .addKeyValue("storageOperation", failure.storageOperation())
                .addKeyValue("failureType", safeType(failure))
                .addKeyValue("rootCauseType", safeType(root))
                .addKeyValue("retryAttempt", 0)
                .addKeyValue("status", failure.storageHttpStatus() == null ? "unassigned" : failure.storageHttpStatus())
                .addKeyValue(
                        "httpStatus", failure.storageHttpStatus() == null ? "unassigned" : failure.storageHttpStatus())
                .addKeyValue(
                        "serviceErrorCode",
                        failure.storageErrorCode() == null ? "unassigned" : failure.storageErrorCode())
                .addKeyValue("errorCode", errorCode)
                .log(renderAssetStorageFailure(failure, completion, root));
    }

    static String renderAssetStorageFailure(
            PlatformAssetService.AssetStorageUnavailableException failure,
            RequestCompletionDiagnosticState completion,
            Throwable root) {
        return "platform-asset-diagnostic event=PLATFORM_ASSET_STORAGE_FAILURE"
                + " phase=OWNER outcome=FAILED"
                + " dependency=" + dependencyFor(failure.storageOperation())
                + " correlationId=" + (completion == null ? "unavailable" : completion.correlationId())
                + " requestId=" + (completion == null ? "unavailable" : completion.requestId())
                + " operationId=" + (completion == null ? "unavailable" : completion.operationId())
                + " routeTemplate=" + (completion == null ? "unavailable" : completion.routeTemplate())
                + " owner=" + (completion == null ? "platform-asset" : completion.owner())
                + " storageOperation=" + failure.storageOperation()
                + " failureType=" + safeType(failure)
                + " rootCauseType=" + safeType(root)
                + " retryAttempt=0"
                + " status=" + (failure.storageHttpStatus() == null ? "unassigned" : failure.storageHttpStatus())
                + " httpStatus=" + (failure.storageHttpStatus() == null ? "unassigned" : failure.storageHttpStatus())
                + " serviceErrorCode="
                + (failure.storageErrorCode() == null ? "unassigned" : failure.storageErrorCode())
                + " errorCode=" + assetStorageFailureCode(completion);
    }

    private static String assetOwnerFailureCode(RequestCompletionDiagnosticState completion) {
        return isCatalogAssetStage(completion)
                ? "ASSET_PROCESSING_FAILED"
                : "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION";
    }

    private static String assetStorageFailureCode(RequestCompletionDiagnosticState completion) {
        return isCatalogAssetStage(completion) ? "ASSET_PROCESSING_FAILED" : "PLATFORM_COMMON_RESULT_UNKNOWN";
    }

    private static boolean isCatalogAssetStage(RequestCompletionDiagnosticState completion) {
        return completion != null && "stageOperationsCatalogAsset".equals(completion.operationId());
    }

    private static Throwable rootCause(Throwable failure) {
        Throwable current = failure;
        while (current.getCause() != null && current.getCause() != current) current = current.getCause();
        return current;
    }

    private static String safeType(Throwable failure) {
        if (failure == null) return "none";
        String value = failure.getClass().getSimpleName();
        return value.matches("[A-Za-z0-9_$]{1,128}") ? value : "unknown";
    }

    private static String safeValidationReason(Throwable failure) {
        if (failure instanceof PrinterSpecification.InvalidRuleException invalid) {
            return "PRINTER_" + invalid.field().name();
        }
        if (failure instanceof TerminalConfiguration.InvalidConfigurationException invalid) {
            return invalid.rule().name();
        }
        return safeType(failure);
    }

    private static String dependencyFor(String operation) {
        if (operation.startsWith("object.") || operation.startsWith("bucket.")) return "object-storage";
        if (operation.startsWith("local.")) return "local-filesystem";
        return "platform-asset-owner";
    }

    @ExceptionHandler(OrganizationCommandService.OrganizationCommandException.class)
    ResponseEntity<Problem> organizationCommand(
            OrganizationCommandService.OrganizationCommandException exception, HttpServletRequest request) {
        String code =
                switch (exception.problem()) {
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
        return problem(
                HttpStatus.UNAUTHORIZED,
                exception instanceof PlatformAuthenticationService.InvalidCredentialsException
                        ? "PLATFORM_IAM_INVALID_CREDENTIALS"
                        : "WORKSPACE_IAM_INVALID_CREDENTIALS",
                "登录名或密码不正确",
                request);
    }

    @ExceptionHandler({
        PlatformAuthenticationService.SessionExpiredException.class,
        WorkspaceAuthenticationService.SessionInvalidException.class
    })
    ResponseEntity<Problem> unauthenticated(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.UNAUTHORIZED,
                exception instanceof PlatformAuthenticationService.SessionExpiredException
                        ? "PLATFORM_IAM_SESSION_EXPIRED"
                        : "PLATFORM_COMMON_AUTHENTICATION_REQUIRED",
                "会话不可用或已过期",
                request);
    }

    @ExceptionHandler(WorkspaceAuthenticationService.PasswordChangeRequiredException.class)
    ResponseEntity<Problem> passwordChangeRequired(
            WorkspaceAuthenticationService.PasswordChangeRequiredException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.FORBIDDEN,
                "WORKSPACE_IAM_PASSWORD_CHANGE_REQUIRED",
                "请先修改登录密码",
                /* format-wrap */
                request);
    }

    @ExceptionHandler({
        PlatformAuthenticationService.AccountDisabledException.class,
        WorkspaceAuthenticationService.AccountDisabledException.class,
        WorkspaceAuthenticationService.WorkspaceDisabledException.class,
        WorkspaceAdministrationService.WorkspaceDisabledException.class,
        WorkspaceAdministrationService.WorkspaceStatusInvalidException.class,
        WorkspaceAccountService.WorkspaceDisabledException.class,
        WorkspaceRoleService.WorkspaceDisabledException.class
    })
    ResponseEntity<Problem> disabled(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof PlatformAuthenticationService.AccountDisabledException
                ? "PLATFORM_IAM_ACCOUNT_DISABLED"
                : exception instanceof WorkspaceAuthenticationService.AccountDisabledException
                        ? "WORKSPACE_IAM_ACCOUNT_DISABLED"
                        : exception instanceof WorkspaceAuthenticationService.WorkspaceDisabledException
                                ? "WORKSPACE_IAM_WORKSPACE_DISABLED"
                                : exception instanceof WorkspaceAdministrationService.WorkspaceDisabledException
                                                || exception
                                                        instanceof WorkspaceAccountService.WorkspaceDisabledException
                                                || exception instanceof WorkspaceRoleService.WorkspaceDisabledException
                                        ? "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED"
                                        : "PLATFORM_WORKSPACE_STATUS_TRANSITION_INVALID";
        return problem(HttpStatus.FORBIDDEN, code, "当前主体不可执行该操作", request);
    }

    @ExceptionHandler({
        WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class,
        WorkspaceUserService.TaskScopeDeniedException.class,
        ContractCommandService.ContractAuthorizationException.class,
        StoreTerminalAuditHistoryService.TerminalAuthorizationException.class,
        BusinessEntityService.OrganizationAuthorizationException.class,
        OrganizationHierarchyService.OrganizationAuthorizationException.class,
        StoreTerminalOwnerService.TerminalAuthorizationException.class,
        TerminalBindingOwnerService.TerminalOperationsAuthorizationException.class
    })
    ResponseEntity<Problem> accessDenied(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.FORBIDDEN,
                "PLATFORM_COMMON_ACCESS_DENIED",
                "当前主体无权执行该操作",
                /* format-wrap */
                request);
    }

    @ExceptionHandler(StoreTerminalOwnerService.TerminalStoreUnavailableException.class)
    ResponseEntity<Problem> storeTerminalUnavailable(
            StoreTerminalOwnerService.TerminalStoreUnavailableException exception, HttpServletRequest request) {
        // spotless:off
        return problem(HttpStatus.FORBIDDEN, "PLATFORM_COMMON_ACCESS_DENIED", "当前主体无权执行该操作",
            request);
        // spotless:on
    }

    @ExceptionHandler(TerminalActivationProblem.class)
    ResponseEntity<Problem> terminalActivation(TerminalActivationProblem exception, HttpServletRequest request) {
        return problem(exception.status(), exception.code(), exception.detail(), request);
    }

    @ExceptionHandler(TerminalDataReadProblem.class)
    ResponseEntity<Problem> terminalDataRead(TerminalDataReadProblem exception, HttpServletRequest request) {
        return problem(exception.status(), exception.code(), exception.detail(), request);
    }

    @ExceptionHandler(OperationsTerminalActivationProblem.class)
    ResponseEntity<Problem> operationsTerminalActivation(
            OperationsTerminalActivationProblem exception, HttpServletRequest request) {
        return problem(exception.status(), exception.code(), exception.detail(), request);
    }

    @ExceptionHandler(TerminalDeviceCredentialProblem.class)
    ResponseEntity<Problem> terminalCredentialInvalid(
            TerminalDeviceCredentialProblem exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "TERMINAL_BINDING_CREDENTIAL_INVALID", "终端凭证无效", request);
    }

    @ExceptionHandler(TerminalBindingOwnerApi.OwnerInvariantViolationException.class)
    ResponseEntity<Problem> terminalBindingOwnerInvariant(
            TerminalBindingOwnerApi.OwnerInvariantViolationException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                "终端绑定状态不一致，暂时无法完成操作",
                request);
    }

    @ExceptionHandler({
        StoreTerminalOwnerService.TerminalNameConflictException.class,
        StoreTerminalOwnerService.ActivationCodeConflictException.class,
        StoreTerminalOwnerService.ActivationCodeExhaustedException.class,
        StoreTerminalOwnerService.TerminalVersionConflictException.class,
        StoreTerminalOwnerService.TerminalVoidedImmutableException.class,
        StoreTerminalOwnerService.TerminalStatusTransitionInvalidException.class,
        StoreTerminalOwnerService.IdempotencyConflictException.class
    })
    ResponseEntity<Problem> storeTerminalConflict(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof StoreTerminalOwnerService.TerminalNameConflictException
                ? "STORE_TERMINAL_NAME_CONFLICT"
                : exception instanceof StoreTerminalOwnerService.ActivationCodeConflictException
                        ? "STORE_TERMINAL_ACTIVATION_CODE_CONFLICT"
                        : exception instanceof StoreTerminalOwnerService.ActivationCodeExhaustedException
                                ? "STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED"
                                : exception instanceof StoreTerminalOwnerService.TerminalVoidedImmutableException
                                        ? "STORE_TERMINAL_VOIDED_IMMUTABLE"
                                        : exception
                                                        instanceof
                                                        StoreTerminalOwnerService
                                                                .TerminalStatusTransitionInvalidException
                                                ? "STORE_TERMINAL_STATUS_TRANSITION_INVALID"
                                                : exception
                                                                instanceof
                                                                StoreTerminalOwnerService.IdempotencyConflictException
                                                        ? "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT"
                                                        : "PLATFORM_COMMON_VERSION_CONFLICT";
        // spotless:off
        return problem(HttpStatus.CONFLICT, code,
            "终端操作与当前 owner 状态冲突，请重新读取后再操作", request);
        // spotless:on
    }

    @ExceptionHandler({
        StoreTerminalOwnerService.TerminalReferenceInvalidException.class,
        StoreTerminalOwnerService.InvalidTerminalInputException.class,
        StoreTerminalOwnerService.InvalidTerminalRequestException.class
    })
    ResponseEntity<Problem> storeTerminalInvalid(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof StoreTerminalOwnerService.TerminalReferenceInvalidException
                ? "STORE_TERMINAL_REFERENCE_INVALID"
                : exception instanceof StoreTerminalOwnerService.InvalidTerminalInputException
                        ? "PLATFORM_COMMON_VALIDATION_FAILED"
                        : "STORE_TERMINAL_RULE_INVALID";
        String validationReason = safeValidationReason(rootCause(exception));
        log.atWarn()
                .addKeyValue("event", "STORE_TERMINAL_TYPED_INVALID_REQUEST")
                .addKeyValue("exceptionType", safeType(exception))
                .addKeyValue("rootCauseType", safeType(rootCause(exception)))
                .addKeyValue("validationReason", validationReason)
                .addKeyValue("errorCode", code)
                .log(
                        "store-terminal request rejected by typed owner validation; validationReason={}",
                        validationReason);
        return problem(
                exception instanceof StoreTerminalOwnerService.InvalidTerminalInputException
                        ? HttpStatus.BAD_REQUEST
                        : HttpStatus.UNPROCESSABLE_ENTITY,
                code,
                exception instanceof StoreTerminalOwnerService.TerminalReferenceInvalidException
                        ? "终端关联资料不可用，请刷新后重试"
                        : exception instanceof StoreTerminalOwnerService.InvalidTerminalInputException
                                ? "请求参数不合法，请检查后重试"
                                : "终端配置不符合当前规则，请检查后重试",
                request);
    }

    @ExceptionHandler({StoreTerminalOwnerService.ReceiptCorruptException.class})
    ResponseEntity<Problem> storeTerminalResultUnknown(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN",
                "owner 命令结果暂时无法确认，请使用同一幂等键重试或查询",
                request);
    }

    @ExceptionHandler({
        PlatformAuthenticationService.CredentialLockedException.class,
        WorkspaceAuthenticationService.CredentialLockedException.class
    })
    ResponseEntity<Problem> credentialLocked(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.LOCKED,
                exception instanceof PlatformAuthenticationService.CredentialLockedException
                        ? "PLATFORM_IAM_CREDENTIAL_LOCKED"
                        : "WORKSPACE_IAM_CREDENTIAL_LOCKED",
                "凭据已被临时锁定",
                request);
    }

    @ExceptionHandler({
        PlatformAuthenticationService.LoginRateLimitedException.class,
        PlatformAuthenticationService.OtpRateLimitedException.class,
        WorkspaceAuthenticationService.LoginRateLimitedException.class,
        WorkspaceAuthenticationService.OtpRateLimitedException.class
    })
    ResponseEntity<Problem> rateLimited(RuntimeException exception, HttpServletRequest request) {
        String code = exception instanceof PlatformAuthenticationService.LoginRateLimitedException
                        || exception instanceof PlatformAuthenticationService.OtpRateLimitedException
                ? "PLATFORM_IAM_RATE_LIMITED"
                : "WORKSPACE_IAM_RATE_LIMITED";
        return problem(HttpStatus.TOO_MANY_REQUESTS, code, "尝试次数过多，请稍后再试", request);
    }

    @ExceptionHandler({
        PlatformAuthenticationService.OtpInvalidException.class,
        PlatformAuthenticationService.RecoveryFlowInvalidException.class
    })
    ResponseEntity<Problem> platformRecoveryInvalid(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.UNAUTHORIZED,
                "PLATFORM_IAM_INVALID_CREDENTIALS",
                "验证码或恢复流程不可用",
                /* format-wrap */
                request);
    }

    @ExceptionHandler({
        WorkspaceAuthenticationService.OtpInvalidException.class,
        WorkspacePasswordRecoveryService.OtpInvalidException.class
    })
    ResponseEntity<Problem> resetOtpInvalid(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "WORKSPACE_IAM_OTP_INVALID",
                "验证码不可用或已失效",
                /* format-wrap */
                request);
    }

    @ExceptionHandler(WorkspacePasswordRecoveryService.RecoveryStateException.class)
    ResponseEntity<Problem> operationsRecoveryState(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.CONFLICT,
                "WORKSPACE_IAM_GRANT_INVALID",
                "找回流程状态不可用或已失效",
                /* format-wrap */
                request);
    }

    @ExceptionHandler({
        ContractCommandReceiptService.ContractReceiptCorruptException.class,
        BusinessEntityCommandReceiptService.BusinessEntityReceiptCorruptException.class,
        OrganizationHierarchyCommandReceiptService.OrganizationReceiptCorruptException.class,
        PlatformCommandReceiptService.PlatformReceiptCorruptException.class,
        WorkspaceCommandReceiptService.WorkspaceReceiptCorruptException.class,
        WorkspaceIamCommandReceiptService.WorkspaceIamReceiptCorruptException.class,
        ExtensionCommandReceiptService.ExtensionReceiptCorruptException.class,
        DuplicateKeyException.class
    })
    ResponseEntity<Problem> ownerResultUnknown(RuntimeException exception, HttpServletRequest request) {
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "PLATFORM_COMMON_RESULT_UNKNOWN",
                "owner 命令结果暂时无法确认，请使用同一幂等键重试或查询",
                request);
    }

    public static ResponseEntity<Problem> problem(
            HttpStatus status, String code, String detail, HttpServletRequest request) {
        return problem(status, code, detail, request, null);
    }

    public static ResponseEntity<Problem> problem(
            HttpStatus status, String code, String detail, HttpServletRequest request, JsonNode details) {
        PublicSecurityDiagnosticRequestState.freezeFailure(request, status.value(), code);
        RequestCompletionDiagnosticState.freezeFailure(request, code);
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(request);
        String correlationId = completion == null
                ? PublicSecurityDiagnosticRequestState.correlationId(request)
                : completion.correlationId();
        return ResponseEntity.status(status)
                .contentType(MediaType.valueOf("application/problem+json"))
                .body(new Problem(
                        "about:blank",
                        code,
                        status.value(),
                        detail,
                        request.getRequestURI(),
                        code,
                        correlationId,
                        responseDetails(details)));
    }

    public static ResponseEntity<Problem> problem(
            HttpStatus status, String code, String detail, EdgeRequestContext request) {
        return problem(status, code, detail, request, null);
    }

    public static ResponseEntity<Problem> problem(
            HttpStatus status, String code, String detail, EdgeRequestContext request, JsonNode details) {
        String correlationId = request.correlationId();
        if (correlationId == null || correlationId.isBlank())
            correlationId = UUID.randomUUID().toString();
        return ResponseEntity.status(status)
                .contentType(MediaType.valueOf("application/problem+json"))
                .body(new Problem(
                        "about:blank",
                        code,
                        status.value(),
                        detail,
                        "",
                        code,
                        correlationId,
                        responseDetails(details)));
    }

    /** Owner APIs use Jackson 2 nodes; the Spring Boot 4 edge serializes Jackson 3 nodes. */
    private static tools.jackson.databind.JsonNode responseDetails(JsonNode details) {
        return details == null ? null : RESPONSE_JSON.readTree(details.toString());
    }

    public record Problem(
            String type,
            String title,
            int status,
            String detail,
            String instance,
            String errorCode,
            String correlationId,
            tools.jackson.databind.JsonNode details) {
        public Problem(
                String type,
                String title,
                int status,
                String detail,
                String instance,
                String errorCode,
                String correlationId) {
            this(type, title, status, detail, instance, errorCode, correlationId, null);
        }
    }
}
