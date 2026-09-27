package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** The shared reference table keeps catalog tags as sets and the production tag as an optional singleton. */
public class CatalogItemReferenceFacts {
    public static final String PRODUCTION_TAG = "PRODUCTION_TAG";
    public static final String CATALOG_TAG = "CATALOG_TAG";
    private static final List<String> KINDS = List.of(PRODUCTION_TAG, CATALOG_TAG);

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogItemReferenceFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<UUID, Map<String, JsonNode>> readByItemRefs(Collection<UUID> itemRefs) {
        if (itemRefs == null || itemRefs.isEmpty()) return Map.of();
        List<UUID> refs = new ArrayList<>(new LinkedHashSet<>(itemRefs));
        String placeholders = String.join(
                CatalogItemReferenceFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogItemReferenceFactsSql.PARAMETER_PLACEHOLDER));
        Map<UUID, Map<String, JsonNode>> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, emptyKinds()));
        jdbc.query(
                CatalogItemReferenceFactsSql
                                .CATALOG_ITEM_REFERENCE_FACTS_SELECT_CATALOG_ITEM_REFERENCE_ITEM_REF_KIND_REF
                        + placeholders
                        + CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_CLOSE_PAREN_ITEM_REF_KIND_REF,
                statement -> {
                    for (int index = 0; index < refs.size(); index++) statement.setObject(index + 1, refs.get(index));
                },
                rows -> {
                    while (rows.next()) {
                        UUID itemRef = rows.getObject(1, UUID.class);
                        String kind = rows.getString(2);
                        UUID reference = rows.getObject(3, UUID.class);
                        JsonNode current = result.get(itemRef).get(kind);
                        if (PRODUCTION_TAG.equals(kind)) {
                            if (current != null && !current.isNull())
                                throw problem("productionTagRef cannot contain more than one ref");
                            result.get(itemRef)
                                    .put(kind, mapper.getNodeFactory().textNode(reference.toString()));
                        } else ((ArrayNode) current).add(reference.toString());
                    }
                    return null;
                });
        return Map.copyOf(result);
    }

    public void replace(UUID itemRef, JsonNode productionTagRef, JsonNode tagRefs) {
        List<Object[]> rows = new ArrayList<>();
        UUID productionTag = normalizeSingle(productionTagRef, "productionTagRef");
        if (productionTag != null) rows.add(new Object[] {itemRef, PRODUCTION_TAG, productionTag});
        addRows(rows, itemRef, CATALOG_TAG, normalize(tagRefs, "tagRefs"));
        if (rows.isEmpty()) {
            jdbc.update(
                    CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_DELETE_CATALOG_ITEM_REFERENCE_ITEM_REF,
                    itemRef);
            return;
        }
        // PostgreSQL evaluates data-modifying CTE branches against one snapshot.  A delete and an insert into this
        // same unique-key table therefore cannot be collapsed into a CTE: the insert still conflicts with the row
        // deleted by its sibling branch.  Keep replacement as its two required statements inside the caller's
        // transaction; correctness and rollback atomicity belong to that transaction, not to a false one-statement
        // optimization.
        jdbc.update(
                CatalogItemReferenceFactsSql
                        .CATALOG_ITEM_REFERENCE_FACTS_DELETE_CATALOG_ITEM_REFERENCE_ITEM_REF_ALTERNATE_A,
                itemRef);
        jdbc.batchUpdate(
                CatalogItemReferenceFactsSql
                        .CATALOG_ITEM_REFERENCE_FACTS_INSERT_INTO_CATALOG_ITEM_REFERENCE_ITEM_REF_KIND_REF,
                rows);
    }

    /** Inserts facts for freshly-created copy targets in one owner-local JDBC batch. */
    public void insertForCopy(Map<UUID, CopyValues> valuesByItem) {
        List<Object[]> rows = new ArrayList<>();
        if (valuesByItem != null)
            for (Map.Entry<UUID, CopyValues> entry : valuesByItem.entrySet()) {
                CopyValues values = entry.getValue();
                addRows(rows, entry.getKey(), PRODUCTION_TAG, singleton(values.productionTagRef(), "productionTagRef"));
                addRows(rows, entry.getKey(), CATALOG_TAG, normalize(values.tagRefs(), "tagRefs"));
            }
        if (!rows.isEmpty()) jdbc.batchUpdate(CatalogItemReferenceFactsSql.INSERT_INTO_CAT_ITEM_REF_ALT_A_001, rows);
    }

    public boolean referenced(String dataNodeRef, String brandRef, String kind, UUID ref) {
        if (!KINDS.contains(kind)) return false;
        Boolean found = jdbc.queryForObject(
                CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_SELECT_CATALOG_ITEM_RELATION_ITEM
                        + CatalogItemReferenceFactsSql
                                .CATALOG_ITEM_REFERENCE_FACTS_JOIN_CONDITION_ITEM_ITEM_REF_RELATION_KIND
                        + CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_ITEM_DATA_NODE_REF_BRAND_REF_STATUS,
                Boolean.class,
                kind,
                ref,
                dataNodeRef,
                brandRef);
        return Boolean.TRUE.equals(found);
    }

    public Set<UUID> referencedRefs(String dataNodeRef, String brandRef, String kind, Collection<UUID> refs) {
        if (!KINDS.contains(kind) || refs == null || refs.isEmpty()) return Set.of();
        List<UUID> requested = new ArrayList<>(new LinkedHashSet<>(refs));
        String placeholders = String.join(
                CatalogItemReferenceFactsSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(requested.size(), CatalogItemReferenceFactsSql.PARAMETER_PLACEHOLDER));
        List<Object> arguments = new ArrayList<>();
        arguments.add(kind);
        arguments.add(dataNodeRef);
        arguments.add(brandRef);
        arguments.addAll(requested);
        return Set.copyOf(jdbc.query(
                CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_SELECT_CATALOG_ITEM_RELATION_REF
                        + CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_ITEM_ITEM_REF_RELATION_KIND
                        + CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_ITEM_BRAND_REF_STATUS_VOIDED
                        + placeholders
                        + CatalogItemReferenceFactsSql.CATALOG_ITEM_REFERENCE_FACTS_CLOSE_PAREN,
                (rows, row) -> rows.getObject(1, UUID.class),
                arguments.toArray()));
    }

    private static void addRows(List<Object[]> rows, UUID itemRef, String kind, List<UUID> refs) {
        for (UUID ref : refs) rows.add(new Object[] {itemRef, kind, ref});
    }

    private Map<String, JsonNode> emptyKinds() {
        Map<String, JsonNode> kinds = new LinkedHashMap<>();
        kinds.put(PRODUCTION_TAG, NullNode.getInstance());
        kinds.put(CATALOG_TAG, mapper.createArrayNode());
        return kinds;
    }

    private static UUID normalizeSingle(JsonNode value, String field) {
        if (value == null || value.isMissingNode() || value.isNull()) return null;
        if (!value.isTextual()) throw problem(field + " must be a UUID ref");
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException failure) {
            throw problem(field + " must be a UUID ref", failure);
        }
    }

    private static List<UUID> singleton(JsonNode value, String field) {
        UUID ref = normalizeSingle(value, field);
        return ref == null ? List.of() : List.of(ref);
    }

    private static List<UUID> normalize(JsonNode values, String field) {
        if (values == null || values.isMissingNode() || values.isNull()) return List.of();
        if (!values.isArray()) throw problem(field + " must be an array of UUID refs");
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (JsonNode value : values) {
            try {
                if (!refs.add(UUID.fromString(value.asText("")))) throw problem(field + " cannot contain duplicates");
            } catch (IllegalArgumentException failure) {
                throw problem(field + " must contain UUID refs", failure);
            }
        }
        return List.copyOf(refs);
    }

    private static CatalogOwnerApi.Problem problem(String message) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message);
    }

    private static CatalogOwnerApi.Problem problem(String message, Throwable cause) {
        return new CatalogOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, message, cause);
    }

    public record CopyValues(JsonNode productionTagRef, JsonNode tagRefs) {}
}
