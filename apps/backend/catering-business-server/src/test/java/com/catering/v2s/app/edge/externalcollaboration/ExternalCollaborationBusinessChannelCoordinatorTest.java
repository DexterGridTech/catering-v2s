package com.catering.v2s.app.edge.externalcollaboration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ExternalCollaborationBusinessChannelCoordinatorTest {
    @Test
    void disabledChannelRejectsBindingUpdateBeforeCollaborationOwnerWrite() {
        UUID workspace = UUID.randomUUID();
        UUID channelRef = UUID.randomUUID();
        UUID bindingRef = UUID.randomUUID();
        BusinessChannelReadApi businessChannelReads = mock(BusinessChannelReadApi.class);
        CollaborationCommandApi collaboration = mock(CollaborationCommandApi.class);
        when(businessChannelReads.readChannel(workspace, "workspace-key", channelRef))
                .thenReturn(new BusinessChannelReadback.Channel(
                        channelRef,
                        UUID.randomUUID(),
                        "PROJECT",
                        UUID.randomUUID().toString(),
                        null,
                        "Disabled channel",
                        bindingRef,
                        "BOUND",
                        "DISABLED",
                        List.of("MANUAL"),
                        3L));
        ExternalCollaborationBusinessChannelCoordinator coordinator =
                new ExternalCollaborationBusinessChannelCoordinator(
                        collaboration,
                        mock(CollaborationCatalogReadApi.class),
                        businessChannelReads,
                        mock(BusinessChannelCommandApi.class));
        OperationsOwnerScopeGrant grant = new OperationsOwnerScopeGrant(
                workspace,
                "workspace-key",
                "REQ_OPERATIONS_BUSINESS_CHANNEL_BINDING_UPDATE",
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                "PROJECT",
                UUID.randomUUID(),
                "PROJECT",
                UUID.randomUUID(),
                List.of(),
                7L);
        CollaborationCommandApi.UpdateOperationsBindingCommand command =
                new CollaborationCommandApi.UpdateOperationsBindingCommand(
                        workspace,
                        "workspace-key",
                        bindingRef,
                        "updated",
                        null,
                        3L,
                        7L,
                        "binding-update-idempotency",
                        AuditActor.system(),
                        grant);

        CollaborationCommandApi.Problem problem = assertThrows(
                CollaborationCommandApi.Problem.class, () -> coordinator.updateOperationsBinding(command, channelRef));

        assertEquals("DISABLED_OBJECT_NOT_EDITABLE", problem.code());
        verifyNoInteractions(collaboration);
    }
}
