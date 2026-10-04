package com.catering.v2s.generated.operationbindings.platformiam;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for platform-iam. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class PlatformIamOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.PlatformCurrentPasswordChangeResult changeCurrentPlatformPassword(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformCurrentPasswordChangeRequest request);
    OperationBindingTypes.Wire.PlatformPasswordRecoveryCompletion completePlatformPasswordRecovery(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryCompleteRequest request);
    OperationBindingTypes.Wire.PlatformAdminDetail createPlatformAdmin(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminCreateRequest request);
    OperationBindingTypes.Wire.PlatformSessionView getCurrentPlatformSession(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PlatformAdminDetail getPlatformAdminDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PlatformAdminPage getPlatformAdminPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.NoContent platformLogout(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.PlatformSessionView platformPasswordLogin(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.LoginRequest request);
    OperationBindingTypes.Wire.PlatformAdminDetail resetPlatformAdminCredential(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminCredentialResetRequest request);
    OperationBindingTypes.Wire.PlatformOtpDispatchResponse sendPlatformLoginOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformLoginOtpSendRequest request);
    OperationBindingTypes.Wire.PlatformOtpDispatchResponse sendPlatformPasswordRecoveryOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryOtpSendRequest request);
    OperationBindingTypes.Wire.PlatformPasswordRecoveryStartResponse startPlatformPasswordRecovery(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryStartRequest request);
    OperationBindingTypes.Wire.PlatformAdminDetail transitionPlatformAdminStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminStatusTransitionRequest request);
    OperationBindingTypes.Wire.PlatformAdminDetail updatePlatformAdminProfile(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminProfileUpdateRequest request);
    OperationBindingTypes.Wire.PlatformSessionView verifyPlatformLoginOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformLoginOtpVerifyRequest request);
    OperationBindingTypes.Wire.PlatformPasswordRecoveryVerification verifyPlatformPasswordRecoveryOtp(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryOtpVerifyRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public PlatformIamOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor CHANGE_CURRENT_PLATFORM_PASSWORD_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("changeCurrentPlatformPassword", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor COMPLETE_PLATFORM_PASSWORD_RECOVERY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("completePlatformPasswordRecovery", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_PLATFORM_ADMIN_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createPlatformAdmin", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_CURRENT_PLATFORM_SESSION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getCurrentPlatformSession", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ADMIN_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformAdminDetail", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ADMIN_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformAdminPage", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor PLATFORM_LOGOUT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("platformLogout", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor PLATFORM_PASSWORD_LOGIN_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("platformPasswordLogin", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor RESET_PLATFORM_ADMIN_CREDENTIAL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("resetPlatformAdminCredential", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SEND_PLATFORM_LOGIN_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("sendPlatformLoginOtp", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor SEND_PLATFORM_PASSWORD_RECOVERY_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("sendPlatformPasswordRecoveryOtp", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor START_PLATFORM_PASSWORD_RECOVERY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("startPlatformPasswordRecovery", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_PLATFORM_ADMIN_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionPlatformAdminStatus", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_PLATFORM_ADMIN_PROFILE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updatePlatformAdminProfile", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor VERIFY_PLATFORM_LOGIN_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("verifyPlatformLoginOtp", "platform-iam", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor VERIFY_PLATFORM_PASSWORD_RECOVERY_OTP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("verifyPlatformPasswordRecoveryOtp", "platform-iam", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getCurrentPlatformSession" -> { if (descriptor != GET_CURRENT_PLATFORM_SESSION_DESCRIPTOR || !"platform-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformAdminDetail" -> { if (descriptor != GET_PLATFORM_ADMIN_DETAIL_DESCRIPTOR || !"platform-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformAdminPage" -> { if (descriptor != GET_PLATFORM_ADMIN_PAGE_DESCRIPTOR || !"platform-iam".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getCurrentPlatformSession" -> adapters.getCurrentPlatformSession(GET_CURRENT_PLATFORM_SESSION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformAdminDetail" -> adapters.getPlatformAdminDetail(GET_PLATFORM_ADMIN_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformAdminPage" -> adapters.getPlatformAdminPage(GET_PLATFORM_ADMIN_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }

  public OperationBindingTypes.Wire.PlatformCurrentPasswordChangeResult changeCurrentPlatformPassword(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformCurrentPasswordChangeRequest request) {
    return adapters.changeCurrentPlatformPassword(CHANGE_CURRENT_PLATFORM_PASSWORD_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformPasswordRecoveryCompletion completePlatformPasswordRecovery(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryCompleteRequest request) {
    return adapters.completePlatformPasswordRecovery(COMPLETE_PLATFORM_PASSWORD_RECOVERY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformAdminDetail createPlatformAdmin(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminCreateRequest request) {
    return adapters.createPlatformAdmin(CREATE_PLATFORM_ADMIN_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.NoContent platformLogout(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.platformLogout(PLATFORM_LOGOUT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformSessionView platformPasswordLogin(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.LoginRequest request) {
    return adapters.platformPasswordLogin(PLATFORM_PASSWORD_LOGIN_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformAdminDetail resetPlatformAdminCredential(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminCredentialResetRequest request) {
    return adapters.resetPlatformAdminCredential(RESET_PLATFORM_ADMIN_CREDENTIAL_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformOtpDispatchResponse sendPlatformLoginOtp(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformLoginOtpSendRequest request) {
    return adapters.sendPlatformLoginOtp(SEND_PLATFORM_LOGIN_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformOtpDispatchResponse sendPlatformPasswordRecoveryOtp(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryOtpSendRequest request) {
    return adapters.sendPlatformPasswordRecoveryOtp(SEND_PLATFORM_PASSWORD_RECOVERY_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformPasswordRecoveryStartResponse startPlatformPasswordRecovery(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryStartRequest request) {
    return adapters.startPlatformPasswordRecovery(START_PLATFORM_PASSWORD_RECOVERY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformAdminDetail transitionPlatformAdminStatus(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminStatusTransitionRequest request) {
    return adapters.transitionPlatformAdminStatus(TRANSITION_PLATFORM_ADMIN_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformAdminDetail updatePlatformAdminProfile(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformAdminProfileUpdateRequest request) {
    return adapters.updatePlatformAdminProfile(UPDATE_PLATFORM_ADMIN_PROFILE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformSessionView verifyPlatformLoginOtp(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformLoginOtpVerifyRequest request) {
    return adapters.verifyPlatformLoginOtp(VERIFY_PLATFORM_LOGIN_OTP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.PlatformPasswordRecoveryVerification verifyPlatformPasswordRecoveryOtp(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.PlatformPasswordRecoveryOtpVerifyRequest request) {
    return adapters.verifyPlatformPasswordRecoveryOtp(VERIFY_PLATFORM_PASSWORD_RECOVERY_OTP_DESCRIPTOR, context, request);
  }
}
