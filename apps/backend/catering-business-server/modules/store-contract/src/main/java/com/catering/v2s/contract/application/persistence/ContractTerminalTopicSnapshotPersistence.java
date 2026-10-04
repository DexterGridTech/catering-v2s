package com.catering.v2s.contract.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.JdbcTemplate;

/** Store-contract owner persistence for terminal contract topic facts. */
public final class ContractTerminalTopicSnapshotPersistence {
    private static final String CHANNEL = "terminal_binding_events";
    private static final String EMPTY_HASH = Sha256Hex.digest(new byte[0]);
    private final JdbcTemplate jdbc;

    public ContractTerminalTopicSnapshotPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lockActiveCollection(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        AdvisoryLock.acquireHashTextPair(
                jdbc,
                "terminal-topic:store-contract:VALID_CONTRACT_COLLECTION",
                workspaceUuid + ":" + groupWorkspaceKey + ":" + storeRef);
    }

    public void notifyContract(UUID workspaceUuid, String groupWorkspaceKey, UUID contractRef) {
        notifyTopic(workspaceUuid, groupWorkspaceKey, "CONTRACT", contractRef);
    }

    public void refreshActiveCollection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            long triggerTime) {
        CollectionSummary summary = jdbc.query(
                "SELECT id, updated_at_epoch_millis FROM contract.store_contract "
                        + "WHERE workspace_uuid = ? AND group_workspace_key = ? AND store_id = ? AND status = 'ACTIVE' "
                        + "ORDER BY id::text",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, storeRef);
                },
                (ResultSetExtractor<CollectionSummary>) ContractTerminalTopicSnapshotPersistence::summarize);
        String hash = summary.hash();
        Existing existing = jdbc.query(
                "SELECT collection_hash FROM contract.terminal_topic_snapshot "
                        + "WHERE workspace_uuid = ? AND group_workspace_key = ? AND store_ref = ? "
                        + "AND topic_key = 'VALID_CONTRACT_COLLECTION'",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, storeRef);
                },
                result -> result.next() ? new Existing(result.getString(1)) : null);
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
                "INSERT INTO contract.terminal_topic_snapshot "
                        + "(workspace_uuid, group_workspace_key, store_ref, topic_key, collection_hash, topic_time_epoch_millis) "
                        + "VALUES (?, ?, ?, 'VALID_CONTRACT_COLLECTION', ?, ?) "
                        + "ON CONFLICT (workspace_uuid, group_workspace_key, store_ref, topic_key) "
                        + "DO UPDATE SET collection_hash = EXCLUDED.collection_hash, "
                        + "topic_time_epoch_millis = EXCLUDED.topic_time_epoch_millis",
                workspaceUuid,
                groupWorkspaceKey,
                storeRef,
                hash,
                topicTime);
        notifyTopic(workspaceUuid, groupWorkspaceKey, "VALID_CONTRACT_COLLECTION", storeRef);
    }

    private void notifyTopic(UUID workspaceUuid, String groupWorkspaceKey, String topicKey, UUID ownerRef) {
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

    private record Existing(String collectionHash) {}
}
