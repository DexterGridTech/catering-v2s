package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.organization.api.OrganizationProblem;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.Objects;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationCommandService implements InitializeCommercialGroupCommand, CommercialGroupLookup {
    private final JdbcTemplate jdbcTemplate;
    private final WorkspaceStatusLookup workspaces;
    private final TimeProvider time;

    public OrganizationCommandService(JdbcTemplate jdbcTemplate, WorkspaceStatusLookup workspaces, TimeProvider time) {
        this.jdbcTemplate = jdbcTemplate;
        this.workspaces = workspaces;
        this.time = time;
    }

    @Override
    @Transactional
    public CommercialGroupReadback execute(
        PlatformExecutionContext context,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        long groupWorkspaceId,
        String idempotencyKey,
        String commercialGroupCode,
        String commercialGroupName,
        AuditActor actor
    ) {
        if (!"platform-admin".equals(context.consumerFace())) {
            throw new OrganizationCommandException(OrganizationProblem.VALIDATION_FAILED, "consumer face is not allowed");
        }
        String code = normalize(commercialGroupCode, 64);
        String name = normalize(commercialGroupName, 120);
        String requestFingerprint = fingerprint(groupWorkspaceKey, code, name);
        IdempotencyRow existing = jdbcTemplate.query(
            "SELECT group_workspace_key, request_fingerprint, commercial_group_id, commercial_group_code, commercial_group_name FROM organization.commercial_group_idempotency WHERE workspace_uuid = ? AND idempotency_key = ?",
            (resultSet, rowNum) -> new IdempotencyRow(
                resultSet.getString("group_workspace_key"),
                resultSet.getString("request_fingerprint"),
                resultSet.getObject("commercial_group_id", Long.class),
                resultSet.getString("commercial_group_code"),
                resultSet.getString("commercial_group_name")
            ),
            workspaceUuid,
            idempotencyKey
        ).stream().findFirst().orElse(null);
        if (existing != null) {
            if (!existing.groupWorkspaceKey().equals(groupWorkspaceKey) || !existing.requestFingerprint().equals(requestFingerprint)) {
                throw new OrganizationCommandException(OrganizationProblem.IDEMPOTENCY_CONFLICT, "idempotency key was reused for another request");
            }
            if (existing.commercialGroupId() != null) {
                return readback(existing.commercialGroupId(), groupWorkspaceKey, existing.commercialGroupCode(), existing.commercialGroupName(), actor.displaySnapshot());
            }
        } else {
            jdbcTemplate.update(
                "INSERT INTO organization.commercial_group_idempotency (workspace_uuid, idempotency_key, group_workspace_key, request_fingerprint) VALUES (?, ?, ?, ?)",
                workspaceUuid,
                idempotencyKey,
                groupWorkspaceKey,
                requestFingerprint
            );
        }
        try {
            UUID commercialGroupUuid = UUID.randomUUID();
            long createdAtEpochMillis = time.currentEpochMillis();
            long id = jdbcTemplate.queryForObject(
                """
                INSERT INTO organization.commercial_group
                    (group_workspace_key, group_workspace_id, commercial_group_code, commercial_group_name, created_by_platform_subject, commercial_group_uuid, created_at_epoch_millis)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                groupWorkspaceKey,
                groupWorkspaceId,
                code,
                name,
                actor.displaySnapshot(),
                commercialGroupUuid,
                createdAtEpochMillis
            );
            jdbcTemplate.update(
                "UPDATE organization.commercial_group_idempotency SET commercial_group_id = ?, commercial_group_code = ?, commercial_group_name = ? WHERE workspace_uuid = ? AND idempotency_key = ?",
                id,
                code,
                name,
                workspaceUuid,
                idempotencyKey
            );
            jdbcTemplate.update(
                "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'GROUP_WORKSPACE', ?, ?, ?, ?, 'COMMERCIAL_GROUP_INITIALIZED', ?, CAST(? AS JSONB))",
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                String.valueOf(groupWorkspaceId),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                time.currentEpochMillis(),
                "[{\"fieldKey\":\"commercialGroupCode\",\"after\":\"" + json(code) + "\"},{\"fieldKey\":\"commercialGroupName\",\"after\":\"" + json(name) + "\"}]"
            );
            return readback(id, groupWorkspaceKey, code, name, actor.displaySnapshot());
        } catch (DuplicateKeyException exception) {
            throw new OrganizationCommandException(OrganizationProblem.COMMERCIAL_GROUP_ALREADY_INITIALIZED, "commercial group already exists");
        }
    }

    /** Task read for the hierarchy snapshot; commercial-group ownership remains in this module. */
    @Transactional(readOnly = true)
    public CommercialGroupReadback requireCommercialGroup(String groupWorkspaceKey) {
        return jdbcTemplate.query(
            "SELECT commercial_group_uuid, commercial_group_code, commercial_group_name, version, created_by_platform_subject, created_at_epoch_millis FROM organization.commercial_group WHERE group_workspace_key=?",
            statement -> statement.setString(1, groupWorkspaceKey),
            result -> {
                if (!result.next()) throw new OrganizationCommandException(OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED, "commercial group is required before organization hierarchy work");
                long createdAt = result.getLong("created_at_epoch_millis");
                return new CommercialGroupReadback(result.getObject("commercial_group_uuid", UUID.class), groupWorkspaceKey, result.getString("commercial_group_code"), result.getString("commercial_group_name"), result.getLong("version"), result.getString("created_by_platform_subject"), createdAt, createdAt);
            }
        );
    }

    @Override
    @Transactional(readOnly = true)
    public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) {
        requireEnabledWorkspace(workspaceUuid, groupWorkspaceKey);
        return jdbcTemplate.query(
            "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?",
            statement -> {
                statement.setString(1, groupWorkspaceKey);
            },
            result -> {
                if (!result.next()) {
                    throw new OrganizationCommandException(OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED, "commercial group is unavailable");
                }
                return result.getObject(1, UUID.class);
            }
        );
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterableCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
        if (!workspaces.isEnabled(workspaceUuid, groupWorkspaceKey)) return false;
        Boolean found = jdbcTemplate.query(
            "SELECT EXISTS(SELECT 1 FROM organization.commercial_group WHERE commercial_group_uuid=? AND group_workspace_key=?)",
            statement -> {
                statement.setObject(1, commercialGroupRef);
                statement.setString(2, groupWorkspaceKey);
            },
            result -> result.next() && result.getBoolean(1)
        );
        return Boolean.TRUE.equals(found);
    }

    @Override
    @Transactional(readOnly = true)
    public String describeCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
        requireEnabledWorkspace(workspaceUuid, groupWorkspaceKey);
        return jdbcTemplate.query(
            "SELECT commercial_group_code, commercial_group_name FROM organization.commercial_group WHERE commercial_group_uuid=? AND group_workspace_key=?",
            statement -> {
                statement.setObject(1, commercialGroupRef);
                statement.setString(2, groupWorkspaceKey);
            },
            result -> {
                if (!result.next()) {
                    throw new OrganizationCommandException(OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED, "commercial group is unavailable");
                }
                return result.getString(1) + " " + result.getString(2);
            }
        );
    }

    private void requireEnabledWorkspace(UUID workspaceUuid, String groupWorkspaceKey) {
        if (!workspaces.isEnabled(workspaceUuid, groupWorkspaceKey)) {
            throw new OrganizationCommandException(OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED, "commercial group is unavailable");
        }
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private CommercialGroupReadback readback(long id, String groupWorkspaceKey, String code, String name, String subject) {
        return jdbcTemplate.query(
            "SELECT commercial_group_uuid, version, created_at_epoch_millis FROM organization.commercial_group WHERE id=?",
            statement -> statement.setLong(1, id),
            result -> {
                if (!result.next()) throw new OrganizationCommandException(OrganizationProblem.VALIDATION_FAILED, "commercial group readback unavailable");
                long createdAt = result.getLong("created_at_epoch_millis");
                return new CommercialGroupReadback(result.getObject("commercial_group_uuid", UUID.class), groupWorkspaceKey, code, name, result.getLong("version"), subject, createdAt, createdAt);
            }
        );
    }


    private static String fingerprint(String groupWorkspaceKey, String code, String name) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest((groupWorkspaceKey + "\u0000initialize-commercial-group\u0000" + code + "\u0000" + name)
                    .getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte value : digest) result.append(String.format("%02x", value));
            return result.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("fingerprint unavailable", exception);
        }
    }

    private record IdempotencyRow(String groupWorkspaceKey, String requestFingerprint, Long commercialGroupId, String commercialGroupCode, String commercialGroupName) {
    }

    private static String normalize(String value, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new OrganizationCommandException(OrganizationProblem.VALIDATION_FAILED, "commercial group input is invalid");
        }
        return normalized;
    }

    public static final class OrganizationCommandException extends RuntimeException {
        private final OrganizationProblem problem;

        public OrganizationCommandException(OrganizationProblem problem, String message) {
            super(message);
            this.problem = problem;
        }

        public OrganizationProblem problem() {
            return problem;
        }
    }
}
