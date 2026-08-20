package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import java.util.Objects;

/** Pure business-channel invariants; persistence and cross-owner reads stay in the owner service. */
final class BusinessChannelPolicy {
    static final String INTERNAL = "INTERNAL";
    static final String EXTERNAL = "EXTERNAL";
    static final String PROJECT = "PROJECT";
    static final String STORE = "STORE";
    static final String DINE_IN = "DINE_IN";
    static final String TAKEAWAY = "TAKEAWAY";
    static final String GROUP_BUY = "GROUP_BUY";
    static final String ENABLED = "ENABLED";
    static final String DISABLED = "DISABLED";
    static final String DRAFT = "DRAFT";
    static final String EFFECTIVE = "EFFECTIVE";
    static final String MANUAL = "MANUAL";
    static final String CASCADE_TEMPLATE = "CASCADE_TEMPLATE";
    static final String CASCADE_EXTERNAL = "CASCADE_EXTERNAL";

    private BusinessChannelPolicy() {}

    static void validateTemplate(
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            CollaborationReadback.ProviderProfile provider) {
        requireEnum(accessKind, "accessKind", INTERNAL, EXTERNAL);
        requireEnum(operatorKind, "operatorKind", PROJECT, STORE);
        requireEnum(orderKind, "orderKind", DINE_IN, TAKEAWAY, GROUP_BUY);
        if (DINE_IN.equals(orderKind) && !INTERNAL.equals(accessKind)) {
            throw problem("DINE_IN_MUST_BE_INTERNAL", 422, "DINE_IN templates must be internal");
        }
        if (DINE_IN.equals(orderKind)) {
            requireEnum(dineInForm, "dineInForm", "POS", "QR", "KIOSK");
        } else if (dineInForm != null) {
            throw problem("DINE_IN_FORM_MISMATCH", 422, "dineInForm is only valid for DINE_IN");
        }
        if (INTERNAL.equals(accessKind)) {
            if (providerCode != null) {
                throw problem("IMMUTABLE_FIELD", 422, "internal templates do not have a provider");
            }
            return;
        }
        if (providerCode == null || providerCode.isBlank()) {
            throw problem("VALIDATION_ERROR", 422, "providerCode is required for an external template");
        }
        if (provider == null) {
            throw problem("CATALOG_NOT_FOUND", 404, "provider profile was not found");
        }
        if (!ENABLED.equals(provider.enablementStatus())) {
            throw problem("PROVIDER_NOT_ENABLED", 422, "provider profile is not enabled for this workspace");
        }
        if (!provider.businessScope().contains(orderKind)) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "provider does not expose this order kind");
        }
    }

    static void validateChannelName(String channelName) {
        required(channelName, "channelName", 240);
    }

    static String preserveTemplateCode(String templateCode) {
        return requiredCode(templateCode, "templateCode");
    }

    static String preserveChannelCode(String channelCode) {
        return requiredCode(channelCode, "channelCode");
    }

    static void validateOwnerNode(String ownerNodeType, String ownerNodeRef) {
        requireEnum(ownerNodeType, "ownerNodeType", PROJECT, STORE);
        required(ownerNodeRef, "ownerNodeRef", 240);
    }

    static void validateTemplateTarget(
            String templateOperatorKind, String templateProjectRef, String ownerNodeType, String ownerNodeRef) {
        if (!Objects.equals(templateOperatorKind, ownerNodeType)) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "channel owner node type does not match the template");
        }
        if (PROJECT.equals(ownerNodeType) && !Objects.equals(templateProjectRef, ownerNodeRef)) {
            throw problem("BUSINESS_SCOPE_EXCEEDED", 422, "project channel is outside the template project");
        }
    }

    static void validateBinding(
            String templateAccessKind,
            String templateOrderKind,
            String templateProviderCode,
            CollaborationReadback.OwnerBinding binding,
            String ownerNodeType,
            String ownerNodeRef,
            boolean requireEffective) {
        if (binding == null) {
            if (EXTERNAL.equals(templateAccessKind) && requireEffective) {
                throw problem("BINDING_NOT_EFFECTIVE", 409, "external channel requires an effective binding");
            }
            return;
        }
        if (INTERNAL.equals(templateAccessKind)) {
            throw problem("IMMUTABLE_FIELD", 422, "internal channel cannot reference a binding");
        }
        if (!Objects.equals(templateProviderCode, binding.providerCode())
                || !Objects.equals(ownerNodeType, binding.nodeType())
                || !Objects.equals(ownerNodeRef, binding.nodeRef())) {
            throw problem("ORDER_KIND_MISMATCH", 422, "binding facts do not match the channel");
        }
        if (!Objects.equals(templateOrderKind, binding.capabilityClass())) {
            throw problem("ORDER_KIND_MISMATCH", 422, "binding capability does not match the order kind");
        }
        if (requireEffective && !"EFFECTIVE".equals(binding.status())) {
            throw problem("BINDING_NOT_EFFECTIVE", 409, "binding is not effective");
        }
    }

    static String required(String value, String name, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength) {
            throw problem("VALIDATION_ERROR", 422, name + " is invalid");
        }
        return value;
    }

    private static String requiredCode(String value, String name) {
        String candidate = required(value, name, 240).trim();
        if (candidate.isEmpty()) throw problem("VALIDATION_ERROR", 422, name + " is invalid");
        return candidate;
    }

    static String requireEnum(String value, String name, String... allowed) {
        String candidate = required(value, name, 80);
        for (String accepted : allowed) if (accepted.equals(candidate)) return candidate;
        throw problem("VALIDATION_ERROR", 422, name + " is not supported");
    }

    private static BusinessChannelCommandApi.Problem problem(String code, int status, String message) {
        return new BusinessChannelCommandApi.Problem(code, status, message);
    }
}
