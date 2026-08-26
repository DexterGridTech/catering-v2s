package com.catering.v2s.platform.asset.application;

import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
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
        implements WorkspaceLogoAssetCommand, CatalogAssetReferenceLock, CatalogAssetCommandApi {
    private static final Logger log = LoggerFactory.getLogger(PlatformAssetService.class);
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    /** Video is deliberately not capped at the image/logo limit; future approved video usage stays streaming. */
    private static final long MAX_VIDEO_BYTES = 512L * 1024 * 1024;

    private static final String GLOBAL_RECEIPT_SCOPE = "global";
    private static final Object CATALOG_ASSET_LOCK_RESOURCE_KEY = new Object();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final AssetObjectStorage objects;
    private final PlatformTransactionManager transactions;
    private final SecureRandom random = new SecureRandom();

    public PlatformAssetService(JdbcTemplate jdbc, TimeProvider time, AssetObjectStorage objects) {
        this(jdbc, time, objects, new DataSourceTransactionManager(jdbc.getDataSource()));
    }

    @Autowired
    public PlatformAssetService(
            JdbcTemplate jdbc, TimeProvider time, AssetObjectStorage objects, PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
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
        if (!validUsageContentType(usage, contentType)
                || content == null
                || declaredSizeBytes <= 0
                || declaredSizeBytes > maxBytes(contentType)) throw new AssetInputInvalidException();
        // Suspending an external DataSourceTransactionManager transaction would retain its
        // borrowed connection. Refuse after input-shape validation but before materialization or object I/O, so every
        // public stage entry keeps storage latency outside a caller-owned database transaction.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new AssetInvariantViolationException("owner.stage-storage-transaction");
        }
        MaterializedContent materialized = materializeAndValidate(contentType, declaredSizeBytes, content);
        if (expectedDigest != null && !expectedDigest.equals(materialized.sha256())) {
            deleteQuietly(materialized.path());
            throw new AssetInputInvalidException();
        }
        String requestHash = sha256((usage + "|" + contentType + "|" + materialized.sizeBytes() + "|"
                        + materialized.sha256() + "|" + workspaceUuid + "|" + groupWorkspaceKey)
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
                            expires));
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
            long expires) {
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            if (idempotencyKey != null) {
                lockReceipt(receiptScope, idempotencyKey);
                Replay replay = findReceipt(receiptScope, idempotencyKey);
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
            ExistingAsset existing =
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
                jdbc.update(
                        "INSERT INTO platform_asset.staged_asset (asset_ref, usage, workspace_uuid, "
                                + "group_workspace_key, storage_key, bucket_name, object_key, content_type, "
                                + "size_bytes, "
                                + "sha256, status, created_at_epoch_millis, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "
                                + "?, ?, "
                                + "'STAGED', ?, 1)",
                        assetRef,
                        usage,
                        workspaceUuid,
                        groupWorkspaceKey,
                        objectKey,
                        objects.bucketName(),
                        objectKey,
                        contentType,
                        materialized.sizeBytes(),
                        digest,
                        now);
            } catch (DuplicateKeyException race) {
                // Only catalog has a content-level logical uniqueness constraint. A logo
                // duplicate-key failure is unrelated to object sharing and must not be
                // reinterpreted as a reusable asset lifecycle.
                if (!"CATALOG_ITEM_IMAGE".equals(usage)) throw race;
                ExistingAsset winner = findCatalogByStorageKey(workspaceUuid, objectKey);
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
        int consumed = jdbc.update(
                "UPDATE platform_asset.asset_bind_grant g SET consumed_at_epoch_millis=? FROM "
                        + "platform_asset.staged_asset a WHERE g.asset_ref=? AND a.asset_ref=g.asset_ref AND "
                        + "a.status='STAGED' AND a.usage='GROUP_WORKSPACE_LOGO' AND g.consumed_at_epoch_millis IS NULL "
                        + "AND "
                        + "g.expires_at_epoch_millis>=? AND g.grant_hash=?",
                now,
                assetRef,
                now,
                proof);
        if (consumed != 1) throw new AssetClaimRejectedException();
        int changed = jdbc.update(
                "UPDATE platform_asset.staged_asset SET workspace_uuid=?, group_workspace_key=?, status='ACTIVE', "
                        + "claimed_by_type='GROUP_WORKSPACE_LOGO', claimed_by_id=?, activated_at_epoch_millis=?, "
                        + "version=version+1 WHERE asset_ref=? AND status='STAGED'",
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                now,
                assetRef);
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
        int consumed = jdbc.update(
                "UPDATE platform_asset.asset_bind_grant g SET consumed_at_epoch_millis=? FROM "
                        + "platform_asset.staged_asset a WHERE g.asset_ref=? AND a.asset_ref=g.asset_ref AND "
                        + "a.usage='CATALOG_ITEM_IMAGE' AND a.status='STAGED' AND a.workspace_uuid=? AND "
                        + "a.group_workspace_key=? AND g.consumed_at_epoch_millis IS NULL AND "
                        + "g.expires_at_epoch_millis>=? "
                        + "AND g.grant_hash=?",
                now,
                assetRef,
                workspaceUuid,
                groupWorkspaceKey,
                now,
                proof);
        if (consumed != 1) throw new AssetClaimRejectedException();
        AssetReadback activated = jdbc.query(
                "UPDATE platform_asset.staged_asset SET status='ACTIVE', claimed_by_type='CATALOG_ITEM_IMAGE', "
                        + "claimed_by_id=?, activated_at_epoch_millis=?, version=version+1 WHERE asset_ref=? AND "
                        + "usage='CATALOG_ITEM_IMAGE' AND status='STAGED' AND workspace_uuid=? AND "
                        + "group_workspace_key=? RETURNING asset_ref, usage, status, version, size_bytes",
                statement -> {
                    statement.setObject(1, assetRef);
                    statement.setLong(2, now);
                    statement.setObject(3, assetRef);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new AssetReadback(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes"))
                        : null);
        if (activated == null) throw new AssetClaimRejectedException();
        return activated;
    }

    @Override
    @Transactional
    public void release(UUID assetRef, UUID workspaceUuid) {
        jdbc.update(
                "UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, "
                        + "version=version+1 WHERE asset_ref=? AND claimed_by_id=? AND status='ACTIVE'",
                time.currentEpochMillis(),
                assetRef,
                workspaceUuid);
    }

    /** Releases an unclaimed staging asset only when the one-time staging proof is presented. */
    @Override
    @Transactional
    public void releaseStaged(UUID assetRef, String bindGrant) {
        if (assetRef == null || bindGrant == null || bindGrant.isBlank()) throw new AssetClaimRejectedException();
        long now = time.currentEpochMillis();
        String proof = sha256(bindGrant.getBytes(StandardCharsets.UTF_8));
        int released = jdbc.update(
                "UPDATE platform_asset.staged_asset a SET status='RELEASED', released_at_epoch_millis=?, "
                        + "version=version+1 WHERE a.asset_ref=? AND a.status='STAGED' AND EXISTS (SELECT 1 FROM "
                        + "platform_asset.asset_bind_grant g WHERE g.asset_ref=a.asset_ref AND "
                        + "g.consumed_at_epoch_millis "
                        + "IS NULL AND g.expires_at_epoch_millis>=? AND g.grant_hash=?)",
                now,
                assetRef,
                now,
                proof);
        if (released != 1) throw new AssetClaimRejectedException();
        jdbc.update(
                "UPDATE platform_asset.asset_bind_grant SET consumed_at_epoch_millis=? WHERE asset_ref=? AND "
                        + "consumed_at_epoch_millis IS NULL AND grant_hash=?",
                now,
                assetRef,
                proof);
    }

    /** Discards only an unclaimed catalog stage belonging to the authenticated workspace. */
    private AssetReadback releaseCatalogStaged(
            UUID assetRef, long expectedVersion, UUID workspaceUuid, String groupWorkspaceKey) {
        if (assetRef == null || workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank())
            throw new AssetClaimRejectedException();
        int changed = jdbc.update(
                "UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, "
                        + "version=version+1 WHERE asset_ref=? AND usage='CATALOG_ITEM_IMAGE' AND status='STAGED' AND "
                        + "version=? AND workspace_uuid=? AND group_workspace_key=?",
                time.currentEpochMillis(),
                assetRef,
                expectedVersion,
                workspaceUuid,
                groupWorkspaceKey);
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
        Replay replay = findReceipt(receiptScope, idempotencyKey);
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
        Replay replay = findReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey);
        if (replay != null) {
            if (!requestHash.equals(replay.requestHash()) || !assetRef.equals(replay.assetRef()))
                throw new AssetIdempotencyConflictException();
            return requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        }
        AssetReadback current = requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            int changed = jdbc.update(
                    "UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, "
                            + "version=version+1 WHERE asset_ref=? AND usage='CATALOG_ITEM_IMAGE' AND status='ACTIVE' "
                            + "AND "
                            + "version=? AND workspace_uuid=?",
                    time.currentEpochMillis(),
                    assetRef,
                    current.version(),
                    workspaceUuid);
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
        Replay replay = findReceipt(GLOBAL_RECEIPT_SCOPE, idempotencyKey);
        if (replay != null) {
            if (!requestHash.equals(replay.requestHash()) || !assetRef.equals(replay.assetRef()))
                throw new AssetIdempotencyConflictException();
            return requireCatalogAssetInWorkspace(assetRef, workspaceUuid);
        }
        try (var command = OwnerOperationDiagnostics.beginCommand()) {
            int changed = jdbc.update(
                    "UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, "
                            + "version=version+1 WHERE asset_ref=? AND usage='CATALOG_ITEM_IMAGE' AND status='ACTIVE' "
                            + "AND "
                            + "version=? AND workspace_uuid=?",
                    time.currentEpochMillis(),
                    assetRef,
                    expectedVersion,
                    workspaceUuid);
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
            jdbc.query(
                    "SELECT pg_advisory_xact_lock(?, ?)",
                    statement -> {
                        statement.setInt(1, (int) (assetRef.getMostSignificantBits() >>> 32));
                        statement.setInt(2, (int) assetRef.getLeastSignificantBits());
                    },
                    result -> null);
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
        return jdbc.query(
                "SELECT asset_ref, usage, status, version, size_bytes FROM platform_asset.staged_asset WHERE "
                        + "asset_ref=?",
                statement -> statement.setObject(1, assetRef),
                result -> {
                    if (!result.next()) throw new AssetNotFoundException();
                    return new AssetReadback(
                            result.getObject("asset_ref", UUID.class),
                            result.getString("usage"),
                            result.getString("status"),
                            result.getLong("version"),
                            result.getLong("size_bytes"));
                });
    }

    private AssetReadback requireCatalogAssetInWorkspace(UUID assetRef, UUID workspaceUuid) {
        return jdbc.query(
                "SELECT asset_ref, usage, status, version, size_bytes FROM platform_asset.staged_asset WHERE "
                        + "asset_ref=? AND usage='CATALOG_ITEM_IMAGE' AND workspace_uuid=?",
                statement -> {
                    statement.setObject(1, assetRef);
                    statement.setObject(2, workspaceUuid);
                },
                result -> {
                    if (!result.next()) throw new AssetClaimRejectedException();
                    return new AssetReadback(
                            result.getObject("asset_ref", UUID.class),
                            result.getString("usage"),
                            result.getString("status"),
                            result.getLong("version"),
                            result.getLong("size_bytes"));
                });
    }

    @Transactional(readOnly = true)
    public PublicAssetReference requireActivePublicReference(UUID assetRef) {
        ActiveAsset asset = jdbc.query(
                "SELECT object_key, content_type, sha256 FROM platform_asset.staged_asset WHERE asset_ref=? AND "
                        + "status='ACTIVE'",
                statement -> statement.setObject(1, assetRef),
                result -> {
                    if (!result.next()) throw new AssetNotFoundException();
                    return new ActiveAsset(
                            result.getString("object_key"),
                            result.getString("content_type"),
                            result.getString("sha256"));
                });
        return new PublicAssetReference(objects.publicUrl(asset.objectKey()), asset.contentType(), asset.sha256());
    }

    /** Bounded owner task read for a collection surface; absent/inactive/object-missing remains a failure. */
    @Transactional(readOnly = true)
    public Map<UUID, PublicAssetReference> requireActivePublicReferences(Collection<UUID> assetRefs) {
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>(assetRefs == null ? List.of() : assetRefs);
        if (distinct.isEmpty()) return Map.of();
        if (distinct.contains(null)) throw new AssetNotFoundException();
        String placeholders = String.join(",", java.util.Collections.nCopies(distinct.size(), "?"));
        List<UUID> ids = List.copyOf(distinct);
        Map<UUID, ActiveAsset> active = jdbc.query(
                "SELECT asset_ref, object_key, content_type, sha256 FROM platform_asset.staged_asset WHERE "
                        + "status='ACTIVE' AND asset_ref IN ("
                        + placeholders + ")",
                statement -> {
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index));
                },
                result -> {
                    Map<UUID, ActiveAsset> resultById = new LinkedHashMap<>();
                    while (result.next())
                        resultById.put(
                                result.getObject("asset_ref", UUID.class),
                                new ActiveAsset(
                                        result.getString("object_key"),
                                        result.getString("content_type"),
                                        result.getString("sha256")));
                    return resultById;
                });
        if (active.size() != ids.size()) throw new AssetNotFoundException();
        Map<UUID, PublicAssetReference> references = new LinkedHashMap<>();
        for (UUID id : ids) {
            ActiveAsset asset = active.get(id);
            if (asset == null) throw new AssetNotFoundException();
            references.put(
                    id,
                    new PublicAssetReference(
                            objects.publicUrl(asset.objectKey()), asset.contentType(), asset.sha256()));
        }
        return Map.copyOf(references);
    }

    private static boolean validUsageContentType(String usage, String contentType) {
        // R5 currently approves a logo usage only. Video support stays in the object adapter/public origin,
        // but it may not be smuggled into the logo command before a video owner usage is approved.
        boolean approvedUsage = "GROUP_WORKSPACE_LOGO".equals(usage) || "CATALOG_ITEM_IMAGE".equals(usage);
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

    private static long maxBytes(String contentType) {
        return "video/mp4".equals(contentType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    }

    private static MaterializedContent materializeAndValidate(
            String contentType, long declaredSizeBytes, InputStream source) {
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
                if (size > maxBytes(contentType)) throw new AssetInputInvalidException();
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
            Boolean stillReferenced = jdbc.query(
                    "SELECT EXISTS(SELECT 1 FROM platform_asset.staged_asset WHERE bucket_name=? AND object_key=?)",
                    statement -> {
                        statement.setString(1, objects.bucketName());
                        statement.setString(2, objectKey);
                    },
                    result -> result.next() && result.getBoolean(1));
            if (!Boolean.TRUE.equals(stillReferenced)) objects.delete(objectKey);
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

    private ExistingAsset findCatalogByStorageKey(UUID workspaceUuid, String objectKey) {
        return jdbc.query(
                "SELECT asset_ref, usage, status, version, content_type, size_bytes, sha256 "
                        + "FROM platform_asset.staged_asset "
                        + "WHERE workspace_uuid=? AND storage_key=? AND usage='CATALOG_ITEM_IMAGE'",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, objectKey);
                },
                result -> result.next()
                        ? new ExistingAsset(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getString("content_type"),
                                result.getLong("size_bytes"),
                                result.getString("sha256"))
                        : null);
    }

    private static boolean sameCatalogContent(
            ExistingAsset existing, String usage, String contentType, long sizeBytes, String sha256) {
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
    private ExistingAsset restageReleasedCatalogContent(
            ExistingAsset released,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String contentType,
            long sizeBytes,
            String sha256) {
        int changed = jdbc.update(
                "UPDATE platform_asset.staged_asset SET status='STAGED', claimed_by_type=NULL, claimed_by_id=NULL, "
                        + "activated_at_epoch_millis=NULL, released_at_epoch_millis=NULL, version=version+1 WHERE "
                        + "asset_ref=? AND usage='CATALOG_ITEM_IMAGE' AND status='RELEASED' AND workspace_uuid=? AND "
                        + "content_type=? AND size_bytes=? AND sha256=?",
                released.assetRef(),
                workspaceUuid,
                contentType,
                sizeBytes,
                sha256);
        if (changed == 1) {
            return new ExistingAsset(
                    released.assetRef(),
                    released.usage(),
                    "STAGED",
                    released.version() + 1L,
                    released.contentType(),
                    released.sizeBytes(),
                    released.sha256());
        }
        ExistingAsset current =
                findCatalogByStorageKey(workspaceUuid, objects.objectKey("static/" + sha256 + suffix(contentType)));
        if (current == null
                || !sameCatalogContent(current, "CATALOG_ITEM_IMAGE", contentType, sizeBytes, sha256)
                || "RELEASED".equals(current.status())) {
            throw new AssetInvariantViolationException("owner.restage-conflict");
        }
        return current;
    }

    private void issueBindGrant(UUID assetRef, String grant, long expiresAt) {
        jdbc.update(
                "INSERT INTO platform_asset.asset_bind_grant (asset_ref, grant_hash, expires_at_epoch_millis, "
                        + "consumed_at_epoch_millis) VALUES (?, ?, ?, NULL) ON CONFLICT (asset_ref) DO UPDATE SET "
                        + "grant_hash=EXCLUDED.grant_hash, expires_at_epoch_millis=EXCLUDED.expires_at_epoch_millis, "
                        + "consumed_at_epoch_millis=NULL",
                assetRef,
                sha256(grant.getBytes(StandardCharsets.UTF_8)),
                expiresAt);
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

    private Replay findReceipt(String receiptScope, String idempotencyKey) {
        return jdbc.query(
                "SELECT receipt.request_hash, asset.asset_ref, asset.status, asset.version, asset.content_type, "
                        + "asset.size_bytes, "
                        + "asset.sha256 FROM platform_asset.asset_command_receipt receipt JOIN "
                        + "platform_asset.staged_asset "
                        + "asset ON asset.asset_ref=receipt.asset_ref WHERE receipt.idempotency_key=? AND "
                        + "receipt.scope_key=? FOR UPDATE",
                statement -> {
                    statement.setString(1, idempotencyKey);
                    statement.setString(2, receiptScope);
                },
                result -> result.next()
                        ? new Replay(
                                result.getString(1),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getLong(4),
                                result.getString(5),
                                result.getLong(6),
                                result.getString(7))
                        : null);
    }

    private void lockReceipt(String receiptScope, String idempotencyKey) {
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(hashtext(CAST(? AS text)), hashtext(CAST(? AS text)))",
                receiptScope,
                idempotencyKey);
    }

    private void lockObjectReference(String objectKey) {
        jdbc.queryForList(
                "SELECT pg_advisory_xact_lock(hashtext('platform-asset-object'), hashtext(CAST(? AS text)))",
                objectKey);
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
        int changed = jdbc.update(
                "INSERT INTO platform_asset.asset_command_receipt (scope_key, idempotency_key, asset_ref, "
                        + "request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, CAST(? AS "
                        + "JSONB), ?) ON CONFLICT (scope_key, idempotency_key) DO UPDATE SET asset_ref=EXCLUDED.ass"
                        + "et_ref, "
                        + "request_hash=EXCLUDED.request_hash, response_json=EXCLUDED.response_json, "
                        + "created_at_epoch_millis=EXCLUDED.created_at_epoch_millis WHERE "
                        + "platform_asset.asset_command_receipt.request_hash=EXCLUDED.request_hash AND "
                        + "platform_asset.asset_command_receipt.asset_ref=EXCLUDED.asset_ref",
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
        jdbc.update(
                "INSERT INTO platform_asset.asset_command_receipt (scope_key, idempotency_key, asset_ref, "
                        + "request_hash, response_json, created_at_epoch_millis) VALUES (?, ?, ?, ?, CAST(? AS "
                        + "JSONB), ?)",
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

    private record ActiveAsset(String objectKey, String contentType, String sha256) {}

    private record MaterializedContent(Path path, long sizeBytes, String sha256) {}

    private record ExistingAsset(
            UUID assetRef,
            String usage,
            String status,
            long version,
            String contentType,
            long sizeBytes,
            String sha256) {}

    private record Replay(
            String requestHash,
            UUID assetRef,
            String status,
            long version,
            String contentType,
            long sizeBytes,
            String sha256) {}

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
