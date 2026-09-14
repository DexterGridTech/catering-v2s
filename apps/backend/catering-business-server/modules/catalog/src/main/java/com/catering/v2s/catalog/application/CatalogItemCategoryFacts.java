package com.catering.v2s.catalog.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Compatibility type; relational category execution lives in the persistence package. */
final class CatalogItemCategoryFacts
        extends com.catering.v2s.catalog.application.persistence.CatalogItemCategoryFacts {
    CatalogItemCategoryFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        super(jdbc, mapper);
    }
}
