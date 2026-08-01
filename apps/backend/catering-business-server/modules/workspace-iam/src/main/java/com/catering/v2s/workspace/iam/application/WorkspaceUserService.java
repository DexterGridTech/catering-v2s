package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Explicit workspace-IAM task read for the five operations user pages. */
@Service
public class WorkspaceUserService {
    private final JdbcTemplate jdbc; private final OrganizationNodeLookup nodes; private final OrganizationEntityLookup entities; private final WorkspaceRoleService roles; private final CommercialGroupLookup groups;
    private final OrganizationAssignmentCandidateLookup candidates;
    private final WorkspaceAssignmentScopeLookup assignments;
    private final OrganizationTaskPathLookup taskPaths;
    public WorkspaceUserService(JdbcTemplate jdbc, OrganizationNodeLookup nodes, OrganizationEntityLookup entities, WorkspaceRoleService roles) { this(jdbc, nodes, entities, roles, legacyGroups(nodes), (workspaceUuid, groupWorkspaceKey, serviceNodeType) -> List.of(), null, null); }
    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceUserService(JdbcTemplate jdbc, OrganizationNodeLookup nodes, OrganizationEntityLookup entities, WorkspaceRoleService roles, CommercialGroupLookup groups, OrganizationAssignmentCandidateLookup candidates, WorkspaceAssignmentScopeLookup assignments, OrganizationTaskPathLookup taskPaths) { this.jdbc = jdbc; this.nodes = nodes; this.entities = entities; this.roles = roles; this.groups = groups; this.candidates = candidates; this.assignments = assignments; this.taskPaths = taskPaths; }

    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveCurrentTaskScope(WorkspaceSessionReadback session) {
        if (session == null || session.currentAssignmentId() == null || assignments == null || taskPaths == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignments.requireActiveScope(session.workspaceUuid(), session.groupWorkspaceKey(), session.currentAssignmentId());
        OrganizationTaskPathLookup.TaskPath target = taskPaths.requireTaskPath(session.workspaceUuid(), session.groupWorkspaceKey(), assignment.serviceNodeType(), assignment.serviceNodeId());
        if (!taskPaths.isScopeAllowed(session.workspaceUuid(), session.groupWorkspaceKey(), assignment.serviceNodeType(), assignment.serviceNodeId(), target)) throw new WorkspaceAuthenticationService.SessionInvalidException();
        return target;
    }

    /**
     * An optional client scope selects an instance of the endpoint's already-fixed target
     * type.  It never selects the target type or authority.
     */
    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveTaskScope(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef) {
        if (session == null || session.currentAssignmentId() == null || assignments == null || taskPaths == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignments.requireActiveScope(session.workspaceUuid(), session.groupWorkspaceKey(), session.currentAssignmentId());
        UUID effectiveScopeRef = requestedScopeRef == null ? session.visibleDataNodeId() : requestedScopeRef;
        if ("GROUP".equals(assignment.serviceNodeType()) && "HEAD_COMPANY".equals(expectedTargetType)) {
            // HEAD_COMPANY user management is a fixed-target, no-data-scope page for a
            // group operator. Ignore any stale client scope and resolve the aggregate
            // from the server-owned group assignment instead.
            return taskPaths.requireTaskPath(session.workspaceUuid(), session.groupWorkspaceKey(), "GROUP", assignment.serviceNodeId());
        }
        if (effectiveScopeRef == null && expectedTargetType != null && expectedTargetType.equals(assignment.serviceNodeType())) {
            effectiveScopeRef = assignment.serviceNodeId();
        }
        if (expectedTargetType == null || effectiveScopeRef == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        OrganizationTaskPathLookup.TaskPath requested = taskPaths.requireTaskPath(session.workspaceUuid(), session.groupWorkspaceKey(), expectedTargetType, effectiveScopeRef);
        if (!taskPaths.isScopeAllowed(session.workspaceUuid(), session.groupWorkspaceKey(), assignment.serviceNodeType(), assignment.serviceNodeId(), requested)) throw new WorkspaceAuthenticationService.SessionInvalidException();
        return requested;
    }

    /** Legacy internal compatibility only; operations endpoints must pass their fixed type. */
    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveTaskScope(WorkspaceSessionReadback session, UUID requestedScopeRef) {
        if (session == null || session.currentAssignmentId() == null || assignments == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        String assignmentType = assignments.requireActiveScope(session.workspaceUuid(), session.groupWorkspaceKey(), session.currentAssignmentId()).serviceNodeType();
        return resolveTaskScope(session, assignmentType, requestedScopeRef);
    }

    /** Verifies a persisted target against the server-derived active (or narrowed) task scope. */
    @Transactional(readOnly = true)
    public boolean isTargetWithinTaskScope(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, String targetType, UUID targetId) {
        if (!java.util.Objects.equals(expectedTargetType, targetType) || targetId == null || taskPaths == null) return false;
        return isTargetWithinScope(session.workspaceUuid(), session.groupWorkspaceKey(), resolveTaskScope(session, expectedTargetType, requestedScopeRef), targetType, targetId);
    }

    /** Filters a bounded set of persisted targets through one server-derived scope and one owner batch read. */
    @Transactional(readOnly = true)
    public Set<OrganizationTaskPathLookup.TaskPathRef> targetsWithinTaskScope(
        WorkspaceSessionReadback session,
        String expectedTargetType,
        UUID requestedScopeRef,
        List<OrganizationTaskPathLookup.TaskPathRef> targets
    ) {
        if (taskPaths == null || targets == null) return Set.of();
        OrganizationTaskPathLookup.TaskPath scope = resolveTaskScope(session, expectedTargetType, requestedScopeRef);
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> requested = new LinkedHashSet<>();
        for (OrganizationTaskPathLookup.TaskPathRef target : targets) {
            if (target != null && expectedTargetType.equals(target.targetType()) && target.targetId() != null) requested.add(target);
        }
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = taskPaths.requireTaskPaths(
            session.workspaceUuid(), session.groupWorkspaceKey(), List.copyOf(requested)
        );
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> allowed = new LinkedHashSet<>();
        for (OrganizationTaskPathLookup.TaskPathRef target : requested) {
            if (isWithinScope(scope, paths.get(target))) allowed.add(target);
        }
        return Set.copyOf(allowed);
    }

    @Transactional(readOnly = true)
    public CandidatePage candidatesForOperations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, String subjectType, String queryText, Integer page, Integer pageSize, UUID selectedOrganizationRef) {
        OrganizationTaskPathLookup.TaskPath scope = resolveTaskScope(session, expectedTargetType, requestedScopeRef);
        int safePage = Math.max(1, page == null ? 1 : page);
        int safeSize = Math.min(100, Math.max(1, pageSize == null ? 20 : pageSize));
        String normalizedQuery = blankToNull(queryText);
        return switch (subjectType) {
            case "ORGANIZATION" -> {
                List<CandidateOrganization> visible = candidates.listEnabled(session.workspaceUuid(), session.groupWorkspaceKey(), expectedTargetType).stream()
                    .map(value -> new CandidateOrganization(value.serviceNodeType(), value.organizationRef(), value.path()))
                    .filter(value -> isTargetWithinScope(session.workspaceUuid(), session.groupWorkspaceKey(), scope, value.serviceNodeType(), value.organizationRef()))
                    .filter(value -> contains(value.path(), normalizedQuery))
                    .sorted(java.util.Comparator.comparing(CandidateOrganization::path).thenComparing(value -> value.organizationRef().toString()))
                    .toList();
                yield new CandidatePage(new CandidateQueryMetadata("ORGANIZATION", normalizedQuery, safePage, safeSize, visible.size(), null), pageSlice(visible, safePage, safeSize), List.of());
            }
            case "ROLE" -> {
                if (selectedOrganizationRef == null || !isTargetWithinScope(session.workspaceUuid(), session.groupWorkspaceKey(), scope, expectedTargetType, selectedOrganizationRef)) {
                    yield new CandidatePage(new CandidateQueryMetadata("ROLE", normalizedQuery, safePage, safeSize, 0, selectedOrganizationRef), List.of(), List.of());
                }
                List<WorkspaceRoleReadback> enabledRoles = roles.list(session.workspaceUuid(), session.groupWorkspaceKey()).stream()
                    .filter(role -> "ENABLED".equals(role.status()) && expectedTargetType.equals(role.serviceNodeType()))
                    .filter(role -> contains(role.name(), normalizedQuery))
                    .sorted(java.util.Comparator.comparing(WorkspaceRoleReadback::name).thenComparing(WorkspaceRoleReadback::id))
                    .toList();
                yield new CandidatePage(new CandidateQueryMetadata("ROLE", normalizedQuery, safePage, safeSize, enabledRoles.size(), selectedOrganizationRef), List.of(), pageSlice(enabledRoles, safePage, safeSize));
            }
            default -> throw new IllegalArgumentException("unsupported invitation candidate subject type");
        };
    }

    @Transactional(readOnly = true)
    public Page pageForOperations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, String userName, String mobile, String roleQuery, String status, int page, int pageSize) {
        OrganizationTaskPathLookup.TaskPath scope = resolveTaskScope(session, expectedTargetType, requestedScopeRef);
        int safePage = Math.max(1, page); int safeSize = Math.min(100, Math.max(1, pageSize));
        boolean groupHeadCompanyAggregate = "GROUP".equals(scope.targetType()) && "HEAD_COMPANY".equals(expectedTargetType);
        List<UUID> ids = groupHeadCompanyAggregate
            ? accountIdsForTargetFamily(session.workspaceUuid(), session.groupWorkspaceKey(), expectedTargetType, userName, mobile, roleQuery, status, safePage, safeSize)
            : accountIdsForTarget(session.workspaceUuid(), session.groupWorkspaceKey(), expectedTargetType, scope.targetId(), userName, mobile, roleQuery, status, safePage, safeSize);
        List<User> visible = usersWithinTaskScope(session, scope, expectedTargetType, users(session.workspaceUuid(), session.groupWorkspaceKey(), ids));
        return new Page(
            visible, safePage, safeSize, groupHeadCompanyAggregate
                ? accountTotalForTargetFamily(session.workspaceUuid(), session.groupWorkspaceKey(), expectedTargetType, userName, mobile, roleQuery, status)
                : accountTotalForTarget(session.workspaceUuid(), session.groupWorkspaceKey(), expectedTargetType, scope.targetId(), userName, mobile, roleQuery, status),
            expectedTargetType, groupHeadCompanyAggregate ? null : scope.targetId().toString(), groupHeadCompanyAggregate ? null : scope.displayPath(), session.contextVersion()
        );
    }

    @Transactional(readOnly = true)
    public User userForOperations(WorkspaceSessionReadback session, String expectedTargetType, UUID accountId) {
        List<User> visible = usersWithinTaskScope(session, resolveCurrentTaskScope(session), expectedTargetType, users(session.workspaceUuid(), session.groupWorkspaceKey(), List.of(accountId)));
        if (visible.isEmpty()) throw new WorkspaceAccountService.AccountNotFoundException();
        return visible.getFirst();
    }

    @Transactional(readOnly = true)
    public CandidatePage candidates(UUID workspaceUuid, String key, String onlyNodeType, UUID scopeId) {
        List<CandidateOrganization> all = new java.util.ArrayList<>();
        for (String type : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            if (onlyNodeType == null || onlyNodeType.equals(type)) {
                all.addAll(candidates.listEnabled(workspaceUuid, key, type).stream()
                    .map(value -> new CandidateOrganization(value.serviceNodeType(), value.organizationRef(), value.path()))
                    .toList());
            }
        }
        if (scopeId != null) all = all.stream().filter(value -> scopeId.equals(value.organizationRef())).toList();
        List<WorkspaceRoleReadback> enabledRoles = roles.list(workspaceUuid, key).stream().filter(role -> "ENABLED".equals(role.status()) && (onlyNodeType == null || onlyNodeType.equals(role.serviceNodeType()))).toList();
        return new CandidatePage(new CandidateQueryMetadata("ORGANIZATION", null, 1, Math.max(1, all.size()), all.size(), scopeId), all, enabledRoles);
    }

    @Transactional(readOnly = true)
    public Page page(UUID workspaceUuid, String key, String nodeType, UUID scopeId, int page, int pageSize, long contextVersion) {
        int safePage = Math.max(1, page); int safeSize = Math.min(100, Math.max(1, pageSize));
        String scopePredicate = "(CAST(? AS uuid) IS NULL OR r.service_node_id=?)";
        List<UUID> ids = jdbc.query("SELECT DISTINCT a.id, a.login_name_normalized FROM workspace_iam.workspace_account a JOIN workspace_iam.role_assignment r ON r.account_id=a.id WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND r.service_node_type=? AND " + scopePredicate + " ORDER BY a.login_name_normalized LIMIT ? OFFSET ?", (row, index) -> row.getObject(1, UUID.class), workspaceUuid, key, nodeType, scopeId, scopeId, safeSize, (safePage - 1) * safeSize);
        long total = jdbc.queryForObject("SELECT COUNT(DISTINCT a.id) FROM workspace_iam.workspace_account a JOIN workspace_iam.role_assignment r ON r.account_id=a.id WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND r.service_node_type=? AND " + scopePredicate, Long.class, workspaceUuid, key, nodeType, scopeId, scopeId);
        String scopeName = scopeId == null ? null : taskPath(workspaceUuid, key, new OrganizationTaskPathLookup.TaskPathRef(nodeType, scopeId)).displayPath();
        return new Page(users(workspaceUuid, key, ids), safePage, safeSize, total, nodeType, scopeId == null ? null : scopeId.toString(), scopeName, contextVersion);
    }

    /** Platform account search keeps the same owner predicate for COUNT and the bounded id read. */
    @Transactional(readOnly = true)
    public PlatformPage pageForPlatform(UUID workspaceUuid, String key, String userName, String mobile, String loginName, String roleQuery, String status, int page, int pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100 || (status != null && !Set.of("ENABLED", "DISABLED").contains(status))) throw new WorkspaceAccountService.AccountNotFoundException();
        String where = " WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.login_name_normalized ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.status=?) AND (CAST(? AS text) IS NULL OR role.name ILIKE '%' || ? || '%')";
        Object[] values = new Object[] {workspaceUuid, key, userName, userName, mobile, mobile, loginName, loginName, status, status, roleQuery, roleQuery};
        String joins = " FROM workspace_iam.workspace_account a LEFT JOIN workspace_iam.role_assignment r ON r.account_id=a.id AND r.workspace_uuid=a.workspace_uuid AND r.group_workspace_key=a.group_workspace_key LEFT JOIN workspace_iam.workspace_role role ON role.id=r.role_id";
        long total = jdbc.queryForObject("SELECT COUNT(DISTINCT a.id)" + joins + where, Long.class, values);
        List<Object> pageValues = new ArrayList<>(java.util.Arrays.asList(values)); pageValues.add(pageSize); pageValues.add((page - 1) * pageSize);
        List<UUID> ids = jdbc.query("SELECT DISTINCT a.id, a.login_name_normalized" + joins + where + " ORDER BY a.login_name_normalized, a.id LIMIT ? OFFSET ?", (row, index) -> row.getObject(1, UUID.class), pageValues.toArray());
        return new PlatformPage(users(workspaceUuid, key, ids), page, pageSize, total);
    }

    @Transactional(readOnly = true)
    public User user(UUID workspaceUuid, String key, UUID accountId) {
        List<User> values = users(workspaceUuid, key, List.of(accountId));
        if (values.isEmpty()) throw new WorkspaceAccountService.AccountNotFoundException();
        return values.getFirst();
    }

    /** Loads the page's account bundle in fixed IAM reads; organization facts are one owner batch read. */
    private List<User> users(UUID workspaceUuid, String key, List<UUID> accountIds) {
        LinkedHashSet<UUID> requested = new LinkedHashSet<>(accountIds);
        if (requested.isEmpty()) return List.of();
        Map<UUID, Account> accounts = accounts(workspaceUuid, key, requested);
        if (accounts.size() != requested.size()) throw new WorkspaceAccountService.AccountNotFoundException();
        Map<UUID, List<RawAssignment>> rawAssignments = assignments(workspaceUuid, key, requested);
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = taskPaths(workspaceUuid, key, rawAssignments.values().stream().flatMap(List::stream).map(value -> new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId())).toList());
        Map<String, List<Invitation>> historyByMobile = invitations(workspaceUuid, key, accounts.values().stream().map(Account::mobile).collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        Set<UUID> pendingCredentials = pendingCredentialAccounts(requested);
        List<User> values = new ArrayList<>();
        for (UUID accountId : requested) {
            Account account = accounts.get(accountId);
            List<Assignment> accountAssignments = rawAssignments.getOrDefault(accountId, List.of()).stream().map(value -> assignment(value, paths)).toList();
            values.add(new User(account.id(), account.displayName(), mask(account.mobile()), account.loginName(), account.status(), pendingCredentials.contains(account.id()) ? "RESET_PENDING" : "SET", (int) accountAssignments.stream().filter(value -> "ACTIVE".equals(value.status())).count(), accountAssignments, historyByMobile.getOrDefault(account.mobile(), List.of()), account.createdAt(), account.updatedAt(), account.version()));
        }
        return List.copyOf(values);
    }

    private List<User> usersWithinTaskScope(WorkspaceSessionReadback session, OrganizationTaskPathLookup.TaskPath scope, String expectedTargetType, List<User> users) {
        Map<UUID, List<AssignmentTarget>> invitationTargets = invitationTargets(users.stream().flatMap(user -> user.invitationHistory().stream()).map(Invitation::invitationId).toList());
        List<OrganizationTaskPathLookup.TaskPathRef> targets = new ArrayList<>();
        users.forEach(user -> user.assignments().stream().filter(value -> expectedTargetType.equals(value.serviceNodeType())).forEach(value -> targets.add(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId()))));
        invitationTargets.values().forEach(values -> values.forEach(value -> targets.add(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId()))));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = taskPaths(session.workspaceUuid(), session.groupWorkspaceKey(), targets);
        List<User> visible = new ArrayList<>();
        for (User user : users) {
            List<Assignment> assignments = user.assignments().stream().filter(value -> expectedTargetType.equals(value.serviceNodeType()) && isWithinScope(scope, paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId())))).toList();
            if (assignments.isEmpty()) continue;
            List<Invitation> history = user.invitationHistory().stream().filter(invitation -> {
                List<AssignmentTarget> targetsForInvitation = invitationTargets.getOrDefault(invitation.invitationId(), List.of());
                return !targetsForInvitation.isEmpty() && targetsForInvitation.stream().allMatch(target -> isWithinScope(scope, paths.get(new OrganizationTaskPathLookup.TaskPathRef(target.serviceNodeType(), target.serviceNodeId()))));
            }).toList();
            visible.add(new User(user.accountId(), user.displayName(), user.maskedMobile(), user.loginName(), user.status(), user.credentialStatus(), (int) assignments.stream().filter(value -> "ACTIVE".equals(value.status())).count(), assignments, history, user.createdAt(), user.updatedAt(), user.revision()));
        }
        return List.copyOf(visible);
    }

    private List<UUID> accountIdsForTarget(UUID workspaceUuid, String key, String targetType, UUID targetId, String userName, String mobile, String roleQuery, String status, int page, int pageSize) {
        String joins = " FROM workspace_iam.workspace_account a JOIN workspace_iam.role_assignment r ON r.account_id=a.id AND r.workspace_uuid=a.workspace_uuid AND r.group_workspace_key=a.group_workspace_key LEFT JOIN workspace_iam.workspace_role role ON role.id=r.role_id";
        String where = " WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND r.service_node_type=? AND r.service_node_id=? AND (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR role.name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.status=?)";
        List<Object> values = new ArrayList<>();
        values.add(workspaceUuid);
        values.add(key);
        values.add(targetType);
        values.add(targetId);
        values.add(userName);
        values.add(userName);
        values.add(mobile);
        values.add(mobile);
        values.add(roleQuery);
        values.add(roleQuery);
        values.add(status);
        values.add(status);
        values.add(pageSize); values.add((page - 1) * pageSize);
        return jdbc.query("SELECT DISTINCT a.id, a.login_name_normalized" + joins + where + " ORDER BY a.login_name_normalized, a.id LIMIT ? OFFSET ?", (row, index) -> row.getObject(1, UUID.class), values.toArray());
    }

    private long accountTotalForTarget(UUID workspaceUuid, String key, String targetType, UUID targetId, String userName, String mobile, String roleQuery, String status) {
        return jdbc.queryForObject("SELECT COUNT(DISTINCT a.id) FROM workspace_iam.workspace_account a JOIN workspace_iam.role_assignment r ON r.account_id=a.id AND r.workspace_uuid=a.workspace_uuid AND r.group_workspace_key=a.group_workspace_key LEFT JOIN workspace_iam.workspace_role role ON role.id=r.role_id WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND r.service_node_type=? AND r.service_node_id=? AND (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR role.name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.status=?)", Long.class, workspaceUuid, key, targetType, targetId, userName, userName, mobile, mobile, roleQuery, roleQuery, status, status);
    }

    private List<UUID> accountIdsForTargetFamily(UUID workspaceUuid, String key, String targetType, String userName, String mobile, String roleQuery, String status, int page, int pageSize) {
        String joins = " FROM workspace_iam.workspace_account a JOIN workspace_iam.role_assignment r ON r.account_id=a.id AND r.workspace_uuid=a.workspace_uuid AND r.group_workspace_key=a.group_workspace_key LEFT JOIN workspace_iam.workspace_role role ON role.id=r.role_id";
        String where = " WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND r.service_node_type=? AND (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR role.name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.status=?)";
        List<Object> values = new ArrayList<>();
        values.add(workspaceUuid); values.add(key); values.add(targetType);
        values.add(userName); values.add(userName); values.add(mobile); values.add(mobile); values.add(roleQuery); values.add(roleQuery); values.add(status); values.add(status);
        values.add(pageSize); values.add((page - 1) * pageSize);
        return jdbc.query("SELECT DISTINCT a.id, a.login_name_normalized" + joins + where + " ORDER BY a.login_name_normalized, a.id LIMIT ? OFFSET ?", (row, index) -> row.getObject(1, UUID.class), values.toArray());
    }

    private long accountTotalForTargetFamily(UUID workspaceUuid, String key, String targetType, String userName, String mobile, String roleQuery, String status) {
        return jdbc.queryForObject("SELECT COUNT(DISTINCT a.id) FROM workspace_iam.workspace_account a JOIN workspace_iam.role_assignment r ON r.account_id=a.id AND r.workspace_uuid=a.workspace_uuid AND r.group_workspace_key=a.group_workspace_key LEFT JOIN workspace_iam.workspace_role role ON role.id=r.role_id WHERE a.workspace_uuid=? AND a.group_workspace_key=? AND r.service_node_type=? AND (CAST(? AS text) IS NULL OR a.display_name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.mobile_normalized ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR role.name ILIKE '%' || ? || '%') AND (CAST(? AS text) IS NULL OR a.status=?)", Long.class, workspaceUuid, key, targetType, userName, userName, mobile, mobile, roleQuery, roleQuery, status, status);
    }

    private Map<UUID, Account> accounts(UUID workspaceUuid, String key, Set<UUID> ids) {
        List<Account> values = jdbc.query("SELECT id, display_name, mobile_normalized, login_name_normalized, status, version, created_at_epoch_millis, updated_at_epoch_millis FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND group_workspace_key=? AND id IN (" + placeholders(ids.size()) + ")", (row, index) -> new Account(row.getObject(1, UUID.class), row.getString(2), row.getString(3), row.getString(4), row.getString(5), row.getLong(6), row.getLong(7), row.getLong(8)), arguments(workspaceUuid, key, ids));
        Map<UUID, Account> result = new LinkedHashMap<>(); values.forEach(value -> result.put(value.id(), value)); return Map.copyOf(result);
    }

    private Map<UUID, List<RawAssignment>> assignments(UUID workspaceUuid, String key, Set<UUID> accountIds) {
        List<RawAssignment> values = jdbc.query("SELECT r.id, r.account_id, r.role_id, role.name, r.service_node_type, r.service_node_id, r.status, r.source_invitation_id, r.version, r.created_at_epoch_millis, r.updated_at_epoch_millis FROM workspace_iam.role_assignment r JOIN workspace_iam.workspace_role role ON role.id=r.role_id WHERE r.workspace_uuid=? AND r.group_workspace_key=? AND r.account_id IN (" + placeholders(accountIds.size()) + ") ORDER BY r.created_at_epoch_millis", (row, index) -> new RawAssignment(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getObject(3, UUID.class), row.getString(4), row.getString(5), row.getObject(6, UUID.class), row.getString(7), row.getObject(8, UUID.class), row.getLong(9), row.getLong(10), row.getLong(11)), arguments(workspaceUuid, key, accountIds));
        Map<UUID, List<RawAssignment>> result = new LinkedHashMap<>(); values.forEach(value -> result.computeIfAbsent(value.accountId(), ignored -> new ArrayList<>()).add(value)); return result;
    }

    private Map<String, List<Invitation>> invitations(UUID workspaceUuid, String key, Set<String> mobiles) {
        if (mobiles.isEmpty()) return Map.of();
        List<MobileInvitation> values = jdbc.query("SELECT mobile_normalized, id, status, version, expires_at_epoch_millis FROM workspace_iam.invitation WHERE workspace_uuid=? AND group_workspace_key=? AND mobile_normalized IN (" + placeholders(mobiles.size()) + ") ORDER BY expires_at_epoch_millis DESC", (row, index) -> new MobileInvitation(row.getString(1), new Invitation(row.getObject(2, UUID.class), invitationStatus(row.getString(3)), Math.toIntExact(row.getLong(4)), row.getLong(5))), arguments(workspaceUuid, key, mobiles));
        Map<String, List<Invitation>> result = new LinkedHashMap<>(); values.forEach(value -> result.computeIfAbsent(value.mobile(), ignored -> new ArrayList<>()).add(value.invitation())); return result;
    }

    private Set<UUID> pendingCredentialAccounts(Set<UUID> accountIds) {
        return Set.copyOf(jdbc.query("SELECT DISTINCT account_id FROM workspace_iam.password_reset WHERE status IN ('PENDING','MOBILE_VERIFIED') AND account_id IN (" + placeholders(accountIds.size()) + ")", (row, index) -> row.getObject(1, UUID.class), accountIds.toArray()));
    }

    private Map<UUID, List<AssignmentTarget>> invitationTargets(List<UUID> invitationIds) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(invitationIds);
        if (ids.isEmpty()) return Map.of();
        List<InvitationTarget> values = jdbc.query("SELECT invitation_id, service_node_type, service_node_id FROM workspace_iam.invitation_assignment_intent WHERE invitation_id IN (" + placeholders(ids.size()) + ")", (row, index) -> new InvitationTarget(row.getObject(1, UUID.class), new AssignmentTarget(row.getString(2), row.getObject(3, UUID.class))), ids.toArray());
        Map<UUID, List<AssignmentTarget>> result = new LinkedHashMap<>(); values.forEach(value -> result.computeIfAbsent(value.invitationId(), ignored -> new ArrayList<>()).add(value.target())); return result;
    }

    private Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> taskPaths(UUID workspaceUuid, String key, List<OrganizationTaskPathLookup.TaskPathRef> targets) {
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>(targets);
        if (refs.isEmpty()) return Map.of();
        if (taskPaths != null) return taskPaths.requireTaskPaths(workspaceUuid, key, List.copyOf(refs));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, new OrganizationTaskPathLookup.TaskPath(ref.targetType(), ref.targetId(), List.of(ref.targetId()), path(workspaceUuid, key, ref.targetType(), ref.targetId()))));
        return Map.copyOf(result);
    }

    private OrganizationTaskPathLookup.TaskPath taskPath(UUID workspaceUuid, String key, OrganizationTaskPathLookup.TaskPathRef target) {
        OrganizationTaskPathLookup.TaskPath value = taskPaths(workspaceUuid, key, List.of(target)).get(target);
        if (value == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return value;
    }

    private static Assignment assignment(RawAssignment value, Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        OrganizationTaskPathLookup.TaskPath path = paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId()));
        if (path == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return new Assignment(value.id(), value.accountId(), value.roleId(), value.roleName(), value.serviceNodeType(), path.displayPath(), value.status(), value.sourceInvitationId() == null ? "ADMINISTRATION" : "INVITATION", value.revision(), value.createdAt(), value.updatedAt(), value.serviceNodeId());
    }

    private static boolean isWithinScope(OrganizationTaskPathLookup.TaskPath scope, OrganizationTaskPathLookup.TaskPath target) { return target != null && target.ancestorIds().contains(scope.targetId()); }
    private static boolean contains(String value, String query) { return query == null || (value != null && value.toLowerCase(java.util.Locale.ROOT).contains(query.toLowerCase(java.util.Locale.ROOT))); }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static <T> List<T> pageSlice(List<T> values, int page, int pageSize) {
        if (values.isEmpty()) return List.of();
        int fromIndex = Math.min(values.size(), Math.max(0, (page - 1) * pageSize));
        int toIndex = Math.min(values.size(), fromIndex + pageSize);
        return fromIndex >= toIndex ? List.of() : List.copyOf(values.subList(fromIndex, toIndex));
    }

    private static String placeholders(int count) { return String.join(",", java.util.Collections.nCopies(count, "?")); }
    private static Object[] arguments(UUID workspaceUuid, String key, Set<?> ids) { List<Object> values = new ArrayList<>(); values.add(workspaceUuid); values.add(key); values.addAll(ids); return values.toArray(); }

    private boolean isTargetWithinScope(UUID workspaceUuid, String key, OrganizationTaskPathLookup.TaskPath scope, String targetType, UUID targetId) {
        OrganizationTaskPathLookup.TaskPath target = taskPaths.requireTaskPath(workspaceUuid, key, targetType, targetId);
        return target.ancestorIds().contains(scope.targetId());
    }

    private String path(UUID workspaceUuid, String key, String nodeType, UUID id) { return switch (nodeType) { case "GROUP" -> groups.describeCommercialGroup(workspaceUuid, key, id); case "REGION", "PROJECT" -> nodes.describePath(workspaceUuid, key, id); case "HEAD_COMPANY", "STORE" -> entities.describeEntityPath(workspaceUuid, key, nodeType, id); default -> throw new IllegalArgumentException("unsupported service node type"); }; }
    private static CommercialGroupLookup legacyGroups(OrganizationNodeLookup nodes) { return new CommercialGroupLookup() { @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) { throw new UnsupportedOperationException("legacy tests supply a GROUP node"); } @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) { return nodes.isEnterable(workspaceUuid, groupWorkspaceKey, commercialGroupRef); } @Override public String describeCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) { return nodes.describePath(workspaceUuid, groupWorkspaceKey, commercialGroupRef); } }; }
    private static String invitationStatus(String status) { return switch (status) { case "CANCELLED" -> "CANCELLED"; case "COMPLETED" -> "COMPLETED"; case "EXPIRED" -> "EXPIRED"; default -> "ACTIVE"; }; }
    private static String mask(String value) { return value.length() <= 4 ? "****" : value.substring(0, Math.min(3, value.length())) + "****" + value.substring(Math.max(3, value.length() - 4)); }
    private record Account(UUID id, String displayName, String mobile, String loginName, String status, long version, long createdAt, long updatedAt) { }
    public record Page(List<User> items, int page, int pageSize, long total, String targetOrganizationType, String scopeRef, String scopeName, long contextVersion) { }
    public record PlatformPage(List<User> items, int page, int pageSize, long total) { }
    public record User(UUID accountId, String displayName, String maskedMobile, String loginName, String status, String credentialStatus, int activeAssignmentCount, List<Assignment> assignments, List<Invitation> invitationHistory, long createdAt, long updatedAt, long revision) { }
    public record Assignment(UUID id, UUID accountId, UUID roleId, String roleName, String serviceNodeType, String organizationPath, String status, String source, long revision, long createdAt, long updatedAt, UUID serviceNodeId) { }
    public record Invitation(UUID invitationId, String status, int generation, long expiresAt) { }
    public record CandidatePage(CandidateQueryMetadata metadata, List<CandidateOrganization> organizations, List<WorkspaceRoleReadback> roles) { }
    public record CandidateQueryMetadata(String subjectType, String queryText, int page, int pageSize, long total, UUID selectedOrganizationRef) { }
    public record CandidateOrganization(String serviceNodeType, UUID organizationRef, String path) { }
    private record RawAssignment(UUID id, UUID accountId, UUID roleId, String roleName, String serviceNodeType, UUID serviceNodeId, String status, UUID sourceInvitationId, long revision, long createdAt, long updatedAt) { }
    private record MobileInvitation(String mobile, Invitation invitation) { }
    private record InvitationTarget(UUID invitationId, AssignmentTarget target) { }
    private record AssignmentTarget(String serviceNodeType, UUID serviceNodeId) { }
}
