package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportReceipt;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateReportRequest;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportInput;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Credential-protected HTTP receipt for actual terminal update facts. */
@RestController
@RequestMapping("/api/terminal/group-workspaces/{groupWorkspaceKey}/update-reports")
public final class TerminalUpdateReportController {
    private static final Logger log = LoggerFactory.getLogger(TerminalUpdateReportController.class);
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();

    private final TerminalCredentialVerificationApi credentials;
    private final TerminalUpdateReportOwnerApi reports;

    public TerminalUpdateReportController(TerminalCredentialVerificationApi credentials,
            TerminalUpdateReportOwnerApi reports) {
        this.credentials = credentials;
        this.reports = reports;
    }

    @PostMapping
    ResponseEntity<TerminalUpdateReportReceipt> submit(@PathVariable String groupWorkspaceKey,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Terminal-Ref", required = false) String terminalRef,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody TerminalUpdateReportRequest request) {
        if (request == null || request.reportId() == null || request.reportSequence() == null
                || request.actual() == null || request.recent() == null
                || idempotencyKey == null || idempotencyKey.length() < 16 || idempotencyKey.length() > 128
                || !idempotencyKey.equals(request.reportId().toString())) throw new InvalidReportException();
        Verification binding = TerminalCredentialEdgeVerifier.verify(credentials, groupWorkspaceKey,
                authorization, terminalRef);
        validate(request);
        String actualJson = json(request.actual());
        String recentJson = json(request.recent());
        String bodyHash = Sha256Hex.digest(json(request));
        ReportInput input = new ReportInput(request.reportId(), request.reportSequence(), request.taskId(),
                binding.bindingDeviceId(), actualJson, recentJson, request.recent().changedAtEpochMillis(), bodyHash);
        var receipt = reports.record(binding, input);
        log.atInfo().addKeyValue("event", "TERMINAL_UPDATE_REPORT_ACCEPTED")
                .addKeyValue("terminalRef", binding.terminalRef())
                .addKeyValue("reportId", receipt.reportId())
                .addKeyValue("taskId", receipt.taskId())
                .addKeyValue("reportSequence", receipt.acceptedSequence())
                .addKeyValue("outcome", receipt.outcome())
                .log("Terminal update report committed");
        return ResponseEntity.ok(new TerminalUpdateReportReceipt(receipt.reportId(), receipt.taskId(),
                receipt.acceptedSequence(), receipt.outcome()));
    }

    @ExceptionHandler(InvalidReportException.class)
    ResponseEntity<ContractProblemAdvice.Problem> invalid(InvalidReportException failure,
            jakarta.servlet.http.HttpServletRequest request) {
        return ContractProblemAdvice.problem(HttpStatus.UNPROCESSABLE_ENTITY,
                "PLATFORM_COMMON_VALIDATION_FAILED", "终端更新报告无效", request);
    }

    @ExceptionHandler(TerminalUpdateReportOwnerApi.IdentityConflictException.class)
    ResponseEntity<ContractProblemAdvice.Problem> conflict(TerminalUpdateReportOwnerApi.IdentityConflictException failure,
            jakarta.servlet.http.HttpServletRequest request) {
        return ContractProblemAdvice.problem(HttpStatus.CONFLICT,
                "TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT", "终端更新报告身份冲突", request);
    }

    @ExceptionHandler(TerminalUpdateReportOwnerApi.BindingNoLongerActiveException.class)
    ResponseEntity<ContractProblemAdvice.Problem> inactiveBinding(
            TerminalUpdateReportOwnerApi.BindingNoLongerActiveException failure,
            jakarta.servlet.http.HttpServletRequest request) {
        return ContractProblemAdvice.problem(HttpStatus.FORBIDDEN,
                "TERMINAL_BINDING_CREDENTIAL_INVALID", "终端凭证无效", request);
    }

    private static String json(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (tools.jackson.core.JacksonException malformed) { throw new InvalidReportException(); }
    }

    private static void validate(TerminalUpdateReportRequest request) {
        if (request.reportSequence() < 1 || request.reportSequence() > 9_007_199_254_740_991L
                || request.recent().changedAtEpochMillis() == null || request.recent().changedAtEpochMillis() < 0
                || !oneOf(request.recent().state(), "WAITING_USER", "DOWNLOADING", "VERIFYING", "INSTALLING",
                        "APPLYING_HOT", "SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN")
                || !oneOf(request.recent().reason(), "NONE", "NETWORK", "HTTP_REJECTED", "HASH_MISMATCH",
                        "PREPARE_FAILED", "INSTALLER_CANCELLED", "INSTALL_FAILED", "HOT_APPLY_FAILED", "UNKNOWN")
                || !oneOf(request.actual().entryKind(), "INSTALLED_APK", "EMBEDDED_BUNDLE", "HOT_BUNDLE", "UNKNOWN")
                || !oneOfNullable(request.actual().unknownReason(), "READBACK_UNAVAILABLE", "NOT_INSTALLED", "MISMATCH", "OTHER")
                || !nullableText(request.actual().apkVersion()) || !nullableText(request.actual().jsVersion())
                || !nullableText(request.actual().publicationId()) || !nullableHash(request.actual().apkSha256())
                || !nullableHash(request.actual().bundleSha256()) || !nullableNonNegativeInteger(request.actual().nativeBuildNumber()))
            throw new InvalidReportException();
    }

    private static boolean nullableText(tools.jackson.databind.JsonNode value) {
        return value == null || value.isNull() || value.isTextual();
    }

    private static boolean nullableHash(tools.jackson.databind.JsonNode value) {
        return value == null || value.isNull() || (value.isTextual() && value.textValue().matches("[a-f0-9]{64}"));
    }

    private static boolean nullableNonNegativeInteger(tools.jackson.databind.JsonNode value) {
        return value == null || value.isNull() || (value.isIntegralNumber() && value.longValue() >= 0);
    }

    private static boolean oneOf(String value, String... allowed) {
        return value != null && java.util.Arrays.asList(allowed).contains(value);
    }

    private static boolean oneOfNullable(String value, String... allowed) {
        return value == null || java.util.Arrays.asList(allowed).contains(value);
    }

    public static final class InvalidReportException extends RuntimeException {}
}
