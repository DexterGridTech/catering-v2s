package com.catering.v2s.terminalupdate.application.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads one bounded page and its enabled-membership identity from the same PostgreSQL statement snapshot. */
@Repository
public class TerminalUpdateRuleSnapshotPersistence {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private static final TypeReference<List<UUID>> UUID_LIST = new TypeReference<>() {};
    private final JdbcTemplate jdbc;

    public TerminalUpdateRuleSnapshotPersistence(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Row> page(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            Long beforeCreatedAt, UUID beforeRuleRef, int limit) {
        String sql = """
                WITH enabled AS MATERIALIZED (
                  SELECT r.rule_ref,r.target_mode,r.store_refs::text AS store_refs,fa.application_id,
                    r.full_artifact_ref,fa.kind AS full_kind,fa.application_id AS full_application_id,
                    fa.runtime_version AS full_runtime_version,fa.native_build_number AS full_native_build_number,
                    fa.native_version AS full_apk_version,fa.bundle_version AS full_js_version,
                    fa.publication_id AS full_publication_id,fa.apk_sha256 AS full_apk_sha256,
                    fa.zip_sha256 AS full_zip_sha256,
                    fa.byte_size AS full_byte_size,fa.created_at_epoch_millis AS full_created_at,
                    r.hot_artifact_ref,ha.kind AS hot_kind,ha.application_id AS hot_application_id,
                    ha.runtime_version AS hot_runtime_version,ha.native_build_number AS hot_native_build_number,
                    ha.native_version AS hot_apk_version,ha.bundle_version AS hot_js_version,
                    ha.publication_id AS hot_publication_id,ha.apk_sha256 AS hot_apk_sha256,
                    ha.zip_sha256 AS hot_zip_sha256,
                    ha.byte_size AS hot_byte_size,ha.created_at_epoch_millis AS hot_created_at,
                    r.n_seconds,r.hot_strategy,r.m_seconds,r.description,r.created_at_epoch_millis
                  FROM terminal_update.project_rule r
                  JOIN terminal_update.artifact fa ON fa.artifact_ref=r.full_artifact_ref AND fa.status='ACTIVE'
                  LEFT JOIN terminal_update.artifact ha ON ha.artifact_ref=r.hot_artifact_ref AND ha.status='ACTIVE'
                  WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.project_ref=? AND r.status='ENABLED'
                ), members AS (
                  SELECT coalesce(string_agg(rule_ref::text || E'\n','' ORDER BY created_at_epoch_millis DESC,rule_ref DESC),'') AS member_text
                  FROM enabled
                ), page_rows AS (
                  SELECT * FROM enabled WHERE ?::bigint IS NULL OR
                    (created_at_epoch_millis < ? OR (created_at_epoch_millis = ? AND rule_ref < ?))
                  ORDER BY created_at_epoch_millis DESC,rule_ref DESC LIMIT ?
                )
                SELECT members.member_text,p.* FROM members LEFT JOIN page_rows p ON TRUE
                ORDER BY p.created_at_epoch_millis DESC,p.rule_ref DESC
                """;
        return jdbc.query(sql, (result, rowNum) -> {
            UUID ruleRef = result.getObject("rule_ref", UUID.class);
            if (ruleRef == null) return Row.empty(result.getString("member_text"));
            return new Row(result.getString("member_text"), ruleRef, result.getString("target_mode"),
                    UUIDS(result.getString("store_refs")), result.getString("application_id"),
                    artifact(result, "full"), artifact(result, "hot"), result.getLong("n_seconds"),
                    result.getString("hot_strategy"), (Long) result.getObject("m_seconds"),
                    result.getString("description"),
                    result.getLong("created_at_epoch_millis"));
        }, workspaceUuid, groupWorkspaceKey, projectRef, beforeCreatedAt, beforeCreatedAt,
                beforeCreatedAt, beforeRuleRef, limit);
    }

    private static Artifact artifact(java.sql.ResultSet result, String prefix) throws java.sql.SQLException {
        UUID ref = result.getObject(prefix + "_artifact_ref", UUID.class);
        if (ref == null) return null;
        return new Artifact(ref, result.getString(prefix + "_kind"), result.getString(prefix + "_application_id"),
                result.getString(prefix + "_runtime_version"), result.getLong(prefix + "_native_build_number"),
                result.getString(prefix + "_apk_version"), result.getString(prefix + "_js_version"),
                result.getString(prefix + "_publication_id"), result.getString(prefix + "_apk_sha256"),
                result.getString(prefix + "_zip_sha256"),
                result.getLong(prefix + "_byte_size"), result.getLong(prefix + "_created_at"));
    }

    private static List<UUID> UUIDS(String value) {
        try { return JSON.readValue(value, UUID_LIST); }
        catch (Exception failure) { throw new IllegalStateException("terminal update store refs are invalid", failure); }
    }

    public record Artifact(UUID artifactRef, String kind, String applicationId, String runtimeVersion,
            long nativeBuildNumber, String apkVersion, String jsVersion, String publicationId,
            String apkSha256, String zipSha256, long byteSize, long createdAtEpochMillis) {}

    public record Row(String memberText, UUID ruleRef, String targetMode, List<UUID> storeRefs,
            String applicationId, Artifact full, Artifact hot, Long nSeconds, String hotStrategy, Long mSeconds,
            String description, Long createdAtEpochMillis) {
        static Row empty(String memberText) { return new Row(memberText, null, null, List.of(), null, null, null,
                null, null, null, null, null); }
    }
}
