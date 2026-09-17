package com.catering.v2s.businesschannel.api;

import java.util.List;
import java.util.UUID;

/**
 * Owner projections for templates and channel instances. No adapter secrets or opaque auth references cross this API.
 */
public final class BusinessChannelReadback {
    private BusinessChannelReadback() {}

    public record Template(
            UUID templateRef,
            UUID projectRef,
            String templateName,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String urlRule,
            String storeVisibilityScope,
            long visibleStoreCount,
            String status,
            List<StatusDimension> statusDimensions,
            List<StatusDimension> blockers,
            long version) {
        public Template {
            statusDimensions = List.copyOf(statusDimensions == null ? List.of() : statusDimensions);
            blockers = List.copyOf(blockers == null ? List.of() : blockers);
        }

        public Template(
                UUID templateRef,
                UUID projectRef,
                String templateName,
                String templateCode,
                String accessKind,
                String operatorKind,
                String orderKind,
                String dineInForm,
                String providerCode,
                String storeVisibilityScope,
                long visibleStoreCount,
                String status,
                List<StatusDimension> statusDimensions,
                List<StatusDimension> blockers,
                long version) {
            this(templateRef, projectRef, templateName, templateCode, accessKind, operatorKind, orderKind, dineInForm,
                    providerCode, null, storeVisibilityScope, visibleStoreCount, status, statusDimensions, blockers,
                    version);
        }
    }

    /**
     * Server-owned target context for an operations command preflight. It deliberately excludes read-model status
     * dimensions; the command owner reloads and locks the complete aggregate before it authorizes or writes.
     */
    public record TemplateCommandContext(UUID templateRef, UUID projectRef) {}

    /** One related lifecycle fact; status is never collapsed into an aggregate availability value. */
    public record StatusDimension(String type, String ref, String status) {
        public StatusDimension {
            type = requireText(type, "type");
            ref = requireText(ref, "ref");
            status = requireText(status, "status");
        }

        private static String requireText(String value, String field) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
            return value;
        }
    }

    public record Channel(
            UUID channelRef,
            UUID templateRef,
            String ownerNodeType,
            String ownerNodeRef,
            /** User-entered business code; legacy rows may still be null until they are recreated. */
            String channelCode,
            String channelName,
            UUID bindingRef,
            /** Owner-projected binding meaning: NOT_REQUIRED, UNBOUND, or BOUND. */
            String bindingStatus,
            String status,
            List<StatusDimension> statusDimensions,
            List<StatusDimension> blockers,
            long version) {
        public Channel {
            statusDimensions = List.copyOf(statusDimensions == null ? List.of() : statusDimensions);
            blockers = List.copyOf(blockers == null ? List.of() : blockers);
        }

        public String targetNodeType() {
            return ownerNodeType;
        }

        public String targetNodeRef() {
            return ownerNodeRef;
        }
    }

    /**
     * Server-owned channel context used by command edges and cross-owner coordination. Complete status readback is
     * intentionally not carried here because it is not safe to reuse as post-write authority.
     */
    public record ChannelCommandContext(
            UUID channelRef,
            UUID templateRef,
            String ownerNodeType,
            String ownerNodeRef,
            String channelName,
            UUID bindingRef,
            long version,
            String templateAccessKind,
            String templateOrderKind,
            String templateProviderCode) {
        public String targetNodeType() {
            return ownerNodeType;
        }

        public String targetNodeRef() {
            return ownerNodeRef;
        }
    }

    /**
     * The operations binding edge needs the channel and its template provider as one owner projection. Keeping the
     * provider in this typed readback prevents the edge from issuing a second template read for the same channel.
     */
    public record ChannelWithTemplateProvider(Channel channel, String providerCode) {}

    /** Bounded management read or cursor-backed candidate page, depending on the owning API method. */
    public record TemplatePage(List<Template> items, String nextCursor, long total) {
        public TemplatePage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }

    public record VisibleStore(UUID storeRef, String storeCode, String storeName, String storeStatus) {}

    public record VisibleStorePage(List<VisibleStore> items, String nextCursor, long total) {
        public VisibleStorePage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }

    public record ChannelPage(List<Channel> items, String nextCursor, long total) {
        public ChannelPage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }
}
