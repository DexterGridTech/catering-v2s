package com.catering.v2s.catalog.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

/** Compatibility type; catalog relational fact execution lives in the persistence package. */
final class CatalogItemDefinitionFacts
        extends com.catering.v2s.catalog.application.persistence.CatalogItemDefinitionFacts {
    CatalogItemDefinitionFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        super(jdbc, mapper);
    }
}
