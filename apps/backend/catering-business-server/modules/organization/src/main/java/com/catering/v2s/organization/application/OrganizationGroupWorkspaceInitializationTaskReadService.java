package com.catering.v2s.organization.application;

import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Bounded organization-only initialization facts; never reads platform_workspace. */
@Service
public final class OrganizationGroupWorkspaceInitializationTaskReadService implements OrganizationGroupWorkspaceInitializationLookup {
    private final JdbcTemplate jdbc;

    public OrganizationGroupWorkspaceInitializationTaskReadService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    @Transactional(readOnly = true)
    public Map<String, InitializationState> listInitializationFacts(List<String> groupWorkspaceKeys) {
        if (groupWorkspaceKeys == null || groupWorkspaceKeys.isEmpty()) return Map.of();
        String[] keys = groupWorkspaceKeys.stream().filter(value -> value != null && !value.isBlank()).distinct().toArray(String[]::new);
        if (keys.length == 0) return Map.of();
        return jdbc.query("SELECT group_workspace_key FROM organization.commercial_group WHERE group_workspace_key = ANY(?::text[])", statement -> statement.setObject(1, keys), result -> {
            Map<String, InitializationState> values = new LinkedHashMap<>();
            while (result.next()) {
                String key = result.getString("group_workspace_key");
                values.put(key, new InitializationState(key, true));
            }
            return Map.copyOf(values);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CommercialGroupReadback> initializationFact(String groupWorkspaceKey) {
        if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank()) return Optional.empty();
        return jdbc.query("SELECT commercial_group_uuid, commercial_group_code, commercial_group_name, version, created_by_platform_subject, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, extension_rule_revision FROM organization.commercial_group WHERE group_workspace_key=?", statement -> statement.setString(1, groupWorkspaceKey), result -> {
            if (!result.next()) return Optional.empty();
            return Optional.of(new CommercialGroupReadback(result.getObject("commercial_group_uuid", UUID.class), groupWorkspaceKey, result.getString("commercial_group_code"), result.getString("commercial_group_name"), result.getLong("version"), result.getString("created_by_platform_subject"), result.getLong("created_at_epoch_millis"), result.getLong("updated_at_epoch_millis"), ExtensionDefinitionService.readValues(result.getString("extension_values")), result.getLong("extension_rule_revision")));
        });
    }
}
