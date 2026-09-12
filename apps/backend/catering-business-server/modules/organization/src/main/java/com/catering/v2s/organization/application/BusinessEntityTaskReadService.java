package com.catering.v2s.organization.application;

import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.StoreContractLookup.StoreContractContext;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.organization.application.BusinessEntityService.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Organization task reads and owner eligibility projections. It owns no mutation fact. */
@Service
public class BusinessEntityTaskReadService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> ENTITY_TYPES = Set.of("BRAND", "TENANT", BusinessEntityTypes.HEAD_COMPANY);
    private static final String BUSINESS_ENTITY_PROJECTION =
            "entities.id, entities.workspace_uuid, entities.group_workspace_key, entities.code, entities.name, "
                    + "entities.legal_name, entities.credit_code, entities.alias, entities.remark, entities.notes, "
                    + "entities.status, entities.version, entities.extension_rule_revision, "
                    + "entities.created_at_epoch_millis, entities.updated_at_epoch_millis, entities.extension_values, "
                    + "entities.entity_type";
    private final JdbcTemplate jdbc;
    private final OrganizationNodeLookup nodes;

    @Autowired
    public BusinessEntityTaskReadService(JdbcTemplate jdbc, OrganizationNodeLookup nodes) {
        this.jdbc = jdbc;
        this.nodes = nodes;
    }

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> authorizedBrands(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
        return authorizedBrandsForKnownHeadCompany(workspaceUuid, groupWorkspaceKey, headCompanyId);
    }

    /** Reads only the relationship closure when the caller already holds an authoritative head-company fact. */
    List<OrganizationEntityReadback> authorizedBrandsForKnownHeadCompany(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        return jdbc.query(
                "SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, "
                        + "NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, "
                        + "b.version, "
                        + "b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, "
                        + "b.extension_values::text FROM organization.head_company_brand_authorization a JOIN "
                        + "organization.brand b ON b.id=a.brand_id WHERE a.head_company_id=? AND b.workspace_uuid=? "
                        + "AND "
                        + "b.group_workspace_key=? ORDER BY b.id",
                (row, index) -> readEntity("BRAND", row),
                headCompanyId,
                workspaceUuid,
                groupWorkspaceKey);
    }

    /**
     * Bounded organization-owner task read for an already paged head-company surface. It validates every requested head
     * company within its workspace before grouping its authorized brands.
     */
    @Transactional(readOnly = true)
    public Map<UUID, List<OrganizationEntityReadback>> authorizedBrandsByHeadCompanyIds(
            UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedHeadCompanyIds) {
        List<UUID> ids = requestedHeadCompanyIds == null
                ? List.of()
                : requestedHeadCompanyIds.stream().distinct().toList();
        if (ids.isEmpty()) return Map.of();
        if (ids.stream().anyMatch(Objects::isNull)) throw new OrganizationNotFoundException();
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        Map<UUID, List<OrganizationEntityReadback>> brandsByHeadCompanyId = new java.util.LinkedHashMap<>();
        ids.forEach(id -> brandsByHeadCompanyId.put(id, new ArrayList<>()));
        Set<UUID> foundHeadCompanyIds = new java.util.HashSet<>();
        jdbc.query(
                "SELECT b.id, b.workspace_uuid, b.group_workspace_key, b.code, b.name, NULL::varchar AS legal_name, "
                        + "NULL::varchar AS credit_code, b.alias, b.remark, NULL::varchar AS notes, b.status, "
                        + "b.version, "
                        + "b.extension_rule_revision, b.created_at_epoch_millis, b.updated_at_epoch_millis, "
                        + "b.extension_values::text, h.id AS head_company_id FROM organization.head_company h LEFT "
                        + "JOIN "
                        + "organization.head_company_brand_authorization a ON a.head_company_id=h.id LEFT JOIN "
                        + "organization.brand b ON b.id=a.brand_id AND b.workspace_uuid=h.workspace_uuid AND "
                        + "b.group_workspace_key=h.group_workspace_key WHERE h.workspace_uuid=? AND "
                        + "h.group_workspace_key=? AND h.id IN ("
                        + placeholders + ") ORDER BY h.id, b.id",
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    for (int index = 0; index < ids.size(); index++) statement.setObject(index + 3, ids.get(index));
                },
                result -> {
                    while (result.next()) {
                        UUID headCompanyId = result.getObject("head_company_id", UUID.class);
                        foundHeadCompanyIds.add(headCompanyId);
                        if (result.getObject(1, UUID.class) != null)
                            brandsByHeadCompanyId.get(headCompanyId).add(readEntity("BRAND", result));
                    }
                    return null;
                });
        if (foundHeadCompanyIds.size() != ids.size()) throw new OrganizationNotFoundException();
        Map<UUID, List<OrganizationEntityReadback>> immutable = new java.util.LinkedHashMap<>();
        brandsByHeadCompanyId.forEach((headCompanyId, brands) -> immutable.put(headCompanyId, List.copyOf(brands)));
        return Map.copyOf(immutable);
    }

    @Transactional(readOnly = true)
    public List<HeadCompanyBrandAuthorization> authorizedBrandAuthorizations(
            UUID workspaceUuid, String groupWorkspaceKey, UUID headCompanyId) {
        requireEntity(BusinessEntityTypes.HEAD_COMPANY, workspaceUuid, groupWorkspaceKey, headCompanyId);
        return jdbc.query(
                "SELECT brand_id, authorized_at_epoch_millis FROM organization.head_company_brand_authorization WHERE "
                        + "head_company_id=? ORDER BY brand_id",
                (row, index) -> new HeadCompanyBrandAuthorization(row.getObject(1, UUID.class), row.getLong(2)),
                headCompanyId);
    }
    @Transactional(readOnly = true)
    public boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT status FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> result.next() && "ENABLED".equals(result.getString(1)));
    }
    @Transactional(readOnly = true)
    public OrganizationOwnerApi.SalesMenuStoreJudgment requireSalesMenuStore(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        if (workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank() || storeRef == null) {
            throw new OrganizationValidationException();
        }
        return jdbc.query(
                "SELECT store.id AS store_ref, store.status, store.brand_id "
                        + "FROM organization.store store "
                        + "WHERE store.id=? AND store.workspace_uuid=? AND store.group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeRef);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    UUID actualStoreRef = result.getObject("store_ref", UUID.class);
                    UUID actualBrandRef = result.getObject("brand_id", UUID.class);
                    return new OrganizationOwnerApi.SalesMenuStoreJudgment(
                            actualStoreRef,
                            result.getString("status"),
                            null,
                            actualStoreRef.toString(),
                            actualBrandRef.toString());
                });
    }
    @Transactional(readOnly = true)
    public CatalogScopeLookup.CatalogBrandJudgment resolveCatalogBrand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            UUID dataNodeId,
            CatalogScopeLookup.CatalogBrandSelection selection) {
        if (workspaceUuid == null || groupWorkspaceKey == null || dataNodeId == null)
            throw new OrganizationValidationException();
        String requestedBrandRef = selection == null ? null : selection.value();
        if (ServiceNodeTypes.STORE.equals(dataNodeType)) {
            CatalogScopeLookup.CatalogBrandJudgment judgment = jdbc.query(
                    "SELECT brand_id, version FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=? AND status='ENABLED'",
                    s -> {
                        s.setObject(1, dataNodeId);
                        s.setObject(2, workspaceUuid);
                        s.setString(3, groupWorkspaceKey);
                    },
                    r -> {
                        if (!r.next()) throw new OrganizationNotFoundException();
                        return new CatalogScopeLookup.CatalogBrandJudgment(
                                r.getObject(1, UUID.class).toString(),
                                "STORE_PERSISTED_BRAND",
                                "STORE_VERSION:" + r.getLong(2));
                    });
            if (requestedBrandRef != null && !requestedBrandRef.equals(judgment.brandRef()))
                throw new OrganizationValidationException();
            return judgment;
        }
        if (ServiceNodeTypes.HEAD_COMPANY.equals(dataNodeType)) {
            if (requestedBrandRef == null || requestedBrandRef.isBlank()) throw new OrganizationValidationException();
            UUID brand;
            try {
                brand = UUID.fromString(requestedBrandRef);
            } catch (IllegalArgumentException ex) {
                throw new OrganizationValidationException(ex);
            }
            CatalogScopeLookup.CatalogBrandJudgment judgment = jdbc.query(
                    "SELECT h.version, b.version, a.authorized_at_epoch_millis FROM "
                            + "organization.head_company_brand_authorization a JOIN organization.head_company h ON "
                            + "h.id=a.head_company_id JOIN organization.brand b ON b.id=a.brand_id WHERE h.id=? AND "
                            + "h.workspace_uuid=? AND h.group_workspace_key=? AND h.status='ENABLED' AND a.brand_id=? "
                            + "AND "
                            + "b.status='ENABLED'",
                    s -> {
                        s.setObject(1, dataNodeId);
                        s.setObject(2, workspaceUuid);
                        s.setString(3, groupWorkspaceKey);
                        s.setObject(4, brand);
                    },
                    r -> {
                        if (!r.next()) throw new OrganizationValidationException();
                        return new CatalogScopeLookup.CatalogBrandJudgment(
                                brand.toString(),
                                "HEAD_COMPANY_BRAND_AUTHORIZATION",
                                "HEAD_COMPANY_VERSION:" + r.getLong(1) + ":BRAND_VERSION:" + r.getLong(2)
                                        + ":AUTHORIZED_AT:" + r.getLong(3));
                    });
            return judgment;
        }
        throw new OrganizationValidationException();
    }
    @Transactional(readOnly = true)
    public void requireCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            UUID sourceDataNodeId,
            String brandRef) {
        UUID approved = resolveCatalogCopySource(
                workspaceUuid, groupWorkspaceKey, targetDataNodeType, targetDataNodeId, brandRef);
        if (sourceDataNodeId == null || !approved.equals(sourceDataNodeId)) throw new OrganizationValidationException();
    }
    public UUID resolveCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            String brandRef) {
        if (workspaceUuid == null
                || groupWorkspaceKey == null
                || targetDataNodeId == null
                || brandRef == null
                || brandRef.isBlank()) throw new OrganizationValidationException();
        if (!ServiceNodeTypes.STORE.equals(targetDataNodeType)) throw new OrganizationValidationException();
        UUID targetBrand = jdbc.query(
                "SELECT brand_id, head_company_id FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=? AND status='ENABLED'",
                s -> {
                    s.setObject(1, targetDataNodeId);
                    s.setObject(2, workspaceUuid);
                    s.setString(3, groupWorkspaceKey);
                },
                r -> {
                    if (!r.next()) throw new OrganizationNotFoundException();
                    return r.getObject(1, UUID.class);
                });
        if (targetBrand == null || !targetBrand.toString().equals(brandRef))
            throw new OrganizationValidationException();
        UUID brand;
        try {
            brand = UUID.fromString(brandRef);
        } catch (IllegalArgumentException ex) {
            throw new OrganizationValidationException(ex);
        }
        UUID source = jdbc.query(
                "SELECT head_company_id FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                        + "group_workspace_key=? AND status='ENABLED'",
                s -> {
                    s.setObject(1, targetDataNodeId);
                    s.setObject(2, workspaceUuid);
                    s.setString(3, groupWorkspaceKey);
                },
                r -> {
                    if (!r.next() || r.getObject(1, UUID.class) == null) throw new OrganizationValidationException();
                    return r.getObject(1, UUID.class);
                });
        Boolean sourceAllowed = jdbc.query(
                "SELECT EXISTS (SELECT 1 FROM organization.head_company h JOIN "
                        + "organization.head_company_brand_authorization a ON a.head_company_id=h.id JOIN "
                        + "organization.brand b ON b.id=a.brand_id WHERE h.id=? AND h.workspace_uuid=? AND "
                        + "h.group_workspace_key=? AND h.status='ENABLED' AND b.id=? AND b.status='ENABLED')",
                s -> {
                    s.setObject(1, source);
                    s.setObject(2, workspaceUuid);
                    s.setString(3, groupWorkspaceKey);
                    s.setObject(4, brand);
                },
                r -> r.next() && r.getBoolean(1));
        if (!Boolean.TRUE.equals(sourceAllowed)) throw new OrganizationValidationException();
        return source;
    }
    @Transactional(readOnly = true)
    public boolean isEnterableEntity(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = entityType(entityType);
        return enabled(table(type), workspaceUuid, groupWorkspaceKey, entityId);
    }
    @Transactional(readOnly = true)
    public String describeEntityPath(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = Objects.requireNonNullElse(entityType, "").toUpperCase(Locale.ROOT);
        if (BusinessEntityTypes.HEAD_COMPANY.equals(type)) {
            OrganizationEntityReadback value = requireEntity(type, workspaceUuid, groupWorkspaceKey, entityId);
            return value.code() + " " + value.name();
        }
        if (ServiceNodeTypes.STORE.equals(type)) {
            StorePathStore store = jdbc.query(
                    "SELECT project_id, code, name FROM organization.store WHERE id=? AND workspace_uuid=? AND "
                            + "group_workspace_key=?",
                    statement -> {
                        statement.setObject(1, entityId);
                        statement.setObject(2, workspaceUuid);
                        statement.setString(3, groupWorkspaceKey);
                    },
                    result -> {
                        if (!result.next()) throw new OrganizationNotFoundException();
                        return new StorePathStore(
                                result.getObject(1, UUID.class), result.getString(2), result.getString(3));
                    });
            return nodes.describePath(workspaceUuid, groupWorkspaceKey, store.projectId()) + " / " + store.code() + " "
                    + store.name();
        }
        throw new OrganizationValidationException();
    }
    @Transactional(readOnly = true)
    public StoreContractContext requireStoreContractContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return requireStoreContractContext(workspaceUuid, groupWorkspaceKey, storeId, false);
    }
    @Transactional
    public StoreContractContext requireStoreContractContextForCreate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return requireStoreContractContext(workspaceUuid, groupWorkspaceKey, storeId, true);
    }

    private StoreContractContext requireStoreContractContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeId, boolean lockStoreAndTenant) {
        return jdbc.query(
                "SELECT s.tenant_id, s.project_id, s.status, t.status AS tenant_status, phase.phase_name "
                        + "FROM organization.store s JOIN organization.tenant t ON t.id=s.tenant_id AND "
                        + "t.workspace_uuid=s.workspace_uuid AND t.group_workspace_key=s.group_workspace_key LEFT JOIN "
                        + "organization.project_phase_name phase ON phase.project_id=s.project_id WHERE s.id=? AND "
                        + "s.workspace_uuid=? AND s.group_workspace_key=? ORDER BY phase.display_order"
                        + (lockStoreAndTenant ? " FOR UPDATE OF s, t" : ""),
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    UUID tenantId = result.getObject("tenant_id", UUID.class);
                    UUID projectId = result.getObject("project_id", UUID.class);
                    String status = result.getString("status");
                    String tenantStatus = result.getString("tenant_status");
                    List<String> phases = new ArrayList<>();
                    do {
                        String phase = result.getString("phase_name");
                        if (phase != null) phases.add(phase);
                    } while (result.next());
                    return new StoreContractContext(storeId, tenantId, projectId, status, tenantStatus, phases);
                });
    }

    @Transactional(readOnly = true)
    public OrganizationEntityReadback requireEntity(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        String table = table(type);
        String fields =
                switch (type) {
                    case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, "
                            + "NULL::varchar AS notes";
                    case ServiceNodeTypes
                            .STORE -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS "
                            + "alias, NULL::varchar AS remark, notes";
                    default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
                };
        return jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text FROM organization."
                        + table + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return readEntity(type, result);
                });
    }

    /** Server-side target fact for operations capability resolution; never accept a synthesized group id. */
    @Transactional(readOnly = true)
    public UUID requireCommercialGroupId(UUID workspaceUuid, String groupWorkspaceKey) {
        return jdbc.query(
                "SELECT commercial_group_uuid FROM organization.commercial_group WHERE group_workspace_key=?",
                statement -> statement.setString(1, groupWorkspaceKey),
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    /** Server-side project fact for a requested create target; the controller never manufactures a PROJECT resource. */
    @Transactional(readOnly = true)
    public UUID requireProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId) {
        return nodes.requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT)
                .id();
    }

    /** Server-side project fact for an existing store write target; STORE is never a capability target. */
    public UUID requireStoreProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT project_id FROM organization.store WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return result.getObject(1, UUID.class);
                });
    }

    /**
     * Narrow immutable facts needed by the operations edge before the owner command performs its authoritative recheck.
     */
    public StoreUpdateFacts readStoreUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return jdbc.query(
                "SELECT project_id, tenant_id, brand_id, code FROM organization.store "
                        + "WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, storeId);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, groupWorkspaceKey);
                },
                result -> {
                    if (!result.next()) throw new OrganizationNotFoundException();
                    return new StoreUpdateFacts(
                            result.getObject(1, UUID.class),
                            result.getObject(2, UUID.class),
                            result.getObject(3, UUID.class),
                            result.getString(4));
                });
    }

    public record StoreUpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> listEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        String table = table(type);
        String fields =
                switch (type) {
                    case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, "
                            + "NULL::varchar AS notes";
                    case ServiceNodeTypes
                            .STORE -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS "
                            + "alias, NULL::varchar AS remark, notes";
                    default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
                };
        return jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text FROM organization."
                        + table + " WHERE workspace_uuid=? AND group_workspace_key=? ORDER BY code",
                (row, index) -> readEntity(type, row),
                workspaceUuid,
                groupWorkspaceKey);
    }

    /**
     * Brand list truth stays with the organization owner: predicate, total and bounded slice are one query contract.
     */
    @Transactional(readOnly = true)
    public BrandPage pageBrands(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String queryText,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        BusinessEntityPage values = pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                "BRAND",
                queryText,
                null,
                null,
                null,
                status,
                sort,
                direction,
                page,
                pageSize,
                true);
        return new BrandPage(
                values.items().stream().map(BusinessEntityPageItem::entity).toList(),
                values.total(),
                values.page(),
                values.pageSize());
    }

    /** Every business-entity page keeps predicate, total and bounded slice inside the organization owner. */
    @Transactional(readOnly = true)
    public EntityPage pageEntities(
            String entityType,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        String type = entityType(entityType);
        BusinessEntityPage values = pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                type,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize);
        return new EntityPage(
                values.items().stream().map(BusinessEntityPageItem::entity).toList(),
                values.total(),
                values.page(),
                values.pageSize());
    }

    /**
     * Canonical organization-owner read for every business-entity list. External edges may expose different response
     * shapes, but their entity predicate, count and bounded slice must pass here.
     */
    @Transactional(readOnly = true)
    public BusinessEntityPage pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize) {
        return pageBusinessEntities(
                workspaceUuid,
                groupWorkspaceKey,
                entityType,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize,
                false);
    }

    private BusinessEntityPage pageBusinessEntities(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            boolean brandQueryText) {
        String type = entityType == null ? null : entityType(entityType);
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new OrganizationValidationException();
        String order =
                switch (Objects.requireNonNullElse(sort, "NAME")) {
                    case "NAME" -> "name";
                    case "CODE" -> "code";
                    case "UPDATED_AT" -> "updated_at_epoch_millis";
                    default -> throw new OrganizationValidationException();
                };
        String safeDirection =
                switch (Objects.requireNonNullElse(direction, "ASC")) {
                    case "ASC", "DESC" -> Objects.requireNonNullElse(direction, "ASC");
                    default -> throw new OrganizationValidationException();
                };
        String safeStatus = status == null
                ? null
                : switch (status) {
                    case "ENABLED", "DISABLED", "VOIDED" -> status;
                    default -> throw new OrganizationValidationException();
                };
        String nameFilter = filter(name);
        String codeFilter = filter(code);
        String legalNameFilter = filter(legalName);
        String unifiedSocialCreditCodeFilter = filter(unifiedSocialCreditCode);
        List<Object> parameters = new ArrayList<>();
        for (int index = 0; index < 3; index++) {
            parameters.add(workspaceUuid);
            parameters.add(groupWorkspaceKey);
        }
        String predicate;
        if (brandQueryText) {
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(safeStatus);
            parameters.add(safeStatus);
            parameters.add(type);
            parameters.add(type);
            predicate = "(CAST(? AS text) IS NULL OR lower(name) LIKE ? OR lower(code) LIKE ?) AND (CAST(? AS text) IS "
                    + "NULL OR status=?) AND (CAST(? AS text) IS NULL OR entity_type=?)";
        } else {
            parameters.add(nameFilter);
            parameters.add(nameFilter);
            parameters.add(codeFilter);
            parameters.add(codeFilter);
            parameters.add(legalNameFilter);
            parameters.add(legalNameFilter);
            parameters.add(unifiedSocialCreditCodeFilter);
            parameters.add(unifiedSocialCreditCodeFilter);
            parameters.add(safeStatus);
            parameters.add(safeStatus);
            parameters.add(type);
            parameters.add(type);
            predicate =
                    "(CAST(? AS text) IS NULL OR lower(name) LIKE ?) AND (CAST(? AS text) IS NULL OR lower(code) LIKE "
                            + "?) AND (CAST(? AS text) IS NULL OR lower(legal_name) LIKE ?) AND (CAST(? AS text) IS "
                            + "NULL "
                            + "OR lower(credit_code) LIKE ?) AND (CAST(? AS text) IS NULL OR status=?) AND (CAST(? AS "
                            + "text) IS NULL OR entity_type=?)";
        }
        String rows = businessEntityRowsSql();
        long total = jdbc.queryForObject(
                "SELECT count(*) FROM (" + rows + ") entities WHERE " + predicate, Long.class, parameters.toArray());
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(pageSize);
        pageParameters.add((page - 1) * pageSize);
        List<BusinessEntityPageItem> items = jdbc.query(
                "SELECT " + BUSINESS_ENTITY_PROJECTION + " FROM (" + rows + ") entities WHERE " + predicate
                        + " ORDER BY " + order + " " + safeDirection + ", id ASC LIMIT ? OFFSET ?",
                (row, index) -> new BusinessEntityPageItem(row.getString(17), readEntity(row.getString(17), row)),
                pageParameters.toArray());
        return new BusinessEntityPage(items, total, page, pageSize);
    }

    /** Canonical owner lookup when an app knows a business-entity id but not its subtype. */
    @Transactional(readOnly = true)
    public BusinessEntityPageItem requireBusinessEntity(UUID workspaceUuid, String groupWorkspaceKey, UUID entityId) {
        List<BusinessEntityPageItem> values = jdbc.query(
                "SELECT " + BUSINESS_ENTITY_PROJECTION + " FROM (" + businessEntityRowsSql() + ") entities WHERE id=?",
                (row, index) -> new BusinessEntityPageItem(row.getString(17), readEntity(row.getString(17), row)),
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                groupWorkspaceKey,
                workspaceUuid,
                groupWorkspaceKey,
                entityId);
        if (values.isEmpty()) throw new OrganizationNotFoundException();
        return values.getFirst();
    }

    private static String businessEntityRowsSql() {
        return "SELECT id, workspace_uuid, group_workspace_key, code, name, NULL::varchar AS legal_name, NULL::varchar "
                + "AS credit_code, alias, remark, NULL::varchar AS notes, status, version, extension_rule_revision, "
                + "created_at_epoch_millis, updated_at_epoch_millis, extension_values::text, 'BRAND' AS entity_type "
                + "FROM "
                + "organization.brand WHERE workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, "
                + "workspace_uuid, group_workspace_key, code, name, legal_name, credit_code, NULL::varchar AS alias, "
                + "remark, NULL::varchar AS notes, status, version, extension_rule_revision, created_at_epoch_millis, "
                + "updated_at_epoch_millis, extension_values::text, 'TENANT' AS entity_type FROM organization.tenant "
                + "WHERE "
                + "workspace_uuid=? AND group_workspace_key=? UNION ALL SELECT id, workspace_uuid, "
                + "group_workspace_key, "
                + "code, name, legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes, "
                + "status, "
                + "version, extension_rule_revision, created_at_epoch_millis, updated_at_epoch_millis, "
                + "extension_values::text, 'HEAD_COMPANY' AS entity_type FROM organization.head_company WHERE "
                + "workspace_uuid=? AND group_workspace_key=?";
    }

    /**
     * Owner-bounded readback for a caller's already paged entity identifiers. It deliberately does not offer an
     * unbounded page replacement.
     */
    @Transactional(readOnly = true)
    public Map<UUID, OrganizationEntityReadback> requireEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, List<UUID> requestedIds) {
        List<UUID> ids = requestedIds == null
                ? List.of()
                : requestedIds.stream().distinct().toList();
        if (ids.isEmpty()) return Map.of();
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        String table = table(type);
        String fields =
                switch (type) {
                    case "BRAND" -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, alias, remark, "
                            + "NULL::varchar AS notes";
                    case ServiceNodeTypes
                            .STORE -> "NULL::varchar AS legal_name, NULL::varchar AS credit_code, NULL::varchar AS "
                            + "alias, NULL::varchar AS remark, notes";
                    default -> "legal_name, credit_code, NULL::varchar AS alias, remark, NULL::varchar AS notes";
                };
        Map<UUID, OrganizationEntityReadback> values = new java.util.LinkedHashMap<>();
        Object[] parameters = new Object[ids.size() + 2];
        parameters[0] = workspaceUuid;
        parameters[1] = groupWorkspaceKey;
        for (int index = 0; index < ids.size(); index++) parameters[index + 2] = ids.get(index);
        jdbc.query(
                "SELECT id, workspace_uuid, group_workspace_key, code, name, " + fields
                        + ", status, version, extension_rule_revision, created_at_epoch_millis, "
                        + "updated_at_epoch_millis, extension_values::text FROM organization."
                        + table + " WHERE workspace_uuid=? AND group_workspace_key=? AND id IN ("
                        + String.join(",", java.util.Collections.nCopies(ids.size(), "?")) + ")",
                (row, index) -> {
                    OrganizationEntityReadback value = readEntity(type, row);
                    values.put(value.id(), value);
                    return value;
                },
                parameters);
        if (values.size() != ids.size()) throw new OrganizationNotFoundException();
        return Map.copyOf(values);
    }

    private static String filter(String value) {
        return value == null || value.isBlank() ? null : "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
    }
        static OrganizationEntityReadback readEntity(String type, java.sql.ResultSet result)
            throws java.sql.SQLException {
        return new OrganizationEntityReadback(
                result.getObject(1, UUID.class),
                type,
                result.getObject(2, UUID.class),
                result.getString(3),
                result.getString(4),
                result.getString(5),
                result.getString(6),
                result.getString(7),
                result.getString(11),
                result.getLong(12),
                result.getString(8),
                result.getString(9),
                result.getString(10),
                result.getLong(13),
                result.getLong(14),
                result.getLong(15),
                readExtensionObject(result.getString(16)));
    }

        static Map<String, String> readExtensionObject(String source) {
        try {
            JsonNode node = JSON.readTree(source);
            if (!node.isObject()) throw new OrganizationValidationException();
            Map<String, String> values = new java.util.LinkedHashMap<>();
            node.fields()
                    .forEachRemaining(
                            entry -> values.put(entry.getKey(), entry.getValue().toString()));
            return Map.copyOf(values);
        } catch (java.io.IOException failure) {
            throw new OrganizationValidationException(failure);
        }
    }

        private static String entityType(String value) {
        String type = Objects.requireNonNullElse(value, "").toUpperCase(Locale.ROOT);
        if (!ENTITY_TYPES.contains(type)) throw new OrganizationValidationException();
        return type;
    }

    private static String table(String type) {
        return switch (type) {
            case "BRAND" -> "brand";
            case "TENANT" -> "tenant";
            case ServiceNodeTypes.HEAD_COMPANY -> "head_company";
            case ServiceNodeTypes.STORE -> "store";
            default -> throw new OrganizationValidationException();
        };
    }

    private boolean enabled(String table, UUID workspaceUuid, String key, UUID id) {
        return jdbc.query(
                "SELECT status='ENABLED' FROM organization." + table
                        + " WHERE id=? AND workspace_uuid=? AND group_workspace_key=?",
                statement -> {
                    statement.setObject(1, id);
                    statement.setObject(2, workspaceUuid);
                    statement.setString(3, key);
                },
                result -> result.next() && result.getBoolean(1));
    }

    private record StorePathStore(UUID projectId, String code, String name) {}
}
