package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    private final JdbcTemplate jdbc;
    private final CollaborationCatalogReadApi collaborationCatalog;
    private final WorkspaceStatusLookup workspaceStatuses;

    @Autowired
    public BusinessChannelTaskReadService(
            JdbcTemplate jdbc,
            CollaborationCatalogReadApi collaborationCatalog,
            WorkspaceStatusLookup workspaceStatuses) {
        this.jdbc = jdbc;
        this.collaborationCatalog = collaborationCatalog;
        this.workspaceStatuses = workspaceStatuses;
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
        List<Object> arguments = new ArrayList<>(List.of(workspaceUuid, groupWorkspaceKey, normalizedStoreRef));
        StringBuilder predicate = new StringBuilder(
                " WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.target_node_type='STORE'"
                        + " AND c.target_node_ref=? AND target_store.id IS NOT NULL"
                        + " AND t.access_kind='INTERNAL' AND t.operator_kind='STORE'"
                        + " AND t.order_kind IN ('DINE_IN','TAKEAWAY')");
        appendSalesMenuChannelCursorPredicate(
                predicate, arguments, position, normalizedSortKey, normalizedSortDirection);
        List<ChannelProjection> projections = query(
                BusinessChannelQuerySupport.channelProjection("JOIN business_channel.business_channel_template t "
                                + "ON t.template_ref=c.template_ref AND t.workspace_uuid=c.workspace_uuid "
                                + "AND t.group_workspace_key=c.group_workspace_key ")
                        + predicate
                        + " ORDER BY "
                        + salesMenuChannelOrderBy(normalizedSortKey, normalizedSortDirection)
                        + " LIMIT ?",
                append(arguments, size + 1),
                this::mapChannelProjection);
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
        List<ChannelProjection> projections = query(
                BusinessChannelQuerySupport.channelSelect(
                                "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? "
                        + "AND c.target_node_type='STORE' AND c.target_node_ref=? "
                        + "AND target_store.id IS NOT NULL AND t.access_kind='INTERNAL' "
                        + "AND t.operator_kind='STORE' AND t.order_kind IN ('DINE_IN','TAKEAWAY')"),
                List.of(workspaceUuid, groupWorkspaceKey, channelRef, normalizedStoreRef),
                this::mapChannelProjection);
        if (projections.isEmpty()) throw salesMenuChannelIneligible();
        return salesMenuChannelJudgment(projections.get(0));
    }

    @Transactional(readOnly = true)
    public boolean salesMenuChannelBelongsToStore(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        String normalizedStoreRef = BusinessChannelPolicy.required(storeRef, "storeRef", 240);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return !query(
                        BusinessChannelQuerySupport.channelSelect(
                                "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=? "
                                        + "AND c.target_node_type='STORE' AND c.target_node_ref=? "
                                        + "AND target_store.id IS NOT NULL"),
                        List.of(workspaceUuid, groupWorkspaceKey, channelRef, normalizedStoreRef),
                        this::mapChannelProjection)
                .isEmpty();
    }

    @Transactional(readOnly = true)
    public BusinessChannelReadback.ChannelWithTemplateProvider readChannelWithTemplateProvider(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (channelRef == null) throw problem("VALIDATION_ERROR", 422, "channelRef is required");
        return jdbc.query(
                BusinessChannelQuerySupport.channelCommandSelect(
                        "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.channel_ref=?"),
                statement -> {
                    statement.setObject(1, workspaceUuid);
                    statement.setString(2, groupWorkspaceKey);
                    statement.setObject(3, channelRef);
                },
                result -> {
                    if (!result.next()) throw problem("NOT_FOUND", 404, "channel was not found in the workspace");
                    ChannelProjection projection = mapChannelProjection(result);
                    StatusFacts facts = statusFacts(workspaceUuid, groupWorkspaceKey, List.of(projection));
                    return new BusinessChannelReadback.ChannelWithTemplateProvider(
                            channel(channelRow(projection, facts)), projection.templateProviderCode());
                });
    }

    @Transactional(readOnly = true)
    public List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        requireScope(workspaceUuid, groupWorkspaceKey);
        if (bindingRef == null) throw problem("VALIDATION_ERROR", 422, "bindingRef is required");
        List<ChannelProjection> projections = query(
                BusinessChannelQuerySupport.channelSelect(
                        "WHERE c.workspace_uuid=? AND c.group_workspace_key=? AND c.binding_ref=?"
                                + " ORDER BY channel_ref"),
                List.of(workspaceUuid, groupWorkspaceKey, bindingRef),
                this::mapChannelProjection);
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
        if (workspaceUuid == null || groupWorkspaceKey == null || nodeRefs == null || nodeRefs.isEmpty()) {
            return Map.of();
        }
        List<UUID> refs = new ArrayList<>(nodeRefs);
        String placeholders = refs.stream().map(ignored -> "?").collect(Collectors.joining(", "));
        List<Object> arguments = new ArrayList<>(refs);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        arguments.add(workspaceUuid);
        arguments.add(groupWorkspaceKey);
        Map<UUID, List<BusinessChannelReadback.StatusDimension>> ancestors = new LinkedHashMap<>();
        jdbc.query(
                "WITH RECURSIVE ancestry AS ("
                        + "SELECT id AS source_ref, id, parent_id, node_type, status, 0 AS depth "
                        + "FROM organization.organization_node "
                        + "WHERE id IN ("
                        + placeholders
                        + ") AND workspace_uuid=? AND group_workspace_key=? "
                        + "UNION ALL SELECT child.source_ref, parent.id, parent.parent_id, "
                        + "parent.node_type, parent.status, child.depth+1 "
                        + "FROM organization.organization_node parent JOIN ancestry child ON parent.id=child.parent_id "
                        + "WHERE parent.workspace_uuid=? AND parent.group_workspace_key=? ) "
                        + "SELECT source_ref, node_type, id, status FROM ancestry ORDER BY source_ref, depth DESC",
                statement -> bind(statement, arguments),
                result -> {
                    while (result.next()) {
                        UUID sourceRef = result.getObject("source_ref", UUID.class);
                        ancestors
                                .computeIfAbsent(sourceRef, ignored -> new ArrayList<>())
                                .add(new BusinessChannelReadback.StatusDimension(
                                        "ORGANIZATION_" + result.getString("node_type"),
                                        result.getObject("id", UUID.class).toString(),
                                        result.getString("status")));
                    }
                    return null;
                });
        return ancestors;
    }

    private ChannelProjection mapChannelProjection(ResultSet result, int rowNumber) throws SQLException {
        return mapChannelProjection(result);
    }

    private ChannelProjection mapChannelProjection(ResultSet result) throws SQLException {
        return new ChannelProjection(
                result.getObject("workspace_uuid", UUID.class),
                result.getString("group_workspace_key"),
                result.getObject("channel_ref", UUID.class),
                result.getObject("template_ref", UUID.class),
                result.getString("target_node_type"),
                result.getString("target_node_ref"),
                result.getString("channel_code"),
                result.getString("channel_name"),
                result.getObject("binding_ref", UUID.class),
                result.getString("template_access_kind"),
                result.getString("status"),
                result.getLong("version"),
                result.getObject("template_project_ref", UUID.class),
                result.getString("template_name"),
                result.getString("template_code"),
                result.getString("template_operator_kind"),
                result.getString("template_order_kind"),
                result.getString("template_dine_in_form"),
                result.getString("template_provider_code"),
                result.getString("template_status"),
                result.getLong("template_version"),
                result.getString("template_project_status"),
                result.getObject("target_project_ref", UUID.class),
                result.getString("target_node_status"),
                result.getObject("target_store_project_ref", UUID.class),
                result.getString("target_store_project_status"),
                result.getString("target_store_status"),
                result.getObject("target_tenant_ref", UUID.class),
                result.getString("target_tenant_status"),
                result.getObject("target_brand_ref", UUID.class),
                result.getString("target_brand_status"),
                result.getString("binding_lifecycle_status"),
                result.getString("provider_status"));
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

    private <T> List<T> query(String sql, List<Object> arguments, org.springframework.jdbc.core.RowMapper<T> mapper) {
        return jdbc.query(sql, statement -> bind(statement, arguments), mapper);
    }

    private static void bind(PreparedStatement statement, List<Object> arguments) throws SQLException {
        for (int index = 0; index < arguments.size(); index++) statement.setObject(index + 1, arguments.get(index));
    }

    private static List<Object> append(List<Object> values, Object value) {
        List<Object> result = new ArrayList<>(values);
        result.add(value);
        return result;
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

    private static void appendSalesMenuChannelCursorPredicate(
            StringBuilder predicate,
            List<Object> arguments,
            OpaqueCollectionCursor.Position position,
            String sortKey,
            String sortDirection) {
        if (position == null) return;
        if (sortKey == null) {
            predicate.append(" AND c.channel_ref > ?");
            arguments.add(position.tieBreaker());
            return;
        }
        String expression = salesMenuChannelSortExpression(sortKey);
        String comparison = "DESC".equals(sortDirection) ? "<" : ">";
        predicate
                .append(" AND (")
                .append(expression)
                .append(' ')
                .append(comparison)
                .append(" ? OR (")
                .append(expression)
                .append(" = ? AND c.channel_ref > ?))");
        arguments.add(position.sortKey());
        arguments.add(position.sortKey());
        arguments.add(position.tieBreaker());
    }

    private static String salesMenuChannelOrderBy(String sortKey, String sortDirection) {
        if (sortKey == null) return "c.channel_ref";
        return salesMenuChannelSortExpression(sortKey) + " " + direction(sortDirection) + ", c.channel_ref";
    }

    private static String salesMenuChannelSortExpression(String sortKey) {
        return switch (sortKey) {
            case "CHANNEL_NAME" -> "COALESCE(c.channel_name, '')";
            case "CHANNEL_CODE" -> "COALESCE(c.channel_code, '')";
            case "TEMPLATE_NAME" -> "COALESCE(t.template_name, '')";
            case "ACCESS_KIND" -> "t.access_kind";
            case "OPERATOR_KIND" -> "t.operator_kind";
            case "ORDER_KIND" -> "t.order_kind";
            case "STATUS" -> "c.status";
            case "BINDING_STATUS" -> "CAST(CASE WHEN t.access_kind='INTERNAL' THEN 0 WHEN c.binding_ref IS NULL "
                    + "THEN 1 ELSE 2 END AS TEXT)";
            default -> throw problem("VALIDATION_ERROR", 422, "sortKey is not supported");
        };
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

    private static String direction(String sortDirection) {
        return "DESC".equals(sortDirection) ? "DESC" : "ASC";
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

    private record ChannelProjection(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID channelRef,
            UUID templateRef,
            String targetNodeType,
            String targetNodeRef,
            String channelCode,
            String channelName,
            UUID bindingRef,
            String templateAccessKind,
            String status,
            long version,
            UUID templateProjectRef,
            String templateName,
            String templateCode,
            String templateOperatorKind,
            String templateOrderKind,
            String templateDineInForm,
            String templateProviderCode,
            String templateStatus,
            long templateVersion,
            String templateProjectStatus,
            UUID targetProjectRef,
            String targetNodeStatus,
            UUID targetStoreProjectRef,
            String targetStoreProjectStatus,
            String targetStoreStatus,
            UUID targetTenantRef,
            String targetTenantStatus,
            UUID targetBrandRef,
            String targetBrandStatus,
            String bindingLifecycleStatus,
            String providerStatus) {}

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
