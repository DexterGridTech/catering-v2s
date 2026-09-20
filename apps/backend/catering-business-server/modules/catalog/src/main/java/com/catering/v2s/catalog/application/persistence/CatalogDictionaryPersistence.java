package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for catalog dictionary facts. */
@Repository
public class CatalogDictionaryPersistence {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    @Autowired
    public CatalogDictionaryPersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public record DictionaryRow(
            UUID ref,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            int displayOrder,
            long version) {}

    public record DictionaryListingRow(
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

    public Long readVersion(String scope, String brand, String kind, String code) {
        return jdbc.queryForObject(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_VERSION_DATA_NODE_REF_BRAND_REF + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE,
                Long.class,
                scope,
                brand,
                kind,
                code);
    }

    public int insertEntry(
            UUID entryRef,
            String dataNodeRef,
            String brandRef,
            String kind,
            String code,
            String name,
            UUID parentEntryRef,
            int displayOrder,
            long createdAt) {
        return jdbc.update(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_INSERT_INTO_DICTIONARY_ENTRY_INSERT_INTO_CATALOG_DICTIONA
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_ENTRY_REF_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE_NAME_CREATED_AT_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS_VALUES,
                entryRef,
                dataNodeRef,
                brandRef,
                kind,
                code,
                name,
                parentEntryRef,
                displayOrder,
                createdAt,
                createdAt);
    }

    public int updateEntry(
            String dataNodeRef,
            String brandRef,
            String kind,
            String code,
            String name,
            long expectedVersion,
            long updatedAt) {
        return jdbc.update(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_NAME_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_STATUS_VOIDED,
                name,
                updatedAt,
                dataNodeRef,
                brandRef,
                kind,
                code,
                expectedVersion);
    }

    public int reorderEntry(
            String scope,
            String brand,
            String kind,
            String code,
            int displayOrder,
            long updatedAt) {
        return jdbc.update(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_DISPLAY_ORDER_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE,
                displayOrder,
                updatedAt,
                scope,
                brand,
                kind,
                code);
    }

    public int transitionStatus(
            String dataNodeRef,
            String brandRef,
            String kind,
            String code,
            String status,
            long expectedVersion,
            long updatedAt) {
        return jdbc.update(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND_CODE_ALTERNATE_A
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_VERSION_STATUS_VOIDED,
                status,
                updatedAt,
                dataNodeRef,
                brandRef,
                kind,
                code,
                expectedVersion);
    }

    public List<DictionaryListingRow> loadListing(
            String scope,
            String brand,
            String kind,
            UUID parentEntryRef,
            String query,
            String status,
            Integer cursorDisplayOrder,
            UUID cursorTieBreaker,
            int pageSize) {
        String cursorPredicate = cursorDisplayOrder == null ? "" : CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_WHERE_DISPLAY_ORDER_ENTRY_REF;
        String sql = CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CTE_MATCHING_ENTRY_REF_CODE_NAME
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_UPDATE_DICTIONARY_ENTRY_UPDATED_AT_EPOCH_MILLIS_DATA_NODE_REF
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CONDITION_BRAND_REF_DICTIONARY_KIND
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_OPEN_PAREN_PARENT_ENTRY_REF
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CONDITION_CODE_CHR_NAME_ILIKE
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CONDITION_TEXT_STATUS
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_AGGREGATE_TOTAL_VERSION
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_MATCHING_GENERATION
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_PAGED_ENTRY_REF_CODE_NAME
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_UPDATE_MATCHING_UPDATED_AT_EPOCH_MILLIS
                + cursorPredicate
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_ORDER_BY_DISPLAY_ORDER_ENTRY_REF
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_ENTRY_REF_CODE_NAME_STATUS
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_UPDATED_AT_EPOCH_MILLIS
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_PAGED_TOTAL_GENERATION_DISPLAY_ORDER
                + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_ENTRY_REF;
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
        if (cursorDisplayOrder != null) {
            arguments.add(cursorDisplayOrder);
            arguments.add(cursorDisplayOrder);
            arguments.add(cursorTieBreaker);
        }
        arguments.add(pageSize + 1);
        return jdbc.query(
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
    }

    public List<DictionaryRow> lockEntriesForReorder(String scope, String brand, String kind) {
        return jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_ENTRY_REF_DICTIONARY_KIND_CODE_NAME
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_DICTIONARY_ENTRY_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_ENTRY_REF_ALTERNATE_A,
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

    public int nextDisplayOrder(String scope, String brand, String kind) {
        Integer value = jdbc.queryForObject(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_DISPLAY_ORDER_DATA_NODE_REF + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_BRAND_REF_DICTIONARY_KIND,
                Integer.class,
                scope,
                brand,
                kind);
        return value == null ? 0 : value;
    }

    public Set<UUID> relationalSkuReferences(String scope, String brand, String kind, List<UUID> entryRefs) {
        if (!Set.of("SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE").contains(kind) || entryRefs.isEmpty()) return Set.of();
        String placeholders = String.join(
                CatalogDictionaryServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(entryRefs.size(), CatalogDictionaryServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(entryRefs);
        String column = "SKU_ATTRIBUTE".equals(kind)
                ? CatalogDictionaryServiceSql.SKU_ATTRIBUTE_REF_COLUMN
                : CatalogDictionaryServiceSql.SKU_ATTRIBUTE_VALUE_REF_COLUMN;
        return Set.copyOf(jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_SELECT_DISTINCT
                        + column
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_FROM_CLAUSE_CATALOG_SKU_RELATION_SKU
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CATALOG_ITEM_SKU_PRODUCT_SKU_REF_RELATION_ITEM
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_ITEM_ITEM_REF_SKU_DATA_NODE_REF
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_ITEM_STATUS_VOIDED
                        + column
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_IN_LIST_PREFIX
                        + placeholders
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CLOSE_PAREN,
                (result, row) -> result.getObject(1, UUID.class),
                args.toArray()));
    }

    public boolean validParent(String parentEntryRef, String scope, String brand) {
        Boolean valid = jdbc.queryForObject(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_ENTRY_REF_DATA_NODE_REF + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_BRAND_REF_DICTIONARY_KIND_SKU_ATTRIBUTE,
                Boolean.class,
                UUID.fromString(parentEntryRef),
                scope,
                brand);
        return Boolean.TRUE.equals(valid);
    }

    public String readName(String scope, String brand, String kind, String code) {
        return jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_NAME_DATA_NODE_REF_BRAND_REF_DICTIONARY_KIND + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CONDITION_CODE,
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

    public String readStatus(String scope, String brand, String kind, String code) {
        return jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_STATUS_DATA_NODE_REF_BRAND_REF + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE_ALTERNATE_A,
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

    public UUID readParentRef(String scope, String brand, String kind, String code) {
        return jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_PARENT_ENTRY_REF_DATA_NODE_REF_BRAND_REF + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE_ALTERNATE_B,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, kind);
                    statement.setString(4, code);
                },
                result -> result.next() ? result.getObject(1, UUID.class) : null);
    }

    public UUID readEntryRef(String scope, String brand, String kind, String code) {
        return jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_ENTRY_REF_DATA_NODE_REF_BRAND_REF + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_DICTIONARY_KIND_CODE_ALTERNATE_C,
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

    public long generation(String dataNodeRef, String brandRef) {
        Long value = jdbc.queryForObject(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_CATALOG_ITEM_VERSION_DATA_NODE_REF_BRAND_REF,
                Long.class,
                dataNodeRef,
                brandRef);
        return value == null ? 0 : value;
    }

    public long generation(String dataNodeRef, String brandRef, String kind) {
        Long value = jdbc.queryForObject(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_DICTIONARY_ENTRY_VERSION_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CONDITION_DICTIONARY_KIND,
                Long.class,
                dataNodeRef,
                brandRef,
                kind);
        return value == null ? 0 : value;
    }

    public void lockReceipt(String dataNodeRef, String key) {
        AdvisoryLock.acquire(jdbc, "catalog-receipt", dataNodeRef, key);
    }

    public List<ReceiptRow> readReceipt(String dataNodeRef, String key) {
        return jdbc.query(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_CONDITION_IDEMPOTENCY_KEY,
                (result, row) -> new ReceiptRow(
                        result.getString(1), result.getString(2), result.getString(3)),
                dataNodeRef,
                key);
    }

    public int saveReceipt(
            String scope,
            String key,
            String operationId,
            String requestHash,
            String responseJson,
            long createdAt) {
        return jdbc.update(
                CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_INSERT_INTO_COMMAND_RECEIPT + CatalogDictionaryServiceSql.CATALOG_DICTIONARY_SERVICE_RESPONSE_CREATED_AT_EPOCH_MILLIS,
                UUID.randomUUID(),
                scope,
                key,
                operationId,
                requestHash,
                responseJson,
                createdAt);
    }

    public record ReceiptRow(String operationId, String requestHash, String responseJson) {}
}
