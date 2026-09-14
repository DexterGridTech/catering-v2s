package com.catering.v2s.catalog.application;

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Compatibility type; catalog relational fact execution lives in the persistence package. */
final class CatalogItemReferenceFacts extends com.catering.v2s.catalog.application.persistence.CatalogItemReferenceFacts {
    CatalogItemReferenceFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        super(jdbc, mapper);
    }
}
