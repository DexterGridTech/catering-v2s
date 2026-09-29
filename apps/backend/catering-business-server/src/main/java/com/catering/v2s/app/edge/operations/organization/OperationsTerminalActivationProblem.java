package com.catering.v2s.app.edge.operations.organization;

import org.springframework.http.HttpStatus;

/** Fixed HTTP mapping for stale or inactive operations-side binding cancellation requests. */
public final class OperationsTerminalActivationProblem extends RuntimeException {
    private final String code;
    private final String detail;

    private OperationsTerminalActivationProblem(String code, String detail) {
        super(code);
        this.code = code;
        this.detail = detail;
    }

    public String code() {
        return code;
    }

    public String detail() {
        return detail;
    }

    public HttpStatus status() {
        return "TERMINAL_BINDING_NOT_ACTIVE".equals(code) ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    }

    public static OperationsTerminalActivationProblem notActive() {
        return new OperationsTerminalActivationProblem("TERMINAL_BINDING_NOT_ACTIVE", "终端当前未激活");
    }

    public static OperationsTerminalActivationProblem bindingChanged() {
        // spotless:off
        return new OperationsTerminalActivationProblem("TERMINAL_BINDING_CHANGED",
            "终端绑定已变化，请重新读取后再操作");
        // spotless:on
    }
}
