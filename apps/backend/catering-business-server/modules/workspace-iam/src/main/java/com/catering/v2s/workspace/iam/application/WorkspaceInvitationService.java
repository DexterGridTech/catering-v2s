package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.seed.DevFixedOtpIssuer;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog.UserManagementAction;
import com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.persistence.WorkspaceInvitationPersistence;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceInvitationService {
    private static final Set<String> INVITATION_FIELDS = Set.of("status", "lifecycleEvent");
    private static final long MANAGEMENT_INVITATION_TTL_MILLIS = 7 * 24 * 60 * 60 * 1000L;
    private final WorkspaceInvitationPersistence persistence;
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

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceInvitationService(
            WorkspaceInvitationPersistence persistence,
            TimeProvider time,
            WorkspaceRoleService roles,
            OrganizationNodeLookup nodes,
            StoreAssignmentLookup stores,
            OrganizationEntityLookup entities,
            CommercialGroupLookup groups,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceCommandAuthorizationService commandAuthorization,
            WorkspaceUserService user,
            OrganizationTaskPathLookup taskPaths,
            OrganizationAssignmentCandidateLookup candidates,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy,
            ObjectProvider<DevFixedOtpIssuer> fixedOtpIssuer) {
        this(
                persistence,
                time,
                roles,
                nodes,
                stores,
                entities,
                groups,
                otpLimits,
                receipts,
                commandAuthorization,
                user,
                taskPaths,
                candidates,
                otpDebugExposurePolicy.enabled(),
                fixedOtpIssuer.getIfAvailable());
    }

    /** Compatibility constructor retained for focused owner tests; production wiring uses the typed boundary above. */
    public WorkspaceInvitationService(
            JdbcTemplate jdbc,
            TimeProvider time,
            WorkspaceRoleService roles,
            OrganizationNodeLookup nodes,
            StoreAssignmentLookup stores,
            OrganizationEntityLookup entities,
            CommercialGroupLookup groups,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceCommandAuthorizationService commandAuthorization,
            WorkspaceUserService user,
            OrganizationTaskPathLookup taskPaths,
            OrganizationAssignmentCandidateLookup candidates,
            com.catering.v2s.platform.foundation.security.OtpDebugExposurePolicy otpDebugExposurePolicy,
            ObjectProvider<DevFixedOtpIssuer> fixedOtpIssuer) {
        this(
                new WorkspaceInvitationPersistence(jdbc),
                time,
                roles,
                nodes,
                stores,
                entities,
                groups,
                otpLimits,
                receipts,
                commandAuthorization,
                user,
                taskPaths,
                candidates,
                otpDebugExposurePolicy.enabled(),
                fixedOtpIssuer.getIfAvailable());
    }

    private WorkspaceInvitationService(
            WorkspaceInvitationPersistence persistence,
            TimeProvider time,
            WorkspaceRoleService roles,
            OrganizationNodeLookup nodes,
            StoreAssignmentLookup stores,
            OrganizationEntityLookup entities,
            CommercialGroupLookup groups,
            WorkspaceOtpRateLimitService otpLimits,
            WorkspaceIamCommandReceiptService receipts,
            WorkspaceCommandAuthorizationService commandAuthorization,
            WorkspaceUserService user,
            OrganizationTaskPathLookup taskPaths,
            OrganizationAssignmentCandidateLookup candidates,
            boolean debugCodeExposure,
            DevFixedOtpIssuer fixedOtpIssuer) {
        this.persistence = persistence;
        this.time = time;
        this.roles = roles;
        this.nodes = nodes;
        this.stores = stores;
        this.entities = entities;
        this.groups = groups;
        this.otpLimits = otpLimits;
        this.receipts = receipts;
        this.commandAuthorization = commandAuthorization;
        this.user = user;
        this.taskPaths = taskPaths;
        this.candidates = candidates;
        this.debugCodeExposure = debugCodeExposure;
        this.fixedOtpIssuer = fixedOtpIssuer;
    }

    @Transactional
    public WorkspaceInvitationReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            List<AssignmentIntent> intents,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("create", workspaceUuid, groupWorkspaceKey, mobile, intents),
                WorkspaceInvitationReadback.class,
                () -> createWithFacts(
                                workspaceUuid,
                                groupWorkspaceKey,
                                mobile,
                                intents,
                                time.currentEpochMillis() + MANAGEMENT_INVITATION_TTL_MILLIS,
                                actor)
                        .readback());
    }

    @Transactional
    public ManagementInvitationView createForOperations(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID actorAssignmentId,
            OrganizationTaskPathLookup.TaskPath validatedTarget,
            String mobile,
            List<AssignmentIntent> intents,
            String idempotencyKey,
            AuditActor actor) {
        String targetType = singleTargetType(intents);
        UUID targetId = singleTargetId(intents);
        if (validatedTarget == null
                || !targetType.equals(validatedTarget.targetType())
                || !targetId.equals(validatedTarget.targetId())) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        commandAuthorization.requireUserManagementAction(
                workspaceUuid,
                groupWorkspaceKey,
                actorAssignmentId,
                targetType,
                validatedTarget,
                UserManagementAction.INVITE);
        List<CreatedInvitation> created = new ArrayList<>(1);
        WorkspaceInvitationReadback invitation = receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("create", workspaceUuid, groupWorkspaceKey, mobile, intents),
                WorkspaceInvitationReadback.class,
                () -> {
                    CreatedInvitation value = createWithFacts(
                            workspaceUuid,
                            groupWorkspaceKey,
                            mobile,
                            intents,
                            time.currentEpochMillis() + MANAGEMENT_INVITATION_TTL_MILLIS,
                            actor);
                    created.add(value);
                    return value.readback();
                });
        // A replay must preserve the stored receipt exactly, so it uses the standard owner read. A fresh create has
        // all display facts in the command-local result and must not reopen them merely to paint the response.
        return created.isEmpty()
                ? managementView(invitation)
                : createdManagementView(created.getFirst(), validatedTarget, actor.displaySnapshot());
    }

    @Transactional
    public WorkspaceInvitationReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            List<AssignmentIntent> intents,
            long expiresAtEpochMillis) {
        return create(workspaceUuid, groupWorkspaceKey, mobile, intents, expiresAtEpochMillis, AuditActor.system());
    }

    @Transactional
    public WorkspaceInvitationReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            List<AssignmentIntent> intents,
            long expiresAtEpochMillis,
            AuditActor actor) {
        return createWithFacts(workspaceUuid, groupWorkspaceKey, mobile, intents, expiresAtEpochMillis, actor)
                .readback();
    }

    private CreatedInvitation createWithFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            List<AssignmentIntent> intents,
            long expiresAtEpochMillis,
            AuditActor actor) {
        if (expiresAtEpochMillis <= time.currentEpochMillis() || intents == null || intents.isEmpty())
            throw new InvitationValidationException();
        singleTargetType(intents);
        singleTargetId(intents);
        String normalizedMobile = normalizedMobile(mobile);
        AccountPresence accountPresence = accountPresence(workspaceUuid, groupWorkspaceKey, normalizedMobile);
        requireBindableAccount(accountPresence);
        Map<UUID, InvitationRoleFact> rolesById = requireEnabledInvitationRoles(
                workspaceUuid,
                groupWorkspaceKey,
                intents.stream().map(AssignmentIntent::roleId).toList());
        String raw = randomToken();
        UUID invitationId = UUID.randomUUID();
        long now = time.currentEpochMillis();
        Invitation pending = new Invitation(
                invitationId, workspaceUuid, groupWorkspaceKey, normalizedMobile, "PENDING", expiresAtEpochMillis, 1);
        for (AssignmentIntent intent : intents) {
            InvitationRoleFact role = rolesById.get(intent.roleId());
            if (role == null) throw new InvitationValidationException();
            if (!role.serviceNodeType().equals(intent.serviceNodeType())) throw new InvitationValidationException();
        }
        // A create command admits exactly one service-node target. Its enterability is a command fact, not a
        // per-role fact; validating it once preserves the same guard without multiplying organization reads.
        requireEnterable(pending, intents.getFirst());
        persistence.insertInvitation(
                invitationId,
                workspaceUuid,
                groupWorkspaceKey,
                sha256(raw),
                raw,
                normalizedMobile,
                actor.displaySnapshot(),
                expiresAtEpochMillis,
                now);
        for (AssignmentIntent intent : intents) {
            persistence.insertAssignmentIntent(
                    invitationId, intent.roleId(), intent.serviceNodeType(), intent.serviceNodeId());
        }
        audit(workspaceUuid, groupWorkspaceKey, invitationId, "WORKSPACE_INVITATION_CREATED", actor, null, "PENDING");
        WorkspaceInvitationReadback readback = new WorkspaceInvitationReadback(
                invitationId,
                workspaceUuid,
                groupWorkspaceKey,
                normalizedMobile,
                "PENDING",
                expiresAtEpochMillis,
                1,
                now,
                null,
                null,
                null,
                raw);
        List<String> roleNames = rolesById.values().stream()
                .map(InvitationRoleFact::name)
                .sorted()
                .toList();
        return new CreatedInvitation(readback, roleNames);
    }

    /** Owner-owned platform page: filters, total and bounds finish before edge mapping. */
    @Transactional(readOnly = true)
    public ManagementInvitationPage managementPage(
            UUID workspaceUuid, String groupWorkspaceKey, ManagementInvitationPageRequest request) {
        return managementPage(workspaceUuid, groupWorkspaceKey, request, null, null);
    }

    /** Owner-owned operations page; the endpoint-fixed type is never inferred from the session. */
    @Transactional(readOnly = true)
    public ManagementInvitationPage managementPageForOperations(
            WorkspaceSessionReadback session,
            String expectedTargetType,
            UUID requestedScopeRef,
            ManagementInvitationPageRequest request) {
        if (user == null) throw new WorkspaceAuthenticationService.SessionInvalidException();
        OrganizationTaskPathLookup.TaskPath scope =
                user.resolveTaskScope(session, expectedTargetType, requestedScopeRef);
        boolean aggregate = ServiceNodeTypes.GROUP.equals(scope.targetType())
                && ServiceNodeTypes.HEAD_COMPANY.equals(expectedTargetType);
        return managementPage(
                session.workspaceUuid(),
                session.groupWorkspaceKey(),
                request,
                expectedTargetType,
                aggregate ? null : scope.targetId());
    }

    private ManagementInvitationPage managementPage(
            UUID workspaceUuid,
            String key,
            ManagementInvitationPageRequest request,
            String fixedTargetType,
            UUID fixedTargetId) {
        PageRequest page = PageRequest.from(request);
        WorkspaceInvitationPersistence.PageRows result = persistence.page(
                workspaceUuid,
                key,
                normalizedMobileQuery(request.mobile()),
                request.status(),
                request.expiresFrom(),
                request.expiresTo(),
                request.targetOrganizationType(),
                request.targetOrganizationRef(),
                request.roleId(),
                fixedTargetType,
                fixedTargetId,
                page.sort(),
                page.direction(),
                page.page(),
                page.pageSize());
        long total = result.total();
        if (total == 0)
            return new ManagementInvitationPage(List.of(), page.page(), page.pageSize(), 0L, page.criteria());
        List<WorkspaceInvitationReadback> rows = result.items().stream()
                .map(row -> new WorkspaceInvitationReadback(
                        row.id(),
                        workspaceUuid,
                        key,
                        row.mobile(),
                        row.status(),
                        row.expiresAtEpochMillis(),
                        row.version(),
                        row.createdAtEpochMillis(),
                        row.consentedAtEpochMillis(),
                        row.completedAtEpochMillis(),
                        row.cancelledAtEpochMillis(),
                        row.invitationToken()))
                .toList();
        return new ManagementInvitationPage(
                managementViews(rows), page.page(), page.pageSize(), total, page.criteria());
    }

    private static String normalizedMobileQuery(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.replace(" ", "").replace("-", "");
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    @Transactional(readOnly = true)
    public ManagementInvitationView managementView(WorkspaceInvitationReadback invitation) {
        return managementViews(List.of(invitation)).getFirst();
    }

    private ManagementInvitationView createdManagementView(
            CreatedInvitation created, OrganizationTaskPathLookup.TaskPath target, String issuerDisplayName) {
        WorkspaceInvitationReadback invitation = created.readback();
        return new ManagementInvitationView(
                invitation.id(),
                invitation.groupWorkspaceKey(),
                maskMobile(invitation.mobileNormalized()),
                invitation.mobileNormalized(),
                issuerDisplayName,
                target.targetType(),
                target.nodes(),
                created.roleNames(),
                invitation.status(),
                1L,
                invitation.expiresAtEpochMillis(),
                invitation.version(),
                invitation.createdAtEpochMillis(),
                invitation.consentedAtEpochMillis(),
                invitation.completedAtEpochMillis(),
                invitation.cancelledAtEpochMillis(),
                invitationRouteFacts(invitation));
    }

    /** Owner read used by the platform detail before a CAS command; it is scoped to one workspace. */
    @Transactional(readOnly = true)
    public ManagementInvitationView managementInvitation(
            UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId) {
        return managementView(readback(workspaceUuid, groupWorkspaceKey, invitationId));
    }

    private List<ManagementInvitationView> managementViews(List<WorkspaceInvitationReadback> invitations) {
        if (invitations.isEmpty()) return List.of();
        InvitationAssignmentIntentFacts facts = loadInvitationAssignmentIntentFacts(invitations);
        return managementViews(invitations, facts);
    }

    private List<ManagementInvitationView> managementViews(
            List<WorkspaceInvitationReadback> invitations, InvitationAssignmentIntentFacts facts) {
        if (invitations.isEmpty()) return List.of();
        Map<UUID, String> issuerNamesByInvitation = issuerNamesByInvitation(invitations);
        Invitation owner = owner(invitations.getFirst());
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = paths(
                owner,
                invitations.stream()
                        .flatMap(invitation ->
                                facts.intentsByInvitation().getOrDefault(invitation.id(), List.of()).stream())
                        .toList());
        return invitations.stream()
                .map(invitation -> managementView(
                        invitation,
                        facts.intentsByInvitation().get(invitation.id()),
                        facts.roleNamesByInvitation().get(invitation.id()),
                        issuerNamesByInvitation.get(invitation.id()),
                        paths))
                .toList();
    }

    private ManagementInvitationView managementView(
            WorkspaceInvitationReadback invitation,
            List<AssignmentIntent> intents,
            List<String> roleNames,
            String issuerDisplayName,
            Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        if (intents.isEmpty() || roleNames.isEmpty()) throw new InvitationStateException();
        String type = intents.getFirst().serviceNodeType();
        if (intents.stream().anyMatch(intent -> !type.equals(intent.serviceNodeType()))) {
            throw new InvitationStateException();
        }
        List<OrganizationTaskPathLookup.TaskPathNode> targetPathNodes =
                targetPathNodes(owner(invitation), intents, paths);
        return new ManagementInvitationView(
                invitation.id(),
                invitation.groupWorkspaceKey(),
                maskMobile(invitation.mobileNormalized()),
                invitation.mobileNormalized(),
                issuerDisplayName,
                type,
                targetPathNodes,
                roleNames,
                invitation.status(),
                1L,
                invitation.expiresAtEpochMillis(),
                invitation.version(),
                invitation.createdAtEpochMillis(),
                invitation.consentedAtEpochMillis(),
                invitation.completedAtEpochMillis(),
                invitation.cancelledAtEpochMillis(),
                invitationRouteFacts(invitation));
    }

    @Transactional
    public void cancel(UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion) {
        cancel(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, AuditActor.system());
    }

    @Transactional
    public void cancel(
            UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor) {
        Invitation before = invitation(workspaceUuid, groupWorkspaceKey, invitationId);
        if (persistence.cancel(
                        invitationId, workspaceUuid, groupWorkspaceKey, time.currentEpochMillis(), expectedVersion)
                != 1) throw new InvitationStateException();
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                invitationId,
                "WORKSPACE_INVITATION_CANCELLED",
                actor,
                before.status(),
                "CANCELLED");
    }

    @Transactional
    public WorkspaceInvitationReadback cancel(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID invitationId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("cancel", workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion),
                WorkspaceInvitationReadback.class,
                () -> {
                    cancel(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, actor);
                    return OwnerOperationDiagnostics.readback(
                            () -> readback(workspaceUuid, groupWorkspaceKey, invitationId));
                });
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
            AuditActor actor) {
        AssignmentIntent target = invitationTarget(invitationId);
        requireExpectedTargetType(expectedTargetType, target.serviceNodeType());
        requireExactOperationScope(selectedScope, target);
        commandAuthorization.requireUserManagementAction(
                workspaceUuid,
                groupWorkspaceKey,
                actorAssignmentId,
                target.serviceNodeType(),
                selectedScope,
                UserManagementAction.INVITE);
        return cancel(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, idempotencyKey, actor);
    }

    @Transactional
    public WorkspaceInvitationReadback reissue(
            UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion) {
        return reissue(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, AuditActor.system());
    }

    @Transactional
    public WorkspaceInvitationReadback reissue(
            UUID workspaceUuid, String groupWorkspaceKey, UUID invitationId, long expectedVersion, AuditActor actor) {
        Invitation previous = invitation(workspaceUuid, groupWorkspaceKey, invitationId);
        if (!Set.of("PENDING", "CANCELLED", "EXPIRED").contains(previous.status())
                || previous.version() != expectedVersion) throw new InvitationStateException();
        if (persistence.reissue(invitationId, expectedVersion) != 1) throw new InvitationStateException();
        List<AssignmentIntent> intents = assignmentIntents(invitationId);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                invitationId,
                "WORKSPACE_INVITATION_REISSUED",
                actor,
                previous.status(),
                "REISSUED");
        return create(
                workspaceUuid,
                groupWorkspaceKey,
                previous.mobile(),
                intents,
                time.currentEpochMillis() + 7 * 24 * 60 * 60 * 1000L,
                actor);
    }

    @Transactional
    public WorkspaceInvitationReadback reissue(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID invitationId,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("reissue", workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion),
                WorkspaceInvitationReadback.class,
                () -> reissue(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, actor));
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
            AuditActor actor) {
        AssignmentIntent target = invitationTarget(invitationId);
        requireExpectedTargetType(expectedTargetType, target.serviceNodeType());
        requireExactOperationScope(selectedScope, target);
        commandAuthorization.requireUserManagementActionOnValidatedScope(
                workspaceUuid,
                groupWorkspaceKey,
                actorAssignmentId,
                expectedTargetType,
                selectedScope,
                UserManagementAction.INVITE);
        return reissue(workspaceUuid, groupWorkspaceKey, invitationId, expectedVersion, idempotencyKey, actor);
    }

    /** Public acceptance is deliberately separate from OTP delivery and creates no account or assignment. */
    @Transactional
    public PublicAcceptIntent acceptPublic(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        String nextStep = publicResumeStep(invitation);
        if ("ACCEPT".equals(nextStep)) {
            if (persistence.acceptIntent(invitation.id(), time.currentEpochMillis(), invitation.version()) == 1) {
                audit(
                        invitation.workspaceUuid(),
                        invitation.groupWorkspaceKey(),
                        invitation.id(),
                        "WORKSPACE_INVITATION_ACCEPT_INTENT_RECORDED",
                        AuditActor.system(),
                        invitation.status(),
                        "ACCEPT_INTENT_RECORDED");
                return new PublicAcceptIntent("VERIFY_MOBILE");
            }
            invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
            nextStep = publicResumeStep(invitation);
        }
        if ("VERIFY_MOBILE".equals(nextStep) || "FINALIZE".equals(nextStep)) return new PublicAcceptIntent(nextStep);
        throw new InvitationStateException();
    }

    @Transactional(readOnly = true)
    public PublicInvitationView publicView(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        List<String> roleNames = persistence.roleNames(invitation.id());
        List<AssignmentIntent> intents = assignmentIntents(invitation.id());
        if (roleNames.isEmpty() || intents.isEmpty()) throw new InvitationStateException();
        String type = intents.getFirst().serviceNodeType();
        if (intents.stream().anyMatch(intent -> !type.equals(intent.serviceNodeType())))
            throw new InvitationStateException();
        List<OrganizationTaskPathLookup.TaskPathNode> pathNodes =
                targetPathNodes(invitation, intents, paths(invitation, intents));
        return new PublicInvitationView(
                invitation.id(),
                invitation.groupWorkspaceKey(),
                type,
                pathNodes,
                roleNames,
                maskMobile(invitation.mobile()),
                invitation.status(),
                publicResumeStep(invitation),
                invitation.expiresAtEpochMillis());
    }

    @Transactional(noRollbackFor = WorkspaceAuthenticationService.OtpRateLimitedException.class)
    public PublicOtpDelivery sendPublicOtp(String groupWorkspaceKey, String rawInvitationToken, String mobile) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        requireInvitationMobile(invitation, mobile);
        otpLimits.beforeSend(
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                "INVITATION_MOBILE_VERIFY",
                invitation.id());
        long expires = Math.min(invitation.expiresAtEpochMillis(), time.currentEpochMillis() + 5 * 60 * 1000L);
        String otp = issueMobileVerificationOtp(invitation, expires);
        return new PublicOtpDelivery("delivery-pending-" + invitation.id(), expires, debugCodeExposure ? otp : null);
    }

    /** Returns an opaque one-time verification grant only to the public caller after a verified OTP. */
    @Transactional(
            noRollbackFor = {
                InvitationStateException.class,
                WorkspaceAuthenticationService.OtpRateLimitedException.class
            })
    public PublicReadiness verifyPublicOtp(
            String groupWorkspaceKey, String rawInvitationToken, String mobile, String rawOtp) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        requireInvitationMobile(invitation, mobile);
        if (!Set.of("ACCEPT_INTENT_RECORDED", "MOBILE_VERIFIED").contains(invitation.status())
                || invitation.expiresAtEpochMillis() <= time.currentEpochMillis()) throw new InvitationStateException();
        otpLimits.beforeVerify(
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                "INVITATION_MOBILE_VERIFY",
                invitation.id());
        int consumed = persistence.consumeOtp(
                time.currentEpochMillis(), invitation.id(), sha256(rawOtp), time.currentEpochMillis());
        if (consumed != 1) {
            persistence.incrementOtpAttempt(invitation.id());
            otpLimits.invalidVerify(
                    invitation.workspaceUuid(),
                    invitation.groupWorkspaceKey(),
                    "INVITATION_MOBILE_VERIFY",
                    invitation.id());
            throw new InvitationStateException();
        }
        otpLimits.successfulVerify(
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                "INVITATION_MOBILE_VERIFY",
                invitation.id());
        String grant = randomToken();
        long expires = Math.min(invitation.expiresAtEpochMillis(), time.currentEpochMillis() + 15 * 60 * 1000L);
        boolean firstVerification = "ACCEPT_INTENT_RECORDED".equals(invitation.status());
        if (firstVerification && persistence.markMobileVerified(invitation.id(), invitation.version()) != 1)
            throw new InvitationStateException();
        persistence.upsertPublicProgress(invitation.id(), sha256(grant), expires);
        if (firstVerification)
            audit(
                    invitation.workspaceUuid(),
                    invitation.groupWorkspaceKey(),
                    invitation.id(),
                    "WORKSPACE_INVITATION_MOBILE_VERIFIED",
                    AuditActor.system(),
                    invitation.status(),
                    "MOBILE_VERIFIED");
        return new PublicReadiness(grant, accountExists(invitation), false, false, false, "COMPLETE_CREDENTIALS");
    }

    @Transactional
    public PublicReadiness savePublicCredentials(
            String groupWorkspaceKey,
            String rawInvitationToken,
            String grant,
            String userName,
            String loginName,
            char[] password) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        if (!"MOBILE_VERIFIED".equals(invitation.status())
                || !validGrant(invitation.id(), grant)
                || password == null
                || password.length < 8) throw new InvitationStateException();
        String normalized = normalizedLogin(loginName);
        String name = text(userName, 120);
        if (persistence.updateCredentials(
                        normalized,
                        name,
                        passwords.encode(new String(password)),
                        time.currentEpochMillis(),
                        invitation.id())
                != 1) throw new InvitationStateException();
        if (persistence.markCredentialReady(invitation.id(), invitation.version()) != 1)
            throw new InvitationStateException();
        audit(
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                invitation.id(),
                "WORKSPACE_INVITATION_CREDENTIAL_READY",
                AuditActor.system(),
                invitation.status(),
                "CREDENTIAL_READY");
        return new PublicReadiness(grant, accountExists(invitation), true, true, true, "FINALIZE");
    }

    @Transactional
    public PublicCompletion completePublic(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = requireGroupInvitation(groupWorkspaceKey, rawInvitationToken);
        if ("COMPLETED".equals(invitation.status())) return completion(invitation);
        if (!"CREDENTIAL_READY".equals(invitation.status())
                || invitation.expiresAtEpochMillis() <= time.currentEpochMillis()) throw new InvitationStateException();
        Progress progress = progress(invitation.id());
        if (progress.passwordHash() == null || progress.loginName() == null || progress.displayName() == null)
            throw new InvitationStateException();
        UUID accountId = completeReadyInvitation(invitation, progress);
        persistence.completeProgress(accountId, time.currentEpochMillis(), invitation.id());
        audit(
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                invitation.id(),
                "WORKSPACE_INVITATION_COMPLETED",
                AuditActor.system(),
                invitation.status(),
                "COMPLETED");
        return completion(read(rawInvitationToken));
    }

    @Transactional(readOnly = true)
    public PublicCompletion publicCompletion(String groupWorkspaceKey, String rawInvitationToken) {
        return completion(requireGroupInvitation(groupWorkspaceKey, rawInvitationToken));
    }

    /** Delivery adapters may receive this transient secret; HTTP edge controllers must never return it. */
    @Transactional
    public String issueMobileVerificationOtp(UUID invitationId, long expiresAtEpochMillis) {
        Invitation invitation = invitation(persistence.byId(invitationId));
        return issueMobileVerificationOtp(invitation, expiresAtEpochMillis);
    }

    private String issueMobileVerificationOtp(Invitation invitation, long expiresAtEpochMillis) {
        if (!Set.of("ACCEPT_INTENT_RECORDED", "MOBILE_VERIFIED").contains(invitation.status())
                || expiresAtEpochMillis <= time.currentEpochMillis()
                || expiresAtEpochMillis > invitation.expiresAtEpochMillis()) throw new InvitationStateException();
        persistence.supersedeActiveOtp(invitation.id());
        String otp = fixedOtpIssuer == null
                ? String.format("%06d", random.nextInt(1_000_000))
                : fixedOtpIssuer.issue("INVITATION_MOBILE_VERIFY", invitation.id());
        persistence.createOtp(
                UUID.randomUUID(),
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                sha256(otp),
                invitation.id(),
                expiresAtEpochMillis);
        return otp;
    }

    @Transactional
    public String issueMobileVerificationOtp(String rawInvitationToken, long expiresAtEpochMillis) {
        return issueMobileVerificationOtp(read(rawInvitationToken), expiresAtEpochMillis);
    }

    @Transactional
    public String issueMobileVerificationOtp(
            String groupWorkspaceKey, String rawInvitationToken, long expiresAtEpochMillis) {
        return issueMobileVerificationOtp(
                requireGroupInvitation(groupWorkspaceKey, rawInvitationToken), expiresAtEpochMillis);
    }

    private void requireEnterable(Invitation invitation, AssignmentIntent intent) {
        boolean valid =
                switch (intent.serviceNodeType()) {
                    case ServiceNodeTypes.STORE -> stores.isEnterableStore(
                            invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
                    case ServiceNodeTypes.HEAD_COMPANY -> entities.isEnterableEntity(
                            invitation.workspaceUuid(),
                            invitation.groupWorkspaceKey(),
                            ServiceNodeTypes.HEAD_COMPANY,
                            intent.serviceNodeId());
                    case ServiceNodeTypes.GROUP -> groups.isEnterableCommercialGroup(
                            invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
                    case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.isEnterable(
                            invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
                    default -> false;
                };
        if (!valid) throw new InvitationValidationException();
    }

    private AssignmentIntent invitationTarget(UUID invitationId) {
        List<AssignmentIntent> intents = assignmentIntents(invitationId);
        singleTargetType(intents);
        singleTargetId(intents);
        return intents.getFirst();
    }

    private List<AssignmentIntent> assignmentIntents(UUID invitationId) {
        return persistence.assignmentIntents(invitationId).stream()
                .map(row -> new AssignmentIntent(row.roleId(), row.serviceNodeType(), row.serviceNodeId()))
                .toList();
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
    private static void requireExactOperationScope(
            OrganizationTaskPathLookup.TaskPath selectedScope, AssignmentIntent target) {
        if (selectedScope == null
                || !target.serviceNodeType().equals(selectedScope.targetType())
                || !target.serviceNodeId().equals(selectedScope.targetId())) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
    }

    private UUID completeReadyInvitation(Invitation invitation, Progress progress) {
        if (persistence.markCompleting(invitation.id(), invitation.version()) != 1)
            throw new InvitationStateException();
        List<AssignmentIntent> intents = assignmentIntents(invitation.id());
        if (intents.isEmpty()) throw new InvitationValidationException();
        for (AssignmentIntent intent : intents) {
            roles.require(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.roleId());
            requireEnterable(invitation, intent);
        }
        AccountPresence accountPresence = accountPresence(invitation);
        requireBindableAccount(accountPresence);
        UUID accountId = accountPresence.accountId();
        long now = time.currentEpochMillis();
        if (accountId == null) {
            accountId = UUID.randomUUID();
            persistence.createAccount(
                    accountId,
                    invitation.workspaceUuid(),
                    invitation.groupWorkspaceKey(),
                    invitation.mobile(),
                    progress.loginName(),
                    progress.displayName(),
                    now,
                    now);
            persistence.createCredential(accountId, progress.passwordHash(), now);
        }
        for (AssignmentIntent intent : intents)
            persistence.createRoleAssignment(
                    UUID.randomUUID(),
                    invitation.workspaceUuid(),
                    invitation.groupWorkspaceKey(),
                    accountId,
                    intent.roleId(),
                    invitation.id(),
                    intent.serviceNodeType(),
                    intent.serviceNodeId(),
                    time.currentEpochMillis(),
                    time.currentEpochMillis());
        if (persistence.markCompleted(invitation.id(), time.currentEpochMillis()) != 1)
            throw new InvitationStateException();
        return accountId;
    }

    /**
     * Immutable management-view facts for one invitation set. Intent rows and role display names share one owner-local
     * join rather than issuing sibling reads for the same ids.
     */
    private InvitationAssignmentIntentFacts loadInvitationAssignmentIntentFacts(
            List<WorkspaceInvitationReadback> invitations) {
        List<UUID> ids =
                invitations.stream().map(WorkspaceInvitationReadback::id).toList();
        Map<UUID, List<AssignmentIntent>> intents = new LinkedHashMap<>();
        Map<UUID, List<String>> roleNames = new LinkedHashMap<>();
        ids.forEach(id -> {
            intents.put(id, new ArrayList<>());
            roleNames.put(id, new ArrayList<>());
        });
        persistence.assignmentFacts(ids).forEach(row -> {
            intents.get(row.invitationId())
                    .add(new AssignmentIntent(row.roleId(), row.serviceNodeType(), row.serviceNodeId()));
            roleNames.get(row.invitationId()).add(row.roleName());
        });
        return new InvitationAssignmentIntentFacts(copyLists(intents), copyLists(roleNames));
    }

    private static <T> Map<UUID, List<T>> copyLists(Map<UUID, List<T>> values) {
        Map<UUID, List<T>> copy = new LinkedHashMap<>();
        values.forEach((id, value) -> copy.put(id, List.copyOf(value)));
        return Map.copyOf(copy);
    }

    private Map<UUID, String> issuerNamesByInvitation(List<WorkspaceInvitationReadback> invitations) {
        List<UUID> ids =
                invitations.stream().map(WorkspaceInvitationReadback::id).toList();
        Map<UUID, String> result = persistence.issuerNames(ids);
        if (result.size() != ids.size()) throw new InvitationStateException();
        return Map.copyOf(result);
    }

    private Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths(
            Invitation invitation, List<AssignmentIntent> intents) {
        if (taskPaths == null) return Map.of();
        List<OrganizationTaskPathLookup.TaskPathRef> refs = intents.stream()
                .map(intent ->
                        new OrganizationTaskPathLookup.TaskPathRef(intent.serviceNodeType(), intent.serviceNodeId()))
                .distinct()
                .toList();
        return taskPaths.describePersistedTaskPaths(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), refs);
    }

    private List<OrganizationTaskPathLookup.TaskPathNode> targetPathNodes(
            Invitation invitation,
            List<AssignmentIntent> intents,
            Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        List<OrganizationTaskPathLookup.TaskPath> distinct = intents.stream()
                .map(intent -> {
                    if (taskPaths == null) return null;
                    return paths.get(new OrganizationTaskPathLookup.TaskPathRef(
                            intent.serviceNodeType(), intent.serviceNodeId()));
                })
                .distinct()
                .toList();
        if (taskPaths == null) return List.of();
        if (distinct.size() != 1 || distinct.getFirst() == null) throw new InvitationStateException();
        return distinct.getFirst().nodes();
    }

    private static InvitationRouteFacts invitationRouteFacts(WorkspaceInvitationReadback invitation) {
        return invitation.rawInvitationToken() == null
                ? null
                : new InvitationRouteFacts(invitation.groupWorkspaceKey(), invitation.rawInvitationToken());
    }

    private static Invitation owner(WorkspaceInvitationReadback invitation) {
        return new Invitation(
                invitation.id(),
                invitation.workspaceUuid(),
                invitation.groupWorkspaceKey(),
                invitation.mobileNormalized(),
                invitation.status(),
                invitation.expiresAtEpochMillis(),
                invitation.version());
    }

    private String path(Invitation invitation, AssignmentIntent intent) {
        return switch (intent.serviceNodeType()) {
            case ServiceNodeTypes.GROUP -> groups.describeCommercialGroup(
                    invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> nodes.describePath(
                    invitation.workspaceUuid(), invitation.groupWorkspaceKey(), intent.serviceNodeId());
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> entities.describeEntityPath(
                    invitation.workspaceUuid(),
                    invitation.groupWorkspaceKey(),
                    intent.serviceNodeType(),
                    intent.serviceNodeId());
            default -> throw new InvitationValidationException();
        };
    }

    private void audit(
            UUID workspaceUuid,
            String key,
            UUID invitationId,
            String action,
            AuditActor actor,
            String beforeStatus,
            String afterStatus) {
        AuditChangePolicy policy = new AuditChangePolicy("WORKSPACE_INVITATION", action, INVITATION_FIELDS);
        List<AuditChange> changes = List.of(
                AuditChange.forNullableScalar("status", beforeStatus, afterStatus),
                AuditChange.forNullableScalar("lifecycleEvent", null, action));
        persistence.appendAudit(
                UUID.randomUUID(),
                workspaceUuid,
                key,
                invitationId,
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                action,
                time.currentEpochMillis(),
                auditJson(policy.allow(changes)));
    }

    private Invitation invitation(UUID workspaceUuid, String key, UUID invitationId) {
        WorkspaceInvitationPersistence.InvitationRow row =
                persistence.scopedInvitation(workspaceUuid, key, invitationId);
        if (row == null) throw new InvitationNotFoundException();
        return new Invitation(
                row.id(),
                row.workspaceUuid(),
                row.groupWorkspaceKey(),
                row.mobile(),
                row.status(),
                row.expiresAtEpochMillis(),
                row.version());
    }

    private WorkspaceInvitationReadback readback(UUID workspaceUuid, String key, UUID invitationId) {
        WorkspaceInvitationPersistence.InvitationReadRow row = persistence.readback(workspaceUuid, key, invitationId);
        if (row == null) throw new InvitationNotFoundException();
        return new WorkspaceInvitationReadback(
                row.id(),
                workspaceUuid,
                key,
                row.mobile(),
                row.status(),
                row.expiresAtEpochMillis(),
                row.version(),
                row.createdAtEpochMillis(),
                row.consentedAtEpochMillis(),
                row.completedAtEpochMillis(),
                row.cancelledAtEpochMillis(),
                row.invitationToken());
    }

    private static String auditJson(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private String accountExists(Invitation invitation) {
        return accountPresence(invitation).status().name();
    }

    private AccountPresence accountPresence(Invitation invitation) {
        return accountPresence(invitation.workspaceUuid(), invitation.groupWorkspaceKey(), invitation.mobile());
    }

    private AccountPresence accountPresence(UUID workspaceUuid, String groupWorkspaceKey, String mobileNormalized) {
        WorkspaceInvitationPersistence.AccountPresenceRow row =
                persistence.accountPresence(workspaceUuid, groupWorkspaceKey, mobileNormalized);
        return row == null
                ? new AccountPresence(null, AccountPresenceStatus.ABSENT)
                : new AccountPresence(row.accountId(), accountPresenceStatus(row.status()));
    }

    private static AccountPresenceStatus accountPresenceStatus(String status) {
        return switch (status) {
            case "ENABLED" -> AccountPresenceStatus.ENABLED;
            case "DISABLED" -> AccountPresenceStatus.DISABLED;
            case "VOIDED" -> AccountPresenceStatus.VOIDED;
            default -> throw new InvitationStateException();
        };
    }

    private static void requireBindableAccount(AccountPresence presence) {
        if (presence.status() == AccountPresenceStatus.DISABLED || presence.status() == AccountPresenceStatus.VOIDED) {
            throw new AccountNotBindableException();
        }
    }

    private Map<UUID, InvitationRoleFact> requireEnabledInvitationRoles(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) return Map.of();
        java.util.LinkedHashSet<UUID> requested = new java.util.LinkedHashSet<>(roleIds);
        if (requested.contains(null)) throw new WorkspaceRoleService.RoleNotFoundException();
        List<UUID> ids = new ArrayList<>(requested);
        List<InvitationRoleFact> roles = persistence.enabledRoles(workspaceUuid, groupWorkspaceKey, ids).stream()
                .map(row -> new InvitationRoleFact(row.id(), row.name(), row.serviceNodeType(), row.status()))
                .toList();
        if (roles.size() != ids.size()) throw new WorkspaceRoleService.RoleNotFoundException();
        Map<UUID, InvitationRoleFact> rolesById = new LinkedHashMap<>();
        roles.forEach(role -> rolesById.put(role.id(), role));
        for (UUID roleId : roleIds) {
            InvitationRoleFact role = rolesById.get(roleId);
            if (role == null || !"ENABLED".equals(role.status())) throw new InvitationValidationException();
        }
        return Map.copyOf(rolesById);
    }

    private boolean validGrant(UUID invitationId, String rawGrant) {
        return rawGrant != null && persistence.validGrant(invitationId, sha256(rawGrant), time.currentEpochMillis());
    }

    private Progress progress(UUID invitationId) {
        WorkspaceInvitationPersistence.ProgressRow row = persistence.progress(invitationId);
        if (row == null) throw new InvitationStateException();
        return new Progress(row.loginName(), row.displayName(), row.passwordHash(), row.accountId());
    }

    private PublicCompletion completion(Invitation invitation) {
        Progress progress = progress(invitation.id());
        if (!"COMPLETED".equals(invitation.status()) || progress.accountId() == null)
            throw new InvitationStateException();
        return new PublicCompletion(
                invitation.id(),
                "COMP" + "LETED",
                "邀请已完成",
                /* format-wrap */
                "/operations/" + invitation.groupWorkspaceKey() + "/login");
    }

    private Invitation requireGroupInvitation(String groupWorkspaceKey, String rawInvitationToken) {
        Invitation invitation = read(rawInvitationToken);
        if (!groupWorkspaceKey.equals(invitation.groupWorkspaceKey())) throw new InvitationNotFoundException();
        return invitation;
    }

    private static void requireInvitationMobile(Invitation invitation, String requestedMobile) {
        if (!invitation.mobile().equals(normalizedMobile(requestedMobile))) throw new InvitationValidationException();
    }

    private Invitation read(String raw) {
        return invitation(persistence.byToken(sha256(raw)));
    }

    private static Invitation invitation(WorkspaceInvitationPersistence.InvitationRow row) {
        if (row == null) throw new InvitationNotFoundException();
        return new Invitation(
                row.id(),
                row.workspaceUuid(),
                row.groupWorkspaceKey(),
                row.mobile(),
                row.status(),
                row.expiresAtEpochMillis(),
                row.version());
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256(String value) {
        try {
            return Sha256Hex.digest(value);
        } catch (NullPointerException failure) {
            throw new IllegalStateException(failure);
        }
    }

    private static String canonical(String operation, Object... values) {
        StringBuilder result = new StringBuilder(operation);
        for (Object value : values) {
            String text;
            if (value instanceof List<?> list) {
                text = list.stream()
                        .map(String::valueOf)
                        .sorted()
                        .reduce((left, right) -> left + "," + right)
                        .orElse("");
            } else {
                text = String.valueOf(value);
            }
            result.append('|').append(text.length()).append(':').append(text);
        }
        return result.toString();
    }

    private static String normalizedMobile(String value) {
        String normalized = value == null ? "" : value.replace(" ", "").replace("-", "");
        if (!normalized.matches("^\\+?[0-9]{8,20}$")) throw new InvitationValidationException();
        return normalized.startsWith("+") ? normalized.substring(1) : normalized;
    }

    private static String normalizedLogin(String value) {
        if (value == null || !value.matches("^[A-Za-z0-9_.-]{3,120}$")) throw new InvitationValidationException();
        return value.toLowerCase();
    }

    private static String text(String value, int limit) {
        if (value == null || value.isBlank() || value.trim().length() > limit)
            throw new InvitationValidationException();
        return value.trim();
    }

    private static String maskMobile(String value) {
        return value.length() <= 4
                ? "****"
                : value.substring(0, Math.min(3, value.length())) + "****"
                        + value.substring(Math.max(3, value.length() - 4));
    }

    private String publicResumeStep(Invitation invitation) {
        if (invitation.expiresAtEpochMillis() <= time.currentEpochMillis()) return "TERMINAL";
        return switch (invitation.status()) {
            case "PENDING" -> "ACCEPT";
            case "ACCEPT_INTENT_RECORDED", "MOBILE_VERIFIED" -> "VERIFY_MOBILE";
            case "CREDENTIAL_READY" -> "FINALIZE";
            case "COMPLETED", "CANCELLED", "EXPIRED" -> "TERMINAL";
            default -> throw new InvitationStateException();
        };
    }

    public record AssignmentIntent(UUID roleId, String serviceNodeType, UUID serviceNodeId) {
        @Override
        public String toString() {
            return roleId + ":" + serviceNodeType + ":" + serviceNodeId;
        }
    }

    public record PublicAcceptIntent(String nextStep) {}

    public record PublicReadiness(
            String verificationGrant,
            String accountExists,
            boolean userNameReady,
            boolean loginNameReady,
            boolean passwordReady,
            String nextStep) {}

    public record PublicCompletion(UUID invitationId, String status, String message, String loginPath) {}

    public record PublicInvitationView(
            UUID invitationId,
            String groupWorkspaceKey,
            String targetOrganizationType,
            List<OrganizationTaskPathLookup.TaskPathNode> targetOrganizationPathNodes,
            List<String> roleNames,
            String maskedMobile,
            String status,
            String nextStep,
            long expiresAt) {}

    public record PublicOtpDelivery(String verificationId, long expiresAt, String debugVerificationCode) {}

    public record ManagementInvitationView(
            UUID id,
            String groupWorkspaceKey,
            String maskedMobile,
            String mobile,
            String issuerDisplayName,
            String targetOrganizationType,
            List<OrganizationTaskPathLookup.TaskPathNode> targetOrganizationPathNodes,
            List<String> roleNames,
            String status,
            long generation,
            long expiresAt,
            long revision,
            long createdAt,
            Long consentedAt,
            Long completedAt,
            Long cancelledAt,
            InvitationRouteFacts invitationRouteFacts) {}

    public record InvitationRouteFacts(String groupWorkspaceKey, String invitationToken) {}

    public record ManagementInvitationPageRequest(
            String mobile,
            String targetOrganizationType,
            UUID targetOrganizationRef,
            UUID roleId,
            String status,
            Long expiresFrom,
            Long expiresTo,
            String sort,
            String direction,
            int page,
            int pageSize) {}

    public record ManagementInvitationPage(
            List<ManagementInvitationView> items,
            int page,
            int pageSize,
            long total,
            ManagementInvitationPageRequest criteria) {
        public ManagementInvitationPage {
            items = List.copyOf(items);
        }
    }

    private record PageRequest(
            int page, int pageSize, String sort, String direction, ManagementInvitationPageRequest criteria) {
        private static PageRequest from(ManagementInvitationPageRequest request) {
            if (request == null || request.page() < 1 || request.pageSize() < 1 || request.pageSize() > 100)
                throw new InvitationValidationException();
            String sort = request.sort() == null ? "CREATED_AT" : request.sort();
            String direction = request.direction() == null ? "DESC" : request.direction();
            if (!Set.of("CREATED_AT", "EXPIRES_AT").contains(sort)
                    || !Set.of("ASC", "DESC").contains(direction)) throw new InvitationValidationException();
            return new PageRequest(
                    request.page(),
                    request.pageSize(),
                    sort,
                    direction,
                    new ManagementInvitationPageRequest(
                            request.mobile(),
                            request.targetOrganizationType(),
                            request.targetOrganizationRef(),
                            request.roleId(),
                            request.status(),
                            request.expiresFrom(),
                            request.expiresTo(),
                            sort,
                            direction,
                            request.page(),
                            request.pageSize()));
        }
    }

    private record Invitation(
            UUID id,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String mobile,
            String status,
            long expiresAtEpochMillis,
            long version) {}

    private record InvitationAssignmentIntentFacts(
            Map<UUID, List<AssignmentIntent>> intentsByInvitation, Map<UUID, List<String>> roleNamesByInvitation) {}

    /** Fresh command-only display facts; receipts intentionally persist only the public invitation readback. */
    private record CreatedInvitation(WorkspaceInvitationReadback readback, List<String> roleNames) {}

    private record Progress(String loginName, String displayName, String passwordHash, UUID accountId) {}

    private record AccountPresence(UUID accountId, AccountPresenceStatus status) {}

    private record InvitationRoleFact(UUID id, String name, String serviceNodeType, String status) {}

    public static final class InvitationNotFoundException extends RuntimeException {}

    public static final class InvitationStateException extends RuntimeException {
        public InvitationStateException() {}

        public InvitationStateException(Throwable cause) {
            super(cause);
        }
    }

    public static final class InvitationValidationException extends RuntimeException {}

    public static final class AccountNotBindableException extends RuntimeException {}

    public enum AccountPresenceStatus {
        ABSENT,
        ENABLED,
        DISABLED,
        VOIDED
    }
}
