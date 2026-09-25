package com.catering.v2s.platform.receipt;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.businesschannel.application.BusinessChannelCommandReceiptService;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelCommandReceiptPersistence;
import com.catering.v2s.collaboration.application.CollaborationCommandReceiptService;
import com.catering.v2s.collaboration.application.persistence.CollaborationCommandReceiptPersistence;
import com.catering.v2s.contract.application.ContractCommandReceiptService;
import com.catering.v2s.contract.application.persistence.ContractCommandReceiptPersistence;
import com.catering.v2s.extension.application.ExtensionCommandReceiptService;
import com.catering.v2s.extension.application.persistence.ExtensionCommandReceiptPersistence;
import com.catering.v2s.organization.application.BusinessEntityCommandReceiptService;
import com.catering.v2s.organization.application.CommercialGroupCommandReceiptService;
import com.catering.v2s.organization.application.OrganizationHierarchyCommandReceiptService;
import com.catering.v2s.organization.application.persistence.BusinessEntityCommandReceiptPersistence;
import com.catering.v2s.organization.application.persistence.CommercialGroupCommandReceiptPersistence;
import com.catering.v2s.organization.application.persistence.OrganizationHierarchyCommandReceiptPersistence;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.iam.application.PlatformCommandReceiptService;
import com.catering.v2s.platform.iam.application.persistence.PlatformCommandReceiptPersistence;
import com.catering.v2s.platform.workspace.application.WorkspaceCommandReceiptService;
import com.catering.v2s.platform.workspace.application.persistence.WorkspaceCommandReceiptPersistence;
import com.catering.v2s.workspace.iam.application.WorkspaceIamCommandReceiptService;
import com.catering.v2s.workspace.iam.application.persistence.WorkspaceIamCommandReceiptPersistence;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Proof carrier for the shared legacy receipt rule: a claimed receipt with a null response is a successful claim-only
 * replay and must not execute the command again. The ten rows intentionally name every generic receipt owner;
 * owner-specific concurrency and HTTP acceptance remain separate evidence.
 */
class CommandReceiptNullReplayMatrixTest {
    private static final String REQUEST = "request";

    @Test
    void businessChannelClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "business-channel-null-01";
        BusinessChannelCommandReceiptPersistence persistence = mock(BusinessChannelCommandReceiptPersistence.class);
        when(persistence.find(workspace, "workspace-key", key))
                .thenReturn(Optional.of(new BusinessChannelCommandReceiptPersistence.Receipt(hash(), null)));

        String replay = new BusinessChannelCommandReceiptService(persistence, () -> 1L)
                .execute(workspace, "workspace-key", key, "operation", REQUEST, String.class, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void collaborationClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "collaboration-null-01";
        CollaborationCommandReceiptPersistence persistence = mock(CollaborationCommandReceiptPersistence.class);
        when(persistence.find(workspace, "workspace-key", key))
                .thenReturn(Optional.of(new CollaborationCommandReceiptPersistence.Receipt(hash(), null)));

        String replay = new CollaborationCommandReceiptService(persistence, () -> 1L)
                .execute(workspace, "workspace-key", key, "operation", REQUEST, String.class, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void extensionClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "extension-null-receipt-01";
        ExtensionCommandReceiptPersistence persistence = mock(ExtensionCommandReceiptPersistence.class);
        when(persistence.claim(eq(key), eq(workspace), eq("workspace-key"), eq("STORE"), eq(hash())))
                .thenReturn(0);
        when(persistence.find(workspace, key))
                .thenReturn(new ExtensionCommandReceiptPersistence.Receipt(hash(), null, "SUCCEEDED"));

        var replay = new ExtensionCommandReceiptService(persistence)
                .execute(key, workspace, "workspace-key", "STORE", REQUEST, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void businessEntityClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "business-entity-null-01";
        BusinessEntityCommandReceiptPersistence persistence = mock(BusinessEntityCommandReceiptPersistence.class);
        when(persistence.claim(eq(workspace), eq(key), eq(hash()), anyLong())).thenReturn(0);
        when(persistence.read(workspace, key))
                .thenReturn(new BusinessEntityCommandReceiptPersistence.Receipt(hash(), null, "SUCCEEDED"));

        var replay = new BusinessEntityCommandReceiptService(persistence, () -> 1L)
                .execute(workspace, key, REQUEST, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void commercialGroupClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "commercial-group-null-01";
        CommercialGroupCommandReceiptPersistence persistence = mock(CommercialGroupCommandReceiptPersistence.class);
        when(persistence.read(workspace, key))
                .thenReturn(new CommercialGroupCommandReceiptPersistence.Receipt(hash(), null));

        var replay = new CommercialGroupCommandReceiptService(mock(JdbcTemplate.class), persistence, () -> 1L)
                .execute(workspace, key, REQUEST, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void organizationHierarchyClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "organization-hierarchy-null";
        OrganizationHierarchyCommandReceiptPersistence persistence =
                mock(OrganizationHierarchyCommandReceiptPersistence.class);
        when(persistence.read(workspace, key))
                .thenReturn(new OrganizationHierarchyCommandReceiptPersistence.Receipt(hash(), null));

        var replay = new OrganizationHierarchyCommandReceiptService(mock(JdbcTemplate.class), persistence, () -> 1L)
                .execute(workspace, key, REQUEST, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void platformClaimOnlyReplayDoesNotRunTheCommand() {
        String key = "platform-null-receipt-01";
        PlatformCommandReceiptPersistence persistence = mock(PlatformCommandReceiptPersistence.class);
        when(persistence.find(key))
                .thenReturn(Optional.of(new PlatformCommandReceiptPersistence.Receipt(hash(), null)));

        var replay = new PlatformCommandReceiptService(persistence, () -> 1L).execute(key, REQUEST, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void contractClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "contract-null-receipt-01";
        ContractCommandReceiptPersistence persistence = mock(ContractCommandReceiptPersistence.class);
        when(persistence.find(workspace, key)).thenReturn(new ContractCommandReceiptPersistence.Receipt(hash(), null));

        var replay = new ContractCommandReceiptService(persistence, () -> 1L)
                .execute(workspace, key, REQUEST, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void workspaceIamClaimOnlyReplayDoesNotRunTheCommand() {
        UUID workspace = UUID.randomUUID();
        String key = "workspace-iam-null-01";
        WorkspaceIamCommandReceiptPersistence persistence = mock(WorkspaceIamCommandReceiptPersistence.class);
        when(persistence.find(workspace, key))
                .thenReturn(new WorkspaceIamCommandReceiptPersistence.ReceiptRow(hash(), null));

        String replay = new WorkspaceIamCommandReceiptService(persistence, () -> 1L)
                .execute(workspace, key, REQUEST, String.class, () -> failReplay());

        assertNull(replay);
    }

    @Test
    void workspaceClaimOnlyReplayDoesNotRunTheCommand() {
        String key = "workspace-null-receipt-01";
        WorkspaceCommandReceiptPersistence persistence = mock(WorkspaceCommandReceiptPersistence.class);
        when(persistence.find("workspace-key", key))
                .thenReturn(Optional.of(new WorkspaceCommandReceiptPersistence.Receipt(hash(), null)));

        var replay = new WorkspaceCommandReceiptService(persistence, () -> 1L)
                .execute("workspace-key", key, REQUEST, () -> failReplay());

        assertNull(replay);
    }

    private static String hash() {
        return Sha256Hex.digest(REQUEST);
    }

    private static <T> T failReplay() {
        throw new AssertionError("claim-only replay must not execute the command");
    }
}
