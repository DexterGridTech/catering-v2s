package com.catering.v2s.organization.application;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationAssignmentCandidateService implements OrganizationAssignmentCandidateLookup {
    private final JdbcTemplate jdbc;
    private final CommercialGroupLookup groups;
    private final OrganizationTaskPathLookup taskPaths;

    public OrganizationAssignmentCandidateService(
        JdbcTemplate jdbc,
        CommercialGroupLookup groups,
        OrganizationTaskPathLookup taskPaths
    ) {
        this.jdbc = jdbc;
        this.groups = groups;
        this.taskPaths = taskPaths;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AssignmentCandidate> listEnabled(UUID workspaceUuid, String key, String type) {
        return switch (type) {
            case ServiceNodeTypes.GROUP -> {
                UUID id = groups.requireCommercialGroupRef(workspaceUuid, key);
                yield List.of(new AssignmentCandidate(type, id, groups.describeCommercialGroup(workspaceUuid, key, id)));
            }
            case ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT -> candidates(workspaceUuid, key, type, jdbc.query(
                "SELECT id FROM organization.organization_node WHERE workspace_uuid=? AND group_workspace_key=? AND node_type=? AND status='ENABLED' ORDER BY code",
                (row, index) -> row.getObject(1, UUID.class),
                workspaceUuid,
                key,
                type
            ));
            case ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE -> {
                String table = ServiceNodeTypes.HEAD_COMPANY.equals(type) ? "head_company" : "store";
                yield candidates(workspaceUuid, key, type, jdbc.query(
                    "SELECT id FROM organization." + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND status='ENABLED' ORDER BY code",
                    (row, index) -> row.getObject(1, UUID.class),
                    workspaceUuid,
                    key
                ));
            }
            default -> throw new IllegalArgumentException("unsupported assignment candidate type");
        };
    }

    private List<AssignmentCandidate> candidates(UUID workspaceUuid, String key, String type, List<UUID> ids) {
        if (ids.isEmpty()) return List.of();
        List<OrganizationTaskPathLookup.TaskPathRef> targets = ids.stream()
            .map(id -> new OrganizationTaskPathLookup.TaskPathRef(type, id))
            .toList();
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths = taskPaths.requireTaskPaths(workspaceUuid, key, targets);
        List<AssignmentCandidate> result = new ArrayList<>(ids.size());
        for (UUID id : ids) {
            OrganizationTaskPathLookup.TaskPath path = paths.get(new OrganizationTaskPathLookup.TaskPathRef(type, id));
            if (path == null) throw new OrganizationTaskPathService.TaskPathNotFoundException();
            result.add(new AssignmentCandidate(type, id, path.displayPath()));
        }
        return List.copyOf(result);
    }
}
