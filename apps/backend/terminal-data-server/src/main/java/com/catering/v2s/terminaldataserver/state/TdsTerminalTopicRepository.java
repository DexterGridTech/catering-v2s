package com.catering.v2s.terminaldataserver.state;

import java.util.OptionalLong;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads only the owner-maintained topic time used by active TDS subscriptions. */
@Repository
public class TdsTerminalTopicRepository {
    private static final String READ_ORGANIZATION_COLLECTION =
            "SELECT topic_time_epoch_millis FROM organization.terminal_topic_snapshot "
                    + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND topic_key=?";
    private static final String READ_CONTRACT_COLLECTION =
            "SELECT topic_time_epoch_millis FROM contract.terminal_topic_snapshot "
                    + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND topic_key=?";
    private static final String READ_ORGANIZATION_EXACT =
            "SELECT topic_time_epoch_millis FROM organization.read_terminal_topic_time(?, ?, ?, ?, ?)";
    private static final String READ_CONTRACT_EXACT =
            "SELECT topic_time_epoch_millis FROM contract.read_terminal_topic_time(?, ?, ?, ?, ?)";

    private final JdbcTemplate jdbc;

    public TdsTerminalTopicRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public OptionalLong readTime(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID boundStoreRef,
            String topicKey,
            UUID ownerRef) {
        if (workspaceUuid == null || groupWorkspaceKey == null || boundStoreRef == null
                || topicKey == null || ownerRef == null) {
            throw new IllegalArgumentException("TDS_TOPIC_IDENTITY_INVALID");
        }
        String sql = switch (topicKey) {
            case "VALID_CONTRACT_COLLECTION" -> READ_CONTRACT_COLLECTION;
            case "SERVICE_POINT_AREA_COLLECTION", "SERVICE_POINT_COLLECTION" -> READ_ORGANIZATION_COLLECTION;
            case "CONTRACT" -> READ_CONTRACT_EXACT;
            case "STORE", "PROJECT", "REGION", "COMMERCIAL_GROUP", "STORE_OPERATING_RULE",
                    "SERVICE_POINT_AREA", "SERVICE_POINT" -> READ_ORGANIZATION_EXACT;
            default -> throw new IllegalArgumentException("TDS_TOPIC_KEY_INVALID");
        };
        Object[] arguments = switch (topicKey) {
            case "VALID_CONTRACT_COLLECTION", "SERVICE_POINT_AREA_COLLECTION", "SERVICE_POINT_COLLECTION" ->
                new Object[] {workspaceUuid, groupWorkspaceKey, boundStoreRef, topicKey};
            default -> new Object[] {workspaceUuid, groupWorkspaceKey, boundStoreRef, topicKey, ownerRef};
        };
        Long value = jdbc.query(sql, result -> result.next() ? result.getLong(1) : null, arguments);
        return value == null ? OptionalLong.empty() : OptionalLong.of(value);
    }
}
