package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.api.CatalogOwnerTypes;
import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryShapeManifest;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
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
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final CopyLimitPolicy copyLimits;
    private final TimeProvider time;
    private final CatalogItemReferenceFacts itemReferenceFacts;

    @Autowired
    public CatalogDictionaryService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this(jdbc, mapper, time, new CatalogItemReferenceFacts(jdbc, mapper));
    }

    CatalogDictionaryService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            TimeProvider time,
            CatalogItemReferenceFacts itemReferenceFacts) {
        this.jdbc = jdbc;
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
                Long version = jdbc.queryForObject(
                        "SELECT version FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                                + "dictionary_kind=? AND code=?",
                        Long.class,
                        scope,
                        brand,
                        kind,
                        code);
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
            jdbc.update(
                    "INSERT INTO catalog.dictionary_entry "
                            + "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,parent_entry_ref,display_or"
                            + "der,created_at_epoch_millis,updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    entryRef,
                    dataNodeRef,
                    brandRef,
                    kind,
                    code,
                    name,
                    parentEntryRef,
                    displayOrder,
                    now(),
                    now());
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
        if (jdbc.update(
                        "UPDATE catalog.dictionary_entry SET name=?,version=version+1,updated_at_epoch_millis=? WHERE "
                                + "data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND version=? AND "
                                + "status <> 'VOIDED'",
                        name,
                        now(),
                        dataNodeRef,
                        brandRef,
                        kind,
                        code,
                        expected)
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
            jdbc.update(
                    "UPDATE catalog.dictionary_entry SET display_order=?,version=version+1,updated_at_epoch_millis=? "
                            + "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=?",
                    index,
                    updatedAt,
                    dataNodeRef,
                    brandRef,
                    kind,
                    orderedCodes.get(index));
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
        if (jdbc.update(
                        "UPDATE catalog.dictionary_entry SET status=?,version=version+1,updated_at_epoch_millis=? "
                                + "WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? AND code=? AND "
                                + "version=? AND status <> 'VOIDED'",
                        status,
                        now(),
                        dataNodeRef,
                        brandRef,
                        kind,
                        code,
                        expected)
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
        String cursorPredicate =
                cursor == null ? "" : " WHERE display_order > ? OR (display_order = ? AND entry_ref > ?)";
        String sql = "WITH matching AS (SELECT entry_ref,code,name,status,parent_entry_ref,display_order,version,"
                + "updated_at_epoch_millis FROM catalog.dictionary_entry WHERE data_node_ref=? "
                + "AND brand_ref=? AND dictionary_kind=? AND "
                + "(?::uuid IS NULL OR parent_entry_ref=?) "
                + "AND (? = '' OR (code || chr(1) || name) ILIKE '%' || ? || '%') "
                + "AND (?::text IS NULL OR status=?)), "
                + "aggregate AS (SELECT COUNT(*) AS total, COALESCE(MAX(version),0) AS "
                + "generation FROM matching), "
                + "paged AS (SELECT entry_ref,code,name,status,parent_entry_ref,display_order,version,"
                + "updated_at_epoch_millis FROM matching"
                + cursorPredicate
                + " ORDER BY display_order, entry_ref LIMIT ?) "
                + "SELECT p.entry_ref,p.code,p.name,p.status,p.parent_entry_ref,p.display_order,p.version,"
                + "p.updated_at_epoch_millis,"
                + "a.total,a.generation FROM aggregate a LEFT JOIN paged p ON TRUE ORDER BY p.display_order NULLS LAST,"
                + "p.entry_ref";
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.add(kind);
        arguments.add(parentEntryRef);
        arguments.add(parentEntryRef);
        arguments.add(query);
        arguments.add(query);
        arguments.add(status);
        arguments.add(status);
        if (cursor != null) {
            int displayOrder;
            try {
                displayOrder = Integer.parseInt(cursor.sortKey());
            } catch (NumberFormatException failure) {
                throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "字典游标无效", failure);
            }
            arguments.add(displayOrder);
            arguments.add(displayOrder);
            arguments.add(cursor.tieBreaker());
        }
        arguments.add(pageSize + 1);
        List<DictionaryListingRow> rows = jdbc.query(
                sql,
                (result, index) -> new DictionaryListingRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getObject(5, UUID.class),
                        result.getInt(6),
                        result.getLong(7),
                        result.getLong(8),
                        result.getLong(9),
                        result.getLong(10)),
                arguments.toArray());
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
        return jdbc.query(
                "SELECT entry_ref,dictionary_kind,code,name,status,parent_entry_ref,display_order,version FROM "
                        + "catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? ORDER "
                        + "BY entry_ref FOR UPDATE",
                (result, index) -> new DictionaryRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getString(5),
                        result.getObject(6, UUID.class),
                        result.getInt(7),
                        result.getLong(8)),
                scope,
                brand,
                kind);
    }

    private int nextDictionaryDisplayOrder(String scope, String brand, String kind) {
        Integer value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(display_order), -1) + 1 FROM catalog.dictionary_entry WHERE data_node_ref=? AND "
                        + "brand_ref=? AND dictionary_kind=?",
                Integer.class,
                scope,
                brand,
                kind);
        return value == null ? 0 : value;
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
        if (!Set.of("SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE").contains(kind) || entryRefs.isEmpty()) return Set.of();
        String placeholders = String.join(",", Collections.nCopies(entryRefs.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(entryRefs);
        String column = "SKU_ATTRIBUTE".equals(kind) ? "relation.attribute_ref" : "relation.attribute_value_ref";
        return Set.copyOf(jdbc.query(
                "SELECT DISTINCT "
                        + column
                        + " FROM catalog.catalog_sku_attribute_value relation JOIN catalog.catalog_sku sku ON "
                        + "sku.product_sku_ref=relation.product_sku_ref JOIN catalog.catalog_item item ON "
                        + "item.item_ref=sku.item_ref WHERE item.data_node_ref=? AND item.brand_ref=? AND "
                        + "item.status <> 'VOIDED' AND "
                        + column
                        + " IN ("
                        + placeholders
                        + ")",
                (result, row) -> result.getObject(1, UUID.class),
                args.toArray()));
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
        Boolean valid = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM catalog.dictionary_entry WHERE entry_ref=? AND data_node_ref=? AND "
                        + "brand_ref=? AND dictionary_kind='SKU_ATTRIBUTE')",
                Boolean.class,
                parentEntryRef,
                scope,
                brand);
        if (!Boolean.TRUE.equals(valid))
            throw new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "parentEntryRef 必须是当前 scope 的 SKU_ATTRIBUTE");
    }

    private String dictionaryName(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT name FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND dictionary_kind=? "
                        + "AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "字典条目不存在");
                    return result.getString(1);
                });
    }

    private String dictionaryStatus(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT status FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "字典条目不存在");
                    return result.getString(1);
                });
    }

    private UUID dictionaryParentRef(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT parent_entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    private UUID dictionaryEntryRef(String scope, String brand, String kind, String code) {
        return jdbc.query(
                "SELECT entry_ref FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? AND "
                        + "dictionary_kind=? AND code=?",
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "字典条目不存在");
                    return result.getObject(1, UUID.class);
                });
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
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM catalog.catalog_item WHERE data_node_ref=? AND brand_ref=?",
                Long.class,
                dataNodeRef,
                brandRef);
        return value == null ? 0 : value;
    }

    private long dictionaryGeneration(String dataNodeRef, String brandRef, String kind) {
        Long value = jdbc.queryForObject(
                "SELECT COALESCE(MAX(version),0) FROM catalog.dictionary_entry WHERE data_node_ref=? AND brand_ref=? "
                        + "AND dictionary_kind=?",
                Long.class,
                dataNodeRef,
                brandRef,
                kind);
        return value == null ? 0 : value;
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
        AdvisoryLock.acquire(jdbc, "catalog-receipt", dataNodeRef, key);
        List<Receipt> rows = jdbc.query(
                "SELECT operation_id,request_hash,response::text FROM catalog.command_receipt WHERE data_node_ref=? "
                        + "AND idempotency_key=?",
                (result, row) -> new Receipt(result.getString(1), result.getString(2), json(result.getString(3))),
                dataNodeRef,
                key);
        if (rows.isEmpty()) return null;
        Receipt receipt = rows.get(0);
        if (!receipt.operationId().equals(operationId) || !receipt.requestHash().equals(hash(request)))
            throw new CatalogOwnerApi.Problem("IDEMPOTENCY_MISMATCH", 409, "幂等键已绑定其他请求");
        return receipt.response();
    }

    private void saveReceipt(String scope, String key, String operationId, ObjectNode request, JsonNode response) {
        jdbc.update(
                "INSERT INTO catalog.command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_id,request_hash,"
                        + "response,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)",
                UUID.randomUUID(),
                scope,
                key,
                operationId,
                hash(request),
                canonicalJson(response),
                now());
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

    private record Receipt(String operationId, String requestHash, JsonNode response) {}

    private record DictionaryRow(
            UUID ref,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            int displayOrder,
            long version) {}

    private record DictionaryEntryRow(
            UUID entryRef,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version,
            long updatedAt) {}

    private record DictionaryListingRow(
            UUID entryRef,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            int displayOrder,
            long version,
            long updatedAt,
            long total,
            long generation) {}

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
