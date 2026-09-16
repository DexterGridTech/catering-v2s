package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.OrganizationStore;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;

/** Explicit Store-target rule read; it never reuses the project-target Store-management detail path. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores")
public class OperationsStoreOperatingRuleController {
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;
    private final OperationsOrganizationTaskReadService reads;
    private final ContractTaskReadService contracts;
    private final WorkspaceUserService user;

    @Autowired
    public OperationsStoreOperatingRuleController(
            OperationsSessionResolver sessions,
            BusinessEntityService entities,
            OperationsOrganizationTaskReadService reads,
            ContractTaskReadService contracts,
            WorkspaceUserService user) {
        this.sessions = sessions;
        this.entities = entities;
        this.reads = reads;
        this.contracts = contracts;
        this.user = user;
    }

    @GetMapping("/{storeId}/operating-rule-switches")
    @Transactional(readOnly = true)
    OrganizationStore read(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceReadAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        user.resolveTaskScope(session, ServiceNodeTypes.STORE, storeId);
        OrganizationOverviewTaskReadService.Item item = reads.store(
                session.workspaceUuid(), groupWorkspaceKey, storeId);
        OrganizationEntityReadback entity = entities.requireEntity(
                ServiceNodeTypes.STORE, session.workspaceUuid(), groupWorkspaceKey, storeId);
        var operatingRules = entities.requireStoreOperatingRuleSwitches(
                session.workspaceUuid(), groupWorkspaceKey, storeId);
        return StoreWireMapper.store(
                entity,
                item,
                contracts.derivedStoreStatus(session.workspaceUuid(), groupWorkspaceKey, storeId),
                operatingRules.values());
    }
}
