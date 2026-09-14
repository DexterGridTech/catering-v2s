package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.application.persistence.BusinessChannelPersistence.ChannelProjection;
import com.catering.v2s.businesschannel.application.persistence.BusinessChannelTaskReadPersistence;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only task projections for business-channel and sales-menu eligibility. */
@Service
public class BusinessChannelTaskReadService {
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String SALES_MENU_CHANNEL_INELIGIBLE_PREFIX = "当前只处理门店内部";
    private static final String SALES_MENU_CHANNEL_INELIGIBLE_SUFFIX = "堂食/外带入口";
    private static final String SALES_MENU_CHANNEL_INELIGIBLE_MESSAGE =
            SALES_MENU_CHANNEL_INELIGIBLE_PREFIX + SALES_MENU_CHANNEL_INELIGIBLE_SUFFIX;
    private final BusinessChannelTaskReadPersistence persistence;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final WorkspaceStatusLookup workspaceStatuses;

    @Autowired
    public BusinessChannelTaskReadService(
            BusinessChannelTaskReadPersistence persistence,
            CollaborationCatalogReadApi collaborationCatalog,
            WorkspaceStatusLookup workspaceStatuses) {
        this.persistence = persistence;
        this.collaborationCatalog = collaborationCatalog;
        this.workspaceStatuses = workspaceStatuses;
    }

    /** Compatibility constructor for focused tests and direct owner construction. */
    public BusinessChannelTaskReadService(
            JdbcTemplate jdbc,
            CollaborationCatalogReadApi collaborationCatalog,
            WorkspaceStatusLookup workspaceStatuses) {
        this(new BusinessChannelTaskReadPersistence(jdbc), collaborationCatalog, workspaceStatuses);
    }

    @Transactional(readOnly = true)
    public BusinessChannelOwnerApi.SalesMenuEligibleChannelPage listSalesMenuEligibleChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String storeRef,
            String cursor,
            int pageSize,
            String sortKey,
            String sortDirection) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedStoreRef = BusinessChannelPolicy.required(storeRef, "storeRef", 240);
        int size = pageSize(pageSize);
        String normalizedSortKey = optionalEnum(
                sortKey,
                "sortKey",
                "CHANNEL_NAME",
                "CHANNEL_CODE",
                "TEMPLATE_NAME",
                "ACCESS_KIND",
                "OPERATOR_KIND",
                "ORDER_KIND",
                "STATUS",
                "BINDING_STATUS");
        String normalizedSortDirection = optionalEnum(sortDirection, "sortDirection", "ASC", "DESC");
        if (normalizedSortKey == null && normalizedSortDirection != null) {
            throw problem("VALIDATION_ERROR", 422, "sortDirection requires sortKey");
        }
        String identity = canonical(
                "sales-menu-eligible-channel-page",
                workspaceUuid,
                groupWorkspaceKey,
                normalizedStoreRef,
                size,
                normalizedSortKey,
                normalizedSortDirection);
        OpaqueCollectionCursor.Position position = decodeCursor(cursor, identity);
        List<ChannelProjection> projections = persistence.listSalesMenuEligibleChannels(
                workspaceUuid,
                groupWorkspaceKey,
                normalizedStoreRef,
                position == null ? null : position.tieBreaker(),
                position == null ? null : position.sortKey(),
                size,
                normalizedSortKey,
                normalizedSortDirection);
        boolean hasNext = projections.size() > size;
        List<ChannelProjection> page = hasNext ? projections.subList(0, size) : projections;
        String nextCursor = hasNext
                ? OpaqueCollectionCursor.encode(
                        identity,
                        salesMenuChannelSortValue(page.get(page.size() - 1), normalizedSortKey),
                        page.get(page.size() - 1).channelRef())
                : null;
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, page);
        List<BusinessChannelOwnerApi.SalesMenuEligibleChannel> items = page.stream()
                .map(projection -> salesMenuEligibleChannel(projection, channelRow(projection, facts)))
                .toList();
        return new BusinessChannelOwnerApi.SalesMenuEligibleChannelPage(items, cursor, nextCursor);
    }

    @Transactional(readOnly = true)
    public BusinessChannelOwnerApi.SalesMenuChannelJudgment requireSalesMenuChannel(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedStoreRef = BusinessChannelPolicy.required(storeRef, "storeRef", 240);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        List<ChannelProjection> projections = persistence.requireSalesMenuChannel(
                workspaceUuid, groupWorkspaceKey, normalizedStoreRef, channelRef);
        if (projections.isEmpty()) throw salesMenuChannelIneligible();
        return salesMenuChannelJudgment(projections.get(0));
    }

    @Transactional(readOnly = true)
    public boolean salesMenuChannelBelongsToStore(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedStoreRef = BusinessChannelPolicy.required(storeRef, "storeRef", 240);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return persistence.salesMenuChannelBelongsToStore(
                workspaceUuid, groupWorkspaceKey, normalizedStoreRef, channelRef);
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.ChannelWithTemplateProvider readChannelWithTemplateProvider(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        ChannelProjection projection = persistence
                .readChannelWithTemplateProvider(workspaceUuid, groupWorkspaceKey, channelRef)
                .orElseThrow(() -> problem("NOT_FOUND", 404, "channel was not found in the workspace"));
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection));
        return new BusinessChannelReadback.ChannelWithTemplateProvider(
                channel(channelRow(projection, facts)), projection.templateProviderCode());
    }

    @Transactional(readOnly = true)
    public List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        List<ChannelProjection> projections = persistence.findChannelsForBinding(
                workspaceUuid, groupWorkspaceKey, bindingRef);
        StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, projections);
        return projections.stream()
                .map(projection -> channel(channelRow(projection, facts)))
                .toList();
    }

    private StatusFacts statusFacts(
            UUID workspaceUuid, String groupWorkspaceKey, List<ChannelProjection> channels) {
        return statusFacts(workspaceUuid, groupWorkspaceKey, channels, null);
    }

    private StatusFacts statusFacts(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            List<ChannelProjection> channels,
            CollaborationReadback.Tree preloadedTree) {
        String workspaceStatus = workspaceStatuses.requireStatus(workspaceUuid, groupWorkspaceKey);
        LinkedHashSet<UUID> organizationRefs = new LinkedHashSet<>();
        boolean needsCollaborationTree = false;
        for (ChannelProjection channel : channels) {
            addRef(organizationRefs, channel.templateProjectRef());
            addRef(organizationRefs, channel.targetProjectRef());
            addRef(organizationRefs, channel.targetStoreProjectRef());
            if (BusinessChannelPolicy.EXTERNAL.equals(channel.templateAccessKind())
                    && channel.templateProviderCode() != null
                    && !channel.templateProviderCode().isBlank()) {
                needsCollaborationTree = true;
            }
        }
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors =
                readOrganizationAncestors(workspaceUuid, groupWorkspaceKey, organizationRefs);
        Map<String, CollaborationReadback.ProviderProfile> providers = new HashMap<>();
        Map<String, CollaborationReadback.ExternalSystem> externalSystems = new HashMap<>();
        if (needsCollaborationTree) {
            CollaborationReadback.Tree tree = preloadedTree == null
                    ? collaborationCatalog.readTree(workspaceUuid, groupWorkspaceKey)
                    : preloadedTree;
            if (tree != null) {
                for (CollaborationReadback.ProviderProfile provider : tree.providerProfiles()) {
                    providers.put(provider.providerCode(), provider);
                }
                for (CollaborationReadback.ExternalSystem externalSystem : tree.externalSystems()) {
                    externalSystems.put(externalSystem.externalSystemCode(), externalSystem);
                }
            }
        }
        return new StatusFacts(workspaceStatus, ancestors, providers, externalSystems);
    }

    private static void addRef(Set<UUID> refs, UUID ref) {
        if (ref != null) refs.add(ref);
    }

    private Map<UUID, List<BusinessChannelReadback.StatusDimension>> readOrganizationAncestors(
            UUID workspaceUuid, String groupWorkspaceKey, Set<UUID> nodeRefs) {
        return persistence.readOrganizationAncestors(workspaceUuid, groupWorkspaceKey, nodeRefs);
    }

    private ChannelRow channelRow(ChannelProjection projection, StatusFacts facts) {
        List<BusinessChannelReadback.StatusDimension> dimensions = new ArrayList<>();
        addWorkspaceDimension(dimensions, projection.groupWorkspaceKey(), facts);
        addDimension(dimensions, "BUSINESS_CHANNEL_TEMPLATE", projection.templateRef(), projection.templateStatus());
        addDimension(
                dimensions,
                "ORGANIZATION_PROJECT",
                projection.templateProjectRef(),
                projection.templateProjectStatus());
        appendOrganizationAncestors(dimensions, facts, projection.templateProjectRef());
        addDimension(
                dimensions,
                projection.targetNodeType() == null ? null : "ORGANIZATION_" + projection.targetNodeType(),
                projection.targetNodeRef(),
                projection.targetNodeStatus());
        appendOrganizationAncestors(dimensions, facts, projection.targetProjectRef());
        addDimension(
                dimensions,
                "ORGANIZATION_PROJECT",
                projection.targetStoreProjectRef(),
                projection.targetStoreProjectStatus());
        appendOrganizationAncestors(dimensions, facts, projection.targetStoreProjectRef());
        addDimension(dimensions, "ORGANIZATION_STORE", projection.targetNodeRef(), projection.targetStoreStatus());
        // spotless:off
        addDimension(
                dimensions,
                "ORGANIZATION_TENANT",
                projection.targetTenantRef(),
                projection.targetTenantStatus());
        addDimension(
                dimensions,
                "ORGANIZATION_BRAND",
                projection.targetBrandRef(),
                projection.targetBrandStatus());
        addDimension(
                dimensions,
                "COLLABORATION_BINDING",
                projection.bindingRef(),
                projection.bindingLifecycleStatus());
        // spotless:on
        appendCollaborationDimensions(
                dimensions, facts, projection.templateAccessKind(), projection.templateProviderCode());
        List<BusinessChannelReadback.StatusDimension> blockers = dimensions.stream()
                .filter(BusinessChannelTaskReadService::isBlocker)
                .toList();
        return new ChannelRow(
                projection.channelRef(),
                projection.templateRef(),
                projection.targetNodeType(),
                projection.targetNodeRef(),
                projection.channelCode(),
                projection.channelName(),
                projection.bindingRef(),
                bindingStatus(projection.templateAccessKind(), projection.bindingRef()),
                projection.status(),
                dimensions,
                blockers,
                projection.version());
    }

    private static void appendOrganizationAncestors(
            List<BusinessChannelReadback.StatusDimension> dimensions, StatusFacts facts, UUID nodeRef) {
        if (nodeRef == null) return;
        for (BusinessChannelReadback.StatusDimension dimension : facts.organizationAncestors(nodeRef)) {
            addDimension(dimensions, dimension.type(), dimension.ref(), dimension.status());
        }
    }

    private void appendCollaborationDimensions(
            List<BusinessChannelReadback.StatusDimension> dimensions,
            StatusFacts facts,
            String accessKind,
            String providerCode) {
        if (!BusinessChannelPolicy.EXTERNAL.equals(accessKind) || providerCode == null || providerCode.isBlank())
            return;
        CollaborationReadback.ProviderProfile provider = facts.provider(providerCode);
        if (provider == null) {
            // spotless:off
            throw problem(
                    "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                    500,
                    "external channel provider readback is missing");
            // spotless:on
        }
        addDimension(
                dimensions, "COLLABORATION_PROVIDER_PROFILE", provider.providerCode(), provider.enablementStatus());
        if (provider.externalSystemCode() != null
                && !provider.externalSystemCode().isBlank()) {
            CollaborationReadback.ExternalSystem externalSystem = facts.externalSystem(provider.externalSystemCode());
            if (externalSystem == null) {
                throw problem(
                        "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
                        500,
                        "external channel system readback is missing");
            }
            addDimension(
                    dimensions,
                    "COLLABORATION_EXTERNAL_SYSTEM",
                    externalSystem.externalSystemCode(),
                    externalSystem.enablementStatus());
        }
    }

    private static void addDimension(
            List<BusinessChannelReadback.StatusDimension> dimensions, String type, UUID ref, String status) {
        if (ref != null && status != null) {
            addDimension(dimensions, type, ref.toString(), status);
        }
    }

    private static void addDimension(
            List<BusinessChannelReadback.StatusDimension> dimensions, String type, String ref, String status) {
        if (ref == null || ref.isBlank() || status == null || status.isBlank()) return;
        boolean duplicate = dimensions.stream()
                .anyMatch(existing ->
                        existing.type().equals(type) && existing.ref().equals(ref));
        if (!duplicate) dimensions.add(new BusinessChannelReadback.StatusDimension(type, ref, status));
    }

    private void addWorkspaceDimension(
            List<BusinessChannelReadback.StatusDimension> dimensions, String groupWorkspaceKey, StatusFacts facts) {
        addDimension(dimensions, "GROUP_WORKSPACE", groupWorkspaceKey, facts.workspaceStatus());
    }

    private static boolean isBlocker(BusinessChannelReadback.StatusDimension dimension) {
        return !"COLLABORATION_BINDING".equals(dimension.type())
                && !BusinessChannelPolicy.ENABLED.equals(dimension.status());
    }

    private static OpaqueCollectionCursor.Position decodeCursor(String cursor, String identity) {
        try {
            return OpaqueCollectionCursor.decode(cursor, identity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw problem("VALIDATION_ERROR", 422, "cursor is invalid", failure);
        }
    }

    private static int pageSize(int requested) {
        int value = requested == 0 ? DEFAULT_PAGE_SIZE : requested;
        if (value < 1 || value > MAX_PAGE_SIZE) throw problem("VALIDATION_ERROR", 422, "pageSize is invalid");
        return value;
    }

    private static String optionalEnum(String value, String name, String... allowed) {
        if (value == null) return null;
        return BusinessChannelPolicy.requireEnum(value, name, allowed);
    }

    private static String salesMenuChannelSortValue(ChannelProjection row, String sortKey) {
        if (sortKey == null) return row.channelRef().toString();
        return switch (sortKey) {
            case "CHANNEL_NAME" -> Objects.toString(row.channelName(), "");
            case "CHANNEL_CODE" -> Objects.toString(row.channelCode(), "");
            case "TEMPLATE_NAME" -> Objects.toString(row.templateName(), "");
            case "ACCESS_KIND" -> row.templateAccessKind();
            case "OPERATOR_KIND" -> row.templateOperatorKind();
            case "ORDER_KIND" -> row.templateOrderKind();
            case "STATUS" -> row.status();
            case "BINDING_STATUS" -> switch (bindingStatus(row.templateAccessKind(), row.bindingRef())) {
                case "NOT_REQUIRED" -> "0";
                case "UNBOUND" -> "1";
                default -> "2";
            };
            default -> throw problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
    }

    private static void requireScope(UUID workspaceUuid, String groupWorkspaceKey) {
        if (workspaceUuid == null) throw problem("VALIDATION_ERROR", 422, "workspaceUuid is required");
        BusinessChannelPolicy.required(groupWorkspaceKey, "groupWorkspaceKey", 120);
    }

    private static BusinessChannelReadback.Channel channel(ChannelRow row) {
        return new BusinessChannelReadback.Channel(
                row.channelRef(),
                row.templateRef(),
                row.ownerNodeType(),
                row.ownerNodeRef(),
                row.channelCode(),
                row.channelName(),
                row.bindingRef(),
                row.bindingStatus(),
                row.status(),
                row.statusDimensions(),
                row.blockers(),
                row.version());
    }

    private static BusinessChannelOwnerApi.SalesMenuEligibleChannel salesMenuEligibleChannel(
            ChannelProjection projection, ChannelRow row) {
        return new BusinessChannelOwnerApi.SalesMenuEligibleChannel(
                projection.channelRef(),
                projection.templateRef(),
                projection.targetNodeRef(),
                projection.channelCode(),
                projection.channelName(),
                projection.templateAccessKind(),
                projection.templateOperatorKind(),
                projection.templateOrderKind(),
                row.bindingStatus(),
                projection.status(),
                row.statusDimensions(),
                row.blockers(),
                projection.version());
    }

    private static BusinessChannelOwnerApi.SalesMenuChannelJudgment salesMenuChannelJudgment(
            ChannelProjection projection) {
        return new BusinessChannelOwnerApi.SalesMenuChannelJudgment(
                projection.channelRef(),
                projection.templateRef(),
                projection.targetNodeRef(),
                projection.templateAccessKind(),
                projection.templateOperatorKind(),
                projection.templateOrderKind(),
                bindingStatus(projection.templateAccessKind(), projection.bindingRef()),
                projection.status(),
                projection.version());
    }

    private static ChannelRow channelRow(BusinessChannelReadback.Channel value) {
        if (value == null) throw problem("NOT_FOUND", 404, "channel was not found in the workspace");
        return new ChannelRow(
                value.channelRef(),
                value.templateRef(),
                value.ownerNodeType(),
                value.ownerNodeRef(),
                value.channelCode(),
                value.channelName(),
                value.bindingRef(),
                value.bindingStatus(),
                value.status(),
                value.statusDimensions(),
                value.blockers(),
                value.version());
    }

    private static String bindingStatus(String accessKind, UUID bindingRef) {
        if (BusinessChannelPolicy.INTERNAL.equals(accessKind)) return "NOT_REQUIRED";
        return bindingRef == null ? "UNBOUND" : "BOUND";
    }

    private static String canonical(String operation, Object... values) {
        return operation + "\u001f"
                + Arrays.stream(values)
                        .map(value -> Objects.toString(value, "<null>"))
                        .collect(Collectors.joining("\u001f"));
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message) {
        return new BusinessChannelCommandApi.Problem(code, status, message);
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message, Throwable cause) {
        return new BusinessChannelCommandApi.Problem(code, status, message, cause);
    }

    private static BusinessChannelCommandApi.Problem salesMenuChannelIneligible() {
        return problem("SALES_MENU_CHANNEL_INELIGIBLE", 422, SALES_MENU_CHANNEL_INELIGIBLE_MESSAGE);
    }

    private record StatusFacts(
            String workspaceStatus,
            Map<UUID, List<BusinessChannelReadback.StatusDimension>> organizationAncestors,
            Map<String, CollaborationReadback.ProviderProfile> providers,
            Map<String, CollaborationReadback.ExternalSystem> externalSystems) {
        List<BusinessChannelReadback.StatusDimension> organizationAncestors(UUID nodeRef) {
            return organizationAncestors.getOrDefault(nodeRef, List.of());
        }

        CollaborationReadback.ProviderProfile provider(String providerCode) {
            return providers.get(providerCode);
        }

        CollaborationReadback.ExternalSystem externalSystem(String externalSystemCode) {
            return externalSystems.get(externalSystemCode);
        }
    }

    private record ChannelRow(
            UUID channelRef,
            UUID templateRef,
            String ownerNodeType,
            String ownerNodeRef,
            String channelCode,
            String channelName,
            UUID bindingRef,
            String bindingStatus,
            String status,
            List<BusinessChannelReadback.StatusDimension> statusDimensions,
            List<BusinessChannelReadback.StatusDimension> blockers,
            long version) {}

}
