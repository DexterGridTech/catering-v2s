package com.catering.v2s.terminalupdate.api;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleArtifactIdentity;
import java.util.List;
import java.util.UUID;

/** Owns committed device update reports and bounded project report reads. */
public interface TerminalUpdateReportOwnerApi {
    ReportReceipt record(Verification binding, ReportInput input);

    VersionPage readVersionPage(VersionQuery query);

    VersionDetail readVersionDetail(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef);

    ReportHistoryPage readHistory(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef,
            String cursor, int limit);

    record ReportInput(UUID reportId, long reportSequence, UUID taskId, String deviceId, String actualJson,
            String recentJson, long changedAtEpochMillis, String bodyHash) {}

    record ReportReceipt(UUID reportId, UUID taskId, long acceptedSequence, String outcome) {}

    record VersionQuery(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID storeRef,
            String queryText, String currentApkVersion, String currentJsVersion, String runtimeVersion,
            String cursor, int limit) {}

    record VersionRow(UUID terminalRef, String terminalName, UUID storeRef, String storeName,
            boolean hasReport, String actualJson, String recentJson, boolean oldBinding, Long receivedAtEpochMillis) {}

    record VersionPage(List<VersionRow> items, String nextCursor) {
        public VersionPage { items = List.copyOf(items); }
    }

    record VersionDetail(UUID terminalRef, String terminalName, UUID storeRef, String storeName,
            String actualJson, String recentJson, boolean oldBinding, Long receivedAtEpochMillis,
            ReportReferences latestReferences, String historyCursor) {}

    record ReportHistoryRow(UUID reportId, UUID taskId, long reportSequence, String actualJson,
            String recentJson, ReportReferences references, long receivedAtEpochMillis) {}

    record ReportRuleTarget(RuleArtifactIdentity fullArtifactIdentity, RuleArtifactIdentity hotArtifactIdentity) {}

    record ReportReferences(ReportRuleTarget ruleTarget, RuleArtifactIdentity fullArtifactIdentity,
            RuleArtifactIdentity hotArtifactIdentity) {}

    record ReportHistoryPage(List<ReportHistoryRow> items, String nextCursor) {
        public ReportHistoryPage { items = List.copyOf(items); }
    }

    final class IdentityConflictException extends RuntimeException {
        public IdentityConflictException() { super("TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT"); }
    }

    final class TargetNotFoundException extends RuntimeException {
        public TargetNotFoundException() { super("TERMINAL_UPDATE_REPORT_TARGET_NOT_FOUND"); }
    }

    final class InvalidQueryException extends RuntimeException {
        public InvalidQueryException() { super("TERMINAL_UPDATE_REPORT_QUERY_INVALID"); }
    }
}
