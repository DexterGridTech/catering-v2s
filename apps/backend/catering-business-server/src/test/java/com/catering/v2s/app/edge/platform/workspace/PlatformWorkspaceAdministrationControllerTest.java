package com.catering.v2s.app.edge.platform.workspace;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceSortKey;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceTaskQuery;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPage;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceAdministrationTaskReadService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/** Ensures a workspace page resolves logo references through one bounded asset-owner task read. */
class PlatformWorkspaceAdministrationControllerTest {
    @Test
    void listUsesOneBatchAssetOwnerReadForOneTwentyAndFiftyItemPages() {
        UUID firstLogo = UUID.randomUUID();
        UUID secondLogo = UUID.randomUUID();
        for (int itemCount : List.of(1, 20, 50)) {
            Fixture fixture = fixture();
            List<WorkspaceAdministrationReadback> values = IntStream.range(0, itemCount)
                    .mapToObj(index -> workspace("workspace-" + index, index % 2 == 0 ? firstLogo : secondLogo))
                    .toList();
            when(fixture.taskReads.page(any()))
                    .thenReturn(new PlatformWorkspaceAdministrationTaskReadService.PageReadback(
                            new WorkspaceAdministrationPage(values, 1, itemCount, itemCount, "NAME", "ASC"),
                            Map.of(),
                            Map.of(
                                    firstLogo,
                                    new PlatformAssetService.PublicAssetReference(
                                            "https://assets.test/first", "image/png", "first"),
                                    secondLogo,
                                    new PlatformAssetService.PublicAssetReference(
                                            "https://assets.test/second", "image/png", "second"))));

            var page = fixture.controller.list(
                    fixture.request,
                    null,
                    null,
                    null,
                    null,
                    1,
                    itemCount,
                    GroupWorkspaceSortKey.NAME,
                    SortDirection.ASC);

            assertEquals(itemCount, page.items().size());
            assertEquals("https://assets.test/first", page.items().getFirst().logoUrl());
            verify(fixture.taskReads).page(any());
            verify(fixture.workspaces, never()).list(any());
            verify(fixture.assets, never()).requireActivePublicReferences(any());
            verify(fixture.assets, never()).requireActivePublicReference(any());
        }
    }

    private static WorkspaceAdministrationReadback workspace(String key, UUID logo) {
        return new WorkspaceAdministrationReadback(
                UUID.randomUUID(), key, key, key, logo.toString(), null, "ENABLED", 1L, 1L, 1L, 1L, false);
    }

    private static Fixture fixture() {
        PlatformAuthenticationService authentication = mock(PlatformAuthenticationService.class);
        when(authentication.requireActiveSession("platform-session"))
                .thenReturn(new PlatformSessionReadback(
                        UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE));
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        PlatformAssetService assets = mock(PlatformAssetService.class);
        PlatformWorkspaceAdministrationTaskReadService taskReads =
                mock(PlatformWorkspaceAdministrationTaskReadService.class);
        PlatformWorkspaceAdministrationController controller = new PlatformWorkspaceAdministrationController(
                new PlatformSessionResolver(authentication),
                workspaces,
                mock(GroupWorkspaceTaskQuery.class),
                taskReads);
        EdgeRequestContext request = new EdgeRequestContext(
                "test-fingerprint",
                "test-correlation",
                PlatformSessionCookie.fromCookie("platform-session"),
                null,
                null,
                null,
                null);
        return new Fixture(controller, workspaces, assets, taskReads, request);
    }

    private record Fixture(
            PlatformWorkspaceAdministrationController controller,
            WorkspaceAdministrationService workspaces,
            PlatformAssetService assets,
            PlatformWorkspaceAdministrationTaskReadService taskReads,
            EdgeRequestContext request) {}
}
