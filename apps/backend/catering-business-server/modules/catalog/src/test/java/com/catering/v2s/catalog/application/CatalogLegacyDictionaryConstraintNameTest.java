package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Keeps the explicit cleanup name bound to PostgreSQL's generated legacy constraint. */
@Testcontainers
class CatalogLegacyDictionaryConstraintNameTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void recordsTheLegacyDictionaryUniqueConstraintNameBeforeReleaseMigration() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:../../src/main/resources/db/migration")
                .schemas("public")
                .defaultSchema("public")
                .cleanDisabled(false)
                .target("20260816.020000.000")
                .load()
                .migrate();
        JdbcTemplate jdbc = new JdbcTemplate(
                new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        List<String> names = jdbc.queryForList(
                "SELECT conname FROM pg_constraint WHERE conrelid = 'catalog.dictionary_entry'::regclass AND contype = "
                        + "'u'",
                String.class);
        assertTrue(names.contains("dictionary_entry_data_node_ref_brand_ref_dictionary_kind_co_key"), names.toString());
    }
}
