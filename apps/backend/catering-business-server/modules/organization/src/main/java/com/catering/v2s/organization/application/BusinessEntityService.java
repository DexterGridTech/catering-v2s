package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessEntityService
        implements StoreAssignmentLookup,
                OrganizationEntityLookup,
                StoreContractLookup,
                CatalogScopeLookup,
                OperationsBusinessEntityCommandApi,
                OperationsStoreCommandApi {
    private static final String BUSINESS_ENTITY_PROJECTION =
            "entities.id, entities.workspace_uuid, entities.group_workspace_key, entities.code, entities.name, "
                    + "entities.legal_name, entities.credit_code, entities.alias, entities.remark, entities.notes, "
                    + "entities.status, entities.version, entities.extension_rule_revision, "
                    + "entities.created_at_epoch_millis, entities.updated_at_epoch_millis, entities.extension_values, "
                    + "entities.entity_type";
    private static final Set<String> ENTITY_TYPES = Set.of("BRAND", "TENANT", BusinessEntityTypes.HEAD_COMPANY);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship");
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final OrganizationNodeLookup nodes;
    private final BusinessEntityCommandReceiptService receipts;

    public BusinessEntityService(
            JdbcTemplate jdbc, TimeProvider time, ExtensionDefinitionLookup definitions, OrganizationNodeLookup nodes) {
        this(jdbc, time, definitions, nodes, new BusinessEntityCommandReceiptService(jdbc, time));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public BusinessEntityService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            OrganizationNodeLookup nodes,
            BusinessEntityCommandReceiptService receipts) {
        this.jdbc = jdbc;
        this.time = time;
        this.definitions = definitions;
        this.nodes = nodes;
        this.receipts = receipts;
    }

    @Override
    @Transactional
    public OrganizationEntityReadback createBrand(BrandCreateCommand command) {
        return createEntitySubmission(
                BusinessEntityTypes.BRAND,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.code(),
                command.name(),
                null,
                null,
                command.alias(),
                command.remark(),
                command.extensionSubmission(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Override
    @Transactional
    public OrganizationEntityReadback updateBrand(BrandUpdateCommand command) {
        return updateEntitySubmission(
                BusinessEntityTypes.BRAND,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.brandId(),
                command.code(),
                command.name(),
                null,
                null,
                command.alias(),
                command.remark(),
                command.expectedVersion(),
                command.extensionSubmission(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Override
    @Transactional
    public OrganizationEntityReadback createTenant(TenantCreateCommand command) {
        return createEntitySubmission(
                BusinessEntityTypes.TENANT,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.code(),
                command.name(),
                command.legalName(),
                command.creditCode(),
                null,
                command.remark(),
                command.extensionSubmission(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Override
    @Transactional
    public OrganizationEntityReadback updateTenant(TenantUpdateCommand command) {
        return updateEntitySubmission(
                BusinessEntityTypes.TENANT,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.tenantId(),
                command.code(),
                command.name(),
                command.legalName(),
                command.creditCode(),
                null,
                command.remark(),
                command.expectedVersion(),
                command.extensionSubmission(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Override
    @Transactional
    public HeadCompanyCommandReadback createHeadCompany(HeadCompanyCreateCommand command) {
        OrganizationEntityReadback entity = createEntitySubmission(
                BusinessEntityTypes.HEAD_COMPANY,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.code(),
                command.name(),
                command.legalName(),
                command.creditCode(),
                null,
                command.remark(),
                command.extensionSubmission(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
        // A freshly inserted head company cannot have an authorization row in this transaction; avoid rereading the
        // entity and join table solely to construct the known-empty relationship projection.
        return new HeadCompanyCommandReadback(entity, List.of());
    }

    @Override
    @Transactional
    public HeadCompanyCommandReadback updateHeadCompany(HeadCompanyUpdateCommand command) {
        OrganizationEntityReadback entity = updateEntitySubmission(
                BusinessEntityTypes.HEAD_COMPANY,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.headCompanyId(),
                command.code(),
                command.name(),
                command.legalName(),
                command.creditCode(),
                null,
                command.remark(),
                command.expectedVersion(),
                command.extensionSubmission(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
        return headCompanyReadback(command.workspaceUuid(), command.groupWorkspaceKey(), entity);
    }

    @Override
    @Transactional
    public HeadCompanyCommandReadback transitionHeadCompanyStatus(HeadCompanyStatusCommand command) {
        OrganizationEntityReadback entity = transitionEntityStatus(
                BusinessEntityTypes.HEAD_COMPANY,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.headCompanyId(),
                command.targetStatus(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
        return headCompanyReadback(command.workspaceUuid(), command.groupWorkspaceKey(), entity);
    }

    @Override
    @Transactional
    public OrganizationEntityReadback transitionBrandStatus(BrandStatusCommand command) {
        return transitionEntityStatus(
                BusinessEntityTypes.BRAND,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.brandId(),
                command.targetStatus(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Override
    @Transactional
    public OrganizationEntityReadback transitionTenantStatus(TenantStatusCommand command) {
        return transitionEntityStatus(
                BusinessEntityTypes.TENANT,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.tenantId(),
                command.targetStatus(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Override
    @Transactional
    public HeadCompanyBrandAuthorizationReadback addHeadCompanyBrandAuthorization(
            HeadCompanyBrandAuthorizationCommand command) {
        requireOwnerGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.HEAD_COMPANY,
                command.headCompanyId());
        addHeadCompanyBrandAuthorization(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.headCompanyId(),
                command.brandId(),
                command.idempotencyKey(),
                command.actor());
        return new HeadCompanyBrandAuthorizationReadback(command.headCompanyId(), command.brandId());
    }

    @Override
    @Transactional
    public HeadCompanyBrandAuthorizationReadback removeHeadCompanyBrandAuthorization(
            HeadCompanyBrandAuthorizationCommand command) {
        requireOwnerGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.HEAD_COMPANY,
                command.headCompanyId());
        removeHeadCompanyBrandAuthorization(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.headCompanyId(),
                command.brandId(),
                command.idempotencyKey(),
                command.actor());
        return new HeadCompanyBrandAuthorizationReadback(command.headCompanyId(), command.brandId());
    }

    @Override
    @Transactional
    public OrganizationEntityReadback createStore(CreateStoreCommand command) {
        UUID ownerProjectId = resolvedOwnerTargetId(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.PROJECT);
        if (!ownerProjectId.equals(command.projectId())) throw new OrganizationValidationException();
        requireOwnerGrantForResolvedTarget(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.PROJECT,
                ownerProjectId);
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "createStore",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        ownerProjectId,
                        command.tenantId(),
                        command.brandId(),
                        command.headCompanyId(),
                        command.code(),
                        command.name(),
                        command.notes(),
                        command.extensionSubmission()),
                () -> createStoreSubmission(command, ownerProjectId));
    }

    @Override
    @Transactional
    public OrganizationEntityReadback updateStore(UpdateStoreCommand command) {
        StoreCommandFacts current = readStoreCommandFacts(command);
        UUID ownerProjectId = current.projectId();
        requireOwnerGrantForResolvedTarget(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.PROJECT,
                ownerProjectId);
        if (!ownerProjectId.equals(command.projectId())) throw new OrganizationValidationException();
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "updateStore",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.storeId(),
                        ownerProjectId,
                        command.tenantId(),
                        command.brandId(),
                        command.headCompanyId(),
                        command.code(),
                        command.name(),
                        command.notes(),
                        command.expectedVersion(),
                        command.extensionSubmission()),
                () -> updateStoreSubmission(command, current));
    }

    @Override
    @Transactional
    public OrganizationEntityReadback transitionStoreStatus(StoreStatusCommand command) {
        return transitionEntityStatus(
                ServiceNodeTypes.STORE,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.storeId(),
                command.targetStatus(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    private OrganizationEntityReadback createStoreSubmission(CreateStoreCommand command, UUID ownerProjectId) {
        validateStoreReferences(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ownerProjectId,
                command.tenantId(),
                command.brandId(),
                command.headCompanyId());
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            jdbc.update(
                    "INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, "
                            + "brand_id, head_company_id, code, name, notes, status, version, created_at_epoch_millis, "
                            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                    id,
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    ownerProjectId,
                    command.tenantId(),
                    command.brandId(),
                    command.headCompanyId(),
                    text(command.code(), 64),
                    text(command.name(), 120),
                    optional(command.notes(), 2000),
                    now,
                    now);
        } catch (DuplicateKeyException exception) {
            throw new OrganizationDuplicateException(exception);
        } catch (DataIntegrityViolationException exception) {
            throw new OrganizationConflictException(exception);
        }
        replaceNewValues(
                "store",
                id,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ExtensionHostTypes.STORE,
                command.extensionSubmission());
        OrganizationEntityReadback created = OwnerOperationDiagnostics.readback(
                () -> requireEntity(ServiceNodeTypes.STORE, command.workspaceUuid(), command.groupWorkspaceKey(), id));
        audit(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                id,
                AuditEntityTypes.STORE,
                "STORE_CREATED",
                now,
                command.actor(),
                createdChanges(created));
        return created;
    }

    private OrganizationEntityReadback updateStoreSubmission(UpdateStoreCommand command, StoreCommandFacts current) {
        OrganizationEntityReadback before = current.before();
        requireMutable(before.status());
        current.requireEnabledReferences();
        int changed;
        try {
            changed = jdbc.update(
                    "UPDATE organization.store SET project_id=?, tenant_id=?, brand_id=?, head_company_id=?, code=?, "
                            + "name=?, notes=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND "
                            + "workspace_uuid=? AND group_workspace_key=? AND version=?",
                    current.projectId(),
                    command.tenantId(),
                    command.brandId(),
                    command.headCompanyId(),
                    text(command.code(), 64),
                    text(command.name(), 120),
                    optional(command.notes(), 2000),
                    time.currentEpochMillis(),
                    command.storeId(),
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.expectedVersion());
        } catch (DataIntegrityViolationException exception) {
            throw new OrganizationConflictException(exception);
        }
        if (changed != 1) throw new OrganizationConflictException();
        replaceValues(
                "store",
                command.storeId(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ExtensionHostTypes.STORE,
                before.extensionValues(),
                command.extensionSubmission());
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(() -> requireEntity(
                BusinessEntityTypes.STORE, command.workspaceUuid(), command.groupWorkspaceKey(), command.storeId()));
        audit(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.storeId(),
                AuditEntityTypes.STORE,
                "STORE_UPDATED",
                time.currentEpochMillis(),
                command.actor(),
                changed(before, updated));
        return updated;
    }

    private OrganizationEntityReadback createEntitySubmission(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            ExtensionSubmission submission,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireOwnerGrantForResolvedTarget(
                ownerScopeGrant,
                workspaceUuid,
                groupWorkspaceKey,
                ServiceNodeTypes.GROUP,
                resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP));
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "createEntity",
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        submission),
                () -> createEntitySubmission(
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        submission,
                        actor));
    }

    private OrganizationEntityReadback createEntitySubmission(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            ExtensionSubmission submission,
            AuditActor actor) {
        String type = entityType(entityType);
        ensureAvailable(type, workspaceUuid, groupWorkspaceKey, null, code, name);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        String table = table(type);
        try {
            if (BusinessEntityTypes.BRAND.equals(type))
                jdbc.update(
                        "INSERT INTO organization.brand (id, workspace_uuid, group_workspace_key, code, name, alias, "
                                + "remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES "
                                + "(?, "
                                + "?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        text(code, 64),
                        text(name, 120),
                        optional(alias, 120),
                        optional(remark, 2000),
                        now,
                        now);
            else
                jdbc.update(
                        "INSERT INTO organization." + table
                                + " (id, workspace_uuid, group_workspace_key, code, name, legal_name, credit_code, "
                                + "remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        text(code, 64),
                        text(name, 120),
                        text(legalName, 240),
                        text(creditCode, 32),
                        optional(remark, 2000),
                        now,
                        now);
        } catch (DuplicateKeyException exception) {
            throw new OrganizationDuplicateException(exception);
        }
        replaceNewValues(table, id, workspaceUuid, groupWorkspaceKey, type, submission);
        OrganizationEntityReadback created =
                OwnerOperationDiagnostics.readback(() -> requireEntity(type, workspaceUuid, groupWorkspaceKey, id));
        audit(workspaceUuid, groupWorkspaceKey, id, type, type + "_CREATED", now, actor, createdChanges(created));
        return created;
    }

    private OrganizationEntityReadback updateEntitySubmission(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            ExtensionSubmission submission,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        String type = entityType(entityType);
        final OrganizationEntityReadback knownOwnerFact;
        if (ServiceNodeTypes.HEAD_COMPANY.equals(type)) {
            knownOwnerFact = requireHeadCompanyOwnerFact(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, id);
        } else {
            knownOwnerFact = null;
        }
        if (!ServiceNodeTypes.HEAD_COMPANY.equals(type))
            requireOwnerGrantForResolvedTarget(
                    ownerScopeGrant,
                    workspaceUuid,
                    groupWorkspaceKey,
                    ServiceNodeTypes.GROUP,
                    resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP));
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "updateEntity",
                        type,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        expectedVersion,
                        submission),
                () -> updateEntitySubmission(
                        type,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        expectedVersion,
                        submission,
                        actor,
                        knownOwnerFact));
    }

    private OrganizationEntityReadback updateEntitySubmission(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            ExtensionSubmission submission,
            AuditActor actor,
            OrganizationEntityReadback knownOwnerFact) {
        String type = entityType(entityType);
        String table = table(type);
        OrganizationEntityReadback before =
                knownOwnerFact == null ? requireEntity(type, workspaceUuid, groupWorkspaceKey, id) : knownOwnerFact;
        requireMutable(before.status());
        ensureAvailable(type, workspaceUuid, groupWorkspaceKey, id, code, name);
        if (ServiceNodeTypes.HEAD_COMPANY.equals(type))
            return updateHeadCompanySubmission(
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    code,
                    name,
                    legalName,
                    creditCode,
                    remark,
                    expectedVersion,
                    submission,
                    actor,
                    before);
        String update = BusinessEntityTypes.BRAND.equals(type)
                ? "UPDATE organization.brand SET code=?, name=?, alias=?, remark=?, version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND "
                        + "version=?"
                : "UPDATE organization." + table
                        + " SET code=?, name=?, legal_name=?, credit_code=?, remark=?, version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND "
                        + "version=?";
        Object[] args = BusinessEntityTypes.BRAND.equals(type)
                ? new Object[] {
                    text(code, 64),
                    text(name, 120),
                    optional(alias, 120),
                    optional(remark, 2000),
                    time.currentEpochMillis(),
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    expectedVersion
                }
                : new Object[] {
                    text(code, 64),
                    text(name, 120),
                    text(legalName, 240),
                    text(creditCode, 32),
                    optional(remark, 2000),
                    time.currentEpochMillis(),
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    expectedVersion
                };
        if (jdbc.update(update, args) != 1) throw new OrganizationConflictException();
        replaceValues(table, id, workspaceUuid, groupWorkspaceKey, type, before.extensionValues(), submission);
        OrganizationEntityReadback updated =
                OwnerOperationDiagnostics.readback(() -> requireEntity(type, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                type,
                type + "_UPDATED",
                time.currentEpochMillis(),
                actor,
                changed(before, updated));
        return updated;
    }

    /** Head-company update returns its complete post-merge row from the owner write. */
    private OrganizationEntityReadback updateHeadCompanySubmission(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            long expectedVersion,
            ExtensionSubmission submission,
            AuditActor actor,
            OrganizationEntityReadback before) {
        ExtensionValues extensions =
                extensionValuesForUpdate(workspaceUuid, groupWorkspaceKey, before.extensionValues(), submission);
        long now = time.currentEpochMillis();
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(() -> jdbc.query(
                "UPDATE organization.head_company SET code=?, name=?, legal_name=?, credit_code=?, remark=?, "
                        + "extension_values=CAST(? AS JSONB), extension_rule_revision=?, version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND "
                        + "version=? RETURNING id, workspace_uuid, group_workspace_key, code, name, legal_name, "
                        + "credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes, status, version, "
                        + "extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, "
                        + "extension_values::text",
                statement -> {
                    statement.setString(1, text(code, 64));
                    statement.setString(2, text(name, 120));
                    statement.setString(3, text(legalName, 240));
                    statement.setString(4, text(creditCode, 32));
                    statement.setString(5, optional(remark, 2000));
                    statement.setString(6, extensions.json());
                    statement.setLong(7, extensions.revision());
                    statement.setLong(8, now);
                    statement.setObject(9, id);
                    statement.setObject(10, workspaceUuid);
                    statement.setString(11, groupWorkspaceKey);
                    statement.setLong(12, expectedVersion);
                },
                result -> {
                    if (!result.next()) throw new OrganizationConflictException();
                    return readEntity(BusinessEntityTypes.HEAD_COMPANY, result);
                }));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                BusinessEntityTypes.HEAD_COMPANY,
                BusinessEntityTypes.HEAD_COMPANY + "_UPDATED",
                time.currentEpochMillis(),
                actor,
                changed(before, updated));
        return updated;
    }

    private HeadCompanyCommandReadback headCompanyReadback(
            UUID workspaceUuid, String groupWorkspaceKey, OrganizationEntityReadback entity) {
        return new HeadCompanyCommandReadback(
                entity, authorizedBrandsForKnownHeadCompany(workspaceUuid, groupWorkspaceKey, entity.id()));
    }

    @Transactional
    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            Map<String, String> extensionValues) {
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                null,
                null,
                extensionValues);
    }

    @Transactional
    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues) {
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            AuditActor actor) {
        String type = entityType(entityType);
        ensureAvailable(type, workspaceUuid, groupWorkspaceKey, null, code, name);
        validateValues(type, workspaceUuid, groupWorkspaceKey, extensionValues);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        String table = table(type);
        try {
            if ("BRAND".equals(type))
                jdbc.update(
                        "INSERT INTO organization.brand (id, workspace_uuid, group_workspace_key, code, name, alias, "
                                + "remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES "
                                + "(?, "
                                + "?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        text(code, 64),
                        text(name, 120),
                        optional(alias, 120),
                        optional(remark, 2000),
                        now,
                        now);
            else
                jdbc.update(
                        "INSERT INTO organization." + table
                                + " (id, workspace_uuid, group_workspace_key, code, name, legal_name, credit_code, "
                                + "remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        text(code, 64),
                        text(name, 120),
                        text(legalName, 240),
                        text(creditCode, 32),
                        optional(remark, 2000),
                        now,
                        now);
        } catch (DuplicateKeyException exception) {
            throw new OrganizationDuplicateException(exception);
        }
        replaceValues(table, id, workspaceUuid, groupWorkspaceKey, type, extensionValues);
        OrganizationEntityReadback created =
                OwnerOperationDiagnostics.readback(() -> requireEntity(type, workspaceUuid, groupWorkspaceKey, id));
        audit(workspaceUuid, groupWorkspaceKey, id, type, type + "_CREATED", now, actor, createdChanges(created));
        return created;
    }

    @Transactional
    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "createEntity",
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        extensionValues),
                () -> createEntity(
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        extensionValues,
                        actor));
    }

    /** Operations-only overload: bind the GROUP grant before receipt replay can return a prior response. */
    @Transactional
    public OrganizationEntityReadback createEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireOwnerGrantForResolvedTarget(
                ownerScopeGrant,
                workspaceUuid,
                groupWorkspaceKey,
                ServiceNodeTypes.GROUP,
                resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP));
        return createEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                extensionValues,
                idempotencyKey,
                actor);
    }

    @Transactional
    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues) {
        return updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        String type = entityType(entityType);
        String table = table(type);
        OrganizationEntityReadback before = requireEntity(type, workspaceUuid, groupWorkspaceKey, id);
        ensureAvailable(type, workspaceUuid, groupWorkspaceKey, id, code, name);
        validateValues(type, workspaceUuid, groupWorkspaceKey, extensionValues);
        String update = "BRAND".equals(type)
                ? "UPDATE organization.brand SET code=?, name=?, alias=?, remark=?, version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND "
                        + "version=?"
                : "UPDATE organization." + table
                        + " SET code=?, name=?, legal_name=?, credit_code=?, remark=?, version=version+1, "
                        + "updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND "
                        + "version=?";
        Object[] args = "BRAND".equals(type)
                ? new Object[] {
                    text(code, 64),
                    text(name, 120),
                    optional(alias, 120),
                    optional(remark, 2000),
                    time.currentEpochMillis(),
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    expectedVersion
                }
                : new Object[] {
                    text(code, 64),
                    text(name, 120),
                    text(legalName, 240),
                    text(creditCode, 32),
                    optional(remark, 2000),
                    time.currentEpochMillis(),
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    expectedVersion
                };
        if (jdbc.update(update, args) != 1) throw new OrganizationConflictException();
        replaceValues(table, id, workspaceUuid, groupWorkspaceKey, type, extensionValues);
        OrganizationEntityReadback updated =
                OwnerOperationDiagnostics.readback(() -> requireEntity(type, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                type,
                type + "_UPDATED",
                time.currentEpochMillis(),
                actor,
                changed(before, updated));
        return updated;
    }

    @Transactional
    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return updateEntity(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "updateEntity",
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        expectedVersion,
                        extensionValues),
                () -> updateEntity(
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        expectedVersion,
                        extensionValues,
                        actor));
    }

    /** Brand and tenant commands are authorized at GROUP; head-company commands target their owner fact. */
    @Transactional
    public OrganizationEntityReadback updateEntity(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        String type = entityType(entityType);
        if (ServiceNodeTypes.HEAD_COMPANY.equals(type))
            requireOwnerGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, id);
        else
            requireOwnerGrantForResolvedTarget(
                    ownerScopeGrant,
                    workspaceUuid,
                    groupWorkspaceKey,
                    ServiceNodeTypes.GROUP,
                    resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP));
        return updateEntity(
                type,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                alias,
                remark,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                actor);
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion) {
        return transitionEntityStatus(
                entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            AuditActor actor) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        return transitionEntityStatus(
                type,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                status,
                expectedVersion,
                actor,
                requireEntity(type, workspaceUuid, groupWorkspaceKey, id));
    }

    private OrganizationEntityReadback transitionEntityStatus(
            String type,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            AuditActor actor,
            OrganizationEntityReadback before) {
        String table = table(type);
        if (!Set.of("ENABLED", "DISABLED", "VOIDED").contains(status)
                || "VOIDED".equals(before.status())
                || jdbc.update(
                                "UPDATE organization." + table
                                        + " SET status=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND "
                                        + "workspace_uuid=? AND group_workspace_key=? AND version=?",
                                status,
                                time.currentEpochMillis(),
                                id,
                                workspaceUuid,
                                groupWorkspaceKey,
                                expectedVersion)
                        != 1) throw new OrganizationConflictException();
        OrganizationEntityReadback updated =
                OwnerOperationDiagnostics.readback(() -> requireEntity(type, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                type,
                type + "_STATUS_CHANGED",
                time.currentEpochMillis(),
                actor,
                List.of(new AuditChange("status", before.status(), updated.status())));
        return updated;
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            String idempotencyKey) {
        return transitionEntityStatus(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                id,
                status,
                expectedVersion,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "transitionEntityStatus",
                        entityType,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        status,
                        expectedVersion),
                () -> transitionEntityStatus(
                        entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, actor));
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        if (ServiceNodeTypes.STORE.equals(type)) {
            StoreStatusFacts current = readStoreStatusFacts(workspaceUuid, groupWorkspaceKey, id);
            requireOwnerGrantForResolvedTarget(
                    ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT, current.projectId());
            return receipts.execute(
                    workspaceUuid,
                    idempotencyKey,
                    canonical(
                            "transitionEntityStatus",
                            entityType,
                            workspaceUuid,
                            groupWorkspaceKey,
                            id,
                            status,
                            expectedVersion),
                    () -> transitionEntityStatus(
                            type,
                            workspaceUuid,
                            groupWorkspaceKey,
                            id,
                            status,
                            expectedVersion,
                            actor,
                            current.before()));
        } else if (ServiceNodeTypes.HEAD_COMPANY.equals(type))
            requireOwnerGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, id);
        else
            requireOwnerGrantForResolvedTarget(
                    ownerScopeGrant,
                    workspaceUuid,
                    groupWorkspaceKey,
                    ServiceNodeTypes.GROUP,
                    resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP));
        return transitionEntityStatus(
                type, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, idempotencyKey, actor);
    }

    @Transactional
    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            Map<String, String> extensionValues) {
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                null,
                extensionValues);
    }

    @Transactional
    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues) {
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            AuditActor actor) {
        validateStoreReferences(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId);
        validateValues(ExtensionHostTypes.STORE, workspaceUuid, groupWorkspaceKey, extensionValues);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            jdbc.update(
                    "INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, "
                            + "brand_id, head_company_id, code, name, notes, status, version, created_at_epoch_millis, "
                            + "updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)",
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    projectId,
                    tenantId,
                    brandId,
                    headCompanyId,
                    text(code, 64),
                    text(name, 120),
                    optional(notes, 2000),
                    now,
                    now);
        } catch (DuplicateKeyException exception) {
            throw new OrganizationDuplicateException(exception);
        } catch (DataIntegrityViolationException exception) {
            throw new OrganizationConflictException(exception);
        }
        replaceValues("store", id, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.STORE, extensionValues);
        OrganizationEntityReadback created =
                requireEntity(ServiceNodeTypes.STORE, workspaceUuid, groupWorkspaceKey, id);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                AuditEntityTypes.STORE,
                "STORE_CREATED",
                now,
                actor,
                createdChanges(created));
        return created;
    }

    @Transactional
    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "createStore",
                        workspaceUuid,
                        groupWorkspaceKey,
                        projectId,
                        tenantId,
                        brandId,
                        headCompanyId,
                        code,
                        name,
                        notes,
                        extensionValues),
                () -> createStore(
                        workspaceUuid,
                        groupWorkspaceKey,
                        projectId,
                        tenantId,
                        brandId,
                        headCompanyId,
                        code,
                        name,
                        notes,
                        extensionValues,
                        actor));
    }

    @Transactional
    public OrganizationEntityReadback createStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        UUID ownerProjectId =
                resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT);
        if (!ownerProjectId.equals(projectId)) throw new OrganizationValidationException();
        requireOwnerGrantForResolvedTarget(
                ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT, ownerProjectId);
        return createStore(
                workspaceUuid,
                groupWorkspaceKey,
                ownerProjectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                extensionValues,
                idempotencyKey,
                actor);
    }

    @Transactional
    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues) {
        return updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        OrganizationEntityReadback before =
                requireEntity(BusinessEntityTypes.STORE, workspaceUuid, groupWorkspaceKey, id);
        validateStoreReferences(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId);
        validateValues(ExtensionHostTypes.STORE, workspaceUuid, groupWorkspaceKey, extensionValues);
        int changed;
        try {
            changed = jdbc.update(
                    "UPDATE organization.store SET project_id=?, tenant_id=?, brand_id=?, head_company_id=?, code=?, "
                            + "name=?, notes=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND "
                            + "workspace_uuid=? AND group_workspace_key=? AND version=?",
                    projectId,
                    tenantId,
                    brandId,
                    headCompanyId,
                    text(code, 64),
                    text(name, 120),
                    optional(notes, 2000),
                    time.currentEpochMillis(),
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    expectedVersion);
        } catch (DataIntegrityViolationException exception) {
            throw new OrganizationConflictException(exception);
        }
        if (changed != 1) throw new OrganizationConflictException();
        replaceValues("store", id, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.STORE, extensionValues);
        OrganizationEntityReadback updated =
                requireEntity(BusinessEntityTypes.STORE, workspaceUuid, groupWorkspaceKey, id);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                AuditEntityTypes.STORE,
                "STORE_UPDATED",
                time.currentEpochMillis(),
                actor,
                changed(before, updated));
        return updated;
    }

    @Transactional
    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                projectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "updateStore",
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        projectId,
                        tenantId,
                        brandId,
                        headCompanyId,
                        code,
                        name,
                        notes,
                        expectedVersion,
                        extensionValues),
                () -> updateStore(
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        projectId,
                        tenantId,
                        brandId,
                        headCompanyId,
                        code,
                        name,
                        notes,
                        expectedVersion,
                        extensionValues,
                        actor));
    }

    @Transactional
    public OrganizationEntityReadback updateStore(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        UUID ownerProjectId = requireStoreProjectId(workspaceUuid, groupWorkspaceKey, id);
        requireOwnerGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT, ownerProjectId);
        if (!ownerProjectId.equals(projectId)) throw new OrganizationValidationException();
        return updateStore(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                ownerProjectId,
                tenantId,
                brandId,
                headCompanyId,
                code,
                name,
                notes,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                actor);
    }

    @Transactional
    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement addHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.executeAuthorizationAcknowledgement(
                workspaceUuid,
                headCompanyId,
                idempotencyKey,
                canonical("addHeadCompanyBrandAuthorization", workspaceUuid, groupWorkspaceKey, headCompanyId, brandId),
                () -> {
                    requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
                    if (!enabled("brand", workspaceUuid, groupWorkspaceKey, brandId))
                        throw new OrganizationValidationException();
                    if (jdbc.update(
                                    "INSERT INTO organization.head_company_brand_authorization (head_company_id, "
                                            + "brand_id, authorized_at_epoch_millis) VALUES (?, ?, ?) ON CONFLICT DO "
                                            + "NOTHING",
                                    headCompanyId,
                                    brandId,
                                    time.currentEpochMillis())
                            == 1) {
                        audit(
                                workspaceUuid,
                                groupWorkspaceKey,
                                headCompanyId,
                                AuditEntityTypes.HEAD_COMPANY,
                                "HEAD_COMPANY_BRAND_AUTHORIZATION_ADDED",
                                time.currentEpochMillis(),
                                actor,
                                List.of(new AuditChange("relationship", null, brandId.toString())));
                    }
                });
    }

    @Transactional
    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement addHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireOwnerGrant(
                ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, headCompanyId);
        return addHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor);
    }

    @Transactional
    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement removeHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.executeAuthorizationAcknowledgement(
                workspaceUuid,
                headCompanyId,
                idempotencyKey,
                canonical(
                        "removeHeadCompanyBrandAuthorization",
                        workspaceUuid,
                        groupWorkspaceKey,
                        headCompanyId,
                        brandId),
                () -> {
                    requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
                    if (!authorized(headCompanyId, brandId)) throw new HeadCompanyBrandAuthorizationNotFoundException();
                    if (hasStoreReference(workspaceUuid, groupWorkspaceKey, headCompanyId, brandId))
                        throw new HeadCompanyBrandAuthorizationInUseException();
                    try {
                        if (jdbc.update(
                                        "DELETE FROM organization.head_company_brand_authorization WHERE "
                                                + "head_company_id=? AND brand_id=?",
                                        headCompanyId,
                                        brandId)
                                != 1) throw new HeadCompanyBrandAuthorizationNotFoundException();
                    } catch (DataIntegrityViolationException exception) {
                        throw new HeadCompanyBrandAuthorizationInUseException(exception);
                    }
                    audit(
                            workspaceUuid,
                            groupWorkspaceKey,
                            headCompanyId,
                            AuditEntityTypes.HEAD_COMPANY,
                            "HEAD_COMPANY_BRAND_AUTHORIZATION_REMOVED",
                            time.currentEpochMillis(),
                            actor,
                            List.of(new AuditChange("relationship", brandId.toString(), null)));
                });
    }

    @Transactional
    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement removeHeadCompanyBrandAuthorization(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID headCompanyId,
            UUID brandId,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireOwnerGrant(
                ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, headCompanyId);
        return removeHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor);
    }

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> authorizedBrands(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
        return authorizedBrandsForKnownHeadCompany(workspaceUuid, groupWorkspaceKey, headCompanyId);
    }

    /** Reads only the relationship closure when the caller already holds an authoritative head-company fact. */
    private List<OrganizationEntityReadback> authorizedBrandsForKnownHeadCompany(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        return jdbc.query(
                "SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, "
                        + "NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, "
                        + "b.version, "
                        + "b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, "
                        + "b.extension_values::text FROM organization.head_company_brand_authorization a JOIN "
                        + "organization.brand b ON b.id=a.brand_id WHERE a.head_company_id=? AND b.workspace_uuid=? "
                        + "AND "
                        + "b.group_workspace_key=? ORDER BY b.id",
                (row, index) -> readEntity("BRAND", row),
                headCompanyId,
                workspaceUuid,
                groupWorkspaceKey);
    }

    /**
     * Bounded organization-owner task read for an already paged head-company surface. It validates every requested head
     * company within its workspace before grouping its authorized brands.
     */
    @Transactional(readOnly = true)
    public Map<UUID, List<OrganizationEntityReadback>> authorizedBrandsByHeadCompanyIds(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedHeadCompanyIds) {
        List<UUID> ids = requestedHeadCompanyIds == null
                ? List.of()
                : requestedHeadCompanyIds.stream().distinct().toList();
        if (ids.isEmpty()) return Map.of();
        if (ids.stream().anyMatch(Objects::isNull)) throw new OrganizationNotFoundException();
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        Map<UUID, List<OrganizationEntityReadback>> brandsByHeadCompanyId = new java.util.LinkedHashMap<>();
        ids.forEach(id -> brandsByHeadCompanyId.put(id, new ArrayList<>()));
        Set<UUID> foundHeadCompanyIds = new java.util.HashSet<>();
        jdbc.query(
                "SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, "
                        + "NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, "
                        + "b.version, "
                        + "b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, "
                        + "b.extension_values::text, h.id AS head_company_id FROM organization.head_company h LEFT "
                        + "JOIN "
                        + "organization.head_company_brand_authorization a ON a.head_company_id=h.id LEFT JOIN "
                        + "organization.brand b ON b.id=a.brand_id AND b.workspace_uuid=h.workspace_uuid AND "
                        + "b.group_workspace_key=h.group_workspace_key WHERE h.workspace_uuid=? AND "
                        + "h.group_workspace_key=? AND h.id IN ("
                        + placeholders + ") ORDER BY h.id, b.id",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 3, ids.get(index));
                },
                result -> {
                    while (result.next()) {
                        UUID headCompanyId = result.getObject("head_company_id", UUID.class);
                        foundHeadCompanyIds.add(headCompanyId);
                        if (result.getObject(1, UUID.class) != null)
                            brandsByHeadCompanyId.get(headCompanyId).add(readEntity("BRAND", result));
                    }
                    return null;
                });
        if (foundHeadCompanyIds.size() != ids.size()) throw new OrganizationNotFoundException();
        Map<UUID, List<OrganizationEntityReadback>> immutable = new java.util.LinkedHashMap<>();
        brandsByHeadCompanyId.forEach((headCompanyId, brands) -> immutable.put(headCompanyId, List.copyOf(brands)));
        return Map.copyOf(immutable);
    }

    @Transactional(readOnly = true)
    public List<HeadCompanyBrandAuthorization> authorizedBrandAuthorizations(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
        return jdbc.query(
                "SELECT brand_id, authorized_at_epoch_millis FROM organization.head_company_brand_authorization WHERE "
                        + "head_company_id=? ORDER BY brand_id",
                (row, index) -> new HeadCompanyBrandAuthorization(row.getObject(1, UUID.class), row.getLong(2)),
                headCompanyId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() && "ENABLED".equals(result.getString(1)));
    }

    @Override
    @Transactional(readOnly = true)
    public CatalogScopeLookup.CatalogBrandJudgment resolveCatalogBrand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            UUID dataNodeId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        if (workspaceUuid == null || groupWorkspaceKey == null || dataNodeId == null)
            throw new OrganizationValidationException();
        String requestedBrandRef = selection == null ? null : selection.value();
        if (ServiceNodeTypes.STORE.equals(dataNodeType)) {
            CatalogScopeLookup.CatalogBrandJudgment judgment = jdbc.query(
                    "SELECT brand_id, version FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=? AND status='ENABLED'",
                    s -> {
                        s.setObject(1, dataNodeId);
                        s.setObject(2, workspaceUuid);
                        s.setString(3, groupWorkspaceKey);
                    },
                    r -> {
                        if (!r.next()) throw new OrganizationNotFoundException();
                        return new CatalogScopeLookup.CatalogBrandJudgment(
                                r.getObject(1, UUID.class).toString(),
                                "STORE_PERSISTED_BRAND",
                                "STORE_VERSION:" + r.getLong(2));
                    });
            if (requestedBrandRef != null && !requestedBrandRef.equals(judgment.brandRef()))
                throw new OrganizationValidationException();
            return judgment;
        }
        if (ServiceNodeTypes.HEAD_COMPANY.equals(dataNodeType)) {
            if (requestedBrandRef == null || requestedBrandRef.isBlank()) throw new OrganizationValidationException();
            UUID brand;
            try {
                brand = UUID.fromString(requestedBrandRef);
            } catch (IllegalArgumentException ex) {
                throw new OrganizationValidationException(ex);
            }
            CatalogScopeLookup.CatalogBrandJudgment judgment = jdbc.query(
                    "SELECT h.version, b.version, a.authorized_at_epoch_millis FROM "
                            + "organization.head_company_brand_authorization a JOIN organization.head_company h ON "
                            + "h.id=a.head_company_id JOIN organization.brand b ON b.id=a.brand_id WHERE h.id=? AND "
                            + "h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND a.brand_id=? "
                            + "AND "
                            + "b.status='ENABLED'",
                    s -> {
                        s.setObject(1, dataNodeId);
                        s.setObject(2, workspaceUuid);
                        s.setString(3, groupWorkspaceKey);
                        s.setObject(4, brand);
                    },
                    r -> {
                        if (!r.next()) throw new OrganizationValidationException();
                        return new CatalogScopeLookup.CatalogBrandJudgment(
                                brand.toString(),
                                "HEAD_COMPANY_BRAND_AUTHORIZATION",
                                "HEAD_COMPANY_VERSION:" + r.getLong(1) + ":BRAND_VERSION:" + r.getLong(2)
                                        + ":AUTHORIZED_AT:" + r.getLong(3));
                    });
            return judgment;
        }
        throw new OrganizationValidationException();
    }

    @Override
    @Transactional(readOnly = true)
    public void requireCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            UUID sourceDataNodeId,
            String brandRef) {
        UUID approved = resolveCatalogCopySource(
                workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeId, brandRef);
        if (sourceDataNodeId == null || !approved.equals(sourceDataNodeId)) throw new OrganizationValidationException();
    }

    @Override
    public UUID resolveCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            String brandRef) {
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || targetDataNodeId == null
                || brandRef == null
                || brandRef.isBlank()) throw new OrganizationValidationException();
        if (!ServiceNodeTypes.STORE.equals(targetDataNodeType)) throw new OrganizationValidationException();
        UUID targetBrand = jdbc.query(
                "SELECT brand_id, head_company_id FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=? AND status='ENABLED'",
                s -> {
                    s.setObject(1, targetDataNodeId);
                    s.setObject(2, workspaceUuid);
                    s.setString(3, groupWorkspaceKey);
                },
                r -> {
                    if (!r.next()) throw new OrganizationNotFoundException();
                    return r.getObject(1, UUID.class);
                });
        if (targetBrand == null || !targetBrand.toString().equals(brandRef))
            throw new OrganizationValidationException();
        UUID brand;
        try {
            brand = UUID.fromString(brandRef);
        } catch (IllegalArgumentException ex) {
            throw new OrganizationValidationException(ex);
        }
        UUID source = jdbc.query(
                "SELECT head_company_id FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=? AND status='ENABLED'",
                s -> {
                    s.setObject(1, targetDataNodeId);
                    s.setObject(2, workspaceUuid);
                    s.setString(3, groupWorkspaceKey);
                },
                r -> {
                    if (!r.next() || r.getObject(1, UUID.class) == null) throw new OrganizationValidationException();
                    return r.getObject(1, UUID.class);
                });
        Boolean sourceAllowed = jdbc.query(
                "SELECT EXISTS (SELECT 1 FROM organization.head_company h JOIN "
                        + "organization.head_company_brand_authorization a ON a.head_company_id=h.id JOIN "
                        + "organization.brand b ON b.id=a.brand_id WHERE h.id=? AND h.workspace_uuid=? AND "
                        + "h.group_workspace_key=? AND h.status='ENABLED' AND b.id=? AND b.status='ENABLED')",
                s -> {
                    s.setObject(1, source);
                    s.setObject(2, workspaceUuid);
                    s.setString(3, groupWorkspaceKey);
                    s.setObject(4, brand);
                },
                r -> r.next() && r.getBoolean(1));
        if (!Boolean.TRUE.equals(sourceAllowed)) throw new OrganizationValidationException();
        return source;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterableEntity(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = entityType(entityType);
        return enabled(table(type), workspaceUuid, groupWorkspaceKey, entityId);
    }

    @Override
    @Transactional(readOnly = true)
    public String describeEntityPath(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = Objects.requireNonNullElse(entityType, "").toUpperCase(Locale.ROOT);
        if (BusinessEntityTypes.HEAD_COMPANY.equals(type)) {
            OrganizationEntityReadback value = requireEntity(type, workspaceUuid, groupWorkspaceKey, entityId);
            return value.code() + " " + value.name();
        }
        if (ServiceNodeTypes.STORE.equals(type)) {
            StorePathStore store = jdbc.query(
                    "SELECT project_id, code, name FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=?",
                    statement -> {
                        statement.setObject(1, entityId);
                        statement.setObject(2, workspaceUuid);
                        statement.setString(3, groupWorkspaceKey);
                    },
                    result -> {
                        if (!result.next()) throw new OrganizationNotFoundException();
                        return new StorePathStore(
                                result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                    });
            return nodes.describePath(workspaceUuid, groupWorkspaceKey, store.projectId()) + " / " + store.code() + " "
                    + store.name();
        }
        throw new OrganizationValidationException();
    }

    @Override
    @Transactional(readOnly = true)
    public StoreContractContext requireStoreContractContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return requireStoreContractContext(workspaceUuid, groupWorkspaceKey, storeId, false);
    }

    @Override
    @Transactional
    public StoreContractContext requireStoreContractContextForCreate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return requireStoreContractContext(workspaceUuid, groupWorkspaceKey, storeId, true);
    }

    private StoreContractContext requireStoreContractContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId, boolean lockStoreAndTenant) {
        return jdbc.query(
                "SELECT s.tenant_id, s.project_id, s.status, t.status AS tenant_status, phase.phase_name "
                        + "FROM organization.store s JOIN organization.tenant t ON t.id=s.tenant_id AND "
                        + "t.workspace_uuid=s.workspace_uuid AND t.group_workspace_key=s.group_workspace_key LEFT JOIN "
                        + "organization.project_phase_name phase ON phase.project_id=s.project_id WHERE s.id=? AND "
                        + "s.workspace_uuid=? AND s.group_workspace_key=? ORDER BY phase.display_order"
                        + (lockStoreAndTenant ? " FOR UPDATE OF s, t" : ""),
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    UUID tenantId = result.getObject("tenant_id", UUID.class);
                    UUID projectId = result.getObject("project_id", UUID.class);
                    String status = result.getString("status");
                    String tenantStatus = result.getString("tenant_status");
                    List<String> phases = new ArrayList<>();
                    do {
                        String phase = result.getString("phase_name");
                        if (phase != null) phases.add(phase);
                    } while (result.next());
                    return new StoreContractContext(storeId, tenantId, projectId, status, tenantStatus, phases);
                });
    }

    @Transactional(readOnly = true)
    public OrganizationEntityReadback requireEntity(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        String table = table(type);
        String fields =
                switch (type) {
                    case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, "
                            + "NULL::varchar AS notes";
                    case ServiceNodeTypes
                            .STORE -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS "
                            + "alias, NULL::varchar AS remark, notes";
                    default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
                };
        return jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text FROM organization."
                        + table + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return readEntity(type, result);
                });
    }

    /** Server-side target fact for operations capability resolution; never accept a synthesized group id. */
    @Transactional(readOnly = true)
    public UUID requireCommercialGroupId(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?",
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    /** Server-side project fact for a requested create target; the controller never manufactures a PROJECT resource. */
    @Transactional(readOnly = true)
    public UUID requireProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId) {
        return nodes.requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT)
                .id();
    }

    /** Server-side project fact for an existing store write target; STORE is never a capability target. */
    public UUID requireStoreProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    /**
     * Authoritative store-command target fact. The store relation and project node type are checked together so the
     * owner does not first read project_id and then issue a second project-node query for the same command target.
     */
    private UUID requireStoreOwnerProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT store.project_id FROM organization.store store "
                        + "JOIN organization.organization_node project ON project.id=store.project_id "
                        + "AND project.workspace_uuid=store.workspace_uuid "
                        + "AND project.group_workspace_key=store.group_workspace_key "
                        + "AND project.node_type='PROJECT' "
                        + "WHERE store.id=? AND store.workspace_uuid=? AND store.group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    /**
     * One authoritative update projection. It carries the store before-image, the project target and the exact
     * reference predicates that updateStoreSubmission must enforce. The projection is read before the idempotency
     * receipt is claimed, just like the former target read; the reference decision itself remains inside the receipt
     * callback so invalid commands retain the existing receipt/error ordering.
     */
    private StoreCommandFacts readStoreCommandFacts(UpdateStoreCommand command) {
        return jdbc.query(
                "WITH requested AS (SELECT ?::uuid AS workspace_uuid, ?::text AS group_workspace_key, ?::uuid AS"
                        + " tenant_id, ?::uuid AS brand_id, ?::uuid AS head_company_id) SELECT store.id,"
                        + " store.workspace_uuid, store.group_workspace_key, store.code, store.name, NULL::varchar AS"
                        + " legal_name, NULL::varchar AS credit_code, NULL::varchar AS alias, NULL::varchar AS remark,"
                        + " store.notes, store.status, store.version, store.extension_rule_revision,"
                        + " store.created_at_epoch_millis, store.updated_at_epoch_millis, store.extension_values::text,"
                        + " store.project_id, store.tenant_id, store.brand_id, store.head_company_id,"
                        + " (project.status='ENABLED') AS project_enabled, EXISTS(SELECT 1 FROM organization.tenant"
                        + " tenant, requested request WHERE tenant.id=request.tenant_id AND"
                        + " tenant.workspace_uuid=request.workspace_uuid AND"
                        + " tenant.group_workspace_key=request.group_workspace_key AND tenant.status='ENABLED') AS"
                        + " tenant_enabled, EXISTS(SELECT 1 FROM organization.brand brand, requested request WHERE"
                        + " brand.id=request.brand_id AND brand.workspace_uuid=request.workspace_uuid AND"
                        + " brand.group_workspace_key=request.group_workspace_key AND brand.status='ENABLED') AS"
                        + " brand_enabled, (request.head_company_id IS NULL OR EXISTS(SELECT 1 FROM"
                        + " organization.head_company head_company WHERE head_company.id=request.head_company_id AND"
                        + " head_company.workspace_uuid=request.workspace_uuid AND"
                        + " head_company.group_workspace_key=request.group_workspace_key AND"
                        + " head_company.status='ENABLED')) AS head_company_enabled, (request.head_company_id IS NULL"
                        + " OR"
                        + " EXISTS(SELECT 1 FROM organization.head_company_brand_authorization hba WHERE"
                        + " hba.head_company_id=request.head_company_id AND hba.brand_id=request.brand_id)) AS"
                        + " head_company_authorized FROM organization.store store JOIN organization.organization_node"
                        + " project ON project.id=store.project_id AND project.workspace_uuid=store.workspace_uuid AND"
                        + " project.group_workspace_key=store.group_workspace_key AND project.node_type='PROJECT' CROSS"
                        + " JOIN requested request WHERE store.id=? AND store.workspace_uuid=? AND"
                        + " store.group_workspace_key=?",
                statement -> {
                    statement.setObject(1, command.workspaceUuid());
                    statement.setString(2, command.groupWorkspaceKey());
                    statement.setObject(3, command.tenantId());
                    statement.setObject(4, command.brandId());
                    statement.setObject(5, command.headCompanyId());
                    statement.setObject(6, command.storeId());
                    statement.setObject(7, command.workspaceUuid());
                    statement.setString(8, command.groupWorkspaceKey());
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    OrganizationEntityReadback before = readEntity(ServiceNodeTypes.STORE, result);
                    return new StoreCommandFacts(
                            before,
                            result.getObject(17, UUID.class),
                            result.getObject(18, UUID.class),
                            result.getObject(19, UUID.class),
                            result.getObject(20, UUID.class),
                            new StoreReferenceFacts(
                                    result.getBoolean("project_enabled"),
                                    result.getBoolean("tenant_enabled"),
                                    result.getBoolean("brand_enabled"),
                                    result.getBoolean("head_company_enabled"),
                                    result.getBoolean("head_company_authorized")));
                });
    }

    /** One owner projection for status transitions; it preserves the target type check and the before-image read. */
    private StoreStatusFacts readStoreStatusFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT store.id, store.workspace_uuid, store.group_workspace_key, store.code, store.name, "
                        + "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS alias, "
                        + "NULL::varchar AS remark, store.notes, store.status, store.version, "
                        + "store.extension_rule_revision, store.created_at_epoch_millis, "
                        + "store.updated_at_epoch_millis, store.extension_values::text, store.project_id "
                        + "FROM organization.store store "
                        + "JOIN organization.organization_node project ON project.id=store.project_id "
                        + "AND project.workspace_uuid=store.workspace_uuid "
                        + "AND project.group_workspace_key=store.group_workspace_key "
                        + "AND project.node_type='PROJECT' "
                        + "WHERE store.id=? AND store.workspace_uuid=? AND store.group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return new StoreStatusFacts(
                            readEntity(ServiceNodeTypes.STORE, result), result.getObject(17, UUID.class));
                });
    }

    private record StoreCommandFacts(
            OrganizationEntityReadback before,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            StoreReferenceFacts references) {
        private void requireEnabledReferences() {
            if (!references.allEnabled()) throw new OrganizationValidationException();
        }
    }

    private record StoreStatusFacts(OrganizationEntityReadback before, UUID projectId) {}

    /**
     * Narrow immutable facts needed by the operations edge before the owner command performs its authoritative recheck.
     */
    public StoreUpdateFacts readStoreUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT project_id, tenant_id, brand_id, code FROM organization.store "
                        + "WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return new StoreUpdateFacts(
                            result.getObject(1, UUID.class),
                            result.getObject(2, UUID.class),
                            result.getObject(3, UUID.class),
                            result.getString(4));
                });
    }

    public record StoreUpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> listEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        String table = table(type);
        String fields =
                switch (type) {
                    case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, "
                            + "NULL::varchar AS notes";
                    case ServiceNodeTypes
                            .STORE -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS "
                            + "alias, NULL::varchar AS remark, notes";
                    default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
                };
        return jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text FROM organization."
                        + table + " WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY code",
                (row, index) -> readEntity(type, row),
                workspaceUuid,
                groupWorkspaceKey);
    }

    /**
     * Brand list truth stays with the organization owner: predicate, total and bounded slice are one query contract.
     */
    @Transactional(readOnly = true)
    public BrandPage pageBrands(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String queryText,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        BusinessEntityPage values = pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                "BRAND",
                queryText,
                null,
                null,
                null,
                status,
                sort,
                direction,
                page,
                pageSize,
                true);
        return new BrandPage(
                values.items().stream().map(BusinessEntityPageItem::entity).toList(),
                values.total(),
                values.page(),
                values.pageSize());
    }

    /** Every business-entity page keeps predicate, total and bounded slice inside the organization owner. */
    @Transactional(readOnly = true)
    public EntityPage pageEntities(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        String type = entityType(entityType);
        BusinessEntityPage values = pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                type,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize);
        return new EntityPage(
                values.items().stream().map(BusinessEntityPageItem::entity).toList(),
                values.total(),
                values.page(),
                values.pageSize());
    }

    /**
     * Canonical organization-owner read for every business-entity list. External edges may expose different response
     * shapes, but their entity predicate, count and bounded slice must pass here.
     */
    @Transactional(readOnly = true)
    public BusinessEntityPage pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        return pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize,
                false);
    }

    private BusinessEntityPage pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            boolean brandQueryText) {
        String type = entityType == null ? null : entityType(entityType);
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new OrganizationValidationException();
        String order =
                switch (Objects.requireNonNullElse(sort, "NAME")) {
                    case "NAME" -> "name";
                    case "CODE" -> "code";
                    case "UPDATED_AT" -> "updated_at_epoch_millis";
                    default -> throw new OrganizationValidationException();
                };
        String safeDirection =
                switch (Objects.requireNonNullElse(direction, "ASC")) {
                    case "ASC", "DESC" -> Objects.requireNonNullElse(direction, "ASC");
                    default -> throw new OrganizationValidationException();
                };
        String safeStatus = status == null
                ? null
                : switch (status) {
                    case "ENABLED", "DISABLED", "VOIDED" -> status;
                    default -> throw new OrganizationValidationException();
                };
        String nameFilter = filter(name);
        String codeFilter = filter(code);
        String legalNameFilter = filter(legalName);
        String unifiedSocialCreditCodeFilter = filter(unifiedSocialCreditCode);
        List<Object> parameters = new ArrayList<>();
        for (int index = 0; index < 3; index++) {
            parameters.add(workspaceUuid);
            parameters.add(groupWorkspaceKey);
        }
        String predicate;
        if (brandQueryText) {
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(safeStatus);
            parameters.add(safeStatus);
            parameters.add(type);
            parameters.add(type);
            predicate = "(CAST(? AS text) IS NULL OR lower(name) LIKE ? OR lower(code) LIKE ?) AND (CAST(? AS text) IS "
                    + "NULL OR status=?) AND (CAST(? AS text) IS NULL OR entity_type=?)";
        } else {
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(codeFilter);
            parameters.add(codeFilter);
            parameters.add(legalNameFilter);
            parameters.add(legalNameFilter);
            parameters.add(unifiedSocialCreditCodeFilter);
            parameters.add(unifiedSocialCreditCodeFilter);
            parameters.add(safeStatus);
            parameters.add(safeStatus);
            parameters.add(type);
            parameters.add(type);
            predicate =
                    "(CAST(? AS text) IS NULL OR lower(name) LIKE ?) AND (CAST(? AS text) IS NULL OR lower(code) LIKE "
                            + "?) AND (CAST(? AS text) IS NULL OR lower(legal_name) LIKE ?) AND (CAST(? AS text) IS "
                            + "NULL "
                            + "OR lower(credit_code) LIKE ?) AND (CAST(? AS text) IS NULL OR status=?) AND (CAST(? AS "
                            + "text) IS NULL OR entity_type=?)";
        }
        String rows = businessEntityRowsSql();
        long total = jdbc.queryForObject(
                "SELECT count(*) FROM (" + rows + ") entities WHERE " + predicate, Long.class, parameters.toArray());
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(pageSize);
        pageParameters.add((page - 1) * pageSize);
        List<BusinessEntityPageItem> items = jdbc.query(
                "SELECT " + BUSINESS_ENTITY_PROJECTION + " FROM (" + rows + ") entities WHERE " + predicate
                        + " ORDER BY " + order + " " + safeDirection + ", id ASC LIMIT ? OFFSET ?",
                (row, index) -> new BusinessEntityPageItem(row.getString(17), readEntity(row.getString(17), row)),
                pageParameters.toArray());
        return new BusinessEntityPage(items, total, page, pageSize);
    }

    /** Canonical owner lookup when an app knows a business-entity id but not its subtype. */
    @Transactional(readOnly = true)
    public BusinessEntityPageItem requireBusinessEntity(UUID workspaceUuid, String groupWorkspaceKey, UUID entityId) {
        List<BusinessEntityPageItem> values = jdbc.query(
                "SELECT " + BUSINESS_ENTITY_PROJECTION + " FROM (" + businessEntityRowsSql() + ") entities WHERE id=?",
                (row, index) -> new BusinessEntityPageItem(row.getString(17), readEntity(row.getString(17), row)),
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                groupWorkspaceKey,
                entityId);
        if (values.isEmpty()) throw new OrganizationNotFoundException();
        return values.getFirst();
    }

    private static String businessEntityRowsSql() {
        return "SELECT id, workspace_uuid, group_workspace_key, code, name, NULL::varchar AS legal_name, NULL::varchar "
                + "AS credit_code, alias, remark, NULL::varchar AS notes, status, version, extension_rule_revision, "
                + "created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, 'BRAND' AS entity_type "
                + "FROM "
                + "organization.brand WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, "
                + "workspace_uuid, group_workspace_key, code, name, legal_name, credit_code, NULL::varchar AS alias, "
                + "remark, NULL::varchar AS notes, status, version, extension_rule_revision, created_at_epoch_millis, "
                + "updated_at_epoch_millis, extension_values::text, 'TENANT' AS entity_type FROM organization.tenant "
                + "WHERE "
                + "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, workspace_uuid, "
                + "group_workspace_key, "
                + "code, name, legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes, "
                + "status, "
                + "version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, "
                + "extension_values::text, 'HEAD_COMPANY' AS entity_type FROM organization.head_company WHERE "
                + "workspace_uuid=? AND group_workspace_key=?";
    }

    /**
     * Owner-bounded readback for a caller's already paged entity identifiers. It deliberately does not offer an
     * unbounded page replacement.
     */
    @Transactional(readOnly = true)
    public Map<UUID, OrganizationEntityReadback> requireEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedIds) {
        List<UUID> ids = requestedIds == null
                ? List.of()
                : requestedIds.stream().distinct().toList();
        if (ids.isEmpty()) return Map.of();
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        String table = table(type);
        String fields =
                switch (type) {
                    case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, "
                            + "NULL::varchar AS notes";
                    case ServiceNodeTypes
                            .STORE -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS "
                            + "alias, NULL::varchar AS remark, notes";
                    default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
                };
        Map<UUID, OrganizationEntityReadback> values = new java.util.LinkedHashMap<>();
        Object[] parameters = new Object[ids.size() + 2];
        parameters[0] = workspaceUuid;
        parameters[1] = groupWorkspaceKey;
        for (int index = 0; index < ids.size(); index++) parameters[index + 2] = ids.get(index);
        jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text FROM organization."
                        + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND id IN ("
                        + String.join(",", java.util.Collections.nCopies(ids.size(), "?")) + ")",
                (row, index) -> {
                    OrganizationEntityReadback value = readEntity(type, row);
                    values.put(value.id(), value);
                    return value;
                },
                parameters);
        if (values.size() != ids.size()) throw new OrganizationNotFoundException();
        return Map.copyOf(values);
    }

    private static String filter(String value) {
        return value == null || value.isBlank() ? null : "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }

    /**
     * Checks the grant against a target already resolved by this owner in the current command. The resolver query is
     * the command's fresh owner fact; repeating it here only adds a round trip.
     */
    private void requireOwnerGrantForResolvedTarget(
            OperationsOwnerScopeGrant grant,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetType,
            UUID targetId) {
        if (grant == null || !grant.matches(workspaceUuid, groupWorkspaceKey, targetType, targetId))
            throw new OrganizationAuthorizationException();
    }

    /** Uses the server-minted target fact already carried by the grant; do not reread the same owner row. */
    private UUID resolvedOwnerTargetId(
            OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, String targetType) {
        if (grant == null
                || !Objects.equals(grant.workspaceUuid(), workspaceUuid)
                || !Objects.equals(grant.groupWorkspaceKey(), groupWorkspaceKey)
                || !Objects.equals(grant.targetType(), targetType)
                || grant.targetId() == null) throw new OrganizationAuthorizationException();
        return grant.targetId();
    }

    private OrganizationEntityReadback requireHeadCompanyOwnerFact(
            OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        if (grant == null
                || !grant.matches(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, headCompanyId))
            throw new OrganizationAuthorizationException();
        return requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
    }

    private void requireOwnerGrant(
            OperationsOwnerScopeGrant grant,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetType,
            UUID targetId) {
        if (grant == null || !grant.matches(workspaceUuid, groupWorkspaceKey, targetType, targetId))
            throw new OrganizationAuthorizationException();
        if (ServiceNodeTypes.GROUP.equals(targetType)) requireCommercialGroupId(workspaceUuid, groupWorkspaceKey);
        else if (ServiceNodeTypes.PROJECT.equals(targetType))
            requireProjectId(workspaceUuid, groupWorkspaceKey, targetId);
        else requireEntity(targetType, workspaceUuid, groupWorkspaceKey, targetId);
    }

    private static OrganizationEntityReadback readEntity(String type, java.sql.ResultSet result)
            throws java.sql.SQLException {
        return new OrganizationEntityReadback(
                result.getObject(1, UUID.class),
                type,
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getString(11),
                result.getLong(12),
                result.getString(8),
                result.getString(9),
                result.getString(10),
                result.getLong(13),
                result.getLong(14),
                result.getLong(15),
                jsonObject(result.getString(16)));
    }

    private void validateValues(String type, UUID workspaceUuid, String key, Map<String, String> values) {
        Map<String, String> actual = values == null ? Map.of() : values;
        try {
            ExtensionDefinitionReadback definition = definitions.requireDefinition(workspaceUuid, key, type);
            if (!actual.isEmpty()) ExtensionDefinitionService.requireConsumableDefinition(definition);
            Map<String, ExtensionDefinitionReadback.Field> known = definition.fields().stream()
                    .collect(java.util.stream.Collectors.toMap(
                            ExtensionDefinitionReadback.Field::fieldKey, value -> value));
            if (actual.keySet().stream().anyMatch(field -> !known.containsKey(field))
                    || actual.entrySet().stream()
                            .anyMatch(entry ->
                                    !"DISABLED".equals(known.get(entry.getKey()).status())
                                            && !isJsonNull(entry.getValue())
                                            && !validJsonValue(known.get(entry.getKey()), entry.getValue())))
                throw new OrganizationValidationException();
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (!actual.isEmpty()) throw new OrganizationValidationException(absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
    }

    private void replaceValues(
            String table, UUID id, UUID workspaceUuid, String key, String hostType, Map<String, String> values) {
        String current = jdbc.query(
                "SELECT extension_values::text FROM organization." + table + " WHERE id=?",
                statement -> statement.setObject(1, id),
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getString(1);
                });
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, key, hostType);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (values != null && !values.isEmpty()) throw new OrganizationValidationException(absent);
            validateExistingExtensionValues(current);
            jdbc.update(
                    "UPDATE organization." + table
                            + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?",
                    current,
                    0L,
                    id);
            return;
        }
        final String merged;
        try {
            merged = ExtensionDefinitionService.mergeValues(definition, current, values);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
        jdbc.update(
                "UPDATE organization." + table
                        + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?",
                merged.toString(),
                definition.version(),
                id);
    }

    private static void validateExistingExtensionValues(String current) {
        try {
            ExtensionDefinitionService.readValues(current);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
    }

    private void replaceValues(
            String table, UUID id, UUID workspaceUuid, String key, String hostType, ExtensionSubmission submission) {
        String current = jdbc.query(
                "SELECT extension_values::text FROM organization." + table + " WHERE id=?",
                statement -> statement.setObject(1, id),
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getString(1);
                });
        replaceValuesWithCurrent(table, id, workspaceUuid, key, hostType, current, submission);
    }

    private void replaceValues(
            String table,
            UUID id,
            UUID workspaceUuid,
            String key,
            String hostType,
            Map<String, String> currentValues,
            ExtensionSubmission submission) {
        replaceValuesWithCurrent(table, id, workspaceUuid, key, hostType, extensionJson(currentValues), submission);
    }

    private void replaceValuesWithCurrent(
            String table,
            UUID id,
            UUID workspaceUuid,
            String key,
            String hostType,
            String current,
            ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, key, hostType);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty()) throw new OrganizationValidationException(absent);
            jdbc.update(
                    "UPDATE organization." + table
                            + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?",
                    current,
                    0L,
                    id);
            return;
        }
        String merged;
        try {
            merged = ExtensionDefinitionService.mergeValues(definition, current, submission);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
        jdbc.update(
                "UPDATE organization." + table
                        + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?",
                merged,
                definition.version(),
                id);
    }

    private ExtensionValues extensionValuesForUpdate(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            Map<String, String> currentValues,
            ExtensionSubmission submission) {
        String current = extensionJson(currentValues);
        ExtensionDefinitionReadback definition;
        try {
            definition =
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.HEAD_COMPANY);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty()) throw new OrganizationValidationException(absent);
            return new ExtensionValues(current, 0L);
        }
        try {
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, current, submission), definition.version());
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
    }

    /** New rows start with the schema's empty JSON object; do not reread that row just to merge extensions. */
    private void replaceNewValues(
            String table, UUID id, UUID workspaceUuid, String key, String hostType, ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, key, hostType);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty()) throw new OrganizationValidationException(absent);
            return;
        }
        final String merged;
        try {
            merged = ExtensionDefinitionService.mergeValues(definition, "{}", submission);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
        jdbc.update(
                "UPDATE organization." + table
                        + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?",
                merged,
                definition.version(),
                id);
    }

    private static Map<String, String> jsonObject(String source) {
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isObject()) throw new OrganizationValidationException();
            Map<String, String> values = new java.util.LinkedHashMap<>();
            node.fields()
                    .forEachRemaining(
                            entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return Map.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new OrganizationValidationException(failure);
        }
    }

    private static String extensionJson(Map<String, String> values) {
        ObjectNode object = JSON.createObjectNode();
        if (values == null) return object.toString();
        values.forEach((key, rawValue) -> {
            try {
                if (rawValue == null) {
                    object.putNull(key);
                } else {
                    object.set(key, JSON.readTree(rawValue));
                }
            } catch (java.io.IOException failure) {
                throw new OrganizationValidationException(failure);
            }
        });
        return object.toString();
    }

    private boolean enabled(String table, UUID workspaceUuid, String key, UUID id) {
        return jdbc.query(
                "SELECT status='ENABLED' FROM organization." + table
                        + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> result.next() && result.getBoolean(1));
    }

    private record StorePathStore(UUID projectId, String code, String name) {}

    private void ensureAvailable(
            String type, UUID workspaceUuid, String key, UUID currentId, String code, String name) {
        String table = table(type);
        String codeValue = text(code, 64);
        String nameValue = text(name, 120).toLowerCase(Locale.ROOT);
        String exclusion = currentId == null ? "" : " AND id<>?";
        String sql = "SELECT EXISTS(SELECT 1 FROM organization." + table
                + " WHERE workspace_uuid=? AND group_workspace_key=? AND status <> 'VOIDED' AND code=?" + exclusion
                + ") AS code_conflict, EXISTS(SELECT 1 FROM organization." + table
                + " WHERE workspace_uuid=? AND group_workspace_key=? AND status <> 'VOIDED' AND lower(btrim(name))=?"
                + exclusion + ") AS name_conflict";
        Object[] args = currentId == null
                ? new Object[] {workspaceUuid, key, codeValue, workspaceUuid, key, nameValue}
                : new Object[] {workspaceUuid, key, codeValue, currentId, workspaceUuid, key, nameValue, currentId};
        Boolean[] conflicts = jdbc.query(
                sql,
                statement -> {
                    for (int index = 0; index < args.length; index++) statement.setObject(index + 1, args[index]);
                },
                result -> {
                    if (!result.next()) throw new OrganizationConflictException();
                    return new Boolean[] {result.getBoolean("code_conflict"), result.getBoolean("name_conflict")};
                });
        if (conflicts[0]) throw new OrganizationCodeConflictException();
        if (conflicts[1]) throw new OrganizationNameConflictException();
    }

    /**
     * Store command validation is one organization-owner fact read. It preserves the prior individual predicates:
     * project, tenant, and brand must be enabled; a supplied head company must be enabled and authorized for the
     * selected brand. The command still reports the same generic validation problem for any failed reference.
     */
    private void validateStoreReferences(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId) {
        StoreReferenceFacts facts = jdbc.query(
                "WITH requested AS (SELECT ?::uuid AS workspace_uuid, ?::text AS group_workspace_key, ?::uuid AS"
                        + " project_id, ?::uuid AS tenant_id, ?::uuid AS brand_id, ?::uuid AS head_company_id) SELECT"
                        + " EXISTS(SELECT 1 FROM organization.organization_node node, requested request WHERE"
                        + " node.id=request.project_id AND node.workspace_uuid=request.workspace_uuid AND"
                        + " node.group_workspace_key=request.group_workspace_key AND node.node_type='PROJECT' AND"
                        + " node.status='ENABLED') AS project_enabled, EXISTS(SELECT 1 FROM organization.tenant tenant,"
                        + " requested request WHERE tenant.id=request.tenant_id AND"
                        + " tenant.workspace_uuid=request.workspace_uuid AND"
                        + " tenant.group_workspace_key=request.group_workspace_key AND tenant.status='ENABLED') AS"
                        + " tenant_enabled, EXISTS(SELECT 1 FROM organization.brand brand, requested request WHERE"
                        + " brand.id=request.brand_id AND brand.workspace_uuid=request.workspace_uuid AND"
                        + " brand.group_workspace_key=request.group_workspace_key AND brand.status='ENABLED') AS"
                        + " brand_enabled, (request.head_company_id IS NULL OR EXISTS(SELECT 1 FROM"
                        + " organization.head_company head_company WHERE head_company.id=request.head_company_id AND"
                        + " head_company.workspace_uuid=request.workspace_uuid AND"
                        + " head_company.group_workspace_key=request.group_workspace_key AND"
                        + " head_company.status='ENABLED')) AS head_company_enabled, (request.head_company_id IS NULL"
                        + " OR"
                        + " EXISTS(SELECT 1 FROM organization.head_company_brand_authorization hba WHERE"
                        + " hba.head_company_id=request.head_company_id AND hba.brand_id=request.brand_id)) AS"
                        + " head_company_authorized FROM requested request",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, projectId);
                    statement.setObject(4, tenantId);
                    statement.setObject(5, brandId);
                    statement.setObject(6, headCompanyId);
                },
                result -> {
                    if (!result.next()) throw new OrganizationValidationException();
                    return new StoreReferenceFacts(
                            result.getBoolean("project_enabled"),
                            result.getBoolean("tenant_enabled"),
                            result.getBoolean("brand_enabled"),
                            result.getBoolean("head_company_enabled"),
                            result.getBoolean("head_company_authorized"));
                });
        if (!facts.allEnabled()) throw new OrganizationValidationException();
    }

    private record StoreReferenceFacts(
            boolean projectEnabled,
            boolean tenantEnabled,
            boolean brandEnabled,
            boolean headCompanyEnabled,
            boolean headCompanyAuthorized) {
        boolean allEnabled() {
            return projectEnabled && tenantEnabled && brandEnabled && headCompanyEnabled && headCompanyAuthorized;
        }
    }

    private boolean authorized(UUID headCompanyId, UUID brandId) {
        return !jdbc.query(
                        "SELECT 1 FROM organization.head_company_brand_authorization WHERE head_company_id=? AND "
                                + "brand_id=?",
                        (row, index) -> row.getInt(1),
                        headCompanyId,
                        brandId)
                .isEmpty();
    }

    private boolean hasStoreReference(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId) {
        return !jdbc.query(
                        "SELECT 1 FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND "
                                + "head_company_id=? AND brand_id=? LIMIT 1",
                        (row, index) -> row.getInt(1),
                        workspaceUuid,
                        groupWorkspaceKey,
                        headCompanyId,
                        brandId)
                .isEmpty();
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String entityType,
            String action,
            long now,
            AuditActor actor,
            List<AuditChange> changes) {
        AuditChangePolicy policy = new AuditChangePolicy(entityType, action, AUDIT_FIELDS);
        jdbc.update(
                "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
                        + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                        + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS "
                        + "JSONB))",
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                id.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                auditJson(policy.allow(changes)));
    }

    private static List<AuditChange> createdChanges(OrganizationEntityReadback value) {
        return List.of(
                new AuditChange("code", null, value.code()),
                new AuditChange("name", null, value.name()),
                new AuditChange("status", null, value.status()));
    }

    private static List<AuditChange> changed(OrganizationEntityReadback before, OrganizationEntityReadback after) {
        return List.of(
                        new AuditChange("code", before.code(), after.code()),
                        new AuditChange("name", before.name(), after.name()),
                        new AuditChange("status", before.status(), after.status()))
                .stream()
                .filter(change -> !Objects.equals(change.beforeValue(), change.afterValue()))
                .toList();
    }

    private static String auditJson(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private static String entityType(String value) {
        String type = Objects.requireNonNullElse(value, "").toUpperCase(Locale.ROOT);
        if (!ENTITY_TYPES.contains(type)) throw new OrganizationValidationException();
        return type;
    }

    private static String table(String type) {
        return switch (type) {
            case "BRAND" -> "brand";
            case "TENANT" -> "tenant";
            case ServiceNodeTypes.HEAD_COMPANY -> "head_company";
            case ServiceNodeTypes.STORE -> "store";
            default -> throw new OrganizationValidationException();
        };
    }

    private static void requireMutable(String status) {
        if ("VOIDED".equals(status)) throw new OrganizationConflictException();
    }

    private static String text(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit) throw new OrganizationValidationException();
        return normalized;
    }

    private static String optional(String value, int limit) {
        if (value == null || value.isBlank()) return null;
        return text(value, limit);
    }

    private static boolean isJsonNull(String value) {
        return value == null || "null".equals(value.trim());
    }

    private static boolean validJsonValue(ExtensionDefinitionReadback.Field field, String value) {
        if (isJsonNull(value)) return false;
        try {
            JsonNode json = JSON.readTree(value);
            return switch (field.fieldType()) {
                case "TEXT" -> json.isTextual();
                case "NUMBER" -> json.isNumber();
                case "DATE" -> json.isTextual() && json.asText().matches("\\d{4}-\\d{2}-\\d{2}");
                case "BOOLEAN" -> json.isBoolean();
                case "SELECT" -> json.isTextual() && field.options().contains(json.asText());
                default -> false;
            };
        } catch (java.io.IOException failure) {
            return false;
        }
    }

    private static String canonical(String operation, Object... values) {
        StringBuilder result = new StringBuilder(operation);
        for (Object value : values) {
            String safe = value instanceof Map<?, ?> map
                    ? map.entrySet().stream()
                            .sorted(java.util.Map.Entry.comparingByKey(java.util.Comparator.comparing(String::valueOf)))
                            .map(entry -> String.valueOf(entry.getKey()) + "=" + String.valueOf(entry.getValue()))
                            .collect(java.util.stream.Collectors.joining("\\u001f"))
                    : String.valueOf(value == null ? "<null>" : value);
            result.append('|').append(safe.length()).append(':').append(safe);
        }
        return result.toString();
    }

    public static class OrganizationNotFoundException extends RuntimeException {
        public OrganizationNotFoundException() {}

        public OrganizationNotFoundException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationDuplicateException extends RuntimeException {
        public OrganizationDuplicateException() {}

        public OrganizationDuplicateException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationCodeConflictException extends RuntimeException {}

    public static final class OrganizationNameConflictException extends RuntimeException {}

    public static class OrganizationConflictException extends RuntimeException {
        public OrganizationConflictException() {}

        public OrganizationConflictException(Throwable cause) {
            super(cause);
        }
    }

    private record ExtensionValues(String json, long revision) {}

    /** Closed conflict without store identity, count, or persistence detail. */
    public static final class HeadCompanyBrandAuthorizationInUseException extends OrganizationConflictException {
        public HeadCompanyBrandAuthorizationInUseException() {}

        public HeadCompanyBrandAuthorizationInUseException(Throwable cause) {
            super(cause);
        }
    }

    public static final class HeadCompanyBrandAuthorizationNotFoundException extends OrganizationNotFoundException {}

    public static final class OrganizationValidationException extends RuntimeException {
        public OrganizationValidationException() {}

        public OrganizationValidationException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationAuthorizationException extends RuntimeException {}

    public record HeadCompanyBrandAuthorization(UUID brandId, long authorizedAtEpochMillis) {}

    public record BrandPage(List<OrganizationEntityReadback> items, long total, int page, int pageSize) {}

    public record EntityPage(List<OrganizationEntityReadback> items, long total, int page, int pageSize) {}

    public record BusinessEntityPageItem(String entityType, OrganizationEntityReadback entity) {}

    public record BusinessEntityPage(List<BusinessEntityPageItem> items, long total, int page, int pageSize) {}
}
