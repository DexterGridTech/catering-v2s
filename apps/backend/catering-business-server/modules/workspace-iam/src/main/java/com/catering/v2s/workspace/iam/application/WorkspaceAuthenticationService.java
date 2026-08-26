package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.SecureRandom;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceAuthenticationService {
    private static final long SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final ObjectMapper JSON = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceRoleService roles;
    private final OrganizationNodeLookup nodes;
    private final StoreAssignmentLookup stores;
    private final OrganizationEntityLookup entities;
    private final CommercialGroupLookup groups;
    private final WorkspaceLoginRateLimitService loginLimits;
    private final WorkspaceOtpRateLimitService otpLimits;
    private final WorkspaceStatusLookup workspaces;
    private final OrganizationVisibilityLookup visibility;
    private final WorkspaceSessionRequestCache sessionCache;
    private final OrganizationTaskPathLookup taskPaths;
    private final boolean debugCodeExposure;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    public WorkspaceAuthenticationService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceRoleService roles,
            OrganizationNodeLookup nodes,
            StoreAssignmentLookup stores,
            OrganizationEntityLookup entities) {
        this(
                jdbc,
                time,
                roles,
                nodes,
                stores,
                entities,
                legacyGroups(nodes),
                new WorkspaceLoginRateLimitService(jdbc, time),
                new WorkspaceOtpRateLimitService(jdbc, time),
                (workspaceUuid, groupWorkspaceKey) -> true,
                (workspaceUuid, groupWorkspaceKey, assignmentNodeType, assignmentNodeId, visibleNodeId) -> true,
                new WorkspaceSessionRequestCache(false),
                null,
                new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false));
    }
    /** Compatibility constructor for owner-focused tests; production must inject the exposure policy. */
    public WorkspaceAuthenticationService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceRoleService roles,
            OrganizationNodeLookup nodes,
            StoreAssignmentLookup stores,
            OrganizationEntityLookup entities,
            CommercialGroupLookup groups,
            WorkspaceLoginRateLimitService loginLimits,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceStatusLookup workspaces,
            OrganizationVisibilityLookup visibility,
            WorkspaceSessionRequestCache sessionCache,
            OrganizationTaskPathLookup taskPaths) {
        this(
                jdbc,
                time,
                roles,
                nodes,
                stores,
                entities,
                groups,
                loginLimits,
                otpLimits,
                workspaces,
                visibility,
                sessionCache,
                taskPaths,
                new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceAuthenticationService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceRoleService roles,
            OrganizationNodeLookup nodes,
            StoreAssignmentLookup stores,
            OrganizationEntityLookup entities,
            CommercialGroupLookup groups,
            WorkspaceLoginRateLimitService loginLimits,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceStatusLookup workspaces,
            OrganizationVisibilityLookup visibility,
            WorkspaceSessionRequestCache sessionCache,
            OrganizationTaskPathLookup taskPaths,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy) {
        this.jdbc = jdbc;
        this.time = time;
        this.roles = roles;
        this.nodes = nodes;
        this.stores = stores;
        this.entities = entities;
        this.groups = groups;
        this.loginLimits = loginLimits;
        this.otpLimits = otpLimits;
        this.workspaces = workspaces;
        this.visibility = visibility;
        this.sessionCache = sessionCache;
        this.taskPaths = taskPaths;
        this.debugCodeExposure = otpDebugExposurePolicy.enabled();
    }

    @Transactional(
            noRollbackFor = {
                InvalidCredentialsException.class,
                AccountDisabledException.class,
                CredentialLockedException.class,
                WorkspaceDisabledException.class,
                LoginRateLimitedException.class,
                OtpInvalidException.class,
                OtpRateLimitedException.class
            })
    public LoginResult login(String groupWorkspaceKey, String loginName, char[] password) {
        return login(groupWorkspaceKey, loginName, password, "legacy-test-source");
    }

    @Transactional(
            noRollbackFor = {
                InvalidCredentialsException.class,
                AccountDisabledException.class,
                CredentialLockedException.class,
                WorkspaceDisabledException.class,
                LoginRateLimitedException.class,
                OtpInvalidException.class,
                OtpRateLimitedException.class
            })
    public LoginResult login(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress) {
        return createSession(authenticatePassword(groupWorkspaceKey, loginName, password, sourceAddress));
    }

    @Transactional(
            noRollbackFor = {
                InvalidCredentialsException.class,
                AccountDisabledException.class,
                CredentialLockedException.class,
                WorkspaceDisabledException.class,
                LoginRateLimitedException.class,
                OtpInvalidException.class,
                OtpRateLimitedException.class
            })
    public LoginEntryResult loginWithSessionEntry(
            String groupWorkspaceKey, String loginName, char[] password, String sourceAddress) {
        return createSessionEntry(authenticatePassword(groupWorkspaceKey, loginName, password, sourceAddress));
    }

    private Account authenticatePassword(
            String groupWorkspaceKey, String loginName, char[] password, String sourceAddress) {
        WorkspaceLoginRateLimitService.Attempt attempt = loginLimits.begin(groupWorkspaceKey, loginName, sourceAddress);
        Account account = jdbc.query(
                "SELECT a.id, a.workspace_uuid, a.group_workspace_key, a.status, c.password_hash, "
                        + "c.locked_until_epoch_millis, c.password_change_required, a.display_name, gw.name, "
                        + "gw.operations_title, gw.logo_asset_ref FROM workspace_iam.workspace_account a JOIN "
                        + "workspace_iam.workspace_credential c ON c.account_id=a.id JOIN "
                        + "platform_workspace.group_workspace gw ON gw.workspace_uuid=a.workspace_uuid AND "
                        + "gw.group_workspace_key=a.group_workspace_key WHERE a.group_workspace_key=? AND "
                        + "a.login_name_normalized=?",
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, loginName == null ? "" : loginName.toLowerCase());
                },
                result -> result.next()
                        ? new Account(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getString(4),
                                result.getString(5),
                                result.getObject(6, Long.class),
                                result.getBoolean(7),
                                result.getString(8),
                                result.getString(9),
                                result.getString(10),
                                result.getString(11))
                        : null);
        if (account == null) {
            loginLimits.recordInvalid(groupWorkspaceKey, attempt);
            throw new InvalidCredentialsException();
        }
        if (!"ENABLED".equals(account.status())) {
            loginLimits.recordSourceFailure(groupWorkspaceKey, attempt);
            throw new AccountDisabledException();
        }
        if (!workspaces.isEnabled(account.workspaceUuid(), account.key())) {
            loginLimits.recordSourceFailure(groupWorkspaceKey, attempt);
            throw new WorkspaceDisabledException();
        }
        if (account.lockedUntilEpochMillis() != null && account.lockedUntilEpochMillis() > time.currentEpochMillis())
            throw new CredentialLockedException();
        if (!passwords.matches(new String(password == null ? new char[0] : password), account.passwordHash())) {
            loginLimits.recordInvalid(groupWorkspaceKey, attempt);
            jdbc.update(
                    "UPDATE workspace_iam.workspace_credential SET failed_attempts=failed_attempts+1, "
                            + "locked_until_epoch_millis=CASE WHEN failed_attempts+1>=10 THEN ? ELSE "
                            + "locked_until_epoch_millis END, version=version+1 WHERE account_id=?",
                    time.currentEpochMillis() + 15 * 60 * 1000L,
                    account.id());
            throw new InvalidCredentialsException();
        }
        loginLimits.clearAccount(groupWorkspaceKey, attempt);
        return account;
    }

    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public OtpDelivery sendLoginOtp(String groupWorkspaceKey, String mobile) {
        Account account = accountByMobile(groupWorkspaceKey, normalizedMobile(mobile));
        otpLimits.beforeSend(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
        long expires = time.currentEpochMillis() + OTP_TTL_MILLIS;
        jdbc.update(
                "UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND "
                        + "purpose='WORKSPACE_LOGIN' AND status='ACTIVE'",
                account.id());
        String otp = String.format("%06d", random.nextInt(1_000_000));
        jdbc.update(
                "INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, "
                        + "subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, ?, 'WORKSPACE_LOGIN', ?, ?, "
                        + "'ACTIVE', ?)",
                UUID.randomUUID(),
                account.workspaceUuid(),
                account.key(),
                sha256(otp),
                account.id(),
                expires);
        return new OtpDelivery(expires, debugCodeExposure ? otp : null);
    }

    @Transactional(noRollbackFor = {OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginResult verifyLoginOtp(String groupWorkspaceKey, String mobile, String otp) {
        return createSession(verifyOtp(groupWorkspaceKey, mobile, otp));
    }

    @Transactional(noRollbackFor = {OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginEntryResult verifyLoginOtpWithSessionEntry(String groupWorkspaceKey, String mobile, String otp) {
        return createSessionEntry(verifyOtp(groupWorkspaceKey, mobile, otp));
    }

    private Account verifyOtp(String groupWorkspaceKey, String mobile, String otp) {
        Account account = accountByMobile(groupWorkspaceKey, normalizedMobile(mobile));
        otpLimits.beforeVerify(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
        int consumed = jdbc.update(
                "UPDATE workspace_iam.otp_grant SET status='USED', used_at_epoch_millis=? WHERE subject_ref=? AND "
                        + "purpose='WORKSPACE_LOGIN' AND token_hash=? AND status='ACTIVE' AND "
                        + "expires_at_epoch_millis>?",
                time.currentEpochMillis(),
                account.id(),
                sha256(otp),
                time.currentEpochMillis());
        if (consumed != 1) {
            jdbc.update(
                    "UPDATE workspace_iam.otp_grant SET attempt_count=attempt_count+1 WHERE subject_ref=? AND "
                            + "purpose='WORKSPACE_LOGIN' AND status='ACTIVE'",
                    account.id());
            otpLimits.invalidVerify(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
            throw new OtpInvalidException();
        }
        otpLimits.successfulVerify(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
        return account;
    }

    @Transactional
    public WorkspaceSessionReadback selectContext(
            String rawToken, UUID assignmentId, UUID scopeNodeId, long expectedContextVersion) {
        selectContext(rawToken, assignmentId, expectedContextVersion);
        SessionRow selected = requireNormal(rawToken);
        Assignment assignment = requireAssignment(selected, assignmentId);
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = visibility
                .listVisibleDataNodeCandidates(
                        selected.workspaceUuid(), selected.key(), assignment.nodeType(), assignment.nodeId())
                .stream()
                .filter(value -> value.dataNodeId().equals(scopeNodeId))
                .findFirst()
                .orElseThrow(SessionInvalidException::new);
        selectDataNode(rawToken, candidate.dataNodeType(), scopeNodeId, selected.contextVersion());
        return session(rawToken);
    }

    @Transactional
    public WorkspaceSessionEntryReadback selectContext(
            String rawToken, UUID assignmentId, long expectedContextVersion) {
        return selectContext(rawToken, (String) null, assignmentId, expectedContextVersion);
    }

    /**
     * Changes the selected assignment while validating the route workspace key from the same fresh owner fact. The edge
     * must not first compose a full session merely to check this key: that composition loads organization visibility
     * and would duplicate the command's own invocation-local visibility read.
     */
    @Transactional
    public WorkspaceSessionEntryReadback selectContext(
            String rawToken, String expectedGroupWorkspaceKey, UUID assignmentId, long expectedContextVersion) {
        SessionRow current = requireNormal(rawToken);
        if (expectedGroupWorkspaceKey != null && !expectedGroupWorkspaceKey.equals(current.key()))
            throw new SessionInvalidException();
        if (current.contextVersion() != expectedContextVersion) throw new SessionConflictException();
        Assignment assignment = requireAssignment(current, assignmentId);
        if (!enterable(current.workspaceUuid(), current.key(), assignment.nodeType(), assignment.nodeId()))
            throw new SessionInvalidException();
        var visibleFacts = visibility.resolveSessionEntryFacts(
                current.workspaceUuid(),
                current.key(),
                assignment.nodeType(),
                assignment.nodeId(),
                current.selectedRegionId(),
                current.selectedProjectId(),
                current.selectedStoreId(),
                current.selectedHeadCompanyId());
        ScopeSelection locked = lockedSelection(visibleFacts, assignment);
        if (jdbc.update(
                        "UPDATE workspace_iam.workspace_session SET current_assignment_id=?, selected_region_id=?, "
                                + "selected_project_id=?, selected_store_id=?, selected_head_company_id=?, "
                                + "context_version=context_version+1, authorization_revision=authorization_revision+1 "
                                + "WHERE id=? AND context_version=?",
                        assignmentId,
                        locked.regionId(),
                        locked.projectId(),
                        locked.storeId(),
                        locked.headCompanyId(),
                        current.id(),
                        expectedContextVersion)
                != 1) throw new SessionConflictException();
        sessionCache.evict(rawToken);
        return sessionEntry(require(rawToken), withScopeSelection(visibleFacts, locked));
    }

    @Transactional
    public WorkspaceSessionEntryReadback selectDataNode(
            String rawToken, String dataNodeType, UUID scopeNodeId, long expectedContextVersion) {
        return selectDataNode(rawToken, null, dataNodeType, scopeNodeId, expectedContextVersion);
    }

    /**
     * Selects a data node while checking the edge workspace key in the same owner transaction. The explicit key avoids
     * a separate edge session projection; the owner still performs the complete assignment and visibility checks before
     * changing the session context.
     */
    @Transactional
    public WorkspaceSessionEntryReadback selectDataNode(
            String rawToken,
            String expectedGroupWorkspaceKey,
            String dataNodeType,
            UUID scopeNodeId,
            long expectedContextVersion) {
        SessionRow current = requireNormal(rawToken);
        if (expectedGroupWorkspaceKey != null && !expectedGroupWorkspaceKey.equals(current.key()))
            throw new SessionInvalidException();
        if (current.contextVersion() != expectedContextVersion || current.assignmentId() == null)
            throw new SessionConflictException();
        Assignment assignment = requireAssignment(current, current.assignmentId());
        var visibleFacts = visibility.resolveSessionEntryFacts(
                current.workspaceUuid(),
                current.key(),
                assignment.nodeType(),
                assignment.nodeId(),
                current.selectedRegionId(),
                current.selectedProjectId(),
                current.selectedStoreId(),
                current.selectedHeadCompanyId());
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = visibleFacts.candidates().stream()
                .filter(value -> value.dataNodeId().equals(scopeNodeId)
                        && value.dataNodeType().equals(dataNodeType))
                .findFirst()
                .orElseThrow(SessionInvalidException::new);
        ScopeSelection next = selectedScope(current, candidate);
        if (jdbc.update(
                        "UPDATE workspace_iam.workspace_session SET selected_region_id=?, selected_project_id=?, "
                                + "selected_store_id=?, selected_head_company_id=?, context_version=context_version+1, "
                                + "authorization_revision=authorization_revision+1 WHERE id=? AND context_version=?",
                        next.regionId(),
                        next.projectId(),
                        next.storeId(),
                        next.headCompanyId(),
                        current.id(),
                        expectedContextVersion)
                != 1) throw new SessionConflictException();
        sessionCache.evict(rawToken);
        SessionRow readback = require(rawToken);
        List<Assignment> activeAssignments = activeAssignments(readback);
        OrganizationTaskPathLookup.SessionTaskTargetFacts taskTargetFacts = taskPaths == null
                ? null
                : taskPaths.sessionTaskTargetFacts(
                        readback.workspaceUuid(),
                        readback.key(),
                        activeAssignments.stream()
                                .map(candidateAssignment -> new OrganizationTaskPathLookup.TaskPathRef(
                                        candidateAssignment.nodeType(), candidateAssignment.nodeId()))
                                .toList());
        List<Assignment> enterableAssignments = taskTargetFacts == null
                ? availableAssignments(readback, activeAssignments)
                : activeAssignments.stream()
                        .filter(candidateAssignment -> taskTargetFacts
                                .availableTargets()
                                .contains(new OrganizationTaskPathLookup.TaskPathRef(
                                        candidateAssignment.nodeType(), candidateAssignment.nodeId())))
                        .toList();
        Map<UUID, WorkspaceRoleReadback> rolesById = roles.requireAll(
                readback.workspaceUuid(),
                readback.key(),
                enterableAssignments.stream().map(Assignment::roleId).toList());
        return sessionEntry(
                readback, withScopeSelection(visibleFacts, next), enterableAssignments, rolesById, taskTargetFacts);
    }

    @Transactional(readOnly = true)
    public WorkspaceSessionReadback session(String rawToken) {
        return sessionCache.read(rawToken, () -> loadSession(rawToken));
    }

    /**
     * Fresh M1/M2 fact minting for an authenticated operations task read. The request cache remains reserved for the
     * legacy session projection and is never consulted here.
     */
    @Transactional(readOnly = true)
    public WorkspaceReadAuthorizationFacts readAuthorizationFacts(String rawToken) {
        ReadAuthorizationRow row = activeAuthorizationRow(rawToken);
        var visibleFacts = visibility.resolveSessionEntryFacts(
                row.workspaceUuid(),
                row.key(),
                row.assignmentNodeType(),
                row.assignmentNodeId(),
                row.selectedRegionId(),
                row.selectedProjectId(),
                row.selectedStoreId(),
                row.selectedHeadCompanyId());
        return new WorkspaceReadAuthorizationFacts(
                row.sessionId(),
                row.workspaceUuid(),
                row.key(),
                row.accountId(),
                row.assignmentId(),
                row.roleId(),
                row.assignmentNodeType(),
                row.assignmentNodeId(),
                row.contextVersion(),
                row.authorizationRevision(),
                row.accountDisplayName(),
                permissionKeys(row.pageAccessKeys()),
                permissionKeys(row.actionCapabilityKeys()),
                visibleFacts);
    }

    /**
     * Fresh command-only workspace-iam facts. This is deliberately not the read projection: command scope is later
     * judged by organization from the persisted selected IDs, so this method neither consults the request cache nor
     * expands visible organization candidates.
     */
    @Transactional(readOnly = true)
    public WorkspaceCommandAuthorizationFacts commandAuthorizationFacts(String rawToken) {
        ReadAuthorizationRow row = activeAuthorizationRow(rawToken);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                row.sessionId(),
                row.workspaceUuid(),
                row.key(),
                row.accountId(),
                row.assignmentId(),
                commandScopeContext(row),
                row.contextVersion(),
                row.authorizationRevision(),
                permissionKeys(row.pageAccessKeys()),
                permissionKeys(row.actionCapabilityKeys()),
                row.accountDisplayName(),
                row.assignmentNodeType(),
                row.assignmentNodeId());
        return new WorkspaceCommandAuthorizationFacts(
                session, row.roleId(), row.assignmentNodeType(), row.assignmentNodeId());
    }

    private ReadAuthorizationRow activeAuthorizationRow(String rawToken) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.CONTEXT_WORKSPACE_IAM,
                () -> jdbc.query(
                        "SELECT s.id, s.workspace_uuid, s.group_workspace_key, s.account_id, s.current_assignment_id, "
                                + "s.selected_region_id, s.selected_project_id, s.selected_store_id, "
                                + "s.selected_head_company_id, "
                                + "s.context_version, s.authorization_revision, a.display_name, ra.role_id, "
                                + "ra.service_node_type, "
                                + "ra.service_node_id, r.page_access_keys, r.capability_keys "
                                + "FROM workspace_iam.workspace_session s "
                                + "JOIN workspace_iam.workspace_account a ON a.id=s.account_id "
                                + "JOIN workspace_iam.role_assignment ra ON ra.id=s.current_assignment_id "
                                + "AND ra.account_id=s.account_id AND ra.workspace_uuid=s.workspace_uuid "
                                + "AND ra.group_workspace_key=s.group_workspace_key AND ra.status='ACTIVE' "
                                + "JOIN workspace_iam.workspace_role r ON r.id=ra.role_id AND "
                                + "r.workspace_uuid=s.workspace_uuid "
                                + "AND r.group_workspace_key=s.group_workspace_key AND r.status='ENABLED' "
                                + "WHERE s.token_hash=? AND s.status='ACTIVE' AND s.expires_at_epoch_millis>?",
                        statement -> {
                            statement.setString(1, sha256(rawToken));
                            statement.setLong(2, time.currentEpochMillis());
                        },
                        result -> {
                            if (!result.next()) throw new SessionInvalidException();
                            return new ReadAuthorizationRow(
                                    result.getObject(1, UUID.class),
                                    result.getObject(2, UUID.class),
                                    result.getString(3),
                                    result.getObject(4, UUID.class),
                                    result.getObject(5, UUID.class),
                                    result.getObject(6, UUID.class),
                                    result.getObject(7, UUID.class),
                                    result.getObject(8, UUID.class),
                                    result.getObject(9, UUID.class),
                                    result.getLong(10),
                                    result.getLong(11),
                                    result.getString(12),
                                    result.getObject(13, UUID.class),
                                    result.getString(14),
                                    result.getObject(15, UUID.class),
                                    result.getString(16),
                                    result.getString(17));
                        }));
    }

    private static WorkspaceSessionEntryReadback.ScopeContext commandScopeContext(ReadAuthorizationRow row) {
        return new WorkspaceSessionEntryReadback.ScopeContext(
                commandScopeNode(ServiceNodeTypes.REGION, row.selectedRegionId()),
                commandScopeNode(ServiceNodeTypes.PROJECT, row.selectedProjectId()),
                commandScopeNode(ServiceNodeTypes.STORE, row.selectedStoreId()),
                commandScopeNode(ServiceNodeTypes.HEAD_COMPANY, row.selectedHeadCompanyId()));
    }

    private static WorkspaceSessionEntryReadback.VisibleDataNodeCandidate commandScopeNode(String type, UUID id) {
        return id == null
                ? null
                : new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        type, id, null, null, List.of(), null, null, null, null);
    }

    /** Restricted read used only by the password-change edge route. */
    @Transactional(readOnly = true)
    public WorkspaceSessionReadback sessionForPasswordChange(String rawToken) {
        SessionRow row = require(rawToken);
        return new WorkspaceSessionReadback(
                row.id(),
                row.workspaceUuid(),
                row.key(),
                row.accountId(),
                null,
                WorkspaceSessionEntryReadback.ScopeContext.empty(),
                row.contextVersion(),
                row.authorizationRevision(),
                Set.of(),
                Set.of(),
                row.accountDisplayName());
    }

    private WorkspaceSessionReadback loadSession(String rawToken) {
        SessionRow row = requireNormal(rawToken);
        if (row.assignmentId() == null)
            return new WorkspaceSessionReadback(
                    row.id(),
                    row.workspaceUuid(),
                    row.key(),
                    row.accountId(),
                    null,
                    scopeContext(row),
                    row.contextVersion(),
                    row.authorizationRevision(),
                    Set.of(),
                    Set.of(),
                    row.accountDisplayName());
        UUID roleId = jdbc.queryForObject(
                "SELECT role_id FROM workspace_iam.role_assignment WHERE id=? AND status='ACTIVE'",
                UUID.class,
                row.assignmentId());
        var role = roles.require(row.workspaceUuid(), row.key(), roleId);
        return new WorkspaceSessionReadback(
                row.id(),
                row.workspaceUuid(),
                row.key(),
                row.accountId(),
                row.assignmentId(),
                scopeContext(row),
                row.contextVersion(),
                row.authorizationRevision(),
                role.pageAccessKeys(),
                role.actionCapabilityKeys(),
                row.accountDisplayName());
    }

    @Transactional(readOnly = true)
    public WorkspaceSessionEntryReadback sessionEntry(String rawToken) {
        return sessionEntry(sessionEntryAuthenticationFacts(rawToken).canonicalEntryInput());
    }

    /** A path-key guard belongs with the session owner, not with an edge-local pre-read. */
    @Transactional(readOnly = true)
    public WorkspaceSessionEntryReadback sessionEntry(String rawToken, String groupWorkspaceKey) {
        SessionEntryAuthenticationFacts facts = sessionEntryAuthenticationFacts(rawToken);
        if (!facts.key().equals(groupWorkspaceKey)) throw new SessionInvalidException();
        return sessionEntry(facts.canonicalEntryInput());
    }

    private WorkspaceSessionEntryReadback sessionEntry(SessionRow row) {
        return sessionEntry(row, null, null, null, null);
    }

    private WorkspaceSessionEntryReadback sessionEntry(
            SessionRow row, OrganizationVisibilityLookup.VisibleOrganizationFacts suppliedVisibleFacts) {
        return sessionEntry(row, suppliedVisibleFacts, null, null, null);
    }

    private WorkspaceSessionEntryReadback sessionEntry(
            SessionRow row,
            OrganizationVisibilityLookup.VisibleOrganizationFacts suppliedVisibleFacts,
            List<Assignment> suppliedEnterableAssignments) {
        return sessionEntry(row, suppliedVisibleFacts, suppliedEnterableAssignments, null, null);
    }

    private WorkspaceSessionEntryReadback sessionEntry(
            SessionRow row,
            OrganizationVisibilityLookup.VisibleOrganizationFacts suppliedVisibleFacts,
            List<Assignment> suppliedEnterableAssignments,
            Map<UUID, WorkspaceRoleReadback> suppliedRolesById,
            OrganizationTaskPathLookup.SessionTaskTargetFacts suppliedTaskTargetFacts) {
        if (row.passwordChangeRequired()) {
            return new WorkspaceSessionEntryReadback(
                    row.key(),
                    row.accountId(),
                    row.accountDisplayName(),
                    row.workspaceName(),
                    row.operationsTitle(),
                    row.logoAssetRef(),
                    row.contextVersion(),
                    WorkspaceSessionEntryReadback.Mode.EMPTY,
                    WorkspaceSessionEntryReadback.Outcome.PASSWORD_CHANGE_REQUIRED,
                    List.of(),
                    Set.of(),
                    List.of(),
                    null,
                    null);
        }
        List<Assignment> enterableAssignments = suppliedEnterableAssignments == null
                ? availableAssignments(row, activeAssignments(row))
                : suppliedEnterableAssignments;
        Map<UUID, WorkspaceRoleReadback> rolesById = suppliedRolesById == null
                ? roles.requireAll(
                        row.workspaceUuid(),
                        row.key(),
                        enterableAssignments.stream().map(Assignment::roleId).toList())
                : suppliedRolesById;
        Map<OrganizationTaskPathLookup.TaskPathRef, String> labels = taskPaths == null
                ? Map.of()
                : suppliedTaskTargetFacts == null
                        ? taskPaths.describeTaskTargetLabels(
                                row.workspaceUuid(),
                                row.key(),
                                enterableAssignments.stream()
                                        .map(assignment -> new OrganizationTaskPathLookup.TaskPathRef(
                                                assignment.nodeType(), assignment.nodeId()))
                                        .toList())
                        : suppliedTaskTargetFacts.labels();
        List<WorkspaceSessionEntryReadback.RoleAssignmentCandidate> candidates = enterableAssignments.stream()
                .map(assignment -> candidate(row, assignment, rolesById.get(assignment.roleId()), labels))
                .sorted(Comparator.comparing(WorkspaceSessionEntryReadback.RoleAssignmentCandidate::roleName)
                        .thenComparing(value -> value.roleAssignmentId().toString()))
                .toList();
        WorkspaceSessionEntryReadback.RoleAssignmentCandidate selected = candidates.stream()
                .filter(candidate -> candidate.roleAssignmentId().equals(row.assignmentId()))
                .findFirst()
                .orElse(null);
        if (candidates.isEmpty()) {
            return new WorkspaceSessionEntryReadback(
                    row.key(),
                    row.accountId(),
                    row.accountDisplayName(),
                    row.workspaceName(),
                    row.operationsTitle(),
                    row.logoAssetRef(),
                    row.contextVersion(),
                    WorkspaceSessionEntryReadback.Mode.EMPTY,
                    WorkspaceSessionEntryReadback.Outcome.EMPTY_WORKBENCH,
                    List.of(),
                    Set.of(),
                    List.of(),
                    null,
                    null);
        }
        if (selected == null) {
            return new WorkspaceSessionEntryReadback(
                    row.key(),
                    row.accountId(),
                    row.accountDisplayName(),
                    row.workspaceName(),
                    row.operationsTitle(),
                    row.logoAssetRef(),
                    row.contextVersion(),
                    WorkspaceSessionEntryReadback.Mode.SELECT,
                    WorkspaceSessionEntryReadback.Outcome.SELECT_IDENTITY,
                    candidates,
                    Set.of(),
                    List.of(),
                    null,
                    null);
        }
        Assignment assignment = enterableAssignments.stream()
                .filter(value -> value.id().equals(selected.roleAssignmentId()))
                .findFirst()
                .orElseThrow(SessionInvalidException::new);
        OrganizationVisibilityLookup.VisibleOrganizationFacts visibleFacts = suppliedVisibleFacts == null
                ? visibility.resolveSessionEntryFacts(
                        row.workspaceUuid(),
                        row.key(),
                        assignment.nodeType(),
                        assignment.nodeId(),
                        row.selectedRegionId(),
                        row.selectedProjectId(),
                        row.selectedStoreId(),
                        row.selectedHeadCompanyId())
                : suppliedVisibleFacts;
        List<WorkspaceSessionEntryReadback.VisibleDataNodeCandidate> dataNodes = visibleFacts.candidates().stream()
                .map(value -> new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        value.dataNodeType(),
                        value.dataNodeId(),
                        value.dataNodeName(),
                        value.dataNodeCode(),
                        value.ancestorPath(),
                        value.regionId(),
                        value.projectId(),
                        value.storeId(),
                        value.headCompanyId()))
                .toList();
        WorkspaceSessionEntryReadback.ScopeContext scopeContext =
                scopeContext(row, dataNodes, visibleFacts.scopeContext());
        boolean scopeRequired =
                selected.navigation().stream().anyMatch(item -> !"NONE".equals(item.requiredDataNodeType()));
        WorkspaceSessionEntryReadback.Mode mode = candidates.size() == 1
                ? WorkspaceSessionEntryReadback.Mode.DIRECT
                : WorkspaceSessionEntryReadback.Mode.SELECT;
        WorkspaceSessionEntryReadback.Outcome outcome = scopeRequired
                        && selected.navigation().stream()
                                .anyMatch(item -> !"NONE".equals(item.requiredDataNodeType())
                                        && scopeContext.selectionFor(item.requiredDataNodeType()) == null)
                ? WorkspaceSessionEntryReadback.Outcome.SELECT_SCOPE
                : WorkspaceSessionEntryReadback.Outcome.HOME;
        return new WorkspaceSessionEntryReadback(
                row.key(),
                row.accountId(),
                row.accountDisplayName(),
                row.workspaceName(),
                row.operationsTitle(),
                row.logoAssetRef(),
                row.contextVersion(),
                mode,
                outcome,
                candidates,
                selected.actionGrants(),
                dataNodes,
                selected,
                scopeContext);
    }

    @Transactional
    public void logout(String rawToken) {
        jdbc.update(
                "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=?, "
                        + "selected_region_id=NULL, selected_project_id=NULL, selected_store_id=NULL, "
                        + "selected_head_company_id=NULL WHERE token_hash=? AND status='ACTIVE'",
                time.currentEpochMillis(),
                sha256(rawToken));
        sessionCache.evict(rawToken);
    }

    /** Current-account rotation revokes all operations sessions after CAS on the current context version. */
    @Transactional
    public PasswordChangeResult changeCurrentPassword(
            String rawToken, char[] currentPassword, char[] newPassword, long expectedSessionVersion) {
        if (newPassword == null || newPassword.length < 8) throw new InvalidCredentialsException();
        SessionCredential current = jdbc.query(
                "SELECT s.id, s.account_id, s.context_version, c.password_hash, c.version FROM "
                        + "workspace_iam.workspace_session s JOIN workspace_iam.workspace_credential c ON "
                        + "c.account_id=s.account_id WHERE s.token_hash=? AND s.status='ACTIVE' AND "
                        + "s.expires_at_epoch_millis>?",
                statement -> {
                    statement.setString(1, sha256(rawToken));
                    statement.setLong(2, time.currentEpochMillis());
                },
                result -> {
                    if (!result.next()) throw new SessionInvalidException();
                    return new SessionCredential(
                            result.getObject(1, UUID.class),
                            result.getObject(2, UUID.class),
                            result.getLong(3),
                            result.getString(4),
                            result.getLong(5));
                });
        if (current.contextVersion() != expectedSessionVersion) throw new SessionConflictException();
        if (!passwords.matches(
                new String(currentPassword == null ? new char[0] : currentPassword), current.passwordHash()))
            throw new InvalidCredentialsException();
        long now = time.currentEpochMillis();
        if (jdbc.update(
                        "UPDATE workspace_iam.workspace_credential c SET password_hash=?, changed_at_epoch_millis=?, "
                                + "failed_attempts=0, locked_until_epoch_millis=NULL, password_change_required=FALSE, "
                                + "version=version+1 WHERE c.account_id=? AND c.version=? AND EXISTS (SELECT 1 FROM "
                                + "workspace_iam.workspace_session s WHERE s.id=? AND s.status='ACTIVE' AND "
                                + "s.expires_at_epoch_millis>?)",
                        passwords.encode(new String(newPassword)),
                        now,
                        current.accountId(),
                        current.credentialVersion(),
                        current.sessionId(),
                        now)
                != 1) throw new SessionConflictException();
        jdbc.update(
                "UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=?, "
                        + "selected_region_id=NULL, selected_project_id=NULL, selected_store_id=NULL, "
                        + "selected_head_company_id=NULL WHERE account_id=? AND status='ACTIVE'",
                now,
                current.accountId());
        return new PasswordChangeResult("COMPLETED", true, true);
    }

    private LoginResult createSession(Account account) {
        CreatedSession created = createRawSession(account);
        if (account.passwordChangeRequired()) throw new PasswordChangeRequiredException();
        WorkspaceSessionReadback readback;
        if (created.selectedAssignment() == null) {
            readback = new WorkspaceSessionReadback(
                    created.sessionId(),
                    account.workspaceUuid(),
                    account.key(),
                    account.id(),
                    null,
                    WorkspaceSessionEntryReadback.ScopeContext.empty(),
                    1L,
                    1L,
                    Set.of(),
                    Set.of(),
                    account.displayName());
        } else {
            WorkspaceRoleReadback role = roles.require(
                    account.workspaceUuid(),
                    account.key(),
                    created.selectedAssignment().roleId());
            readback = new WorkspaceSessionReadback(
                    created.sessionId(),
                    account.workspaceUuid(),
                    account.key(),
                    account.id(),
                    created.selectedAssignment().id(),
                    readbackScopeContext(created),
                    1L,
                    1L,
                    role.pageAccessKeys(),
                    role.actionCapabilityKeys(),
                    account.displayName());
        }
        return new LoginResult(created.rawToken(), readback);
    }

    private LoginEntryResult createSessionEntry(Account account) {
        CreatedSession created = createRawSession(account);
        SessionRow session = require(created.rawToken());
        if (!session.key().equals(account.key())) throw new SessionInvalidException();
        return new LoginEntryResult(
                created.rawToken(), sessionEntry(session, created.visibleFacts(), created.enterableAssignments()));
    }

    private CreatedSession createRawSession(Account account) {
        List<Assignment> assignments = jdbc.query(
                "SELECT a.id, a.role_id, a.service_node_type, a.service_node_id FROM workspace_iam.role_assignment a "
                        + "JOIN workspace_iam.workspace_role r ON r.id=a.role_id WHERE a.account_id=? AND "
                        + "a.workspace_uuid=? AND a.group_workspace_key=? AND a.status='ACTIVE' AND r.status='ENABLED'",
                (row, index) -> new Assignment(
                        row.getObject(1, UUID.class),
                        row.getObject(2, UUID.class),
                        row.getString(3),
                        row.getObject(4, UUID.class)),
                account.id(),
                account.workspaceUuid(),
                account.key());
        List<Assignment> enterable = availableAssignments(account.workspaceUuid(), account.key(), assignments);
        Assignment selected = enterable.size() == 1 ? enterable.getFirst() : null;
        LockedSelection locked = selected == null
                ? LockedSelection.empty()
                : lockedSelection(account.workspaceUuid(), account.key(), selected);
        String raw = rawToken();
        UUID sessionId = UUID.randomUUID();
        long now = time.currentEpochMillis();
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, "
                        + "token_hash, current_assignment_id, selected_region_id, selected_project_id, "
                        + "selected_store_id, "
                        + "selected_head_company_id, context_version, authorization_revision, status, "
                        + "expires_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'ACTIVE', ?)",
                sessionId,
                account.workspaceUuid(),
                account.key(),
                account.id(),
                sha256(raw),
                selected == null ? null : selected.id(),
                locked.selection().regionId(),
                locked.selection().projectId(),
                locked.selection().storeId(),
                locked.selection().headCompanyId(),
                now + SESSION_TTL_MILLIS);
        jdbc.update(
                "INSERT INTO workspace_iam.workspace_authentication_history (id, workspace_uuid, group_workspace_key, "
                        + "account_id, authenticated_at_epoch_millis) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                account.workspaceUuid(),
                account.key(),
                account.id(),
                now);
        return new CreatedSession(raw, sessionId, selected, locked.visibleFacts(), enterable);
    }

    private Account accountByMobile(String groupWorkspaceKey, String mobile) {
        Account account = jdbc.query(
                "SELECT a.id, a.workspace_uuid, a.group_workspace_key, a.status, c.password_change_required, "
                        + "a.display_name, gw.name, gw.operations_title, gw.logo_asset_ref FROM "
                        + "workspace_iam.workspace_account a JOIN workspace_iam.workspace_credential c ON "
                        + "c.account_id=a.id JOIN platform_workspace.group_workspace gw ON "
                        + "gw.workspace_uuid=a.workspace_uuid AND gw.group_workspace_key=a.group_workspace_key WHERE "
                        + "a.group_workspace_key=? AND a.mobile_normalized=?",
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                    statement.setString(2, mobile);
                },
                result -> result.next()
                        ? new Account(
                                result.getObject(1, UUID.class),
                                result.getObject(2, UUID.class),
                                result.getString(3),
                                result.getString(4),
                                null,
                                null,
                                result.getBoolean(5),
                                result.getString(6),
                                result.getString(7),
                                result.getString(8),
                                result.getString(9))
                        : null);
        if (account == null) throw new InvalidCredentialsException();
        if (!"ENABLED".equals(account.status())) throw new AccountDisabledException();
        if (!workspaces.isEnabled(account.workspaceUuid(), account.key())) throw new WorkspaceDisabledException();
        return account;
    }
    /** Fresh owner-local fact for canonical session-entry composition; this path never consults the request cache. */
    private SessionEntryAuthenticationFacts sessionEntryAuthenticationFacts(String rawToken) {
        return sessionEntryAuthenticationFacts(ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.CONTEXT_WORKSPACE_IAM, () -> require(rawToken)));
    }

    private static SessionEntryAuthenticationFacts sessionEntryAuthenticationFacts(SessionRow row) {
        return new SessionEntryAuthenticationFacts(
                row.id(),
                row.workspaceUuid(),
                row.key(),
                row.accountId(),
                row.assignmentId(),
                row.selectedRegionId(),
                row.selectedProjectId(),
                row.selectedStoreId(),
                row.selectedHeadCompanyId(),
                row.contextVersion(),
                row.authorizationRevision(),
                row.accountDisplayName(),
                row.workspaceName(),
                row.operationsTitle(),
                row.logoAssetRef(),
                row.passwordChangeRequired());
    }

    private SessionRow require(String raw) {
        return jdbc.query(
                "SELECT s.id, s.workspace_uuid, s.group_workspace_key, s.account_id, s.current_assignment_id, "
                        + "s.selected_region_id, s.selected_project_id, s.selected_store_id, "
                        + "s.selected_head_company_id, "
                        + "s.context_version, s.authorization_revision, a.display_name, gw.name, gw.operations_title, "
                        + "gw.logo_asset_ref, c.password_change_required FROM workspace_iam.workspace_session s JOIN "
                        + "workspace_iam.workspace_account a ON a.id=s.account_id JOIN "
                        + "workspace_iam.workspace_credential "
                        + "c ON c.account_id=a.id JOIN platform_workspace.group_workspace gw ON "
                        + "gw.workspace_uuid=s.workspace_uuid AND gw.group_workspace_key=s.group_workspace_key WHERE "
                        + "s.token_hash=? AND s.status='ACTIVE' AND s.expires_at_epoch_millis>?",
                statement -> {
                    statement.setString(1, sha256(raw));
                    statement.setLong(2, time.currentEpochMillis());
                },
                result -> {
                    if (!result.next()) throw new SessionInvalidException();
                    return new SessionRow(
                            result.getObject(1, UUID.class),
                            result.getObject(2, UUID.class),
                            result.getString(3),
                            result.getObject(4, UUID.class),
                            result.getObject(5, UUID.class),
                            result.getObject(6, UUID.class),
                            result.getObject(7, UUID.class),
                            result.getObject(8, UUID.class),
                            result.getObject(9, UUID.class),
                            result.getLong(10),
                            result.getLong(11),
                            result.getString(12),
                            result.getString(13),
                            result.getString(14),
                            result.getString(15),
                            result.getBoolean(16));
                });
    }

    private SessionRow requireNormal(String raw) {
        SessionRow row = require(raw);
        if (row.passwordChangeRequired()) throw new PasswordChangeRequiredException();
        return row;
    }

    private boolean enterable(UUID workspace, String key, String type, UUID node) {
        if (!isSupportedServiceNodeType(type)) throw new SessionInvalidException();
        return switch (type) {
            case ServiceNodeTypes.STORE -> stores.isEnterableStore(workspace, key, node);
            case ServiceNodeTypes.HEAD_COMPANY -> entities.isEnterableEntity(
                    workspace, key, ServiceNodeTypes.HEAD_COMPANY, node);
            case ServiceNodeTypes.GROUP -> groups.isEnterableCommercialGroup(workspace, key, node);
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.isEnterable(workspace, key, node);
            default -> throw new SessionInvalidException();
        };
    }

    static boolean isSupportedServiceNodeType(String type) {
        if (type == null) return false;
        return switch (type) {
            case ServiceNodeTypes.GROUP,
                    ServiceNodeTypes.REGION,
                    ServiceNodeTypes.PROJECT,
                    ServiceNodeTypes.HEAD_COMPANY,
                    ServiceNodeTypes.STORE -> true;
            default -> false;
        };
    }

    private ScopeSelection lockedSelection(SessionRow current, Assignment assignment) {
        return lockedSelection(current.workspaceUuid(), current.key(), assignment)
                .selection();
    }

    private LockedSelection lockedSelection(UUID workspaceUuid, String key, Assignment assignment) {
        if (ServiceNodeTypes.GROUP.equals(assignment.nodeType())) return LockedSelection.empty();
        OrganizationVisibilityLookup.VisibleOrganizationFacts facts = visibility.resolveSessionEntryFacts(
                workspaceUuid, key, assignment.nodeType(), assignment.nodeId(), null, null, null, null);
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = facts.candidates().stream()
                .filter(value -> value.dataNodeId().equals(assignment.nodeId()))
                .findFirst()
                .orElseThrow(SessionInvalidException::new);
        ScopeSelection selection = selectionFor(candidate, null);
        return new LockedSelection(selection, facts);
    }

    private static ScopeSelection lockedSelection(
            OrganizationVisibilityLookup.VisibleOrganizationFacts facts, Assignment assignment) {
        if (ServiceNodeTypes.GROUP.equals(assignment.nodeType())) return ScopeSelection.empty();
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = facts.candidates().stream()
                .filter(value -> value.dataNodeId().equals(assignment.nodeId()))
                .findFirst()
                .orElseThrow(SessionInvalidException::new);
        return selectionFor(candidate, null);
    }

    private static OrganizationVisibilityLookup.VisibleOrganizationFacts withScopeSelection(
            OrganizationVisibilityLookup.VisibleOrganizationFacts facts, ScopeSelection selection) {
        return new OrganizationVisibilityLookup.VisibleOrganizationFacts(
                facts.candidates(),
                new OrganizationVisibilityLookup.ScopeContext(
                        findVisible(facts, ServiceNodeTypes.REGION, selection.regionId()),
                        findVisible(facts, ServiceNodeTypes.PROJECT, selection.projectId()),
                        findVisible(facts, ServiceNodeTypes.STORE, selection.storeId()),
                        findVisible(facts, ServiceNodeTypes.HEAD_COMPANY, selection.headCompanyId())));
    }

    private static OrganizationVisibilityLookup.VisibleDataNodeCandidate findVisible(
            OrganizationVisibilityLookup.VisibleOrganizationFacts facts, String type, UUID id) {
        if (id == null) return null;
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = facts.candidates().stream()
                .filter(value -> type.equals(value.dataNodeType()) && id.equals(value.dataNodeId()))
                .findFirst()
                .orElse(null);
        if (candidate != null) return candidate;
        OrganizationVisibilityLookup.ScopeContext scope = facts.scopeContext();
        return java.util.stream.Stream.of(scope.region(), scope.project(), scope.store(), scope.headCompany())
                .filter(java.util.Objects::nonNull)
                .filter(value -> type.equals(value.dataNodeType()) && id.equals(value.dataNodeId()))
                .findFirst()
                .orElse(null);
    }

    private ScopeSelection selectedScope(
            SessionRow current, OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate) {
        return selectionFor(
                candidate,
                new ScopeSelection(
                        current.selectedRegionId(),
                        current.selectedProjectId(),
                        current.selectedStoreId(),
                        current.selectedHeadCompanyId()));
    }

    private static ScopeSelection selectionFor(
            OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate, ScopeSelection current) {
        ScopeSelection base = current == null ? ScopeSelection.empty() : current;
        return switch (candidate.dataNodeType()) {
            case ServiceNodeTypes.REGION -> new ScopeSelection(candidate.regionId(), null, null, base.headCompanyId());
            case ServiceNodeTypes.PROJECT -> new ScopeSelection(
                    candidate.regionId(), candidate.projectId(), null, base.headCompanyId());
            case ServiceNodeTypes.STORE -> new ScopeSelection(
                    candidate.regionId(), candidate.projectId(), candidate.storeId(), candidate.headCompanyId());
            case ServiceNodeTypes.HEAD_COMPANY -> new ScopeSelection(
                    base.regionId(), base.projectId(), base.storeId(), candidate.headCompanyId());
            default -> throw new SessionInvalidException();
        };
    }

    private List<OrganizationVisibilityLookup.VisibleDataNodeCandidate> visibleCandidates(
            SessionRow row, Assignment assignment) {
        return visibility.listVisibleDataNodeCandidates(
                row.workspaceUuid(), row.key(), assignment.nodeType(), assignment.nodeId());
    }

    private WorkspaceSessionEntryReadback.ScopeContext scopeContext(SessionRow row) {
        if (row.assignmentId() == null) return WorkspaceSessionEntryReadback.ScopeContext.empty();
        Assignment assignment = requireAssignment(row, row.assignmentId());
        return scopeContext(
                row,
                visibleCandidates(row, assignment).stream()
                        .map(value -> new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                                value.dataNodeType(),
                                value.dataNodeId(),
                                value.dataNodeName(),
                                value.dataNodeCode(),
                                value.ancestorPath(),
                                value.regionId(),
                                value.projectId(),
                                value.storeId(),
                                value.headCompanyId()))
                        .toList());
    }

    private WorkspaceSessionEntryReadback.ScopeContext scopeContext(
            SessionRow row, List<WorkspaceSessionEntryReadback.VisibleDataNodeCandidate> candidates) {
        return scopeContext(
                row,
                candidates,
                visibility.describeScopeContext(
                        row.workspaceUuid(),
                        row.key(),
                        row.selectedRegionId(),
                        row.selectedProjectId(),
                        row.selectedStoreId(),
                        row.selectedHeadCompanyId()));
    }

    private WorkspaceSessionEntryReadback.ScopeContext scopeContext(
            SessionRow row,
            List<WorkspaceSessionEntryReadback.VisibleDataNodeCandidate> candidates,
            OrganizationVisibilityLookup.ScopeContext ownerContext) {
        WorkspaceSessionEntryReadback.ScopeContext fallback = new WorkspaceSessionEntryReadback.ScopeContext(
                findCandidate(candidates, ServiceNodeTypes.REGION, row.selectedRegionId()),
                findCandidate(candidates, ServiceNodeTypes.PROJECT, row.selectedProjectId()),
                findCandidate(candidates, ServiceNodeTypes.STORE, row.selectedStoreId()),
                findCandidate(candidates, ServiceNodeTypes.HEAD_COMPANY, row.selectedHeadCompanyId()));
        return new WorkspaceSessionEntryReadback.ScopeContext(
                ownerContext.region() == null ? fallback.region() : scopeNode(ownerContext.region()),
                ownerContext.project() == null ? fallback.project() : scopeNode(ownerContext.project()),
                ownerContext.store() == null ? fallback.store() : scopeNode(ownerContext.store()),
                ownerContext.headCompany() == null ? fallback.headCompany() : scopeNode(ownerContext.headCompany()));
    }

    private static WorkspaceSessionEntryReadback.ScopeContext readbackScopeContext(CreatedSession created) {
        if (created.visibleFacts() == null) return WorkspaceSessionEntryReadback.ScopeContext.empty();
        List<WorkspaceSessionEntryReadback.VisibleDataNodeCandidate> candidates =
                created.visibleFacts().candidates().stream()
                        .map(WorkspaceAuthenticationService::readbackCandidate)
                        .toList();
        ScopeSelection selection = selectionForVisibleFacts(created.visibleFacts(), created.selectedAssignment());
        OrganizationVisibilityLookup.ScopeContext ownerContext =
                created.visibleFacts().scopeContext();
        return new WorkspaceSessionEntryReadback.ScopeContext(
                ownerContext.region() == null
                        ? findCandidate(candidates, ServiceNodeTypes.REGION, selection.regionId())
                        : readbackCandidate(ownerContext.region()),
                ownerContext.project() == null
                        ? findCandidate(candidates, ServiceNodeTypes.PROJECT, selection.projectId())
                        : readbackCandidate(ownerContext.project()),
                ownerContext.store() == null
                        ? findCandidate(candidates, ServiceNodeTypes.STORE, selection.storeId())
                        : readbackCandidate(ownerContext.store()),
                ownerContext.headCompany() == null
                        ? findCandidate(candidates, ServiceNodeTypes.HEAD_COMPANY, selection.headCompanyId())
                        : readbackCandidate(ownerContext.headCompany()));
    }

    private static ScopeSelection selectionForVisibleFacts(
            OrganizationVisibilityLookup.VisibleOrganizationFacts facts, Assignment assignment) {
        if (assignment == null || ServiceNodeTypes.GROUP.equals(assignment.nodeType())) return ScopeSelection.empty();
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = facts.candidates().stream()
                .filter(value -> value.dataNodeId().equals(assignment.nodeId()))
                .findFirst()
                .orElseThrow(SessionInvalidException::new);
        return selectionFor(candidate, null);
    }

    private static WorkspaceSessionEntryReadback.VisibleDataNodeCandidate readbackCandidate(
            OrganizationVisibilityLookup.VisibleDataNodeCandidate value) {
        return new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                value.dataNodeType(),
                value.dataNodeId(),
                value.dataNodeName(),
                value.dataNodeCode(),
                value.ancestorPath(),
                value.regionId(),
                value.projectId(),
                value.storeId(),
                value.headCompanyId());
    }

    private static WorkspaceSessionEntryReadback.VisibleDataNodeCandidate scopeNode(
            OrganizationVisibilityLookup.VisibleDataNodeCandidate value) {
        return new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                value.dataNodeType(),
                value.dataNodeId(),
                value.dataNodeName(),
                value.dataNodeCode(),
                value.ancestorPath(),
                value.regionId(),
                value.projectId(),
                value.storeId(),
                value.headCompanyId());
    }

    private static WorkspaceSessionEntryReadback.VisibleDataNodeCandidate findCandidate(
            List<WorkspaceSessionEntryReadback.VisibleDataNodeCandidate> candidates, String type, UUID id) {
        return id == null
                ? null
                : candidates.stream()
                        .filter(value -> type.equals(value.dataNodeType()) && id.equals(value.dataNodeId()))
                        .findFirst()
                        .orElse(null);
    }

    private Assignment requireAssignment(SessionRow current, UUID assignmentId) {
        return jdbc.query(
                "SELECT a.id, a.role_id, a.service_node_type, a.service_node_id FROM workspace_iam.role_assignment a "
                        + "JOIN workspace_iam.workspace_role r ON r.id=a.role_id WHERE a.id=? AND a.account_id=? AND "
                        + "a.workspace_uuid=? AND a.group_workspace_key=? AND a.status='ACTIVE' AND r.status='ENABLED'",
                statement -> {
                    statement.setObject(1, assignmentId);
                    statement.setObject(2, current.accountId());
                    statement.setObject(3, current.workspaceUuid());
                    statement.setString(4, current.key());
                },
                result -> {
                    if (!result.next()) throw new SessionInvalidException();
                    return new Assignment(
                            result.getObject(1, UUID.class),
                            result.getObject(2, UUID.class),
                            result.getString(3),
                            result.getObject(4, UUID.class));
                });
    }

    private List<Assignment> activeAssignments(SessionRow current) {
        return jdbc.query(
                "SELECT a.id, a.role_id, a.service_node_type, a.service_node_id FROM workspace_iam.role_assignment a "
                        + "JOIN workspace_iam.workspace_role r ON r.id=a.role_id WHERE a.account_id=? AND "
                        + "a.workspace_uuid=? AND a.group_workspace_key=? AND a.status='ACTIVE' AND r.status='ENABLED'",
                (row, index) -> new Assignment(
                        row.getObject(1, UUID.class),
                        row.getObject(2, UUID.class),
                        row.getString(3),
                        row.getObject(4, UUID.class)),
                current.accountId(),
                current.workspaceUuid(),
                current.key());
    }

    private List<Assignment> availableAssignments(SessionRow current, List<Assignment> assignments) {
        return availableAssignments(current.workspaceUuid(), current.key(), assignments);
    }

    private List<Assignment> availableAssignments(UUID workspaceUuid, String key, List<Assignment> assignments) {
        if (taskPaths == null)
            return assignments.stream()
                    .filter(assignment -> enterable(workspaceUuid, key, assignment.nodeType(), assignment.nodeId()))
                    .toList();
        Set<OrganizationTaskPathLookup.TaskPathRef> available = taskPaths.availableTaskTargets(
                workspaceUuid,
                key,
                assignments.stream()
                        .map(assignment ->
                                new OrganizationTaskPathLookup.TaskPathRef(assignment.nodeType(), assignment.nodeId()))
                        .toList());
        return assignments.stream()
                .filter(assignment -> available.contains(
                        new OrganizationTaskPathLookup.TaskPathRef(assignment.nodeType(), assignment.nodeId())))
                .toList();
    }

    private WorkspaceSessionEntryReadback.RoleAssignmentCandidate candidate(
            SessionRow row,
            Assignment assignment,
            WorkspaceRoleReadback role,
            Map<OrganizationTaskPathLookup.TaskPathRef, String> labels) {
        if (role == null) throw new SessionInvalidException();
        String home = homePage(assignment.nodeType());
        LinkedHashSet<String> pageKeys = new LinkedHashSet<>();
        pageKeys.add(home);
        role.pageAccessKeys().stream()
                .sorted(Comparator.comparingInt(this::pageOrder).thenComparing(String::compareTo))
                .forEach(pageKeys::add);
        List<WorkspaceSessionEntryReadback.NavigationItem> navigation =
                pageKeys.stream().map(this::navigation).toList();
        return new WorkspaceSessionEntryReadback.RoleAssignmentCandidate(
                assignment.id(),
                role.id(),
                role.name(),
                assignment.nodeId(),
                assignment.nodeType(),
                nodeName(row.workspaceUuid(), row.key(), assignment.nodeType(), assignment.nodeId(), labels),
                home,
                List.copyOf(pageKeys),
                navigation,
                Set.copyOf(role.actionCapabilityKeys()));
    }

    private String nodeName(
            UUID workspaceUuid,
            String key,
            String type,
            UUID nodeId,
            Map<OrganizationTaskPathLookup.TaskPathRef, String> labels) {
        if (taskPaths != null) {
            String label = labels.get(new OrganizationTaskPathLookup.TaskPathRef(type, nodeId));
            if (label == null) throw new SessionInvalidException();
            return label;
        }
        return switch (type) {
            case ServiceNodeTypes.GROUP -> groups.describeCommercialGroup(workspaceUuid, key, nodeId);
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.requireNode(
                            workspaceUuid, key, nodeId, type)
                    .name();
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> entities.describeEntityPath(
                    workspaceUuid, key, type, nodeId);
            default -> throw new SessionInvalidException();
        };
    }

    private String homePage(String type) {
        return WorkspaceAuthorizationCatalog.homePageForRoleNodeType(type).orElseThrow(SessionInvalidException::new);
    }

    private int pageOrder(String pageKey) {
        return WorkspaceAuthorizationCatalog.page(pageKey)
                .orElseThrow(SessionInvalidException::new)
                .menuOrder();
    }

    private WorkspaceSessionEntryReadback.NavigationItem navigation(String pageKey) {
        WorkspaceAuthorizationCatalog.PageAccessCatalogEntry page =
                WorkspaceAuthorizationCatalog.page(pageKey).orElseThrow(SessionInvalidException::new);
        return new WorkspaceSessionEntryReadback.NavigationItem(
                page.pageDesignKey(),
                page.title(),
                page.menuGroup(),
                page.menuOrder(),
                page.pageAccessManaged() ? "BUSINESS" : "ROLE_HOME",
                page.pageAccessManaged(),
                page.requiredDataNodeType());
    }

    private String rawToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
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

    private static String normalizedMobile(String value) {
        String normalized = value == null ? "" : value.replace(" ", "").replace("-", "");
        if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new InvalidCredentialsException();
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private static String sha256(String input) {
        try {
            return Sha256Hex.digest(input);
        } catch (NullPointerException error) {
            throw new IllegalStateException(error);
        }
    }

    private static Set<String> permissionKeys(String value) {
        try {
            return Set.copyOf(JSON.readValue(value, new TypeReference<List<String>>() {}));
        } catch (Exception failure) {
            throw new SessionInvalidException(failure);
        }
    }

    public record LoginResult(String rawSessionToken, WorkspaceSessionReadback session) {}

    public record LoginEntryResult(String rawSessionToken, WorkspaceSessionEntryReadback sessionEntry) {}
    /**
     * Optional development/UAT-only delivery echo. The name deliberately matches the public contract: production omits
     * it rather than exposing an internal test-code concept.
     */
    public record OtpDelivery(long expiresAt, String debugVerificationCode) {}

    public record PasswordChangeResult(String status, boolean sessionsRevoked, boolean reauthenticationRequired) {}

    private record Account(
            UUID id,
            UUID workspaceUuid,
            String key,
            String status,
            String passwordHash,
            Long lockedUntilEpochMillis,
            boolean passwordChangeRequired,
            String displayName,
            String workspaceName,
            String operationsTitle,
            String logoAssetRef) {}

    private record CreatedSession(
            String rawToken,
            UUID sessionId,
            Assignment selectedAssignment,
            OrganizationVisibilityLookup.VisibleOrganizationFacts visibleFacts,
            List<Assignment> enterableAssignments) {}

    private record Assignment(UUID id, UUID roleId, String nodeType, UUID nodeId) {}

    private record SessionCredential(
            UUID sessionId, UUID accountId, long contextVersion, String passwordHash, long credentialVersion) {}

    private record ReadAuthorizationRow(
            UUID sessionId,
            UUID workspaceUuid,
            String key,
            UUID accountId,
            UUID assignmentId,
            UUID selectedRegionId,
            UUID selectedProjectId,
            UUID selectedStoreId,
            UUID selectedHeadCompanyId,
            long contextVersion,
            long authorizationRevision,
            String accountDisplayName,
            UUID roleId,
            String assignmentNodeType,
            UUID assignmentNodeId,
            String pageAccessKeys,
            String actionCapabilityKeys) {}

    private record ScopeSelection(UUID regionId, UUID projectId, UUID storeId, UUID headCompanyId) {
        static ScopeSelection empty() {
            return new ScopeSelection(null, null, null, null);
        }
    }

    private record LockedSelection(
            ScopeSelection selection, OrganizationVisibilityLookup.VisibleOrganizationFacts visibleFacts) {
        static LockedSelection empty() {
            return new LockedSelection(ScopeSelection.empty(), null);
        }
    }

    private record SessionRow(
            UUID id,
            UUID workspaceUuid,
            String key,
            UUID accountId,
            UUID assignmentId,
            UUID selectedRegionId,
            UUID selectedProjectId,
            UUID selectedStoreId,
            UUID selectedHeadCompanyId,
            long contextVersion,
            long authorizationRevision,
            String accountDisplayName,
            String workspaceName,
            String operationsTitle,
            String logoAssetRef,
            boolean passwordChangeRequired) {}

    private record SessionEntryAuthenticationFacts(
            UUID id,
            UUID workspaceUuid,
            String key,
            UUID accountId,
            UUID assignmentId,
            UUID selectedRegionId,
            UUID selectedProjectId,
            UUID selectedStoreId,
            UUID selectedHeadCompanyId,
            long contextVersion,
            long authorizationRevision,
            String accountDisplayName,
            String workspaceName,
            String operationsTitle,
            String logoAssetRef,
            boolean passwordChangeRequired) {
        private SessionRow canonicalEntryInput() {
            return new SessionRow(
                    id,
                    workspaceUuid,
                    key,
                    accountId,
                    assignmentId,
                    selectedRegionId,
                    selectedProjectId,
                    selectedStoreId,
                    selectedHeadCompanyId,
                    contextVersion,
                    authorizationRevision,
                    accountDisplayName,
                    workspaceName,
                    operationsTitle,
                    logoAssetRef,
                    passwordChangeRequired);
        }
    }

    public static final class InvalidCredentialsException extends RuntimeException {}

    public static final class AccountDisabledException extends RuntimeException {}

    public static final class CredentialLockedException extends RuntimeException {}

    public static final class PasswordChangeRequiredException extends RuntimeException {}

    public static final class WorkspaceDisabledException extends RuntimeException {}

    public static final class SessionInvalidException extends RuntimeException {
        public SessionInvalidException() {}

        public SessionInvalidException(Throwable cause) {
            super(cause);
        }
    }

    public static final class SessionConflictException extends RuntimeException {}

    public static final class OtpInvalidException extends RuntimeException {}

    public static final class LoginRateLimitedException extends RuntimeException {}

    public static final class OtpRateLimitedException extends RuntimeException {}
}
