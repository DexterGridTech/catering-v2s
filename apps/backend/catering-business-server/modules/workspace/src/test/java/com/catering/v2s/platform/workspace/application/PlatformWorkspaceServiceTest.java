package com.catering.v2s.platform.workspace.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceDetail;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformWorkspaceServiceTest {
    @Test
    void initializeUsesWorkspaceUuidFromTheDetailProjection() {
        GroupWorkspaceRepository repository = mock(GroupWorkspaceRepository.class);
        InitializeCommercialGroupCommand command = mock(InitializeCommercialGroupCommand.class);
        TimeProvider time = mock(TimeProvider.class);
        PlatformExecutionContext context = mock(PlatformExecutionContext.class);
        AuditActor actor = mock(AuditActor.class);
        UUID workspaceUuid = UUID.randomUUID();
        GroupWorkspaceDetail detail =
                new GroupWorkspaceDetail(7L, workspaceUuid, "gw", "North", "ENABLED", "NOT_INITIALIZED", null);
        when(repository.detail(context, "gw")).thenReturn(Optional.of(detail));

        PlatformWorkspaceService service = new PlatformWorkspaceService(repository, command, time);

        assertDoesNotThrow(() -> service.initializeCommercialGroup(
                context, "gw", "idempotency-key", "group-code", "Group", Map.of(), actor));

        verify(repository).detail(context, "gw");
        verify(command)
                .execute(
                        eq(context),
                        eq(workspaceUuid),
                        eq("gw"),
                        eq(7L),
                        eq("idempotency-key"),
                        eq("group-code"),
                        eq("Group"),
                        eq(Map.of()),
                        eq(actor));
        verifyNoInteractions(time);
    }
}
