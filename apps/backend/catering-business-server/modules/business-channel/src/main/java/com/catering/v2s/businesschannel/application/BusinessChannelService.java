package com.catering.v2s.businesschannel.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateChannelCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.DetachChannelBindingCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.TransitionChannelStatusCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.UpdateChannelCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
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
public class BusinessChannelService {
    private static final String REQ_CREATE_CHANNEL = "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL";
    private static final String REQ_UPDATE_CHANNEL = "REQ_UPDATE_OPERATIONS_BUSINESS_CHANNEL";
    private static final String REQ_TRANSITION_CHANNEL = "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS";
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
    private final BusinessChannelTemplateService templateService;

    @Autowired
    public BusinessChannelService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            BusinessChannelTemplateService templateService) {
        this.jdbc = jdbc;
        this.time = time;
        this.collaborationCatalog = collaborationCatalog;
        this.collaborationBindings = collaborationBindings;
        this.workspaceStatuses = workspaceStatuses;
        this.receipts = receipts;
        this.templateService = Objects.requireNonNull(templateService, "templateService");
    }

    /**
     * Compatibility constructor for focused tests and direct owner construction. Production wiring uses the
     * aggregate services above.
     */
    public BusinessChannelService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            OrganizationOwnerApi organizationOwner,
            OrganizationTaskPathLookup organizationTaskPaths) {
        this(
                jdbc,
                time,
                collaborationCatalog,
                collaborationBindings,
                workspaceStatuses,
                receipts,
                new BusinessChannelTemplateService(
                        jdbc,
                        time,
                        collaborationCatalog,
                        collaborationBindings,
                        workspaceStatuses,
                        receipts,
                        organizationOwner,
                        organizationTaskPaths));
    }

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
                BusinessChannelQuerySupport.channelProjection("LEFT JOIN business_channel.business_channel_template t "
                                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                                + "AND t.group_workspace_key=c.group_workspace_key ")
                        + predicate
                        + " ORDER BY "
                        + channelOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?",
                append(arguments, BusinessChannelQuerySupport.BOUNDED_READ_LIMIT + 1),
                this::mapChannelProjection);
        if (projections.size() > BusinessChannelQuerySupport.BOUNDED_READ_LIMIT) {
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "bounded business-channel read exceeded its fixed source limit");
        }
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, projections);
        List<ChannelRow> rows = projections.stream()
                .map(projection -> channelRow(projection, facts))
                .toList();
        return new BusinessChannelReadback.ChannelPage(
                rows.stream().map(BusinessChannelService::channel).toList(), null, rows.size());
    }


    @Transactional(readOnly = true)
    public BusinessChannelReadback.Channel readChannel(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        return channel(readChannelRow(workspaceUuid, groupWorkspaceKey, channelRef));
    }


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
                            command.workspaceUuid(), command.groupWorkspaceKey(), command.templateRef(), channelCode);
                    requireEnabledTemplate(template.status());
                    CollaborationReadback.Tree collaborationTree = BusinessChannelPolicy.EXTERNAL.equals(
                                    template.accessKind())
                            ? collaborationCatalog.readTree(command.workspaceUuid(), command.groupWorkspaceKey())
                            : null;
                    validateTemplateProvider(
                            template, command.workspaceUuid(), command.groupWorkspaceKey(), collaborationTree);
                    BusinessChannelPolicy.validateTemplateTarget(
                            template.operatorKind(),
                            template.projectRef().toString(),
                            command.ownerNodeType(),
                            command.ownerNodeRef());
                    if (BusinessChannelPolicy.STORE.equals(command.ownerNodeType())) {
                        templateService.requireStoreChannelCreateEligibility(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.templateRef(),
                                template.projectRef(),
                                template.storeVisibilityScope(),
                                parseUuid(command.ownerNodeRef(), "ownerNodeRef"));
                    }
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
                    ensureChannelCodeAvailable(template.channelCodeInUse());
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
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            List.of(created),
                            collaborationTree);
                    return channel(channelRow(created, facts));
                });
    }


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
                            .filter(BusinessChannelService::isBlocker)
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
                        .filter(BusinessChannelService::isBlocker)
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
                            + BusinessChannelQuerySupport.insertedChannelProjection(),
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



    private TemplateCommandProjection readTemplateCommandProjection(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, String channelCode) {
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        return jdbc.query(
                "SELECT template.project_ref, template.access_kind, template.operator_kind, template.order_kind, "
                        + "template.dine_in_form, template.provider_code, template.store_visibility_scope, "
                        + "template.status, EXISTS (SELECT 1 "
                        + "FROM business_channel.business_channel channel "
                        + "WHERE channel.workspace_uuid=template.workspace_uuid "
                        + "AND channel.group_workspace_key=template.group_workspace_key "
                        + "AND channel.channel_code=? AND channel.status <> 'VOIDED') AS channel_code_in_use "
                        + "FROM business_channel.business_channel_template template "
                        + "WHERE template.workspace_uuid=? AND template.group_workspace_key=? "
                        + "AND template.template_ref=? FOR UPDATE",
                statement -> {
                    statement.setString(1, channelCode);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setObject(4, templateRef);
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
                            result.getString("store_visibility_scope"),
                            result.getString("status"),
                            result.getBoolean("channel_code_in_use"));
                });
    }



    private ChannelRow readChannelRow(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return jdbc.query(
                BusinessChannelQuerySupport.channelSelect(
                        "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) return notFound("channel");
                    ChannelProjection projection = mapChannelProjection(result);
                    return channelRow(
                            projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection)));
                });
    }



    private ChannelRow readChannelForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return jdbc.query(
                BusinessChannelQuerySupport.channelSelect(
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
                            projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection)));
                });
    }



    private CommandChannelRow readCommandChannelRow(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef, boolean forUpdate) {
        String suffix = "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"
                + (forUpdate ? " FOR UPDATE OF c" : "");
        return jdbc.query(
                BusinessChannelQuerySupport.channelCommandSelect(suffix),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) return notFound("channel");
                    ChannelProjection projection = mapChannelProjection(result);
                    StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection));
                    return new CommandChannelRow(channelRow(projection, facts), joinedTemplateRow(projection, facts));
                });
    }



    private StatusFacts statusFacts(
            UUID workspaceUuid, String groupWorkspaceKey, List<ChannelProjection> channels) {
        return statusFacts(workspaceUuid, groupWorkspaceKey, channels, null);
    }



    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<ChannelProjection> channels,
            CollaborationReadback.Tree preloadedTree) {
        String workspaceStatus = workspaceStatuses.requireStatus(workspaceUuid, groupWorkspaceKey);
        LinkedHashSet<UUID> organizationRefs = new LinkedHashSet<>();
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
                .filter(BusinessChannelService::isBlocker)
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
                .filter(BusinessChannelService::isBlocker)
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
                null,
                0,
                projection.templateStatus(),
                dimensions,
                blockers,
                projection.templateVersion());
    }
    private static UUID parseUuid(String value, String field) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException failure) {
            throw problem("VALIDATION_ERROR", 422, field + " is invalid", failure);
        }
    }



    private void ensureChannelCodeAvailable(boolean channelCodeInUse) {
        if (channelCodeInUse) {
            throw problem("DUPLICATE_CODE", 409, "channelCode is already used in the group workspace");
        }
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



    private static String optionalEnum(String value, String name, String... allowed) {
        if (value == null) return null;
        return BusinessChannelPolicy.requireEnum(value, name, allowed);
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
                row.storeVisibilityScope(),
                row.visibleStoreCount(),
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
