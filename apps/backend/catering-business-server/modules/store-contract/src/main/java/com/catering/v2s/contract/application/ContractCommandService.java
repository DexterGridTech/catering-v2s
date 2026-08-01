package com.catering.v2s.contract.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.contract.api.StoreContractReadback;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractCommandService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> CONTRACT_FIELDS = Set.of("contractNo", "effectiveFrom", "effectiveTo", "phaseName", "status", "items");
    private static final AuditChangePolicy CONTRACT_CREATED = new AuditChangePolicy("STORE_CONTRACT", "CONTRACT_CREATED", CONTRACT_FIELDS);
    private static final AuditChangePolicy CONTRACT_UPDATED = new AuditChangePolicy("STORE_CONTRACT", "CONTRACT_UPDATED", CONTRACT_FIELDS);
    private static final AuditChangePolicy CONTRACT_INVALIDATED = new AuditChangePolicy("STORE_CONTRACT", "CONTRACT_INVALIDATED", Set.of("status"));
    private final JdbcTemplate jdbc; private final TimeProvider time; private final BusinessDateProvider businessDate; private final StoreContractLookup stores; private final ExtensionDefinitionLookup definitions; private final ContractCommandReceiptService receipts;
    public ContractCommandService(JdbcTemplate jdbc, TimeProvider time, BusinessDateProvider businessDate, StoreContractLookup stores, ExtensionDefinitionLookup definitions) { this(jdbc, time, businessDate, stores, definitions, new ContractCommandReceiptService(jdbc, time)); }
    @org.springframework.beans.factory.annotation.Autowired
    public ContractCommandService(JdbcTemplate jdbc, TimeProvider time, BusinessDateProvider businessDate, StoreContractLookup stores, ExtensionDefinitionLookup definitions, ContractCommandReceiptService receipts) { this.jdbc = jdbc; this.time = time; this.businessDate = businessDate; this.stores = stores; this.definitions = definitions; this.receipts = receipts; }

    @Transactional
    public StoreContractReadback create(UUID workspaceUuid, String key, String contractNo, UUID storeId, UUID projectId, LocalDate from, LocalDate to, String phaseName, List<ItemInput> items, Map<String, String> extensionValues) {
        return create(workspaceUuid, key, contractNo, storeId, projectId, from, to, phaseName, null, items, extensionValues, AuditActor.system());
    }
    @Transactional
    public StoreContractReadback create(UUID workspaceUuid, String key, String contractNo, UUID storeId, UUID projectId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, Map<String, String> extensionValues) {
        return create(workspaceUuid, key, contractNo, storeId, projectId, from, to, phaseName, notes, items, extensionValues, AuditActor.system());
    }
    @Transactional
    public StoreContractReadback create(UUID workspaceUuid, String key, String contractNo, UUID storeId, UUID projectId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, Map<String, String> extensionValues, AuditActor actor) {
        var context = stores.requireStoreContractContext(workspaceUuid, key, storeId);
        if (!context.projectId().equals(projectId)) throw new ContractValidationException();
        validateContract(from, to, phaseName, context.projectPhaseNames(), items); validateValues(workspaceUuid, key, extensionValues);
        UUID id = UUID.randomUUID(); long now = time.currentEpochMillis();
        try { jdbc.update("INSERT INTO contract.store_contract (id, workspace_uuid, group_workspace_key, contract_no, store_id, tenant_id, effective_from, effective_to, phase_name_snapshot, notes, items_json, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), 'ACTIVE', 1, ?, ?)", id, workspaceUuid, key, text(contractNo, 120), storeId, context.tenantId(), from, to, optional(phaseName, 120), optional(notes, 2000), itemsJson(items), now, now); }
        catch (DuplicateKeyException duplicate) { throw new ContractConflictException(); }
        replaceValues(id, workspaceUuid, key, extensionValues);
        StoreContractReadback created = require(workspaceUuid, key, id);
        audit(workspaceUuid, key, id, "CONTRACT_CREATED", now, actor, CONTRACT_CREATED, createdChanges(created));
        return created;
    }
    @Transactional
    public StoreContractReadback create(UUID workspaceUuid, String key, String contractNo, UUID storeId, UUID projectId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, Map<String, String> extensionValues, String idempotencyKey) { return create(workspaceUuid, key, contractNo, storeId, projectId, from, to, phaseName, notes, items, extensionValues, idempotencyKey, AuditActor.system()); }
    @Transactional
    public StoreContractReadback create(UUID workspaceUuid, String key, String contractNo, UUID storeId, UUID projectId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) { return receipts.execute(idempotencyKey, canonical("create", workspaceUuid, key, contractNo, storeId, projectId, from, to, phaseName, notes, items, extensionValues), () -> create(workspaceUuid, key, contractNo, storeId, projectId, from, to, phaseName, notes, items, extensionValues, actor)); }

    @Transactional
    public StoreContractReadback update(UUID workspaceUuid, String key, UUID contractId, LocalDate from, LocalDate to, String phaseName, List<ItemInput> items, long expectedVersion, Map<String, String> extensionValues) {
        return update(workspaceUuid, key, contractId, from, to, phaseName, null, items, expectedVersion, extensionValues, AuditActor.system());
    }
    @Transactional
    public StoreContractReadback update(UUID workspaceUuid, String key, UUID contractId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, long expectedVersion, Map<String, String> extensionValues) {
        return update(workspaceUuid, key, contractId, from, to, phaseName, notes, items, expectedVersion, extensionValues, AuditActor.system());
    }
    @Transactional
    public StoreContractReadback update(UUID workspaceUuid, String key, UUID contractId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, long expectedVersion, Map<String, String> extensionValues, AuditActor actor) {
        StoreContractReadback existing = require(workspaceUuid, key, contractId);
        var context = stores.requireStoreContractContext(workspaceUuid, key, existing.storeId());
        validateContract(from, to, phaseName, context.projectPhaseNames(), items); validateValues(workspaceUuid, key, extensionValues);
        long now = time.currentEpochMillis();
        if (jdbc.update("UPDATE contract.store_contract SET effective_from=?, effective_to=?, phase_name_snapshot=?, notes=?, items_json=CAST(? AS JSONB), version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE' AND version=?", from, to, optional(phaseName, 120), optional(notes, 2000), itemsJson(items), now, contractId, workspaceUuid, key, expectedVersion) != 1) throw new ContractConflictException();
        replaceValues(contractId, workspaceUuid, key, extensionValues);
        StoreContractReadback updated = require(workspaceUuid, key, contractId);
        audit(workspaceUuid, key, contractId, "CONTRACT_UPDATED", now, actor, CONTRACT_UPDATED, changed(existing, updated));
        return updated;
    }
    @Transactional
    public StoreContractReadback update(UUID workspaceUuid, String key, UUID contractId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey) { return update(workspaceUuid, key, contractId, from, to, phaseName, notes, items, expectedVersion, extensionValues, idempotencyKey, AuditActor.system()); }
    @Transactional
    public StoreContractReadback update(UUID workspaceUuid, String key, UUID contractId, LocalDate from, LocalDate to, String phaseName, String notes, List<ItemInput> items, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) { return receipts.execute(idempotencyKey, canonical("update", workspaceUuid, key, contractId, from, to, phaseName, notes, items, expectedVersion, extensionValues), () -> update(workspaceUuid, key, contractId, from, to, phaseName, notes, items, expectedVersion, extensionValues, actor)); }

    @Transactional
    public StoreContractReadback invalidate(UUID workspaceUuid, String key, UUID contractId, long expectedVersion) {
        return invalidate(workspaceUuid, key, contractId, expectedVersion, AuditActor.system());
    }
    @Transactional
    public StoreContractReadback invalidate(UUID workspaceUuid, String key, UUID contractId, long expectedVersion, AuditActor actor) {
        StoreContractReadback existing = require(workspaceUuid, key, contractId);
        long now = time.currentEpochMillis();
        if (jdbc.update("UPDATE contract.store_contract SET status='INVALID', invalidated_at_epoch_millis=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND status='ACTIVE' AND version=?", now, now, contractId, workspaceUuid, key, expectedVersion) != 1) throw new ContractConflictException();
        StoreContractReadback invalidated = require(workspaceUuid, key, contractId);
        audit(workspaceUuid, key, contractId, "CONTRACT_INVALIDATED", now, actor, CONTRACT_INVALIDATED, List.of(new AuditChange("status", existing.status(), invalidated.status())));
        return invalidated;
    }
    @Transactional
    public StoreContractReadback invalidate(UUID workspaceUuid, String key, UUID contractId, long expectedVersion, String idempotencyKey) { return invalidate(workspaceUuid, key, contractId, expectedVersion, idempotencyKey, AuditActor.system()); }
    @Transactional
    public StoreContractReadback invalidate(UUID workspaceUuid, String key, UUID contractId, long expectedVersion, String idempotencyKey, AuditActor actor) { return receipts.execute(idempotencyKey, canonical("invalidate", workspaceUuid, key, contractId, expectedVersion), () -> invalidate(workspaceUuid, key, contractId, expectedVersion, actor)); }

    @Transactional(readOnly = true)
    public StoreContractReadback require(UUID workspaceUuid, String key, UUID contractId) {
        return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, contract_no, store_id, tenant_id, effective_from, effective_to, phase_name_snapshot, notes, status, version, items_json::text FROM contract.store_contract WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, contractId); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> {
            if (!result.next()) throw new ContractNotFoundException();
            return readback(result);
        });
    }

    @Transactional(readOnly = true)
    public List<StoreContractReadback> list(UUID workspaceUuid, String key) {
        return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, contract_no, store_id, tenant_id, effective_from, effective_to, phase_name_snapshot, notes, status, version, items_json::text FROM contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY contract_no", (row, index) -> readback(row), workspaceUuid, key);
    }

    @Transactional(readOnly = true)
    public String derivedStoreStatus(UUID workspaceUuid, String key, UUID storeId) {
        LocalDate today = businessDate.today();
        int operating = jdbc.queryForObject("SELECT COUNT(*) FROM contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? AND store_id=? AND status='ACTIVE' AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?)", Integer.class, workspaceUuid, key, storeId, today, today);
        if (operating > 0) return "OPERATING";
        int preparing = jdbc.queryForObject("SELECT COUNT(*) FROM contract.store_contract WHERE workspace_uuid=? AND group_workspace_key=? AND store_id=? AND status='ACTIVE' AND effective_from>?", Integer.class, workspaceUuid, key, storeId, today);
        return preparing > 0 ? "PREPARING" : "NOT_OPERATING";
    }

    private void validateContract(LocalDate from, LocalDate to, String phase, List<String> projectPhases, List<ItemInput> items) { if (from == null || (to != null && to.isBefore(from)) || (phase != null && !phase.isBlank() && !projectPhases.contains(phase)) || items == null || items.isEmpty() || items.stream().anyMatch(item -> item == null || item.itemCode() == null || item.itemCode().isBlank() || item.itemCode().trim().length() > 120 || item.itemName() == null || item.itemName().isBlank() || item.itemName().trim().length() > 240) || items.stream().map(item -> item.itemCode().strip().toLowerCase(java.util.Locale.ROOT)).distinct().count() != items.size()) throw new ContractValidationException(); }
    private static StoreContractReadback readback(java.sql.ResultSet result) throws java.sql.SQLException { List<StoreContractReadback.Item> items = readItems(result.getString(13)); return new StoreContractReadback(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getObject(5, UUID.class), result.getObject(6, UUID.class), result.getObject(7, LocalDate.class), result.getObject(8, LocalDate.class), result.getString(9), result.getString(10), result.getString(11), result.getLong(12), items); }
    private static String canonical(String operation, Object... values) { StringBuilder value = new StringBuilder(operation); for (Object part : values) { String text = String.valueOf(part == null ? "<null>" : part); value.append('|').append(text.length()).append(':').append(text); } return value.toString(); }
    private void validateValues(UUID workspaceUuid, String key, Map<String, String> values) { Map<String, String> actual = values == null ? Map.of() : values; try { ExtensionDefinitionReadback definition = definitions.requireDefinition(workspaceUuid, key, "CONTRACT"); Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream().collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, field -> field)); if (actual.keySet().stream().anyMatch(field -> !fields.containsKey(field)) || actual.entrySet().stream().anyMatch(entry -> !"DISABLED".equals(fields.get(entry.getKey()).status()) && !isJsonNull(entry.getValue()) && !validJsonValue(fields.get(entry.getKey()), entry.getValue()))) throw new ContractValidationException(); } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) { if (!actual.isEmpty()) throw new ContractValidationException(); } }
    private static String itemsJson(List<ItemInput> items) { var array = JSON.createArrayNode(); for (ItemInput item : items) { var value = array.addObject(); value.put("code", text(item.itemCode(), 120)); value.put("name", text(item.itemName(), 240)); } return array.toString(); }
    private static List<StoreContractReadback.Item> readItems(String source) { try { JsonNode array = JSON.readTree(source); if (!array.isArray()) throw new ContractValidationException(); java.util.ArrayList<StoreContractReadback.Item> values = new java.util.ArrayList<>(); int line = 1; for (JsonNode item : array) values.add(new StoreContractReadback.Item(line++, item.path("code").asText(), item.path("name").asText())); return List.copyOf(values); } catch (java.io.IOException failure) { throw new ContractValidationException(); } }
    private void replaceValues(UUID id, UUID workspaceUuid, String key, Map<String, String> values) {
        String current = jdbc.query("SELECT extension_values::text FROM contract.store_contract WHERE id=?", statement -> statement.setObject(1, id), result -> { if (!result.next()) throw new ContractNotFoundException(); return result.getString(1); });
        ObjectNode merged;
        try { JsonNode parsed = JSON.readTree(current); if (!parsed.isObject()) throw new ContractValidationException(); merged = (ObjectNode) parsed; }
        catch (java.io.IOException failure) { throw new ContractValidationException(); }
        ExtensionDefinitionReadback definition;
        try { definition = definitions.requireDefinition(workspaceUuid, key, "CONTRACT"); }
        catch (ExtensionDefinitionService.DefinitionNotFoundException absent) { if (values != null && !values.isEmpty()) throw new ContractValidationException(); jdbc.update("UPDATE contract.store_contract SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?", merged.toString(), 0L, id); return; }
        Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream().collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, field -> field));
        if (values != null) for (var value : values.entrySet()) {
            ExtensionDefinitionReadback.Field field = fields.get(value.getKey());
            if (field == null) throw new ContractValidationException();
            if ("DISABLED".equals(field.status())) continue;
            if (isJsonNull(value.getValue())) { merged.remove(value.getKey()); continue; }
            if (!validJsonValue(field, value.getValue())) throw new ContractValidationException();
            try { merged.set(value.getKey(), JSON.readTree(value.getValue())); }
            catch (java.io.IOException failure) { throw new ContractValidationException(); }
        }
        if (fields.values().stream().filter(field -> "ENABLED".equals(field.status()) && field.required()).anyMatch(field -> !merged.hasNonNull(field.fieldKey()) || !validJsonValue(field, merged.get(field.fieldKey()).toString()))) throw new ContractValidationException();
        jdbc.update("UPDATE contract.store_contract SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?", merged.toString(), definition.version(), id);
    }
    private void audit(UUID workspaceUuid, String key, UUID id, String action, long now, AuditActor actor, AuditChangePolicy policy, List<AuditChange> changes) {
        jdbc.update("INSERT INTO contract.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, 'STORE_CONTRACT', ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))", UUID.randomUUID(), workspaceUuid, key, id.toString(), actor.actorType(), actor.actorId(), actor.displaySnapshot(), action, now, auditJson(policy.allow(changes)));
    }
    private static List<AuditChange> createdChanges(StoreContractReadback value) {
        return List.of(new AuditChange("contractNo", null, value.contractNo()), new AuditChange("effectiveFrom", null, date(value.effectiveFrom())), new AuditChange("effectiveTo", null, date(value.effectiveTo())), new AuditChange("phaseName", null, value.phaseNameSnapshot()), new AuditChange("status", null, value.status()), new AuditChange("items", null, items(value.items())));
    }
    private static List<AuditChange> changed(StoreContractReadback before, StoreContractReadback after) {
        return List.of(new AuditChange("contractNo", before.contractNo(), after.contractNo()), new AuditChange("effectiveFrom", date(before.effectiveFrom()), date(after.effectiveFrom())), new AuditChange("effectiveTo", date(before.effectiveTo()), date(after.effectiveTo())), new AuditChange("phaseName", before.phaseNameSnapshot(), after.phaseNameSnapshot()), new AuditChange("status", before.status(), after.status()), new AuditChange("items", items(before.items()), items(after.items()))).stream().filter(change -> !Objects.equals(change.beforeValue(), change.afterValue())).toList();
    }
    private static String items(List<StoreContractReadback.Item> values) { return String.join(",", values.stream().map(value -> value.itemCode() + ":" + value.itemName()).toList()); }
    private static String date(LocalDate value) { return value == null ? null : value.toString(); }
    private static String auditJson(List<AuditChange> changes) { StringBuilder value = new StringBuilder("["); for (int index = 0; index < changes.size(); index++) { if (index > 0) value.append(','); AuditChange change = changes.get(index); value.append("{\"fieldKey\":\"").append(escape(change.fieldKey())).append("\""); if (change.beforeValue() != null) value.append(",\"before\":\"").append(escape(change.beforeValue())).append("\""); if (change.afterValue() != null) value.append(",\"after\":\"").append(escape(change.afterValue())).append("\""); value.append('}'); } return value.append(']').toString(); }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r"); }
    private static String text(String value, int limit) { String normalized = Objects.requireNonNullElse(value, "").trim(); if (normalized.isEmpty() || normalized.length() > limit) throw new ContractValidationException(); return normalized; }
    private static String optional(String value, int limit) { return value == null || value.isBlank() ? null : text(value, limit); }
    private static boolean isJsonNull(String value) { return value == null || "null".equals(value.trim()); }
    private static boolean validJsonValue(ExtensionDefinitionReadback.Field field, String value) { if (isJsonNull(value)) return false; try { JsonNode json = JSON.readTree(value); return switch (field.fieldType()) { case "TEXT" -> json.isTextual(); case "NUMBER" -> json.isNumber(); case "DATE" -> json.isTextual() && json.asText().matches("\\d{4}-\\d{2}-\\d{2}"); case "BOOLEAN" -> json.isBoolean(); case "SELECT" -> json.isTextual() && field.options().contains(json.asText()); default -> false; }; } catch (java.io.IOException failure) { return false; } }
    public record ItemInput(String itemCode, String itemName) { }
    public static final class ContractNotFoundException extends RuntimeException { }
    public static final class ContractConflictException extends RuntimeException { }
    public static final class ContractValidationException extends RuntimeException { }
}
