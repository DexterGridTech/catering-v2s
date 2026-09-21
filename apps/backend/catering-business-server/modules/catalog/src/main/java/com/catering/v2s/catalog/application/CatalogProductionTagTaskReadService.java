package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Typed production-tag task-read boundary for the one approved GET route. */
public final class CatalogProductionTagTaskReadService {
    private final CatalogProductionTagOwnerApi owner;

    public CatalogProductionTagTaskReadService(CatalogProductionTagOwnerApi owner) {
        this.owner = owner;
    }

    public JsonNode tags(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> owner.readTags(dataNodeRef, brandRef, request, requestId));
    }
}

