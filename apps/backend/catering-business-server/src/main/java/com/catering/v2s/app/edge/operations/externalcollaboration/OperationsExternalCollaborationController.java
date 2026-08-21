package com.catering.v2s.app.edge.operations.externalcollaboration;

import com.catering.v2s.app.edge.generated.wire.CapabilityDictionary;
import com.catering.v2s.app.edge.generated.wire.ExternalProviderCandidatePage;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.platform.externalcollaboration.ExternalCollaborationWireMapper;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations read-only collaboration surface; reads never resolve a capability or channel context. */
@RestController
@RequestMapping("/api/operations")
public final class OperationsExternalCollaborationController {
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final OperationsSessionResolver sessions;
    private final CollaborationCatalogReadApi catalog;

    public OperationsExternalCollaborationController(
            OperationsSessionResolver sessions, CollaborationCatalogReadApi catalog) {
        this.sessions = sessions;
        this.catalog = catalog;
    }

    @GetMapping("/external-capability-dictionary")
    CapabilityDictionary capabilityDictionary(EdgeRequestContext request) {
        WorkspaceSessionReadback session = sessions.requireRead(request);
        return ExternalCollaborationWireMapper.dictionary(
                catalog.readCapabilityDictionary(session.workspaceUuid(), session.groupWorkspaceKey()));
    }

    @GetMapping("/group-workspaces/{groupWorkspaceKey}/external-provider-candidates")
    ExternalProviderCandidatePage providerCandidates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String capabilityClass,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        int normalizedPageSize = pageSize(pageSize);
        String normalizedCapability = optional(capabilityClass);
        List<CollaborationReadback.ProviderProfile> values = catalog
                .listEnabledProviderProfiles(session.workspaceUuid(), session.groupWorkspaceKey(), normalizedCapability)
                .stream()
                .sorted(Comparator.comparing(CollaborationReadback.ProviderProfile::providerCode))
                .toList();
        String queryIdentity = cursorIdentity(
                session.workspaceUuid(), session.groupWorkspaceKey(), normalizedCapability, normalizedPageSize);
        OpaqueCollectionCursor.Position position = cursor(cursor, queryIdentity);
        int start = start(values, position);
        int end = Math.min(start + normalizedPageSize, values.size());
        List<CollaborationReadback.ProviderProfile> page = values.subList(start, end);
        String nextCursor = end < values.size()
                ? OpaqueCollectionCursor.encode(
                        queryIdentity,
                        page.get(page.size() - 1).providerCode(),
                        providerTie(page.get(page.size() - 1).providerCode()))
                : null;
        return ExternalCollaborationWireMapper.providerCandidates(page, nextCursor, values.size());
    }

    private static int pageSize(Integer value) {
        int normalized = value == null ? DEFAULT_PAGE_SIZE : value;
        if (normalized < 1 || normalized > MAX_PAGE_SIZE) {
            throw new InvalidEdgeRequestException("pageSize must be between 1 and 100");
        }
        return normalized;
    }

    private static OpaqueCollectionCursor.Position cursor(String value, String queryIdentity) {
        try {
            return OpaqueCollectionCursor.decode(value, queryIdentity);
        } catch (OpaqueCollectionCursor.InvalidCursor failure) {
            throw new InvalidEdgeRequestException("cursor is invalid", failure);
        }
    }

    private static int start(
            List<CollaborationReadback.ProviderProfile> values, OpaqueCollectionCursor.Position position) {
        if (position == null) return 0;
        for (int index = 0; index < values.size(); index++) {
            if (values.get(index).providerCode().compareTo(position.sortKey()) > 0) return index;
        }
        return values.size();
    }

    private static String optional(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String cursorIdentity(
            UUID workspaceUuid, String groupWorkspaceKey, String capabilityClass, int pageSize) {
        return String.join(
                "\u001f",
                "external-provider-candidates",
                workspaceUuid.toString(),
                groupWorkspaceKey,
                capabilityClass == null ? "<null>" : capabilityClass,
                Integer.toString(pageSize));
    }

    private static UUID providerTie(String providerCode) {
        return UUID.nameUUIDFromBytes(providerCode.getBytes(StandardCharsets.UTF_8));
    }
}
