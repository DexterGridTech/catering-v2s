package com.catering.v2s.catalog.api;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;

/** Public owner boundary for catalog facts and commands. Coordinators may not issue catalog SQL. */
public interface CatalogOwnerApi {
    /** Typed task-read boundaries.  The legacy operation-id entrypoint remains deferred to BP-U06. */
    JsonNode readWorkbenchContext(String dataNodeRef, String brandRef, String requestId);
    JsonNode readNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId);
    JsonNode readDictionary(String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId);
    JsonNode readLocalCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readBrandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);
    JsonNode readShapeManifest(String requestId);

    /** Typed command boundary; derives operation, target and grant requirement from the resolver-owned context. */
    JsonNode write(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * The category and dictionary commands deliberately have named records: P1 wire types
     * terminate at the edge and no dynamic JSON may cross this owner boundary.
     */
    record CategoryCreateCommand(String code, String name, UUID parentCategoryRef) { }
    record CategoryUpdateCommand(UUID categoryRef, long expectedVersion, String name) { }
    enum CategoryMoveAction { REPARENT, UP, DOWN }
    record CategoryMoveCommand(UUID categoryRef, long expectedVersion, CategoryMoveAction action, UUID parentCategoryRef) { }
    record CategoryDeleteCommand(UUID categoryRef, long expectedVersion) { }
    record CategoryDeletionAvailability(boolean canDelete, long subtreeSize, long blockingReferenceCount,
                                        List<String> blockingReferenceLabels) { }
    record CategoryReadback(UUID categoryRef, String code, String name, UUID parentCategoryRef, long version,
                            long displayOrder, CategoryDeletionAvailability deletionAvailability) { }
    record CategoryDeleteReadback(UUID categoryRef, long deletedSubtreeSize, List<String> deletedCategoryCodes) { }

    record DictionaryEntryCreateCommand(String dictionaryKind, String code, String name) { }
    record DictionaryEntryUpdateCommand(String dictionaryKind, String entryCode, long expectedVersion, String name) { }
    record DictionaryEntryReorderCommand(String dictionaryKind, List<String> orderedCodes) { }
    record DictionaryEntryTransitionCommand(String dictionaryKind, String entryCode, long expectedVersion,
                                            String targetStatus) { }
    record DictionaryCommandReadback(String dictionaryKind, String code, String name, String status, long version) { }
    record DictionaryBlockingReference(String referenceKind, String referenceRef) { }
    record DictionaryDependentFact(String factKind, String factRef) { }
    record DictionaryVoidAvailability(boolean canVoid, List<DictionaryBlockingReference> blockingReferences,
                                      List<DictionaryDependentFact> dependentFacts) { }
    record DictionaryEntryView(String entryRef, String code, String name, String status, String ownerType, String ownerRef,
                               String brandRef, long version, long updatedAt,
                               DictionaryVoidAvailability voidAvailability) { }
    record DictionaryViewReadback(String dictionaryKind, List<DictionaryEntryView> entries, String cursor,
                                  long total, String generation) { }

    /** Catalog-owned free attributes cross this public boundary only as canonical JSON text. */
    record CatalogItemCreateCommand(String name, String code, String shapeKey, String attributesJson) { }
    record CatalogItemStatusTransitionCommand(String itemCode, long expectedVersion, String targetStatus) { }
    record CatalogItemBatchStatusTransitionItem(UUID itemRef, long expectedVersion) { }
    record CatalogItemBatchStatusTransitionCommand(String targetStatus, List<CatalogItemBatchStatusTransitionItem> items) { }
    record CatalogItemBatchStatusTransitionResult(UUID itemRef, boolean ok, String failureCode, Long version) { }
    record CatalogItemBatchStatusTransitionReadback(String revision, String requestId,
                                                     List<CatalogItemBatchStatusTransitionResult> results) { }
    record TemporaryPromotionPreflightCommand(String itemCode, String formalCode, String shapeKey, String name,
                                              String shortName, String materialRole, String attributesJson,
                                              long expectedSourceVersion) { }
    record TemporaryPromotionExecuteCommand(String itemCode, String formalCode, String shapeKey, String name,
                                            String shortName, String materialRole, String attributesJson,
                                            long expectedSourceVersion, long expectedVersion,
                                            String preflightDigest) { }
    record CatalogItemOwnerReadback(String owner, String status, long version) { }
    record CatalogItemActionAvailability(boolean canEdit, boolean canEnable, boolean canDisable) { }
    record CatalogItemCommandReadback(String operation, String resourceRef, String status, long version,
                                      List<CatalogItemOwnerReadback> ownerReadbacks,
                                      CatalogItemActionAvailability actionAvailability) { }
    /** Save keeps free form fields opaque until the catalog owner validates them. */
    record CatalogItemSaveCommand(String itemCode, String canonicalRequestJson) { }
    record CatalogItemSaveReadback(String canonicalJson) { }
    record TemporaryPromotionItem(String code, String name, String shapeKey) { }
    record TemporaryPromotionProposed(String code, String name, String shapeKey, String materialRole) { }
    record TemporaryPromotionChange(String field, String before, String after) { }
    record TemporaryPromotionPreflightReadback(TemporaryPromotionItem item, TemporaryPromotionProposed proposed,
                                               String source, long sourceVersion, boolean formalCodeAvailable,
                                               List<String> requiredFields, List<String> blockedReasons,
                                               List<TemporaryPromotionChange> changes, String preflightDigest,
                                               boolean canPromote) { }

    CategoryReadback createCategory(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                    CategoryCreateCommand command, String idempotencyKey);
    CategoryReadback updateCategory(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                    CategoryUpdateCommand command, String idempotencyKey);
    CategoryReadback moveCategory(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                  CategoryMoveCommand command, String idempotencyKey);
    CategoryDeleteReadback deleteCategory(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                          CategoryDeleteCommand command, String idempotencyKey);
    DictionaryCommandReadback createDictionaryEntry(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                    DictionaryEntryCreateCommand command, String idempotencyKey);
    DictionaryCommandReadback updateDictionaryEntry(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                    DictionaryEntryUpdateCommand command, String idempotencyKey);
    DictionaryViewReadback reorderDictionaryEntries(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                    DictionaryEntryReorderCommand command, String idempotencyKey);
    DictionaryCommandReadback transitionDictionaryEntry(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                        DictionaryEntryTransitionCommand command, String idempotencyKey);
    CatalogItemCommandReadback createCatalogItem(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                 CatalogItemCreateCommand command, String idempotencyKey);
    CatalogItemCommandReadback transitionCatalogItemStatus(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                           CatalogItemStatusTransitionCommand command, String idempotencyKey);
    CatalogItemBatchStatusTransitionReadback transitionCatalogItemStatuses(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                                            CatalogItemBatchStatusTransitionCommand command,
                                                                            String idempotencyKey);
    /** Resolves a catalog business code to the catalog-owned opaque ref for the typed VOID dependency judgment. */
    UUID resolveCatalogItemRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemCode);
    /** Catalog-owned inbound-reference fact used before the typed VOID orchestration. */
    boolean catalogItemReferencedByOtherItems(WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID itemRef);
    CatalogItemSaveReadback saveCatalogItem(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                            CatalogItemSaveCommand command, String idempotencyKey);
    TemporaryPromotionPreflightReadback preflightTemporaryCatalogItemPromotion(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                                                TemporaryPromotionPreflightCommand command,
                                                                                String idempotencyKey);
    CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(WorkspaceExecutionContext<CatalogAuthorizationScope> context,
                                                                    TemporaryPromotionExecuteCommand command,
                                                                    String idempotencyKey);

    record LocalCopyPreflightCommand(String sourceItemCode, String targetItemCode, List<String> selectedSections) { }
    record LocalCopyExecuteCommand(String sourceItemCode, String targetItemCode, List<String> selectedSections, String catalogPreflightDigest,
                                   long expectedSourceVersion, long expectedTargetVersion, String referencePlanJson) { }
    record CopyPreflightReadback(String preflightDigest, String canonicalJson) { }
    /**
     * Owner-native copy execution contribution.  This deliberately carries
     * named business facts rather than a serialized response: a coordinator
     * must never decode an owner receipt after the owner has written.
     */
    record CopyObjectReadback(String objectType, String code) { }
    record CopySkippedReadback(String section, String reasonCode) { }
    record CopyReferenceMapping(String objectType, String sourceRef, String targetRef,
                                String targetCode, String targetSkuCode, String targetOptionValueCode) { }
    record CopyTargetVersion(String targetRef, long version) { }
    record CopyOwnerReadback(String owner, String status, long version) { }
    record CopyExecutionReadback(String preflightDigest, List<CopyObjectReadback> created,
                                 List<CopyObjectReadback> reused, List<CopySkippedReadback> skipped,
                                 List<CopyReferenceMapping> referenceMappings,
                                 List<CopyTargetVersion> targetVersions,
                                 List<CopyOwnerReadback> ownerReadbacks) { }
    CopyPreflightReadback preflightLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyPreflightCommand command);
    CopyExecutionReadback executeLocalCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyExecuteCommand command, String idempotencyKey);
    record BrandCopyPreflightCommand(List<String> selectedItemCodes, String targetDataNodeRef) { }
    record BrandCopyExecuteCommand(List<String> selectedItemCodes, String targetDataNodeRef, String catalogPreflightDigest, long expectedSourceVersion, long expectedTargetVersion, String referencePlanJson) { }
    CopyPreflightReadback preflightBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);
    CopyExecutionReadback executeBrandCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyExecuteCommand command, String idempotencyKey);

    /** Typed copy boundary; the source is resolved only from the context's static copy policy. */
    JsonNode copy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Typed catalog-only copy preflight.  It deliberately derives the source,
     * target and copy variant from the live context instead of interpreting an
     * execute operation id or accepting a caller-supplied scope.
     */
    JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request);

    /** Owner judgment used by inventory and production coordinations; it does not write. */
    boolean itemExists(String dataNodeRef, String brandRef, String itemCode);

    /** Owner judgment used before a production-tag terminal transition. */
    boolean productionTagReferenced(String dataNodeRef, String brandRef, String tagRef);

    /** Owner judgment used before an asset lifecycle release; URL/storage ownership stays with asset owner. */
    boolean assetReferenced(String dataNodeRef, String brandRef, String assetRef);

    /** Global catalog reference judgment for a shared immutable assetRef before lifecycle release. */
    boolean assetReferencedAnywhere(String assetRef);

    /** Set-based global form; assets remain shared across every catalog scope. */
    java.util.Set<String> assetRefsStillReferenced(java.util.Set<String> assetRefs);

    /** Narrow lifecycle judgment: reject release while any live catalog reference remains. */
    void requireAssetUnreferencedAnywhere(UUID assetRef);

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

        public Problem(String code, int status, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
            this.status = status;
        }

        public String code() { return code; }
        public int status() { return status; }
    }
}
