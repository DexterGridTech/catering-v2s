package com.catering.v2s.terminal.adapter.android.update

internal fun isUnconfirmedHotCandidate(
  entryKind: String,
  bootConfirmed: Boolean,
  candidatePublicationId: String,
  selectedPublicationId: String,
): Boolean = entryKind == "hot" && !bootConfirmed && candidatePublicationId.isNotBlank() &&
  candidatePublicationId == selectedPublicationId

internal fun isUnconfirmedRecoveryBoot(recoveryBootPending: Boolean, bootConfirmed: Boolean): Boolean =
  recoveryBootPending && !bootConfirmed
