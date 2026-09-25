package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.organization.application.OrganizationTaskPathService;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.persistence.WorkspaceUserPersistence;
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
    private final WorkspaceUserPersistence persistence;
    private final OrganizationNodeLookup nodes;
    private final OrganizationEntityLookup entities;
    private final WorkspaceRoleService roles;
    private final CommercialGroupLookup groups;
    private final OrganizationAssignmentCandidateLookup candidates;
    private final WorkspaceAssignmentScopeLookup assignments;
    private final OrganizationTaskPathLookup taskPaths;

    public WorkspaceUserService(
            JdbcTemplate jdbc,
            OrganizationNodeLookup nodes,
            OrganizationEntityLookup entities,
            WorkspaceRoleService roles) {
        this(
                new WorkspaceUserPersistence(jdbc),
                nodes,
                entities,
                roles,
                legacyGroups(nodes),
                (workspaceUuid, groupWorkspaceKey, serviceNodeType) -> List.of(),
                null,
                null);
    }

    /** Compatibility constructor for focused owner tests; production injects the typed persistence boundary. */
    public WorkspaceUserService(
            JdbcTemplate jdbc,
            OrganizationNodeLookup nodes,
            OrganizationEntityLookup entities,
            WorkspaceRoleService roles,
            CommercialGroupLookup groups,
            OrganizationAssignmentCandidateLookup candidates,
            WorkspaceAssignmentScopeLookup assignments,
            OrganizationTaskPathLookup taskPaths) {
        this(new WorkspaceUserPersistence(jdbc), nodes, entities, roles, groups, candidates, assignments, taskPaths);
    }

    @org.springframework.beans.factory.annotation.Autowired
    private WorkspaceUserService(
            WorkspaceUserPersistence persistence,
            OrganizationNodeLookup nodes,
            OrganizationEntityLookup entities,
            WorkspaceRoleService roles,
            CommercialGroupLookup groups,
            OrganizationAssignmentCandidateLookup candidates,
            WorkspaceAssignmentScopeLookup assignments,
            OrganizationTaskPathLookup taskPaths) {
        this.persistence = persistence;
        this.nodes = nodes;
        this.entities = entities;
        this.roles = roles;
        this.groups = groups;
        this.candidates = candidates;
        this.assignments = assignments;
        this.taskPaths = taskPaths;
    }

    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveCurrentTaskScope(WorkspaceSessionReadback session) {
        if (session == null || session.currentAssignmentId() == null || assignments == null || taskPaths == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignmentScope(session);
        OrganizationTaskPathLookup.CommandTaskPathFacts facts =
                commandTaskPathFacts(session, assignment, assignment.serviceNodeType(), assignment.serviceNodeId());
        if (!facts.assignmentScopeAllowed()) throw new TaskScopeDeniedException();
        return facts.taskPath();
    }

    /**
     * An optional client scope selects an instance of the endpoint's already-fixed target type. It never selects the
     * target type or authority.
     */
    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveTaskScope(
            WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef) {
        if (session == null || session.currentAssignmentId() == null || assignments == null || taskPaths == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignmentScope(session);
        String requiredDataNodeType = requiredDataNodeType(expectedTargetType);
        if ("NONE".equals(requiredDataNodeType)) {
            if (ServiceNodeTypes.GROUP.equals(assignment.serviceNodeType())
                    && ServiceNodeTypes.HEAD_COMPANY.equals(expectedTargetType)) {
                // The catalog declares this page as fixed-target/no-scope. A GROUP
                // operator therefore receives the owner-approved aggregate, never a
                // scope selection from a different required page type.
                return taskPaths.requireTaskPath(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        ServiceNodeTypes.GROUP,
                        assignment.serviceNodeId());
            }
            if (expectedTargetType == null || !expectedTargetType.equals(assignment.serviceNodeType()))
                throw new TaskScopeDeniedException();
            return taskPaths.requireTaskPath(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    assignment.serviceNodeType(),
                    assignment.serviceNodeId());
        }
        var selected =
                session.scopeContext() == null ? null : session.scopeContext().selectionFor(requiredDataNodeType);
        UUID effectiveScopeRef = selected == null ? null : selected.dataNodeId();
        if (requestedScopeRef != null && !requestedScopeRef.equals(effectiveScopeRef))
            throw new TaskScopeDeniedException();
        if (effectiveScopeRef == null) throw new TaskScopeDeniedException();
        OrganizationTaskPathLookup.CommandTaskPathFacts facts =
                commandTaskPathFacts(session, assignment, expectedTargetType, effectiveScopeRef);
        if (!facts.assignmentScopeAllowed()) throw new TaskScopeDeniedException();
        return facts.taskPath();
    }

    /** Resolves the project explicitly selected for project-context business pages. */
    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveSelectedProjectScope(
            WorkspaceSessionReadback session, UUID requestedProjectRef) {
        if (session == null || session.currentAssignmentId() == null || assignments == null || taskPaths == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignmentScope(session);
        var selected =
                session.scopeContext() == null ? null : session.scopeContext().selectionFor(ServiceNodeTypes.PROJECT);
        UUID effectiveProjectRef = selected == null ? null : selected.dataNodeId();
        if (requestedProjectRef != null && !requestedProjectRef.equals(effectiveProjectRef))
            throw new TaskScopeDeniedException();
        if (effectiveProjectRef == null) throw new TaskScopeDeniedException();
        OrganizationTaskPathLookup.CommandTaskPathFacts facts =
                commandTaskPathFacts(session, assignment, ServiceNodeTypes.PROJECT, effectiveProjectRef);
        if (!facts.assignmentScopeAllowed()) throw new TaskScopeDeniedException();
        return facts.taskPath();
    }

    /**
     * Store commands need the selected Project path and the Store's immutable update facts. The organization owner
     * supplies both in one read; this edge helper only applies the already-loaded session selection and assignment
     * scope judgment, so it deliberately does not open a second transaction.
     */
    public OrganizationTaskPathLookup.StoreProjectCommandFacts resolveSelectedProjectScopeForStore(
            WorkspaceSessionReadback session, UUID storeId) {
        if (session == null || session.currentAssignmentId() == null || assignments == null || taskPaths == null)
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignmentScope(session);
        var selected =
                session.scopeContext() == null ? null : session.scopeContext().selectionFor(ServiceNodeTypes.PROJECT);
        if (selected == null) throw new TaskScopeDeniedException();
        OrganizationTaskPathLookup.StoreProjectCommandFacts facts = taskPaths.requireStoreProjectCommandFacts(
                session.workspaceUuid(), session.groupWorkspaceKey(), storeId);
        if (!selected.dataNodeId().equals(facts.projectId())
                || !OrganizationTaskPathLookup.scopeAllows(
                        assignment.serviceNodeType(), assignment.serviceNodeId(), facts.taskPath()))
            throw new TaskScopeDeniedException();
        return facts;
    }

    /** Resolves a command target from the explicit target selected in the approved form. */
    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveCommandTarget(
            WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef) {
        if (session == null
                || session.currentAssignmentId() == null
                || assignments == null
                || taskPaths == null
                || expectedTargetType == null
                || requestedTargetRef == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignmentScope(session);
        OrganizationTaskPathLookup.CommandTaskPathFacts facts =
                commandTaskPathFacts(session, assignment, expectedTargetType, requestedTargetRef);
        if (!facts.assignmentScopeAllowed()) throw new WorkspaceAuthenticationService.SessionInvalidException();
        return facts.taskPath();
    }

    /**
     * Same command target projection for the narrowly approved business-channel case where a Store target may already
     * be disabled. The target type guard remains in the organization owner API; this method does not broaden ordinary
     * command authority.
     */
    @Transactional(readOnly = true)
    public OrganizationTaskPathLookup.TaskPath resolveCommandTargetAllowingDisabledStore(
            WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef) {
        if (session == null
                || session.currentAssignmentId() == null
                || assignments == null
                || taskPaths == null
                || !ServiceNodeTypes.STORE.equals(expectedTargetType)
                || requestedTargetRef == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        WorkspaceAssignmentScopeLookup.AssignmentScope assignment = assignmentScope(session);
        OrganizationTaskPathLookup.CommandTaskPathFacts facts = taskPaths.commandTaskPathFactsAllowingDisabledTarget(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                assignment.serviceNodeType(),
                assignment.serviceNodeId(),
                expectedTargetType,
                requestedTargetRef);
        if (!facts.assignmentScopeAllowed()) throw new WorkspaceAuthenticationService.SessionInvalidException();
        return facts.taskPath();
    }

    private static String requiredDataNodeType(String expectedTargetType) {
        String pageDesignKey = WorkspaceAuthorizationCatalog.userManagementPageForTargetType(expectedTargetType)
                .orElseThrow(WorkspaceAuthenticationService.SessionInvalidException::new);
        return WorkspaceAuthorizationCatalog.page(pageDesignKey)
                .map(WorkspaceAuthorizationCatalog.PageAccessCatalogEntry::requiredDataNodeType)
                .orElseThrow(WorkspaceAuthenticationService.SessionInvalidException::new);
    }

    /**
     * A command-minted session already contains the fresh active-assignment projection. Legacy and task-read sessions
     * intentionally retain their owner lookup rather than inheriting a command optimization across an unrelated
     * invocation.
     */
    private WorkspaceAssignmentScopeLookup.AssignmentScope assignmentScope(WorkspaceSessionReadback session) {
        if (session.assignmentNodeType() != null && session.assignmentNodeId() != null) {
            return new WorkspaceAssignmentScopeLookup.AssignmentScope(
                    session.assignmentNodeType(), session.assignmentNodeId());
        }
        return assignments.requireActiveScope(
                session.workspaceUuid(), session.groupWorkspaceKey(), session.currentAssignmentId());
    }

    private OrganizationTaskPathLookup.CommandTaskPathFacts commandTaskPathFacts(
            WorkspaceSessionReadback session,
            WorkspaceAssignmentScopeLookup.AssignmentScope assignment,
            String targetType,
            UUID targetId) {
        return taskPaths.commandTaskPathFacts(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                assignment.serviceNodeType(),
                assignment.serviceNodeId(),
                targetType,
                targetId,
                false);
    }

    /** One candidate interface; only invitation-target candidates carry task-range restriction. */
    @Transactional(readOnly = true)
    public CandidatePage candidates(CandidateQuery query) {
        CandidateQuery safe = query == null ? null : query.validated();
        if (safe == null) throw new IllegalArgumentException("candidate query is required");
        OrganizationTaskPathLookup.TaskPath scope = safe.operationsSession() == null
                ? null
                : resolveTaskScope(safe.operationsSession(), safe.targetType(), safe.requestedScopeRef());
        int safePage = Math.max(1, safe.page() == null ? 1 : safe.page());
        int safeSize = Math.min(100, Math.max(1, safe.pageSize() == null ? 20 : safe.pageSize()));
        String normalizedQuery = blankToNull(safe.queryText());
        return switch (safe.subjectType()) {
            case "ORGANIZATION" -> {
                if (safe.operationsSession() == null) throw new TaskScopeDeniedException();
                if (scope == null) throw new TaskScopeDeniedException();
                var result = candidates.operationsInvitationCandidates(
                        safe.workspaceUuid(),
                        safe.groupWorkspaceKey(),
                        new OrganizationAssignmentCandidateLookup.OperationsInvitationCandidateQuery(
                                candidateTargetType(safe.targetType()),
                                scope.targetType(),
                                scope.targetId(),
                                normalizedQuery,
                                safePage,
                                safeSize));
                List<CandidateOrganization> visible = result.items().stream()
                        .map(value -> new CandidateOrganization(
                                value.serviceNodeType(), value.organizationRef(), value.path(), value.pathNodes()))
                        .toList();
                yield new CandidatePage(
                        new CandidateQueryMetadata(
                                "ORGANIZATION", normalizedQuery, safePage, safeSize, result.total(), null),
                        visible,
                        List.of());
            }
            case "ROLE" -> {
                boolean invitationTarget = "INVITATION_TARGET".equals(safe.candidateUsage());
                boolean selectedIsAllowed = !invitationTarget
                        || (safe.selectedOrganizationRef() != null
                                && (scope == null
                                        ? isEnabledTarget(
                                                safe.workspaceUuid(),
                                                safe.groupWorkspaceKey(),
                                                safe.targetType(),
                                                safe.selectedOrganizationRef())
                                        : isTargetWithinScope(
                                                safe.workspaceUuid(),
                                                safe.groupWorkspaceKey(),
                                                scope,
                                                safe.targetType(),
                                                safe.selectedOrganizationRef())));
                if (!selectedIsAllowed)
                    yield new CandidatePage(
                            new CandidateQueryMetadata(
                                    "ROLE", normalizedQuery, safePage, safeSize, 0, safe.selectedOrganizationRef()),
                            List.of(),
                            List.of());
                WorkspaceRoleService.Page enabledRoles = roles.page(
                        safe.workspaceUuid(),
                        safe.groupWorkspaceKey(),
                        normalizedQuery,
                        safe.targetType(),
                        "ENABLED",
                        safePage,
                        safeSize,
                        "NAME",
                        "ASC");
                yield new CandidatePage(
                        new CandidateQueryMetadata(
                                "ROLE",
                                normalizedQuery,
                                safePage,
                                safeSize,
                                enabledRoles.total(),
                                safe.selectedOrganizationRef()),
                        List.of(),
                        enabledRoles.items());
            }
            default -> throw new IllegalArgumentException("unsupported invitation candidate subject type");
        };
    }

    /**
     * The sole owner account-page query. The app face chooses only a caller scope and the conditions it exposes; scope
     * resolution and the exact count/page predicate remain in workspace-IAM.
     */
    @Transactional(readOnly = true)
    public AccountPage page(AccountPageQuery query) {
        AccountPageQuery safe = query == null ? null : query.validated();
        if (safe == null) throw new WorkspaceAccountService.AccountNotFoundException();
        ResolvedAccountScope scope = resolveAccountScope(safe);
        PageOrder order = pageOrder(safe.sort(), safe.direction(), scope.operationsScoped());
        String targetType = scope.operationsScoped() ? scope.targetType() : safe.targetType();
        UUID organizationRef = scope.operationsScoped() ? scope.targetId() : safe.organizationRef();
        WorkspaceUserPersistence.AccountPageRows rows = persistence.page(
                safe.workspaceUuid(),
                safe.groupWorkspaceKey(),
                targetType,
                organizationRef,
                safe.userName(),
                safe.mobile(),
                safe.loginName(),
                safe.roleId(),
                safe.status(),
                order.sort(),
                order.direction(),
                safe.page(),
                safe.pageSize());
        long total = rows.total();
        List<UUID> ids = rows.accountIds();
        List<User> pageUsers = users(safe.workspaceUuid(), safe.groupWorkspaceKey(), ids, false);
        if (scope.operationsScoped()) pageUsers = usersAtExactTarget(scope.targetType(), scope.targetId(), pageUsers);
        return new AccountPage(
                pageUsers,
                safe.page(),
                safe.pageSize(),
                total,
                scope.targetType(),
                scope.scopeRef(),
                scope.scopeName(),
                scope.contextVersion(),
                order.sort(),
                order.direction());
    }

    @Transactional(readOnly = true)
    public User detail(AccountDetailQuery query) {
        AccountDetailQuery safe = query == null ? null : query.validated();
        if (safe == null) throw new WorkspaceAccountService.AccountNotFoundException();
        if (safe.operationsSession() == null) {
            List<User> visible = users(safe.workspaceUuid(), safe.groupWorkspaceKey(), List.of(safe.accountId()));
            if (visible.isEmpty()) throw new WorkspaceAccountService.AccountNotFoundException();
            return visible.getFirst();
        }
        WorkspaceSessionReadback session = safe.operationsSession();
        if (!safe.workspaceUuid().equals(session.workspaceUuid())
                || !safe.groupWorkspaceKey().equals(session.groupWorkspaceKey()))
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        OrganizationTaskPathLookup.TaskPath scope = resolveTaskScope(session, safe.expectedTargetType(), null);
        List<User> visible = usersAtExactTarget(
                scope.targetType(),
                scope.targetId(),
                users(session.workspaceUuid(), session.groupWorkspaceKey(), List.of(safe.accountId())));
        if (visible.isEmpty()) throw new WorkspaceAccountService.AccountNotFoundException();
        return visible.getFirst();
    }

    private ResolvedAccountScope resolveAccountScope(AccountPageQuery query) {
        if (query.operationsSession() == null) return new ResolvedAccountScope(false, null, null, null, null, null);
        OrganizationTaskPathLookup.TaskPath scope =
                resolveTaskScope(query.operationsSession(), query.targetType(), query.requestedScopeRef());
        return new ResolvedAccountScope(
                true,
                query.targetType(),
                scope.targetId(),
                scope.targetId().toString(),
                scope.displayPath(),
                query.operationsSession().contextVersion());
    }

    /** Loads the page's account bundle in fixed IAM reads; organization facts are one owner batch read. */
    private List<User> users(UUID workspaceUuid, String key, List<UUID> accountIds) {
        return users(workspaceUuid, key, accountIds, true);
    }

    /** Page rows carry only the latest aggregate; detail alone carries bounded authentication facts. */
    private List<User> users(
            UUID workspaceUuid, String key, List<UUID> accountIds, boolean includeAuthenticationHistory) {
        LinkedHashSet<UUID> requested = new LinkedHashSet<>(accountIds);
        if (requested.isEmpty()) return List.of();
        Map<UUID, Account> accounts = accounts(workspaceUuid, key, requested);
        if (accounts.size() != requested.size()) throw new WorkspaceAccountService.AccountNotFoundException();
        Map<UUID, List<RawAssignment>> rawAssignments = assignments(workspaceUuid, key, requested);
        Map<UUID, Long> lastLoginByAccount = latestAuthenticationByAccount(workspaceUuid, key, requested);
        Map<UUID, List<AuthenticationHistory>> authenticationHistoryByAccount =
                includeAuthenticationHistory ? authenticationHistory(workspaceUuid, key, requested) : Map.of();
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths =
                persistedAssignmentPaths(
                        workspaceUuid,
                        key,
                        rawAssignments.values().stream()
                                .flatMap(List::stream)
                                .map(value -> new OrganizationTaskPathLookup.TaskPathRef(
                                        value.serviceNodeType(), value.serviceNodeId()))
                                .toList());
        Map<String, List<Invitation>> historyByMobile = invitations(
                workspaceUuid,
                key,
                accounts.values().stream()
                        .map(Account::mobile)
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
        Set<UUID> pendingCredentials = pendingCredentialAccounts(requested);
        List<User> values = new ArrayList<>();
        for (UUID accountId : requested) {
            Account account = accounts.get(accountId);
            List<Assignment> accountAssignments = rawAssignments.getOrDefault(accountId, List.of()).stream()
                    .map(value -> assignment(value, paths))
                    .toList();
            values.add(new User(
                    account.id(),
                    account.displayName(),
                    account.mobile(),
                    mask(account.mobile()),
                    account.loginName(),
                    account.status(),
                    pendingCredentials.contains(account.id()) ? "CHANGE_REQUIRED" : "SET",
                    (int) accountAssignments.stream()
                            .filter(value -> "ACTIVE".equals(value.status()))
                            .count(),
                    accountAssignments,
                    historyByMobile.getOrDefault(account.mobile(), List.of()),
                    lastLoginByAccount.get(account.id()),
                    authenticationHistoryByAccount.getOrDefault(account.id(), List.of()),
                    account.createdAt(),
                    account.updatedAt(),
                    account.version()));
        }
        return List.copyOf(values);
    }

    /**
     * Operations user pages are a management view of one exact selected node. Account membership is selected by the
     * same target in SQL; this owner-side projection keeps the returned role and invitation facts on that exact node
     * instead of leaking the account's other valid assignments into the view.
     */
    private List<User> usersAtExactTarget(String targetType, UUID targetId, List<User> users) {
        Map<UUID, List<AssignmentTarget>> invitationTargets = invitationTargets(users.stream()
                .flatMap(user -> user.invitationHistory().stream())
                .map(Invitation::invitationId)
                .toList());
        List<User> visible = new ArrayList<>();
        for (User user : users) {
            List<Assignment> assignments = user.assignments().stream()
                    .filter(value ->
                            targetType.equals(value.serviceNodeType()) && targetId.equals(value.serviceNodeId()))
                    .toList();
            if (assignments.isEmpty()) continue;
            List<Invitation> history = user.invitationHistory().stream()
                    .filter(invitation -> {
                        List<AssignmentTarget> targetsForInvitation =
                                invitationTargets.getOrDefault(invitation.invitationId(), List.of());
                        return !targetsForInvitation.isEmpty()
                                && targetsForInvitation.stream()
                                        .allMatch(target -> targetType.equals(target.serviceNodeType())
                                                && targetId.equals(target.serviceNodeId()));
                    })
                    .toList();
            visible.add(new User(
                    user.accountId(),
                    user.displayName(),
                    user.mobile(),
                    user.maskedMobile(),
                    user.loginName(),
                    user.status(),
                    user.credentialStatus(),
                    (int) assignments.stream()
                            .filter(value -> "ACTIVE".equals(value.status()))
                            .count(),
                    assignments,
                    history,
                    user.lastLoginAt(),
                    user.authenticationHistory(),
                    user.createdAt(),
                    user.updatedAt(),
                    user.revision()));
        }
        return List.copyOf(visible);
    }

    private Map<UUID, Account> accounts(UUID workspaceUuid, String key, Set<UUID> ids) {
        Map<UUID, Account> result = new LinkedHashMap<>();
        persistence
                .accounts(workspaceUuid, key, ids)
                .forEach(value -> result.put(
                        value.id(),
                        new Account(
                                value.id(),
                                value.displayName(),
                                value.mobile(),
                                value.loginName(),
                                value.status(),
                                value.version(),
                                value.createdAt(),
                                value.updatedAt())));
        return Map.copyOf(result);
    }

    private Map<UUID, List<RawAssignment>> assignments(UUID workspaceUuid, String key, Set<UUID> accountIds) {
        Map<UUID, List<RawAssignment>> result = new LinkedHashMap<>();
        persistence.assignments(workspaceUuid, key, accountIds).forEach(value -> result.computeIfAbsent(
                        value.accountId(), ignored -> new ArrayList<>())
                .add(new RawAssignment(
                        value.id(),
                        value.accountId(),
                        value.roleId(),
                        value.roleName(),
                        value.serviceNodeType(),
                        value.serviceNodeId(),
                        value.status(),
                        value.sourceInvitationId(),
                        value.revision(),
                        value.createdAt(),
                        value.updatedAt())));
        return result;
    }

    /** One owner aggregate for page projection; never derive last login from invitations or audit. */
    private Map<UUID, Long> latestAuthenticationByAccount(UUID workspaceUuid, String key, Set<UUID> accountIds) {
        Map<UUID, Long> result = new LinkedHashMap<>();
        persistence
                .latestAuthentication(workspaceUuid, key, accountIds)
                .forEach(value -> result.put(value.accountId(), value.authenticatedAt()));
        return Map.copyOf(result);
    }

    /** Bounded latest-ten history for every requested account in one owner read. */
    private Map<UUID, List<AuthenticationHistory>> authenticationHistory(
            UUID workspaceUuid, String key, Set<UUID> accountIds) {
        Map<UUID, List<AuthenticationHistory>> result = new LinkedHashMap<>();
        for (WorkspaceUserPersistence.AuthenticationHistoryRow value :
                persistence.authenticationHistory(workspaceUuid, key, accountIds))
            result.computeIfAbsent(value.accountId(), ignored -> new ArrayList<>())
                    .add(new AuthenticationHistory(value.id(), value.authenticatedAt()));
        result.replaceAll((ignored, history) -> List.copyOf(history));
        return Map.copyOf(result);
    }

    private Map<String, List<Invitation>> invitations(UUID workspaceUuid, String key, Set<String> mobiles) {
        if (mobiles.isEmpty()) return Map.of();
        Map<String, List<Invitation>> result = new LinkedHashMap<>();
        persistence.invitations(workspaceUuid, key, mobiles).forEach(value -> result.computeIfAbsent(
                        value.mobile(), ignored -> new ArrayList<>())
                .add(new Invitation(
                        value.invitationId(),
                        invitationStatus(value.status()),
                        value.generation(),
                        value.expiresAt())));
        return result;
    }

    private Set<UUID> pendingCredentialAccounts(Set<UUID> accountIds) {
        return persistence.pendingCredentialAccounts(accountIds);
    }

    private Map<UUID, List<AssignmentTarget>> invitationTargets(List<UUID> invitationIds) {
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(invitationIds);
        if (ids.isEmpty()) return Map.of();
        Map<UUID, List<AssignmentTarget>> result = new LinkedHashMap<>();
        persistence.invitationTargets(List.copyOf(ids)).forEach(value -> result.computeIfAbsent(
                        value.invitationId(), ignored -> new ArrayList<>())
                .add(new AssignmentTarget(value.serviceNodeType(), value.serviceNodeId())));
        return result;
    }

    private Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> taskPaths(
            UUID workspaceUuid, String key, List<OrganizationTaskPathLookup.TaskPathRef> targets) {
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>(targets);
        if (refs.isEmpty()) return Map.of();
        if (taskPaths != null) return taskPaths.requireTaskPaths(workspaceUuid, key, List.copyOf(refs));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(
                ref,
                new OrganizationTaskPathLookup.TaskPath(
                        ref.targetType(),
                        ref.targetId(),
                        List.of(ref.targetId()),
                        path(workspaceUuid, key, ref.targetType(), ref.targetId()))));
        return Map.copyOf(result);
    }

    private Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> persistedAssignmentPaths(
            UUID workspaceUuid, String key, List<OrganizationTaskPathLookup.TaskPathRef> targets) {
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>(targets);
        if (refs.isEmpty()) return Map.of();
        if (taskPaths != null) return taskPaths.describePersistedTaskPaths(workspaceUuid, key, List.copyOf(refs));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(
                ref,
                new OrganizationTaskPathLookup.TaskPath(
                        ref.targetType(),
                        ref.targetId(),
                        List.of(ref.targetId()),
                        path(workspaceUuid, key, ref.targetType(), ref.targetId()))));
        return Map.copyOf(result);
    }

    private OrganizationTaskPathLookup.TaskPath taskPath(
            UUID workspaceUuid, String key, OrganizationTaskPathLookup.TaskPathRef target) {
        OrganizationTaskPathLookup.TaskPath value =
                taskPaths(workspaceUuid, key, List.of(target)).get(target);
        if (value == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return value;
    }

    private static Assignment assignment(
            RawAssignment value,
            Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        OrganizationTaskPathLookup.TaskPath path =
                paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.serviceNodeType(), value.serviceNodeId()));
        if (path == null) throw new WorkspaceAccountService.AccountNotFoundException();
        return new Assignment(
                value.id(),
                value.accountId(),
                value.roleId(),
                value.roleName(),
                value.serviceNodeType(),
                path.nodes(),
                value.status(),
                value.sourceInvitationId() == null ? "ADMINISTRATION" : "INVITATION",
                value.revision(),
                value.createdAt(),
                value.updatedAt(),
                value.serviceNodeId());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isTargetWithinScope(
            UUID workspaceUuid,
            String key,
            OrganizationTaskPathLookup.TaskPath scope,
            String targetType,
            UUID targetId) {
        OrganizationTaskPathLookup.TaskPath target =
                taskPaths.requireTaskPath(workspaceUuid, key, targetType, targetId);
        return target.ancestorIds().contains(scope.targetId());
    }

    private boolean isEnabledTarget(UUID workspaceUuid, String key, String targetType, UUID targetId) {
        try {
            candidates.requireEnabledInvitationTarget(
                    workspaceUuid,
                    key,
                    new OrganizationAssignmentCandidateLookup.InvitationTargetRef(
                            candidateTargetType(targetType), targetId));
            return true;
        } catch (OrganizationTaskPathService.TaskPathNotFoundException exception) {
            return false;
        }
    }

    private static OrganizationAssignmentCandidateLookup.InvitationTargetType candidateTargetType(String targetType) {
        try {
            return OrganizationAssignmentCandidateLookup.InvitationTargetType.valueOf(targetType);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("unsupported invitation candidate target type", exception);
        }
    }

    private String path(UUID workspaceUuid, String key, String nodeType, UUID id) {
        return switch (nodeType) {
            case ServiceNodeTypes.GROUP -> groups.describeCommercialGroup(workspaceUuid, key, id);
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.describePath(workspaceUuid, key, id);
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> entities.describeEntityPath(
                    workspaceUuid, key, nodeType, id);
            default -> throw new IllegalArgumentException("unsupported service node type");
        };
    }

    private static CommercialGroupLookup legacyGroups(OrganizationNodeLookup nodes) {
        return new CommercialGroupLookup() {
            @Override
            public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) {
                throw new UnsupportedOperationException("legacy tests supply a GROUP node");
            }

            @Override
            public boolean isEnterableCommercialGroup(
                    UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
                return nodes.isEnterable(workspaceUuid, groupWorkspaceKey, commercialGroupRef);
            }

            @Override
            public String describeCommercialGroup(
                    UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
                return nodes.describePath(workspaceUuid, groupWorkspaceKey, commercialGroupRef);
            }
        };
    }

    private static PageOrder pageOrder(String sort, String direction, boolean operationsScoped) {
        String safeSort = sort == null ? "LOGIN_NAME" : sort;
        if (!Set.of("DISPLAY_NAME", "LOGIN_NAME", "LAST_LOGIN_AT", "UPDATED_AT").contains(safeSort)
                || (operationsScoped && Set.of("LAST_LOGIN_AT", "UPDATED_AT").contains(safeSort)))
            throw new WorkspaceAccountService.AccountNotFoundException();
        return new PageOrder(safeSort, sortDirection(direction));
    }

    private static String sortDirection(String direction) {
        String safeDirection = direction == null ? "ASC" : direction;
        if (!Set.of("ASC", "DESC").contains(safeDirection))
            throw new WorkspaceAccountService.AccountNotFoundException();
        return safeDirection;
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
    /** A valid session attempted a direct primary read outside its role-node range. */
    public static final class TaskScopeDeniedException extends RuntimeException {}
    /** Pagination bounds are request errors, not account-visibility signals. */
    public static final class PageValidationException extends RuntimeException {}

    private record Account(
            UUID id,
            String displayName,
            String mobile,
            String loginName,
            String status,
            long version,
            long createdAt,
            long updatedAt) {}

    public record AccountPageQuery(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            WorkspaceSessionReadback operationsSession,
            String targetType,
            UUID requestedScopeRef,
            UUID organizationRef,
            String userName,
            String mobile,
            String loginName,
            UUID roleId,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        public static AccountPageQuery forOperations(
                WorkspaceSessionReadback session,
                String targetType,
                UUID requestedScopeRef,
                String userName,
                String mobile,
                UUID roleId,
                String status,
                String sort,
                String direction,
                int page,
                int pageSize) {
            return new AccountPageQuery(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    session,
                    targetType,
                    requestedScopeRef,
                    null,
                    userName,
                    mobile,
                    null,
                    roleId,
                    status,
                    sort,
                    direction,
                    page,
                    pageSize);
        }

        public static AccountPageQuery forPlatform(
                UUID workspaceUuid,
                String groupWorkspaceKey,
                String userName,
                String mobile,
                String loginName,
                UUID roleId,
                String status,
                String targetType,
                UUID organizationRef,
                String sort,
                String direction,
                int page,
                int pageSize) {
            return new AccountPageQuery(
                    workspaceUuid,
                    groupWorkspaceKey,
                    null,
                    targetType,
                    null,
                    organizationRef,
                    userName,
                    mobile,
                    loginName,
                    roleId,
                    status,
                    sort,
                    direction,
                    page,
                    pageSize);
        }

        private AccountPageQuery validated() {
            if (pageSize > 100) throw new PageValidationException();
            if (workspaceUuid == null
                    || groupWorkspaceKey == null
                    || groupWorkspaceKey.isBlank()
                    || page < 1
                    || pageSize < 1
                    || (status != null
                            && !Set.of("ENABLED", "DISABLED", "VOIDED").contains(status)))
                throw new WorkspaceAccountService.AccountNotFoundException();
            if (operationsSession != null
                    && (targetType == null || targetType.isBlank() || loginName != null || organizationRef != null))
                throw new WorkspaceAccountService.AccountNotFoundException();
            return this;
        }
    }

    public record AccountPage(
            List<User> items,
            int page,
            int pageSize,
            long total,
            String targetOrganizationType,
            String scopeRef,
            String scopeName,
            Long contextVersion,
            String sort,
            String direction) {}
    /** The sole owner account-detail query; operations scope is data, never a consumer-specific API. */
    public record AccountDetailQuery(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            WorkspaceSessionReadback operationsSession,
            String expectedTargetType) {
        public static AccountDetailQuery forPlatform(UUID workspaceUuid, String groupWorkspaceKey, UUID accountId) {
            return new AccountDetailQuery(workspaceUuid, groupWorkspaceKey, accountId, null, null);
        }

        public static AccountDetailQuery forOperations(
                WorkspaceSessionReadback session, String expectedTargetType, UUID accountId) {
            return new AccountDetailQuery(
                    session.workspaceUuid(), session.groupWorkspaceKey(), accountId, session, expectedTargetType);
        }

        private AccountDetailQuery validated() {
            if (workspaceUuid == null
                    || groupWorkspaceKey == null
                    || groupWorkspaceKey.isBlank()
                    || accountId == null
                    || (operationsSession != null && (expectedTargetType == null || expectedTargetType.isBlank())))
                throw new WorkspaceAccountService.AccountNotFoundException();
            return this;
        }
    }

    private record ResolvedAccountScope(
            boolean operationsScoped,
            String targetType,
            UUID targetId,
            String scopeRef,
            String scopeName,
            Long contextVersion) {}

    private record PageOrder(String sort, String direction) {}

    public record User(
            UUID accountId,
            String displayName,
            String mobile,
            String maskedMobile,
            String loginName,
            String status,
            String credentialStatus,
            int activeAssignmentCount,
            List<Assignment> assignments,
            List<Invitation> invitationHistory,
            Long lastLoginAt,
            List<AuthenticationHistory> authenticationHistory,
            long createdAt,
            long updatedAt,
            long revision) {}

    public record Assignment(
            UUID id,
            UUID accountId,
            UUID roleId,
            String roleName,
            String serviceNodeType,
            List<OrganizationTaskPathLookup.TaskPathNode> organizationPathNodes,
            String status,
            String source,
            long revision,
            long createdAt,
            long updatedAt,
            UUID serviceNodeId) {
        public Assignment {
            organizationPathNodes = List.copyOf(organizationPathNodes);
        }
    }

    public record Invitation(UUID invitationId, String status, int generation, long expiresAt) {}

    public record CandidatePage(
            CandidateQueryMetadata metadata,
            List<CandidateOrganization> organizations,
            List<WorkspaceRoleReadback> roles) {}

    public record CandidateQueryMetadata(
            String subjectType, String queryText, int page, int pageSize, long total, UUID selectedOrganizationRef) {}

    public record CandidateOrganization(
            String serviceNodeType,
            UUID organizationRef,
            String path,
            List<OrganizationTaskPathLookup.TaskPathNode> pathNodes) {
        public CandidateOrganization {
            pathNodes = List.copyOf(pathNodes);
        }

        /** Legacy owner projections keep compiling until their wire consumer is migrated. */
        public CandidateOrganization(String serviceNodeType, UUID organizationRef, String path) {
            this(serviceNodeType, organizationRef, path, List.of());
        }
    }

    public record CandidateQuery(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            WorkspaceSessionReadback operationsSession,
            String targetType,
            UUID requestedScopeRef,
            String subjectType,
            String candidateUsage,
            String queryText,
            Integer page,
            Integer pageSize,
            UUID selectedOrganizationRef) {
        public static CandidateQuery forOperations(
                WorkspaceSessionReadback session,
                String targetType,
                UUID requestedScopeRef,
                String subjectType,
                String candidateUsage,
                String queryText,
                Integer page,
                Integer pageSize,
                UUID selectedOrganizationRef) {
            return new CandidateQuery(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    session,
                    targetType,
                    requestedScopeRef,
                    subjectType,
                    candidateUsage,
                    queryText,
                    page,
                    pageSize,
                    selectedOrganizationRef);
        }

        public static CandidateQuery forPlatform(
                UUID workspaceUuid,
                String groupWorkspaceKey,
                String targetType,
                String subjectType,
                String candidateUsage,
                String queryText,
                Integer page,
                Integer pageSize,
                UUID selectedOrganizationRef) {
            return new CandidateQuery(
                    workspaceUuid,
                    groupWorkspaceKey,
                    null,
                    targetType,
                    null,
                    subjectType,
                    candidateUsage,
                    queryText,
                    page,
                    pageSize,
                    selectedOrganizationRef);
        }

        private CandidateQuery validated() {
            if (workspaceUuid == null
                    || groupWorkspaceKey == null
                    || groupWorkspaceKey.isBlank()
                    || targetType == null
                    || subjectType == null
                    || !Set.of("ORGANIZATION", "ROLE").contains(subjectType)
                    || !Set.of("INVITATION_TARGET", "LIST_FILTER").contains(candidateUsage)
                    || ("LIST_FILTER".equals(candidateUsage) && selectedOrganizationRef != null)
                    || ("INVITATION_TARGET".equals(candidateUsage)
                            && "ROLE".equals(subjectType)
                            && selectedOrganizationRef == null))
                throw new IllegalArgumentException("invalid candidate query");
            return this;
        }
    }

    private record RawAssignment(
            UUID id,
            UUID accountId,
            UUID roleId,
            String roleName,
            String serviceNodeType,
            UUID serviceNodeId,
            String status,
            UUID sourceInvitationId,
            long revision,
            long createdAt,
            long updatedAt) {}

    public record AuthenticationHistory(UUID id, long authenticatedAt) {}

    private record AuthenticationLatest(UUID accountId, long authenticatedAt) {}

    private record AssignmentTarget(String serviceNodeType, UUID serviceNodeId) {}
}
