package com.catering.v2s.catalog.application.persistence;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for catalog category facts. */
@Repository
public class CatalogCategoryPersistence {
    private static final int CATALOG_CATEGORY_MAX_DEPTH = 3;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    @Autowired
    public CatalogCategoryPersistence(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.time = time;
    }

    public record CategoryRow(
            UUID ref,
            String code,
            String name,
            String parentCode,
            UUID parentCategoryRef,
            String status,
            long version,
            int displayOrder) {}

    public record CategoryMoveDepths(int targetDepth, int movingSubtreeDepth) {}

    public record ReceiptRow(String operationId, String requestHash, String responseJson) {}

    public record TypedCategoryUpdateRow(
            UUID currentCategoryRef,
            long currentVersion,
            String receiptOperation,
            String receiptHash,
            String replayResponse,
            String writtenResponse) {}

    public record TypedCategoryMoveRow(
            String validationCode,
            UUID currentCategoryRef,
            long currentVersion,
            String receiptOperation,
            String receiptHash,
            String replayResponse,
            String writtenResponse) {}

    public TypedCategoryUpdateRow executeTypedUpdate(
            String scope,
            String brand,
            CatalogOwnerApi.CategoryUpdateCommand command,
            String key,
            String name,
            String operation,
            String requestHash) {
        String sql = CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_RECEIPT_LOCK_PG_ADVISORY_XACT_LOCK_HASHTEXT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_TEXT_HASHTEXT_CURRENT_CATEGORY_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_RECEIPT_LOCK_STATUS_VERSION_DATA_NODE_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_BRAND_REF_CATEGORY_REF_STATUS_VOIDED
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_RECEIPT_LOCK_DATA_NODE_REF_IDEMPOTENCY_KEY_UPDATED_CATEGORY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_CATEGORY_NAME_VERSION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_CURRENT_CATEGORY_CURRENT_CATEGORY_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PRIOR_RECEIPT_CURRENT_VERSION_CATEGORY_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_CODE_NAME_STATUS
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_UPDATED_CATEGORY_CATEGORY_SUBTREE_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_SUBTREE_CHILD_CATEGORY_REF_PARENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_CHILD_STATUS_VOIDED_DELETION_AVAILABILITY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_CATEGORY_REF_SUBTREE_SIZE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_ITEM_ITEM_REF_BLOCKING_REFERENCE_COUNT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_JSONB_AGG_JSONB_BUILD_OBJECT_REFERENCE_KIND
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_REFERENCE_REF_REFS_ITEM_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_INBOUND_REFS_CODE_ITEM
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_CATEGORY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_RELATION_REFS_CATEGORY_REF_SUBTREE_REFS_ITEM
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_ITEM_ITEM_REF_RELATION_REFS_DATA_NODE_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_SUBTREE_ITEM_STATUS_VOIDED_REFS
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_CATEGORY_SUBTREE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_RELATION_CATEGORY_REF_SUBTREE_ITEM
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_ITEM_ITEM_REF_RELATION_DATA_NODE_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_VOIDED_RESPONSE_JSONB_BUILD_OBJECT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_CODE_NAME_STATUS_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_PARENT_CATEGORY_REF_VERSION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_VERSION_DISPLAY_ORDER_DELETION_AVAILABILITY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CAN_DELETE_AVAILABILITY_BLOCKING_REFERENCE_COUNT_SUBTREE_SIZE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_BLOCKING_REFERENCE_COUNT_AVAILABILITY_BLOCKING_REFERENCES
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_AVAILABILITY_BLOCKING_REFERENCE_FACTS_BODY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_UPDATED_CATEGORY_CATEGORY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_COMMAND_RECEIPT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY_OPERATION_ID
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CREATED_AT_EPOCH_MILLIS
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_RESPONSE_BODY_TEXT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_CATEGORY_CATEGORY_REF_VERSION_PRIOR_RECEIPT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PRIOR_RECEIPT_REQUEST_HASH_RESPONSE_REPLAY_RESPONSE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_CATEGORY_WRITTEN_RESPONSE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PRIOR_RECEIPT_LEFT_JOIN_PRIOR_RECEIPT_ON_T
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_WRITTEN_RECEIPT_LEFT_JOIN_WRITTEN_RECEIPT_ON;
        return jdbc.queryForObject(
                sql,
                (result, ignored) -> new TypedCategoryUpdateRow(
                        result.getObject("category_ref", UUID.class),
                        result.getLong("version"),
                        result.getString("operation_id"),
                        result.getString("request_hash"),
                        result.getString("replay_response"),
                        result.getString("written_response")),
                "catalog-category-receipt:" + scope,
                key,
                scope,
                brand,
                command.categoryRef(),
                scope,
                key,
                name,
                time.currentEpochMillis(),
                command.expectedVersion(),
                scope,
                brand,
                scope,
                brand,
                scope,
                brand,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                time.currentEpochMillis());
    }

    public TypedCategoryMoveRow executeTypedMove(
            String scope,
            String brand,
            CatalogOwnerApi.CategoryMoveCommand command,
            String key,
            String operation,
            String requestHash) {
        long timestamp = time.currentEpochMillis();
        String sql = CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_RECEIPT_LOCK_PG_ADVISORY_XACT_LOCK_HASHTEXT_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_TEXT_HASHTEXT_HIERARCHY_LOCK
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_LOCKED_CATEGORIES_CATEGORY_CATEGORY_REF_CODE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_PARENT_CATEGORY_REF_VERSION_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_HIERARCHY_LOCK_CATALOG_CATEGORY_CATEGORY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_DATA_NODE_REF_BRAND_REF_STATUS
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_MOVE_INPUT_CATEGORY_REF_TEXT_ACTION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_PARAMETER_PLACEHOLDER_REQUESTED_PARENT_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_LOCKED_CATEGORIES_CURRENT_CATEGORY_CATEGORY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_MOVE_INPUT_INPUT_CATEGORY_REF_CATEGORY_PRIOR_RECEIPT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_RECEIPT_LOCK_DATA_NODE_REF_IDEMPOTENCY_KEY_REQUESTED_PARENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_MOVE_INPUT_CATEGORY_INPUT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_INPUT_REQUESTED_PARENT_REF_CATEGORY_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CURRENT_CATEGORY_CATEGORY_REF_CHILD
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_DEPTH_CHILD
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_PARENT_CATEGORY_REF_SUBTREE_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_REQUESTED_PARENT_DEPTH_CATEGORY_REF_PARENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_PARENT_ANCESTORS
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_ANCESTORS_LOCKED_CATEGORIES_PARENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_CATEGORY_REF_PARENT_ANCESTORS_PARENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SIBLING_CATEGORY_REF_DISPLAY_ORDER_LAG
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SIBLING_DISPLAY_ORDER_CODE_PREVIOUS_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SIBLING_DISPLAY_ORDER_CODE_PREVIOUS_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_SIBLING_DISPLAY_ORDER_CODE_NEXT_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_LOCKED_CATEGORIES_SIBLING_DISPLAY_ORDER_CODE_NEXT_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_CATEGORY_CURRENT_SIBLING_PARENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SIBLINGS_CURRENT_PARENT_CATEGORY_REF_CURRENT_SIBLING_SIBLING
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_CATEGORY_SIBLING_CURRENT_CATEGORY_REF_MOVE_PLAN
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_INPUT_ACTION_REQUESTED_PARENT_REF_EXPECTED_VERSION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_INPUT_UPDATED_AT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_CATEGORY_REF_CURRENT_CATEGORY_REF_VERSION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_DISPLAY_ORDER_CURRENT_DISPLAY_ORDER_CURRENT_SIBLING
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_SIBLING_PREVIOUS_DISPLAY_ORDER_NEXT_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_ANCESTORS_CURRENT_SIBLING_NEXT_DISPLAY_ORDER_DEPTH
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_TARGET_DEPTH_DEPTH_SUBTREE_DEPTH
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_LOCKED_CATEGORIES_CATEGORY_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_REQUESTED_PARENT_REF_CATEGORY_PARENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_REPARENT_DISPLAY_ORDER_CURRENT_CATEGORY_REF_NOT_FOUND
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_VERSION_INPUT_EXPECTED_VERSION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_VERSION_CONFLICT_INPUT_ACTION_REPARENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHEN_INPUT_ACTION_REPARENT_REQUESTED_PARENT_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_REQUESTED_PARENT_CATEGORY_REF_NOT_FOUND_INPUT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_INPUT_REQUESTED_PARENT_REF_CURRENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_SUBTREE_CATEGORY_REF_INPUT_REQUESTED_PARENT_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_HIERARCHY_CYCLE_INPUT_ACTION_REPARENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_DEPTH_ALTERNATE_A
                + CATALOG_CATEGORY_MAX_DEPTH
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_THEN_CATEGORY_DEPTH_EXCEEDED_INPUT_ACTION_CURRENT_SIBLING
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_THEN_MOVE_BOUNDARY_INPUT_ACTION_DOWN
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_CATEGORY_MOVE_BOUNDARY_VALIDATION_CODE_INPUT_CURRENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CURRENT_SIBLING_UPDATED_CATEGORIES
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CATALOG_CATEGORY_CATEGORY_PARENT_CATEGORY_REF_PLAN_ACTION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_PARENT_CATEGORY_REF_DISPLAY_ORDER_PLAN
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PLAN_ACTION_CATEGORY_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PLAN_PREVIOUS_DISPLAY_ORDER_ACTION_CATEGORY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PLAN_CURRENT_DISPLAY_ORDER_ACTION_DOWN
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_THEN_PLAN_NEXT_DISPLAY_ORDER_ACTION_DOWN
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PLAN_CURRENT_DISPLAY_ORDER_CATEGORY_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_UPDATE_MOVE_PLAN_UPDATED_AT_EPOCH_MILLIS_PLAN_UPDATED_AT_VALIDATION_CODE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_PRIOR_RECEIPT_CATEGORY_CATEGORY_REF_PLAN_CURRENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_ALTERNATIVE_CATEGORY_CATEGORY_REF_PLAN_PREVIOUS_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_CATEGORY_REF_CODE_NAME
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_UPDATED_CATEGORIES
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_EMPTY_LITERAL
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_MOVE_PLAN_CATEGORY_PLAN_CATEGORY_REF_CURRENT_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_UPDATED_CURRENT_READBACK_SUBTREE_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_READBACK_SUBTREE_CHILD_CATEGORY_REF_PARENT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_B
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_CATEGORY_REF_SUBTREE_SIZE_ITEM
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_BLOCKING_REFERENCE_COUNT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_JSONB_AGG_JSONB_BUILD_OBJECT_REFERENCE_KIND_CATALOG_ITEM
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CODE_REFS_NAME_DIRECTION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_READBACK_SUBTREE_ITEM_ITEM_REF_CODE_NAME
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_CATEGORY_RELATION_REFS_CATEGORY_REF_SUBTREE_REFS
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_CATALOG_ITEM_ITEM_ITEM_REF_RELATION_REFS_DATA_NODE_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_ITEM_BRAND_REF_STATUS_VOIDED
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_READBACK_SUBTREE_SUBTREE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_CATEGORY_RELATION_CATEGORY_REF_SUBTREE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_ITEM_ITEM_REF_RELATION_DATA_NODE_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_ITEM_BRAND_REF_STATUS_VOIDED_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_REF_CATEGORY_CODE_NAME
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_STATUS_PARENT_CATEGORY_REF_VERSION
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DISPLAY_ORDER
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_DISPLAY_ORDER_ALTERNATE_A
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DELETION_AVAILABILITY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_SIZE_AVAILABILITY_BLOCKING_REFERENCE_COUNT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_AVAILABILITY_BLOCKING_REFERENCE_COUNT_BLOCKING_REFERENCES
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_UPDATED_CURRENT_AVAILABILITY_BLOCKING_REFERENCE_FACTS_BODY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DELETION_AVAILABILITY_CATEGORY_AVAILABILITY_WRITTEN_RECEIPT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_COMMAND_RECEIPT_RECEIPT_REF_DATA_NODE_REF_IDEMPOTENCY_KEY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_RESPONSE_REQUEST_HASH_CREATED_AT_EPOCH_MILLIS_BODY
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_RETURNING_RESPONSE_TEXT
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_PLAN_VALIDATION_CODE_CURRENT_CATEGORY_CATEGORY_REF
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PRIOR_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_MOVE_PLAN_WRITTEN_RECEIPT_RESPONSE_WRITTEN_RESPONSE_PLAN
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PRIOR_RECEIPT_LEFT_JOIN_CURRENT_CATEGORY_O
                + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_WRITTEN_RECEIPT_LEFT_JOIN_WRITTEN_RECEIPT_ON_ALTERNATE_A;
        return jdbc.queryForObject(
                sql,
                (result, ignored) -> new TypedCategoryMoveRow(
                        result.getString("validation_code"),
                        result.getObject("category_ref", UUID.class),
                        result.getLong("version"),
                        result.getString("operation_id"),
                        result.getString("request_hash"),
                        result.getString("replay_response"),
                        result.getString("written_response")),
                "catalog-category-receipt:" + scope,
                key,
                "catalog-category-hierarchy:" + scope,
                brand,
                scope,
                brand,
                command.categoryRef(),
                command.action().name(),
                command.parentCategoryRef(),
                command.expectedVersion(),
                timestamp,
                scope,
                key,
                scope,
                brand,
                scope,
                brand,
                UUID.randomUUID(),
                scope,
                key,
                operation,
                requestHash,
                timestamp);
    }

    public int updateName(UUID categoryRef, String name, long updatedAt) {
        return jdbc.update(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_NAME_VERSION_UPDATED_AT_EPOCH_MILLIS + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_REF,
                name,
                updatedAt,
                categoryRef);
    }

    public int reparent(UUID categoryRef, UUID parentCategoryRef, int displayOrder, long updatedAt) {
        return jdbc.update(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_UPDATE_CATALOG_CATALOG_CATEG
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_REF_ALTERNATE_A,
                parentCategoryRef,
                displayOrder,
                updatedAt,
                categoryRef);
    }

    public CategoryMoveDepths readMoveDepths(
            String scope, String brand, UUID parentCategoryRef, UUID movingCategoryRef) {
        return jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_ANCESTORS_CATEGORY_REF_PARENT_CATEGORY_REF_DEPTH
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_BRAND_REF_CATEGORY_REF_STATUS_VOIDED
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ANCESTORS
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_ANCESTORS_PARENT
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_CATEGORY_REF_ANCESTORS_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_PARENT_BRAND_REF_STATUS_VOIDED
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_DEPTH
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_CHILD_CATEGORY_REF_SUBTREE_DEPTH
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_SUBTREE_CHILD_PARENT_CATEGORY_REF_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_ANCESTORS_CHILD_STATUS_VOIDED_DEPTH
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_DEPTH,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, parentCategoryRef);
                    statement.setString(4, scope);
                    statement.setString(5, brand);
                    statement.setString(6, scope);
                    statement.setString(7, brand);
                    statement.setObject(8, movingCategoryRef);
                    statement.setString(9, scope);
                    statement.setString(10, brand);
                },
                result -> {
                    if (!result.next()) throw new IllegalStateException("category move depth query returned no row");
                    return new CategoryMoveDepths(result.getInt(1), result.getInt(2));
                });
    }

    public int readSubtreeDepth(String scope, String brand, UUID rootCategoryRef) {
        Integer depth = jdbc.queryForObject(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_DEPTH
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_SUBTREE_CHILD_CATEGORY_REF_DEPTH
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_CONDITION_CHILD_PARENT_CATEGORY_REF_SUBTREE_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_SUBTREE_CHILD_STATUS_VOIDED_DEPTH,
                Integer.class,
                scope,
                brand,
                rootCategoryRef,
                scope,
                brand);
        return depth == null ? 0 : depth;
    }

    public int updateSiblingOrder(UUID categoryRef, int displayOrder, long updatedAt) {
        return jdbc.update(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_DISPLAY_ORDER_VERSION_UPDATED_AT_EPOCH_MILLIS + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATEGORY_REF_ALTERNATE_B,
                displayOrder,
                updatedAt,
                categoryRef);
    }

    public List<CategoryRow> lockCategories(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        List<UUID> stable = refs.stream().distinct().sorted().toList();
        String placeholders = String.join(
                CatalogCategoryServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(stable.size(), CatalogCategoryServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(stable);
        List<CategoryRow> rows = jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF
                        + placeholders
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CLOSE_PAREN_STATUS_VOIDED_CATEGORY_REF,
                (result, row) -> categoryRow(result),
                args.toArray());
        if (rows.size() != stable.size())
            throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在或已删除");
        return rows;
    }

    public List<CategoryRow> lockSiblings(String scope, String brand, UUID parentCategoryRef) {
        return jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_STATUS_VOIDED_CATEGORY_REF,
                (result, row) -> categoryRow(result),
                scope,
                brand,
                parentCategoryRef);
    }

    public List<UUID> subtreeRefs(String scope, String brand, UUID rootCategoryRef) {
        List<UUID> refs = jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_CHILD_CATEGORY_REF_PARENT
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_BRAND_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_SUBTREE_CHILD_STATUS_VOIDED_CATEGORY_REF,
                (result, row) -> result.getObject(1, UUID.class),
                scope,
                brand,
                rootCategoryRef,
                scope,
                brand);
        if (refs.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
        return refs;
    }

    public int insertCategory(
            UUID categoryRef,
            String dataNodeRef,
            String brandRef,
            String code,
            String name,
            UUID parentCategoryRef,
            long displayOrder,
            long createdAt) {
        return jdbc.update(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_INSERT_INTO_CATALOG_CATEGORY_INSERT_INTO_CATALOG_CATALOG_
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CATEGORY_REF_DATA_NODE_REF_BRAND_REF_CODE
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_D_AT
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_EPOCH_MILLIS_UPDATED_AT_EPOCH_MILLIS,
                categoryRef,
                dataNodeRef,
                brandRef,
                code,
                name,
                parentCategoryRef,
                displayOrder,
                createdAt,
                createdAt);
    }

    public int transitionStatus(
            String dataNodeRef,
            String brandRef,
            UUID categoryRef,
            String status,
            long updatedAt,
            long expectedVersion) {
        return jdbc.update(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_UPDATE_CATALOG_CATEGORY_STATUS_VERSION_UPDATED_AT_EPOCH_MILLIS
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF_BRAND_REF_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_VERSION_STATUS_VOIDED,
                status,
                updatedAt,
                dataNodeRef,
                brandRef,
                categoryRef,
                expectedVersion);
    }

    public int readDepth(String scope, String brand, UUID categoryRef) {
        Integer depth = jdbc.queryForObject(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_ANCESTORS_CATEGORY_REF_PARENT_CATEGORY_REF_DEPTH_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_DATA_NODE_REF_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_BRAND_REF_CATEGORY_REF_STATUS_VOIDED_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ANCESTORS_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_CATALOG_CATEGORY_PARENT
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_ANCESTORS_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_PARENT_DATA_NODE_REF_BRAND_REF_STATUS
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_ANCESTORS_DEPTH,
                Integer.class,
                scope,
                brand,
                categoryRef,
                scope,
                brand);
        return depth == null ? 0 : depth;
    }

    public CategoryRow read(String dataNodeRef, String brandRef, UUID categoryRef) {
        return readRow(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_B
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_STATUS_VOIDED,
                dataNodeRef,
                brandRef,
                categoryRef);
    }

    public CategoryRow lock(String dataNodeRef, String brandRef, UUID categoryRef) {
        return readRow(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_C
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_B
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_STATUS_VOIDED_ALTERNATE_A,
                dataNodeRef,
                brandRef,
                categoryRef);
    }

    public CategoryRow readIncludingVoided(String dataNodeRef, String brandRef, UUID categoryRef) {
        return readRow(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_D + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_ALTERNATE_C,
                dataNodeRef,
                brandRef,
                categoryRef);
    }

    public CategoryRow lockIncludingVoided(String dataNodeRef, String brandRef, UUID categoryRef) {
        return readRow(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATEGORY_REF_CODE_NAME_PARENT_CODE_ALTERNATE_E
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_CATEGORY_DATA_NODE_REF_BRAND_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_CATEGORY_REF,
                dataNodeRef,
                brandRef,
                categoryRef);
    }

    public List<UUID> subtreeRefsIncludingVoided(String scope, String brand, UUID rootCategoryRef) {
        List<UUID> refs = jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_CHILD
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_SUBTREE_CHILD_PARENT
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_CONDITION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_ALTERNATE_B
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_SUBTREE_CATEGORY_REF,
                (result, row) -> result.getObject(1, UUID.class),
                scope,
                brand,
                rootCategoryRef,
                scope,
                brand);
        if (refs.isEmpty()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
        return refs;
    }

    public List<String> referencedItems(String scope, String brand, List<UUID> refs) {
        if (refs.isEmpty()) return List.of();
        String placeholders = String.join(
                CatalogCategoryServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(refs.size(), CatalogCategoryServiceSql.PARAMETER_PLACEHOLDER));
        List<Object> args = new ArrayList<>();
        args.add(scope);
        args.add(brand);
        args.addAll(refs);
        return jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_ITEM_CATEGORY_ITEM_CODE_RELATION
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_CATALOG_ITEM_ITEM
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_JOIN_CONDITION_ITEM_ITEM_REF_RELATION_DATA_NODE_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_ITEM_STATUS_VOIDED_RELATION
                        + placeholders
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CLOSE_PAREN_ITEM_CODE,
                (rows, index) -> rows.getString(1),
                args.toArray());
    }

    public CatalogOwnerApi.CategoryDeletionAvailability deletionAvailability(
            String scope, String brand, UUID categoryRef) {
        return jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CTE_CATALOG_CATEGORY_SUBTREE_CATEGORY_REF_ALTERNATE_B
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_DATA_NODE_REF_BRAND_REF_CATEGORY_REF_STATUS_ALTERNATE_B
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_SUBTREE_CHILD_CATEGORY_REF_PARENT_ALTERNATE_A
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_PARENT_CATEGORY_REF_PARENT_CATEGORY_REF_ALTERNATE_C
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CHILD_BRAND_REF_STATUS_VOIDED
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_SUBTREE_ITEM_ITEM_REF_CODE_NAME
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_FROM_CLAUSE_ANCHOR
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_CATEGORY_RELATION_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_OPEN_PAREN_CATEGORY_REF
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_CATALOG_ITEM_SUBTREE_ITEM_ITEM_REF_RELATION
                        + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_ITEM_DATA_NODE_REF_BRAND_REF_STATUS,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setObject(3, categoryRef);
                    statement.setString(4, scope);
                    statement.setString(5, brand);
                    statement.setString(6, scope);
                    statement.setString(7, brand);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    long subtreeSize = result.getLong(1);
                    if (subtreeSize == 0) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    LinkedHashSet<String> blocking = new LinkedHashSet<>();
                    List<CatalogOwnerApi.CategoryBlockingReference> references = new ArrayList<>();
                    UUID firstRef = result.getObject(2, UUID.class);
                    String first = result.getString(3);
                    String firstName = result.getString(4);
                    if (first != null) {
                        blocking.add(first);
                        references.add(new CatalogOwnerApi.CategoryBlockingReference(
                                "CATALOG_ITEM", firstRef, first, firstName, "INBOUND"));
                    }
                    while (result.next()) {
                        UUID itemRef = result.getObject(2, UUID.class);
                        String itemCode = result.getString(3);
                        String itemName = result.getString(4);
                        if (itemCode != null && blocking.add(itemCode)) {
                            references.add(new CatalogOwnerApi.CategoryBlockingReference(
                                    "CATALOG_ITEM", itemRef, itemCode, itemName, "INBOUND"));
                        }
                    }
                    return new CatalogOwnerApi.CategoryDeletionAvailability(
                            blocking.isEmpty(), subtreeSize, references.size(), List.copyOf(references));
                });
    }

    public long nextDisplayOrder(String scope, String brand, UUID parentCategoryRef) {
        Long next = jdbc.queryForObject(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_CATALOG_CATEGORY_DISPLAY_ORDER_DATA_NODE_REF + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_BRAND_REF_PARENT_CATEGORY_REF_STATUS_VOIDED,
                Long.class,
                scope,
                brand,
                parentCategoryRef);
        return next == null ? 0L : next;
    }

    public void lockHierarchy(String scope, String brand) {
        AdvisoryLock.acquire(jdbc, "catalog-category-hierarchy", scope, brand);
    }

    public void lockReceipt(String scope, String key) {
        AdvisoryLock.acquire(jdbc, "catalog-receipt", scope, key);
    }

    public List<ReceiptRow> readReceipt(String dataNodeRef, String key) {
        return jdbc.query(
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_SELECT_COMMAND_RECEIPT_OPERATION_ID_REQUEST_HASH_RESPONSE_TEXT + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONDITION_IDEMPOTENCY_KEY,
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
                CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_INSERT_INTO_COMMAND_RECEIPT + CatalogCategoryServiceSql.CATALOG_CATEGORY_SERVICE_CONTINUATION_RESPONSE_CREATED_AT_EPOCH_MILLIS,
                UUID.randomUUID(),
                scope,
                key,
                operationId,
                requestHash,
                responseJson,
                createdAt);
    }

    private CategoryRow readRow(String sql, String dataNodeRef, String brandRef, UUID categoryRef) {
        return jdbc.query(
                sql,
                statement -> {
                    statement.setString(1, dataNodeRef);
                    statement.setString(2, brandRef);
                    statement.setObject(3, categoryRef);
                },
                result -> {
                    if (!result.next()) throw new CatalogOwnerApi.Problem("NOT_FOUND", 404, "分类不存在");
                    return categoryRow(result);
                });
    }

    private static CategoryRow categoryRow(java.sql.ResultSet result) throws java.sql.SQLException {
        return new CategoryRow(
                result.getObject(1, UUID.class),
                result.getString(2),
                result.getString(3),
                result.getString(4),
                result.getObject(5, UUID.class),
                result.getString(6),
                result.getLong(7),
                result.getInt(8));
    }
}
