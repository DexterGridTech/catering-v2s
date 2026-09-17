package com.catering.v2s.contract.application;

import com.catering.v2s.contract.application.persistence.ContractCommandPersistence;
import com.catering.v2s.contract.application.persistence.ContractDerivedStoreStatusPersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.contract.api.OperationsStoreContractCommandApi;
import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.api.ExtensionValueSemantics;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractCommandService implements OperationsStoreContractCommandApi {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> CONTRACT_FIELDS =
            Set.of("contractNo", "effectiveFrom", "effectiveTo", "phaseName", "status", "items");
    private static final AuditChangePolicy CONTRACT_CREATED =
            new AuditChangePolicy("STORE_CONTRACT", "CONTRACT_CREATED", CONTRACT_FIELDS);
    private static final AuditChangePolicy CONTRACT_UPDATED =
            new AuditChangePolicy("STORE_CONTRACT", "CONTRACT_UPDATED", CONTRACT_FIELDS);
    private static final AuditChangePolicy CONTRACT_INVALIDATED =
            new AuditChangePolicy("STORE_CONTRACT", "CONTRACT_INVALIDATED", Set.of("status"));
    private final ContractCommandPersistence persistence;
    private final ContractDerivedStoreStatusPersistence derivedStatusPersistence;
    private final TimeProvider time;
    private final BusinessDateProvider businessDate;
    private final StoreContractLookup stores;
    private final ExtensionDefinitionLookup definitions;
    private final ContractCommandReceiptService receipts;

    public ContractCommandService(
            JdbcTemplate jdbc,
            TimeProvider time,
            BusinessDateProvider businessDate,
            StoreContractLookup stores,
            ExtensionDefinitionLookup definitions) {
        this(jdbc, time, businessDate, stores, definitions, new ContractCommandReceiptService(jdbc, time));
    }

    public ContractCommandService(
            JdbcTemplate jdbc,
            TimeProvider time,
            BusinessDateProvider businessDate,
            StoreContractLookup stores,
            ExtensionDefinitionLookup definitions,
            ContractCommandReceiptService receipts) {
        this(
                new ContractCommandPersistence(jdbc),
                time,
                businessDate,
                stores,
                definitions,
                receipts,
                new ContractDerivedStoreStatusPersistence(jdbc));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ContractCommandService(
            ContractCommandPersistence persistence,
            TimeProvider time,
            BusinessDateProvider businessDate,
            StoreContractLookup stores,
            ExtensionDefinitionLookup definitions,
            ContractCommandReceiptService receipts,
            ContractDerivedStoreStatusPersistence derivedStatusPersistence) {
        this.persistence = persistence;
        this.time = time;
        this.businessDate = businessDate;
        this.stores = stores;
        this.definitions = definitions;
        this.receipts = receipts;
        this.derivedStatusPersistence = derivedStatusPersistence;
    }

    @Override
    @Transactional
    public StoreContractReadback create(CreateCommand command) {
        var context = stores.requireStoreContractContextForCreate(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.storeId());
        if (!context.projectId().equals(command.projectId())) throw new ContractValidationException();
        requireProjectGrant(
                command.workspaceUuid(), command.groupWorkspaceKey(), context.projectId(), command.ownerScopeGrant());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "create",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.contractNo(),
                        command.storeId(),
                        command.projectId(),
                        command.effectiveFrom(),
                        command.effectiveTo(),
                        command.phaseName(),
                        command.notes(),
                        command.items(),
                        command.extensionSubmission()),
                () -> createSubmission(command, context));
    }

    @Override
    @Transactional
    public StoreContractReadback update(UpdateCommand command) {
        ContractState existingState =
                requireState(command.workspaceUuid(), command.groupWorkspaceKey(), command.contractId());
        StoreContractReadback existing = existingState.readback();
        var context = stores.requireStoreContractContext(
                command.workspaceUuid(), command.groupWorkspaceKey(), existing.storeId());
        requireProjectGrant(
                command.workspaceUuid(), command.groupWorkspaceKey(), context.projectId(), command.ownerScopeGrant());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "update",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.contractId(),
                        command.effectiveFrom(),
                        command.effectiveTo(),
                        command.phaseName(),
                        command.notes(),
                        command.items(),
                        command.expectedVersion(),
                        command.extensionSubmission()),
                () -> updateSubmission(command, existing, existingState.extensionValuesJson(), context));
    }

    @Override
    @Transactional
    public StoreContractReadback invalidate(InvalidateCommand command) {
        return invalidate(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.contractId(),
                command.expectedVersion(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    private StoreContractReadback createSubmission(
            CreateCommand command, StoreContractLookup.StoreContractContext context) {
        requireCreateStoreAndTenantEnabled(context);
        if (!context.projectId().equals(command.projectId())) throw new ContractValidationException();
        List<ItemInput> items = itemInputs(command.items());
        validateContract(
                command.effectiveFrom(),
                command.effectiveTo(),
                command.phaseName(),
                context.projectPhaseNames(),
                items);
        String contractNo = text(command.contractNo(), 120);
        String phaseName = optional(command.phaseName(), 120);
        String notes = optional(command.notes(), 2000);
        String itemsJson = itemsJson(items);
        ExtensionValues extensionValues = createExtensionValues(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.extensionSubmission());
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            persistence.insertWithExtensions(
                    id,
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    contractNo,
                    command.storeId(),
                    context.tenantId(),
                    command.effectiveFrom(),
                    command.effectiveTo(),
                    phaseName,
                    notes,
                    itemsJson,
                    extensionValues.json(),
                    extensionValues.revision(),
                    now,
                    now);
        } catch (DuplicateKeyException duplicate) {
            throw new ContractConflictException(duplicate);
        }
        StoreContractReadback created = new StoreContractReadback(
                id,
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                contractNo,
                command.storeId(),
                context.tenantId(),
                command.effectiveFrom(),
                command.effectiveTo(),
                phaseName,
                notes,
                "ACTIVE",
                1L,
                readItems(itemsJson));
        audit(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                id,
                "CONTRACT_CREATED",
                now,
                command.actor(),
                CONTRACT_CREATED,
                createdChanges(created));
        return created;
    }

    private StoreContractReadback updateSubmission(
            UpdateCommand command,
            StoreContractReadback existing,
            String currentExtensionValuesJson,
            StoreContractLookup.StoreContractContext context) {
        List<ItemInput> items = itemInputs(command.items());
        validateContract(
                command.effectiveFrom(),
                command.effectiveTo(),
                command.phaseName(),
                context.projectPhaseNames(),
                items);
        long now = time.currentEpochMillis();
        if (persistence.updateFromCommand(
                        command.effectiveFrom(),
                        command.effectiveTo(),
                        optional(command.phaseName(), 120),
                        optional(command.notes(), 2000),
                        itemsJson(items),
                        now,
                        command.contractId(),
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.expectedVersion())
                != 1) throw new ContractConflictException();
        replaceValues(
                command.contractId(),
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                currentExtensionValuesJson,
                command.extensionSubmission());
        StoreContractReadback updated = new StoreContractReadback(
                existing.id(),
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.contractNo(),
                existing.storeId(),
                existing.tenantId(),
                command.effectiveFrom(),
                command.effectiveTo(),
                optional(command.phaseName(), 120),
                optional(command.notes(), 2000),
                existing.status(),
                existing.version() + 1,
                readItems(itemsJson(items)));
        audit(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.contractId(),
                "CONTRACT_UPDATED",
                now,
                command.actor(),
                CONTRACT_UPDATED,
                changed(existing, updated));
        return updated;
    }

    @Transactional
    public StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            List<ItemInput> items,
            Map<String, String> extensionValues) {
        return create(
                workspaceUuid,
                key,
                contractNo,
                storeId,
                projectId,
                from,
                to,
                phaseName,
                null,
                items,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            Map<String, String> extensionValues) {
        return create(
                workspaceUuid,
                key,
                contractNo,
                storeId,
                projectId,
                from,
                to,
                phaseName,
                notes,
                items,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            Map<String, String> extensionValues,
            AuditActor actor) {
        var context = stores.requireStoreContractContextForCreate(workspaceUuid, key, storeId);
        return create(
                workspaceUuid,
                key,
                contractNo,
                storeId,
                projectId,
                from,
                to,
                phaseName,
                notes,
                items,
                extensionValues,
                actor,
                context);
    }

    private StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            Map<String, String> extensionValues,
            AuditActor actor,
            StoreContractLookup.StoreContractContext context) {
        requireCreateStoreAndTenantEnabled(context);
        if (!context.projectId().equals(projectId)) throw new ContractValidationException();
        validateContract(from, to, phaseName, context.projectPhaseNames(), items);
        validateValues(workspaceUuid, key, extensionValues);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            persistence.insertWithoutExtensions(
                    id,
                    workspaceUuid,
                    key,
                    text(contractNo, 120),
                    storeId,
                    context.tenantId(),
                    from,
                    to,
                    optional(phaseName, 120),
                    optional(notes, 2000),
                    itemsJson(items),
                    now,
                    now);
        } catch (DuplicateKeyException duplicate) {
            throw new ContractConflictException(duplicate);
        }
        replaceValues(id, workspaceUuid, key, extensionValues);
        StoreContractReadback created = require(workspaceUuid, key, id);
        audit(workspaceUuid, key, id, "CONTRACT_CREATED", now, actor, CONTRACT_CREATED, createdChanges(created));
        return created;
    }

    @Transactional
    public StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return create(
                workspaceUuid,
                key,
                contractNo,
                storeId,
                projectId,
                from,
                to,
                phaseName,
                notes,
                items,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "create",
                        workspaceUuid,
                        key,
                        contractNo,
                        storeId,
                        projectId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        extensionValues),
                () -> create(
                        workspaceUuid,
                        key,
                        contractNo,
                        storeId,
                        projectId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        extensionValues,
                        actor));
    }

    /** Operations command path: bind the actual store project before receipt replay. */
    @Transactional
    public StoreContractReadback create(
            UUID workspaceUuid,
            String key,
            String contractNo,
            UUID storeId,
            UUID projectId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        var context = stores.requireStoreContractContextForCreate(workspaceUuid, key, storeId);
        if (!context.projectId().equals(projectId)) throw new ContractValidationException();
        requireProjectGrant(workspaceUuid, key, context.projectId(), ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "create",
                        workspaceUuid,
                        key,
                        contractNo,
                        storeId,
                        projectId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        extensionValues),
                () -> create(
                        workspaceUuid,
                        key,
                        contractNo,
                        storeId,
                        projectId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        extensionValues,
                        actor,
                        context));
    }

    @Transactional
    public StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues) {
        return update(
                workspaceUuid,
                key,
                contractId,
                from,
                to,
                phaseName,
                null,
                items,
                expectedVersion,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues) {
        return update(
                workspaceUuid,
                key,
                contractId,
                from,
                to,
                phaseName,
                notes,
                items,
                expectedVersion,
                extensionValues,
                AuditActor.system());
    }

    @Transactional
    public StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        StoreContractReadback existing = require(workspaceUuid, key, contractId);
        var context = stores.requireStoreContractContext(workspaceUuid, key, existing.storeId());
        return update(
                workspaceUuid,
                key,
                contractId,
                from,
                to,
                phaseName,
                notes,
                items,
                expectedVersion,
                extensionValues,
                actor,
                existing,
                context);
    }

    private StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor,
            StoreContractReadback existing,
            StoreContractLookup.StoreContractContext context) {
        validateContract(from, to, phaseName, context.projectPhaseNames(), items);
        validateValues(workspaceUuid, key, extensionValues);
        long now = time.currentEpochMillis();
        if (persistence.updateFromLegacyCommand(
                        from,
                        to,
                        optional(phaseName, 120),
                        optional(notes, 2000),
                        itemsJson(items),
                        now,
                        contractId,
                        workspaceUuid,
                        key,
                        expectedVersion)
                != 1) throw new ContractConflictException();
        replaceValues(contractId, workspaceUuid, key, extensionValues);
        StoreContractReadback updated = require(workspaceUuid, key, contractId);
        audit(
                workspaceUuid,
                key,
                contractId,
                "CONTRACT_UPDATED",
                now,
                actor,
                CONTRACT_UPDATED,
                changed(existing, updated));
        return updated;
    }

    @Transactional
    public StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey) {
        return update(
                workspaceUuid,
                key,
                contractId,
                from,
                to,
                phaseName,
                notes,
                items,
                expectedVersion,
                extensionValues,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "update",
                        workspaceUuid,
                        key,
                        contractId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        expectedVersion,
                        extensionValues),
                () -> update(
                        workspaceUuid,
                        key,
                        contractId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        expectedVersion,
                        extensionValues,
                        actor));
    }

    /** Operations command path: bind the persisted contract's store project before receipt replay. */
    @Transactional
    public StoreContractReadback update(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            LocalDate from,
            LocalDate to,
            String phaseName,
            String notes,
            List<ItemInput> items,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        StoreContractReadback existing = require(workspaceUuid, key, contractId);
        var context = stores.requireStoreContractContext(workspaceUuid, key, existing.storeId());
        requireProjectGrant(workspaceUuid, key, context.projectId(), ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "update",
                        workspaceUuid,
                        key,
                        contractId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        expectedVersion,
                        extensionValues),
                () -> update(
                        workspaceUuid,
                        key,
                        contractId,
                        from,
                        to,
                        phaseName,
                        notes,
                        items,
                        expectedVersion,
                        extensionValues,
                        actor,
                        existing,
                        context));
    }

    @Transactional
    public StoreContractReadback invalidate(UUID workspaceUuid, String key, UUID contractId, long expectedVersion) {
        return invalidate(workspaceUuid, key, contractId, expectedVersion, AuditActor.system());
    }

    @Transactional
    public StoreContractReadback invalidate(
            UUID workspaceUuid, String key, UUID contractId, long expectedVersion, AuditActor actor) {
        StoreContractReadback existing = require(workspaceUuid, key, contractId);
        return invalidate(workspaceUuid, key, contractId, expectedVersion, actor, existing);
    }

    private StoreContractReadback invalidate(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            long expectedVersion,
            AuditActor actor,
        StoreContractReadback existing) {
        long now = time.currentEpochMillis();
        if (persistence.invalidate(
                        now,
                        now,
                        contractId,
                        workspaceUuid,
                        key,
                        expectedVersion)
                != 1) throw new ContractConflictException();
        StoreContractReadback invalidated = new StoreContractReadback(
                existing.id(),
                existing.workspaceUuid(),
                existing.groupWorkspaceKey(),
                existing.contractNo(),
                existing.storeId(),
                existing.tenantId(),
                existing.effectiveFrom(),
                existing.effectiveTo(),
                existing.phaseNameSnapshot(),
                existing.notes(),
                "INVALID",
                existing.version() + 1,
                existing.items());
        audit(
                workspaceUuid,
                key,
                contractId,
                "CONTRACT_INVALIDATED",
                now,
                actor,
                CONTRACT_INVALIDATED,
                List.of(AuditChange.forNullableScalar("status", existing.status(), invalidated.status())));
        return invalidated;
    }

    @Transactional
    public StoreContractReadback invalidate(
            UUID workspaceUuid, String key, UUID contractId, long expectedVersion, String idempotencyKey) {
        return invalidate(workspaceUuid, key, contractId, expectedVersion, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public StoreContractReadback invalidate(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("invalidate", workspaceUuid, key, contractId, expectedVersion),
                () -> invalidate(workspaceUuid, key, contractId, expectedVersion, actor));
    }

    /** Operations command path: bind the persisted contract's store project before receipt replay. */
    @Transactional
    public StoreContractReadback invalidate(
            UUID workspaceUuid,
            String key,
            UUID contractId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        StoreContractReadback existing =
                requireState(workspaceUuid, key, contractId).readback();
        var context = stores.requireStoreContractContext(workspaceUuid, key, existing.storeId());
        requireProjectGrant(workspaceUuid, key, context.projectId(), ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("invalidate", workspaceUuid, key, contractId, expectedVersion),
                () -> invalidate(workspaceUuid, key, contractId, expectedVersion, actor, existing));
    }

    @Transactional(readOnly = true)
    public StoreContractReadback require(UUID workspaceUuid, String key, UUID contractId) {
        return persistence.require(workspaceUuid, key, contractId);
    }

    /** One owner read supplies both the command state and extension JSON needed by an update/replay path. */
    private ContractState requireState(UUID workspaceUuid, String key, UUID contractId) {
        ContractCommandPersistence.ContractState state = persistence.requireState(workspaceUuid, key, contractId);
        return new ContractState(state.readback(), state.extensionValuesJson());
    }

    @Transactional(readOnly = true)
    public List<StoreContractReadback> list(UUID workspaceUuid, String key) {
        return persistence.list(workspaceUuid, key);
    }

    @Transactional(readOnly = true)
    public String derivedStoreStatus(UUID workspaceUuid, String key, UUID storeId) {
        return derivedStatusPersistence.read(workspaceUuid, key, List.of(storeId), businessDate.today())
                .statusOf(storeId);
    }

    private void validateContract(
            LocalDate from, LocalDate to, String phase, List<String> projectPhases, List<ItemInput> items) {
        if (from == null
                || (to != null && to.isBefore(from))
                || (phase != null && !phase.isBlank() && !projectPhases.contains(phase))
                || items == null
                || items.isEmpty()
                || items.stream()
                        .anyMatch(item -> item == null
                                || item.itemCode() == null
                                || item.itemCode().isBlank()
                                || item.itemCode().trim().length() > 120
                                || item.itemName() == null
                                || item.itemName().isBlank()
                                || item.itemName().trim().length() > 240)
                || items.stream()
                                .map(item -> item.itemCode().strip().toLowerCase(java.util.Locale.ROOT))
                                .distinct()
                                .count()
                        != items.size()) throw new ContractValidationException();
    }

    private static void requireCreateStoreAndTenantEnabled(StoreContractLookup.StoreContractContext context) {
        if (!"ENABLED".equals(context.storeStatus()) || !"ENABLED".equals(context.tenantStatus())) {
            throw new ContractValidationException();
        }
    }

    private static void requireProjectGrant(
            UUID workspaceUuid, String key, UUID projectId, OperationsOwnerScopeGrant ownerScopeGrant) {
        if (ownerScopeGrant == null
                || !ownerScopeGrant.matches(workspaceUuid, key, ServiceNodeTypes.PROJECT, projectId))
            throw new ContractAuthorizationException();
    }

    private static String canonical(String operation, Object... values) {
        StringBuilder value = new StringBuilder(operation);
        for (Object part : values) {
            String text = String.valueOf(part == null ? "<null>" : part);
            value.append('|').append(text.length()).append(':').append(text);
        }
        return value.toString();
    }

    private void validateValues(UUID workspaceUuid, String key, Map<String, String> values) {
        Map<String, String> actual = values == null ? Map.of() : values;
        try {
            ExtensionDefinitionReadback definition =
                    definitions.requireDefinition(workspaceUuid, key, ExtensionHostTypes.CONTRACT);
            if (!actual.isEmpty()) ExtensionDefinitionService.requireConsumableDefinition(definition);
            Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream()
                    .collect(java.util.stream.Collectors.toMap(
                            ExtensionDefinitionReadback.Field::fieldKey, field -> field));
            if (actual.keySet().stream().anyMatch(field -> !fields.containsKey(field))
                    || actual.entrySet().stream()
                            .anyMatch(entry -> !"DISABLED"
                                            .equals(fields.get(entry.getKey()).status())
                                    && !isJsonNull(entry.getValue())
                                    && !validJsonValue(fields.get(entry.getKey()), entry.getValue())))
                throw new ContractValidationException();
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (!actual.isEmpty()) throw new ContractValidationException(absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new ContractValidationException(invalid);
        }
    }

    private ExtensionValues createExtensionValues(UUID workspaceUuid, String key, ExtensionSubmission submission) {
        try {
            ExtensionDefinitionReadback definition =
                    definitions.requireDefinition(workspaceUuid, key, ExtensionHostTypes.CONTRACT);
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, "{}", submission), definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty()) throw new ContractValidationException(absent);
            return new ExtensionValues("{}", 0L);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new ContractValidationException(invalid);
        }
    }

    private static List<ItemInput> itemInputs(List<Item> values) {
        return values.stream()
                .map(value -> value == null ? null : new ItemInput(value.itemCode(), value.itemName()))
                .toList();
    }

    private static String itemsJson(List<ItemInput> items) {
        var array = JSON.createArrayNode();
        for (ItemInput item : items) {
            var value = array.addObject();
            value.put("code", text(item.itemCode(), 120));
            value.put("name", text(item.itemName(), 240));
        }
        return array.toString();
    }

    private static List<StoreContractReadback.Item> readItems(String source) {
        try {
            JsonNode array = JSON.readTree(source);
            if (!array.isArray()) throw new ContractValidationException();
            java.util.ArrayList<StoreContractReadback.Item> values = new java.util.ArrayList<>();
            int line = 1;
            for (JsonNode item : array)
                values.add(new StoreContractReadback.Item(
                        line++, item.path("code").asText(), item.path("name").asText()));
            return List.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new ContractValidationException(failure);
        }
    }

    private void replaceValues(UUID id, UUID workspaceUuid, String key, Map<String, String> values) {
        String current = persistence.readExtensionValues(id);
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, key, ExtensionHostTypes.CONTRACT);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (values != null && !values.isEmpty()) throw new ContractValidationException(absent);
            validateExistingExtensionValues(current);
            persistence.clearExtensionValues(id, current, 0L);
            return;
        }
        final String merged;
        try {
            merged = ExtensionDefinitionService.mergeValues(definition, current, values);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new ContractValidationException(invalid);
        }
        persistence.updateExtensionValues(id, merged.toString(), definition.version());
    }

    private static void validateExistingExtensionValues(String current) {
        try {
            ExtensionDefinitionService.readValues(current);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new ContractValidationException(invalid);
        }
    }

    private void replaceValues(UUID id, UUID workspaceUuid, String key, ExtensionSubmission submission) {
        String current = persistence.readExtensionValuesForSubmission(id);
        replaceValues(id, workspaceUuid, key, current, submission);
    }

    private void replaceValues(
            UUID id, UUID workspaceUuid, String key, String current, ExtensionSubmission submission) {
        ExtensionDefinitionReadback definition;
        try {
            definition = definitions.requireDefinition(workspaceUuid, key, ExtensionHostTypes.CONTRACT);
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (submission != null && !submission.fields().isEmpty()) throw new ContractValidationException(absent);
            persistence.clearSubmittedExtensionValues(id, current);
            return;
        }
        String merged;
        try {
            merged = ExtensionDefinitionService.mergeValues(definition, current, submission);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new ContractValidationException(invalid);
        }
        persistence.updateSubmittedExtensionValues(id, merged, definition.version());
    }

    private void audit(
            UUID workspaceUuid,
            String key,
            UUID id,
            String action,
            long now,
            AuditActor actor,
            AuditChangePolicy policy,
            List<AuditChange> changes) {
        persistence.insertAuditEvent(
                UUID.randomUUID(),
                workspaceUuid,
                key,
                id.toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                now,
                auditJson(policy.allow(changes)));
    }

    private static List<AuditChange> createdChanges(StoreContractReadback value) {
        return List.of(
                AuditChange.forNullableScalar("contractNo", null, value.contractNo()),
                AuditChange.forNullableScalar("effectiveFrom", null, date(value.effectiveFrom())),
                AuditChange.forNullableScalar("effectiveTo", null, date(value.effectiveTo())),
                AuditChange.forNullableScalar("phaseName", null, value.phaseNameSnapshot()),
                AuditChange.forNullableScalar("status", null, value.status()),
                AuditChange.forNullableScalar("items", null, items(value.items())));
    }

    private static List<AuditChange> changed(StoreContractReadback before, StoreContractReadback after) {
        return List.of(
                        AuditChange.forNullableScalar("contractNo", before.contractNo(), after.contractNo()),
                        AuditChange.forNullableScalar("effectiveFrom", date(before.effectiveFrom()), date(after.effectiveFrom())),
                        AuditChange.forNullableScalar("effectiveTo", date(before.effectiveTo()), date(after.effectiveTo())),
                        AuditChange.forNullableScalar("phaseName", before.phaseNameSnapshot(), after.phaseNameSnapshot()),
                        AuditChange.forNullableScalar("status", before.status(), after.status()),
                        AuditChange.forNullableScalar("items", items(before.items()), items(after.items())))
                .stream()
                .filter(change -> !Objects.equals(change.beforeValue(), change.afterValue()))
                .toList();
    }

    private static String items(List<StoreContractReadback.Item> values) {
        return String.join(
                ",",
                values.stream()
                        .map(value -> value.itemCode() + ":" + value.itemName())
                        .toList());
    }

    private static String date(LocalDate value) {
        return value == null ? null : value.toString();
    }

    private static String auditJson(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private static String text(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit) throw new ContractValidationException();
        return normalized;
    }

    private static String optional(String value, int limit) {
        return value == null || value.isBlank() ? null : text(value, limit);
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
                case "DATE" -> json.isTextual() && ExtensionValueSemantics.isCanonicalDate(json.asText());
                case "BOOLEAN" -> json.isBoolean();
                case "SELECT" -> json.isTextual() && field.options().contains(json.asText());
                default -> false;
            };
        } catch (java.io.IOException failure) {
            return false;
        }
    }

    private record ContractState(StoreContractReadback readback, String extensionValuesJson) {}

    private record ExtensionValues(String json, long revision) {}

    public record ItemInput(String itemCode, String itemName) {}

    public static final class ContractNotFoundException extends RuntimeException {}

    public static final class ContractConflictException extends RuntimeException {
        public ContractConflictException() {}

        public ContractConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class ContractValidationException extends RuntimeException {
        public ContractValidationException() {}

        public ContractValidationException(Throwable cause) {
            super(cause);
        }
    }

    public static final class ContractAuthorizationException extends RuntimeException {}
}
