package com.catering.v2s.terminalupdate.application.persistence;

import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportHistoryRow;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportInput;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportReferences;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportReceipt;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportRuleTarget;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionDetail;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionQuery;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionRow;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleArtifactIdentity;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL boundary for committed terminal update observations and task history. */
@Repository
public class TerminalUpdateReportPersistence {
    private static final String REPORT_REFERENCE_COLUMNS = "report_rule.rule_ref AS report_rule_ref,"
            + "rule_full.application_id AS rule_full_application_id,rule_full.kind AS rule_full_kind,"
            + "CASE WHEN rule_full.kind='FULL' THEN rule_full.native_version ELSE rule_full.bundle_version END AS rule_full_version,"
            + "rule_hot.application_id AS rule_hot_application_id,rule_hot.kind AS rule_hot_kind,"
            + "CASE WHEN rule_hot.kind='FULL' THEN rule_hot.native_version ELSE rule_hot.bundle_version END AS rule_hot_version,"
            + "report_full.application_id AS report_full_application_id,report_full.kind AS report_full_kind,"
            + "CASE WHEN report_full.kind='FULL' THEN report_full.native_version ELSE report_full.bundle_version END AS report_full_version,"
            + "report_hot.application_id AS report_hot_application_id,report_hot.kind AS report_hot_kind,"
            + "CASE WHEN report_hot.kind='FULL' THEN report_hot.native_version ELSE report_hot.bundle_version END AS report_hot_version";
    private final JdbcTemplate jdbc;

    public TerminalUpdateReportPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void lock(Verification binding) {
        AdvisoryLock.acquireHashText(jdbc, "terminal-update:report:" + binding.workspaceUuid() + ":"
                + binding.groupWorkspaceKey() + ":" + binding.terminalRef() + ":" + binding.generation());
    }

    public ReportFacts facts(Verification binding, ReportInput input) {
        String scope = "workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? AND binding_generation=?";
        String columns = "report_id,task_id,report_sequence,body_hash,device_id,received_at_epoch_millis";
        String sql = "SELECT maximum.maximum_sequence,"
                + "current_report." + columns.replace(",", ",current_report.") + ","
                + "sequence_report." + columns.replace(",", ",sequence_report.") + ","
                + "id_report." + columns.replace(",", ",id_report.") + " "
                + "FROM (SELECT COALESCE(max(report_sequence),0) AS maximum_sequence "
                + "FROM terminal_update.terminal_report WHERE " + scope + ") maximum "
                + "LEFT JOIN LATERAL (SELECT " + columns + " FROM terminal_update.terminal_report WHERE "
                + scope + " AND report_key=? LIMIT 1) current_report ON TRUE "
                + "LEFT JOIN LATERAL (SELECT " + columns + " FROM terminal_update.terminal_report WHERE "
                + scope + " AND report_sequence=? LIMIT 1) sequence_report ON TRUE "
                + "LEFT JOIN LATERAL (SELECT " + columns + " FROM terminal_update.terminal_report WHERE "
                + scope + " AND report_id=? LIMIT 1) id_report ON TRUE";
        Object[] args = new Object[] {
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation(),
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation(),
                input.taskId() == null ? "observation" : input.taskId().toString(),
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation(),
                input.reportSequence(),
                binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation(),
                input.reportId()
        };
        return jdbc.queryForObject(sql, (rs, row) -> new ReportFacts(rs.getLong(1), stored(rs, 2), stored(rs, 8), stored(rs, 14)), args);
    }

    public ReportReceipt insert(Verification binding, ReportInput input, long receivedAt) {
        String key = input.taskId() == null ? "observation" : input.taskId().toString();
        jdbc.update("INSERT INTO terminal_update.terminal_report(report_row_ref,workspace_uuid,group_workspace_key,"
                        + "terminal_ref,binding_generation,device_id,report_key,task_id,report_id,report_sequence,body_hash,"
                        + "actual,recent,changed_at_epoch_millis,received_at_epoch_millis) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?,?)",
                UUID.randomUUID(), binding.workspaceUuid(), binding.groupWorkspaceKey(), binding.terminalRef(),
                binding.generation(), input.deviceId(), key, input.taskId(), input.reportId(), input.reportSequence(),
                input.bodyHash(), input.actualJson(), input.recentJson(), input.changedAtEpochMillis(), receivedAt);
        return new ReportReceipt(input.reportId(), input.taskId(), input.reportSequence(), "ACCEPTED");
    }

    public ReportReceipt update(Verification binding, ReportInput input, long receivedAt) {
        String key = input.taskId() == null ? "observation" : input.taskId().toString();
        int count = jdbc.update("UPDATE terminal_update.terminal_report SET device_id=?,report_id=?,report_sequence=?,"
                        + "body_hash=?,actual=?::jsonb,recent=?::jsonb,changed_at_epoch_millis=?,received_at_epoch_millis=? "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? AND binding_generation=? "
                        + "AND report_key=?",
                input.deviceId(), input.reportId(), input.reportSequence(), input.bodyHash(), input.actualJson(),
                input.recentJson(), input.changedAtEpochMillis(), receivedAt, binding.workspaceUuid(),
                binding.groupWorkspaceKey(), binding.terminalRef(), binding.generation(), key);
        if (count != 1) throw new IllegalStateException("terminal update report row disappeared under owner lock");
        return new ReportReceipt(input.reportId(), input.taskId(), input.reportSequence(), "ACCEPTED");
    }

    public VersionPageRows page(VersionQuery query) {
        validateLimit(query.limit());
        String identity = pageIdentity(query);
        OpaqueCollectionCursor.Position frontier;
        try { frontier = OpaqueCollectionCursor.decode(query.cursor(), identity); }
        catch (OpaqueCollectionCursor.InvalidCursor invalid) { throw new InvalidCursorException(); }
        if (frontier != null && (!frontier.sortKey().matches("[0-9a-f]{32}")
                || !frontier.sortKey().equals(uuidHex(frontier.tieBreaker())))) throw new InvalidCursorException();

        StringBuilder sql = new StringBuilder("WITH eligible AS (SELECT t.terminal_ref,t.name AS terminal_name,"
                + "s.id AS store_ref,s.name AS store_name,b.generation,b.binding_status FROM organization.store s "
                + "JOIN store_terminal.terminal t ON t.workspace_uuid=s.workspace_uuid AND t.group_workspace_key=s.group_workspace_key "
                + "AND t.store_ref=s.id LEFT JOIN terminal_binding.latest_binding b ON b.workspace_uuid=t.workspace_uuid "
                + "AND b.group_workspace_key=t.group_workspace_key AND b.terminal_ref=t.terminal_ref "
                + "WHERE s.workspace_uuid=? AND s.group_workspace_key=? AND s.project_id=? "
                + "AND s.status='ENABLED' AND t.status='ENABLED'" + (query.storeRef() == null ? "" : " AND s.id=?")
                + "), projected AS (SELECT e.*,r.report_id,r.task_id,r.binding_generation AS report_generation,"
                + "r.actual,r.recent,r.received_at_epoch_millis,"
                + "CASE WHEN r.report_id IS NOT NULL AND (e.binding_status IS DISTINCT FROM 'ACTIVE' "
                + "OR e.generation IS NULL OR r.binding_generation<>e.generation) THEN TRUE ELSE FALSE END AS old_binding "
                + "FROM eligible e LEFT JOIN LATERAL ("
                + "SELECT report_id,task_id,binding_generation,actual,recent,received_at_epoch_millis FROM terminal_update.terminal_report r "
                + "WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.terminal_ref=e.terminal_ref "
                + "ORDER BY r.binding_generation DESC,r.report_sequence DESC LIMIT 1) r ON TRUE WHERE TRUE");
        List<Object> args = new ArrayList<>();
        args.add(query.workspaceUuid()); args.add(query.groupWorkspaceKey()); args.add(query.projectRef());
        if (query.storeRef() != null) args.add(query.storeRef());
        args.add(query.workspaceUuid()); args.add(query.groupWorkspaceKey());
        addNameFilter(sql, args, query.queryText());
        addJsonFilter(sql, args, "actual->>'apkVersion'", query.currentApkVersion());
        addJsonFilter(sql, args, "actual->>'jsVersion'", query.currentJsVersion());
        addJsonFilter(sql, args, "actual->>'runtimeVersion'", query.runtimeVersion());
        if (frontier != null) { sql.append(" AND terminal_ref<?"); args.add(frontier.tieBreaker()); }
        sql.append(" ORDER BY terminal_ref DESC LIMIT ?) SELECT terminal_ref,terminal_name,store_ref,store_name,"
                + "report_id,task_id,report_generation,generation,actual::text,recent::text,received_at_epoch_millis,old_binding FROM projected ORDER BY terminal_ref DESC");
        args.add(query.limit() + 1);
        List<VersionRow> rows = jdbc.query(sql.toString(), (rs, row) -> new VersionRow(
                rs.getObject("terminal_ref", UUID.class), rs.getString("terminal_name"),
                rs.getObject("store_ref", UUID.class), rs.getString("store_name"),
                rs.getObject("report_id", UUID.class) != null,
                rs.getString("actual"), rs.getString("recent"),
                rs.getBoolean("old_binding"),
                rs.getObject("received_at_epoch_millis", Long.class)),
                args.toArray());
        boolean hasMore = rows.size() > query.limit();
        List<VersionRow> items = hasMore ? List.copyOf(rows.subList(0, query.limit())) : List.copyOf(rows);
        String next = hasMore && !items.isEmpty()
                ? OpaqueCollectionCursor.encode(identity, uuidHex(items.getLast().terminalRef()), items.getLast().terminalRef())
                : null;
        return new VersionPageRows(items, next);
    }

    public Optional<VersionDetail> detail(UUID workspace, String groupKey, UUID projectRef, UUID terminalRef) {
        List<VersionDetail> rows = jdbc.query("SELECT t.terminal_ref,t.name,s.id,s.name,r.actual::text,r.recent::text,"
                        + "r.received_at_epoch_millis,"
                        + "(r.report_id IS NOT NULL AND (b.binding_status IS DISTINCT FROM 'ACTIVE' "
                        + "OR b.generation IS NULL OR r.report_generation<>b.generation)) "
                        + "," + REPORT_REFERENCE_COLUMNS + " "
                        + "FROM organization.store s JOIN store_terminal.terminal t ON t.workspace_uuid=s.workspace_uuid "
                        + "AND t.group_workspace_key=s.group_workspace_key AND t.store_ref=s.id "
                        + "LEFT JOIN terminal_binding.latest_binding b ON b.workspace_uuid=t.workspace_uuid "
                        + "AND b.group_workspace_key=t.group_workspace_key AND b.terminal_ref=t.terminal_ref "
                        + "LEFT JOIN LATERAL (SELECT report_id,actual,recent,received_at_epoch_millis,binding_generation AS report_generation FROM terminal_update.terminal_report r "
                        + "WHERE r.workspace_uuid=t.workspace_uuid AND r.group_workspace_key=t.group_workspace_key "
                        + "AND r.terminal_ref=t.terminal_ref ORDER BY binding_generation DESC,report_sequence DESC LIMIT 1) r ON TRUE "
                        + reportReferenceJoins("t.workspace_uuid", "t.group_workspace_key", "s.project_id", "r")
                        + "WHERE s.workspace_uuid=? AND s.group_workspace_key=? AND s.project_id=? AND s.status='ENABLED' "
                        + "AND t.status='ENABLED' AND t.terminal_ref=?",
                (rs, row) -> new VersionDetail(rs.getObject(1, UUID.class), rs.getString(2), rs.getObject(3, UUID.class),
                        rs.getString(4), rs.getString(5), rs.getString(6), rs.getBoolean(8),
                        rs.getObject(7, Long.class), reportReferences(rs), null),
                workspace, groupKey, projectRef, terminalRef);
        return rows.stream().findFirst();
    }

    public HistoryPageRows history(UUID workspace, String groupKey, UUID projectRef, UUID terminalRef,
            String cursor, int limit) {
        validateLimit(limit);
        String identity = Sha256Hex.digest(workspace + "|" + groupKey + "|" + projectRef + "|" + terminalRef + "|" + limit);
        OpaqueCollectionCursor.Position frontier;
        try { frontier = OpaqueCollectionCursor.decode(cursor, identity); }
        catch (OpaqueCollectionCursor.InvalidCursor invalid) { throw new InvalidCursorException(); }
        long receivedAt = 0;
        if (frontier != null) {
            try { receivedAt = Long.parseLong(frontier.sortKey()); }
            catch (NumberFormatException invalid) { throw new InvalidCursorException(); }
        }
        List<Object> args = new ArrayList<>(List.of(workspace, groupKey, projectRef, terminalRef, workspace, groupKey));
        StringBuilder sql = new StringBuilder("WITH eligible AS (SELECT t.terminal_ref,t.workspace_uuid,t.group_workspace_key,"
                + "s.project_id FROM store_terminal.terminal t "
                + "JOIN organization.store s ON s.workspace_uuid=t.workspace_uuid AND s.group_workspace_key=t.group_workspace_key "
                + "AND s.id=t.store_ref WHERE t.workspace_uuid=? AND t.group_workspace_key=? AND s.project_id=? "
                + "AND t.terminal_ref=? AND t.status='ENABLED' AND s.status='ENABLED') "
                + "SELECT e.terminal_ref,r.report_id,r.task_id,r.report_sequence,r.actual::text,r.recent::text,"
                + "r.received_at_epoch_millis," + REPORT_REFERENCE_COLUMNS + " "
                + "FROM eligible e LEFT JOIN LATERAL (SELECT report_id,task_id,report_sequence,actual,recent,received_at_epoch_millis "
                + "FROM terminal_update.terminal_report WHERE workspace_uuid=? AND group_workspace_key=? "
                + "AND terminal_ref=e.terminal_ref AND task_id IS NOT NULL");
        if (frontier != null) {
            sql.append(" AND (received_at_epoch_millis<? OR (received_at_epoch_millis=? AND task_id<?))");
            args.add(receivedAt); args.add(receivedAt); args.add(frontier.tieBreaker());
        }
        sql.append(" ORDER BY received_at_epoch_millis DESC,task_id DESC LIMIT ?) r ON TRUE")
                .append(reportReferenceJoins("e.workspace_uuid", "e.group_workspace_key", "e.project_id", "r"));
        args.add(limit + 1);
        List<EligibleHistoryRow> eligibleRows = jdbc.query(sql.toString(), (rs, row) -> {
            UUID reportId = rs.getObject("report_id", UUID.class);
            ReportHistoryRow report = reportId == null ? null : new ReportHistoryRow(reportId,
                    rs.getObject("task_id", UUID.class), rs.getLong("report_sequence"), rs.getString("actual"),
                    rs.getString("recent"), reportReferences(rs), rs.getLong("received_at_epoch_millis"));
            return new EligibleHistoryRow(rs.getObject("terminal_ref", UUID.class), report);
        }, args.toArray());
        boolean eligible = !eligibleRows.isEmpty();
        List<ReportHistoryRow> rows = eligibleRows.stream().map(EligibleHistoryRow::report)
                .filter(java.util.Objects::nonNull).toList();
        boolean hasMore = rows.size() > limit;
        List<ReportHistoryRow> items = hasMore ? List.copyOf(rows.subList(0, limit)) : List.copyOf(rows);
        String next = hasMore && !items.isEmpty() ? OpaqueCollectionCursor.encode(identity,
                Long.toString(items.getLast().receivedAtEpochMillis()), items.getLast().taskId()) : null;
        return new HistoryPageRows(eligible, items, next);
    }

    private static StoredReport stored(java.sql.ResultSet rs, int start) throws java.sql.SQLException {
        UUID reportId = rs.getObject(start, UUID.class);
        return reportId == null ? null : new StoredReport(reportId, rs.getObject(start + 1, UUID.class),
                rs.getLong(start + 2), rs.getString(start + 3), rs.getString(start + 4), rs.getLong(start + 5));
    }

    private static String reportReferenceJoins(String workspace, String group, String project, String report) {
        return " LEFT JOIN terminal_update.project_rule report_rule ON report_rule.workspace_uuid=" + workspace
                + " AND report_rule.group_workspace_key=" + group + " AND report_rule.project_ref=" + project
                + " AND report_rule.rule_ref::text=" + report + ".recent->>'ruleRef'"
                + " LEFT JOIN terminal_update.artifact rule_full ON rule_full.workspace_uuid=" + workspace
                + " AND rule_full.group_workspace_key=" + group + " AND rule_full.artifact_ref=report_rule.full_artifact_ref"
                + " LEFT JOIN terminal_update.artifact rule_hot ON rule_hot.workspace_uuid=" + workspace
                + " AND rule_hot.group_workspace_key=" + group + " AND rule_hot.artifact_ref=report_rule.hot_artifact_ref"
                + " LEFT JOIN terminal_update.artifact report_full ON report_full.workspace_uuid=" + workspace
                + " AND report_full.group_workspace_key=" + group
                + " AND report_full.artifact_ref::text=" + report + ".recent->>'fullArtifactRef'"
                + " LEFT JOIN terminal_update.artifact report_hot ON report_hot.workspace_uuid=" + workspace
                + " AND report_hot.group_workspace_key=" + group
                + " AND report_hot.artifact_ref::text=" + report + ".recent->>'hotArtifactRef'";
    }

    private static ReportReferences reportReferences(java.sql.ResultSet rs) throws java.sql.SQLException {
        ReportRuleTarget ruleTarget = rs.getObject("report_rule_ref", UUID.class) == null ? null
                : new ReportRuleTarget(identity(rs, "rule_full"), identity(rs, "rule_hot"));
        return new ReportReferences(ruleTarget, identity(rs, "report_full"), identity(rs, "report_hot"));
    }

    private static RuleArtifactIdentity identity(java.sql.ResultSet rs, String prefix) throws java.sql.SQLException {
        String applicationId = rs.getString(prefix + "_application_id");
        return applicationId == null ? null : new RuleArtifactIdentity(applicationId,
                rs.getString(prefix + "_kind"), rs.getString(prefix + "_version"));
    }

    private static String pageIdentity(VersionQuery q) {
        return Sha256Hex.digest(q.workspaceUuid() + "|" + q.groupWorkspaceKey() + "|" + q.projectRef() + "|"
                + q.storeRef() + "|" + q.queryText() + "|" + q.currentApkVersion() + "|" + q.currentJsVersion()
                + "|" + q.runtimeVersion() + "|" + q.limit());
    }

    private static void addNameFilter(StringBuilder sql, List<Object> args, String value) {
        if (value != null && !value.isBlank()) { sql.append(" AND strpos(lower(terminal_name),lower(?))>0"); args.add(value); }
    }

    private static void addJsonFilter(StringBuilder sql, List<Object> args, String field, String value) {
        if (value != null && !value.isBlank()) { sql.append(" AND ").append(field).append("=?"); args.add(value); }
    }

    private static String uuidHex(UUID value) { return value.toString().replace("-", ""); }

    private static void validateLimit(int limit) { if (limit < 1 || limit > 100) throw new InvalidCursorException(); }

    public record StoredReport(UUID reportId, UUID taskId, long sequence, String bodyHash, String deviceId, long receivedAt) {}
    public record ReportFacts(long maximumSequence, StoredReport current, StoredReport sameSequence, StoredReport sameReportId) {}
    public record VersionPageRows(List<VersionRow> items, String nextCursor) {}
    public record EligibleHistoryRow(UUID terminalRef, ReportHistoryRow report) {}
    public record HistoryPageRows(boolean eligible, List<ReportHistoryRow> items, String nextCursor) {}
    public static final class InvalidCursorException extends RuntimeException {}
}
