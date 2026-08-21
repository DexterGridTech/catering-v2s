package com.catering.v2s.collaboration.application;

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
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private static final String ENABLED = "ENABLED";
    private static final String DISABLED = "DISABLED";
    private static final String DELETED = "DELETED";
    private static final String INVALID = "INVALID";
    private static final String REQUIRES_ADAPTER_UNBIND = "REQUIRES_ADAPTER_UNBIND";
    private static final String REQ_BINDING_CREATE = "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_CREATE";
    private static final String REQ_BINDING_UPDATE = "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_UPDATE";
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

    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final CollaborationCatalogSource catalog;
    private final PlatformGovernanceAuthorization platformAuthorization;
    private final CollaborationCommandReceiptService receipts;

    public CollaborationOwnerService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogSource catalog,
            PlatformGovernanceAuthorization platformAuthorization,
            CollaborationCommandReceiptService receipts) {
        this.jdbc = jdbc;
        this.time = time;
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
                readEnablement(
                        "collaboration.external_system_enablement",
                        workspaceUuid,
                        groupWorkspaceKey,
                        externalSystemCode));
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.ProviderProfile readProviderProfile(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        CollaborationCatalogSource.ProviderProfileDefinition definition = requireProviderProfile(providerCode);
        return providerReadback(
                definition,
                readEnablement(
                        "collaboration.provider_profile_enablement", workspaceUuid, groupWorkspaceKey, providerCode));
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.Tree readTree(UUID workspaceUuid, String groupWorkspaceKey) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        Map<String, EnablementRow> systems =
                readEnablements("collaboration.external_system_enablement", workspaceUuid, groupWorkspaceKey);
        Map<String, EnablementRow> providers =
                readEnablements("collaboration.provider_profile_enablement", workspaceUuid, groupWorkspaceKey);
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
            UUID workspaceUuid, String groupWorkspaceKey, String capabilityClass) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedCapability = CollaborationBindingPolicy.optional(capabilityClass);
        Map<String, EnablementRow> providers =
                readEnablements("collaboration.provider_profile_enablement", workspaceUuid, groupWorkspaceKey);
        return catalog.providerProfiles().stream()
                .filter(definition -> ENABLED.equals(status(providers.get(definition.providerCode()))))
                .filter(definition -> normalizedCapability == null
                        || definition.businessScope().contains(normalizedCapability))
                .map(definition -> providerReadback(definition, providers.get(definition.providerCode())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CollaborationReadback.OwnerBinding readBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
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
        String sql = "WITH RECURSIVE owner_bindings AS ("
                + "SELECT binding_ref, provider_code, capability_class, node_type, node_ref, "
                + "binding_display_name, external_owner_id, status, version, created_at_epoch_millis, "
                + "status_changed_at_epoch_millis FROM collaboration.owner_binding "
                + "WHERE workspace_uuid=? AND group_workspace_key=? AND provider_code=?"
                + "), requested_nodes AS ("
                + "SELECT DISTINCT node_type, node_ref FROM owner_bindings"
                + "), node_seeds AS ("
                + "SELECT requested.node_type, requested.node_ref, node.id, node.parent_id, node.code, "
                + "node.name FROM requested_nodes requested JOIN organization.organization_node node "
                + "ON requested.node_type IN ('REGION','PROJECT') AND requested.node_type=node.node_type "
                + "AND requested.node_ref=node.id::text WHERE node.workspace_uuid=? "
                + "AND node.group_workspace_key=? UNION ALL "
                + "SELECT requested.node_type, requested.node_ref, project.id, project.parent_id, "
                + "project.code, project.name FROM requested_nodes requested JOIN organization.store store "
                + "ON requested.node_type='STORE' AND requested.node_ref=store.id::text "
                + "JOIN organization.organization_node project ON project.id=store.project_id "
                + "WHERE store.workspace_uuid=? AND store.group_workspace_key=? "
                + "AND project.workspace_uuid=? AND project.group_workspace_key=?"
                + "), ancestry AS ("
                + "SELECT node_type, node_ref, id, parent_id, code, name, 0 AS depth FROM node_seeds "
                + "UNION ALL SELECT ancestry.node_type, ancestry.node_ref, parent.id, parent.parent_id, "
                + "parent.code, parent.name, ancestry.depth + 1 FROM organization.organization_node parent "
                + "JOIN ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? "
                + "AND parent.group_workspace_key=?"
                + "), node_paths AS ("
                + "SELECT node_type, node_ref, string_agg(code || ' ' || name, ' / ' ORDER BY depth DESC) "
                + "AS display_path FROM ancestry GROUP BY node_type, node_ref"
                + "), owner_node_display AS ("
                + "SELECT 'COMMERCIAL_GROUP' AS node_type, commercial_group_uuid::text AS node_ref, "
                + "commercial_group_code || ' ' || commercial_group_name AS node_display_name, "
                + "commercial_group_name || '（' || commercial_group_code || '）' AS node_display_path "
                + "FROM organization.commercial_group group_node JOIN requested_nodes requested "
                + "ON requested.node_type='COMMERCIAL_GROUP' "
                + "AND requested.node_ref=group_node.commercial_group_uuid::text "
                + "WHERE group_node.group_workspace_key=? UNION ALL "
                + "SELECT node.node_type, node.node_ref, node.code || ' ' || node.name AS node_display_name, "
                + "node_paths.display_path AS node_display_path FROM node_seeds node "
                + "JOIN node_paths ON node_paths.node_type=node.node_type "
                + "AND node_paths.node_ref=node.node_ref WHERE node.node_type IN ('REGION','PROJECT') "
                + "UNION ALL SELECT 'HEAD_COMPANY', head_company.id::text, "
                + "head_company.code || ' ' || head_company.name AS node_display_name, "
                + "head_company.code || ' ' || head_company.name AS node_display_path "
                + "FROM organization.head_company head_company JOIN requested_nodes requested "
                + "ON requested.node_type='HEAD_COMPANY' AND requested.node_ref=head_company.id::text "
                + "WHERE head_company.workspace_uuid=? AND head_company.group_workspace_key=? UNION ALL "
                + "SELECT 'STORE', store.id::text, store.code || ' ' || store.name AS node_display_name, "
                + "node_paths.display_path || ' / ' || store.code || ' ' || store.name AS node_display_path "
                + "FROM organization.store store JOIN requested_nodes requested "
                + "ON requested.node_type='STORE' AND requested.node_ref=store.id::text "
                + "JOIN node_paths ON node_paths.node_type='STORE' "
                + "AND node_paths.node_ref=store.id::text "
                + "WHERE store.workspace_uuid=? AND store.group_workspace_key=?"
                + ") SELECT binding.binding_ref, binding.provider_code, binding.capability_class, "
                + "binding.node_type, binding.node_ref, binding.binding_display_name, "
                + "binding.external_owner_id, binding.status, binding.version, "
                + "binding.created_at_epoch_millis, binding.status_changed_at_epoch_millis, "
                + "node_display.node_display_path, COUNT(*) OVER() AS total "
                + "FROM owner_bindings binding LEFT JOIN owner_node_display node_display "
                + "ON node_display.node_type=binding.node_type AND node_display.node_ref=binding.node_ref "
                + "WHERE (?::text IS NULL OR COALESCE(binding.binding_display_name, '') ILIKE ? ESCAPE E'\\\\') "
                + "AND (?::text IS NULL OR CONCAT_WS(' ', binding.node_ref, "
                + "COALESCE(node_display.node_display_name, ''), COALESCE(node_display.node_display_path, '')) "
                + "ILIKE ? ESCAPE E'\\\\') ORDER BY "
                + bindingOrderBy(normalizedSortKey, normalizedSortDirection)
                + " LIMIT ? OFFSET ?";
        List<BindingPageRow> rows = jdbc.query(
                sql,
                statement -> {
                    int index = 1;
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setString(index++, normalizedProvider);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setObject(index++, workspaceUuid);
                    statement.setString(index++, groupWorkspaceKey);
                    statement.setString(index++, normalizedBindingName);
                    statement.setString(
                            index++, normalizedBindingName == null ? null : likePattern(normalizedBindingName));
                    statement.setString(index++, normalizedNodeQueryText);
                    statement.setString(
                            index++, normalizedNodeQueryText == null ? null : likePattern(normalizedNodeQueryText));
                    statement.setInt(index++, normalizedPageSize);
                    statement.setLong(index, offset);
                },
                (result, rowNumber) -> new BindingPageRow(
                        ownerBinding(
                                new BindingRow(
                                        result.getObject("binding_ref", UUID.class),
                                        workspaceUuid,
                                        groupWorkspaceKey,
                                        null,
                                        result.getString("provider_code"),
                                        result.getString("capability_class"),
                                        result.getString("node_type"),
                                        result.getString("node_ref"),
                                        result.getString("binding_display_name"),
                                        result.getString("external_owner_id"),
                                        null,
                                        result.getString("status"),
                                        null,
                                        null,
                                        null,
                                        result.getLong("version"),
                                        result.getLong("created_at_epoch_millis"),
                                        result.getLong("status_changed_at_epoch_millis"),
                                        0L),
                                result.getString("node_display_path")),
                        result.getLong("total")));
        long total = rows.isEmpty() ? 0L : rows.get(0).total();
        return new CollaborationReadback.OwnerBindingPage(
                rows.stream().map(BindingPageRow::readback).toList(),
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
        return jdbc
                .query(
                        "SELECT binding_ref, external_system_code, provider_code, capability_class, "
                                + "node_type, node_ref, "
                                + "binding_display_name, external_owner_id, authorization_ref, status, "
                                + "unbind_requested_at_epoch_millis, external_revoked_at_epoch_millis, "
                                + "deleted_at_epoch_millis, version, created_at_epoch_millis, "
                                + "status_changed_at_epoch_millis, updated_at_epoch_millis "
                                + "FROM collaboration.owner_binding WHERE workspace_uuid=? AND group_workspace_key=? "
                                + "AND provider_code=? AND node_type=? AND node_ref=? ORDER BY binding_ref",
                        statement -> {
                            statement.setObject(1, workspaceUuid);
                            statement.setString(2, groupWorkspaceKey);
                            statement.setString(3, normalizedProvider);
                            statement.setString(4, normalizedNodeType);
                            statement.setString(5, normalizedNodeRef);
                        },
                        (result, rowNumber) -> mapBinding(result))
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
                                "collaboration.external_system_enablement",
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                code,
                                targetStatus,
                                command.expectedVersion(),
                                command.actor(),
                                true)));
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
                                "collaboration.provider_profile_enablement",
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                code,
                                targetStatus,
                                command.expectedVersion(),
                                command.actor(),
                                false)));
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
    public CollaborationReadback.OwnerBinding updateOperationsBinding(UpdateOperationsBindingCommand command) {
        requireScope(command.workspaceUuid(), command.groupWorkspaceKey());
        BindingRow existing =
                readBindingRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
        CollaborationCatalogSource.ProviderProfileDefinition provider = requireProviderProfile(existing.providerCode());
        String ownerId = CollaborationBindingPolicy.validateUpdate(provider, command.externalOwnerId());
        requireOperationsGrant(
                command.ownerScopeGrant(),
                command.contextVersion(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                existing.nodeType(),
                existing.nodeRef(),
                REQ_BINDING_UPDATE);
        return receipts.execute(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.idempotencyKey(),
                "updateOperationsOwnerBinding",
                canonical(
                        "operations-update-binding",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.bindingRef(),
                        command.bindingDisplayName(),
                        ownerId,
                        command.expectedVersion(),
                        command.contextVersion()),
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
                readBindingRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
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
                readBindingRow(command.workspaceUuid(), command.groupWorkspaceKey(), command.bindingRef());
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
            String table,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String targetStatus,
            long expectedVersion,
            AuditActor actor,
            boolean externalSystem) {
        lockEnablement(workspaceUuid, groupWorkspaceKey, table, code);
        EnablementRow current = readEnablementForUpdate(table, workspaceUuid, groupWorkspaceKey, code);
        long currentVersion = current == null ? 0L : current.version();
        if (currentVersion != expectedVersion) throw problem("VERSION_CONFLICT", 409, "enablement version has changed");
        if (current == null && DISABLED.equals(targetStatus)) return null;
        long now = time.currentEpochMillis();
        if (current == null) {
            jdbc.update(
                    "INSERT INTO " + table
                            + " (workspace_uuid, group_workspace_key, "
                            + (externalSystem ? "external_system_code" : "provider_code")
                            + ", status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                            + "VALUES (?, ?, ?, ?, 1, ?, ?)",
                    workspaceUuid,
                    groupWorkspaceKey,
                    code,
                    targetStatus,
                    now,
                    now);
        } else if (jdbc.update(
                        "UPDATE " + table + " SET status=?, version=version+1, updated_at_epoch_millis=? "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND "
                                + (externalSystem ? "external_system_code" : "provider_code")
                                + "=? AND version=?",
                        targetStatus,
                        now,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        expectedVersion)
                != 1) throw problem("VERSION_CONFLICT", 409, "enablement version has changed");
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                code,
                externalSystem ? "EXTERNAL_SYSTEM" : "PROVIDER_PROFILE",
                "STATUS_CHANGED",
                actor,
                ENABLEMENT_CHANGED,
                List.of(new AuditChange("status", current == null ? null : current.status(), targetStatus)));
        return readEnablement(table, workspaceUuid, groupWorkspaceKey, code);
    }

    private void lockEnablement(UUID workspaceUuid, String groupWorkspaceKey, String table, String code) {
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))",
                workspaceUuid.toString(),
                groupWorkspaceKey + ":" + table + ":" + code);
    }

    private CollaborationReadback.OwnerBinding insertBinding(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            CollaborationCatalogSource.ProviderProfileDefinition provider,
            CollaborationBindingPolicy.CreateShape shape,
            String bindingDisplayName,
            AuditActor actor) {
        UUID bindingRef = UUID.randomUUID();
        long now = time.currentEpochMillis();
        jdbc.update(
                "INSERT INTO collaboration.owner_binding (binding_ref, workspace_uuid, group_workspace_key, "
                        + "external_system_code, provider_code, capability_class, node_type, node_ref, "
                        + "binding_display_name, external_owner_id, authorization_ref, status, version, "
                        + "created_at_epoch_millis, status_changed_at_epoch_millis, updated_at_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?)",
                bindingRef,
                workspaceUuid,
                groupWorkspaceKey,
                provider.externalSystemCode(),
                provider.providerCode(),
                shape.capabilityClass(),
                shape.nodeType(),
                shape.nodeRef(),
                CollaborationBindingPolicy.optional(bindingDisplayName),
                shape.externalOwnerId(),
                shape.initialStatus(),
                now,
                now,
                now);
        BindingRow created = readBindingRow(workspaceUuid, groupWorkspaceKey, bindingRef);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                bindingRef.toString(),
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
        long now = time.currentEpochMillis();
        if (jdbc.update(
                        "UPDATE collaboration.owner_binding SET binding_display_name=?, external_owner_id=?, "
                                + "version=version+1, updated_at_epoch_millis=? WHERE binding_ref=? "
                                + "AND workspace_uuid=? AND group_workspace_key=? AND version=? AND status<>?",
                        normalizedDisplayName,
                        ownerId,
                        now,
                        current.bindingRef(),
                        current.workspaceUuid(),
                        current.groupWorkspaceKey(),
                        expectedVersion,
                        DELETED)
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
        BindingRow current =
                readBindingRowForUpdate(initial.workspaceUuid(), initial.groupWorkspaceKey(), initial.bindingRef());
        if (DELETED.equals(current.status())) return ownerBinding(current);
        if (current.version() != expectedVersion) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        if (REQUIRES_ADAPTER_UNBIND.equals(provider.unbindKind()) && current.externalRevokedAt() == null) {
            throw problem("ADAPTER_UNBIND_REQUIRED", 409, "adapter revocation is required before deletion");
        }
        long now = time.currentEpochMillis();
        if (jdbc.update(
                        "UPDATE collaboration.owner_binding SET status=?, deleted_at_epoch_millis=?, "
                                + "status_changed_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? "
                                + "WHERE binding_ref=? "
                                + "AND workspace_uuid=? AND group_workspace_key=? AND version=? AND status<>?",
                        DELETED,
                        now,
                        now,
                        now,
                        current.bindingRef(),
                        current.workspaceUuid(),
                        current.groupWorkspaceKey(),
                        expectedVersion,
                        DELETED)
                != 1) throw problem("VERSION_CONFLICT", 409, "binding version has changed");
        BindingRow deleted = readBindingRow(current.workspaceUuid(), current.groupWorkspaceKey(), current.bindingRef());
        audit(
                current.workspaceUuid(),
                current.groupWorkspaceKey(),
                current.bindingRef().toString(),
                "OWNER_BINDING",
                "BINDING_DELETED",
                actor,
                BINDING_DELETED,
                List.of(
                        new AuditChange("status", current.status(), DELETED),
                        new AuditChange("deletedAt", null, Long.toString(now))));
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
        long now = time.currentEpochMillis();
        if (jdbc.update(
                        "UPDATE collaboration.owner_binding SET external_owner_id=?, authorization_ref=?, status=?, "
                                + "status_changed_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? "
                                + "WHERE binding_ref=? AND version=?",
                        externalOwnerId,
                        authorizationReference,
                        CollaborationBindingPolicy.EFFECTIVE,
                        now,
                        now,
                        current.bindingRef(),
                        current.version())
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
        long now = time.currentEpochMillis();
        if (jdbc.update(
                        "UPDATE collaboration.owner_binding SET external_revoked_at_epoch_millis=?, status=?, "
                                + "status_changed_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? "
                                + "WHERE binding_ref=? AND version=?",
                        now,
                        INVALID,
                        now,
                        now,
                        current.bindingRef(),
                        current.version())
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
                        new AuditChange("externalRevokedAt", null, Long.toString(now))));
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
        return jdbc.query(
                bindingSelect("WHERE binding_ref=? AND workspace_uuid=? AND group_workspace_key=?"),
                statement -> {
                    statement.setObject(1, bindingRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? mapBinding(result) : notFound("binding"));
    }

    private BindingRow readBindingRowForUpdate(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        return jdbc.query(
                bindingSelect("WHERE binding_ref=? AND workspace_uuid=? AND group_workspace_key=? FOR UPDATE"),
                statement -> {
                    statement.setObject(1, bindingRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() ? mapBinding(result) : notFound("binding"));
    }

    private BindingRow readBindingByReference(UUID bindingRef) {
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        return jdbc.query(
                bindingSelect("WHERE binding_ref=?"),
                statement -> statement.setObject(1, bindingRef),
                result -> result.next() ? mapBinding(result) : notFound("binding"));
    }

    private static String bindingSelect(String predicate) {
        return "SELECT binding_ref, workspace_uuid, group_workspace_key, external_system_code, provider_code, "
                + "capability_class, node_type, node_ref, binding_display_name, external_owner_id, authorization_ref, "
                + "status, unbind_requested_at_epoch_millis, external_revoked_at_epoch_millis, "
                + "deleted_at_epoch_millis, version, created_at_epoch_millis, status_changed_at_epoch_millis, "
                + "updated_at_epoch_millis "
                + "FROM collaboration.owner_binding " + predicate;
    }

    private BindingRow mapBinding(ResultSet result) throws SQLException {
        return new BindingRow(
                result.getObject("binding_ref", UUID.class),
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getString("external_system_code"),
                result.getString("provider_code"),
                result.getString("capability_class"),
                result.getString("node_type"),
                result.getString("node_ref"),
                result.getString("binding_display_name"),
                result.getString("external_owner_id"),
                result.getString("authorization_ref"),
                result.getString("status"),
                result.getObject("unbind_requested_at_epoch_millis", Long.class),
                result.getObject("external_revoked_at_epoch_millis", Long.class),
                result.getObject("deleted_at_epoch_millis", Long.class),
                result.getLong("version"),
                result.getLong("created_at_epoch_millis"),
                result.getLong("status_changed_at_epoch_millis"),
                result.getLong("updated_at_epoch_millis"));
    }

    private EnablementRow readEnablement(String table, UUID workspaceUuid, String groupWorkspaceKey, String code) {
        return jdbc.query(
                "SELECT status, version FROM " + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + (table.contains("external_system") ? "external_system_code" : "provider_code") + "=?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, code);
                },
                result -> result.next() ? new EnablementRow(result.getString(1), result.getLong(2)) : null);
    }

    private EnablementRow readEnablementForUpdate(
            String table, UUID workspaceUuid, String groupWorkspaceKey, String code) {
        return jdbc.query(
                "SELECT status, version FROM " + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND "
                        + (table.contains("external_system") ? "external_system_code" : "provider_code")
                        + "=? FOR UPDATE",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setString(3, code);
                },
                result -> result.next() ? new EnablementRow(result.getString(1), result.getLong(2)) : null);
    }

    private Map<String, EnablementRow> readEnablements(String table, UUID workspaceUuid, String groupWorkspaceKey) {
        String codeColumn = table.contains("external_system") ? "external_system_code" : "provider_code";
        return jdbc
                .query(
                        "SELECT " + codeColumn + ", status, version FROM " + table
                                + " WHERE workspace_uuid=? AND group_workspace_key=?",
                        statement -> {
                            statement.setObject(1, workspaceUuid);
                            statement.setString(2, groupWorkspaceKey);
                        },
                        (result, rowNumber) -> Map.entry(
                                result.getString(1), new EnablementRow(result.getString(2), result.getLong(3))))
                .stream()
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, Map.Entry::getValue));
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
        EnablementRow enablement = readEnablement(
                "collaboration.provider_profile_enablement", workspaceUuid, groupWorkspaceKey, providerCode);
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
                definition.catalogStatusDisplayName(),
                definition.attributeDictionary(),
                definition.capabilities().stream()
                        .map(value -> new CollaborationReadback.Capability(
                                value.capabilityClass(),
                                value.displayName(),
                                value.attributeValues(),
                                value.attributeValueLabels()))
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
                definition.businessScopeDisplayNames(),
                definition.bindableNodeTypes(),
                definition.bindableNodeTypeDisplayNames(),
                definition.authenticationKind(),
                definition.authenticationKindDisplayName(),
                definition.unbindKind(),
                definition.unbindKindDisplayName(),
                definition.catalogStatus(),
                definition.catalogStatusDisplayName(),
                status(enablement),
                version(enablement));
    }

    private CollaborationReadback.OwnerBinding ownerBinding(BindingRow row) {
        return ownerBinding(row, null);
    }

    private CollaborationReadback.OwnerBinding ownerBinding(BindingRow row, String nodeDisplayPath) {
        CollaborationCatalogSource.ProviderProfileDefinition provider = catalog.providerProfile(row.providerCode());
        CollaborationCatalogSource.ExternalSystemDefinition system =
                provider == null ? null : catalog.externalSystem(provider.externalSystemCode());
        String capabilityDisplayName = system == null || row.capabilityClass() == null
                ? null
                : system.capabilities().stream()
                        .filter(value -> value.capabilityClass().equals(row.capabilityClass()))
                        .map(CollaborationCatalogSource.CapabilityDefinition::displayName)
                        .findFirst()
                        .orElse(null);
        String nodeTypeDisplayName = provider == null
                ? null
                : displayNameAt(provider.bindableNodeTypes(), provider.bindableNodeTypeDisplayNames(), row.nodeType());
        return new CollaborationReadback.OwnerBinding(
                row.bindingRef(),
                row.providerCode(),
                provider == null ? row.providerCode() : provider.displayName(),
                row.capabilityClass(),
                capabilityDisplayName,
                provider == null ? List.of() : provider.businessScopeDisplayNames(),
                row.nodeType(),
                nodeTypeDisplayName,
                row.nodeRef(),
                row.bindingDisplayName(),
                row.externalOwnerId(),
                row.createdAt(),
                row.statusChangedAt(),
                row.status(),
                bindingStatusDisplayName(row.status()),
                row.version());
    }

    private String catalogExternalSystemDisplayName(String externalSystemCode) {
        CollaborationCatalogSource.ExternalSystemDefinition system = catalog.externalSystem(externalSystemCode);
        return system == null ? externalSystemCode : system.displayName();
    }

    private static String displayNameAt(List<String> codes, List<String> names, String code) {
        int index = codes.indexOf(code);
        return index >= 0 && index < names.size() ? names.get(index) : code;
    }

    private static String bindingStatusDisplayName(String status) {
        return switch (status) {
            case "PENDING_AUTHORIZATION" -> "待授权";
            case "EFFECTIVE" -> "有效";
            case "INVALID" -> "无效";
            case "DELETED" -> "已删除";
            default -> status;
        };
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
    private static String bindingOrderBy(String sortKey, String sortDirection) {
        String expression =
                switch (sortKey) {
                    case "NODE" -> "COALESCE(node_display.node_display_path, node_display.node_display_name, "
                            + "binding.no"
                            + "de_ref)";
                    case "BUSINESS" -> "COALESCE(binding.capability_class, '')";
                    case "EXTERNAL_OWNER_ID" -> "COALESCE(binding.external_owner_id, '')";
                    case "STATUS" -> "binding.status";
                    default -> "COALESCE(binding.binding_display_name, '')";
                };
        return expression + " " + sortDirection + " NULLS LAST, binding.binding_ref ASC";
    }

    private static String likePattern(String value) {
        return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

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
        jdbc.update(
                "INSERT INTO collaboration.audit_event (event_ref, workspace_uuid, group_workspace_key, "
                        + "actor_type, actor_id, actor_display_snapshot, entity_type, entity_ref, action, "
                        + "changes_json, occurred_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                entityType,
                entityRef,
                action,
                AuditChangeJson.write(allowed),
                time.currentEpochMillis());
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

    private record EnablementRow(String status, long version) {}

    private record BindingPageRow(CollaborationReadback.OwnerBinding readback, long total) {}

    private record BindingRow(
            UUID bindingRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String externalSystemCode,
            String providerCode,
            String capabilityClass,
            String nodeType,
            String nodeRef,
            String bindingDisplayName,
            String externalOwnerId,
            String authorizationRef,
            String status,
            Long unbindRequestedAt,
            Long externalRevokedAt,
            Long deletedAt,
            long version,
            long createdAt,
            long statusChangedAt,
            long updatedAt) {}
}
