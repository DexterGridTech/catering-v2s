package com.catering.v2s.catalog.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Public owner boundary for catalog facts and commands. Coordinators may not issue catalog SQL. */
public interface CatalogOwnerApi {
    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode write(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey);

    JsonNode copy(String operationId, String sourceDataNodeRef, String targetDataNodeRef, String brandRef, ObjectNode request, String requestId, String idempotencyKey);

    /** Returns production-tag codes referenced by the approved copy closure; catalog owns only the typed refs. */
    JsonNode referencedProductionTagCodes(String sourceDataNodeRef, String brandRef, ObjectNode request);

    /** Owner judgment used by inventory and production coordinations; it does not write. */
    boolean itemExists(String dataNodeRef, String brandRef, String itemCode);

    /** Owner judgment used before a production-tag terminal transition. */
    boolean productionTagReferenced(String dataNodeRef, String brandRef, String tagCode);

    /** Owner judgment used before an asset lifecycle release; URL/storage ownership stays with asset owner. */
    boolean assetReferenced(String dataNodeRef, String brandRef, String assetRef);

    /**
     * Task-specific read used by the inventory detail surface to reverse-lookup
     * catalog BOM facts that consume one inventory target.  The catalog owner
     * keeps the reference semantics; the coordinator only joins the read.
     */
    JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef);

    /**
     * Set-based task read for the inventory list.  SKU display names remain
     * catalog-owned; the application coordinator may join this projection to
     * inventory rows without issuing one detail query per target.
     */
    JsonNode skuNamesByItemCodes(String dataNodeRef, String brandRef, JsonNode itemCodes);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;

        public Problem(String code, int status, String message) {
            super(message);
            this.code = code;
            this.status = status;
        }

        public String code() { return code; }
        public int status() { return status; }
    }
}
