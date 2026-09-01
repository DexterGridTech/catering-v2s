package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.InitializeCommercialGroupCommand;
import com.catering.v2s.organization.api.OperationsCommercialGroupCommandApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationProblem;
import com.catering.v2s.organization.api.UpdateCommercialGroupCommand;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiPredicate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationCommandService
        implements InitializeCommercialGroupCommand,
                UpdateCommercialGroupCommand,
                CommercialGroupLookup,
                OperationsCommercialGroupCommandApi {
    private final JdbcTemplate jdbcTemplate;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final CommercialGroupCommandReceiptService receipts;

    public OrganizationCommandService(JdbcTemplate jdbcTemplate, Object workspaces, TimeProvider time) {
        this(jdbcTemplate, time, null, new CommercialGroupCommandReceiptService(jdbcTemplate, time));
    }

    /** Compatibility constructor for owner tests that inject a workspace-presence predicate. */
    public OrganizationCommandService(
            JdbcTemplate jdbcTemplate, BiPredicate<UUID, String> workspaces, TimeProvider time) {
        this(jdbcTemplate, time, null, new CommercialGroupCommandReceiptService(jdbcTemplate, time));
    }

    public OrganizationCommandService(
            JdbcTemplate jdbcTemplate, Object workspaces, TimeProvider time, ExtensionDefinitionLookup definitions) {
        this(jdbcTemplate, time, definitions, new CommercialGroupCommandReceiptService(jdbcTemplate, time));
    }

    /** Compatibility constructor for owner tests that inject a workspace-presence predicate. */
    public OrganizationCommandService(
            JdbcTemplate jdbcTemplate,
            BiPredicate<UUID, String> workspaces,
            TimeProvider time,
            ExtensionDefinitionLookup definitions) {
        this(jdbcTemplate, time, definitions, new CommercialGroupCommandReceiptService(jdbcTemplate, time));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OrganizationCommandService(
            JdbcTemplate jdbcTemplate,
            TimeProvider time,
            ExtensionDefinitionLookup definitions,
            CommercialGroupCommandReceiptService receipts) {
        this.jdbcTemplate = jdbcTemplate;
        this.time = time;
        this.definitions = definitions;
        this.receipts = receipts;
    }

    @Override
    @Transactional
    public CommercialGroupReadback update(OperationsCommercialGroupCommandApi.UpdateCommand command) {
        CommercialGroupReadback current = requireCommercialGroup(command.groupWorkspaceKey());
        if (!command.ownerScopeGrant()
                .matches(command.workspaceUuid(), command.groupWorkspaceKey(), ServiceNodeTypes.GROUP, current.id())) {
            throw new OrganizationCommandException(
                    OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED,
                    "commercial group authorization target does not match");
        }
        String code = normalize(command.commercialGroupCode(), 64);
        String name = normalize(command.commercialGroupName(), 120);
        String canonical = "update-commercial-group\\u0000" + command.groupWorkspaceKey() + "\\u0000" + code + "\\u0000"
                + name + "\\u0000" + command.expectedVersion() + "\\u0000"
                + extensionCanonical(command.extensionSubmission());
        return receipts.execute(
                command.workspaceUuid(),
                command.idempotencyKey(),
                canonical,
                () -> updateOnce(
                        command.workspaceUuid(),
                        command.groupWorkspaceKey(),
                        code,
                        name,
                        command.expectedVersion(),
                        command.extensionSubmission(),
                        command.actor(),
                        current));
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
            AuditActor actor) {
        return initialize(
                context,
                workspaceUuid,
                groupWorkspaceKey,
                groupWorkspaceId,
                idempotencyKey,
                commercialGroupCode,
                commercialGroupName,
                Map.of(),
                actor);
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
            Map<String, String> extensionValues,
            AuditActor actor) {
        return initialize(
                context,
                workspaceUuid,
                groupWorkspaceKey,
                groupWorkspaceId,
                idempotencyKey,
                commercialGroupCode,
                commercialGroupName,
                extensionValues,
                actor);
    }

    private CommercialGroupReadback initialize(
            PlatformExecutionContext context,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            long groupWorkspaceId,
            String idempotencyKey,
            String commercialGroupCode,
            String commercialGroupName,
            Map<String, String> extensionValues,
            AuditActor actor) {
        if (!"platform-admin".equals(context.consumerFace())) {
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "consumer face is not allowed");
        }
        String code = normalize(commercialGroupCode, 64);
        String name = normalize(commercialGroupName, 120);
        ExtensionValues extensions = extensionValues(workspaceUuid, groupWorkspaceKey, "{}", extensionValues);
        String requestFingerprint = fingerprint(groupWorkspaceKey, code, name, extensionValues);
        IdempotencyRow existing = jdbcTemplate
                .query(
                        "SELECT group_workspace_key, request_fingerprint, commercial_group_id, commercial_group_code, "
                                + "commercial_group_name FROM organization.commercial_group_idempotency WHERE "
                                + "workspace_uuid = ? AND idempotency_key = ?",
                        (resultSet, rowNum) -> new IdempotencyRow(
                                resultSet.getString("group_workspace_key"),
                                resultSet.getString("request_fingerprint"),
                                resultSet.getObject("commercial_group_id", Long.class),
                                resultSet.getString("commercial_group_code"),
                                resultSet.getString("commercial_group_name")),
                        workspaceUuid,
                        idempotencyKey)
                .stream()
                .findFirst()
                .orElse(null);
        if (existing != null) {
            if (!existing.groupWorkspaceKey().equals(groupWorkspaceKey)
                    || !existing.requestFingerprint().equals(requestFingerprint)) {
                throw new OrganizationCommandException(
                        OrganizationProblem.IDEMPOTENCY_CONFLICT, "idempotency key was reused for another request");
            }
            if (existing.commercialGroupId() != null) {
                return readback(
                        existing.commercialGroupId(),
                        groupWorkspaceKey,
                        existing.commercialGroupCode(),
                        existing.commercialGroupName(),
                        actor.displaySnapshot());
            }
        } else {
            jdbcTemplate.update(
                    "INSERT INTO organization.commercial_group_idempotency (workspace_uuid, idempotency_key, "
                            + "group_workspace_key, request_fingerprint) VALUES (?, ?, ?, ?)",
                    workspaceUuid,
                    idempotencyKey,
                    groupWorkspaceKey,
                    requestFingerprint);
        }
        try (var ignored = OwnerOperationDiagnostics.beginCommand()) {
            UUID commercialGroupUuid = UUID.randomUUID();
            long createdAtEpochMillis = time.currentEpochMillis();
            long id = jdbcTemplate.queryForObject(
                    """
                INSERT INTO organization.commercial_group
                    (group_workspace_key, group_workspace_id, commercial_group_code, commercial_group_name, \
                    created_by_platform_subject, commercial_group_uuid, created_at_epoch_millis, \
                    updated_at_epoch_millis, extension_values, extension_rule_revision)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), ?)
                RETURNING id
                """,
                    Long.class,
                    groupWorkspaceKey,
                    groupWorkspaceId,
                    code,
                    name,
                    actor.displaySnapshot(),
                    commercialGroupUuid,
                    createdAtEpochMillis,
                    createdAtEpochMillis,
                    extensions.json(),
                    extensions.revision());
            jdbcTemplate.update(
                    "UPDATE organization.commercial_group_idempotency SET commercial_group_id = ?, "
                            + "commercial_group_code = ?, commercial_group_name = ? WHERE workspace_uuid = ? AND "
                            + "idempotency_key = ?",
                    id,
                    code,
                    name,
                    workspaceUuid,
                    idempotencyKey);
            jdbcTemplate.update(
                    "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
                            + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                            + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'GROUP_WORKSPACE', ?, ?, ?, ?, "
                            + "'COMMERCIAL_GROUP_INITIALIZED', ?, CAST(? AS JSONB))",
                    UUID.randomUUID(),
                    workspaceUuid,
                    groupWorkspaceKey,
                    String.valueOf(groupWorkspaceId),
                    actor.actorType(),
                    actor.actorId(),
                    actor.displaySnapshot(),
                    time.currentEpochMillis(),
                    AuditChangeJson.write(java.util.List.of(
                            new com.catering.v2s.audit.contract.AuditChange("commercialGroupCode", null, code),
                            new com.catering.v2s.audit.contract.AuditChange("commercialGroupName", null, name))));
            return OwnerOperationDiagnostics.readback(
                    () -> readback(id, groupWorkspaceKey, code, name, actor.displaySnapshot()));
        } catch (DuplicateKeyException exception) {
            throw new OrganizationCommandException(
                    OrganizationProblem.COMMERCIAL_GROUP_ALREADY_INITIALIZED,
                    "commercial group already exists",
                    exception);
        }
    }

    @Override
    @Transactional
    public CommercialGroupReadback execute(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String idempotencyKey,
            String commercialGroupCode,
            String commercialGroupName,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor) {
        return execute(
                workspaceUuid,
                groupWorkspaceKey,
                idempotencyKey,
                commercialGroupCode,
                commercialGroupName,
                expectedVersion,
                extensionValues,
                actor,
                null);
    }

    /** Operations command path: the owner binds the server-resolved group grant to its first query. */
    @Transactional
    public CommercialGroupReadback execute(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String idempotencyKey,
            String commercialGroupCode,
            String commercialGroupName,
            long expectedVersion,
            Map<String, String> extensionValues,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        // Receipt replay remains after a fresh owner fact and grant-target recheck.
        CommercialGroupReadback current = requireCommercialGroup(groupWorkspaceKey);
        if (ownerScopeGrant != null
                && !ownerScopeGrant.matches(workspaceUuid, groupWorkspaceKey, ServiceNodeTypes.GROUP, current.id())) {
            throw new OrganizationCommandException(
                    OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED,
                    "commercial group authorization target does not match");
        }
        String code = normalize(commercialGroupCode, 64);
        String name = normalize(commercialGroupName, 120);
        Map<String, String> requested = extensionValues == null ? Map.of() : extensionValues;
        String canonical = "update-commercial-group\u0000" + groupWorkspaceKey + "\u0000" + code + "\u0000" + name
                + "\u0000" + expectedVersion + "\u0000"
                + requested.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(entry -> entry.getKey() + "=" + entry.getValue())
                        .collect(java.util.stream.Collectors.joining("\u001f"));
        return receipts.execute(
                workspaceUuid,
                idempotencyKey,
                canonical,
                () -> updateOnce(
                        workspaceUuid, groupWorkspaceKey, code, name, expectedVersion, requested, actor, current));
    }

    /** Immutable owner pre-state is shared by grant validation, CAS/audit and this write. */
    private CommercialGroupReadback updateOnce(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            long expectedVersion,
            Map<String, String> requested,
            AuditActor actor,
            CommercialGroupReadback current) {
        ExtensionValues extensions =
                extensionValues(workspaceUuid, groupWorkspaceKey, valuesJson(current.extensionValues()), requested);
        return updateOnce(workspaceUuid, groupWorkspaceKey, code, name, expectedVersion, extensions, actor, current);
    }

    private CommercialGroupReadback updateOnce(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            long expectedVersion,
            ExtensionSubmission submission,
            AuditActor actor,
            CommercialGroupReadback current) {
        ExtensionValues extensions =
                extensionValues(workspaceUuid, groupWorkspaceKey, valuesJson(current.extensionValues()), submission);
        return updateOnce(workspaceUuid, groupWorkspaceKey, code, name, expectedVersion, extensions, actor, current);
    }

    /** The owner write returns the complete row so its authoritative readback does not reread the group. */
    private CommercialGroupReadback updateOnce(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String code,
            String name,
            long expectedVersion,
            ExtensionValues extensions,
            AuditActor actor,
            CommercialGroupReadback current) {
        long now = time.currentEpochMillis();
        if (current.revision() != expectedVersion) {
            throw new OrganizationHierarchyService.OrganizationConflictException();
        }
        CommercialGroupReadback updated = OwnerOperationDiagnostics.readback(() -> jdbcTemplate.query(
                "UPDATE organization.commercial_group SET commercial_group_code=?, "
                        + "commercial_group_name=?, extension_values=CAST(? AS JSONB), "
                        + "extension_rule_revision=?, version=version+1, updated_at_epoch_millis=? WHERE "
                        + "commercial_group_uuid=? AND group_workspace_key=? AND version=? RETURNING "
                        + "commercial_group_uuid, group_workspace_key, commercial_group_code, commercial_group_name, "
                        + "version, created_by_platform_subject, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text, extension_rule_revision",
                statement -> {
                    statement.setString(1, code);
                    statement.setString(2, name);
                    statement.setString(3, extensions.json());
                    statement.setLong(4, extensions.revision());
                    statement.setLong(5, now);
                    statement.setObject(6, current.id());
                    statement.setString(7, groupWorkspaceKey);
                    statement.setLong(8, expectedVersion);
                },
                result -> {
                    if (!result.next()) throw new OrganizationHierarchyService.OrganizationConflictException();
                    return new CommercialGroupReadback(
                            result.getObject("commercial_group_uuid", UUID.class),
                            result.getString("group_workspace_key"),
                            result.getString("commercial_group_code"),
                            result.getString("commercial_group_name"),
                            result.getLong("version"),
                            result.getString("created_by_platform_subject"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            ExtensionDefinitionService.readValues(result.getString("extension_values")),
                            result.getLong("extension_rule_revision"));
                }));
        jdbcTemplate.update(
                "INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, "
                        + "entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, "
                        + "occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'COMMERCIAL_GROUP', ?, ?, ?, ?, "
                        + "'COMMERCIAL_GROUP_UPDATED', ?, CAST(? AS JSONB))",
                UUID.randomUUID(),
                workspaceUuid,
                groupWorkspaceKey,
                updated.id().toString(),
                actor.actorType(),
                actor.actorId(),
                actor.displaySnapshot(),
                now,
                AuditChangeJson.write(java.util.List.of(
                        new com.catering.v2s.audit.contract.AuditChange(
                                "commercialGroupCode", current.commercialGroupCode(), updated.commercialGroupCode()),
                        new com.catering.v2s.audit.contract.AuditChange(
                                "commercialGroupName", current.commercialGroupName(), updated.commercialGroupName()))));
        return updated;
    }

    /** Task read for the hierarchy snapshot; commercial-group ownership remains in this module. */
    @Transactional(readOnly = true)
    public CommercialGroupReadback requireCommercialGroup(String groupWorkspaceKey) {
        return jdbcTemplate.query(
                "SELECT commercial_group_uuid, commercial_group_code, commercial_group_name, version, "
                        + "created_by_platform_subject, created_at_epoch_millis, updated_at_epoch_millis, "
                        + "extension_values::text, extension_rule_revision FROM organization.commercial_group WHERE "
                        + "group_workspace_key=?",
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> {
                    if (!result.next())
                        throw new OrganizationCommandException(
                                OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED,
                                "commercial group is required before organization hierarchy work");
                    return new CommercialGroupReadback(
                            result.getObject("commercial_group_uuid", UUID.class),
                            groupWorkspaceKey,
                            result.getString("commercial_group_code"),
                            result.getString("commercial_group_name"),
                            result.getLong("version"),
                            result.getString("created_by_platform_subject"),
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            ExtensionDefinitionService.readValues(result.getString("extension_values")),
                            result.getLong("extension_rule_revision"));
                });
    }

    @Override
    @Transactional(readOnly = true)
    public UUID requireCommercialGroupRef(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbcTemplate.query(
                "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?",
                statement -> {
                    statement.setString(1, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) {
                        throw new OrganizationCommandException(
                                OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED,
                                "commercial group is unavailable");
                    }
                    return result.getObject(1, UUID.class);
                });
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterableCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
        // Post-auth callers establish workspace-session eligibility before this owner fact check.
        // This method intentionally checks commercial-group enterability only.
        Boolean found = jdbcTemplate.query(
                "SELECT EXISTS(SELECT 1 FROM organization.commercial_group WHERE commercial_group_uuid=? AND "
                        + "group_workspace_key=?)",
                statement -> {
                    statement.setObject(1, commercialGroupRef);
                    statement.setString(2, groupWorkspaceKey);
                },
                result -> result.next() && result.getBoolean(1));
        return Boolean.TRUE.equals(found);
    }

    @Override
    @Transactional(readOnly = true)
    public String describeCommercialGroup(UUID workspaceUuid, String groupWorkspaceKey, UUID commercialGroupRef) {
        return jdbcTemplate.query(
                "SELECT commercial_group_code, commercial_group_name FROM organization.commercial_group WHERE "
                        + "commercial_group_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, commercialGroupRef);
                    statement.setString(2, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) {
                        throw new OrganizationCommandException(
                                OrganizationProblem.COMMERCIAL_GROUP_NOT_INITIALIZED,
                                "commercial group is unavailable");
                    }
                    return nameCode(result.getString(2), result.getString(1));
                });
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private static String nameCode(String name, String code) {
        return name + "（" + code + "）";
    }

    private CommercialGroupReadback readback(
            long id, String groupWorkspaceKey, String code, String name, String subject) {
        return jdbcTemplate.query(
                "SELECT commercial_group_uuid, version, created_at_epoch_millis, updated_at_epoch_millis, "
                        + "extension_values::text, extension_rule_revision FROM organization.commercial_group WHERE "
                        + "id=?",
                statement -> statement.setLong(1, id),
                result -> {
                    if (!result.next())
                        throw new OrganizationCommandException(
                                OrganizationProblem.VALIDATION_FAILED, "commercial group readback unavailable");
                    return new CommercialGroupReadback(
                            result.getObject("commercial_group_uuid", UUID.class),
                            groupWorkspaceKey,
                            code,
                            name,
                            result.getLong("version"),
                            subject,
                            result.getLong("created_at_epoch_millis"),
                            result.getLong("updated_at_epoch_millis"),
                            ExtensionDefinitionService.readValues(result.getString("extension_values")),
                            result.getLong("extension_rule_revision"));
                });
    }

    private ExtensionValues extensionValues(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String currentValuesJson,
            Map<String, String> requestedValues) {
        Map<String, String> requested = requestedValues == null ? Map.of() : requestedValues;
        if (definitions == null) {
            if (requested.isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "extension definition lookup is unavailable");
        }
        try {
            ExtensionDefinitionReadback definition = definitions.requireDefinition(
                    workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.COMMERCIAL_GROUP);
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, currentValuesJson, requested),
                    definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (requested.isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "commercial group extension values are invalid", absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "commercial group extension values are invalid", invalid);
        }
    }

    private ExtensionValues extensionValues(
            UUID workspaceUuid, String groupWorkspaceKey, String currentValuesJson, ExtensionSubmission submission) {
        ExtensionSubmission requested = submission == null ? new ExtensionSubmission(List.of()) : submission;
        if (definitions == null) {
            if (requested.fields().isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "extension definition lookup is unavailable");
        }
        try {
            ExtensionDefinitionReadback definition = definitions.requireDefinition(
                    workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.COMMERCIAL_GROUP);
            return new ExtensionValues(
                    ExtensionDefinitionService.mergeValues(definition, currentValuesJson, requested),
                    definition.version());
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (requested.fields().isEmpty()) return new ExtensionValues(currentValuesJson, 0L);
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "commercial group extension values are invalid", absent);
        } catch (ExtensionDefinitionService.DefinitionInvalidException invalid) {
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "commercial group extension values are invalid", invalid);
        }
    }

    private static String valuesJson(Map<String, String> values) {
        return "{"
                + values.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(entry -> "\"" + json(entry.getKey()) + "\":" + entry.getValue())
                        .collect(java.util.stream.Collectors.joining(","))
                + "}";
    }

    private static String extensionCanonical(ExtensionSubmission submission) {
        return submission.fields().stream()
                .sorted(java.util.Comparator.comparing(ExtensionSubmission.ExtensionFieldValue::fieldKey))
                .map(value -> value.fieldKey() + "=" + value.mode() + "=" + value.valueJson())
                .collect(java.util.stream.Collectors.joining("\\u001f"));
    }

    private static String fingerprint(
            String groupWorkspaceKey, String code, String name, Map<String, String> extensionValues) {
        try {
            String extensions = extensionValues == null
                    ? ""
                    : extensionValues.entrySet().stream()
                            .sorted(Map.Entry.comparingByKey())
                            .map(entry -> entry.getKey() + "=" + entry.getValue())
                            .collect(java.util.stream.Collectors.joining("\u001f"));
            return Sha256Hex.digest(groupWorkspaceKey + "\u0000initialize-commercial-group\u0000" + code + "\u0000"
                    + name + (extensions.isEmpty() ? "" : "\u0000" + extensions));
        } catch (Exception exception) {
            throw new IllegalStateException("fingerprint unavailable", exception);
        }
    }

    private record IdempotencyRow(
            String groupWorkspaceKey,
            String requestFingerprint,
            Long commercialGroupId,
            String commercialGroupCode,
            String commercialGroupName) {}

    private record ExtensionValues(String json, long revision) {}

    private static String normalize(String value, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "").trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new OrganizationCommandException(
                    OrganizationProblem.VALIDATION_FAILED, "commercial group input is invalid");
        }
        return normalized;
    }

    public static final class OrganizationCommandException extends RuntimeException {
        private final OrganizationProblem problem;

        public OrganizationCommandException(OrganizationProblem problem, String message) {
            super(message);
            this.problem = problem;
        }

        public OrganizationCommandException(OrganizationProblem problem, String message, Throwable cause) {
            super(message, cause);
            this.problem = problem;
        }

        public OrganizationProblem problem() {
            return problem;
        }
    }
}
