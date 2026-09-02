package com.catering.v2s.app.edge.operations.salesmenu;

import com.catering.v2s.app.edge.generated.wire.SalesMenuDisplayMedia;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.domain.SalesMenuActivationStatus;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetUsage;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMediaMode;
import com.catering.v2s.salesmenu.domain.SalesMenuItemTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuPageRequest;
import com.catering.v2s.salesmenu.domain.SalesMenuSaleContentKind;
import com.catering.v2s.salesmenu.domain.SalesMenuScheduleKind;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuSkuPrice;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Shared, narrow transport checks for the two sales-menu edge controllers. */
@Component
final class SalesMenuEdgeSupport {
    static final String CAPABILITY = "EDIT_STORE_SALES_MENU";
    private static final String CHANNEL_INELIGIBLE_MESSAGE = "业务渠道不符合销售菜单要求";
    private static final String SCHEDULE_INVALID_MESSAGE = "菜单时段格式不正确";
    private static final String ASSET_INVALID_MESSAGE = "销售菜单图片绑定凭证无效";
    static final String USAGE = "SALES_MENU_ITEM_IMAGE";
    static final int PAGE_SIZE = 20;

    private final OperationsSessionResolver sessions;
    private final BusinessChannelOwnerApi channels;
    private final WorkspaceCapabilityScopeResolver capabilities;
    private final OperationsOrganizationTaskReadService organizationReads;
    private final ObjectMapper json;

    SalesMenuEdgeSupport(
            OperationsSessionResolver sessions,
            BusinessChannelOwnerApi channels,
            WorkspaceCapabilityScopeResolver capabilities,
            OperationsOrganizationTaskReadService organizationReads,
            ObjectMapper json) {
        this.sessions = sessions;
        this.channels = channels;
        this.capabilities = capabilities;
        this.organizationReads = organizationReads;
        this.json = json;
    }

    WorkspaceSessionReadback readSession(EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireWorkspaceRead(request, groupWorkspaceKey);
    }

    WorkspaceSessionReadback commandSession(EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
    }

    SalesMenuScope scope(WorkspaceSessionReadback session, String groupWorkspaceKey, UUID storeRef) {
        requireScopedStore(session, groupWorkspaceKey, storeRef);
        return new SalesMenuScope(session.workspaceUuid(), session.groupWorkspaceKey(), storeRef);
    }

    void requireEligibleChannel(SalesMenuScope scope, UUID channelRef) {
        if (channelRef == null) throw new InvalidEdgeRequestException("channelRef is required");
        BusinessChannelOwnerApi.SalesMenuChannelJudgment judgment;
        try {
            judgment = channels.requireSalesMenuChannel(
                    scope.workspaceUuid(),
                    scope.groupWorkspaceKey(),
                    scope.storeRef().toString(),
                    channelRef);
        } catch (BusinessChannelCommandApi.Problem failure) {
            if ("SALES_MENU_CHANNEL_INELIGIBLE".equals(failure.code())) {
                throw problem("SALES_MENU_CHANNEL_INELIGIBLE", CHANNEL_INELIGIBLE_MESSAGE, failure);
            }
            throw failure;
        }
        if (!channelRef.equals(judgment.channelRef())
                || !scope.storeRef().toString().equals(judgment.storeRef())
                || !"INTERNAL".equals(judgment.accessKind())
                || !"STORE".equals(judgment.operatorKind())
                || !("DINE_IN".equals(judgment.orderKind()) || "TAKEAWAY".equals(judgment.orderKind()))) {
            throw problem("SALES_MENU_CHANNEL_INELIGIBLE", CHANNEL_INELIGIBLE_MESSAGE);
        }
    }

    OperationsOwnerScopeGrant grant(WorkspaceSessionReadback session, String requirementId, UUID storeRef) {
        return grant(session, requirementId, storeRef, false);
    }

    /**
     * Publish is the one sales-menu command that must reach the owner while its persisted Store is disabled, so the
     * owner can return the typed STORE_DISABLED blocker. Every other command stays on the normal enabled-target path.
     */
    OperationsOwnerScopeGrant grantForPublish(WorkspaceSessionReadback session, String requirementId, UUID storeRef) {
        return grant(session, requirementId, storeRef, true);
    }

    private OperationsOwnerScopeGrant grant(
            WorkspaceSessionReadback session, String requirementId, UUID storeRef, boolean allowDisabledStoreTarget) {
        var target = new WorkspaceCapabilityScopeResolver.ServerResolvedResource("STORE", storeRef);
        var resolution = allowDisabledStoreTarget
                ? capabilities.resolveIncludingDisabledStoreTarget(session, requirementId, target)
                : capabilities.resolveGeneratedOperation(session, requirementId, CAPABILITY, target);
        return resolution.ownerScopeGrant(requirementId);
    }

    SalesMenuCommandApi.CommandContext commandContext(
            WorkspaceSessionReadback session,
            SalesMenuScope scope,
            UUID salesMenuRef,
            String requirementId,
            String idempotencyKey) {
        return commandContext(session, scope, salesMenuRef, requirementId, idempotencyKey, false);
    }

    SalesMenuCommandApi.CommandContext commandContext(
            WorkspaceSessionReadback session,
            SalesMenuScope scope,
            UUID salesMenuRef,
            String requirementId,
            String idempotencyKey,
            boolean allowDisabledStoreTarget) {
        return new SalesMenuCommandApi.CommandContext(
                scope,
                salesMenuRef,
                allowDisabledStoreTarget
                        ? grantForPublish(session, requirementId, scope.storeRef())
                        : grant(session, requirementId, scope.storeRef()),
                session.contextVersion(),
                sessions.actor(session),
                idempotencyKey(idempotencyKey));
    }

    SalesMenuTarget menuTarget(SalesMenuScope scope, UUID salesMenuRef) {
        if (salesMenuRef == null) throw new InvalidEdgeRequestException("salesMenuRef is required");
        return new SalesMenuTarget(scope, salesMenuRef);
    }

    SalesMenuItemTarget itemTarget(SalesMenuScope scope, UUID salesMenuRef, UUID salesItemRef) {
        if (salesItemRef == null) throw new InvalidEdgeRequestException("salesItemRef is required");
        return new SalesMenuItemTarget(menuTarget(scope, salesMenuRef), salesItemRef);
    }

    SalesMenuAssetTarget assetTarget(
            SalesMenuScope scope, UUID salesMenuRef, UUID salesItemRef, long expectedDraftVersion) {
        return new SalesMenuAssetTarget(
                scope.groupWorkspaceKey(),
                scope.storeRef(),
                menuTarget(scope, salesMenuRef).salesMenuRef(),
                itemTarget(scope, salesMenuRef, salesItemRef).salesItemRef(),
                SalesMenuAssetUsage.SALES_MENU_ITEM_IMAGE,
                expectedDraftVersion);
    }

    SalesMenuPageRequest page(String cursor, Integer pageSize) {
        if (pageSize != null && pageSize != PAGE_SIZE) throw new InvalidEdgeRequestException("pageSize must be 20");
        return new SalesMenuPageRequest(cursor, PAGE_SIZE);
    }

    long expected(Long value, String field) {
        if (value == null || value < 0) throw new InvalidEdgeRequestException(field + " is required");
        return value;
    }

    String requiredText(String value, String field) {
        if (value == null || value.isBlank()) throw new InvalidEdgeRequestException(field + " is required");
        return value;
    }

    String boundedText(String value, String field, int maxLength) {
        String normalized = requiredText(value, field).trim();
        if (normalized.length() > maxLength) throw new InvalidEdgeRequestException(field + " is invalid");
        return normalized;
    }

    List<UUID> requiredRefs(List<UUID> value, String field) {
        if (value == null || value.isEmpty() || value.stream().anyMatch(java.util.Objects::isNull)) {
            throw new InvalidEdgeRequestException(field + " is required");
        }
        return List.copyOf(value);
    }

    String idempotencyKey(String value) {
        if (value == null || value.isBlank() || value.length() < 16 || value.length() > 128) {
            throw new InvalidEdgeRequestException("invalid idempotency key");
        }
        return value;
    }

    SalesMenuActivationStatus activationStatus(String value) {
        return enumValue(value, SalesMenuActivationStatus.class, "status");
    }

    SalesMenuMoveDirection moveDirection(String value) {
        return enumValue(value, SalesMenuMoveDirection.class, "direction");
    }

    com.catering.v2s.salesmenu.domain.SalesMenuSaleContentInput saleContent(
            com.catering.v2s.app.edge.generated.wire.SalesMenuItemUpdateRequestSaleContent value) {
        if (value == null || value.kind() == null || value.skuPrices() == null) {
            throw new InvalidEdgeRequestException("saleContent is required");
        }
        List<SalesMenuSkuPrice> skuPrices = new ArrayList<>();
        for (var sku : value.skuPrices()) {
            if (sku == null
                    || sku.skuRef() == null
                    || sku.skuName() == null
                    || sku.skuCode() == null
                    || sku.standardPriceCents() == null
                    || sku.listedPriceCents() == null) {
                throw new InvalidEdgeRequestException("saleContent.skuPrices is invalid");
            }
            skuPrices.add(new SalesMenuSkuPrice(
                    sku.skuRef(), sku.skuName(), sku.skuCode(), sku.standardPriceCents(), sku.listedPriceCents()));
        }
        return new com.catering.v2s.salesmenu.domain.SalesMenuSaleContentInput(
                enumValue(value.kind(), SalesMenuSaleContentKind.class, "saleContent.kind"),
                value.listedPriceCents(),
                skuPrices);
    }

    com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints ordering(
            com.catering.v2s.app.edge.generated.wire.SalesMenuOrderingConstraints value) {
        if (value == null) throw new InvalidEdgeRequestException("orderingConstraints is required");
        return new com.catering.v2s.salesmenu.domain.SalesMenuOrderingConstraints(
                intValue(value.minItemQuantity(), "minItemQuantity"), intValue(value.quantityStep(), "quantityStep"));
    }

    com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia displayMedia(SalesMenuDisplayMedia value) {
        if (value == null || value.mode() == null || value.assetRefs() == null) {
            throw new InvalidEdgeRequestException("displayMedia is required");
        }
        return new com.catering.v2s.salesmenu.domain.SalesMenuDisplayMedia(
                enumValue(value.mode(), SalesMenuDisplayMediaMode.class, "displayMedia.mode"),
                List.copyOf(value.assetRefs()),
                value.primaryAssetRef());
    }

    com.catering.v2s.salesmenu.domain.SalesMenuSchedule schedule(
            com.catering.v2s.app.edge.generated.wire.SalesMenuSchedule value) {
        if (value == null || value.kind() == null) throw new InvalidEdgeRequestException("schedule is required");
        SalesMenuScheduleKind kind = enumValue(value.kind(), SalesMenuScheduleKind.class, "schedule.kind");
        try {
            return new com.catering.v2s.salesmenu.domain.SalesMenuSchedule(
                    kind,
                    value.startLocalTime() == null ? null : LocalTime.parse(value.startLocalTime()),
                    value.endLocalTime() == null ? null : LocalTime.parse(value.endLocalTime()));
        } catch (RuntimeException failure) {
            throw problem("SALES_MENU_SCHEDULE_INVALID", SCHEDULE_INVALID_MESSAGE, failure);
        }
    }

    List<com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi.AssetBinding> assetBindings(String encoded) {
        if (encoded == null || encoded.isBlank()) return List.of();
        try {
            JsonNode root = json.readTree(encoded);
            if (root == null || !root.isObject()) throw new IllegalArgumentException("grants must be an object");
            List<com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi.AssetBinding> bindings = new ArrayList<>();
            root.properties().forEach(entry -> {
                if (!entry.getValue().isTextual() || entry.getValue().asText().isBlank()) {
                    throw new IllegalArgumentException("grant must be text");
                }
                bindings.add(new com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi.AssetBinding(
                        UUID.fromString(entry.getKey()), entry.getValue().asText()));
            });
            return List.copyOf(bindings);
        } catch (Exception failure) {
            throw problem("SALES_MENU_ASSET_INVALID", ASSET_INVALID_MESSAGE, failure);
        }
    }

    private static SalesMenuOwnerApi.Problem problem(String code, String message) {
        return new SalesMenuOwnerApi.Problem(code, 422, message);
    }

    private static SalesMenuOwnerApi.Problem problem(String code, String message, Throwable cause) {
        return new SalesMenuOwnerApi.Problem(code, 422, message, cause);
    }

    private void requireScopedStore(WorkspaceSessionReadback session, String groupWorkspaceKey, UUID storeRef) {
        if (storeRef == null) throw new InvalidEdgeRequestException("storeRef is required");
        if (session.scopeContext() == null || session.scopeContext().store() == null) {
            throw new WorkspaceUserService.TaskScopeDeniedException();
        }
        if (!storeRef.equals(session.scopeContext().store().dataNodeId())) {
            throw new WorkspaceUserService.TaskScopeDeniedException();
        }
        OrganizationOverviewTaskReadService.Item store =
                organizationReads.store(session.workspaceUuid(), groupWorkspaceKey, storeRef);
        if (store == null || store.project() == null || store.project().id() == null) {
            throw new InvalidEdgeRequestException("store has no project owner");
        }
    }

    private static Integer intValue(Long value, String field) {
        if (value == null) return null;
        try {
            return Math.toIntExact(value);
        } catch (ArithmeticException failure) {
            throw new InvalidEdgeRequestException(field + " is invalid", failure);
        }
    }

    private static <E extends Enum<E>> E enumValue(String value, Class<E> type, String field) {
        if (value == null || value.isBlank()) throw new InvalidEdgeRequestException(field + " is required");
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException failure) {
            throw new InvalidEdgeRequestException(field + " is invalid", failure);
        }
    }
}
