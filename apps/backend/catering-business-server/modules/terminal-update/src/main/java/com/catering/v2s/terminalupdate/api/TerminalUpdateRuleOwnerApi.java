package com.catering.v2s.terminalupdate.api;

import com.catering.v2s.audit.contract.AuditActor;
import java.util.List;
import java.util.UUID;

/** Project-owned terminal update rules and their owner-maintained delivery snapshot. */
public interface TerminalUpdateRuleOwnerApi {
    RuleReadback create(CreateRule command);

    RuleReadback changeStatus(ChangeRuleStatus command);

    RuleReadback read(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID ruleRef);

    RulePage page(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, RulePageQuery query);

    RuleStorePage stores(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID ruleRef,
            String cursor, int limit);

    RuleSnapshotPage terminalSnapshot(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            String cursor, int limit, String collectionHash);

    record RulePageQuery(String status, String applicationId, Long createdFromEpochMillis,
            Long createdToEpochMillis, String cursor, int limit) {}

    record RulePage(List<RuleSummary> items, String nextCursor) {
        public RulePage { items = List.copyOf(items); }
    }

    record RuleSummary(UUID ruleRef, UUID projectRef, String status, String targetMode,
            UUID fullArtifactRef, UUID hotArtifactRef, long nSeconds, String hotStrategy,
            RuleArtifactIdentity fullArtifactIdentity, RuleArtifactIdentity hotArtifactIdentity,
            Long mSeconds, String description, long createdAtEpochMillis, long revision) {}

    record RuleArtifactIdentity(String applicationId, String kind, String version) {}

    record RuleStorePage(List<RuleStore> items, String nextCursor) {
        public RuleStorePage { items = List.copyOf(items); }
    }

    record RuleStore(UUID storeRef, String name, String code, String status, String unknownReason) {}

    record RuleSnapshotPage(List<RuleSnapshotItem> items, String collectionHash, String nextCursor) {
        public RuleSnapshotPage { items = List.copyOf(items); }
    }

    record RuleSnapshotItem(UUID ruleRef, String targetMode, List<UUID> storeRefs, String applicationId,
            long createdAtEpochMillis, SnapshotArtifact full, SnapshotArtifact hot, long nSeconds, String hotStrategy, Long mSeconds,
            String description) {
        public RuleSnapshotItem { storeRefs = List.copyOf(storeRefs); }
    }

    record SnapshotArtifact(UUID artifactRef, String kind, String applicationId, String runtimeVersion,
            long nativeBuildNumber, String apkVersion, String jsVersion, String publicationId,
            String apkSha256, String zipSha256, long byteSize, long createdAtEpochMillis) {}

    record CreateRule(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String targetMode,
            List<UUID> storeRefs,
            UUID fullArtifactRef,
            UUID hotArtifactRef,
            String status,
            long nSeconds,
            String hotStrategy,
            Long mSeconds,
            String description,
            long expectedContextVersion,
            String idempotencyKey,
            AuditActor actor) {
        public CreateRule {
            storeRefs = storeRefs == null ? List.of() : List.copyOf(storeRefs);
        }
    }

    record ChangeRuleStatus(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            UUID ruleRef,
            long revision,
            String status,
            String reason,
            long expectedContextVersion,
            String idempotencyKey,
            AuditActor actor) {}

    record RuleReadback(
            UUID ruleRef,
            UUID projectRef,
            String targetMode,
            List<UUID> storeRefs,
            UUID fullArtifactRef,
            UUID hotArtifactRef,
            RuleArtifactIdentity fullArtifactIdentity,
            RuleArtifactIdentity hotArtifactIdentity,
            String status,
            long nSeconds,
            String hotStrategy,
            Long mSeconds,
            String description,
            long createdAtEpochMillis,
            long updatedAtEpochMillis,
            long revision) {
        public RuleReadback {
            storeRefs = List.copyOf(storeRefs);
        }

        public RuleReadback(UUID ruleRef, UUID projectRef, String targetMode, List<UUID> storeRefs,
                UUID fullArtifactRef, UUID hotArtifactRef, String status, long nSeconds, String hotStrategy,
                Long mSeconds, String description, long createdAtEpochMillis, long updatedAtEpochMillis,
                long revision) {
            this(ruleRef, projectRef, targetMode, storeRefs, fullArtifactRef, hotArtifactRef,
                    null, null, status, nSeconds, hotStrategy, mSeconds, description,
                    createdAtEpochMillis, updatedAtEpochMillis, revision);
        }
    }
}
