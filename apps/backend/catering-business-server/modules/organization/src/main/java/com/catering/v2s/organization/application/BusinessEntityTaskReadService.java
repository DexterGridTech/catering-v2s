package com.catering.v2s.organization.application;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionFilterQuery;
import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeLookup;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.StoreContractLookup.StoreContractContext;
import com.catering.v2s.organization.application.BusinessEntityService.*;
import com.catering.v2s.organization.application.persistence.BusinessEntityTaskReadPersistence;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
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
    private final BusinessEntityTaskReadPersistence persistence;
    private final OrganizationNodeLookup nodes;
    private final ExtensionDefinitionLookup definitions;

    @Autowired
    public BusinessEntityTaskReadService(
            BusinessEntityTaskReadPersistence persistence,
            OrganizationNodeLookup nodes,
            ExtensionDefinitionLookup definitions) {
        this.persistence = persistence;
        this.nodes = nodes;
        this.definitions = definitions;
    }

    public BusinessEntityTaskReadService(BusinessEntityTaskReadPersistence persistence, OrganizationNodeLookup nodes) {
        this(persistence, nodes, null);
    }

    /** Compatibility constructor for existing unit tests; production wiring uses the typed boundary. */
    public BusinessEntityTaskReadService(JdbcTemplate jdbc, OrganizationNodeLookup nodes) {
        this(new BusinessEntityTaskReadPersistence(jdbc), nodes);
    }

    public BusinessEntityTaskReadService(
            JdbcTemplate jdbc, ExtensionDefinitionLookup definitions, OrganizationNodeLookup nodes) {
        this(new BusinessEntityTaskReadPersistence(jdbc), nodes, definitions);
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
        return persistence.authorizedBrands(workspaceUuid, groupWorkspaceKey, headCompanyId);
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
        Map<UUID, List<OrganizationEntityReadback>> brandsByHeadCompanyId = new java.util.LinkedHashMap<>();
        ids.forEach(id -> brandsByHeadCompanyId.put(id, new ArrayList<>()));
        Set<UUID> foundHeadCompanyIds = new java.util.HashSet<>();
        persistence
                .authorizedBrandsByHeadCompanyIds(workspaceUuid, groupWorkspaceKey, ids)
                .forEach(row -> {
                    foundHeadCompanyIds.add(row.headCompanyId());
                    if (row.brand() != null)
                        brandsByHeadCompanyId.get(row.headCompanyId()).add(row.brand());
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
        return persistence.authorizedBrandAuthorizations(headCompanyId).stream()
                .map(row -> new HeadCompanyBrandAuthorization(row.brandId(), row.authorizedAtEpochMillis()))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isEnterableStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return persistence.isEnterableStore(workspaceUuid, groupWorkspaceKey, storeId);
    }

    @Transactional(readOnly = true)
    public OrganizationOwnerApi.SalesMenuStoreJudgment requireSalesMenuStore(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef) {
        if (workspaceUuid == null || groupWorkspaceKey == null || groupWorkspaceKey.isBlank() || storeRef == null) {
            throw new OrganizationValidationException();
        }
        return persistence
                .salesMenuStore(workspaceUuid, groupWorkspaceKey, storeRef)
                .orElseThrow(OrganizationNotFoundException::new);
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
            CatalogScopeLookup.CatalogBrandJudgment judgment = persistence
                    .storeCatalogBrand(workspaceUuid, groupWorkspaceKey, dataNodeId)
                    .orElseThrow(OrganizationNotFoundException::new);
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
            CatalogScopeLookup.CatalogBrandJudgment judgment = persistence
                    .headCompanyCatalogBrand(workspaceUuid, groupWorkspaceKey, dataNodeId, brand)
                    .orElseThrow(OrganizationValidationException::new);
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
        UUID targetBrand = persistence
                .storeBrand(workspaceUuid, groupWorkspaceKey, targetDataNodeId)
                .orElseThrow(OrganizationNotFoundException::new);
        if (targetBrand == null || !targetBrand.toString().equals(brandRef))
            throw new OrganizationValidationException();
        UUID brand;
        try {
            brand = UUID.fromString(brandRef);
        } catch (IllegalArgumentException ex) {
            throw new OrganizationValidationException(ex);
        }
        UUID source = persistence
                .storeSource(workspaceUuid, groupWorkspaceKey, targetDataNodeId)
                .orElseThrow(OrganizationValidationException::new);
        if (!persistence.sourceBrandAllowed(workspaceUuid, groupWorkspaceKey, source, brand))
            throw new OrganizationValidationException();
        return source;
    }

    @Transactional(readOnly = true)
    public boolean isEnterableEntity(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = entityType(entityType);
        return persistence.isEnabled(type, workspaceUuid, groupWorkspaceKey, entityId);
    }

    @Transactional(readOnly = true)
    public String describeEntityPath(UUID workspaceUuid, String groupWorkspaceKey, String entityType, UUID entityId) {
        String type = Objects.requireNonNullElse(entityType, "").toUpperCase(Locale.ROOT);
        if (BusinessEntityTypes.HEAD_COMPANY.equals(type)) {
            OrganizationEntityReadback value = requireEntity(type, workspaceUuid, groupWorkspaceKey, entityId);
            return value.code() + " " + value.name();
        }
        if (ServiceNodeTypes.STORE.equals(type)) {
            BusinessEntityTaskReadPersistence.StorePathFact store = persistence
                    .storePath(workspaceUuid, groupWorkspaceKey, entityId)
                    .orElseThrow(OrganizationNotFoundException::new);
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
        return persistence
                .storeContractContext(workspaceUuid, groupWorkspaceKey, storeId, lockStoreAndTenant)
                .orElseThrow(OrganizationNotFoundException::new);
    }

    @Transactional(readOnly = true)
    public OrganizationEntityReadback requireEntity(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        return persistence
                .findEntity(type, workspaceUuid, groupWorkspaceKey, id)
                .orElseThrow(OrganizationNotFoundException::new);
    }

    /** Server-side target fact for operations capability resolution; never accept a synthesized group id. */
    @Transactional(readOnly = true)
    public UUID requireCommercialGroupId(UUID workspaceUuid, String groupWorkspaceKey) {
        return persistence.commercialGroupId(groupWorkspaceKey).orElseThrow(OrganizationNotFoundException::new);
    }

    /** Server-side project fact for a requested create target; the controller never manufactures a PROJECT resource. */
    @Transactional(readOnly = true)
    public UUID requireProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID projectId) {
        return nodes.requireNode(workspaceUuid, groupWorkspaceKey, projectId, OrganizationNodeTypes.PROJECT)
                .id();
    }

    /** Server-side project fact for an existing store write target; STORE is never a capability target. */
    public UUID requireStoreProjectId(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        return persistence
                .storeProjectId(workspaceUuid, groupWorkspaceKey, storeId)
                .orElseThrow(OrganizationNotFoundException::new);
    }

    /**
     * Narrow immutable facts needed by the operations edge before the owner command performs its authoritative recheck.
     */
    public StoreUpdateFacts readStoreUpdateFacts(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId) {
        BusinessEntityTaskReadPersistence.StoreUpdateFacts facts = persistence
                .storeUpdateFacts(workspaceUuid, groupWorkspaceKey, storeId)
                .orElseThrow(OrganizationNotFoundException::new);
        return new StoreUpdateFacts(facts.projectId(), facts.tenantId(), facts.brandId(), facts.code());
    }

    public record StoreUpdateFacts(UUID projectId, UUID tenantId, UUID brandId, String code) {}

    @Transactional(readOnly = true)
    public List<OrganizationEntityReadback> listEntities(
            String entityType, UUID workspaceUuid, String groupWorkspaceKey) {
        String type = ServiceNodeTypes.STORE.equals(entityType) ? ServiceNodeTypes.STORE : entityType(entityType);
        return persistence.listEntities(type, workspaceUuid, groupWorkspaceKey);
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
        return pageBrands(
                workspaceUuid, groupWorkspaceKey, queryText, status, sort, direction, page, pageSize, null, null);
    }

    @Transactional(readOnly = true)
    public BrandPage pageBrands(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String queryText,
            String status,
            String sort,
            String direction,
            int page,
            int pageSize,
            String extensionFilters,
            String definitionRevision) {
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
                true,
                extensionFilters,
                definitionRevision);
        return new BrandPage(
                values.items().stream().map(BusinessEntityPageItem::entity).toList(),
                values.total(),
                values.page(),
                values.pageSize(),
                values.definitionRevision());
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
        return pageEntities(
                entityType,
                workspaceUuid,
                groupWorkspaceKey,
                name,
                code,
                legalName,
                unifiedSocialCreditCode,
                status,
                sort,
                direction,
                page,
                pageSize,
                null,
                null);
    }

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
            int pageSize,
            String extensionFilters,
            String definitionRevision) {
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
                pageSize,
                false,
                extensionFilters,
                definitionRevision);
        return new EntityPage(
                values.items().stream().map(BusinessEntityPageItem::entity).toList(),
                values.total(),
                values.page(),
                values.pageSize(),
                values.definitionRevision());
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
                null,
                null);
    }

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
            int pageSize,
            String extensionFilters,
            String definitionRevision) {
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
                false,
                extensionFilters,
                definitionRevision);
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
            boolean brandQueryText,
            String extensionFilters,
            String definitionRevision) {
        String type = entityType == null ? null : entityType(entityType);
        ExtensionFilterQuery.Prepared filters =
                prepareFilters(workspaceUuid, groupWorkspaceKey, type, extensionFilters, definitionRevision);
        try {
            BusinessEntityTaskReadPersistence.PageData values = persistence.pageBusinessEntities(
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
                    pageSize,
                    brandQueryText,
                    filters);
            List<BusinessEntityPageItem> items = values.items().stream()
                    .map(item -> new BusinessEntityPageItem(item.entityType(), item.entity()))
                    .toList();
            return new BusinessEntityPage(
                    items, values.total(), values.page(), values.pageSize(), filters.definitionRevision());
        } catch (IllegalArgumentException invalid) {
            throw new OrganizationValidationException(invalid);
        }
    }

    private ExtensionFilterQuery.Prepared prepareFilters(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String entityType,
            String extensionFilters,
            String definitionRevision) {
        if (extensionFilters == null) {
            return ExtensionFilterQuery.Prepared.empty();
        }
        if (entityType == null || definitions == null) {
            throw new ExtensionFilterQuery.InvalidFilterException(
                    List.of(new ExtensionFilterQuery.InvalidReason(entityType, "HOST_TYPE_REQUIRED", null)));
        }
        return ExtensionFilterQuery.prepare(
                definitions, workspaceUuid, groupWorkspaceKey, entityType, extensionFilters, definitionRevision);
    }

    /** Canonical owner lookup when an app knows a business-entity id but not its subtype. */
    @Transactional(readOnly = true)
    public BusinessEntityPageItem requireBusinessEntity(UUID workspaceUuid, String groupWorkspaceKey, UUID entityId) {
        List<BusinessEntityPageItem> values =
                persistence.findBusinessEntity(workspaceUuid, groupWorkspaceKey, entityId).stream()
                        .map(item -> new BusinessEntityPageItem(item.entityType(), item.entity()))
                        .toList();
        if (values.isEmpty()) throw new OrganizationNotFoundException();
        return values.getFirst();
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
        Map<UUID, OrganizationEntityReadback> values =
                persistence.findEntities(type, workspaceUuid, groupWorkspaceKey, ids);
        if (values.size() != ids.size()) throw new OrganizationNotFoundException();
        return values;
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
}
