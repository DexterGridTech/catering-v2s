package com.catering.v2s.fulfillment.production.application;

import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;

/** Typed production-tag task-read boundary for the one approved GET route. */
public final class ProductionTagTaskReadService {
    private final ProductionTagOwnerApi owner;

    public ProductionTagTaskReadService(ProductionTagOwnerApi owner) { this.owner = owner; }

    public JsonNode tags(String dataNodeRef, String brandRef, String requestId) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY,
            () -> owner.readTags(dataNodeRef, brandRef, requestId));
    }
}
