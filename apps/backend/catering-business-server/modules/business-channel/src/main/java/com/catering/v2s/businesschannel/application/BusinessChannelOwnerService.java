package com.catering.v2s.businesschannel.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of business-channel templates and channel instances. */
@Service
public class BusinessChannelOwnerService implements BusinessChannelReadApi, BusinessChannelCommandApi {
    private static final String REQ_CREATE_TEMPLATE = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE";
    private static final String REQ_UPDATE_TEMPLATE = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE";
    private static final String REQ_TRANSITION_TEMPLATE = "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS";
    private static final String REQ_CREATE_CHANNEL = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL";
    private static final String REQ_UPDATE_CHANNEL = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL";
    private static final String REQ_TRANSITION_CHANNEL = "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS";
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    /**
     * Fixed source bound for the project-owned template/channel reads classified as Bounded.
     *
     * <p>This is deliberately a source constant, not a value derived from the current row count or request parameters.
     * The query reads one extra row so an accidental overflow is rejected instead of being silently presented as an
     * exact set.
     */
    static final int BOUNDED_READ_LIMIT = 100;

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
                    "status"));
    private static final AuditChangePolicy TEMPLATE_UPDATED =
            new AuditChangePolicy("BUSINESS_CHANNEL_TEMPLATE", "TEMPLATE_UPDATED", java.util.Set.of("templateName"));
    private static final AuditChangePolicy TEMPLATE_STATUS =
            new AuditChangePolicy("BUSINESS_CHANNEL_TEMPLATE", "STATUS_CHANGED", java.util.Set.of("status"));
    private static final AuditChangePolicy CHANNEL_CREATED = new AuditChangePolicy(
            "BUSINESS_CHANNEL",
            "CHANNEL_CREATED",
            java.util.Set.of(
                    "templateRef",
                    "ownerNodeType",
                    "ownerNodeRef",
                    "channelCode",
                    "channelName",
                    "bindingRef",
                    "status"));
    private static final AuditChangePolicy CHANNEL_UPDATED =
            new AuditChangePolicy("BUSINESS_CHANNEL", "CHANNEL_UPDATED", java.util.Set.of("channelName", "bindingRef"));
    private static final AuditChangePolicy CHANNEL_STATUS =
            new AuditChangePolicy("BUSINESS_CHANNEL", "STATUS_CHANGED", java.util.Set.of("status"));
    private static final AuditChangePolicy CHANNEL_DETACHED =
            new AuditChangePolicy("BUSINESS_CHANNEL", "BINDING_DETACHED", java.util.Set.of("bindingRef"));

    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final CollaborationBindingReadApi collaborationBindings;
    private final WorkspaceStatusLookup workspaceStatuses;
    private final BusinessChannelCommandReceiptService receipts;

    public BusinessChannelOwnerService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts) {
        this.jdbc = jdbc;
        this.time = time;
        this.collaborationCatalog = collaborationCatalog;
        this.collaborationBindings = collaborationBindings;
        this.workspaceStatuses = workspaceStatuses;
        this.receipts = receipts;
    }

    @Override
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
                append(arguments, BOUNDED_READ_LIMIT + 1),
                this::mapTemplateProjection);
        if (projections.size() > BOUNDED_READ_LIMIT) {
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
                rows.stream().map(BusinessChannelOwnerService::template).toList(), null, rows.size());
    }

    @Override
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
        int size = pageSize(pageSize);
        String normalizedSortKey = optionalEnum(
                sortKey, "sortKey", "TEMPLATE_NAME", "TEMPLATE_CODE", "ACCESS_KIND", "ORDER_KIND", "STATUS");
        String normalizedSortDirection = optionalEnum(sortDirection, "sortDirection", "ASC", "DESC");
        if (normalizedSortKey == null && normalizedSortDirection != null) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection requires sortKey");
        }
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
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, projectRef));
        StringBuilder predicate =
                new StringBuilder(" WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? "
                        + "AND operator_kind='STORE' AND status='ENABLED'");
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
                "SELECT count(*) FROM business_channel.business_channel_template" + countPredicate, countArguments);
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
                mapped.stream().map(BusinessChannelOwnerService::template).toList(), nextCursor, total);
    }

    @Override
    @Transactional(readOnly = true)
    public BusinessChannelReadback.ChannelPage pageChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String ownerNodeType,
            String ownerNodeRef,
            String status,
            String sortKey,
            String sortDirection) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        BusinessChannelPolicy.validateOwnerNode(ownerNodeType, ownerNodeRef);
        String normalizedStatus = optionalEnum(
                status,
                "status",
                BusinessChannelPolicy.ENABLED,
                BusinessChannelPolicy.DISABLED,
                BusinessChannelPolicy.VOIDED);
        String normalizedSortKey = optionalEnum(
                sortKey,
                "sortKey",
                "CHANNEL_NAME",
                "CHANNEL_CODE",
                "TEMPLATE_NAME",
                "STATUS",
                "BINDING_STATUS");
        // spotless:on
        String normalizedSortDirection = optionalEnum(sortDirection, "sortDirection", "ASC", "DESC");
        if (normalizedSortKey == null && normalizedSortDirection != null) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection requires sortKey");
        }
        List<Object> arguments =
                new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, ownerNodeType, ownerNodeRef));
        StringBuilder predicate = new StringBuilder(
                " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.target_node_type=? AND c.target_node_r"
                        + "ef=?");
        if (normalizedStatus != null) {
            predicate.append(" AND c.status=?");
            arguments.add(normalizedStatus);
        }
        List<ChannelProjection> projections = query(
                channelProjection("LEFT JOIN business_channel.business_channel_template t "
                                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                                + "AND t.group_workspace_key=c.group_workspace_key ")
                        + predicate
                        + " ORDER BY "
                        + channelOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?",
                append(arguments, BOUNDED_READ_LIMIT + 1),
                this::mapChannelProjection);
        if (projections.size() > BOUNDED_READ_LIMIT) {
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "bounded business-channel read exceeded its fixed source limit");
        }
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(), projections);
        List<ChannelRow> rows = projections.stream()
                .map(projection -> channelRow(projection, facts))
                .toList();
        return new BusinessChannelReadback.ChannelPage(
                rows.stream().map(BusinessChannelOwnerService::channel).toList(), null, rows.size());
    }

    @Override
    @Transactional(readOnly = true)
    public BusinessChannelReadback.Template readTemplate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        return template(readTemplateRow(workspaceUuid, groupWorkspaceKey, templateRef));
    }

    @Override
    @Transactional(readOnly = true)
    public BusinessChannelReadback.Channel readChannel(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        return channel(readChannelRow(workspaceUuid, groupWorkspaceKey, channelRef));
    }

    @Override
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

    @Override
    @Transactional(readOnly = true)
    public BusinessChannelReadback.ChannelCommandContext readChannelCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return jdbc.query(
                "SELECT c.channel_ref, c.template_ref, c.target_node_type, c.target_node_ref, c.channel_name, "
                        + "c.binding_ref, c.version, t.access_kind, t.order_kind, t.provider_code "
                        + "FROM business_channel.business_channel c "
                        + "JOIN business_channel.business_channel_template t ON t.template_ref=c.template_ref "
                        + "AND t.workspace_uuid=c.workspace_uuid AND t.group_workspace_key=c.group_workspace_key "
                        + "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) return notFound("channel");
                    return new BusinessChannelReadback.ChannelCommandContext(
                            result.getObject("channel_ref", UUID.class),
                            result.getObject("template_ref", UUID.class),
                            result.getString("target_node_type"),
                            result.getString("target_node_ref"),
                            result.getString("channel_name"),
                            result.getObject("binding_ref", UUID.class),
                            result.getLong("version"),
                            result.getString("access_kind"),
                            result.getString("order_kind"),
                            result.getString("provider_code"));
                });
    }

    @Override
    @Transactional(readOnly = true)
    public BusinessChannelReadback.ChannelWithTemplateProvider readChannelWithTemplateProvider(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return jdbc.query(
                channelCommandSelect("WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) throw problem("NOT_FOUND", 404, "channel was not found in the workspace");
                    ChannelProjection projection = mapChannelProjection(result);
                    StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(), List.of(projection));
                    return new BusinessChannelReadback.ChannelWithTemplateProvider(
                            channel(channelRow(projection, facts)), projection.templateProviderCode());
                });
    }

    @Override
    @Transactional(readOnly = true)
    public List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        List<ChannelProjection> projections = query(
                channelSelect("WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.binding_ref=?"
                        + " ORDER BY channel_ref"),
                List.of(workspaceUuid, groupWorkspaceKey, bindingRef),
                this::mapChannelProjection);
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(), projections);
        return projections.stream()
                .map(projection -> channel(channelRow(projection, facts)))
                .toList();
    }

    @Override
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
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "createOperationsBusinessChannelTemplate",
                request,
                BusinessChannelReadback.Template.class,
                () -> {
                    ensureTemplateCodeAvailable(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.projectRef(), templateCode);
                    UUID templateRef = UUID.randomUUID();
                    long now = time.currentEpochMillis();
                    try {
                        jdbc.update(
                                "INSERT INTO business_channel.business_channel_template "
                                        + "(template_ref, workspace_uuid, group_workspace_key, project_ref, templat"
                                        + "e_name, template_code, "
                                        + "access_kind, operator_kind, order_kind, dine_in_form, provider_code, sta"
                                        + "tus, "
                                        + "version, created_at_epoch_millis, updated_at_epoch_millis) "
                                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
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
                                now,
                                now);
                    } catch (DuplicateKeyException failure) {
                        throw problem("DUPLICATE_CODE", 409, "templateCode is already used in the project", failure);
                    }
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
                                    change("status", null, BusinessChannelPolicy.ENABLED)));
                    return template(readTemplateRow(command.workspaceUuid(), command.groupWorkspaceKey(), templateRef));
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Template updateTemplate(UpdateTemplateCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BusinessChannelPolicy.required(command.templateName(), "templateName", 240);
        if (command.templateRef() == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
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
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "updateOperationsBusinessChannelTemplate",
                request,
                BusinessChannelReadback.Template.class,
                () -> {
                    TemplateRow current = readTemplateForUpdate(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
                    // The locked template row is the authoritative relation between templateRef and projectRef. The
                    // server-minted grant is checked again after the lock before any version check or write.
                    requireOperationsGrant(
                            command.ownerScopeGrant(),
                            command.contextVersion(),
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            BusinessChannelPolicy.PROJECT,
                            current.projectRef().toString(),
                            REQ_UPDATE_TEMPLATE);
                    requireVersion(current.version(), command.expectedVersion());
                    requireMutable(current.status());
                    if (jdbc.update(
                                    "UPDATE business_channel.business_channel_template SET template_name=?, "
                                            + "version=version+1, updated_at_epoch_millis=? WHERE template_ref=? "
                                            + "AND workspace_uuid=? AND group_workspace_key=? AND version=?",
                                    command.templateName(),
                                    time.currentEpochMillis(),
                                    command.templateRef(),
                                    command.workspaceUuid(),
                                    command.groupWorkspaceKey(),
                                    command.expectedVersion())
                            != 1) throw problem("VERSION_CONFLICT", 409, "template version has changed");
                    audit(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            command.templateRef().toString(),
                            "TEMPLATE_UPDATED",
                            command.actor(),
                            TEMPLATE_UPDATED,
                            List.of(change("templateName", current.templateName(), command.templateName())));
                    return template(templateAfterUpdate(current, command.templateName()));
                });
    }

    @Override
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

    @Override
    @Transactional
    public BusinessChannelReadback.Channel createChannel(CreateChannelCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BusinessChannelPolicy.validateOwnerNode(command.ownerNodeType(), command.ownerNodeRef());
        String channelCode = BusinessChannelPolicy.preserveChannelCode(command.channelCode());
        BusinessChannelPolicy.validateChannelName(command.channelName());
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.ownerNodeType(),
                command.ownerNodeRef(),
                REQ_CREATE_CHANNEL);
        String request = canonical(
                "create-channel",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.templateRef(),
                command.ownerNodeType(),
                command.ownerNodeRef(),
                channelCode,
                command.channelName(),
                command.bindingRef(),
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "createOperationsBusinessChannel",
                request,
                BusinessChannelReadback.Channel.class,
                () -> {
                    TemplateCommandProjection template = readTemplateCommandProjection(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
                    requireEnabledTemplate(template.status());
                    validateTemplateProvider(template, command.workspaceUuid(), command.groupWorkspaceKey());
                    BusinessChannelPolicy.validateTemplateTarget(
                            template.operatorKind(),
                            template.projectRef().toString(),
                            command.ownerNodeType(),
                            command.ownerNodeRef());
                    CollaborationReadback.OwnerBinding binding = command.bindingRef() == null
                            ? null
                            : readBinding(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
                    BusinessChannelPolicy.validateBinding(
                            template.accessKind(),
                            template.orderKind(),
                            template.providerCode(),
                            binding,
                            command.ownerNodeType(),
                            command.ownerNodeRef(),
                            false);
                    String initialStatus = BusinessChannelPolicy.INTERNAL.equals(template.accessKind())
                            ? BusinessChannelPolicy.ENABLED
                            : binding != null && "EFFECTIVE".equals(binding.status())
                                    ? BusinessChannelPolicy.ENABLED
                                    : BusinessChannelPolicy.DISABLED;
                    UUID channelRef = UUID.randomUUID();
                    long now = time.currentEpochMillis();
                    ChannelProjection created =
                            insertChannelReturningProjection(command, channelRef, channelCode, initialStatus, now);
                    audit(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            channelRef.toString(),
                            "CHANNEL_CREATED",
                            command.actor(),
                            CHANNEL_CREATED,
                            List.of(
                                    change("templateRef", null, command.templateRef()),
                                    change("ownerNodeType", null, command.ownerNodeType()),
                                    change("ownerNodeRef", null, command.ownerNodeRef()),
                                    change("channelCode", null, channelCode),
                                    change("channelName", null, command.channelName()),
                                    change("bindingRef", null, command.bindingRef()),
                                    change("status", null, initialStatus)));
                    StatusFacts facts = statusFacts(
                            command.workspaceUuid(), command.groupWorkspaceKey(), List.of(), List.of(created));
                    return channel(channelRow(created, facts));
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Channel updateChannel(UpdateChannelCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BusinessChannelPolicy.validateChannelName(command.channelName());
        requireOperationsGrantTargetEnvelope(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                null,
                REQ_UPDATE_CHANNEL);
        String request = canonical(
                "update-channel",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.channelRef(),
                command.channelName(),
                command.bindingRef(),
                command.expectedVersion(),
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "updateOperationsBusinessChannel",
                request,
                BusinessChannelReadback.Channel.class,
                () -> {
                    CommandChannelRow currentRead = readCommandChannelRow(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef(), true);
                    ChannelRow current = currentRead.channel();
                    // The locked channel row is the authoritative owner target. Recheck the grant against it before
                    // any version check or write; the envelope check above keeps replay authorization pre-receipt.
                    requireOperationsGrant(
                            command.ownerScopeGrant(),
                            command.contextVersion(),
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            current.ownerNodeType(),
                            current.ownerNodeRef(),
                            REQ_UPDATE_CHANNEL);
                    requireVersion(current.version(), command.expectedVersion());
                    requireMutable(current.status());
                    TemplateRow template = currentRead.template();
                    if (command.bindingRef() == null && BusinessChannelPolicy.EXTERNAL.equals(template.accessKind())) {
                        throw problem(
                                "BINDING_EDIT_NOT_ALLOWED",
                                403,
                                "external binding can only be detached by the edge command");
                    }
                    boolean bindingChanged = !Objects.equals(current.bindingRef(), command.bindingRef());
                    CollaborationReadback.OwnerBinding binding = !bindingChanged || command.bindingRef() == null
                            ? null
                            : command.bindingReadback() == null
                                    ? readBinding(
                                            command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef())
                                    : attachedBinding(command.bindingRef(), command.bindingReadback());
                    if (bindingChanged) {
                        BusinessChannelPolicy.validateBinding(
                                template.accessKind(),
                                template.orderKind(),
                                template.providerCode(),
                                binding,
                                current.ownerNodeType(),
                                current.ownerNodeRef(),
                                // The edge coordinator passes the just-created binding readback while attaching a
                                // pending authorization in the same REQUIRED transaction. Direct user edits must
                                // still reject a non-effective existing binding.
                                command.bindingReadback() == null);
                    }
                    if (jdbc.update(
                                    "UPDATE business_channel.business_channel SET channel_name=?, binding_ref=?, "
                                            + "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? "
                                            + "AND workspace_uuid=? AND group_workspace_key=? AND version=?",
                                    command.channelName(),
                                    command.bindingRef(),
                                    time.currentEpochMillis(),
                                    command.channelRef(),
                                    command.workspaceUuid(),
                                    command.groupWorkspaceKey(),
                                    command.expectedVersion())
                            != 1) throw problem("VERSION_CONFLICT", 409, "channel version has changed");
                    audit(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            command.channelRef().toString(),
                            "CHANNEL_UPDATED",
                            command.actor(),
                            CHANNEL_UPDATED,
                            List.of(
                                    change("channelName", current.channelName(), command.channelName()),
                                    change("bindingRef", current.bindingRef(), command.bindingRef())));
                    List<BusinessChannelReadback.StatusDimension> dimensions = withBindingDimension(
                            current.statusDimensions(),
                            command.bindingRef(),
                            binding == null ? null : binding.status());
                    List<BusinessChannelReadback.StatusDimension> blockers = dimensions.stream()
                            .filter(BusinessChannelOwnerService::isBlocker)
                            .toList();
                    return channel(new ChannelRow(
                            current.channelRef(),
                            current.templateRef(),
                            current.ownerNodeType(),
                            current.ownerNodeRef(),
                            current.channelCode(),
                            command.channelName(),
                            command.bindingRef(),
                            bindingStatus(template.accessKind(), command.bindingRef()),
                            current.status(),
                            dimensions,
                            blockers,
                            current.version() + 1));
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Channel transitionChannelStatus(TransitionChannelStatusCommand command) {
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
                null,
                REQ_TRANSITION_CHANNEL);
        String request = canonical(
                "transition-channel-status",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.channelRef(),
                targetStatus,
                command.expectedVersion(),
                command.contextVersion());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "transitionOperationsBusinessChannelStatus",
                request,
                BusinessChannelReadback.Channel.class,
                () -> {
                    CommandChannelRow currentRead = readCommandChannelRow(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef(), true);
                    ChannelRow current = currentRead.channel();
                    // The locked channel row is the authoritative owner target. Recheck the grant against it before
                    // any version check or write; the envelope check above keeps replay authorization pre-receipt.
                    requireOperationsGrant(
                            command.ownerScopeGrant(),
                            command.contextVersion(),
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            current.ownerNodeType(),
                            current.ownerNodeRef(),
                            REQ_TRANSITION_CHANNEL);
                    requireVersion(current.version(), command.expectedVersion());
                    requireMutable(current.status());
                    boolean needsWrite = !Objects.equals(current.status(), targetStatus);
                    ChannelRow result = current;
                    if (needsWrite) {
                        long now = time.currentEpochMillis();
                        if (jdbc.update(
                                        "UPDATE business_channel.business_channel SET status=?, "
                                                + "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? "
                                                + "AND workspace_uuid=? AND group_workspace_key=? AND version=?",
                                        targetStatus,
                                        now,
                                        command.channelRef(),
                                        command.workspaceUuid(),
                                        command.groupWorkspaceKey(),
                                        command.expectedVersion())
                                != 1) throw problem("VERSION_CONFLICT", 409, "channel version has changed");
                        audit(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.channelRef().toString(),
                                "STATUS_CHANGED",
                                command.actor(),
                                CHANNEL_STATUS,
                                List.of(change("status", current.status(), targetStatus)));
                        result = channelAfterStatusTransition(current, targetStatus);
                    }
                    return channel(result);
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Channel detachChannelBinding(
            DetachChannelBindingCommand command, long expectedVersion) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        if (command.channelRef() == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        String request = canonical(
                "detach-channel-binding",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.channelRef(),
                expectedVersion,
                command.expectedBindingRef());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "detachChannelBinding",
                request,
                BusinessChannelReadback.Channel.class,
                () -> {
                    ChannelRow current = readChannelForUpdate(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef());
                    requireVersion(current.version(), expectedVersion);
                    requireMutable(current.status());
                    if (command.expectedBindingRef() != null
                            && !Objects.equals(current.bindingRef(), command.expectedBindingRef())) {
                        throw problem(
                                "BINDING_CONTEXT_MISMATCH",
                                409,
                                "binding is not attached to the selected business channel");
                    }
                    ChannelRow result = current;
                    if (current.bindingRef() != null) {
                        long now = time.currentEpochMillis();
                        if (jdbc.update(
                                        "UPDATE business_channel.business_channel SET binding_ref=null, "
                                                + "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? "
                                                + "AND workspace_uuid=? AND group_workspace_key=? AND version=?",
                                        now,
                                        command.channelRef(),
                                        command.workspaceUuid(),
                                        command.groupWorkspaceKey(),
                                        expectedVersion)
                                != 1) throw problem("VERSION_CONFLICT", 409, "channel version has changed");
                        audit(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.channelRef().toString(),
                                "BINDING_DETACHED",
                                command.actor(),
                                CHANNEL_DETACHED,
                                List.of(change("bindingRef", current.bindingRef(), null)));
                        result = channelAfterBindingDetach(current);
                    }
                    return channel(result);
                });
    }

    private CollaborationReadback.ProviderProfile providerFor(
            String accessKind, String providerCode, UUID workspaceUuid, String groupWorkspaceKey) {
        if (!BusinessChannelPolicy.EXTERNAL.equals(accessKind)) return null;
        return collaborationCatalog.readProviderProfile(workspaceUuid, groupWorkspaceKey, providerCode);
    }

    private void validateTemplateProvider(
            TemplateCommandProjection template, UUID workspaceUuid, String groupWorkspaceKey) {
        BusinessChannelPolicy.validateTemplate(
                template.accessKind(),
                template.operatorKind(),
                template.orderKind(),
                template.dineInForm(),
                template.providerCode(),
                providerFor(template.accessKind(), template.providerCode(), workspaceUuid, groupWorkspaceKey));
    }

    private CollaborationReadback.OwnerBinding readBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        CollaborationReadback.OwnerBinding binding =
                collaborationBindings.readBinding(workspaceUuid, groupWorkspaceKey, bindingRef);
        if (binding == null) throw problem("NOT_FOUND", 404, "binding was not found in the workspace");
        return binding;
    }

    private static CollaborationReadback.OwnerBinding attachedBinding(
            UUID expectedBindingRef, CollaborationReadback.OwnerBinding binding) {
        if (binding == null || !Objects.equals(expectedBindingRef, binding.bindingRef())) {
            throw problem("BINDING_CONTEXT_MISMATCH", 409, "binding readback is not attached to the selected channel");
        }
        return binding;
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
                targetStatus,
                current.statusDimensions(),
                current.blockers(),
                current.version() + 1);
    }

    private static TemplateRow templateAfterUpdate(TemplateRow current, String templateName) {
        return new TemplateRow(
                current.templateRef(),
                current.projectRef(),
                templateName,
                current.templateCode(),
                current.accessKind(),
                current.operatorKind(),
                current.orderKind(),
                current.dineInForm(),
                current.providerCode(),
                current.status(),
                current.statusDimensions(),
                current.blockers(),
                current.version() + 1);
    }

    private static ChannelRow channelAfterStatusTransition(ChannelRow current, String targetStatus) {
        return new ChannelRow(
                current.channelRef(),
                current.templateRef(),
                current.ownerNodeType(),
                current.ownerNodeRef(),
                current.channelCode(),
                current.channelName(),
                current.bindingRef(),
                current.bindingStatus(),
                targetStatus,
                current.statusDimensions(),
                current.blockers(),
                current.version() + 1);
    }

    private static ChannelRow channelAfterBindingDetach(ChannelRow current) {
        List<BusinessChannelReadback.StatusDimension> dimensions =
                withBindingDimension(current.statusDimensions(), null, null);
        return new ChannelRow(
                current.channelRef(),
                current.templateRef(),
                current.ownerNodeType(),
                current.ownerNodeRef(),
                current.channelCode(),
                current.channelName(),
                null,
                "NOT_REQUIRED".equals(current.bindingStatus()) ? "NOT_REQUIRED" : "UNBOUND",
                current.status(),
                dimensions,
                dimensions.stream()
                        .filter(BusinessChannelOwnerService::isBlocker)
                        .toList(),
                current.version() + 1);
    }

    private ChannelProjection insertChannelReturningProjection(
            BusinessChannelCommandApi.CreateChannelCommand command,
            UUID channelRef,
            String channelCode,
            String initialStatus,
            long now) {
        try {
            return jdbc.query(
                    "WITH inserted AS (INSERT INTO business_channel.business_channel "
                            + "(channel_ref, workspace_uuid, group_workspace_key, target_node_type, target_node_ref, "
                            + "template_ref, channel_code, channel_name, binding_ref, status, version, "
                            + "created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
                            + "1, ?, ?) "
                            + "RETURNING *) "
                            + insertedChannelProjection(),
                    statement -> {
                        statement.setObject(1, channelRef);
                        statement.setObject(2, command.workspaceUuid());
                        statement.setString(3, command.groupWorkspaceKey());
                        statement.setString(4, command.ownerNodeType());
                        statement.setString(5, command.ownerNodeRef());
                        statement.setObject(6, command.templateRef());
                        statement.setString(7, channelCode);
                        statement.setString(8, command.channelName());
                        statement.setObject(9, command.bindingRef());
                        statement.setString(10, initialStatus);
                        statement.setLong(11, now);
                        statement.setLong(12, now);
                    },
                    result -> result.next() ? mapChannelProjection(result) : notFound("channel"));
        } catch (DuplicateKeyException failure) {
            throw problem("DUPLICATE_CODE", 409, "channelCode is already used in the group workspace", failure);
        }
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

    private TemplateCommandProjection readTemplateCommandProjection(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        return jdbc.query(
                "SELECT project_ref, access_kind, operator_kind, order_kind, dine_in_form, provider_code, status "
                        + "FROM business_channel.business_channel_template "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=? FOR UPDATE",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> {
                    if (!result.next()) return notFound("template");
                    return new TemplateCommandProjection(
                            result.getObject("project_ref", UUID.class),
                            result.getString("access_kind"),
                            result.getString("operator_kind"),
                            result.getString("order_kind"),
                            result.getString("dine_in_form"),
                            result.getString("provider_code"),
                            result.getString("status"));
                });
    }

    private ChannelRow readChannelRow(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return jdbc.query(
                channelSelect("WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) return notFound("channel");
                    ChannelProjection projection = mapChannelProjection(result);
                    return channelRow(
                            projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(), List.of(projection)));
                });
    }

    private ChannelRow readChannelForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return jdbc.query(
                channelSelect(
                        "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? FOR UPDATE OF c"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) return notFound("channel");
                    ChannelProjection projection = mapChannelProjection(result);
                    return channelRow(
                            projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(), List.of(projection)));
                });
    }

    private CommandChannelRow readCommandChannelRow(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef, boolean forUpdate) {
        String suffix = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"
                + (forUpdate ? " FOR UPDATE OF c" : "");
        return jdbc.query(
                channelCommandSelect(suffix),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) return notFound("channel");
                    ChannelProjection projection = mapChannelProjection(result);
                    StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(), List.of(projection));
                    return new CommandChannelRow(channelRow(projection, facts), joinedTemplateRow(projection, facts));
                });
    }

    private static String templateSelect(String suffix) {
        return "SELECT t.workspace_uuid, t.group_workspace_key, t.template_ref, t.project_ref, t.template_name, "
                + "t.template_code, t.access_kind, t.operator_kind, t.order_kind, t.dine_in_form, t.provider_code, "
                + "t.status, t.version, (SELECT project.status FROM organization.organization_node project "
                + "WHERE project.id=t.project_ref AND project.workspace_uuid=t.workspace_uuid "
                + "AND project.group_workspace_key=t.group_workspace_key) AS project_status "
                + "FROM business_channel.business_channel_template t "
                + suffix;
    }

    private static String channelSelect(String suffix) {
        return channelProjection(
                        /* format-wrap */
                        "JOIN business_channel.business_channel_template t "
                                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                                + "AND t.group_workspace_key=c.group_workspace_key ")
                + suffix;
    }

    static String channelCommandSelect(String suffix) {
        return channelProjection("JOIN business_channel.business_channel_template t "
                        + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                        + "AND t.group_workspace_key=c.group_workspace_key ")
                + suffix;
    }

    private static String insertedChannelProjection() {
        return channelProjection("JOIN business_channel.business_channel_template t "
                        + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                        + "AND t.group_workspace_key=c.group_workspace_key ")
                .replace("FROM business_channel.business_channel c ", "FROM inserted c ");
    }

    private static String channelProjection(String templateJoin) {
        return "SELECT c.channel_ref, c.workspace_uuid, c.group_workspace_key, c.template_ref, "
                + "c.target_node_type, c.target_node_ref, c.channel_code, "
                + "c.channel_name, c.binding_ref, t.access_kind AS template_access_kind, c.status, c.version, "
                + "t.project_ref AS template_project_ref, t.template_name, t.template_code, "
                + "t.operator_kind AS template_operator_kind, t.order_kind AS template_order_kind, "
                + "t.dine_in_form AS template_dine_in_form, t.provider_code AS template_provider_code, "
                + "t.status AS template_status, t.version AS template_version, "
                + "template_project.status AS template_project_status, "
                + "target_project.id AS target_project_ref, "
                + "CASE WHEN c.target_node_type='PROJECT' THEN target_project.status ELSE target_store.status END "
                + "AS target_node_status, target_store.project_id AS target_store_project_ref, "
                + "target_store_project.status AS target_store_project_status, "
                + "target_store.status AS target_store_status, "
                + "target_tenant.id AS target_tenant_ref, target_tenant.status AS target_tenant_status, "
                + "target_brand.id AS target_brand_ref, target_brand.status AS target_brand_status, "
                + "binding.status AS binding_lifecycle_status, provider.status AS provider_status "
                + "FROM business_channel.business_channel c "
                + templateJoin
                + "LEFT JOIN organization.organization_node template_project "
                + "ON template_project.id=t.project_ref AND template_project.workspace_uuid=c.workspace_uuid "
                + "AND template_project.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.organization_node target_project "
                + "ON c.target_node_type='PROJECT' AND target_project.id::text=c.target_node_ref "
                + "AND target_project.workspace_uuid=c.workspace_uuid "
                + "AND target_project.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.store target_store "
                + "ON c.target_node_type='STORE' AND target_store.id::text=c.target_node_ref "
                + "AND target_store.workspace_uuid=c.workspace_uuid "
                + "AND target_store.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.organization_node target_store_project "
                + "ON target_store_project.id=target_store.project_id "
                + "AND target_store_project.workspace_uuid=c.workspace_uuid "
                + "AND target_store_project.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.tenant target_tenant ON target_tenant.id=target_store.tenant_id "
                + "AND target_tenant.workspace_uuid=c.workspace_uuid "
                + "AND target_tenant.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN organization.brand target_brand ON target_brand.id=target_store.brand_id "
                + "AND target_brand.workspace_uuid=c.workspace_uuid "
                + "AND target_brand.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN collaboration.owner_binding binding ON binding.binding_ref=c.binding_ref "
                + "AND binding.workspace_uuid=c.workspace_uuid AND binding.group_workspace_key=c.group_workspace_key "
                + "LEFT JOIN collaboration.provider_profile_enablement provider "
                + "ON provider.provider_code=t.provider_code AND provider.workspace_uuid=c.workspace_uuid "
                + "AND provider.group_workspace_key=c.group_workspace_key ";
    }

    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<TemplateProjection> templates,
            List<ChannelProjection> channels) {
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
            CollaborationReadback.Tree tree = collaborationCatalog.readTree(workspaceUuid, groupWorkspaceKey);
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
                result.getString("status"),
                result.getString("project_status"),
                result.getLong("version"));
    }

    private TemplateRow templateRow(TemplateProjection projection, StatusFacts facts) {
        List<BusinessChannelReadback.StatusDimension> dimensions = new ArrayList<>();
        addDimension(dimensions, "ORGANIZATION_PROJECT", projection.projectRef(), projection.projectStatus());
        addWorkspaceDimension(dimensions, projection.groupWorkspaceKey(), facts);
        appendOrganizationAncestors(dimensions, facts, projection.projectRef());
        List<BusinessChannelReadback.StatusDimension> blockers = dimensions.stream()
                .filter(BusinessChannelOwnerService::isBlocker)
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
                projection.status(),
                dimensions,
                blockers,
                projection.version());
    }

    private ChannelProjection mapChannelProjection(ResultSet result, int rowNumber) throws SQLException {
        return mapChannelProjection(result);
    }

    private ChannelProjection mapChannelProjection(ResultSet result) throws SQLException {
        return new ChannelProjection(
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("channel_ref", UUID.class),
                result.getObject("template_ref", UUID.class),
                result.getString("target_node_type"),
                result.getString("target_node_ref"),
                result.getString("channel_code"),
                result.getString("channel_name"),
                result.getObject("binding_ref", UUID.class),
                result.getString("template_access_kind"),
                result.getString("status"),
                result.getLong("version"),
                result.getObject("template_project_ref", UUID.class),
                result.getString("template_name"),
                result.getString("template_code"),
                result.getString("template_operator_kind"),
                result.getString("template_order_kind"),
                result.getString("template_dine_in_form"),
                result.getString("template_provider_code"),
                result.getString("template_status"),
                result.getLong("template_version"),
                result.getString("template_project_status"),
                result.getObject("target_project_ref", UUID.class),
                result.getString("target_node_status"),
                result.getObject("target_store_project_ref", UUID.class),
                result.getString("target_store_project_status"),
                result.getString("target_store_status"),
                result.getObject("target_tenant_ref", UUID.class),
                result.getString("target_tenant_status"),
                result.getObject("target_brand_ref", UUID.class),
                result.getString("target_brand_status"),
                result.getString("binding_lifecycle_status"),
                result.getString("provider_status"));
    }

    private ChannelRow channelRow(ChannelProjection projection, StatusFacts facts) {
        List<BusinessChannelReadback.StatusDimension> dimensions = new ArrayList<>();
        addWorkspaceDimension(dimensions, projection.groupWorkspaceKey(), facts);
        addDimension(dimensions, "BUSINESS_CHANNEL_TEMPLATE", projection.templateRef(), projection.templateStatus());
        addDimension(
                dimensions,
                "ORGANIZATION_PROJECT",
                projection.templateProjectRef(),
                projection.templateProjectStatus());
        appendOrganizationAncestors(dimensions, facts, projection.templateProjectRef());
        addDimension(
                dimensions,
                projection.targetNodeType() == null ? null : "ORGANIZATION_" + projection.targetNodeType(),
                projection.targetNodeRef(),
                projection.targetNodeStatus());
        appendOrganizationAncestors(dimensions, facts, projection.targetProjectRef());
        addDimension(
                dimensions,
                "ORGANIZATION_PROJECT",
                projection.targetStoreProjectRef(),
                projection.targetStoreProjectStatus());
        appendOrganizationAncestors(dimensions, facts, projection.targetStoreProjectRef());
        addDimension(dimensions, "ORGANIZATION_STORE", projection.targetNodeRef(), projection.targetStoreStatus());
        // spotless:off
        addDimension(
                dimensions,
                "ORGANIZATION_TENANT",
                projection.targetTenantRef(),
                projection.targetTenantStatus());
        addDimension(
                dimensions,
                "ORGANIZATION_BRAND",
                projection.targetBrandRef(),
                projection.targetBrandStatus());
        addDimension(
                dimensions,
                "COLLABORATION_BINDING",
                projection.bindingRef(),
                projection.bindingLifecycleStatus());
        // spotless:on
        appendCollaborationDimensions(
                dimensions, facts, projection.templateAccessKind(), projection.templateProviderCode());
        List<BusinessChannelReadback.StatusDimension> blockers = dimensions.stream()
                .filter(BusinessChannelOwnerService::isBlocker)
                .toList();
        return new ChannelRow(
                projection.channelRef(),
                projection.templateRef(),
                projection.targetNodeType(),
                projection.targetNodeRef(),
                projection.channelCode(),
                projection.channelName(),
                projection.bindingRef(),
                bindingStatus(projection.templateAccessKind(), projection.bindingRef()),
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

    private void appendCollaborationDimensions(
            List<BusinessChannelReadback.StatusDimension> dimensions,
            StatusFacts facts,
            String accessKind,
            String providerCode) {
        if (!BusinessChannelPolicy.EXTERNAL.equals(accessKind) || providerCode == null || providerCode.isBlank())
            return;
        CollaborationReadback.ProviderProfile provider = facts.provider(providerCode);
        if (provider == null) {
            // spotless:off
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "external channel provider readback is missing");
            // spotless:on
        }
        addDimension(
                dimensions, "COLLABORATION_PROVIDER_PROFILE", provider.providerCode(), provider.enablementStatus());
        if (provider.externalSystemCode() != null
                && !provider.externalSystemCode().isBlank()) {
            CollaborationReadback.ExternalSystem externalSystem = facts.externalSystem(provider.externalSystemCode());
            if (externalSystem == null) {
                throw problem(
                        "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                        500,
                        "external channel system readback is missing");
            }
            addDimension(
                    dimensions,
                    "COLLABORATION_EXTERNAL_SYSTEM",
                    externalSystem.externalSystemCode(),
                    externalSystem.enablementStatus());
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

    private static List<BusinessChannelReadback.StatusDimension> withBindingDimension(
            List<BusinessChannelReadback.StatusDimension> current, UUID bindingRef, String bindingStatus) {
        List<BusinessChannelReadback.StatusDimension> result = current.stream()
                .filter(dimension -> !"COLLABORATION_BINDING".equals(dimension.type()))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        addDimension(result, "COLLABORATION_BINDING", bindingRef, bindingStatus);
        return List.copyOf(result);
    }

    private static boolean isBlocker(BusinessChannelReadback.StatusDimension dimension) {
        return !"COLLABORATION_BINDING".equals(dimension.type())
                && !BusinessChannelPolicy.ENABLED.equals(dimension.status());
    }

    private TemplateRow joinedTemplateRow(ChannelProjection projection, StatusFacts facts) {
        UUID projectRef = projection.templateProjectRef();
        List<BusinessChannelReadback.StatusDimension> dimensions = new ArrayList<>();
        addDimension(dimensions, "ORGANIZATION_PROJECT", projectRef, projection.templateProjectStatus());
        addWorkspaceDimension(dimensions, projection.groupWorkspaceKey(), facts);
        appendOrganizationAncestors(dimensions, facts, projectRef);
        List<BusinessChannelReadback.StatusDimension> blockers = dimensions.stream()
                .filter(BusinessChannelOwnerService::isBlocker)
                .toList();
        return new TemplateRow(
                projection.templateRef(),
                projectRef,
                projection.templateName(),
                projection.templateCode(),
                projection.templateAccessKind(),
                projection.templateOperatorKind(),
                projection.templateOrderKind(),
                projection.templateDineInForm(),
                projection.templateProviderCode(),
                projection.templateStatus(),
                dimensions,
                blockers,
                projection.templateVersion());
    }

    private void ensureTemplateCodeAvailable(
            UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, String templateCode) {
        if (count(
                        "SELECT count(*) FROM business_channel.business_channel_template "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? AND template_"
                                + "code=? AND status <> 'VOIDED'",
                        List.of(workspaceUuid, groupWorkspaceKey, projectRef, templateCode))
                > 0) {
            throw problem("DUPLICATE_CODE", 409, "templateCode is already used in the project");
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

    private static String channelOrderBy(String sortKey, String sortDirection) {
        if (sortKey == null) return "c.channel_ref";
        String expression =
                switch (sortKey) {
                    case "CHANNEL_NAME" -> "c.channel_name";
                    case "CHANNEL_CODE" -> "COALESCE(c.channel_code, '')";
                    case "TEMPLATE_NAME" -> "COALESCE(t.template_name, '')";
                    case "STATUS" -> "c.status";
                    case "BINDING_STATUS" -> "CASE WHEN t.access_kind='INTERNAL' THEN 0 WHEN c.binding_ref IS NULL "
                            + "THEN 1 ELSE 2 END";
                    default -> throw problem("VALIDATION_ERROR", 422, "sortKey is not supported");
                };
        return expression + " " + direction(sortDirection) + ", c.channel_ref";
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

    private static void requireEnabledTemplate(String status) {
        if (!BusinessChannelPolicy.ENABLED.equals(status)) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "new channels require an enabled template");
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
                row.status(),
                row.statusDimensions(),
                row.blockers(),
                row.version());
    }

    private static BusinessChannelReadback.Channel channel(ChannelRow row) {
        return new BusinessChannelReadback.Channel(
                row.channelRef(),
                row.templateRef(),
                row.ownerNodeType(),
                row.ownerNodeRef(),
                row.channelCode(),
                row.channelName(),
                row.bindingRef(),
                row.bindingStatus(),
                row.status(),
                row.statusDimensions(),
                row.blockers(),
                row.version());
    }

    private static ChannelRow channelRow(BusinessChannelReadback.Channel value) {
        if (value == null) throw problem("NOT_FOUND", 404, "channel was not found in the workspace");
        return new ChannelRow(
                value.channelRef(),
                value.templateRef(),
                value.ownerNodeType(),
                value.ownerNodeRef(),
                value.channelCode(),
                value.channelName(),
                value.bindingRef(),
                value.bindingStatus(),
                value.status(),
                value.statusDimensions(),
                value.blockers(),
                value.version());
    }

    private static String bindingStatus(String accessKind, UUID bindingRef) {
        if (BusinessChannelPolicy.INTERNAL.equals(accessKind)) return "NOT_REQUIRED";
        return bindingRef == null ? "UNBOUND" : "BOUND";
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
            String status,
            String projectStatus,
            long version) {}

    private record TemplateCommandProjection(
            UUID projectRef,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String status) {}

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
