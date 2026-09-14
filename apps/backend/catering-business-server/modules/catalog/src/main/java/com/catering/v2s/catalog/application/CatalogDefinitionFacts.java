package com.catering.v2s.catalog.application;

import org.springframework.jdbc.core.JdbcTemplate;

/** Compatibility type; catalog relational fact execution lives in the persistence package. */
final class CatalogDefinitionFacts extends com.catering.v2s.catalog.application.persistence.CatalogDefinitionFacts {
    CatalogDefinitionFacts(JdbcTemplate jdbc) {
        super(jdbc);
    }
}
