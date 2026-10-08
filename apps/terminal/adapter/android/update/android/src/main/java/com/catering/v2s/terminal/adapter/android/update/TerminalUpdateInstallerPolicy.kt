package com.catering.v2s.terminal.adapter.android.update

internal data class BusyInstallerExit(
  val state: String,
  val reason: String?,
  val installerState: String,
)

internal fun busyInstallerExit(targetInstalled: Boolean?, previousIdentityUnchanged: Boolean?): BusyInstallerExit? = when {
  targetInstalled == true -> BusyInstallerExit("succeeded", null, "none")
  targetInstalled == false && previousIdentityUnchanged == true ->
    BusyInstallerExit("user-cancelled", "ENDED_NOT_INSTALLED", "ended")
  else -> null
}

internal fun isCurrentFullInstallerCallback(
  currentTaskId: String,
  currentActionId: String,
  currentKind: String,
  currentSessionId: Int,
  currentApplicationId: String,
  currentNativeBuildNumber: Long,
  currentPublicationId: String,
  currentApkSha256: String,
  callbackTaskId: String,
  callbackActionId: String,
  callbackSessionId: Int,
  callbackApplicationId: String?,
  callbackNativeBuildNumber: Long,
  callbackPublicationId: String?,
  callbackApkSha256: String?,
): Boolean = currentKind == "full" &&
  currentTaskId == callbackTaskId && currentActionId == callbackActionId &&
  currentSessionId >= 0 && currentSessionId == callbackSessionId &&
  currentApplicationId.isNotBlank() && currentApplicationId == callbackApplicationId &&
  currentNativeBuildNumber >= 0 && currentNativeBuildNumber == callbackNativeBuildNumber &&
  currentPublicationId.isNotBlank() && currentPublicationId == callbackPublicationId &&
  currentApkSha256.matches(Regex("[0-9a-fA-F]{64}")) &&
  currentApkSha256.equals(callbackApkSha256, ignoreCase = true)

internal fun isResumableInstallerSession(
  sessionApplicationId: String?,
  applicationId: String,
  committed: Boolean,
  sealed: Boolean,
): Boolean = sessionApplicationId == applicationId && committed && sealed

internal fun isMatchingInstallerConfirmation(
  expectedSessionId: Int,
  confirmationSessionId: Int,
  hasResolvedActivity: Boolean,
): Boolean = expectedSessionId >= 0 &&
  confirmationSessionId == expectedSessionId && hasResolvedActivity
