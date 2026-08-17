package com.catering.v2s.fulfillment.production.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** QG-09: production copy preflight and execute preserve the same typed source-fact failures. */
@Testcontainers
class ProductionTagCopyPreflightIntegrationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID TARGET_SCOPE = UUID.randomUUID();
    private static final String BRAND = "QG09-PRODUCTION";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;
    private static ProductionTagOwnerService service;

    @BeforeAll
    static void setup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .load()
                .migrate();
        jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        service = new ProductionTagOwnerService(jdbc, MAPPER, () -> 1_785_000_000_000L);
    }

    @AfterAll
    static void cleanup() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .cleanDisabled(false)
                .load()
                .clean();
    }

    @Test
    void emptySourceReferenceSetIsAValidNoOp() {
        JsonNode result = preflight(UUID.randomUUID(), requestWithRefs());

        assertEquals("", result.path("firstBlockingProblem").asText());
        assertEquals(0, result.path("compatibilityResults").size());
        assertEquals(0, result.path("referenceMappings").size());
    }

    @Test
    void multipleSourcesUseTheSetReadAndPreserveEachCompatibilityResult() {
        UUID sourceScope = UUID.randomUUID();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        insertTag(first, sourceScope, "FIRST", "ENABLED", 1);
        insertTag(second, sourceScope, "SECOND", "ENABLED", 1);

        JsonNode result = preflight(sourceScope, requestWithRefs(first, second));

        assertEquals("", result.path("firstBlockingProblem").asText());
        assertEquals(
                List.of("CREATE", "CREATE"), result.path("compatibilityResults").findValuesAsText("result"));
    }

    @Test
    void missingSourceIsATypedBlockingResult() {
        JsonNode result = preflight(UUID.randomUUID(), requestWithRefs(UUID.randomUUID()));

        assertEquals(
                "REFERENCE_MAPPING_UNRESOLVED",
                result.path("firstBlockingProblem").asText());
        assertEquals(
                "BLOCKED",
                result.path("compatibilityResults").path(0).path("result").asText());
        assertEquals(
                "REFERENCE_MAPPING_UNRESOLVED",
                result.path("compatibilityResults").path(0).path("problemCode").asText());
    }

    @Test
    void duplicateSourceRefsAreRejectedBeforeTheOwnerRead() {
        UUID sourceRef = UUID.randomUUID();

        ProductionTagOwnerApi.Problem failure = assertThrows(
                ProductionTagOwnerApi.Problem.class,
                () -> preflight(UUID.randomUUID(), requestWithRefs(sourceRef, sourceRef)));

        assertEquals("REFERENCE_MAPPING_UNRESOLVED", failure.code());
        assertEquals(422, failure.status());
    }

    @Test
    void voidedSourceIsBlockedDuringPreflightInsteadOfBeingPlannedForCreate() {
        UUID sourceScope = UUID.randomUUID();
        UUID sourceRef = UUID.randomUUID();
        insertTag(sourceRef, sourceScope, "VOIDED-SOURCE", "VOIDED", 2);

        JsonNode result = preflight(sourceScope, requestWithRefs(sourceRef));

        assertEquals(
                "REFERENCE_MAPPING_UNRESOLVED",
                result.path("firstBlockingProblem").asText());
        assertEquals(
                "BLOCKED",
                result.path("compatibilityResults").path(0).path("result").asText());
        assertEquals(
                "REFERENCE_MAPPING_UNRESOLVED",
                result.path("compatibilityResults").path(0).path("reasonCode").asText());
    }

    @Test
    void executeRejectsAValidPreflightAfterTheSourceChanges() {
        UUID sourceScope = UUID.randomUUID();
        UUID sourceRef = UUID.randomUUID();
        insertTag(sourceRef, sourceScope, "STALE-SOURCE", "ENABLED", 1);
        ObjectNode request = requestWithRefs(sourceRef);
        JsonNode preflight = preflight(sourceScope, request);
        request.put("productionPreflightDigest", preflight.path("digest").asText());
        jdbc.update(
                "UPDATE fulfillment_production.production_tag_definition SET version=version+1 WHERE tag_ref=?",
                sourceRef);

        ProductionTagOwnerApi.Problem failure = assertThrows(
                ProductionTagOwnerApi.Problem.class,
                () -> service.copy(
                        sourceScope.toString(),
                        TARGET_SCOPE.toString(),
                        BRAND,
                        request,
                        "qg09-stale",
                        "qg09-stale-receipt",
                        WORKSPACE,
                        "qg09-production",
                        "STORE",
                        grant(TARGET_SCOPE)));

        assertEquals("STALE_COPY_PREFLIGHT", failure.code());
        assertEquals(409, failure.status());
    }

    private static JsonNode preflight(UUID sourceScope, ObjectNode request) {
        return service.preflightCopy(
                sourceScope.toString(),
                TARGET_SCOPE.toString(),
                BRAND,
                request,
                WORKSPACE,
                "qg09-production",
                "STORE",
                grant(TARGET_SCOPE));
    }

    private static ObjectNode requestWithRefs(UUID... refs) {
        ObjectNode request = MAPPER.createObjectNode();
        var values = request.putArray("productionTagRefs");
        for (UUID ref : refs) values.add(ref.toString());
        return request;
    }

    private static void insertTag(UUID ref, UUID scope, String code, String status, long version) {
        jdbc.update(
                "INSERT INTO fulfillment_production.production_tag_definition "
                        + "(tag_ref,data_node_ref,brand_ref,code,tag_kind,name,status,version,created_at_epoch_millis,"
                        + "updated_at_epoch_millis) VALUES (?,?,?,?,?,?,?,?,?,?)",
                ref,
                scope.toString(),
                BRAND,
                code,
                "PRODUCTION",
                code,
                status,
                version,
                1_785_000_000_000L,
                1_785_000_000_000L);
    }

    private static OperationsOwnerScopeGrant grant(UUID targetScope) {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                "qg09-production",
                "QG09_PRODUCTION",
                "EDIT_STORE_CATALOG",
                "STORE",
                targetScope,
                "STORE",
                targetScope,
                List.of(targetScope));
    }
}
