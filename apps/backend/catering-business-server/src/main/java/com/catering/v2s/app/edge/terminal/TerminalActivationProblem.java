package com.catering.v2s.app.edge.terminal;

import com.catering.v2s.terminalbinding.api.TerminalBindingOwnerApi.ActivationOutcome;
import org.springframework.http.HttpStatus;

/** Fixed, secret-free HTTP mapping for activation owner outcomes. */
public final class TerminalActivationProblem extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String detail;

    private TerminalActivationProblem(HttpStatus status, String code, String detail) {
        super(code);
        this.status = status;
        this.code = code;
        this.detail = detail;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String detail() {
        return detail;
    }

    static TerminalActivationProblem from(ActivationOutcome outcome) {
        return switch (outcome) {
            case GROUP_WORKSPACE_DISABLED -> new TerminalActivationProblem(
                    HttpStatus.FORBIDDEN, "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED", "集团空间已停用");
            case RESOURCE_NOT_FOUND -> new TerminalActivationProblem(
                    HttpStatus.NOT_FOUND, "PLATFORM_COMMON_RESOURCE_NOT_FOUND", "没有这个激活码");
            case STORE_VOIDED -> new TerminalActivationProblem(
                    HttpStatus.NOT_FOUND, "STORE_TERMINAL_STORE_VOIDED", "门店已作废");
            case STORE_DISABLED -> new TerminalActivationProblem(
                    HttpStatus.FORBIDDEN, "PLATFORM_COMMON_ACCESS_DENIED", "门店已停用，无法激活新设备");
            case TERMINAL_VOIDED -> new TerminalActivationProblem(
                    HttpStatus.CONFLICT, "STORE_TERMINAL_VOIDED_IMMUTABLE", "终端已作废");
            case TERMINAL_DISABLED -> new TerminalActivationProblem(
                    HttpStatus.CONFLICT, "STORE_TERMINAL_DISABLED", "终端已停用");
            case DEVICE_TYPE_MISMATCH -> new TerminalActivationProblem(
                    // spotless:off
                    HttpStatus.CONFLICT, "STORE_TERMINAL_DEVICE_TYPE_MISMATCH",
                        "设备形态与终端设备类型不一致");
                    // spotless:on
            case ALREADY_BOUND -> new TerminalActivationProblem(
                    HttpStatus.CONFLICT, "TERMINAL_BINDING_ALREADY_BOUND", "终端已绑定另一台设备");
            case ACTIVATION_EXPIRED -> new TerminalActivationProblem(
                    HttpStatus.CONFLICT, "TERMINAL_BINDING_ACTIVATION_EXPIRED", "本次激活已失效");
            case ACTIVATED -> throw new IllegalArgumentException("successful activation has no problem mapping");
        };
    }
}
