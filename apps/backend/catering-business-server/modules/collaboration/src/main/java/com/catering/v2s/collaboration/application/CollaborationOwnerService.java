package com.catering.v2s.collaboration.application;

import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.BindingPageRow;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.BindingRow;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.AuditRecord;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.EnablementKind;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.EnablementRow;
import com.catering.v2s.collaboration.application.persistence.CollaborationOwnerPersistence.EnablementSnapshot;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Collaboration owner for workspace enablement and owner_binding facts.
 *
 * <p>This class has no business-channel dependency. Cross-domain cascade and channel detachment stay in the edge and
 * the business-channel owner; this service only returns its own readback.
 */
@Service
public class CollaborationOwnerService
        implements CollaborationCatalogReadApi, CollaborationBindingReadApi, CollaborationCommandApi {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String ENABLED = "ENABLED";
    private static final String DISABLED = "DISABLED";
    private static final String DELETED = "DELETED";
    private static final String INVALID = "INVALID";
    private static final String REQUIRES_ADAPTER_UNBIND = "REQUIRES_ADAPTER_UNBIND";
    private static final String REQ_BINDING_CREATE = "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE";
    private static final String REQ_BINDING_DELETE = "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_DELETE";
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_QUERY_TEXT_LENGTH = 120;

    private static final AuditChangePolicy ENABLEMENT_CHANGED =
            new AuditChangePolicy("COLLABORATION_ENABLEMENT", "STATUS_CHANGED", java.util.Set.of("status"));
    private static final AuditChangePolicy BINDING_CREATED = new AuditChangePolicy(
            "COLLABORATION_BINDING",
            "BINDING_CREATED",
            java.util.Set.of("providerCode", "capabilityClass", "nodeType", "nodeRef", "bindingDisplayName", "status"));
    private static final AuditChangePolicy BINDING_UPDATED = new AuditChangePolicy(
            "COLLABORATION_BINDING", "BINDING_UPDATED", java.util.Set.of("bindingDisplayName", "externalOwnerId"));
    private static final AuditChangePolicy BINDING_DELETED =
            new AuditChangePolicy("COLLABORATION_BINDING", "BINDING_DELETED", java.util.Set.of("status", "deletedAt"));
    private static final AuditChangePolicy AUTHORIZATION_APPLIED = new AuditChangePolicy(
            "COLLABORATION_BINDING", "AUTHORIZATION_APPLIED", java.util.Set.of("status", "externalOwnerId"));
    private static final AuditChangePolicy REVOCATION_APPLIED = new AuditChangePolicy(
            "COLLABORATION_BINDING", "REVOCATION_APPLIED", java.util.Set.of("status", "externalRevokedAt"));

    private final CollaborationOwnerPersistence persistence;
    private final CollaborationCatalogSource catalog;
    private final PlatformGovernanceAuthorization platformAuthorization;
    private final CollaborationCommandReceiptService receipts;

    public CollaborationOwnerService(
            CollaborationOwnerPersistence persistence,
            CollaborationCatalogSource catalog,
            PlatformGovernanceAuthorization platformAuthorization,
            CollaborationCommandReceiptService receipts) {
        this.persistence = persistence;
        this.catalog = catalog;
        this.platformAuthorization = platformAuthorization;
        this.receipts = receipts;
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.ExternalSystem readExternalSystem(
            UUID workspaceUuid, String groupWorkspaceKey, String externalSystemCode) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        CollaborationCatalogSource.ExternalSystemDefinition definition = requireExternalSystem(externalSystemCode);
        return externalSystemReadback(
                definition,
                persistence.readEnablement(
                        EnablementKind.EXTERNAL_SYSTEM, workspaceUuid, groupWorkspaceKey, externalSystemCode));
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.ProviderProfile readProviderProfile(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        CollaborationCatalogSource.ProviderProfileDefinition definition = requireProviderProfile(providerCode);
        return providerReadback(
                definition,
                persistence.readEnablement(
                        EnablementKind.PROVIDER_PROFILE, workspaceUuid, groupWorkspaceKey, providerCode));
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.Tree readTree(UUID workspaceUuid, String groupWorkspaceKey) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        List<EnablementSnapshot> snapshots = persistence.readTree(workspaceUuid, groupWorkspaceKey);
        Map<String, EnablementRow> systems = snapshots.stream()
                .filter(snapshot -> "EXTERNAL_SYSTEM".equals(snapshot.kind()))
                .collect(Collectors.toUnmodifiableMap(EnablementSnapshot::code, EnablementSnapshot::enablement));
        Map<String, EnablementRow> providers = snapshots.stream()
                .filter(snapshot -> "PROVIDER_PROFILE".equals(snapshot.kind()))
                .collect(Collectors.toUnmodifiableMap(EnablementSnapshot::code, EnablementSnapshot::enablement));
        List<CollaborationReadback.ExternalSystem> systemReadbacks = catalog.externalSystems().stream()
                .map(definition -> externalSystemReadback(definition, systems.get(definition.externalSystemCode())))
                .toList();
        List<CollaborationReadback.ProviderProfile> providerReadbacks = catalog.providerProfiles().stream()
                .map(definition -> providerReadback(definition, providers.get(definition.providerCode())))
                .toList();
        return new CollaborationReadback.Tree(systemReadbacks, providerReadbacks);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CollaborationReadback.ProviderProfile> listEnabledProviderProfiles(
            UUID workspaceUuid, String groupWorkspaceKey, String capabilityClass, String nodeType) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedCapability = CollaborationBindingPolicy.optional(capabilityClass);
        String normalizedNodeType = CollaborationBindingPolicy.optional(nodeType);
        Map<String, EnablementRow> providers =
                persistence.readEnablements(EnablementKind.PROVIDER_PROFILE, workspaceUuid, groupWorkspaceKey);
        return catalog.providerProfiles().stream()
                .filter(definition -> ENABLED.equals(status(providers.get(definition.providerCode()))))
                .filter(definition -> normalizedCapability == null
                        || definition.businessScope().contains(normalizedCapability))
                .filter(definition -> normalizedNodeType == null
                        || definition.bindableNodeTypes().contains(normalizedNodeType))
                .map(definition -> providerReadback(definition, providers.get(definition.providerCode())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.OwnerBinding readBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        return ownerBinding(readBindingRow(workspaceUuid, groupWorkspaceKey, bindingRef));
    }

    /** Reads the provider binding page with filtering, total counting and pagination performed by SQL. */
    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.OwnerBindingPage pageBindings(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String bindingName,
            String nodeQueryText,
            String sortKey,
            String sortDirection,
            int page,
            int pageSize) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedProvider = CollaborationBindingPolicy.required(providerCode, "providerCode");
        String normalizedBindingName = queryText(bindingName, "bindingName");
        String normalizedNodeQueryText = queryText(nodeQueryText, "nodeQueryText");
        String normalizedSortKey = normalizeSortKey(sortKey);
        String normalizedSortDirection = normalizeSortDirection(sortDirection);
        int normalizedPage = page == 0 ? 1 : page;
        if (normalizedPage < 1) throw problem("VALIDATION_ERROR", 422, "page must be at least 1");
        int normalizedPageSize = pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
        if (normalizedPageSize < 1 || normalizedPageSize > MAX_PAGE_SIZE)
            throw problem("VALIDATION_ERROR", 422, "pageSize must be between 1 and 100");
        long offset = ((long) normalizedPage - 1L) * normalizedPageSize;
        List<BindingPageRow> rows = persistence.pageBindings(
                workspaceUuid,
                groupWorkspaceKey,
                normalizedProvider,
                normalizedBindingName,
                normalizedNodeQueryText,
                normalizedSortKey,
                normalizedSortDirection,
                normalizedPageSize,
                offset);
        long total = rows.isEmpty() ? 0L : rows.get(0).total();
        return new CollaborationReadback.OwnerBindingPage(
                rows.stream()
                        .map(row -> ownerBinding(row.binding(), parseNodePath(row.nodePathJson())))
                        .toList(),
                new CollaborationReadback.OwnerBindingPage.Metadata(
                        normalizedBindingName,
                        normalizedNodeQueryText,
                        normalizedSortKey,
                        normalizedSortDirection,
                        normalizedPage,
                        normalizedPageSize,
                        total));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CollaborationReadback.OwnerBinding> findBindingsForNode(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode, String nodeType, String nodeRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedProvider = CollaborationBindingPolicy.required(providerCode, "providerCode");
        String normalizedNodeType = CollaborationBindingPolicy.required(nodeType, "nodeType");
        String normalizedNodeRef = CollaborationBindingPolicy.required(nodeRef, "nodeRef");
        return persistence
                .findBindingsForNode(
                        workspaceUuid, groupWorkspaceKey, normalizedProvider, normalizedNodeType, normalizedNodeRef)
                .stream()
                .map(this::ownerBinding)
                .toList();
    }

    @Override
    @Transactional
    public CollaborationReadback.ExternalSystem transitionExternalSystemStatus(
            TransitionExternalSystemStatusCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        platformAuthorization.requireEnabledPlatformAdministrator(command.actor());
        String code = CollaborationBindingPolicy.required(command.externalSystemCode(), "externalSystemCode");
        String targetStatus = requireEnablementStatus(command.status());
        CollaborationCatalogSource.ExternalSystemDefinition definition = requireExternalSystem(code);
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "transitionPlatformExternalSystemStatus",
                canonical(
                        "external-system",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        code,
                        targetStatus,
                        command.expectedVersion()),
                CollaborationReadback.ExternalSystem.class,
                () -> externalSystemReadback(
                        definition,
                        transitionEnablement(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                code,
                                targetStatus,
                                command.expectedVersion(),
                                command.actor(),
                                EnablementKind.EXTERNAL_SYSTEM)));
    }

    @Override
    @Transactional
    public CollaborationReadback.ProviderProfile transitionProviderProfileStatus(
            TransitionProviderProfileStatusCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        platformAuthorization.requireEnabledPlatformAdministrator(command.actor());
        String code = CollaborationBindingPolicy.required(command.providerCode(), "providerCode");
        String targetStatus = requireEnablementStatus(command.status());
        CollaborationCatalogSource.ProviderProfileDefinition definition = requireProviderProfile(code);
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "transitionPlatformProviderProfileStatus",
                canonical(
                        "provider-profile",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        code,
                        targetStatus,
                        command.expectedVersion()),
                CollaborationReadback.ProviderProfile.class,
                () -> providerReadback(
                        definition,
                        transitionEnablement(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                code,
                                targetStatus,
                                command.expectedVersion(),
                                command.actor(),
                                EnablementKind.PROVIDER_PROFILE)));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding createPlatformBinding(CreatePlatformBindingCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        platformAuthorization.requireEnabledPlatformAdministrator(command.actor());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(command.providerCode());
        CollaborationBindingPolicy.validatePlatformCreate(provider);
        CollaborationBindingPolicy.CreateShape shape = CollaborationBindingPolicy.validateCreate(
                provider, command.capabilityClass(), command.nodeType(), command.nodeRef(), command.externalOwnerId());
        requireProviderEnabled(command.workspaceUuid(), command.groupWorkspaceKey(), provider.providerCode());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "createPlatformOwnerBinding",
                canonical(
                        "platform-create-binding",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        provider.providerCode(),
                        shape.capabilityClass(),
                        shape.nodeType(),
                        shape.nodeRef(),
                        command.bindingDisplayName(),
                        shape.externalOwnerId()),
                CollaborationReadback.OwnerBinding.class,
                () -> insertBinding(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        provider,
                        shape,
                        command.bindingDisplayName(),
                        command.actor()));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding createOperationsBinding(CreateOperationsBindingCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(command.providerCode());
        CollaborationBindingPolicy.CreateShape shape = CollaborationBindingPolicy.validateCreate(
                provider, command.capabilityClass(), command.nodeType(), command.nodeRef(), command.externalOwnerId());
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                shape.nodeType(),
                shape.nodeRef(),
                REQ_BINDING_CREATE);
        requireProviderEnabled(command.workspaceUuid(), command.groupWorkspaceKey(), provider.providerCode());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "createOperationsOwnerBinding",
                canonical(
                        "operations-create-binding",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        provider.providerCode(),
                        shape.capabilityClass(),
                        shape.nodeType(),
                        shape.nodeRef(),
                        command.bindingDisplayName(),
                        shape.externalOwnerId(),
                        command.contextVersion()),
                CollaborationReadback.OwnerBinding.class,
                () -> insertBinding(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        provider,
                        shape,
                        command.bindingDisplayName(),
                        command.actor()));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding updatePlatformBinding(UpdatePlatformBindingCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        platformAuthorization.requireEnabledPlatformAdministrator(command.actor());
        BindingRow existing =
                readBindingRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(existing.providerCode());
        String ownerId = CollaborationBindingPolicy.validateUpdate(provider, command.externalOwnerId());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "updatePlatformOwnerBinding",
                canonical(
                        "platform-update-binding",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.bindingRef(),
                        command.bindingDisplayName(),
                        ownerId,
                        command.expectedVersion()),
                CollaborationReadback.OwnerBinding.class,
                () -> updateBinding(
                        existing,
                        provider,
                        command.bindingDisplayName(),
                        ownerId,
                        command.expectedVersion(),
                        command.actor()));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding requestOrDeletePlatformBinding(DeletePlatformBindingCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        platformAuthorization.requireEnabledPlatformAdministrator(command.actor());
        BindingRow existing =
                readBindingRowForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(existing.providerCode());
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "deletePlatformOwnerBinding",
                canonical(
                        "platform-delete-binding",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.bindingRef(),
                        command.expectedVersion()),
                CollaborationReadback.OwnerBinding.class,
                () -> deleteBinding(existing, provider, command.expectedVersion(), command.actor()));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding requestOrDeleteOperationsBinding(DeleteOperationsBindingCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BindingRow existing =
                readBindingRowForUpdate(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(existing.providerCode());
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                existing.nodeType(),
                existing.nodeRef(),
                REQ_BINDING_DELETE);
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "deleteOperationsOwnerBinding",
                canonical(
                        "operations-delete-binding",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.bindingRef(),
                        command.expectedVersion(),
                        command.contextVersion()),
                CollaborationReadback.OwnerBinding.class,
                () -> deleteBinding(existing, provider, command.expectedVersion(), command.actor()));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding applyAuthorizationCallback(AuthorizationCallbackCommand command) {
        String ownerId = CollaborationBindingPolicy.required(command.externalOwnerId(), "externalOwnerId");
        String authorizationReference =
                CollaborationBindingPolicy.required(command.authorizationReference(), "authorizationReference");
        requireAdapterIdentity(command.adapterIdentity());
        BindingRow existing = readBindingByReference(command.bindingRef());
        return receipts.execute(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                command.idempotencyKey(),
                "applyAuthorizationCallback",
                canonical(
                        "authorization-callback",
                        command.bindingRef(),
                        ownerId,
                        com.catering.v2s.platform.foundation.security.Sha256Hex.digest(authorizationReference)),
                CollaborationReadback.OwnerBinding.class,
                () -> applyAuthorization(existing, ownerId, authorizationReference));
    }

    @Override
    @Transactional
    public CollaborationReadback.OwnerBinding applyRevocationCallback(RevocationCallbackCommand command) {
        requireAdapterIdentity(command.adapterIdentity());
        BindingRow existing = readBindingByReference(command.bindingRef());
        return receipts.execute(
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                command.idempotencyKey(),
                "applyRevocationCallback",
                canonical(
                        "revocation-callback",
                        command.bindingRef(),
                        com.catering.v2s.platform.foundation.security.Sha256Hex.digest(command.adapterIdentity())),
                CollaborationReadback.OwnerBinding.class,
                () -> applyRevocation(existing));
    }

    private EnablementRow transitionEnablement(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String targetStatus,
            long expectedVersion,
            AuditActor actor,
            EnablementKind kind) {
        persistence.lockEnablement(kind, workspaceUuid, groupWorkspaceKey, code);
        EnablementRow current = persistence.readEnablementForUpdate(kind, workspaceUuid, groupWorkspaceKey, code);
        long currentVersion = current == null ? 0L : current.version();
        if (currentVersion != expectedVersion) throw problem("VERSION_CONFLICT", 409, "enablement version has changed");
        if (current == null && DISABLED.equals(targetStatus)) return null;
        if (current == null) {
            persistence.insertEnablement(kind, workspaceUuid, groupWorkspaceKey, code, targetStatus);
        } else if (persistence.updateEnablement(
                        kind, workspaceUuid, groupWorkspaceKey, code, targetStatus, expectedVersion)
                != 1) throw problem("VERSION_CONFLICT", 409, "enablement version has changed");
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                code,
                kind == EnablementKind.EXTERNAL_SYSTEM ? "EXTERNAL_SYSTEM" : "PROVIDER_PROFILE",
                "STATUS_CHANGED",
                actor,
                ENABLEMENT_CHANGED,
                List.of(new AuditChange("status", current == null ? null : current.status(), targetStatus)));
        return persistence.readEnablement(kind, workspaceUuid, groupWorkspaceKey, code);
    }

    private CollaborationReadback.OwnerBinding insertBinding(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            CollaborationCatalogSource.ProviderProfileDefinition provider,
            CollaborationBindingPolicy.CreateShape shape,
            String bindingDisplayName,
            AuditActor actor) {
        BindingRow created = persistence.insertBinding(
                workspaceUuid,
                groupWorkspaceKey,
                provider.externalSystemCode(),
                provider.providerCode(),
                shape.capabilityClass(),
                shape.nodeType(),
                shape.nodeRef(),
                CollaborationBindingPolicy.optional(bindingDisplayName),
                shape.externalOwnerId(),
                shape.initialStatus());
        if (created == null) throw problem("NOT_FOUND", 404, "binding was not created");
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                created.bindingRef().toString(),
                "OWNER_BINDING",
                "BINDING_CREATED",
                actor,
                BINDING_CREATED,
                List.of(
                        new AuditChange("providerCode", null, created.providerCode()),
                        new AuditChange("capabilityClass", null, created.capabilityClass()),
                        new AuditChange("nodeType", null, created.nodeType()),
                        new AuditChange("nodeRef", null, created.nodeRef()),
                        new AuditChange("bindingDisplayName", null, created.bindingDisplayName()),
                        new AuditChange("status", null, created.status())));
        return ownerBinding(created);
    }

    private CollaborationReadback.OwnerBinding updateBinding(
            BindingRow initial,
            CollaborationCatalogSource.ProviderProfileDefinition provider,
            String bindingDisplayName,
            String externalOwnerId,
            long expectedVersion,
            AuditActor actor) {
        BindingRow current =
                readBindingRowForUpdate(initial.workspaceUuid(), initial.groupWorkspaceKey(), initial.bindingRef());
        if (DELETED.equals(current.status())) {
            throw problem("BINDING_EDIT_NOT_ALLOWED", 403, "deleted binding is immutable");
        }
        String ownerId = CollaborationBindingPolicy.validateUpdate(provider, externalOwnerId);
        if (current.version() != expectedVersion) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        String normalizedDisplayName = CollaborationBindingPolicy.optional(bindingDisplayName);
        if (persistence.updateBinding(
                        current.bindingRef(),
                        current.workspaceUuid(),
                        current.groupWorkspaceKey(),
                        normalizedDisplayName,
                        ownerId,
                        expectedVersion)
                != 1) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        BindingRow updated = readBindingRow(current.workspaceUuid(), current.groupWorkspaceKey(), current.bindingRef());
        audit(
                current.workspaceUuid(),
                current.groupWorkspaceKey(),
                current.bindingRef().toString(),
                "OWNER_BINDING",
                "BINDING_UPDATED",
                actor,
                BINDING_UPDATED,
                List.of(
                        new AuditChange(
                                "bindingDisplayName", current.bindingDisplayName(), updated.bindingDisplayName()),
                        new AuditChange("externalOwnerId", current.externalOwnerId(), updated.externalOwnerId())));
        return ownerBinding(updated);
    }

    private CollaborationReadback.OwnerBinding deleteBinding(
            BindingRow initial,
            CollaborationCatalogSource.ProviderProfileDefinition provider,
            long expectedVersion,
            AuditActor actor) {
        if (DELETED.equals(initial.status())) return ownerBinding(initial);
        if (initial.version() != expectedVersion) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        if (REQUIRES_ADAPTER_UNBIND.equals(provider.unbindKind()) && initial.externalRevokedAt() == null) {
            throw problem("ADAPTER_UNBIND_REQUIRED", 409, "adapter revocation is required before deletion");
        }
        BindingRow deleted = persistence.deleteBinding(
                initial.bindingRef(), initial.workspaceUuid(), initial.groupWorkspaceKey(), expectedVersion);
        if (deleted == null) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        audit(
                initial.workspaceUuid(),
                initial.groupWorkspaceKey(),
                initial.bindingRef().toString(),
                "OWNER_BINDING",
                "BINDING_DELETED",
                actor,
                BINDING_DELETED,
                List.of(
                        new AuditChange("status", initial.status(), DELETED),
                        new AuditChange("deletedAt", null, Long.toString(deleted.deletedAt()))));
        return ownerBinding(deleted);
    }

    private CollaborationReadback.OwnerBinding applyAuthorization(
            BindingRow initial, String externalOwnerId, String authorizationReference) {
        BindingRow current =
                readBindingRowForUpdate(initial.workspaceUuid(), initial.groupWorkspaceKey(), initial.bindingRef());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(current.providerCode());
        if (!CollaborationBindingPolicy.EXTERNAL_GRANT.equals(provider.authenticationKind())) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "authorization callback is only valid for EXTERNAL_GRANT");
        }
        if (DELETED.equals(current.status())) {
            throw problem("BINDING_EDIT_NOT_ALLOWED", 403, "deleted binding is immutable");
        }
        if (!CollaborationBindingPolicy.PENDING_AUTHORIZATION.equals(current.status())
                && !CollaborationBindingPolicy.EFFECTIVE.equals(current.status())) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "binding is not awaiting authorization");
        }
        if (CollaborationBindingPolicy.EFFECTIVE.equals(current.status())) {
            if (!Objects.equals(current.externalOwnerId(), externalOwnerId))
                throw problem("EXTERNAL_OWNER_ID_MISMATCH", 422, "effective binding owner does not match callback");
            return ownerBinding(current);
        }
        if (persistence.applyAuthorization(
                        current.bindingRef(), externalOwnerId, authorizationReference, current.version())
                != 1) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        BindingRow updated = readBindingRow(current.workspaceUuid(), current.groupWorkspaceKey(), current.bindingRef());
        audit(
                current.workspaceUuid(),
                current.groupWorkspaceKey(),
                current.bindingRef().toString(),
                "OWNER_BINDING",
                "AUTHORIZATION_APPLIED",
                AuditActor.system(),
                AUTHORIZATION_APPLIED,
                List.of(
                        new AuditChange("status", current.status(), CollaborationBindingPolicy.EFFECTIVE),
                        new AuditChange("externalOwnerId", current.externalOwnerId(), updated.externalOwnerId())));
        return ownerBinding(updated);
    }

    private CollaborationReadback.OwnerBinding applyRevocation(BindingRow initial) {
        BindingRow current =
                readBindingRowForUpdate(initial.workspaceUuid(), initial.groupWorkspaceKey(), initial.bindingRef());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(current.providerCode());
        if (!REQUIRES_ADAPTER_UNBIND.equals(provider.unbindKind())) {
            throw problem("INVALID_CALLBACK_STATE", 409, "provider does not use adapter revocation");
        }
        if (DELETED.equals(current.status())) return ownerBinding(current);
        if (current.externalRevokedAt() != null && INVALID.equals(current.status())) return ownerBinding(current);
        if (persistence.applyRevocation(current.bindingRef(), current.version())
                != 1) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        BindingRow updated = readBindingRow(current.workspaceUuid(), current.groupWorkspaceKey(), current.bindingRef());
        audit(
                current.workspaceUuid(),
                current.groupWorkspaceKey(),
                current.bindingRef().toString(),
                "OWNER_BINDING",
                "REVOCATION_APPLIED",
                AuditActor.system(),
                REVOCATION_APPLIED,
                List.of(
                        new AuditChange("status", current.status(), INVALID),
                        new AuditChange(
                                "externalRevokedAt", null, Objects.toString(updated.externalRevokedAt(), null))));
        return ownerBinding(updated);
    }

    private void requireOperationsGrant(
            OperationsOwnerScopeGrant grant,
            long contextVersion,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            String nodeRef,
            String requirementId) {
        String capability = CollaborationBindingPolicy.requiredOperationsCapability(nodeType);
        UUID targetId = parseTargetId(nodeRef);
        if (!grant.matchesExpectedContextVersion(contextVersion)
                || !grant.matchesRequirementAndCapability(
                        workspaceUuid, groupWorkspaceKey, nodeType, targetId, requirementId, capability)) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations owner grant does not match command context");
        }
    }

    private static UUID parseTargetId(String nodeRef) {
        try {
            return UUID.fromString(CollaborationBindingPolicy.required(nodeRef, "nodeRef"));
        } catch (IllegalArgumentException failure) {
            throw problem("AUTHORIZATION_REQUIRED", 409, "operations target reference is not server-resolved", failure);
        }
    }

    private BindingRow readBindingRow(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        return requireBinding(persistence.readBinding(workspaceUuid, groupWorkspaceKey, bindingRef));
    }

    private BindingRow readBindingRowForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        return requireBinding(persistence.readBindingForUpdate(workspaceUuid, groupWorkspaceKey, bindingRef));
    }

    private BindingRow readBindingByReference(UUID bindingRef) {
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        return requireBinding(persistence.readBindingByReference(bindingRef));
    }

    private CollaborationCatalogSource.ExternalSystemDefinition requireExternalSystem(String code) {
        String normalized = CollaborationBindingPolicy.required(code, "externalSystemCode");
        CollaborationCatalogSource.ExternalSystemDefinition definition = catalog.externalSystem(normalized);
        if (definition == null) throw problem("CATALOG_NOT_FOUND", 404, "external system is not in contract catalogue");
        return definition;
    }

    private CollaborationCatalogSource.ProviderProfileDefinition requireProviderProfile(String code) {
        String normalized = CollaborationBindingPolicy.required(code, "providerCode");
        CollaborationCatalogSource.ProviderProfileDefinition definition = catalog.providerProfile(normalized);
        if (definition == null) {
            throw problem("CATALOG_NOT_FOUND", 404, "provider profile is not in contract catalogue");
        }
        return definition;
    }

    private void requireProviderEnabled(UUID workspaceUuid, String groupWorkspaceKey, String providerCode) {
        EnablementRow enablement = persistence.readEnablement(
                EnablementKind.PROVIDER_PROFILE, workspaceUuid, groupWorkspaceKey, providerCode);
        if (!ENABLED.equals(status(enablement))) {
            throw problem("PROVIDER_NOT_ENABLED", 422, "provider profile is not enabled for this workspace");
        }
    }

    private static CollaborationReadback.ExternalSystem externalSystemReadback(
            CollaborationCatalogSource.ExternalSystemDefinition definition, EnablementRow enablement) {
        return new CollaborationReadback.ExternalSystem(
                definition.externalSystemCode(),
                definition.displayName(),
                definition.catalogStatus(),
                definition.capabilities().stream()
                        .map(value -> new CollaborationReadback.Capability(
                                value.capabilityClass(), value.displayName(), value.attributeValues()))
                        .toList(),
                status(enablement),
                version(enablement));
    }

    private CollaborationReadback.ProviderProfile providerReadback(
            CollaborationCatalogSource.ProviderProfileDefinition definition, EnablementRow enablement) {
        return new CollaborationReadback.ProviderProfile(
                definition.providerCode(),
                definition.displayName(),
                definition.externalSystemCode(),
                catalogExternalSystemDisplayName(definition.externalSystemCode()),
                definition.businessScope(),
                definition.bindableNodeTypes(),
                definition.authenticationKind(),
                definition.unbindKind(),
                definition.catalogStatus(),
                status(enablement),
                version(enablement));
    }

    private CollaborationReadback.OwnerBinding ownerBinding(BindingRow row) {
        return ownerBinding(row, readNodePath(row));
    }

    private CollaborationReadback.OwnerBinding ownerBinding(
            BindingRow row, List<CollaborationReadback.OrganizationPathNode> nodePath) {
        CollaborationCatalogSource.ProviderProfileDefinition provider = catalog.providerProfile(row.providerCode());
        return new CollaborationReadback.OwnerBinding(
                row.bindingRef(),
                row.providerCode(),
                provider == null ? row.providerCode() : provider.displayName(),
                row.capabilityClass(),
                provider == null ? List.of() : provider.businessScope(),
                row.nodeType(),
                row.nodeRef(),
                nodePath,
                row.bindingDisplayName(),
                row.externalOwnerId(),
                row.createdAt(),
                row.statusChangedAt(),
                row.status(),
                row.version());
    }

    private String catalogExternalSystemDisplayName(String externalSystemCode) {
        CollaborationCatalogSource.ExternalSystemDefinition system = catalog.externalSystem(externalSystemCode);
        return system == null ? externalSystemCode : system.displayName();
    }

    private List<CollaborationReadback.OrganizationPathNode> readNodePath(BindingRow row) {
        return parseNodePath(persistence.readNodePath(row));
    }

    private static List<CollaborationReadback.OrganizationPathNode> parseNodePath(String value) {
        if (value == null || value.isBlank()) return List.of();
        try {
            JsonNode nodes = JSON.readTree(value);
            if (nodes == null || !nodes.isArray()) throw new IllegalStateException("owner node path is not an array");
            List<CollaborationReadback.OrganizationPathNode> result = new ArrayList<>();
            for (JsonNode node : nodes) {
                if (!node.isObject()) throw new IllegalStateException("owner node path contains a non-object");
                result.add(new CollaborationReadback.OrganizationPathNode(
                        UUID.fromString(requiredNodeText(node, "ref")),
                        requiredNodeText(node, "code"),
                        requiredNodeText(node, "name"),
                        requiredNodeText(node, "nodeType")));
            }
            return List.copyOf(result);
        } catch (IllegalStateException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalStateException("owner node path cannot be decoded", failure);
        }
    }

    private static String requiredNodeText(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            throw new IllegalStateException("owner node path field is missing: " + field);
        }
        return value.asText();
    }

    private static String status(EnablementRow row) {
        return row == null ? DISABLED : row.status();
    }

    private static long version(EnablementRow row) {
        return row == null ? 0L : row.version();
    }

    private static void requireScope(UUID workspaceUuid, String groupWorkspaceKey) {
        if (workspaceUuid == null) throw problem("VALIDATION_ERROR", 422, "workspaceUuid is required");
        CollaborationBindingPolicy.required(groupWorkspaceKey, "groupWorkspaceKey");
    }

    private static String requireEnablementStatus(String value) {
        String normalized = CollaborationBindingPolicy.required(value, "status");
        if (!ENABLED.equals(normalized) && !DISABLED.equals(normalized))
            throw problem("VALIDATION_ERROR", 422, "status is not an enablement status");
        return normalized;
    }

    private static void requireAdapterIdentity(String adapterIdentity) {
        String normalized = CollaborationBindingPolicy.required(adapterIdentity, "adapterIdentity");
        if (normalized.length() > 160) throw problem("VALIDATION_ERROR", 422, "adapterIdentity is too long");
    }

    private static String queryText(String value, String fieldName) {
        String normalized = CollaborationBindingPolicy.optional(value);
        if (normalized != null && normalized.length() > MAX_QUERY_TEXT_LENGTH) {
            throw problem("VALIDATION_ERROR", 422, fieldName + " is too long");
        }
        return normalized;
    }

    private static String normalizeSortKey(String value) {
        String normalized = CollaborationBindingPolicy.optional(value);
        if (normalized == null) return "BINDING_NAME";
        return switch (normalized) {
            case "BINDING_NAME", "NODE", "BUSINESS", "EXTERNAL_OWNER_ID", "STATUS" -> normalized;
            default -> throw problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
    }

    private static String normalizeSortDirection(String value) {
        String normalized = CollaborationBindingPolicy.optional(value);
        if (normalized == null) return "ASC";
        if (!"ASC".equals(normalized) && !"DESC".equals(normalized)) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection must be ASC or DESC");
        }
        return normalized;
    }

    /** The caller supplies only the closed vocabulary above; raw query input never reaches SQL. */
    private static String canonical(String operation, Object... values) {
        return operation + "\u001f"
                + Arrays.stream(values)
                        .map(value -> Objects.toString(value, "<null>"))
                        .collect(Collectors.joining("\u001f"));
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityRef,
            String entityType,
            String action,
            AuditActor actor,
            AuditChangePolicy policy,
            List<AuditChange> changes) {
        List<AuditChange> allowed = policy.allow(changes);
        persistence.writeAudit(new AuditRecord(
                workspaceUuid,
                groupWorkspaceKey,
                entityRef,
                entityType,
                action,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                AuditChangeJson.write(allowed)));
    }

    private static BindingRow requireBinding(BindingRow row) {
        if (row == null) throw problem("NOT_FOUND", 404, "binding was not found in the workspace");
        return row;
    }

    private static <T> T notFound(String resource) {
        throw problem("NOT_FOUND", 404, resource + " was not found in the workspace");
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message) {
        return new CollaborationCommandApi.Problem(code, status, message);
    }

    private static CollaborationCommandApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new CollaborationCommandApi.Problem(code, status, message, cause);
    }

}
