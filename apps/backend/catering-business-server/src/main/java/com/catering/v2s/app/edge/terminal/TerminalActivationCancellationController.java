package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalActivationCancellationRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalActivationCancellationResult;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.DeviceCancelOutcome;
import com.catering.v2s.terminalbinding.application.CancelTerminalActivationOperation;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Device cancellation is authorized by the terminal credential, independently of public activation. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}/terminals/{terminalRef}/activation")
public final class TerminalActivationCancellationController {
    private final CancelTerminalActivationOperation cancellation;

    public TerminalActivationCancellationController(CancelTerminalActivationOperation cancellation) {
        this.cancellation = Objects.requireNonNull(cancellation, "cancellation");
    }

    @PostMapping("/cancel")
    public ResponseEntity<TerminalActivationCancellationResult> cancel(
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID terminalRef,
            @RequestBody TerminalActivationCancellationRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) List<String> authorizationValues) {
        if (request.deviceId() == null
                || request.deviceId().isBlank()
                || request.deviceId().length() > 128) {
            throw new InvalidEdgeRequestException("terminal cancellation request is invalid");
        }
        DeviceCancelOutcome outcome = cancellation.execute(
                groupWorkspaceKey,
                terminalRef,
                request.deviceId(),
                authorizationValues == null ? List.of() : authorizationValues);
        if (outcome == DeviceCancelOutcome.CREDENTIAL_INVALID) throw new TerminalDeviceCredentialProblem();
        return ResponseEntity.ok(new TerminalActivationCancellationResult(outcome.name()));
    }
}
