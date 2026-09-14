package com.catering.v2s.fulfillment.production.application.persistence;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Persistence execution boundary for production-tag owner facts. */
@Repository
public class ProductionTagOwnerPersistence {
    private final JdbcTemplate jdbc;
    private final TimeProvider time;

    public ProductionTagOwnerPersistence(JdbcTemplate jdbc, TimeProvider time) {
        this.jdbc = jdbc;
        this.time = time;
    }

    public List<PageRow> readTagsPage(
            String dataNodeRef,
            String brandRef,
            String usage,
            String query,
            String status,
            OpaqueCollectionCursor.Position cursor,
            int pageSize) {
        String cursorPredicate = cursor == null
                ? ProductionTagOwnerServiceSql.NO_CURSOR_PREDICATE
                : ProductionTagOwnerServiceSql.CURSOR_PREDICATE;
        String sql = ProductionTagOwnerServiceSql.READ_TAGS_PAGE_PREFIX
                + cursorPredicate
                + ProductionTagOwnerServiceSql.READ_TAGS_PAGE_SUFFIX;
        return jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setString(3, usage);
                    statement.setString(4, query);
                    statement.setString(5, query);
                    statement.setString(6, status);
                    statement.setString(7, status);
                    int index = 8;
                    if (cursor != null) {
                        statement.setString(index++, cursor.sortKey());
                        statement.setString(index++, cursor.sortKey());
                        statement.setObject(index++, cursor.tieBreaker());
                    }
                    statement.setInt(index, pageSize + 1);
                },
                (result, row) -> new PageRow(
                        result.getObject(1, UUID.class),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4),
                        result.getLong(5),
                        result.getLong(6),
                        result.getLong(7)));
    }

    public List<ProductionTagOwnerApi.ProductionTagNavigationReadback> readNavigationTags(
            String dataNodeRef, String brandRef) {
        return jdbc.query(
                ProductionTagOwnerServiceSql.READ_NAVIGATION_TAGS,
                (result, row) -> new ProductionTagOwnerApi.ProductionTagNavigationReadback(
                        result.getObject("tag_ref", UUID.class),
                        result.getString("code"),
                        result.getString("name"),
                        result.getString("status")),
                dataNodeRef,
                brandRef);
    }

    public List<ProductionTagOwnerApi.ProductionTagReferenceReadback> readTagReferencesByRefs(
            String dataNodeRef, String brandRef, List<UUID> tagRefs) {
        if (tagRefs.isEmpty()) return List.of();
        String placeholders = placeholders(tagRefs.size());
        List<Object> arguments = new ArrayList<>();
        arguments.add(dataNodeRef);
        arguments.add(brandRef);
        arguments.addAll(tagRefs);
        return jdbc.query(
                        ProductionTagOwnerServiceSql.READ_TAG_REFERENCES_BY_REFS_PREFIX
                                + placeholders
                                + ProductionTagOwnerServiceSql.READ_TAG_REFERENCES_BY_REFS_SUFFIX,
                        (result, index) -> new ProductionTagOwnerApi.ProductionTagReferenceReadback(
                                result.getObject("tag_ref", UUID.class),
                                result.getString("code"),
                                result.getString("name"),
                                result.getString("status"),
                                result.getLong("version")),
                        arguments.toArray())
                .stream()
                .toList();
    }

    public TypedMutationRow createTypedTag(
            String scope,
            String brand,
            UUID tagRef,
            String code,
            String name,
            String key,
            String operation,
            String requestHash) {
        return jdbc.queryForObject(
                ProductionTagOwnerServiceSql.CREATE_TYPED_TAG,
                (result, ignored) -> new TypedMutationRow(
                        null,
                        null,
                        0L,
                        result.getString("operation_id"),
                        result.getString("request_hash"),
                        result.getString("replay_response"),
                        result.getString("written_response")),
                "production-receipt:" + scope,
                key,
                scope,
                key,
                tagRef,
                scope,
                brand,
                code,
                name,
                time.currentEpochMillis(),
                time.currentEpochMillis(),
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                time.currentEpochMillis());
    }

    public TypedMutationRow updateTypedTagName(
            String scope,
            String brand,
            String code,
            long expectedVersion,
            String key,
            String operation,
            String requestHash,
            String name) {
        return mutateTypedTag(
                ProductionTagOwnerServiceSql.MUTATE_TYPED_TAG_PREFIX + "name"
                        + ProductionTagOwnerServiceSql.MUTATE_TYPED_TAG_SUFFIX,
                scope,
                brand,
                code,
                expectedVersion,
                key,
                operation,
                requestHash,
                name);
    }

    public TypedMutationRow updateTypedTagStatus(
            String scope,
            String brand,
            String code,
            long expectedVersion,
            String key,
            String operation,
            String requestHash,
            String status) {
        return mutateTypedTag(
                ProductionTagOwnerServiceSql.MUTATE_TYPED_TAG_PREFIX + "status"
                        + ProductionTagOwnerServiceSql.MUTATE_TYPED_TAG_SUFFIX,
                scope,
                brand,
                code,
                expectedVersion,
                key,
                operation,
                requestHash,
                status);
    }

    private TypedMutationRow mutateTypedTag(
            String sql,
            String scope,
            String brand,
            String code,
            long expectedVersion,
            String key,
            String operation,
            String requestHash,
            String changedValue) {
        return jdbc.queryForObject(
                sql,
                (result, ignored) -> new TypedMutationRow(
                        result.getObject("tag_ref", UUID.class),
                        result.getString("status"),
                        result.getLong("version"),
                        result.getString("operation_id"),
                        result.getString("request_hash"),
                        result.getString("replay_response"),
                        result.getString("written_response")),
                "production-receipt:" + scope,
                key,
                scope,
                brand,
                code,
                scope,
                key,
                changedValue,
                time.currentEpochMillis(),
                expectedVersion,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                time.currentEpochMillis());
    }

    public int[] copyTags(String targetScope, String brand, List<CopyTagRow> rows) {
        List<CopyTagRow> batchRows = List.copyOf(rows);
        return jdbc.batchUpdate(
                ProductionTagOwnerServiceSql.COPY_TAGS,
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement statement, int index)
                            throws java.sql.SQLException {
                        CopyTagRow row = batchRows.get(index);
                        statement.setObject(1, row.targetRef());
                        statement.setString(2, targetScope);
                        statement.setString(3, brand);
                        statement.setString(4, row.code());
                        statement.setString(5, row.name());
                        statement.setString(6, row.status());
                        statement.setLong(7, 1L);
                        statement.setLong(8, time.currentEpochMillis());
                        statement.setLong(9, time.currentEpochMillis());
                    }

                    @Override
                    public int getBatchSize() {
                        return batchRows.size();
                    }
                });
    }

    public void createTag(
            String scope, String brand, UUID tagRef, String code, String name) {
        jdbc.update(
                ProductionTagOwnerServiceSql.CREATE_TAG,
                tagRef,
                scope,
                brand,
                code,
                name,
                time.currentEpochMillis(),
                time.currentEpochMillis());
    }

    public int updateTagName(
            String scope, String brand, String code, String name, long expectedVersion) {
        return jdbc.update(
                ProductionTagOwnerServiceSql.UPDATE_TAG_NAME,
                name,
                time.currentEpochMillis(),
                scope,
                brand,
                code,
                expectedVersion);
    }

    public int updateTagStatus(
            String scope, String brand, String code, String status, long expectedVersion) {
        return jdbc.update(
                ProductionTagOwnerServiceSql.UPDATE_TAG_STATUS,
                status,
                time.currentEpochMillis(),
                scope,
                brand,
                code,
                expectedVersion);
    }

    public TagRow findByCode(String scope, String brand, String code) {
        return jdbc.query(
                ProductionTagOwnerServiceSql.FIND_TAG,
                result -> {
                    if (!result.next()) return null;
                    return tagRow(result);
                },
                scope,
                brand,
                code);
    }

    public TagRow findByRef(String scope, String brand, UUID ref) {
        return jdbc.query(
                ProductionTagOwnerServiceSql.FIND_TAG_BY_REF,
                result -> {
                    if (!result.next()) return null;
                    return tagRow(result);
                },
                scope,
                brand,
                ref);
    }

    public List<TagRow> findByRefs(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.addAll(refs);
        return jdbc.query(
                ProductionTagOwnerServiceSql.READ_TAGS_BY_COLUMN_PREFIX
                        + "tag_ref"
                        + ProductionTagOwnerServiceSql.READ_TAGS_BY_COLUMN_IN
                        + placeholders(refs.size())
                        + ProductionTagOwnerServiceSql.READ_TAGS_BY_COLUMN_SUFFIX,
                (row, number) -> tagRow(row),
                arguments.toArray());
    }

    public List<TagRow> findByCodes(String scope, String brand, List<String> codes) {
        if (codes.isEmpty()) return List.of();
        List<Object> arguments = new ArrayList<>();
        arguments.add(scope);
        arguments.add(brand);
        arguments.addAll(codes);
        return jdbc.query(
                ProductionTagOwnerServiceSql.READ_TAGS_BY_CODES
                        + placeholders(codes.size())
                        + ProductionTagOwnerServiceSql.READ_TAGS_BY_COLUMN_SUFFIX,
                (row, number) -> tagRow(row),
                arguments.toArray());
    }

    public String readName(String scope, String brand, String code) {
        return jdbc.query(
                ProductionTagOwnerServiceSql.READ_TAG_NAME,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, code);
                },
                result -> result.next() ? result.getString(1) : null);
    }

    public String readStatus(String scope, String brand, String code) {
        return jdbc.query(
                ProductionTagOwnerServiceSql.READ_TAG_STATUS,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setString(3, code);
                },
                result -> result.next() ? result.getString(1) : null);
    }

    public ReceiptRow findReceiptReplay(String scope, String key) {
        AdvisoryLock.acquire(jdbc, "production-receipt", scope, key);
        return jdbc.query(
                        ProductionTagOwnerServiceSql.READ_RECEIPT_REPLAY,
                        (result, number) -> new ReceiptRow(
                                result.getString(1), result.getString(2), result.getString(3)),
                        scope,
                        key)
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void saveReceipt(
            String scope,
            String key,
            String operation,
            String requestHash,
            String canonicalResponse) {
        jdbc.update(
                ProductionTagOwnerServiceSql.WRITE_RECEIPT,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                canonicalResponse,
                time.currentEpochMillis());
    }

    private static TagRow tagRow(java.sql.ResultSet result) throws java.sql.SQLException {
        return new TagRow(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getString(4),
                result.getLong(5));
    }

    private static String placeholders(int size) {
        return String.join(
                ProductionTagOwnerServiceSql.PLACEHOLDER_SEPARATOR,
                java.util.Collections.nCopies(size, ProductionTagOwnerServiceSql.PARAMETER_PLACEHOLDER));
    }

    public record PageRow(
            UUID tagRef,
            String code,
            String name,
            String status,
            long version,
            long updatedAt,
            long total) {}

    public record TypedMutationRow(
            UUID currentTagRef,
            String currentStatus,
            long currentVersion,
            String receiptOperation,
            String receiptHash,
            String replayResponse,
            String writtenResponse) {}

    public record CopyTagRow(UUID targetRef, String code, String name, String status) {}

    public record TagRow(UUID ref, String code, String name, String status, long version) {}

    public record ReceiptRow(String operation, String hash, String response) {}
}
