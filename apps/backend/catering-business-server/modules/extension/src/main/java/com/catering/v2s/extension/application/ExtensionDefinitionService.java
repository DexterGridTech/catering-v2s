package com.catering.v2s.extension.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangeJson;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.api.ExtensionHostTypes;
import com.catering.v2s.extension.api.ExtensionSubmission;
import com.catering.v2s.extension.api.ExtensionValueSemantics;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence.DefinitionRow;
import com.catering.v2s.extension.application.persistence.ExtensionDefinitionPersistence.PreStateRow;
import com.catering.v2s.platform.foundation.persistence.ReadBudgetComponent;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import com.catering.v2s.platform.iam.api.PlatformGovernanceAuthorization;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExtensionDefinitionService implements ExtensionDefinitionLookup {
    private static final List<String> MANAGEMENT_HOST_TYPES = List.of(
            ExtensionHostTypes.BRAND,
            ExtensionHostTypes.TENANT,
            ExtensionHostTypes.HEAD_COMPANY,
            ExtensionHostTypes.STORE,
            ExtensionHostTypes.CONTRACT,
            ExtensionHostTypes.COMMERCIAL_GROUP,
            ExtensionHostTypes.REGION,
            ExtensionHostTypes.PROJECT,
            ExtensionHostTypes.SERVICE_POINT);
    private static final Set<String> HOST_TYPES = Set.copyOf(MANAGEMENT_HOST_TYPES);
    private static final Set<String> AUDIT_FIELDS = Set.of("fieldDefinitions", "revision");
    private static final ObjectMapper JSON = new ObjectMapper();
    private final ExtensionDefinitionPersistence persistence;
    private final ExtensionCommandReceiptService receipts;
    private final PlatformGovernanceAuthorization platformAuthorization;
    private final WorkspaceStatusLookup workspaceStatuses;

    @Autowired
    public ExtensionDefinitionService(
            ExtensionDefinitionPersistence persistence,
            ExtensionCommandReceiptService receipts,
            PlatformGovernanceAuthorization platformAuthorization,
            WorkspaceStatusLookup workspaceStatuses) {
        this.persistence = persistence;
        this.receipts = receipts;
        this.platformAuthorization = platformAuthorization;
        this.workspaceStatuses = Objects.requireNonNull(workspaceStatuses, "workspaceStatuses");
    }

    /** Internal owner readers do not have platform-admin authorization and must not expose draft commands. */
    public ExtensionDefinitionService(
            ExtensionDefinitionPersistence persistence,
            ExtensionCommandReceiptService receipts,
            WorkspaceStatusLookup workspaceStatuses) {
        this(
                persistence,
                receipts,
                actor -> {
                    throw new IllegalStateException("platform authorization is required");
                },
                workspaceStatuses);
    }

    @Override
    @Transactional(readOnly = true, noRollbackFor = DefinitionNotFoundException.class)
    public ExtensionDefinitionReadback requireDefinition(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        validateHost(hostType);
        return requireDefinition(
                workspaceUuid, groupWorkspaceKey, hostType, workspaceStatus(workspaceUuid, groupWorkspaceKey));
    }

    private ExtensionDefinitionReadback requireDefinition(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType, String workspaceStatus) {
        DefinitionRow row = persistence.findDefinition(workspaceUuid, groupWorkspaceKey, hostType);
        if (row == null) throw new DefinitionNotFoundException();
        return readback(groupWorkspaceKey, row, workspaceStatus);
    }

    @Transactional(readOnly = true)
    public List<ExtensionDefinitionReadback> listDefinitions(UUID workspaceUuid, String groupWorkspaceKey) {
        return listDefinitions(workspaceUuid, groupWorkspaceKey, workspaceStatus(workspaceUuid, groupWorkspaceKey));
    }

    private List<ExtensionDefinitionReadback> listDefinitions(
            UUID workspaceUuid, String groupWorkspaceKey, String workspaceStatus) {
        return persistence.findDefinitions(workspaceUuid, groupWorkspaceKey).stream()
                .map(row -> readback(groupWorkspaceKey, row, workspaceStatus))
                .toList();
    }

    private static ExtensionDefinitionReadback readback(
            String groupWorkspaceKey, DefinitionRow row, String workspaceStatus) {
        return new ExtensionDefinitionReadback(
                groupWorkspaceKey,
                row.hostType(),
                row.revision(),
                row.updatedAtEpochMillis(),
                readFields(row.definitionsJson(), row.hostType()),
                workspaceStatus,
                blockers(workspaceStatus));
    }

    /**
     * Platform configuration is available for every supported business object before its first persisted field
     * definition. This management read deliberately differs from the strict lookup used by operations writes: an
     * unconfigured object has revision zero, not an active empty definition.
     */
    @Transactional(readOnly = true)
    public List<ExtensionDefinitionReadback> listManagementDefinitions(UUID workspaceUuid, String groupWorkspaceKey) {
        String workspaceStatus = workspaceStatus(workspaceUuid, groupWorkspaceKey);
        java.util.Map<String, ExtensionDefinitionReadback> configured =
                listDefinitions(workspaceUuid, groupWorkspaceKey, workspaceStatus).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                ExtensionDefinitionReadback::hostType, value -> value));
        return MANAGEMENT_HOST_TYPES.stream()
                .map(hostType ->
                        configured.getOrDefault(hostType, unconfigured(groupWorkspaceKey, hostType, workspaceStatus)))
                .toList();
    }

    /** See {@link #listManagementDefinitions(UUID, String)}; this must not replace strict owner lookup. */
    @Transactional(readOnly = true)
    public ExtensionDefinitionReadback managementDefinition(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        validateHost(hostType);
        String workspaceStatus = workspaceStatus(workspaceUuid, groupWorkspaceKey);
        try {
            return requireDefinition(workspaceUuid, groupWorkspaceKey, hostType, workspaceStatus);
        } catch (DefinitionNotFoundException absent) {
            return unconfigured(groupWorkspaceKey, hostType, workspaceStatus);
        }
    }

    /** Explicit GET-only operations owner boundary; host-type validation remains in this owner. */
    @Transactional(readOnly = true)
    public ExtensionDefinitionReadback operationsManagementDefinition(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> managementDefinition(workspaceUuid, groupWorkspaceKey, hostType));
    }

    /** Platform task-read boundary for the complete management catalog. */
    @Transactional(readOnly = true)
    public List<ExtensionDefinitionReadback> platformManagementDefinitions(
            UUID workspaceUuid, String groupWorkspaceKey) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> listManagementDefinitions(workspaceUuid, groupWorkspaceKey));
    }

    /** Platform task-read boundary for one configured or intentionally unconfigured host type. */
    @Transactional(readOnly = true)
    public ExtensionDefinitionReadback platformManagementDefinition(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> managementDefinition(workspaceUuid, groupWorkspaceKey, hostType));
    }

    /** Named extension-owner half of the platform contract-detail projection. */
    @Transactional(readOnly = true)
    public ExtensionDefinitionReadback platformContractManagementDefinition(
            UUID workspaceUuid, String groupWorkspaceKey) {
        return ReadBudgetComponent.measure(
                ReadBudgetComponent.Component.PRIMARY_QUERY,
                () -> managementDefinition(workspaceUuid, groupWorkspaceKey, ExtensionHostTypes.CONTRACT));
    }

    private String workspaceStatus(UUID workspaceUuid, String groupWorkspaceKey) {
        String status = workspaceStatuses.requireStatus(workspaceUuid, groupWorkspaceKey);
        if (status == null || !Set.of("ENABLED", "DISABLED").contains(status)) throw new DefinitionInvalidException();
        return status;
    }

    private static List<ExtensionDefinitionReadback.Blocker> blockers(String workspaceStatus) {
        return "ENABLED".equals(workspaceStatus)
                ? List.of()
                : List.of(new ExtensionDefinitionReadback.Blocker("WORKSPACE", workspaceStatus));
    }

    private static ExtensionDefinitionReadback unconfigured(
            String groupWorkspaceKey, String hostType, String workspaceStatus) {
        return new ExtensionDefinitionReadback(
                groupWorkspaceKey, hostType, 0, 0, List.of(), workspaceStatus, blockers(workspaceStatus));
    }

    @Transactional
    public ExtensionDefinitionReadback replace(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType, long expectedVersion, List<Field> fields) {
        return replace(workspaceUuid, groupWorkspaceKey, hostType, expectedVersion, fields, AuditActor.system());
    }

    @Transactional
    public ExtensionDefinitionReadback replace(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            long expectedVersion,
            List<Field> fields,
            AuditActor actor) {
        validateHost(hostType);
        List<Field> normalized = normalize(hostType, fields);
        ExtensionDefinitionPreState before =
                loadExtensionDefinitionPreState(workspaceUuid, groupWorkspaceKey, hostType);
        Long existing = before == null ? null : before.revision();
        List<ExtensionDefinitionReadback.Field> beforeFields = before == null ? List.of() : before.fields();
        long nextVersion;
        if (existing == null) {
            if (expectedVersion != 0) throw new DefinitionVersionConflictException();
            nextVersion = 1;
            try {
                persistence.insertDefinition(workspaceUuid, groupWorkspaceKey, hostType, json(normalized));
            } catch (DuplicateKeyException conflict) {
                throw new DefinitionVersionConflictException(conflict);
            }
        } else {
            if (existing != expectedVersion) throw new DefinitionVersionConflictException();
            java.util.Map<String, String> existingTypes = before.fields().stream()
                    .collect(java.util.stream.Collectors.toMap(
                            ExtensionDefinitionReadback.Field::fieldKey, ExtensionDefinitionReadback.Field::fieldType));
            if (normalized.stream()
                    .anyMatch(field -> existingTypes.containsKey(field.fieldKey())
                            && !existingTypes.get(field.fieldKey()).equals(field.fieldType())))
                throw new DefinitionInvalidException();
            nextVersion = expectedVersion + 1;
            int updated = persistence.updateDefinition(
                    workspaceUuid, groupWorkspaceKey, hostType, json(normalized), nextVersion, expectedVersion);
            if (updated != 1) throw new DefinitionVersionConflictException();
        }
        audit(workspaceUuid, groupWorkspaceKey, hostType, existing, nextVersion, beforeFields, normalized, actor);
        return requireDefinition(workspaceUuid, groupWorkspaceKey, hostType);
    }

    /**
     * One immutable pre-write owner fact. It contains exactly the revision and field definitions required for CAS, type
     * preservation and audit; post-write readback remains deliberately fresh.
     */
    private ExtensionDefinitionPreState loadExtensionDefinitionPreState(
            UUID workspaceUuid, String groupWorkspaceKey, String hostType) {
        PreStateRow row = persistence.findPreState(workspaceUuid, groupWorkspaceKey, hostType);
        return row == null
                ? null
                : new ExtensionDefinitionPreState(row.revision(), readFields(row.definitionsJson(), hostType));
    }

    @Transactional
    public ExtensionDefinitionReadback replace(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            long expectedVersion,
            List<Field> fields,
            AuditActor actor,
            String idempotencyKey) {
        validateHost(hostType);
        List<Field> normalized = normalize(hostType, fields);
        return receipts.execute(
                idempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                hostType,
                hostType + "|" + expectedVersion + "|" + json(normalized),
                () -> replace(workspaceUuid, groupWorkspaceKey, hostType, expectedVersion, normalized, actor));
    }
    /**
     * Edge-facing whole-group replacement. Existing keys remain stable hidden owner identities. For a new field with no
     * key, this owner assigns the next deterministic field_n identity; the browser never creates or exposes it.
     */
    @Transactional
    public ExtensionDefinitionReadback replaceDraft(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            long expectedVersion,
            List<DraftField> fields,
            AuditActor actor,
            String idempotencyKey) {
        platformAuthorization.requireEnabledPlatformAdministrator(actor);
        validateHost(hostType);
        if (fields == null || fields.stream().anyMatch(java.util.Objects::isNull))
            throw new DefinitionInvalidException();
        return receipts.execute(
                idempotencyKey,
                workspaceUuid,
                groupWorkspaceKey,
                hostType,
                draftRequest(hostType, expectedVersion, fields),
                () -> {
                    Set<String> assignedKeys = new java.util.LinkedHashSet<>(historicalGeneratedFieldKeys(
                            persistence.findDefinitionHistoryChanges(workspaceUuid, groupWorkspaceKey, hostType)));
                    for (DraftField field : fields) {
                        if (field.fieldKey() != null && !field.fieldKey().isBlank()) assignedKeys.add(field.fieldKey());
                    }
                    int nextGeneratedKey = 1;
                    List<Field> ownerFields = new java.util.ArrayList<>();
                    for (int index = 0; index < fields.size(); index++) {
                        DraftField field = fields.get(index);
                        String key = field.fieldKey();
                        if (key == null || key.isBlank()) {
                            do {
                                key = "field_" + nextGeneratedKey++;
                            } while (!assignedKeys.add(key));
                        }
                        ownerFields.add(new Field(
                                key,
                                field.label(),
                                field.fieldType(),
                                field.listDisplay(),
                                field.searchable(),
                                field.required(),
                                field.options(),
                                field.status(),
                                field.displayOrder(),
                                field.displaySuffix()));
                    }
                    return replace(workspaceUuid, groupWorkspaceKey, hostType, expectedVersion, ownerFields, actor);
                });
    }

    private static Set<String> historicalGeneratedFieldKeys(List<AuditChange> changes) {
        Set<String> keys = new java.util.LinkedHashSet<>();
        for (AuditChange change : changes) {
            if (!"fieldDefinitions".equals(change.fieldKey())) continue;
            reserveGeneratedFieldKeys(change.beforeValue(), keys);
            reserveGeneratedFieldKeys(change.afterValue(), keys);
        }
        return keys;
    }

    private static void reserveGeneratedFieldKeys(String summary, Set<String> keys) {
        if (summary == null || summary.isBlank()) return;
        for (String description : summary.split(";", -1)) {
            int separator = description.indexOf('|');
            if (separator <= 0) continue;
            String key = description.substring(0, separator);
            if (key.matches("field_[0-9]+")) keys.add(key);
        }
    }

    private static String draftRequest(String hostType, long expectedVersion, List<DraftField> fields) {
        StringBuilder value = new StringBuilder();
        requestPart(value, hostType);
        requestPart(value, expectedVersion);
        requestPart(value, fields.size());
        for (DraftField field : fields) {
            requestPart(value, field.fieldKey());
            requestPart(value, field.label());
            requestPart(value, field.fieldType());
            requestPart(value, field.listDisplay());
            requestPart(value, field.searchable());
            requestPart(value, field.required());
            if (field.options() == null) requestPart(value, null);
            else {
                requestPart(value, field.options().size());
                for (String option : field.options()) requestPart(value, option);
            }
            requestPart(value, field.status());
            requestPart(value, field.displayOrder());
            requestPart(value, field.displaySuffix());
        }
        return value.toString();
    }

    private static void requestPart(StringBuilder value, Object part) {
        if (part == null) {
            value.append("-1:");
            return;
        }
        String text = String.valueOf(part);
        value.append(text.length()).append(':').append(text);
    }

    private void audit(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String hostType,
            Long previousRevision,
            long revision,
            List<ExtensionDefinitionReadback.Field> before,
            List<Field> after,
            AuditActor actor) {
        AuditChangePolicy policy =
                new AuditChangePolicy("EXTENSION_DEFINITION", "EXTENSION_DEFINITION_REPLACED", AUDIT_FIELDS);
        List<AuditChange> changes = List.of(
                        AuditChange.forNullableScalar("fieldDefinitions", summarize(before), summarize(after)),
                        AuditChange.forNullableScalar(
                                "revision",
                                previousRevision == null ? null : previousRevision.toString(),
                                String.valueOf(revision)))
                .stream()
                .filter(change -> !Objects.equals(change.beforeValue(), change.afterValue()))
                .toList();
        persistence.writeAudit(
                workspaceUuid, groupWorkspaceKey, hostType, hostType, actor, auditJson(policy.allow(changes)));
    }

    private static String summarize(List<?> fields) {
        return fields.stream()
                .map(ExtensionDefinitionService::describe)
                .sorted()
                .reduce((left, right) -> left + ";" + right)
                .orElse("");
    }

    private static String describe(Object value) {
        if (value instanceof Field field)
            return field.fieldKey()
                    + "|"
                    + field.label()
                    + "|"
                    + field.fieldType()
                    + "|"
                    + field.listDisplay()
                    + "|"
                    + field.searchable()
                    + "|"
                    + field.required();
        if (value instanceof ExtensionDefinitionReadback.Field field)
            return field.fieldKey()
                    + "|"
                    + field.label()
                    + "|"
                    + field.fieldType()
                    + "|"
                    + field.listDisplay()
                    + "|"
                    + field.searchable()
                    + "|"
                    + field.required();
        throw new IllegalArgumentException("unknown extension field");
    }

    private static String auditJson(List<AuditChange> changes) {
        return AuditChangeJson.write(changes);
    }

    private static void validateHost(String value) {
        if (!HOST_TYPES.contains(value)) throw new DefinitionInvalidException();
    }

    private static List<Field> normalize(String hostType, List<Field> fields) {
        validateHost(hostType);
        if (fields == null
                || fields.stream().anyMatch(java.util.Objects::isNull)
                || fields.stream().map(Field::fieldKey).distinct().count() != fields.size())
            throw new DefinitionInvalidException();
        java.util.ArrayList<Field> normalized = new java.util.ArrayList<>();
        for (int index = 0; index < fields.size(); index++) {
            Field field = fields.get(index);
            String key = field.fieldKey();
            String label = field.label() == null ? null : field.label().trim();
            String type = field.fieldType();
            List<String> options = field.options() == null
                    ? List.of()
                    : field.options().stream()
                            .map(value -> value == null ? null : value.trim())
                            .toList();
            String status = field.status();
            int order = field.displayOrder() == null ? index : field.displayOrder();
            String suffix =
                    field.displaySuffix() == null || field.displaySuffix().isBlank()
                            ? null
                            : field.displaySuffix().trim();
            if (key == null
                    || !key.matches("[a-z][A-Za-z0-9_]{0,79}")
                    || label == null
                    || label.isEmpty()
                    || label.length() > 120
                    || !Set.of("TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT").contains(type)
                    || status == null
                    || !Set.of("ENABLED", "DISABLED").contains(status)
                    || order < 0
                    || (suffix != null && suffix.length() > 20)
                    || options.stream().anyMatch(value -> value == null || value.isEmpty() || value.length() > 120)
                    || options.stream().distinct().count() != options.size()
                    || ("SELECT".equals(type) && options.isEmpty())
                    || (!"SELECT".equals(type) && !options.isEmpty())) throw new DefinitionInvalidException();
            if (!validDisplayFlags(hostType, field.listDisplay(), field.searchable()))
                throw new DefinitionInvalidException();
            normalized.add(new Field(
                    key,
                    label,
                    type,
                    normalizedFlag(hostType, field.listDisplay()),
                    normalizedFlag(hostType, field.searchable()),
                    field.required(),
                    List.copyOf(options),
                    status,
                    order,
                    suffix));
        }
        if (normalized.stream().map(Field::displayOrder).distinct().count() != normalized.size())
            throw new DefinitionInvalidException();
        normalized.sort(java.util.Comparator.comparingInt(Field::displayOrder));
        return List.copyOf(normalized);
    }

    public record Field(
            String fieldKey,
            String label,
            String fieldType,
            Boolean listDisplay,
            Boolean searchable,
            boolean required,
            List<String> options,
            String status,
            Integer displayOrder,
            String displaySuffix) {
        public Field(
                String fieldKey,
                String label,
                String fieldType,
                boolean required,
                List<String> options,
                String status,
                Integer displayOrder,
                String displaySuffix) {
            this(fieldKey, label, fieldType, false, false, required, options, status, displayOrder, displaySuffix);
        }
    }

    public record DraftField(
            String fieldKey,
            String label,
            String fieldType,
            Boolean listDisplay,
            Boolean searchable,
            boolean required,
            List<String> options,
            String status,
            Integer displayOrder,
            String displaySuffix) {
        public DraftField(
                String fieldKey,
                String label,
                String fieldType,
                boolean required,
                List<String> options,
                String status,
                Integer displayOrder,
                String displaySuffix) {
            this(fieldKey, label, fieldType, false, false, required, options, status, displayOrder, displaySuffix);
        }
    }

    private record ExtensionDefinitionPreState(long revision, List<ExtensionDefinitionReadback.Field> fields) {}

    private static String json(List<Field> fields) {
        ArrayNode values = JSON.createArrayNode();
        for (Field field : fields) {
            var node = values.addObject();
            node.put("key", field.fieldKey());
            node.put("label", field.label());
            node.put("type", field.fieldType());
            if (field.listDisplay() != null) node.put("listDisplay", field.listDisplay());
            if (field.searchable() != null) node.put("searchable", field.searchable());
            node.put("required", field.required());
            node.putPOJO("options", field.options());
            node.put("status", field.status());
            node.put("displayOrder", field.displayOrder());
            if (field.displaySuffix() != null) node.put("displaySuffix", field.displaySuffix());
        }
        return values.toString();
    }
    /**
     * Applies the common extension-field semantics without taking ownership of a business record. The calling business
     * owner persists the returned JSON in its own transaction.
     */
    public static String mergeValues(
            ExtensionDefinitionReadback definition, String currentValuesJson, Map<String, String> requestedValues) {
        if (definition == null) throw new DefinitionInvalidException();
        ObjectNode merged;
        try {
            JsonNode parsed = JSON.readTree(currentValuesJson == null ? "{}" : currentValuesJson);
            if (!parsed.isObject()) throw new DefinitionInvalidException();
            merged = (ObjectNode) parsed;
        } catch (java.io.IOException failure) {
            throw new DefinitionInvalidException(failure);
        }
        Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream()
                .collect(
                        java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, field -> field));
        Map<String, String> requested = requestedValues == null ? Map.of() : requestedValues;
        if (!requested.isEmpty()) requireConsumableDefinition(definition);
        for (Map.Entry<String, String> entry : requested.entrySet()) {
            ExtensionDefinitionReadback.Field field = fields.get(entry.getKey());
            if (field == null) throw new DefinitionInvalidException();
            if ("DISABLED".equals(field.status())) continue;
            if (isJsonNull(entry.getValue())) {
                merged.remove(entry.getKey());
                continue;
            }
            if (!validJsonValue(field, entry.getValue())) throw new DefinitionInvalidException();
            try {
                merged.set(entry.getKey(), JSON.readTree(entry.getValue()));
            } catch (java.io.IOException failure) {
                throw new DefinitionInvalidException(failure);
            }
        }
        if (fields.values().stream()
                .filter(field -> "ENABLED".equals(field.status()) && field.required())
                .anyMatch(field -> !merged.hasNonNull(field.fieldKey())
                        || !validJsonValue(field, merged.get(field.fieldKey()).toString()))) {
            throw new DefinitionInvalidException();
        }
        return merged.toString();
    }

    /**
     * Applies an explicit owner-native submission. Unlike the legacy map form, CLEAR is carried by the mode rather than
     * by a null-shaped value; only this owner interprets the JSON text.
     */
    public static String mergeValues(
            ExtensionDefinitionReadback definition, String currentValuesJson, ExtensionSubmission submission) {
        if (definition == null) throw new DefinitionInvalidException();
        ObjectNode merged;
        try {
            JsonNode parsed = JSON.readTree(currentValuesJson == null ? "{}" : currentValuesJson);
            if (!parsed.isObject()) throw new DefinitionInvalidException();
            merged = (ObjectNode) parsed;
        } catch (java.io.IOException failure) {
            throw new DefinitionInvalidException(failure);
        }
        Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream()
                .collect(
                        java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, field -> field));
        List<ExtensionSubmission.ExtensionFieldValue> submitted = submission == null ? List.of() : submission.fields();
        if (!submitted.isEmpty()) requireConsumableDefinition(definition);
        for (ExtensionSubmission.ExtensionFieldValue value : submitted) {
            ExtensionDefinitionReadback.Field field = fields.get(value.fieldKey());
            if (field == null) throw new DefinitionInvalidException();
            if ("DISABLED".equals(field.status())) continue;
            if (value.mode() == ExtensionSubmission.Mode.CLEAR) {
                merged.remove(value.fieldKey());
                continue;
            }
            if (!validJsonValue(field, value.valueJson())) throw new DefinitionInvalidException();
            try {
                merged.set(value.fieldKey(), JSON.readTree(value.valueJson()));
            } catch (java.io.IOException failure) {
                throw new DefinitionInvalidException(failure);
            }
        }
        if (fields.values().stream()
                .filter(field -> "ENABLED".equals(field.status()) && field.required())
                .anyMatch(field -> !merged.hasNonNull(field.fieldKey())
                        || !validJsonValue(field, merged.get(field.fieldKey()).toString()))) {
            throw new DefinitionInvalidException();
        }
        return merged.toString();
    }

    /**
     * Extension values are a downstream business consumption. A definition may still be read and edited while its
     * workspace is disabled, but no owner may materialize new values until the root workspace dimension is usable. Keep
     * this predicate beside the shared merge implementation so every owner-native consumer gets the same fail-closed
     * rule without duplicating status interpretation.
     */
    public static void requireConsumableDefinition(ExtensionDefinitionReadback definition) {
        if (!"ENABLED".equals(definition.workspaceStatus())
                || definition.blockers() == null
                || !definition.blockers().isEmpty()) {
            throw new DefinitionInvalidException();
        }
    }

    /** Decodes the durable JSON object into the owner readback representation. */
    public static Map<String, String> readValues(String source) {
        try {
            JsonNode parsed = JSON.readTree(source == null ? "{}" : source);
            if (!parsed.isObject()) throw new DefinitionInvalidException();
            Map<String, String> values = new LinkedHashMap<>();
            parsed.fields()
                    .forEachRemaining(
                            entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return Map.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new DefinitionInvalidException(failure);
        }
    }

    private static List<ExtensionDefinitionReadback.Field> readFields(String source, String hostType) {
        try {
            JsonNode values = JSON.readTree(source);
            if (!values.isArray()) throw new DefinitionInvalidException();
            java.util.ArrayList<ExtensionDefinitionReadback.Field> fields = new java.util.ArrayList<>();
            for (JsonNode value : values) {
                if (!value.isObject()) throw new DefinitionInvalidException();
                List<String> options = new java.util.ArrayList<>();
                if (!value.path("options").isArray()) throw new DefinitionInvalidException();
                value.path("options").forEach(option -> options.add(option.asText()));
                JsonNode statusNode = value.get("status");
                if (statusNode == null || statusNode.isNull() || !statusNode.isTextual()) {
                    throw new DefinitionInvalidException();
                }
                Boolean listDisplay = normalizedFlag(hostType, readDisplayFlag(value.get("listDisplay")));
                Boolean searchable = normalizedFlag(hostType, readDisplayFlag(value.get("searchable")));
                if (!validDisplayFlags(hostType, listDisplay, searchable)) throw new DefinitionInvalidException();
                fields.add(new ExtensionDefinitionReadback.Field(
                        value.path("key").asText(),
                        value.path("label").asText(),
                        value.path("type").asText(),
                        listDisplay,
                        searchable,
                        value.path("required").asBoolean(),
                        List.copyOf(options),
                        statusNode.asText(),
                        value.path("displayOrder").asInt(),
                        value.path("displaySuffix").isMissingNode()
                                        || value.path("displaySuffix").isNull()
                                ? null
                                : value.path("displaySuffix").asText()));
            }
            return List.copyOf(fields);
        } catch (java.io.IOException failure) {
            throw new DefinitionInvalidException(failure);
        }
    }

    private static Boolean readDisplayFlag(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) return null;
        if (!value.isBoolean()) throw new DefinitionInvalidException();
        return value.booleanValue();
    }

    private static boolean validDisplayFlags(String hostType, Boolean listDisplay, Boolean searchable) {
        if (isFlatHost(hostType)) return true;
        return listDisplay == null && searchable == null;
    }

    private static Boolean normalizedFlag(String hostType, Boolean value) {
        return isFlatHost(hostType) ? Boolean.TRUE.equals(value) : null;
    }

    private static boolean isFlatHost(String hostType) {
        return ExtensionHostTypes.FLAT_VALUES.contains(hostType);
    }

    private static boolean isJsonNull(String value) {
        return value == null || "null".equals(value.trim());
    }

    private static boolean validJsonValue(ExtensionDefinitionReadback.Field field, String value) {
        if (isJsonNull(value)) return false;
        try {
            JsonNode json = JSON.readTree(value);
            return switch (field.fieldType()) {
                case "TEXT" -> json.isTextual();
                case "NUMBER" -> json.isNumber();
                case "DATE" -> json.isTextual() && ExtensionValueSemantics.isCanonicalDate(json.asText());
                case "BOOLEAN" -> json.isBoolean();
                case "SELECT" -> json.isTextual() && field.options().contains(json.asText());
                default -> false;
            };
        } catch (java.io.IOException failure) {
            return false;
        }
    }

    public static final class DefinitionNotFoundException extends RuntimeException {}

    public static final class DefinitionVersionConflictException extends RuntimeException {
        public DefinitionVersionConflictException() {}

        public DefinitionVersionConflictException(Throwable cause) {
            super(null, cause);
        }
    }

    public static final class DefinitionInvalidException extends RuntimeException {
        public DefinitionInvalidException() {}

        public DefinitionInvalidException(Throwable cause) {
            super(cause);
        }
    }
}
