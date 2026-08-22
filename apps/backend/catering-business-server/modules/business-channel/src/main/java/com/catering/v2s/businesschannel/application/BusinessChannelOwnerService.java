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
import java.sql.Array;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
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
    private static final AuditChangePolicy TEMPLATE_STATUS = new AuditChangePolicy(
            "BUSINESS_CHANNEL_TEMPLATE", "STATUS_CHANGED", java.util.Set.of("status", "channelCount"));
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
            new AuditChangePolicy("BUSINESS_CHANNEL", "STATUS_CHANGED", java.util.Set.of("status", "stopReason"));
    private static final AuditChangePolicy CHANNEL_DETACHED =
            new AuditChangePolicy("BUSINESS_CHANNEL", "BINDING_DETACHED", java.util.Set.of("bindingRef", "status"));

    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final CollaborationBindingReadApi collaborationBindings;
    private final BusinessChannelCommandReceiptService receipts;

    public BusinessChannelOwnerService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            BusinessChannelCommandReceiptService receipts) {
        this.jdbc = jdbc;
        this.time = time;
        this.collaborationCatalog = collaborationCatalog;
        this.collaborationBindings = collaborationBindings;
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
        List<TemplateRow> rows = query(
                "SELECT template_ref, project_ref, template_name, template_code, access_kind, operator_kind, order_"
                        + "kind, "
                        + "dine_in_form, provider_code, status, version FROM business_channel.business_channel_template"
                        + predicate
                        + " ORDER BY "
                        + templateOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?",
                append(arguments, BOUNDED_READ_LIMIT + 1),
                this::mapTemplate);
        if (rows.size() > BOUNDED_READ_LIMIT) {
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "bounded business-channel template read exceeded its fixed source limit");
        }
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
        List<TemplateRow> rows = query(
                "SELECT template_ref, project_ref, template_name, template_code, access_kind, operator_kind, order_"
                        + "kind, "
                        + "dine_in_form, provider_code, status, version FROM business_channel.business_channel_template"
                        + predicate
                        + " ORDER BY "
                        + templateOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?",
                append(arguments, size + 1),
                this::mapTemplate);
        boolean hasNext = rows.size() > size;
        List<TemplateRow> page = hasNext ? rows.subList(0, size) : rows;
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity,
                        templateSortValue(page.get(page.size() - 1), normalizedSortKey),
                        page.get(page.size() - 1).templateRef())
                : null;
        return new BusinessChannelReadback.TemplatePage(
                page.stream().map(BusinessChannelOwnerService::template).toList(), nextCursor, total);
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
                BusinessChannelPolicy.DRAFT,
                BusinessChannelPolicy.EFFECTIVE,
                BusinessChannelPolicy.DISABLED);
        String normalizedSortKey = optionalEnum(
                sortKey, "sortKey", "CHANNEL_NAME", "CHANNEL_CODE", "TEMPLATE_NAME", "STATUS", "BINDING_STATUS");
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
        List<ChannelRow> rows = query(
                "SELECT c.channel_ref, c.template_ref, c.target_node_type, c.target_node_ref, c.channel_code, "
                        + "c.channel_name, c.binding_ref, t.access_kind AS template_access_kind, c.status, "
                        + "c.stop_reasons, c.version "
                        + "FROM business_channel.business_channel c "
                        + "LEFT JOIN business_channel.business_channel_template t "
                        + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                        + "AND t.group_workspace_key=c.group_workspace_key"
                        + predicate
                        + " ORDER BY "
                        + channelOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?",
                append(arguments, BOUNDED_READ_LIMIT + 1),
                this::mapChannel);
        if (rows.size() > BOUNDED_READ_LIMIT) {
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "bounded business-channel read exceeded its fixed source limit");
        }
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
                    return new BusinessChannelReadback.ChannelWithTemplateProvider(
                            channel(mapChannel(result)), result.getString("template_provider_code"));
                });
    }

    @Override
    @Transactional(readOnly = true)
    public List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        return query(
                        channelSelect("WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.binding_ref=?"
                                + " ORDER BY channel_ref"),
                        List.of(workspaceUuid, groupWorkspaceKey, bindingRef),
                        this::mapChannel)
                .stream()
                .map(BusinessChannelOwnerService::channel)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BusinessChannelReadback.Channel> findChannelsForProvider(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedProvider = BusinessChannelPolicy.required(providerCode, "providerCode", 240);
        return query(
                        "SELECT c.channel_ref, c.template_ref, c.target_node_type, c.target_node_ref, "
                                + "c.channel_code, c.channel_name, c.binding_ref, t.access_kind AS template_access_"
                                + "kind, "
                                + "c.status, c.stop_reasons, c.version "
                                + "FROM business_channel.business_channel c "
                                + "JOIN business_channel.business_channel_template t "
                                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                                + "AND t.group_workspace_key=c.group_workspace_key "
                                + "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND t.provider_code=? "
                                + "ORDER BY c.channel_ref",
                        List.of(workspaceUuid, groupWorkspaceKey, normalizedProvider),
                        this::mapChannel)
                .stream()
                .map(BusinessChannelOwnerService::channel)
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
        TemplateRow initial =
                readTemplateRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                BusinessChannelPolicy.PROJECT,
                initial.projectRef().toString(),
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
                    requireVersion(current.version(), command.expectedVersion());
                    requireEditable(current.status());
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
                    return template(readTemplateRow(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef()));
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Template transitionTemplateStatus(TransitionTemplateStatusCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        String targetStatus = BusinessChannelPolicy.requireEnum(
                command.status(), "status", BusinessChannelPolicy.ENABLED, BusinessChannelPolicy.DISABLED);
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
                        long channelCount = 0;
                        if (BusinessChannelPolicy.DISABLED.equals(targetStatus)) {
                            channelCount = cascadeTemplateStop(
                                    command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef(), now);
                        }
                        audit(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.templateRef().toString(),
                                "STATUS_CHANGED",
                                command.actor(),
                                TEMPLATE_STATUS,
                                List.of(
                                        change("status", current.status(), targetStatus),
                                        change("channelCount", null, channelCount)));
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
                    TemplateRow template = readTemplateRow(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef());
                    requireEditable(template.status());
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
                    ensureChannelCodeAvailable(command.workspaceUuid(), command.groupWorkspaceKey(), channelCode);
                    String initialStatus = BusinessChannelPolicy.INTERNAL.equals(template.accessKind())
                            ? BusinessChannelPolicy.EFFECTIVE
                            : binding != null && BusinessChannelPolicy.EFFECTIVE.equals(binding.status())
                                    ? BusinessChannelPolicy.EFFECTIVE
                                    : BusinessChannelPolicy.DRAFT;
                    UUID channelRef = UUID.randomUUID();
                    long now = time.currentEpochMillis();
                    try {
                        jdbc.update(
                                "INSERT INTO business_channel.business_channel "
                                        + "(channel_ref, workspace_uuid, group_workspace_key, target_node_type, "
                                        + "target_node_ref, template_ref, channel_code, channel_name, binding_ref, "
                                        + "status, "
                                        + "stop_reasons, version, created_at_epoch_millis, updated_at_epoch_millis) "
                                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}'::text[], 1, ?, ?)",
                                channelRef,
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.ownerNodeType(),
                                command.ownerNodeRef(),
                                command.templateRef(),
                                channelCode,
                                command.channelName(),
                                command.bindingRef(),
                                initialStatus,
                                now,
                                now);
                    } catch (DuplicateKeyException failure) {
                        throw problem(
                                "DUPLICATE_CODE", 409, "channelCode is already used in the group workspace", failure);
                    }
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
                    return channel(readChannelRow(command.workspaceUuid(), command.groupWorkspaceKey(), channelRef));
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Channel updateChannel(UpdateChannelCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BusinessChannelPolicy.validateChannelName(command.channelName());
        CommandChannelRow initialRead = command.initialChannelReadback() == null
                ? readCommandChannelRow(
                        command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef(), false)
                : null;
        ChannelRow initial = initialRead == null ? channelRow(command.initialChannelReadback()) : initialRead.channel();
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                initial.ownerNodeType(),
                initial.ownerNodeRef(),
                REQ_UPDATE_CHANNEL);
        requireEditable(initial.status());
        if (command.bindingRef() == null) {
            TemplateRow initialTemplate = initialRead == null
                    ? readTemplateRow(command.workspaceUuid(), command.groupWorkspaceKey(), initial.templateRef())
                    : initialRead.template();
            if (BusinessChannelPolicy.EXTERNAL.equals(initialTemplate.accessKind())) {
                throw problem(
                        "BINDING_EDIT_NOT_ALLOWED", 403, "external binding can only be detached by the edge command");
            }
        }
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
                    requireVersion(current.version(), command.expectedVersion());
                    requireEditable(current.status());
                    TemplateRow template = currentRead.template();
                    requireEditable(template.status());
                    CollaborationReadback.OwnerBinding binding = command.bindingRef() == null
                            ? null
                            : command.bindingReadback() == null
                                    ? readBinding(
                                            command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef())
                                    : attachedBinding(command.bindingRef(), command.bindingReadback());
                    BusinessChannelPolicy.validateBinding(
                            template.accessKind(),
                            template.orderKind(),
                            template.providerCode(),
                            binding,
                            current.ownerNodeType(),
                            current.ownerNodeRef(),
                            BusinessChannelPolicy.EFFECTIVE.equals(current.status()));
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
                            current.stopReasons(),
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
                BusinessChannelPolicy.DRAFT,
                BusinessChannelPolicy.EFFECTIVE,
                BusinessChannelPolicy.DISABLED);
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
                    if (!BusinessChannelPolicy.DISABLED.equals(targetStatus)) requireEditable(current.status());
                    TemplateRow template = currentRead.template();
                    if (!BusinessChannelPolicy.DISABLED.equals(targetStatus)) requireEditable(template.status());
                    if (BusinessChannelPolicy.EFFECTIVE.equals(targetStatus)) {
                        if (!current.stopReasons().isEmpty()) {
                            throw problem(
                                    "DISABLED_OBJECT_NOT_EDITABLE",
                                    409,
                                    "stop reason recovery remains pending under C-01");
                        }
                        CollaborationReadback.OwnerBinding binding = current.bindingRef() == null
                                ? null
                                : readBinding(
                                        command.workspaceUuid(), command.groupWorkspaceKey(), current.bindingRef());
                        validateTemplateProvider(template, command.workspaceUuid(), command.groupWorkspaceKey());
                        BusinessChannelPolicy.validateBinding(
                                template.accessKind(),
                                template.orderKind(),
                                template.providerCode(),
                                binding,
                                current.ownerNodeType(),
                                current.ownerNodeRef(),
                                true);
                    }
                    if (BusinessChannelPolicy.DRAFT.equals(targetStatus)
                            && !current.stopReasons().isEmpty()) {
                        throw problem(
                                "DISABLED_OBJECT_NOT_EDITABLE", 409, "stop reason recovery remains pending under C-01");
                    }
                    String reason =
                            BusinessChannelPolicy.DISABLED.equals(targetStatus) ? BusinessChannelPolicy.MANUAL : null;
                    boolean needsWrite = !Objects.equals(current.status(), targetStatus)
                            || (reason != null && !current.stopReasons().contains(reason));
                    ChannelRow result = current;
                    if (needsWrite) {
                        String reasonSql = reason == null
                                ? "stop_reasons"
                                : "CASE WHEN 'MANUAL' = ANY(stop_reasons) THEN stop_reasons "
                                        + "ELSE array_append(stop_reasons, 'MANUAL'::text) END";
                        long now = time.currentEpochMillis();
                        if (jdbc.update(
                                        "UPDATE business_channel.business_channel SET status=?, stop_reasons="
                                                + reasonSql
                                                + ", version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? "
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
                                List.of(
                                        change("status", current.status(), targetStatus),
                                        change("stopReason", null, reason)));
                        result = channelAfterStatusTransition(current, targetStatus, reason);
                    }
                    return channel(result);
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Channel returnChannelToDraftAfterBindingDeletion(
            ReturnChannelToDraftAfterBindingDeletionCommand command, long expectedVersion) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        if (command.channelRef() == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        String request = canonical(
                "return-channel-to-draft",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.channelRef(),
                expectedVersion);
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "returnChannelToDraftAfterBindingDeletion",
                request,
                BusinessChannelReadback.Channel.class,
                () -> {
                    ChannelRow current = readChannelForUpdate(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef());
                    requireVersion(current.version(), expectedVersion);
                    TemplateRow template = readTemplateRow(
                            command.workspaceUuid(), command.groupWorkspaceKey(), current.templateRef());
                    String fallbackStatus = BusinessChannelPolicy.INTERNAL.equals(template.accessKind())
                            ? BusinessChannelPolicy.EFFECTIVE
                            : BusinessChannelPolicy.DRAFT;
                    if (current.bindingRef() != null || !fallbackStatus.equals(current.status())) {
                        long now = time.currentEpochMillis();
                        if (jdbc.update(
                                        "UPDATE business_channel.business_channel SET binding_ref=null, "
                                                + "status=?, "
                                                + "version=version+1, updated_at_epoch_millis=? WHERE channel_ref=? "
                                                + "AND workspace_uuid=? AND group_workspace_key=? AND version=?",
                                        fallbackStatus,
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
                                List.of(
                                        change("bindingRef", current.bindingRef(), null),
                                        change("status", current.status(), fallbackStatus)));
                    }
                    return channel(
                            readChannelRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef()));
                });
    }

    @Override
    @Transactional
    public BusinessChannelReadback.Channel applyExternalStopReason(
            ApplyExternalStopReasonCommand command, long expectedVersion) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BusinessChannelPolicy.required(command.providerCode(), "providerCode", 120);
        ChannelRow initial = readChannelRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef());
        TemplateRow initialTemplate =
                readTemplateRow(command.workspaceUuid(), command.groupWorkspaceKey(), initial.templateRef());
        if (!BusinessChannelPolicy.EXTERNAL.equals(initialTemplate.accessKind())
                || !Objects.equals(initialTemplate.providerCode(), command.providerCode())) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "external stop provider does not match the channel");
        }
        String request = canonical(
                "apply-external-stop-reason",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.channelRef(),
                command.providerCode(),
                expectedVersion);
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "applyExternalStopReason",
                request,
                BusinessChannelReadback.Channel.class,
                () -> {
                    ChannelRow current = readChannelForUpdate(
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef());
                    requireVersion(current.version(), expectedVersion);
                    if (!current.stopReasons().contains(BusinessChannelPolicy.CASCADE_EXTERNAL)) {
                        long now = time.currentEpochMillis();
                        if (jdbc.update(
                                        "UPDATE business_channel.business_channel SET status='DISABLED', "
                                                + "stop_reasons=array_append(stop_reasons, 'CASCADE_EXTERNAL'::text), "
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
                                "EXTERNAL_STOP_APPLIED",
                                command.actor(),
                                CHANNEL_STATUS,
                                List.of(
                                        change("status", current.status(), BusinessChannelPolicy.DISABLED),
                                        change("stopReason", null, BusinessChannelPolicy.CASCADE_EXTERNAL)));
                    }
                    return channel(
                            readChannelRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.channelRef()));
                });
    }

    private CollaborationReadback.ProviderProfile providerFor(
            String accessKind, String providerCode, UUID workspaceUuid, String groupWorkspaceKey) {
        if (!BusinessChannelPolicy.EXTERNAL.equals(accessKind)) return null;
        return collaborationCatalog.readProviderProfile(workspaceUuid, groupWorkspaceKey, providerCode);
    }

    private void validateTemplateProvider(TemplateRow template, UUID workspaceUuid, String groupWorkspaceKey) {
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
                current.version() + 1);
    }

    private static ChannelRow channelAfterStatusTransition(ChannelRow current, String targetStatus, String reason) {
        List<String> stopReasons = current.stopReasons();
        if (reason != null && !stopReasons.contains(reason)) {
            List<String> updatedReasons = new ArrayList<>(stopReasons);
            updatedReasons.add(reason);
            stopReasons = List.copyOf(updatedReasons);
        }
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
                stopReasons,
                current.version() + 1);
    }

    private long cascadeTemplateStop(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, long now) {
        return jdbc.update(
                "UPDATE business_channel.business_channel SET status='DISABLED', "
                        + "stop_reasons=array_append(stop_reasons, 'CASCADE_TEMPLATE'::text), "
                        + "version=version+1, updated_at_epoch_millis=? WHERE workspace_uuid=? "
                        + "AND group_workspace_key=? AND template_ref=? "
                        + "AND NOT ('CASCADE_TEMPLATE' = ANY(stop_reasons))",
                now,
                workspaceUuid,
                groupWorkspaceKey,
                templateRef);
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
                result -> result.next() ? mapTemplate(result) : notFound("template"));
    }

    private TemplateRow readTemplateForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return jdbc.query(
                templateSelect("WHERE workspace_uuid=? AND group_workspace_key=? AND template_ref=? FOR UPDATE"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, templateRef);
                },
                result -> result.next() ? mapTemplate(result) : notFound("template"));
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
                result -> result.next() ? mapChannel(result) : notFound("channel"));
    }

    private ChannelRow readChannelForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return jdbc.query(
                channelSelect("WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? FOR UPDATE"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> result.next() ? mapChannel(result) : notFound("channel"));
    }

    private CommandChannelRow readCommandChannelRow(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef, boolean forUpdate) {
        String suffix = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"
                + (forUpdate ? " FOR UPDATE" : "");
        return jdbc.query(
                channelCommandSelect(suffix),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> result.next()
                        ? new CommandChannelRow(mapChannel(result), mapJoinedTemplate(result))
                        : notFound("channel"));
    }

    private static String templateSelect(String suffix) {
        return "SELECT template_ref, project_ref, template_name, template_code, access_kind, operator_kind, order_k"
                + "ind, "
                + "dine_in_form, provider_code, status, version FROM business_channel.business_channel_template "
                + suffix;
    }

    private static String channelSelect(String suffix) {
        return "SELECT c.channel_ref, c.template_ref, c.target_node_type, c.target_node_ref, c.channel_code, "
                + "c.channel_name, c.binding_ref, t.access_kind AS template_access_kind, c.status, c.stop_reasons, "
                + "c.version "
                + "FROM business_channel.business_channel c "
                + "JOIN business_channel.business_channel_template t "
                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                + "AND t.group_workspace_key=c.group_workspace_key "
                + suffix;
    }

    static String channelCommandSelect(String suffix) {
        return "SELECT c.channel_ref, c.template_ref, c.target_node_type, c.target_node_ref, c.channel_code, "
                + "c.channel_name, c.binding_ref, t.access_kind AS template_access_kind, c.status, c.stop_reasons, "
                + "c.version, t.project_ref AS template_project_ref, t.template_name, t.template_code, "
                + "t.operator_kind AS template_operator_kind, "
                + "t.order_kind AS template_order_kind, t.dine_in_form AS template_dine_in_form, "
                + "t.provider_code AS template_provider_code, t.status AS template_status, "
                + "t.version AS template_version "
                + "FROM business_channel.business_channel c "
                + "JOIN business_channel.business_channel_template t "
                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                + "AND t.group_workspace_key=c.group_workspace_key "
                + suffix;
    }

    private TemplateRow mapTemplate(ResultSet result, int rowNumber) throws SQLException {
        return mapTemplate(result);
    }

    private TemplateRow mapTemplate(ResultSet result) throws SQLException {
        return new TemplateRow(
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
                result.getLong("version"));
    }

    private ChannelRow mapChannel(ResultSet result, int rowNumber) throws SQLException {
        return mapChannel(result);
    }

    private ChannelRow mapChannel(ResultSet result) throws SQLException {
        return new ChannelRow(
                result.getObject("channel_ref", UUID.class),
                result.getObject("template_ref", UUID.class),
                result.getString("target_node_type"),
                result.getString("target_node_ref"),
                result.getString("channel_code"),
                result.getString("channel_name"),
                result.getObject("binding_ref", UUID.class),
                bindingStatus(result.getString("template_access_kind"), result.getObject("binding_ref", UUID.class)),
                result.getString("status"),
                reasons(result.getArray("stop_reasons")),
                result.getLong("version"));
    }

    private TemplateRow mapJoinedTemplate(ResultSet result) throws SQLException {
        return new TemplateRow(
                result.getObject("template_ref", UUID.class),
                result.getObject("template_project_ref", UUID.class),
                result.getString("template_name"),
                result.getString("template_code"),
                result.getString("template_access_kind"),
                result.getString("template_operator_kind"),
                result.getString("template_order_kind"),
                result.getString("template_dine_in_form"),
                result.getString("template_provider_code"),
                result.getString("template_status"),
                result.getLong("template_version"));
    }

    private static List<String> reasons(Array array) throws SQLException {
        if (array == null) return List.of();
        Object value = array.getArray();
        if (!(value instanceof Object[] values)) return List.of();
        return Arrays.stream(values)
                .filter(Objects::nonNull)
                .map(Object::toString)
                .toList();
    }

    private void ensureTemplateCodeAvailable(
            UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, String templateCode) {
        if (count(
                        "SELECT count(*) FROM business_channel.business_channel_template "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? AND template_"
                                + "code=?",
                        List.of(workspaceUuid, groupWorkspaceKey, projectRef, templateCode))
                > 0) {
            throw problem("DUPLICATE_CODE", 409, "templateCode is already used in the project");
        }
    }

    private void ensureChannelCodeAvailable(UUID workspaceUuid, String groupWorkspaceKey, String channelCode) {
        if (count(
                        "SELECT count(*) FROM business_channel.business_channel "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND channel_code=?",
                        List.of(workspaceUuid, groupWorkspaceKey, channelCode))
                > 0) {
            throw problem("DUPLICATE_CODE", 409, "channelCode is already used in the group workspace");
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

    private static String templateSortValue(TemplateRow row, String sortKey) {
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

    private static void requireEditable(String status) {
        if (BusinessChannelPolicy.DISABLED.equals(status)) {
            throw problem("DISABLED_OBJECT_NOT_EDITABLE", 409, "disabled object is not editable");
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
                row.stopReasons(),
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
                value.stopReasons(),
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
            List<String> stopReasons,
            long version) {}

    private record CommandChannelRow(ChannelRow channel, TemplateRow template) {}
}
