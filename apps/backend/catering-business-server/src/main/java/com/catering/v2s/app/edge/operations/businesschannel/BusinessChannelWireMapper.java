package com.catering.v2s.app.edge.operations.businesschannel;

import com.catering.v2s.app.edge.generated.wire.BusinessChannelPage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateCandidatePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplatePage;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelTemplateView;
import com.catering.v2s.app.edge.generated.wire.BusinessChannelView;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import java.util.List;
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
                value.accessKind(),
                accessKindDisplayName(value.accessKind()),
                value.operatorKind(),
                operatorKindDisplayName(value.operatorKind()),
                value.orderKind(),
                orderKindDisplayName(value.orderKind()),
                text(value.dineInForm()),
                text(dineInFormDisplayName(value.dineInForm())),
                text(value.providerCode()),
                value.status(),
                statusDisplayName(value.status()),
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

    static BusinessChannelView channel(BusinessChannelReadback.Channel value) {
        return new BusinessChannelView(
                value.channelRef(),
                value.templateRef(),
                value.ownerNodeType(),
                ownerNodeTypeDisplayName(value.ownerNodeType()),
                uuid(value.ownerNodeRef(), "ownerNodeRef"),
                text(value.channelCode()),
                value.channelName(),
                value.bindingRef(),
                value.status(),
                statusDisplayName(value.status()),
                value.stopReasons(),
                stopReasonDisplayNames(value.stopReasons()),
                value.version(),
                value.bindingStatus(),
                bindingStatusDisplayName(value.bindingStatus()));
    }

    static BusinessChannelPage channelPage(BusinessChannelReadback.ChannelPage value) {
        return new BusinessChannelPage(
                value.items().stream().map(BusinessChannelWireMapper::channel).toList());
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

    private static String accessKindDisplayName(String value) {
        return switch (value) {
            case "INTERNAL" -> "内部接入";
            case "EXTERNAL" -> "外部接入";
            default -> "未知";
        };
    }

    private static String operatorKindDisplayName(String value) {
        return switch (value) {
            case "PROJECT" -> "项目";
            case "STORE" -> "门店";
            default -> "未知";
        };
    }

    private static String orderKindDisplayName(String value) {
        return switch (value) {
            case "DINE_IN" -> "到店点餐";
            case "TAKEAWAY" -> "外卖";
            case "GROUP_BUY" -> "团购";
            default -> "未知";
        };
    }

    private static String dineInFormDisplayName(String value) {
        if (value == null) return null;
        return switch (value) {
            case "POS" -> "POS";
            case "QR" -> "扫码";
            case "KIOSK" -> "自助机";
            default -> "未知";
        };
    }

    private static String statusDisplayName(String value) {
        return switch (value) {
            case "ENABLED" -> "已启用";
            case "DISABLED" -> "已停用";
            case "DRAFT" -> "草稿";
            case "EFFECTIVE" -> "已生效";
            default -> "未知";
        };
    }

    private static String bindingStatusDisplayName(String value) {
        return switch (value) {
            case "NOT_REQUIRED" -> "—";
            case "UNBOUND" -> "未绑定";
            case "BOUND" -> "已绑定";
            default -> "未知";
        };
    }

    private static String ownerNodeTypeDisplayName(String value) {
        return operatorKindDisplayName(value);
    }

    private static List<String> stopReasonDisplayNames(List<String> values) {
        return values.stream()
                .map(value -> switch (value) {
                    case "CASCADE_TEMPLATE" -> "模板停用";
                    case "CASCADE_EXTERNAL" -> "外部接入停用";
                    case "MANUAL" -> "手动停用";
                    default -> "未知";
                })
                .toList();
    }
}
