package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OperationsOrganizationHierarchyCommandApi;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationHierarchyService implements OrganizationNodeLookup, OperationsOrganizationHierarchyCommandApi {
    /** The commercial group is the logical root. Only its REGION and PROJECT descendants are organization nodes. */
    private static final List<String> NODE_TYPES = List.of(OrganizationNodeTypes.REGION, OrganizationNodeTypes.PROJECT);
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final OrganizationHierarchyCommandReceiptService receipts;
    private final CommercialGroupLookup commercialGroups;
    private final ExtensionDefinitionLookup definitions;

    public OrganizationHierarchyService(JdbcTemplate jdbc, TimeProvider time) {
        this(jdbc, time, new OrganizationHierarchyCommandReceiptService(jdbc, time), null, null);
    }

    public OrganizationHierarchyService(JdbcTemplate jdbc, TimeProvider time, ExtensionDefinitionLookup definitions) {
        this(jdbc, time, new OrganizationHierarchyCommandReceiptService(jdbc, time), null, definitions);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationHierarchyService(JdbcTemplate jdbc, TimeProvider time, OrganizationHierarchyCommandReceiptService receipts, CommercialGroupLookup commercialGroups, ExtensionDefinitionLookup definitions) {
        this.jdbc = jdbc;
        this.time = time;
        this.receipts = receipts;
        this.commercialGroups = commercialGroups;
        this.definitions = definitions;
    }
    /** Compatibility construction only; post-auth hierarchy commands no longer read workspace status. */
    public OrganizationHierarchyService(JdbcTemplate jdbc, TimeProvider time, OrganizationHierarchyCommandReceiptService receipts, WorkspaceStatusLookup ignoredWorkspaceStatus, CommercialGroupLookup commercialGroups, ExtensionDefinitionLookup definitions) {
        this(jdbc, time, receipts, commercialGroups, definitions);
    }

    @Override
    @Transactional
    public OrganizationNodeReadback createRegion(CreateRegionCommand command) {
        requireCommercialGroup(command.workspaceUuid(), command.groupWorkspaceKey(), command.ownerScopeGrant());
        return receipts.execute(command.workspaceUuid(), command.idempotencyKey(), canonical(
            "createRegion", command.workspaceUuid(), command.groupWorkspaceKey(), command.code(), command.name(), command.notes(), extensionCanonical(command.extensionSubmission())
        ), () -> create(
            command.workspaceUuid(), command.groupWorkspaceKey(), OrganizationNodeTypes.REGION, null,
            command.code(), command.name(), command.notes(), List.of(), command.extensionSubmission(), command.actor()
        ));
    }

    @Override
    @Transactional
    public OrganizationNodeReadback createProject(CreateProjectCommand command) {
        requireNode(command.workspaceUuid(), command.groupWorkspaceKey(), command.regionId(), OrganizationNodeTypes.REGION, command.ownerScopeGrant());
        return receipts.execute(command.workspaceUuid(), command.idempotencyKey(), canonical(
            "createProject", command.workspaceUuid(), command.groupWorkspaceKey(), command.regionId(), command.code(), command.name(), command.notes(), command.phaseNames(), extensionCanonical(command.extensionSubmission())
        ), () -> create(
            command.workspaceUuid(), command.groupWorkspaceKey(), OrganizationNodeTypes.PROJECT, command.regionId(),
            command.code(), command.name(), command.notes(), command.phaseNames(), command.extensionSubmission(), command.actor(), true
        ));
    }

    @Override
    @Transactional
    public OrganizationNodeReadback updateNode(UpdateNodeCommand command) {
        OrganizationNodeReadback current = requireNode(command.workspaceUuid(), command.groupWorkspaceKey(), command.nodeId(), null, command.ownerScopeGrant());
        return receipts.execute(command.workspaceUuid(), command.idempotencyKey(), canonical(
            "update", command.workspaceUuid(), command.groupWorkspaceKey(), command.nodeId(), command.code(), command.name(), command.parentId(), command.notes(), command.phaseNames(), command.expectedVersion(), extensionCanonical(command.extensionSubmission())
        ), () -> updateWithSubmission(command, current));
    }

    @Override
    @Transactional
    public OrganizationNodeReadback transitionNodeStatus(TransitionNodeStatusCommand command) {
        return transitionStatus(command.workspaceUuid(), command.groupWorkspaceKey(), command.nodeId(), command.expectedVersion(), command.targetStatus(), command.idempotencyKey(), command.actor(), command.ownerScopeGrant());
    }

    @Transactional
    public OrganizationNodeReadback create(
        UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name
    ) {
        return create(workspaceUuid, groupWorkspaceKey, nodeType, parentId, code, name, null, List.of());
    }

    @Transactional
    public OrganizationNodeReadback create(
        UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name, String notes, List<String> phaseNames
    ) {
        return create(workspaceUuid, groupWorkspaceKey, nodeType, parentId, code, name, notes, phaseNames, AuditActor.system());
    }

    @Transactional
    public OrganizationNodeReadback create(
        UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name, String notes, List<String> phaseNames, AuditActor actor
    ) {
        return create(workspaceUuid, groupWorkspaceKey, nodeType, parentId, code, name, notes, phaseNames, Map.of(), actor);
    }

    @Transactional
    public OrganizationNodeReadback create(
        UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name, String notes, List<String> phaseNames, Map<String, String> extensionValues, AuditActor actor
    ) {
        String type = requiredType(nodeType);
        validateParent(workspaceUuid, groupWorkspaceKey, type, parentId);
        List<String> phases = normalizedPhases(type, phaseNames);
        ExtensionValues extensions = extensionValues(workspaceUuid, groupWorkspaceKey, type, "{}", extensionValues);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        jdbc.update(
            "INSERT INTO organization.organization_node (id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, phase_names, status, version, created_at_epoch_millis, updated_at_epoch_millis, extension_values, extension_rule_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST('[]' AS JSONB), 'ENABLED', 1, ?, ?, CAST(? AS JSONB), ?)",
            id, workspaceUuid, groupWorkspaceKey, parentId, type, requiredText(code, 64), requiredText(name, 120), optionalNotes(notes), now, now, extensions.json(), extensions.revision()
        );
        replacePhases(id, phases);
        OrganizationNodeReadback created = requireNode(workspaceUuid, groupWorkspaceKey, id, type);
        audit(workspaceUuid, groupWorkspaceKey, id, "ORGANIZATION_NODE_CREATED", now, actor, "[{\"fieldKey\":\"name\",\"after\":\"" + json(created.name()) + "\"}]");
        return created;
    }

    /** Typed owner-boundary variant; legacy map-shaped entry points remain only for migration callers. */
    private OrganizationNodeReadback create(
        UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name,
        String notes, List<String> phaseNames, ExtensionSubmission extensionSubmission, AuditActor actor
    ) {
        return create(workspaceUuid, groupWorkspaceKey, nodeType, parentId, code, name, notes, phaseNames, extensionSubmission, actor, false);
    }

    /** The typed project command has already bound this parent in the owner before receipt replay. */
    private OrganizationNodeReadback create(
        UUID workspaceUuid, String groupWorkspaceKey, String nodeType, UUID parentId, String code, String name,
        String notes, List<String> phaseNames, ExtensionSubmission extensionSubmission, AuditActor actor, boolean parentAlreadyValidated
    ) {
        String type = requiredType(nodeType);
        if (!parentAlreadyValidated) validateParent(workspaceUuid, groupWorkspaceKey, type, parentId);
        List<String> phases = normalizedPhases(type, phaseNames);
        ExtensionValues extensions = extensionValues(workspaceUuid, groupWorkspaceKey, type, "{}", extensionSubmission);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        jdbc.update(
            "INSERT INTO organization.organization_node (id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, phase_names, status, version, created_at_epoch_millis, updated_at_epoch_millis, extension_values, extension_rule_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST('[]' AS JSONB), 'ENABLED', 1, ?, ?, CAST(? AS JSONB), ?)",
            id, workspaceUuid, groupWorkspaceKey, parentId, type, requiredText(code, 64), requiredText(name, 120), optionalNotes(notes), now, now, extensions.json(), extensions.revision()
        );
        replacePhases(id, phases);
        OrganizationNodeReadback created = requireNode(workspaceUuid, groupWorkspaceKey, id, type);
        audit(workspaceUuid, groupWorkspaceKey, id, "ORGANIZATION_NODE_CREATED", now, actor, "[{\"fieldKey\":\"name\",\"after\":\"" + json(created.name()) + "\"}]");
        return created;
    }

    @Transactional
    public OrganizationNodeReadback createRegion(UUID workspaceUuid, String groupWorkspaceKey, String code, String name) {
        return createRegion(workspaceUuid, groupWorkspaceKey, code, name, null);
    }

    @Transactional
    public OrganizationNodeReadback createRegion(UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String notes) {
        requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
        return create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.REGION, null, code, name, notes, List.of());
    }

    @Transactional
    public OrganizationNodeReadback createRegion(UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String notes, String idempotencyKey) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes), () -> createRegion(workspaceUuid, groupWorkspaceKey, code, name, notes));
    }

    @Transactional
    public OrganizationNodeReadback createRegion(UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String notes, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes), () -> {
            requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
            return create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.REGION, null, code, name, notes, List.of(), actor);
        });
    }

    @Transactional
    public OrganizationNodeReadback createRegion(UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String notes, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes, extensionValues), () -> {
            requireCommercialGroup(workspaceUuid, groupWorkspaceKey);
            return create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.REGION, null, code, name, notes, List.of(), extensionValues, actor);
        });
    }

    /** Operations command path: bind the server-resolved commercial-group target before receipt replay. */
    @Transactional
    public OrganizationNodeReadback createRegion(UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String notes, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) {
        requireCommercialGroup(workspaceUuid, groupWorkspaceKey, ownerScopeGrant);
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createRegion", workspaceUuid, groupWorkspaceKey, code, name, notes, extensionValues), () ->
            create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.REGION, null, code, name, notes, List.of(), extensionValues, actor)
        );
    }

    @Transactional
    public OrganizationNodeReadback createProject(UUID workspaceUuid, String groupWorkspaceKey, UUID regionId, String code, String name, String notes, List<String> phaseNames, String idempotencyKey) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createProject", workspaceUuid, groupWorkspaceKey, regionId, code, name, notes, phaseNames), () -> create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.PROJECT, regionId, code, name, notes, phaseNames));
    }

    @Transactional
    public OrganizationNodeReadback createProject(UUID workspaceUuid, String groupWorkspaceKey, UUID regionId, String code, String name, String notes, List<String> phaseNames, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createProject", workspaceUuid, groupWorkspaceKey, regionId, code, name, notes, phaseNames), () -> create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.PROJECT, regionId, code, name, notes, phaseNames, actor));
    }

    @Transactional
    public OrganizationNodeReadback createProject(UUID workspaceUuid, String groupWorkspaceKey, UUID regionId, String code, String name, String notes, List<String> phaseNames, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createProject", workspaceUuid, groupWorkspaceKey, regionId, code, name, notes, phaseNames, extensionValues), () -> create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.PROJECT, regionId, code, name, notes, phaseNames, extensionValues, actor));
    }

    /** Operations command path: bind the parent-region target before receipt replay. */
    @Transactional
    public OrganizationNodeReadback createProject(UUID workspaceUuid, String groupWorkspaceKey, UUID regionId, String code, String name, String notes, List<String> phaseNames, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) {
        requireNode(workspaceUuid, groupWorkspaceKey, regionId, OrganizationNodeTypes.REGION, ownerScopeGrant);
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createProject", workspaceUuid, groupWorkspaceKey, regionId, code, name, notes, phaseNames, extensionValues), () -> create(workspaceUuid, groupWorkspaceKey, OrganizationNodeTypes.PROJECT, regionId, code, name, notes, phaseNames, extensionValues, actor));
    }

    @Transactional(readOnly = true)
    public List<OrganizationNodeReadback> list(UUID workspaceUuid, String groupWorkspaceKey) {
        List<NodeListRow> nodes = jdbc.query("SELECT id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, status, version, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, extension_rule_revision FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND node_type IN ('REGION','PROJECT') ORDER BY node_type, code", (result, row) -> new NodeListRow(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getObject(4, UUID.class), result.getString(5), result.getString(6), result.getString(7), result.getString(8), result.getString(9), result.getLong(10), result.getLong(11), result.getLong(12), result.getString(13), result.getLong(14)), workspaceUuid, groupWorkspaceKey);
        List<UUID> projectIds = nodes.stream().filter(node -> OrganizationNodeTypes.PROJECT.equals(node.nodeType())).map(NodeListRow::id).toList();
        Map<UUID, List<String>> phases = new java.util.LinkedHashMap<>();
        if (!projectIds.isEmpty()) jdbc.query("SELECT project_id, phase_name FROM organization.project_phase_name WHERE project_id IN (" + String.join(",", java.util.Collections.nCopies(projectIds.size(), "?")) + ") ORDER BY project_id, display_order", statement -> { for (int index = 0; index < projectIds.size(); index++) statement.setObject(index + 1, projectIds.get(index)); }, result -> { while (result.next()) phases.computeIfAbsent(result.getObject(1, UUID.class), ignored -> new ArrayList<>()).add(result.getString(2)); });
        return nodes.stream().map(node -> new OrganizationNodeReadback(node.id(), node.workspaceUuid(), node.groupWorkspaceKey(), node.parentId(), node.nodeType(), node.code(), node.name(), node.notes(), node.status(), node.version(), node.createdAtEpochMillis(), node.updatedAtEpochMillis(), phases.getOrDefault(node.id(), List.of()), ExtensionDefinitionService.readValues(node.extensionValuesJson()), node.extensionRuleRevision())).toList();
    }


    /**
     * Canonical paged hierarchy read for every consumer face.  A consumer may
     * choose its own condition vocabulary at the edge, but the owner keeps the
     * predicate, count and node-path resolution together.
     */
    @Transactional(readOnly = true)
    public HierarchyPage page(UUID workspaceUuid, String groupWorkspaceKey, HierarchyQuery query) {
        HierarchyQuery safe = (query == null ? HierarchyQuery.empty() : query).validated();
        int safePage = Math.max(1, safe.page());
        int safeSize = Math.min(100, Math.max(1, safe.pageSize()));
        String where = " WHERE workspace_uuid=? AND group_workspace_key=?"
            + " AND (?::text IS NULL OR name ILIKE ? ESCAPE '!')"
            + " AND (?::text IS NULL OR code ILIKE ? ESCAPE '!')"
            + " AND (?::text IS NULL OR status=?)"
            + " AND (?::text IS NULL OR node_type=?)"
            + " AND (?::uuid IS NULL OR id=?)";
        String namePattern = like(safe.name());
        String codePattern = like(safe.code());
        List<Object> values = new ArrayList<>();
        java.util.Collections.addAll(values, workspaceUuid, groupWorkspaceKey, namePattern, namePattern, codePattern, codePattern, safe.status(), safe.status(), safe.type(), safe.type(), safe.projectId(), safe.projectId());
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM organization.organization_node" + where, Long.class, values.toArray());
        String order = switch (safe.sort()) { case "NAME" -> "name"; case "CODE" -> "code"; default -> "updated_at_epoch_millis"; };
        List<Object> paged = new ArrayList<>(values); paged.add(safeSize); paged.add((safePage - 1) * safeSize);
        List<OrganizationNodeReadback> nodes = jdbc.query(
            "SELECT id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, status, version, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, extension_rule_revision FROM organization.organization_node"
                + where + " ORDER BY " + order + " " + safe.direction() + ", id DESC LIMIT ? OFFSET ?",
            (result, row) -> node(result, List.of()), paged.toArray()
        );
        Map<UUID, List<String>> phases = phases(nodes.stream().filter(node -> OrganizationNodeTypes.PROJECT.equals(node.nodeType())).map(OrganizationNodeReadback::id).toList());
        Map<UUID, List<HierarchyPathNode>> paths = paths(workspaceUuid, groupWorkspaceKey, nodes.stream().map(OrganizationNodeReadback::id).toList());
        return new HierarchyPage(safePage, safeSize, total, safe.sort(), safe.direction(), nodes.stream()
            .map(node -> new HierarchyPageItem(withPhases(node, phases.getOrDefault(node.id(), List.of())), paths.getOrDefault(node.id(), List.of())))
            .toList());
    }

    /** The canonical single-node hierarchy read, including its resolved ancestry. */
    @Transactional(readOnly = true)
    public HierarchyPageItem requireNodeWithPath(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        OrganizationNodeReadback node = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        return new HierarchyPageItem(node, paths(workspaceUuid, groupWorkspaceKey, List.of(nodeId)).getOrDefault(nodeId, List.of()));
    }

    @Transactional
    public OrganizationNodeReadback replaceProjectPhaseNames(
        UUID workspaceUuid, String groupWorkspaceKey, UUID projectId, long expectedVersion, List<String> phaseNames
    ) {
        OrganizationNodeReadback project = requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT);
        if (project.version() != expectedVersion || phaseNames == null || phaseNames.stream().anyMatch(value -> value == null || value.isBlank() || value.trim().length() > 120) || phaseNames.stream().map(String::trim).distinct().count() != phaseNames.size()) {
            throw new OrganizationConflictException();
        }
        long now = time.currentEpochMillis();
        if (jdbc.update("UPDATE organization.organization_node SET version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?", now, projectId, expectedVersion) != 1) {
            throw new OrganizationConflictException();
        }
        jdbc.update("DELETE FROM organization.project_phase_name WHERE project_id=?", projectId);
        for (int index = 0; index < phaseNames.size(); index++) {
            jdbc.update("INSERT INTO organization.project_phase_name (project_id, phase_name, display_order) VALUES (?, ?, ?)", projectId, phaseNames.get(index).trim(), index);
        }
        OrganizationNodeReadback updated = requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT);
        audit(workspaceUuid, groupWorkspaceKey, projectId, "PROJECT_PHASE_NAMES_REPLACED", now, AuditActor.system(), "[]");
        return updated;
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, long expectedVersion, String status) {
        return transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, AuditActor.system());
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, long expectedVersion, String status, AuditActor actor) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        if (!List.of("ENABLED", "DISABLED").contains(status) || current.version() != expectedVersion || jdbc.update("UPDATE organization.organization_node SET status=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND version=?", status, time.currentEpochMillis(), nodeId, expectedVersion) != 1) {
            throw new OrganizationConflictException();
        }
        OrganizationNodeReadback updated = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        audit(workspaceUuid, groupWorkspaceKey, nodeId, "ORGANIZATION_NODE_STATUS_CHANGED", time.currentEpochMillis(), actor, "[{\"fieldKey\":\"status\",\"before\":\"" + json(current.status()) + "\",\"after\":\"" + json(updated.status()) + "\"}]");
        return updated;
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, long expectedVersion, String status, String idempotencyKey) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("transitionStatus", workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status), () -> transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status));
    }

    @Transactional
    public OrganizationNodeReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, long expectedVersion, String status, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("transitionStatus", workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status), () -> transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, actor));
    }

    /** Operations command path: bind the current node before receipt replay. */
    @Transactional
    public OrganizationNodeReadback transitionStatus(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, long expectedVersion, String status, String idempotencyKey, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) {
        requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null, ownerScopeGrant);
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("transitionStatus", workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status), () -> transitionStatus(workspaceUuid, groupWorkspaceKey, nodeId, expectedVersion, status, actor));
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, long expectedVersion) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        return update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, current.parentId(), current.notes(), current.phaseNames(), expectedVersion);
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion) {
        return update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, AuditActor.system());
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion, AuditActor actor) {
        return update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, Map.of(), actor);
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion, Map<String, String> extensionValues, AuditActor actor) {
        OrganizationNodeReadback current = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        ExtensionValues extensions = extensionValues(workspaceUuid, groupWorkspaceKey, current.nodeType(), valuesJson(current.extensionValues()), extensionValues);
        if (!Objects.equals(current.parentId(), parentId) || current.version() != expectedVersion || jdbc.update("UPDATE organization.organization_node SET code=?, name=?, notes=?, extension_values=CAST(? AS JSONB), extension_rule_revision=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?", requiredText(code, 64), requiredText(name, 120), optionalNotes(notes), extensions.json(), extensions.revision(), time.currentEpochMillis(), nodeId, workspaceUuid, groupWorkspaceKey, expectedVersion) != 1) throw new OrganizationConflictException();
        replacePhases(nodeId, normalizedPhases(current.nodeType(), phaseNames));
        OrganizationNodeReadback updated = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null);
        audit(workspaceUuid, groupWorkspaceKey, nodeId, "ORGANIZATION_NODE_UPDATED", time.currentEpochMillis(), actor, "[{\"fieldKey\":\"name\",\"before\":\"" + json(current.name()) + "\",\"after\":\"" + json(updated.name()) + "\"}]");
        return updated;
    }

    private OrganizationNodeReadback updateWithSubmission(UpdateNodeCommand command, OrganizationNodeReadback current) {
        ExtensionValues extensions = extensionValues(
            command.workspaceUuid(), command.groupWorkspaceKey(), current.nodeType(), valuesJson(current.extensionValues()), command.extensionSubmission()
        );
        if (!Objects.equals(current.parentId(), command.parentId()) || current.version() != command.expectedVersion() || jdbc.update(
            "UPDATE organization.organization_node SET code=?, name=?, notes=?, extension_values=CAST(? AS JSONB), extension_rule_revision=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?",
            requiredText(command.code(), 64), requiredText(command.name(), 120), optionalNotes(command.notes()), extensions.json(), extensions.revision(), time.currentEpochMillis(), command.nodeId(), command.workspaceUuid(), command.groupWorkspaceKey(), command.expectedVersion()
        ) != 1) throw new OrganizationConflictException();
        replacePhases(command.nodeId(), normalizedPhases(current.nodeType(), command.phaseNames()));
        OrganizationNodeReadback updated = requireNode(command.workspaceUuid(), command.groupWorkspaceKey(), command.nodeId(), null);
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), command.nodeId(), "ORGANIZATION_NODE_UPDATED", time.currentEpochMillis(), command.actor(), "[{\"fieldKey\":\"name\",\"before\":\"" + json(current.name()) + "\",\"after\":\"" + json(updated.name()) + "\"}]");
        return updated;
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion, String idempotencyKey) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("update", workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion), () -> update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion));
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("update", workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion), () -> update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, actor));
    }

    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("update", workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, extensionValues), () -> update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, extensionValues, actor));
    }

    /** Operations command path: bind the current node before receipt replay. */
    @Transactional
    public OrganizationNodeReadback update(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String code, String name, UUID parentId, String notes, List<String> phaseNames, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor, OperationsOwnerScopeGrant ownerScopeGrant) {
        requireNode(workspaceUuid, groupWorkspaceKey, nodeId, null, ownerScopeGrant);
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("update", workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, extensionValues), () -> update(workspaceUuid, groupWorkspaceKey, nodeId, code, name, parentId, notes, phaseNames, expectedVersion, extensionValues, actor));
    }

    @Override
    @Transactional(readOnly = true)
    public OrganizationNodeReadback requireNode(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String requiredType) {
        OrganizationNodeReadback node = jdbc.query(
            "SELECT id, workspace_uuid, group_workspace_key, parent_id, node_type, code, name, notes, status, version, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, extension_rule_revision FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
            statement -> { statement.setObject(1, nodeId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); },
            result -> {
                if (!result.next()) throw new OrganizationNotFoundException();
                String actualType = result.getString("node_type");
                if (requiredType != null && !requiredType.equals(actualType)) throw new OrganizationValidationException();
                return new OrganizationNodeReadback(result.getObject("id", UUID.class), result.getObject("workspace_uuid", UUID.class), result.getString("group_workspace_key"), result.getObject("parent_id", UUID.class), actualType, result.getString("code"), result.getString("name"), result.getString("notes"), result.getString("status"), result.getLong("version"), result.getLong("created_at_epoch_millis"), result.getLong("updated_at_epoch_millis"), List.of(), ExtensionDefinitionService.readValues(result.getString("extension_values")), result.getLong("extension_rule_revision"));
            }
        );
        List<String> phases = jdbc.query("SELECT phase_name FROM organization.project_phase_name WHERE project_id=? ORDER BY display_order", (rs, row) -> rs.getString(1), node.id());
        return new OrganizationNodeReadback(node.id(), node.workspaceUuid(), node.groupWorkspaceKey(), node.parentId(), node.nodeType(), node.code(), node.name(), node.notes(), node.status(), node.version(), node.createdAtEpochMillis(), node.updatedAtEpochMillis(), phases, node.extensionValues(), node.extensionRuleRevision());
    }

    private OrganizationNodeReadback requireNode(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId, String requiredType, OperationsOwnerScopeGrant ownerScopeGrant) {
        OrganizationNodeReadback node = requireNode(workspaceUuid, groupWorkspaceKey, nodeId, requiredType);
        if (ownerScopeGrant == null || !ownerScopeGrant.matches(workspaceUuid, groupWorkspaceKey, node.nodeType(), node.id())) throw new OrganizationAuthorizationException();
        return node;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterable(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        return jdbc.query("SELECT status FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, nodeId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); }, result -> result.next() && "ENABLED".equals(result.getString(1)));
    }

    @Override
    @Transactional(readOnly = true)
    public String describePath(UUID workspaceUuid, String groupWorkspaceKey, UUID nodeId) {
        return jdbc.query(
            "WITH RECURSIVE ancestry AS (" +
                "SELECT id, parent_id, code, name, 0 AS depth FROM organization.organization_node WHERE id=? AND workspace_uuid=? AND group_workspace_key=? " +
                "UNION ALL " +
                "SELECT parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1 " +
                "FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id " +
                "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?" +
            ") SELECT string_agg(code || ' ' || name, ' / ' ORDER BY depth DESC) FROM ancestry",
            statement -> { statement.setObject(1, nodeId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); statement.setObject(4, workspaceUuid); statement.setString(5, groupWorkspaceKey); },
            result -> {
                if (!result.next() || result.getString(1) == null) throw new OrganizationNotFoundException();
                return result.getString(1);
            }
        );
    }

    private record NodeListRow(UUID id, UUID workspaceUuid, String groupWorkspaceKey, UUID parentId, String nodeType, String code, String name, String notes, String status, long version, long createdAtEpochMillis, long updatedAtEpochMillis, String extensionValuesJson, long extensionRuleRevision) { }

    private static OrganizationNodeReadback node(java.sql.ResultSet result, List<String> phases) throws java.sql.SQLException {
        return new OrganizationNodeReadback(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getObject(4, UUID.class), result.getString(5), result.getString(6), result.getString(7), result.getString(8), result.getString(9), result.getLong(10), result.getLong(11), result.getLong(12), phases, ExtensionDefinitionService.readValues(result.getString(13)), result.getLong(14));
    }

    private static OrganizationNodeReadback withPhases(OrganizationNodeReadback node, List<String> phases) {
        return new OrganizationNodeReadback(node.id(), node.workspaceUuid(), node.groupWorkspaceKey(), node.parentId(), node.nodeType(), node.code(), node.name(), node.notes(), node.status(), node.version(), node.createdAtEpochMillis(), node.updatedAtEpochMillis(), phases, node.extensionValues(), node.extensionRuleRevision());
    }

    private Map<UUID, List<String>> phases(List<UUID> projectIds) {
        if (projectIds.isEmpty()) return Map.of();
        return jdbc.query("SELECT project_id, phase_name FROM organization.project_phase_name WHERE project_id IN (" + String.join(",", java.util.Collections.nCopies(projectIds.size(), "?")) + ") ORDER BY project_id, display_order", statement -> {
            for (int index = 0; index < projectIds.size(); index++) statement.setObject(index + 1, projectIds.get(index));
        }, result -> {
            Map<UUID, List<String>> values = new java.util.LinkedHashMap<>();
            while (result.next()) values.computeIfAbsent(result.getObject(1, UUID.class), ignored -> new ArrayList<>()).add(result.getString(2));
            return Map.copyOf(values);
        });
    }

    private Map<UUID, List<HierarchyPathNode>> paths(UUID workspaceUuid, String key, List<UUID> nodeIds) {
        if (nodeIds.isEmpty()) return Map.of();
        String sql = "WITH RECURSIVE ancestry AS ("
            + "SELECT node.id AS target_id, node.id, node.parent_id, node.code, node.name, 0 AS depth FROM organization.organization_node node WHERE node.workspace_uuid=? AND node.group_workspace_key=? AND node.id IN (" + String.join(",", java.util.Collections.nCopies(nodeIds.size(), "?")) + ") "
            + "UNION ALL SELECT ancestry.target_id, parent.id, parent.parent_id, parent.code, parent.name, ancestry.depth + 1 FROM organization.organization_node parent JOIN ancestry ON ancestry.parent_id=parent.id WHERE parent.workspace_uuid=? AND parent.group_workspace_key=?"
            + ") SELECT target_id, array_agg(id ORDER BY depth DESC) AS path_ids, array_agg(code ORDER BY depth DESC) AS path_codes, array_agg(name ORDER BY depth DESC) AS path_names FROM ancestry GROUP BY target_id";
        return jdbc.query(sql, statement -> {
            int index = 1;
            statement.setObject(index++, workspaceUuid); statement.setString(index++, key);
            for (UUID nodeId : nodeIds) statement.setObject(index++, nodeId);
            statement.setObject(index++, workspaceUuid); statement.setString(index, key);
        }, result -> {
            Map<UUID, List<HierarchyPathNode>> values = new java.util.LinkedHashMap<>();
            while (result.next()) {
                Object[] ids = (Object[]) result.getArray("path_ids").getArray();
                Object[] codes = (Object[]) result.getArray("path_codes").getArray();
                Object[] names = (Object[]) result.getArray("path_names").getArray();
                List<HierarchyPathNode> path = new ArrayList<>();
                for (int index = 0; index < ids.length; index++) path.add(new HierarchyPathNode((UUID) ids[index], (String) codes[index], (String) names[index]));
                values.put(result.getObject("target_id", UUID.class), List.copyOf(path));
            }
            return Map.copyOf(values);
        });
    }

    private static String like(String value) { return value == null || value.isBlank() ? null : "%" + value.trim().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"; }

    private void validateParent(UUID workspaceUuid, String key, String type, UUID parentId) {
        String parentType = switch (type) { case OrganizationNodeTypes.REGION -> null; case OrganizationNodeTypes.PROJECT -> OrganizationNodeTypes.REGION; default -> throw new OrganizationValidationException(); };
        if ((parentType == null) != (parentId == null)) throw new OrganizationValidationException();
        if (parentType != null) {
            OrganizationNodeReadback parent = requireNode(workspaceUuid, key, parentId, parentType);
            if (!"ENABLED".equals(parent.status())) throw new OrganizationValidationException();
        }
    }

    private void requireCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey) {
        if (commercialGroups == null) return;
        commercialGroups.requireCommercialGroupRef(workspaceUuid, groupWorkspaceKey);
    }
    private void requireCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, OperationsOwnerScopeGrant ownerScopeGrant) {
        if (commercialGroups == null) {
            throw new OrganizationAuthorizationException();
        }
        UUID groupId = commercialGroups.requireCommercialGroupRef(workspaceUuid, groupWorkspaceKey);
        if (ownerScopeGrant == null || !ownerScopeGrant.matches(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP, groupId)) throw new OrganizationAuthorizationException();
    }
    private ExtensionValues extensionValues(UUID workspaceUuid, String groupWorkspaceKey, String hostType, String currentValuesJson, Map<String, String> requestedValues) {
        Map<String, String> requested = requestedValues == null ? Map.of() : requestedValues;
        if (definitions == null) {
            if (requested.isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationValidationException();
        }
        try {
            ExtensionDefinitionReadback definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
            return new ExtensionValues(ExtensionDefinitionService.mergeValues(definition, currentValuesJson, requested), definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (requested.isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationValidationException();
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException();
        }
    }

    private ExtensionValues extensionValues(UUID workspaceUuid, String groupWorkspaceKey, String hostType, String currentValuesJson, ExtensionSubmission submission) {
        ExtensionSubmission requested = submission == null ? new ExtensionSubmission(List.of()) : submission;
        if (definitions == null) {
            if (requested.fields().isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationValidationException();
        }
        try {
            ExtensionDefinitionReadback definition = definitions.requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
            return new ExtensionValues(ExtensionDefinitionService.mergeValues(definition, currentValuesJson, requested), definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (requested.fields().isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationValidationException();
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationValidationException();
        }
    }
    private static String valuesJson(Map<String, String> values) {
        try {
            com.fasterxml.jackson.databind.node.ObjectNode object = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
            values.forEach((key, value) -> {
                try { object.set(key, new com.fasterxml.jackson.databind.ObjectMapper().readTree(value)); }
                catch (java.io.IOException failure) { throw new OrganizationValidationException(); }
            });
            return object.toString();
        } catch (OrganizationValidationException failure) { throw failure; }
    }
    private static String extensionCanonical(ExtensionSubmission submission) {
        return submission.fields().stream()
            .sorted(java.util.Comparator.comparing(ExtensionSubmission.ExtensionFieldValue::fieldKey))
            .map(value -> value.fieldKey() + "=" + value.mode() + "=" + value.valueJson())
            .collect(java.util.stream.Collectors.joining("\\u001f"));
    }
    private void audit(UUID workspaceUuid, String key, UUID nodeId, String action, long occurredAt, AuditActor actor, String changesJson) {
        jdbc.update("INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'ORGANIZATION_NODE', ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))", UUID.randomUUID(), workspaceUuid, key, nodeId.toString(), actor.actorType(), actor.actorId(), actor.displaySnapshot(), action, occurredAt, AuditChangeJson.write(AuditChangeJson.read(changesJson)));
    }
    private static String json(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r"); }

    private static String requiredType(String value) { if (!NODE_TYPES.contains(value)) throw new OrganizationValidationException(); return value; }
    private static String requiredText(String value, int limit) { String normalized = Objects.requireNonNullElse(value, "").trim(); if (normalized.isEmpty() || normalized.length() > limit) throw new OrganizationValidationException(); return normalized; }
    private static String optionalNotes(String value) { if (value == null || value.isBlank()) return null; return requiredText(value, 2000); }
    private static List<String> normalizedPhases(String nodeType, List<String> values) {
        List<String> phases = values == null ? List.of() : values.stream().map(value -> requiredText(value, 120)).toList();
        if (!OrganizationNodeTypes.PROJECT.equals(nodeType) && !phases.isEmpty()) throw new OrganizationValidationException();
        if (phases.stream().distinct().count() != phases.size()) throw new OrganizationValidationException();
        return phases;
    }
    private void replacePhases(UUID projectId, List<String> phases) {
        jdbc.update("DELETE FROM organization.project_phase_name WHERE project_id=?", projectId);
        for (int index = 0; index < phases.size(); index++) jdbc.update("INSERT INTO organization.project_phase_name (project_id, phase_name, display_order) VALUES (?, ?, ?)", projectId, phases.get(index), index);
    }
    private static String canonical(String operation, Object... values) {
        StringBuilder result = new StringBuilder(operation);
        for (Object value : values) {
            String safe = value == null ? "<null>" : value instanceof List<?> list ? String.join("\\u001f", list.stream().map(String::valueOf).toList()) : value instanceof Map<?, ?> map ? map.entrySet().stream().sorted(Map.Entry.comparingByKey(java.util.Comparator.comparing(String::valueOf))).map(entry -> String.valueOf(entry.getKey()) + "=" + String.valueOf(entry.getValue())).collect(java.util.stream.Collectors.joining("\\u001f")) : String.valueOf(value);
            result.append('|').append(safe.length()).append(':').append(safe);
        }
        return result.toString();
    }
    public record HierarchyQuery(String type, String name, String code, String status, UUID projectId, String sort, String direction, int page, int pageSize) {
        public static HierarchyQuery empty() { return new HierarchyQuery(null, null, null, null, null, "UPDATED_AT", "DESC", 1, 50); }
        private HierarchyQuery validated() {
            String safeSort = sort == null ? "UPDATED_AT" : sort;
            String safeDirection = direction == null ? "DESC" : direction;
            if (!List.of("NAME", "CODE", "UPDATED_AT").contains(safeSort) || !List.of("ASC", "DESC").contains(safeDirection) || (type != null && !NODE_TYPES.contains(type)) || (status != null && !List.of("ENABLED", "DISABLED").contains(status)) || (projectId != null && !OrganizationNodeTypes.PROJECT.equals(type))) throw new OrganizationValidationException();
            return new HierarchyQuery(type, name, code, status, projectId, safeSort, safeDirection, page, pageSize);
        }
    }
    public record HierarchyPage(int page, int pageSize, long total, String sort, String direction, List<HierarchyPageItem> items) { }
    public record HierarchyPageItem(OrganizationNodeReadback node, List<HierarchyPathNode> path) { }
    public record HierarchyPathNode(UUID id, String code, String name) { }
    public static final class OrganizationNotFoundException extends RuntimeException { }
    public static final class OrganizationConflictException extends RuntimeException { }
    public static final class OrganizationValidationException extends RuntimeException { }
    public static final class OrganizationAuthorizationException extends RuntimeException { }
    private record ExtensionValues(String json, long revision) { }
}
