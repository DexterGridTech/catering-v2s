package com.catering.v2s.catalog.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Compatibility type for package-local application constructors and existing tests. SQL execution is owned by the typed
 * persistence implementation.
 */
final class CatalogIdentifierFacts extends com.catering.v2s.catalog.application.persistence.CatalogIdentifierFacts {

    CatalogIdentifierFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        super(jdbc, mapper);
    }
}
