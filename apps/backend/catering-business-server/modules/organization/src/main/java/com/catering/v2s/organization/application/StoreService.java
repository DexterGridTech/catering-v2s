package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.StorePersistence;
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
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.api.OperationsStoreCommandApi.CreateStoreCommand;
import com.catering.v2s.organization.api.OperationsStoreCommandApi.StoreStatusCommand;
import com.catering.v2s.organization.api.OperationsStoreCommandApi.UpdateStoreCommand;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Store lifecycle owner; store-specific references and status facts stay in this bean. */
@Service
public class StoreService {
    private static final Set<String> VALID_STATUS = Set.of("ENABLED", "DISABLED", "VOIDED");
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship");
    private final StorePersistence persistence;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityCommandReceiptService receipts;
    private final BusinessEntityTaskReadService reads;

    @Autowired
    public StoreService(
            StorePersistence persistence,
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

    StoreService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            com.catering.v2s.organization.api.OrganizationNodeLookup nodes) {
        this(new StorePersistence(jdbc), time, definitions, receipts, new BusinessEntityTaskReadService(jdbc, nodes));
    }

    StoreService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            BusinessEntityTaskReadService reads) {
        this(new StorePersistence(jdbc), time, definitions, receipts, reads);
    }

    @Transactional
    public OrganizationEntityReadback createStore(CreateStoreCommand command) {
        UUID ownerProjectId = resolvedOwnerTargetId(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.PROJECT);
        if (!ownerProjectId.equals(command.projectId())) throw new BusinessEntityService.OrganizationValidationException();
        requireOwnerGrantForResolvedTarget(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                ServiceNodeTypes.PROJECT,
                ownerProjectId);
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
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
                () -> createNow(command.workspaceUuid(), command.groupWorkspaceKey(), ownerProjectId, command.tenantId(),
                        command.brandId(), command.headCompanyId(), command.code(), command.name(), command.notes(),
                        command.extensionSubmission(), command.actor()));
    }

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
        if (!ownerProjectId.equals(command.projectId())) throw new BusinessEntityService.OrganizationValidationException();
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
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
                () -> updateNow(command, current));
    }

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

    /** Canonical map-based create used by the legacy organization owner overloads. */
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
        if (ownerScopeGrant != null) {
            UUID ownerProjectId = resolvedOwnerTargetId(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT);
            if (!ownerProjectId.equals(projectId)) throw new BusinessEntityService.OrganizationValidationException();
            requireOwnerGrantForResolvedTarget(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT, ownerProjectId);
        }
        validateValues(workspaceUuid, groupWorkspaceKey, extensionValues);
        ExtensionSubmission submission = submission(extensionValues);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return createNow(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name,
                    notes, submission, safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "createStore", workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId,
                        code, name, notes, extensionValues),
                () -> createNow(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name,
                        notes, submission, safeActor));
    }

    /** Canonical map-based update used by the legacy organization owner overloads. */
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
        StoreCommandFacts current;
        if (ownerScopeGrant != null) {
            UUID ownerProjectId = reads.requireStoreProjectId(workspaceUuid, groupWorkspaceKey, id);
            requireOwnerGrant(
                    ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT, ownerProjectId);
            if (!ownerProjectId.equals(projectId)) throw new BusinessEntityService.OrganizationValidationException();
            current = readStoreCommandFacts(
                    new UpdateStoreCommand(
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
                            submission(extensionValues),
                            idempotencyKey,
                            actor == null ? AuditActor.system() : actor,
                            ownerScopeGrant));
        } else {
            OrganizationEntityReadback before = reads.requireEntity(ServiceNodeTypes.STORE, workspaceUuid, groupWorkspaceKey, id);
            validateStoreReferences(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId);
            current = new StoreCommandFacts(
                    before,
                    projectId,
                    tenantId,
                    brandId,
                    headCompanyId,
                    new StoreReferenceFacts(true, true, true, true, true));
        }
        validateValues(workspaceUuid, groupWorkspaceKey, extensionValues);
        ExtensionSubmission submission = submission(extensionValues);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        StoreUpdateInput input = new StoreUpdateInput(
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
                submission,
                safeActor);
        if (idempotencyKey == null) return updateNow(input, current);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "updateStore", workspaceUuid, groupWorkspaceKey, id, projectId, tenantId, brandId,
                        headCompanyId, code, name, notes, expectedVersion, extensionValues),
                () -> updateNow(input, current));
    }

    /** Canonical status entry used by the closed-set command router. */
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
        if (!ServiceNodeTypes.STORE.equals(entityType)) throw new BusinessEntityService.OrganizationValidationException();
        StoreStatusFacts current = readStoreStatusFacts(workspaceUuid, groupWorkspaceKey, id);
        if (ownerScopeGrant != null)
            requireOwnerGrantForResolvedTarget(
                    ownerScopeGrant, workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.PROJECT, current.projectId());
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return transitionNow(workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor, current.before());
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "transitionEntityStatus", entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion),
                () -> transitionNow(workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor, current.before()));
    }

    public StoreUpdateFacts readStoreUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        try {
            StorePersistence.UpdateFacts facts = persistence.readUpdateFacts(workspaceUuid, groupWorkspaceKey, storeId);
            return new StoreUpdateFacts(facts.projectId(), facts.tenantId(), facts.brandId(), facts.code());
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
    }

    private OrganizationEntityReadback createNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            ExtensionSubmission submission,
            AuditActor actor) {
        validateStoreReferences(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            persistence.insert(
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    projectId,
                    tenantId,
                    brandId,
                    headCompanyId,
                    BusinessEntityValueSupport.text(code, 64),
                    BusinessEntityValueSupport.text(name, 120),
                    BusinessEntityValueSupport.optional(notes, 2000),
                    now);
        } catch (DuplicateKeyException exception) {
            throw new BusinessEntityService.OrganizationDuplicateException(exception);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessEntityService.OrganizationConflictException(exception);
        }
        replaceNewValues(id, workspaceUuid, groupWorkspaceKey, submission);
        OrganizationEntityReadback created = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(ServiceNodeTypes.STORE, workspaceUuid, groupWorkspaceKey, id));
        audit(workspaceUuid, groupWorkspaceKey, id, "STORE_CREATED", now, actor, createdChanges(created));
        return created;
    }

    private OrganizationEntityReadback updateNow(UpdateStoreCommand command, StoreCommandFacts current) {
        return updateNow(
                new StoreUpdateInput(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.storeId(),
                        command.projectId(),
                        command.tenantId(),
                        command.brandId(),
                        command.headCompanyId(),
                        command.code(),
                        command.name(),
                        command.notes(),
                        command.expectedVersion(),
                        command.extensionSubmission(),
                        command.actor()),
                current);
    }

    private OrganizationEntityReadback updateNow(StoreUpdateInput input, StoreCommandFacts current) {
        OrganizationEntityReadback before = current.before();
        BusinessEntityValueSupport.requireMutable(before.status());
        current.requireEnabledReferences();
        int changed;
        try {
            changed = persistence.update(
                    input.storeId(),
                    input.workspaceUuid(),
                    input.groupWorkspaceKey(),
                    current.projectId(),
                    input.tenantId(),
                    input.brandId(),
                    input.headCompanyId(),
                    BusinessEntityValueSupport.text(input.code(), 64),
                    BusinessEntityValueSupport.text(input.name(), 120),
                    BusinessEntityValueSupport.optional(input.notes(), 2000),
                    time.currentEpochMillis(),
                    input.expectedVersion());
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessEntityService.OrganizationConflictException(exception);
        }
        if (changed != 1) throw new BusinessEntityService.OrganizationConflictException();
        replaceValues(
                input.storeId(),
                input.workspaceUuid(),
                input.groupWorkspaceKey(),
                before.extensionValues(),
                input.extensionSubmission());
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(ServiceNodeTypes.STORE, input.workspaceUuid(), input.groupWorkspaceKey(), input.storeId()));
        audit(
                input.workspaceUuid(),
                input.groupWorkspaceKey(),
                input.storeId(),
                "STORE_UPDATED",
                time.currentEpochMillis(),
                input.actor(),
                changed(before, updated));
        return updated;
    }

    private OrganizationEntityReadback transitionNow(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String status,
            long expectedVersion,
            AuditActor actor,
            OrganizationEntityReadback before) {
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
                () -> reads.requireEntity(ServiceNodeTypes.STORE, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "STORE_STATUS_CHANGED",
                time.currentEpochMillis(),
                actor,
                List.of(new AuditChange("status", before.status(), updated.status())));
        return updated;
    }

    private StoreCommandFacts readStoreCommandFacts(UpdateStoreCommand command) {
        try {
            StorePersistence.CommandFacts facts = persistence.readCommandFacts(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.storeId(),
                    command.tenantId(),
                    command.brandId(),
                    command.headCompanyId());
            StorePersistence.ReferenceFacts references = facts.references();
            return new StoreCommandFacts(
                    facts.before(),
                    facts.projectId(),
                    facts.tenantId(),
                    facts.brandId(),
                    facts.headCompanyId(),
                    new StoreReferenceFacts(
                            references.projectEnabled(),
                            references.tenantEnabled(),
                            references.brandEnabled(),
                            references.headCompanyEnabled(),
                            references.headCompanyAuthorized()));
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
    }

    private StoreStatusFacts readStoreStatusFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        try {
            StorePersistence.StatusFacts facts = persistence.readStatusFacts(workspaceUuid, groupWorkspaceKey, storeId);
            return new StoreStatusFacts(facts.before(), facts.projectId());
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException();
        }
    }

    private void validateStoreReferences(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId) {
        StorePersistence.ReferenceFacts result = persistence.validateReferences(
                workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId);
        StoreReferenceFacts facts = new StoreReferenceFacts(
                result.projectEnabled(),
                result.tenantEnabled(),
                result.brandEnabled(),
                result.headCompanyEnabled(),
                result.headCompanyAuthorized());
        if (!facts.allEnabled()) throw new BusinessEntityService.OrganizationValidationException();
    }

    private void validateValues(UUID workspaceUuid, String groupWorkspaceKey, Map<String, String> values) {
        Map<String, String> actual = values == null ? Map.of() : values;
        try {
            ExtensionDefinitionReadback definition =
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.STORE);
            if (!actual.isEmpty()) ExtensionDefinitionService.requireConsumableDefinition(definition);
            Map<String, ExtensionDefinitionReadback.Field> known = definition.fields().stream()
                    .collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, value -> value));
            if (actual.keySet().stream().anyMatch(field -> !known.containsKey(field))
                    || actual.entrySet().stream().anyMatch(entry ->
                            !"DISABLED".equals(known.get(entry.getKey()).status())
                                    && !BusinessEntityValueSupport.isJsonNull(entry.getValue())
                                    && !BusinessEntityValueSupport.validJsonValue(known.get(entry.getKey()), entry.getValue())))
                throw new BusinessEntityService.OrganizationValidationException();
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (!actual.isEmpty()) throw new BusinessEntityService.OrganizationValidationException(absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    private void replaceNewValues(UUID id, UUID workspaceUuid, String groupWorkspaceKey, ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.STORE);
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
        ExtensionDefinitionReadback definition;
        String current = BusinessEntityValueSupport.extensionJson(currentValues);
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.STORE);
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

    private ExtensionSubmission submission(Map<String, String> values) {
        return new ExtensionSubmission(values == null ? List.of() : values.entrySet().stream()
                .map(entry -> BusinessEntityValueSupport.isJsonNull(entry.getValue())
                        ? ExtensionSubmission.ExtensionFieldValue.clear(entry.getKey())
                        : new ExtensionSubmission.ExtensionFieldValue(
                                entry.getKey(), entry.getValue(), ExtensionSubmission.Mode.SET))
                .toList());
    }

    private void requireOwnerGrant(
            OperationsOwnerScopeGrant grant,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetType,
            UUID targetId) {
        if (grant == null || !grant.matches(workspaceUuid, groupWorkspaceKey, targetType, targetId))
            throw new BusinessEntityService.OrganizationAuthorizationException();
        if (ServiceNodeTypes.PROJECT.equals(targetType)) reads.requireProjectId(workspaceUuid, groupWorkspaceKey, targetId);
        else if (ServiceNodeTypes.GROUP.equals(targetType)) reads.requireCommercialGroupId(workspaceUuid, groupWorkspaceKey);
        else reads.requireEntity(targetType, workspaceUuid, groupWorkspaceKey, targetId);
    }

    private void requireOwnerGrantForResolvedTarget(
            OperationsOwnerScopeGrant grant,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetType,
            UUID targetId) {
        if (grant == null || !grant.matches(workspaceUuid, groupWorkspaceKey, targetType, targetId))
            throw new BusinessEntityService.OrganizationAuthorizationException();
    }

    private UUID resolvedOwnerTargetId(
            OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, String targetType) {
        if (grant == null
                || !Objects.equals(grant.workspaceUuid(), workspaceUuid)
                || !Objects.equals(grant.groupWorkspaceKey(), groupWorkspaceKey)
                || !Objects.equals(grant.targetType(), targetType)
                || grant.targetId() == null)
            throw new BusinessEntityService.OrganizationAuthorizationException();
        return grant.targetId();
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID id,
            String action,
            long now,
            AuditActor actor,
            List<AuditChange> changes) {
        AuditChangePolicy policy = new AuditChangePolicy(AuditEntityTypes.STORE, action, AUDIT_FIELDS);
        persistence.audit(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                AuditEntityTypes.STORE,
                id.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                AuditChangeJson.write(policy.allow(changes)));
    }

    private static List<AuditChange> createdChanges(OrganizationEntityReadback value) {
        return BusinessEntityValueSupport.createdChanges(value);
    }

    private static List<AuditChange> changed(OrganizationEntityReadback before, OrganizationEntityReadback after) {
        return BusinessEntityValueSupport.changed(before, after);
    }

    public record StoreUpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    private record StoreUpdateInput(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeId,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            String code,
            String name,
            String notes,
            long expectedVersion,
            ExtensionSubmission extensionSubmission,
            AuditActor actor) {}

    private record StoreCommandFacts(
            OrganizationEntityReadback before,
            UUID projectId,
            UUID tenantId,
            UUID brandId,
            UUID headCompanyId,
            StoreReferenceFacts references) {
        private void requireEnabledReferences() {
            if (!references.allEnabled()) throw new BusinessEntityService.OrganizationValidationException();
        }
    }

    private record StoreStatusFacts(OrganizationEntityReadback before, UUID projectId) {}

    private record StoreReferenceFacts(
            boolean projectEnabled,
            boolean tenantEnabled,
            boolean brandEnabled,
            boolean headCompanyEnabled,
            boolean headCompanyAuthorized) {
        private boolean allEnabled() {
            return projectEnabled && tenantEnabled && brandEnabled && headCompanyEnabled && headCompanyAuthorized;
        }
    }
}
