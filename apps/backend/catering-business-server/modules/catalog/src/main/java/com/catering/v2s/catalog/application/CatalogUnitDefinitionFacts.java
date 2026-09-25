package com.catering.v2s.catalog.application;

import org.springframework.jdbc.core.JdbcTemplate;

/** Compatibility type; catalog relational fact execution lives in the persistence package. */
final class CatalogUnitDefinitionFacts
        extends com.catering.v2s.catalog.application.persistence.CatalogUnitDefinitionFacts {
    CatalogUnitDefinitionFacts(JdbcTemplate jdbc) {
        super(jdbc);
    }
}
