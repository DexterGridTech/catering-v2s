package com.catering.v2s.platform.asset.application.persistence;

import com.catering.v2s.platform.asset.api.SalesMenuAssetCommandApi;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed JDBC execution boundary for platform-asset lifecycle and owner-local read facts. */
@Repository
public class PlatformAssetPersistence {
    private final JdbcTemplate jdbc;

    public PlatformAssetPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record AssetRow(UUID assetRef, String usage, String status, long version, long sizeBytes) {}

    public record ActiveAsset(String objectKey, String contentType, String sha256) {}

    public record ExistingAsset(
            UUID assetRef,
            String usage,
            String status,
            long version,
            String contentType,
            long sizeBytes,
            String sha256) {}

    public record Receipt(
            String requestHash,
            UUID assetRef,
            String status,
            long version,
            String contentType,
            long sizeBytes,
            String sha256) {}

    public record SalesMenuAssetImage(UUID assetRef, String objectKey, String contentType, String sha256, String usage,
            String status, long version, long sizeBytes) {}

    public record SalesMenuAssetRow(
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
            long expectedDraftVersion) {}

    public int insertStagedAsset(
            UUID assetRef,
            String usage,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String objectKey,
            String bucketName,
            String contentType,
            long sizeBytes,
            String sha256,
            long now) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_INSERT_INTO_STAGED_ASSET_ASSET_REF_USAGE_WORKSPACE_UUID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STORAGE_KEY_BUCKET_NAME_OBJECT_KEY
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_SIZE_BYTES
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_SHA256_STATUS_CREATED_AT_EPOCH_MILLIS_VERSION
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_PARAMETER_PLACEHOLDER
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_STAGED,
                assetRef,
                usage,
                workspaceUuid,
                groupWorkspaceKey,
                objectKey,
                bucketName,
                objectKey,
                contentType,
                sizeBytes,
                sha256,
                now);
    }

    public int releaseStagedSalesMenuItemImage(
            long releasedAt, UUID assetRef, long expectedVersion, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_RELEASED_RELEASED_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_USAGE_STATUS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                releasedAt,
                assetRef,
                "SALES_MENU_ITEM_IMAGE",
                expectedVersion,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public int consumeSalesMenuBindGrant(
            long now, UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String proof) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_ASSET_BIND_GRANT_CONSUMED_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_STAGED_ASSET_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_STATUS_STAGED_USAGE_WORKSPACE_UUID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_CONSUMED_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_EXPIRES_AT_EPOCH_MILLIS_GRANT_HASH,
                now,
                assetRef,
                "SALES_MENU_ITEM_IMAGE",
                workspaceUuid,
                groupWorkspaceKey,
                now,
                proof);
    }

    public int consumeStoreServicePointBindGrant(
            long now, UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String proof) {
        return jdbc.update(
                "UPDATE platform_asset.asset_bind_grant g SET consumed_at_epoch_millis=? "
                        + "FROM platform_asset.staged_asset a "
                        + "WHERE g.asset_ref=? AND a.asset_ref=g.asset_ref "
                        + "AND a.status='STAGED' AND a.usage='STORE_SERVICE_POINT_IMAGE' "
                        + "AND a.workspace_uuid=? AND a.group_workspace_key=? "
                        + "AND g.consumed_at_epoch_millis IS NULL AND g.expires_at_epoch_millis>=? AND g.grant_hash=?",
                now,
                assetRef,
                workspaceUuid,
                groupWorkspaceKey,
                now,
                proof);
    }

    public AssetRow activateStoreServicePointImage(
            UUID assetRef,
            UUID servicePointRef,
            long now,
            long expectedVersion,
            UUID workspaceUuid,
            String groupWorkspaceKey) {
        return jdbc.query(
                "UPDATE platform_asset.staged_asset SET status='ACTIVE', claimed_by_type='STORE_SERVICE_POINT_IMAGE', "
                        + "claimed_by_id=?, activated_at_epoch_millis=?, version=version+1 "
                        + "WHERE asset_ref=? AND usage='STORE_SERVICE_POINT_IMAGE' AND status='STAGED' "
                        + "AND version=? AND workspace_uuid=? AND group_workspace_key=? "
                        + "RETURNING asset_ref, usage, status, version, size_bytes",
                statement -> {
                    statement.setObject(1, servicePointRef);
                    statement.setLong(2, now);
                    statement.setObject(3, assetRef);
                    statement.setLong(4, expectedVersion);
                    statement.setObject(5, workspaceUuid);
                    statement.setString(6, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new AssetRow(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes"))
                        : null);
    }

    public int releaseStagedStoreServicePointImage(
            long releasedAt, UUID assetRef, long expectedVersion, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.update(
                "UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, version=version+1 "
                        + "WHERE asset_ref=? AND usage='STORE_SERVICE_POINT_IMAGE' AND status='STAGED' "
                        + "AND version=? AND workspace_uuid=? AND group_workspace_key=?",
                releasedAt,
                assetRef,
                expectedVersion,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public int releaseActiveStoreServicePointImage(
            long releasedAt,
            UUID assetRef,
            UUID servicePointRef,
            UUID workspaceUuid,
            String groupWorkspaceKey) {
        return jdbc.update(
                "UPDATE platform_asset.staged_asset SET status='RELEASED', released_at_epoch_millis=?, version=version+1 "
                        + "WHERE asset_ref=? AND usage='STORE_SERVICE_POINT_IMAGE' AND status='ACTIVE' "
                        + "AND claimed_by_type='STORE_SERVICE_POINT_IMAGE' AND claimed_by_id=? "
                        + "AND workspace_uuid=? AND group_workspace_key=?",
                releasedAt,
                assetRef,
                servicePointRef,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public int consumeWorkspaceLogoBindGrant(long now, UUID assetRef, String proof) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_ASSET_BIND_GRANT_CONSUMED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_STAGED_ASSET_ASSET_REF_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_STATUS_STAGED_USAGE_GROUP_WORKSPACE_LOGO
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_EXPIRES_AT_EPOCH_MILLIS_GRANT_HASH,
                now,
                assetRef,
                now,
                proof);
    }

    public int activateWorkspaceLogo(UUID workspaceUuid, String groupWorkspaceKey, long now, UUID assetRef) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_WORKSPACE_UUID_GROUP_WORKSPACE_KEY_STATUS_ACTIVE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CLAIMED_BY_TYPE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_STATUS_STAGED,
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                now,
                assetRef);
    }

    public int consumeCatalogBindGrant(
            long now, UUID assetRef, UUID workspaceUuid, String groupWorkspaceKey, String proof) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_ASSET_BIND_GRANT_CONSUMED_AT_EPOCH_MILLIS_ALTERNATE_B
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_STAGED_ASSET_ASSET_REF_ALTERNATE_B
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_USAGE_CATALOG_ITEM_IMAGE_STATUS_STAGED
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_CONSUMED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_EXPIRES_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_GRANT_HASH,
                now,
                assetRef,
                workspaceUuid,
                groupWorkspaceKey,
                now,
                proof);
    }

    public AssetRow activateCatalogAsset(UUID assetRef, long now, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_ACTIVE_CLAIMED_BY_TYPE_CATALOG_ITEM_IMAGE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CLAIMED_BY_ID_ACTIVATED_AT_EPOCH_MILLIS_VERSION_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_USAGE_CATALOG_ITEM_IMAGE_STATUS_STAGED_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ASSET_REF_USAGE_STATUS,
                statement -> {
                    statement.setObject(1, assetRef);
                    statement.setLong(2, now);
                    statement.setObject(3, assetRef);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new AssetRow(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes"))
                        : null);
    }

    public int releaseActiveAsset(long releasedAt, UUID assetRef, UUID workspaceUuid) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_RELEASED_RELEASED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_CLAIMED_BY_ID_STATUS,
                releasedAt,
                assetRef,
                workspaceUuid);
    }

    public int consumeStagedBindGrant(long now, UUID assetRef, String proof) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_RELEASED_RELEASED_AT_EPOCH_MILLIS_ALTERNATE_B
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_STATUS_STAGED_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_ASSET_BIND_GRANT_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CONSUMED_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_EXPIRES_AT_EPOCH_MILLIS_GRANT_HASH_ALTERNATE_A,
                now,
                assetRef,
                now,
                proof);
    }

    public int markStagedBindGrantConsumed(long now, UUID assetRef, String proof) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_ASSET_BIND_GRANT_CONSUMED_AT_EPOCH_MILLIS_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CONSUMED_AT_EPOCH_MILLIS_GRANT_HASH,
                now,
                assetRef,
                proof);
    }

    public int releaseStagedCatalogAsset(
            long releasedAt, UUID assetRef, long expectedVersion, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_RELEASED_RELEASED_AT_EPOCH_MILLIS_ALTERNATE_C
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_USAGE_CATALOG_ITEM_IMAGE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_WORKSPACE_UUID_GROUP_WORKSPACE_KEY,
                releasedAt,
                assetRef,
                expectedVersion,
                workspaceUuid,
                groupWorkspaceKey);
    }

    public int releaseActiveCatalogAsset(long releasedAt, UUID assetRef, long expectedVersion, UUID workspaceUuid) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_RELEASED_RELEASED_AT_EPOCH_MILLIS_ALTERNATE_D
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_USAGE_CATALOG_ITEM_IMAGE_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_WORKSPACE_UUID,
                releasedAt,
                assetRef,
                expectedVersion,
                workspaceUuid);
    }

    public int releaseAuthorizedCatalogAsset(long releasedAt, UUID assetRef, long expectedVersion, UUID workspaceUuid) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_RELEASED_RELEASED_AT_EPOCH_MILLIS_ALTERNATE_E
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_REF_USAGE_CATALOG_ITEM_IMAGE_ALTERNATE_B
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_ALTERNATE_B
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_WORKSPACE_UUID_ALTERNATE_A,
                releasedAt,
                assetRef,
                expectedVersion,
                workspaceUuid);
    }

    public void lockCatalogReference(UUID assetRef) {
        jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_PG_ADVISORY_XACT_LOCK,
                statement -> {
                    statement.setInt(1, (int) (assetRef.getMostSignificantBits() >>> 32));
                    statement.setInt(2, (int) assetRef.getLeastSignificantBits());
                },
                result -> null);
    }

    public AssetRow readAsset(UUID assetRef) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_STAGED_ASSET_ASSET_REF_USAGE_STATUS_VERSION
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ASSET_REF,
                statement -> statement.setObject(1, assetRef),
                result -> result.next()
                        ? new AssetRow(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes"))
                        : null);
    }

    public List<SalesMenuAssetImage> readSalesMenuItemImages(Collection<UUID> assetRefs) {
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>(assetRefs == null ? List.of() : assetRefs);
        List<UUID> ids = List.copyOf(distinct);
        String placeholders = String.join(
                PlatformAssetServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(ids.size(), PlatformAssetServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_ASSET_REF_OBJECT_KEY_CONTENT_TYPE_SHA256
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_FROM_CLAUSE_STAGED_ASSET_USAGE_SALES_MENU_ITEM_IMAGE_STATUS_ACTIVE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_ASSET_REF
                        + placeholders
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CLOSE_PAREN,
                statement -> {
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index));
                },
                result -> {
                    List<SalesMenuAssetImage> rows = new java.util.ArrayList<>();
                    while (result.next()) {
                        rows.add(new SalesMenuAssetImage(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("object_key"),
                                result.getString("content_type"),
                                result.getString("sha256"),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes")));
                    }
                    return rows;
                });
    }

    public AssetRow readCatalogAssetInWorkspace(UUID assetRef, UUID workspaceUuid) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_STAGED_ASSET_ASSET_REF_USAGE_STATUS_VERSION_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ASSET_REF_USAGE_CATALOG_ITEM_IMAGE_WORKSPACE_UUID,
                statement -> {
                    statement.setObject(1, assetRef);
                    statement.setObject(2, workspaceUuid);
                },
                result -> result.next()
                        ? new AssetRow(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes"))
                        : null);
    }

    public ActiveAsset readActiveAsset(UUID assetRef) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_STAGED_ASSET_OBJECT_KEY_CONTENT_TYPE_SHA256_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_STATUS_ACTIVE,
                statement -> statement.setObject(1, assetRef),
                result -> result.next()
                        ? new ActiveAsset(
                                result.getString("object_key"),
                                result.getString("content_type"),
                                result.getString("sha256"))
                        : null);
    }

    public Map<UUID, ActiveAsset> readActiveAssets(Collection<UUID> assetRefs) {
        LinkedHashSet<UUID> distinct = new LinkedHashSet<>(assetRefs);
        List<UUID> ids = List.copyOf(distinct);
        String placeholders = String.join(
                PlatformAssetServiceSql.PLACEHOLDER_SEPARATOR,
                Collections.nCopies(ids.size(), PlatformAssetServiceSql.PARAMETER_PLACEHOLDER));
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_STAGED_ASSET_ASSET_REF_OBJECT_KEY_CONTENT_TYPE_SHA256
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_STATUS_ACTIVE_ASSET_REF
                        + placeholders
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CLOSE_PAREN_ALTERNATE_A,
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
    }

    public boolean isObjectReferenced(String bucketName, String objectKey) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_STAGED_ASSET_BUCKET_NAME_OBJECT_KEY,
                statement -> {
                    statement.setString(1, bucketName);
                    statement.setString(2, objectKey);
                },
                result -> result.next() && result.getBoolean(1));
    }

    public ExistingAsset findCatalogByStorageKey(UUID workspaceUuid, String objectKey) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_ASSET_REF_USAGE_STATUS_VERSION
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_FROM_CLAUSE_STAGED_ASSET_FROM_PLATFORM_ASSET_STAGED_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_WHERE_WORKSPACE_UUID_STORAGE_KEY_USAGE_CATALOG_ITEM_IMAGE,
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

    public int restageReleasedCatalogContent(
            UUID assetRef, UUID workspaceUuid, String contentType, long sizeBytes, String sha256) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_STAGED_CLAIMED_BY_TYPE_CLAIMED_BY_ID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ACTIVATED_AT_EPOCH_MILLIS_RELEASED_AT_EPOCH_MILLIS_VERSION
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ASSET_REF_USAGE_CATALOG_ITEM_IMAGE_STATUS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CONTENT_TYPE_SIZE_BYTES_SHA256,
                assetRef,
                workspaceUuid,
                contentType,
                sizeBytes,
                sha256);
    }

    public int upsertBindGrant(UUID assetRef, String grantHash, long expiresAt) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_INSERT_INTO_ASSET_BIND_GRANT_ASSET_REF_GRANT_HASH_EXPIRES_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_SET_CONSUMED_AT_EPOCH_MILLIS_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GRANT_HASH_EXPIRES_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CONSUMED_AT_EPOCH_MILLIS_ALTERNATE_A,
                assetRef,
                grantHash,
                expiresAt);
    }

    public int insertSalesMenuAssetTarget(
            UUID assetRef,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID salesMenuRef,
            UUID salesItemRef,
            long expectedDraftVersion,
            long now) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_INSERT_INTO_SALES_MENU_ASSET_TARGET_ASSET_REF_WORKSPACE_UUID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_STORE_REF_SALES_MENU_REF_SALES_ITEM_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_EXPECTED_DRAFT_VERSION_CREATED_AT_EPOCH_MILLIS,
                assetRef,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                salesMenuRef,
                salesItemRef,
                "SALES_MENU_ITEM_IMAGE",
                expectedDraftVersion,
                now);
    }

    public SalesMenuAssetRow readSalesMenuAssetAndTarget(UUID assetRef) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_ASSET_REF_USAGE_ASSET_USAGE_STATUS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_VERSION_ASSET_VERSION_WORKSPACE_UUID_ASSET_WORKSPACE_UUID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_RELEASED_AT_EPOCH_MILLIS_ASSET_RELEASED_AT
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_WORKSPACE_UUID_TARGET_WORKSPACE_UUID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_GROUP_WORKSPACE_KEY_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_SALES_MENU_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_USAGE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_FROM_CLAUSE_STAGED_ASSET_FROM_PLATFORM_ASSET_STAGED_A_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_JOIN_SALES_MENU_ASSET_TARGET_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_WHERE_OF_ASSET_REF,
                statement -> statement.setObject(1, assetRef),
                result -> result.next()
                        ? new SalesMenuAssetRow(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("asset_usage"),
                                result.getString("asset_status"),
                                result.getLong("asset_version"),
                                result.getObject("asset_workspace_uuid", UUID.class),
                                result.getString("asset_group_workspace_key"),
                                result.getLong("asset_size_bytes"),
                                result.getObject("asset_released_at", Long.class),
                                result.getObject("target_workspace_uuid", UUID.class),
                                result.getString("target_group_workspace_key"),
                                result.getObject("target_store_ref", UUID.class),
                                result.getObject("target_sales_menu_ref", UUID.class),
                                result.getObject("target_sales_item_ref", UUID.class),
                                result.getString("target_usage"),
                                result.getLong("target_expected_draft_version"))
                        : null);
    }

    public SalesMenuAssetCommandApi.AssetMetadata activateSalesMenuAsset(
            UUID assetRef, UUID salesItemRef, long now, long expectedVersion, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_UPDATE_STAGED_ASSET_STATUS_ACTIVE_CLAIMED_BY_TYPE_CLAIMED_BY_ID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ACTIVATED_AT_EPOCH_MILLIS_VERSION_ASSET_REF_USAGE
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONDITION_STATUS_STAGED_VERSION_WORKSPACE_UUID
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_RETURNING_ASSET_REF_USAGE_STATUS_VERSION,
                statement -> {
                    statement.setString(1, "SALES_MENU_ITEM_IMAGE");
                    statement.setObject(2, salesItemRef);
                    statement.setLong(3, now);
                    statement.setObject(4, assetRef);
                    statement.setString(5, "SALES_MENU_ITEM_IMAGE");
                    statement.setLong(6, expectedVersion);
                    statement.setObject(7, workspaceUuid);
                    statement.setString(8, groupWorkspaceKey);
                },
                result -> result.next()
                        ? new SalesMenuAssetCommandApi.AssetMetadata(
                                result.getObject("asset_ref", UUID.class),
                                result.getString("usage"),
                                result.getString("status"),
                                result.getLong("version"),
                                result.getLong("size_bytes"))
                        : null);
    }

    public Receipt findReceipt(String receiptScope, String idempotencyKey) {
        return jdbc.query(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_RECEIPT_REQUEST_HASH_ASSET_REF_STATUS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_SIZE_BYTES_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ASSET_COMMAND_RECEIPT_SHA256_RECEIPT
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_STAGED_ASSET
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ASSET_REF_RECEIPT_IDEMPOTENCY_KEY
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_RECEIPT_SCOPE_KEY,
                statement -> {
                    statement.setString(1, idempotencyKey);
                    statement.setString(2, receiptScope);
                },
                result -> result.next()
                        ? new Receipt(
                                result.getString(1),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getLong(4),
                                result.getString(5),
                                result.getLong(6),
                                result.getString(7))
                        : null);
    }

    public void lockReceipt(String receiptScope, String idempotencyKey) {
        jdbc.queryForList(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_PG_ADVISORY_XACT_LOCK_HASHTEXT_TEXT,
                receiptScope,
                idempotencyKey);
    }

    public void lockObjectReference(String objectKey) {
        jdbc.queryForList(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_SELECT_PG_ADVISORY_XACT_LOCK_HASHTEXT_PLATFORM_OBJECT,
                objectKey);
    }

    public int upsertStageReceipt(
            String receiptScope,
            String idempotencyKey,
            UUID assetRef,
            String requestHash,
            String responseJson,
            long now) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_INSERT_INTO_ASSET_COMMAND_RECEIPT_SCOPE_KEY_IDEMPOTENCY_KEY_ASSET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_REQUEST_HASH_RESPONSE_JSON_CREATED_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_SET_SCOPE_KEY_IDEMPOTENCY_KEY_ASSET_REF_ASS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_ET_REF
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_REQUEST_HASH_RESPONSE_JSON
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_CREATED_AT_EPOCH_MILLIS
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_ASSET_COMMAND_RECEIPT_REQUEST_HASH
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_PLATFORM_ASSET_ASSET_COMMAND_RECEIPT_ASSET_REF,
                receiptScope,
                idempotencyKey,
                assetRef,
                requestHash,
                responseJson,
                now);
    }

    public int insertReleaseReceipt(
            String receiptScope,
            String idempotencyKey,
            UUID assetRef,
            String requestHash,
            String responseJson,
            long now) {
        return jdbc.update(
                PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_INSERT_INTO_ASSET_COMMAND_RECEIPT_SCOPE_KEY_IDEMPOTENCY_KEY_ASSET_REF_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION_REQUEST_HASH_RESPONSE_JSON_CREATED_AT_EPOCH_MILLIS_ALTERNATE_A
                        + PlatformAssetServiceSql.PLATFORM_ASSET_SERVICE_CONTINUATION,
                receiptScope,
                idempotencyKey,
                assetRef,
                requestHash,
                responseJson,
                now);
    }
}
