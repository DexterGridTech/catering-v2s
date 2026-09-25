package com.catering.v2s.storeterminal.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.AreaCandidate;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.AreaReference;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.CandidatePage;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.CreateCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.ReplaceCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.StatusCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TagCandidate;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TagReference;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TerminalDetail;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.TerminalMutation;
import com.catering.v2s.storeterminal.domain.ActivationCode;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration;
import com.catering.v2s.storeterminal.domain.TerminalConfiguration.RangeSelection;
import com.catering.v2s.storeterminal.domain.generated.StoreTerminalRules;
import com.catering.v2s.storeterminal.persistence.StoreTerminalOwnerPersistence;
import com.catering.v2s.storeterminal.persistence.StoreTerminalOwnerPersistence.Receipt;
import com.catering.v2s.storeterminal.persistence.StoreTerminalOwnerPersistence.TerminalRow;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner boundary: validates the full aggregate, writes one transaction receipt and audit event per mutation. */
@Service
public class StoreTerminalOwnerService implements StoreTerminalOwnerApi {
    private static final int MAX_AUTOMATIC_CODE_ATTEMPTS = 16;
    private static final String EDIT_CAPABILITY = "EDIT_STORE_TERMINAL";
    private static final AuditChangePolicy CREATED = new AuditChangePolicy(
            AuditEntityTypes.STORE_TERMINAL,
            "TERMINAL_CREATED",
            Set.of("name", "deviceType", "status", "activationCode", "printers", "functions", "ranges", "scenes"));
    private static final AuditChangePolicy REPLACED = new AuditChangePolicy(
            AuditEntityTypes.STORE_TERMINAL,
            "TERMINAL_REPLACED",
            Set.of("name", "deviceType", "printers", "functions", "ranges", "scenes"));
    private static final AuditChangePolicy STATUS_CHANGED =
            new AuditChangePolicy(AuditEntityTypes.STORE_TERMINAL, "TERMINAL_STATUS_CHANGED", Set.of("status"));

    private final StoreTerminalOwnerPersistence persistence;
    private final StoreContractLookup stores;
    private final StoreServicePointOwnerApi servicePoints;
    private final CatalogScopeLookup catalogScopes;
    private final CatalogProductionTagOwnerApi productionTags;
    private final TimeProvider time;
    private final ActivationCodeCandidateSource codeCandidates;
    private final ObjectMapper json;
    private final TerminalConfigurationCodec configurations;
    private final AuditEventWriter auditEvents;

    public StoreTerminalOwnerService(
            StoreTerminalOwnerPersistence persistence,
            StoreContractLookup stores,
            StoreServicePointOwnerApi servicePoints,
            CatalogScopeLookup catalogScopes,
            CatalogProductionTagOwnerApi productionTags,
            TimeProvider time,
            ActivationCodeCandidateSource codeCandidates,
            ObjectMapper json,
            AuditEventWriter auditEvents) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.stores = Objects.requireNonNull(stores, "stores");
        this.servicePoints = Objects.requireNonNull(servicePoints, "servicePoints");
        this.catalogScopes = Objects.requireNonNull(catalogScopes, "catalogScopes");
        this.productionTags = Objects.requireNonNull(productionTags, "productionTags");
        this.time = Objects.requireNonNull(time, "time");
        this.codeCandidates = Objects.requireNonNull(codeCandidates, "codeCandidates");
        this.json = Objects.requireNonNull(json, "json");
        this.configurations = new TerminalConfigurationCodec(json);
        this.auditEvents = Objects.requireNonNull(auditEvents, "auditEvents");
    }

    @Override
    @Transactional(readOnly = true)
    public TerminalPage listTerminalPage(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String query, String cursor, int pageSize) {
        requireStore(workspaceUuid, groupWorkspaceKey, storeRef);
        try {
            return persistence.list(workspaceUuid, groupWorkspaceKey, storeRef, query, cursor, pageSize);
        } catch (OpaqueCollectionCursor.InvalidCursor invalid) {
            throw new InvalidTerminalInputException(invalid);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public TerminalDetail readTerminalDetail(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID terminalRef) {
        requireStore(workspaceUuid, groupWorkspaceKey, storeRef);
        TerminalRow row = persistence.find(workspaceUuid, groupWorkspaceKey, storeRef, terminalRef);
        if (row == null) throw new TerminalNotFoundException();
        return detail(row, workspaceUuid, groupWorkspaceKey);
    }

    @Override
    @Transactional(readOnly = true)
    public CandidatePage<AreaCandidate> listAreaCandidates(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String query, String cursor, int pageSize) {
        requireStore(workspaceUuid, groupWorkspaceKey, storeRef);
        var page = servicePoints.searchTerminalAreaCandidates(
                workspaceUuid, groupWorkspaceKey, storeRef, query, cursor, pageSize);
        return new CandidatePage<>(
                page.items().stream()
                        .map(value -> new AreaCandidate(value.areaRef(), value.name(), value.code()))
                        .toList(),
                page.nextCursor(),
                page.total());
    }

    @Override
    @Transactional(readOnly = true)
    public CandidatePage<TagCandidate> listTagCandidates(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String query, String cursor, int pageSize) {
        requireStore(workspaceUuid, groupWorkspaceKey, storeRef);
        validatePageSize(pageSize);
        String brandRef = catalogScopes.requireCatalogBrand(workspaceUuid, groupWorkspaceKey, "STORE", storeRef, null);
        ObjectNode request =
                json.createObjectNode().put("usage", "BINDABLE_CANDIDATE").put("pageSize", pageSize);
        if (query != null && !query.isBlank()) request.put("query", query.trim());
        if (cursor != null && !cursor.isBlank()) request.put("cursor", cursor);
        JsonNode data = productionTags
                .readTags(storeRef.toString(), brandRef, request, "store-terminal-candidate-read")
                .path("data");
        JsonNode entries = data.path("entries");
        if (!entries.isArray()) throw new IllegalStateException("production tag owner candidate projection is invalid");
        List<TagCandidate> items = new ArrayList<>();
        for (JsonNode item : entries) {
            try {
                items.add(new TagCandidate(
                        UUID.fromString(requiredString(item, "tagRef")),
                        requiredString(item, "name"),
                        requiredString(item, "code"),
                        requiredString(item, "status")));
            } catch (RuntimeException invalid) {
                throw new IllegalStateException("production tag owner candidate projection is invalid", invalid);
            }
        }
        return new CandidatePage<>(
                items,
                data.path("cursor").isNull() ? null : data.path("cursor").asText(),
                data.path("total").asLong());
    }

    @Override
    @Transactional
    public TerminalMutation createTerminal(CreateCommand command) {
        requireWrite(
                command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        StoreContractLookup.StoreContractContext store =
                requireStore(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        String name = requiredName(command.name());
        String normalizedName = normalizeName(name);
        String deviceType = requiredText(command.deviceType(), 32);
        String key = idempotencyKey(command.idempotencyKey());
        String mode = command.activationCode() == null ? "AUTO" : "MANUAL";
        String requestHash = requestHash(
                "create",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.storeRef(),
                name,
                deviceType,
                mode,
                command.configuration(),
                null,
                null);
        Receipt prior = persistence.findReceipt(command.workspaceUuid(), command.groupWorkspaceKey(), key);
        if (prior != null) {
            ReceiptValue replay = replay(prior, requestHash);
            if ("MANUAL".equals(mode)) {
                TerminalRow stored = persistence.find(
                        command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), replay.terminalRef());
                if (stored == null || !command.activationCode().value().equals(stored.activationCode())) {
                    throw new IdempotencyConflictException();
                }
            }
            return replay.mutation();
        }

        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            persistence.lockNames(
                    command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), List.of(normalizedName));
            TerminalConfigurationCodec.Normalized normalized =
                    normalizeConfiguration(deviceType, command.configuration(), null);
            ReferenceFacts referenceFacts = validateReferences(
                    command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), normalized, null);
            UUID terminalRef = UUID.randomUUID();
            long now = time.currentEpochMillis();
            ActivationCode activationCode = insertWithActivationCode(
                    terminalRef,
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.storeRef(),
                    name,
                    normalizedName,
                    deviceType,
                    command.activationCode(),
                    normalized.document().toString(),
                    now);
            TerminalMutation mutation = new TerminalMutation(terminalRef, 1, "ENABLED");
            appendAudit(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    terminalRef,
                    command.actor(),
                    now,
                    CREATED,
                    "TERMINAL_CREATED",
                    createChanges(name, deviceType, normalized.document(), referenceFacts));
            persistence.insertReceipt(
                    command.workspaceUuid(), command.groupWorkspaceKey(), key, requestHash, receiptJson(mutation), now);
            Objects.requireNonNull(activationCode, "activationCode");
            return mutation;
        } catch (DuplicateKeyException conflict) {
            throw new TerminalNameConflictException(conflict);
        }
    }

    @Override
    @Transactional
    public TerminalMutation replaceTerminal(ReplaceCommand command) {
        requireWrite(
                command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        StoreContractLookup.StoreContractContext store =
                requireStore(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        String name = requiredName(command.name());
        String normalizedName = normalizeName(name);
        String deviceType = requiredText(command.deviceType(), 32);
        String key = idempotencyKey(command.idempotencyKey());
        String requestHash = requestHash(
                "replace",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.storeRef(),
                name,
                deviceType,
                null,
                command.configuration(),
                command.terminalRef(),
                command.expectedVersion());
        Receipt prior = persistence.findReceipt(command.workspaceUuid(), command.groupWorkspaceKey(), key);
        if (prior != null) return replay(prior, requestHash).mutation();

        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            TerminalRow before = persistence.lock(
                    command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.terminalRef());
            if (before == null) throw new TerminalNotFoundException();
            if ("VOIDED".equals(before.status())) throw new TerminalVoidedImmutableException();
            if (before.version() != command.expectedVersion()) throw new TerminalVersionConflictException();
            String oldNormalizedName = normalizeName(before.name());
            persistence.lockNames(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.storeRef(),
                    List.of(oldNormalizedName, normalizedName));
            JsonNode previousDocument = parseConfiguration(before.configurationJson());
            TerminalConfigurationCodec.Normalized normalized =
                    normalizeConfiguration(deviceType, command.configuration(), previousDocument);
            ReferenceFacts referenceFacts = validateReferences(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.storeRef(),
                    normalized,
                    previousDocument);
            long now = time.currentEpochMillis();
            try {
                if (persistence.replace(
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                command.storeRef(),
                                command.terminalRef(),
                                name,
                                normalizedName,
                                deviceType,
                                normalized.document().toString(),
                                command.expectedVersion(),
                                now)
                        != 1) {
                    throw new TerminalVersionConflictException();
                }
            } catch (DuplicateKeyException conflict) {
                throw new TerminalNameConflictException(conflict);
            }
            TerminalMutation mutation =
                    new TerminalMutation(command.terminalRef(), before.version() + 1, before.status());
            appendAudit(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.terminalRef(),
                    command.actor(),
                    now,
                    REPLACED,
                    "TERMINAL_REPLACED",
                    replaceChanges(before, name, deviceType, previousDocument, normalized.document(), referenceFacts));
            persistence.insertReceipt(
                    command.workspaceUuid(), command.groupWorkspaceKey(), key, requestHash, receiptJson(mutation), now);
            return mutation;
        }
    }

    @Override
    @Transactional
    public TerminalMutation transitionTerminalStatus(StatusCommand command) {
        requireWrite(
                command.ownerScopeGrant(), command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        requireStore(command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef());
        String target = status(command.targetStatus());
        String key = idempotencyKey(command.idempotencyKey());
        String requestHash = requestHash(
                "status",
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.storeRef(),
                null,
                null,
                target,
                null,
                command.terminalRef(),
                command.expectedVersion());
        Receipt prior = persistence.findReceipt(command.workspaceUuid(), command.groupWorkspaceKey(), key);
        if (prior != null) return replay(prior, requestHash).mutation();

        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            TerminalRow before = persistence.lock(
                    command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRef(), command.terminalRef());
            if (before == null) throw new TerminalNotFoundException();
            if ("VOIDED".equals(before.status())) throw new TerminalStatusTransitionInvalidException();
            if (before.version() != command.expectedVersion()) throw new TerminalVersionConflictException();
            if (!validTransition(before.status(), target)) throw new TerminalStatusTransitionInvalidException();
            long now = time.currentEpochMillis();
            if (persistence.transition(
                            command.workspaceUuid(),
                            command.groupWorkspaceKey(),
                            command.storeRef(),
                            command.terminalRef(),
                            target,
                            command.expectedVersion(),
                            now)
                    != 1) {
                throw new TerminalVersionConflictException();
            }
            TerminalMutation mutation = new TerminalMutation(command.terminalRef(), before.version() + 1, target);
            appendAudit(
                    command.workspaceUuid(),
                    command.groupWorkspaceKey(),
                    command.terminalRef(),
                    command.actor(),
                    now,
                    STATUS_CHANGED,
                    "TERMINAL_STATUS_CHANGED",
                    List.of(AuditChange.forNullableScalar("status", before.status(), target)));
            persistence.insertReceipt(
                    command.workspaceUuid(), command.groupWorkspaceKey(), key, requestHash, receiptJson(mutation), now);
            return mutation;
        }
    }

    private ActivationCode insertWithActivationCode(
            UUID terminalRef,
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            String name,
            String normalizedName,
            String deviceType,
            ActivationCode manualCode,
            String configuration,
            long now) {
        if (manualCode != null) {
            if (!persistence.insert(
                    terminalRef,
                    workspaceUuid,
                    groupKey,
                    storeRef,
                    name,
                    normalizedName,
                    deviceType,
                    manualCode.value(),
                    configuration,
                    now)) {
                throw new ActivationCodeConflictException();
            }
            return manualCode;
        }
        for (int attempt = 0; attempt < MAX_AUTOMATIC_CODE_ATTEMPTS; attempt++) {
            ActivationCode candidate = ActivationCode.of(codeCandidates.nextCandidate());
            if (persistence.insert(
                    terminalRef,
                    workspaceUuid,
                    groupKey,
                    storeRef,
                    name,
                    normalizedName,
                    deviceType,
                    candidate.value(),
                    configuration,
                    now)) {
                return candidate;
            }
        }
        throw new ActivationCodeExhaustedException();
    }

    private ReferenceFacts validateReferences(
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            TerminalConfigurationCodec.Normalized normalized,
            JsonNode previousDocument) {
        Map<String, Set<UUID>> oldRefs = oldRangeRefs(previousDocument);
        Set<UUID> areaRefs = new HashSet<>();
        Set<UUID> tagRefs = new HashSet<>();
        for (TerminalConfiguration.Function function :
                normalized.configuration().functions()) {
            UUID functionRef = function.identity().ref();
            for (RangeSelection range : function.ranges()) {
                if (StoreTerminalRules.RANGE_TABLE_AREA.equals(range.key())) areaRefs.addAll(range.refs());
                if (StoreTerminalRules.RANGE_PRODUCTION_TAG.equals(range.key())) tagRefs.addAll(range.refs());
            }
        }

        Set<UUID> lookupAreaRefs = new HashSet<>(areaRefs);
        lookupAreaRefs.addAll(rangeRefs(previousDocument, StoreTerminalRules.RANGE_TABLE_AREA));
        Map<UUID, StoreServicePointOwnerApi.AreaReference> areas = new HashMap<>();
        if (!lookupAreaRefs.isEmpty()) {
            servicePoints
                    .readAreasByRefs(workspaceUuid, groupKey, storeRef, List.copyOf(lookupAreaRefs))
                    .forEach(value -> areas.put(value.areaRef(), value));
            if (!areas.keySet().containsAll(areaRefs)) throw new TerminalReferenceInvalidException();
        }
        Set<UUID> lookupTagRefs = new HashSet<>(tagRefs);
        lookupTagRefs.addAll(rangeRefs(previousDocument, StoreTerminalRules.RANGE_PRODUCTION_TAG));
        Map<UUID, CatalogProductionTagOwnerApi.ProductionTagReferenceReadback> tags = new HashMap<>();
        if (!lookupTagRefs.isEmpty()) {
            String brandRef = catalogScopes.requireCatalogBrand(workspaceUuid, groupKey, "STORE", storeRef, null);
            productionTags
                    .readTagReferencesByRefs(
                            storeRef.toString(), brandRef, List.copyOf(lookupTagRefs), "store-terminal-reference-check")
                    .forEach(value -> tags.put(value.tagRef(), value));
            if (!tags.keySet().containsAll(tagRefs)) throw new TerminalReferenceInvalidException();
        }

        for (TerminalConfiguration.Function function :
                normalized.configuration().functions()) {
            UUID functionRef = function.identity().ref();
            for (RangeSelection range : function.ranges()) {
                Set<UUID> previouslySelected = oldRefs.getOrDefault(functionRef + ":" + range.key(), Set.of());
                for (UUID ref : range.refs()) {
                    boolean existingSameAxis = previouslySelected.contains(ref);
                    if (StoreTerminalRules.RANGE_TABLE_AREA.equals(range.key())) {
                        var area = areas.get(ref);
                        if (!existingSameAxis
                                && (!StoreTerminalRules.RANGE_TABLE_AREA.equals(area.areaType())
                                        || !"ENABLED".equals(area.status()))) {
                            throw new TerminalReferenceInvalidException();
                        }
                    } else if (StoreTerminalRules.RANGE_PRODUCTION_TAG.equals(range.key())) {
                        var tag = tags.get(ref);
                        if (!existingSameAxis && !"ENABLED".equals(tag.status())) {
                            throw new TerminalReferenceInvalidException();
                        }
                    }
                }
            }
        }
        return new ReferenceFacts(areas, tags);
    }

    private TerminalConfigurationCodec.Normalized normalizeConfiguration(
            String deviceType, JsonNode configuration, JsonNode previousDocument) {
        try {
            return configurations.normalize(deviceType, configuration, previousDocument);
        } catch (IllegalArgumentException invalid) {
            throw new InvalidTerminalRequestException(invalid);
        }
    }

    private List<AuditChange> createChanges(
            String name, String deviceType, JsonNode document, ReferenceFacts referenceFacts) {
        Map<String, String> summaries = configurationSummaries(document, referenceFacts);
        List<AuditChange> changes = new ArrayList<>(List.of(
                AuditChange.forNullableScalar("name", null, name),
                AuditChange.forNullableScalar("deviceType", null, deviceType),
                AuditChange.forNullableScalar("status", null, "ENABLED"),
                AuditChange.forNullableScalar("activationCode", null, "已签发")));
        summaries.forEach((field, value) -> changes.add(AuditChange.forNullableScalar(field, null, value)));
        return CREATED.allow(changes);
    }

    private List<AuditChange> replaceChanges(
            TerminalRow before,
            String name,
            String deviceType,
            JsonNode oldDocument,
            JsonNode newDocument,
            ReferenceFacts referenceFacts) {
        List<AuditChange> changes = new ArrayList<>();
        addIfChanged(changes, "name", before.name(), name);
        addIfChanged(changes, "deviceType", before.deviceType(), deviceType);
        Map<String, String> oldSummary = configurationSummaries(oldDocument, referenceFacts);
        Map<String, String> newSummary = configurationSummaries(newDocument, referenceFacts);
        for (String field : List.of("printers", "functions", "ranges", "scenes")) {
            addIfChanged(changes, field, oldSummary.get(field), newSummary.get(field));
        }
        return REPLACED.allow(changes);
    }

    private Map<String, String> configurationSummaries(JsonNode document, ReferenceFacts referenceFacts) {
        Map<String, String> result = new LinkedHashMap<>();
        List<String> printers = new ArrayList<>();
        Map<String, String> printerNames = new HashMap<>();
        JsonNode printerNodes = document.path("printers");
        if (printerNodes.isArray()) {
            for (JsonNode printer : printerNodes) {
                String ref = printer.path("ref").asText("");
                String name = printer.path("name").asText("");
                printerNames.put(ref, name);
                printers.add(String.join(
                        " · ",
                        name,
                        printerBrandLabel(printer.path("brandKey").asText("")),
                        printerModelLabel(printer.path("modelKey").asText("")),
                        printerPaperLabel(printer.path("paperSpecKey").asText("")),
                        printerConnectionLabel(printer.path("connectionMethodKey").asText("")),
                        printer.hasNonNull("connectionParameter") ? "参数已配置" : "无参数"));
            }
        }
        result.put("printers", jsonString(printers));
        List<String> functions = new ArrayList<>();
        List<String> ranges = new ArrayList<>();
        List<String> scenes = new ArrayList<>();
        JsonNode functionNodes = document.path("functions");
        if (functionNodes.isArray()) {
            for (JsonNode function : functionNodes) {
                String functionKey = function.path("functionKey").asText("");
                String functionLabel = functionLabel(functionKey);
                functions.add(functionLabel);
                JsonNode rangeNodes = function.path("ranges");
                if (rangeNodes.isArray())
                    for (JsonNode range : rangeNodes) {
                        List<String> refs = stringValues(range.path("refs"));
                        String rangeKey = range.path("key").asText("");
                        String selection = range.path("all").asBoolean(false)
                                ? "全部"
                                : refs.stream().map(ref -> referenceLabel(rangeKey, ref, referenceFacts)).toList().stream()
                                        .collect(java.util.stream.Collectors.joining("、"));
                        ranges.add(functionLabel + " · " + rangeLabel(rangeKey) + "：" + selection);
                    }
                JsonNode sceneNodes = function.path("scenes");
                if (sceneNodes.isArray())
                    for (JsonNode scene : sceneNodes) {
                        List<String> names = new ArrayList<>();
                        JsonNode bindings = scene.path("printers");
                        if (bindings.isArray())
                            for (JsonNode binding : bindings) {
                                names.add(printerNames.getOrDefault(
                                        binding.path("printerRef").asText(""), "未知打印机"));
                            }
                        String sceneKey = scene.path("sceneKey").asText("");
                        String orderLabels = stringValues(scene.path("orderTypes")).stream()
                                .map(StoreTerminalOwnerService::orderTypeLabel)
                                .collect(java.util.stream.Collectors.joining("、"));
                        scenes.add(functionLabel + " · " + sceneLabel(functionKey, sceneKey)
                                + "：订单类型=" + orderLabels + "；打印机=" + String.join("、", names));
                    }
            }
        }
        result.put("functions", jsonString(functions));
        result.put("ranges", jsonString(ranges));
        result.put("scenes", jsonString(scenes));
        return result;
    }

    private static String functionLabel(String key) {
        return StoreTerminalRules.FUNCTION_RULES.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.FunctionRule::label)
                .findFirst()
                .orElse("未知功能");
    }

    private static String rangeLabel(String key) {
        return StoreTerminalRules.RANGE_RULES.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.RangeRule::label)
                .findFirst()
                .orElse("未知范围");
    }

    private static String sceneLabel(String functionKey, String key) {
        return StoreTerminalRules.scenesForFunction(functionKey).stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.SceneRule::label)
                .findFirst()
                .orElse("未知打印场景");
    }

    private static String orderTypeLabel(String key) {
        return StoreTerminalRules.ORDER_TYPES.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.OrderType::label)
                .findFirst()
                .orElse("未知订单类型");
    }

    private static String printerBrandLabel(String key) {
        return StoreTerminalRules.PRINTER_BRANDS.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.PrinterBrand::label)
                .findFirst()
                .orElse("未知品牌");
    }

    private static String printerModelLabel(String key) {
        return StoreTerminalRules.PRINTER_MODELS.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.PrinterModel::label)
                .findFirst()
                .orElse("未知型号");
    }

    private static String printerPaperLabel(String key) {
        return StoreTerminalRules.PAPER_SPECS.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.PaperSpec::label)
                .findFirst()
                .orElse("未知纸规格");
    }

    private static String printerConnectionLabel(String key) {
        return StoreTerminalRules.CONNECTION_METHODS.stream()
                .filter(value -> value.key().equals(key))
                .map(StoreTerminalRules.ConnectionMethod::label)
                .findFirst()
                .orElse("未知连接方式");
    }

    private static String referenceLabel(String rangeKey, String ref, ReferenceFacts referenceFacts) {
        try {
            UUID parsed = UUID.fromString(ref);
            if (StoreTerminalRules.RANGE_TABLE_AREA.equals(rangeKey)) {
                StoreServicePointOwnerApi.AreaReference area = referenceFacts.areas().get(parsed);
                if (area != null) return area.name() + "（" + area.code() + "）";
            }
            if (StoreTerminalRules.RANGE_PRODUCTION_TAG.equals(rangeKey)) {
                CatalogProductionTagOwnerApi.ProductionTagReferenceReadback tag = referenceFacts.tags().get(parsed);
                if (tag != null) return tag.name() + "（" + tag.code() + "）";
            }
        } catch (IllegalArgumentException ignored) {
            // The normalized owner document is validated before this method. A
            // fixed label keeps a corrupt audit payload from exposing an opaque id.
        }
        return "引用已不存在";
    }

    private void appendAudit(
            UUID workspaceUuid,
            String groupKey,
            UUID terminalRef,
            AuditActor actor,
            long now,
            AuditChangePolicy policy,
            String action,
            List<AuditChange> changes) {
        if (!policy.action().equals(action)) throw new IllegalArgumentException("terminal audit policy mismatch");
        auditEvents.write(new AuditEvent(
                UUID.randomUUID(),
                workspaceUuid,
                groupKey,
                new AuditTarget(AuditEntityTypes.STORE_TERMINAL, terminalRef.toString()),
                actor,
                action,
                now,
                policy.allow(changes)));
    }

    private ReceiptValue replay(Receipt receipt, String requestHash) {
        if (!requestHash.equals(receipt.requestHash())) throw new IdempotencyConflictException();
        try {
            JsonNode response = json.readTree(receipt.responseJson());
            UUID ref = UUID.fromString(response.path("terminalRef").asText());
            long version = response.path("version").asLong(-1);
            String status = response.path("status").asText("");
            if (version < 1 || !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status))
                throw new IllegalArgumentException();
            return new ReceiptValue(ref, version, status);
        } catch (Exception corrupt) {
            throw new ReceiptCorruptException(corrupt);
        }
    }

    private String receiptJson(TerminalMutation mutation) {
        try {
            ObjectNode response = json.createObjectNode()
                    .put("terminalRef", mutation.terminalRef().toString())
                    .put("version", mutation.version())
                    .put("status", mutation.status());
            return json.writeValueAsString(response);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("terminal command receipt cannot be serialized", failure);
        }
    }

    private String requestHash(
            String operation,
            UUID workspaceUuid,
            String groupKey,
            UUID storeRef,
            String name,
            String deviceType,
            String codeModeOrTarget,
            JsonNode configuration,
            UUID terminalRef,
            Long version) {
        ObjectNode canonical = json.createObjectNode()
                .put("operation", operation)
                .put("workspaceUuid", workspaceUuid.toString())
                .put("groupWorkspaceKey", groupKey)
                .put("storeRef", storeRef.toString());
        if (name != null) canonical.put("name", name);
        if (deviceType != null) canonical.put("deviceType", deviceType);
        if (codeModeOrTarget != null) canonical.put("modeOrTarget", codeModeOrTarget);
        if (configuration != null) canonical.set("configuration", canonicalConfiguration(configuration));
        if (terminalRef != null) canonical.put("terminalRef", terminalRef.toString());
        if (version != null) canonical.put("expectedVersion", version);
        try {
            return CommandReceiptSupport.requestHash(json.writeValueAsString(canonical));
        } catch (JsonProcessingException failure) {
            throw new IllegalArgumentException("terminal command is not canonicalizable", failure);
        }
    }

    private JsonNode canonicalConfiguration(JsonNode configuration) {
        JsonNode copy = configuration.deepCopy();
        if (!copy.isObject()) return copy;
        sortArray(copy.path("printers"), "ref", "clientKey");
        sortArray(copy.path("functions"), "ref", "clientKey");
        JsonNode functions = copy.path("functions");
        if (functions.isArray())
            for (JsonNode function : functions) {
                sortArray(function.path("ranges"), "key", null);
                JsonNode ranges = function.path("ranges");
                if (ranges.isArray()) for (JsonNode range : ranges) sortTextArray(range.path("refs"));
                sortArray(function.path("scenes"), "sceneKey", null);
                JsonNode scenes = function.path("scenes");
                if (scenes.isArray())
                    for (JsonNode scene : scenes) {
                        sortTextArray(scene.path("orderTypes"));
                        JsonNode bindings = scene.path("printers");
                        if (bindings.isArray()) {
                            List<JsonNode> sorted = new ArrayList<>();
                            bindings.forEach(sorted::add);
                            sorted.sort(java.util.Comparator.comparing(value -> value.path("printerRef")
                                    .asText(value.path("printerClientKey").asText(""))));
                            ((com.fasterxml.jackson.databind.node.ArrayNode) bindings).removeAll();
                            sorted.forEach(((com.fasterxml.jackson.databind.node.ArrayNode) bindings)::add);
                        }
                    }
            }
        return copy;
    }

    private static void sortArray(JsonNode array, String primary, String fallback) {
        if (!array.isArray()) return;
        List<JsonNode> sorted = new ArrayList<>();
        array.forEach(sorted::add);
        sorted.sort(java.util.Comparator.comparing(value -> value.path(primary)
                .asText(fallback == null ? "" : value.path(fallback).asText(""))));
        ((com.fasterxml.jackson.databind.node.ArrayNode) array).removeAll();
        sorted.forEach(((com.fasterxml.jackson.databind.node.ArrayNode) array)::add);
    }

    private static void sortTextArray(JsonNode array) {
        if (!array.isArray()) return;
        List<String> sorted = stringValues(array);
        sorted.sort(String::compareTo);
        ((com.fasterxml.jackson.databind.node.ArrayNode) array).removeAll();
        sorted.forEach(((com.fasterxml.jackson.databind.node.ArrayNode) array)::add);
    }

    private static Map<String, Set<UUID>> oldRangeRefs(JsonNode oldDocument) {
        Map<String, Set<UUID>> result = new HashMap<>();
        if (oldDocument == null || !oldDocument.path("functions").isArray()) return result;
        for (JsonNode function : oldDocument.path("functions")) {
            UUID functionRef;
            try {
                functionRef = UUID.fromString(function.path("ref").asText());
            } catch (IllegalArgumentException invalid) {
                continue;
            }
            JsonNode ranges = function.path("ranges");
            if (!ranges.isArray()) continue;
            for (JsonNode range : ranges) {
                Set<UUID> refs = new HashSet<>();
                JsonNode values = range.path("refs");
                if (values.isArray())
                    for (JsonNode value : values) {
                        try {
                            refs.add(UUID.fromString(value.asText()));
                        } catch (IllegalArgumentException ignored) {
                            // A corrupt old reference is not an exemption for any requested reference.
                        }
                    }
                result.put(functionRef + ":" + range.path("key").asText(""), Set.copyOf(refs));
            }
        }
        return result;
    }

    private static List<String> stringValues(JsonNode values) {
        List<String> result = new ArrayList<>();
        if (values.isArray()) values.forEach(value -> result.add(value.asText()));
        return result;
    }

    private static String jsonString(Object value) {
        try {
            return new ObjectMapper().writeValueAsString(value);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("audit summary cannot be serialized", failure);
        }
    }

    private StoreContractLookup.StoreContractContext requireStore(UUID workspaceUuid, String groupKey, UUID storeRef) {
        StoreContractLookup.StoreContractContext context =
                stores.requireStoreContractContext(workspaceUuid, groupKey, storeRef);
        if (!"ENABLED".equals(context.storeStatus())) throw new TerminalStoreUnavailableException();
        return context;
    }

    private static void requireWrite(
            OperationsOwnerScopeGrant grant, UUID workspaceUuid, String groupKey, UUID storeRef) {
        if (grant == null || !grant.matchesCapability(workspaceUuid, groupKey, "STORE", storeRef, EDIT_CAPABILITY)) {
            throw new TerminalAuthorizationException();
        }
    }

    private static String requiredName(String value) {
        String normalized =
                Normalizer.normalize(Objects.requireNonNullElse(value, "").trim(), Normalizer.Form.NFC);
        if (normalized.isEmpty() || normalized.codePointCount(0, normalized.length()) > 120)
            throw new InvalidTerminalInputException();
        return normalized;
    }

    private static String normalizeName(String value) {
        return Normalizer.normalize(value.trim(), Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
    }

    private static String requiredText(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.codePointCount(0, normalized.length()) > limit)
            throw new InvalidTerminalInputException();
        return normalized;
    }

    private static String idempotencyKey(String value) {
        String key = Objects.requireNonNullElse(value, "").trim();
        if (key.length() < 16 || key.length() > 128) throw new InvalidTerminalInputException();
        return key;
    }

    private static String status(String value) {
        if (!Set.of("ENABLED", "DISABLED", "VOIDED").contains(value)) throw new InvalidTerminalInputException();
        return value;
    }

    private static boolean validTransition(String from, String to) {
        if (from.equals(to)) return false;
        return "VOIDED".equals(to)
                || ("ENABLED".equals(from) && "DISABLED".equals(to))
                || ("DISABLED".equals(from) && "ENABLED".equals(to));
    }

    private static void validatePageSize(int pageSize) {
        if (pageSize < 1 || pageSize > 100) throw new InvalidTerminalInputException();
    }

    private TerminalDetail detail(TerminalRow row, UUID workspaceUuid, String groupWorkspaceKey) {
        JsonNode configuration = parseConfiguration(row.configurationJson());
        List<UUID> areaRefs = rangeRefs(configuration, StoreTerminalRules.RANGE_TABLE_AREA);
        List<UUID> tagRefs = rangeRefs(configuration, StoreTerminalRules.RANGE_PRODUCTION_TAG);
        List<AreaReference> areas = areaRefs.isEmpty()
                ? List.of()
                : servicePoints.readAreasByRefs(workspaceUuid, groupWorkspaceKey, row.storeRef(), areaRefs).stream()
                        .map(value -> new AreaReference(
                                value.areaRef(), value.name(), value.code(), value.areaType(), value.status()))
                        .toList();
        List<TagReference> tags = tagRefs.isEmpty()
                ? List.of()
                : productionTags
                        .readTagReferencesByRefs(
                                row.storeRef().toString(),
                                catalogScopes.requireCatalogBrand(
                                        workspaceUuid, groupWorkspaceKey, "STORE", row.storeRef(), null),
                                tagRefs,
                                "store-terminal-detail-read")
                        .stream()
                        .map(value -> new TagReference(value.tagRef(), value.name(), value.code(), value.status()))
                        .toList();
        return new TerminalDetail(
                row.terminalRef(),
                row.storeRef(),
                row.name(),
                row.deviceType(),
                row.status(),
                row.version(),
                row.createdAt(),
                row.updatedAt(),
                row.activationCode(),
                configuration,
                areas,
                tags);
    }

    private static List<UUID> rangeRefs(JsonNode document, String key) {
        Set<UUID> refs = new java.util.LinkedHashSet<>();
        if (document == null || document.isNull()) return List.of();
        JsonNode functions = document.path("functions");
        if (!functions.isArray()) return List.of();
        for (JsonNode function : functions) {
            JsonNode ranges = function.path("ranges");
            if (!ranges.isArray()) continue;
            for (JsonNode range : ranges) {
                if (!key.equals(range.path("key").asText())) continue;
                JsonNode values = range.path("refs");
                if (!values.isArray()) continue;
                for (JsonNode value : values) {
                    try {
                        refs.add(UUID.fromString(value.asText()));
                    } catch (IllegalArgumentException invalid) {
                        throw new IllegalStateException("stored terminal reference is corrupt", invalid);
                    }
                }
            }
        }
        return List.copyOf(refs);
    }

    private JsonNode parseConfiguration(String value) {
        try {
            JsonNode node = json.readTree(value);
            if (node == null || !node.isObject()) throw new IllegalArgumentException();
            return node;
        } catch (Exception invalid) {
            throw new IllegalStateException("stored terminal configuration is corrupt", invalid);
        }
    }

    private static String requiredString(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isTextual() || value.textValue().isBlank())
            throw new IllegalStateException("owner read value is incomplete");
        return value.textValue();
    }

    private static void addIfChanged(List<AuditChange> changes, String field, String before, String after) {
        if (!Objects.equals(before, after)) changes.add(AuditChange.forNullableScalar(field, before, after));
    }

    private record ReferenceFacts(
            Map<UUID, StoreServicePointOwnerApi.AreaReference> areas,
            Map<UUID, CatalogProductionTagOwnerApi.ProductionTagReferenceReadback> tags) {
        private ReferenceFacts {
            areas = Map.copyOf(areas);
            tags = Map.copyOf(tags);
        }
    }

    private record ReceiptValue(UUID terminalRef, long version, String status) {
        private TerminalMutation mutation() {
            return new TerminalMutation(terminalRef, version, status);
        }
    }

    public static class TerminalNotFoundException extends RuntimeException {}

    public static class TerminalAuthorizationException extends RuntimeException {}

    public static class TerminalStoreUnavailableException extends RuntimeException {}

    public static class TerminalNameConflictException extends RuntimeException {
        public TerminalNameConflictException() {}

        public TerminalNameConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static class ActivationCodeConflictException extends RuntimeException {}

    public static class ActivationCodeExhaustedException extends RuntimeException {}

    public static class TerminalVersionConflictException extends RuntimeException {}

    public static class TerminalVoidedImmutableException extends RuntimeException {}

    public static class TerminalStatusTransitionInvalidException extends RuntimeException {}

    public static class TerminalReferenceInvalidException extends RuntimeException {}

    public static class IdempotencyConflictException extends RuntimeException {}

    public static class ReceiptCorruptException extends RuntimeException {
        public ReceiptCorruptException(Throwable cause) {
            super(cause);
        }
    }

    public static class InvalidTerminalRequestException extends RuntimeException {
        public InvalidTerminalRequestException() {}

        public InvalidTerminalRequestException(Throwable cause) {
            super(cause);
        }
    }

    public static class InvalidTerminalInputException extends RuntimeException {
        public InvalidTerminalInputException() {}

        public InvalidTerminalInputException(Throwable cause) {
            super(cause);
        }
    }
}
