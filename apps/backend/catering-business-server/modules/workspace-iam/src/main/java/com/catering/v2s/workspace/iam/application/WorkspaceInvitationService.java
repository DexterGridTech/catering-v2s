package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.seed.DevFixedOtpIssuer;
import com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.UserManagementAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceInvitationService {
    private static final Set<String> INVITATION_FIELDS = Set.of("status", "lifecycleEvent");
    private static final long MANAGEMENT_INVITATION_TTL_MILLIS = 7 * 24 * 60 * 60 * 1000L;
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final WorkspaceRoleService roles;
    private final OrganizationNodeLookup nodes;
    private final StoreAssignmentLookup stores;
    private final OrganizationEntityLookup entities;
    private final CommercialGroupLookup groups;
    private final WorkspaceOtpRateLimitService otpLimits;
    private final WorkspaceIamCommandReceiptService receipts;
    private final WorkspaceCommandAuthorizationService commandAuthorization;
    private final WorkspaceUserService user;
    private final OrganizationTaskPathLookup taskPaths;
    private final OrganizationAssignmentCandidateLookup candidates;
    private final boolean debugCodeExposure;
    private final DevFixedOtpIssuer fixedOtpIssuer;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    public WorkspaceInvitationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities) {
        this(jdbc, time, roles, nodes, stores, entities, legacyGroups(nodes), new WorkspaceOtpRateLimitService(jdbc, time), new WorkspaceIamCommandReceiptService(jdbc, time), new WorkspaceCommandAuthorizationService(jdbc), null, null, null, false, (DevFixedOtpIssuer) null);
    }

    /** Compatibility constructor for owner-focused tests; production must inject the exposure policy. */
    public WorkspaceInvitationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities, CommercialGroupLookup groups, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceCommandAuthorizationService commandAuthorization, WorkspaceUserService user, OrganizationTaskPathLookup taskPaths, OrganizationAssignmentCandidateLookup candidates) {
        this(jdbc, time, roles, nodes, stores, entities, groups, otpLimits, receipts, commandAuthorization, user, taskPaths, candidates, false, (DevFixedOtpIssuer) null);
    }

    public WorkspaceInvitationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities, CommercialGroupLookup groups, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceCommandAuthorizationService commandAuthorization, WorkspaceUserService user, OrganizationTaskPathLookup taskPaths, OrganizationAssignmentCandidateLookup candidates, boolean debugCodeExposure) {
        this(jdbc, time, roles, nodes, stores, entities, groups, otpLimits, receipts, commandAuthorization, user, taskPaths, candidates, debugCodeExposure, (DevFixedOtpIssuer) null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceInvitationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities, CommercialGroupLookup groups, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceCommandAuthorizationService commandAuthorization, WorkspaceUserService user, OrganizationTaskPathLookup taskPaths, OrganizationAssignmentCandidateLookup candidates, com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy, ObjectProvider<DevFixedOtpIssuer> fixedOtpIssuer) {
        this(jdbc, time, roles, nodes, stores, entities, groups, otpLimits, receipts, commandAuthorization, user, taskPaths, candidates, otpDebugExposurePolicy.enabled(), fixedOtpIssuer.getIfAvailable());
    }

    private WorkspaceInvitationService(JdbcTemplate jdbc, TimeProvider time, WorkspaceRoleService roles, OrganizationNodeLookup nodes, StoreAssignmentLookup stores, OrganizationEntityLookup entities, CommercialGroupLookup groups, WorkspaceOtpRateLimitService otpLimits, WorkspaceIamCommandReceiptService receipts, WorkspaceCommandAuthorizationService commandAuthorization, WorkspaceUserService user, OrganizationTaskPathLookup taskPaths, OrganizationAssignmentCandidateLookup candidates, boolean debugCodeExposure, DevFixedOtpIssuer fixedOtpIssuer) {
        this.jdbc = jdbc; this.time = time; this.roles = roles; this.nodes = nodes; this.stores = stores; this.entities = entities; this.groups = groups; this.otpLimits = otpLimits; this.receipts = receipts; this.commandAuthorization = commandAuthorization; this.user = user; this.taskPaths = taskPaths; this.candidates = candidates; this.debugCodeExposure = debugCodeExposure; this.fixedOtpIssuer = fixedOtpIssuer;
    }

    @Transactional
    public WorkspaceInvitationReadback create(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String mobile,
        List<AssignmentIntent> intents,
        String idempotencyKey,
        AuditActor actor
    ) {
        return receipts.execute(
            workspaceUuid,
            idempotencyKey,
            canonical("create", workspaceUuid, groupWorkspaceKey, mobile, intents),
            WorkspaceInvitationReadback.class,
            () -> create(
                workspaceUuid,
                groupWorkspaceKey,
                mobile,
                intents,
                time.currentEpochMillis() + MANAGEMENT_INVITATION_TTL_MILLIS,
                actor
            )
        );
    }

    @Transactional
    public WorkspaceInvitationReadback createForOperations(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID actorAssignmentId,
        String mobile,
        List<AssignmentIntent> intents,
        String idempotencyKey,
        AuditActor actor
    ) {
        String targetType = singleTargetType(intents);
        UUID targetId = singleTargetId(intents);
        commandAuthorization.requireUserManagementAction(
            workspaceUuid, groupWorkspaceKey, actorAssignmentId, targetType, targetId, UserManagementAction.INVITE
        );
        return create(workspaceUuid, groupWorkspaceKey, mobile, intents, idempotencyKey, actor);
    }

    @Transactional
    public WorkspaceInvitationReadback create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, long expiresAtEpochMillis) {
        return create(workspaceUuid, groupWorkspaceKey, mobile, intents, expiresAtEpochMillis, AuditActor.system());
    }
    @Transactional
    public WorkspaceInvitationReadback create(UUID workspaceUuid, String groupWorkspaceKey, String mobile, List<AssignmentIntent> intents, long expiresAtEpochMillis, AuditActor actor) {
        if (expiresAtEpochMillis <= time.currentEpochMillis() || intents == null || intents.isEmpty()) throw new InvitationValidationException();
        singleTargetType(intents);
        singleTargetId(intents);
        String normalizedMobile = normalizedMobile(mobile); String raw = randomToken(); UUID invitationId = UUID.randomUUID(); long now = time.currentEpochMillis();
        jdbc.update("INSERT INTO workspace_iam.invitation (id, workspace_uuid, group_workspace_key, token_hash, invitation_token, mobile_normalized, issuer_display_name_snapshot, status, expires_at_epoch_millis, version, created_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 1, ?)", invitationId, workspaceUuid, groupWorkspaceKey, sha256(raw), raw, normalizedMobile, actor.displaySnapshot(), expiresAtEpochMillis, now);
        for (AssignmentIntent intent : intents) {
            var role = roles.require(workspaceUuid, groupWorkspaceKey, intent.roleId());
            if (!role.serviceNodeType().equals(intent.serviceNodeType())) throw new InvitationValidationException();
            requireEnterable(new Invitation(invitationId, workspaceUuid, groupWorkspaceKey, normalizedMobile, "PENDING", expiresAtEpochMillis, 1), intent);
            jdbc.update("INSERT INTO workspace_iam.invitation_assignment_intent (invitation_id, role_id, service_node_type, service_node_id) VALUES (?, ?, ?, ?)", invitationId, intent.roleId(), intent.serviceNodeType(), intent.serviceNodeId());
        }
        audit(workspaceUuid, groupWorkspaceKey, invitationId, "WORKSPACE_INVITATION_CREATED", actor, null, "PENDING"); return new WorkspaceInvitationReadback(invitationId, workspaceUuid, groupWorkspaceKey, normalizedMobile, "PENDING", expiresAtEpochMillis, 1, now, null, null, null, raw);
    }

    /** Owner-owned platform page: filters, total and bounds finish before edge mapping. */
    @Transactional(readOnly = true)
    public ManagementInvitationPage managementPage(UUID workspaceUuid, String groupWorkspaceKey, ManagementInvitationPageRequest request) {
        return managementPage(workspaceUuid, groupWorkspaceKey, request, null, null);
    }

    /** Owner-owned operations page; the endpoint-fixed type is never inferred from the session. */
    @Transactional(readOnly = true)
    public ManagementInvitationPage managementPageForOperations(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedScopeRef, ManagementInvitationPageRequest request) {
        if (user == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        OrganizationTaskPathLookup.TaskPath scope = user.resolveTaskScope(session, expectedTargetType, requestedScopeRef);
        boolean aggregate = ServiceNodeTypes.GROUP.equals(scope.targetType()) && ServiceNodeTypes.HEAD_COMPANY.equals(expectedTargetType);
        return managementPage(session.workspaceUuid(), session.groupWorkspaceKey(), request, expectedTargetType, aggregate ? null : scope.targetId());
    }

    private ManagementInvitationPage managementPage(UUID workspaceUuid, String key, ManagementInvitationPageRequest request, String fixedTargetType, UUID fixedTargetId) {
        PageRequest page = PageRequest.from(request);
        InvitationPageSql sql = invitationPageSql(workspaceUuid, key, request, fixedTargetType, fixedTargetId);
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.invitation i WHERE " + sql.where(), Long.class, sql.arguments().toArray());
        if (total == 0) return new ManagementInvitationPage(List.of(), page.page(), page.pageSize(), 0L, page.criteria());
        List<WorkspaceInvitationReadback> rows = jdbc.query(
            "SELECT i.id, i.mobile_normalized, i.status, i.expires_at_epoch_millis, i.version, i.created_at_epoch_millis, i.consented_at_epoch_millis, i.completed_at_epoch_millis, i.cancelled_at_epoch_millis, i.invitation_token FROM workspace_iam.invitation i WHERE " + sql.where() + " ORDER BY i." + page.orderColumn() + " " + page.direction() + ", i.id ASC LIMIT ? OFFSET ?",
            (row, index) -> new WorkspaceInvitationReadback(row.getObject(1, UUID.class), workspaceUuid, key, row.getString(2), row.getString(3), row.getLong(4), row.getLong(5), row.getLong(6), row.getObject(7, Long.class), row.getObject(8, Long.class), row.getObject(9, Long.class), row.getString(10)),
            arguments(sql.arguments(), page.pageSize(), (page.page() - 1) * page.pageSize())
        );
        return new ManagementInvitationPage(managementViews(rows), page.page(), page.pageSize(), total, page.criteria());
    }

    private static InvitationPageSql invitationPageSql(UUID workspaceUuid, String key, ManagementInvitationPageRequest request, String fixedType, UUID fixedId) {
        List<String> clauses = new ArrayList<>(List.of("i.workspace_uuid=?", "i.group_workspace_key=?"));
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, key));
        String mobileQuery = normalizedMobileQuery(request.mobile());
        if (mobileQuery != null) { clauses.add("i.mobile_normalized LIKE ?"); arguments.add("%" + mobileQuery + "%"); }
        if (request.status() != null) { clauses.add("i.status=?"); arguments.add(request.status()); }
        if (request.expiresFrom() != null) { clauses.add("i.expires_at_epoch_millis>=?"); arguments.add(request.expiresFrom()); }
        if (request.expiresTo() != null) { clauses.add("i.expires_at_epoch_millis<=?"); arguments.add(request.expiresTo()); }
        if (request.targetOrganizationType() != null || request.targetOrganizationRef() != null || request.roleId() != null) {
            clauses.add("EXISTS (SELECT 1 FROM workspace_iam.invitation_assignment_intent intent WHERE intent.invitation_id=i.id AND (CAST(? AS text) IS NULL OR intent.service_node_type=?) AND (CAST(? AS uuid) IS NULL OR intent.service_node_id=?) AND (CAST(? AS uuid) IS NULL OR intent.role_id=?))");
            arguments.add(request.targetOrganizationType()); arguments.add(request.targetOrganizationType()); arguments.add(request.targetOrganizationRef()); arguments.add(request.targetOrganizationRef()); arguments.add(request.roleId()); arguments.add(request.roleId());
        }
        if (fixedType != null) {
            if (fixedId == null) {
                clauses.add("EXISTS (SELECT 1 FROM workspace_iam.invitation_assignment_intent intent WHERE intent.invitation_id=i.id AND intent.service_node_type=?)");
                arguments.add(fixedType);
            } else {
                clauses.add("EXISTS (SELECT 1 FROM workspace_iam.invitation_assignment_intent intent WHERE intent.invitation_id=i.id AND intent.service_node_type=? AND intent.service_node_id=?)");
                arguments.add(fixedType); arguments.add(fixedId);
            }
        }
        // JDBC intentionally needs null placeholders for independently optional
        // type/ref/role filters; List.copyOf rejects those nulls.
        return new InvitationPageSql(String.join(" AND ", clauses), Collections.unmodifiableList(new ArrayList<>(arguments)));
    }

    private static String normalizedMobileQuery(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.replace(" ", "").replace("-", "");
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private static Object[] arguments(List<Object> values, Object... tail) { List<Object> result = new ArrayList<>(values); result.addAll(List.of(tail)); return result.toArray(); }

    @Transactional(readOnly = true)
    public ManagementInvitationView managementView(WorkspaceInvitationReadback invitation) {
        return managementViews(List.of(invitation)).getFirst();
    }

    /** Owner read used by the platform detail before a CAS command; it is scoped to one workspace. */
    @Transactional(readOnly = true)
    public ManagementInvitationView managementInvitation(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId) {
        return managementView(readback(workspaceUuid, groupWorkspaceKey, invitationId));
    }

    private List<ManagementInvitationView> managementViews(List<WorkspaceInvitationReadback> invitations) {
        if (invitations.isEmpty()) return List.of();
        InvitationAssignmentIntentFacts facts = loadInvitationAssignmentIntentFacts(invitations);
        return managementViews(invitations, facts);
    }

    private List<ManagementInvitationView> managementViews(List<WorkspaceInvitationReadback> invitations, InvitationAssignmentIntentFacts facts) {
        if (invitations.isEmpty()) return List.of();
        Map<UUID, String> issuerNamesByInvitation = issuerNamesByInvitation(invitations);
        Invitation owner = owner(invitations.getFirst());
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = paths(owner, invitations.stream().flatMap(invitation -> facts.intentsByInvitation().getOrDefault(invitation.id(), List.of()).stream()).toList());
        return invitations.stream().map(invitation -> managementView(invitation, facts.intentsByInvitation().get(invitation.id()), facts.roleNamesByInvitation().get(invitation.id()), issuerNamesByInvitation.get(invitation.id()), paths)).toList();
    }

    private ManagementInvitationView managementView(WorkspaceInvitationReadback invitation, List<AssignmentIntent> intents, List<String> roleNames, String issuerDisplayName, Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        if (intents.isEmpty() || roleNames.isEmpty()) throw new InvitationStateException();
        String type = intents.getFirst().serviceNodeType();
        if (intents.stream().anyMatch(intent -> !type.equals(intent.serviceNodeType()))) {
            throw new InvitationStateException();
        }
        String targetPath = targetPath(owner(invitation), intents, paths);
        String rawInvitationToken = invitation.rawInvitationToken();
        String invitationPageUrl = rawInvitationToken == null ? null
            : "/operations/invitations/" + invitation.groupWorkspaceKey()
                + "/" + rawInvitationToken;
        return new ManagementInvitationView(
            invitation.id(), invitation.groupWorkspaceKey(), maskMobile(invitation.mobileNormalized()),
            invitation.mobileNormalized(), issuerDisplayName,
            type, targetPath, roleNames, invitation.status(), 1L,
            invitation.expiresAtEpochMillis(), invitation.version(), invitation.createdAtEpochMillis(),
            invitation.consentedAtEpochMillis(), invitation.completedAtEpochMillis(),
            invitation.cancelledAtEpochMillis(), invitationPageUrl
        );
    }

    @Transactional
    public void cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion) {
        cancel(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, AuditActor.system());
    }
    @Transactional
    public void cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor) {
        Invitation before = invitation(workspaceUuid, groupWorkspaceKey, invitationId);
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='CANCELLED', cancelled_at_epoch_millis=?, version=version+1 WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status IN ('PENDING','MOBILE_VERIFIED') AND version=?", time.currentEpochMillis(), invitationId, workspaceUuid, groupWorkspaceKey, expectedVersion) != 1) throw new InvitationStateException(); audit(workspaceUuid, groupWorkspaceKey, invitationId, "WORKSPACE_INVITATION_CANCELLED", actor, before.status(), "CANCELLED");
    }

    @Transactional
    public WorkspaceInvitationReadback cancel(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID invitationId,
        long expectedVersion,
        String idempotencyKey,
        AuditActor actor
    ) {
        return receipts.execute(
            workspaceUuid,
            idempotencyKey,
            canonical("cancel", workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion),
            WorkspaceInvitationReadback.class,
            () -> {
                cancel(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, actor);
                return OwnerOperationDiagnostics.readback(() -> readback(workspaceUuid, groupWorkspaceKey, invitationId));
            }
        );
    }

    @Transactional
    public WorkspaceInvitationReadback cancelForOperations(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID actorAssignmentId,
        String expectedTargetType,
        OrganizationTaskPathLookup.TaskPath selectedScope,
        UUID invitationId,
        long expectedVersion,
        String idempotencyKey,
        AuditActor actor
    ) {
        AssignmentIntent target = invitationTarget(invitationId);
        requireExpectedTargetType(expectedTargetType, target.serviceNodeType());
        requireExactOperationScope(selectedScope, target);
        commandAuthorization.requireUserManagementAction(
            workspaceUuid, groupWorkspaceKey, actorAssignmentId,
            target.serviceNodeType(), target.serviceNodeId(), UserManagementAction.INVITE
        );
        return cancel(
            workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, idempotencyKey, actor
        );
    }

    @Transactional
    public WorkspaceInvitationReadback reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion) {
        return reissue(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, AuditActor.system());
    }
    @Transactional
    public WorkspaceInvitationReadback reissue(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor) {
        Invitation previous = jdbc.query("SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, status, expires_at_epoch_millis, version FROM workspace_iam.invitation WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, invitationId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); }, result -> { if (!result.next()) throw new InvitationNotFoundException(); return new Invitation(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getLong(6), result.getLong(7)); });
        if (!Set.of("PENDING", "CANCELLED", "EXPIRED").contains(previous.status()) || previous.version() != expectedVersion) throw new InvitationStateException();
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='REISSUED', version=version+1 WHERE id=? AND version=?", invitationId, expectedVersion) != 1) throw new InvitationStateException();
        List<AssignmentIntent> intents = jdbc.query("SELECT role_id, service_node_type, service_node_id FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=?", (row, index) -> new AssignmentIntent(row.getObject(1, UUID.class), row.getString(2), row.getObject(3, UUID.class)), invitationId);
        audit(workspaceUuid, groupWorkspaceKey, invitationId, "WORKSPACE_INVITATION_REISSUED", actor, previous.status(), "REISSUED"); return create(workspaceUuid, groupWorkspaceKey, previous.mobile(), intents, time.currentEpochMillis() + 7 * 24 * 60 * 60 * 1000L, actor);
    }

    @Transactional
    public WorkspaceInvitationReadback reissue(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID invitationId,
        long expectedVersion,
        String idempotencyKey,
        AuditActor actor
    ) {
        return receipts.execute(
            workspaceUuid,
            idempotencyKey,
            canonical("reissue", workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion),
            WorkspaceInvitationReadback.class,
            () -> reissue(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, actor)
        );
    }

    @Transactional
    public WorkspaceInvitationReadback reissueForOperations(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID actorAssignmentId,
        String expectedTargetType,
        OrganizationTaskPathLookup.TaskPath selectedScope,
        UUID invitationId,
        long expectedVersion,
        String idempotencyKey,
        AuditActor actor
    ) {
        AssignmentIntent target = invitationTarget(invitationId);
        requireExpectedTargetType(expectedTargetType, target.serviceNodeType());
        requireExactOperationScope(selectedScope, target);
        commandAuthorization.requireUserManagementAction(
            workspaceUuid, groupWorkspaceKey, actorAssignmentId,
            target.serviceNodeType(), target.serviceNodeId(), UserManagementAction.INVITE
        );
        return reissue(
            workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, idempotencyKey, actor
        );
    }

    /** Public acceptance is deliberately separate from OTP delivery and creates no account or assignment. */
    @Transactional
    public PublicAcceptIntent acceptPublic(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        if (!"PENDING".equals(invitation.status()) || invitation.expiresAtEpochMillis() <= time.currentEpochMillis()) throw new InvitationStateException();
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='ACCEPT_INTENT_RECORDED', consented_at_epoch_millis=?, version=version+1 WHERE id=? AND status='PENDING' AND version=?", time.currentEpochMillis(), invitation.id(), invitation.version()) != 1) throw new InvitationStateException();
        audit(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.id(), "WORKSPACE_INVITATION_ACCEPT_INTENT_RECORDED", AuditActor.system(), invitation.status(), "ACCEPT_INTENT_RECORDED");
        return new PublicAcceptIntent("VERIFY_MOBILE");
    }

    @Transactional(readOnly = true)
    public PublicInvitationView publicView(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        List<String> roleNames = jdbc.query("SELECT r.name FROM workspace_iam.invitation_assignment_intent i JOIN workspace_iam.workspace_role r ON r.id=i.role_id WHERE i.invitation_id=? ORDER BY r.name", (row, index) -> row.getString(1), invitation.id());
        List<AssignmentIntent> intents = jdbc.query("SELECT role_id, service_node_type, service_node_id FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=? ORDER BY service_node_type, service_node_id", (row, index) -> new AssignmentIntent(row.getObject(1, UUID.class), row.getString(2), row.getObject(3, UUID.class)), invitation.id());
        if (roleNames.isEmpty() || intents.isEmpty()) throw new InvitationStateException();
        String type = intents.getFirst().serviceNodeType();
        if (intents.stream().anyMatch(intent -> !type.equals(intent.serviceNodeType()))) throw new InvitationStateException();
        String path = targetPath(invitation, intents, paths(invitation, intents));
        if (path.length() > 240) throw new InvitationStateException();
        return new PublicInvitationView(invitation.id(), invitation.groupWorkspaceKey(), type, path, roleNames, maskMobile(invitation.mobile()), invitation.status(), invitation.expiresAtEpochMillis());
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.OtpRateLimitedException.class)
    public PublicOtpDelivery sendPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        requireInvitationMobile(invitation, mobile);
        otpLimits.beforeSend(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), "INVITATION_MOBILE_VERIFY", invitation.id());
        long expires = Math.min(invitation.expiresAtEpochMillis(), time.currentEpochMillis() + 5 * 60 * 1000L);
        String otp = issueMobileVerificationOtp(invitation, expires);
        return new PublicOtpDelivery("delivery-pending-" + invitation.id(), expires, debugCodeExposure ? otp : null);
    }

    /** Returns an opaque one-time verification grant only to the public caller after a verified OTP. */
    @Transactional(noRollbackFor = {InvitationStateException.class, WorkspaceAuthenticationService.OtpRateLimitedException.class})
    public PublicReadiness verifyPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile, String rawOtp) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        requireInvitationMobile(invitation, mobile);
        if (!"ACCEPT_INTENT_RECORDED".equals(invitation.status()) || invitation.expiresAtEpochMillis() <= time.currentEpochMillis()) throw new InvitationStateException();
        otpLimits.beforeVerify(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), "INVITATION_MOBILE_VERIFY", invitation.id());
        int consumed = jdbc.update("UPDATE workspace_iam.otp_grant SET status='USED', used_at_epoch_millis=? WHERE subject_ref=? AND purpose='INVITATION_MOBILE_VERIFY' AND token_hash=? AND status='ACTIVE' AND expires_at_epoch_millis>?", time.currentEpochMillis(), invitation.id(), sha256(rawOtp), time.currentEpochMillis());
        if (consumed != 1) { jdbc.update("UPDATE workspace_iam.otp_grant SET attempt_count=attempt_count+1 WHERE subject_ref=? AND purpose='INVITATION_MOBILE_VERIFY' AND status='ACTIVE'", invitation.id()); otpLimits.invalidVerify(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), "INVITATION_MOBILE_VERIFY", invitation.id()); throw new InvitationStateException(); }
        otpLimits.successfulVerify(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), "INVITATION_MOBILE_VERIFY", invitation.id());
        String grant = randomToken(); long expires = Math.min(invitation.expiresAtEpochMillis(), time.currentEpochMillis() + 15 * 60 * 1000L);
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='MOBILE_VERIFIED', version=version+1 WHERE id=? AND status='ACCEPT_INTENT_RECORDED' AND version=?", invitation.id(), invitation.version()) != 1) throw new InvitationStateException();
        jdbc.update("INSERT INTO workspace_iam.invitation_public_progress (invitation_id, verification_grant_hash, verification_grant_expires_at_epoch_millis, version) VALUES (?, ?, ?, 1) ON CONFLICT (invitation_id) DO UPDATE SET verification_grant_hash=EXCLUDED.verification_grant_hash, verification_grant_expires_at_epoch_millis=EXCLUDED.verification_grant_expires_at_epoch_millis, version=workspace_iam.invitation_public_progress.version+1", invitation.id(), sha256(grant), expires);
        audit(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.id(), "WORKSPACE_INVITATION_MOBILE_VERIFIED", AuditActor.system(), invitation.status(), "MOBILE_VERIFIED");
        return new PublicReadiness(grant, accountExists(invitation), false, false, false, "COMPLETE_CREDENTIALS");
    }

    @Transactional
    public PublicReadiness savePublicCredentials(String groupWorkspaceKey, String rawInvitationToken, String grant, String userName, String loginName, char[] password) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        if (!"MOBILE_VERIFIED".equals(invitation.status()) || !validGrant(invitation.id(), grant) || password == null || password.length < 8) throw new InvitationStateException();
        String normalized = normalizedLogin(loginName); String name = text(userName, 120);
        if (jdbc.update("UPDATE workspace_iam.invitation_public_progress SET login_name_normalized=?, display_name=?, password_hash=?, credential_ready_at_epoch_millis=?, version=version+1 WHERE invitation_id=?", normalized, name, passwords.encode(new String(password)), time.currentEpochMillis(), invitation.id()) != 1) throw new InvitationStateException();
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='CREDENTIAL_READY', version=version+1 WHERE id=? AND status='MOBILE_VERIFIED' AND version=?", invitation.id(), invitation.version()) != 1) throw new InvitationStateException();
        audit(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.id(), "WORKSPACE_INVITATION_CREDENTIAL_READY", AuditActor.system(), invitation.status(), "CREDENTIAL_READY");
        return new PublicReadiness(grant, accountExists(invitation), true, true, true, "FINALIZE");
    }

    @Transactional
    public PublicCompletion completePublic(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        if ("COMPLETED".equals(invitation.status())) return completion(invitation);
        if (!"CREDENTIAL_READY".equals(invitation.status()) || invitation.expiresAtEpochMillis() <= time.currentEpochMillis()) throw new InvitationStateException();
        Progress progress = progress(invitation.id());
        if (progress.passwordHash() == null || progress.loginName() == null || progress.displayName() == null) throw new InvitationStateException();
        UUID accountId = completeReadyInvitation(invitation, progress);
        jdbc.update("UPDATE workspace_iam.invitation_public_progress SET completion_account_id=?, completed_at_epoch_millis=?, version=version+1 WHERE invitation_id=?", accountId, time.currentEpochMillis(), invitation.id());
        audit(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.id(), "WORKSPACE_INVITATION_COMPLETED", AuditActor.system(), invitation.status(), "COMPLETED");
        return completion(read(rawInvitationToken));
    }

    @Transactional(readOnly = true)
    public PublicCompletion publicCompletion(String groupWorkspaceKey, String rawInvitationToken) { return completion(requireGroupInvitation(groupWorkspaceKey, rawInvitationToken)); }

    /** Delivery adapters may receive this transient secret; HTTP edge controllers must never return it. */
    @Transactional
    public String issueMobileVerificationOtp(UUID invitationId, long expiresAtEpochMillis) {
        Invitation invitation = jdbc.query("SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, status, expires_at_epoch_millis, version FROM workspace_iam.invitation WHERE id=?", statement -> statement.setObject(1, invitationId), result -> { if (!result.next()) throw new InvitationNotFoundException(); return new Invitation(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getLong(6), result.getLong(7)); });
        return issueMobileVerificationOtp(invitation, expiresAtEpochMillis);
    }

    private String issueMobileVerificationOtp(Invitation invitation, long expiresAtEpochMillis) {
        if (!"ACCEPT_INTENT_RECORDED".equals(invitation.status()) || expiresAtEpochMillis <= time.currentEpochMillis() || expiresAtEpochMillis > invitation.expiresAtEpochMillis()) throw new InvitationStateException();
        jdbc.update("UPDATE workspace_iam.otp_grant SET status='SUPERSEDED' WHERE subject_ref=? AND purpose='INVITATION_MOBILE_VERIFY' AND status='ACTIVE'", invitation.id());
        String otp = fixedOtpIssuer == null ? String.format("%06d", random.nextInt(1_000_000)) : fixedOtpIssuer.issue("INVITATION_MOBILE_VERIFY", invitation.id());
        jdbc.update("INSERT INTO workspace_iam.otp_grant (id, workspace_uuid, group_workspace_key, purpose, token_hash, subject_ref, status, expires_at_epoch_millis) VALUES (?, ?, ?, 'INVITATION_MOBILE_VERIFY', ?, ?, 'ACTIVE', ?)", UUID.randomUUID(), invitation.workspaceUuid(), invitation.groupWorkspaceKey(), sha256(otp), invitation.id(), expiresAtEpochMillis);
        return otp;
    }

    @Transactional
    public String issueMobileVerificationOtp(String rawInvitationToken, long expiresAtEpochMillis) {
        return issueMobileVerificationOtp(read(rawInvitationToken), expiresAtEpochMillis);
    }

    @Transactional
    public String issueMobileVerificationOtp(String groupWorkspaceKey, String rawInvitationToken, long expiresAtEpochMillis) {
        return issueMobileVerificationOtp(requireGroupInvitation(groupWorkspaceKey, rawInvitationToken), expiresAtEpochMillis);
    }


    private void requireEnterable(Invitation invitation, AssignmentIntent intent) {
        boolean valid = switch (intent.serviceNodeType()) {
            case ServiceNodeTypes.STORE -> stores.isEnterableStore(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            case ServiceNodeTypes.HEAD_COMPANY -> entities.isEnterableEntity(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), ServiceNodeTypes.HEAD_COMPANY, intent.serviceNodeId());
            case ServiceNodeTypes.GROUP -> groups.isEnterableCommercialGroup(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.isEnterable(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            default -> false;
        };
        if (!valid) throw new InvitationValidationException();
    }

    private AssignmentIntent invitationTarget(UUID invitationId) {
        List<AssignmentIntent> intents = jdbc.query(
            "SELECT role_id, service_node_type, service_node_id "
                + "FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=?",
            (row, index) -> new AssignmentIntent(
                row.getObject(1, UUID.class), row.getString(2), row.getObject(3, UUID.class)
            ),
            invitationId
        );
        singleTargetType(intents);
        singleTargetId(intents);
        return intents.getFirst();
    }

    private static String singleTargetType(List<AssignmentIntent> intents) {
        if (intents == null || intents.isEmpty()) throw new InvitationValidationException();
        String targetType = intents.getFirst().serviceNodeType();
        if (intents.stream().anyMatch(intent -> !targetType.equals(intent.serviceNodeType()))) {
            throw new InvitationValidationException();
        }
        return targetType;
    }

    private static UUID singleTargetId(List<AssignmentIntent> intents) {
        if (intents == null || intents.isEmpty()) throw new InvitationValidationException();
        UUID targetId = intents.getFirst().serviceNodeId();
        if (targetId == null || intents.stream().anyMatch(intent -> !targetId.equals(intent.serviceNodeId()))) {
            throw new InvitationValidationException();
        }
        return targetId;
    }

    private static void requireExpectedTargetType(String expectedTargetType, String actualTargetType) {
        if (expectedTargetType == null || !expectedTargetType.equals(actualTargetType)) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
    }

    /** Mutating a scoped invitation is bound to the owner-confirmed page node, not merely its type. */
    private static void requireExactOperationScope(OrganizationTaskPathLookup.TaskPath selectedScope, AssignmentIntent target) {
        if (selectedScope == null
            || !target.serviceNodeType().equals(selectedScope.targetType())
            || !target.serviceNodeId().equals(selectedScope.targetId())) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
    }

    private UUID completeReadyInvitation(Invitation invitation, Progress progress) {
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='COMPLETING', version=version+1 WHERE id=? AND status='CREDENTIAL_READY' AND version=?", invitation.id(), invitation.version()) != 1) throw new InvitationStateException();
        List<AssignmentIntent> intents = jdbc.query("SELECT role_id, service_node_type, service_node_id FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=?", (row, index) -> new AssignmentIntent(row.getObject(1, UUID.class), row.getString(2), row.getObject(3, UUID.class)), invitation.id());
        if (intents.isEmpty()) throw new InvitationValidationException();
        for (AssignmentIntent intent : intents) { roles.require(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.roleId()); requireEnterable(invitation, intent); }
        UUID accountId = jdbc.query("SELECT id FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND group_workspace_key=? AND mobile_normalized=?", statement -> { statement.setObject(1, invitation.workspaceUuid()); statement.setString(2, invitation.groupWorkspaceKey()); statement.setString(3, invitation.mobile()); }, result -> result.next() ? result.getObject(1, UUID.class) : null);
        long now = time.currentEpochMillis();
        if (accountId == null) {
            accountId = UUID.randomUUID();
            jdbc.update("INSERT INTO workspace_iam.workspace_account (id, workspace_uuid, group_workspace_key, mobile_normalized, login_name_normalized, display_name, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)", accountId, invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.mobile(), progress.loginName(), progress.displayName(), now, now);
            jdbc.update("INSERT INTO workspace_iam.workspace_credential (account_id, password_hash, algorithm, changed_at_epoch_millis, version) VALUES (?, ?, 'bcrypt', ?, 1)", accountId, progress.passwordHash(), now);
        }
        for (AssignmentIntent intent : intents) jdbc.update("INSERT INTO workspace_iam.role_assignment (id, workspace_uuid, group_workspace_key, account_id, role_id, source_invitation_id, service_node_type, service_node_id, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)", UUID.randomUUID(), invitation.workspaceUuid(), invitation.groupWorkspaceKey(), accountId, intent.roleId(), invitation.id(), intent.serviceNodeType(), intent.serviceNodeId(), time.currentEpochMillis(), time.currentEpochMillis());
        if (jdbc.update("UPDATE workspace_iam.invitation SET status='COMPLETED', completed_at_epoch_millis=?, version=version+1 WHERE id=? AND status='COMPLETING'", time.currentEpochMillis(), invitation.id()) != 1) throw new InvitationStateException();
        return accountId;
    }

    /**
     * Immutable management-view facts for one invitation set.  Intent rows and role display
     * names share one owner-local join rather than issuing sibling reads for the same ids.
     */
    private InvitationAssignmentIntentFacts loadInvitationAssignmentIntentFacts(List<WorkspaceInvitationReadback> invitations) {
        List<UUID> ids = invitations.stream().map(WorkspaceInvitationReadback::id).toList();
        Map<UUID, List<AssignmentIntent>> intents = new LinkedHashMap<>();
        Map<UUID, List<String>> roleNames = new LinkedHashMap<>();
        ids.forEach(id -> { intents.put(id, new ArrayList<>()); roleNames.put(id, new ArrayList<>()); });
        jdbc.query(
            "SELECT intent.invitation_id, intent.role_id, intent.service_node_type, intent.service_node_id, role.name FROM workspace_iam.invitation_assignment_intent intent JOIN workspace_iam.workspace_role role ON role.id=intent.role_id WHERE intent.invitation_id IN (" + placeholders(ids.size()) + ") ORDER BY intent.invitation_id, intent.service_node_type, intent.service_node_id, role.name",
            statement -> { for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index)); },
            (org.springframework.jdbc.core.RowCallbackHandler) row -> {
                UUID invitationId = row.getObject(1, UUID.class);
                intents.get(invitationId).add(new AssignmentIntent(row.getObject(2, UUID.class), row.getString(3), row.getObject(4, UUID.class)));
                roleNames.get(invitationId).add(row.getString(5));
            }
        );
        return new InvitationAssignmentIntentFacts(copyLists(intents), copyLists(roleNames));
    }

    private static <T> Map<UUID, List<T>> copyLists(Map<UUID, List<T>> values) {
        Map<UUID, List<T>> copy = new LinkedHashMap<>();
        values.forEach((id, value) -> copy.put(id, List.copyOf(value)));
        return Map.copyOf(copy);
    }

    private Map<UUID, String> issuerNamesByInvitation(List<WorkspaceInvitationReadback> invitations) {
        List<UUID> ids = invitations.stream().map(WorkspaceInvitationReadback::id).toList();
        Map<UUID, String> result = new LinkedHashMap<>();
        jdbc.query(
            "SELECT id, issuer_display_name_snapshot FROM workspace_iam.invitation WHERE id IN (" + placeholders(ids.size()) + ")",
            statement -> { for (int index = 0; index < ids.size(); index++) statement.setObject(index + 1, ids.get(index)); },
            (org.springframework.jdbc.core.RowCallbackHandler) row -> result.put(row.getObject(1, UUID.class), row.getString(2))
        );
        if (result.size() != ids.size()) throw new InvitationStateException();
        return Map.copyOf(result);
    }

    private Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths(Invitation invitation, List<AssignmentIntent> intents) {
        if (taskPaths == null) return Map.of();
        List<OrganizationTaskPathLookup.TaskPathRef> refs = intents.stream()
            .map(intent -> new OrganizationTaskPathLookup.TaskPathRef(intent.serviceNodeType(), intent.serviceNodeId()))
            .distinct()
            .toList();
        return taskPaths.describePersistedTaskPaths(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), refs);
    }

    private String targetPath(Invitation invitation, List<AssignmentIntent> intents, Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        return intents.stream().map(intent -> {
            if (taskPaths == null) return path(invitation, intent);
            OrganizationTaskPathLookup.TaskPath value = paths.get(new OrganizationTaskPathLookup.TaskPathRef(intent.serviceNodeType(), intent.serviceNodeId()));
            if (value == null) throw new InvitationStateException();
            return value.displayPath();
        }).distinct().reduce((first, second) -> first + " ; " + second).orElseThrow(InvitationStateException::new);
    }

    private static Invitation owner(WorkspaceInvitationReadback invitation) {
        return new Invitation(invitation.id(), invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.mobileNormalized(), invitation.status(), invitation.expiresAtEpochMillis(), invitation.version());
    }

    private static String placeholders(int size) {
        if (size <= 0) throw new InvitationStateException();
        return String.join(",", java.util.Collections.nCopies(size, "?"));
    }

    private String path(Invitation invitation, AssignmentIntent intent) {
        return switch (intent.serviceNodeType()) {
            case ServiceNodeTypes.GROUP -> groups.describeCommercialGroup(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.describePath(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> entities.describeEntityPath(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeType(), intent.serviceNodeId());
            default -> throw new InvitationValidationException();
        };
    }

    private static CommercialGroupLookup legacyGroups(OrganizationNodeLookup nodes) {
        return new CommercialGroupLookup() {
            @Override public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) { throw new UnsupportedOperationException("legacy tests supply a GROUP node"); }
            @Override public boolean isEnterableCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) { return nodes.isEnterable(workspaceUuid, groupWorkspaceKey, commercialGroupRef); }
            @Override public String describeCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) { return nodes.describePath(workspaceUuid, groupWorkspaceKey, commercialGroupRef); }
        };
    }
    private void audit(UUID workspaceUuid, String key, UUID invitationId, String action, AuditActor actor, String beforeStatus, String afterStatus) { AuditChangePolicy policy = new AuditChangePolicy("WORKSPACE_INVITATION", action, INVITATION_FIELDS); List<AuditChange> changes = List.of(new AuditChange("status", beforeStatus, afterStatus), new AuditChange("lifecycleEvent", null, action)); jdbc.update("INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'WORKSPACE_INVITATION', ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))", UUID.randomUUID(), workspaceUuid, key, invitationId.toString(), actor.actorType(), actor.actorId(), actor.displaySnapshot(), action, time.currentEpochMillis(), auditJson(policy.allow(changes))); }
    private Invitation invitation(UUID workspaceUuid, String key, UUID invitationId) { return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, status, expires_at_epoch_millis, version FROM workspace_iam.invitation WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, invitationId); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> { if (!result.next()) throw new InvitationNotFoundException(); return new Invitation(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getLong(6), result.getLong(7)); }); }
    private WorkspaceInvitationReadback readback(UUID workspaceUuid, String key, UUID invitationId) {
        return jdbc.query(
            "SELECT id, mobile_normalized, status, expires_at_epoch_millis, version, "
                + "created_at_epoch_millis, consented_at_epoch_millis, completed_at_epoch_millis, "
                + "cancelled_at_epoch_millis, invitation_token FROM workspace_iam.invitation "
                + "WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
            statement -> {
                statement.setObject(1, invitationId);
                statement.setObject(2, workspaceUuid);
                statement.setString(3, key);
            },
            result -> {
                if (!result.next()) throw new InvitationNotFoundException();
                return new WorkspaceInvitationReadback(
                    result.getObject(1, UUID.class), workspaceUuid, key, result.getString(2),
                    result.getString(3), result.getLong(4), result.getLong(5), result.getLong(6),
                    result.getObject(7, Long.class), result.getObject(8, Long.class),
                    result.getObject(9, Long.class), result.getString(10)
                );
            }
        );
    }
    private static String auditJson(List<AuditChange> changes) { return AuditChangeJson.write(changes); }

    private boolean accountExists(Invitation invitation) { return jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=? AND group_workspace_key=? AND mobile_normalized=?", Integer.class, invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.mobile()) > 0; }
    private boolean validGrant(UUID invitationId, String rawGrant) { return rawGrant != null && jdbc.queryForObject("SELECT COUNT(*) FROM workspace_iam.invitation_public_progress WHERE invitation_id=? AND verification_grant_hash=? AND verification_grant_expires_at_epoch_millis>?", Integer.class, invitationId, sha256(rawGrant), time.currentEpochMillis()) == 1; }
    private Progress progress(UUID invitationId) { return jdbc.query("SELECT login_name_normalized, display_name, password_hash, completion_account_id FROM workspace_iam.invitation_public_progress WHERE invitation_id=?", statement -> statement.setObject(1, invitationId), result -> { if (!result.next()) throw new InvitationStateException(); return new Progress(result.getString(1), result.getString(2), result.getString(3), result.getObject(4, UUID.class)); }); }
    private PublicCompletion completion(Invitation invitation) { Progress progress = progress(invitation.id()); if (!"COMPLETED".equals(invitation.status()) || progress.accountId() == null) throw new InvitationStateException(); return new PublicCompletion(invitation.id(), "COMPLETED", "邀请已完成", "/operations/" + invitation.groupWorkspaceKey() + "/login"); }
    private Invitation requireGroupInvitation(String groupWorkspaceKey, String rawInvitationToken) { Invitation invitation = read(rawInvitationToken); if (!groupWorkspaceKey.equals(invitation.groupWorkspaceKey())) throw new InvitationNotFoundException(); return invitation; }
    private static void requireInvitationMobile(Invitation invitation, String requestedMobile) { if (!invitation.mobile().equals(normalizedMobile(requestedMobile))) throw new InvitationValidationException(); }

    private Invitation read(String raw) { return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, mobile_normalized, status, expires_at_epoch_millis, version FROM workspace_iam.invitation WHERE token_hash=?", statement -> statement.setString(1, sha256(raw)), result -> { if (!result.next()) throw new InvitationNotFoundException(); return new Invitation(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getLong(6), result.getLong(7)); }); }
    private String randomToken() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
    private static String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception failure) { throw new IllegalStateException(failure); } }
    private static String canonical(String operation, Object... values) {
        StringBuilder result = new StringBuilder(operation);
        for (Object value : values) {
            String text;
            if (value instanceof List<?> list) {
                text = list.stream().map(String::valueOf).sorted().reduce((left, right) -> left + "," + right).orElse("");
            } else {
                text = String.valueOf(value);
            }
            result.append('|').append(text.length()).append(':').append(text);
        }
        return result.toString();
    }
    private static String normalizedMobile(String value) { String normalized = value == null ? "" : value.replace(" ", "").replace("-", ""); if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new InvitationValidationException(); return normalized.startsWith("+") ? normalized.substring(1) : normalized; }
    private static String normalizedLogin(String value) { if (value == null || !value.matches("^[A-Za-z0-9_.-]{3,120}$")) throw new InvitationValidationException(); return value.toLowerCase(); }
    private static String text(String value, int limit) { if (value == null || value.isBlank() || value.trim().length() > limit) throw new InvitationValidationException(); return value.trim(); }
    private static String maskMobile(String value) { return value.length() <= 4 ? "****" : value.substring(0, Math.min(3, value.length())) + "****" + value.substring(Math.max(3, value.length() - 4)); }
    public record AssignmentIntent(UUID roleId, String serviceNodeType, UUID serviceNodeId) {
        @Override public String toString() {
            return roleId + ":" + serviceNodeType + ":" + serviceNodeId;
        }
    }
    public record PublicAcceptIntent(String nextStep) { }
    public record PublicReadiness(String verificationGrant, boolean accountExists, boolean userNameReady, boolean loginNameReady, boolean passwordReady, String nextStep) { }
    public record PublicCompletion(UUID invitationId, String status, String message, String loginPath) { }
    public record PublicInvitationView(UUID invitationId, String groupWorkspaceKey, String targetOrganizationType, String targetOrganizationPath, List<String> roleNames, String maskedMobile, String status, long expiresAt) { }
    public record PublicOtpDelivery(String verificationId, long expiresAt, String debugVerificationCode) { }
    public record ManagementInvitationView(
        UUID id,
        String groupWorkspaceKey,
        String maskedMobile,
        String mobile,
        String issuerDisplayName,
        String targetOrganizationType,
        String targetOrganizationPath,
        List<String> roleNames,
        String status,
        long generation,
        long expiresAt,
        long revision,
        long createdAt,
        Long consentedAt,
        Long completedAt,
        Long cancelledAt,
        String invitationPageUrl
    ) { }
    public record ManagementInvitationPageRequest(String mobile, String targetOrganizationType, UUID targetOrganizationRef, UUID roleId, String status, Long expiresFrom, Long expiresTo, String sort, String direction, int page, int pageSize) {
    }
    public record ManagementInvitationPage(List<ManagementInvitationView> items, int page, int pageSize, long total, ManagementInvitationPageRequest criteria) { public ManagementInvitationPage { items = List.copyOf(items); } }
    private record InvitationPageSql(String where, List<Object> arguments) { }
    private record PageRequest(int page, int pageSize, String orderColumn, String direction, ManagementInvitationPageRequest criteria) {
        private static PageRequest from(ManagementInvitationPageRequest request) {
            if (request == null || request.page() < 1 || request.pageSize() < 1 || request.pageSize() > 100) throw new InvitationValidationException();
            String sort = request.sort() == null ? "CREATED_AT" : request.sort();
            String direction = request.direction() == null ? "DESC" : request.direction();
            String column = switch (sort) { case "CREATED_AT" -> "created_at_epoch_millis"; case "EXPIRES_AT" -> "expires_at_epoch_millis"; default -> throw new InvitationValidationException(); };
            if (!Set.of("ASC", "DESC").contains(direction)) throw new InvitationValidationException();
            return new PageRequest(request.page(), request.pageSize(), column, direction, new ManagementInvitationPageRequest(request.mobile(), request.targetOrganizationType(), request.targetOrganizationRef(), request.roleId(), request.status(), request.expiresFrom(), request.expiresTo(), sort, direction, request.page(), request.pageSize()));
        }
    }
    private record Invitation(UUID id, UUID workspaceUuid, String groupWorkspaceKey, String mobile, String status, long expiresAtEpochMillis, long version) { }
    private record InvitationAssignmentIntentFacts(Map<UUID, List<AssignmentIntent>> intentsByInvitation, Map<UUID, List<String>> roleNamesByInvitation) { }
    private record Progress(String loginName, String displayName, String passwordHash, UUID accountId) { }
    public static final class InvitationNotFoundException extends RuntimeException { }
    public static final class InvitationStateException extends RuntimeException { }
    public static final class InvitationValidationException extends RuntimeException { }
}
