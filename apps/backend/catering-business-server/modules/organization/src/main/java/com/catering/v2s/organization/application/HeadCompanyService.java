package com.catering.v2s.organization.application;

import com.catering.v2s.organization.application.persistence.HeadCompanyPersistence;
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
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyBrandAuthorizationReadback;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyCommandReadback;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyCreateCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyStatusCommand;
import com.catering.v2s.organization.api.OperationsBusinessEntityCommandApi.HeadCompanyUpdateCommand;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
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

/** Head-company entity and head-company-to-brand authorization owner. */
@Service
public class HeadCompanyService {
    private static final Set<String> VALID_STATUS = Set.of("ENABLED", "DISABLED", "VOIDED");
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship");
    private final HeadCompanyPersistence persistence;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final BusinessEntityCommandReceiptService receipts;
    private final BusinessEntityTaskReadService reads;

    @Autowired
    public HeadCompanyService(
            HeadCompanyPersistence persistence,
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

    HeadCompanyService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            com.catering.v2s.organization.api.OrganizationNodeLookup nodes) {
        this(new HeadCompanyPersistence(jdbc), time, definitions, receipts, new BusinessEntityTaskReadService(jdbc, nodes));
    }

    HeadCompanyService(
            JdbcTemplate jdbc,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            BusinessEntityCommandReceiptService receipts,
            BusinessEntityTaskReadService reads) {
        this(new HeadCompanyPersistence(jdbc), time, definitions, receipts, reads);
    }

    @Transactional
    public HeadCompanyCommandReadback createHeadCompany(HeadCompanyCreateCommand command) {
        requireGroupGrant(command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey());
        OrganizationEntityReadback entity = receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "createEntity",
                        BusinessEntityTypes.HEAD_COMPANY,
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        command.legalName(),
                        command.creditCode(),
                        null,
                        command.remark(),
                        command.extensionSubmission()),
                () -> createNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        command.legalName(),
                        command.creditCode(),
                        command.remark(),
                        command.extensionSubmission(),
                        command.actor()));
        return new HeadCompanyCommandReadback(entity, List.of());
    }

    @Transactional
    public HeadCompanyCommandReadback updateHeadCompany(HeadCompanyUpdateCommand command) {
        OrganizationEntityReadback ownerFact = requireHeadCompanyOwnerFact(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.headCompanyId());
        OrganizationEntityReadback entity = receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "updateEntity",
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
                        command.extensionSubmission()),
                () -> updateNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.headCompanyId(),
                        command.code(),
                        command.name(),
                        command.legalName(),
                        command.creditCode(),
                        command.remark(),
                        command.expectedVersion(),
                        command.extensionSubmission(),
                        command.actor(),
                        ownerFact));
        return headCompanyReadback(command.workspaceUuid(), command.groupWorkspaceKey(), entity);
    }

    @Transactional
    public HeadCompanyCommandReadback transitionHeadCompanyStatus(HeadCompanyStatusCommand command) {
        OrganizationEntityReadback ownerFact = requireHeadCompanyOwnerFact(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.headCompanyId());
        OrganizationEntityReadback entity = receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                BusinessEntityValueSupport.canonical(
                        "transitionEntityStatus",
                        BusinessEntityTypes.HEAD_COMPANY,
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.headCompanyId(),
                        command.targetStatus(),
                        command.expectedVersion()),
                () -> transitionNow(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.headCompanyId(),
                        command.targetStatus(),
                        command.expectedVersion(),
                        command.actor(),
                        ownerFact));
        return headCompanyReadback(command.workspaceUuid(), command.groupWorkspaceKey(), entity);
    }

    /** Canonical generic create entry used by the closed-set command router. */
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
        requireHeadCompany(entityType);
        if (ownerScopeGrant != null) requireGroupGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        validateValues(workspaceUuid, groupWorkspaceKey, extensionValues);
        ExtensionSubmission submission = submission(extensionValues);
        if (idempotencyKey == null)
            return createNow(
                    workspaceUuid,
                    groupWorkspaceKey,
                    code,
                    name,
                    legalName,
                    creditCode,
                    remark,
                    submission,
                    safeActor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "createEntity",
                        BusinessEntityTypes.HEAD_COMPANY,
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        alias,
                        remark,
                        extensionValues),
                () -> createNow(
                        workspaceUuid,
                        groupWorkspaceKey,
                        code,
                        name,
                        legalName,
                        creditCode,
                        remark,
                        submission,
                        safeActor));
    }

    /** Canonical generic update entry used by the closed-set command router. */
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
        requireHeadCompany(entityType);
        OrganizationEntityReadback ownerFact = ownerScopeGrant == null
                ? reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, id)
                : requireHeadCompanyOwnerFact(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, id);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        validateValues(workspaceUuid, groupWorkspaceKey, extensionValues);
        ExtensionSubmission submission = submission(extensionValues);
        if (idempotencyKey == null)
            return updateNow(
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
                    safeActor,
                    ownerFact);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "updateEntity",
                        BusinessEntityTypes.HEAD_COMPANY,
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
                () -> updateNow(
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
                        safeActor,
                        ownerFact));
    }

    /** Canonical generic status entry used by the closed-set command router. */
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
        requireHeadCompany(entityType);
        OrganizationEntityReadback ownerFact = ownerScopeGrant == null
                ? reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, id)
                : requireHeadCompanyOwnerFact(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, id);
        AuditActor safeActor = actor == null ? AuditActor.system() : actor;
        if (idempotencyKey == null)
            return transitionNow(
                    workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor, ownerFact);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                BusinessEntityValueSupport.canonical(
                        "transitionEntityStatus",
                        BusinessEntityTypes.HEAD_COMPANY,
                        workspaceUuid,
                        groupWorkspaceKey,
                        id,
                        status,
                        expectedVersion),
                () -> transitionNow(
                        workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, safeActor, ownerFact));
    }

    @Transactional
    public HeadCompanyBrandAuthorizationReadback addHeadCompanyBrandAuthorization(
            HeadCompanyBrandAuthorizationCommand command) {
        requireOwnerGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
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

    @Transactional
    public HeadCompanyBrandAuthorizationReadback removeHeadCompanyBrandAuthorization(
            HeadCompanyBrandAuthorizationCommand command) {
        requireOwnerGrant(
                command.ownerScopeGrant(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
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
                BusinessEntityValueSupport.canonical(
                        "addHeadCompanyBrandAuthorization", workspaceUuid, groupWorkspaceKey, headCompanyId, brandId),
                () -> {
                    reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
                    if (!enabled("brand", workspaceUuid, groupWorkspaceKey, brandId))
                        throw new BusinessEntityService.OrganizationValidationException();
                    if (persistence.addBrandAuthorization(
                                    headCompanyId,
                                    brandId,
                                    time.currentEpochMillis())
                            == 1) {
                        audit(
                                workspaceUuid,
                                groupWorkspaceKey,
                                headCompanyId,
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
        requireOwnerGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, headCompanyId);
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
                BusinessEntityValueSupport.canonical(
                        "removeHeadCompanyBrandAuthorization", workspaceUuid, groupWorkspaceKey, headCompanyId, brandId),
                () -> {
                    reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
                    if (!authorized(headCompanyId, brandId))
                        throw new BusinessEntityService.HeadCompanyBrandAuthorizationNotFoundException();
                    if (hasStoreReference(workspaceUuid, groupWorkspaceKey, headCompanyId, brandId))
                        throw new BusinessEntityService.HeadCompanyBrandAuthorizationInUseException();
                    try {
                        if (persistence.removeBrandAuthorization(
                                        headCompanyId,
                                        brandId)
                                != 1) throw new BusinessEntityService.HeadCompanyBrandAuthorizationNotFoundException();
                    } catch (DataIntegrityViolationException exception) {
                        throw new BusinessEntityService.HeadCompanyBrandAuthorizationInUseException(exception);
                    }
                    audit(
                            workspaceUuid,
                            groupWorkspaceKey,
                            headCompanyId,
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
        requireOwnerGrant(ownerScopeGrant, workspaceUuid, groupWorkspaceKey, headCompanyId);
        return removeHeadCompanyBrandAuthorization(
                workspaceUuid, groupWorkspaceKey, headCompanyId, brandId, idempotencyKey, actor);
    }

    private OrganizationEntityReadback createNow(
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
        } catch (DuplicateKeyException exception) {
            throw new BusinessEntityService.OrganizationDuplicateException(exception);
        }
        replaceNewValues(id, workspaceUuid, groupWorkspaceKey, submission);
        OrganizationEntityReadback created = OwnerOperationDiagnostics.readback(
                () -> reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, id));
        ExtensionDefinitionReadback definition = BusinessEntityValueSupport.optionalDefinition(
                definitions, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.HEAD_COMPANY);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "HEAD_COMPANY_CREATED",
                now,
                actor,
                BusinessEntityValueSupport.withExtensionChanges(
                        BusinessEntityValueSupport.createdChanges(created), null, created, definition, submission),
                BusinessEntityValueSupport.extensionKeys(definition));
        return created;
    }

    private OrganizationEntityReadback updateNow(
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
        BusinessEntityValueSupport.requireMutable(before.status());
        ensureAvailable(workspaceUuid, groupWorkspaceKey, id, code, name);
        ExtensionValues extensions = extensionValuesForUpdate(workspaceUuid, groupWorkspaceKey, before, submission);
        long now = time.currentEpochMillis();
        OrganizationEntityReadback updated = persistence.update(
                        id,
                        workspaceUuid,
                        groupWorkspaceKey,
                        BusinessEntityValueSupport.text(code, 64),
                        BusinessEntityValueSupport.text(name, 120),
                        BusinessEntityValueSupport.text(legalName, 240),
                        BusinessEntityValueSupport.text(creditCode, 32),
                        BusinessEntityValueSupport.optional(remark, 2000),
                        extensions.json(),
                        extensions.revision(),
                        now,
                        expectedVersion)
                .orElseThrow(BusinessEntityService.OrganizationConflictException::new);
        ExtensionDefinitionReadback definition = BusinessEntityValueSupport.optionalDefinition(
                definitions, workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.HEAD_COMPANY);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "HEAD_COMPANY_UPDATED",
                time.currentEpochMillis(),
                actor,
                BusinessEntityValueSupport.withExtensionChanges(
                        BusinessEntityValueSupport.changed(before, updated), before, updated, definition, submission),
                BusinessEntityValueSupport.extensionKeys(definition));
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
                () -> reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, id));
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "HEAD_COMPANY_STATUS_CHANGED",
                time.currentEpochMillis(),
                actor,
                List.of(new AuditChange("status", before.status(), updated.status())));
        return updated;
    }

    private HeadCompanyCommandReadback headCompanyReadback(
            UUID workspaceUuid, String groupWorkspaceKey, OrganizationEntityReadback entity) {
        return new HeadCompanyCommandReadback(
                entity, reads.authorizedBrandsForKnownHeadCompany(workspaceUuid, groupWorkspaceKey, entity.id()));
    }

    private OrganizationEntityReadback requireHeadCompanyOwnerFact(
            OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        requireOwnerGrant(grant, workspaceUuid, groupWorkspaceKey, id);
        return reads.requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, id);
    }

    private void requireOwnerGrant(
            OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        if (grant == null || !grant.matches(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.HEAD_COMPANY, headCompanyId))
            throw new BusinessEntityService.OrganizationAuthorizationException();
    }

    private void requireGroupGrant(OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupWorkspaceKey) {
        if (grant == null
                || !grant.matches(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP, grant.targetId())
                || grant.targetId() == null
                || !Objects.equals(grant.targetType(), ServiceNodeTypes.GROUP))
            throw new BusinessEntityService.OrganizationAuthorizationException();
    }

    private void ensureAvailable(UUID workspaceUuid, String groupWorkspaceKey, UUID currentId, String code, String name) {
        HeadCompanyPersistence.ConflictFlags conflicts = persistence.findConflicts(
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
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.HEAD_COMPANY);
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

    private ExtensionValues extensionValuesForUpdate(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            OrganizationEntityReadback before,
            ExtensionSubmission submission) {
        String current = BusinessEntityValueSupport.extensionJson(before.extensionValues());
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.HEAD_COMPANY);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty())
                throw new BusinessEntityService.OrganizationValidationException(absent);
            return new ExtensionValues(current, 0L);
        }
        try {
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, current, submission), definition.version());
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new BusinessEntityService.OrganizationValidationException(invalid);
        }
    }

    private void replaceNewValues(UUID id, UUID workspaceUuid, String groupWorkspaceKey, ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.HEAD_COMPANY);
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

    private ExtensionSubmission submission(Map<String, String> values) {
        return new ExtensionSubmission(values == null ? List.of() : values.entrySet().stream()
                .map(entry -> BusinessEntityValueSupport.isJsonNull(entry.getValue())
                        ? ExtensionSubmission.ExtensionFieldValue.clear(entry.getKey())
                        : new ExtensionSubmission.ExtensionFieldValue(
                                entry.getKey(), entry.getValue(), ExtensionSubmission.Mode.SET))
                .toList());
    }

    private boolean enabled(String table, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        if (!"brand".equals(table)) throw new IllegalArgumentException("unsupported head-company lookup table");
        return persistence.isBrandEnabled(workspaceUuid, groupWorkspaceKey, id);
    }

    private boolean authorized(UUID headCompanyId, UUID brandId) {
        return persistence.isBrandAuthorized(headCompanyId, brandId);
    }

    private boolean hasStoreReference(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId) {
        return persistence.hasStoreReference(workspaceUuid, groupWorkspaceKey, headCompanyId, brandId);
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
        AuditChangePolicy policy = new AuditChangePolicy(AuditEntityTypes.HEAD_COMPANY, action, AUDIT_FIELDS)
                .withAdditionalFieldKeys(additionalAllowedFieldKeys);
        persistence.audit(
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                AuditEntityTypes.HEAD_COMPANY,
                id.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                AuditChangeJson.write(policy.allow(changes)));
    }

    private static OrganizationEntityReadback readHeadCompany(java.sql.ResultSet result) throws java.sql.SQLException {
        return new OrganizationEntityReadback(
                result.getObject(1, UUID.class),
                BusinessEntityTypes.HEAD_COMPANY,
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(10),
                result.getString(11),
                result.getLong(12),
                result.getString(7),
                result.getString(8),
                result.getString(9),
                result.getLong(13),
                result.getLong(14),
                result.getLong(15),
                BusinessEntityTaskReadService.readExtensionObject(result.getString(16)));
    }

    private static void requireHeadCompany(String entityType) {
        if (!BusinessEntityTypes.HEAD_COMPANY.equalsIgnoreCase(Objects.requireNonNullElse(entityType, "")))
            throw new BusinessEntityService.OrganizationValidationException();
    }

    private record ExtensionValues(String json, long revision) {}

}
