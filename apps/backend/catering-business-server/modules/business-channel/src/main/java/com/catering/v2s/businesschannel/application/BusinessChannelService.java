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
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelPersistence;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelPersistence.ChannelProjection;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelTemplatePersistence;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
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

    private final BusinessChannelPersistence channelPersistence;
    private final BusinessChannelTemplatePersistence templatePersistence;
    private final TimeProvider time;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final CollaborationBindingReadApi collaborationBindings;
    private final WorkspaceStatusLookup workspaceStatuses;
    private final BusinessChannelCommandReceiptService receipts;
    private final BusinessChannelTemplateService templateService;

    @Autowired
    public BusinessChannelService(
            BusinessChannelPersistence channelPersistence,
            BusinessChannelTemplatePersistence templatePersistence,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            BusinessChannelTemplateService templateService) {
        this.channelPersistence = channelPersistence;
        this.templatePersistence = templatePersistence;
        this.time = time;
        this.collaborationCatalog = collaborationCatalog;
        this.collaborationBindings = collaborationBindings;
        this.workspaceStatuses = workspaceStatuses;
        this.receipts = receipts;
        this.templateService = Objects.requireNonNull(templateService, "templateService");
    }

    /**
     * Compatibility constructor for focused tests and direct owner construction. Production wiring uses the aggregate
     * services above.
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
                new BusinessChannelPersistence(jdbc),
                new BusinessChannelTemplatePersistence(jdbc),
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
                sortKey, "sortKey", "CHANNEL_NAME", "CHANNEL_CODE", "TEMPLATE_NAME", "STATUS", "BINDING_STATUS");
        // spotless:on
        String normalizedSortDirection = optionalEnum(sortDirection, "sortDirection", "ASC", "DESC");
        if (normalizedSortKey == null && normalizedSortDirection != null) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection requires sortKey");
        }
        List<ChannelProjection> projections = channelPersistence.pageChannels(
                workspaceUuid,
                groupWorkspaceKey,
                ownerNodeType,
                ownerNodeRef,
                normalizedStatus,
                normalizedSortKey,
                normalizedSortDirection,
                BusinessChannelPersistence.BOUNDED_READ_LIMIT);
        if (projections.size() > BusinessChannelPersistence.BOUNDED_READ_LIMIT) {
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
        return channelPersistence
                .readChannelCommandContext(workspaceUuid, groupWorkspaceKey, channelRef)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "channel was not found in the workspace"));
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
                    BusinessChannelTemplatePersistence.TemplateCommandProjection template =
                            readTemplateCommandProjection(
                                    command.workspaceUuid(),
                                    command.groupWorkspaceKey(),
                                    command.templateRef(),
                                    channelCode);
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
                            command.workspaceUuid(), command.groupWorkspaceKey(), List.of(created), collaborationTree);
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
                    if (channelPersistence.updateChannel(
                                    command.channelRef(),
                                    command.workspaceUuid(),
                                    command.groupWorkspaceKey(),
                                    command.channelName(),
                                    command.bindingRef(),
                                    time.currentEpochMillis(),
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
                        if (channelPersistence.transitionChannel(
                                        command.channelRef(),
                                        command.workspaceUuid(),
                                        command.groupWorkspaceKey(),
                                        targetStatus,
                                        now,
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
                        if (channelPersistence.detachChannel(
                                        command.channelRef(),
                                        command.workspaceUuid(),
                                        command.groupWorkspaceKey(),
                                        now,
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
                dimensions.stream().filter(BusinessChannelService::isBlocker).toList(),
                current.version() + 1);
    }

    private ChannelProjection insertChannelReturningProjection(
            BusinessChannelCommandApi.CreateChannelCommand command,
            UUID channelRef,
            String channelCode,
            String initialStatus,
            long now) {
        try {
            return channelPersistence.insertChannel(command, channelRef, channelCode, initialStatus, now);
        } catch (DuplicateKeyException failure) {
            throw problem("DUPLICATE_CODE", 409, "channelCode is already used in the group workspace", failure);
        }
    }

    private BusinessChannelTemplatePersistence.TemplateCommandProjection readTemplateCommandProjection(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef, String channelCode) {
        if (templateRef == null) throw problem("VALIDATION_ERROR", 422, "templateRef is required");
        return templatePersistence
                .readTemplateCommandProjection(workspaceUuid, groupWorkspaceKey, templateRef, channelCode)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "template was not found in the workspace"));
    }

    private ChannelRow readChannelRow(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        ChannelProjection projection = channelPersistence
                .readChannel(workspaceUuid, groupWorkspaceKey, channelRef, false)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "channel was not found in the workspace"));
        return channelRow(projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection)));
    }

    private ChannelRow readChannelForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        ChannelProjection projection = channelPersistence
                .readChannel(workspaceUuid, groupWorkspaceKey, channelRef, true)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "channel was not found in the workspace"));
        return channelRow(projection, statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection)));
    }

    private CommandChannelRow readCommandChannelRow(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef, boolean forUpdate) {
        ChannelProjection projection = channelPersistence
                .readCommandChannel(workspaceUuid, groupWorkspaceKey, channelRef, forUpdate)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "channel was not found in the workspace"));
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection));
        return new CommandChannelRow(channelRow(projection, facts), joinedTemplateRow(projection, facts));
    }

    private StatusFacts statusFacts(UUID workspaceUuid, String groupWorkspaceKey, List<ChannelProjection> channels) {
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
        List<BusinessChannelReadback.StatusDimension> blockers =
                dimensions.stream().filter(BusinessChannelService::isBlocker).toList();
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
        return channelPersistence.readOrganizationAncestors(workspaceUuid, groupWorkspaceKey, nodeRefs);
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
        List<BusinessChannelReadback.StatusDimension> blockers =
                dimensions.stream().filter(BusinessChannelService::isBlocker).toList();
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

    private static String optionalEnum(String value, String name, String... allowed) {
        if (value == null) return null;
        return BusinessChannelPolicy.requireEnum(value, name, allowed);
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
        channelPersistence.recordAudit(
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
