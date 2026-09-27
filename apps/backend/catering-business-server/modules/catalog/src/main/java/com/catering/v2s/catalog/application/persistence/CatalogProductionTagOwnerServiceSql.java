package com.catering.v2s.catalog.application.persistence;

/** SQL text owned by CatalogProductionTagOwnerPersistence; B3 relocates text without changing execution. */
public final class CatalogProductionTagOwnerServiceSql {
    public static final String PARAMETER_PLACEHOLDER = "?";
    public static final String PLACEHOLDER_SEPARATOR = ",";
    public static final String NO_CURSOR_PREDICATE = "";
    public static final String CURSOR_PREDICATE = " WHERE code > ? OR (code = ? AND tag_ref > ?)";

    public static final String READ_TAGS_PAGE_PREFIX =
            "WITH matching AS (SELECT tag_ref,code,name,status,version,updated_at_epoch_millis FROM "
                    + "catalog.production_tag_definition WHERE data_node_ref=? AND brand_ref=? "
                    + "AND (? = 'MANAGEMENT' OR status='ENABLED') "
                    + "AND (? = '' OR (code || chr(1) || name) ILIKE '%' || ? || '%') "
                    + "AND (?::text IS NULL OR status=?)), "
                    + "aggregate AS (SELECT COUNT(*) AS total FROM matching), paged AS "
                    + "(SELECT tag_ref,code,name,status,version,updated_at_epoch_millis FROM matching";
    public static final String READ_TAGS_PAGE_SUFFIX =
            " ORDER BY code NULLS LAST, tag_ref LIMIT ?) SELECT p.tag_ref,p.code,p.name,p.status,"
                    + "p.version,p.updated_at_epoch_millis,a.total FROM aggregate a LEFT JOIN paged p ON "
                    + "TRUE ORDER BY p.code NULLS LAST,p.tag_ref";
    public static final String READ_NAVIGATION_TAGS =
            "SELECT tag_ref,code,name,status FROM catalog.production_tag_definition "
                    + "WHERE data_node_ref=? AND brand_ref=? AND status <> 'VOIDED' "
                    + "ORDER BY code, tag_ref";
    public static final String READ_TAG_REFERENCES_BY_REFS_PREFIX =
            "SELECT tag_ref,code,name,status,version FROM catalog.production_tag_definition "
                    + "WHERE data_node_ref=? AND brand_ref=? AND tag_ref IN (";
    public static final String READ_TAG_REFERENCES_BY_REFS_SUFFIX = ") ORDER BY tag_ref";

    public static final String CREATE_TYPED_TAG =
            "WITH receipt_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), "
                    + "hashtext(CAST(? AS text)))), prior_receipt AS MATERIALIZED (SELECT operation_id,request_hash,"
                    + ("response_json::text AS response FROM catalog.production_tag_command_rece"
                            + "ipt CROSS JOIN receipt_lock ")
                    + "WHERE data_node_ref=? AND idempotency_key=?), inserted_tag AS (INSERT INTO "
                    + "catalog.production_tag_definition(tag_ref,data_node_ref,brand_ref,code,name,"
                    + "created_at_epoch_millis,updated_at_epoch_millis) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS "
                    + "(SELECT 1 FROM prior_receipt) RETURNING tag_ref,code,name,status,version), written_receipt AS "
                    + "(INSERT INTO catalog.production_tag_command_receipt(receipt_ref,data_node_ref,idempotency_key,"
                    + ("operation_id,request_hash,response_json,created_at_epoch_millis) SELECT "
                            + "?,?,?,?,?,jsonb_build_object(")
                    + "'tagRef',tag_ref,'code',code,'name',name,'status',status,'version',version),? FROM inserted_tag "
                    + ("RETURNING response_json::text AS response) SELECT prior_receipt.operatio"
                            + "n_id,prior_receipt.request_hash,")
                    + "prior_receipt.response AS replay_response,written_receipt.response AS written_response "
                    + "FROM receipt_lock "
                    + "LEFT JOIN prior_receipt ON TRUE LEFT JOIN written_receipt ON TRUE";

    public static final String MUTATE_TYPED_TAG_PREFIX =
            "WITH receipt_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), "
                    + ("hashtext(CAST(? AS text)))), current_tag AS MATERIALIZED (SELECT tag_ref"
                            + ",code,name,status,version ")
                    + "FROM catalog.production_tag_definition CROSS JOIN receipt_lock WHERE data_node_ref=? "
                    + "AND brand_ref=? AND code=? FOR UPDATE), prior_receipt AS MATERIALIZED "
                    + "(SELECT operation_id,request_hash,"
                    + "response_json::text AS response FROM catalog.production_tag_command_receipt "
                    + "CROSS JOIN receipt_lock WHERE "
                    + "data_node_ref=? AND idempotency_key=?), updated_tag AS (UPDATE "
                    + "catalog.production_tag_definition tag SET ";
    public static final String MUTATE_TYPED_TAG_SUFFIX =
            "=?,version=tag.version+1,updated_at_epoch_millis=? FROM current_tag current "
                    + "WHERE tag.tag_ref=current.tag_ref "
                    + ("AND current.status <> 'VOIDED' AND current.version=? AND NOT EXISTS (SEL"
                            + "ECT 1 FROM prior_receipt) ")
                    + ("RETURNING tag.tag_ref,tag.code,tag.name,tag.status,tag.version), written"
                            + "_receipt AS (INSERT INTO ")
                    + "catalog.production_tag_command_receipt(receipt_ref,data_node_ref,idempotency_key,"
                    + "operation_id,request_hash,response_json,created_at_epoch_millis) SELECT ?,?,?,?,?,"
                    + ("jsonb_build_object('tagRef',tag_ref,'code',code,'name',name,'status',sta"
                            + "tus,'version',version),? ")
                    + "FROM updated_tag RETURNING response_json::text AS response) SELECT current_tag.tag_ref,"
                    + "current_tag.status,"
                    + "current_tag.version,prior_receipt.operation_id,prior_receipt.request_hash,"
                    + "prior_receipt.response AS replay_response,written_receipt.response AS written_response "
                    + "FROM receipt_lock "
                    + "LEFT JOIN current_tag ON TRUE LEFT JOIN prior_receipt ON TRUE LEFT JOIN written_receipt ON TRUE";

    public static final String COPY_TAGS = "INSERT INTO "
            + "catalog.production_tag_definition(tag_ref,data_node_ref,"
            + "brand_ref,code,name,status,version,created_at_epoch_millis,updated_at_epoch_millis) "
            + "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING";
    public static final String CREATE_TAG = "INSERT INTO "
            + "catalog.production_tag_definition(tag_ref,data_node_ref,"
            + "brand_ref,code,name,created_at_epoch_millis,updated_at_epoch_millis) "
            + "VALUES(?,?,?,?,?,?,?)";
    public static final String UPDATE_TAG_NAME = "UPDATE catalog.production_tag_definition SET "
            + "name=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
            + "brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'";
    public static final String UPDATE_TAG_STATUS = "UPDATE catalog.production_tag_definition SET "
            + "status=?,version=version+1,updated_at_epoch_millis=? WHERE data_node_ref=? AND "
            + "brand_ref=? AND code=? AND version=? AND status <> 'VOIDED'";
    public static final String FIND_TAG = "SELECT tag_ref,code,name,status,version FROM "
            + "catalog.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND "
            + "code=?";
    public static final String FIND_TAG_BY_REF = "SELECT tag_ref,code,name,status,version FROM "
            + "catalog.production_tag_definition WHERE data_node_ref=? AND brand_ref=? "
            + "AND tag_ref=?";
    public static final String READ_TAGS_BY_COLUMN_PREFIX = "SELECT tag_ref,code,name,status,version FROM "
            + "catalog.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND ";
    public static final String READ_TAGS_BY_COLUMN_IN = " IN (";
    public static final String READ_TAGS_BY_COLUMN_SUFFIX = ")";
    public static final String READ_TAGS_BY_CODES = "SELECT tag_ref,code,name,status,version FROM "
            + "catalog.production_tag_definition WHERE data_node_ref=? AND brand_ref=? AND "
            + "code IN (";
    public static final String READ_TAG_NAME =
            "SELECT name FROM catalog.production_tag_definition WHERE data_node_ref=? AND " + "brand_ref=? AND code=?";
    public static final String READ_TAG_STATUS =
            "SELECT status FROM catalog.production_tag_definition WHERE data_node_ref=? AND "
                    + "brand_ref=? AND code=?";
    public static final String READ_RECEIPT_REPLAY =
            "SELECT operation_id,request_hash,response_json::text FROM catalog.production_tag_command_receipt WHERE "
                    + "data_node_ref=? AND idempotency_key=?";
    public static final String WRITE_RECEIPT = "INSERT INTO "
            + "catalog.production_tag_command_receipt(receipt_ref,data_node_ref,idempotency_key,operation_i"
            + "d,re"
            + "quest_hash,response_json,created_at_epoch_millis) VALUES(?,?,?,?,?,CAST(? AS JSONB),?)";
}
