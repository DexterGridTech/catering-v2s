package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.generated.wire.HeadCompanyBrandAuthorizationAddRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.application.BusinessEntityService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operations head-company authorization capability adapter. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies")
public final class OperationsHeadCompanyAuthorizationController {
    private final OperationsSessionResolver sessions;
    private final BusinessEntityService entities;

    public OperationsHeadCompanyAuthorizationController(OperationsSessionResolver sessions, BusinessEntityService entities) {
        this.sessions = sessions;
        this.entities = entities;
    }

    @PostMapping("/{headCompanyId}/brand-authorizations")
    ResponseEntity<Void> add(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody HeadCompanyBrandAuthorizationAddRequest body) {
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        entities.addHeadCompanyBrandAuthorization(session.workspaceUuid(), groupWorkspaceKey, headCompanyId, requiredUuid(body == null ? null : body.brandId()), idempotencyKey, sessions.actor(session));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{headCompanyId}/brand-authorizations/{brandId}")
    ResponseEntity<Void> remove(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID headCompanyId, @PathVariable String brandId, @RequestHeader("Idempotency-Key") String idempotencyKey) {
        var session = sessions.requireWorkspace(request, groupWorkspaceKey);
        entities.removeHeadCompanyBrandAuthorization(session.workspaceUuid(), groupWorkspaceKey, headCompanyId, requiredUuid(brandId), idempotencyKey, sessions.actor(session));
        return ResponseEntity.noContent().build();
    }

    private static UUID requiredUuid(String value) {
        if (value == null || value.isBlank()) throw new InvalidEdgeRequestException("brand id is required");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new InvalidEdgeRequestException("brand id is invalid");
        }
    }
}
