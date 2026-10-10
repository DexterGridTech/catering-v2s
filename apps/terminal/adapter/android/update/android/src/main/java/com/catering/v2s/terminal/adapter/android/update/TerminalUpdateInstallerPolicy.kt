package com.catering.v2s.terminal.adapter.android.update

internal data class BusyInstallerExit(
  val state: String,
  val reason: String?,
  val installerState: String,
)

internal fun matchesInstalledFullAction(
  actual: TerminalUpdateInstalledIdentity,
  actionApplicationId: String,
  actionNativeBuildNumber: Long,
  actionPublicationId: String,
  actionApkSha256: String?,
): Boolean = actionApkSha256 != null &&
  actual.applicationId == actionApplicationId &&
  actual.nativeBuildNumber == actionNativeBuildNumber &&
  actual.publicationId == actionPublicationId &&
  actual.apkSha256.equals(actionApkSha256, ignoreCase = true)

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

internal fun isPendingUserInstallerAction(
  sessionPresent: Boolean,
  installerState: String,
  actionState: String,
): Boolean = sessionPresent &&
  installerState == "pending-user" &&
  actionState !in setOf("callback-success", "callback-aborted", "callback-failed", "succeeded", "failed")

internal fun isMatchingInstallerConfirmation(
  expectedSessionId: Int,
  confirmationSessionId: Int,
  hasResolvedActivity: Boolean,
): Boolean = expectedSessionId >= 0 &&
  confirmationSessionId == expectedSessionId && hasResolvedActivity

internal fun shouldResumePendingInstallerConfirmation(
  actionKind: String,
  actionState: String,
  installerState: String,
  awaitingSourcePermission: Boolean,
  canRequestPackageInstalls: Boolean,
  attemptedInCurrentProcess: Boolean,
): Boolean = actionKind == "full" &&
  actionState == "pending-user" &&
  installerState == "pending-user" &&
  awaitingSourcePermission &&
  canRequestPackageInstalls &&
  !attemptedInCurrentProcess
