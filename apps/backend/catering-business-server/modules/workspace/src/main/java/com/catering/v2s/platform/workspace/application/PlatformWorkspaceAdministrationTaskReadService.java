package com.catering.v2s.platform.workspace.application;

import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPage;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceIamSummaryLookup;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Typed GET projection: platform base, organization fact, asset batch, and IAM aggregate. */
@Service
public class PlatformWorkspaceAdministrationTaskReadService {
    private final WorkspaceAdministrationService workspaces;
    private final OrganizationGroupWorkspaceInitializationLookup initializationFacts;
    private final PlatformAssetService assets;
    private final WorkspaceIamSummaryLookup workspaceIam;

    public PlatformWorkspaceAdministrationTaskReadService(
            WorkspaceAdministrationService workspaces,
            OrganizationGroupWorkspaceInitializationLookup initializationFacts,
            PlatformAssetService assets,
            WorkspaceIamSummaryLookup workspaceIam) {
        this.workspaces = workspaces;
        this.initializationFacts = initializationFacts;
        this.assets = assets;
        this.workspaceIam = workspaceIam;
    }

    @Transactional(readOnly = true)
    public PageReadback page(WorkspaceAdministrationPageRequest request) {
        WorkspaceAdministrationPage page = workspaces.list(request);
        Map<String, OrganizationGroupWorkspaceInitializationLookup.InitializationState> initialized =
                initializationFacts.listInitializationFacts(page.items().stream()
                        .map(WorkspaceAdministrationReadback::groupWorkspaceKey)
                        .toList());
        Map<UUID, PlatformAssetService.PublicAssetReference> logos =
                assets.requireActivePublicReferences(assetRefs(page.items()));
        return new PageReadback(page, initialized, logos);
    }

    @Transactional(readOnly = true)
    public DetailReadback detail(String groupWorkspaceKey) {
        WorkspaceAdministrationReadback workspace = workspaces.require(groupWorkspaceKey);
        return detailAfterCommand(workspace);
    }

    /** Builds the same detail projection from an owner command readback without re-reading the workspace row. */
    @Transactional(readOnly = true)
    public DetailReadback detailAfterCommand(WorkspaceAdministrationReadback workspace) {
        Optional<CommercialGroupReadback> commercialGroup =
                initializationFacts.initializationFact(workspace.groupWorkspaceKey());
        Map<UUID, PlatformAssetService.PublicAssetReference> logos =
                assets.requireActivePublicReferences(assetRefs(List.of(workspace)));
        PlatformAssetService.PublicAssetReference logo =
                workspace.logoAssetRef() == null ? null : logos.get(UUID.fromString(workspace.logoAssetRef()));
        WorkspaceIamSummaryLookup.AccountAndRoleSummary summary =
                workspaceIam.accountAndRoleSummary(workspace.workspaceUuid());
        return new DetailReadback(workspace, commercialGroup, logo, summary);
    }

    private static Set<UUID> assetRefs(List<WorkspaceAdministrationReadback> workspaces) {
        return workspaces.stream()
                .map(WorkspaceAdministrationReadback::logoAssetRef)
                .filter(java.util.Objects::nonNull)
                .map(UUID::fromString)
                .collect(Collectors.toUnmodifiableSet());
    }

    public record PageReadback(
            WorkspaceAdministrationPage workspacePage,
            Map<String, OrganizationGroupWorkspaceInitializationLookup.InitializationState> initializationFacts,
            Map<UUID, PlatformAssetService.PublicAssetReference> logoReferences) {}

    public record DetailReadback(
            WorkspaceAdministrationReadback workspace,
            Optional<CommercialGroupReadback> commercialGroup,
            PlatformAssetService.PublicAssetReference logoReference,
            WorkspaceIamSummaryLookup.AccountAndRoleSummary accountAndRoleSummary) {}
}
