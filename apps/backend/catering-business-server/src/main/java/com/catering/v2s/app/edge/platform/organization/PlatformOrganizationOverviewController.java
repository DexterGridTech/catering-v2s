package com.catering.v2s.app.edge.platform.organization;

import com.catering.v2s.app.edge.generated.wire.OrganizationCandidatePage;
import com.catering.v2s.app.edge.generated.wire.OrganizationCandidatePageItemsItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationCandidatePageMetadata;
import com.catering.v2s.app.edge.generated.wire.OrganizationCandidateQuerySubjectType;
import com.catering.v2s.app.edge.generated.wire.OrganizationHierarchyTree;
import com.catering.v2s.app.edge.generated.wire.OrganizationHierarchyTreeNode;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewCategory;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemBrand;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemExtensionFieldsItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemHeadCompany;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemPathItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemProject;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewItemTenant;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewPage;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewPageFilterOptionsItem;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewPageMetadata;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewSortDirection;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewSortKey;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewSource;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewStatus;
import com.catering.v2s.app.edge.generated.wire.OrganizationOverviewType;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.organization.application.StoreCandidateTaskReadService;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview")
public final class PlatformOrganizationOverviewController {
    private final PlatformSessionResolver sessions; private final WorkspaceAdministrationService workspaces; private final OrganizationOverviewTaskReadService overview; private final StoreCandidateTaskReadService candidates; private final ExtensionDefinitionService definitions;
    public PlatformOrganizationOverviewController(PlatformSessionResolver sessions, WorkspaceAdministrationService workspaces, OrganizationOverviewTaskReadService overview, StoreCandidateTaskReadService candidates, ExtensionDefinitionService definitions) { this.sessions = sessions; this.workspaces = workspaces; this.overview = overview; this.candidates = candidates; this.definitions = definitions; }
    @GetMapping OrganizationOverviewPage page(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam String category, @RequestParam(required = false) String type, @RequestParam(required = false) String name, @RequestParam(required = false) String code, @RequestParam(required = false) String legalName, @RequestParam(required = false) String unifiedSocialCreditCode, @RequestParam(required = false) String status, @RequestParam(required = false) String source, @RequestParam(required = false) String projectId, @RequestParam(required = false) String brandId, @RequestParam(required = false) String tenantId, @RequestParam(required = false) String headCompanyId, @RequestParam(defaultValue = "UPDATED_AT") String sort, @RequestParam(defaultValue = "DESC") String direction, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int pageSize) { var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey); return page(overview.platformOverviewTaskPage(workspace.workspaceUuid(), groupWorkspaceKey, category, new OrganizationOverviewTaskReadService.Query(type, name, code, legalName, unifiedSocialCreditCode, status, source, uuid(projectId), uuid(brandId), uuid(tenantId), uuid(headCompanyId), sort, direction, null), page, pageSize)); }
    @GetMapping("/candidates") OrganizationCandidatePage candidatePage(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestParam String subjectType, @RequestParam(defaultValue = "CONTRACT_LIST") String candidateUsage, @RequestParam(required = false) String queryText, @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer pageSize, @RequestParam(required = false) UUID selectedId, @RequestParam(required = false) UUID projectId) {
        var readFacts = sessions.requireRead(request);
        if (!"CONTRACT_LIST".equals(candidateUsage)) throw new InvalidEdgeRequestException("invalid platform organization candidate usage");
        var workspace = readFacts.requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
        var value = candidates.platformContractCandidatePage(workspace.workspaceUuid(), groupWorkspaceKey,
            new StoreCandidateTaskReadService.PlatformContractCandidateQuery(
                StoreCandidateTaskReadService.PlatformContractCandidateSubject.valueOf(subjectType), queryText,
                page == null ? 1 : page, pageSize == null ? 20 : pageSize, selectedId, projectId
            ));
        return new OrganizationCandidatePage(new OrganizationCandidatePageMetadata(OrganizationCandidateQuerySubjectType.valueOf(value.metadata().subjectType()), value.metadata().queryText(), (long) value.metadata().page(), (long) value.metadata().pageSize(), value.metadata().total(), value.metadata().selectedId()), value.items().stream().map(item -> new OrganizationCandidatePageItemsItem(item.id(), item.code(), item.name())).toList());
    }
    @GetMapping("/hierarchy") OrganizationHierarchyTree hierarchy(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) { var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey); return hierarchy(overview.platformHierarchyTree(workspace.workspaceUuid(), groupWorkspaceKey)); }
    @GetMapping("/{category}/{itemId}") OrganizationOverviewItem detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable String category, @PathVariable UUID itemId) { var workspace = sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey); var base = overview.platformManagementBaseDetail(workspace.workspaceUuid(), groupWorkspaceKey, category, itemId); return item(overview.withPlatformManagementDefinition(base, definitions.platformManagementDefinition(workspace.workspaceUuid(), groupWorkspaceKey, base.item().type()))); }

    private static OrganizationOverviewPage page(OrganizationOverviewTaskReadService.Page value) {
        return new OrganizationOverviewPage(
            new OrganizationOverviewPageMetadata(value.metadata().groupWorkspaceKey(), OrganizationOverviewCategory.valueOf(value.metadata().category()), (long) value.metadata().page(), (long) value.metadata().pageSize(), value.metadata().total(), OrganizationOverviewSortKey.valueOf(value.metadata().sort()), OrganizationOverviewSortDirection.valueOf(value.metadata().direction())),
            value.items().stream().map(PlatformOrganizationOverviewController::item).toList(), value.itemsSourceStatus(), value.itemsAsOf(), value.itemsUnresolved(),
            value.filterOptions().stream().map(option -> new OrganizationOverviewPageFilterOptionsItem(option.kind(), option.id().toString(), option.code(), option.name())).toList(), value.filterOptionsSourceStatus(), value.filterOptionsAsOf(), value.filterOptionsUnresolved()
        );
    }

    private static OrganizationOverviewItem item(OrganizationOverviewTaskReadService.Item value) {
        return new OrganizationOverviewItem(
            value.id().toString(), value.groupWorkspaceKey(), OrganizationOverviewCategory.valueOf(value.category()), OrganizationOverviewType.valueOf(value.type()), value.code(), value.name(),
            value.path().stream().map(PlatformOrganizationOverviewController::pathItem).toList(), OrganizationOverviewStatus.valueOf(value.status()), OrganizationOverviewSource.valueOf(value.source()), value.version(), value.createdAt(), value.updatedAt(), value.notes(),
            project(value.project()), brand(value.brand()), tenant(value.tenant()), headCompany(value.headCompany()), value.unresolvedReferences(), value.alias(), value.legalName(), value.unifiedSocialCreditCode(),
            value.extensionFields().stream().map(field -> new OrganizationOverviewItemExtensionFieldsItem(field.name(), field.value())).toList()
        );
    }

    private static OrganizationOverviewItemPathItem pathItem(OrganizationOverviewTaskReadService.Reference value) { return new OrganizationOverviewItemPathItem(value.id().toString(), value.code(), value.name(), value.resolved()); }
    private static OrganizationOverviewItemProject project(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationOverviewItemProject(value.id().toString(), value.code(), value.name(), value.resolved()); }
    private static OrganizationOverviewItemBrand brand(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationOverviewItemBrand(value.id().toString(), value.code(), value.name(), value.resolved()); }
    private static OrganizationOverviewItemTenant tenant(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationOverviewItemTenant(value.id().toString(), value.code(), value.name(), value.resolved()); }
    private static OrganizationOverviewItemHeadCompany headCompany(OrganizationOverviewTaskReadService.Reference value) { return value == null ? null : new OrganizationOverviewItemHeadCompany(value.id().toString(), value.code(), value.name(), value.resolved()); }

    private static OrganizationHierarchyTree hierarchy(OrganizationOverviewTaskReadService.HierarchyTree value) { return new OrganizationHierarchyTree(value.groupCode(), value.groupName(), value.regions().stream().map(PlatformOrganizationOverviewController::treeNode).toList()); }
    private static OrganizationHierarchyTreeNode treeNode(OrganizationOverviewTaskReadService.TreeNode value) { return new OrganizationHierarchyTreeNode(value.id(), value.type(), value.code(), value.name(), OrganizationOverviewStatus.valueOf(value.status()), value.notes(), value.updatedAt(), value.children().stream().map(PlatformOrganizationOverviewController::treeNode).toList(), value.phases()); }
    private static UUID uuid(String value) { if (value == null || value.isBlank()) return null; try { return UUID.fromString(value); } catch (IllegalArgumentException failure) { throw new InvalidEdgeRequestException("invalid overview UUID filter"); } }
}
