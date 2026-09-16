package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.BusinessTenantPersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.TenantCreateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.TenantStatusCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.TenantUpdateCommand;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Tenant lifecycle owner. Generic entity calls reach this bean through BusinessEntityCommandRouter. */
@Service
public class BusinessTenantService {
    private static final Set<String> VALID_STATUS = Set.of("ENABLED", "DISABLED", "VOIDED");
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship", "notes");
    private final BusinessTenantPersistence persistence;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityCommandReceiptService receipts;
    private final BusinessEntityTaskReadService reads;

    @Autowired
    public BusinessTenantService(
            BusinessTenantPersistence persistence,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            BusinessEntityTaskReadService reads) {
        this.persistence = persistence;
        this.time = time;
        this.definitions = definitions;
        this.receipts = receipts;
        this.reads = reads;
    }

    BusinessTenantService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            com.catering.v2s.organization.api.OrganizationNodeLookup nodes) {
        this(new BusinessTenantPersistence(jdbc), time, definitions, receipts, new BusinessEntityTaskReadService(jdbc, nodes));
    }

    BusinessTenantService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            BusinessEntityTaskReadService reads) {
        this(new BusinessTenantPersistence(jdbc), time, definitions, receipts, reads);
    }

    @Transactional
    public OrganizationEntityReadback createTenant(TenantCreateCommand command) {
        requireGroupGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "createEntity",
                        BusinessEntityTypes.TENANT,
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        command.legalName(),
                        command.creditCode(),
                        null,
                        command.remark(),
                        command.extensionSubmission()),
                () -> createTenantNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        command.legalName(),
                        command.creditCode(),
                        command.remark(),
                        command.extensionSubmission(),
                        command.actor()));
    }

    @Transactional
    public OrganizationEntityReadback updateTenant(TenantUpdateCommand command) {
        requireGroupGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "updateEntity",
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
                        command.extensionSubmission()),
                () -> updateTenantNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.tenantId(),
                        command.code(),
                        command.name(),
                        command.legalName(),
                        command.creditCode(),
                        command.remark(),
                        command.expectedVersion(),
                        command.extensionSubmission(),
                        command.actor()));
    }

    @Transactional
    public OrganizationEntityReadback transitionTenantStatus(TenantStatusCommand command) {
        requireGroupGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey());
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

    /** Canonical generic create entry used by the operation-id router. */
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
        requireTenant(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return createTenantMapNow(
                    workspaceUuid,
                    groupWorkspaceKey,
                    code,
                    name,
                    legalName,
                    creditCode,
                    remark,
                    extensionValues,
                    safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "createEntity",
                        BusinessEntityTypes.TENANT,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        extensionValues),
                () -> createTenantMapNow(
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        remark,
                        extensionValues,
                        safeActor));
    }

    /** Canonical generic update entry used by the operation-id router. */
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
        requireTenant(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return updateTenantMapNow(
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    code,
                    name,
                    legalName,
                    creditCode,
                    remark,
                    expectedVersion,
                    extensionValues,
                    safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "updateEntity",
                        BusinessEntityTypes.TENANT,
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
                () -> updateTenantMapNow(
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        code,
                        name,
                        legalName,
                        creditCode,
                        remark,
                        expectedVersion,
                        extensionValues,
                        safeActor));
    }

    /** Canonical generic status entry used by the operation-id router. */
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
        requireTenant(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return transitionTenantNow(workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "transitionEntityStatus",
                        BusinessEntityTypes.TENANT,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        status,
                        expectedVersion),
                () -> transitionTenantNow(workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor));
    }

    private OrganizationEntityReadback createTenantNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            ExtensionSubmission submission,
            AuditActor actor) {
        ensureAvailable(workspaceUuid, groupWorkspaceKey, null, code, name);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            persistence.insert(
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    BusinessEntityValueSupport.text(code, 64),
                    BusinessEntityValueSupport.text(name, 120),
                    BusinessEntityValueSupport.text(legalName, 240),
                    BusinessEntityValueSupport.text(creditCode, 32),
                    BusinessEntityValueSupport.optional(remark, 2000),
                    now);
        } catch (org.springframework.dao.DuplicateKeyException exception) {
            throw new BusinessEntityService.OrganizationDuplicateException(exception);
        }
        replaceNewValues(id, workspaceUuid, groupWorkspaceKey, submission);
        OrganizationEntityReadback created = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(BusinessEntityTypes.TENANT, workspaceUuid, groupWorkspaceKey, id));
        ExtensionDefinitionReadback definition = BusinessEntityValueSupport.optionalDefinition(
                definitions, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.TENANT);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "TENANT_CREATED",
                now,
                actor,
                BusinessEntityValueSupport.withExtensionChanges(
                        BusinessEntityValueSupport.createdChanges(created), null, created, definition, submission),
                BusinessEntityValueSupport.extensionKeys(definition));
        return created;
    }

    private OrganizationEntityReadback createTenantMapNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            Map<String, String> values,
            AuditActor actor) {
        validateValues(workspaceUuid, groupWorkspaceKey, values);
        return createTenantNow(
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                legalName,
                creditCode,
                remark,
                new ExtensionSubmission(values == null ? List.of() : values.entrySet().stream()
                        .map(entry -> BusinessEntityValueSupport.isJsonNull(entry.getValue())
                                ? ExtensionSubmission.ExtensionFieldValue.clear(entry.getKey())
                                : new ExtensionSubmission.ExtensionFieldValue(
                                        entry.getKey(), entry.getValue(), ExtensionSubmission.Mode.SET))
                        .toList()),
                actor);
    }

    private OrganizationEntityReadback updateTenantNow(
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
            AuditActor actor) {
        OrganizationEntityReadback before = reads.requireEntity(BusinessEntityTypes.TENANT, workspaceUuid, groupWorkspaceKey, id);
        BusinessEntityValueSupport.requireMutable(before.status());
        ensureAvailable(workspaceUuid, groupWorkspaceKey, id, code, name);
        if (persistence.update(
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        BusinessEntityValueSupport.text(code, 64),
                        BusinessEntityValueSupport.text(name, 120),
                        BusinessEntityValueSupport.text(legalName, 240),
                        BusinessEntityValueSupport.text(creditCode, 32),
                        BusinessEntityValueSupport.optional(remark, 2000),
                        time.currentEpochMillis(),
                        expectedVersion)
                != 1) throw new BusinessEntityService.OrganizationConflictException();
        replaceValues(id, workspaceUuid, groupWorkspaceKey, before.extensionValues(), submission);
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(BusinessEntityTypes.TENANT, workspaceUuid, groupWorkspaceKey, id));
        ExtensionDefinitionReadback definition = BusinessEntityValueSupport.optionalDefinition(
                definitions, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.TENANT);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "TENANT_UPDATED",
                time.currentEpochMillis(),
                actor,
                BusinessEntityValueSupport.withExtensionChanges(
                        BusinessEntityValueSupport.changed(before, updated), before, updated, definition, submission),
                BusinessEntityValueSupport.extensionKeys(definition));
        return updated;
    }

    private OrganizationEntityReadback updateTenantMapNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String legalName,
            String creditCode,
            String remark,
            long expectedVersion,
            Map<String, String> values,
            AuditActor actor) {
        validateValues(workspaceUuid, groupWorkspaceKey, values);
        return updateTenantNow(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                legalName,
                creditCode,
                remark,
                    expectedVersion,
                    new ExtensionSubmission(values == null ? List.of() : values.entrySet().stream()
                        .map(entry -> BusinessEntityValueSupport.isJsonNull(entry.getValue())
                                ? ExtensionSubmission.ExtensionFieldValue.clear(entry.getKey())
                                : new ExtensionSubmission.ExtensionFieldValue(
                                        entry.getKey(), entry.getValue(), ExtensionSubmission.Mode.SET))
                        .toList()),
                actor);
    }

    private OrganizationEntityReadback transitionTenantNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            AuditActor actor) {
        OrganizationEntityReadback before = reads.requireEntity(BusinessEntityTypes.TENANT, workspaceUuid, groupWorkspaceKey, id);
        if (!VALID_STATUS.contains(status)
                || "VOIDED".equals(before.status())
                || persistence.transitionStatus(
                                id,
                                workspaceUuid,
                                groupWorkspaceKey,
                                status,
                                time.currentEpochMillis(),
                                expectedVersion)
                        != 1) throw new BusinessEntityService.OrganizationConflictException();
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(BusinessEntityTypes.TENANT, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "TENANT_STATUS_CHANGED",
                time.currentEpochMillis(),
                actor,
                List.of(new AuditChange("status", before.status(), updated.status())));
        return updated;
    }

    private void ensureAvailable(UUID workspaceUuid, String groupWorkspaceKey, UUID currentId, String code, String name) {
        BusinessTenantPersistence.ConflictFlags conflicts = persistence.findConflicts(
                workspaceUuid,
                groupWorkspaceKey,
                currentId,
                BusinessEntityValueSupport.text(code, 64),
                BusinessEntityValueSupport.text(name, 120).toLowerCase());
        if (conflicts.codeConflict()) throw new BusinessEntityService.OrganizationCodeConflictException();
        if (conflicts.nameConflict()) throw new BusinessEntityService.OrganizationNameConflictException();
    }

    private void validateValues(UUID workspaceUuid, String groupWorkspaceKey, Map<String, String> values) {
        Map<String, String> actual = values == null ? Map.of() : values;
        try {
            ExtensionDefinitionReadback definition =
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.TENANT);
            if (!actual.isEmpty()) ExtensionDefinitionService.requireConsumableDefinition(definition);
            Map<String, ExtensionDefinitionReadback.Field> known = definition.fields().stream()
                    .collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, value -> value));
            if (actual.keySet().stream().anyMatch(field -> !known.containsKey(field))
                    || actual.entrySet().stream().anyMatch(entry ->
                            !"DISABLED".equals(known.get(entry.getKey()).status())
                                    && !BusinessEntityValueSupport.isJsonNull(entry.getValue())
                                    && !BusinessEntityValueSupport.validJsonValue(
                                            known.get(entry.getKey()), entry.getValue())))
                throw new BusinessEntityService.OrganizationValidationException();
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (!actual.isEmpty()) throw new BusinessEntityService.OrganizationValidationException(absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    private void replaceNewValues(
            UUID id, UUID workspaceUuid, String groupWorkspaceKey, ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.TENANT);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty())
                throw new BusinessEntityService.OrganizationValidationException(absent);
            return;
        }
        try {
            String merged = ExtensionDefinitionService.mergeValues(definition, "{}", submission);
            persistence.replaceExtensionValues(id, merged, definition.version());
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    private void replaceValues(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            Map<String, String> currentValues,
            ExtensionSubmission submission) {
        String current = BusinessEntityValueSupport.extensionJson(currentValues);
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.TENANT);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty())
                throw new BusinessEntityService.OrganizationValidationException(absent);
            persistence.replaceExtensionValuesWithoutDefinition(id, current);
            return;
        }
        try {
            String merged = ExtensionDefinitionService.mergeValues(definition, current, submission);
            persistence.replaceExtensionValues(id, merged, definition.version());
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    private void requireGroupGrant(OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey) {
        if (grant == null
                || !grant.matches(
                        workspaceUuid,
                        groupWorkspaceKey,
                        ServiceNodeTypes.GROUP,
                        grant.targetId())
                || grant.targetId() == null
                || !Objects.equals(grant.targetType(), ServiceNodeTypes.GROUP))
            throw new BusinessEntityService.OrganizationAuthorizationException();
    }

    private static void requireTenant(String entityType) {
        if (!BusinessEntityTypes.TENANT.equalsIgnoreCase(Objects.requireNonNullElse(entityType, "")))
            throw new BusinessEntityService.OrganizationValidationException();
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String action,
            long now,
            AuditActor actor,
            List<AuditChange> changes) {
        audit(workspaceUuid, groupWorkspaceKey, id, action, now, actor, changes, Set.of());
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String action,
            long now,
            AuditActor actor,
            List<AuditChange> changes,
            Set<String> additionalAllowedFieldKeys) {
        AuditChangePolicy policy = new AuditChangePolicy(BusinessEntityTypes.TENANT, action, AUDIT_FIELDS)
                .withAdditionalFieldKeys(additionalAllowedFieldKeys);
        persistence.audit(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                BusinessEntityTypes.TENANT,
                id.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                BusinessEntityValueSupport.auditJson(policy.allow(changes)));
    }
}
