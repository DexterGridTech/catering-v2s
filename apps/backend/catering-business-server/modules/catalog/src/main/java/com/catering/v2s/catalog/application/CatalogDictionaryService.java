package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.application.persistence.CatalogDictionaryPersistence;
import com.catering.v2s.catalog.application.persistence.CatalogDictionaryPersistence.DictionaryListingRow;
import com.catering.v2s.catalog.application.persistence.CatalogDictionaryPersistence.DictionaryRow;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner of catalog dictionary facts, ordering, lifecycle, receipts, and authoritative readback. */
@Service
public class CatalogDictionaryService {
    private final CatalogDictionaryPersistence persistence;
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;
    private final CatalogItemReferenceFacts itemReferenceFacts;

    @Autowired
    public CatalogDictionaryService(
            CatalogDictionaryPersistence persistence, JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this(persistence, mapper, time, new CatalogItemReferenceFacts(jdbc, mapper));
    }

    public CatalogDictionaryService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this(jdbc, mapper, time, new CatalogItemReferenceFacts(jdbc, mapper));
    }

    CatalogDictionaryService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogItemReferenceFacts itemReferenceFacts) {
        this(new CatalogDictionaryPersistence(jdbc, time), mapper, time, itemReferenceFacts);
    }

    CatalogDictionaryService(
            CatalogDictionaryPersistence persistence,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogItemReferenceFacts itemReferenceFacts) {
        this.persistence = persistence;
        this.mapper = mapper;
        this.copyLimits = CopyLimitPolicy.load(mapper);
        this.time = time;
        this.itemReferenceFacts = itemReferenceFacts;
    }

    public JsonNode readDictionary(
            String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        return dictionary(dataNodeRef, brandRef, requestId, dictionaryKind, request);
    }

    @Transactional
    public CatalogOwnerApi.DictionaryCommandReadback createDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryCreateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "createOperationsCatalogDictionaryEntry");
        ObjectNode request =
                dictionaryRequest(command.dictionaryKind(), "code", command.code(), null, command.name(), null);
        putNullableUuid(request, "parentEntryRef", command.parentEntryRef());
        return dictionaryCommandReadback(executeDictionaryWrite(
                context,
                "createOperationsCatalogDictionaryEntry",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey));
    }

    @Transactional
    public CatalogOwnerApi.DictionaryCommandReadback updateDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryUpdateCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "updateOperationsCatalogDictionaryEntry");
        return dictionaryCommandReadback(executeDictionaryWrite(
                context,
                "updateOperationsCatalogDictionaryEntry",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                dictionaryRequest(
                        command.dictionaryKind(),
                        "entryCode",
                        command.entryCode(),
                        command.expectedVersion(),
                        command.name(),
                        null),
                context.requestId(),
                idempotencyKey));
    }

    @Transactional
    public CatalogOwnerApi.DictionaryViewReadback reorderDictionaryEntries(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryReorderCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "reorderOperationsCatalogDictionaryEntry");
        ObjectNode request = mapper.createObjectNode().put("dictionaryKind", command.dictionaryKind());
        ArrayNode codes = request.putArray("orderedCodes");
        command.orderedCodes().forEach(codes::add);
        return dictionaryViewReadback(executeDictionaryWrite(
                context,
                "reorderOperationsCatalogDictionaryEntry",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey));
    }

    @Transactional
    public CatalogOwnerApi.DictionaryCommandReadback transitionDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogOwnerApi.DictionaryEntryTransitionCommand command,
            String idempotencyKey) {
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(
                context, "transitionOperationsCatalogDictionaryEntryStatus");
        return dictionaryCommandReadback(executeDictionaryWrite(
                context,
                "transitionOperationsCatalogDictionaryEntryStatus",
                scope.dataNodeId().toString(),
                scope.brandRef(),
                dictionaryRequest(
                        command.dictionaryKind(),
                        "entryCode",
                        command.entryCode(),
                        command.expectedVersion(),
                        null,
                        command.targetStatus()),
                context.requestId(),
                idempotencyKey));
    }

    JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            ObjectNode request,
            String idempotencyKey) {
        String operationId = context.operationToken().operationId();
        CatalogAuthorizationScope scope = CatalogOwnerScopeSupport.typedCommandScope(context, operationId);
        return executeDictionaryWrite(
                context,
                operationId,
                scope.dataNodeId().toString(),
                scope.brandRef(),
                request,
                context.requestId(),
                idempotencyKey);
    }

    private JsonNode executeDictionaryWrite(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey) {
        CatalogOwnerScopeSupport.requireScope(dataNodeRef, brandRef);
        String receiptKey = idempotencyKey == null ? "" : idempotencyKey.trim();
        recheckWriteFactsBeforeReceipt(operationId, dataNodeRef, brandRef, request);

        ObjectNode receiptRequest = receiptRequest(request, brandRef);
        if (!receiptKey.isEmpty()) {
            JsonNode replay = replay(dataNodeRef, receiptKey, operationId, receiptRequest);
            if (replay != null) return replay;
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            JsonNode result = switch (operationId) {
                case "createOperationsCatalogDictionaryEntry" -> createDictionary(
                        dataNodeRef, brandRef, requestId, request);
                case "updateOperationsCatalogDictionaryEntry" -> updateDictionary(
                        dataNodeRef, brandRef, requestId, request);
                case "reorderOperationsCatalogDictionaryEntry" -> reorderDictionary(
                        dataNodeRef, brandRef, requestId, request);
                case "transitionOperationsCatalogDictionaryEntryStatus" -> transitionDictionary(
                        commandContext, dataNodeRef, brandRef, requestId, request);
                default -> throw new CatalogOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "catalog dictionary write operation is not registered");
            };
            if (!receiptKey.isEmpty()) saveReceipt(dataNodeRef, receiptKey, operationId, receiptRequest, result);
            return result;
        }
    }

    private void recheckWriteFactsBeforeReceipt(
            String operationId, String scope, String brand, ObjectNode request) {
        switch (operationId) {
            case "updateOperationsCatalogDictionaryEntry", "transitionOperationsCatalogDictionaryEntryStatus" -> {
                String kind = requiredDictionaryKind(request);
                String code = required(request, "entryCode");
                Long version = persistence.readVersion(scope, brand, kind, code);
                long expected = requiredLong(request, "expectedVersion", -1);
                if (version == null || (expected >= 0 && version != expected && version != expected + 1L)) {
                    throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "字典版本已变化");
                }
            }
            case "reorderOperationsCatalogDictionaryEntry" -> dictionaryGeneration(
                    scope, brand, requiredDictionaryKind(request));
            case "createOperationsCatalogDictionaryEntry" -> generation(scope, brand);
            default -> throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "catalog dictionary write operation is not registered");
        }
    }

    private ObjectNode dictionary(
            String dataNodeRef, String brandRef, String requestId, String kind, ObjectNode request) {
        ObjectNode data = mapper.createObjectNode().put("dictionaryKind", kind);
        ArrayNode entries = data.putArray("entries");
        UUID parentEntryRef = optionalUuid(request, "parentEntryRef");
        if (parentEntryRef != null && !"SKU_ATTRIBUTE_VALUE".equals(kind)) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "parentEntryRef 仅适用于 SKU_ATTRIBUTE_VALUE");
        }
        String query = optional(request, "query");
        query = query == null ? "" : query.trim();
        String status = optional(request, "status");
        if (status != null && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典状态筛选不合法");
        int pageSize = parsePageSize(request, "pageSize", 20);
        String queryIdentity = cursorIdentity(
                "dictionary",
                dataNodeRef,
                brandRef,
                kind,
                parentEntryRef == null ? null : parentEntryRef.toString(),
                query,
                status,
                Integer.toString(pageSize));
        OpaqueCollectionCursor.Position cursor = decodeCollectionCursor(request, queryIdentity);
        DictionaryListing listing = loadDictionaryListing(
                dataNodeRef, brandRef, kind, parentEntryRef, query, status, cursor, pageSize, queryIdentity);
        DictionaryReferenceSnapshot references =
                dictionaryReferenceSnapshot(dataNodeRef, brandRef, kind, listing.entryRefs());
        for (DictionaryEntryRow row : listing.entries()) {
            String entryRef = row.entryRef().toString();
            boolean referenced = references.isReferenced(row.entryRef());
            ObjectNode entry = entries.addObject()
                    .put("entryRef", entryRef)
                    .put("code", row.code())
                    .put("name", row.name())
                    .put("status", row.status())
                    .put("ownerType", "DATA_NODE")
                    .put("ownerRef", dataNodeRef)
                    .put("brandRef", brandRef)
                    .put("version", row.version())
                    .put("updatedAt", row.updatedAt());
            putNullableUuid(entry, "parentEntryRef", row.parentEntryRef());
            ObjectNode voidAvailability = entry.putObject("voidAvailability");
            voidAvailability.put("canVoid", !"VOIDED".equals(row.status()) && !referenced);
            ArrayNode blocking = voidAvailability.putArray("blockingReferences");
            if (referenced) blocking.addObject().put("referenceKind", "CATALOG_ITEM").put("referenceRef", entryRef);
            voidAvailability.putArray("dependentFacts");
        }
        data.put("total", listing.total()).put("generation", listing.generation());
        if (listing.cursor() == null) data.putNull("cursor");
        else data.put("cursor", listing.cursor());
        return envelope(requestId, data);
    }

    private ObjectNode createDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String kind = requiredDictionaryKind(request),
                code = required(request, "code"),
                name = required(request, "name");
        UUID parentEntryRef = optionalUuid(request, "parentEntryRef");
        validateDictionaryParent(dataNodeRef, brandRef, kind, parentEntryRef);
        int displayOrder = nextDictionaryDisplayOrder(dataNodeRef, brandRef, kind);
        UUID entryRef = UUID.randomUUID();
        try {
            persistence.insertEntry(
                    entryRef, dataNodeRef, brandRef, kind, code, name, parentEntryRef, displayOrder, now());
        } catch (DuplicateKeyException ex) {
            throw new CatalogOwnerApi.Problem("DUPLICATE_CODE", 409, "字典编码已存在", ex);
        }
        return dictionaryCommand(requestId, entryRef, kind, code, name, "ENABLED", parentEntryRef, 1L);
    }

    private ObjectNode updateDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String kind = requiredDictionaryKind(request),
                code = required(request, "entryCode"),
                name = required(request, "name");
        long expected = requiredLong(request, "expectedVersion", 1);
        if (persistence.updateEntry(dataNodeRef, brandRef, kind, code, name, expected, now())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "字典版本已变化");
        return dictionaryCommand(
                requestId,
                dictionaryEntryRef(dataNodeRef, brandRef, kind, code),
                kind,
                code,
                name,
                dictionaryStatus(dataNodeRef, brandRef, kind, code),
                dictionaryParentRef(dataNodeRef, brandRef, kind, code),
                expected + 1);
    }

    private ObjectNode reorderDictionary(String dataNodeRef, String brandRef, String requestId, ObjectNode request) {
        String kind = requiredDictionaryKind(request);
        JsonNode codes = request.get("orderedCodes");
        if (codes == null || !codes.isArray())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "orderedCodes 必须为数组");

        List<DictionaryRow> locked = lockDictionaryEntriesForReorder(dataNodeRef, brandRef, kind);
        List<DictionaryRow> current = locked.stream()
                .sorted(java.util.Comparator.comparingInt(DictionaryRow::displayOrder)
                        .thenComparing(DictionaryRow::code))
                .toList();
        List<String> orderedCodes = dictionaryOrderCodes(codes);
        validateDictionaryOrder(current, orderedCodes);

        long updatedAt = now();
        for (int index = 0; index < current.size(); index++) {
            persistence.reorderEntry(
                    dataNodeRef, brandRef, kind, orderedCodes.get(index), index, updatedAt);
        }
        return dictionary(dataNodeRef, brandRef, requestId, kind, request);
    }

    private ObjectNode transitionDictionary(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String requestId,
            ObjectNode request) {
        String kind = requiredDictionaryKind(request),
                code = required(request, "entryCode"),
                status = required(request, "targetStatus");
        long expected = requiredLong(request, "expectedVersion", 1);
        if (!CatalogInventoryShapeManifest.accepts("dictionaryEntryStatus", status))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典状态不合法");
        if ("VOIDED".equals(status)) {
            if (dictionaryReferenced(dataNodeRef, brandRef, kind, code)) {
                throw new CatalogOwnerApi.Problem("REFERENCE_BLOCKS_VOID", 422, "字典条目仍被商品引用，不能作废");
            }
            requireInventoryDictionaryReferenceUnreferenced(commandContext, dataNodeRef, brandRef, kind, code);
        }
        if (persistence.transitionStatus(dataNodeRef, brandRef, kind, code, status, expected, now())
                != 1) throw new CatalogOwnerApi.Problem("VERSION_CONFLICT", 409, "字典版本已变化");
        return dictionaryCommand(
                requestId,
                dictionaryEntryRef(dataNodeRef, brandRef, kind, code),
                kind,
                code,
                dictionaryName(dataNodeRef, brandRef, kind, code),
                status,
                dictionaryParentRef(dataNodeRef, brandRef, kind, code),
                expected + 1);
    }

    /** The current Inventory dependency probe is intentionally a no-op after the retired reference type was removed. */
    private void requireInventoryDictionaryReferenceUnreferenced(
            WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext,
            String dataNodeRef,
            String brandRef,
            String kind,
            String code) {}

    private DictionaryListing loadDictionaryListing(
            String scope,
            String brand,
            String kind,
            UUID parentEntryRef,
            String query,
            String status,
            OpaqueCollectionCursor.Position cursor,
            int pageSize,
            String queryIdentity) {
        Integer cursorDisplayOrder = null;
        UUID cursorTieBreaker = null;
        if (cursor != null) {
            try {
                cursorDisplayOrder = Integer.parseInt(cursor.sortKey());
            } catch (NumberFormatException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典游标无效", failure);
            }
            cursorTieBreaker = cursor.tieBreaker();
        }
        List<DictionaryListingRow> rows = persistence.loadListing(
                scope,
                brand,
                kind,
                parentEntryRef,
                query,
                status,
                cursorDisplayOrder,
                cursorTieBreaker,
                pageSize);
        long generation = rows.isEmpty() ? 0L : rows.get(0).generation();
        long total = rows.isEmpty() ? 0L : rows.get(0).total();
        List<DictionaryListingRow> presentRows = rows.stream().filter(row -> row.entryRef() != null).toList();
        boolean hasNext = presentRows.size() > pageSize;
        if (hasNext) presentRows = presentRows.subList(0, pageSize);
        List<DictionaryEntryRow> entries = presentRows.stream()
                .map(row -> new DictionaryEntryRow(
                        row.entryRef(),
                        row.code(),
                        row.name(),
                        row.status(),
                        row.parentEntryRef(),
                        row.version(),
                        row.updatedAt()))
                .toList();
        String nextCursor = null;
        if (hasNext) {
            DictionaryListingRow last = presentRows.get(presentRows.size() - 1);
            nextCursor = OpaqueCollectionCursor.encode(
                    queryIdentity, Integer.toString(last.displayOrder()), last.entryRef());
        }
        return new DictionaryListing(entries, generation, total, nextCursor);
    }

    private List<DictionaryRow> lockDictionaryEntriesForReorder(String scope, String brand, String kind) {
        return persistence.lockEntriesForReorder(scope, brand, kind);
    }

    private int nextDictionaryDisplayOrder(String scope, String brand, String kind) {
        return persistence.nextDisplayOrder(scope, brand, kind);
    }

    private static List<String> dictionaryOrderCodes(JsonNode codes) {
        List<String> orderedCodes = new ArrayList<>();
        for (JsonNode code : codes) {
            if (!code.isTextual() || code.asText().isBlank())
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "orderedCodes 必须只包含非空编码");
            orderedCodes.add(code.asText());
        }
        return List.copyOf(orderedCodes);
    }

    private static void validateDictionaryOrder(List<DictionaryRow> current, List<String> orderedCodes) {
        if (orderedCodes.size() != current.size())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "orderedCodes 必须完整覆盖当前字典且不能重复");
        Set<String> currentCodes = current.stream().map(DictionaryRow::code).collect(java.util.stream.Collectors.toSet());
        Set<String> submittedCodes = new java.util.HashSet<>(orderedCodes);
        if (submittedCodes.size() != orderedCodes.size() || !currentCodes.equals(submittedCodes))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "orderedCodes 必须完整覆盖当前字典且不能重复");
    }

    private DictionaryReferenceSnapshot dictionaryReferenceSnapshot(
            String scope, String brand, String kind, List<UUID> entryRefs) {
        if (entryRefs.isEmpty()) return new DictionaryReferenceSnapshot(Set.of());
        Set<UUID> referenced = new LinkedHashSet<>();
        referenced.addAll(itemReferenceFacts.referencedRefs(scope, brand, CatalogOwnerValueSupport.dictionaryObjectType(kind), entryRefs));
        referenced.addAll(relationalSkuDictionaryReferences(scope, brand, kind, entryRefs));
        return new DictionaryReferenceSnapshot(referenced);
    }

    private Set<UUID> relationalSkuDictionaryReferences(String scope, String brand, String kind, List<UUID> entryRefs) {
        return persistence.relationalSkuReferences(scope, brand, kind, entryRefs);
    }

    private boolean dictionaryReferenced(String scope, String brand, String kind, String entryCode) {
        UUID entryRef = dictionaryEntryRef(scope, brand, kind, entryCode);
        return entryRef != null && dictionaryReferenceSnapshot(scope, brand, kind, List.of(entryRef)).isReferenced(entryRef);
    }

    private void validateDictionaryParent(String scope, String brand, String kind, UUID parentEntryRef) {
        boolean requiresParent = "SKU_ATTRIBUTE_VALUE".equals(kind);
        if (requiresParent != (parentEntryRef != null)) {
            throw new CatalogOwnerApi.Problem(
                    "VALIDATION_ERROR", 422, "SKU_ATTRIBUTE_VALUE 必须带 parentEntryRef，其他字典类型不得带父属性");
        }
        if (parentEntryRef == null) return;
        if (!persistence.validParent(parentEntryRef.toString(), scope, brand))
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "parentEntryRef 必须是当前 scope 的 SKU_ATTRIBUTE");
    }

    private String dictionaryName(String scope, String brand, String kind, String code) {
        return persistence.readName(scope, brand, kind, code);
    }

    private String dictionaryStatus(String scope, String brand, String kind, String code) {
        return persistence.readStatus(scope, brand, kind, code);
    }

    private UUID dictionaryParentRef(String scope, String brand, String kind, String code) {
        return persistence.readParentRef(scope, brand, kind, code);
    }

    private UUID dictionaryEntryRef(String scope, String brand, String kind, String code) {
        return persistence.readEntryRef(scope, brand, kind, code);
    }

    private ObjectNode dictionaryCommand(
            String requestId,
            UUID entryRef,
            String kind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version) {
        ObjectNode node = mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId);
        ObjectNode result = node.putObject("result")
                .put("entryRef", entryRef.toString())
                .put("dictionaryKind", kind)
                .put("code", code)
                .put("name", name)
                .put("status", status)
                .put("version", version);
        putNullableUuid(result, "parentEntryRef", parentEntryRef);
        node.put("version", version);
        return node;
    }

    private CatalogOwnerApi.DictionaryCommandReadback dictionaryCommandReadback(JsonNode response) {
        JsonNode result = response.path("result");
        return new CatalogOwnerApi.DictionaryCommandReadback(
                nullableUuid(result, "entryRef"),
                result.path("dictionaryKind").asText(),
                result.path("code").asText(),
                result.path("name").asText(),
                result.path("status").asText(),
                nullableUuid(result, "parentEntryRef"),
                result.path("version").asLong());
    }

    private CatalogOwnerApi.DictionaryViewReadback dictionaryViewReadback(JsonNode response) {
        JsonNode data = response.path("data");
        List<CatalogOwnerApi.DictionaryEntryView> entries = new ArrayList<>();
        for (JsonNode entry : data.path("entries")) {
            JsonNode availability = entry.path("voidAvailability");
            List<CatalogOwnerApi.DictionaryBlockingReference> blocking = new ArrayList<>();
            for (JsonNode reference : availability.path("blockingReferences")) {
                blocking.add(new CatalogOwnerApi.DictionaryBlockingReference(
                        reference.path("referenceKind").asText(), reference.path("referenceRef").asText()));
            }
            List<CatalogOwnerApi.DictionaryDependentFact> dependencies = new ArrayList<>();
            for (JsonNode dependency : availability.path("dependentFacts")) {
                dependencies.add(new CatalogOwnerApi.DictionaryDependentFact(
                        dependency.path("factKind").asText(), dependency.path("factRef").asText()));
            }
            entries.add(new CatalogOwnerApi.DictionaryEntryView(
                    entry.path("entryRef").asText(),
                    entry.path("code").asText(),
                    entry.path("name").asText(),
                    entry.path("status").asText(),
                    nullableUuid(entry, "parentEntryRef"),
                    entry.path("ownerType").asText(),
                    entry.path("ownerRef").asText(),
                    entry.path("brandRef").asText(),
                    entry.path("version").asLong(),
                    entry.path("updatedAt").asLong(),
                    new CatalogOwnerApi.DictionaryVoidAvailability(
                            availability.path("canVoid").asBoolean(),
                            List.copyOf(blocking),
                            List.copyOf(dependencies))));
        }
        return new CatalogOwnerApi.DictionaryViewReadback(
                data.path("dictionaryKind").asText(),
                List.copyOf(entries),
                data.path("cursor").isNull() ? null : data.path("cursor").asText(),
                data.path("total").asLong(),
                data.path("generation").asText());
    }

    private ObjectNode dictionaryRequest(
            String dictionaryKind,
            String codeField,
            String code,
            Long expectedVersion,
            String name,
            String targetStatus) {
        ObjectNode request = mapper.createObjectNode().put("dictionaryKind", dictionaryKind).put(codeField, code);
        if (expectedVersion != null) request.put("expectedVersion", expectedVersion);
        if (name != null) request.put("name", name);
        if (targetStatus != null) request.put("targetStatus", targetStatus);
        return request;
    }

    private String requiredDictionaryKind(ObjectNode request) {
        String kind = required(request, "dictionaryKind");
        if (!copyLimits.allowsDictionaryKind(kind))
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "dictionaryKind is not supported");
        return kind;
    }

    private static String required(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank())
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        return value;
    }

    private static String optional(ObjectNode request, String key) {
        JsonNode value = request == null ? null : request.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static UUID optionalUuid(ObjectNode request, String key) {
        String value = optional(request, key);
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be an opaque UUID ref", failure);
        }
    }

    private static long requiredLong(ObjectNode request, String key, long fallback) {
        JsonNode value = request.get(key);
        if (value == null || !value.isIntegralNumber()) return fallback;
        return value.asLong();
    }

    private static void putNullableUuid(ObjectNode target, String field, UUID value) {
        if (value == null) target.putNull(field);
        else target.put(field, value.toString());
    }

    private static UUID nullableUuid(JsonNode object, String field) {
        JsonNode value = object == null ? null : object.get(field);
        return value == null || value.isNull() || value.asText().isBlank() ? null : UUID.fromString(value.asText());
    }

    private static int parsePageSize(ObjectNode request, String key, int fallback) {
        JsonNode value = request == null ? null : request.get(key);
        if (value == null || value.isNull() || value.asText().isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(value.asText());
            if (parsed < 1 || parsed > 100) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException ex) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be between 1 and 100", ex);
        }
    }

    private static OpaqueCollectionCursor.Position decodeCollectionCursor(ObjectNode request, String queryIdentity) {
        try {
            return OpaqueCollectionCursor.decode(optional(request, "cursor"), queryIdentity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
    }

    private static String cursorIdentity(String operationId, String... parts) {
        StringBuilder identity = new StringBuilder(operationId);
        for (String part : parts) {
            String value = part == null ? "" : part;
            identity.append('|').append(value.length()).append(':').append(value);
        }
        return identity.toString();
    }

    private long generation(String dataNodeRef, String brandRef) {
        return persistence.generation(dataNodeRef, brandRef);
    }

    private long dictionaryGeneration(String dataNodeRef, String brandRef, String kind) {
        return persistence.generation(dataNodeRef, brandRef, kind);
    }

    private ObjectNode envelope(String requestId, JsonNode data) {
        return mapper.createObjectNode()
                .put("revision", CatalogOwnerTypes.REVISION)
                .put("requestId", requestId)
                .set("data", data);
    }

    private ObjectNode receiptRequest(ObjectNode request, String brandRef) {
        ObjectNode scoped = request.deepCopy();
        scoped.put("receiptBrandRef", brandRef);
        return scoped;
    }

    private JsonNode replay(String dataNodeRef, String key, String operationId, ObjectNode request) {
        persistence.lockReceipt(dataNodeRef, key);
        List<CatalogDictionaryPersistence.ReceiptRow> rows = persistence.readReceipt(dataNodeRef, key);
        if (rows.isEmpty()) return null;
        CatalogDictionaryPersistence.ReceiptRow receipt = rows.get(0);
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request)))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return json(receipt.responseJson());
    }

    private void saveReceipt(String scope, String key, String operationId, ObjectNode request, JsonNode response) {
        persistence.saveReceipt(scope, key, operationId, hash(request), canonicalJson(response), now());
    }

    private String hash(JsonNode value) {
        try {
            return Sha256Hex.digest(canonicalJson(value));
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    private String canonicalJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value == null ? mapper.createObjectNode() : value);
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "JSON payload is invalid", failure);
        }
    }

    private JsonNode json(String value) {
        if (value == null || value.isBlank())
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is missing");
        try {
            JsonNode parsed = mapper.readTree(value);
            if (parsed == null || parsed.isNull())
                throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is missing");
            return parsed;
        } catch (CatalogOwnerApi.Problem problem) {
            throw problem;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog JSON fact is invalid", failure);
        }
    }

    private long now() {
        return time.currentEpochMillis();
    }

    private record DictionaryEntryRow(
            UUID entryRef,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version,
            long updatedAt) {}

    private record DictionaryListing(List<DictionaryEntryRow> entries, long generation, long total, String cursor) {
        List<UUID> entryRefs() {
            return entries.stream().map(DictionaryEntryRow::entryRef).toList();
        }
    }

    private record DictionaryReferenceSnapshot(Set<UUID> referencedEntryRefs) {
        boolean isReferenced(UUID entryRef) {
            return referencedEntryRefs.contains(entryRef);
        }
    }
}
