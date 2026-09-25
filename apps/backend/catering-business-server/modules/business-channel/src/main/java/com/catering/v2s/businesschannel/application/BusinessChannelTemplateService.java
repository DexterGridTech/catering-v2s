package com.catering.v2s.businesschannel.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateTemplateCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.TransitionTemplateStatusCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.UpdateTemplateCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelPersistence.ChannelProjection;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelTemplatePersistence;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.collection.CanonicalCursorIdentity;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of business-channel templates and channel instances. */
@Service
public class BusinessChannelTemplateService {
    private static final String REQ_CREATE_TEMPLATE = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE";
    private static final String REQ_UPDATE_TEMPLATE = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE";
    private static final String REQ_TRANSITION_TEMPLATE = "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS";
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final AuditChangePolicy TEMPLATE_CREATED = new AuditChangePolicy(
            "BUSINESS_CHANNEL_TEMPLATE",
            "TEMPLATE_CREATED",
            java.util.Set.of(
                    "projectRef",
                    "templateName",
                    "templateCode",
                    "accessKind",
                    "operatorKind",
                    "orderKind",
                    "dineInForm",
                    "providerCode",
                    "urlRule",
                    "storeVisibilityScope",
                    "visibleStoreRefs",
                    "status"));
    private static final AuditChangePolicy TEMPLATE_UPDATED = new AuditChangePolicy(
            "BUSINESS_CHANNEL_TEMPLATE",
            "TEMPLATE_UPDATED",
            java.util.Set.of("templateName", "urlRule", "storeVisibilityScope", "visibleStoreRefs"));
    private static final AuditChangePolicy TEMPLATE_STATUS =
            new AuditChangePolicy("BUSINESS_CHANNEL_TEMPLATE", "STATUS_CHANGED", java.util.Set.of("status"));
    private final BusinessChannelTemplatePersistence persistence;
    private final TimeProvider time;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final CollaborationBindingReadApi collaborationBindings;
    private final WorkspaceStatusLookup workspaceStatuses;
    private final BusinessChannelCommandReceiptService receipts;
    private final OrganizationOwnerApi organizationOwner;
    private final OrganizationTaskPathLookup organizationTaskPaths;

    @Autowired
    public BusinessChannelTemplateService(
            BusinessChannelTemplatePersistence persistence,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            OrganizationOwnerApi organizationOwner,
            OrganizationTaskPathLookup organizationTaskPaths) {
        this.persistence = persistence;
        this.time = time;
        this.collaborationCatalog = collaborationCatalog;
        this.collaborationBindings = collaborationBindings;
        this.workspaceStatuses = workspaceStatuses;
        this.receipts = receipts;
        this.organizationOwner = Objects.requireNonNull(organizationOwner, "organizationOwner");
        this.organizationTaskPaths = Objects.requireNonNull(organizationTaskPaths, "organizationTaskPaths");
    }

    /** Compatibility constructor for focused tests and direct owner construction. */
    public BusinessChannelTemplateService(
            org.springframework.jdbc.core.JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            OrganizationOwnerApi organizationOwner,
            OrganizationTaskPathLookup organizationTaskPaths) {
        this(
                new BusinessChannelTemplatePersistence(jdbc),
                time,
                collaborationCatalog,
                collaborationBindings,
                workspaceStatuses,
                receipts,
                organizationOwner,
                organizationTaskPaths);
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.TemplatePage pageTemplates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String status,
            String operatorKind,
            String sortKey,
            String sortDirection) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedStatus =
                optionalEnum(status, "status", BusinessChannelPolicy.ENABLED, BusinessChannelPolicy.DISABLED);
        String normalizedOperator =
                optionalEnum(operatorKind, "operatorKind", BusinessChannelPolicy.PROJECT, BusinessChannelPolicy.STORE);
        // spotless:off
        String normalizedSortKey = optionalEnum(
                sortKey,
                "sortKey",
                "TEMPLATE_NAME",
                "TEMPLATE_CODE",
                "ACCESS_KIND",
                "OPERATOR_KIND",
                "ORDER_KIND",
                "STATUS");
        String normalizedSortDirection = optionalEnum(sortDirection, "sortDirection", "ASC", "DESC");
        if (normalizedSortKey == null && normalizedSortDirection != null) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection requires sortKey");
        }
        List<BusinessChannelTemplatePersistence.TemplateProjection> projections = persistence
                .pageTemplates(
                        workspaceUuid,
                        groupWorkspaceKey,
                        projectRef,
                        normalizedStatus,
                        normalizedOperator,
                        normalizedSortKey,
                        normalizedSortDirection,
                        BusinessChannelTemplatePersistence.BOUNDED_READ_LIMIT)
                .rows();
        if (projections.size() > BusinessChannelTemplatePersistence.BOUNDED_READ_LIMIT) {
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "bounded business-channel template read exceeded its fixed source limit");
        }
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, projections, List.of());
        List<TemplateRow> rows = projections.stream()
                .map(projection -> templateRow(projection, facts))
                .toList();
        return new BusinessChannelReadback.TemplatePage(
                rows.stream().map(BusinessChannelTemplateService::template).toList(), null, rows.size());
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.TemplatePage pageStoreTemplateCandidates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String storeRef,
            String cursor,
            int pageSize,
            String sortKey,
            String sortDirection) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (projectRef == null) throw problem("VALIDATION_ERROR", 422, "projectRef is required");
        String normalizedStoreRef = BusinessChannelPolicy.required(storeRef, "storeRef", 240);
        UUID storeId = parseUuid(normalizedStoreRef, "storeRef");
        int size = pageSize(pageSize);
        String normalizedSortKey = optionalEnum(
                sortKey, "sortKey", "TEMPLATE_NAME", "TEMPLATE_CODE", "ACCESS_KIND", "ORDER_KIND", "STATUS");
        String normalizedSortDirection = optionalEnum(sortDirection, "sortDirection", "ASC", "DESC");
        if (normalizedSortKey == null && normalizedSortDirection != null) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection requires sortKey");
        }
        requireEnabledStore(workspaceUuid, groupWorkspaceKey, storeId);
        String identity = cursorIdentity(
                "store-template-candidate-page",
                workspaceUuid,
                groupWorkspaceKey,
                projectRef,
                normalizedStoreRef,
                size,
                normalizedSortKey,
                normalizedSortDirection);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        BusinessChannelTemplatePersistence.TemplatePageQuery queried = persistence.pageStoreTemplateCandidates(
                workspaceUuid,
                groupWorkspaceKey,
                projectRef,
                storeId,
                position == null ? null : position.tieBreaker(),
                position == null ? null : position.sortKey(),
                normalizedSortKey,
                normalizedSortDirection,
                size);
        List<BusinessChannelTemplatePersistence.TemplateProjection> rows = queried.rows();
        long total = queried.total();
        boolean hasNext = rows.size() > size;
        List<BusinessChannelTemplatePersistence.TemplateProjection> page = hasNext ? rows.subList(0, size) : rows;
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity,
                        templateSortValue(page.get(page.size() - 1), normalizedSortKey),
                        page.get(page.size() - 1).templateRef())
                : null;
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, page, List.of());
        List<TemplateRow> mapped =
                page.stream().map(projection -> templateRow(projection, facts)).toList();
        return new BusinessChannelReadback.TemplatePage(
                mapped.stream().map(BusinessChannelTemplateService::template).toList(), nextCursor, total);
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.VisibleStorePage pageTemplateVisibleStores(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            UUID projectRef,
            String storeStatusFilter,
            String cursor,
            int pageSize) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        if (projectRef == null) throw problem("VALIDATION_ERROR", 422, "projectRef is required");
        String filter = BusinessChannelPolicy.requireEnum(storeStatusFilter, "storeStatusFilter", "NON_VOIDED", "ALL");
        int size = pageSize(pageSize);
        verifyVisibleStoreTemplate(workspaceUuid, groupWorkspaceKey, templateRef, projectRef);
        String identity = cursorIdentity(
                "business-channel-template-visible-store-page",
                workspaceUuid,
                groupWorkspaceKey,
                templateRef,
                projectRef,
                filter,
                size);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        BusinessChannelTemplatePersistence.VisibleStorePageQuery queried = persistence.pageVisibleStores(
                templateRef,
                workspaceUuid,
                groupWorkspaceKey,
                projectRef,
                filter,
                position == null ? null : position.sortKey(),
                position == null ? null : position.tieBreaker(),
                size);
        List<BusinessChannelReadback.VisibleStore> rows = queried.rows();
        long total = queried.total();
        boolean hasNext = rows.size() > size;
        List<BusinessChannelReadback.VisibleStore> page = hasNext ? rows.subList(0, size) : rows;
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity,
                        Objects.toString(page.get(page.size() - 1).storeCode(), ""),
                        page.get(page.size() - 1).storeRef())
                : null;
        return new BusinessChannelReadback.VisibleStorePage(page, nextCursor, total);
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.Template readTemplate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        return template(readTemplateRow(workspaceUuid, groupWorkspaceKey, templateRef));
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.TemplateCommandContext readTemplateCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        return persistence
                .readTemplateCommandContext(workspaceUuid, groupWorkspaceKey, templateRef)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "template was not found in the workspace"));
    }

    @Transactional
    public BusinessChannelReadback.Template createTemplate(CreateTemplateCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        if (command.projectRef() == null) throw problem("VALIDATION_ERROR", 422, "projectRef is required");
        BusinessChannelPolicy.validateTemplate(
                command.accessKind(),
                command.operatorKind(),
                command.orderKind(),
                command.dineInForm(),
                command.providerCode(),
                providerFor(
                        command.accessKind(),
                        command.providerCode(),
                        command.workspaceUuid(),
                        command.groupWorkspaceKey()));
        BusinessChannelPolicy.required(command.templateName(), "templateName", 240);
        String templateCode = BusinessChannelPolicy.preserveTemplateCode(command.templateCode());
        String urlRule = normalizeUrlRule(
                command.urlRule(),
                command.accessKind(),
                command.operatorKind(),
                command.orderKind(),
                command.dineInForm());
        String storeVisibilityScope =
                normalizedStoreVisibilityScope(command.operatorKind(), command.storeVisibilityScope());
        List<UUID> visibleStoreRefs = BusinessChannelPolicy.validateAndNormalizeStoreVisibility(
                command.operatorKind(), storeVisibilityScope, command.visibleStoreRefs());
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                BusinessChannelPolicy.PROJECT,
                command.projectRef().toString(),
                REQ_CREATE_TEMPLATE);
        String request = canonical(
                "create-template",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.projectRef(),
                command.templateName(),
                templateCode,
                command.accessKind(),
                command.operatorKind(),
                command.orderKind(),
                command.dineInForm(),
                command.providerCode(),
                urlRule,
                storeVisibilityScope,
                visibleStoreRefs,
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "createOperationsBusinessChannelTemplate",
                request,
                BusinessChannelReadback.Template.class,
                () -> {
                    validateVisibleStoreMembership(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            command.projectRef(),
                            visibleStoreRefs);
                    UUID templateRef = UUID.randomUUID();
                    long now = time.currentEpochMillis();
                    try {
                        persistence.insertTemplate(
                                templateRef,
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.projectRef(),
                                command.templateName(),
                                templateCode,
                                command.accessKind(),
                                command.operatorKind(),
                                command.orderKind(),
                                command.dineInForm(),
                                command.providerCode(),
                                urlRule,
                                storeVisibilityScope,
                                now);
                    } catch (DuplicateKeyException failure) {
                        throw problem("DUPLICATE_CODE", 409, "templateCode is already used in the project", failure);
                    }
                    persistence.insertVisibleStoreRelations(templateRef, visibleStoreRefs);
                    audit(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            templateRef.toString(),
                            "TEMPLATE_CREATED",
                            command.actor(),
                            TEMPLATE_CREATED,
                            List.of(
                                    change("projectRef", null, command.projectRef()),
                                    change("templateName", null, command.templateName()),
                                    change("templateCode", null, templateCode),
                                    change("accessKind", null, command.accessKind()),
                                    change("operatorKind", null, command.operatorKind()),
                                    change("orderKind", null, command.orderKind()),
                                    change("dineInForm", null, command.dineInForm()),
                                    change("providerCode", null, command.providerCode()),
                                    change("urlRule", null, urlRule),
                                    change("storeVisibilityScope", null, storeVisibilityScope),
                                    change("visibleStoreRefs", null, visibleStoreRefs),
                                    change("status", null, BusinessChannelPolicy.ENABLED)));
                    return template(readTemplateRow(command.workspaceUuid(), command.groupWorkspaceKey(), templateRef));
                });
    }

    @Transactional
    public BusinessChannelReadback.Template updateTemplate(UpdateTemplateCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BusinessChannelPolicy.required(command.templateName(), "templateName", 240);
        if (command.templateRef() == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        List<UUID> canonicalVisibleStoreRefs =
                BusinessChannelPolicy.normalizeVisibleStoreRefs(command.visibleStoreRefs());
        requireOperationsGrantTargetEnvelope(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                BusinessChannelPolicy.PROJECT,
                REQ_UPDATE_TEMPLATE);
        String request = canonical(
                "update-template",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.templateRef(),
                command.templateName(),
                command.expectedVersion(),
                command.storeVisibilityScope(),
                command.urlRule(),
                canonicalVisibleStoreRefs,
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "updateOperationsBusinessChannelTemplate",
                request,
                BusinessChannelReadback.Template.class,
                () -> {
                    BusinessChannelTemplatePersistence.TemplateUpdateProjection current =
                            readTemplateProjectionForUpdate(
                                    command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
                    BusinessChannelTemplatePersistence.TemplateProjection currentProjection = current.projection();
                    // The locked template row is the authoritative relation between templateRef and projectRef. The
                    // server-minted grant is checked again after the lock before any version check or write.
                    requireOperationsGrant(
                            command.ownerScopeGrant(),
                            command.contextVersion(),
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            BusinessChannelPolicy.PROJECT,
                            currentProjection.projectRef().toString(),
                            REQ_UPDATE_TEMPLATE);
                    CollaborationReadback.Tree collaborationTree = BusinessChannelPolicy.EXTERNAL.equals(
                                    currentProjection.accessKind())
                            ? collaborationCatalog.readTree(command.workspaceUuid(), command.groupWorkspaceKey())
                            : null;
                    validateTemplateProvider(
                            new BusinessChannelTemplatePersistence.TemplateCommandProjection(
                                    currentProjection.projectRef(),
                                    currentProjection.accessKind(),
                                    currentProjection.operatorKind(),
                                    currentProjection.orderKind(),
                                    currentProjection.dineInForm(),
                                    currentProjection.providerCode(),
                                    currentProjection.storeVisibilityScope(),
                                    currentProjection.status(),
                                    false),
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            collaborationTree);
                    requireVersion(currentProjection.version(), command.expectedVersion());
                    requireMutable(currentProjection.status());
                    String storeVisibilityScope = normalizedStoreVisibilityScope(
                            currentProjection.operatorKind(), command.storeVisibilityScope());
                    String urlRule = normalizeUrlRule(
                            command.urlRule(),
                            currentProjection.accessKind(),
                            currentProjection.operatorKind(),
                            currentProjection.orderKind(),
                            currentProjection.dineInForm());
                    List<UUID> visibleStoreRefs = BusinessChannelPolicy.validateAndNormalizeStoreVisibility(
                            currentProjection.operatorKind(), storeVisibilityScope, command.visibleStoreRefs());
                    validateVisibleStoreMembership(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            currentProjection.projectRef(),
                            visibleStoreRefs);
                    BusinessChannelTemplatePersistence.TemplateProjection updated =
                            updateTemplateAndVisibleStoreRelations(
                                    command.workspaceUuid(),
                                    command.groupWorkspaceKey(),
                                    command.templateRef(),
                                    command.templateName(),
                                    storeVisibilityScope,
                                    urlRule,
                                    command.expectedVersion(),
                                    visibleStoreRefs);
                    audit(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            command.templateRef().toString(),
                            "TEMPLATE_UPDATED",
                            command.actor(),
                            TEMPLATE_UPDATED,
                            List.of(
                                    change("templateName", currentProjection.templateName(), command.templateName()),
                                    change(
                                            "storeVisibilityScope",
                                            currentProjection.storeVisibilityScope(),
                                            storeVisibilityScope),
                                    change("urlRule", currentProjection.urlRule(), urlRule),
                                    change("visibleStoreRefs", current.visibleStoreRefs(), visibleStoreRefs)));
                    StatusFacts facts = statusFacts(
                            command.workspaceUuid(), command.groupWorkspaceKey(), List.of(updated), List.of());
                    return template(templateRow(updated, facts));
                });
    }

    @Transactional
    public BusinessChannelReadback.Template transitionTemplateStatus(TransitionTemplateStatusCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        String targetStatus = BusinessChannelPolicy.requireEnum(
                command.status(),
                "status",
                BusinessChannelPolicy.ENABLED,
                BusinessChannelPolicy.DISABLED,
                BusinessChannelPolicy.VOIDED);
        requireOperationsGrantTargetEnvelope(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                BusinessChannelPolicy.PROJECT,
                REQ_TRANSITION_TEMPLATE);
        String request = canonical(
                "transition-template-status",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.templateRef(),
                targetStatus,
                command.expectedVersion(),
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "transitionOperationsBusinessChannelTemplateStatus",
                request,
                BusinessChannelReadback.Template.class,
                () -> {
                    TemplateRow current = readTemplateForUpdate(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
                    // The row locked here is the authoritative relation between templateRef and projectRef. The
                    // server-minted grant is checked again after the lock so a stale/mis-bound target cannot write.
                    requireOperationsGrant(
                            command.ownerScopeGrant(),
                            command.contextVersion(),
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            BusinessChannelPolicy.PROJECT,
                            current.projectRef().toString(),
                            REQ_TRANSITION_TEMPLATE);
                    requireVersion(current.version(), command.expectedVersion());
                    requireMutable(current.status());
                    TemplateRow result = current;
                    if (!Objects.equals(current.status(), targetStatus)) {
                        long now = time.currentEpochMillis();
                        if (persistence.transitionTemplate(
                                        command.templateRef(),
                                        command.workspaceUuid(),
                                        command.groupWorkspaceKey(),
                                        targetStatus,
                                        now,
                                        command.expectedVersion())
                                != 1) throw problem("VERSION_CONFLICT", 409, "template version has changed");
                        audit(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.templateRef().toString(),
                                "STATUS_CHANGED",
                                command.actor(),
                                TEMPLATE_STATUS,
                                List.of(change("status", current.status(), targetStatus)));
                        result = templateAfterStatusTransition(current, targetStatus);
                    }
                    return template(result);
                });
    }

    private CollaborationReadback.ProviderProfile providerFor(
            String accessKind, String providerCode, UUID workspaceUuid, String groupWorkspaceKey) {
        if (!BusinessChannelPolicy.EXTERNAL.equals(accessKind)) return null;
        return collaborationCatalog.readProviderProfile(workspaceUuid, groupWorkspaceKey, providerCode);
    }

    private void validateTemplateProvider(
            BusinessChannelTemplatePersistence.TemplateCommandProjection template,
            UUID workspaceUuid,
            String groupWorkspaceKey) {
        validateTemplateProvider(template, workspaceUuid, groupWorkspaceKey, null);
    }

    private void validateTemplateProvider(
            BusinessChannelTemplatePersistence.TemplateCommandProjection template,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            CollaborationReadback.Tree preloadedTree) {
        BusinessChannelPolicy.validateTemplate(
                template.accessKind(),
                template.operatorKind(),
                template.orderKind(),
                template.dineInForm(),
                template.providerCode(),
                preloadedTree == null
                        ? providerFor(template.accessKind(), template.providerCode(), workspaceUuid, groupWorkspaceKey)
                        : providerFromTree(preloadedTree, template.providerCode()));
    }

    private static CollaborationReadback.ProviderProfile providerFromTree(
            CollaborationReadback.Tree tree, String providerCode) {
        if (tree == null || providerCode == null) return null;
        return tree.providerProfiles().stream()
                .filter(provider -> Objects.equals(provider.providerCode(), providerCode))
                .findFirst()
                .orElse(null);
    }

    private void requireOperationsGrant(
            OperationsOwnerScopeGrant grant,
            long contextVersion,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            String nodeRef,
            String requirementId) {
        String capability = BusinessChannelPolicy.PROJECT.equals(nodeType)
                ? "BC-BUSINESS-CHANNEL-PROJECT-EDIT"
                : "BC-BUSINESS-CHANNEL-STORE-EDIT";
        UUID targetId;
        try {
            targetId = UUID.fromString(BusinessChannelPolicy.required(nodeRef, "ownerNodeRef", 240));
        } catch (IllegalArgumentException failure) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations target reference is not server-resolved", failure);
        }
        if (!grant.matchesExpectedContextVersion(contextVersion)
                || !grant.matchesRequirementAndCapability(
                        workspaceUuid, groupWorkspaceKey, nodeType, targetId, requirementId, capability)) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations owner grant does not match command context");
        }
    }

    private void requireOperationsGrantTargetEnvelope(
            OperationsOwnerScopeGrant grant,
            long contextVersion,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String expectedTargetType,
            String requirementId) {
        if (grant == null || grant.targetId() == null) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations owner grant does not match command context");
        }
        String targetType = grant.targetType();
        if (expectedTargetType != null && !Objects.equals(expectedTargetType, targetType)) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations owner grant does not match command context");
        }
        if (expectedTargetType == null
                && !BusinessChannelPolicy.PROJECT.equals(targetType)
                && !BusinessChannelPolicy.STORE.equals(targetType)) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations owner grant does not match command context");
        }
        requireOperationsGrant(
                grant,
                contextVersion,
                workspaceUuid,
                groupWorkspaceKey,
                targetType,
                grant.targetId().toString(),
                requirementId);
    }

    private static TemplateRow templateAfterStatusTransition(TemplateRow current, String targetStatus) {
        return new TemplateRow(
                current.templateRef(),
                current.projectRef(),
                current.templateName(),
                current.templateCode(),
                current.accessKind(),
                current.operatorKind(),
                current.orderKind(),
                current.dineInForm(),
                current.providerCode(),
                current.urlRule(),
                current.storeVisibilityScope(),
                current.visibleStoreCount(),
                targetStatus,
                current.statusDimensions(),
                current.blockers(),
                current.version() + 1);
    }

    private TemplateRow readTemplateRow(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        BusinessChannelTemplatePersistence.TemplateProjection projection = persistence
                .readTemplate(workspaceUuid, groupWorkspaceKey, templateRef, false)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "template was not found in the workspace"));
        return templateRow(projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection), List.of()));
    }

    private TemplateRow readTemplateForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        BusinessChannelTemplatePersistence.TemplateProjection projection = persistence
                .readTemplate(workspaceUuid, groupWorkspaceKey, templateRef, true)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "template was not found in the workspace"));
        return templateRow(projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection), List.of()));
    }

    private BusinessChannelTemplatePersistence.TemplateUpdateProjection readTemplateProjectionForUpdate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return persistence
                .readTemplateForUpdate(workspaceUuid, groupWorkspaceKey, templateRef)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "template was not found in the workspace"));
    }

    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<BusinessChannelTemplatePersistence.TemplateProjection> templates,
            List<ChannelProjection> channels) {
        return statusFacts(workspaceUuid, groupWorkspaceKey, templates, channels, null);
    }

    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<BusinessChannelTemplatePersistence.TemplateProjection> templates,
            List<ChannelProjection> channels,
            CollaborationReadback.Tree preloadedTree) {
        String workspaceStatus = workspaceStatuses.requireStatus(workspaceUuid, groupWorkspaceKey);
        LinkedHashSet<UUID> organizationRefs = new LinkedHashSet<>();
        for (BusinessChannelTemplatePersistence.TemplateProjection template : templates) {
            addRef(organizationRefs, template.projectRef());
        }
        boolean needsCollaborationTree = false;
        for (ChannelProjection channel : channels) {
            addRef(organizationRefs, channel.templateProjectRef());
            addRef(organizationRefs, channel.targetProjectRef());
            addRef(organizationRefs, channel.targetStoreProjectRef());
            if (BusinessChannelPolicy.EXTERNAL.equals(channel.templateAccessKind())
                    && channel.templateProviderCode() != null
                    && !channel.templateProviderCode().isBlank()) {
                needsCollaborationTree = true;
            }
        }
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors =
                readOrganizationAncestors(workspaceUuid, groupWorkspaceKey, organizationRefs);
        Map<String, CollaborationReadback.ProviderProfile> providers = new HashMap<>();
        Map<String, CollaborationReadback.ExternalSystem> externalSystems = new HashMap<>();
        if (needsCollaborationTree) {
            CollaborationReadback.Tree tree = preloadedTree == null
                    ? collaborationCatalog.readTree(workspaceUuid, groupWorkspaceKey)
                    : preloadedTree;
            if (tree != null) {
                for (CollaborationReadback.ProviderProfile provider : tree.providerProfiles()) {
                    providers.put(provider.providerCode(), provider);
                }
                for (CollaborationReadback.ExternalSystem externalSystem : tree.externalSystems()) {
                    externalSystems.put(externalSystem.externalSystemCode(), externalSystem);
                }
            }
        }
        return new StatusFacts(workspaceStatus, ancestors, providers, externalSystems);
    }

    private static void addRef(Set<UUID> refs, UUID ref) {
        if (ref != null) refs.add(ref);
    }

    private TemplateRow templateRow(
            BusinessChannelTemplatePersistence.TemplateProjection projection, StatusFacts facts) {
        List<BusinessChannelReadback.StatusDimension> dimensions = new ArrayList<>();
        addDimension(dimensions, "ORGANIZATION_PROJECT", projection.projectRef(), projection.projectStatus());
        addWorkspaceDimension(dimensions, projection.groupWorkspaceKey(), facts);
        appendOrganizationAncestors(dimensions, facts, projection.projectRef());
        List<BusinessChannelReadback.StatusDimension> blockers = dimensions.stream()
                .filter(BusinessChannelTemplateService::isBlocker)
                .toList();
        return new TemplateRow(
                projection.templateRef(),
                projection.projectRef(),
                projection.templateName(),
                projection.templateCode(),
                projection.accessKind(),
                projection.operatorKind(),
                projection.orderKind(),
                projection.dineInForm(),
                projection.providerCode(),
                projection.urlRule(),
                projection.storeVisibilityScope(),
                projection.visibleStoreCount(),
                projection.status(),
                dimensions,
                blockers,
                projection.version());
    }

    private Map<UUID, List<BusinessChannelReadback.StatusDimension>> readOrganizationAncestors(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> nodeRefs) {
        return persistence.readOrganizationAncestors(workspaceUuid, groupWorkspaceKey, nodeRefs);
    }

    private static void appendOrganizationAncestors(
            List<BusinessChannelReadback.StatusDimension> dimensions, StatusFacts facts, UUID nodeRef) {
        if (nodeRef == null) return;
        for (BusinessChannelReadback.StatusDimension dimension : facts.organizationAncestors(nodeRef)) {
            addDimension(dimensions, dimension.type(), dimension.ref(), dimension.status());
        }
    }

    private static void addDimension(
            List<BusinessChannelReadback.StatusDimension> dimensions, String type, UUID ref, String status) {
        if (ref != null && status != null) {
            addDimension(dimensions, type, ref.toString(), status);
        }
    }

    private static void addDimension(
            List<BusinessChannelReadback.StatusDimension> dimensions, String type, String ref, String status) {
        if (ref == null || ref.isBlank() || status == null || status.isBlank()) return;
        boolean duplicate = dimensions.stream()
                .anyMatch(existing ->
                        existing.type().equals(type) && existing.ref().equals(ref));
        if (!duplicate) dimensions.add(new BusinessChannelReadback.StatusDimension(type, ref, status));
    }

    private void addWorkspaceDimension(
            List<BusinessChannelReadback.StatusDimension> dimensions, String groupWorkspaceKey, StatusFacts facts) {
        addDimension(dimensions, "GROUP_WORKSPACE", groupWorkspaceKey, facts.workspaceStatus());
    }

    private static boolean isBlocker(BusinessChannelReadback.StatusDimension dimension) {
        return !"COLLABORATION_BINDING".equals(dimension.type())
                && !BusinessChannelPolicy.ENABLED.equals(dimension.status());
    }

    private void verifyVisibleStoreTemplate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, UUID projectRef) {
        BusinessChannelTemplatePersistence.VisibleStoreTemplate template = persistence
                .verifyVisibleStoreTemplate(workspaceUuid, groupWorkspaceKey, templateRef)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "template was not found in the workspace"));
        if (!BusinessChannelPolicy.STORE.equals(template.operatorKind())) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "only store-owned templates have visible stores");
        }
        if (!Objects.equals(template.projectRef(), projectRef)) {
            throw problem("BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT", 422, "template is outside the requested project");
        }
    }

    private void validateVisibleStoreMembership(
            UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, List<UUID> visibleStoreRefs) {
        if (visibleStoreRefs.isEmpty()) return;
        Map<UUID, UUID> projectRefsByStore = organizationTaskPaths.requireStoreProjectMemberships(
                workspaceUuid, groupWorkspaceKey, visibleStoreRefs);
        if (projectRefsByStore == null)
            throw problem(
                    "BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT", 422, "visible store is outside the template project");
        for (UUID storeRef : visibleStoreRefs) {
            UUID actualProjectRef = projectRefsByStore.get(storeRef);
            if (actualProjectRef == null)
                throw problem(
                        "BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT", 422, "visible store is outside the template project");
            if (!Objects.equals(projectRef, actualProjectRef)) {
                throw problem(
                        "BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT", 422, "visible store is outside the template project");
            }
        }
    }

    private void requireEnabledStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        String status = organizationOwner
                .requireSalesMenuStore(workspaceUuid, groupWorkspaceKey, storeRef)
                .status();
        if (!BusinessChannelPolicy.ENABLED.equals(status)) {
            throw problem(
                    "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE", 409, "store is not enabled for new business channels");
        }
    }

    void requireStoreChannelCreateEligibility(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            UUID projectRef,
            String storeVisibilityScope,
            UUID storeRef) {
        requireEnabledStore(workspaceUuid, groupWorkspaceKey, storeRef);
        validateVisibleStoreMembership(workspaceUuid, groupWorkspaceKey, projectRef, List.of(storeRef));
        if (BusinessChannelPolicy.SELECTED_PROJECT_STORES.equals(storeVisibilityScope)
                && !persistence.visibleStoreRelationExists(templateRef, storeRef)) {
            throw problem(
                    "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE",
                    409,
                    "store is no longer visible for this business channel template");
        }
        if (!BusinessChannelPolicy.ALL_PROJECT_STORES.equals(storeVisibilityScope)
                && !BusinessChannelPolicy.SELECTED_PROJECT_STORES.equals(storeVisibilityScope)) {
            throw problem(
                    "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE",
                    409,
                    "business channel template store visibility is invalid");
        }
    }

    private BusinessChannelTemplatePersistence.TemplateProjection updateTemplateAndVisibleStoreRelations(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            String templateName,
            String storeVisibilityScope,
            String urlRule,
            long expectedVersion,
            List<UUID> visibleStoreRefs) {
        return persistence
                .updateTemplateAndVisibleStoreRelations(
                        workspaceUuid,
                        groupWorkspaceKey,
                        templateRef,
                        templateName,
                        storeVisibilityScope,
                        urlRule,
                        expectedVersion,
                        visibleStoreRefs,
                        time.currentEpochMillis())
                .orElseThrow(() -> problem("VERSION_CONFLICT", 409, "template version has changed"));
    }

    private static String normalizedStoreVisibilityScope(String operatorKind, String storeVisibilityScope) {
        return BusinessChannelPolicy.STORE.equals(operatorKind)
                ? BusinessChannelPolicy.requireStoreVisibilityScope(storeVisibilityScope)
                : storeVisibilityScope;
    }

    private static String normalizeUrlRule(
            String urlRule, String accessKind, String operatorKind, String orderKind, String dineInForm) {
        String normalized = urlRule == null || urlRule.isBlank() ? null : urlRule.trim();
        boolean target = BusinessChannelPolicy.INTERNAL.equals(accessKind)
                && BusinessChannelPolicy.STORE.equals(operatorKind)
                && BusinessChannelPolicy.DINE_IN.equals(orderKind)
                && "QR".equals(dineInForm);
        if (!target && normalized != null) {
            throw problem("VALIDATION_ERROR", 422, "urlRule is only supported for internal store QR dine-in templates");
        }
        if (normalized != null && normalized.length() > 2000) {
            throw problem("VALIDATION_ERROR", 422, "urlRule is too long");
        }
        return normalized;
    }

    private static UUID parseUuid(String value, String field) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException failure) {
            throw problem("VALIDATION_ERROR", 422, field + " is invalid", failure);
        }
    }

    private static OpaqueCollectionCursor.Position decodeCursor(String cursor, String identity) {
        try {
            return OpaqueCollectionCursor.decode(cursor, identity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
    }

    private static int pageSize(int requested) {
        int value = requested == 0 ? DEFAULT_PAGE_SIZE : requested;
        if (value < 1 || value > MAX_PAGE_SIZE) throw problem("VALIDATION_ERROR", 422, "pageSize is invalid");
        return value;
    }

    private static String optionalEnum(String value, String name, String... allowed) {
        if (value == null) return null;
        return BusinessChannelPolicy.requireEnum(value, name, allowed);
    }

    private static String templateSortValue(BusinessChannelTemplatePersistence.TemplateProjection row, String sortKey) {
        if (sortKey == null) return row.templateRef().toString();
        return switch (sortKey) {
            case "TEMPLATE_NAME" -> Objects.toString(row.templateName(), "");
            case "TEMPLATE_CODE" -> Objects.toString(row.templateCode(), "");
            case "ACCESS_KIND" -> row.accessKind();
            case "OPERATOR_KIND" -> row.operatorKind();
            case "ORDER_KIND" -> row.orderKind();
            case "STATUS" -> row.status();
            default -> throw problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
    }

    private static void requireScope(UUID workspaceUuid, String groupWorkspaceKey) {
        if (workspaceUuid == null) throw problem("VALIDATION_ERROR", 422, "workspaceUuid is required");
        BusinessChannelPolicy.required(groupWorkspaceKey, "groupWorkspaceKey", 120);
    }

    private static void requireVersion(long actual, long expected) {
        if (expected < 1 || actual != expected) throw problem("VERSION_CONFLICT", 409, "version has changed");
    }

    private static void requireMutable(String status) {
        if (BusinessChannelPolicy.VOIDED.equals(status)) {
            throw problem("VOIDED_RECORD_IMMUTABLE", 409, "该业务渠道已作废，不能继续修改");
        }
    }

    private static BusinessChannelReadback.Template template(TemplateRow row) {
        return new BusinessChannelReadback.Template(
                row.templateRef(),
                row.projectRef(),
                row.templateName(),
                row.templateCode(),
                row.accessKind(),
                row.operatorKind(),
                row.orderKind(),
                row.dineInForm(),
                row.providerCode(),
                row.urlRule(),
                row.storeVisibilityScope(),
                row.visibleStoreCount(),
                row.status(),
                row.statusDimensions(),
                row.blockers(),
                row.version());
    }

    private static AuditChange change(String field, Object before, Object after) {
        return AuditChange.forNullableScalar(
                field, before == null ? null : before.toString(), after == null ? null : after.toString());
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityRef,
            String action,
            AuditActor actor,
            AuditChangePolicy policy,
            List<AuditChange> changes) {
        persistence.recordAudit(
                workspaceUuid,
                groupWorkspaceKey,
                entityRef,
                action,
                actor,
                policy.entityType(),
                AuditChangeJson.write(policy.allow(changes)),
                time.currentEpochMillis());
    }

    private static String canonical(String operation, Object... values) {
        return operation + "\u001f"
                + Arrays.stream(values)
                        .map(value -> Objects.toString(value, "<null>"))
                        .collect(Collectors.joining("\u001f"));
    }

    private static String cursorIdentity(String operation, Object... values) {
        String[] components = new String[values.length + 1];
        components[0] = operation;
        for (int index = 0; index < values.length; index++) {
            components[index + 1] = values[index] == null ? null : values[index].toString();
        }
        return CanonicalCursorIdentity.encode(components);
    }

    private static <T> T notFound(String resource) {
        throw problem("NOT_FOUND", 404, resource + " was not found in the workspace");
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message) {
        return new BusinessChannelCommandApi.Problem(code, status, message);
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new BusinessChannelCommandApi.Problem(code, status, message, cause);
    }

    private record StatusFacts(
            String workspaceStatus,
            Map<UUID, List<BusinessChannelReadback.StatusDimension>> organizationAncestors,
            Map<String, CollaborationReadback.ProviderProfile> providers,
            Map<String, CollaborationReadback.ExternalSystem> externalSystems) {
        List<BusinessChannelReadback.StatusDimension> organizationAncestors(UUID nodeRef) {
            return organizationAncestors.getOrDefault(nodeRef, List.of());
        }

        CollaborationReadback.ProviderProfile provider(String providerCode) {
            return providers.get(providerCode);
        }

        CollaborationReadback.ExternalSystem externalSystem(String externalSystemCode) {
            return externalSystems.get(externalSystemCode);
        }
    }

    private record TemplateRow(
            UUID templateRef,
            UUID projectRef,
            String templateName,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String urlRule,
            String storeVisibilityScope,
            long visibleStoreCount,
            String status,
            List<BusinessChannelReadback.StatusDimension> statusDimensions,
            List<BusinessChannelReadback.StatusDimension> blockers,
            long version) {}

    private record ChannelRow(
            UUID channelRef,
            UUID templateRef,
            String ownerNodeType,
            String ownerNodeRef,
            String channelCode,
            String channelName,
            UUID bindingRef,
            String bindingStatus,
            String status,
            List<BusinessChannelReadback.StatusDimension> statusDimensions,
            List<BusinessChannelReadback.StatusDimension> blockers,
            long version) {}

    private record CommandChannelRow(ChannelRow channel, TemplateRow template) {}
}
