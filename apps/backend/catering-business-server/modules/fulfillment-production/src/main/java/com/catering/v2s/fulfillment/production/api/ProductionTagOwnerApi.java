package com.catering.v2s.fulfillment.production.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;

/** Production tag definition owner. Catalog stores only typed references to these facts. */
public interface ProductionTagOwnerApi {
    JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode readTags(String dataNodeRef, String brandRef, String requestId);

    List<ProductionTagReferenceReadback> readTagReferencesByRefs(
            String dataNodeRef, String brandRef, List<UUID> tagRefs, String requestId);

    JsonNode write(
            String operationId,
            String dataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    ProductionTagCommandReadback createTag(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CreateTagCommand command,
            String idempotencyKey);

    ProductionTagCommandReadback updateTag(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UpdateTagCommand command,
            String idempotencyKey);

    ProductionTagCommandReadback transitionTagStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            TransitionTagStatusCommand command,
            String idempotencyKey);

    UUID resolveProductionTagRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String tagCode);

    record CreateTagCommand(String code, String tagKind, String name) {}

    record UpdateTagCommand(String tagCode, long expectedVersion, String tagKind, String name) {}

    record TransitionTagStatusCommand(String tagCode, long expectedVersion, String targetStatus) {}

    record ProductionTagReferenceReadback(UUID tagRef, String code, String name, String status, long version) {}
    /** Owner-native command readback; edge contract serialization is deliberately separate. */
    record ProductionTagCommandReadback(
            UUID tagRef, String code, String tagKind, String name, String status, long version) {}

    /**
     * Brand-copy composition carries only opaque owner-produced plan text between owners. The production owner alone
     * interprets the canonical plan when it checks and copies tags.
     */
    record BrandCopyPreflightCommand(
            List<String> selectedItemCodes, String targetDataNodeRef, String catalogReferencePlanJson) {}

    record BrandCopyExecuteCommand(
            List<String> selectedItemCodes,
            String targetDataNodeRef,
            String productionPreflightDigest,
            String catalogReferencePlanJson) {}

    record BrandCopyPreflightReadback(String preflightDigest, String canonicalJson) {}
    /** Named production contribution for brand-copy composition. */
    record BrandCopyReferenceMapping(
            String objectType,
            String sourceRef,
            String targetRef,
            String targetCode,
            String targetSkuCode,
            String targetOptionValueCode) {}

    record BrandCopyExecutionReadback(
            String owner, String status, long version, List<BrandCopyReferenceMapping> referenceMappings) {}

    BrandCopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);

    BrandCopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            BrandCopyExecuteCommand command,
            String idempotencyKey);

    /** Coordinated copy command; production owns tag definitions. */
    JsonNode copy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            String requestId,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /** Read-only owner judgement used by catalog copy preflight and execute recheck. */
    JsonNode preflightCopy(
            String sourceDataNodeRef,
            String targetDataNodeRef,
            String brandRef,
            ObjectNode request,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant);

    JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request);

    final class Problem extends RuntimeException {
        private final String code;
        private final int status;

        public Problem(String code, int status, String message) {
            super(message);
            this.code = code;
            this.status = status;
        }

        public Problem(String code, int status, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
            this.status = status;
        }

        public String code() {
            return code;
        }

        public int status() {
            return status;
        }
    }
}
