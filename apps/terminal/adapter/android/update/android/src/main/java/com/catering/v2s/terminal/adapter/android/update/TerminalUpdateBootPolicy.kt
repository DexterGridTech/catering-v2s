package com.catering.v2s.terminal.adapter.android.update

internal fun selectRecoveryTarget(
  candidatePublicationId: String,
  safeEmbeddedPublicationId: String?,
  safePreviousHotPublicationId: String?,
  safePreviousHotFile: String?,
): Triple<String, String, String?> = when {
  safeEmbeddedPublicationId != null -> Triple("embedded", safeEmbeddedPublicationId, null)
  safePreviousHotPublicationId != null && safePreviousHotFile != null ->
    Triple("file-recovery", safePreviousHotPublicationId, safePreviousHotFile)
  else -> Triple("failed", candidatePublicationId, null)
}

internal fun isUnconfirmedHotCandidate(
  entryKind: String,
  bootConfirmed: Boolean,
  candidatePublicationId: String,
  selectedPublicationId: String,
): Boolean = entryKind == "hot" && !bootConfirmed && candidatePublicationId.isNotBlank() &&
  candidatePublicationId == selectedPublicationId

internal fun isUnconfirmedRecoveryBoot(recoveryBootPending: Boolean, bootConfirmed: Boolean): Boolean =
  recoveryBootPending && !bootConfirmed

internal fun hotActionReadbackState(
  actionState: String,
  actionPublicationId: String,
  actionBootToken: String,
  entryKind: String,
  selectedPublicationId: String,
  currentBootToken: String,
  bootConfirmed: Boolean,
  bootPublicationId: String,
): String = when {
  bootConfirmed && bootPublicationId == actionPublicationId -> "succeeded"
  actionState == "failed" -> "failed"
  actionState == "applying" && entryKind == "hot" && actionBootToken.isNotBlank() &&
    actionBootToken == currentBootToken && selectedPublicationId == actionPublicationId -> "accepted"
  else -> actionState
}
