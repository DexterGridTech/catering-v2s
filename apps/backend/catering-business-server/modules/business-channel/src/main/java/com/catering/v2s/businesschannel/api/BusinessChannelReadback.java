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
            String status,
            long version) {}

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
            List<String> stopReasons,
            long version) {
        public Channel {
            stopReasons = List.copyOf(stopReasons == null ? List.of() : stopReasons);
        }

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

    public record ChannelPage(List<Channel> items, String nextCursor, long total) {
        public ChannelPage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }
}
