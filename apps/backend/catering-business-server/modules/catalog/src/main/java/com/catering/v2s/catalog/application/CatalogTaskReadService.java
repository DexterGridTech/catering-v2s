package com.catering.v2s.catalog.application;

import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Catalog's closed task-read boundary.  It deliberately exposes no operation
 * id so a read route cannot fall back to the legacy dispatcher by accident.
 */
public final class CatalogTaskReadService {
    private final CatalogOwnerApi owner;

    public CatalogTaskReadService(CatalogOwnerApi owner) { this.owner = owner; }

    public JsonNode workbenchContext(String dataNodeRef, String brandRef, String requestId) {
        return primary(() -> owner.readWorkbenchContext(dataNodeRef, brandRef, requestId));
    }

    public JsonNode navigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return primary(() -> owner.readNavigation(dataNodeRef, brandRef, request, requestId));
    }

    public JsonNode items(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return primary(() -> owner.readItems(dataNodeRef, brandRef, request, requestId));
    }

    public JsonNode item(String dataNodeRef, String brandRef, String itemCode, String requestId) {
        return primary(() -> owner.readItem(dataNodeRef, brandRef, itemCode, requestId));
    }

    public JsonNode dictionary(String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId) {
        return primary(() -> owner.readDictionary(dataNodeRef, brandRef, dictionaryKind, request, requestId));
    }

    public JsonNode localCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return primary(() -> owner.readLocalCopyCandidates(dataNodeRef, brandRef, request, requestId));
    }

    public JsonNode brandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId) {
        return primary(() -> owner.readBrandCopyCandidates(dataNodeRef, brandRef, request, requestId));
    }

    public JsonNode shapeManifest(String requestId) {
        return primary(() -> owner.readShapeManifest(requestId));
    }

    private static JsonNode primary(java.util.function.Supplier<JsonNode> read) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, read);
    }
}
