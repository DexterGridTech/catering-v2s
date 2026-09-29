package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.platform.asset.api.WorkspaceLogoAssetCommand;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import com.catering.v2s.platform.identity.GroupWorkspaceKey;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPage;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceAdministrationPersistence;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Workspace owner command surface; R3 bigint identity remains transitional only. */
@Service
public class WorkspaceAdministrationService implements WorkspaceStatusLookup {
    private final WorkspaceAdministrationPersistence persistence;
    private final TimeProvider time;
    private final WorkspaceLogoAssetCommand assets;
    private final WorkspaceCommandReceiptService receipts;
    private final WorkspaceIamSummaryLookup workspaceIam;

    public WorkspaceAdministrationService(
            WorkspaceAdministrationPersistence persistence,
            TimeProvider time,
            WorkspaceLogoAssetCommand assets,
            WorkspaceCommandReceiptService receipts,
            WorkspaceIamSummaryLookup workspaceIam) {
        this.persistence = persistence;
        this.time = time;
        this.assets = assets;
        this.receipts = receipts;
        this.workspaceIam = workspaceIam;
    }

    @Transactional
    public WorkspaceAdministrationReadback create(
            String key,
            String name,
            String operationsTitle,
            UUID logoAssetRef,
            String logoBindGrant,
            String notes,
            String idempotencyKey) {
        return create(
                key, name, operationsTitle, logoAssetRef, logoBindGrant, notes, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public WorkspaceAdministrationReadback create(
            String key,
            String name,
            String operationsTitle,
            UUID logoAssetRef,
            String logoBindGrant,
            String notes,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                key,
                idempotencyKey,
                canonical("create", key, name, operationsTitle, String.valueOf(logoAssetRef), notes),
                () -> createNew(key, name, operationsTitle, logoAssetRef, logoBindGrant, notes, actor));
    }

    private WorkspaceAdministrationReadback createNew(
            String key,
            String name,
            String operationsTitle,
            UUID logoAssetRef,
            String logoBindGrant,
            String notes,
            AuditActor actor) {
        String normalizedKey = requiredKey(key);
        String normalizedName = requiredName(name);
        long now = time.currentEpochMillis();
        UUID workspaceUuid = UUID.randomUUID();
        try {
            persistence.create(
                    workspaceUuid,
                    normalizedKey,
                    name.trim(),
                    normalizedName,
                    requiredTitle(operationsTitle, name),
                    requiredLogo(logoAssetRef).toString(),
                    optionalNotes(notes),
                    now);
        } catch (DuplicateKeyException exception) {
            throw new WorkspaceConflictException(exception);
        }
        assets.claim(logoAssetRef, workspaceUuid, normalizedKey, requiredGrant(logoBindGrant));
        WorkspaceAdministrationReadback created = require(normalizedKey);
        audit(
                created,
                "GROUP_WORKSPACE_CREATED",
                now,
                actor,
                "[{\"fieldKey\":\"groupWorkspaceKey\",\"after\":\"" + json(created.groupWorkspaceKey())
                        + "\"},{\"fieldKey\":\"name\",\"after\":\"" + json(created.name())
                        + "\"},{\"fieldKey\":\"operationsTitle\",\"after\":\"" + json(created.operationsTitle())
                        + "\"},{\"fieldKey\":\"logo\",\"after\":\"已配置\"}"
                        + (created.notes() == null
                                ? "]"
                                : ",{\"fieldKey\":\"notes\",\"after\":\"" + json(created.notes()) + "\"}]"));
        return created;
    }

    @Transactional(readOnly = true)
    public WorkspaceAdministrationPage list(WorkspaceAdministrationPageRequest request) {
        WorkspaceAdministrationPersistence.PageResult result = persistence.page(request);
        return new WorkspaceAdministrationPage(
                result.items(),
                request.page(),
                request.pageSize(),
                result.total(),
                request.sortKey(),
                request.sortDirection());
    }

    @Transactional(readOnly = true)
    public WorkspaceAdministrationReadback require(String key) {
        return persistence.findByKey(requiredKey(key)).orElseThrow(WorkspaceNotFoundException::new);
    }

    /** Owner-checked selected-workspace boundary for every dependent task. */
    @Transactional(readOnly = true)
    public WorkspaceAdministrationReadback requireEnabled(String key) {
        WorkspaceAdministrationReadback workspace = require(key);
        if (!"ENABLED".equals(workspace.status())) throw new WorkspaceDisabledException();
        return workspace;
    }

    @Override
    @Transactional(readOnly = true)
    public String requireStatus(UUID workspaceUuid, String groupWorkspaceKey) {
        return persistence.findStatus(workspaceUuid, groupWorkspaceKey).orElseThrow(WorkspaceNotFoundException::new);
    }

    @Transactional
    public WorkspaceAdministrationReadback updateDisplay(
            String key,
            String name,
            String operationsTitle,
            String notes,
            String logoIntent,
            UUID nextLogoAssetRef,
            String logoBindGrant,
            long expectedVersion,
            String idempotencyKey) {
        return updateDisplay(
                key,
                name,
                operationsTitle,
                notes,
                logoIntent,
                nextLogoAssetRef,
                logoBindGrant,
                expectedVersion,
                idempotencyKey,
                AuditActor.system());
    }

    @Transactional
    public WorkspaceAdministrationReadback updateDisplay(
            String key,
            String name,
            String operationsTitle,
            String notes,
            String logoIntent,
            UUID nextLogoAssetRef,
            String logoBindGrant,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                key,
                idempotencyKey,
                canonical(
                        "updateDisplay",
                        key,
                        name,
                        operationsTitle,
                        notes,
                        logoIntent,
                        String.valueOf(nextLogoAssetRef),
                        String.valueOf(expectedVersion)),
                () -> updateDisplayNew(
                        key,
                        name,
                        operationsTitle,
                        notes,
                        logoIntent,
                        nextLogoAssetRef,
                        logoBindGrant,
                        expectedVersion,
                        actor));
    }

    private WorkspaceAdministrationReadback updateDisplayNew(
            String key,
            String name,
            String operationsTitle,
            String notes,
            String logoIntent,
            UUID nextLogoAssetRef,
            String logoBindGrant,
            long expectedVersion,
            AuditActor actor) {
        WorkspaceAdministrationReadback current = require(key);
        UUID previousLogoAssetRef = current.logoAssetRef() == null ? null : UUID.fromString(current.logoAssetRef());
        String resolvedIntent = requiredLogoIntent(logoIntent);
        UUID targetLogo =
                switch (resolvedIntent) {
                    case "KEEP" -> keepOrRemoveLogo(previousLogoAssetRef, nextLogoAssetRef, logoBindGrant, true);
                    case "REMOVE" -> keepOrRemoveLogo(null, nextLogoAssetRef, logoBindGrant, false);
                    case "REPLACE" -> requiredLogo(nextLogoAssetRef);
                    default -> throw new WorkspaceInputInvalidException();
                };
        if ("REPLACE".equals(resolvedIntent))
            assets.claim(
                    targetLogo, current.workspaceUuid(), current.groupWorkspaceKey(), requiredGrant(logoBindGrant));
        WorkspaceAdministrationPersistence.UpdateResult updatedRow = persistence
                .updateDisplay(
                        name.trim(),
                        requiredName(name),
                        requiredTitle(operationsTitle, name),
                        optionalNotes(notes),
                        targetLogo == null ? null : targetLogo.toString(),
                        time.currentEpochMillis(),
                        requiredKey(key),
                        expectedVersion)
                .orElseThrow(WorkspaceVersionConflictException::new);
        if (previousLogoAssetRef != null && !previousLogoAssetRef.equals(targetLogo))
            assets.release(previousLogoAssetRef, current.workspaceUuid());
        WorkspaceAdministrationReadback updated = updatedRow.readback();
        audit(
                updated,
                "GROUP_WORKSPACE_UPDATED",
                time.currentEpochMillis(),
                actor,
                updatedRow.legacyId(),
                updateChanges(current, updated, resolvedIntent));
        return updated;
    }

    @Transactional
    public WorkspaceAdministrationReadback transitionStatus(
            String key, String status, long expectedVersion, String idempotencyKey) {
        return transitionStatus(key, status, expectedVersion, idempotencyKey, AuditActor.system());
    }

    @Transactional
    public WorkspaceAdministrationReadback transitionStatus(
            String key, String status, long expectedVersion, String idempotencyKey, AuditActor actor) {
        return receipts.execute(
                key,
                idempotencyKey,
                canonical("transitionStatus", key, status, String.valueOf(expectedVersion)),
                () -> transitionStatusNew(key, status, expectedVersion, actor));
    }

    private WorkspaceAdministrationReadback transitionStatusNew(
            String key, String status, long expectedVersion, AuditActor actor) {
        if (!"ENABLED".equals(status) && !"DISABLED".equals(status)) throw new WorkspaceStatusInvalidException();
        long now = time.currentEpochMillis();
        int changed = persistence.transitionStatus(status, now, requiredKey(key), expectedVersion);
        if (changed == 0) throw new WorkspaceVersionConflictException();
        WorkspaceAdministrationReadback updated = require(key);
        audit(
                updated,
                "GROUP_WORKSPACE_STATUS_CHANGED",
                now,
                actor,
                "[{\"fieldKey\":\"status\",\"after\":\"" + json(updated.status()) + "\"}]");
        return updated;
    }

    @Transactional(readOnly = true)
    public long accountCount(UUID workspaceUuid) {
        return workspaceIam.accountCount(workspaceUuid);
    }

    @Transactional(readOnly = true)
    public long roleCount(UUID workspaceUuid) {
        return workspaceIam.roleCount(workspaceUuid);
    }

    private void audit(
            WorkspaceAdministrationReadback workspace,
            String action,
            long occurredAt,
            AuditActor actor,
            String changesJson) {
        Long legacyId = persistence.findLegacyId(workspace.workspaceUuid(), workspace.groupWorkspaceKey());
        audit(workspace, action, occurredAt, actor, legacyId, changesJson);
    }

    private void audit(
            WorkspaceAdministrationReadback workspace,
            String action,
            long occurredAt,
            AuditActor actor,
            long legacyId,
            String changesJson) {
        persistence.insertAudit(
                UUID.randomUUID(),
                workspace,
                legacyId,
                action,
                actor,
                occurredAt,
                AuditChangeJson.write(AuditChangeJson.read(changesJson)));
    }

    private static String updateChanges(
            WorkspaceAdministrationReadback before, WorkspaceAdministrationReadback after, String logoIntent) {
        List<String> changes = new ArrayList<>();
        if (!Objects.equals(before.name(), after.name())) changes.add(change("name", before.name(), after.name()));
        if (!Objects.equals(before.operationsTitle(), after.operationsTitle()))
            changes.add(change("operationsTitle", before.operationsTitle(), after.operationsTitle()));
        if (!Objects.equals(before.notes(), after.notes())) changes.add(change("notes", before.notes(), after.notes()));
        if (!Objects.equals(before.logoAssetRef(), after.logoAssetRef()))
            changes.add(change(
                    "logo",
                    before.logoAssetRef() == null ? "未配置" : "已配置",
                    after.logoAssetRef() == null ? "未配置" : "已配置"));
        if (changes.isEmpty() && "KEEP".equals(logoIntent)) return "[]";
        return "[" + String.join(",", changes) + "]";
    }

    private static String change(String field, String before, String after) {
        return "{\"fieldKey\":\"" + field + "\",\"before\":" + nullableJson(before) + ",\"after\":"
                + nullableJson(after) + "}";
    }

    private static String nullableJson(String value) {
        return value == null ? "null" : "\"" + json(value) + "\"";
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private static UUID keepOrRemoveLogo(UUID value, UUID stagedAssetRef, String bindGrant, boolean keep) {
        if (stagedAssetRef != null || (bindGrant != null && !bindGrant.isBlank()))
            throw new WorkspaceInputInvalidException();
        return keep ? value : null;
    }

    private static String requiredKey(String value) {
        if (!GroupWorkspaceKey.isValid(value)) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String requiredName(String value) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > 200)
            throw new WorkspaceInputInvalidException();
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static String requiredTitle(String value, String name) {
        String result = value == null || value.isBlank() ? name : value.trim();
        if (result.length() > 120) throw new WorkspaceInputInvalidException();
        return result;
    }

    private static UUID requiredLogo(UUID value) {
        if (value == null) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String requiredGrant(String value) {
        if (value == null || value.length() < 32 || value.length() > 256) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String optionalNotes(String value) {
        if (value != null && value.length() > 500) throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String requiredLogoIntent(String value) {
        if (!"KEEP".equals(value) && !"REPLACE".equals(value) && !"REMOVE".equals(value))
            throw new WorkspaceInputInvalidException();
        return value;
    }

    private static String canonical(String operation, String... values) {
        StringBuilder result = new StringBuilder(operation);
        for (String value : values) {
            String safe = value == null ? "<null>" : value;
            result.append('|').append(safe.length()).append(':').append(safe);
        }
        return result.toString();
    }

    public static final class WorkspaceConflictException extends RuntimeException {
        public WorkspaceConflictException() {}

        public WorkspaceConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class WorkspaceNotFoundException extends RuntimeException {}

    public static final class WorkspaceDisabledException extends RuntimeException {}

    public static final class WorkspaceVersionConflictException extends RuntimeException {}

    public static final class WorkspaceStatusInvalidException extends RuntimeException {}

    public static final class WorkspaceInputInvalidException extends RuntimeException {}
}
