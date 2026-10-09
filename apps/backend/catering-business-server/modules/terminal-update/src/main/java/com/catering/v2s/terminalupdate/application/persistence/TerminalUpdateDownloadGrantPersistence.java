package com.catering.v2s.terminalupdate.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Owns short-lived, digest-only grants for immutable private update packages. */
@Repository
public class TerminalUpdateDownloadGrantPersistence {
    private final JdbcTemplate jdbc;

    public TerminalUpdateDownloadGrantPersistence(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void lock(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef, long generation) {
        AdvisoryLock.acquireHashText(jdbc, "terminal-update:download-grant:" + workspaceUuid + ":"
                + groupWorkspaceKey + ":" + terminalRef + ":" + generation);
    }

    public void deleteExpired(long now, int limit) {
        jdbc.update("DELETE FROM terminal_update.download_grant WHERE grant_digest IN ("
                + "SELECT grant_digest FROM terminal_update.download_grant WHERE expires_at_epoch_millis<=? "
                + "ORDER BY expires_at_epoch_millis LIMIT ?)", now, limit);
    }

    public int activeCount(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef, long generation, long now) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM terminal_update.download_grant "
                + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? AND binding_generation=? "
                + "AND expires_at_epoch_millis>?", Integer.class, workspaceUuid, groupWorkspaceKey, terminalRef,
                generation, now);
        return count == null ? 0 : count;
    }

    public void insert(String digest, UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef,
            long generation, UUID storeRef, UUID projectRef, UUID artifactRef, long createdAt, long expiresAt) {
        jdbc.update("INSERT INTO terminal_update.download_grant(grant_digest,workspace_uuid,group_workspace_key,"
                + "terminal_ref,binding_generation,store_ref,project_ref,artifact_ref,created_at_epoch_millis,"
                + "expires_at_epoch_millis) VALUES(?,?,?,?,?,?,?,?,?,?)", digest, workspaceUuid, groupWorkspaceKey,
                terminalRef, generation, storeRef, projectRef, artifactRef, createdAt, expiresAt);
    }

    public GrantReadback read(String digest) {
        List<GrantReadback> rows = jdbc.query("""
                SELECT g.workspace_uuid,g.group_workspace_key,g.terminal_ref,g.binding_generation,g.store_ref,
                  g.project_ref,a.artifact_ref,a.asset_ref,a.zip_sha256,a.byte_size,g.expires_at_epoch_millis
                FROM terminal_update.download_grant g JOIN terminal_update.artifact a
                  ON a.workspace_uuid=g.workspace_uuid AND a.group_workspace_key=g.group_workspace_key
                 AND a.artifact_ref=g.artifact_ref AND a.status='ACTIVE'
                WHERE g.grant_digest=?
                """, (result, row) -> new GrantReadback(result.getObject(1, UUID.class), result.getString(2),
                result.getObject(3, UUID.class), result.getLong(4), result.getObject(5, UUID.class),
                result.getObject(6, UUID.class), result.getObject(7, UUID.class), result.getObject(8, UUID.class),
                result.getString(9), result.getLong(10), result.getLong(11)), digest);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public record GrantReadback(UUID workspaceUuid, String groupWorkspaceKey, UUID terminalRef, long generation,
            UUID storeRef, UUID projectRef, UUID artifactRef, UUID assetRef, String zipSha256,
            long byteSize, long expiresAtEpochMillis) {}
}
