package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.application.persistence.OrganizationHierarchyPersistence;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiPredicate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationHierarchyService implements OrganizationNodeLookup, OperationsOrganizationHierarchyCommandApi {
    /** The commercial group is the logical root. Only its REGION and PROJECT descendants are organization nodes. */
    private static final List<String> NODE_TYPES = List.of(OrganizationNodeTypes.REGION, OrganizationNodeTypes.PROJECT);

    private static final String SORT_DIRECTION_ASC = "ASC";
    private static final String SORT_DIRECTION_DESC = "DESC";

    private final OrganizationHierarchyPersistence persistence;
    private final TimeProvider time;
    private final OrganizationHierarchyCommandReceiptService receipts;
    private final CommercialGroupLookup commercialGroups;
    private final ExtensionDefinitionLookup definitions;

    public OrganizationHierarchyService(JdbcTemplate jdbc, TimeProvider time) {
        this(
                new OrganizationHierarchyPersistence(jdbc),
                time,
                new OrganizationHierarchyCommandReceiptService(jdbc, time),
                null,
                null);
    }

    public OrganizationHierarchyService(JdbcTemplate jdbc, TimeProvider time, ExtensionDefinitionLookup definitions) {
        this(
                new OrganizationHierarchyPersistence(jdbc),
                time,
                new OrganizationHierarchyCommandReceiptService(jdbc, time),
                null,
                definitions);
    }

    public OrganizationHierarchyService(
            JdbcTemplate jdbc, TimeProvider time, CommercialGroupLookup commercialGroups) {
        this(
                new OrganizationHierarchyPersistence(jdbc),
                time,
                new OrganizationHierarchyCommandReceiptService(jdbc, time),
                commercialGroups,
                null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationHierarchyService(
            OrganizationHierarchyPersistence persistence,
            TimeProvider time,
            OrganizationHierarchyCommandReceiptService receipts,
            CommercialGroupLookup commercialGroups,
            ExtensionDefinitionLookup definitions) {
        this.persistence = persistence;
        this.time = time;
        this.receipts = receipts;
        this.commercialGroups = commercialGroups;
        this.definitions = definitions;
    }
    /** Compatibility construction only; post-auth hierarchy commands no longer read workspace status. */
    public OrganizationHierarchyService(
            JdbcTemplate jdbc,
            TimeProvider time,
            OrganizationHierarchyCommandReceiptService receipts,
            BiPredicate<UUID, String> ignoredWorkspaceStatus,
            CommercialGroupLookup commercialGroups,
            ExtensionDefinitionLookup definitions) {
        this(new OrganizationHierarchyPersistence(jdbc), time, receipts, commercialGroups, definitions);
    }

    @Override
    @Transactional
    public OrganizationNodeReadback createRegion(CreateRegionCommand command) {
        UUID commercialGroupRef = requireCommercialGroup(
                command.workspaceUuid(), command.groupWorkspaceKey(), command.ownerScopeGrant());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "createRegion",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.code(),
                        command.name(),
                        command.notes(),
                        extensionCanonical(command.extensionSubmission())),
                () -> create(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        OrganizationNodeTypes.REGION,
                        commercialGroupRef,
                        command.code(),
                        command.name(),
                        command.notes(),
                        List.of(),
                        command.extensionSubmission(),
                        command.actor()));
    }

    @Override
    @Transactional
    public OrganizationNodeReadback createProject(CreateProjectCommand command) {
        requireNode(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.regionId(),
                OrganizationNodeTypes.REGION,
                command.ownerScopeGrant());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "createProject",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.regionId(),
                        command.code(),
                        command.name(),
                        command.notes(),
                        command.phaseNames(),
                        extensionCanonical(command.extensionSubmission())),
                () -> create(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        OrganizationNodeTypes.PROJECT,
                        command.regionId(),
                        command.code(),
                        command.name(),
                        command.notes(),
                        command.phaseNames(),
                        command.extensionSubmission(),
                        command.actor(),
                        true));
    }

    @Override
    @Transactional
    public OrganizationNodeReadback updateNode(UpdateNodeCommand command) {
        OrganizationNodeReadback current = requireNode(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.nodeId(),
                null,
                command.ownerScopeGrant());
        requireCurrentParent(command.workspaceUuid(), command.groupWorkspaceKey(), current);
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical(
                        "update",
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        command.nodeId(),
                        command.code(),
                        command.name(),
                        command.parentId(),
                        command.notes(),
                        command.phaseNames(),
                        command.expectedVersion(),
                        extensionCanonical(command.extensionSubmission())),
                () -> updateWithSubmission(command, current));
    }

    @Override
    @Transactional
    public OrganizationNodeReadback transitionNodeStatus(TransitionNodeStatusCommand command) {
        return transitionStatus(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.nodeId(),
                command.expectedVersion(),
                command.targetStatus(),
                command.idempotencyKey(),
                command.actor(),
                command.ownerScopeGrant());
    }

    @Transactional
    public OrganizationNodeReadback create(
            UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name) {
        return create(workspaceUuid, groupWorkspaceKey, nodeType, parentId, code, name, null, List.of());
    }

    @Transactional
    public OrganizationNodeReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            UUID parentId,
            String code,
            String name,
            String notes,
            List<String> phaseNames) {
        return create(
                workspaceUuid,
                groupWorkspaceKey,
                nodeType,
                parentId,
                code,
                name,
                notes,
                phaseNames,
                AuditActor.system());
    }

    @Transactional
    public OrganizationNodeReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            UUID parentId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            AuditActor actor) {
        return create(
                workspaceUuid, groupWorkspaceKey, nodeType, parentId, code, name, notes, phaseNames, Map.of(), actor);
    }

    @Transactional
    public OrganizationNodeReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            UUID parentId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            Map<String, String> extensionValues,
            AuditActor actor) {
        String type = requiredType(nodeType);
        validateParent(workspaceUuid, groupWorkspaceKey, type, parentId);
        List<String> phases = normalizedPhases(type, phaseNames);
        ExtensionValues extensions = extensionValues(workspaceUuid, groupWorkspaceKey, type, "{}", extensionValues);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        persistence.insertNode(
                id,
                workspaceUuid,
                groupWorkspaceKey,
                parentId,
                type,
                requiredText(code, 64),
                requiredText(name, 120),
                optionalNotes(notes),
                now,
                now,
                extensions.json(),
                extensions.revision());
        // A newly inserted node has no child phase rows; only the required project rows need to be inserted.
        insertPhases(id, phases);
        OrganizationNodeReadback created = requireNode(workspaceUuid, groupWorkspaceKey, id, type);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "ORGANIZATION_NODE_CREATED",
                now,
                actor,
                "[{\"fieldKey\":\"name\",\"after\":\"" + json(created.name()) + "\"}]");
        persistence.notifyTerminalTopic(workspaceUuid, groupWorkspaceKey, type, id);
        return created;
    }

    /** Typed owner-boundary variant; legacy map-shaped entry points remain only for migration callers. */
    private OrganizationNodeReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            UUID parentId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            ExtensionSubmission extensionSubmission,
            AuditActor actor) {
        return create(
                workspaceUuid,
                groupWorkspaceKey,
                nodeType,
                parentId,
                code,
                name,
                notes,
                phaseNames,
                extensionSubmission,
                actor,
                false);
    }

    /** The typed project command has already bound this parent in the owner before receipt replay. */
    private OrganizationNodeReadback create(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String nodeType,
            UUID parentId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            ExtensionSubmission extensionSubmission,
            AuditActor actor,
            boolean parentAlreadyValidated) {
        String type = requiredType(nodeType);
        if (!parentAlreadyValidated) validateParent(workspaceUuid, groupWorkspaceKey, type, parentId);
        List<String> phases = normalizedPhases(type, phaseNames);
        ExtensionValues extensions = extensionValues(workspaceUuid, groupWorkspaceKey, type, "{}", extensionSubmission);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        persistence.insertNode(
                id,
                workspaceUuid,
                groupWorkspaceKey,
                parentId,
                type,
                requiredText(code, 64),
                requiredText(name, 120),
                optionalNotes(notes),
                now,
                now,
                extensions.json(),
                extensions.revision());
        // A newly inserted node has no child phase rows; only the required project rows need to be inserted.
        insertPhases(id, phases);
        OrganizationNodeReadback created = requireNode(workspaceUuid, groupWorkspaceKey, id, type);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                id,
                "ORGANIZATION_NODE_CREATED",
                now,
                actor,
                "[{\"fieldKey\":\"name\",\"after\":\"" + json(created.name()) + "\"}]");
        return created;
    }

    @Transactional
    public OrganizationNodeReadback createRegion(
            UUID workspaceUuid, String groupWorkspaceKey, String code, String name) {
        return createRegion(workspaceUuid, groupWorkspaceKey, code, name, null);
    }

    @Transactional
    public OrganizationNodeReadback createRegion(
            UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String notes) {
        UUID commercialGroupRef = requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
        return create(
                workspaceUuid,
                groupWorkspaceKey,
                OrganizationNodeTypes.REGION,
                commercialGroupRef,
                code,
                name,
                notes,
                List.of());
    }

    @Transactional
    public OrganizationNodeReadback createRegion(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String notes,
            String idempotencyKey) {
        UUID commercialGroupRef = requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes),
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        OrganizationNodeTypes.REGION,
                        commercialGroupRef,
                        code,
                        name,
                        notes,
                        List.of()));
    }

    @Transactional
    public OrganizationNodeReadback createRegion(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String notes,
            String idempotencyKey,
            AuditActor actor) {
        UUID commercialGroupRef = requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes),
                () -> {
                    return create(
                            workspaceUuid,
                            groupWorkspaceKey,
                            OrganizationNodeTypes.REGION,
                            commercialGroupRef,
                            code,
                            name,
                            notes,
                            List.of(),
                            actor);
                });
    }

    @Transactional
    public OrganizationNodeReadback createRegion(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        UUID commercialGroupRef = requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes, extensionValues),
                () -> {
                    return create(
                            workspaceUuid,
                            groupWorkspaceKey,
                            OrganizationNodeTypes.REGION,
                            commercialGroupRef,
                            code,
                            name,
                            notes,
                            List.of(),
                            extensionValues,
                            actor);
                });
    }

    /** Operations command path: bind the server-resolved commercial-group target before receipt replay. */
    @Transactional
    public OrganizationNodeReadback createRegion(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            String notes,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        UUID commercialGroupRef = requireCommercialGroup(workspaceUuid, groupWorkspaceKey, ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes, extensionValues),
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        OrganizationNodeTypes.REGION,
                        commercialGroupRef,
                        code,
                        name,
                        notes,
                        List.of(),
                        extensionValues,
                        actor));
    }

    @Transactional
    public OrganizationNodeReadback createProject(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID regionId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            String idempotencyKey) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("createProject", workspaceUuid, groupWorkspaceKey, regionId, code, name, notes, phaseNames),
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        OrganizationNodeTypes.PROJECT,
                        regionId,
                        code,
                        name,
                        notes,
                        phaseNames));
    }

    @Transactional
    public OrganizationNodeReadback createProject(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID regionId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("createProject", workspaceUuid, groupWorkspaceKey, regionId, code, name, notes, phaseNames),
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        OrganizationNodeTypes.PROJECT,
                        regionId,
                        code,
                        name,
                        notes,
                        phaseNames,
                        actor));
    }

    @Transactional
    public OrganizationNodeReadback createProject(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID regionId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "createProject",
                        workspaceUuid,
                        groupWorkspaceKey,
                        regionId,
                        code,
                        name,
                        notes,
                        phaseNames,
                        extensionValues),
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        OrganizationNodeTypes.PROJECT,
                        regionId,
                        code,
                        name,
                        notes,
                        phaseNames,
                        extensionValues,
                        actor));
    }

    /** Operations command path: bind the parent-region target before receipt replay. */
    @Transactional
    public OrganizationNodeReadback createProject(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID regionId,
            String code,
            String name,
            String notes,
            List<String> phaseNames,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireNode(workspaceUuid, groupWorkspaceKey, regionId, OrganizationNodeTypes.REGION, ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "createProject",
                        workspaceUuid,
                        groupWorkspaceKey,
                        regionId,
                        code,
                        name,
                        notes,
                        phaseNames,
                        extensionValues),
                () -> create(
                        workspaceUuid,
                        groupWorkspaceKey,
                        OrganizationNodeTypes.PROJECT,
                        regionId,
                        code,
                        name,
                        notes,
                        phaseNames,
                        extensionValues,
                        actor));
    }

    @Transactional(readOnly = true)
    public List<OrganizationNodeReadback> list(UUID workspaceUuid, String groupWorkspaceKey) {
        return persistence.listNodes(workspaceUuid, groupWorkspaceKey);
    }

    /**
     * Canonical paged hierarchy read for every consumer face. A consumer may choose its own condition vocabulary at the
     * edge, but the owner keeps the predicate, count and node-path resolution together.
     */
    @Transactional(readOnly = true)
    public HierarchyPage page(UUID workspaceUuid, String groupWorkspaceKey, HierarchyQuery query) {
        HierarchyQuery safe = (query == null ? HierarchyQuery.empty() : query).validated();
        int safePage = Math.max(1, safe.page());
        int safeSize = Math.min(100, Math.max(1, safe.pageSize()));
        String namePattern = like(safe.name());
        String codePattern = like(safe.code());
        long total = persistence.countNodes(
                workspaceUuid,
                groupWorkspaceKey,
                namePattern,
                codePattern,
                safe.status(),
                safe.type(),
                safe.projectId());
        List<OrganizationNodeReadback> nodes = persistence.pageNodes(
                workspaceUuid,
                groupWorkspaceKey,
                namePattern,
                codePattern,
                safe.status(),
                safe.type(),
                safe.projectId(),
                safe.sort(),
                safe.direction(),
                safeSize,
                (safePage - 1) * safeSize);
        Map<UUID, List<String>> phases = persistence.readPhaseNames(nodes.stream()
                .filter(node -> OrganizationNodeTypes.PROJECT.equals(node.nodeType()))
                .map(OrganizationNodeReadback::id)
                .toList());
        Map<UUID, List<HierarchyPathNode>> paths = persistence.readPaths(
                workspaceUuid,
                groupWorkspaceKey,
                nodes.stream().map(OrganizationNodeReadback::id).toList());
        return new HierarchyPage(
                safePage,
                safeSize,
                total,
                safe.sort(),
                safe.direction(),
                nodes.stream()
                        .map(node -> new HierarchyPageItem(
                                withPhases(node, phases.getOrDefault(node.id(), List.of())),
                                paths.getOrDefault(node.id(), List.of())))
                        .toList());
    }

    /** The canonical single-node hierarchy read, including its resolved ancestry. */
    @Transactional(readOnly = true)
    public HierarchyPageItem requireNodeWithPath(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        OrganizationNodeReadback node = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        return new HierarchyPageItem(
                node,
                persistence
                        .readPaths(workspaceUuid, groupWorkspaceKey, List.of(nodeId))
                        .getOrDefault(nodeId, List.of()));
    }

    @Transactional
    public OrganizationNodeReadback replaceProjectPhaseNames(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectId,
            long expectedVersion,
            List<String> phaseNames) {
        OrganizationNodeReadback project =
                requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT);
        if (project.version() != expectedVersion
                || phaseNames == null
                || phaseNames.stream()
                        .anyMatch(value ->
                                value == null || value.isBlank() || value.trim().length() > 120)
                || phaseNames.stream().map(String::trim).distinct().count() != phaseNames.size()) {
            throw new OrganizationConflictException();
        }
        long now = time.currentEpochMillis();
        if (persistence.updateProjectPhaseVersion(projectId, now, expectedVersion) != 1) {
            throw new OrganizationConflictException();
        }
        replacePhases(projectId, phaseNames.stream().map(String::trim).toList());
        OrganizationNodeReadback updated =
                requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                projectId,
                "PROJECT_PHASE_NAMES_REPLACED",
                now,
                AuditActor.system(),
                "[]");
        persistence.notifyTerminalTopic(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.PROJECT, projectId);
        return updated;
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(
            UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, long expectedVersion, String status) {
        return transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, AuditActor.system());
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            long expectedVersion,
            String status,
            AuditActor actor) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        return transitionStatusFromCurrent(
                current, workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, actor);
    }

    private OrganizationNodeReadback transitionStatusFromCurrent(
            OrganizationNodeReadback current,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            long expectedVersion,
            String status,
            AuditActor actor) {
        requireCurrentParent(workspaceUuid, groupWorkspaceKey, current);
        // The owner-bound command already performed the grant-bound read before receipt replay.
        // Keep the post-write readback fresh; only the pre-write fact is transferred.
        long now = time.currentEpochMillis();
        if (!List.of("ENABLED", "DISABLED", "VOIDED").contains(status)
                || "VOIDED".equals(current.status())
                || current.version() != expectedVersion
                || persistence.updateStatus(
                                nodeId,
                                workspaceUuid,
                                groupWorkspaceKey,
                                status,
                                now,
                                expectedVersion)
                        != 1) {
            throw new OrganizationConflictException();
        }
        OrganizationNodeReadback updated = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                nodeId,
                "ORGANIZATION_NODE_STATUS_CHANGED",
                now,
                actor,
                "[{\"fieldKey\":\"status\",\"before\":\"" + json(current.status()) + "\",\"after\":\""
                        + json(updated.status()) + "\"}]");
        persistence.notifyTerminalTopic(workspaceUuid, groupWorkspaceKey, current.nodeType(), nodeId);
        return updated;
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            long expectedVersion,
            String status,
            String idempotencyKey) {
        requireCurrentParent(
                workspaceUuid,
                groupWorkspaceKey,
                requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null));
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("transitionStatus", workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status),
                () -> transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status));
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            long expectedVersion,
            String status,
            String idempotencyKey,
            AuditActor actor) {
        requireCurrentParent(
                workspaceUuid,
                groupWorkspaceKey,
                requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null));
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("transitionStatus", workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status),
                () -> transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, actor));
    }

    /** Operations command path: bind the current node before receipt replay. */
    @Transactional
    public OrganizationNodeReadback transitionStatus(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            long expectedVersion,
            String status,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null, ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical("transitionStatus", workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status),
                () -> transitionStatusFromCurrent(
                        current, workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, actor));
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, long expectedVersion) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        return update(
                workspaceUuid,
                groupWorkspaceKey,
                nodeId,
                code,
                name,
                current.parentId(),
                current.notes(),
                current.phaseNames(),
                expectedVersion);
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion) {
        return update(
                workspaceUuid,
                groupWorkspaceKey,
                nodeId,
                code,
                name,
                parentId,
                notes,
                phaseNames,
                expectedVersion,
                AuditActor.system());
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion,
            AuditActor actor) {
        return update(
                workspaceUuid,
                groupWorkspaceKey,
                nodeId,
                code,
                name,
                parentId,
                notes,
                phaseNames,
                expectedVersion,
                Map.of(),
                actor);
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        requireCurrentParent(workspaceUuid, groupWorkspaceKey, current);
        requireMutable(current.status());
        ExtensionValues extensions =
                extensionValues(workspaceUuid, groupWorkspaceKey, current.nodeType(), current, extensionValues);
        List<String> phases = normalizedPhases(current.nodeType(), phaseNames);
        long now = time.currentEpochMillis();
        if (!Objects.equals(current.parentId(), parentId)
                || current.version() != expectedVersion
                || persistence.updateNode(
                                nodeId,
                                workspaceUuid,
                                groupWorkspaceKey,
                                requiredText(code, 64),
                                requiredText(name, 120),
                                optionalNotes(notes),
                                extensions.json(),
                                extensions.revision(),
                                now,
                                expectedVersion)
                        != 1) throw new OrganizationConflictException();
        if (!current.phaseNames().equals(phases)) replacePhases(nodeId, phases);
        OrganizationNodeReadback updated = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        audit(
                workspaceUuid,
                groupWorkspaceKey,
                nodeId,
                "ORGANIZATION_NODE_UPDATED",
                now,
                actor,
                "[{\"fieldKey\":\"name\",\"before\":\"" + json(current.name()) + "\",\"after\":\""
                        + json(updated.name()) + "\"}]");
        persistence.notifyTerminalTopic(workspaceUuid, groupWorkspaceKey, current.nodeType(), nodeId);
        return updated;
    }

    private OrganizationNodeReadback updateWithSubmission(UpdateNodeCommand command, OrganizationNodeReadback current) {
        requireCurrentParent(command.workspaceUuid(), command.groupWorkspaceKey(), current);
        requireMutable(current.status());
        ExtensionValues extensions = extensionValues(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                current.nodeType(),
                current,
                command.extensionSubmission());
        List<String> phases = normalizedPhases(current.nodeType(), command.phaseNames());
        long now = time.currentEpochMillis();
        if (!Objects.equals(current.parentId(), command.parentId())
                || current.version() != command.expectedVersion()
                || persistence.updateNode(
                                command.nodeId(),
                                command.workspaceUuid(),
                                command.groupWorkspaceKey(),
                                requiredText(command.code(), 64),
                                requiredText(command.name(), 120),
                                optionalNotes(command.notes()),
                                extensions.json(),
                                extensions.revision(),
                                now,
                                command.expectedVersion())
                        != 1) throw new OrganizationConflictException();
        if (!current.phaseNames().equals(phases)) replacePhases(command.nodeId(), phases);
        OrganizationNodeReadback updated =
                requireNode(command.workspaceUuid(), command.groupWorkspaceKey(), command.nodeId(), null);
        audit(
                command.workspaceUuid(),
                command.groupWorkspaceKey(),
                command.nodeId(),
                "ORGANIZATION_NODE_UPDATED",
                now,
                command.actor(),
                "[{\"fieldKey\":\"name\",\"before\":\"" + json(current.name()) + "\",\"after\":\""
                        + json(updated.name()) + "\"}]");
        persistence.notifyTerminalTopic(
                command.workspaceUuid(), command.groupWorkspaceKey(), current.nodeType(), command.nodeId());
        return updated;
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion,
            String idempotencyKey) {
        requireCurrentParent(
                workspaceUuid,
                groupWorkspaceKey,
                requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null));
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "update",
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion),
                () -> update(
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion));
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "update",
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion),
                () -> update(
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion,
                        actor));
    }

    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor) {
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "update",
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion,
                        extensionValues),
                () -> update(
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion,
                        extensionValues,
                        actor));
    }

    /** Operations command path: bind the current node before receipt replay. */
    @Transactional
    public OrganizationNodeReadback update(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String code,
            String name,
            UUID parentId,
            String notes,
            List<String> phaseNames,
            long expectedVersion,
            Map<String, String> extensionValues,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null, ownerScopeGrant);
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical(
                        "update",
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion,
                        extensionValues),
                () -> update(
                        workspaceUuid,
                        groupWorkspaceKey,
                        nodeId,
                        code,
                        name,
                        parentId,
                        notes,
                        phaseNames,
                        expectedVersion,
                        extensionValues,
                        actor));
    }

    @Override
    @Transactional(readOnly = true)
    public OrganizationNodeReadback requireNode(
            UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String requiredType) {
        return persistence.findNode(workspaceUuid, groupWorkspaceKey, nodeId, requiredType);
    }

    private OrganizationNodeReadback requireNode(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID nodeId,
            String requiredType,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        OrganizationNodeReadback node = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, requiredType);
        if (ownerScopeGrant == null
                || !ownerScopeGrant.matches(workspaceUuid, groupWorkspaceKey, node.nodeType(), node.id()))
            throw new OrganizationAuthorizationException();
        return node;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterable(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        return persistence.isEnterable(workspaceUuid, groupWorkspaceKey, nodeId);
    }

    @Override
    @Transactional(readOnly = true)
    public String describePath(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        return persistence.describePath(workspaceUuid, groupWorkspaceKey, nodeId);
    }

    private static OrganizationNodeReadback withPhases(OrganizationNodeReadback node, List<String> phases) {
        return new OrganizationNodeReadback(
                node.id(),
                node.workspaceUuid(),
                node.groupWorkspaceKey(),
                node.parentId(),
                node.nodeType(),
                node.code(),
                node.name(),
                node.notes(),
                node.status(),
                node.version(),
                node.createdAtEpochMillis(),
                node.updatedAtEpochMillis(),
                phases,
                node.extensionValues(),
                node.extensionRuleRevision());
    }

    private static String like(String value) {
        return value == null || value.isBlank()
                ? null
                : "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private void validateParent(UUID workspaceUuid, String key, String type, UUID parentId) {
        if (OrganizationNodeTypes.REGION.equals(type)) {
            if (parentId == null || !parentId.equals(requireCommercialGroup(workspaceUuid, key))) {
                throw new OrganizationValidationException();
            }
            return;
        }
        if (!OrganizationNodeTypes.PROJECT.equals(type) || parentId == null) {
            throw new OrganizationValidationException();
        }
        OrganizationNodeReadback parent = requireNode(workspaceUuid, key, parentId, OrganizationNodeTypes.REGION);
        if (!"ENABLED".equals(parent.status())) throw new OrganizationValidationException();
    }

    private void requireCurrentParent(UUID workspaceUuid, String groupWorkspaceKey, OrganizationNodeReadback node) {
        if (OrganizationNodeTypes.REGION.equals(node.nodeType())
                && (node.parentId() == null
                        || !node.parentId().equals(requireCommercialGroup(workspaceUuid, groupWorkspaceKey)))) {
            throw new OrganizationValidationException();
        }
    }

    private static void requireMutable(String status) {
        if ("VOIDED".equals(status)) throw new OrganizationConflictException();
    }

    private UUID requireCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey) {
        if (commercialGroups == null) throw new OrganizationValidationException();
        return commercialGroups.requireCommercialGroupRef(workspaceUuid, groupWorkspaceKey);
    }

    private UUID requireCommercialGroup(
            UUID workspaceUuid, String groupWorkspaceKey, OperationsOwnerScopeGrant ownerScopeGrant) {
        if (commercialGroups == null) {
            throw new OrganizationAuthorizationException();
        }
        UUID groupId = commercialGroups.requireCommercialGroupRef(workspaceUuid, groupWorkspaceKey);
        if (ownerScopeGrant == null
                || !ownerScopeGrant.matches(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP, groupId))
            throw new OrganizationAuthorizationException();
        return groupId;
    }

    private ExtensionValues extensionValues(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            String currentValuesJson,
            Map<String, String> requestedValues) {
        Map<String, String> requested = requestedValues == null ? Map.of() : requestedValues;
        // Empty submission means no extension fact is being changed; definition lookup is unnecessary.
        if (requested.isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
        if (definitions == null) {
            throw new OrganizationValidationException();
        }
        try {
            ExtensionDefinitionReadback definition =
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, currentValuesJson, requested),
                    definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            throw new OrganizationValidationException(absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
    }

    private ExtensionValues extensionValues(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            String currentValuesJson,
            ExtensionSubmission submission) {
        ExtensionSubmission requested = submission == null ? new ExtensionSubmission(List.of()) : submission;
        // Empty submission means no extension fact is being changed; definition lookup is unnecessary.
        if (requested.fields().isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
        if (definitions == null) {
            throw new OrganizationValidationException();
        }
        try {
            ExtensionDefinitionReadback definition =
                    definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, currentValuesJson, requested),
                    definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            throw new OrganizationValidationException(absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException(invalid);
        }
    }

    private ExtensionValues extensionValues(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            OrganizationNodeReadback current,
            Map<String, String> requestedValues) {
        Map<String, String> requested = requestedValues == null ? Map.of() : requestedValues;
        if (requested.isEmpty())
            return new ExtensionValues(valuesJson(current.extensionValues()), current.extensionRuleRevision());
        return extensionValues(
                workspaceUuid, groupWorkspaceKey, hostType, valuesJson(current.extensionValues()), requested);
    }

    private ExtensionValues extensionValues(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            OrganizationNodeReadback current,
            ExtensionSubmission submission) {
        ExtensionSubmission requested = submission == null ? new ExtensionSubmission(List.of()) : submission;
        if (requested.fields().isEmpty())
            return new ExtensionValues(valuesJson(current.extensionValues()), current.extensionRuleRevision());
        return extensionValues(
                workspaceUuid, groupWorkspaceKey, hostType, valuesJson(current.extensionValues()), requested);
    }

    private static String valuesJson(Map<String, String> values) {
        try {
            com.fasterxml.jackson.databind.node.ObjectNode object =
                    new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
            values.forEach((key, value) -> {
                try {
                    object.set(key, new com.fasterxml.jackson.databind.ObjectMapper().readTree(value));
                } catch (java.io.IOException failure) {
                    throw new OrganizationValidationException(failure);
                }
            });
            return object.toString();
        } catch (OrganizationValidationException failure) {
            throw failure;
        }
    }

    private static String extensionCanonical(ExtensionSubmission submission) {
        return submission.fields().stream()
                .sorted(java.util.Comparator.comparing(ExtensionSubmission.ExtensionFieldValue::fieldKey))
                .map(value -> value.fieldKey() + "=" + value.mode() + "=" + value.valueJson())
                .collect(java.util.stream.Collectors.joining("\\u001f"));
    }

    private void audit(
            UUID workspaceUuid,
            String key,
            UUID nodeId,
            String action,
            long occurredAt,
            AuditActor actor,
            String changesJson) {
        persistence.insertAudit(workspaceUuid, key, nodeId, action, occurredAt, actor, changesJson);
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private static String requiredType(String value) {
        if (!NODE_TYPES.contains(value)) throw new OrganizationValidationException();
        return value;
    }

    private static String requiredText(String value, int limit) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > limit) throw new OrganizationValidationException();
        return normalized;
    }

    private static String optionalNotes(String value) {
        if (value == null || value.isBlank()) return null;
        return requiredText(value, 2000);
    }

    private static List<String> normalizedPhases(String nodeType, List<String> values) {
        List<String> phases = values == null
                ? List.of()
                : values.stream().map(value -> requiredText(value, 120)).toList();
        if (!OrganizationNodeTypes.PROJECT.equals(nodeType) && !phases.isEmpty())
            throw new OrganizationValidationException();
        if (phases.stream().distinct().count() != phases.size()) throw new OrganizationValidationException();
        return phases;
    }

    private void replacePhases(UUID projectId, List<String> phases) {
        persistence.deletePhases(projectId);
        insertPhases(projectId, phases);
    }

    private void insertPhases(UUID projectId, List<String> phases) {
        if (phases.isEmpty()) return;
        persistence.insertPhases(projectId, phases);
    }

    private static String canonical(String operation, Object... values) {
        StringBuilder result = new StringBuilder(operation);
        for (Object value : values) {
            String safe = value == null
                    ? "<null>"
                    : value instanceof List<?> list
                            ? String.join(
                                    "\\u001f",
                                    list.stream().map(String::valueOf).toList())
                            : value instanceof Map<?, ?> map
                                    ? map.entrySet().stream()
                                            .sorted(Map.Entry.comparingByKey(
                                                    java.util.Comparator.comparing(String::valueOf)))
                                            .map(entry -> String.valueOf(entry.getKey()) + "="
                                                    + String.valueOf(entry.getValue()))
                                            .collect(java.util.stream.Collectors.joining("\\u001f"))
                                    : String.valueOf(value);
            result.append('|').append(safe.length()).append(':').append(safe);
        }
        return result.toString();
    }

    public record HierarchyQuery(
            String type,
            String name,
            String code,
            String status,
            UUID projectId,
            String sort,
            String direction,
            int page,
            int pageSize) {
        public static HierarchyQuery empty() {
            return new HierarchyQuery(null, null, null, null, null, "UPDATED_AT", SORT_DIRECTION_DESC, 1, 50);
        }

        private HierarchyQuery validated() {
            String safeSort = sort == null ? "UPDATED_AT" : sort;
            String safeDirection = direction == null ? SORT_DIRECTION_DESC : direction;
            if (!List.of("NAME", "CODE", "UPDATED_AT").contains(safeSort)
                    || !List.of(SORT_DIRECTION_ASC, SORT_DIRECTION_DESC).contains(safeDirection)
                    || (type != null && !NODE_TYPES.contains(type))
                    || (status != null
                            && !List.of("ENABLED", "DISABLED", "VOIDED").contains(status))
                    || (projectId != null && !OrganizationNodeTypes.PROJECT.equals(type)))
                throw new OrganizationValidationException();
            return new HierarchyQuery(type, name, code, status, projectId, safeSort, safeDirection, page, pageSize);
        }
    }

    public record HierarchyPage(
            int page, int pageSize, long total, String sort, String direction, List<HierarchyPageItem> items) {}

    public record HierarchyPageItem(OrganizationNodeReadback node, List<HierarchyPathNode> path) {}

    public record HierarchyPathNode(UUID id, String code, String name) {}

    public static final class OrganizationNotFoundException extends RuntimeException {
        public OrganizationNotFoundException() {}

        public OrganizationNotFoundException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationConflictException extends RuntimeException {
        public OrganizationConflictException() {}

        public OrganizationConflictException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationValidationException extends RuntimeException {
        public OrganizationValidationException() {}

        public OrganizationValidationException(Throwable cause) {
            super(cause);
        }
    }

    public static final class OrganizationAuthorizationException extends RuntimeException {}

    private record ExtensionValues(String json, long revision) {}
}
