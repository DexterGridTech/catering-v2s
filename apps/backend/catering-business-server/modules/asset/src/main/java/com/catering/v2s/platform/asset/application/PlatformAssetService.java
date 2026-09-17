package com.catering.v2s.platform.asset.application;

import com.catering.v2s.platform.asset.application.persistence.PlatformAssetPersistence;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreServicePointAssetLifecycle;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi;
import com.catering.v2s.platform.asset.api.SalesMenuAssetReadApi;
import com.catering.v2s.platform.asset.api.SalesMenuAssetTarget;
import com.catering.v2s.platform.asset.api.SalesMenuAssetUsage;
import com.catering.v2s.platform.asset.api.WorkspaceLogoAssetCommand;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Owner service for public static images and videos. Business owners retain only asset references. */
@Service
public class PlatformAssetService
        implements WorkspaceLogoAssetCommand,
                CatalogAssetReferenceLock,
                CatalogAssetCommandApi,
                SalesMenuAssetReadApi,
                SalesMenuAssetCommandApi,
                StoreServicePointAssetLifecycle {
    private static final Logger log = LoggerFactory.getLogger(PlatformAssetService.class);
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final long MAX_SALES_MENU_IMAGE_BYTES = 2L * 1024 * 1024;
    /** Video is deliberately not capped at the image/logo limit; future approved video usage stays streaming. */
    private static final long MAX_VIDEO_BYTES = 512L * 1024 * 1024;

    private static final String SALES_MENU_IMAGE_USAGE = SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE.name();
    private static final String SALES_MENU_TARGET_TYPE = "STORE";
    private static final String SALES_MENU_CAPABILITY = "EDIT_STORE_SALES_MENU";
    private static final String SALES_MENU_STAGE_REQUIREMENT = "REQ_STAGE_OPERATIONS_SALES_MENU_ASSET";
    private static final String SALES_MENU_RELEASE_REQUIREMENT = "REQ_RELEASE_OPERATIONS_SALES_MENU_STAGED_ASSET";
    private static final String SALES_MENU_CLAIM_REQUIREMENT = "REQ_UPDATE_OPERATIONS_SALES_MENU_ITEM";

    private static final String GLOBAL_RECEIPT_SCOPE = "global";
    private static final Object CATALOG_ASSET_LOCK_RESOURCE_KEY = new Object();
    private final PlatformAssetPersistence persistence;
    private final TimeProvider time;
    private final AssetObjectStorage objects;
    private final PlatformTransactionManager transactions;
    private final SecureRandom random = new SecureRandom();

    public PlatformAssetService(JdbcTemplate jdbc, TimeProvider time, AssetObjectStorage objects) {
        this(jdbc, time, objects, new DataSourceTransactionManager(jdbc.getDataSource()));
    }

    public PlatformAssetService(
            JdbcTemplate jdbc, TimeProvider time, AssetObjectStorage objects, PlatformTransactionManager transactions) {
        this(new PlatformAssetPersistence(jdbc), time, objects, transactions);
    }

    @Autowired
    public PlatformAssetService(
            PlatformAssetPersistence persistence,
            TimeProvider time,
            AssetObjectStorage objects,
            PlatformTransactionManager transactions) {
        this.persistence = persistence;
        this.time = time;
        this.objects = objects;
        this.transactions = transactions;
    }

    /**
     * Stores only immutable content-hash objects. The one-time bind proof is stored as a hash and must be consumed by
     * the workspace command before the object becomes public.
     */
    public StageReadback stageContent(String usage, String contentType, long declaredSizeBytes, InputStream content) {
        return stageContentResult(usage, contentType, declaredSizeBytes, content, null, null, null)
                .stage();
    }

    public StageReadback stageContent(
            String usage, String contentType, long declaredSizeBytes, InputStream content, String idempotencyKey) {
        return stageContentResult(usage, contentType, declaredSizeBytes, content, idempotencyKey, null, null)
                .stage();
    }

    /** Stages a store service-point image after the operations edge has resolved the store scope. */
    public StageReadback stageStoreServicePointImage(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String contentType,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey,
            String expectedDigest) {
        if (workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank())
            throw new AssetInputInvalidException();
        if (expectedDigest == null || !expectedDigest.matches("[a-f0-9]{64}"))
            throw new AssetInputInvalidException();
        return stageContentResult(
                        "STORE_SERVICE_POINT_IMAGE",
                        contentType,
                        declaredSizeBytes,
                        content,
                        idempotencyKey,
                        workspaceUuid,
                        groupWorkspaceKey,
                        expectedDigest)
                .stage();
    }

    /** Catalog staging rechecks the target-scope grant before its asset receipt can replay. */
    public StageReadback stageCatalogContent(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeRef,
            String dataNodeType,
            String contentType,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireCatalogOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType, ownerScopeGrant);
        return stageContentResult(
                        "CATALOG_ITEM_IMAGE",
                        contentType,
                        declaredSizeBytes,
                        content,
                        idempotencyKey,
                        workspaceUuid,
                        groupWorkspaceKey)
                .stage();
    }

    /**
     * Catalog staging accepts only the transaction-local command context. The legacy scalar/grant overload remains for
     * unmigrated callers and is deliberately not used by the catalog-inventory command path.
     */
    public StageReadback stageCatalogContent(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String contentType,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey) {
        requireCatalogContext(context, "asset", "stageOperationsCatalogAsset");
        return stageContentResult(
                        "CATALOG_ITEM_IMAGE",
                        contentType,
                        declaredSizeBytes,
                        content,
                        idempotencyKey,
                        context.workspaceUuid(),
                        context.groupWorkspaceKey())
                .stage();
    }

    /** The only catalog multipart entry validates the declared digest owner-side without byte-array transport. */
    @Override
    public CatalogAssetCommandApi.StageReadback stageCatalogAsset(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context, CatalogAssetCommandApi.StageCommand command) {
        requireCatalogContext(context, "asset", "stageOperationsCatalogAsset");
        if (command == null
                || command.fileName() == null
                || command.fileName().isBlank()
                || command.contentDigest() == null
                || !command.contentDigest().matches("[a-f0-9]{64}")) {
            throw new AssetInputInvalidException();
        }
        StageResult staged = stageContentResult(
                "CATALOG_ITEM_IMAGE",
                command.mediaType(),
                command.contentLength(),
                command.content(),
                command.idempotencyKey(),
                context.workspaceUuid(),
                context.groupWorkspaceKey(),
                command.contentDigest());
        return new CatalogAssetCommandApi.StageReadback(
                staged.stage().assetRef(),
                staged.stage().bindGrant(),
                staged.asset().status(),
                staged.stage().contentType(),
                staged.stage().sha256(),
                staged.asset().version());
    }

    /**
     * Stages a server-resolved sales-menu image. The target judgment belongs to sales-menu; this owner only validates
     * the opaque grant, stores the exact target relation, and owns the asset lifecycle.
     */
    @Override
    public SalesMenuAssetCommandApi.StageReadback stageSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            SalesMenuAssetCommandApi.StageCommand command) {
        requireSalesMenuOwnerScope(target, ownerScopeGrant, contextVersion, SALES_MENU_STAGE_REQUIREMENT);
        if (command == null || !command.contentDigest().matches("[a-f0-9]{64}")) throw new AssetInputInvalidException();
        StageResult staged = stageContentResult(
                SALES_MENU_IMAGE_USAGE,
                command.mediaType(),
                command.contentLength(),
                command.content(),
                command.idempotencyKey(),
                target.workspaceUuid(),
                target.groupWorkspaceKey(),
                command.contentDigest(),
                target);
        return new SalesMenuAssetCommandApi.StageReadback(
                staged.stage().assetRef(),
                target,
                staged.stage().bindGrant(),
                staged.asset().status(),
                staged.stage().contentType(),
                staged.stage().sha256(),
                staged.asset().version());
    }

    private StageResult stageContentResult(
            String usage,
            String contentType,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey) {
        return stageContentResult(
                usage, contentType, declaredSizeBytes, content, idempotencyKey, workspaceUuid, groupWorkspaceKey, null);
    }

    private StageResult stageContentResult(
            String usage,
            String contentType,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String expectedDigest) {
        return stageContentResult(
                usage,
                contentType,
                declaredSizeBytes,
                content,
                idempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                expectedDigest,
                null);
    }

    private StageResult stageContentResult(
            String usage,
            String contentType,
            long declaredSizeBytes,
            InputStream content,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String expectedDigest,
            SalesMenuAssetTarget salesMenuTarget) {
        if (!validUsageContentType(usage, contentType)
                || content == null
                || declaredSizeBytes <= 0
                || declaredSizeBytes > maxBytes(usage, contentType)) throw new AssetInputInvalidException();
        // Suspending an external DataSourceTransactionManager transaction would retain its
        // borrowed connection. Refuse after input-shape validation but before materialization or object I/O, so every
        // public stage entry keeps storage latency outside a caller-owned database transaction.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new AssetInvariantViolationException("owner.stage-storage-transaction");
        }
        MaterializedContent materialized = materializeAndValidate(usage, contentType, declaredSizeBytes, content);
        if (expectedDigest != null && !expectedDigest.equals(materialized.sha256())) {
            deleteQuietly(materialized.path());
            throw new AssetInputInvalidException();
        }
        String requestHash = sha256((usage + "|" + contentType + "|" + materialized.sizeBytes() + "|"
                        + materialized.sha256() + "|" + workspaceUuid + "|" + groupWorkspaceKey + "|"
                        + salesMenuTargetKey(salesMenuTarget))
                .getBytes(StandardCharsets.UTF_8));
        String receiptScope = receiptScope(workspaceUuid);
        if (idempotencyKey != null) {
            if (idempotencyKey.length() < 16 || idempotencyKey.length() > 128) {
                deleteQuietly(materialized.path());
                throw new AssetInputInvalidException();
            }
        }
        UUID assetRef = UUID.randomUUID();
        String digest = materialized.sha256();
        String objectKey = objects.objectKey("static/" + digest + suffix(contentType));
        String grant = secret();
        long now = time.currentEpochMillis();
        long expires = now + 15 * 60 * 1000L;
        // Stage entry points deliberately begin no transaction. Object I/O must finish before
        // receipt arbitration borrows a database connection; suspending an already-borrowed
        // DataSourceTransactionManager transaction does not return that connection to its pool.
        boolean uploadedByThisAttempt = false;
        try {
            uploadedByThisAttempt = ensurePhysicalObject(objectKey, contentType, materialized);
            return new TransactionTemplate(transactions)
                    .execute(status -> writeStagedContent(
                            usage,
                            contentType,
                            idempotencyKey,
                            workspaceUuid,
                            groupWorkspaceKey,
                            materialized,
                            requestHash,
                            receiptScope,
                            assetRef,
                            digest,
                            objectKey,
                            grant,
                            now,
                            expires,
                            salesMenuTarget));
        } catch (RuntimeException failure) {
            scheduleUnreferencedUploadCleanup(objectKey, uploadedByThisAttempt);
            throw failure;
        } finally {
            try {
                Files.deleteIfExists(materialized.path());
            } catch (IOException cleanupFailure) {
            }
        }
    }

    private StageResult writeStagedContent(
            String usage,
            String contentType,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            MaterializedContent materialized,
            String requestHash,
            String receiptScope,
            UUID assetRef,
            String digest,
            String objectKey,
            String grant,
            long now,
            long expires,
            SalesMenuAssetTarget salesMenuTarget) {
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            if (idempotencyKey != null) {
                lockReceipt(receiptScope, idempotencyKey);
                PlatformAssetPersistence.Receipt replay = findReceipt(receiptScope, idempotencyKey);
                if (replay != null) {
                    // A released catalog stage is a completed lifecycle, not a different request. The UI uses a
                    // deterministic content key, so closing an editor and uploading the same file again legitimately
                    // reuses this receipt. A changed payload must still fail closed.
                    if (!requestHash.equals(replay.requestHash())) {
                        log.atWarn()
                                .addKeyValue("event", "PLATFORM_ASSET_STAGE_IDEMPOTENCY_CONFLICT")
                                .addKeyValue("reason", "RECEIPT_REQUEST_MISMATCH")
                                .addKeyValue("receiptStatus", replay.status())
                                .log("catalog asset stage idempotency conflict");
                        throw new AssetIdempotencyConflictException();
                    }
                    if (salesMenuTarget != null) {
                        requireSalesMenuAssetTargetRow(replay.assetRef(), salesMenuTarget);
                    }
                    if ("RELEASED".equals(replay.status())) {
                        log.atInfo()
                                .addKeyValue("event", "PLATFORM_ASSET_STAGE_RESTAGE")
                                .addKeyValue("reason", "RELEASED_RECEIPT_REPLAY")
                                .addKeyValue("receiptStatus", replay.status())
                                .log("catalog asset stage reopens a released content reference");
                    } else {
                        // The catalog may claim the staged ref before a client retries the same multipart command.
                        // ACTIVE is still the same successful stage result; only a released asset needs to continue
                        // through the normal content-addressed restage path below.
                        String renewed = secret();
                        long replayExpires = time.currentEpochMillis() + 15 * 60 * 1000L;
                        issueBindGrant(replay.assetRef(), renewed, replayExpires);
                        return stageResult(
                                usage,
                                replay.assetRef(),
                                renewed,
                                replayExpires,
                                replay.contentType(),
                                replay.sizeBytes(),
                                replay.sha256(),
                                replay.status(),
                                replay.version());
                    }
                }
            }
            // Object I/O completed outside a database transaction. Content-addressed
            // objects are shared, so an existing object is never overwritten or later deleted by
            // this attempt's relational rollback/constraint failure.
            // Physical bytes are shared by digest. Logical reference reuse is a separate,
            // workspace-owned policy: catalog images reuse an existing lifecycle only in
            // their own workspace.
            // Workspace logos always receive a fresh asset ref and one-time bind grant.
            lockObjectReference(objectKey);
            PlatformAssetPersistence.ExistingAsset existing =
                    "CATALOG_ITEM_IMAGE".equals(usage) ? findCatalogByStorageKey(workspaceUuid, objectKey) : null;
            if (existing != null
                    && !sameCatalogContent(existing, usage, contentType, materialized.sizeBytes(), digest)) {
                throw new AssetInvariantViolationException("owner.metadata-conflict");
            }
            if (existing != null) {
                // Physical bytes are content-addressed and shared. Re-uploading identical
                // catalog bytes reuses only this workspace's logical row. A RELEASED row may
                // be restaged without changing its workspace ownership.
                boolean restagedByThisCommand = "RELEASED".equals(existing.status());
                if (restagedByThisCommand) {
                    existing = restageReleasedCatalogContent(
                            existing, workspaceUuid, groupWorkspaceKey, contentType, materialized.sizeBytes(), digest);
                }
                if ("STAGED".equals(existing.status())) {
                    if (!restagedByThisCommand) {
                        // A different command must not rotate the pending command's one-time
                        // grant. Only receipt replay above may renew a grant for the same intent.
                        log.atWarn()
                                .addKeyValue("event", "PLATFORM_ASSET_STAGE_IDEMPOTENCY_CONFLICT")
                                .addKeyValue("reason", "STAGED_ASSET_OWNED_BY_OTHER_COMMAND")
                                .addKeyValue("assetStatus", existing.status())
                                .log("catalog asset stage is already pending under another command");
                        throw new AssetIdempotencyConflictException();
                    }
                } else if (!"ACTIVE".equals(existing.status())) {
                    throw new AssetInvariantViolationException("owner.lifecycle-conflict");
                }
                issueBindGrant(existing.assetRef(), grant, expires);
                recordStageReceipt(
                        receiptScope,
                        idempotencyKey,
                        existing.assetRef(),
                        requestHash,
                        contentType,
                        materialized.sizeBytes(),
                        digest,
                        now);
                return stageResult(
                        usage,
                        existing.assetRef(),
                        grant,
                        expires,
                        contentType,
                        materialized.sizeBytes(),
                        digest,
                        existing.status(),
                        existing.version());
            }
            try {
                persistence.insertStagedAsset(
                        assetRef,
                        usage,
                        workspaceUuid,
                        groupWorkspaceKey,
                        objectKey,
                        objects.bucketName(),
                        contentType,
                        materialized.sizeBytes(),
                        digest,
                        now);
            } catch (DuplicateKeyException race) {
                // Only catalog has a content-level logical uniqueness constraint. A logo
                // duplicate-key failure is unrelated to object sharing and must not be
                // reinterpreted as a reusable asset lifecycle.
                if (!"CATALOG_ITEM_IMAGE".equals(usage)) throw race;
                PlatformAssetPersistence.ExistingAsset winner = findCatalogByStorageKey(workspaceUuid, objectKey);
                if (winner == null || !sameCatalogContent(winner, usage, contentType, materialized.sizeBytes(), digest))
                    throw race;
                boolean restagedByThisCommand = "RELEASED".equals(winner.status());
                if (restagedByThisCommand) {
                    winner = restageReleasedCatalogContent(
                            winner, workspaceUuid, groupWorkspaceKey, contentType, materialized.sizeBytes(), digest);
                }
                if ("STAGED".equals(winner.status())) {
                    if (!restagedByThisCommand) throw new AssetIdempotencyConflictException(race);
                } else if (!"ACTIVE".equals(winner.status())) throw race;
                issueBindGrant(winner.assetRef(), grant, expires);
                recordStageReceipt(
                        receiptScope,
                        idempotencyKey,
                        winner.assetRef(),
                        requestHash,
                        contentType,
                        materialized.sizeBytes(),
                        digest,
                        now);
                return stageResult(
                        usage,
                        winner.assetRef(),
                        grant,
                        expires,
                        contentType,
                        materialized.sizeBytes(),
                        digest,
                        winner.status(),
                        winner.version());
            }
            issueBindGrant(assetRef, grant, expires);
            if (salesMenuTarget != null) writeSalesMenuAssetTarget(assetRef, salesMenuTarget, now);
            recordStageReceipt(
                    receiptScope,
                    idempotencyKey,
                    assetRef,
                    requestHash,
                    contentType,
                    materialized.sizeBytes(),
                    digest,
                    now);
            return stageResult(
                    usage, assetRef, grant, expires, contentType, materialized.sizeBytes(), digest, "STAGED", 1L);
        }
    }

    /** Releases only an unclaimed sales-menu stage after the sales-menu owner supplied the resolved target. */
    @Override
    @Transactional
    public SalesMenuAssetCommandApi.ReleaseReadback releaseStagedSalesMenuItemImage(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            SalesMenuAssetCommandApi.ReleaseCommand command) {
        requireSalesMenuOwnerScope(target, ownerScopeGrant, contextVersion, SALES_MENU_RELEASE_REQUIREMENT);
        if (command == null) throw new AssetInputInvalidException();
        String requestHash =
                salesMenuReleaseRequestHash("RELEASE_STAGED", target, command.assetRef(), command.expectedVersion());
        String receiptScope = receiptScope(target.workspaceUuid());
        lockReceipt(receiptScope, command.idempotencyKey());
        PlatformAssetPersistence.Receipt replay = findReceipt(receiptScope, command.idempotencyKey());
        SalesMenuAssetRow current = lockSalesMenuAssetAndTargetForRelease(command.assetRef(), target);
        if (replay != null) {
            if (!requestHash.equals(replay.requestHash()) || !command.assetRef().equals(replay.assetRef())) {
                throw new AssetIdempotencyConflictException();
            }
            if (!"RELEASED".equals(current.status())) throw new AssetClaimRejectedException();
            return new SalesMenuAssetCommandApi.ReleaseReadback(
                    storedSalesMenuTarget(current),
                    current.assetRef(),
                    current.releasedAt() == null ? time.currentEpochMillis() : current.releasedAt(),
                    current.version());
        }
        if (!"STAGED".equals(current.status()) || current.version() != command.expectedVersion()) {
            throw new AssetClaimRejectedException();
        }
        long releasedAt = time.currentEpochMillis();
        int changed = persistence.releaseStagedSalesMenuItemImage(
                releasedAt,
                command.assetRef(),
                command.expectedVersion(),
                target.workspaceUuid(),
                target.groupWorkspaceKey());
        if (changed != 1) throw new AssetClaimRejectedException();
        AssetReadback released = new AssetReadback(
                command.assetRef(),
                SALES_MENU_IMAGE_USAGE,
                "RELEASED",
                command.expectedVersion() + 1,
                current.sizeBytes());
        recordReleaseReceipt(receiptScope, command.idempotencyKey(), command.assetRef(), requestHash, released);
        return new SalesMenuAssetCommandApi.ReleaseReadback(
                storedSalesMenuTarget(current), command.assetRef(), releasedAt, released.version());
    }

    /** Claims all newly staged refs atomically after locking every asset and its owner-local target row. */
    @Override
    @Transactional
    public SalesMenuAssetCommandApi.ClaimReadback claimSalesMenuItemImages(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            List<SalesMenuAssetCommandApi.AssetBinding> bindings) {
        requireSalesMenuOwnerScope(target, ownerScopeGrant, contextVersion, SALES_MENU_CLAIM_REQUIREMENT);
        List<SalesMenuAssetCommandApi.AssetBinding> requested = bindings == null ? List.of() : List.copyOf(bindings);
        LinkedHashSet<UUID> refs = new LinkedHashSet<>();
        for (SalesMenuAssetCommandApi.AssetBinding binding : requested) {
            if (binding == null || !refs.add(binding.assetRef())) throw new AssetInputInvalidException();
        }
        Map<UUID, SalesMenuAssetRow> locked = new LinkedHashMap<>();
        refs.stream().sorted().forEach(assetRef -> locked.put(assetRef, lockSalesMenuAssetAndTarget(assetRef, target)));
        long now = time.currentEpochMillis();
        List<SalesMenuAssetCommandApi.AssetMetadata> claimed = new ArrayList<>();
        for (SalesMenuAssetCommandApi.AssetBinding binding : requested) {
            SalesMenuAssetRow current = locked.get(binding.assetRef());
            if (!"STAGED".equals(current.status())) throw new AssetClaimRejectedException();
            String proof = sha256(binding.bindGrant().getBytes(StandardCharsets.UTF_8));
            int consumed = persistence.consumeSalesMenuBindGrant(
                    now, binding.assetRef(), target.workspaceUuid(), target.groupWorkspaceKey(), proof);
            if (consumed != 1) throw new AssetClaimRejectedException();
            SalesMenuAssetCommandApi.AssetMetadata activated =
                    activateSalesMenuAsset(binding.assetRef(), target, current.version(), now);
            claimed.add(activated);
        }
        return new SalesMenuAssetCommandApi.ClaimReadback(target, claimed);
    }

    @Override
    @Transactional
    public void claim(UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String bindGrant) {
        if (assetRef == null
                || workspaceUuid == null
                || groupWorkspaceKey == null
                || bindGrant == null
                || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        int consumed = persistence.consumeWorkspaceLogoBindGrant(now, assetRef, proof);
        if (consumed != 1) throw new AssetClaimRejectedException();
        int changed = persistence.activateWorkspaceLogo(workspaceUuid, groupWorkspaceKey, now, assetRef);
        if (changed != 1) throw new AssetClaimRejectedException();
    }

    /**
     * The initial catalog claim consumes the scope-bound staging grant. An ACTIVE catalog image is deliberately
     * reusable from another approved catalog scope and therefore never requires a second asset bind proof, but every
     * command still rechecks its server-minted catalog grant before reading lifecycle state.
     */
    @Transactional
    public AssetReadback claimCatalogStaged(
            UUID assetRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeRef,
            String dataNodeType,
            String bindGrant,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireCatalogOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType, ownerScopeGrant);
        return claimCatalogStagedAfterAuthorization(assetRef, workspaceUuid, groupWorkspaceKey, bindGrant);
    }

    /** Catalog save settlement retains its catalog command token; no legacy grant is reconstructed. */
    @Transactional
    public AssetReadback claimCatalogStaged(
            UUID assetRef, String bindGrant, WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        requireCatalogContext(context, "catalog", null);
        return claimCatalogStagedAfterAuthorization(
                assetRef, context.workspaceUuid(), context.groupWorkspaceKey(), bindGrant);
    }

    private AssetReadback claimCatalogStagedAfterAuthorization(
            UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String bindGrant) {
        if (assetRef == null) throw new AssetClaimRejectedException();
        AssetReadback current = require(assetRef);
        requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        if ("ACTIVE".equals(current.status()) && "CATALOG_ITEM_IMAGE".equals(current.usage())) return current;
        if (bindGrant == null || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        int consumed = persistence.consumeCatalogBindGrant(now, assetRef, workspaceUuid, groupWorkspaceKey, proof);
        if (consumed != 1) throw new AssetClaimRejectedException();
        PlatformAssetPersistence.AssetRow activated =
                persistence.activateCatalogAsset(assetRef, now, workspaceUuid, groupWorkspaceKey);
        if (activated == null) throw new AssetClaimRejectedException();
        return new AssetReadback(
                activated.assetRef(), activated.usage(), activated.status(), activated.version(), activated.sizeBytes());
    }

    @Override
    @Transactional
    public void release(UUID assetRef, UUID workspaceUuid) {
        persistence.releaseActiveAsset(time.currentEpochMillis(), assetRef, workspaceUuid);
    }

    /** Releases an unclaimed staging asset only when the one-time staging proof is presented. */
    @Override
    @Transactional
    public void releaseStaged(UUID assetRef, String bindGrant) {
        if (assetRef == null || bindGrant == null || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        int released = persistence.consumeStagedBindGrant(now, assetRef, proof);
        if (released != 1) throw new AssetClaimRejectedException();
        persistence.markStagedBindGrantConsumed(now, assetRef, proof);
    }

    @Transactional
    public AssetReadback releaseStagedStoreServicePointImage(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID assetRef,
            long expectedVersion) {
        if (workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank() || assetRef == null)
            throw new AssetClaimRejectedException();
        AssetReadback current = require(assetRef);
        if (!"STORE_SERVICE_POINT_IMAGE".equals(current.usage()) || !"STAGED".equals(current.status()))
            throw new AssetClaimRejectedException();
        int changed = persistence.releaseStagedStoreServicePointImage(
                time.currentEpochMillis(), assetRef, expectedVersion, workspaceUuid, groupWorkspaceKey);
        if (changed != 1) throw new AssetClaimRejectedException();
        return require(assetRef);
    }

    @Override
    @Transactional
    public StoreServicePointAssetLifecycle.AssetClaim claimStaged(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID servicePointRef,
            UUID assetRef,
            String bindGrant) {
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || storeRef == null
                || servicePointRef == null
                || assetRef == null
                || bindGrant == null
                || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        AssetReadback current = require(assetRef);
        if (!"STAGED".equals(current.status()) || !"STORE_SERVICE_POINT_IMAGE".equals(current.usage()))
            throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        if (persistence.consumeStoreServicePointBindGrant(now, assetRef, workspaceUuid, groupWorkspaceKey, proof) != 1)
            throw new AssetClaimRejectedException();
        PlatformAssetPersistence.AssetRow activated = persistence.activateStoreServicePointImage(
                assetRef, servicePointRef, now, current.version(), workspaceUuid, groupWorkspaceKey);
        if (activated == null) throw new AssetClaimRejectedException();
        return new StoreServicePointAssetLifecycle.AssetClaim(
                activated.assetRef(), activated.usage(), activated.status(), activated.version(), activated.sizeBytes());
    }

    @Override
    @Transactional
    public void releaseActive(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID servicePointRef,
            UUID assetRef) {
        if (workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank()
                || storeRef == null || servicePointRef == null || assetRef == null)
            throw new AssetClaimRejectedException();
        if (persistence.releaseActiveStoreServicePointImage(
                        time.currentEpochMillis(), assetRef, servicePointRef, workspaceUuid, groupWorkspaceKey)
                != 1) throw new AssetClaimRejectedException();
    }

    /** Discards only an unclaimed catalog stage belonging to the authenticated workspace. */
    private AssetReadback releaseCatalogStaged(
            UUID assetRef, long expectedVersion, UUID workspaceUuid, String groupWorkspaceKey) {
        if (assetRef == null || workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank())
            throw new AssetClaimRejectedException();
        int changed = persistence.releaseStagedCatalogAsset(
                time.currentEpochMillis(), assetRef, expectedVersion, workspaceUuid, groupWorkspaceKey);
        if (changed != 1) throw new AssetClaimRejectedException();
        return require(assetRef);
    }

    /** Idempotent catalog release path. The receipt is owned by the asset owner. */
    @Transactional
    public AssetReadback releaseCatalogStaged(
            UUID assetRef,
            long expectedVersion,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeRef,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireCatalogOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType, ownerScopeGrant);
        return releaseCatalogStagedAfterAuthorization(
                assetRef, expectedVersion, idempotencyKey, workspaceUuid, groupWorkspaceKey);
    }

    private AssetReadback releaseCatalogStagedAfterAuthorization(
            UUID assetRef, long expectedVersion, String idempotencyKey, UUID workspaceUuid, String groupWorkspaceKey) {
        if (assetRef == null || idempotencyKey == null || idempotencyKey.isBlank())
            throw new AssetClaimRejectedException();
        String requestHash = sha256(
                (assetRef + "|" + expectedVersion + "|CATALOG_ITEM_IMAGE_RELEASE").getBytes(StandardCharsets.UTF_8));
        String receiptScope = receiptScope(workspaceUuid);
        lockReceipt(receiptScope, idempotencyKey);
        PlatformAssetPersistence.Receipt replay = findReceipt(receiptScope, idempotencyKey);
        if (replay != null) {
            if (!requestHash.equals(replay.requestHash()) || !assetRef.equals(replay.assetRef()))
                throw new AssetIdempotencyConflictException();
            return require(assetRef);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            AssetReadback released = releaseCatalogStaged(assetRef, expectedVersion, workspaceUuid, groupWorkspaceKey);
            recordReleaseReceipt(receiptScope, idempotencyKey, assetRef, requestHash, released);
            return released;
        }
    }

    /**
     * Transaction-local typed catalog release entry; see {@link #stageCatalogContent(WorkspaceExecutionContext, String,
     * long, InputStream, String)}.
     */
    @Transactional
    public AssetReadback releaseCatalogStaged(
            UUID assetRef,
            long expectedVersion,
            String idempotencyKey,
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        requireCatalogContext(context, "asset", "releaseOperationsCatalogStagedAsset");
        return releaseCatalogStagedAfterAuthorization(
                assetRef, expectedVersion, idempotencyKey, context.workspaceUuid(), context.groupWorkspaceKey());
    }

    @Override
    @Transactional
    public CatalogAssetCommandApi.ReleaseReadback releaseStagedCatalogAsset(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogAssetCommandApi.ReleaseCommand command) {
        if (command == null) throw new AssetInputInvalidException();
        AssetReadback released =
                releaseCatalogStaged(command.assetRef(), command.expectedVersion(), command.idempotencyKey(), context);
        return new CatalogAssetCommandApi.ReleaseReadback(
                released.assetRef(), time.currentEpochMillis(), released.version());
    }

    /** Receipt creation stays after the adapter's lock and catalog-owned global no-reference judgment. */
    @Override
    @Transactional
    public CatalogAssetCommandApi.ReleaseReadback releaseUnreferencedCatalogAsset(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogAssetCommandApi.ReleaseCommand command) {
        requireCatalogContext(context, "asset", "releaseOperationsCatalogStagedAsset");
        if (command == null) throw new AssetInputInvalidException();
        AssetReadback released = releaseUnreferencedCatalogAssetAfterAuthorization(
                command.assetRef(), command.expectedVersion(), command.idempotencyKey(), context.workspaceUuid());
        return new CatalogAssetCommandApi.ReleaseReadback(
                released.assetRef(), time.currentEpochMillis(), released.version());
    }

    /**
     * The catalog owner has already performed its global no-reference judgement before it supplies a prior ref here.
     * This owner keeps lifecycle serialization and grant consumption local: lock every ref, claim the selected staged
     * refs, then release only prior refs that are no longer selected by this save.
     */
    @Override
    @Transactional
    public CatalogAssetCommandApi.SaveSettlementReadback settleCatalogSaveAssets(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            CatalogAssetCommandApi.SaveSettlementCommand command) {
        requireCatalogContext(context, "catalog", null);
        if (command == null
                || command.idempotencyKeyBase() == null
                || command.idempotencyKeyBase().isBlank()) throw new AssetInputInvalidException();
        LinkedHashSet<UUID> lockRefs = new LinkedHashSet<>();
        for (CatalogAssetCommandApi.AssetBinding binding : command.bindings()) {
            if (binding == null || binding.assetRef() == null) throw new AssetInputInvalidException();
            lockRefs.add(binding.assetRef());
        }
        for (CatalogAssetCommandApi.PriorAssetReference prior : command.priorReferences()) {
            if (prior == null || prior.assetRef() == null) throw new AssetInputInvalidException();
            lockRefs.add(prior.assetRef());
        }
        lockCatalogReferences(lockRefs);
        LinkedHashSet<UUID> selectedRefs = new LinkedHashSet<>();
        List<CatalogAssetCommandApi.AssetMetadata> claimed = new ArrayList<>();
        for (CatalogAssetCommandApi.AssetBinding binding : command.bindings()) {
            if (!selectedRefs.add(binding.assetRef())) throw new AssetInputInvalidException();
            AssetReadback asset = claimCatalogStagedAfterAuthorization(
                    binding.assetRef(), context.workspaceUuid(), context.groupWorkspaceKey(), binding.bindGrant());
            claimed.add(new CatalogAssetCommandApi.AssetMetadata(
                    asset.assetRef(), asset.status(), asset.version(), asset.sizeBytes()));
        }
        List<CatalogAssetCommandApi.AssetMetadata> released = new ArrayList<>();
        LinkedHashSet<UUID> releasedRefs = new LinkedHashSet<>();
        for (CatalogAssetCommandApi.PriorAssetReference prior : command.priorReferences()) {
            if (selectedRefs.contains(prior.assetRef()) || !releasedRefs.add(prior.assetRef())) continue;
            AssetReadback current = require(prior.assetRef());
            requireCatalogAssetInWorkspace(prior.assetRef(), context.workspaceUuid());
            AssetReadback asset = releaseUnreferencedCatalogAssetAfterAuthorization(
                    prior.assetRef(),
                    current.version(),
                    catalogSaveSettlementReleaseKey(command.idempotencyKeyBase(), prior.assetRef()),
                    context.workspaceUuid());
            released.add(new CatalogAssetCommandApi.AssetMetadata(
                    asset.assetRef(), asset.status(), asset.version(), asset.sizeBytes()));
        }
        return new CatalogAssetCommandApi.SaveSettlementReadback(claimed, released);
    }

    private String catalogSaveSettlementReleaseKey(String idempotencyKeyBase, UUID assetRef) {
        return sha256(
                (idempotencyKeyBase + "|catalog-save-settlement-release|" + assetRef).getBytes(StandardCharsets.UTF_8));
    }

    /** Releases an active catalog asset only after the catalog owner supplied a global no-reference judgment. */
    @Transactional
    public AssetReadback releaseUnreferencedCatalogAsset(
            UUID assetRef,
            long expectedVersion,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeRef,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireCatalogOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType, ownerScopeGrant);
        return releaseUnreferencedCatalogAssetAfterAuthorization(
                assetRef, expectedVersion, idempotencyKey, workspaceUuid);
    }

    /** Owner-local version read: callers never pre-read an asset merely to supply its CAS value. */
    @Transactional
    public AssetReadback releaseUnreferencedCatalogAsset(
            UUID assetRef,
            String idempotencyKey,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeRef,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireCatalogOwnerScopeGrant(workspaceUuid, groupWorkspaceKey, dataNodeRef, dataNodeType, ownerScopeGrant);
        if (assetRef == null || idempotencyKey == null || idempotencyKey.isBlank())
            throw new AssetClaimRejectedException();
        String requestHash = sha256(
                (assetRef + "|CATALOG_ITEM_IMAGE_GLOBAL_RELEASE_OWNER_LOCAL_VERSION").getBytes(StandardCharsets.UTF_8));
        lockReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey);
        PlatformAssetPersistence.Receipt replay = findReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey);
        if (replay != null) {
            if (!requestHash.equals(replay.requestHash()) || !assetRef.equals(replay.assetRef()))
                throw new AssetIdempotencyConflictException();
            return requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        }
        AssetReadback current = requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            int changed = persistence.releaseActiveCatalogAsset(
                    time.currentEpochMillis(), assetRef, current.version(), workspaceUuid);
            if (changed != 1) throw new AssetClaimRejectedException();
            AssetReadback released = require(assetRef);
            recordReleaseReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey, assetRef, requestHash, released);
            return released;
        }
    }

    private AssetReadback releaseUnreferencedCatalogAssetAfterAuthorization(
            UUID assetRef, long expectedVersion, String idempotencyKey, UUID workspaceUuid) {
        if (assetRef == null || idempotencyKey == null || idempotencyKey.isBlank())
            throw new AssetClaimRejectedException();
        String requestHash = sha256((assetRef + "|" + expectedVersion + "|CATALOG_ITEM_IMAGE_GLOBAL_RELEASE")
                .getBytes(StandardCharsets.UTF_8));
        lockReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey);
        PlatformAssetPersistence.Receipt replay = findReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey);
        if (replay != null) {
            if (!requestHash.equals(replay.requestHash()) || !assetRef.equals(replay.assetRef()))
                throw new AssetIdempotencyConflictException();
            return requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            int changed = persistence.releaseAuthorizedCatalogAsset(
                    time.currentEpochMillis(), assetRef, expectedVersion, workspaceUuid);
            if (changed != 1) throw new AssetClaimRejectedException();
            AssetReadback released = require(assetRef);
            recordReleaseReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey, assetRef, requestHash, released);
            return released;
        }
    }

    @Transactional
    public AssetReadback releaseUnreferencedCatalogAsset(
            UUID assetRef,
            long expectedVersion,
            String idempotencyKey,
            WorkspaceExecutionContext<CatalogAuthorizationScope> context) {
        // This lifecycle release is coordinated by a catalog save, not the public
        // asset-release endpoint. It must therefore retain the caller's catalog token.
        requireCatalogContext(context, "catalog", null);
        return releaseUnreferencedCatalogAssetAfterAuthorization(
                assetRef, expectedVersion, idempotencyKey, context.workspaceUuid());
    }

    /**
     * Holds one PostgreSQL transaction advisory lock for every catalog assetRef until the surrounding REQUIRED
     * transaction finishes. Catalog mutations acquire the same locks before changing a reference, so a global reference
     * judgment and lifecycle release share one assetRef-level serialization point without a duplicate reference table.
     */
    @Override
    @Transactional
    public void lockCatalogReferences(Collection<UUID> assetRefs) {
        if (assetRefs == null || assetRefs.isEmpty()) return;
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>();
        for (UUID assetRef : assetRefs) if (assetRef != null) distinct.add(assetRef);
        LinkedHashSet<UUID> held = transactionCatalogAssetLocks();
        distinct.stream().sorted().forEach(assetRef -> {
            if (held != null && held.contains(assetRef)) return;
            persistence.lockCatalogReference(assetRef);
            if (held != null) held.add(assetRef);
        });
    }

    @SuppressWarnings("unchecked")
    private LinkedHashSet<UUID> transactionCatalogAssetLocks() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return null;
        Object existing = TransactionSynchronizationManager.getResource(CATALOG_ASSET_LOCK_RESOURCE_KEY);
        if (existing != null) return (LinkedHashSet<UUID>) existing;
        LinkedHashSet<UUID> held = new LinkedHashSet<>();
        TransactionSynchronizationManager.bindResource(CATALOG_ASSET_LOCK_RESOURCE_KEY, held);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (TransactionSynchronizationManager.hasResource(CATALOG_ASSET_LOCK_RESOURCE_KEY))
                    TransactionSynchronizationManager.unbindResource(CATALOG_ASSET_LOCK_RESOURCE_KEY);
            }
        });
        return held;
    }

    @Override
    @Transactional
    public void lockCatalogReference(UUID assetRef) {
        if (assetRef == null) throw new AssetInputInvalidException();
        lockCatalogReferences(List.of(assetRef));
    }

    @Transactional(readOnly = true)
    public AssetReadback require(UUID assetRef) {
        PlatformAssetPersistence.AssetRow row = persistence.readAsset(assetRef);
        if (row == null) throw new AssetNotFoundException();
        return new AssetReadback(row.assetRef(), row.usage(), row.status(), row.version(), row.sizeBytes());
    }

    /**
     * Bounded owner task read for sales-menu item images. The caller supplies only opaque refs; usage and lifecycle
     * metadata are selected and returned by this owner in the same query.
     */
    @Override
    @Transactional(readOnly = true)
    public Map<UUID, SalesMenuAssetReadApi.SalesMenuItemImage> readSalesMenuItemImages(Set<UUID> assetRefs) {
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>(assetRefs == null ? List.of() : assetRefs);
        if (distinct.isEmpty()) return Map.of();
        if (distinct.contains(null)) throw new AssetNotFoundException();
        List<UUID> ids = List.copyOf(distinct);
        Map<UUID, SalesMenuAssetReadApi.SalesMenuItemImage> images = new LinkedHashMap<>();
        for (PlatformAssetPersistence.SalesMenuAssetImage row : persistence.readSalesMenuItemImages(ids)) {
            if (!SALES_MENU_IMAGE_USAGE.equals(row.usage())) {
                throw new AssetInvariantViolationException("owner.sales-menu-read-usage");
            }
            images.put(
                    row.assetRef(),
                    new SalesMenuAssetReadApi.SalesMenuItemImage(
                            row.assetRef(),
                            new SalesMenuAssetReadApi.PublicReference(
                                    objects.publicUrl(row.objectKey()), row.contentType(), row.sha256()),
                            SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE,
                            row.status(),
                            row.version(),
                            row.sizeBytes()));
        }
        if (images.size() != ids.size()) throw new AssetNotFoundException();
        for (UUID id : ids) if (!images.containsKey(id)) throw new AssetNotFoundException();
        return Map.copyOf(images);
    }

    private AssetReadback requireCatalogAssetInWorkspace(UUID assetRef, UUID workspaceUuid) {
        PlatformAssetPersistence.AssetRow row = persistence.readCatalogAssetInWorkspace(assetRef, workspaceUuid);
        if (row == null) throw new AssetClaimRejectedException();
        return new AssetReadback(row.assetRef(), row.usage(), row.status(), row.version(), row.sizeBytes());
    }

    @Transactional(readOnly = true)
    public PublicAssetReference requireActivePublicReference(UUID assetRef) {
        PlatformAssetPersistence.ActiveAsset asset = persistence.readActiveAsset(assetRef);
        if (asset == null) throw new AssetNotFoundException();
        return new PublicAssetReference(objects.publicUrl(asset.objectKey()), asset.contentType(), asset.sha256());
    }

    /** Bounded owner task read for a collection surface; absent/inactive/object-missing remains a failure. */
    @Transactional(readOnly = true)
    public Map<UUID, PublicAssetReference> requireActivePublicReferences(Collection<UUID> assetRefs) {
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>(assetRefs == null ? List.of() : assetRefs);
        if (distinct.isEmpty()) return Map.of();
        if (distinct.contains(null)) throw new AssetNotFoundException();
        List<UUID> ids = List.copyOf(distinct);
        Map<UUID, PlatformAssetPersistence.ActiveAsset> active = persistence.readActiveAssets(ids);
        if (active.size() != ids.size()) throw new AssetNotFoundException();
        Map<UUID, PublicAssetReference> references = new LinkedHashMap<>();
        for (UUID id : ids) {
            PlatformAssetPersistence.ActiveAsset asset = active.get(id);
            if (asset == null) throw new AssetNotFoundException();
            references.put(
                    id,
                    new PublicAssetReference(
                            objects.publicUrl(asset.objectKey()), asset.contentType(), asset.sha256()));
        }
        return Map.copyOf(references);
    }

    private static boolean validUsageContentType(String usage, String contentType) {
        boolean approvedUsage = "GROUP_WORKSPACE_LOGO".equals(usage)
                || "CATALOG_ITEM_IMAGE".equals(usage)
                || SALES_MENU_IMAGE_USAGE.equals(usage)
                || "STORE_SERVICE_POINT_IMAGE".equals(usage);
        return approvedUsage
                && ("image/png".equals(contentType)
                        || "image/jpeg".equals(contentType)
                        || "image/webp".equals(contentType));
    }

    private <T> T storageValue(String operation, Supplier<T> action) {
        try {
            return action.get();
        } catch (AssetObjectStorageUnavailableException failure) {
            String resolvedOperation = failure.operation() == null ? operation : failure.operation();
            throw new AssetStorageUnavailableException(
                    resolvedOperation, failure, failure.httpStatus(), failure.serviceErrorCode());
        }
    }

    private void storageAction(String operation, Runnable action) {
        try {
            action.run();
        } catch (AssetObjectStorageUnavailableException failure) {
            String resolvedOperation = failure.operation() == null ? operation : failure.operation();
            throw new AssetStorageUnavailableException(
                    resolvedOperation, failure, failure.httpStatus(), failure.serviceErrorCode());
        }
    }

    private static boolean validContentType(String value) {
        return "image/png".equals(value)
                || "image/jpeg".equals(value)
                || "image/webp".equals(value)
                || "video/mp4".equals(value);
    }

    private static String suffix(String contentType) {
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "video/mp4" -> ".mp4";
            default -> throw new AssetInputInvalidException();
        };
    }

    private static long maxBytes(String usage, String contentType) {
        if (SALES_MENU_IMAGE_USAGE.equals(usage)) return MAX_SALES_MENU_IMAGE_BYTES;
        return "video/mp4".equals(contentType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    }

    private static MaterializedContent materializeAndValidate(
            String usage, String contentType, long declaredSizeBytes, InputStream source) {
        Path file;
        try {
            file = Files.createTempFile("catering-v2s-asset-", ".upload");
        } catch (IOException failure) {
            throw new AssetStorageUnavailableException("local.upload-materialization", failure);
        }
        long size = 0;
        byte[] prefix = new byte[8192];
        int prefixLength = 0;
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
        try (InputStream input = new BufferedInputStream(source);
                var output = Files.newOutputStream(file)) {
            byte[] buffer = new byte[8192];
            for (int read; (read = input.read(buffer)) != -1; ) {
                size += read;
                if (size > maxBytes(usage, contentType)) throw new AssetInputInvalidException();
                int copied = Math.min(read, prefix.length - prefixLength);
                if (copied > 0) {
                    System.arraycopy(buffer, 0, prefix, prefixLength, copied);
                    prefixLength += copied;
                }
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
        } catch (AssetInputInvalidException failure) {
            deleteQuietly(file);
            throw failure;
        } catch (IOException failure) {
            deleteQuietly(file);
            throw new AssetStorageUnavailableException("local.upload-materialization", failure);
        }
        if (size != declaredSizeBytes
                || size == 0
                || !matchesMagic(contentType, prefix, prefixLength)
                || (isImage(contentType) && !decodesImage(file))) {
            deleteQuietly(file);
            throw new AssetInputInvalidException();
        }
        return new MaterializedContent(file, size, HexFormat.of().formatHex(digest.digest()));
    }

    /** Object storage can block; suspend any database transaction and its connection while it runs. */
    private boolean ensurePhysicalObject(String objectKey, String contentType, MaterializedContent materialized) {
        try (InputStream upload = Files.newInputStream(materialized.path())) {
            if (storageValue("object.stat", () -> objects.exists(objectKey))) return false;
            storageAction("object.put", () -> objects.put(objectKey, contentType, materialized.sizeBytes(), upload));
            return true;
        } catch (IOException failure) {
            throw new AssetStorageUnavailableException("local.upload-read", failure);
        }
    }

    private static boolean isImage(String contentType) {
        return contentType.startsWith("image/");
    }

    private static boolean decodesImage(Path file) {
        try (InputStream input = Files.newInputStream(file)) {
            return ImageIO.read(input) != null;
        } catch (IOException failure) {
            return false;
        }
    }

    private static boolean matchesMagic(String contentType, byte[] value, int length) {
        return switch (contentType) {
            case "image/png" -> length >= 8
                    && value[0] == (byte) 0x89
                    && value[1] == 0x50
                    && value[2] == 0x4e
                    && value[3] == 0x47
                    && value[4] == 0x0d
                    && value[5] == 0x0a
                    && value[6] == 0x1a
                    && value[7] == 0x0a;
            case "image/jpeg" -> length >= 3
                    && value[0] == (byte) 0xff
                    && value[1] == (byte) 0xd8
                    && value[2] == (byte) 0xff;
            case "image/webp" -> length >= 12
                    && value[0] == 0x52
                    && value[1] == 0x49
                    && value[2] == 0x46
                    && value[3] == 0x46
                    && value[8] == 0x57
                    && value[9] == 0x45
                    && value[10] == 0x42
                    && value[11] == 0x50;
            case "video/mp4" -> length >= 12
                    && value[4] == 0x66
                    && value[5] == 0x74
                    && value[6] == 0x79
                    && value[7] == 0x70;
            default -> false;
        };
    }

    private void scheduleUnreferencedUploadCleanup(String objectKey, boolean uploadedByThisAttempt) {
        if (!uploadedByThisAttempt) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == TransactionSynchronization.STATUS_ROLLED_BACK)
                        deleteUnreferencedObjectAfterRollback(objectKey);
                }
            });
        } else {
            deleteUnreferencedObjectAfterRollback(objectKey);
        }
    }

    private void deleteUnreferencedObjectAfterRollback(String objectKey) {
        try {
            if (!persistence.isObjectReferenced(objects.bucketName(), objectKey)) objects.delete(objectKey);
        } catch (RuntimeException failure) {
            log.atWarn()
                    .addKeyValue("event", "PLATFORM_ASSET_ROLLBACK_CLEANUP_FAILED")
                    .addKeyValue("phase", "CLEANUP")
                    .addKeyValue("outcome", "FAILED")
                    .addKeyValue("storageOperation", "object.delete")
                    .addKeyValue("failureType", failure.getClass().getSimpleName())
                    .log("platform-asset rollback cleanup failed; immutable orphan remains eligible for managed "
                            + "cleanup");
        }
    }

    private PlatformAssetPersistence.ExistingAsset findCatalogByStorageKey(UUID workspaceUuid, String objectKey) {
        return persistence.findCatalogByStorageKey(workspaceUuid, objectKey);
    }

    private static boolean sameCatalogContent(
            PlatformAssetPersistence.ExistingAsset existing, String usage, String contentType, long sizeBytes, String sha256) {
        // Catalog images are referenceable by multiple business records and do not use the
        // one-time workspace-logo bind proof. Logo staging remains one asset/one live grant;
        // reusing it here would invalidate a concurrent caller's plaintext grant.
        return "CATALOG_ITEM_IMAGE".equals(usage)
                && usage.equals(existing.usage())
                && contentType.equals(existing.contentType())
                && sizeBytes == existing.sizeBytes()
                && sha256.equals(existing.sha256());
    }

    /** Restages this workspace's logical row only after its prior catalog lifecycle is fully released. */
    private PlatformAssetPersistence.ExistingAsset restageReleasedCatalogContent(
            PlatformAssetPersistence.ExistingAsset released,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String contentType,
            long sizeBytes,
            String sha256) {
        int changed = persistence.restageReleasedCatalogContent(
                released.assetRef(), workspaceUuid, contentType, sizeBytes, sha256);
        if (changed == 1) {
            return new PlatformAssetPersistence.ExistingAsset(
                    released.assetRef(),
                    released.usage(),
                    "STAGED",
                    released.version() + 1L,
                    released.contentType(),
                    released.sizeBytes(),
                    released.sha256());
        }
        PlatformAssetPersistence.ExistingAsset current =
                findCatalogByStorageKey(workspaceUuid, objects.objectKey("static/" + sha256 + suffix(contentType)));
        if (current == null
                || !sameCatalogContent(current, "CATALOG_ITEM_IMAGE", contentType, sizeBytes, sha256)
                || "RELEASED".equals(current.status())) {
            throw new AssetInvariantViolationException("owner.restage-conflict");
        }
        return current;
    }

    private void issueBindGrant(UUID assetRef, String grant, long expiresAt) {
        persistence.upsertBindGrant(assetRef, sha256(grant.getBytes(StandardCharsets.UTF_8)), expiresAt);
    }

    private static StageResult stageResult(
            String usage,
            UUID assetRef,
            String bindGrant,
            long expiresAt,
            String contentType,
            long sizeBytes,
            String sha256,
            String status,
            long version) {
        return new StageResult(
                new StageReadback(assetRef, bindGrant, expiresAt, contentType, sizeBytes, sha256),
                new AssetReadback(assetRef, usage, status, version, sizeBytes));
    }

    private static void requireSalesMenuOwnerScope(
            SalesMenuAssetTarget target,
            OperationsOwnerScopeGrant ownerScopeGrant,
            long contextVersion,
            String expectedRequirementId) {
        requireSalesMenuTarget(target);
        if (ownerScopeGrant == null
                || contextVersion < 0
                || !ownerScopeGrant.matchesExpectedContextVersion(contextVersion)
                || !ownerScopeGrant.matchesRequirementAndCapability(
                        target.workspaceUuid(),
                        target.groupWorkspaceKey(),
                        SALES_MENU_TARGET_TYPE,
                        target.storeRef(),
                        expectedRequirementId,
                        SALES_MENU_CAPABILITY)) {
            throw new AssetOwnerScopeForbiddenException();
        }
    }

    private static void requireSalesMenuTarget(SalesMenuAssetTarget target) {
        if (target == null || target.usage() != SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE) {
            throw new AssetInputInvalidException();
        }
    }

    private void writeSalesMenuAssetTarget(UUID assetRef, SalesMenuAssetTarget target, long now) {
        requireSalesMenuTarget(target);
        int inserted = persistence.insertSalesMenuAssetTarget(
                assetRef,
                target.workspaceUuid(),
                target.groupWorkspaceKey(),
                target.storeRef(),
                target.salesMenuRef(),
                target.salesItemRef(),
                target.expectedDraftVersion(),
                now);
        if (inserted != 1) throw new AssetInvariantViolationException("owner.sales-menu-target-write");
    }

    private static String salesMenuTargetKey(SalesMenuAssetTarget target) {
        if (target == null) return "";
        return target.workspaceUuid()
                + "|"
                + target.groupWorkspaceKey()
                + "|"
                + target.storeRef()
                + "|"
                + target.salesMenuRef()
                + "|"
                + target.salesItemRef()
                + "|"
                + target.usage().name()
                + "|"
                + target.expectedDraftVersion();
    }

    private static String salesMenuRequestHash(
            String operation, SalesMenuAssetTarget target, UUID assetRef, long expectedVersion) {
        return sha256((operation + "|" + salesMenuTargetKey(target) + "|" + assetRef + "|" + expectedVersion)
                .getBytes(StandardCharsets.UTF_8));
    }

    private static String salesMenuReleaseRequestHash(
            String operation, SalesMenuAssetTarget target, UUID assetRef, long expectedVersion) {
        return sha256((operation + "|" + salesMenuReleaseTargetKey(target) + "|" + assetRef + "|" + expectedVersion)
                .getBytes(StandardCharsets.UTF_8));
    }

    private static String salesMenuReleaseTargetKey(SalesMenuAssetTarget target) {
        if (target == null) return "";
        return target.workspaceUuid()
                + "|"
                + target.groupWorkspaceKey()
                + "|"
                + target.storeRef()
                + "|"
                + target.salesMenuRef()
                + "|"
                + target.salesItemRef()
                + "|"
                + target.usage().name();
    }

    private void requireSalesMenuAssetTargetRow(UUID assetRef, SalesMenuAssetTarget target) {
        lockSalesMenuAssetAndTarget(assetRef, target);
    }

    private SalesMenuAssetRow lockSalesMenuAssetAndTarget(UUID assetRef, SalesMenuAssetTarget target) {
        requireSalesMenuTarget(target);
        SalesMenuAssetRow row = readLockedSalesMenuAssetAndTarget(assetRef);
        if (!row.matches(target)) throw new AssetOwnerScopeForbiddenException();
        return row;
    }

    private SalesMenuAssetRow lockSalesMenuAssetAndTargetForRelease(UUID assetRef, SalesMenuAssetTarget target) {
        requireSalesMenuTarget(target);
        SalesMenuAssetRow row = readLockedSalesMenuAssetAndTarget(assetRef);
        if (!row.matchesRelease(target)) throw new AssetOwnerScopeForbiddenException();
        return row;
    }

    private SalesMenuAssetRow readLockedSalesMenuAssetAndTarget(UUID assetRef) {
        PlatformAssetPersistence.SalesMenuAssetRow persisted = persistence.readSalesMenuAssetAndTarget(assetRef);
        if (persisted == null) throw new AssetOwnerScopeForbiddenException();
        return new SalesMenuAssetRow(
                persisted.assetRef(),
                persisted.usage(),
                persisted.status(),
                persisted.version(),
                persisted.workspaceUuid(),
                persisted.groupWorkspaceKey(),
                persisted.sizeBytes(),
                persisted.releasedAt(),
                persisted.targetWorkspaceUuid(),
                persisted.targetGroupWorkspaceKey(),
                persisted.storeRef(),
                persisted.salesMenuRef(),
                persisted.salesItemRef(),
                persisted.targetUsage(),
                persisted.expectedDraftVersion());
    }

    private static SalesMenuAssetTarget storedSalesMenuTarget(SalesMenuAssetRow row) {
        return new SalesMenuAssetTarget(
                row.targetWorkspaceUuid(),
                row.targetGroupWorkspaceKey(),
                row.storeRef(),
                row.salesMenuRef(),
                row.salesItemRef(),
                SalesMenuAssetUsage.valueOf(row.targetUsage()),
                row.expectedDraftVersion());
    }

    private SalesMenuAssetCommandApi.AssetMetadata activateSalesMenuAsset(
            UUID assetRef, SalesMenuAssetTarget target, long expectedVersion, long now) {
        SalesMenuAssetCommandApi.AssetMetadata activated = persistence.activateSalesMenuAsset(
                assetRef, target.salesItemRef(), now, expectedVersion, target.workspaceUuid(), target.groupWorkspaceKey());
        if (activated == null) throw new AssetClaimRejectedException();
        return activated;
    }

    private static void requireCatalogOwnerScopeGrant(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeRef,
            String dataNodeType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        String expectedCapability = CatalogTargetCapability.forDataNodeType(dataNodeType);
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || groupWorkspaceKey.isBlank()
                || expectedCapability == null) throw new AssetOwnerScopeForbiddenException();
        try {
            UUID targetId = UUID.fromString(dataNodeRef);
            if (ownerScopeGrant != null
                    && ownerScopeGrant.matchesCapability(
                            workspaceUuid, groupWorkspaceKey, dataNodeType, targetId, expectedCapability)) return;
        } catch (RuntimeException ignored) {
        }
        throw new AssetOwnerScopeForbiddenException();
    }

    /** Verifies the generated operation policy and opaque grant without reconstructing legacy scope state. */
    private static CatalogAuthorizationScope requireCatalogContext(
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            String expectedOwner,
            String expectedOperationId) {
        if (context == null
                || context.workspaceUuid() == null
                || context.groupWorkspaceKey() == null
                || context.groupWorkspaceKey().isBlank()
                || context.ownerScope() == null
                || context.ownerGrant() == null
                || context.operationToken() == null) {
            throw new AssetOwnerScopeForbiddenException();
        }
        WorkspaceCommandOperationToken token = context.operationToken();
        CatalogAuthorizationScope scope = context.ownerScope();
        String capability = token.capabilityFor(scope.dataNodeType());
        if (!expectedOwner.equals(token.owner())
                || (expectedOperationId != null && !expectedOperationId.equals(token.operationId()))
                || token.copySourcePolicy() != WorkspaceCommandOperationToken.CopySourcePolicy.NONE
                || capability == null
                || !token.allowedDataNodeTypes().contains(scope.dataNodeType())
                || !context.ownerGrant()
                        .verifyFor(token.requirementId(), capability, scope.dataNodeType(), scope.dataNodeId())) {
            throw new AssetOwnerScopeForbiddenException();
        }
        return scope;
    }

    private PlatformAssetPersistence.Receipt findReceipt(String receiptScope, String idempotencyKey) {
        return persistence.findReceipt(receiptScope, idempotencyKey);
    }

    private void lockReceipt(String receiptScope, String idempotencyKey) {
        persistence.lockReceipt(receiptScope, idempotencyKey);
    }

    private void lockObjectReference(String objectKey) {
        persistence.lockObjectReference(objectKey);
    }

    private static String receiptScope(UUID workspaceUuid) {
        return workspaceUuid == null ? GLOBAL_RECEIPT_SCOPE : "workspace:" + workspaceUuid;
    }

    private void recordStageReceipt(
            String receiptScope,
            String idempotencyKey,
            UUID assetRef,
            String requestHash,
            String contentType,
            long sizeBytes,
            String digest,
            long now) {
        if (idempotencyKey == null) return;
        int changed = persistence.upsertStageReceipt(
                receiptScope,
                idempotencyKey,
                assetRef,
                requestHash,
                "{\"assetRef\":\"" + assetRef + "\",\"contentType\":\"" + contentType + "\",\"sizeBytes\":" + sizeBytes
                        + ",\"sha256\":\"" + digest + "\"}",
                now);
        if (changed != 1) {
            log.atWarn()
                    .addKeyValue("event", "PLATFORM_ASSET_STAGE_IDEMPOTENCY_CONFLICT")
                    .addKeyValue("reason", "RECEIPT_WRITE_MISMATCH")
                    .log("catalog asset stage receipt could not be safely refreshed");
            throw new AssetIdempotencyConflictException();
        }
    }

    private void recordReleaseReceipt(
            String receiptScope, String idempotencyKey, UUID assetRef, String requestHash, AssetReadback released) {
        persistence.insertReleaseReceipt(
                receiptScope,
                idempotencyKey,
                assetRef,
                requestHash,
                "{\"assetRef\":\"" + assetRef + "\",\"disposition\":\"RELEASED\",\"version\":" + released.version()
                        + "}",
                time.currentEpochMillis());
    }

    private static void deleteQuietly(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
        }
    }

    private String secret() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256(byte[] bytes) {
        try {
            return Sha256Hex.digest(bytes);
        } catch (NullPointerException failure) {
            throw new IllegalStateException(failure);
        }
    }

    public record AssetReadback(UUID assetRef, String usage, String status, long version, long sizeBytes) {}

    public record StageReadback(
            UUID assetRef, String bindGrant, long expiresAt, String contentType, long sizeBytes, String sha256) {}

    private record StageResult(StageReadback stage, AssetReadback asset) {}

    public record PublicAssetReference(String publicUrl, String contentType, String sha256) {}

    private record MaterializedContent(Path path, long sizeBytes, String sha256) {}

    private record SalesMenuAssetRow(
            UUID assetRef,
            String usage,
            String status,
            long version,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            long sizeBytes,
            Long releasedAt,
            UUID targetWorkspaceUuid,
            String targetGroupWorkspaceKey,
            UUID storeRef,
            UUID salesMenuRef,
            UUID salesItemRef,
            String targetUsage,
            long expectedDraftVersion) {
        private boolean matches(SalesMenuAssetTarget target) {
            return workspaceUuid.equals(target.workspaceUuid())
                    && targetWorkspaceUuid.equals(target.workspaceUuid())
                    && groupWorkspaceKey.equals(target.groupWorkspaceKey())
                    && targetGroupWorkspaceKey.equals(target.groupWorkspaceKey())
                    && storeRef.equals(target.storeRef())
                    && salesMenuRef.equals(target.salesMenuRef())
                    && salesItemRef.equals(target.salesItemRef())
                    && SALES_MENU_IMAGE_USAGE.equals(usage)
                    && SALES_MENU_IMAGE_USAGE.equals(targetUsage)
                    && target.usage() == SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE
                    && expectedDraftVersion == target.expectedDraftVersion();
        }

        private boolean matchesRelease(SalesMenuAssetTarget target) {
            return workspaceUuid.equals(target.workspaceUuid())
                    && targetWorkspaceUuid.equals(target.workspaceUuid())
                    && groupWorkspaceKey.equals(target.groupWorkspaceKey())
                    && targetGroupWorkspaceKey.equals(target.groupWorkspaceKey())
                    && storeRef.equals(target.storeRef())
                    && salesMenuRef.equals(target.salesMenuRef())
                    && salesItemRef.equals(target.salesItemRef())
                    && SALES_MENU_IMAGE_USAGE.equals(usage)
                    && SALES_MENU_IMAGE_USAGE.equals(targetUsage)
                    && target.usage() == SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE;
        }
    }

    public static final class AssetInputInvalidException extends RuntimeException {}

    public static final class AssetIdempotencyConflictException extends RuntimeException {
        public AssetIdempotencyConflictException() {}

        public AssetIdempotencyConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class AssetInvariantViolationException extends RuntimeException {
        private final String ownerOperation;

        public AssetInvariantViolationException(String ownerOperation) {
            if (ownerOperation == null || !ownerOperation.matches("[A-Za-z0-9._:-]{1,128}"))
                throw new IllegalArgumentException("invalid owner operation");
            this.ownerOperation = ownerOperation;
        }

        public String ownerOperation() {
            return ownerOperation;
        }
    }

    public static final class AssetStorageUnavailableException extends RuntimeException {
        private final String storageOperation;
        private final Integer storageHttpStatus;
        private final String storageErrorCode;

        public AssetStorageUnavailableException(Throwable cause) {
            this("unknown", cause, null, null);
        }

        public AssetStorageUnavailableException(String storageOperation, Throwable cause) {
            this(storageOperation, cause, null, null);
        }

        public AssetStorageUnavailableException(
                String storageOperation, Throwable cause, Integer storageHttpStatus, String storageErrorCode) {
            super(cause);
            if (storageOperation == null || !storageOperation.matches("[A-Za-z0-9._:-]{1,128}"))
                throw new IllegalArgumentException("invalid storage operation");
            if (storageHttpStatus != null && (storageHttpStatus < 100 || storageHttpStatus > 599))
                throw new IllegalArgumentException("invalid storage HTTP status");
            if (storageErrorCode != null && !storageErrorCode.matches("[A-Za-z0-9._:-]{1,128}"))
                throw new IllegalArgumentException("invalid storage error code");
            this.storageOperation = storageOperation;
            this.storageHttpStatus = storageHttpStatus;
            this.storageErrorCode = storageErrorCode;
        }

        public String storageOperation() {
            return storageOperation;
        }

        public Integer storageHttpStatus() {
            return storageHttpStatus;
        }

        public String storageErrorCode() {
            return storageErrorCode;
        }
    }

    public static final class AssetClaimRejectedException extends RuntimeException {
        public AssetClaimRejectedException() {}

        public AssetClaimRejectedException(Throwable cause) {
            super(cause);
        }
    }

    public static final class AssetOwnerScopeForbiddenException extends RuntimeException {
        public AssetOwnerScopeForbiddenException() {}

        public AssetOwnerScopeForbiddenException(Throwable cause) {
            super(cause);
        }
    }

    public static final class AssetNotFoundException extends RuntimeException {}
}
