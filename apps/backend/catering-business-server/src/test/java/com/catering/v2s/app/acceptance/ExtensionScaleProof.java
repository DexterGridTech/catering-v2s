package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.contract.application.persistence.ContractTaskReadServiceSql;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionFilterQuery;
import com.catering.v2s.organization.application.persistence.BusinessEntityTaskReadServiceSql;
import com.catering.v2s.organization.application.persistence.OrganizationOverviewTaskReadServiceSql;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Real PostgreSQL scale evidence for the five flat extension hosts. This is an explicitly gated proof fixture, not a
 * business acceptance scenario and not a source for runtime indexes or operation budgets.
 */
final class ExtensionScaleProof {
    private static final int TOTAL_ROWS = 100_000;
    private static final int GENERATED_ROWS = TOTAL_ROWS - 1;
    private static final int PAGE_SIZE = 10;
    private static final int SAMPLE_COUNT = 3;
    private static final String SCALE_PREFIX = "extension-scale-proof";
    private static final ExtensionDefinitionLookup SCALE_DEFINITION =
            (workspaceUuid, groupWorkspaceKey, hostType) -> new ExtensionDefinitionReadback(
                    groupWorkspaceKey,
                    hostType,
                    1L,
                    0L,
                    List.of(
                            new ExtensionDefinitionReadback.Field(
                                    "scale_text", "Scale text", "TEXT", true, true, false, List.of(), "ENABLED", 1, ""),
                            new ExtensionDefinitionReadback.Field(
                                    "scale_number",
                                    "Scale number",
                                    "NUMBER",
                                    true,
                                    true,
                                    false,
                                    List.of(),
                                    "ENABLED",
                                    2,
                                    ""),
                            new ExtensionDefinitionReadback.Field(
                                    "scale_date", "Scale date", "DATE", true, true, false, List.of(), "ENABLED", 3, ""),
                            new ExtensionDefinitionReadback.Field(
                                    "scale_boolean",
                                    "Scale boolean",
                                    "BOOLEAN",
                                    true,
                                    true,
                                    false,
                                    List.of(),
                                    "ENABLED",
                                    4,
                                    ""),
                            new ExtensionDefinitionReadback.Field(
                                    "scale_select",
                                    "Scale select",
                                    "SELECT",
                                    true,
                                    true,
                                    false,
                                    List.of("A", "B"),
                                    "ENABLED",
                                    5,
                                    "")),
                    "ENABLED",
                    List.of());

    private ExtensionScaleProof() {}

    static void run(BackendAcceptanceTest host, JdbcTemplate jdbc, ObjectMapper mapper) throws Exception {
        String evidenceText = System.getenv("V2S_EXTENSION_SCALE_EVIDENCE");
        assertTrue(evidenceText != null && !evidenceText.isBlank(), "V2S_EXTENSION_SCALE_EVIDENCE is required");
        Path evidencePath = Path.of(evidenceText);
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("schemaVersion", 1);
        evidence.put("proof", "extension-flat-list-scale");
        evidence.put("rowTargetPerTable", TOTAL_ROWS);
        evidence.put("sampleCountPerQuery", SAMPLE_COUNT);
        evidence.put("pageSize", PAGE_SIZE);
        evidence.put("scopeRule", "one isolated workspace; store and contract additionally constrained by one project");
        evidence.put("runtimeDdl", false);
        evidence.put("perKeyIndexes", false);
        try {
            BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", java.util.Set.of());
            long now = Instant.now().toEpochMilli();
            insertHeadCompany(jdbc, fixture, now);
            insertBaseContract(jdbc, fixture, now);
            List<TableSpec> tables = tableSpecs(fixture, now);
            List<Map<String, Object>> tableEvidenceRows = new ArrayList<>();
            List<Map<String, Object>> writes = new ArrayList<>();
            Map<String, Object> relationshipPreparation = Map.of();
            for (TableSpec table : tables) {
                Map<String, Object> write = writeTable(jdbc, table);
                writes.add(write);
                assertEquals(
                        TOTAL_ROWS,
                        count(
                                jdbc,
                                "SELECT COUNT(*) FROM " + table.fromSql() + " WHERE " + table.scopeSql(),
                                table.scopeParameters()),
                        "BUSINESS: " + table.name() + " scope contains exactly 100,000 rows");
                if ("head_company".equals(table.name())) {
                    relationshipPreparation = insertScaleBrandAuthorizations(jdbc, fixture, now);
                }
                Map<String, Object> tableEvidence = new LinkedHashMap<>();
                tableEvidence.put("table", table.qualifiedTable());
                tableEvidence.put("write", write);
                tableEvidence.put("indexesOnExtensionValues", extensionIndexes(jdbc, table));
                tableEvidenceRows.add(tableEvidence);
            }
            List<Map<String, Object>> operationEvidenceRows = new ArrayList<>();
            List<Map<String, Object>> queries = new ArrayList<>();
            Map<String, List<Map<String, Object>>> operationVariants = new LinkedHashMap<>();
            Map<String, List<Map<String, Object>>> groupedOperationQueries = new LinkedHashMap<>();
            for (OwnerOperation operation : ownerOperations(fixture)) {
                List<Map<String, Object>> variantQueries = new ArrayList<>();
                for (FilterCase query : filterCases()) {
                    ExtensionFilterQuery.Prepared filters =
                            prepareFilters(mapper, fixture, operation.hostType(), query.filters());
                    Map<String, Object> result = runQuery(jdbc, mapper, operation, query, filters);
                    variantQueries.add(result);
                    queries.add(result);
                }
                Map<String, Object> variantEvidence = new LinkedHashMap<>();
                variantEvidence.put("ownerClass", operation.ownerClass());
                variantEvidence.put("ownerMethod", operation.ownerMethod());
                variantEvidence.put("ownerSource", operation.ownerSource());
                variantEvidence.put("hostType", operation.hostType());
                variantEvidence.put("table", operation.table());
                variantEvidence.put("queryShape", Map.of("count", "COUNT", "page", "PAGE"));
                variantEvidence.put("scope", operation.scope());
                variantEvidence.put("joins", operation.joins());
                variantEvidence.put("unionAll", operation.unionAll());
                variantEvidence.put("sort", operation.sort());
                variantEvidence.put("queryCount", variantQueries.size());
                variantEvidence.put("queries", variantQueries);
                operationVariants
                        .computeIfAbsent(operation.operationId(), ignored -> new ArrayList<>())
                        .add(variantEvidence);
                groupedOperationQueries
                        .computeIfAbsent(operation.operationId(), ignored -> new ArrayList<>())
                        .addAll(variantQueries);
            }
            operationVariants.forEach((operationId, variants) -> {
                Map<String, Object> operationEvidence = new LinkedHashMap<>();
                operationEvidence.put("operationId", operationId);
                operationEvidence.put("variantCount", variants.size());
                operationEvidence.put(
                        "queryCount", groupedOperationQueries.get(operationId).size());
                operationEvidence.put("variants", variants);
                operationEvidence.put("queries", groupedOperationQueries.get(operationId));
                operationEvidenceRows.add(operationEvidence);
            });
            evidence.put(
                    "scope",
                    Map.of(
                            "workspaceUuid", fixture.workspaceUuid().toString(),
                            "groupWorkspaceKey", fixture.groupWorkspaceKey(),
                            "projectId", fixture.projectId().toString()));
            evidence.put(
                    "preloadedRows",
                    Map.of(
                            "organization.brand", 1,
                            "organization.tenant", 1,
                            "organization.head_company", 1,
                            "organization.store", 1,
                            "contract.store_contract", 1));
            evidence.put("writes", writes);
            evidence.put("relationshipPreparation", relationshipPreparation);
            evidence.put("queries", queries);
            evidence.put("tables", tableEvidenceRows);
            evidence.put("operations", operationEvidenceRows);
            evidence.put("operationCount", operationEvidenceRows.size());
            evidence.put(
                    "indexDecision",
                    Map.of(
                            "strategy", "BOUNDED_CORE_SCOPE_SCAN",
                            "jsonbIndexesAdded", false,
                            "perKeyExpressionIndexesAdded", false,
                            "runtimeDdl", false,
                            "reason",
                                    "measure the accepted JSONB persistence shape before considering one generic additive index"));
            evidence.put("status", "PASS");
            writeEvidence(mapper, evidencePath, evidence);
        } catch (Throwable failure) {
            evidence.put("status", "FAIL");
            evidence.put("failure", failure.getClass().getSimpleName() + ":" + String.valueOf(failure.getMessage()));
            writeEvidence(mapper, evidencePath, evidence);
            if (failure instanceof Exception exception) throw exception;
            if (failure instanceof Error error) throw error;
            throw new AssertionError(failure);
        }
    }

    private static Map<String, Object> insertScaleBrandAuthorizations(
            JdbcTemplate jdbc, BackendAcceptanceTest.Fixture fixture, long now) {
        String prefix = fixture.workspaceUuid().toString();
        long started = System.nanoTime();
        int inserted = jdbc.update(
                "INSERT INTO organization.head_company_brand_authorization "
                        + "(head_company_id, brand_id, authorized_at_epoch_millis) "
                        + "SELECT md5(? || ':head:' || gs::text)::uuid, "
                        + "md5(? || ':brand:' || gs::text)::uuid, ? "
                        + "FROM generate_series(1, "
                        + GENERATED_ROWS
                        + ") AS gs",
                prefix,
                prefix,
                now);
        assertEquals(GENERATED_ROWS, inserted, "BUSINESS: generated store brand authorizations");
        return Map.of(
                "table",
                "organization.head_company_brand_authorization",
                "rowsInserted",
                inserted,
                "writeStatementCount",
                1,
                "writeElapsedMs",
                elapsedMillis(started));
    }

    private static void insertHeadCompany(JdbcTemplate jdbc, BackendAcceptanceTest.Fixture fixture, long now) {
        UUID id = UUID.nameUUIDFromBytes(
                (SCALE_PREFIX + ":head-company").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        jdbc.update(
                "INSERT INTO organization.head_company (id, workspace_uuid, group_workspace_key, code, name, "
                        + "legal_name, credit_code, status, version, created_at_epoch_millis, updated_at_epoch_millis, "
                        + "remark, extension_values, extension_rule_revision) VALUES (?, ?, ?, 'scale-head-company', "
                        + "'Scale Head Company', 'Scale Head Company Ltd', '91310000SCALEHEAD', 'ENABLED', 1, ?, ?, NULL, "
                        + "'{}'::jsonb, 0)",
                id,
                fixture.workspaceUuid(),
                fixture.groupWorkspaceKey(),
                now,
                now);
    }

    private static void insertBaseContract(JdbcTemplate jdbc, BackendAcceptanceTest.Fixture fixture, long now) {
        UUID id =
                UUID.nameUUIDFromBytes((SCALE_PREFIX + ":contract").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        jdbc.update(
                "INSERT INTO contract.store_contract (id, workspace_uuid, group_workspace_key, contract_no, store_id, tenant_id, "
                        + "effective_from, effective_to, phase_name_snapshot, notes, items_json, extension_values, "
                        + "extension_rule_revision, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, "
                        + "'scale-base-contract', ?, ?, DATE '2026-01-01', NULL, 'Opening', 'Scale Base Contract', "
                        + "'[ {\"code\": \"scale-item\", \"name\": \"Scale Item\" } ]'::jsonb, '{}'::jsonb, 0, 'ACTIVE', 1, ?, ?)",
                id,
                fixture.workspaceUuid(),
                fixture.groupWorkspaceKey(),
                fixture.storeId(),
                fixture.tenantId(),
                now,
                now);
    }

    private static List<TableSpec> tableSpecs(BackendAcceptanceTest.Fixture fixture, long now) {
        String prefix = fixture.workspaceUuid().toString();
        String json = extensionJson();
        return List.of(
                new TableSpec(
                        "brand",
                        "organization.brand",
                        "organization.brand e",
                        "e.workspace_uuid=? AND e.group_workspace_key=?",
                        List.of(fixture.workspaceUuid(), fixture.groupWorkspaceKey()),
                        "INSERT INTO organization.brand (id, workspace_uuid, group_workspace_key, code, name, status, "
                                + "version, created_at_epoch_millis, updated_at_epoch_millis, alias, remark, extension_values, "
                                + "extension_rule_revision) SELECT md5(? || ':brand:' || gs::text)::uuid, ?, ?, "
                                + "'scale-brand-' || gs::text, 'Scale Brand ' || gs::text, 'ENABLED', 1, ?, ?, NULL, NULL, "
                                + json + ", 0 FROM generate_series(1, "
                                + GENERATED_ROWS
                                + ") AS gs",
                        List.of(prefix, fixture.workspaceUuid(), fixture.groupWorkspaceKey(), now, now)),
                new TableSpec(
                        "tenant",
                        "organization.tenant",
                        "organization.tenant e",
                        "e.workspace_uuid=? AND e.group_workspace_key=?",
                        List.of(fixture.workspaceUuid(), fixture.groupWorkspaceKey()),
                        "INSERT INTO organization.tenant (id, workspace_uuid, group_workspace_key, code, name, legal_name, "
                                + "credit_code, status, version, created_at_epoch_millis, updated_at_epoch_millis, remark, "
                                + "extension_values, extension_rule_revision) SELECT md5(? || ':tenant:' || gs::text)::uuid, ?, ?, "
                                + "'scale-tenant-' || gs::text, 'Scale Tenant ' || gs::text, 'Scale Tenant ' || gs::text || ' Ltd', "
                                + "'91310000SCALE' || lpad(gs::text, 6, '0'), 'ENABLED', 1, ?, ?, NULL, "
                                + json + ", 0 FROM generate_series(1, "
                                + GENERATED_ROWS
                                + ") AS gs",
                        List.of(prefix, fixture.workspaceUuid(), fixture.groupWorkspaceKey(), now, now)),
                new TableSpec(
                        "head_company",
                        "organization.head_company",
                        "organization.head_company e",
                        "e.workspace_uuid=? AND e.group_workspace_key=?",
                        List.of(fixture.workspaceUuid(), fixture.groupWorkspaceKey()),
                        "INSERT INTO organization.head_company (id, workspace_uuid, group_workspace_key, code, name, "
                                + "legal_name, credit_code, status, version, created_at_epoch_millis, updated_at_epoch_millis, "
                                + "remark, extension_values, extension_rule_revision) SELECT md5(? || ':head:' || gs::text)::uuid, ?, ?, "
                                + "'scale-head-' || gs::text, 'Scale Head ' || gs::text, 'Scale Head ' || gs::text || ' Ltd', "
                                + "'91310000SCALEH' || lpad(gs::text, 6, '0'), 'ENABLED', 1, ?, ?, NULL, "
                                + json + ", 0 FROM generate_series(1, "
                                + GENERATED_ROWS
                                + ") AS gs",
                        List.of(prefix, fixture.workspaceUuid(), fixture.groupWorkspaceKey(), now, now)),
                new TableSpec(
                        "store",
                        "organization.store",
                        "organization.store e",
                        "e.workspace_uuid=? AND e.group_workspace_key=? AND e.project_id=?",
                        List.of(fixture.workspaceUuid(), fixture.groupWorkspaceKey(), fixture.projectId()),
                        "INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, brand_id, "
                                + "head_company_id, code, name, status, version, created_at_epoch_millis, updated_at_epoch_millis, "
                                + "notes, extension_values, extension_rule_revision) SELECT md5(? || ':store:' || gs::text)::uuid, ?, ?, ?, "
                                + "md5(? || ':tenant:' || gs::text)::uuid, md5(? || ':brand:' || gs::text)::uuid, "
                                + "md5(? || ':head:' || gs::text)::uuid, 'scale-store-' || gs::text, 'Scale Store ' || gs::text, 'ENABLED', 1, ?, ?, NULL, "
                                + json + ", 0 FROM generate_series(1, "
                                + GENERATED_ROWS
                                + ") AS gs",
                        List.of(
                                prefix,
                                fixture.workspaceUuid(),
                                fixture.groupWorkspaceKey(),
                                fixture.projectId(),
                                prefix,
                                prefix,
                                prefix,
                                now,
                                now)),
                new TableSpec(
                        "contract",
                        "contract.store_contract",
                        "contract.store_contract e JOIN organization.store s ON s.id=e.store_id",
                        "e.workspace_uuid=? AND e.group_workspace_key=? AND s.project_id=?",
                        List.of(fixture.workspaceUuid(), fixture.groupWorkspaceKey(), fixture.projectId()),
                        "INSERT INTO contract.store_contract (id, workspace_uuid, group_workspace_key, contract_no, store_id, tenant_id, "
                                + "effective_from, effective_to, phase_name_snapshot, notes, items_json, extension_values, "
                                + "extension_rule_revision, status, version, created_at_epoch_millis, updated_at_epoch_millis) SELECT "
                                + "md5(? || ':contract:' || gs::text)::uuid, ?, ?, 'scale-contract-' || gs::text, "
                                + "md5(? || ':store:' || gs::text)::uuid, md5(? || ':tenant:' || gs::text)::uuid, DATE '2026-01-01', NULL, "
                                + "'Opening', 'Scale Contract', '[{\"code\":\"scale-item\",\"name\":\"Scale Item\"}]'::jsonb, "
                                + json + ", 0, 'ACTIVE', 1, ?, ? FROM generate_series(1, "
                                + GENERATED_ROWS
                                + ") AS gs",
                        List.of(
                                prefix,
                                fixture.workspaceUuid(),
                                fixture.groupWorkspaceKey(),
                                prefix,
                                prefix,
                                now,
                                now)));
    }

    private static String extensionJson() {
        return "jsonb_build_object('scale_text', CASE WHEN gs % 1000 = 0 THEN 'scale-needle-' || gs::text "
                + "ELSE 'scale-value-' || gs::text END, 'scale_number', gs, 'scale_date', "
                + "to_char(DATE '2026-01-01' + (gs % 365)::integer, 'YYYY-MM-DD'), 'scale_boolean', (gs % 2 = 0), "
                + "'scale_select', CASE WHEN gs % 2 = 0 THEN 'A' ELSE 'B' END)";
    }

    private static Map<String, Object> writeTable(JdbcTemplate jdbc, TableSpec table) {
        Map<String, Long> before = tableSizeSnapshot(jdbc, table.qualifiedTable());
        long started = System.nanoTime();
        int inserted = jdbc.update(table.insertSql(), table.insertParameters().toArray());
        long elapsed = elapsedMillis(started);
        Map<String, Long> after = tableSizeSnapshot(jdbc, table.qualifiedTable());
        assertEquals(GENERATED_ROWS, inserted, "BUSINESS: " + table.name() + " generated rows inserted");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("table", table.qualifiedTable());
        result.put("rowsInserted", inserted);
        result.put("writeStatementCount", 1);
        result.put("writeElapsedMs", elapsed);
        result.put("storageBefore", before);
        result.put("storageAfter", after);
        result.put(
                "storageDelta",
                Map.of(
                        "heapBytes", after.get("heapBytes") - before.get("heapBytes"),
                        "indexBytes", after.get("indexBytes") - before.get("indexBytes"),
                        "totalRelationBytes", after.get("totalRelationBytes") - before.get("totalRelationBytes")));
        return result;
    }

    private static List<OwnerOperation> ownerOperations(BackendAcceptanceTest.Fixture fixture) {
        List<OwnerOperation> result = new ArrayList<>();
        result.add(
                businessOperation(
                        fixture,
                        "getOperationsOrganizationBrands",
                        "BRAND",
                        true,
                        "BusinessEntityTaskReadPersistence#pageBusinessEntities",
                        "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadPersistence.java:369-473"));
        result.add(
                businessOperation(
                        fixture,
                        "getOperationsOrganizationTenants",
                        "TENANT",
                        false,
                        "BusinessEntityTaskReadPersistence#pageBusinessEntities",
                        "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadPersistence.java:369-473"));
        result.add(
                businessOperation(
                        fixture,
                        "getOperationsOrganizationHeadCompanies",
                        "HEAD_COMPANY",
                        false,
                        "BusinessEntityTaskReadPersistence#pageBusinessEntities",
                        "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadPersistence.java:369-473"));
        for (String hostType : List.of("BRAND", "TENANT", "HEAD_COMPANY")) {
            result.add(
                    businessOperation(
                            fixture,
                            "getPlatformOrganizationOverviewPage",
                            hostType,
                            false,
                            "OrganizationOverviewTaskReadPersistence#page -> BusinessEntityTaskReadPersistence#pageBusinessEntities",
                            "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java:78-101; apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadPersistence.java:369-473"));
        }
        result.add(
                storeOperation(
                        fixture,
                        "getOperationsOrganizationStores",
                        "OrganizationOverviewTaskReadPersistence#storePage",
                        "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java:521-566"));
        result.add(
                storeOperation(
                        fixture,
                        "getPlatformOrganizationOverviewPage",
                        "OrganizationOverviewTaskReadPersistence#platformOverviewTaskPage -> page -> storePage",
                        "apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java:78-166,521-566"));
        result.add(
                contractOperation(
                        fixture,
                        "getOperationsContracts",
                        "ContractTaskReadPersistence#list",
                        "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/persistence/ContractTaskReadPersistence.java:212-300"));
        result.add(
                contractOperation(
                        fixture,
                        "getPlatformContractOverviewPage",
                        "ContractTaskReadPersistence#taskPage -> list",
                        "apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/persistence/ContractTaskReadPersistence.java:212-305"));
        return List.copyOf(result);
    }

    private static OwnerOperation businessOperation(
            BackendAcceptanceTest.Fixture fixture,
            String operationId,
            String hostType,
            boolean brandQueryText,
            String ownerMethod,
            String ownerSource) {
        String rows = businessEntityRowsSql();
        String from =
                BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE + rows + ") entities";
        String predicate = brandQueryText
                ? BusinessEntityTaskReadServiceSql.BRAND_PAGE_PREDICATE
                : BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_OPEN_PAREN_TEXT_LOWER_NAME_LIKE
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_PARAMETER_PLACEHOLDER_TEXT_LOWER_LEGAL_NAME_LIKE
                        + BusinessEntityTaskReadServiceSql
                                .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_LOWER_CREDIT_CODE_LIKE_TEXT
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_TEXT_ENTITY_TYPE;
        return new OwnerOperation(
                operationId,
                "BusinessEntityTaskReadPersistence",
                ownerMethod,
                ownerSource,
                hostType,
                switch (hostType) {
                    case "BRAND" -> "organization.brand";
                    case "TENANT" -> "organization.tenant";
                    case "HEAD_COMPANY" -> "organization.head_company";
                    default -> throw new IllegalArgumentException("unsupported scale host type");
                },
                "SELECT count(*)",
                from,
                " WHERE " + predicate,
                BusinessEntityTaskReadServiceSql.SELECT_PREFIX
                        + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_PROJECTION,
                from,
                " WHERE " + predicate,
                BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_ORDER_BY
                        + BusinessEntityTaskReadServiceSql.ENTITY_ORDER_NAME
                        + BusinessEntityTaskReadServiceSql.SQL_SPACE
                        + BusinessEntityTaskReadServiceSql.SORT_DIRECTION_ASC
                        + BusinessEntityTaskReadServiceSql.ENTITY_PAGE_ORDER_SUFFIX,
                "entities.extension_values",
                businessParameters(fixture, hostType, brandQueryText),
                "workspace + group workspace; entity type fixed by operation",
                List.of("UNION ALL organization.brand/tenant/head_company"),
                true,
                "name ASC, id ASC");
    }

    private static OwnerOperation storeOperation(
            BackendAcceptanceTest.Fixture fixture, String operationId, String ownerMethod, String ownerSource) {
        String rows = storeRowsSql();
        String from = rows.substring(rows.indexOf(
                OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_FROM_CLAUSE));
        String base = storeBaseFilters();
        String pageWhere = base
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_ID_BRAND_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ID_HEAD_COMPANY_ID;
        String countWhere = base
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_PROJECT_ID_BRAND_ID_ALTERNATE_A
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_OPEN_PAREN_TENANT_ID_HEAD_COMPANY_ID;
        return new OwnerOperation(
                operationId,
                "OrganizationOverviewTaskReadPersistence",
                ownerMethod,
                ownerSource,
                "STORE",
                "organization.store",
                OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_SELECT_COUNT,
                from,
                countWhere,
                "",
                rows,
                pageWhere,
                OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ORDER_BY
                        + OrganizationOverviewTaskReadServiceSql.STORE_UPDATED_ORDER
                        + OrganizationOverviewTaskReadServiceSql.SQL_SPACE
                        + OrganizationOverviewTaskReadServiceSql.SORT_DIRECTION_DESC
                        + OrganizationOverviewTaskReadServiceSql.STORE_PAGE_ORDER_SUFFIX,
                "s.extension_values",
                storeParameters(fixture),
                "workspace + group workspace + project",
                List.of(
                        "organization.organization_node p",
                        "organization.brand b",
                        "organization.tenant t",
                        "organization.head_company h LEFT JOIN"),
                false,
                "s.updated_at_epoch_millis DESC, s.id DESC");
    }

    private static OwnerOperation contractOperation(
            BackendAcceptanceTest.Fixture fixture, String operationId, String ownerMethod, String ownerSource) {
        String select =
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_GROUP_WORKSPACE_KEY_CONTRACT_NO_CODE_NAME
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_TENANT_ID_CODE_NAME_PHASE_NAME_SNAPSHOT
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_STATUS
                        + ContractTaskReadServiceSql
                                .CONTRACT_TASK_READ_SERVICE_EXTENSION_VALUES_TEXT_EXTENSION_RULE_REVISION_ITEMS_JSON;
        String from = ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_FROM_CLAUSE_STORE_STORE_ID_ALTERNATE_A
                + ContractTaskReadServiceSql
                        .CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_TENANT_ORGANIZATION_NODE_PROJECT_ID_ALTERNATE_A
                + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_TENANT_ID_ALTERNATE_A;
        String where =
                ContractTaskReadServiceSql
                                .CONTRACT_TASK_READ_SERVICE_WHERE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_PROJECT_ID
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CONDITION_STORE_ID_TENANT_ID_TEXT
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ALTERNATIVE_CONTRACT_NO_ILIKE_ESCAPE
                        + ContractTaskReadServiceSql
                                .CONTRACT_TASK_READ_SERVICE_CONDITION_TEXT_PHASE_NAME_SNAPSHOT_ILIKE_ESCAPE
                        + ContractTaskReadServiceSql
                                .CONTRACT_TASK_READ_SERVICE_CONDITION_JSONB_ARRAY_ELEMENTS_TEXT_ITEMS_JSON
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_CODE_ILIKE_ESCAPE
                        + ContractTaskReadServiceSql
                                .CONTRACT_TASK_READ_SERVICE_CONDITION_DATE_EFFECTIVE_FROM_EFFECTIVE_TO
                        + ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_EFFECTIVE_TO_TEXT_STATUS;
        return new OwnerOperation(
                operationId,
                "ContractTaskReadPersistence",
                ownerMethod,
                ownerSource,
                "CONTRACT",
                "contract.store_contract",
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_SELECT_SELECT_COUNT_ALTERNATE_A,
                from,
                where,
                select,
                from,
                where,
                ContractTaskReadServiceSql.CONTRACT_TASK_READ_SERVICE_ORDER_BY
                        + ContractTaskReadServiceSql.UPDATED_AT_ORDER
                        + ContractTaskReadServiceSql.SQL_SPACE
                        + ContractTaskReadServiceSql.SORT_DIRECTION_DESC
                        + ContractTaskReadServiceSql.CONTRACT_PAGE_TIE_BREAKER_SUFFIX,
                "c.extension_values",
                contractParameters(fixture),
                "workspace + group workspace + project + store/tenant joins",
                List.of("organization.store s", "organization.organization_node p", "organization.tenant t"),
                false,
                "c.updated_at_epoch_millis DESC, c.id ASC");
    }

    private static String businessEntityRowsSql() {
        return BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_SELECT_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME_ALTERNATE_D
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_CREDIT_CODE_ALIAS_REMARK_VARCHAR
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_CREATED_AT_EPOCH_MILLIS_EXTENSION_VALUES
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_FROM_CLAUSE_ALTERNATE_B
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_ALTERNATIVE_BRAND_WORKSPACE_UUID_GROUP_WORKSPACE_KEY
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_CODE_NAME
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_REMARK_VARCHAR_NOTES_STATUS
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_UPDATE_TENANT_EXTENSION_VALUES
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_WHERE
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_A
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY_ALTERNATE_C
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_CODE_NAME_LEGAL_NAME_CREDIT_CODE
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_STATUS
                + BusinessEntityTaskReadServiceSql.BUSINESS_ENTITY_TASK_READ_SERVICE_VERSION_ALTERNATE_B
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_HEAD_COMPANY_EXTENSION_VALUES_ENTITY_TYPE
                + BusinessEntityTaskReadServiceSql
                        .BUSINESS_ENTITY_TASK_READ_SERVICE_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_ALTERNATE_B;
    }

    private static String storeRowsSql() {
        return OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_SELECT_CODE_NAME_STATUS_VERSION
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_UPDATED_AT_EPOCH_MILLIS_NOTES_PROJECT_ID_CODE
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_PROJECT_NAME
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_BRAND_ID_CODE_BRAND_CODE_NAME_ALTERNATE_A
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_CODE
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_NAME_TENANT_NAME_HEAD_ID_CODE_ALTERNATE_A
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_ORGANIZATION_NODE_STORE_PROJECT_ID_ALTERNATE_A
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_BRAND
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_TENANT_BRAND_ID_TENANT_ID
                + OrganizationOverviewTaskReadServiceSql
                        .ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_ALTERNATIVE_HEAD_COMPANY
                + OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_HEAD_COMPANY_ID;
    }

    private static String storeBaseFilters() {
        return OrganizationOverviewTaskReadServiceSql.ORGANIZATION_OVERVIEW_TASK_READ_SERVICE_CONDITION_TEXT
                + OrganizationOverviewTaskReadServiceSql.STORE_ALIAS_PREFIX
                + OrganizationOverviewTaskReadServiceSql.BASE_FILTER_NAME_SUFFIX
                + OrganizationOverviewTaskReadServiceSql.STORE_ALIAS_PREFIX
                + OrganizationOverviewTaskReadServiceSql.BASE_FILTER_CODE_SUFFIX
                + OrganizationOverviewTaskReadServiceSql.BASE_FILTER_STATUS_SUFFIX;
    }

    private static List<Object> businessParameters(
            BackendAcceptanceTest.Fixture fixture, String hostType, boolean brandQueryText) {
        List<Object> values = new ArrayList<>();
        for (int index = 0; index < 3; index++) {
            values.add(fixture.workspaceUuid());
            values.add(fixture.groupWorkspaceKey());
        }
        if (brandQueryText) {
            values.add(null);
            values.add(null);
            values.add(null);
            values.add(null);
            values.add(null);
            values.add(hostType);
            values.add(hostType);
        } else {
            for (int index = 0; index < 8; index++) values.add(null);
            values.add(null);
            values.add(null);
            values.add(hostType);
            values.add(hostType);
        }
        return Collections.unmodifiableList(new ArrayList<>(values));
    }

    private static List<Object> storeParameters(BackendAcceptanceTest.Fixture fixture) {
        List<Object> values = new ArrayList<>();
        values.add(fixture.workspaceUuid());
        values.add(fixture.groupWorkspaceKey());
        values.add(null);
        values.add(null);
        values.add(null);
        values.add(null);
        values.add(null);
        values.add(null);
        values.add(fixture.projectId());
        values.add(fixture.projectId());
        for (int index = 0; index < 6; index++) values.add(null);
        return Collections.unmodifiableList(new ArrayList<>(values));
    }

    private static List<Object> contractParameters(BackendAcceptanceTest.Fixture fixture) {
        List<Object> values = new ArrayList<>();
        values.add(fixture.workspaceUuid());
        values.add(fixture.groupWorkspaceKey());
        values.add(fixture.projectId());
        values.add(fixture.projectId());
        for (int index = 0; index < 16; index++) values.add(null);
        return Collections.unmodifiableList(new ArrayList<>(values));
    }

    private static List<FilterCase> filterCases() {
        return List.of(
                new FilterCase("empty", List.of(), 0),
                new FilterCase("equality-number", List.of(new FilterSpec("scale_number", "NUMBER", "42")), 0),
                new FilterCase("text-contains", List.of(new FilterSpec("scale_text", "TEXT", "needle")), 0),
                new FilterCase(
                        "and-text-and-boolean",
                        List.of(
                                new FilterSpec("scale_text", "TEXT", "needle"),
                                new FilterSpec("scale_boolean", "BOOLEAN", "true")),
                        0),
                new FilterCase("no-match", List.of(new FilterSpec("scale_text", "TEXT", "no-such-scale-value")), 0),
                new FilterCase("cross-page-text", List.of(new FilterSpec("scale_text", "TEXT", "needle")), PAGE_SIZE));
    }

    private static ExtensionFilterQuery.Prepared prepareFilters(
            ObjectMapper mapper, BackendAcceptanceTest.Fixture fixture, String hostType, List<FilterSpec> filters)
            throws Exception {
        List<Map<String, String>> wire = filters.stream()
                .map(filter -> Map.of("fieldKey", filter.fieldKey(), "type", filter.type(), "value", filter.value()))
                .toList();
        return ExtensionFilterQuery.prepare(
                SCALE_DEFINITION,
                fixture.workspaceUuid(),
                fixture.groupWorkspaceKey(),
                hostType,
                mapper.writeValueAsString(wire),
                filters.isEmpty() ? null : "1");
    }

    private static Map<String, Object> runQuery(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            OwnerOperation operation,
            FilterCase query,
            ExtensionFilterQuery.Prepared filters)
            throws Exception {
        String extension = filters.isEmpty() ? "" : " AND " + filters.predicate(operation.extensionColumn());
        String countSql = operation.countSqlPrefix() + operation.countFromSql() + operation.countWhereSql() + extension;
        String pageSql = operation.pageSqlPrefix()
                + operation.pageFromSql()
                + operation.pageWhereSql()
                + extension
                + operation.pageOrderSql();
        List<Object> parameters = new ArrayList<>(operation.baseParameters());
        parameters.addAll(filters.parameters());
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(PAGE_SIZE);
        pageParameters.add(query.offset());
        long total = count(jdbc, countSql, parameters);
        int pageItems = jdbc.queryForList(pageSql, pageParameters.toArray()).size();
        List<Map<String, Object>> samples = new ArrayList<>();
        for (int sample = 0; sample < SAMPLE_COUNT; sample++) {
            Map<String, Object> measurement = new LinkedHashMap<>();
            measurement.put("count", explain(jdbc, mapper, countSql, parameters));
            measurement.put("page", explain(jdbc, mapper, pageSql, pageParameters));
            samples.add(measurement);
        }
        List<Double> countTimes = executionTimes(samples, "count");
        List<Double> pageTimes = executionTimes(samples, "page");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("operationId", operation.operationId());
        result.put("ownerClass", operation.ownerClass());
        result.put("ownerMethod", operation.ownerMethod());
        result.put("ownerSource", operation.ownerSource());
        result.put("hostType", operation.hostType());
        result.put("table", operation.table());
        result.put("query", query.name());
        result.put("queryShape", Map.of("count", "COUNT", "page", "PAGE"));
        result.put("scope", operation.scope());
        result.put("joins", operation.joins());
        result.put("unionAll", operation.unionAll());
        result.put("sort", operation.sort());
        result.put("definitionRevision", filters.definitionRevision());
        result.put("parameterSummary", parameterSummary(parameters, pageParameters));
        result.put("total", total);
        result.put("page", query.offset() / PAGE_SIZE + 1);
        result.put("pageSize", PAGE_SIZE);
        result.put("pageItems", pageItems);
        result.put(
                "executionTimeMs",
                Map.of(
                        "countP95", percentile95(countTimes),
                        "countMax",
                                countTimes.stream()
                                        .mapToDouble(Double::doubleValue)
                                        .max()
                                        .orElse(0D),
                        "pageP95", percentile95(pageTimes),
                        "pageMax",
                                pageTimes.stream()
                                        .mapToDouble(Double::doubleValue)
                                        .max()
                                        .orElse(0D)));
        result.put("recheck", recheckSummary(samples));
        result.put("samples", samples);
        if ("empty".equals(query.name()))
            assertEquals(TOTAL_ROWS, total, "BUSINESS: empty owner scope returns 100,000 rows");
        if ("equality-number".equals(query.name())) assertTrue(total > 0, "BUSINESS: equality returns rows");
        if ("text-contains".equals(query.name())) assertTrue(total > 0, "BUSINESS: TEXT contains returns rows");
        if ("and-text-and-boolean".equals(query.name())) assertTrue(total > 0, "BUSINESS: typed AND returns rows");
        if ("no-match".equals(query.name())) assertEquals(0, total, "BUSINESS: no-match returns zero rows");
        if ("cross-page-text".equals(query.name()))
            assertTrue(pageItems > 0, "BUSINESS: cross-page returns later rows");
        return result;
    }

    private static List<Double> executionTimes(List<Map<String, Object>> samples, String queryShape) {
        return samples.stream()
                .map(sample -> sample.get(queryShape))
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .map(value -> ((Number) value.get("executionTimeMs")).doubleValue())
                .sorted()
                .toList();
    }

    private static Map<String, Object> parameterSummary(List<Object> countParameters, List<Object> pageParameters) {
        Map<String, Integer> countTypes = parameterTypes(countParameters);
        Map<String, Integer> pageTypes = parameterTypes(pageParameters);
        return Map.of(
                "count",
                countParameters.size(),
                "page",
                pageParameters.size(),
                "countTypes",
                countTypes,
                "pageTypes",
                pageTypes,
                "rawValuesIncluded",
                false);
    }

    private static Map<String, Integer> parameterTypes(List<Object> parameters) {
        Map<String, Integer> types = new LinkedHashMap<>();
        for (Object value : parameters) {
            String type = value == null ? "NULL" : value.getClass().getSimpleName();
            types.merge(type, 1, Integer::sum);
        }
        return Map.copyOf(types);
    }

    private static Map<String, Object> explain(
            JdbcTemplate jdbc, ObjectMapper mapper, String sql, List<Object> parameters) throws Exception {
        String explainSql = "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + sql;
        String json = jdbc.query(
                explainSql,
                statement -> {
                    for (int index = 0; index < parameters.size(); index++)
                        statement.setObject(index + 1, parameters.get(index));
                },
                result -> {
                    StringBuilder value = new StringBuilder();
                    while (result.next()) value.append(result.getString(1));
                    return value.toString();
                });
        JsonNode root = mapper.readTree(json);
        JsonNode plan = root.isArray() ? root.path(0) : root;
        double planning = plan.path("Planning Time").asDouble(-1);
        double execution = plan.path("Execution Time").asDouble(-1);
        assertTrue(planning >= 0 && execution >= 0, "BUSINESS: PostgreSQL EXPLAIN timing is present");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("planningTimeMs", planning);
        result.put("executionTimeMs", execution);
        List<Map<String, Object>> planNodes = new ArrayList<>();
        collectPlanNodes(plan.path("Plan"), planNodes);
        result.put("planNodes", planNodes);
        result.put("plan", plan);
        return result;
    }

    private static void collectPlanNodes(JsonNode node, List<Map<String, Object>> result) {
        if (node == null || node.isMissingNode() || !node.isObject()) return;
        Map<String, Object> summary = new LinkedHashMap<>();
        putText(summary, "nodeType", node, "Node Type");
        putText(summary, "relationName", node, "Relation Name");
        putText(summary, "indexName", node, "Index Name");
        putText(summary, "filter", node, "Filter");
        putText(summary, "recheckCondition", node, "Recheck Cond");
        putNumber(summary, "actualRows", node, "Actual Rows");
        putNumber(summary, "actualLoops", node, "Actual Loops");
        putNumber(summary, "rowsRemovedByFilter", node, "Rows Removed by Filter");
        putNumber(summary, "rowsRemovedByIndexRecheck", node, "Rows Removed by Index Recheck");
        putNumber(summary, "sharedHitBlocks", node, "Shared Hit Blocks");
        putNumber(summary, "sharedReadBlocks", node, "Shared Read Blocks");
        putNumber(summary, "sharedDirtiedBlocks", node, "Shared Dirtied Blocks");
        putNumber(summary, "sharedWrittenBlocks", node, "Shared Written Blocks");
        result.add(summary);
        JsonNode children = node.path("Plans");
        if (children.isArray()) for (JsonNode child : children) collectPlanNodes(child, result);
    }

    private static void putText(Map<String, Object> target, String key, JsonNode node, String source) {
        String value = node.path(source).asText("");
        if (!value.isBlank()) target.put(key, value);
    }

    private static void putNumber(Map<String, Object> target, String key, JsonNode node, String source) {
        JsonNode value = node.path(source);
        if (value.isNumber()) target.put(key, value.numberValue());
    }

    private static Map<String, Object> recheckSummary(List<Map<String, Object>> samples) {
        List<String> conditions = new ArrayList<>();
        long rowsRemoved = 0L;
        for (Map<String, Object> sample : samples) {
            for (String queryShape : List.of("count", "page")) {
                Object measurementValue = sample.get(queryShape);
                if (!(measurementValue instanceof Map<?, ?> measurement)) continue;
                Object nodesValue = measurement.get("planNodes");
                if (!(nodesValue instanceof List<?> nodes)) continue;
                for (Object nodeValue : nodes) {
                    if (!(nodeValue instanceof Map<?, ?> node)) continue;
                    Object condition = node.get("recheckCondition");
                    if (condition instanceof String text && !text.isBlank()) conditions.add(queryShape + ":" + text);
                    Object removed = node.get("rowsRemovedByIndexRecheck");
                    if (removed instanceof Number number) rowsRemoved += number.longValue();
                }
            }
        }
        return Map.of("conditions", List.copyOf(conditions), "rowsRemovedByIndexRecheck", rowsRemoved);
    }

    private static List<String> extensionIndexes(JdbcTemplate jdbc, TableSpec table) {
        String[] parts = table.qualifiedTable().split("\\.", 2);
        List<String> values = jdbc.queryForList(
                "SELECT indexname FROM pg_indexes WHERE schemaname=? AND tablename=? AND indexdef ILIKE '%extension_values%' "
                        + "ORDER BY indexname",
                String.class, parts[0], parts[1]);
        assertTrue(values.isEmpty(), "BUSINESS: no extension_values index is added by scale proof");
        return List.copyOf(values);
    }

    private static long count(JdbcTemplate jdbc, String sql, List<Object> parameters) {
        Long value = jdbc.queryForObject(sql, Long.class, parameters.toArray());
        return value == null ? 0L : value;
    }

    private static Map<String, Long> tableSizeSnapshot(JdbcTemplate jdbc, String qualifiedTable) {
        Map<String, Object> values = jdbc.queryForMap(
                "SELECT pg_relation_size(?::regclass) AS heap_bytes, pg_indexes_size(?::regclass) AS index_bytes, "
                        + "pg_total_relation_size(?::regclass) AS total_relation_bytes",
                qualifiedTable,
                qualifiedTable,
                qualifiedTable);
        return Map.of(
                "heapBytes", ((Number) values.get("heap_bytes")).longValue(),
                "indexBytes", ((Number) values.get("index_bytes")).longValue(),
                "totalRelationBytes", ((Number) values.get("total_relation_bytes")).longValue());
    }

    private static long elapsedMillis(long started) {
        return Math.max(0L, (System.nanoTime() - started) / 1_000_000L);
    }

    private static double percentile95(List<Double> sorted) {
        if (sorted.isEmpty()) return 0D;
        int index = Math.min(sorted.size() - 1, Math.max(0, (int) Math.ceil(sorted.size() * 0.95D) - 1));
        return sorted.get(index);
    }

    private static void writeEvidence(ObjectMapper mapper, Path path, Map<String, Object> evidence) throws Exception {
        Path parent = path.getParent();
        if (parent != null) Files.createDirectories(parent);
        Files.writeString(path, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(evidence) + "\n");
    }

    private record TableSpec(
            String name,
            String qualifiedTable,
            String fromSql,
            String scopeSql,
            List<Object> scopeParameters,
            String insertSql,
            List<Object> insertParameters) {}

    private record OwnerOperation(
            String operationId,
            String ownerClass,
            String ownerMethod,
            String ownerSource,
            String hostType,
            String table,
            String countSqlPrefix,
            String countFromSql,
            String countWhereSql,
            String pageSqlPrefix,
            String pageFromSql,
            String pageWhereSql,
            String pageOrderSql,
            String extensionColumn,
            List<Object> baseParameters,
            String scope,
            List<String> joins,
            boolean unionAll,
            String sort) {}

    private record FilterCase(String name, List<FilterSpec> filters, int offset) {}

    private record FilterSpec(String fieldKey, String type, String value) {}
}
