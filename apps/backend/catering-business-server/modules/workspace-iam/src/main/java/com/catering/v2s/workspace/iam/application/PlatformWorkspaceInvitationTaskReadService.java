package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.application.persistence.PlatformWorkspaceInvitationTaskReadPersistence;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Platform invitation reads: a workspace-IAM CTE projection plus one persisted-path batch. */
@Service
public class PlatformWorkspaceInvitationTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final PlatformWorkspaceInvitationTaskReadPersistence persistence;
    private final OrganizationTaskPathLookup paths;

    @org.springframework.beans.factory.annotation.Autowired
    public PlatformWorkspaceInvitationTaskReadService(
            PlatformWorkspaceInvitationTaskReadPersistence persistence, OrganizationTaskPathLookup paths) {
        this.persistence = persistence;
        this.paths = paths;
    }

    public PlatformWorkspaceInvitationTaskReadService(JdbcTemplate jdbc, OrganizationTaskPathLookup paths) {
        this(new PlatformWorkspaceInvitationTaskReadPersistence(jdbc), paths);
    }

    @Transactional(readOnly = true)
    public WorkspaceInvitationService.ManagementInvitationPage page(
            UUID workspaceUuid, String key, WorkspaceInvitationService.ManagementInvitationPageRequest request) {
        PlatformWorkspaceInvitationTaskReadPersistence.PageResult result =
                primary(() -> persistence.page(workspaceUuid, key, request));
        List<PlatformWorkspaceInvitationTaskReadPersistence.Row> rows = result.rows();
        WorkspaceInvitationService.ManagementInvitationPageRequest safe = result.criteria();
        long total = rows.isEmpty() ? 0 : rows.getFirst().total();
        return new WorkspaceInvitationService.ManagementInvitationPage(
                views(workspaceUuid, key, rows), safe.page(), safe.pageSize(), total, safe);
    }

    @Transactional(readOnly = true)
    public WorkspaceInvitationService.ManagementInvitationView detail(
            UUID workspaceUuid, String key, UUID invitationId) {
        if (workspaceUuid == null || key == null || key.isBlank() || invitationId == null)
            throw new WorkspaceInvitationService.InvitationNotFoundException();
        List<PlatformWorkspaceInvitationTaskReadPersistence.Row> rows =
                primary(() -> persistence.detail(workspaceUuid, key, invitationId));
        if (rows.isEmpty()) throw new WorkspaceInvitationService.InvitationNotFoundException();
        return views(workspaceUuid, key, rows).getFirst();
    }

    private List<WorkspaceInvitationService.ManagementInvitationView> views(
            UUID workspaceUuid,
            String key,
            List<PlatformWorkspaceInvitationTaskReadPersistence.Row> rows) {
        List<PlatformWorkspaceInvitationTaskReadPersistence.Row> actual = rows.stream()
                .filter(row -> row.id() != null)
                .toList();
        LinkedHashSet<OrganizationTaskPathLookup.TaskPathRef> refs = new LinkedHashSet<>();
        for (PlatformWorkspaceInvitationTaskReadPersistence.Row row : actual)
            for (Intent intent : intents(row))
                refs.add(new OrganizationTaskPathLookup.TaskPathRef(intent.type(), intent.targetId()));
        Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> resolved = refs.isEmpty()
                ? Map.of()
                : primary(() -> paths.describePersistedTaskPaths(workspaceUuid, key, List.copyOf(refs)));
        return actual.stream().map(row -> view(key, row, resolved)).toList();
    }

    private static WorkspaceInvitationService.ManagementInvitationView view(
            String key,
            PlatformWorkspaceInvitationTaskReadPersistence.Row row,
            Map<OrganizationTaskPathLookup.TaskPathRef, OrganizationTaskPathLookup.TaskPath> paths) {
        List<Intent> intents = intents(row);
        if (intents.isEmpty()) throw new WorkspaceInvitationService.InvitationStateException();
        String type = intents.getFirst().type();
        if (intents.stream().anyMatch(value -> !type.equals(value.type())))
            throw new WorkspaceInvitationService.InvitationStateException();
        List<String> roleNames = intents.stream().map(Intent::roleName).toList();
        if (roleNames.isEmpty()) throw new WorkspaceInvitationService.InvitationStateException();
        List<OrganizationTaskPathLookup.TaskPath> pathFacts = intents.stream()
                .map(value -> paths.get(new OrganizationTaskPathLookup.TaskPathRef(value.type(), value.targetId())))
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (pathFacts.size() != 1) throw new WorkspaceInvitationService.InvitationStateException();
        return new WorkspaceInvitationService.ManagementInvitationView(
                row.id(),
                key,
                mask(row.mobile()),
                row.mobile(),
                row.issuer(),
                type,
                pathFacts.getFirst().nodes(),
                roleNames,
                row.status(),
                1L,
                row.expires(),
                row.version(),
                row.created(),
                row.consented(),
                row.completed(),
                row.cancelled(),
                row.token() == null ? null : new WorkspaceInvitationService.InvitationRouteFacts(key, row.token()));
    }

    private static List<Intent> intents(PlatformWorkspaceInvitationTaskReadPersistence.Row row) {
        try {
            List<Intent> values = new ArrayList<>();
            JSON.readTree(row.intents())
                    .forEach(value -> values.add(new Intent(
                            value.path("type").asText(),
                            UUID.fromString(value.path("targetId").asText()),
                            value.path("roleName").asText())));
            return List.copyOf(values);
        } catch (Exception error) {
            throw new WorkspaceInvitationService.InvitationStateException(error);
        }
    }

    private static String mask(String value) {
        return value.length() <= 4
                ? "****"
                : value.substring(0, Math.min(3, value.length())) + "****"
                        + value.substring(Math.max(3, value.length() - 4));
    }

    private static <T> T primary(java.util.function.Supplier<T> action) {
        return ReadBudgetComponent.measure(ReadBudgetComponent.Component.PRIMARY_QUERY, action);
    }

    private record Intent(String type, UUID targetId, String roleName) {}
}
