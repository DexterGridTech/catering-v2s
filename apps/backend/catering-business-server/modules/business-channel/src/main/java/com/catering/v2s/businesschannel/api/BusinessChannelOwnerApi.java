package com.catering.v2s.businesschannel.api;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Owner-native business-channel facts required by the sales-menu owner. */
public interface BusinessChannelOwnerApi {
    /**
     * Lists only the store-owned internal dine-in/takeaway channel instances for one store. The cursor is an
     * owner-issued keyset frontier and is bound to the complete query identity.
     */
    SalesMenuEligibleChannelPage listSalesMenuEligibleChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String storeRef,
            String cursor,
            int pageSize,
            String sortKey,
            String sortDirection);

    /** Re-reads and exactly judges one persisted channel instance for a sales-menu target. */
    SalesMenuChannelJudgment requireSalesMenuChannel(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef);

    /** Re-reads only the persisted STORE target relation so a known ineligible channel rejection can be audited. */
    boolean salesMenuChannelBelongsToStore(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef);

    record SalesMenuEligibleChannelPage(List<SalesMenuEligibleChannel> items, String cursor, String nextCursor) {
        public SalesMenuEligibleChannelPage {
            items = List.copyOf(Objects.requireNonNull(items, "items"));
        }
    }

    /**
     * General channel facts only. Sales-menu schedule/time-range facts deliberately do not belong here; those are owned
     * by a sales-menu version.
     */
    record SalesMenuEligibleChannel(
            UUID channelRef,
            UUID templateRef,
            String storeRef,
            String channelCode,
            String channelName,
            String accessKind,
            String operatorKind,
            String orderKind,
            String bindingStatus,
            String status,
            List<BusinessChannelReadback.StatusDimension> statusDimensions,
            List<BusinessChannelReadback.StatusDimension> blockers,
            long version) {
        public SalesMenuEligibleChannel {
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(templateRef, "templateRef");
            storeRef = required(storeRef, "storeRef");
            channelName = required(channelName, "channelName");
            accessKind = required(accessKind, "accessKind");
            operatorKind = required(operatorKind, "operatorKind");
            orderKind = required(orderKind, "orderKind");
            bindingStatus = required(bindingStatus, "bindingStatus");
            status = required(status, "status");
            statusDimensions = List.copyOf(statusDimensions == null ? List.of() : statusDimensions);
            blockers = List.copyOf(blockers == null ? List.of() : blockers);
        }

        private static String required(String value, String field) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
            return value;
        }
    }

    /** Server-owned exact target facts; no binding/template reference from the caller is accepted. */
    record SalesMenuChannelJudgment(
            UUID channelRef,
            UUID templateRef,
            String storeRef,
            String accessKind,
            String operatorKind,
            String orderKind,
            String bindingStatus,
            String status,
            long version) {
        public SalesMenuChannelJudgment {
            Objects.requireNonNull(channelRef, "channelRef");
            Objects.requireNonNull(templateRef, "templateRef");
            storeRef = required(storeRef, "storeRef");
            accessKind = required(accessKind, "accessKind");
            operatorKind = required(operatorKind, "operatorKind");
            orderKind = required(orderKind, "orderKind");
            bindingStatus = required(bindingStatus, "bindingStatus");
            status = required(status, "status");
        }

        private static String required(String value, String field) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
            return value;
        }
    }
}
