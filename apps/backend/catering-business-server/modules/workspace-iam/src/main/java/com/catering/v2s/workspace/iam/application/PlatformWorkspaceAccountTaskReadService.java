package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.PlatformWorkspaceAccountTaskReadPersistence;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.workspace.iam.api.WorkspaceAccountReadback;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform account reads use exactly two explicit owner stages: one workspace-IAM projection and one organization batch
 * that decorates persisted assignment references with display paths.
 */
@Service
public class PlatformWorkspaceAccountTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> SORTS = Set.of("DISPLAY_NAME", "LOGIN_NAME", "LAST_LOGIN_AT", "UPDATED_AT");
    private final PlatformWorkspaceAccountTaskReadPersistence persistence;
    private final OrganizationTaskPathLookup paths;
    private final WorkspaceAccountService accounts;

    @org.springframework.beans.factory.annotation.Autowired
    public PlatformWorkspaceAccountTaskReadService(
            PlatformWorkspaceAccountTaskReadPersistence persistence,
            OrganizationTaskPathLookup paths,
            WorkspaceAccountService accounts) {
        this.persistence = persistence;
        this.paths = paths;
        this.accounts = accounts;
    }

    public PlatformWorkspaceAccountTaskReadService(
            JdbcTemplate jdbc, OrganizationTaskPathLookup paths, WorkspaceAccountService accounts) {
        this(new PlatformWorkspaceAccountTaskReadPersistence(jdbc), paths, accounts);
    }

    @Transactional(readOnly = true)
    public WorkspaceUserService.AccountPage page(WorkspaceUserService.AccountPageQuery query) {
        WorkspaceUserService.AccountPageQuery safe = platform(query);
        String sort = sort(safe.sort());
        String direction = direction(safe.direction());
        List<PlatformWorkspaceAccountTaskReadPersistence.Row> rows =
                primary(() -> persistence.page(safe, sort, direction));
        long total = rows.isEmpty() ? 0 : rows.getFirst().total();
        return new WorkspaceUserService.AccountPage(
                users(safe.workspaceUuid(), safe.groupWorkspaceKey(), rows),
                safe.page(),
                safe.pageSize(),
                total,
                null,
                null,
                null,
                null,
                sort,
                direction);
    }

    @Transactional(readOnly = true)
    public WorkspaceUserService.User detail(WorkspaceUserService.AccountDetailQuery query) {
        WorkspaceUserService.AccountDetailQuery safe = platform(query);
        List<PlatformWorkspaceAccountTaskReadPersistence.Row> rows = primary(() -> persistence.detail(safe));
        if (rows.isEmpty()) throw new WorkspaceAccountService.AccountNotFoundException();
        return users(safe.workspaceUuid(), safe.groupWorkspaceKey(), rows).getFirst();
    }

    /** Keeps the owner command and complete platform account readback in one REQUIRED transaction. */
    @Transactional
    public WorkspaceUserService.User transitionStatusAndReadback(
            UUID workspaceUuid,
            String key,
            UUID accountId,
            String status,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        WorkspaceAccountReadback changed = accounts.transitionStatusForPlatform(
                workspaceUuid, key, accountId, status, expectedVersion, idempotencyKey, actor);
        return detail(WorkspaceUserService.AccountDetailQuery.forPlatform(
                changed.workspaceUuid(), changed.groupWorkspaceKey(), changed.id()));
    }

    private List<WorkspaceUserService.User> users(
            UUID workspaceUuid,
            String key,
            List<PlatformWorkspaceAccountTaskReadPersistence.Row> rows) {
        List<PlatformWorkspaceAccountTaskReadPersistence.Row> actual = rows.stream()
                .filter(value -> value.id() != null)
                .toList();
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>();
        for (PlatformWorkspaceAccountTaskReadPersistence.Row row : actual)
            for (RawAssignment assignment : assignments(row))
                refs.add(new OrganizationTaskPathLookup.TaskPathRef(
                        assignment.serviceNodeType(), assignment.serviceNodeId()));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> resolved = refs.isEmpty()
                ? Map.of()
                : primary(() -> paths.describePersistedTaskPaths(workspaceUuid, key, List.copyOf(refs)));
        List<WorkspaceUserService.User> result = new ArrayList<>();
        for (PlatformWorkspaceAccountTaskReadPersistence.Row row : actual) {
            List<WorkspaceUserService.Assignment> assignments = assignments(row).stream()
                    .map(value -> assignment(row.id(), value, resolved))
                    .toList();
            result.add(new WorkspaceUserService.User(
                    row.id(),
                    row.displayName(),
                    row.mobile(),
                    mask(row.mobile()),
                    row.loginName(),
                    row.status(),
                    row.passwordChangeRequired() ? "CHANGE_REQUIRED" : "SET",
                    (int) assignments.stream()
                            .filter(value -> "ACTIVE".equals(value.status()))
                            .count(),
                    assignments,
                    invitations(row),
                    row.lastLoginAt(),
                    history(row),
                    row.createdAt(),
                    row.updatedAt(),
                    row.version()));
        }
        return List.copyOf(result);
    }

    private static WorkspaceUserService.Assignment assignment(
            UUID accountId,
            RawAssignment value,
            Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        OrganizationTaskPathLookup.TaskPath path =
                paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId()));
        if (path == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return new WorkspaceUserService.Assignment(
                value.id(),
                accountId,
                value.roleId(),
                value.roleName(),
                value.serviceNodeType(),
                path.nodes(),
                value.status(),
                value.sourceInvitationId() == null ? "ADMINISTRATION" : "INVITATION",
                value.version(),
                value.createdAt(),
                value.updatedAt(),
                value.serviceNodeId());
    }

    private static WorkspaceUserService.AccountPageQuery platform(WorkspaceUserService.AccountPageQuery query) {
        if (query == null
                || query.operationsSession() != null
                || query.workspaceUuid() == null
                || query.groupWorkspaceKey() == null
                || query.groupWorkspaceKey().isBlank()
                || query.page() < 1
                || query.pageSize() < 1
                || (query.status() != null
                        && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(query.status())))
            throw new WorkspaceAccountService.AccountNotFoundException();
        if (query.pageSize() > 100) throw new WorkspaceUserService.PageValidationException();
        return query;
    }

    private static WorkspaceUserService.AccountDetailQuery platform(WorkspaceUserService.AccountDetailQuery query) {
        if (query == null
                || query.operationsSession() != null
                || query.workspaceUuid() == null
                || query.groupWorkspaceKey() == null
                || query.groupWorkspaceKey().isBlank()
                || query.accountId() == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return query;
    }

    private static String sort(String value) {
        String safe = value == null ? "LOGIN_NAME" : value;
        if (!SORTS.contains(safe)) throw new WorkspaceAccountService.AccountNotFoundException();
        return safe;
    }

    private static String direction(String value) {
        String safe = value == null ? "ASC" : value;
        if (!Set.of("ASC", "DESC").contains(safe))
            throw new WorkspaceAccountService.AccountNotFoundException();
        return safe;
    }

    private static List<RawAssignment> assignments(PlatformWorkspaceAccountTaskReadPersistence.Row row) {
        return array(row.assignments()).stream()
                .map(value -> new RawAssignment(
                        uuid(value, "id"),
                        uuid(value, "roleId"),
                        value.path("roleName").asText(),
                        value.path("type").asText(),
                        uuid(value, "ref"),
                        value.path("status").asText(),
                        value.path("source").isNull() ? null : uuid(value, "source"),
                        value.path("version").asLong(),
                        value.path("created").asLong(),
                        value.path("updated").asLong()))
                .toList();
    }

    private static List<WorkspaceUserService.Invitation> invitations(PlatformWorkspaceAccountTaskReadPersistence.Row row) {
        return array(row.invitations()).stream()
                .map(value -> new WorkspaceUserService.Invitation(
                        uuid(value, "id"),
                        invitationStatus(value.path("status").asText()),
                        Math.toIntExact(value.path("version").asLong()),
                        value.path("expires").asLong()))
                .toList();
    }

    private static List<WorkspaceUserService.AuthenticationHistory> history(PlatformWorkspaceAccountTaskReadPersistence.Row row) {
        return array(row.history()).stream()
                .map(value -> new WorkspaceUserService.AuthenticationHistory(
                        uuid(value, "id"), value.path("authenticatedAt").asLong()))
                .toList();
    }

    private static UUID uuid(JsonNode value, String field) {
        return UUID.fromString(value.path(field).asText());
    }

    private static List<JsonNode> array(String source) {
        try {
            JsonNode root = JSON.readTree(source);
            List<JsonNode> values = new ArrayList<>();
            root.forEach(values::add);
            return List.copyOf(values);
        } catch (Exception error) {
            throw new WorkspaceAccountService.AccountNotFoundException(error);
        }
    }

    private static String invitationStatus(String status) {
        return switch (status) {
            case "CANCELLED" -> "CANCELLED";
            case "COMPLETED" -> "COMPLETED";
            case "EXPIRED" -> "EXPIRED";
            default -> "ACTIVE";
        };
    }

    private static String mask(String value) {
        return value.length() <= 4
                ? "****"
                : value.substring(0, Math.min(3, value.length())) + "****"
                        + value.substring(Math.max(3, value.length() - 4));
    }

    private static <T> T primary(java.util.function.Supplier<T> action) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, action);
    }

    private record RawAssignment(
            UUID id,
            UUID roleId,
            String roleName,
            String serviceNodeType,
            UUID serviceNodeId,
            String status,
            UUID sourceInvitationId,
            long version,
            long createdAt,
            long updatedAt) {}
}
