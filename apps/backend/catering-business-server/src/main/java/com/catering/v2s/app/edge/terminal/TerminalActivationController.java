package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalActivationRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalActivationResult;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationOutcome;
import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationResult;
import java.util.Objects;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public device protocol. It intentionally has no user-session or permission dependencies. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}")
public final class TerminalActivationController {
    private final ActivateTerminalOperation activation;

    public TerminalActivationController(ActivateTerminalOperation activation) {
        this.activation = Objects.requireNonNull(activation, "activation");
    }

    @PostMapping("/activation")
    public ResponseEntity<TerminalActivationResult> activate(
            @PathVariable String groupWorkspaceKey, @RequestBody TerminalActivationRequest request) {
        ActivationResult result = activation.execute(groupWorkspaceKey, request);
        if (result.outcome() != ActivationOutcome.ACTIVATED) throw TerminalActivationProblem.from(result.outcome());
        return ResponseEntity.ok(new TerminalActivationResult(
                result.terminalRef(), result.storeRef(), result.groupWorkspaceKey(), result.bindingGeneration()));
    }
}
