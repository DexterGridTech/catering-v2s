package com.catering.v2s.audit.read;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.extension.application.ExtensionAuditHistoryService;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformIamAuditHistoryService;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceAuditHistoryService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Closed platform-audit task reader with seven compile-time target branches. */
@Service
public class PlatformAuditHistoryTaskReadService {
    private final PlatformWorkspaceAuditHistoryService groupWorkspaceAudit;
    private final WorkspaceAdministrationService workspaces;
    private final PlatformIamAuditHistoryService platformIamAudit;
    private final WorkspaceIamAuditHistoryService workspaceIamAudit;
    private final ExtensionAuditHistoryService extensionAudit;
    private final ContractAuditHistoryService contractAudit;

    public PlatformAuditHistoryTaskReadService(
            PlatformWorkspaceAuditHistoryService groupWorkspaceAudit,
            WorkspaceAdministrationService workspaces,
            PlatformIamAuditHistoryService platformIamAudit,
            WorkspaceIamAuditHistoryService workspaceIamAudit,
            ExtensionAuditHistoryService extensionAudit,
            ContractAuditHistoryService contractAudit) {
        this.groupWorkspaceAudit = Objects.requireNonNull(groupWorkspaceAudit, "groupWorkspaceAudit");
        this.workspaces = Objects.requireNonNull(workspaces, "workspaces");
        this.platformIamAudit = Objects.requireNonNull(platformIamAudit, "platformIamAudit");
        this.workspaceIamAudit = Objects.requireNonNull(workspaceIamAudit, "workspaceIamAudit");
        this.extensionAudit = Objects.requireNonNull(extensionAudit, "extensionAudit");
        this.contractAudit = Objects.requireNonNull(contractAudit, "contractAudit");
    }

    @Transactional(readOnly = true)
    public AuditHistoryPage read(PlatformSessionReadback session, PlatformAuditHistoryQuery query) {
        Objects.requireNonNull(session, "session");
        return switch (Objects.requireNonNull(query, "query")) {
            case PlatformAuditHistoryQuery.GroupWorkspace value -> {
                AuditReadScope scope = scope(value.target().entityRef());
                yield groupWorkspaceAudit.readGroupWorkspace(
                        scope, value.target().entityRef(), value.page(), value.pageSize());
            }
            case PlatformAuditHistoryQuery.PlatformAdmin value -> platformIamAudit.readPlatformAdmin(
                    value.target().entityRef(), value.page(), value.pageSize());
            case PlatformAuditHistoryQuery.WorkspaceRole value -> workspaceIamAudit.readPlatformAuditProjection(
                    scope(value.groupWorkspaceKey()), value.target(), value.page(), value.pageSize());
            case PlatformAuditHistoryQuery.WorkspaceAccount value -> workspaceIamAudit.readPlatformAuditProjection(
                    scope(value.groupWorkspaceKey()), value.target(), value.page(), value.pageSize());
            case PlatformAuditHistoryQuery.WorkspaceInvitation value -> workspaceIamAudit.readPlatformAuditProjection(
                    scope(value.groupWorkspaceKey()), value.target(), value.page(), value.pageSize());
            case PlatformAuditHistoryQuery.ExtensionDefinition value -> extensionAudit.readExtensionDefinition(
                    scope(value.groupWorkspaceKey()), value.target().entityRef(), value.page(), value.pageSize());
            case PlatformAuditHistoryQuery.StoreContract value -> contractAudit.readStoreContract(
                    scope(value.groupWorkspaceKey()), value.target().entityRef(), value.page(), value.pageSize());
        };
    }

    private AuditReadScope scope(String groupWorkspaceKey) {
        var workspace = ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.CONTEXT_PLATFORM_WORKSPACE,
                () -> workspaces.requireEnabled(groupWorkspaceKey));
        return new AuditReadScope(workspace.workspaceUuid(), workspace.groupWorkspaceKey());
    }

    /** Closed wire-to-task boundary; each record permanently fixes its audit entity type. */
    public sealed interface PlatformAuditHistoryQuery
            permits PlatformAuditHistoryQuery.GroupWorkspace,
                    PlatformAuditHistoryQuery.PlatformAdmin,
                    PlatformAuditHistoryQuery.WorkspaceRole,
                    PlatformAuditHistoryQuery.WorkspaceAccount,
                    PlatformAuditHistoryQuery.WorkspaceInvitation,
                    PlatformAuditHistoryQuery.ExtensionDefinition,
                    PlatformAuditHistoryQuery.StoreContract {
        AuditTarget target();

        long page();

        long pageSize();

        record GroupWorkspace(AuditTarget target, long page, long pageSize) implements PlatformAuditHistoryQuery {
            public GroupWorkspace {
                requireType(target, "GROUP_WORKSPACE");
            }
        }

        record PlatformAdmin(AuditTarget target, long page, long pageSize) implements PlatformAuditHistoryQuery {
            public PlatformAdmin {
                requireType(target, "PLATFORM_ADMIN");
            }
        }

        record WorkspaceRole(AuditTarget target, String groupWorkspaceKey, long page, long pageSize)
                implements PlatformAuditHistoryQuery {
            public WorkspaceRole {
                requireType(target, "WORKSPACE_ROLE");
                groupWorkspaceKey = requireWorkspaceKey(groupWorkspaceKey);
            }
        }

        record WorkspaceAccount(AuditTarget target, String groupWorkspaceKey, long page, long pageSize)
                implements PlatformAuditHistoryQuery {
            public WorkspaceAccount {
                requireType(target, "WORKSPACE_ACCOUNT");
                groupWorkspaceKey = requireWorkspaceKey(groupWorkspaceKey);
            }
        }

        record WorkspaceInvitation(AuditTarget target, String groupWorkspaceKey, long page, long pageSize)
                implements PlatformAuditHistoryQuery {
            public WorkspaceInvitation {
                requireType(target, "WORKSPACE_INVITATION");
                groupWorkspaceKey = requireWorkspaceKey(groupWorkspaceKey);
            }
        }

        record ExtensionDefinition(AuditTarget target, String groupWorkspaceKey, long page, long pageSize)
                implements PlatformAuditHistoryQuery {
            public ExtensionDefinition {
                requireType(target, "EXTENSION_DEFINITION");
                groupWorkspaceKey = requireWorkspaceKey(groupWorkspaceKey);
            }
        }

        record StoreContract(AuditTarget target, String groupWorkspaceKey, long page, long pageSize)
                implements PlatformAuditHistoryQuery {
            public StoreContract {
                requireType(target, "STORE_CONTRACT");
                groupWorkspaceKey = requireWorkspaceKey(groupWorkspaceKey);
            }
        }

        private static void requireType(AuditTarget target, String expectedType) {
            if (target == null || !expectedType.equals(target.entityType()))
                throw new IllegalArgumentException("unsupported platform audit target");
        }

        private static String requireWorkspaceKey(String groupWorkspaceKey) {
            String normalized =
                    Objects.requireNonNullElse(groupWorkspaceKey, "").trim();
            if (normalized.isEmpty())
                throw new IllegalArgumentException("audit host target requires group workspace key");
            return normalized;
        }
    }
}
