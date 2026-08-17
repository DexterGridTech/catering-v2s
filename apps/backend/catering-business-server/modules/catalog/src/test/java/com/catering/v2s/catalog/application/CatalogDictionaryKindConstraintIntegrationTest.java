package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class CatalogDictionaryKindConstraintIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .load()
                .migrate();
        jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    }

    @Test
    void closesDictionaryKindToOwnerWriteVocabularyWithoutRemovingParentConstraint() {
        List<String> checkConstraints = jdbc.queryForList(
                "SELECT conname FROM pg_constraint WHERE conrelid='catalog.dictionary_entry'::regclass AND contype='c'",
                String.class);
        assertTrue(checkConstraints.contains("ck_catalog_dictionary_entry_kind"), checkConstraints.toString());
        assertTrue(checkConstraints.contains("ck_catalog_dictionary_parent_kind"), checkConstraints.toString());

        String dataNodeRef = "cp12-node-" + UUID.randomUUID();
        String brandRef = "cp12-brand-" + UUID.randomUUID();
        assertDoesNotThrow(() -> insert(dataNodeRef, brandRef, "ORDER_OPTION_VALUE", "OPTION-001"));

        DataIntegrityViolationException invalid = assertThrows(
                DataIntegrityViolationException.class,
                () -> insert(dataNodeRef, brandRef, "PRODUCTION_TAG", "INVALID-001"));
        assertTrue(invalid.getMostSpecificCause().getMessage().contains("ck_catalog_dictionary_entry_kind"));
    }

    private static void insert(String dataNodeRef, String brandRef, String dictionaryKind, String code) {
        jdbc.update(
                "INSERT INTO catalog.dictionary_entry "
                        + "(entry_ref,data_node_ref,brand_ref,dictionary_kind,code,name,"
                        + "created_at_epoch_millis,updated_at_epoch_millis) "
                        + "VALUES (?,?,?,?,?,?,?,?)",
                UUID.randomUUID(),
                dataNodeRef,
                brandRef,
                dictionaryKind,
                code,
                code,
                1_785_000_000_000L,
                1_785_000_000_000L);
    }
}
