package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.WorkspaceRolePersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceRoleService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String SORT_DIRECTION_ASC = "ASC";
    private static final String SORT_DIRECTION_DESC = "DESC";
    private static final AuditChangePolicy ROLE_CREATED = new AuditChangePolicy(
            "WORKSPACE_ROLE",
            "WORKSPACE_ROLE_CREATED",
            Set.of("name", "description", "status", "pageAccessKeys", "capabilityKeys"));
    private static final AuditChangePolicy ROLE_REPLACED = new AuditChangePolicy(
            "WORKSPACE_ROLE",
            "ROLE_PERMISSIONS_REPLACED",
            Set.of("name", "description", "status", "pageAccessKeys", "capabilityKeys"));
    private static final AuditChangePolicy ROLE_STATUS_CHANGED =
            new AuditChangePolicy("WORKSPACE_ROLE", "WORKSPACE_ROLE_STATUS_CHANGED", Set.of("status"));
    private static final Map<String, Set<String>> PAGE_CATALOG =
            WorkspaceAuthorizationCatalog.managedPageCatalog().stream()
                    .collect(java.util.stream.Collectors.toUnmodifiableMap(
                            WorkspaceAuthorizationCatalog.PageAccessCatalogEntry::pageDesignKey,
                            entry -> Set.copyOf(entry.eligibleOrganizationTypes())));
    private static final Map<String, Set<String>> ACTION_CATALOG =
            WorkspaceAuthorizationCatalog.capabilityCatalog().stream()
                    .collect(java.util.stream.Collectors.toUnmodifiableMap(
                            WorkspaceAuthorizationCatalog.CapabilityCatalogEntry::key,
                            entry -> Set.copyOf(entry.organizationTypes())));
    private static final Set<String> SERVICE_NODE_TYPES = Set.of(
            ServiceNodeTypes.GROUP,
            ServiceNodeTypes.REGION,
            ServiceNodeTypes.PROJECT,
            ServiceNodeTypes.HEAD_COMPANY,
            ServiceNodeTypes.STORE);
    private final WorkspaceRolePersistence persistence;
    private final TimeProvider time;
    private final WorkspaceIamCommandReceiptService receipts;
    private final PlatformGovernanceAuthorization platformAuthorization;

    public WorkspaceRoleService(JdbcTemplate jdbc, TimeProvider time) {
        this(new WorkspaceRolePersistence(jdbc), time, new WorkspaceIamCommandReceiptService(jdbc, time), null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceRoleService(
            WorkspaceRolePersistence persistence,
            TimeProvider time,
            WorkspaceIamCommandReceiptService receipts,
            PlatformGovernanceAuthorization platformAuthorization) {
        this.persistence = persistence;
        this.time = time;
        this.receipts = receipts;
        this.platformAuthorization = platformAuthorization;
    }

    @Transactional
    public WorkspaceRoleReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String serviceNodeType,
            String description,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys) {
        return create(
                workspaceUuid,
                groupWorkspaceKey,
                name,
                serviceNodeType,
                description,
                pageAccessKeys,
                actionCapabilityKeys,
                AuditActor.system());
    }

    @Transactional
    public WorkspaceRoleReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String serviceNodeType,
            String description,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys,
            AuditActor actor) {
        String type = requiredNodeType(serviceNodeType);
        validateCatalogs(type, pageAccessKeys, actionCapabilityKeys);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        try {
            persistence.insert(
                    id,
                    workspaceUuid,
                    groupWorkspaceKey,
                    requiredName(name),
                    type,
                    optional(description),
                    now,
                    now,
                    json(pageAccessKeys),
                    json(actionCapabilityKeys));
        } catch (DuplicateKeyException duplicate) {
            throw new RoleConflictException(duplicate);
        }
        WorkspaceRoleReadback created = require(workspaceUuid, groupWorkspaceKey, id);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "WORKSPACE_ROLE_CREATED",
                actor,
                ROLE_CREATED,
                createdChanges(created));
        return created;
    }

    @Transactional
    public WorkspaceRoleReadback createForPlatform(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String serviceNodeType,
            String description,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys,
            String idempotencyKey,
            AuditActor actor) {
        requirePlatformActor(actor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "platform-role-create",
                        groupWorkspaceKey,
                        null,
                        name,
                        serviceNodeType,
                        description,
                        pageAccessKeys,
                        actionCapabilityKeys,
                        null),
                WorkspaceRoleReadback.class,
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        name,
                        serviceNodeType,
                        description,
                        pageAccessKeys,
                        actionCapabilityKeys,
                        actor));
    }

    /** Page entry and mutation rights are intentionally independent and replaced in one transaction. */
    @Transactional
    public WorkspaceRoleReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            long expectedVersion,
            String name,
            String description,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys) {
        return update(
                workspaceUuid,
                groupWorkspaceKey,
                roleId,
                expectedVersion,
                name,
                description,
                pageAccessKeys,
                actionCapabilityKeys,
                AuditActor.system());
    }

    @Transactional
    public WorkspaceRoleReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            long expectedVersion,
            String name,
            String description,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys,
            AuditActor actor) {
        WorkspaceRoleReadback current = require(workspaceUuid, groupWorkspaceKey, roleId);
        requireMutable(current.status());
        validateCatalogs(current.serviceNodeType(), pageAccessKeys, actionCapabilityKeys);
        if (persistence.update(
                        requiredName(name),
                        optional(description),
                        json(pageAccessKeys),
                        json(actionCapabilityKeys),
                        time.currentEpochMillis(),
                        roleId,
                        workspaceUuid,
                        groupWorkspaceKey,
                        expectedVersion)
                != 1) throw new RoleConflictException();
        WorkspaceRoleReadback updated = require(workspaceUuid, groupWorkspaceKey, roleId);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                roleId,
                "ROLE_PERMISSIONS_REPLACED",
                actor,
                ROLE_REPLACED,
                changed(current, updated));
        return updated;
    }

    @Transactional
    public WorkspaceRoleReadback updateForPlatform(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            long expectedVersion,
            String name,
            String description,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys,
            String idempotencyKey,
            AuditActor actor) {
        requirePlatformActor(actor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "platform-role-update",
                        groupWorkspaceKey,
                        roleId,
                        name,
                        description,
                        pageAccessKeys,
                        actionCapabilityKeys,
                        expectedVersion),
                WorkspaceRoleReadback.class,
                () -> update(
                        workspaceUuid,
                        groupWorkspaceKey,
                        roleId,
                        expectedVersion,
                        name,
                        description,
                        pageAccessKeys,
                        actionCapabilityKeys,
                        actor));
    }

    /** Compatibility owner API for the dedicated authorization-replacement contract. */
    @Transactional
    public WorkspaceRoleReadback replacePermissions(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            long expectedVersion,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys) {
        WorkspaceRoleReadback current = require(workspaceUuid, groupWorkspaceKey, roleId);
        return update(
                workspaceUuid,
                groupWorkspaceKey,
                roleId,
                expectedVersion,
                current.name(),
                current.description(),
                pageAccessKeys,
                actionCapabilityKeys);
    }

    @Transactional
    public WorkspaceRoleReadback transitionStatus(
            UUID workspaceUuid, String groupWorkspaceKey, UUID roleId, String status, long expectedVersion) {
        return transitionStatus(workspaceUuid, groupWorkspaceKey, roleId, status, expectedVersion, AuditActor.system());
    }

    @Transactional
    public WorkspaceRoleReadback transitionStatus(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            String status,
            long expectedVersion,
            AuditActor actor) {
        String beforeStatus = currentStatus(workspaceUuid, groupWorkspaceKey, roleId);
        if (!Set.of("ENABLED", "DISABLED", "VOIDED").contains(status)
                || "VOIDED".equals(beforeStatus)
                || persistence.transitionStatus(
                                status,
                                time.currentEpochMillis(),
                                roleId,
                                workspaceUuid,
                                groupWorkspaceKey,
                                expectedVersion)
                        != 1) throw new RoleConflictException();
        WorkspaceRoleReadback updated = require(workspaceUuid, groupWorkspaceKey, roleId);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                roleId,
                "WORKSPACE_ROLE_STATUS_CHANGED",
                actor,
                ROLE_STATUS_CHANGED,
                List.of(new AuditChange("status", beforeStatus, updated.status())));
        return updated;
    }

    @Transactional
    public WorkspaceRoleReadback transitionStatusForPlatform(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID roleId,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        requirePlatformActor(actor);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("platform-role-status", groupWorkspaceKey, roleId, status, expectedVersion),
                WorkspaceRoleReadback.class,
                () -> transitionStatus(workspaceUuid, groupWorkspaceKey, roleId, status, expectedVersion, actor));
    }

    /** Owner-bounded platform role search; the edge never materializes or slices this list. */
    @Transactional(readOnly = true)
    public Page page(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String organizationType,
            String status,
            int page,
            int pageSize,
            String sort,
            String direction) {
        return queryPage(
                workspaceUuid, groupWorkspaceKey, name, organizationType, status, page, pageSize, sort, direction);
    }

    /** Explicit platform GET page boundary with one owner-local statement, including an empty page's total. */
    @Transactional(readOnly = true)
    public Page platformTaskPage(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String organizationType,
            String status,
            int page,
            int pageSize,
            String sort,
            String direction) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> queryPage(
                        workspaceUuid,
                        groupWorkspaceKey,
                        name,
                        organizationType,
                        status,
                        page,
                        pageSize,
                        sort,
                        direction));
    }

    private Page queryPage(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String organizationType,
            String status,
            int page,
            int pageSize,
            String sort,
            String direction) {
        if (page < 1
                || pageSize < 1
                || pageSize > 100
                || (organizationType != null && !SERVICE_NODE_TYPES.contains(organizationType))
                || (status != null && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status)))
            throw new RoleValidationException();
        String effectiveSort = sort == null ? "NAME" : sort;
        String effectiveDirection = direction == null ? SORT_DIRECTION_ASC : direction;
        if (!Set.of("NAME", "UPDATED_AT").contains(effectiveSort)
                || !Set.of(SORT_DIRECTION_ASC, SORT_DIRECTION_DESC).contains(effectiveDirection))
            throw new RoleValidationException();
        WorkspaceRolePersistence.PageRows rows = persistence.page(
                workspaceUuid,
                groupWorkspaceKey,
                name,
                organizationType,
                status,
                page,
                pageSize,
                effectiveSort,
                effectiveDirection);
        List<WorkspaceRoleReadback> items = rows.items().stream().map(WorkspaceRoleService::readback).toList();
        return new Page(List.copyOf(items), page, pageSize, rows.total(), effectiveSort, effectiveDirection);
    }

    @Transactional(readOnly = true)
    public WorkspaceRoleReadback require(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId) {
        return queryRole(workspaceUuid, groupWorkspaceKey, roleId);
    }

    /** Explicit platform GET boundary; role commands retain their existing owner-local reads. */
    @Transactional(readOnly = true)
    public WorkspaceRoleReadback platformTaskDetail(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY, () -> queryRole(workspaceUuid, groupWorkspaceKey, roleId));
    }

    private WorkspaceRoleReadback queryRole(UUID workspaceUuid, String groupWorkspaceKey, UUID roleId) {
        WorkspaceRolePersistence.RoleRow row = persistence.role(workspaceUuid, groupWorkspaceKey, roleId);
        if (row == null) throw new RoleNotFoundException();
        return readback(row);
    }

    /** Bounded owner read used by session composition; JSON is parsed here, never expanded by PostgreSQL per role. */
    @Transactional(readOnly = true)
    public Map<UUID, WorkspaceRoleReadback> requireAll(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) return Map.of();
        LinkedHashSet<UUID> requested = new LinkedHashSet<>(roleIds);
        if (requested.contains(null)) throw new RoleNotFoundException();
        List<UUID> ids = new ArrayList<>(requested);
        List<WorkspaceRoleReadback> values = persistence.roles(workspaceUuid, groupWorkspaceKey, ids).stream()
                .map(WorkspaceRoleService::readback)
                .toList();
        if (values.size() != ids.size()) throw new RoleNotFoundException();
        Map<UUID, WorkspaceRoleReadback> result = new LinkedHashMap<>();
        values.forEach(value -> result.put(value.id(), value));
        return Map.copyOf(result);
    }

    private static WorkspaceRoleReadback readback(WorkspaceRolePersistence.RoleRow row) {
        Set<String> pages = jsonSet(row.pageAccessKeysJson());
        Set<String> actions = jsonSet(row.actionCapabilityKeysJson());
        String nodeType = row.serviceNodeType();
        assertStoredCatalog(nodeType, pages, actions);
        return new WorkspaceRoleReadback(
                row.id(),
                row.workspaceUuid(),
                row.groupWorkspaceKey(),
                row.name(),
                row.description(),
                nodeType,
                row.status(),
                row.version(),
                row.createdAt(),
                row.updatedAt(),
                pages,
                actions);
    }

    private static Set<String> jsonSet(String value) {
        try {
            return Set.copyOf(JSON.readValue(value, new TypeReference<List<String>>() {}));
        } catch (JsonProcessingException failure) {
            throw new RoleCapabilityCatalogDriftException(failure);
        }
    }

    private void audit(
            UUID workspaceUuid,
            String key,
            UUID roleId,
            String action,
            AuditActor actor,
            AuditChangePolicy policy,
            List<AuditChange> changes) {
        persistence.appendAudit(
                UUID.randomUUID(),
                workspaceUuid,
                key,
                roleId,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                time.currentEpochMillis(),
                jsonChanges(policy.allow(changes)));
    }

    private static List<AuditChange> createdChanges(WorkspaceRoleReadback role) {
        return List.of(
                new AuditChange("name", null, role.name()),
                new AuditChange("description", null, role.description()),
                new AuditChange("status", null, role.status()),
                new AuditChange("pageAccessKeys", null, keys(role.pageAccessKeys())),
                new AuditChange("capabilityKeys", null, keys(role.actionCapabilityKeys())));
    }

    private static List<AuditChange> changed(WorkspaceRoleReadback before, WorkspaceRoleReadback after) {
        return List.of(
                        new AuditChange("name", before.name(), after.name()),
                        new AuditChange("description", before.description(), after.description()),
                        new AuditChange("pageAccessKeys", keys(before.pageAccessKeys()), keys(after.pageAccessKeys())),
                        new AuditChange(
                                "capabilityKeys",
                                keys(before.actionCapabilityKeys()),
                                keys(after.actionCapabilityKeys())))
                .stream()
                .filter(change -> !java.util.Objects.equals(change.beforeValue(), change.afterValue()))
                .toList();
    }

    private String currentStatus(UUID workspaceUuid, String key, UUID roleId) {
        return require(workspaceUuid, key, roleId).status();
    }

    private static String keys(Set<String> values) {
        return String.join(",", values.stream().sorted().toList());
    }

    private static String jsonChanges(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private void requirePlatformActor(AuditActor actor) {
        if (platformAuthorization == null) throw new IllegalStateException("platform authorization is required");
        platformAuthorization.requireEnabledPlatformAdministrator(actor);
    }

    private static String canonical(String operation, String key, UUID roleId, Object... values) {
        StringBuilder request =
                new StringBuilder(operation).append('|').append(key).append('|').append(roleId);
        for (Object value : values)
            request.append('|')
                    .append(
                            value instanceof Set<?> set
                                    ? set.stream().map(String::valueOf).sorted().toList()
                                    : value);
        return request.toString();
    }

    private static void validateCatalogs(String nodeType, Set<String> pages, Set<String> actions) {
        if (pages == null
                || actions == null
                || pages.stream()
                        .anyMatch(page -> !PAGE_CATALOG.containsKey(page)
                                || !PAGE_CATALOG.get(page).contains(nodeType)))
            throw new PageAccessCatalogMismatchException();
        if (actions.stream().anyMatch(action -> !ACTION_CATALOG.containsKey(action)))
            throw new RoleCapabilityUnknownException();
        if (actions.stream().anyMatch(action -> !ACTION_CATALOG.get(action).contains(nodeType)))
            throw new RoleCapabilityIncompatibleException();
    }

    private static void assertStoredCatalog(String nodeType, Set<String> pages, Set<String> actions) {
        if (pages.stream()
                        .anyMatch(page -> !PAGE_CATALOG.containsKey(page)
                                || !PAGE_CATALOG.get(page).contains(nodeType))
                || actions.stream()
                        .anyMatch(action -> !ACTION_CATALOG.containsKey(action)
                                || !ACTION_CATALOG.get(action).contains(nodeType)))
            throw new RoleCapabilityCatalogDriftException();
    }

    private static String requiredNodeType(String value) {
        String normalized = value == null ? "" : value.toUpperCase(Locale.ROOT);
        if (!SERVICE_NODE_TYPES.contains(normalized)) throw new RoleValidationException();
        return normalized;
    }

    private static void requireMutable(String status) {
        if ("VOIDED".equals(status)) throw new RoleConflictException();
    }

    private static String requiredName(String value) {
        if (value == null || value.isBlank() || value.trim().length() > 120) throw new RoleValidationException();
        return value.trim();
    }

    private static String optional(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().length() > 500) throw new RoleValidationException();
        return value.trim();
    }

    private static String json(Set<String> values) {
        try {
            return JSON.writeValueAsString(values.stream().sorted().toList());
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException(failure);
        }
    }

    public static final class RoleNotFoundException extends RuntimeException {}

    public static final class RoleConflictException extends RuntimeException {
        public RoleConflictException() {}

        public RoleConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static class RoleValidationException extends RuntimeException {}

    public static final class WorkspaceDisabledException extends RuntimeException {}

    public static final class RoleCapabilityUnknownException extends RoleValidationException {}

    public static final class RoleCapabilityIncompatibleException extends RoleValidationException {}

    public static final class PageAccessCatalogMismatchException extends RoleValidationException {}

    public static final class RoleCapabilityCatalogDriftException extends RuntimeException {
        public RoleCapabilityCatalogDriftException() {}

        public RoleCapabilityCatalogDriftException(Throwable cause) {
            super(cause);
        }
    }

    public record Page(
            List<WorkspaceRoleReadback> items, int page, int pageSize, long total, String sort, String direction) {}
}
