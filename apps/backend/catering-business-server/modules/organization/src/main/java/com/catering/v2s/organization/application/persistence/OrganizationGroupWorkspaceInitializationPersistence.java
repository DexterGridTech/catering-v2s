package com.catering.v2s.organization.application.persistence;

import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup.InitializationState;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Typed persistence boundary for organization commercial-group initialization facts. */
@Repository
public class OrganizationGroupWorkspaceInitializationPersistence {
    private final JdbcTemplate jdbc;

    public OrganizationGroupWorkspaceInitializationPersistence(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, InitializationState> listInitializationFacts(List<String> groupWorkspaceKeys) {
        String[] keys = groupWorkspaceKeys.stream()
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .toArray(String[]::new);
        if (keys.length == 0) return Map.of();
        return jdbc.query(
                OrganizationGroupWorkspaceInitializationTaskReadServiceSql
                                .ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP
                        + OrganizationGroupWorkspaceInitializationTaskReadServiceSql
                                .ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_TEXT,
                statement -> statement.setObject(1, keys),
                result -> {
                    Map<String, InitializationState> values = new LinkedHashMap<>();
                    while (result.next()) {
                        String key = result.getString("group_workspace_key");
                        values.put(key, new InitializationState(key, true));
                    }
                    return Map.copyOf(values);
                });
    }

    public Optional<CommercialGroupReadback> initializationFact(String groupWorkspaceKey) {
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank()) return Optional.empty();
        return jdbc.query(
                OrganizationGroupWorkspaceInitializationTaskReadServiceSql
                                .ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_SELECT_COMMERCIAL_GROUP_UUID
                        + OrganizationGroupWorkspaceInitializationTaskReadServiceSql
                                .ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_AUDIT_COLUMNS_PREFIX
                        + OrganizationGroupWorkspaceInitializationTaskReadServiceSql
                                .ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_COMMERCIAL_GROUP
                        + OrganizationGroupWorkspaceInitializationTaskReadServiceSql
                                .ORGANIZATION_GROUP_WORKSPACE_INITIALIZATION_TASK_READ_SERVICE_GROUP_WORKSPACE_KEY,
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> {
                    if (!result.next()) return Optional.empty();
                    return Optional.of(new CommercialGroupReadback(
                            result.getObject("commercial_group_uuid", UUID.class),
                            groupWorkspaceKey,
                            result.getString("commercial_group_code"),
                            result.getString("commercial_group_name"),
                            result.getLong("version"),
                            result.getString("created_by_platform_subject"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            ExtensionDefinitionService.readValues(result.getString("extension_values")),
                            result.getLong("extension_rule_revision")));
                });
    }
}
