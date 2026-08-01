package com.catering.v2s.organization.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditChangePolicy;
import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.extension.application.ExtensionDefinitionService;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationEntityLookup;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.StoreAssignmentLookup;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.organization.api.WorkspaceStatusLookup;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessEntityService implements StoreAssignmentLookup, OrganizationEntityLookup, StoreContractLookup {
    private static final Set<String> ENTITY_TYPES = Set.of("BRAND", "TENANT", "HEAD_COMPANY");
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> AUDIT_FIELDS = Set.of("code", "name", "status", "relationship");
    private final JdbcTemplate jdbc;
    private final TimeProvider time;
    private final ExtensionDefinitionLookup definitions;
    private final OrganizationNodeLookup nodes;
    private final BusinessEntityCommandReceiptService receipts;
    private final WorkspaceStatusLookup workspaces;

    public BusinessEntityService(JdbcTemplate jdbc, TimeProvider time, ExtensionDefinitionLookup definitions, OrganizationNodeLookup nodes) {
        this(jdbc, time, definitions, nodes, new BusinessEntityCommandReceiptService(jdbc, time), (workspaceUuid, groupWorkspaceKey) -> true);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public BusinessEntityService(JdbcTemplate jdbc, TimeProvider time, ExtensionDefinitionLookup definitions, OrganizationNodeLookup nodes, BusinessEntityCommandReceiptService receipts, WorkspaceStatusLookup workspaces) {
        this.jdbc = jdbc; this.time = time; this.definitions = definitions; this.nodes = nodes;
        this.receipts = receipts;
        this.workspaces = workspaces;
    }

    @Transactional
    public OrganizationEntityReadback createEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String legalName, String creditCode, Map<String, String> extensionValues) {
        return createEntity(entityType, workspaceUuid, groupWorkspaceKey, code, name, legalName, creditCode, null, null, extensionValues);
    }

    @Transactional
    public OrganizationEntityReadback createEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String legalName, String creditCode, String alias, String remark, Map<String, String> extensionValues) {
        return createEntity(entityType, workspaceUuid, groupWorkspaceKey, code, name, legalName, creditCode, alias, remark, extensionValues, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback createEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String legalName, String creditCode, String alias, String remark, Map<String, String> extensionValues, AuditActor actor) {
        String type = entityType(entityType);
        requireActiveWorkspace(workspaceUuid, groupWorkspaceKey);
        ensureAvailable(type, workspaceUuid, groupWorkspaceKey, null, code, name);
        validateValues(type, workspaceUuid, groupWorkspaceKey, extensionValues);
        UUID id = UUID.randomUUID();
        long now = time.currentEpochMillis();
        String table = table(type);
        try {
            if ("BRAND".equals(type)) jdbc.update("INSERT INTO organization.brand (id, workspace_uuid, group_workspace_key, code, name, alias, remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)", id, workspaceUuid, groupWorkspaceKey, text(code, 64), text(name, 120), optional(alias, 120), optional(remark, 2000), now, now);
            else jdbc.update("INSERT INTO organization." + table + " (id, workspace_uuid, group_workspace_key, code, name, legal_name, credit_code, remark, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)", id, workspaceUuid, groupWorkspaceKey, text(code, 64), text(name, 120), text(legalName, 240), text(creditCode, 32), optional(remark, 2000), now, now);
        } catch (DuplicateKeyException exception) { throw new OrganizationDuplicateException(); }
        replaceValues(table, id, workspaceUuid, groupWorkspaceKey, type, extensionValues);
        OrganizationEntityReadback created = requireEntity(type, workspaceUuid, groupWorkspaceKey, id);
        audit(workspaceUuid, groupWorkspaceKey, id, type, type + "_CREATED", now, actor, createdChanges(created));
        return created;
    }

    @Transactional
    public OrganizationEntityReadback createEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String legalName, String creditCode, String alias, String remark, Map<String, String> extensionValues, String idempotencyKey) {
        return createEntity(entityType, workspaceUuid, groupWorkspaceKey, code, name, legalName, creditCode, alias, remark, extensionValues, idempotencyKey, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback createEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, String code, String name, String legalName, String creditCode, String alias, String remark, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createEntity", entityType, workspaceUuid, groupWorkspaceKey, code, name, legalName, creditCode, alias, remark, extensionValues), () -> createEntity(entityType, workspaceUuid, groupWorkspaceKey, code, name, legalName, creditCode, alias, remark, extensionValues, actor));
    }

    @Transactional
    public OrganizationEntityReadback updateEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String code, String name, String legalName, String creditCode, String alias, String remark, long expectedVersion, Map<String, String> extensionValues) {
        return updateEntity(entityType, workspaceUuid, groupWorkspaceKey, id, code, name, legalName, creditCode, alias, remark, expectedVersion, extensionValues, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback updateEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String code, String name, String legalName, String creditCode, String alias, String remark, long expectedVersion, Map<String, String> extensionValues, AuditActor actor) {
        String type = entityType(entityType); String table = table(type); OrganizationEntityReadback before = requireEntity(type, workspaceUuid, groupWorkspaceKey, id);
        ensureAvailable(type, workspaceUuid, groupWorkspaceKey, id, code, name);
        validateValues(type, workspaceUuid, groupWorkspaceKey, extensionValues);
        String update = "BRAND".equals(type)
            ? "UPDATE organization.brand SET code=?, name=?, alias=?, remark=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?"
            : "UPDATE organization." + table + " SET code=?, name=?, legal_name=?, credit_code=?, remark=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?";
        Object[] args = "BRAND".equals(type)
            ? new Object[]{text(code, 64), text(name, 120), optional(alias, 120), optional(remark, 2000), time.currentEpochMillis(), id, workspaceUuid, groupWorkspaceKey, expectedVersion}
            : new Object[]{text(code, 64), text(name, 120), text(legalName, 240), text(creditCode, 32), optional(remark, 2000), time.currentEpochMillis(), id, workspaceUuid, groupWorkspaceKey, expectedVersion};
        if (jdbc.update(update, args) != 1) throw new OrganizationConflictException();
        replaceValues(table, id, workspaceUuid, groupWorkspaceKey, type, extensionValues);
        OrganizationEntityReadback updated = requireEntity(type, workspaceUuid, groupWorkspaceKey, id);
        audit(workspaceUuid, groupWorkspaceKey, id, type, type + "_UPDATED", time.currentEpochMillis(), actor, changed(before, updated));
        return updated;
    }

    @Transactional
    public OrganizationEntityReadback updateEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String code, String name, String legalName, String creditCode, String alias, String remark, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey) {
        return updateEntity(entityType, workspaceUuid, groupWorkspaceKey, id, code, name, legalName, creditCode, alias, remark, expectedVersion, extensionValues, idempotencyKey, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback updateEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String code, String name, String legalName, String creditCode, String alias, String remark, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("updateEntity", entityType, workspaceUuid, groupWorkspaceKey, id, code, name, legalName, creditCode, alias, remark, expectedVersion, extensionValues), () -> updateEntity(entityType, workspaceUuid, groupWorkspaceKey, id, code, name, legalName, creditCode, alias, remark, expectedVersion, extensionValues, actor));
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String status, long expectedVersion) {
        return transitionEntityStatus(entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String status, long expectedVersion, AuditActor actor) {
        String type = "STORE".equals(entityType) ? "STORE" : entityType(entityType); String table = table(type); OrganizationEntityReadback before = requireEntity(type, workspaceUuid, groupWorkspaceKey, id);
        if (!Set.of("ENABLED", "DISABLED").contains(status) || jdbc.update("UPDATE organization." + table + " SET status=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?", status, time.currentEpochMillis(), id, workspaceUuid, groupWorkspaceKey, expectedVersion) != 1) throw new OrganizationConflictException();
        OrganizationEntityReadback updated = requireEntity(type, workspaceUuid, groupWorkspaceKey, id);
        audit(workspaceUuid, groupWorkspaceKey, id, type, type + "_STATUS_CHANGED", time.currentEpochMillis(), actor, List.of(new AuditChange("status", before.status(), updated.status())));
        return updated;
    }

    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String status, long expectedVersion, String idempotencyKey) {
        return transitionEntityStatus(entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, idempotencyKey, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback transitionEntityStatus(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id, String status, long expectedVersion, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("transitionEntityStatus", entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion), () -> transitionEntityStatus(entityType, workspaceUuid, groupWorkspaceKey, id, status, expectedVersion, actor));
    }

    @Transactional
    public OrganizationEntityReadback createStore(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, Map<String, String> extensionValues) {
        return createStore(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name, null, extensionValues);
    }

    @Transactional
    public OrganizationEntityReadback createStore(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, Map<String, String> extensionValues) {
        return createStore(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name, notes, extensionValues, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback createStore(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, Map<String, String> extensionValues, AuditActor actor) {
        requireActiveWorkspace(workspaceUuid, groupWorkspaceKey);
        var project = nodes.requireNode(workspaceUuid, groupWorkspaceKey, projectId, "PROJECT");
        if (!"ENABLED".equals(project.status()) || !enabled("tenant", workspaceUuid, groupWorkspaceKey, tenantId) || !enabled("brand", workspaceUuid, groupWorkspaceKey, brandId)) throw new OrganizationValidationException();
        if (headCompanyId != null && (!enabled("head_company", workspaceUuid, groupWorkspaceKey, headCompanyId) || !authorized(headCompanyId, brandId))) throw new OrganizationValidationException();
        validateValues("STORE", workspaceUuid, groupWorkspaceKey, extensionValues);
        UUID id = UUID.randomUUID(); long now = time.currentEpochMillis();
        try { jdbc.update("INSERT INTO organization.store (id, workspace_uuid, group_workspace_key, project_id, tenant_id, brand_id, head_company_id, code, name, notes, status, version, created_at_epoch_millis, updated_at_epoch_millis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENABLED', 1, ?, ?)", id, workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, text(code, 64), text(name, 120), optional(notes, 2000), now, now); }
        catch (DuplicateKeyException exception) { throw new OrganizationDuplicateException(); }
        catch (DataIntegrityViolationException exception) { throw new OrganizationConflictException(); }
        replaceValues("store", id, workspaceUuid, groupWorkspaceKey, "STORE", extensionValues);
        OrganizationEntityReadback created = requireEntity("STORE", workspaceUuid, groupWorkspaceKey, id);
        audit(workspaceUuid, groupWorkspaceKey, id, "STORE", "STORE_CREATED", now, actor, createdChanges(created));
        return created;
    }

    @Transactional
    public OrganizationEntityReadback createStore(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, Map<String, String> extensionValues, String idempotencyKey) {
        return createStore(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name, notes, extensionValues, idempotencyKey, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback createStore(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("createStore", workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name, notes, extensionValues), () -> createStore(workspaceUuid, groupWorkspaceKey, projectId, tenantId, brandId, headCompanyId, code, name, notes, extensionValues, actor));
    }

    @Transactional
    public OrganizationEntityReadback updateStore(UUID workspaceUuid, String groupWorkspaceKey, UUID id, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, long expectedVersion, Map<String, String> extensionValues) {
        return updateStore(workspaceUuid, groupWorkspaceKey, id, projectId, tenantId, brandId, headCompanyId, code, name, notes, expectedVersion, extensionValues, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback updateStore(UUID workspaceUuid, String groupWorkspaceKey, UUID id, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, long expectedVersion, Map<String, String> extensionValues, AuditActor actor) {
        OrganizationEntityReadback before = requireEntity("STORE", workspaceUuid, groupWorkspaceKey, id); var project = nodes.requireNode(workspaceUuid, groupWorkspaceKey, projectId, "PROJECT");
        if (!"ENABLED".equals(project.status()) || !enabled("tenant", workspaceUuid, groupWorkspaceKey, tenantId) || !enabled("brand", workspaceUuid, groupWorkspaceKey, brandId) || (headCompanyId != null && (!enabled("head_company", workspaceUuid, groupWorkspaceKey, headCompanyId) || !authorized(headCompanyId, brandId)))) throw new OrganizationValidationException();
        validateValues("STORE", workspaceUuid, groupWorkspaceKey, extensionValues);
        try {
            if (jdbc.update("UPDATE organization.store SET project_id=?, tenant_id=?, brand_id=?, head_company_id=?, code=?, name=?, notes=?, version=version+1, updated_at_epoch_millis=? WHERE id=? AND workspace_uuid=? AND group_workspace_key=? AND version=?", projectId, tenantId, brandId, headCompanyId, text(code, 64), text(name, 120), optional(notes, 2000), time.currentEpochMillis(), id, workspaceUuid, groupWorkspaceKey, expectedVersion) != 1) throw new OrganizationConflictException();
        } catch (DataIntegrityViolationException exception) {
            throw new OrganizationConflictException();
        }
        replaceValues("store", id, workspaceUuid, groupWorkspaceKey, "STORE", extensionValues); OrganizationEntityReadback updated = requireEntity("STORE", workspaceUuid, groupWorkspaceKey, id); audit(workspaceUuid, groupWorkspaceKey, id, "STORE", "STORE_UPDATED", time.currentEpochMillis(), actor, changed(before, updated));
        return updated;
    }

    @Transactional
    public OrganizationEntityReadback updateStore(UUID workspaceUuid, String groupWorkspaceKey, UUID id, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey) {
        return updateStore(workspaceUuid, groupWorkspaceKey, id, projectId, tenantId, brandId, headCompanyId, code, name, notes, expectedVersion, extensionValues, idempotencyKey, AuditActor.system());
    }
    @Transactional
    public OrganizationEntityReadback updateStore(UUID workspaceUuid, String groupWorkspaceKey, UUID id, UUID projectId, UUID tenantId, UUID brandId, UUID headCompanyId, String code, String name, String notes, long expectedVersion, Map<String, String> extensionValues, String idempotencyKey, AuditActor actor) {
        return receipts.execute(workspaceUuid, idempotencyKey, canonical("updateStore", workspaceUuid, groupWorkspaceKey, id, projectId, tenantId, brandId, headCompanyId, code, name, notes, expectedVersion, extensionValues), () -> updateStore(workspaceUuid, groupWorkspaceKey, id, projectId, tenantId, brandId, headCompanyId, code, name, notes, expectedVersion, extensionValues, actor));
    }

    @Transactional
    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement addHeadCompanyBrandAuthorization(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId, String idempotencyKey, AuditActor actor) {
        return receipts.executeAuthorizationAcknowledgement(workspaceUuid, headCompanyId, idempotencyKey, canonical("addHeadCompanyBrandAuthorization", workspaceUuid, groupWorkspaceKey, headCompanyId, brandId), () -> {
            requireEntity("HEAD_COMPANY", workspaceUuid, groupWorkspaceKey, headCompanyId);
            if (!enabled("brand", workspaceUuid, groupWorkspaceKey, brandId)) throw new OrganizationValidationException();
            if (jdbc.update("INSERT INTO organization.head_company_brand_authorization (head_company_id, brand_id, authorized_at_epoch_millis) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", headCompanyId, brandId, time.currentEpochMillis()) == 1) {
                audit(workspaceUuid, groupWorkspaceKey, headCompanyId, "HEAD_COMPANY", "HEAD_COMPANY_BRAND_AUTHORIZATION_ADDED", time.currentEpochMillis(), actor, List.of(new AuditChange("relationship", null, brandId.toString())));
            }
        });
    }

    @Transactional
    public BusinessEntityCommandReceiptService.BrandAuthorizationAcknowledgement removeHeadCompanyBrandAuthorization(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId, String idempotencyKey, AuditActor actor) {
        return receipts.executeAuthorizationAcknowledgement(workspaceUuid, headCompanyId, idempotencyKey, canonical("removeHeadCompanyBrandAuthorization", workspaceUuid, groupWorkspaceKey, headCompanyId, brandId), () -> {
            requireEntity("HEAD_COMPANY", workspaceUuid, groupWorkspaceKey, headCompanyId);
            if (!authorized(headCompanyId, brandId)) throw new HeadCompanyBrandAuthorizationNotFoundException();
            if (hasStoreReference(workspaceUuid, groupWorkspaceKey, headCompanyId, brandId)) throw new HeadCompanyBrandAuthorizationInUseException();
            try {
                if (jdbc.update("DELETE FROM organization.head_company_brand_authorization WHERE head_company_id=? AND brand_id=?", headCompanyId, brandId) != 1) throw new HeadCompanyBrandAuthorizationNotFoundException();
            } catch (DataIntegrityViolationException exception) {
                throw new HeadCompanyBrandAuthorizationInUseException();
            }
            audit(workspaceUuid, groupWorkspaceKey, headCompanyId, "HEAD_COMPANY", "HEAD_COMPANY_BRAND_AUTHORIZATION_REMOVED", time.currentEpochMillis(), actor, List.of(new AuditChange("relationship", brandId.toString(), null)));
        });
    }

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> authorizedBrands(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        requireEntity("HEAD_COMPANY", workspaceUuid, groupWorkspaceKey, headCompanyId);
        return jdbc.query("SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, b.version, b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, b.extension_values::text FROM organization.head_company_brand_authorization a JOIN organization.brand b ON b.id=a.brand_id WHERE a.head_company_id=? AND b.workspace_uuid=? AND b.group_workspace_key=? ORDER BY b.id", (row, index) -> readEntity("BRAND", row), headCompanyId, workspaceUuid, groupWorkspaceKey);
    }
    @Transactional(readOnly = true)
    public List<HeadCompanyBrandAuthorization> authorizedBrandAuthorizations(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        requireEntity("HEAD_COMPANY", workspaceUuid, groupWorkspaceKey, headCompanyId);
        return jdbc.query("SELECT brand_id, authorized_at_epoch_millis FROM organization.head_company_brand_authorization WHERE head_company_id=? ORDER BY brand_id", (row, index) -> new HeadCompanyBrandAuthorization(row.getObject(1, UUID.class), row.getLong(2)), headCompanyId);
    }

    @Override @Transactional(readOnly = true)
    public boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query("SELECT status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, storeId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); }, result -> result.next() && "ENABLED".equals(result.getString(1)));
    }

    @Override @Transactional(readOnly = true)
    public boolean isEnterableEntity(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = entityType(entityType);
        return enabled(table(type), workspaceUuid, groupWorkspaceKey, entityId);
    }

    @Override
    @Transactional(readOnly = true)
    public String describeEntityPath(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = Objects.requireNonNullElse(entityType, "").toUpperCase(Locale.ROOT);
        if ("HEAD_COMPANY".equals(type)) {
            OrganizationEntityReadback value = requireEntity(type, workspaceUuid, groupWorkspaceKey, entityId);
            return value.code() + " " + value.name();
        }
        if ("STORE".equals(type)) {
            StorePathStore store = jdbc.query(
                "SELECT project_id, code, name FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> { statement.setObject(1, entityId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return new StorePathStore(result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                }
            );
            return nodes.describePath(workspaceUuid, groupWorkspaceKey, store.projectId()) + " / " + store.code() + " " + store.name();
        }
        throw new OrganizationValidationException();
    }

    @Override @Transactional(readOnly = true)
    public StoreContractContext requireStoreContractContext(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        StoreContractStore store = jdbc.query("SELECT tenant_id, project_id, status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, storeId); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); }, result -> {
            if (!result.next()) throw new OrganizationNotFoundException();
            return new StoreContractStore(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3));
        });
        List<String> phases = jdbc.query("SELECT phase_name FROM organization.project_phase_name WHERE project_id=? ORDER BY display_order", (row, index) -> row.getString(1), store.projectId());
        return new StoreContractContext(storeId, store.tenantId(), store.projectId(), store.status(), phases);
    }

    @Transactional(readOnly = true)
    public OrganizationEntityReadback requireEntity(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        String type = "STORE".equals(entityType) ? "STORE" : entityType(entityType); String table = table(type);
        String fields = switch (type) { case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, NULL::varchar AS notes"; case "STORE" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS alias, NULL::varchar AS remark, notes"; default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes"; };
        return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields + ", status, version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text FROM organization." + table + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, id); statement.setObject(2, workspaceUuid); statement.setString(3, groupWorkspaceKey); }, result -> { if (!result.next()) throw new OrganizationNotFoundException(); return readEntity(type, result); });
    }

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> listEntities(String entityType, UUID workspaceUuid, String groupWorkspaceKey) {
        String type = "STORE".equals(entityType) ? "STORE" : entityType(entityType); String table = table(type);
        String fields = switch (type) { case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, NULL::varchar AS notes"; case "STORE" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS alias, NULL::varchar AS remark, notes"; default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes"; };
        return jdbc.query("SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields + ", status, version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text FROM organization." + table + " WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY code", (row, index) -> readEntity(type, row), workspaceUuid, groupWorkspaceKey);
    }

    /** Brand list truth stays with the organization owner: predicate, total and bounded slice are one query contract. */
    @Transactional(readOnly = true)
    public BrandPage pageBrands(UUID workspaceUuid, String groupWorkspaceKey, String name, String code, String status, String sort, String direction, int page, int pageSize) {
        EntityPage values = pageEntities("BRAND", workspaceUuid, groupWorkspaceKey, name, code, status, sort, direction, page, pageSize);
        return new BrandPage(values.items(), values.total(), values.page(), values.pageSize());
    }

    /** Every business-entity page keeps predicate, total and bounded slice inside the organization owner. */
    @Transactional(readOnly = true)
    public EntityPage pageEntities(String entityType, UUID workspaceUuid, String groupWorkspaceKey, String name, String code, String status, String sort, String direction, int page, int pageSize) {
        String type = entityType(entityType);
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new OrganizationValidationException();
        String order = switch (Objects.requireNonNullElse(sort, "NAME")) {
            case "NAME" -> "name";
            case "CODE" -> "code";
            case "UPDATED_AT" -> "updated_at_epoch_millis";
            default -> throw new OrganizationValidationException();
        };
        String safeDirection = switch (Objects.requireNonNullElse(direction, "ASC")) {
            case "ASC", "DESC" -> Objects.requireNonNullElse(direction, "ASC");
            default -> throw new OrganizationValidationException();
        };
        String safeStatus = status == null ? null : switch (status) {
            case "ENABLED", "DISABLED" -> status;
            default -> throw new OrganizationValidationException();
        };
        String nameFilter = filter(name);
        String codeFilter = filter(code);
        List<Object> parameters = new ArrayList<>();
        parameters.add(workspaceUuid); parameters.add(groupWorkspaceKey);
        parameters.add(nameFilter); parameters.add(nameFilter);
        parameters.add(codeFilter); parameters.add(codeFilter);
        parameters.add(safeStatus); parameters.add(safeStatus);
        String predicate = "workspace_uuid=? AND group_workspace_key=? AND (CAST(? AS text) IS NULL OR lower(name) LIKE ?) AND (CAST(? AS text) IS NULL OR lower(code) LIKE ?) AND (CAST(? AS text) IS NULL OR status=?)";
        String table = table(type);
        long total = jdbc.queryForObject("SELECT count(*) FROM organization." + table + " WHERE " + predicate, Long.class, parameters.toArray());
        String fields = switch (type) { case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, NULL::varchar AS notes"; default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes"; };
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(pageSize); pageParameters.add((page - 1) * pageSize);
        List<OrganizationEntityReadback> items = jdbc.query("SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields + ", status, version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text FROM organization." + table + " WHERE " + predicate + " ORDER BY " + order + " " + safeDirection + ", id ASC LIMIT ? OFFSET ?", (row, index) -> readEntity(type, row), pageParameters.toArray());
        return new EntityPage(items, total, page, pageSize);
    }

    /**
     * Owner-bounded readback for a caller's already paged entity identifiers.
     * It deliberately does not offer an unbounded page replacement.
     */
    @Transactional(readOnly = true)
    public Map<UUID, OrganizationEntityReadback> requireEntities(String entityType, UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedIds) {
        List<UUID> ids = requestedIds == null ? List.of() : requestedIds.stream().distinct().toList();
        if (ids.isEmpty()) return Map.of();
        String type = "STORE".equals(entityType) ? "STORE" : entityType(entityType); String table = table(type);
        String fields = switch (type) { case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, NULL::varchar AS notes"; case "STORE" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS alias, NULL::varchar AS remark, notes"; default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes"; };
        Map<UUID, OrganizationEntityReadback> values = new java.util.LinkedHashMap<>();
        Object[] parameters = new Object[ids.size() + 2];
        parameters[0] = workspaceUuid; parameters[1] = groupWorkspaceKey;
        for (int index = 0; index < ids.size(); index++) parameters[index + 2] = ids.get(index);
        jdbc.query("SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields + ", status, version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, extension_values::text FROM organization." + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND id IN (" + String.join(",", java.util.Collections.nCopies(ids.size(), "?")) + ")", (row, index) -> {
            OrganizationEntityReadback value = readEntity(type, row);
            values.put(value.id(), value);
            return value;
        }, parameters);
        if (values.size() != ids.size()) throw new OrganizationNotFoundException();
        return Map.copyOf(values);
    }

    private static String filter(String value) { return value == null || value.isBlank() ? null : "%" + value.trim().toLowerCase(Locale.ROOT) + "%"; }
    private static OrganizationEntityReadback readEntity(String type, java.sql.ResultSet result) throws java.sql.SQLException { return new OrganizationEntityReadback(result.getObject(1, UUID.class), type, result.getObject(2, UUID.class), result.getString(3), result.getString(4), result.getString(5), result.getString(6), result.getString(7), result.getString(11), result.getLong(12), result.getString(8), result.getString(9), result.getString(10), result.getLong(13), result.getLong(14), result.getLong(15), jsonObject(result.getString(16))); }

    private void validateValues(String type, UUID workspaceUuid, String key, Map<String, String> values) {
        Map<String, String> actual = values == null ? Map.of() : values;
        try {
            ExtensionDefinitionReadback definition = definitions.requireDefinition(workspaceUuid, key, type);
            Map<String, ExtensionDefinitionReadback.Field> known = definition.fields().stream().collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, value -> value));
            if (actual.keySet().stream().anyMatch(field -> !known.containsKey(field)) || actual.entrySet().stream().anyMatch(entry -> !"DISABLED".equals(known.get(entry.getKey()).status()) && !isJsonNull(entry.getValue()) && !validJsonValue(known.get(entry.getKey()), entry.getValue()))) throw new OrganizationValidationException();
        } catch (ExtensionDefinitionService.DefinitionNotFoundException absent) {
            if (!actual.isEmpty()) throw new OrganizationValidationException();
        }
    }

    private void replaceValues(String table, UUID id, UUID workspaceUuid, String key, String hostType, Map<String, String> values) {
        String current = jdbc.query("SELECT extension_values::text FROM organization." + table + " WHERE id=?", statement -> statement.setObject(1, id), result -> { if (!result.next()) throw new OrganizationNotFoundException(); return result.getString(1); });
        ObjectNode merged;
        try { JsonNode parsed = JSON.readTree(current); if (!parsed.isObject()) throw new OrganizationValidationException(); merged = (ObjectNode) parsed; }
        catch (java.io.IOException failure) { throw new OrganizationValidationException(); }
        ExtensionDefinitionReadback definition;
        try { definition = definitions.requireDefinition(workspaceUuid, key, hostType); }
        catch (ExtensionDefinitionService.DefinitionNotFoundException absent) { if (values != null && !values.isEmpty()) throw new OrganizationValidationException(); jdbc.update("UPDATE organization." + table + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?", merged.toString(), 0L, id); return; }
        Map<String, ExtensionDefinitionReadback.Field> fields = definition.fields().stream().collect(java.util.stream.Collectors.toMap(ExtensionDefinitionReadback.Field::fieldKey, field -> field));
        if (values != null) for (var entry : values.entrySet()) {
            ExtensionDefinitionReadback.Field field = fields.get(entry.getKey());
            if (field == null) throw new OrganizationValidationException();
            if ("DISABLED".equals(field.status())) continue;
            if (isJsonNull(entry.getValue())) { merged.remove(entry.getKey()); continue; }
            if (!validJsonValue(field, entry.getValue())) throw new OrganizationValidationException();
            try { merged.set(entry.getKey(), JSON.readTree(entry.getValue())); }
            catch (java.io.IOException failure) { throw new OrganizationValidationException(); }
        }
        if (fields.values().stream().filter(field -> "ENABLED".equals(field.status()) && field.required()).anyMatch(field -> !merged.hasNonNull(field.fieldKey()) || !validJsonValue(field, merged.get(field.fieldKey()).toString()))) throw new OrganizationValidationException();
        jdbc.update("UPDATE organization." + table + " SET extension_values=CAST(? AS JSONB), extension_rule_revision=? WHERE id=?", merged.toString(), definition.version(), id);
    }
    private static Map<String, String> jsonObject(String source) { try { JsonNode node = JSON.readTree(source); if (!node.isObject()) throw new OrganizationValidationException(); Map<String, String> values = new java.util.LinkedHashMap<>(); node.fields().forEachRemaining(entry -> values.put(entry.getKey(), entry.getValue().toString())); return Map.copyOf(values); } catch (java.io.IOException failure) { throw new OrganizationValidationException(); } }

    private boolean enabled(String table, UUID workspaceUuid, String key, UUID id) { return jdbc.query("SELECT status='ENABLED' FROM organization." + table + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?", statement -> { statement.setObject(1, id); statement.setObject(2, workspaceUuid); statement.setString(3, key); }, result -> result.next() && result.getBoolean(1)); }
    private record StorePathStore(UUID projectId, String code, String name) { }
    private record StoreContractStore(UUID tenantId, UUID projectId, String status) { }
    private void ensureAvailable(String type, UUID workspaceUuid, String key, UUID currentId, String code, String name) {
        String table = table(type);
        if (exists(table, workspaceUuid, key, currentId, "code", text(code, 64))) throw new OrganizationCodeConflictException();
        if (exists(table, workspaceUuid, key, currentId, "lower(btrim(name))", text(name, 120).toLowerCase(Locale.ROOT))) throw new OrganizationNameConflictException();
    }
    private boolean exists(String table, UUID workspaceUuid, String key, UUID currentId, String column, String value) {
        String sql = currentId == null
            ? "SELECT 1 FROM organization." + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND " + column + "=?"
            : "SELECT 1 FROM organization." + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND " + column + "=? AND id<>?";
        Object[] values = currentId == null ? new Object[]{workspaceUuid, key, value} : new Object[]{workspaceUuid, key, value, currentId};
        return !jdbc.queryForList(sql, values).isEmpty();
    }
    private boolean authorized(UUID headCompanyId, UUID brandId) { return !jdbc.query("SELECT 1 FROM organization.head_company_brand_authorization WHERE head_company_id=? AND brand_id=?", (row, index) -> row.getInt(1), headCompanyId, brandId).isEmpty(); }
    private boolean hasStoreReference(UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId, UUID brandId) { return !jdbc.query("SELECT 1 FROM organization.store WHERE workspace_uuid=? AND group_workspace_key=? AND head_company_id=? AND brand_id=? LIMIT 1", (row, index) -> row.getInt(1), workspaceUuid, groupWorkspaceKey, headCompanyId, brandId).isEmpty(); }
    private void requireActiveWorkspace(UUID workspaceUuid, String key) { if (!workspaces.isEnabled(workspaceUuid, key)) throw new OrganizationValidationException(); }
    private void audit(UUID workspaceUuid, String groupWorkspaceKey, UUID id, String entityType, String action, long now, AuditActor actor, List<AuditChange> changes) { AuditChangePolicy policy = new AuditChangePolicy(entityType, action, AUDIT_FIELDS); jdbc.update("INSERT INTO organization.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))", UUID.randomUUID(), workspaceUuid, groupWorkspaceKey, entityType, id.toString(), actor.actorType(), actor.actorId(), actor.displaySnapshot(), action, now, auditJson(policy.allow(changes))); }
    private static List<AuditChange> createdChanges(OrganizationEntityReadback value) { return List.of(new AuditChange("code", null, value.code()), new AuditChange("name", null, value.name()), new AuditChange("status", null, value.status())); }
    private static List<AuditChange> changed(OrganizationEntityReadback before, OrganizationEntityReadback after) { return List.of(new AuditChange("code", before.code(), after.code()), new AuditChange("name", before.name(), after.name()), new AuditChange("status", before.status(), after.status())).stream().filter(change -> !Objects.equals(change.beforeValue(), change.afterValue())).toList(); }
    private static String auditJson(List<AuditChange> changes) { StringBuilder value = new StringBuilder("["); for (int index = 0; index < changes.size(); index++) { if (index > 0) value.append(','); AuditChange change = changes.get(index); value.append("{\"fieldKey\":\"").append(escape(change.fieldKey())).append("\""); if (change.beforeValue() != null) value.append(",\"before\":\"").append(escape(change.beforeValue())).append("\""); if (change.afterValue() != null) value.append(",\"after\":\"").append(escape(change.afterValue())).append("\""); value.append('}'); } return value.append(']').toString(); }
    private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r"); }
    private static String entityType(String value) { String type = Objects.requireNonNullElse(value, "").toUpperCase(Locale.ROOT); if (!ENTITY_TYPES.contains(type)) throw new OrganizationValidationException(); return type; }
    private static String table(String type) { return switch (type) { case "BRAND" -> "brand"; case "TENANT" -> "tenant"; case "HEAD_COMPANY" -> "head_company"; case "STORE" -> "store"; default -> throw new OrganizationValidationException(); }; }
    private static String text(String value, int limit) { String normalized = Objects.requireNonNullElse(value, "").trim(); if (normalized.isEmpty() || normalized.length() > limit) throw new OrganizationValidationException(); return normalized; }
    private static String optional(String value, int limit) { if (value == null || value.isBlank()) return null; return text(value, limit); }
    private static boolean isJsonNull(String value) { return value == null || "null".equals(value.trim()); }
    private static boolean validJsonValue(ExtensionDefinitionReadback.Field field, String value) { if (isJsonNull(value)) return false; try { JsonNode json = JSON.readTree(value); return switch (field.fieldType()) { case "TEXT" -> json.isTextual(); case "NUMBER" -> json.isNumber(); case "DATE" -> json.isTextual() && json.asText().matches("\\d{4}-\\d{2}-\\d{2}"); case "BOOLEAN" -> json.isBoolean(); case "SELECT" -> json.isTextual() && field.options().contains(json.asText()); default -> false; }; } catch (java.io.IOException failure) { return false; } }
    private static String canonical(String operation, Object... values) { StringBuilder result = new StringBuilder(operation); for (Object value : values) { String safe = value instanceof Map<?, ?> map ? map.entrySet().stream().sorted(java.util.Map.Entry.comparingByKey(java.util.Comparator.comparing(String::valueOf))).map(entry -> String.valueOf(entry.getKey()) + "=" + String.valueOf(entry.getValue())).collect(java.util.stream.Collectors.joining("\\u001f")) : String.valueOf(value == null ? "<null>" : value); result.append('|').append(safe.length()).append(':').append(safe); } return result.toString(); }
    public static class OrganizationNotFoundException extends RuntimeException { }
    public static final class OrganizationDuplicateException extends RuntimeException { }
    public static final class OrganizationCodeConflictException extends RuntimeException { }
    public static final class OrganizationNameConflictException extends RuntimeException { }
    public static class OrganizationConflictException extends RuntimeException { }
    /** Closed conflict without store identity, count, or persistence detail. */
    public static final class HeadCompanyBrandAuthorizationInUseException extends OrganizationConflictException { }
    public static final class HeadCompanyBrandAuthorizationNotFoundException extends OrganizationNotFoundException { }
    public static final class OrganizationValidationException extends RuntimeException { }
    public record HeadCompanyBrandAuthorization(UUID brandId, long authorizedAtEpochMillis) { }
    public record BrandPage(List<OrganizationEntityReadback> items, long total, int page, int pageSize) { }
    public record EntityPage(List<OrganizationEntityReadback> items, long total, int page, int pageSize) { }
}
