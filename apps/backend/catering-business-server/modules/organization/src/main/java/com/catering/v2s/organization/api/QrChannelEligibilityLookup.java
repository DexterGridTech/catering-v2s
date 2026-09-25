package com.catering.v2s.organization.api;

import java.util.List;
import java.util.UUID;

/** Narrow cross-owner read used by organization when saving a store QR configuration. */
public interface QrChannelEligibilityLookup {
    /** Bounded owner read for the QR configuration selector; the owner applies the complete candidate predicate. */
    List<Candidate> listCandidates(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef);

    Candidate read(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID channelRef);

    Candidate requireEligible(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID channelRef);

    /** Returns the derived URL or null when the current template rule is empty/invalid. */
    String deriveUrl(Candidate candidate, String groupWorkspaceKey, UUID servicePointRef);

    record Candidate(
            UUID channelRef,
            UUID templateRef,
            String channelCode,
            String channelName,
            String templateName,
            String status,
            String bindingStatus,
            String urlRule,
            String templateStatus,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm) {}
}
