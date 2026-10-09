package com.catering.v2s.terminalupdate.application.persistence;

import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.MinimumFull;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ValidatedStage;
import com.catering.v2s.audit.contract.AuditHistoryResultSetReader;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL boundary for immutable terminal update stages and artifacts. */
@Repository
public class TerminalUpdateArtifactPersistence {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private final JdbcTemplate jdbc;

    public TerminalUpdateArtifactPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lockCommand(String workspaceKey, String command, String idempotencyKey) {
        AdvisoryLock.acquireHashText(jdbc, "terminal-update|" + workspaceKey + "|" + command + "|" + idempotencyKey);
    }

    public void lockPublication(String applicationId, String platform, String runtimeVersion, String bundleVersion) {
        AdvisoryLock.acquireHashText(jdbc,
                "terminal-update-publication|" + applicationId + "|" + platform + "|" + runtimeVersion + "|" + bundleVersion);
    }

    public int insertStage(ValidatedStage stage, long now) {
        return jdbc.update(
                """
                INSERT INTO terminal_update.artifact_stage(
                  stage_ref,workspace_uuid,group_workspace_key,asset_ref,file_name,expires_at_epoch_millis,
                  byte_size,zip_sha256,application_id,platform,native_version,native_build_number,bundle_version,
                  runtime_version,entry_path,files_json,publication_id,apk_path,apk_sha256,certificate_sha256,
                  minimum_full,owner_actor_type,owner_actor_id,created_at_epoch_millis)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?::jsonb,?,?,?) ON CONFLICT(stage_ref) DO NOTHING
                """,
                stage.stageRef(), stage.workspaceUuid(), stage.groupWorkspaceKey(), stage.assetRef(), stage.fileName(),
                stage.expiresAtEpochMillis(), stage.byteSize(), stage.zipSha256(), stage.applicationId(), stage.platform(),
                stage.nativeVersion(), stage.nativeBuildNumber(), stage.bundleVersion(), stage.runtimeVersion(),
                stage.entryPath(), stage.filesJson(), stage.publicationId(), stage.apkPath(), stage.apkSha256(),
                stage.certificateSha256(), stage.minimumFull() == null ? null : write(stage.minimumFull()),
                stage.ownerActorType(), stage.ownerActorId(), now);
    }

    public Optional<ValidatedStage> readStage(UUID stageRef, boolean forUpdate) {
        String sql = "SELECT stage_ref,workspace_uuid,group_workspace_key,asset_ref,file_name,expires_at_epoch_millis,"
                + "byte_size,zip_sha256,application_id,platform,native_version,native_build_number,bundle_version,"
                + "runtime_version,entry_path,files_json::text,publication_id,apk_path,apk_sha256,certificate_sha256,"
                + "minimum_full::text,owner_actor_type,owner_actor_id FROM terminal_update.artifact_stage WHERE stage_ref=?"
                + (forUpdate ? " FOR UPDATE" : "");
        return jdbc.query(sql, statement -> statement.setObject(1, stageRef), result -> result.next()
                ? Optional.of(new ValidatedStage(
                        result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3),
                        result.getObject(4, UUID.class), result.getString(5), result.getLong(6), result.getLong(7),
                        result.getString(8), result.getString(9), result.getString(10), result.getString(11),
                        result.getLong(12), result.getString(13), result.getString(14), result.getString(15),
                        result.getString(16), result.getString(17), result.getString(18), result.getString(19),
                        result.getString(20), result.getString(21) == null ? null : readMinimumFull(result.getString(21)),
                        result.getString(22), result.getObject(23, UUID.class)))
                : Optional.empty());
    }

    public void deleteStage(UUID stageRef) {
        jdbc.update("DELETE FROM terminal_update.artifact_stage WHERE stage_ref=?", stageRef);
    }

    public Optional<Receipt> findReceipt(String groupWorkspaceKey, String command, String idempotencyKey) {
        return jdbc.query(
                "SELECT request_hash,response_json::text FROM terminal_update.command_receipt "
                        + "WHERE group_workspace_key=? AND command_name=? AND idempotency_key=?",
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, command);
                    statement.setString(3, idempotencyKey);
                }, result -> result.next() ? Optional.of(new Receipt(result.getString(1), result.getString(2))) : Optional.empty());
    }

    public int insertReceipt(String groupWorkspaceKey, String command, String idempotencyKey, String requestHash,
            String responseJson, long now) {
        return jdbc.update(
                "INSERT INTO terminal_update.command_receipt(group_workspace_key,command_name,idempotency_key,"
                        + "request_hash,response_json,created_at_epoch_millis) VALUES (?,?,?,?,?::jsonb,?)",
                groupWorkspaceKey, command, idempotencyKey, requestHash, responseJson, now);
    }

    public String registerPublication(String applicationId, String platform, String runtimeVersion,
            String bundleVersion, String publicationId) {
        jdbc.update("INSERT INTO terminal_update.publication_identity(application_id,platform,runtime_version,"
                        + "bundle_version,publication_id) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
                applicationId, platform, runtimeVersion, bundleVersion, publicationId);
        return jdbc.queryForObject("SELECT publication_id FROM terminal_update.publication_identity "
                        + "WHERE application_id=? AND platform=? AND runtime_version=? AND bundle_version=?",
                String.class, applicationId, platform, runtimeVersion, bundleVersion);
    }

    public Optional<FullIdentity> readFull(UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef) {
        return jdbc.query("SELECT artifact_ref,application_id,native_build_number,runtime_version,publication_id,"
                        + "apk_sha256 FROM terminal_update.artifact WHERE artifact_ref=? AND workspace_uuid=? "
                        + "AND group_workspace_key=? AND kind='FULL' AND status='ACTIVE'",
                statement -> {
                    statement.setObject(1, artifactRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                }, result -> result.next() ? Optional.of(new FullIdentity(
                        result.getObject(1, UUID.class), result.getString(2), result.getLong(3), result.getString(4),
                        result.getString(5), result.getString(6))) : Optional.empty());
    }

    public void insertArtifact(UUID artifactRef, ValidatedStage stage, String kind, UUID minimumFullArtifactRef,
            long now) {
        jdbc.update(
                """
                INSERT INTO terminal_update.artifact(
                  artifact_ref,workspace_uuid,group_workspace_key,asset_ref,kind,application_id,platform,native_version,
                  native_build_number,bundle_version,runtime_version,entry_path,files_json,publication_id,zip_sha256,
                  byte_size,apk_path,apk_sha256,certificate_sha256,minimum_full_artifact_ref,minimum_full,
                  created_at_epoch_millis)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?::jsonb,?)
                """,
                artifactRef, stage.workspaceUuid(), stage.groupWorkspaceKey(), stage.assetRef(), kind,
                stage.applicationId(), stage.platform(), stage.nativeVersion(), stage.nativeBuildNumber(),
                stage.bundleVersion(), stage.runtimeVersion(), stage.entryPath(), stage.filesJson(), stage.publicationId(),
                stage.zipSha256(), stage.byteSize(), stage.apkPath(), stage.apkSha256(), stage.certificateSha256(),
                minimumFullArtifactRef, stage.minimumFull() == null ? null : write(stage.minimumFull()), now);
    }

    public Optional<ArtifactReadback> readArtifact(UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef) {
        return jdbc.query(
                "SELECT artifact_ref,kind,application_id,platform,native_version,native_build_number,bundle_version,"
                        + "runtime_version,entry_path,files_json::text,publication_id,asset_ref,zip_sha256,byte_size,"
                        + "minimum_full_artifact_ref,minimum_full::text,created_at_epoch_millis,apk_sha256,apk_path,certificate_sha256 FROM terminal_update.artifact "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND artifact_ref=? AND status='ACTIVE'",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, artifactRef);
                }, result -> result.next() ? Optional.of(new ArtifactReadback(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getString(4),
                        result.getString(5), result.getLong(6), result.getString(7), result.getString(8), result.getString(9),
                                result.getString(10), result.getString(11), result.getObject(12, UUID.class), result.getString(13),
                                result.getString(18), result.getString(19), result.getString(20), result.getLong(14), result.getObject(15, UUID.class), result.getString(16) == null ? null
                                        : readMinimumFull(result.getString(16)), result.getLong(17))) : Optional.empty());
    }

    public List<ArtifactReadback> readPage(
            UUID workspaceUuid, String groupWorkspaceKey, int limit, UUID before, ArtifactFilter filter) {
        StringBuilder sql = new StringBuilder(
                "SELECT artifact_ref,kind,application_id,platform,native_version,native_build_number,bundle_version,"
                        + "runtime_version,entry_path,files_json::text,publication_id,asset_ref,zip_sha256,byte_size,"
                        + "minimum_full_artifact_ref,minimum_full::text,created_at_epoch_millis,apk_sha256,apk_path,certificate_sha256 FROM terminal_update.artifact "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE' ");
        List<Object> values = new java.util.ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey));
        if (filter.kind() != null) { sql.append("AND kind=? "); values.add(filter.kind()); }
        if (filter.applicationId() != null) { sql.append("AND application_id=? "); values.add(filter.applicationId()); }
        if (filter.runtimeVersion() != null) { sql.append("AND runtime_version=? "); values.add(filter.runtimeVersion()); }
        if (filter.queryText() != null) {
            sql.append("AND (application_id ILIKE ? OR native_version ILIKE ? OR bundle_version ILIKE ? "
                    + "OR runtime_version ILIKE ? OR publication_id ILIKE ?) ");
            String query = "%" + filter.queryText().replace("%", "\\%").replace("_", "\\_") + "%";
            for (int index = 0; index < 5; index++) values.add(query);
        }
        if (filter.minimumFullNativeBuildNumber() != null) {
            sql.append("AND minimum_full->>'nativeBuildNumber'=? ");
            values.add(filter.minimumFullNativeBuildNumber().toString());
        }
        if (filter.minimumFullPublicationId() != null) {
            sql.append("AND minimum_full->>'publicationId'=? "); values.add(filter.minimumFullPublicationId());
        }
        if (filter.minimumFullApkSha256() != null) {
            sql.append("AND minimum_full->>'apkSha256'=? "); values.add(filter.minimumFullApkSha256());
        }
        sql.append("AND (?::uuid IS NULL OR (created_at_epoch_millis,artifact_ref) < "
                + "(SELECT created_at_epoch_millis,artifact_ref FROM terminal_update.artifact "
                + "WHERE artifact_ref=? AND workspace_uuid=? AND group_workspace_key=?)) "
                + "ORDER BY created_at_epoch_millis DESC,artifact_ref DESC LIMIT ?");
        values.add(before);
        values.add(before);
        values.add(workspaceUuid);
        values.add(groupWorkspaceKey);
        values.add(limit);
        return jdbc.query(sql.toString(), values.toArray(), (result, row) -> new ArtifactReadback(
                        result.getObject(1, UUID.class), result.getString(2), result.getString(3), result.getString(4),
                        result.getString(5), result.getLong(6), result.getString(7), result.getString(8), result.getString(9),
                        result.getString(10), result.getString(11), result.getObject(12, UUID.class), result.getString(13),
                        result.getString(18), result.getString(19), result.getString(20), result.getLong(14), result.getObject(15, UUID.class), result.getString(16) == null ? null
                        : readMinimumFull(result.getString(16)), result.getLong(17)));
    }

    public AuditHistoryResultSetReader.TargetProjection readAuditHistory(
            UUID workspaceUuid, String groupWorkspaceKey, UUID artifactRef, long pageSize, long offset) {
        return jdbc.query(
                """
                WITH target AS (
                  SELECT EXISTS (
                    SELECT 1 FROM terminal_update.artifact
                    WHERE workspace_uuid=? AND group_workspace_key=? AND artifact_ref=? AND status='ACTIVE'
                  ) AS target_exists
                ), events AS (
                  SELECT id,occurred_at_epoch_millis,actor_display_snapshot,action,entity_type,entity_ref_text,
                         changes_json::text AS changes_json
                  FROM terminal_update.audit_event
                  WHERE workspace_uuid=? AND group_workspace_key=? AND entity_type='TERMINAL_UPDATE_ARTIFACT'
                    AND entity_ref_text=? AND (SELECT target_exists FROM target)
                ), selected AS (
                  SELECT * FROM events ORDER BY occurred_at_epoch_millis DESC,id DESC LIMIT ? OFFSET ?
                )
                SELECT target.target_exists,(SELECT COUNT(*) FROM events) AS total,
                       selected.id AS event_id,selected.occurred_at_epoch_millis,
                       selected.actor_display_snapshot,selected.action,selected.entity_type,
                       selected.entity_ref_text,selected.changes_json
                FROM target LEFT JOIN selected ON TRUE
                ORDER BY selected.occurred_at_epoch_millis DESC,selected.id DESC
                """,
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, artifactRef);
                    statement.setObject(4, workspaceUuid);
                    statement.setString(5, groupWorkspaceKey);
                    statement.setString(6, artifactRef.toString());
                    statement.setLong(7, pageSize);
                    statement.setLong(8, offset);
                },
                AuditHistoryResultSetReader::readTarget);
    }

    public record Receipt(String requestHash, String responseJson) {}
    public record FullIdentity(UUID artifactRef, String applicationId, long nativeBuildNumber, String runtimeVersion,
            String publicationId, String apkSha256) {}

    public record ArtifactFilter(String kind, String applicationId, String runtimeVersion, String queryText,
            Long minimumFullNativeBuildNumber, String minimumFullPublicationId, String minimumFullApkSha256) {
        public ArtifactFilter {
            if (kind != null && !kind.equals("FULL") && !kind.equals("HOT")) throw new IllegalArgumentException("kind is invalid");
            if (applicationId != null && (applicationId.isBlank() || applicationId.length() > 128)) throw new IllegalArgumentException("applicationId is invalid");
            if (runtimeVersion != null && (runtimeVersion.isBlank() || runtimeVersion.length() > 128)) throw new IllegalArgumentException("runtimeVersion is invalid");
            if (queryText != null && (queryText.isBlank() || queryText.length() > 120)) throw new IllegalArgumentException("queryText is invalid");
            if (minimumFullNativeBuildNumber != null && minimumFullNativeBuildNumber < 0) throw new IllegalArgumentException("minimumFullNativeBuildNumber is invalid");
            if (minimumFullPublicationId != null && !minimumFullPublicationId.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("minimumFullPublicationId is invalid");
            if (minimumFullApkSha256 != null && !minimumFullApkSha256.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("minimumFullApkSha256 is invalid");
        }
    }

    public static String write(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception failure) { throw new IllegalStateException("terminal update JSON write failed", failure); }
    }

    private static MinimumFull readMinimumFull(String json) {
        try { return JSON.readValue(json, MinimumFull.class); }
        catch (Exception failure) { throw new IllegalStateException("terminal update JSON read failed", failure); }
    }
}
