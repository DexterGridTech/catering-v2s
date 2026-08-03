package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.organization.api.OrganizationVisibilityLookup;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceAuthenticationService {
    private static final long SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private final JdbcTemplate jdbc; private final TimeProvider time; private final WorkspaceRoleService roles; private final OrganizationNodeLookup nodes; private final StoreAssignmentLookup stores; private final OrganizationEntityLookup entities; private final CommercialGroupLookup groups; private final WorkspaceLoginRateLimitService loginLimits; private final WorkspaceOtpRateLimitService otpLimits; private final WorkspaceStatusLookup workspaces; private final OrganizationVisibilityLookup visibility; private final WorkspaceSessionRequestCache sessionCache; private final OrganizationTaskPathLookup taskPaths; private final boolean debugCodeExposure;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(); private final SecureRandom random = new SecureRandom();
    public WorkspaceAuthenticationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities) { this(jdbc, time, roles, nodes, stores, entities, legacyGroups(nodes), new WorkspaceLoginRateLimitService(jdbc, time), new WorkspaceOtpRateLimitService(jdbc, time), (workspaceUuid, groupWorkspaceKey) -> true, (workspaceUuid, groupWorkspaceKey, assignmentNodeType, assignmentNodeId, visibleNodeId) -> true, new WorkspaceSessionRequestCache(false), null, new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false)); }
    /** Compatibility constructor for owner-focused tests; production must inject the exposure policy. */
    public WorkspaceAuthenticationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities, CommercialGroupLookup groups, WorkspaceLoginRateLimitService loginLimits, WorkspaceOtpRateLimitService otpLimits, WorkspaceStatusLookup workspaces, OrganizationVisibilityLookup visibility, WorkspaceSessionRequestCache sessionCache, OrganizationTaskPathLookup taskPaths) { this(jdbc, time, roles, nodes, stores, entities, groups, loginLimits, otpLimits, workspaces, visibility, sessionCache, taskPaths, new com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy("", false)); }
    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceAuthenticationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities, CommercialGroupLookup groups, WorkspaceLoginRateLimitService loginLimits, WorkspaceOtpRateLimitService otpLimits, WorkspaceStatusLookup workspaces, OrganizationVisibilityLookup visibility, WorkspaceSessionRequestCache sessionCache, OrganizationTaskPathLookup taskPaths, com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy) { this.jdbc = jdbc; this.time = time; this.roles = roles; this.nodes = nodes; this.stores = stores; this.entities = entities; this.groups = groups; this.loginLimits = loginLimits; this.otpLimits = otpLimits; this.workspaces = workspaces; this.visibility = visibility; this.sessionCache = sessionCache; this.taskPaths = taskPaths; this.debugCodeExposure = otpDebugExposurePolicy.enabled(); }

    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountDisabledException.class, CredentialLockedException.class, WorkspaceDisabledException.class, LoginRateLimitedException.class, OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginResult login(String groupWorkspaceKey, String loginName, char[] password) {
        return login(groupWorkspaceKey, loginName, password, "legacy-test-source");
    }

    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountDisabledException.class, CredentialLockedException.class, WorkspaceDisabledException.class, LoginRateLimitedException.class, OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginResult login(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress) {
        return createSession(authenticatePassword(groupWorkspaceKey, loginName, password, sourceAddress));
    }

    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountDisabledException.class, CredentialLockedException.class, WorkspaceDisabledException.class, LoginRateLimitedException.class, OtpInvalidException.class, OtpRateLimitedException.class})
    public LoginEntryResult loginWithSessionEntry(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress) {
        return createSessionEntry(authenticatePassword(groupWorkspaceKey, loginName, password, sourceAddress));
    }

    private Account authenticatePassword(String groupWorkspaceKey, String loginName, char[] password, String sourceAddress) {
        WorkspaceLoginRateLimitService.Attempt attempt = loginLimits.begin(groupWorkspaceKey, loginName, sourceAddress);
        Account account = jdbc.query("SELECT a.id, a.workspace_uuid, a.group_workspace_key, a.status, c.password_hash, c.locked_until_epoch_millis FROM workspace_iam.workspace_account a JOIN workspace_iam.workspace_credential c ON c.account_id=a.id WHERE a.group_workspace_key=? AND a.login_name_normalized=?", statement -> { statement.setString(1, groupWorkspaceKey); statement.setString(2, loginName == null ? "" : loginName.toLowerCase()); }, result -> result.next() ? new Account(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getObject(6, Long.class)) : null);
        if (account == null) { loginLimits.recordInvalid(groupWorkspaceKey, attempt); throw new InvalidCredentialsException(); }
        if (!"ENABLED".equals(account.status())) { loginLimits.recordSourceFailure(groupWorkspaceKey, attempt); throw new AccountDisabledException(); }
        if (!workspaces.isEnabled(account.workspaceUuid(), account.key())) { loginLimits.recordSourceFailure(groupWorkspaceKey, attempt); throw new WorkspaceDisabledException(); }
        if (account.lockedUntilEpochMillis() != null && account.lockedUntilEpochMillis() > time.currentEpochMillis()) throw new CredentialLockedException();
        if (!passwords.matches(new String(password == null ? new char[0] : password), account.passwordHash())) { loginLimits.recordInvalid(groupWorkspaceKey, attempt); jdbc.update("UPDATE workspace_iam.workspace_credential SET failed_attempts=failed_attempts+1, locked_until_epoch_millis=CASE WHEN failed_attempts+1>=10 THEN ? ELSE locked_until_epoch_millis END, version=version+1 WHERE account_id=?", time.currentEpochMillis() + 15 * 60 * 1000L, account.id()); throw new InvalidCredentialsException(); }
        loginLimits.clearAccount(groupWorkspaceKey, attempt);
        return account;
    }

    @Transactional(noRollbackFor = OtpRateLimitedException.class)
    public OtpDelivery sendLoginOtp(String groupWorkspaceKey, String mobile) {
        Account account = accountByMobile(groupWorkspaceKey, normalizedMobile(mobile));
        otpLimits.beforeSend(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
        long expires = time.currentEpochMillis() + OTP_TTL_MILLIS;
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND purpose='WORKSPACE_LOGIN' AND status='ACTIVE'", account.id());
        String otp = String.format("%06d", random.nextInt(1_000_000));
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, ?, 'WORKSPACE_LOGIN', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), account.workspaceUuid(), account.key(), sha256(otp), account.id(), expires);
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
        int consumed = jdbc.update("UPDATE workspace_iam.otp_grant SET status='USED', used_at_epoch_millis=? WHERE subject_ref=? AND purpose='WORKSPACE_LOGIN' AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>?", time.currentEpochMillis(), account.id(), sha256(otp), time.currentEpochMillis());
        if (consumed != 1) {
            jdbc.update("UPDATE workspace_iam.otp_grant SET attempt_count=attempt_count+1 WHERE subject_ref=? AND purpose='WORKSPACE_LOGIN' AND status='ACTIVE'", account.id());
            otpLimits.invalidVerify(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
            throw new OtpInvalidException();
        }
        otpLimits.successfulVerify(account.workspaceUuid(), account.key(), "WORKSPACE_LOGIN", account.id());
        return account;
    }

    @Transactional
    public WorkspaceSessionReadback selectContext(String rawToken, UUID assignmentId, UUID visibleDataNodeId, long expectedContextVersion) {
        selectContext(rawToken, assignmentId, expectedContextVersion);
        SessionRow selected = require(rawToken);
        Assignment assignment = requireAssignment(selected, assignmentId);
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = visibility.listVisibleDataNodeCandidates(selected.workspaceUuid(), selected.key(), assignment.nodeType(), assignment.nodeId()).stream()
            .filter(value -> value.dataNodeId().equals(visibleDataNodeId))
            .findFirst()
            .orElseThrow(SessionInvalidException::new);
        selectDataNode(rawToken, candidate.dataNodeType(), visibleDataNodeId, selected.contextVersion());
        return session(rawToken);
    }

    @Transactional
    public WorkspaceSessionEntryReadback selectContext(String rawToken, UUID assignmentId, long expectedContextVersion) {
        SessionRow current = require(rawToken);
        if (current.contextVersion() != expectedContextVersion) throw new SessionConflictException();
        Assignment assignment = requireAssignment(current, assignmentId);
        if (!enterable(current.workspaceUuid(), current.key(), assignment.nodeType(), assignment.nodeId())) throw new SessionInvalidException();
        if (jdbc.update("UPDATE workspace_iam.workspace_session SET current_assignment_id=?, visible_data_node_id=NULL, context_version=context_version+1, authorization_revision=authorization_revision+1 WHERE id=? AND context_version=?", assignmentId, current.id(), expectedContextVersion) != 1) throw new SessionConflictException();
        sessionCache.evict(rawToken);
        return sessionEntry(rawToken);
    }

    @Transactional
    public WorkspaceSessionEntryReadback selectDataNode(String rawToken, String dataNodeType, UUID visibleDataNodeId, long expectedContextVersion) {
        SessionRow current = require(rawToken);
        if (current.contextVersion() != expectedContextVersion || current.assignmentId() == null) throw new SessionConflictException();
        Assignment assignment = requireAssignment(current, current.assignmentId());
        OrganizationVisibilityLookup.VisibleDataNodeCandidate candidate = visibility.listVisibleDataNodeCandidates(current.workspaceUuid(), current.key(), assignment.nodeType(), assignment.nodeId()).stream()
            .filter(value -> value.dataNodeId().equals(visibleDataNodeId) && value.dataNodeType().equals(dataNodeType))
            .findFirst()
            .orElseThrow(SessionInvalidException::new);
        if (jdbc.update("UPDATE workspace_iam.workspace_session SET visible_data_node_id=?, context_version=context_version+1, authorization_revision=authorization_revision+1 WHERE id=? AND context_version=?", candidate.dataNodeId(), current.id(), expectedContextVersion) != 1) throw new SessionConflictException();
        sessionCache.evict(rawToken);
        return sessionEntry(rawToken);
    }

    @Transactional(readOnly = true)
    public WorkspaceSessionReadback session(String rawToken) {
        return sessionCache.read(rawToken, () -> loadSession(rawToken));
    }

    private WorkspaceSessionReadback loadSession(String rawToken) {
        SessionRow row = require(rawToken);
        if (row.assignmentId() == null) return new WorkspaceSessionReadback(row.id(), row.workspaceUuid(), row.key(), row.accountId(), null, row.visibleDataNodeId(), row.contextVersion(), row.authorizationRevision(), Set.of(), Set.of(), row.accountDisplayName());
        UUID roleId = jdbc.queryForObject("SELECT role_id FROM workspace_iam.role_assignment WHERE id=? AND status='ACTIVE'", UUID.class, row.assignmentId());
        var role = roles.require(row.workspaceUuid(), row.key(), roleId);
        return new WorkspaceSessionReadback(row.id(), row.workspaceUuid(), row.key(), row.accountId(), row.assignmentId(), row.visibleDataNodeId(), row.contextVersion(), row.authorizationRevision(), role.pageAccessKeys(), role.actionCapabilityKeys(), row.accountDisplayName());
    }

    @Transactional(readOnly = true)
    public WorkspaceSessionEntryReadback sessionEntry(String rawToken) {
        return sessionEntry(require(rawToken));
    }

    /** A path-key guard belongs with the session owner, not with an edge-local pre-read. */
    @Transactional(readOnly = true)
    public WorkspaceSessionEntryReadback sessionEntry(String rawToken, String groupWorkspaceKey) {
        SessionRow row = require(rawToken);
        if (!row.key().equals(groupWorkspaceKey)) throw new SessionInvalidException();
        return sessionEntry(row);
    }

    private WorkspaceSessionEntryReadback sessionEntry(SessionRow row) {
        List<Assignment> enterableAssignments = availableAssignments(row, activeAssignments(row));
        Map<UUID, WorkspaceRoleReadback> rolesById = roles.requireAll(
            row.workspaceUuid(), row.key(), enterableAssignments.stream().map(Assignment::roleId).toList()
        );
        Map<OrganizationTaskPathLookup.TaskPathRef, String> labels = taskPaths == null
            ? Map.of()
            : taskPaths.describeTaskTargetLabels(
                row.workspaceUuid(), row.key(),
                enterableAssignments.stream().map(assignment -> new OrganizationTaskPathLookup.TaskPathRef(assignment.nodeType(), assignment.nodeId())).toList()
            );
        List<WorkspaceSessionEntryReadback.RoleAssignmentCandidate> candidates = enterableAssignments.stream()
            .map(assignment -> candidate(row, assignment, rolesById.get(assignment.roleId()), labels))
            .sorted(Comparator.comparing(WorkspaceSessionEntryReadback.RoleAssignmentCandidate::roleName).thenComparing(value -> value.roleAssignmentId().toString()))
            .toList();
        WorkspaceSessionEntryReadback.RoleAssignmentCandidate selected = candidates.stream()
            .filter(candidate -> candidate.roleAssignmentId().equals(row.assignmentId()))
            .findFirst()
            .orElse(null);
        if (candidates.isEmpty()) {
            return new WorkspaceSessionEntryReadback(row.key(), row.accountId(), row.accountDisplayName(), row.workspaceName(), row.operationsTitle(), row.logoAssetRef(), row.contextVersion(), WorkspaceSessionEntryReadback.Mode.EMPTY, WorkspaceSessionEntryReadback.Outcome.EMPTY_WORKBENCH, List.of(), Set.of(), List.of(), null, null);
        }
        if (selected == null) {
            return new WorkspaceSessionEntryReadback(row.key(), row.accountId(), row.accountDisplayName(), row.workspaceName(), row.operationsTitle(), row.logoAssetRef(), row.contextVersion(), WorkspaceSessionEntryReadback.Mode.SELECT, WorkspaceSessionEntryReadback.Outcome.SELECT_IDENTITY, candidates, Set.of(), List.of(), null, null);
        }
        Assignment assignment = enterableAssignments.stream()
            .filter(value -> value.id().equals(selected.roleAssignmentId()))
            .findFirst()
            .orElseThrow(SessionInvalidException::new);
        List<WorkspaceSessionEntryReadback.VisibleDataNodeCandidate> dataNodes = visibility.listVisibleDataNodeCandidates(row.workspaceUuid(), row.key(), assignment.nodeType(), assignment.nodeId()).stream()
            .map(value -> new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(value.dataNodeType(), value.dataNodeId(), value.dataNodeName(), value.ancestorPath(), value.regionId(), value.projectId(), value.storeId()))
            .toList();
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate selectedDataNode = dataNodes.stream().filter(value -> value.dataNodeId().equals(row.visibleDataNodeId())).findFirst().orElse(null);
        boolean scopeRequired = selected.navigation().stream().anyMatch(item -> !"NONE".equals(item.requiredDataNodeType()));
        WorkspaceSessionEntryReadback.Mode mode = candidates.size() == 1 ? WorkspaceSessionEntryReadback.Mode.DIRECT : WorkspaceSessionEntryReadback.Mode.SELECT;
        WorkspaceSessionEntryReadback.Outcome outcome = scopeRequired && selectedDataNode == null ? WorkspaceSessionEntryReadback.Outcome.SELECT_SCOPE : WorkspaceSessionEntryReadback.Outcome.HOME;
        return new WorkspaceSessionEntryReadback(row.key(), row.accountId(), row.accountDisplayName(), row.workspaceName(), row.operationsTitle(), row.logoAssetRef(), row.contextVersion(), mode, outcome, candidates, selected.actionGrants(), dataNodes, selected, selectedDataNode);
    }

    @Transactional
    public void logout(String rawToken) { jdbc.update("UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE token_hash=? AND status='ACTIVE'", time.currentEpochMillis(), sha256(rawToken)); sessionCache.evict(rawToken); }

    /** Current-account rotation revokes all operations sessions after CAS on the current context version. */
    @Transactional
    public PasswordChangeResult changeCurrentPassword(String rawToken, char[] currentPassword, char[] newPassword, long expectedSessionVersion) {
        if (newPassword == null || newPassword.length < 8) throw new InvalidCredentialsException();
        SessionCredential current = jdbc.query("SELECT s.account_id, s.context_version, c.password_hash FROM workspace_iam.workspace_session s JOIN workspace_iam.workspace_credential c ON c.account_id=s.account_id WHERE s.token_hash=? AND s.status='ACTIVE' AND s.expires_at_epoch_millis>?", statement -> { statement.setString(1, sha256(rawToken)); statement.setLong(2, time.currentEpochMillis()); }, result -> {
            if (!result.next()) throw new SessionInvalidException();
            return new SessionCredential(result.getObject(1, UUID.class), result.getLong(2), result.getString(3));
        });
        if (current.contextVersion() != expectedSessionVersion) throw new SessionConflictException();
        if (!passwords.matches(new String(currentPassword == null ? new char[0] : currentPassword), current.passwordHash())) throw new InvalidCredentialsException();
        long now = time.currentEpochMillis();
        jdbc.update("UPDATE workspace_iam.workspace_credential SET password_hash=?, changed_at_epoch_millis=?, failed_attempts=0, locked_until_epoch_millis=NULL, version=version+1 WHERE account_id=?", passwords.encode(new String(newPassword)), now, current.accountId());
        jdbc.update("UPDATE workspace_iam.workspace_session SET status='REVOKED', revoked_at_epoch_millis=? WHERE account_id=? AND status='ACTIVE'", now, current.accountId());
        return new PasswordChangeResult("COMPLETED", true, true);
    }
    private LoginResult createSession(Account account) { CreatedSession created = createRawSession(account); return new LoginResult(created.rawToken(), session(created.rawToken())); }
    private LoginEntryResult createSessionEntry(Account account) { CreatedSession created = createRawSession(account); return new LoginEntryResult(created.rawToken(), sessionEntry(created.rawToken(), account.key())); }
    private CreatedSession createRawSession(Account account) { List<Assignment> assignments = jdbc.query("SELECT a.id, a.role_id, a.service_node_type, a.service_node_id FROM workspace_iam.role_assignment a JOIN workspace_iam.workspace_role r ON r.id=a.role_id WHERE a.account_id=? AND a.workspace_uuid=? AND a.group_workspace_key=? AND a.status='ACTIVE' AND r.status='ENABLED'", (row, index) -> new Assignment(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getObject(4, UUID.class)), account.id(), account.workspaceUuid(), account.key()); List<Assignment> enterable = availableAssignments(account.workspaceUuid(), account.key(), assignments); UUID current = enterable.size() == 1 ? enterable.getFirst().id() : null; String raw = rawToken(); UUID sessionId = UUID.randomUUID(); long now = time.currentEpochMillis(); jdbc.update("INSERT INTO workspace_iam.workspace_session (id, workspace_uuid, group_workspace_key, account_id, token_hash, current_assignment_id, context_version, authorization_revision, status, expires_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'ACTIVE', ?)", sessionId, account.workspaceUuid(), account.key(), account.id(), sha256(raw), current, now + SESSION_TTL_MILLIS); jdbc.update("INSERT INTO workspace_iam.workspace_authentication_history (id, workspace_uuid, group_workspace_key, account_id, authenticated_at_epoch_millis) VALUES (?, ?, ?, ?, ?)", UUID.randomUUID(), account.workspaceUuid(), account.key(), account.id(), now); return new CreatedSession(raw); }
    private Account accountByMobile(String groupWorkspaceKey, String mobile) { Account account = jdbc.query("SELECT id, workspace_uuid, group_workspace_key, status FROM workspace_iam.workspace_account WHERE group_workspace_key=? AND mobile_normalized=?", statement -> { statement.setString(1, groupWorkspaceKey); statement.setString(2, mobile); }, result -> result.next() ? new Account(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), null, null) : null); if (account == null) throw new InvalidCredentialsException(); if (!"ENABLED".equals(account.status())) throw new AccountDisabledException(); if (!workspaces.isEnabled(account.workspaceUuid(), account.key())) throw new WorkspaceDisabledException(); return account; }
    private SessionRow require(String raw) { return jdbc.query("SELECT s.id, s.workspace_uuid, s.group_workspace_key, s.account_id, s.current_assignment_id, s.visible_data_node_id, s.context_version, s.authorization_revision, a.display_name, gw.name, gw.operations_title, gw.logo_asset_ref FROM workspace_iam.workspace_session s JOIN workspace_iam.workspace_account a ON a.id=s.account_id JOIN platform_workspace.group_workspace gw ON gw.workspace_uuid=s.workspace_uuid AND gw.group_workspace_key=s.group_workspace_key WHERE s.token_hash=? AND s.status='ACTIVE' AND s.expires_at_epoch_millis>?", statement -> { statement.setString(1, sha256(raw)); statement.setLong(2, time.currentEpochMillis()); }, result -> { if (!result.next()) throw new SessionInvalidException(); return new SessionRow(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getObject(4, UUID.class), result.getObject(5, UUID.class), result.getObject(6, UUID.class), result.getLong(7), result.getLong(8), result.getString(9), result.getString(10), result.getString(11), result.getString(12)); }); }
    private boolean enterable(UUID workspace, String key, String type, UUID node) { return switch(type) { case "STORE" -> stores.isEnterableStore(workspace, key, node); case "HEAD_COMPANY" -> entities.isEnterableEntity(workspace, key, "HEAD_COMPANY", node); case "GROUP" -> groups.isEnterableCommercialGroup(workspace, key, node); case "REGION", "PROJECT" -> nodes.isEnterable(workspace, key, node); default -> false; }; }
    private boolean visibleDataNodeAllowed(UUID workspace, String key, String assignmentType, UUID assignmentNode, UUID visibleNode) {
        if ("GROUP".equals(assignmentType) && !groups.isEnterableCommercialGroup(workspace, key, assignmentNode)) return false;
        return visibility.isVisibleDataNodeAllowed(workspace, key, assignmentType, assignmentNode, visibleNode);
    }
    private Assignment requireAssignment(SessionRow current, UUID assignmentId) {
        return jdbc.query("SELECT a.id, a.role_id, a.service_node_type, a.service_node_id FROM workspace_iam.role_assignment a JOIN workspace_iam.workspace_role r ON r.id=a.role_id WHERE a.id=? AND a.account_id=? AND a.workspace_uuid=? AND a.group_workspace_key=? AND a.status='ACTIVE' AND r.status='ENABLED'", statement -> { statement.setObject(1, assignmentId); statement.setObject(2, current.accountId()); statement.setObject(3, current.workspaceUuid()); statement.setString(4, current.key()); }, result -> { if (!result.next()) throw new SessionInvalidException(); return new Assignment(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getObject(4, UUID.class)); });
    }
    private List<Assignment> activeAssignments(SessionRow current) {
        return jdbc.query("SELECT a.id, a.role_id, a.service_node_type, a.service_node_id FROM workspace_iam.role_assignment a JOIN workspace_iam.workspace_role r ON r.id=a.role_id WHERE a.account_id=? AND a.workspace_uuid=? AND a.group_workspace_key=? AND a.status='ACTIVE' AND r.status='ENABLED'", (row, index) -> new Assignment(row.getObject(1, UUID.class), row.getObject(2, UUID.class), row.getString(3), row.getObject(4, UUID.class)), current.accountId(), current.workspaceUuid(), current.key());
    }
    private List<Assignment> availableAssignments(SessionRow current, List<Assignment> assignments) { return availableAssignments(current.workspaceUuid(), current.key(), assignments); }
    private List<Assignment> availableAssignments(UUID workspaceUuid, String key, List<Assignment> assignments) {
        if (taskPaths == null) return assignments.stream().filter(assignment -> enterable(workspaceUuid, key, assignment.nodeType(), assignment.nodeId())).toList();
        Set<OrganizationTaskPathLookup.TaskPathRef> available = taskPaths.availableTaskTargets(workspaceUuid, key, assignments.stream().map(assignment -> new OrganizationTaskPathLookup.TaskPathRef(assignment.nodeType(), assignment.nodeId())).toList());
        return assignments.stream().filter(assignment -> available.contains(new OrganizationTaskPathLookup.TaskPathRef(assignment.nodeType(), assignment.nodeId()))).toList();
    }
    private WorkspaceSessionEntryReadback.RoleAssignmentCandidate candidate(SessionRow row, Assignment assignment, WorkspaceRoleReadback role, Map<OrganizationTaskPathLookup.TaskPathRef, String> labels) {
        if (role == null) throw new SessionInvalidException();
        String home = homePage(assignment.nodeType());
        LinkedHashSet<String> pageKeys = new LinkedHashSet<>();
        pageKeys.add(home);
        role.pageAccessKeys().stream().sorted(Comparator.comparingInt(this::pageOrder).thenComparing(String::compareTo)).forEach(pageKeys::add);
        List<WorkspaceSessionEntryReadback.NavigationItem> navigation = pageKeys.stream().map(this::navigation).toList();
        return new WorkspaceSessionEntryReadback.RoleAssignmentCandidate(assignment.id(), role.id(), role.name(), assignment.nodeId(), assignment.nodeType(), nodeName(row.workspaceUuid(), row.key(), assignment.nodeType(), assignment.nodeId(), labels), home, List.copyOf(pageKeys), navigation, Set.copyOf(role.actionCapabilityKeys()));
    }
    private String nodeName(UUID workspaceUuid, String key, String type, UUID nodeId, Map<OrganizationTaskPathLookup.TaskPathRef, String> labels) {
        if (taskPaths != null) {
            String label = labels.get(new OrganizationTaskPathLookup.TaskPathRef(type, nodeId));
            if (label == null) throw new SessionInvalidException();
            return label;
        }
        return switch (type) { case "GROUP" -> groups.describeCommercialGroup(workspaceUuid, key, nodeId); case "REGION", "PROJECT" -> nodes.requireNode(workspaceUuid, key, nodeId, type).name(); case "HEAD_COMPANY", "STORE" -> entities.describeEntityPath(workspaceUuid, key, type, nodeId); default -> throw new SessionInvalidException(); };
    }
    private String homePage(String type) {
        return WorkspaceAuthorizationCatalog.homePageForRoleNodeType(type).orElseThrow(SessionInvalidException::new);
    }
    private int pageOrder(String pageKey) { return WorkspaceAuthorizationCatalog.page(pageKey).orElseThrow(SessionInvalidException::new).menuOrder(); }
    private WorkspaceSessionEntryReadback.NavigationItem navigation(String pageKey) {
        WorkspaceAuthorizationCatalog.PageAccessCatalogEntry page = WorkspaceAuthorizationCatalog.page(pageKey).orElseThrow(SessionInvalidException::new);
        return new WorkspaceSessionEntryReadback.NavigationItem(page.pageDesignKey(), page.title(), page.menuGroup(), page.menuOrder(), page.pageAccessManaged() ? "BUSINESS" : "ROLE_HOME", page.pageAccessManaged(), page.requiredDataNodeType());
    }
    private String rawToken() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
    private static CommercialGroupLookup legacyGroups(OrganizationNodeLookup nodes) { return new CommercialGroupLookup() { @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) { throw new UnsupportedOperationException("legacy tests supply a GROUP node"); } @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) { return nodes.isEnterable(workspaceUuid, groupWorkspaceKey, commercialGroupRef); } @Override public String describeCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) { return nodes.describePath(workspaceUuid, groupWorkspaceKey, commercialGroupRef); } }; }
    private static String normalizedMobile(String value) { String normalized = value == null ? "" : value.replace(" ", "").replace("-", ""); if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new InvalidCredentialsException(); return normalized.startsWith("+") ? normalized.substring(1) : normalized; }
    private static String sha256(String input) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8))); } catch (Exception error) { throw new IllegalStateException(error); } }
    public record LoginResult(String rawSessionToken, WorkspaceSessionReadback session) { }
    public record LoginEntryResult(String rawSessionToken, WorkspaceSessionEntryReadback sessionEntry) { }
    /**
     * Optional development/UAT-only delivery echo.  The name deliberately matches the public
     * contract: production omits it rather than exposing an internal test-code concept.
     */
    public record OtpDelivery(long expiresAt, String debugVerificationCode) { }
    public record PasswordChangeResult(String status, boolean sessionsRevoked, boolean reauthenticationRequired) { }
    private record Account(UUID id, UUID workspaceUuid, String key, String status, String passwordHash, Long lockedUntilEpochMillis) { }
    private record CreatedSession(String rawToken) { }
    private record Assignment(UUID id, UUID roleId, String nodeType, UUID nodeId) { }
    private record SessionCredential(UUID accountId, long contextVersion, String passwordHash) { }
    private record SessionRow(UUID id, UUID workspaceUuid, String key, UUID accountId, UUID assignmentId, UUID visibleDataNodeId, long contextVersion, long authorizationRevision, String accountDisplayName, String workspaceName, String operationsTitle, String logoAssetRef) { }
    public static final class InvalidCredentialsException extends RuntimeException { }
    public static final class AccountDisabledException extends RuntimeException { }
    public static final class CredentialLockedException extends RuntimeException { }
    public static final class WorkspaceDisabledException extends RuntimeException { }
    public static final class SessionInvalidException extends RuntimeException { }
    public static final class SessionConflictException extends RuntimeException { }
    public static final class OtpInvalidException extends RuntimeException { }
    public static final class LoginRateLimitedException extends RuntimeException { }
    public static final class OtpRateLimitedException extends RuntimeException { }
}
