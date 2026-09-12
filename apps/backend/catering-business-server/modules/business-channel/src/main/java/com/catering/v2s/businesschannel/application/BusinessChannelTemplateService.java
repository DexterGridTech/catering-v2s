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
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
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
                    "storeVisibilityScope",
                    "visibleStoreRefs",
                    "status"));
    private static final AuditChangePolicy TEMPLATE_UPDATED = new AuditChangePolicy(
            "BUSINESS_CHANNEL_TEMPLATE",
            "TEMPLATE_UPDATED",
            java.util.Set.of("templateName", "storeVisibilityScope", "visibleStoreRefs"));
    private static final AuditChangePolicy TEMPLATE_STATUS =
            new AuditChangePolicy("BUSINESS_CHANNEL_TEMPLATE", "STATUS_CHANGED", java.util.Set.of("status"));
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final CollaborationBindingReadApi collaborationBindings;
    private final WorkspaceStatusLookup workspaceStatuses;
    private final BusinessChannelCommandReceiptService receipts;
    private final OrganizationOwnerApi organizationOwner;
    private final OrganizationTaskPathLookup organizationTaskPaths;

    @Autowired
    public BusinessChannelTemplateService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            OrganizationOwnerApi organizationOwner,
            OrganizationTaskPathLookup organizationTaskPaths) {
        this.jdbc = jdbc;
        this.time = time;
        this.collaborationCatalog = collaborationCatalog;
        this.collaborationBindings = collaborationBindings;
        this.workspaceStatuses = workspaceStatuses;
        this.receipts = receipts;
        this.organizationOwner = Objects.requireNonNull(organizationOwner, "organizationOwner");
        this.organizationTaskPaths = Objects.requireNonNull(organizationTaskPaths, "organizationTaskPaths");
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
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey));
        StringBuilder predicate = new StringBuilder(" WHERE workspace_uuid=? AND group_workspace_key=?");
        if (projectRef != null) {
            predicate.append(" AND project_ref=?");
            arguments.add(projectRef);
        }
        if (normalizedStatus != null) {
            predicate.append(" AND status=?");
            arguments.add(normalizedStatus);
        }
        if (normalizedOperator != null) {
            predicate.append(" AND operator_kind=?");
            arguments.add(normalizedOperator);
        }
        List<TemplateProjection> projections = query(
                templateSelect(predicate
                        + " ORDER BY "
                        + templateOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?"),
                append(arguments, BusinessChannelQuerySupport.BOUNDED_READ_LIMIT + 1),
                this::mapTemplateProjection);
        if (projections.size() > BusinessChannelQuerySupport.BOUNDED_READ_LIMIT) {
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
        String identity = canonical(
                "store-template-candidate-page",
                workspaceUuid,
                groupWorkspaceKey,
                projectRef,
                normalizedStoreRef,
                size,
                normalizedSortKey,
                normalizedSortDirection);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, projectRef, storeId));
        StringBuilder predicate =
                new StringBuilder(" WHERE t.workspace_uuid=? AND t.group_workspace_key=? AND t.project_ref=? "
                        + "AND t.operator_kind='STORE' AND t.status='ENABLED' AND ("
                        + "t.store_visibility_scope='ALL_PROJECT_STORES' OR ("
                        + "t.store_visibility_scope='SELECTED_PROJECT_STORES' AND EXISTS ("
                        + "SELECT 1 FROM business_channel.business_channel_template_store_visibility v "
                        + "WHERE v.template_ref=t.template_ref AND v.store_ref=?)))");
        String countPredicate = predicate.toString();
        List<Object> countArguments = List.copyOf(arguments);
        if (position != null) {
            if (normalizedSortKey == null) {
                predicate.append(" AND template_ref > ?");
                arguments.add(position.tieBreaker());
            } else {
                String expression = templateSortExpression(normalizedSortKey);
                String comparison = "DESC".equals(normalizedSortDirection) ? "<" : ">";
                predicate
                        .append(" AND (")
                        .append(expression)
                        .append(' ')
                        .append(comparison)
                        .append(" ? OR (")
                        .append(expression)
                        .append(" = ? AND template_ref > ?))");
                arguments.add(position.sortKey());
                arguments.add(position.sortKey());
                arguments.add(position.tieBreaker());
            }
        }
        long total = count(
                "SELECT count(*) FROM business_channel.business_channel_template t" + countPredicate, countArguments);
        List<TemplateProjection> rows = query(
                templateSelect(predicate
                        + " ORDER BY "
                        + templateOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?"),
                append(arguments, size + 1),
                this::mapTemplateProjection);
        boolean hasNext = rows.size() > size;
        List<TemplateProjection> page = hasNext ? rows.subList(0, size) : rows;
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
        String identity = canonical(
                "business-channel-template-visible-store-page",
                workspaceUuid,
                groupWorkspaceKey,
                templateRef,
                projectRef,
                filter,
                size);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        List<Object> arguments = new ArrayList<>(List.of(templateRef, workspaceUuid, groupWorkspaceKey, projectRef));
        StringBuilder predicate = new StringBuilder(
                " WHERE v.template_ref=? AND t.workspace_uuid=? AND t.group_workspace_key=? "
                        + "AND t.project_ref=? AND t.operator_kind='STORE' "
                        + "AND s.id=v.store_ref AND s.workspace_uuid=t.workspace_uuid "
                        + "AND s.group_workspace_key=t.group_workspace_key AND s.project_id=t.project_ref");
        if ("NON_VOIDED".equals(filter)) predicate.append(" AND s.status <> 'VOIDED'");
        String countPredicate = predicate.toString();
        List<Object> countArguments = List.copyOf(arguments);
        if (position != null) {
            predicate.append(
                    " AND (COALESCE(s.code,'') > ? OR (COALESCE(s.code,'') = ? "
                            + "AND v.store_ref > CAST(? AS uuid)))");
            arguments.add(position.sortKey());
            arguments.add(position.sortKey());
            arguments.add(position.tieBreaker());
        }
        String from = " FROM business_channel.business_channel_template_store_visibility v "
                + "JOIN business_channel.business_channel_template t ON t.template_ref=v.template_ref "
                + "JOIN organization.store s ON s.id=v.store_ref";
        long total = count("SELECT count(*)" + from + countPredicate, countArguments);
        List<BusinessChannelReadback.VisibleStore> rows = query(
                "SELECT v.store_ref, s.code AS store_code, s.name AS store_name, s.status AS store_status"
                        + from
                        + predicate
                        + " ORDER BY COALESCE(s.code,''), v.store_ref LIMIT ?",
                append(arguments, size + 1),
                (result, rowNumber) -> new BusinessChannelReadback.VisibleStore(
                        result.getObject("store_ref", UUID.class),
                        result.getString("store_code"),
                        result.getString("store_name"),
                        result.getString("store_status")));
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
        return jdbc.query(
                "SELECT template_ref, project_ref FROM business_channel.business_channel_template "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> {
                    if (!result.next()) return notFound("template");
                    return new BusinessChannelReadback.TemplateCommandContext(
                            result.getObject("template_ref", UUID.class), result.getObject("project_ref", UUID.class));
                });
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
                        jdbc.update(
                                "INSERT INTO business_channel.business_channel_template "
                                        + "(template_ref, workspace_uuid, group_workspace_key, project_ref, templat"
                                        + "e_name, template_code, "
                                        + "access_kind, operator_kind, order_kind, dine_in_form, provider_code, "
                                        + "store_visibility_scope, status, "
                                        + "version, created_at_epoch_millis, updated_at_epoch_millis) "
                                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
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
                                storeVisibilityScope,
                                now,
                                now);
                    } catch (DuplicateKeyException failure) {
                        throw problem("DUPLICATE_CODE", 409, "templateCode is already used in the project", failure);
                    }
                    insertVisibleStoreRelations(templateRef, visibleStoreRefs);
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
                    TemplateUpdateProjection current = readTemplateProjectionForUpdate(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
                    TemplateProjection currentProjection = current.projection();
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
                            new TemplateCommandProjection(
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
                    List<UUID> visibleStoreRefs = BusinessChannelPolicy.validateAndNormalizeStoreVisibility(
                            currentProjection.operatorKind(), storeVisibilityScope, command.visibleStoreRefs());
                    validateVisibleStoreMembership(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            currentProjection.projectRef(),
                            visibleStoreRefs);
                    TemplateProjection updated = updateTemplateAndVisibleStoreRelations(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            command.templateRef(),
                            command.templateName(),
                            storeVisibilityScope,
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
                        if (jdbc.update(
                                        "UPDATE business_channel.business_channel_template SET status=?, "
                                                + "version=version+1, updated_at_epoch_millis=? WHERE template_ref=? "
                                                + "AND workspace_uuid=? AND group_workspace_key=? AND version=?",
                                        targetStatus,
                                        now,
                                        command.templateRef(),
                                        command.workspaceUuid(),
                                        command.groupWorkspaceKey(),
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
            TemplateCommandProjection template, UUID workspaceUuid, String groupWorkspaceKey) {
        validateTemplateProvider(template, workspaceUuid, groupWorkspaceKey, null);
    }



    private void validateTemplateProvider(
            TemplateCommandProjection template,
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
                current.storeVisibilityScope(),
                current.visibleStoreCount(),
                targetStatus,
                current.statusDimensions(),
                current.blockers(),
                current.version() + 1);
    }



    private TemplateRow readTemplateRow(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        return jdbc.query(
                templateSelect("WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=?"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> {
                    if (!result.next()) return notFound("template");
                    TemplateProjection projection = mapTemplateProjection(result);
                    return templateRow(
                            projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection), List.of()));
                });
    }



    private TemplateRow readTemplateForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return jdbc.query(
                templateSelect("WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=? FOR UPDATE"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> {
                    if (!result.next()) return notFound("template");
                    TemplateProjection projection = mapTemplateProjection(result);
                    return templateRow(
                            projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection), List.of()));
                });
    }



    private TemplateUpdateProjection readTemplateProjectionForUpdate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return jdbc.query(
                templateSelectForUpdate(
                        "WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=? FOR UPDATE"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> {
                    if (!result.next()) return notFound("template");
                    return new TemplateUpdateProjection(
                            mapTemplateProjection(result), uuidList(result, "visible_store_refs"));
                });
    }



    private static String templateSelect(String suffix) {
        return templateSelect(suffix, false);
    }



    private static String templateSelectForUpdate(String suffix) {
        return templateSelect(suffix, true);
    }



    private static String templateSelect(String suffix, boolean includeVisibleStoreRefs) {
        return "SELECT t.workspace_uuid, t.group_workspace_key, t.template_ref, t.project_ref, t.template_name, "
                + "t.template_code, t.access_kind, t.operator_kind, t.order_kind, t.dine_in_form, t.provider_code, "
                + "t.store_visibility_scope, t.status, t.version, (SELECT count(*) FROM "
                + "business_channel.business_channel_template_store_visibility v "
                + "JOIN organization.store visible_store ON visible_store.id=v.store_ref "
                + "AND visible_store.workspace_uuid=t.workspace_uuid "
                + "AND visible_store.group_workspace_key=t.group_workspace_key "
                + "AND visible_store.project_id=t.project_ref "
                + "WHERE v.template_ref=t.template_ref AND visible_store.status <> 'VOIDED') AS visible_store_count, "
                + (includeVisibleStoreRefs
                        ? "COALESCE((SELECT array_agg(v.store_ref ORDER BY v.store_ref) FROM "
                                + "business_channel.business_channel_template_store_visibility v "
                                + "WHERE v.template_ref=t.template_ref), ARRAY[]::uuid[]) AS visible_store_refs, "
                        : "")
                + "(SELECT project.status FROM organization.organization_node project "
                + "WHERE project.id=t.project_ref AND project.workspace_uuid=t.workspace_uuid "
                + "AND project.group_workspace_key=t.group_workspace_key) AS project_status "
                + "FROM business_channel.business_channel_template t "
                + suffix;
    }



    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<TemplateProjection> templates,
            List<ChannelProjection> channels) {
        return statusFacts(workspaceUuid, groupWorkspaceKey, templates, channels, null);
    }



    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<TemplateProjection> templates,
            List<ChannelProjection> channels,
            CollaborationReadback.Tree preloadedTree) {
        String workspaceStatus = workspaceStatuses.requireStatus(workspaceUuid, groupWorkspaceKey);
        LinkedHashSet<UUID> organizationRefs = new LinkedHashSet<>();
        for (TemplateProjection template : templates) {
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



    private TemplateProjection mapTemplateProjection(ResultSet result, int rowNumber) throws SQLException {
        return mapTemplateProjection(result);
    }



    private TemplateProjection mapTemplateProjection(ResultSet result) throws SQLException {
        return new TemplateProjection(
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("template_ref", UUID.class),
                result.getObject("project_ref", UUID.class),
                result.getString("template_name"),
                result.getString("template_code"),
                result.getString("access_kind"),
                result.getString("operator_kind"),
                result.getString("order_kind"),
                result.getString("dine_in_form"),
                result.getString("provider_code"),
                result.getString("store_visibility_scope"),
                result.getString("status"),
                result.getString("project_status"),
                result.getLong("visible_store_count"),
                result.getLong("version"));
    }



    private static List<UUID> uuidList(ResultSet result, String column) throws SQLException {
        java.sql.Array array = result.getArray(column);
        if (array == null) return List.of();
        Object[] values = (Object[]) array.getArray();
        List<UUID> refs = new ArrayList<>(values.length);
        for (Object value : values) refs.add(value instanceof UUID ? (UUID) value : UUID.fromString(value.toString()));
        return List.copyOf(refs);
    }



    private TemplateRow templateRow(TemplateProjection projection, StatusFacts facts) {
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
                projection.storeVisibilityScope(),
                projection.visibleStoreCount(),
                projection.status(),
                dimensions,
                blockers,
                projection.version());
    }



    private Map<UUID, List<BusinessChannelReadback.StatusDimension>> readOrganizationAncestors(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> nodeRefs) {
        if (workspaceUuid == null || groupWorkspaceKey == null || nodeRefs == null || nodeRefs.isEmpty()) {
            return Map.of();
        }
        List<UUID> refs = new ArrayList<>(nodeRefs);
        String placeholders = refs.stream().map(ignored -> "?").collect(Collectors.joining(", "));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors = new LinkedHashMap<>();
        jdbc.query(
                "WITH RECURSIVE ancestry AS ("
                        + "SELECT id AS source_ref, id, parent_id, node_type, status, 0 AS depth "
                        + "FROM organization.organization_node "
                        + "WHERE id IN ("
                        + placeholders
                        + ") AND workspace_uuid=? AND group_workspace_key=? "
                        + "UNION ALL SELECT child.source_ref, parent.id, parent.parent_id, "
                        + "parent.node_type, parent.status, child.depth+1 "
                        + "FROM organization.organization_node parent JOIN ancestry child ON parent.id=child.parent_id "
                        + "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=? ) "
                        + "SELECT source_ref, node_type, id, status FROM ancestry ORDER BY source_ref, depth DESC",
                statement -> bind(statement, arguments),
                result -> {
                    while (result.next()) {
                        UUID sourceRef = result.getObject("source_ref", UUID.class);
                        ancestors
                                .computeIfAbsent(sourceRef, ignored -> new ArrayList<>())
                                .add(new BusinessChannelReadback.StatusDimension(
                                        "ORGANIZATION_" + result.getString("node_type"),
                                        result.getObject("id", UUID.class).toString(),
                                        result.getString("status")));
                    }
                    return null;
                });
        return ancestors;
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
        jdbc.query(
                "SELECT project_ref, operator_kind FROM business_channel.business_channel_template "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> {
                    if (!result.next()) return notFound("template");
                    UUID actualProjectRef = result.getObject("project_ref", UUID.class);
                    String operatorKind = result.getString("operator_kind");
                    if (!BusinessChannelPolicy.STORE.equals(operatorKind)) {
                        throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "only store-owned templates have visible stores");
                    }
                    if (!Objects.equals(actualProjectRef, projectRef)) {
                        throw problem(
                                "BUSINESS_CHANNEL_STORE_NOT_IN_PROJECT",
                                422,
                                "template is outside the requested project");
                    }
                    return null;
                });
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
                && count(
                                "SELECT count(*) FROM business_channel.business_channel_template_store_visibility "
                                        + "WHERE template_ref=? AND store_ref=?",
                                List.of(templateRef, storeRef))
                        == 0) {
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



    private TemplateProjection updateTemplateAndVisibleStoreRelations(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            String templateName,
            String storeVisibilityScope,
            long expectedVersion,
            List<UUID> visibleStoreRefs) {
        String relationRows = visibleStoreRefs.isEmpty()
                ? "SELECT NULL::uuid AS store_ref WHERE FALSE"
                : "SELECT refs.store_ref FROM (VALUES "
                        + visibleStoreRefs.stream().map(ignored -> "(?::uuid)").collect(Collectors.joining(", "))
                        + ") refs(store_ref)";
        String sql = "WITH deleted AS ("
                + "DELETE FROM business_channel.business_channel_template_store_visibility "
                + "WHERE template_ref=? RETURNING template_ref), "
                + "target_template AS (SELECT ?::uuid AS template_ref UNION SELECT template_ref FROM deleted), "
                + "inserted AS (INSERT INTO business_channel.business_channel_template_store_visibility "
                + "(template_ref, store_ref) SELECT target_template.template_ref, relation_rows.store_ref "
                + "FROM target_template CROSS JOIN (" + relationRows + ") relation_rows "
                + "RETURNING template_ref, store_ref), "
                + "updated AS (UPDATE business_channel.business_channel_template t SET template_name=?, "
                + "store_visibility_scope=?, version=version+1, updated_at_epoch_millis=? "
                + "FROM target_template CROSS JOIN (SELECT count(*) AS inserted_count FROM inserted) relation_write "
                + "WHERE t.template_ref=target_template.template_ref AND t.workspace_uuid=? "
                + "AND t.group_workspace_key=? AND t.version=? AND relation_write.inserted_count >= 0 "
                + "RETURNING t.*) "
                + "SELECT updated.workspace_uuid, updated.group_workspace_key, updated.template_ref, "
                + "updated.project_ref, updated.template_name, updated.template_code, updated.access_kind, "
                + "updated.operator_kind, updated.order_kind, updated.dine_in_form, updated.provider_code, "
                + "updated.store_visibility_scope, updated.status, updated.version, (SELECT count(*) FROM inserted "
                + "JOIN organization.store visible_store ON visible_store.id=inserted.store_ref "
                + "AND visible_store.workspace_uuid=updated.workspace_uuid "
                + "AND visible_store.group_workspace_key=updated.group_workspace_key "
                + "AND visible_store.project_id=updated.project_ref "
                + "WHERE inserted.template_ref=updated.template_ref AND visible_store.status <> 'VOIDED') "
                + "AS visible_store_count, (SELECT project.status FROM organization.organization_node project "
                + "WHERE project.id=updated.project_ref AND project.workspace_uuid=updated.workspace_uuid "
                + "AND project.group_workspace_key=updated.group_workspace_key) AS project_status "
                + "FROM updated";
        List<Object> arguments = new ArrayList<>();
        arguments.add(templateRef);
        arguments.add(templateRef);
        arguments.addAll(visibleStoreRefs);
        arguments.add(templateName);
        arguments.add(storeVisibilityScope);
        arguments.add(time.currentEpochMillis());
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(expectedVersion);
        return jdbc.query(sql, statement -> bind(statement, arguments), result -> {
            if (!result.next()) throw problem("VERSION_CONFLICT", 409, "template version has changed");
            return mapTemplateProjection(result);
        });
    }



    private void insertVisibleStoreRelations(UUID templateRef, List<UUID> visibleStoreRefs) {
        if (visibleStoreRefs.isEmpty()) return;
        jdbc.batchUpdate(
                "INSERT INTO business_channel.business_channel_template_store_visibility "
                        + "(template_ref, store_ref) VALUES (?, ?)",
                visibleStoreRefs.stream()
                        .map(storeRef -> new Object[] {templateRef, storeRef})
                        .toList());
    }



    private static String normalizedStoreVisibilityScope(String operatorKind, String storeVisibilityScope) {
        return BusinessChannelPolicy.STORE.equals(operatorKind)
                ? BusinessChannelPolicy.requireStoreVisibilityScope(storeVisibilityScope)
                : storeVisibilityScope;
    }



    private static UUID parseUuid(String value, String field) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException failure) {
            throw problem("VALIDATION_ERROR", 422, field + " is invalid", failure);
        }
    }



    private long count(String sql, List<Object> arguments) {
        return jdbc.query(
                sql, statement -> bind(statement, arguments), result -> result.next() ? result.getLong(1) : 0L);
    }



    private <T> List<T> query(String sql, List<Object> arguments, org.springframework.jdbc.core.RowMapper<T> mapper) {
        return jdbc.query(sql, statement -> bind(statement, arguments), mapper);
    }



    private static void bind(PreparedStatement statement, List<Object> arguments) throws SQLException {
        for (int index = 0; index < arguments.size(); index++) statement.setObject(index + 1, arguments.get(index));
    }



    private static List<Object> append(List<Object> values, Object value) {
        List<Object> result = new ArrayList<>(values);
        result.add(value);
        return result;
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



    private static String templateOrderBy(String sortKey, String sortDirection) {
        if (sortKey == null) return "template_ref";
        String expression = templateSortExpression(sortKey);
        return expression + " " + direction(sortDirection) + ", template_ref";
    }



    private static String templateSortExpression(String sortKey) {
        return switch (sortKey) {
            case "TEMPLATE_NAME" -> "COALESCE(template_name, '')";
            case "TEMPLATE_CODE" -> "COALESCE(template_code, '')";
            case "ACCESS_KIND" -> "access_kind";
            case "OPERATOR_KIND" -> "operator_kind";
            case "ORDER_KIND" -> "order_kind";
            case "STATUS" -> "status";
            default -> throw problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
    }



    private static String templateSortValue(TemplateProjection row, String sortKey) {
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



    private static String direction(String sortDirection) {
        return "DESC".equals(sortDirection) ? "DESC" : "ASC";
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
            throw problem("VOIDED_RECORD_IMMUTABLE", 409, "该业务渠道已标记删除，不能继续修改");
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
                row.storeVisibilityScope(),
                row.visibleStoreCount(),
                row.status(),
                row.statusDimensions(),
                row.blockers(),
                row.version());
    }



    private static AuditChange change(String field, Object before, Object after) {
        return new AuditChange(
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
        jdbc.update(
                "INSERT INTO business_channel.audit_event (event_ref, workspace_uuid, group_workspace_key, "
                        + "actor_type, actor_id, actor_display_snapshot, entity_type, entity_ref, action, "
                        + "changes_json, occurred_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                policy.entityType(),
                entityRef,
                action,
                AuditChangeJson.write(policy.allow(changes)),
                time.currentEpochMillis());
    }



    private static String canonical(String operation, Object... values) {
        return operation + "\u001f"
                + Arrays.stream(values)
                        .map(value -> Objects.toString(value, "<null>"))
                        .collect(Collectors.joining("\u001f"));
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

    private record TemplateProjection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            UUID projectRef,
            String templateName,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String storeVisibilityScope,
            String status,
            String projectStatus,
            long visibleStoreCount,
            long version) {}

    private record TemplateUpdateProjection(TemplateProjection projection, List<UUID> visibleStoreRefs) {}

    private record TemplateCommandProjection(
            UUID projectRef,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String storeVisibilityScope,
            String status,
            boolean channelCodeInUse) {}

    private record ChannelProjection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            UUID templateRef,
            String targetNodeType,
            String targetNodeRef,
            String channelCode,
            String channelName,
            UUID bindingRef,
            String templateAccessKind,
            String status,
            long version,
            UUID templateProjectRef,
            String templateName,
            String templateCode,
            String templateOperatorKind,
            String templateOrderKind,
            String templateDineInForm,
            String templateProviderCode,
            String templateStatus,
            long templateVersion,
            String templateProjectStatus,
            UUID targetProjectRef,
            String targetNodeStatus,
            UUID targetStoreProjectRef,
            String targetStoreProjectStatus,
            String targetStoreStatus,
            UUID targetTenantRef,
            String targetTenantStatus,
            UUID targetBrandRef,
            String targetBrandStatus,
            String bindingLifecycleStatus,
            String providerStatus) {}

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
