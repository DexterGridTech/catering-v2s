package com.catering.v2s.catalog.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

/** Compatibility type; catalog relational fact execution lives in the persistence package. */
final class CatalogSkuMediaFacts extends com.catering.v2s.catalog.application.persistence.CatalogSkuMediaFacts {
    CatalogSkuMediaFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        super(jdbc, mapper);
    }
}
