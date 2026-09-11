package com.catering.v2s.app.edge.operations.businesschannel;

import com.catering.v2s.app.edge.generated.wire.BusinessChannelPage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateCandidatePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplatePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateStoreVisibilityScope;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateView;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewAccessKind;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewBlockersItemStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewBlockersItemType;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewDineInForm;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewOperatorKind;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewOrderKind;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewStatusDimensionsItemStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewStatusDimensionsItemType;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateVisibleStore;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateVisibleStorePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelView;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewBindingStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewBlockersItemStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewBlockersItemType;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewOwnerNodeType;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewSelfStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewStatusDimensionsItemStatus;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelViewStatusDimensionsItemType;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Maps the business-channel owner projection to the generated operations wire. */
final class BusinessChannelWireMapper {
    private static final ObjectMapper JSON = new ObjectMapper();

    private BusinessChannelWireMapper() {}

    static BusinessChannelTemplateView template(BusinessChannelReadback.Template value) {
        return new BusinessChannelTemplateView(
                value.templateRef(),
                value.projectRef(),
                value.templateName(),
                text(value.templateCode()),
                enumValue(BusinessChannelTemplateViewAccessKind.class, value.accessKind(), "accessKind"),
                enumValue(BusinessChannelTemplateViewOperatorKind.class, value.operatorKind(), "operatorKind"),
                enumValue(BusinessChannelTemplateViewOrderKind.class, value.orderKind(), "orderKind"),
                enumValue(BusinessChannelTemplateViewDineInForm.class, value.dineInForm(), "dineInForm"),
                text(value.providerCode()),
                enumValue(
                        BusinessChannelTemplateStoreVisibilityScope.class,
                        value.storeVisibilityScope(),
                        "storeVisibilityScope"),
                value.visibleStoreCount(),
                enumValue(BusinessChannelTemplateViewStatus.class, value.status(), "status"),
                value.statusDimensions().stream()
                        .map(dimension ->
                                new com.catering.v2s.app.edge.generated.wire
                                        .BusinessChannelTemplateViewStatusDimensionsItem(
                                        enumValue(
                                                BusinessChannelTemplateViewStatusDimensionsItemType.class,
                                                dimension.type(),
                                                "statusDimensions.type"),
                                        dimension.ref(),
                                        enumValue(
                                                BusinessChannelTemplateViewStatusDimensionsItemStatus.class,
                                                dimension.status(),
                                                "statusDimensions.status")))
                        .toList(),
                value.blockers().stream()
                        .map(dimension ->
                                new com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateViewBlockersItem(
                                        enumValue(
                                                BusinessChannelTemplateViewBlockersItemType.class,
                                                dimension.type(),
                                                "blockers.type"),
                                        dimension.ref(),
                                        enumValue(
                                                BusinessChannelTemplateViewBlockersItemStatus.class,
                                                dimension.status(),
                                                "blockers.status")))
                        .toList(),
                value.version());
    }

    static BusinessChannelTemplatePage templatePage(BusinessChannelReadback.TemplatePage value) {
        return new BusinessChannelTemplatePage(
                value.items().stream().map(BusinessChannelWireMapper::template).toList());
    }

    static BusinessChannelTemplateCandidatePage templateCandidatePage(BusinessChannelReadback.TemplatePage value) {
        return new BusinessChannelTemplateCandidatePage(
                value.items().stream().map(BusinessChannelWireMapper::template).toList(),
                text(value.nextCursor()),
                value.total());
    }

    static BusinessChannelTemplateVisibleStorePage visibleStorePage(BusinessChannelReadback.VisibleStorePage value) {
        return new BusinessChannelTemplateVisibleStorePage(
                value.items().stream()
                        .map(store -> new BusinessChannelTemplateVisibleStore(
                                store.storeRef(), store.storeCode(), store.storeName(), store.storeStatus()))
                        .toList(),
                text(value.nextCursor()),
                value.total());
    }

    static BusinessChannelView channel(BusinessChannelReadback.Channel value) {
        return new BusinessChannelView(
                value.channelRef(),
                value.templateRef(),
                enumValue(BusinessChannelViewOwnerNodeType.class, value.ownerNodeType(), "ownerNodeType"),
                uuid(value.ownerNodeRef(), "ownerNodeRef"),
                text(value.channelCode()),
                value.channelName(),
                value.bindingRef(),
                enumValue(BusinessChannelViewStatus.class, value.status(), "status"),
                enumValue(BusinessChannelViewBindingStatus.class, value.bindingStatus(), "bindingStatus"),
                enumValue(BusinessChannelViewSelfStatus.class, value.status(), "selfStatus"),
                value.statusDimensions().stream()
                        .map(dimension ->
                                new com.catering.v2s.app.edge.generated.wire.BusinessChannelViewStatusDimensionsItem(
                                        enumValue(
                                                BusinessChannelViewStatusDimensionsItemType.class,
                                                dimension.type(),
                                                "statusDimensions.type"),
                                        dimension.ref(),
                                        enumValue(
                                                BusinessChannelViewStatusDimensionsItemStatus.class,
                                                dimension.status(),
                                                "statusDimensions.status")))
                        .toList(),
                value.blockers().stream()
                        .map(dimension -> new com.catering.v2s.app.edge.generated.wire.BusinessChannelViewBlockersItem(
                                enumValue(BusinessChannelViewBlockersItemType.class, dimension.type(), "blockers.type"),
                                dimension.ref(),
                                enumValue(
                                        BusinessChannelViewBlockersItemStatus.class,
                                        dimension.status(),
                                        "blockers.status")))
                        .toList(),
                value.version());
    }

    static BusinessChannelPage channelPage(BusinessChannelReadback.ChannelPage value) {
        return new BusinessChannelPage(
                value.items().stream().map(BusinessChannelWireMapper::channel).toList(), null, value.nextCursor());
    }

    static BusinessChannelPage salesMenuChannelPage(BusinessChannelOwnerApi.SalesMenuEligibleChannelPage value) {
        return new BusinessChannelPage(
                value.items().stream()
                        .map(BusinessChannelWireMapper::salesMenuChannel)
                        .toList(),
                value.cursor(),
                value.nextCursor());
    }

    private static BusinessChannelView salesMenuChannel(BusinessChannelOwnerApi.SalesMenuEligibleChannel value) {
        return new BusinessChannelView(
                value.channelRef(),
                value.templateRef(),
                BusinessChannelViewOwnerNodeType.STORE,
                uuid(value.storeRef(), "storeRef"),
                value.channelCode() == null ? null : JSON.valueToTree(value.channelCode()),
                value.channelName(),
                null,
                enumValue(BusinessChannelViewStatus.class, value.status(), "status"),
                enumValue(BusinessChannelViewBindingStatus.class, value.bindingStatus(), "bindingStatus"),
                enumValue(BusinessChannelViewSelfStatus.class, value.status(), "selfStatus"),
                value.statusDimensions().stream()
                        .map(dimension ->
                                new com.catering.v2s.app.edge.generated.wire.BusinessChannelViewStatusDimensionsItem(
                                        enumValue(
                                                BusinessChannelViewStatusDimensionsItemType.class,
                                                dimension.type(),
                                                "statusDimensions.type"),
                                        dimension.ref(),
                                        enumValue(
                                                BusinessChannelViewStatusDimensionsItemStatus.class,
                                                dimension.status(),
                                                "statusDimensions.status")))
                        .toList(),
                value.blockers().stream()
                        .map(dimension -> new com.catering.v2s.app.edge.generated.wire.BusinessChannelViewBlockersItem(
                                enumValue(BusinessChannelViewBlockersItemType.class, dimension.type(), "blockers.type"),
                                dimension.ref(),
                                enumValue(
                                        BusinessChannelViewBlockersItemStatus.class,
                                        dimension.status(),
                                        "blockers.status")))
                        .toList(),
                value.version());
    }

    private static UUID uuid(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalStateException(field + " is missing in owner readback");
        try {
            return java.util.UUID.fromString(value);
        } catch (IllegalArgumentException failure) {
            throw new IllegalStateException(field + " is not a UUID in owner readback", failure);
        }
    }

    private static JsonNode text(String value) {
        return value == null ? null : JSON.valueToTree(value);
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, String value, String field) {
        if (value == null) return null;
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException failure) {
            throw new IllegalStateException(field + " is not a supported closed value: " + value, failure);
        }
    }
}
