package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.StorePersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditValueState;
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
import com.catering.v2s.organization.api.StoreOperatingRuleReadback;
import com.catering.v2s.organization.domain.generated.StoreOperatingRuleCatalog;
import com.catering.v2s.organization.domain.generated.StoreOperatingRuleCatalog.Values;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.LinkedHashSet;
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
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship", "notes");
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
                        command.extensionSubmission(),
                        command.operatingRuleSwitches()),
                () -> createNow(command.workspaceUuid(), command.groupWorkspaceKey(), ownerProjectId, command.tenantId(),
                        command.brandId(), command.headCompanyId(), command.code(), command.name(), command.notes(),
                        command.extensionSubmission(), command.operatingRuleSwitches(), command.actor()));
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
                        command.extensionSubmission(),
                        command.operatingRuleSwitches()),
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
        return createStoreWithOperatingRuleSwitches(
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
                actor,
                ownerScopeGrant,
                null);
    }

    /** Explicit owner fixture/command seam for a complete non-default rule map. */
    @Transactional
    public OrganizationEntityReadback createStoreWithOperatingRuleSwitches(
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
            OperationsOwnerScopeGrant ownerScopeGrant,
            Map<String, ?> operatingRuleSwitches) {
        Values rules = operatingRuleSwitches == null
                ? null
                : StoreOperatingRuleCatalog.values(operatingRuleSwitches, true);
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
                    notes, submission, rules, safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "createStore", workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId,
                        code, name, notes, extensionValues, rules == null ? null : rules.asMap()),
                () -> createNow(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name,
                        notes, submission, rules, safeActor));
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
                        safeActor,
                        null);
        if (idempotencyKey == null) return updateNow(input, current);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "updateStore", workspaceUuid, groupWorkspaceKey, id, projectId, tenantId, brandId,
                        headCompanyId, code, name, notes, expectedVersion, extensionValues, null),
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
            throw new BusinessEntityService.OrganizationNotFoundException(notFound);
        }
    }

    @Transactional(readOnly = true)
    public StoreOperatingRuleReadback requireStoreOperatingRuleSwitches(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        try {
            return new StoreOperatingRuleReadback(
                    storeId,
                    StoreOperatingRuleCatalog.values(
                            StoreOperatingRuleCodec.resolved(
                                    persistence.readOperatingRuleSwitches(workspaceUuid, groupWorkspaceKey, storeId)),
                            true));
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException(notFound);
        } catch (IllegalArgumentException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    public Map<UUID, StoreOperatingRuleReadback> requireStoreOperatingRuleSwitches(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> storeIds) {
        if (storeIds == null || storeIds.isEmpty()) return Map.of();
        Map<UUID, String> raw = persistence.readOperatingRuleSwitches(workspaceUuid, groupWorkspaceKey, storeIds);
        Map<UUID, StoreOperatingRuleReadback> result = new java.util.LinkedHashMap<>();
        for (UUID storeId : storeIds.stream().distinct().toList()) {
            String source = raw.get(storeId);
            if (source == null)
                throw new BusinessEntityService.OrganizationNotFoundException();
            try {
                result.put(
                        storeId,
                        new StoreOperatingRuleReadback(
                                storeId, StoreOperatingRuleCatalog.values(StoreOperatingRuleCodec.resolved(source), true)));
            } catch (IllegalArgumentException invalid) {
                throw new BusinessEntityService.OrganizationValidationException(invalid);
            }
        }
        return Map.copyOf(result);
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
            Values operatingRuleSwitches,
            AuditActor actor) {
        validateStoreReferences(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId);
        String operatingRuleJson;
        try {
            operatingRuleJson = StoreOperatingRuleCodec.stored(operatingRuleSwitches);
        } catch (StoreOperatingRuleCodec.InvalidValuesException invalid) {
            throw new BusinessEntityService.OrganizationOperatingRuleValidationException(invalid);
        } catch (IllegalArgumentException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
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
                    operatingRuleJson,
                    now);
        } catch (DuplicateKeyException exception) {
            throw new BusinessEntityService.OrganizationDuplicateException(exception);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessEntityService.OrganizationConflictException(exception);
        }
        ExtensionDefinitionReadback definition = replaceNewValues(id, workspaceUuid, groupWorkspaceKey, submission);
        OrganizationEntityReadback created = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(ServiceNodeTypes.STORE, workspaceUuid, groupWorkspaceKey, id));
        Map<String, ?> createdRules = readOperatingRuleValues(workspaceUuid, groupWorkspaceKey, id);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "STORE_CREATED",
                now,
                actor,
                append(
                        BusinessEntityValueSupport.withExtensionChanges(
                                createdChanges(created, headCompanyId), null, created, definition, submission),
                        operatingRuleChanges(Map.of(), createdRules, operatingRuleSwitches)),
                storeAuditKeys(definition));
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
                        command.actor(),
                        command.operatingRuleSwitches()),
                current);
    }

    private OrganizationEntityReadback updateNow(StoreUpdateInput input, StoreCommandFacts current) {
        OrganizationEntityReadback before = current.before();
        BusinessEntityValueSupport.requireMutable(before.status());
        current.requireEnabledReferences();
        Map<String, ?> beforeRules = readOperatingRuleValues(
                input.workspaceUuid(), input.groupWorkspaceKey(), input.storeId());
        String operatingRuleJson;
        try {
            operatingRuleJson = input.operatingRuleSwitches() == null
                    ? persistence.readOperatingRuleSwitches(
                            input.workspaceUuid(), input.groupWorkspaceKey(), input.storeId())
                    : StoreOperatingRuleCodec.stored(input.operatingRuleSwitches());
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException(notFound);
        } catch (StoreOperatingRuleCodec.InvalidValuesException invalid) {
            throw new BusinessEntityService.OrganizationOperatingRuleValidationException(invalid);
        } catch (IllegalArgumentException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
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
                    operatingRuleJson,
                    time.currentEpochMillis(),
                    input.expectedVersion());
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessEntityService.OrganizationConflictException(exception);
        }
        if (changed != 1) throw new BusinessEntityService.OrganizationConflictException();
        ExtensionDefinitionReadback definition = replaceValues(
                input.storeId(),
                input.workspaceUuid(),
                input.groupWorkspaceKey(),
                before.extensionValues(),
                input.extensionSubmission());
        OrganizationEntityReadback updated = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(ServiceNodeTypes.STORE, input.workspaceUuid(), input.groupWorkspaceKey(), input.storeId()));
        Map<String, ?> afterRules = readOperatingRuleValues(
                input.workspaceUuid(), input.groupWorkspaceKey(), input.storeId());
        audit(
                input.workspaceUuid(),
                input.groupWorkspaceKey(),
                input.storeId(),
                "STORE_UPDATED",
                time.currentEpochMillis(),
                input.actor(),
                append(
                        BusinessEntityValueSupport.withExtensionChanges(
                                changed(before, updated, current.headCompanyId(), input.headCompanyId()),
                                before,
                                updated,
                                definition,
                                input.extensionSubmission()),
                        operatingRuleChanges(beforeRules, afterRules, input.operatingRuleSwitches())),
                storeAuditKeys(definition));
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
                List.of(AuditChange.forNullableScalar("status", before.status(), updated.status())));
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
            throw new BusinessEntityService.OrganizationNotFoundException(notFound);
        }
    }

    private StoreStatusFacts readStoreStatusFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        try {
            StorePersistence.StatusFacts facts = persistence.readStatusFacts(workspaceUuid, groupWorkspaceKey, storeId);
            return new StoreStatusFacts(facts.before(), facts.projectId());
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException(notFound);
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

    private ExtensionDefinitionReadback replaceNewValues(
            UUID id, UUID workspaceUuid, String groupWorkspaceKey, ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.STORE);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty())
                throw new BusinessEntityService.OrganizationValidationException(absent);
            return null;
        }
        try {
            String merged = ExtensionDefinitionService.mergeValues(definition, "{}", submission);
            persistence.replaceExtensionValues(id, merged, definition.version());
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
        return definition;
    }

    private ExtensionDefinitionReadback replaceValues(
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
            return null;
        }
        try {
            String merged = ExtensionDefinitionService.mergeValues(definition, current, submission);
            persistence.replaceExtensionValues(id, merged, definition.version());
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
        return definition;
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
        AuditChangePolicy policy = new AuditChangePolicy(AuditEntityTypes.STORE, action, AUDIT_FIELDS)
                .withAdditionalFieldKeys(additionalAllowedFieldKeys);
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
        return createdChanges(value, null);
    }

    private static List<AuditChange> createdChanges(OrganizationEntityReadback value, UUID headCompanyId) {
        List<AuditChange> result = new java.util.ArrayList<>(BusinessEntityValueSupport.createdChanges(value));
        result.add(new AuditChange(
                "notes",
                null,
                AuditValueState.MISSING,
                null,
                value.notes() == null ? AuditValueState.MISSING : AuditValueState.VALUE,
                value.notes()));
        if (headCompanyId != null)
            result.add(new AuditChange(
                    "relationship",
                    null,
                    AuditValueState.MISSING,
                    null,
                    AuditValueState.VALUE,
                    headCompanyId.toString()));
        return List.copyOf(result);
    }

    private static List<AuditChange> changed(
            OrganizationEntityReadback before,
            OrganizationEntityReadback after,
            UUID beforeHeadCompanyId,
            UUID afterHeadCompanyId) {
        List<AuditChange> result = new java.util.ArrayList<>(BusinessEntityValueSupport.changed(before, after));
        if (!Objects.equals(before.notes(), after.notes()))
            result.add(AuditChange.forNullableScalar("notes", before.notes(), after.notes()));
        if (!Objects.equals(beforeHeadCompanyId, afterHeadCompanyId))
            result.add(AuditChange.forNullableScalar(
                    "relationship",
                    beforeHeadCompanyId == null ? null : beforeHeadCompanyId.toString(),
                    afterHeadCompanyId == null ? null : afterHeadCompanyId.toString()));
        return List.copyOf(result);
    }

    private Map<String, ?> readOperatingRuleValues(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        try {
            return StoreOperatingRuleCodec.resolved(
                    persistence.readOperatingRuleSwitches(workspaceUuid, groupWorkspaceKey, storeId));
        } catch (IllegalStateException notFound) {
            throw new BusinessEntityService.OrganizationNotFoundException(notFound);
        } catch (IllegalArgumentException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    private static List<AuditChange> operatingRuleChanges(
            Map<String, ?> before, Map<String, ?> after, Values supplied) {
        if (supplied == null || supplied.asMap().isEmpty()) return List.of();
        return StoreOperatingRuleCatalog.definitions().stream()
                .filter(definition -> supplied.containsKey(definition.key()))
                .map(definition -> operatingRuleChange(definition, before, after))
                .filter(Objects::nonNull)
                .toList();
    }

    private static AuditChange operatingRuleChange(
            StoreOperatingRuleCatalog.Definition definition,
            Map<String, ?> before,
            Map<String, ?> after) {
        boolean beforePresent = before.containsKey(definition.key());
        boolean afterPresent = after.containsKey(definition.key());
        Object beforeValue = before.get(definition.key());
        Object afterValue = after.get(definition.key());
        AuditValueState beforeState = auditState(beforePresent, beforeValue);
        AuditValueState afterState = auditState(afterPresent, afterValue);
        String beforeText = auditScalar(beforeState, beforeValue);
        String afterText = auditScalar(afterState, afterValue);
        if (beforeState == afterState && Objects.equals(beforeText, afterText)) return null;
        return new AuditChange(
                definition.key(),
                definition.label(),
                beforeState,
                beforeText,
                afterState,
                afterText);
    }

    private static AuditValueState auditState(boolean present, Object value) {
        if (!present) return AuditValueState.MISSING;
        return value == null ? AuditValueState.NULL : AuditValueState.VALUE;
    }

    private static String auditScalar(AuditValueState state, Object value) {
        return state == AuditValueState.VALUE ? String.valueOf(value) : null;
    }

    private static List<AuditChange> append(List<AuditChange> first, List<AuditChange> second) {
        return java.util.stream.Stream.concat(first.stream(), second.stream()).toList();
    }

    private static Set<String> storeAuditKeys(ExtensionDefinitionReadback definition) {
        Set<String> keys = new LinkedHashSet<>(BusinessEntityValueSupport.extensionKeys(definition));
        keys.addAll(StoreOperatingRuleCatalog.keys());
        return Set.copyOf(keys);
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
            AuditActor actor,
            Values operatingRuleSwitches) {}

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
