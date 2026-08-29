package com.catering.v2s.catalog.api;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Public owner boundary for catalog facts and commands. Coordinators may not issue catalog SQL. */
public interface CatalogOwnerApi {
    /** Typed task-read boundaries. The legacy operation-id entrypoint remains deferred to BP-U06. */
    JsonNode readWorkbenchContext(String dataNodeRef, String brandRef, String requestId);

    JsonNode readNavigation(String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode readItems(String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode readCategoryCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode readItemSkus(String dataNodeRef, String brandRef, String itemCode, ObjectNode request, String requestId);

    /**
     * The inventory page's bounded display projection. The five components are the complete display fact set;
     * {@link InventoryDisplayFact#absent(UUID)} keeps an input ref visible when catalog has no matching item.
     */
    record InventoryDisplayFact(
            UUID itemRef, String itemName, String skuName, String materialRole, String categoryDisplayName) {
        public static InventoryDisplayFact absent(UUID itemRef) {
            return new InventoryDisplayFact(itemRef, null, null, null, null);
        }

        public boolean present() {
            return itemName != null;
        }
    }

    List<InventoryDisplayFact> readInventoryDisplayFacts(
            String dataNodeRef, String brandRef, List<UUID> orderedItemRefs);

    /** Minimal catalog-owned display fact used to enrich one inventory target without hydrating a catalog item. */
    record InventoryTargetDisplayFact(UUID itemRef, String itemName, String shapeKey, String skuName) {
        public static InventoryTargetDisplayFact absent(UUID itemRef) {
            return new InventoryTargetDisplayFact(itemRef, null, null, null);
        }

        public boolean present() {
            return itemName != null;
        }
    }

    InventoryTargetDisplayFact readInventoryTargetDisplayFact(
            String dataNodeRef, String brandRef, UUID itemRef, UUID productSkuRef);

    JsonNode readItem(String dataNodeRef, String brandRef, String itemCode, String requestId);

    JsonNode readDictionary(
            String dataNodeRef, String brandRef, String dictionaryKind, ObjectNode request, String requestId);

    JsonNode readLocalCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode readBrandCopyCandidates(String dataNodeRef, String brandRef, ObjectNode request, String requestId);

    JsonNode readShapeManifest(String requestId);

    /** Typed command boundary; derives operation, target and grant requirement from the resolver-owned context. */
    JsonNode write(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * The category and dictionary commands deliberately have named records: P1 wire types terminate at the edge and no
     * dynamic JSON may cross this owner boundary.
     */
    record CategoryCreateCommand(String code, String name, UUID parentCategoryRef) {}

    record CategoryUpdateCommand(UUID categoryRef, long expectedVersion, String name) {}

    enum CategoryMoveAction {
        REPARENT,
        UP,
        DOWN
    }

    record CategoryMoveCommand(
            UUID categoryRef, long expectedVersion, CategoryMoveAction action, UUID parentCategoryRef) {}

    record CategoryStatusTransitionCommand(UUID categoryRef, long expectedVersion, String targetStatus) {}

    record CategoryBlockingReference(
            String referenceKind, UUID referenceRef, String code, String name, String direction) {}

    record CategoryDeletionAvailability(
            boolean canDelete,
            long subtreeSize,
            long blockingReferenceCount,
            List<CategoryBlockingReference> blockingReferences) {}

    record CategoryReadback(
            UUID categoryRef,
            String code,
            String name,
            String status,
            UUID parentCategoryRef,
            long version,
            long displayOrder,
            CategoryDeletionAvailability deletionAvailability) {}

    record DictionaryEntryCreateCommand(String dictionaryKind, String code, String name, UUID parentEntryRef) {}

    record DictionaryEntryUpdateCommand(String dictionaryKind, String entryCode, long expectedVersion, String name) {}

    record DictionaryEntryReorderCommand(String dictionaryKind, List<String> orderedCodes) {}

    record DictionaryEntryTransitionCommand(
            String dictionaryKind, String entryCode, long expectedVersion, String targetStatus) {}

    record DictionaryCommandReadback(
            UUID entryRef,
            String dictionaryKind,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            long version) {}

    record DictionaryBlockingReference(String referenceKind, String referenceRef) {}

    record DictionaryDependentFact(String factKind, String factRef) {}

    record DictionaryVoidAvailability(
            boolean canVoid,
            List<DictionaryBlockingReference> blockingReferences,
            List<DictionaryDependentFact> dependentFacts) {}

    record DictionaryEntryView(
            String entryRef,
            String code,
            String name,
            String status,
            UUID parentEntryRef,
            String ownerType,
            String ownerRef,
            String brandRef,
            long version,
            long updatedAt,
            DictionaryVoidAvailability voidAvailability) {}

    record DictionaryViewReadback(
            String dictionaryKind, List<DictionaryEntryView> entries, String cursor, long total, String generation) {}

    record AttributeDefinitionOption(UUID optionRef, String name, int displayOrder) {}

    record AttributeDefinitionCreateCommand(
            String code, String name, String valueType, List<AttributeDefinitionOption> options) {}

    record AttributeDefinitionUpdateCommand(
            UUID definitionRef,
            long expectedVersion,
            String code,
            String name,
            List<AttributeDefinitionOption> options) {}

    record AttributeDefinitionReadback(
            UUID definitionRef,
            String code,
            String name,
            String status,
            String valueType,
            List<AttributeDefinitionOption> options,
            long version) {}

    record AttributeDefinitionListReadback(List<AttributeDefinitionReadback> definitions) {}

    record AttributeDefinitionStatusTransitionCommand(UUID definitionRef, long expectedVersion, String targetStatus) {}

    /** Catalog-owned unit definitions are a bounded library, not a dictionary/tag projection. */
    enum UnitDimension {
        COUNT,
        WEIGHT,
        VOLUME,
        SERVICE_DURATION,
        PACKAGE
    }

    record UnitDefinitionCreateCommand(String code, String name, UnitDimension unitDimension, int precision) {}

    record UnitDefinitionUpdateCommand(
            UUID unitRef,
            long expectedVersion,
            String code,
            String name,
            UnitDimension unitDimension,
            Integer precision) {}

    record UnitDefinitionStatusTransitionCommand(UUID unitRef, long expectedVersion, String targetStatus) {}

    record UnitDefinitionReadback(
            UUID unitRef,
            String code,
            String name,
            UnitDimension unitDimension,
            int precision,
            String status,
            long version) {}

    record UnitDefinitionListReadback(List<UnitDefinitionReadback> units, Set<UUID> referencedUnitRefs) {
        public UnitDefinitionListReadback {
            units = List.copyOf(units);
            referencedUnitRefs = referencedUnitRefs == null ? Set.of() : Set.copyOf(referencedUnitRefs);
        }
    }

    /** `stockTargetRef` is owner-resolved in the coordinator; the edge never supplies it. */
    record OrderOptionMaterialTemplate(
            UUID materialItemRef, UUID stockTargetRef, InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    /**
     * {@code code} is the immutable, scope-unique business identity of a library value. {@code valueRef} remains the
     * relation key; on update an existing value must echo its stored code and may not rename it.
     */
    record OrderOptionValueCommand(
            UUID valueRef, String code, String name, int displayOrder, List<OrderOptionMaterialTemplate> materials) {}

    record OrderOptionMaterialReadback(
            UUID materialRef,
            UUID materialItemRef,
            String materialItemName,
            UUID stockTargetRef,
            InventoryOwnerApi.UnitSnapshot consumptionUnitSnapshot) {}

    record OrderOptionValueReadback(
            UUID valueRef, String code, String name, int displayOrder, List<OrderOptionMaterialReadback> materials) {}

    record OrderOptionDefinitionCreateCommand(
            String code, String name, String selectionMode, List<OrderOptionValueCommand> values) {}

    record OrderOptionDefinitionUpdateCommand(
            UUID definitionRef,
            long expectedVersion,
            String code,
            String name,
            String selectionMode,
            List<OrderOptionValueCommand> values) {}

    record OrderOptionDefinitionReadback(
            UUID definitionRef,
            String code,
            String name,
            String status,
            String selectionMode,
            List<OrderOptionValueReadback> values,
            long version) {}

    record OrderOptionDefinitionListReadback(List<OrderOptionDefinitionReadback> definitions) {}

    record OrderOptionDefinitionMutationReadback(
            OrderOptionDefinitionReadback definition, List<UUID> deletedDefinitionValueRefs) {}

    record OrderOptionDefinitionStatusTransitionCommand(
            UUID definitionRef, long expectedVersion, String targetStatus) {}

    /** First-step identity is atomic: item is DISABLED and categoryRef is either one opaque ref or null. */
    record CatalogItemCreateCommand(String name, String code, String shapeKey, UUID categoryRef) {}

    record CatalogItemStatusTransitionCommand(String itemCode, long expectedVersion, String targetStatus) {}

    record CatalogItemBatchStatusTransitionItem(UUID itemRef, long expectedVersion) {}

    record CatalogItemBatchStatusTransitionCommand(
            String targetStatus, List<CatalogItemBatchStatusTransitionItem> items) {}

    enum CatalogItemBatchStatusTransitionOutcome {
        SUCCEEDED,
        FAILED
    }

    record CatalogItemBatchStatusTransitionResult(
            UUID itemRef,
            String itemCode,
            CatalogItemBatchStatusTransitionOutcome outcome,
            String problemCode,
            String reason,
            Long version) {}

    record CatalogItemBatchStatusTransitionReadback(
            String revision, String requestId, List<CatalogItemBatchStatusTransitionResult> results) {}

    record TemporaryPromotionPreflightCommand(
            String itemCode,
            String formalCode,
            String shapeKey,
            String name,
            String shortName,
            String materialRole,
            long expectedSourceVersion) {}

    record TemporaryPromotionExecuteCommand(
            String itemCode,
            String formalCode,
            String shapeKey,
            String name,
            String shortName,
            String materialRole,
            long expectedSourceVersion,
            long expectedVersion,
            String preflightDigest) {}

    record CatalogItemOwnerReadback(String owner, String status, long version) {}

    record CatalogItemActionAvailability(boolean canEdit, boolean canEnable, boolean canDisable) {}

    record CatalogItemCommandReadback(
            String operation,
            String resourceRef,
            String status,
            long version,
            List<CatalogItemOwnerReadback> ownerReadbacks,
            CatalogItemActionAvailability actionAvailability) {}
    /** Save keeps free form fields opaque until the catalog owner validates them. */
    record CatalogItemSaveCommand(String itemCode, String canonicalRequestJson) {}

    /** Internal post-save projection consumed by the catalog/inventory coordinator; never serialized on the wire. */
    record CatalogItemSaveProjection(
            UUID itemRef,
            String itemCode,
            String shapeKey,
            String measureMode,
            Map<String, String> productSkuRefs,
            Map<String, String> optionValueRefs,
            InventoryOwnerApi.UnitSnapshot itemBaseMeasureUnit,
            Map<String, InventoryOwnerApi.UnitSnapshot> skuBaseMeasureUnits,
            Set<String> previousAssetRefs) {
        public CatalogItemSaveProjection {
            productSkuRefs = productSkuRefs == null ? Map.of() : Map.copyOf(productSkuRefs);
            optionValueRefs = optionValueRefs == null ? Map.of() : Map.copyOf(optionValueRefs);
            skuBaseMeasureUnits = skuBaseMeasureUnits == null ? Map.of() : Map.copyOf(skuBaseMeasureUnits);
            previousAssetRefs = previousAssetRefs == null ? Set.of() : Set.copyOf(previousAssetRefs);
        }
    }

    record CatalogItemSaveReadback(String canonicalJson, CatalogItemSaveProjection projection) {
        public CatalogItemSaveReadback(String canonicalJson) {
            this(canonicalJson, null);
        }
    }

    record TemporaryPromotionItem(String code, String name, String shapeKey) {}

    record TemporaryPromotionProposed(String code, String name, String shapeKey, String materialRole) {}

    record TemporaryPromotionChange(String field, String before, String after) {}

    record TemporaryPromotionPreflightReadback(
            TemporaryPromotionItem item,
            TemporaryPromotionProposed proposed,
            String source,
            long sourceVersion,
            boolean formalCodeAvailable,
            List<String> requiredFields,
            List<String> blockedReasons,
            List<TemporaryPromotionChange> changes,
            String preflightDigest,
            boolean canPromote) {}

    CategoryReadback createCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CategoryCreateCommand command,
            String idempotencyKey);

    CategoryReadback updateCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CategoryUpdateCommand command,
            String idempotencyKey);

    CategoryReadback moveCategory(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CategoryMoveCommand command,
            String idempotencyKey);

    CategoryReadback transitionCategoryStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CategoryStatusTransitionCommand command,
            String idempotencyKey);

    DictionaryCommandReadback createDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            DictionaryEntryCreateCommand command,
            String idempotencyKey);

    DictionaryCommandReadback updateDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            DictionaryEntryUpdateCommand command,
            String idempotencyKey);

    DictionaryViewReadback reorderDictionaryEntries(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            DictionaryEntryReorderCommand command,
            String idempotencyKey);

    DictionaryCommandReadback transitionDictionaryEntry(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            DictionaryEntryTransitionCommand command,
            String idempotencyKey);

    CatalogItemCommandReadback createCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemCreateCommand command,
            String idempotencyKey);

    AttributeDefinitionListReadback listAttributeDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage);

    AttributeDefinitionReadback createAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            AttributeDefinitionCreateCommand command,
            String idempotencyKey);

    AttributeDefinitionReadback updateAttributeDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            AttributeDefinitionUpdateCommand command,
            String idempotencyKey);

    AttributeDefinitionReadback transitionAttributeDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            AttributeDefinitionStatusTransitionCommand command,
            String idempotencyKey);

    UnitDefinitionListReadback listUnitDefinitions(
            String dataNodeRef,
            String brandRef,
            boolean includeInactive,
            UnitDimension dimension,
            String query,
            String status);

    UnitDefinitionReadback createUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UnitDefinitionCreateCommand command,
            String idempotencyKey);

    UnitDefinitionReadback updateUnitDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UnitDefinitionUpdateCommand command,
            String idempotencyKey);

    UnitDefinitionReadback transitionUnitStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UnitDefinitionStatusTransitionCommand command,
            String idempotencyKey);

    OrderOptionDefinitionListReadback listOrderOptionDefinitions(
            String dataNodeRef, String brandRef, String candidateUsage);

    OrderOptionDefinitionReadback createOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            OrderOptionDefinitionCreateCommand command,
            String idempotencyKey);

    OrderOptionDefinitionMutationReadback updateOrderOptionDefinition(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            OrderOptionDefinitionUpdateCommand command,
            String idempotencyKey);

    OrderOptionDefinitionReadback transitionOrderOptionDefinitionStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            OrderOptionDefinitionStatusTransitionCommand command,
            String idempotencyKey);

    CatalogItemCommandReadback transitionCatalogItemStatus(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemStatusTransitionCommand command,
            String idempotencyKey);

    CatalogItemBatchStatusTransitionReadback transitionCatalogItemStatuses(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemBatchStatusTransitionCommand command,
            String idempotencyKey);
    /** Resolves a catalog business code to the catalog-owned opaque ref for the typed VOID dependency judgment. */
    UUID resolveCatalogItemRef(WorkspaceExecutionContext<CatalogAuthorizationScope> context, String itemCode);
    /** Catalog-owned inbound-reference fact used before the typed VOID orchestration. */
    boolean catalogItemReferencedByOtherItems(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, UUID itemRef);

    CatalogItemSaveReadback saveCatalogItem(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogItemSaveCommand command,
            String idempotencyKey);

    TemporaryPromotionPreflightReadback preflightTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            TemporaryPromotionPreflightCommand command,
            String idempotencyKey);

    CatalogItemCommandReadback executeTemporaryCatalogItemPromotion(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            TemporaryPromotionExecuteCommand command,
            String idempotencyKey);

    record LocalCopyPreflightCommand(String sourceItemCode, String targetItemCode, List<String> selectedSections) {}

    record CompatibilityDisposition(String compatibilityId, String disposition) {}

    record LocalCopyExecuteCommand(
            String sourceItemCode,
            String targetItemCode,
            List<String> selectedSections,
            String catalogPreflightDigest,
            long expectedSourceVersion,
            long expectedTargetVersion,
            String referencePlanJson,
            List<CompatibilityDisposition> compatibilityDispositions) {}

    record CopyPreflightReadback(String preflightDigest, String canonicalJson) {}

    /**
     * Request-local, owner-created immutable preparation. It exposes only the canonical preflight readback; the owner
     * keeps its hydrated copy projection private and consumes this handle only in the matching execute command. It is
     * not a cache or a serialized client token.
     */
    interface LocalCopyExecutionPreparation {
        CopyPreflightReadback preflight();
    }

    /** Same typed preparation boundary for the brand-copy closure. */
    interface BrandCopyExecutionPreparation {
        CopyPreflightReadback preflight();
    }
    /**
     * Owner-native copy execution contribution. This deliberately carries named business facts rather than a serialized
     * response: a coordinator must never decode an owner receipt after the owner has written.
     */
    record CopyObjectReadback(String objectType, String code) {}

    record CopySkippedReadback(String section, String reasonCode) {}

    record CopyReferenceMapping(
            String objectType,
            String sourceRef,
            String targetRef,
            String targetCode,
            String targetSkuCode,
            String targetOptionValueCode) {}

    record CopyTargetVersion(String targetRef, long version) {}

    record CopyOwnerReadback(String owner, String status, long version) {}

    record CopyExecutionReadback(
            String preflightDigest,
            List<CopyObjectReadback> created,
            List<CopyObjectReadback> reused,
            List<CopySkippedReadback> skipped,
            List<CopyReferenceMapping> referenceMappings,
            List<CopyTargetVersion> targetVersions,
            List<CopyOwnerReadback> ownerReadbacks) {}

    CopyPreflightReadback preflightLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyPreflightCommand command);

    LocalCopyExecutionPreparation prepareLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, LocalCopyPreflightCommand command);

    CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            LocalCopyExecuteCommand command,
            String idempotencyKey);

    CopyExecutionReadback executeLocalCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            LocalCopyExecuteCommand command,
            String idempotencyKey,
            LocalCopyExecutionPreparation preparation);

    record BrandCopyPreflightCommand(List<String> selectedItemCodes, String targetDataNodeRef) {}

    record BrandCopyExecuteCommand(
            List<String> selectedItemCodes,
            String targetDataNodeRef,
            String catalogPreflightDigest,
            long expectedSourceVersion,
            long expectedTargetVersion,
            String referencePlanJson,
            List<CompatibilityDisposition> compatibilityDispositions) {}

    CopyPreflightReadback preflightBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);

    BrandCopyExecutionPreparation prepareBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, BrandCopyPreflightCommand command);

    CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            BrandCopyExecuteCommand command,
            String idempotencyKey);

    CopyExecutionReadback executeBrandCopy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            BrandCopyExecuteCommand command,
            String idempotencyKey,
            BrandCopyExecutionPreparation preparation);

    /** Typed copy boundary; the source is resolved only from the context's static copy policy. */
    JsonNode copy(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey);

    /**
     * Typed catalog-only copy preflight. It deliberately derives the source, target and copy variant from the live
     * context instead of interpreting an execute operation id or accepting a caller-supplied scope.
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

    /** Narrow task read for a single catalog item; it returns only persisted item/SKU asset references. */
    record CatalogAssetReferenceReadback(List<UUID> assetRefs) {}

    CatalogAssetReferenceReadback readAssetReferences(String dataNodeRef, String brandRef, String itemCode);

    /** Narrow lifecycle judgment: reject release while any live catalog reference remains. */
    void requireAssetUnreferencedAnywhere(UUID assetRef);

    /**
     * Task-specific read used by the inventory detail surface to reverse-lookup catalog BOM facts that consume one
     * inventory target. The catalog owner keeps the reference semantics; the coordinator only joins the read.
     */
    JsonNode inventoryConsumptionReferences(String dataNodeRef, String brandRef, String targetRef);

    /**
     * Set-based task read for the inventory list. SKU display names remain catalog-owned; the application coordinator
     * may join this projection to inventory rows without issuing one detail query per target.
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

        public String code() {
            return code;
        }

        public int status() {
            return status;
        }
    }
}
