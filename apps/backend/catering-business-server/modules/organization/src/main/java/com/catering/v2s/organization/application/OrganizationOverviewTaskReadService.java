package com.catering.v2s.organization.application;

import com.catering.v2s.extension.api.ExtensionDefinitionLookup;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import com.catering.v2s.organization.api.OperationsStoreCommandApi;
import com.catering.v2s.organization.application.persistence.OrganizationOverviewTaskReadPersistence;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Platform organization overview read model exposed through a typed persistence boundary. */
@Service
public class OrganizationOverviewTaskReadService implements OperationsStoreCommandApi.StoreDetailReadbackApi {
    private static final String SORT_DIRECTION_DESC = "DESC";
    private final OrganizationOverviewTaskReadPersistence persistence;

    public OrganizationOverviewTaskReadService(JdbcTemplate jdbc) {
        this(new OrganizationOverviewTaskReadPersistence(jdbc));
    }

    public OrganizationOverviewTaskReadService(
            JdbcTemplate jdbc, ExtensionDefinitionLookup definitions, BusinessEntityService businessEntities) {
        this(new OrganizationOverviewTaskReadPersistence(jdbc, definitions, businessEntities));
    }

    public OrganizationOverviewTaskReadService(
            JdbcTemplate jdbc,
            ExtensionDefinitionLookup definitions,
            BusinessEntityService businessEntities,
            OrganizationHierarchyService hierarchy,
            OrganizationCommandService commercialGroups) {
        this(new OrganizationOverviewTaskReadPersistence(
                jdbc, definitions, businessEntities, hierarchy, commercialGroups));
    }

    @Autowired
    public OrganizationOverviewTaskReadService(OrganizationOverviewTaskReadPersistence persistence) {
        this.persistence = persistence;
    }

    @Transactional(readOnly = true)
    public Page page(UUID workspaceUuid, String key, String category, int page, int pageSize) {
        return persistence.page(workspaceUuid, key, category, page, pageSize);
    }

    @Transactional(readOnly = true)
    public Page page(UUID workspaceUuid, String key, String category, Query query, int page, int pageSize) {
        return persistence.page(workspaceUuid, key, category, query, page, pageSize);
    }

    @Transactional(readOnly = true)
    public Page platformOverviewTaskPage(
            UUID workspaceUuid, String key, String category, Query query, int page, int pageSize) {
        return persistence.platformOverviewTaskPage(workspaceUuid, key, category, query, page, pageSize);
    }

    @Transactional(readOnly = true)
    public Item detail(UUID workspaceUuid, String key, String category, UUID itemId) {
        return persistence.detail(workspaceUuid, key, category, itemId);
    }

    @Override
    @Transactional(readOnly = true)
    public OperationsStoreCommandApi.StoreOrganizationDetailReadback readStoreDetail(
            OperationsStoreCommandApi.StoreDetailQuery query) {
        return persistence.readStoreDetail(query);
    }

    @Transactional(readOnly = true)
    public PlatformManagementBaseDetail platformManagementBaseDetail(
            UUID workspaceUuid, String key, String category, UUID itemId) {
        return persistence.platformManagementBaseDetail(workspaceUuid, key, category, itemId);
    }

    public Item withPlatformManagementDefinition(
            PlatformManagementBaseDetail base, ExtensionDefinitionReadback definition) {
        return persistence.withPlatformManagementDefinition(base, definition);
    }

    @Transactional(readOnly = true)
    public HierarchyTree hierarchyTree(UUID workspaceUuid, String key) {
        return persistence.hierarchyTree(workspaceUuid, key);
    }

    @Transactional(readOnly = true)
    public HierarchyTree platformHierarchyTree(UUID workspaceUuid, String key) {
        return persistence.platformHierarchyTree(workspaceUuid, key);
    }

    public static final class QueryValidationException extends IllegalArgumentException {
        public QueryValidationException(String message) {
            super(message);
        }
    }

    public record Query(
            String type,
            String name,
            String code,
            String legalName,
            String unifiedSocialCreditCode,
            String status,
            String source,
            UUID projectId,
            UUID brandId,
            UUID tenantId,
            UUID headCompanyId,
            String sort,
            String direction,
            UUID scopeNodeId,
            String extensionFilters,
            String definitionRevision) {
        public Query(
                String type,
                String name,
                String code,
                String legalName,
                String unifiedSocialCreditCode,
                String status,
                String source,
                UUID projectId,
                UUID brandId,
                UUID tenantId,
                String sort,
                String direction) {
            this(
                    type,
                    name,
                    code,
                    legalName,
                    unifiedSocialCreditCode,
                    status,
                    source,
                    projectId,
                    brandId,
                    tenantId,
                    null,
                    sort,
                    direction,
                    null,
                    null,
                    null);
        }

        public Query(
                String type,
                String name,
                String code,
                String legalName,
                String unifiedSocialCreditCode,
                String status,
                String source,
                UUID projectId,
                UUID brandId,
                UUID tenantId,
                String sort,
                String direction,
                UUID scopeNodeId) {
            this(
                    type,
                    name,
                    code,
                    legalName,
                    unifiedSocialCreditCode,
                    status,
                    source,
                    projectId,
                    brandId,
                    tenantId,
                    null,
                    sort,
                    direction,
                    scopeNodeId,
                    null,
                    null);
        }

        public static Query empty() {
            return new Query(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    "UPDATED_AT",
                    SORT_DIRECTION_DESC,
                    null,
                    null,
                    null);
        }

        public Query validated(String category) {
            String safeSort = sort == null ? "UPDATED_AT" : sort;
            String safeDirection = direction == null ? SORT_DIRECTION_DESC : direction;
            if (!List.of("NAME", "CODE", "UPDATED_AT").contains(safeSort)
                    || !List.of("ASC", "DESC").contains(safeDirection)
                    || !validStatus(status)
                    || (source != null && !List.of("MANUAL", "SYSTEM").contains(source)))
                throw new QueryValidationException("invalid overview query");
            if ("HIERARCHY".equals(category)) {
                if (extensionFilters != null && !extensionFilters.isBlank())
                    throw new QueryValidationException("extension filters are not applicable to hierarchy");
                if (type != null
                                && !List.of(
                                                com.catering.v2s.organization.api.OrganizationNodeTypes.REGION,
                                                com.catering.v2s.organization.api.OrganizationNodeTypes.PROJECT)
                                        .contains(type)
                        || brandId != null
                        || tenantId != null
                        || headCompanyId != null) throw new QueryValidationException("invalid hierarchy query");
            } else if ("BUSINESS_ENTITY".equals(category)) {
                if (type != null
                                && !List.of(
                                                "BRAND",
                                                "TENANT",
                                                com.catering.v2s.organization.api.BusinessEntityTypes.HEAD_COMPANY)
                                        .contains(type)
                        || projectId != null
                        || brandId != null
                        || tenantId != null
                        || headCompanyId != null) throw new QueryValidationException("invalid entity query");
            } else if (com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE.equals(category)) {
                if (type != null && !com.catering.v2s.platform.foundation.contract.ServiceNodeTypes.STORE.equals(type))
                    throw new QueryValidationException("invalid store query");
            } else throw new QueryValidationException("unsupported overview category");
            if (!"BUSINESS_ENTITY".equals(category) && (legalName != null || unifiedSocialCreditCode != null))
                throw new QueryValidationException("invalid overview query");
            if ("BUSINESS_ENTITY".equals(category)
                    && ("BRAND".equals(type) && (legalName != null || unifiedSocialCreditCode != null)))
                throw new QueryValidationException("invalid brand legal query");
            return new Query(
                    type,
                    name,
                    code,
                    legalName,
                    unifiedSocialCreditCode,
                    status,
                    source,
                    projectId,
                    brandId,
                    tenantId,
                    headCompanyId,
                    safeSort,
                    safeDirection,
                    scopeNodeId,
                    extensionFilters,
                    definitionRevision);
        }

        private static boolean validStatus(String status) {
            if (status == null) return true;
            return List.of("ENABLED", "DISABLED", "VOIDED").contains(status);
        }
    }

    public record HierarchyTree(String groupCode, String groupName, List<TreeNode> regions) {}

    public record TreeNode(
            UUID id,
            String type,
            String code,
            String name,
            String status,
            String notes,
            long updatedAt,
            List<TreeNode> children,
            List<String> phases) {}

    public record Page(
            Metadata metadata,
            List<Item> items,
            String itemsSourceStatus,
            long itemsAsOf,
            List<String> itemsUnresolved,
            List<FilterOption> filterOptions,
            String filterOptionsSourceStatus,
            long filterOptionsAsOf,
            List<String> filterOptionsUnresolved) {}

    public record Metadata(
            String groupWorkspaceKey,
            String category,
            int page,
            int pageSize,
            long total,
            String sort,
            String direction,
            Long definitionRevision) {
        public Metadata(
                String groupWorkspaceKey,
                String category,
                int page,
                int pageSize,
                long total,
                String sort,
                String direction) {
            this(groupWorkspaceKey, category, page, pageSize, total, sort, direction, null);
        }
    }

    public record Item(
            UUID id,
            String groupWorkspaceKey,
            String category,
            String type,
            String code,
            String name,
            List<Reference> path,
            String status,
            String source,
            long version,
            long createdAt,
            long updatedAt,
            String notes,
            String legalName,
            String unifiedSocialCreditCode,
            Reference project,
            Reference brand,
            Reference tenant,
            Reference headCompany,
            List<String> unresolvedReferences,
            List<ExtensionDisplayField> extensionFields,
            String alias,
            Map<String, String> extensionValues,
            long extensionRuleRevision) {
        public Item(
                UUID id,
                String groupWorkspaceKey,
                String category,
                String type,
                String code,
                String name,
                List<Reference> path,
                String status,
                String source,
                long version,
                long createdAt,
                long updatedAt,
                String notes,
                String legalName,
                String unifiedSocialCreditCode,
                Reference project,
                Reference brand,
                Reference tenant,
                Reference headCompany,
                List<String> unresolvedReferences,
                List<ExtensionDisplayField> extensionFields,
                String alias) {
            this(
                    id,
                    groupWorkspaceKey,
                    category,
                    type,
                    code,
                    name,
                    path,
                    status,
                    source,
                    version,
                    createdAt,
                    updatedAt,
                    notes,
                    legalName,
                    unifiedSocialCreditCode,
                    project,
                    brand,
                    tenant,
                    headCompany,
                    unresolvedReferences,
                    extensionFields,
                    alias,
                    Map.of(),
                    0L);
        }
    }

    public record PlatformManagementBaseDetail(Item item, java.util.Map<String, String> extensionValues) {}

    public record ExtensionDisplayField(String name, String value) {}

    public record Reference(UUID id, String code, String name, boolean resolved) {}

    public record FilterOption(String kind, UUID id, String code, String name) {}
}
