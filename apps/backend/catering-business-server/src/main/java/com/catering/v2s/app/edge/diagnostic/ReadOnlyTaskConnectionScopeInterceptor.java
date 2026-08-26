package com.catering.v2s.app.edge.diagnostic;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.Set;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Opens one read-only connection scope for the current CP-05 P2 GET set.
 *
 * <p>The exact operation set is intentionally closed. A route not in the set remains unchanged rather than gaining a
 * default transaction and hiding an unclassified performance regression.
 */
public final class ReadOnlyTaskConnectionScopeInterceptor implements HandlerInterceptor {
    private static final String STATE = ReadOnlyTaskConnectionScopeInterceptor.class.getName();

    private static final Set<String> CURRENT_P2_OPERATIONS = Set.of(
            "getExtensionDefinition",
            "getExtensionEntityCatalog",
            "getOperationsBrandCatalogCopyCandidates",
            "getOperationsBusinessChannelDetail",
            "getOperationsBusinessChannelTemplates",
            "getOperationsCatalogDictionary",
            "getOperationsCatalogCategoryCandidates",
            "getOperationsCatalogItem",
            "getOperationsCatalogItems",
            "getOperationsCatalogItemSkus",
            "getOperationsCatalogNavigation",
            "getOperationsCatalogShapeManifest",
            "getOperationsCatalogWorkbenchContext",
            "getOperationsContract",
            "getOperationsContractCandidates",
            "getOperationsContractExtensionDefinition",
            "getOperationsContracts",
            "getOperationsEntityAuditHistory",
            "getOperationsExternalCapabilityDictionary",
            "getOperationsExternalProviderCandidates",
            "getOperationsFixedStoreContracts",
            "getOperationsInventoryConsumptionTargetCandidates",
            "getOperationsInventoryTarget",
            "getOperationsInventoryTargetBusinessHistory",
            "getOperationsInventoryTargetChangeSummary",
            "getOperationsInventoryTargetConsumptionReferences",
            "getOperationsInventoryTargetDiagnostics",
            "getOperationsInventoryTargetLedger",
            "getOperationsInventoryTargets",
            "getOperationsLocalCatalogCopyCandidates",
            "getOperationsOrganizationBrand",
            "getOperationsOrganizationBrands",
            "getOperationsOrganizationBusinessEntityExtensionDefinition",
            "getOperationsOrganizationCandidates",
            "getOperationsOrganizationHeadCompanies",
            "getOperationsOrganizationHeadCompany",
            "getOperationsOrganizationHierarchy",
            "getOperationsOrganizationHierarchyExtensionDefinition",
            "getOperationsOrganizationStore",
            "getOperationsOrganizationStoreExtensionDefinition",
            "getOperationsOrganizationStores",
            "getOperationsOrganizationTenant",
            "getOperationsOrganizationTenants",
            "getOperationsOwnerBindingDetail",
            "getOperationsProductionTags",
            "getOperationsProjectBusinessChannels",
            "getOperationsStoreBusinessChannelTemplateCandidates",
            "getOperationsStoreBusinessChannels",
            "getOperationsStoreProfile",
            "getOperationsWorkspaceGroupInvitationCandidates",
            "getOperationsWorkspaceGroupInvitations",
            "getOperationsWorkspaceGroupUser",
            "getOperationsWorkspaceGroupUserAccount",
            "getOperationsWorkspaceHeadCompanyInvitationCandidates",
            "getOperationsWorkspaceHeadCompanyInvitations",
            "getOperationsWorkspaceHeadCompanyUser",
            "getOperationsWorkspaceHeadCompanyUserAccount",
            "getOperationsWorkspaceProjectInvitationCandidates",
            "getOperationsWorkspaceProjectInvitations",
            "getOperationsWorkspaceProjectUser",
            "getOperationsWorkspaceProjectUserAccount",
            "getOperationsWorkspaceRegionInvitationCandidates",
            "getOperationsWorkspaceRegionInvitations",
            "getOperationsWorkspaceRegionUser",
            "getOperationsWorkspaceRegionUserAccount",
            "getOperationsWorkspaceStoreInvitationCandidates",
            "getOperationsWorkspaceStoreInvitations",
            "getOperationsWorkspaceStoreUser",
            "getOperationsWorkspaceStoreUserAccount",
            "getPlatformAdminDetail",
            "getPlatformAdminPage",
            "getPlatformContractOverviewDetail",
            "getPlatformContractOverviewPage",
            "getPlatformEntityAuditHistory",
            "getPlatformExternalCollaborationTree",
            "getPlatformExternalSystemDetail",
            "getPlatformGroupWorkspaceDetail",
            "getPlatformOrganizationCandidates",
            "getPlatformOrganizationHierarchyTree",
            "getPlatformOrganizationOverviewDetail",
            "getPlatformOrganizationOverviewPage",
            "getPlatformOwnerBindingDetail",
            "getPlatformProviderProfileBindings",
            "getPlatformProviderProfileDetail",
            "getPublicInvitationView",
            "getWorkspaceAccount",
            "getWorkspaceAccounts",
            "getWorkspaceInvitation",
            "getWorkspaceInvitationCandidates",
            "getWorkspaceInvitations",
            "getWorkspaceRole",
            "getWorkspaceRoles",
            "listOperationsCatalogAttributeDefinitions",
            "listOperationsCatalogOrderOptionDefinitions",
            "listOperationsCatalogUnits",
            "listPlatformGroupWorkspaces");

    private final Map<String, EdgeRouteFaceRegistry.Definition> definitions;
    private final PlatformTransactionManager transactions;

    public ReadOnlyTaskConnectionScopeInterceptor(
            Map<String, EdgeRouteFaceRegistry.Definition> definitions, PlatformTransactionManager transactions) {
        this.definitions = Map.copyOf(definitions);
        this.transactions = transactions;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String operationId = operationId(request);
        if (!CURRENT_P2_OPERATIONS.contains(operationId)) return true;

        DefaultTransactionDefinition definition = new DefaultTransactionDefinition();
        definition.setName("performance.read." + operationId);
        definition.setReadOnly(true);
        definition.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        TransactionStatus status = transactions.getTransaction(definition);
        request.setAttribute(STATE, new State(status, operationId));
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        Object value = request.getAttribute(STATE);
        if (!(value instanceof State state)) return;
        if (!state.status().isCompleted()) transactions.rollback(state.status());
    }

    static Set<String> currentP2Operations() {
        return CURRENT_P2_OPERATIONS;
    }

    private String operationId(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase(java.util.Locale.ROOT);
        String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        EdgeRouteFaceRegistry.Definition definition = definitions.get(method + " " + pattern);
        return definition == null ? "" : definition.operationId();
    }

    private record State(TransactionStatus status, String operationId) {}
}
