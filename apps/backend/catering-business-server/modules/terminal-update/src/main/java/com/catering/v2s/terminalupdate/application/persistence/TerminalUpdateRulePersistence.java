package com.catering.v2s.terminalupdate.application.persistence;

import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RulePageQuery;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleSummary;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.stereotype.Repository;

/** SQL boundary for project rules, receipts and the owner-maintained delivery topic. */
@Repository
public class TerminalUpdateRulePersistence {
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
    private static final TypeReference<List<UUID>> UUID_LIST = new TypeReference<>() {};
    private static final String CHANNEL = "terminal_binding_events";
    private final JdbcTemplate jdbc;

    public TerminalUpdateRulePersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lockProject(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef) {
        AdvisoryLock.acquireHashTextPair(jdbc, "terminal-update:project-rules", workspaceUuid + ":" + groupWorkspaceKey + ":" + projectRef);
    }

    public void lockCommand(String groupWorkspaceKey, String command, String idempotencyKey) {
        AdvisoryLock.acquireHashText(jdbc, "terminal-update|" + groupWorkspaceKey + "|" + command + "|" + idempotencyKey);
    }

    public Optional<RuleReadback> findReceipt(String groupWorkspaceKey, String command, String idempotencyKey) {
        List<String> values = jdbc.query(
                "SELECT response_json::text FROM terminal_update.command_receipt WHERE group_workspace_key=? AND command_name=? AND idempotency_key=?",
                (result, row) -> result.getString(1), groupWorkspaceKey, command, idempotencyKey);
        return values.isEmpty() ? Optional.empty() : Optional.of(read(values.getFirst()));
    }

    public void insertReceipt(String groupWorkspaceKey, String command, String idempotencyKey, String requestHash,
            RuleReadback response, long now) {
        jdbc.update(
                "INSERT INTO terminal_update.command_receipt(group_workspace_key,command_name,idempotency_key,request_hash,response_json,created_at_epoch_millis) VALUES(?,?,?,?,?::jsonb,?)",
                groupWorkspaceKey, command, idempotencyKey, requestHash, write(response), now);
    }

    public Optional<String> receiptHash(String groupWorkspaceKey, String command, String idempotencyKey) {
        List<String> values = jdbc.query(
                "SELECT request_hash FROM terminal_update.command_receipt WHERE group_workspace_key=? AND command_name=? AND idempotency_key=?",
                (result, row) -> result.getString(1), groupWorkspaceKey, command, idempotencyKey);
        return values.stream().findFirst();
    }

    public int insert(RuleReadback rule, UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.update(
                "INSERT INTO terminal_update.project_rule(rule_ref,workspace_uuid,group_workspace_key,project_ref,target_mode,store_refs,full_artifact_ref,hot_artifact_ref,status,n_seconds,hot_strategy,m_seconds,description,created_at_epoch_millis,updated_at_epoch_millis,revision) VALUES(?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(rule_ref) DO NOTHING",
                rule.ruleRef(), workspaceUuid, groupWorkspaceKey, rule.projectRef(), rule.targetMode(), write(rule.storeRefs()),
                rule.fullArtifactRef(), rule.hotArtifactRef(), rule.status(), rule.nSeconds(), rule.hotStrategy(),
                rule.mSeconds(), rule.description(), rule.createdAtEpochMillis(), rule.updatedAtEpochMillis(), rule.revision());
    }

    public Optional<RuleReadback> read(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID ruleRef, boolean forUpdate) {
        String sql = "SELECT rule_ref,project_ref,target_mode,store_refs::text,full_artifact_ref,hot_artifact_ref,status,n_seconds,hot_strategy,m_seconds,description,created_at_epoch_millis,updated_at_epoch_millis,revision FROM terminal_update.project_rule WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? AND rule_ref=?" + (forUpdate ? " FOR UPDATE" : "");
        List<RuleReadback> rows = jdbc.query(sql, (result, row) -> new RuleReadback(
                result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3),
                readUuids(result.getString(4)), result.getObject(5, UUID.class), result.getObject(6, UUID.class),
                result.getString(7), result.getLong(8), result.getString(9),
                (Long) result.getObject(10), result.getString(11), result.getLong(12), result.getLong(13), result.getLong(14)),
                workspaceUuid, groupWorkspaceKey, projectRef, ruleRef);
        return rows.stream().findFirst();
    }

    public RulePageRows page(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, RulePageQuery query) {
        String identity = Sha256Hex.digest(workspaceUuid + "|" + groupWorkspaceKey + "|" + projectRef + "|"
                + query.status() + "|" + query.applicationId() + "|" + query.createdFromEpochMillis() + "|"
                + query.createdToEpochMillis() + "|" + query.limit());
        OpaqueCollectionCursor.Position frontier;
        try { frontier = OpaqueCollectionCursor.decode(query.cursor(), identity); }
        catch (OpaqueCollectionCursor.InvalidCursor invalid) {
            throw new com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerService.TerminalUpdateRuleInvalidException();
        }
        StringBuilder filtered = new StringBuilder("SELECT r.rule_ref,r.project_ref,r.status,r.target_mode,"
                + "r.full_artifact_ref,r.hot_artifact_ref,r.n_seconds,r.hot_strategy,r.m_seconds,r.description,"
                + "r.created_at_epoch_millis,r.revision FROM terminal_update.project_rule r "
                + "JOIN terminal_update.artifact a ON a.artifact_ref=r.full_artifact_ref "
                + "WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.project_ref=?");
        List<Object> filterArgs = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, projectRef));
        if (query.status() != null) { filtered.append(" AND r.status=?"); filterArgs.add(query.status()); }
        if (query.applicationId() != null) { filtered.append(" AND a.application_id=?"); filterArgs.add(query.applicationId()); }
        if (query.createdFromEpochMillis() != null) {
            filtered.append(" AND r.created_at_epoch_millis>=?"); filterArgs.add(query.createdFromEpochMillis());
        }
        if (query.createdToEpochMillis() != null) {
            filtered.append(" AND r.created_at_epoch_millis<=?"); filterArgs.add(query.createdToEpochMillis());
        }
        StringBuilder sql = new StringBuilder("WITH filtered AS (").append(filtered)
                .append("), snapshot AS (SELECT md5(coalesce(string_agg(rule_ref::text || ':' || revision::text, ',' "
                        + "ORDER BY created_at_epoch_millis DESC,rule_ref DESC),'')) AS collection_hash FROM filtered), ")
                .append("page_rows AS (SELECT * FROM filtered WHERE TRUE");
        List<Object> args = new ArrayList<>(filterArgs);
        if (frontier != null) {
            String[] cursorParts = frontier.sortKey().split(":", -1);
            if (cursorParts.length != 2 || !cursorParts[0].matches("[0-9a-f]{32}"))
                throw new com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerService.TerminalUpdateRuleInvalidException();
            long createdAt;
            try { createdAt = Long.parseLong(cursorParts[1]); }
            catch (NumberFormatException failure) {
                throw new com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerService.TerminalUpdateRuleInvalidException();
            }
            sql.append(" AND (created_at_epoch_millis<? OR (created_at_epoch_millis=? AND rule_ref<?))");
            args.add(createdAt);
            args.add(createdAt);
            args.add(frontier.tieBreaker());
        }
        sql.append(" ORDER BY created_at_epoch_millis DESC,rule_ref DESC LIMIT ?)")
                .append(" SELECT snapshot.collection_hash,page_rows.rule_ref,page_rows.project_ref,page_rows.status,"
                        + "page_rows.target_mode,page_rows.full_artifact_ref,page_rows.hot_artifact_ref,page_rows.n_seconds,"
                        + "page_rows.hot_strategy,page_rows.m_seconds,page_rows.description,page_rows.created_at_epoch_millis,"
                        + "page_rows.revision FROM snapshot LEFT JOIN page_rows ON TRUE "
                        + "ORDER BY page_rows.created_at_epoch_millis DESC,page_rows.rule_ref DESC");
        args.add(query.limit() + 1);
        List<PageRow> rows = jdbc.query(sql.toString(), (result, row) -> {
            UUID ruleRef = result.getObject(2, UUID.class);
            RuleSummary item = ruleRef == null ? null : new RuleSummary(ruleRef,
                    result.getObject(3, UUID.class), result.getString(4), result.getString(5),
                    result.getObject(6, UUID.class), result.getObject(7, UUID.class), result.getLong(8),
                    result.getString(9), (Long) result.getObject(10), result.getString(11),
                    result.getLong(12), result.getLong(13));
            return new PageRow(result.getString(1), item);
        }, args.toArray());
        String snapshotHash = rows.getFirst().collectionHash();
        if (frontier != null && !snapshotHash.equals(frontier.sortKey().substring(0, 32)))
            throw new com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerService.TerminalUpdateRuleStaleStateException();
        List<RuleSummary> itemsWithExtra = rows.stream().map(PageRow::item).filter(java.util.Objects::nonNull).toList();
        boolean hasMore = itemsWithExtra.size() > query.limit();
        List<RuleSummary> items = hasMore ? List.copyOf(itemsWithExtra.subList(0, query.limit())) : List.copyOf(itemsWithExtra);
        String next = hasMore && !items.isEmpty()
                ? OpaqueCollectionCursor.encode(identity,
                        snapshotHash + ":" + items.getLast().createdAtEpochMillis(), items.getLast().ruleRef())
                : null;
        return new RulePageRows(items, next);
    }

    private record PageRow(String collectionHash, RuleSummary item) {}

    public record RulePageRows(List<RuleSummary> items, String nextCursor) {
        public RulePageRows { items = List.copyOf(items); }
    }

    public List<RuleReadback> enabledRules(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef) {
        return jdbc.query(
                "SELECT rule_ref,project_ref,target_mode,store_refs::text,full_artifact_ref,hot_artifact_ref,status,n_seconds,hot_strategy,m_seconds,description,created_at_epoch_millis,updated_at_epoch_millis,revision FROM terminal_update.project_rule WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? AND status='ENABLED' ORDER BY rule_ref",
                (result, row) -> new RuleReadback(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3),
                        readUuids(result.getString(4)), result.getObject(5, UUID.class), result.getObject(6, UUID.class),
                        result.getString(7), result.getLong(8), result.getString(9), (Long) result.getObject(10),
                        result.getString(11), result.getLong(12), result.getLong(13), result.getLong(14)),
                workspaceUuid, groupWorkspaceKey, projectRef);
    }

    public boolean artifactAssignedToStore(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            UUID storeRef, UUID artifactRef) {
        Boolean found = jdbc.queryForObject("""
                SELECT EXISTS (
                  SELECT 1 FROM terminal_update.project_rule
                  WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=?
                    AND (full_artifact_ref=? OR hot_artifact_ref=?)
                    AND (target_mode='ALL' OR store_refs @> jsonb_build_array(?::text))
                )
                """, Boolean.class, workspaceUuid, groupWorkspaceKey, projectRef, artifactRef, artifactRef,
                storeRef.toString());
        return Boolean.TRUE.equals(found);
    }

    public boolean changeStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID ruleRef,
            long revision, String status, long updatedAt) {
        return jdbc.update(
                "UPDATE terminal_update.project_rule SET status=?,updated_at_epoch_millis=?,revision=revision+1 WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? AND rule_ref=? AND revision=?",
                status, updatedAt, workspaceUuid, groupWorkspaceKey, projectRef, ruleRef, revision) == 1;
    }

    public void refreshTopic(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, long triggerTime) {
        String members = jdbc.queryForObject(
                "SELECT coalesce(string_agg(rule_ref::text || E'\\n','' ORDER BY created_at_epoch_millis DESC,rule_ref DESC),'') FROM terminal_update.project_rule WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=? AND status='ENABLED'",
                String.class, workspaceUuid, groupWorkspaceKey, projectRef);
        String hash = com.catering.v2s.platform.foundation.security.Sha256Hex.digest(members == null ? "" : members);
        List<String> current = jdbc.query(
                "SELECT collection_hash FROM terminal_update.rule_topic_snapshot WHERE workspace_uuid=? AND group_workspace_key=? AND project_ref=?",
                (result, row) -> result.getString(1), workspaceUuid, groupWorkspaceKey, projectRef);
        if (!current.isEmpty() && current.getFirst().equals(hash)) return;
        jdbc.update(
                "INSERT INTO terminal_update.rule_topic_snapshot(workspace_uuid,group_workspace_key,project_ref,collection_hash,topic_time_epoch_millis) VALUES(?,?,?,?,?) ON CONFLICT(workspace_uuid,group_workspace_key,project_ref) DO UPDATE SET collection_hash=EXCLUDED.collection_hash,topic_time_epoch_millis=EXCLUDED.topic_time_epoch_millis",
                workspaceUuid, groupWorkspaceKey, projectRef, hash, triggerTime);
        jdbc.execute(
                (PreparedStatementCreator) connection -> {
                    var statement = connection.prepareStatement(
                            "SELECT pg_notify(?, jsonb_build_object('v',1,'kind','TOPIC_CHANGED','workspaceUuid',?,"
                                    + "'groupWorkspaceKey',?,'topicKey','TERMINAL_UPDATE_RULES','ownerRef',?)::text)");
                    statement.setString(1, CHANNEL);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                    statement.setObject(4, projectRef);
                    return statement;
                },
                java.sql.PreparedStatement::execute);
    }

    private static List<UUID> readUuids(String json) {
        try { return JSON.readValue(json, UUID_LIST); }
        catch (Exception failure) { throw new IllegalStateException("terminal update store refs are invalid", failure); }
    }

    private static String write(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception failure) { throw new IllegalStateException("terminal update rule serialization failed", failure); }
    }

    private static RuleReadback read(String json) {
        try { return JSON.readValue(json, RuleReadback.class); }
        catch (Exception failure) { throw new IllegalStateException("terminal update rule receipt is invalid", failure); }
    }
}
