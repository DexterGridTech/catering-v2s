package com.catering.v2s.app.edge.terminal;

import org.springframework.http.HttpStatus;

/** Typed, secret-free problems for credential-protected terminal read operations. */
public final class TerminalDataReadProblem extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String detail;

    private TerminalDataReadProblem(HttpStatus status, String code, String detail) {
        super(code);
        this.status = status;
        this.code = code;
        this.detail = detail;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public String detail() { return detail; }

    static TerminalDataReadProblem denied() {
        return new TerminalDataReadProblem(HttpStatus.FORBIDDEN, "PLATFORM_COMMON_ACCESS_DENIED", "终端无权读取该资料");
    }

    static TerminalDataReadProblem notFound() {
        return new TerminalDataReadProblem(HttpStatus.NOT_FOUND, "PLATFORM_COMMON_RESOURCE_NOT_FOUND", "资料不存在");
    }

    static TerminalDataReadProblem credentialInvalid() {
        return new TerminalDataReadProblem(HttpStatus.FORBIDDEN, "TERMINAL_BINDING_CREDENTIAL_INVALID", "终端凭证无效");
    }

    static TerminalDataReadProblem workspaceDisabled() {
        return new TerminalDataReadProblem(
                HttpStatus.FORBIDDEN, "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED", "集团空间已停用");
    }

    static TerminalDataReadProblem terminalDisabled() {
        return new TerminalDataReadProblem(HttpStatus.CONFLICT, "STORE_TERMINAL_DISABLED", "终端已停用");
    }
}
