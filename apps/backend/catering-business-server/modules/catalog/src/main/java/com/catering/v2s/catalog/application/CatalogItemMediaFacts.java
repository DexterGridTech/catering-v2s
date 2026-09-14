package com.catering.v2s.catalog.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** Compatibility type; JDBC execution lives in the persistence package. */
final class CatalogItemMediaFacts extends com.catering.v2s.catalog.application.persistence.CatalogItemMediaFacts {
    CatalogItemMediaFacts(JdbcTemplate jdbc, ObjectMapper mapper) {
        super(jdbc, mapper);
    }

    @Override
    public Map<UUID, ArrayNode> readByItemRefs(Collection<UUID> itemRefs) {
        return super.readByItemRefs(itemRefs);
    }

    @Override
    public void replace(UUID itemRef, JsonNode submitted) {
        super.replace(itemRef, submitted);
    }

    @Override
    public void insertForCopy(Map<UUID, JsonNode> imagesByItem) {
        super.insertForCopy(imagesByItem);
    }

    @Override
    public boolean referenced(String dataNodeRef, String brandRef, UUID assetRef) {
        return super.referenced(dataNodeRef, brandRef, assetRef);
    }

    @Override
    public Set<UUID> referencedRefs(String dataNodeRef, String brandRef, Collection<UUID> assetRefs) {
        return super.referencedRefs(dataNodeRef, brandRef, assetRefs);
    }
}
