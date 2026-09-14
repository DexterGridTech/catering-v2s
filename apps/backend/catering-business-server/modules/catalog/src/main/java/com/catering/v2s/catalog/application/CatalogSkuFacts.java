package com.catering.v2s.catalog.application;

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.catering.v2s.platform.foundation.time.TimeProvider;

/** Compatibility type; catalog relational fact execution lives in the persistence package. */
final class CatalogSkuFacts extends com.catering.v2s.catalog.application.persistence.CatalogSkuFacts {
    CatalogSkuFacts(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        super(jdbc, mapper, time);
    }
}
