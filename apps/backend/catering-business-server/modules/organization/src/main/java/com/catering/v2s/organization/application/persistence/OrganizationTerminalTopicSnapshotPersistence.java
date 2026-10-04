package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.JdbcTemplate;

/** Owner-local persistence for terminal topic wake-ups and the two organization collection snapshots. */
public final class OrganizationTerminalTopicSnapshotPersistence {
    private static final String CHANNEL = "terminal_binding_events";
    private static final String EMPTY_HASH = Sha256Hex.digest(new byte[0]);
    private final JdbcTemplate jdbc;

    public OrganizationTerminalTopicSnapshotPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lockAreaCollection(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        AdvisoryLock.acquireHashTextPair(
                jdbc,
                "terminal-topic:organization:SERVICE_POINT_AREA_COLLECTION",
                scope(workspaceUuid, groupWorkspaceKey, storeRef));
    }

    public void lockPointCollection(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        AdvisoryLock.acquireHashTextPair(
                jdbc,
                "terminal-topic:organization:SERVICE_POINT_COLLECTION",
                scope(workspaceUuid, groupWorkspaceKey, storeRef));
    }

    public void initializeEmptyStoreCollections(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        jdbc.update(
                "INSERT INTO organization.terminal_topic_snapshot "
                        + "(workspace_uuid, group_workspace_key, store_ref, topic_key, collection_hash, topic_time_epoch_millis) "
                        + "VALUES (?, ?, ?, 'SERVICE_POINT_AREA_COLLECTION', ?, 0), "
                        + "(?, ?, ?, 'SERVICE_POINT_COLLECTION', ?, 0) ON CONFLICT DO NOTHING",
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                EMPTY_HASH,
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                EMPTY_HASH);
    }

    public void notifyExact(
            UUID workspaceUuid, String groupWorkspaceKey, String topicKey, UUID ownerRef) {
        jdbc.execute(
                (PreparedStatementCreator) connection -> {
                    var statement = connection.prepareStatement(
                            "SELECT pg_notify(?, jsonb_build_object('v', 1, 'kind', 'TOPIC_CHANGED', "
                                    + "'workspaceUuid', ?, 'groupWorkspaceKey', ?, 'topicKey', ?, 'ownerRef', ?)::text)");
                    statement.setString(1, CHANNEL);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setString(4, topicKey);
                    statement.setObject(5, ownerRef);
                    return statement;
                },
                java.sql.PreparedStatement::execute);
    }

    public void refreshAreaCollection(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, long triggerTime) {
        refreshCollection(
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                "SERVICE_POINT_AREA_COLLECTION",
                "SELECT area_ref, updated_at_epoch_millis FROM organization.store_service_point_area "
                        + "WHERE workspace_uuid = ? AND group_workspace_key = ? AND store_ref = ? "
                        + "AND status = 'ENABLED' ORDER BY area_ref::text",
                triggerTime);
    }

    public void refreshPointCollection(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, long triggerTime) {
        refreshCollection(
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                "SERVICE_POINT_COLLECTION",
                "SELECT point_ref, updated_at_epoch_millis FROM organization.store_service_point "
                        + "WHERE workspace_uuid = ? AND group_workspace_key = ? AND store_ref = ? "
                        + "AND status = 'ENABLED' ORDER BY point_ref::text",
                triggerTime);
    }

    private void refreshCollection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            String topicKey,
            String memberSql,
            long triggerTime) {
        CollectionSummary summary = jdbc.query(
                memberSql,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, storeRef);
                },
                (ResultSetExtractor<CollectionSummary>) OrganizationTerminalTopicSnapshotPersistence::summarize);
        String hash = summary.hash();
        Existing existing = jdbc.query(
                "SELECT collection_hash, topic_time_epoch_millis FROM organization.terminal_topic_snapshot "
                        + "WHERE workspace_uuid = ? AND group_workspace_key = ? AND store_ref = ? AND topic_key = ?",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, storeRef);
                    statement.setString(4, topicKey);
                },
                result -> result.next()
                        ? new Existing(result.getString(1), result.getLong(2))
                        : null);
        if (existing != null && existing.collectionHash().equals(hash)) return;

        long topicTime;
        if (existing == null) {
            topicTime = summary.empty() ? 0L : summary.maxUpdatedAt();
        } else if (!summary.empty() && EMPTY_HASH.equals(existing.collectionHash())) {
            topicTime = summary.maxUpdatedAt();
        } else {
            topicTime = triggerTime;
        }

        jdbc.update(
                "INSERT INTO organization.terminal_topic_snapshot "
                        + "(workspace_uuid, group_workspace_key, store_ref, topic_key, collection_hash, topic_time_epoch_millis) "
                        + "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_uuid, group_workspace_key, store_ref, topic_key) "
                        + "DO UPDATE SET collection_hash = EXCLUDED.collection_hash, "
                        + "topic_time_epoch_millis = EXCLUDED.topic_time_epoch_millis",
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                topicKey,
                hash,
                topicTime);
        notifyExact(workspaceUuid, groupWorkspaceKey, topicKey, storeRef);
    }

    private static String scope(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        return workspaceUuid + ":" + groupWorkspaceKey + ":" + storeRef;
    }

    private static CollectionSummary summarize(java.sql.ResultSet result) throws java.sql.SQLException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            boolean empty = true;
            long maxUpdatedAt = 0L;
            while (result.next()) {
                if (!empty) digest.update((byte) '\n');
                digest.update(result.getString(1).getBytes(StandardCharsets.UTF_8));
                maxUpdatedAt = Math.max(maxUpdatedAt, result.getLong(2));
                empty = false;
            }
            return new CollectionSummary(HexFormat.of().formatHex(digest.digest()), maxUpdatedAt, empty);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private record CollectionSummary(String hash, long maxUpdatedAt, boolean empty) {}

    private record Existing(String collectionHash, long topicTimeEpochMillis) {}
}
