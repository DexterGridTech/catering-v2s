package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.BusinessBrandPersistence;
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
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.BrandCreateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.BrandStatusCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.BrandUpdateCommand;
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

/** Brand lifecycle owner. Generic entity calls reach this bean through BusinessEntityCommandRouter. */
@Service
public class BusinessBrandService {
    private static final Set<String> VALID_STATUS = Set.of("ENABLED", "DISABLED", "VOIDED");
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship", "notes");
    private final BusinessBrandPersistence persistence;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityCommandReceiptService receipts;
    private final BusinessEntityTaskReadService reads;

    @Autowired
    public BusinessBrandService(
            BusinessBrandPersistence persistence,
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

    BusinessBrandService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            com.catering.v2s.organization.api.OrganizationNodeLookup nodes) {
        this(new BusinessBrandPersistence(jdbc), time, definitions, receipts, new BusinessEntityTaskReadService(jdbc, nodes));
    }

    BusinessBrandService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            BusinessEntityTaskReadService reads) {
        this(new BusinessBrandPersistence(jdbc), time, definitions, receipts, reads);
    }

    @Transactional
    public OrganizationEntityReadback createBrand(BrandCreateCommand command) {
        requireGroupGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "createEntity",
                        BusinessEntityTypes.BRAND,
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        null,
                        null,
                        command.alias(),
                        command.remark(),
                        command.extensionSubmission()),
                () -> createBrandNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        command.alias(),
                        command.remark(),
                        command.extensionSubmission(),
                        command.actor()));
    }

    @Transactional
    public OrganizationEntityReadback updateBrand(BrandUpdateCommand command) {
        requireGroupGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "updateEntity",
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
                        command.extensionSubmission()),
                () -> updateBrandNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.brandId(),
                        command.code(),
                        command.name(),
                        command.alias(),
                        command.remark(),
                        command.expectedVersion(),
                        command.extensionSubmission(),
                        command.actor()));
    }

    @Transactional
    public OrganizationEntityReadback transitionBrandStatus(BrandStatusCommand command) {
        requireGroupGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey());
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
        requireBrand(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return createBrandMapNow(
                    workspaceUuid, groupWorkspaceKey, code, name, alias, remark, extensionValues, safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "createEntity",
                        BusinessEntityTypes.BRAND,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        extensionValues),
                () -> createBrandMapNow(
                        workspaceUuid, groupWorkspaceKey, code, name, alias, remark, extensionValues, safeActor));
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
        requireBrand(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return updateBrandMapNow(
                    workspaceUuid,
                    groupWorkspaceKey,
                    id,
                    code,
                    name,
                    alias,
                    remark,
                    expectedVersion,
                    extensionValues,
                    safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "updateEntity",
                        BusinessEntityTypes.BRAND,
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
                () -> updateBrandMapNow(
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        code,
                        name,
                        alias,
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
        requireBrand(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return transitionBrandNow(workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "transitionEntityStatus",
                        BusinessEntityTypes.BRAND,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        status,
                        expectedVersion),
                () -> transitionBrandNow(workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor));
    }

    private OrganizationEntityReadback createBrandNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String alias,
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
                    BusinessEntityValueSupport.optional(alias, 120),
                    BusinessEntityValueSupport.optional(remark, 2000),
                    now);
        } catch (org.springframework.dao.DuplicateKeyException exception) {
            throw new BusinessEntityService.OrganizationDuplicateException(exception);
        }
        replaceNewValues(id, workspaceUuid, groupWorkspaceKey, submission);
        OrganizationEntityReadback created = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(BusinessEntityTypes.BRAND, workspaceUuid, groupWorkspaceKey, id));
        ExtensionDefinitionReadback definition = BusinessEntityValueSupport.optionalDefinition(
                definitions, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.BRAND);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "BRAND_CREATED",
                now,
                actor,
                BusinessEntityValueSupport.withExtensionChanges(
                        BusinessEntityValueSupport.createdChanges(created), null, created, definition, submission),
                BusinessEntityValueSupport.extensionKeys(definition));
        return created;
    }

    private OrganizationEntityReadback createBrandMapNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String alias,
            String remark,
            Map<String, String> values,
            AuditActor actor) {
        validateValues(workspaceUuid, groupWorkspaceKey, values);
        return createBrandNow(
                workspaceUuid,
                groupWorkspaceKey,
                code,
                name,
                alias,
                remark,
                new ExtensionSubmission(values == null ? List.of() : values.entrySet().stream()
                        .map(entry -> BusinessEntityValueSupport.isJsonNull(entry.getValue())
                                ? ExtensionSubmission.ExtensionFieldValue.clear(entry.getKey())
                                : new ExtensionSubmission.ExtensionFieldValue(
                                        entry.getKey(), entry.getValue(), ExtensionSubmission.Mode.SET))
                        .toList()),
                actor);
    }

    private OrganizationEntityReadback updateBrandNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String alias,
            String remark,
            long expectedVersion,
            ExtensionSubmission submission,
            AuditActor actor) {
        OrganizationEntityReadback before = reads.requireEntity(BusinessEntityTypes.BRAND, workspaceUuid, groupWorkspaceKey, id);
        BusinessEntityValueSupport.requireMutable(before.status());
        ensureAvailable(workspaceUuid, groupWorkspaceKey, id, code, name);
        if (persistence.update(
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        BusinessEntityValueSupport.text(code, 64),
                        BusinessEntityValueSupport.text(name, 120),
                        BusinessEntityValueSupport.optional(alias, 120),
                        BusinessEntityValueSupport.optional(remark, 2000),
                        time.currentEpochMillis(),
                        expectedVersion)
                != 1) throw new BusinessEntityService.OrganizationConflictException();
        replaceValues(id, workspaceUuid, groupWorkspaceKey, before.extensionValues(), submission);
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(BusinessEntityTypes.BRAND, workspaceUuid, groupWorkspaceKey, id));
        ExtensionDefinitionReadback definition = BusinessEntityValueSupport.optionalDefinition(
                definitions, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.BRAND);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "BRAND_UPDATED",
                time.currentEpochMillis(),
                actor,
                BusinessEntityValueSupport.withExtensionChanges(
                        BusinessEntityValueSupport.changed(before, updated), before, updated, definition, submission),
                BusinessEntityValueSupport.extensionKeys(definition));
        return updated;
    }

    private OrganizationEntityReadback updateBrandMapNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String code,
            String name,
            String alias,
            String remark,
            long expectedVersion,
            Map<String, String> values,
            AuditActor actor) {
        validateValues(workspaceUuid, groupWorkspaceKey, values);
        return updateBrandNow(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                code,
                name,
                alias,
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

    private OrganizationEntityReadback transitionBrandNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            AuditActor actor) {
        OrganizationEntityReadback before = reads.requireEntity(BusinessEntityTypes.BRAND, workspaceUuid, groupWorkspaceKey, id);
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
                () -> reads.requireEntity(BusinessEntityTypes.BRAND, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "BRAND_STATUS_CHANGED",
                time.currentEpochMillis(),
                actor,
                List.of(new AuditChange("status", before.status(), updated.status())));
        return updated;
    }

    private void ensureAvailable(UUID workspaceUuid, String groupWorkspaceKey, UUID currentId, String code, String name) {
        BusinessBrandPersistence.ConflictFlags conflicts = persistence.findConflicts(
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
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.BRAND);
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
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.BRAND);
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
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.BRAND);
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

    private static void requireBrand(String entityType) {
        if (!BusinessEntityTypes.BRAND.equalsIgnoreCase(Objects.requireNonNullElse(entityType, "")))
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
        AuditChangePolicy policy = new AuditChangePolicy(BusinessEntityTypes.BRAND, action, AUDIT_FIELDS)
                .withAdditionalFieldKeys(additionalAllowedFieldKeys);
        persistence.audit(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                BusinessEntityTypes.BRAND,
                id.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                BusinessEntityValueSupport.auditJson(policy.allow(changes)));
    }
}
