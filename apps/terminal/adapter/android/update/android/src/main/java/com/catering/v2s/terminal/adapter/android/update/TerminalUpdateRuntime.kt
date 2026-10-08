package com.catering.v2s.terminal.adapter.android.update

import android.content.Context
import android.content.Intent
import android.app.AppOpsManager
import android.app.PendingIntent
import android.content.pm.PackageInstaller
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.UserManager
import android.provider.Settings
import android.util.AtomicFile
import android.util.Log
import com.facebook.react.ReactHost
import com.facebook.react.bridge.ReactContext
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.security.MessageDigest
import java.util.UUID
import java.util.WeakHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

internal data class TerminalUpdateInstalledIdentity(
  val applicationId: String,
  val nativeBuildNumber: Long,
  val publicationId: String,
  val embeddedBundleVersion: String,
) {
  fun key(): String = "$applicationId:$nativeBuildNumber:$publicationId"
}

internal data class TerminalUpdateBootReservation(
  val token: String,
  val installedIdentity: TerminalUpdateInstalledIdentity,
  val entryKind: String,
  val publicationId: String,
  val bundleFile: String?,
  val embeddedBundleAssetName: String,
)

internal fun selectedBundleVersionForFacts(
  entryKind: String?,
  selectedBundleVersion: String?,
  embeddedBundleVersion: String,
): String? = when (entryKind) {
  null, "", "embedded" -> embeddedBundleVersion
  "hot", "file-recovery" -> selectedBundleVersion?.takeIf {
    it.matches(Regex("(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)"))
  }
  else -> null
}

/** Process boot/entry facts. Business task state remains owned by terminal-update in JS. */
internal object TerminalUpdateRuntime {
  private const val LOG_TAG = "TerminalUpdate"
  private const val RECORD_NAME = "terminal-update-native.json"
  private const val PUBLICATION_ASSET = "terminal-update-publication.json"
  private const val PUBLICATION_ID_METADATA = "com.catering.v2s.terminal.PUBLICATION_ID"
  private const val PUBLICATION_MANIFEST_ASSET_METADATA = "com.catering.v2s.terminal.PUBLICATION_ASSET"
  private const val EMBEDDED_BUNDLE_ASSET_METADATA = "com.catering.v2s.terminal.BUNDLE_ASSET"
  private const val EMBEDDED_ENTRY = "assets/index.android.bundle"
  private const val MAX_PUBLICATION_BYTES = 256 * 1024L
  private const val MAX_EMBEDDED_BYTES = 256L * 1024 * 1024
  private const val MAX_HOT_BUNDLE_BYTES = 256L * 1024 * 1024
  private const val HOT_BOOT_TIMEOUT_MS = 60_000L
  const val ACTION_INSTALL_STATUS = "com.catering.v2s.terminal.update.INSTALL_STATUS"
  const val EXTRA_ACTION_ID = "terminalUpdateActionId"
  const val EXTRA_TASK_ID = "terminalUpdateTaskId"
  private const val EXTRA_APPLICATION_ID = "terminalUpdateApplicationId"
  private const val EXTRA_NATIVE_BUILD_NUMBER = "terminalUpdateNativeBuildNumber"
  private const val EXTRA_PUBLICATION_ID = "terminalUpdatePublicationId"
  private const val EXTRA_APK_SHA256 = "terminalUpdateApkSha256"

  private val lock = Any()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val contextBoots = WeakHashMap<ReactContext, String>()
  @Volatile private var application: WeakReference<Context>? = null
  @Volatile private var reactHost: WeakReference<ReactHost>? = null
  @Volatile private var currentReservation: TerminalUpdateBootReservation? = null
  @Volatile private var selectionResetReason: String? = null
  private var bootDeadline: Runnable? = null

  fun beginBoot(context: Context): TerminalUpdateBootReservation = synchronized(lock) {
    val app = context.applicationContext
    application = WeakReference(app)
    bindCurrentContextToPreviousReservation()
    val actual = readInstalledIdentity(app)
    val previous = readRecord(app)
    val changed = previous != null && previous.optString("installedIdentity") != actual.key()
    val unconfirmedCandidate = !changed && previous != null && isUnconfirmedHotCandidate(
      previous.optString("entryKind"), previous.optBoolean("bootConfirmed"),
      previous.optString("candidatePublicationId"), previous.optString("selectedPublicationId"),
    )
    val unconfirmedRecovery = !changed && previous != null && previous.optBoolean("rollbackAttempted") && isUnconfirmedRecoveryBoot(
      previous.optBoolean("recoveryBootPending"), previous.optBoolean("bootConfirmed"),
    )
    val recovery = if (unconfirmedCandidate) recoverPreviousSelection(app, previous!!, actual) else null
    val selectedKind = when {
      changed -> "embedded"
      unconfirmedRecovery -> "failed"
      recovery != null -> recovery.first
      else -> previous?.optString("entryKind")?.takeIf { it.isNotBlank() } ?: "embedded"
    }
    val selectedPublication = when {
      changed || selectedKind == "embedded" -> actual.publicationId
      recovery != null -> recovery.second
      else -> previous?.optString("selectedPublicationId")?.takeIf { it.isNotBlank() } ?: actual.publicationId
    }
    val selectedFile = when {
      selectedKind == "embedded" || selectedKind == "failed" -> null
      recovery != null -> recovery.third
      else -> previous?.optString("selectedBundleFile")?.takeIf { it.isNotBlank() }
    }
    val selectedBundleVersion = when {
      selectedKind == "embedded" -> actual.embeddedBundleVersion
      recovery != null && recovery.first == "embedded" -> actual.embeddedBundleVersion
      recovery != null -> previous?.optString("previousBundleVersion")?.takeIf { it.isNotBlank() && it != "null" }
      selectedKind == "failed" -> null
      else -> previous?.optString("selectedBundleVersion")?.takeIf { it.isNotBlank() }
    }
    val embeddedBundleAssetName = readPublicationMetadata(app).second
    if (selectedKind != "embedded" && selectedKind != "failed" && (selectedFile == null || !File(selectedFile).isFile)) {
      throw IllegalStateException("TERMINAL_UPDATE_SELECTED_BUNDLE_UNAVAILABLE")
    }
    val reservation = TerminalUpdateBootReservation(
      UUID.randomUUID().toString(), actual, selectedKind, selectedPublication, selectedFile, embeddedBundleAssetName,
    )
    val nextRecord = previous ?: JSONObject()
    if (changed) {
      nextRecord.put("previousInstalledIdentity", previous?.optString("installedIdentity") ?: JSONObject.NULL)
      nextRecord.put("previousPublicationId", previous?.optString("selectedPublicationId") ?: JSONObject.NULL)
      nextRecord.put("entryKind", "embedded")
      nextRecord.put("selectedBundleFile", JSONObject.NULL)
      nextRecord.put("selectedPublicationId", actual.publicationId)
      nextRecord.put("selectedBundleVersion", actual.embeddedBundleVersion)
      nextRecord.put("candidatePublicationId", JSONObject.NULL)
      nextRecord.put("previousEntryKind", JSONObject.NULL)
      nextRecord.put("previousBundleFile", JSONObject.NULL)
      nextRecord.put("previousBundleSha256", JSONObject.NULL)
      nextRecord.put("failedCandidatePublicationId", JSONObject.NULL)
      nextRecord.put("recoveryBootPending", false)
      nextRecord.put("rollbackAttempted", false)
    }
    if (unconfirmedCandidate) {
      nextRecord.put("failedCandidatePublicationId", previous!!.optString("candidatePublicationId"))
      nextRecord.put("actionState", "failed")
      nextRecord.put("actionReason", "HOT_BOOT_UNCONFIRMED")
      nextRecord.put("rollbackAttempted", true)
      nextRecord.put("recoveryBootPending", selectedKind != "failed")
      nextRecord.put("entryKind", selectedKind)
      nextRecord.put("selectedPublicationId", selectedPublication)
      if (selectedBundleVersion == null) nextRecord.put("selectedBundleVersion", JSONObject.NULL)
      else nextRecord.put("selectedBundleVersion", selectedBundleVersion)
      if (selectedFile == null) nextRecord.put("selectedBundleFile", JSONObject.NULL)
      else nextRecord.put("selectedBundleFile", selectedFile)
    }
    if (unconfirmedRecovery) {
      nextRecord.put("actionState", "failed")
      nextRecord.put("actionReason", "HOT_ROLLBACK_BOOT_UNCONFIRMED")
      nextRecord.put("recoveryBootPending", false)
      nextRecord.put("entryKind", "failed")
      nextRecord.put("selectedBundleFile", JSONObject.NULL)
      nextRecord.put("selectedBundleVersion", JSONObject.NULL)
    }
    nextRecord.apply {
      put("installedIdentity", actual.key())
      put("applicationId", actual.applicationId)
      put("nativeBuildNumber", actual.nativeBuildNumber)
      put("embeddedPublicationId", actual.publicationId)
      put("entryKind", selectedKind)
      put("selectedPublicationId", selectedPublication)
      if (selectedBundleVersion == null) put("selectedBundleVersion", JSONObject.NULL)
      else put("selectedBundleVersion", selectedBundleVersion)
      if (selectedFile != null) put("selectedBundleFile", selectedFile)
      else remove("selectedBundleFile")
      put("bootToken", reservation.token)
      put("bootConfirmed", false)
      put("selectionResetReason", if (changed) "APK_CHANGED_SELECTION_RESET" else JSONObject.NULL)
    }
    writeRecord(app, nextRecord)
    currentReservation = reservation
    selectionResetReason = if (changed) "APK_CHANGED_SELECTION_RESET" else null
    cancelBootDeadline()
    scheduleBootDeadline(app, reservation)
    Log.i(LOG_TAG, "event=boot-reserved entryKind=$selectedKind apkChanged=$changed")
    reservation
  }

  fun registerReactHost(context: Context, host: ReactHost) = synchronized(lock) {
    application = WeakReference(context.applicationContext)
    reactHost = WeakReference(host)
  }

  fun bindReactContext(context: ReactContext) = synchronized(lock) {
    if (!contextBoots.containsKey(context)) {
      val token = currentReservation?.token ?: readRecord(context.applicationContext)?.optString("bootToken")
      if (!token.isNullOrBlank()) contextBoots[context] = token
    }
  }

  fun bootTokenFor(context: ReactContext): String? = synchronized(lock) {
    contextBoots[context]
  }

  fun jsBundleFile(useDeveloperSupport: Boolean): String? {
    if (useDeveloperSupport) return null
    val reservation = currentReservation ?: synchronized(lock) {
      val app = application?.get() ?: throw IllegalStateException("TERMINAL_UPDATE_APPLICATION_NOT_READY")
      val record = readRecord(app) ?: throw IllegalStateException("TERMINAL_UPDATE_BOOT_RESERVATION_MISSING")
      val identity = readInstalledIdentity(app)
      if (record.optString("installedIdentity") != identity.key()) {
        throw IllegalStateException("TERMINAL_UPDATE_BOOT_APK_IDENTITY_MISMATCH")
      }
      TerminalUpdateBootReservation(
        record.optString("bootToken"), identity, record.optString("entryKind"),
        record.optString("selectedPublicationId"), record.optString("selectedBundleFile").takeIf { it.isNotBlank() },
        readPublicationMetadata(app).second,
      ).also { currentReservation = it }
    }
    return when (reservation.entryKind) {
      "embedded" -> "assets://${reservation.embeddedBundleAssetName}"
      "hot", "file-recovery" -> reservation.bundleFile
        ?.takeIf { File(it).isFile }
        ?: throw IllegalStateException("TERMINAL_UPDATE_SELECTED_BUNDLE_UNAVAILABLE")
      "failed" -> {
        TerminalUpdateStartupFailureView.show()
        throw IllegalStateException("TERMINAL_UPDATE_HOT_BOOT_RECOVERY_UNAVAILABLE")
      }
      else -> throw IllegalStateException("TERMINAL_UPDATE_ENTRY_KIND_UNKNOWN")
    }
  }

  fun selectedFacts(context: Context): Map<String, Any?> = synchronized(lock) {
    val app = context.applicationContext
    val record = readRecord(app)
    val actual = readInstalledIdentity(app)
    val (manifestAsset, _) = readPublicationMetadata(app)
    val embedded = app.assets.open(manifestAsset).use { input -> JSONObject(String(input.readBounded(MAX_PUBLICATION_BYTES), Charsets.UTF_8)) }
    val selectedBundleVersion = selectedBundleVersionForFacts(
      record?.optString("entryKind"),
      record?.optString("selectedBundleVersion")?.takeIf { it.isNotBlank() && it != "null" },
      embedded.getString("bundleVersion"),
    )
    mapOf(
      "actual" to selectedBundleVersion?.let { bundleVersion -> mapOf(
        "applicationId" to actual.applicationId,
        "nativeVersion" to embedded.getString("nativeVersion"),
        "nativeBuildNumber" to actual.nativeBuildNumber,
        "runtimeVersion" to embedded.getString("runtimeVersion"),
        "bundleVersion" to bundleVersion,
        "publicationId" to (record?.optString("selectedPublicationId")?.takeIf { it.isNotBlank() } ?: actual.publicationId),
        "bootId" to (record?.optString("bootToken") ?: ""),
        "entryKind" to (record?.optString("entryKind") ?: "unknown"),
      ) },
      "embedded" to embedded.toWireMap(),
      "selectedPublicationId" to (record?.optString("selectedPublicationId") ?: actual.publicationId),
      "previousPublicationId" to (record?.optString("previousPublicationId")?.takeIf { it.isNotBlank() }),
      "candidatePublicationId" to (record?.optString("candidatePublicationId")?.takeIf { it.isNotBlank() }),
      "installerActionId" to (record?.optString("actionId")?.takeIf { it.isNotBlank() }),
      "installerState" to (record?.optString("installerState") ?: "none"),
      "selectionResetReason" to selectionResetReason,
    )
  }

  fun reservationFor(context: ReactContext): TerminalUpdateBootReservation? = synchronized(lock) {
    val token = contextBoots[context] ?: return@synchronized null
    val current = currentReservation ?: return@synchronized null
    if (current.token != token) return@synchronized null
    current
  }

  fun markBootConfirmed(context: ReactContext, bootToken: String, publicationId: String): Boolean = synchronized(lock) {
    val reservation = reservationFor(context) ?: return@synchronized false
    if (reservation.token != bootToken || reservation.publicationId != publicationId) return@synchronized false
    val app = context.applicationContext
    val record = readRecord(app) ?: return@synchronized false
    if (record.optString("bootToken") != reservation.token || record.optString("installedIdentity") != reservation.installedIdentity.key()) {
      return@synchronized false
    }
    record.put("bootConfirmed", true)
    record.put("bootPublicationId", publicationId)
    record.put("recoveryBootPending", false)
    record.put("candidatePublicationId", JSONObject.NULL)
    if (record.optString("actionKind") == "hot" && record.optString("actionPublicationId") == publicationId) {
      record.put("actionState", "succeeded")
      record.put("actionReason", JSONObject.NULL)
    }
    writeRecord(app, record)
    cancelBootDeadline()
    Log.i(LOG_TAG, "event=boot-confirmed entryKind=${reservation.entryKind}")
    true
  }

  suspend fun applyPrepared(context: ReactContext, taskId: String, actionId: String, preparedId: String, kind: String): Map<String, Any?> {
    require(taskId.isNotBlank() && actionId.matches(Regex("[A-Za-z0-9._:-]{1,160}"))) {
      "TERMINAL_UPDATE_ACTION_IDENTITY_INVALID"
    }
    require(kind == "full" || kind == "hot") { "TERMINAL_UPDATE_KIND_INVALID" }
    val app = context.applicationContext
    val artifactFile = TerminalUpdateArtifactPreparer.preparedFile(app, preparedId, "artifact.json")
    val artifact = JSONObject(artifactFile.readText(Charsets.UTF_8))
    require(artifact.getString("applicationId") == app.packageName) { "TERMINAL_UPDATE_APPLICATION_IDENTITY_MISMATCH" }
    val existing = record(app)
    if (existing?.optString("actionId") == actionId && existing.optString("taskId") == taskId) {
      return readAction(app, taskId, actionId)
        ?: actionResult(taskId, actionId, "unknown", "ACTION_READBACK_UNAVAILABLE", artifact.getString("publicationId"), null)
    }
    if (existing?.optString("actionState") in setOf("intent", "staged", "committing", "pending-user", "unknown", "applying")) {
      return actionResult(taskId, actionId, "unknown", "RESOURCE_BUSY", artifact.getString("publicationId"), null)
    }
    return if (kind == "hot") applyHot(context, taskId, actionId, preparedId, artifact)
    else applyFull(app, taskId, actionId, preparedId, artifact)
  }

  fun readAction(context: Context, taskId: String, actionId: String): Map<String, Any?>? = synchronized(lock) {
    val app = context.applicationContext
    val value = readRecord(app) ?: return@synchronized null
    if (value.optString("taskId") != taskId || value.optString("actionId") != actionId) return@synchronized null
    val publicationId = value.optString("actionPublicationId")
    if (value.optString("actionKind") == "hot") {
      val confirmed = value.optBoolean("bootConfirmed") && value.optString("bootPublicationId") == publicationId
      val state = when {
        confirmed -> "succeeded"
        value.optString("actionState") == "failed" -> "failed"
        else -> value.optString("actionState", "unknown")
      }
      return@synchronized actionResult(taskId, actionId, state,
        value.optString("actionReason").ifBlank { null }, publicationId, value.optString("actionBootId").ifBlank { null })
    }
    if (value.optString("actionKind") != "full") {
      return@synchronized actionResult(taskId, actionId, "unknown", "ACTION_KIND_UNKNOWN", publicationId, null)
    }
    val targetBuild = value.optLong("actionNativeBuildNumber", -1)
    val actual = runCatching { readInstalledIdentity(app) }.getOrNull()
      ?: return@synchronized actionResult(taskId, actionId, "unknown", "INSTALLED_IDENTITY_UNAVAILABLE", publicationId, null)
    val targetInstalled = actual.applicationId == value.optString("actionApplicationId") &&
      actual.nativeBuildNumber == targetBuild && actual.publicationId == publicationId
    if (targetInstalled) {
      value.put("actionState", "succeeded")
      value.put("installerState", "none")
      writeRecord(app, value)
      return@synchronized actionResult(taskId, actionId, "succeeded", null, publicationId, value.optString("actionBootId").ifBlank { null })
    }
    val installer = app.packageManager.packageInstaller
    val sessionId = value.optInt("installerSessionId", PackageInstaller.SessionInfo.INVALID_ID)
    val sessionRead = if (sessionId != PackageInstaller.SessionInfo.INVALID_ID) {
      runCatching { installer.getSessionInfo(sessionId) != null }
    } else {
      runCatching { installer.mySessions.isNotEmpty() }
    }
    if (sessionRead.isFailure) {
      return@synchronized actionResult(taskId, actionId, "unknown", "INSTALLER_SESSION_READBACK_UNAVAILABLE", publicationId, null)
    }
    val sessionPresent = sessionRead.getOrThrow()
    val state = when {
      sessionPresent -> "unknown"
      value.optString("actionState") == "callback-failed" -> "failed"
      busyInstallerExit(false, value.optString("actionPreviousInstalledIdentity") == actual.key())?.state == "user-cancelled" -> "user-cancelled"
      value.optString("installerState") == "pending-user" -> "waiting-user"
      else -> "unknown"
    }
    val reason = when (state) {
      "failed" -> value.optString("actionReason").ifBlank { "INSTALL_FAILED" }
      "user-cancelled" -> "ENDED_NOT_INSTALLED"
      "unknown" -> value.optString("actionReason").ifBlank { "INSTALLER_STATE_UNKNOWN" }
      else -> null
    }
    actionResult(taskId, actionId, state, reason, publicationId, value.optString("actionBootId").ifBlank { null })
  }

  fun readConfirmedHotAction(context: ReactContext, publicationId: String): Map<String, Any?>? = synchronized(lock) {
    val value = readRecord(context.applicationContext) ?: return@synchronized null
    if (value.optString("actionKind") != "hot" || !value.optBoolean("bootConfirmed")) return@synchronized null
    if (value.optString("actionState") == "failed") {
      return@synchronized actionResult(value.optString("taskId"), value.optString("actionId"), "failed",
        value.optString("actionReason").ifBlank { "HOT_BOOT_UNCONFIRMED" },
        value.optString("actionPublicationId"), value.optString("bootToken"))
    }
    if (value.optString("actionPublicationId") != publicationId ||
      value.optString("bootPublicationId") != publicationId || value.optString("bootToken") != bootTokenFor(context)) return@synchronized null
    actionResult(value.optString("taskId"), value.optString("actionId"), "succeeded", null,
      publicationId, value.optString("bootToken"))
  }

  fun onInstallerStatus(context: Context, intent: Intent) = synchronized(lock) {
    val app = context.applicationContext
    val actionId = intent.getStringExtra(EXTRA_ACTION_ID) ?: return@synchronized
    val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return@synchronized
    val callbackSessionId = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, PackageInstaller.SessionInfo.INVALID_ID)
    val value = readRecord(app) ?: return@synchronized
    if (!isCurrentFullInstallerCallback(
        value.optString("taskId"), value.optString("actionId"), value.optString("actionKind"),
        value.optInt("installerSessionId", PackageInstaller.SessionInfo.INVALID_ID),
        value.optString("actionApplicationId"), value.optLong("actionNativeBuildNumber", -1),
        value.optString("actionPublicationId"), value.optString("actionApkSha256"),
        taskId, actionId, callbackSessionId,
        intent.getStringExtra(EXTRA_APPLICATION_ID),
        intent.getLongExtra(EXTRA_NATIVE_BUILD_NUMBER, -1),
        intent.getStringExtra(EXTRA_PUBLICATION_ID), intent.getStringExtra(EXTRA_APK_SHA256),
      )) {
      Log.w(LOG_TAG, "event=installer-callback status=stale identity=session-or-target-mismatch")
      return@synchronized
    }
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        value.put("installerState", "pending-user")
        value.put("actionState", "pending-user")
        val confirmation = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
        if (confirmation != null) {
          val awaitingSourcePermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !app.packageManager.canRequestPackageInstalls()
          value.put("installerAwaitingSourcePermission", awaitingSourcePermission)
          value.put("installerConfirmationIntentUri", confirmation.toUri(Intent.URI_INTENT_SCHEME))
          value.remove("installerConfirmationResumeAttempted")
          Log.i(LOG_TAG, "event=installer-user-action action=${confirmation.action ?: "none"} package=${confirmation.`package` ?: "none"} component=${confirmation.component?.className ?: "implicit"} dataScheme=${confirmation.data?.scheme ?: "none"} awaitingSourcePermission=$awaitingSourcePermission")
          if (!awaitingSourcePermission) {
            runCatching {
              confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
              app.startActivity(confirmation)
              Log.i(LOG_TAG, "event=installer-user-action-launch outcome=returned")
            }.onFailure {
              Log.e(LOG_TAG, "event=installer-user-action-launch outcome=failed exceptionType=${it.javaClass.simpleName}")
              value.put("actionState", "unknown")
              value.put("actionReason", "INSTALL_CONFIRMATION_UNAVAILABLE")
            }
          } else {
            runCatching {
              val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:${app.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
              app.startActivity(settingsIntent)
              Log.i(LOG_TAG, "event=installer-source-settings-launch outcome=returned packageScoped=true")
            }.onFailure {
              Log.e(LOG_TAG, "event=installer-source-settings-launch outcome=failed exceptionType=${it.javaClass.simpleName}")
              value.put("actionState", "unknown")
              value.put("actionReason", "INSTALL_CONFIRMATION_UNAVAILABLE")
            }
          }
        }
      }
      PackageInstaller.STATUS_SUCCESS -> {
        value.put("actionState", "callback-success")
        value.put("actionReason", JSONObject.NULL)
        value.remove("installerConfirmationIntentUri")
        value.remove("installerAwaitingSourcePermission")
      }
      PackageInstaller.STATUS_FAILURE_ABORTED -> {
        value.put("actionState", "callback-aborted")
        value.put("actionReason", "ABORT_UNCLASSIFIED")
        value.put("installerState", "ended")
        value.remove("installerConfirmationIntentUri")
        value.remove("installerAwaitingSourcePermission")
      }
      else -> {
        value.put("actionState", "callback-failed")
        value.put("actionReason", "INSTALL_FAILED")
        value.put("installerState", "ended")
        value.remove("installerConfirmationIntentUri")
        value.remove("installerAwaitingSourcePermission")
      }
    }
    writeRecord(app, value)
    Log.i(LOG_TAG, "event=installer-callback status=$status")
  }

  /** Replays PackageInstaller's exact user-action Intent once after source permission is granted. */
  fun resumePendingInstallerConfirmation(context: Context) = synchronized(lock) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return@synchronized
    val app = context.applicationContext
    val value = readRecord(app) ?: return@synchronized
    if (value.optString("actionKind") == "full" &&
      value.optString("actionState") == "unknown" &&
      value.optString("actionReason") == "BUSY_UNKNOWN") {
      val sessions = runCatching { app.packageManager.packageInstaller.mySessions }.getOrNull()
      if (sessions == null || sessions.isNotEmpty()) {
        Log.i(LOG_TAG, "event=installer-busy-reconcile outcome=still-occupied query=${if (sessions == null) "failed" else "succeeded"}")
        return@synchronized
      }
      val actual = runCatching { readInstalledIdentity(app) }.getOrNull()
      if (actual == null) {
        Log.i(LOG_TAG, "event=installer-busy-reconcile outcome=installed-identity-unknown")
        return@synchronized
      }
      val targetInstalled = actual.applicationId == value.optString("actionApplicationId") &&
        actual.nativeBuildNumber == value.optLong("actionNativeBuildNumber", -1) &&
        actual.publicationId == value.optString("actionPublicationId")
      val exit = busyInstallerExit(targetInstalled,
        value.optString("actionPreviousInstalledIdentity") == actual.key()) ?: return@synchronized
      value.put("actionState", exit.state)
      value.put("actionReason", exit.reason ?: JSONObject.NULL)
      value.put("installerState", exit.installerState)
      writeRecord(app, value)
      Log.i(LOG_TAG, "event=installer-busy-reconcile outcome=${exit.state}")
      return@synchronized
    }
    if (value.optString("actionKind") != "full" ||
      value.optString("actionState") != "pending-user" ||
      value.optString("installerState") != "pending-user" ||
      !value.optBoolean("installerAwaitingSourcePermission") ||
      value.optBoolean("installerConfirmationResumeAttempted")) return@synchronized

    if (!app.packageManager.canRequestPackageInstalls()) {
      Log.i(LOG_TAG, "event=installer-confirmation-resume outcome=not-authorized")
      return@synchronized
    }

    val sessionId = value.optInt("installerSessionId", PackageInstaller.SessionInfo.INVALID_ID)
    val sessionInfo = if (sessionId != PackageInstaller.SessionInfo.INVALID_ID) {
      runCatching { app.packageManager.packageInstaller.getSessionInfo(sessionId) }.getOrNull()
    } else null
    if (sessionInfo == null || !isResumableInstallerSession(
        sessionInfo.appPackageName, app.packageName, sessionInfo.isCommitted, sessionInfo.isSealed,
      )) {
      Log.i(LOG_TAG, "event=installer-confirmation-resume outcome=session-not-resumable")
      return@synchronized
    }

    val confirmationUri = value.optString("installerConfirmationIntentUri").takeIf { it.isNotBlank() }
    val confirmation = confirmationUri?.let {
      runCatching { Intent.parseUri(it, Intent.URI_INTENT_SCHEME) }.getOrNull()
    }
    if (confirmation == null) {
      value.put("actionState", "unknown")
      value.put("actionReason", "INSTALL_CONFIRMATION_UNAVAILABLE")
      writeRecord(app, value)
      Log.i(LOG_TAG, "event=installer-confirmation-resume outcome=confirmation-intent-unavailable")
      return@synchronized
    }

    value.put("installerConfirmationResumeAttempted", true)
    writeRecord(app, value)
    runCatching {
      confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      app.startActivity(confirmation)
      Log.i(LOG_TAG, "event=installer-confirmation-resume outcome=launched session=$sessionId")
    }.onFailure {
      value.put("actionState", "unknown")
      value.put("actionReason", "INSTALL_CONFIRMATION_UNAVAILABLE")
      writeRecord(app, value)
      Log.e(LOG_TAG, "event=installer-confirmation-resume outcome=failed errorType=${it.javaClass.simpleName}")
    }
  }

  private suspend fun applyHot(context: ReactContext, taskId: String, actionId: String, preparedId: String, artifact: JSONObject): Map<String, Any?> {
    val preparedDirectory = TerminalUpdateArtifactPreparer.preparedDirectory(context.applicationContext, preparedId)
    val entry = artifact.getString("entry")
    require(entry == EMBEDDED_ENTRY) { "TERMINAL_UPDATE_HOT_ENTRY_INVALID" }
    val bundle = File(preparedDirectory, entry).canonicalFile
    require(bundle.isFile && bundle.path.startsWith(preparedDirectory.canonicalPath + File.separator) &&
      bundle.length() <= MAX_HOT_BUNDLE_BYTES) { "TERMINAL_UPDATE_HOT_BUNDLE_INVALID" }
    val expected = artifact.getJSONArray("files").let { files ->
      (0 until files.length()).map { files.getJSONObject(it) }.singleOrNull { it.getString("path") == entry }
    } ?: error("TERMINAL_UPDATE_HOT_BUNDLE_METADATA_MISSING")
    require(bundle.length() == expected.getLong("sizeBytes") &&
      FileInputStream(bundle).use { it.sha256(MAX_HOT_BUNDLE_BYTES) } == expected.getString("sha256")) {
      "TERMINAL_UPDATE_HOT_BUNDLE_DIGEST_MISMATCH"
    }
    val reservation = updateSelection(
      context, artifact.getString("publicationId"), artifact.getString("bundleVersion"), bundle, "hot",
    )
    updateRecord(context) { value ->
      value.put("actionId", actionId); value.put("taskId", taskId); value.put("actionKind", "hot")
      value.put("actionState", "applying"); value.put("actionReason", JSONObject.NULL)
      value.put("actionPublicationId", artifact.getString("publicationId")); value.put("actionBootId", reservation.token)
      value.put("actionPreparedId", preparedId); value.put("bootConfirmed", false)
    }
    val reloadResult = reload("terminal-update:$actionId", 60_000)
    val state = if (reloadResult == "SUCCESSOR_RUNTIME_STARTED") "accepted" else "unknown"
    updateRecord(context) { value ->
      if (value.optString("actionId") == actionId && value.optString("taskId") == taskId &&
        value.optString("actionBootId") == reservation.token && value.optString("bootToken") == reservation.token &&
        value.optString("actionState") !in setOf("succeeded", "failed")) {
        value.put("actionState", state)
        value.put("actionReason", if (state == "accepted") JSONObject.NULL else reloadResult)
      }
    }
    return actionResult(taskId, actionId, state, if (state == "accepted") null else reloadResult,
      artifact.getString("publicationId"), reservation.token)
  }

  private fun applyFull(app: Context, taskId: String, actionId: String, preparedId: String, artifact: JSONObject): Map<String, Any?> {
    Log.i(LOG_TAG, "event=apply-full-stage stage=begin")
    require(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { "TERMINAL_UPDATE_ANDROID_API_UNSUPPORTED" }
    val apk = TerminalUpdateArtifactPreparer.preparedFile(app, preparedId, "candidate.apk")
    Log.i(LOG_TAG, "event=apply-full-stage stage=artifact-ready")
    val installed = readInstalledIdentity(app)
    Log.i(LOG_TAG, "event=apply-full-stage stage=installed-identity-ready")
    val targetBuild = artifact.getLong("nativeBuildNumber")
    val targetApkSha256 = artifact.getJSONObject("apk").getString("sha256")
    require(targetBuild >= installed.nativeBuildNumber) { "TERMINAL_UPDATE_NATIVE_DOWNGRADE_FORBIDDEN" }
    val archiveInfo = app.packageManager.getPackageArchiveInfo(apk.path, PackageManager.GET_SIGNING_CERTIFICATES)
      ?: error("TERMINAL_UPDATE_APK_IDENTITY_INVALID")
    Log.i(LOG_TAG, "event=apply-full-stage stage=archive-metadata-ready")
    val signers = archiveInfo.signingInfo?.apkContentsSigners ?: error("TERMINAL_UPDATE_APK_SIGNER_MISSING")
    Log.i(LOG_TAG, "event=apply-full-stage stage=archive-signers-ready")
    val expectedCertificateDigest = artifact.optJSONObject("apk")?.getString("certificateSha256")
      ?: error("TERMINAL_UPDATE_APK_SIGNER_MISSING")
    val signerDigest = signers.singleOrNull()?.toByteArray()?.let { MessageDigest.getInstance("SHA-256").digest(it) }
      ?: error("TERMINAL_UPDATE_APK_SIGNER_INVALID")
    require(signerDigest.joinToString("") { "%02x".format(it) }.equals(expectedCertificateDigest, ignoreCase = true) &&
      app.packageManager.hasSigningCertificate(app.packageName, signerDigest, PackageManager.CERT_INPUT_SHA256)) {
      "TERMINAL_UPDATE_APK_SIGNER_MISMATCH"
    }
    Log.i(LOG_TAG, "event=apply-full-stage stage=signer-verified")
    val installer = app.packageManager.packageInstaller
    if (installer.mySessions.isNotEmpty()) {
      updateRecord(app) { value ->
        value.put("actionId", actionId); value.put("taskId", taskId); value.put("actionKind", "full")
        value.put("actionState", "unknown"); value.put("actionReason", "BUSY_UNKNOWN")
        value.put("actionPublicationId", artifact.getString("publicationId")); value.put("actionApplicationId", app.packageName)
        value.put("actionNativeBuildNumber", targetBuild); value.put("actionApkSha256", targetApkSha256)
        value.put("actionPreviousInstalledIdentity", installed.key())
        value.put("actionPreparedId", preparedId)
        value.put("installerSessionId", PackageInstaller.SessionInfo.INVALID_ID)
        value.put("installerState", "unknown")
      }
      return actionResult(taskId, actionId, "unknown", "BUSY_UNKNOWN", artifact.getString("publicationId"), null)
    }
    Log.i(LOG_TAG, "event=apply-full-stage stage=installer-idle")
    val intentRecord = record(app) ?: JSONObject()
    intentRecord.put("actionId", actionId); intentRecord.put("taskId", taskId); intentRecord.put("actionKind", "full")
    intentRecord.put("actionState", "intent"); intentRecord.put("actionReason", JSONObject.NULL)
    intentRecord.put("actionPublicationId", artifact.getString("publicationId")); intentRecord.put("actionApplicationId", app.packageName)
    intentRecord.put("actionNativeBuildNumber", targetBuild); intentRecord.put("actionApkSha256", targetApkSha256)
    intentRecord.put("actionPreviousInstalledIdentity", installed.key())
    intentRecord.put("actionNativeVersion", artifact.getString("nativeVersion"))
    intentRecord.put("actionPreparedId", preparedId); intentRecord.put("installerState", "created")
    intentRecord.remove("installerAwaitingSourcePermission")
    intentRecord.remove("installerConfirmationResumeAttempted")
    intentRecord.remove("installerConfirmationIntentUri")
    writeRecord(app, intentRecord)
    Log.i(LOG_TAG, "event=apply-full-stage stage=intent-persisted")
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply { setAppPackageName(app.packageName) }
    val sessionId = installer.createSession(params)
    Log.i(LOG_TAG, "event=apply-full-stage stage=installer-session-created")
    intentRecord.put("installerSessionId", sessionId)
    writeRecord(app, intentRecord)
    val session = installer.openSession(sessionId)
    try {
      apk.inputStream().use { source ->
        session.openWrite("candidate.apk", 0, apk.length()).use { output ->
          source.copyTo(output, 64 * 1024)
          session.fsync(output)
        }
      }
      intentRecord.put("installerState", "staged"); intentRecord.put("actionState", "waiting-user")
      writeRecord(app, intentRecord)
      Log.i(LOG_TAG, "event=apply-full-stage stage=installer-session-staged")
    } catch (error: Throwable) {
      session.abandon()
      intentRecord.put("installerState", "ended"); intentRecord.put("actionState", "failed")
      intentRecord.put("actionReason", "INSTALL_STAGE_FAILED"); writeRecord(app, intentRecord)
      throw error
    } finally {
      session.close()
    }
    intentRecord.put("installerState", "committing")
    writeRecord(app, intentRecord)
    val callback = Intent(app, TerminalUpdateInstallReceiver::class.java).setAction(ACTION_INSTALL_STATUS)
      .putExtra(EXTRA_ACTION_ID, actionId).putExtra(EXTRA_TASK_ID, taskId)
      .putExtra(PackageInstaller.EXTRA_SESSION_ID, sessionId)
      .putExtra(EXTRA_APPLICATION_ID, app.packageName)
      .putExtra(EXTRA_NATIVE_BUILD_NUMBER, targetBuild)
      .putExtra(EXTRA_PUBLICATION_ID, artifact.getString("publicationId"))
      .putExtra(EXTRA_APK_SHA256, targetApkSha256)
    @Suppress("DEPRECATION")
    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      app.packageManager.getPackageInfo(app.packageName,
        PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
    } else {
      app.packageManager.getPackageInfo(app.packageName, PackageManager.GET_PERMISSIONS)
    }
    val requestsInstallPackages = packageInfo.requestedPermissions
      ?.contains(android.Manifest.permission.REQUEST_INSTALL_PACKAGES) == true
    val installPermissionGranted = app.packageManager.checkPermission(
      android.Manifest.permission.REQUEST_INSTALL_PACKAGES, app.packageName,
    ) == PackageManager.PERMISSION_GRANTED
    val canRequestPackageInstalls = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      app.packageManager.canRequestPackageInstalls()
    } else false
    val userManager = app.getSystemService(UserManager::class.java)
    val appOpsManager = app.getSystemService(AppOpsManager::class.java)
    val installAppOp = AppOpsManager.permissionToOp(android.Manifest.permission.REQUEST_INSTALL_PACKAGES)
    val installAppOpMode = if (appOpsManager != null && installAppOp != null) {
      appOpsManager.checkOpNoThrow(installAppOp, android.os.Process.myUid(), app.packageName)
    } else null
    val installAppOpModeName = when (installAppOpMode) {
      AppOpsManager.MODE_ALLOWED -> "allowed"
      AppOpsManager.MODE_IGNORED -> "ignored"
      AppOpsManager.MODE_ERRORED -> "errored"
      AppOpsManager.MODE_DEFAULT -> "default"
      AppOpsManager.MODE_FOREGROUND -> "foreground"
      null -> "unknown"
      else -> "other"
    }
    val managedProfile = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) userManager?.isManagedProfile else null
    val disallowedByUser = userManager?.hasUserRestriction(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
    val disallowedInUserRestrictions = userManager?.userRestrictions
      ?.getBoolean(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
    val disallowedGlobally = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      userManager?.hasUserRestriction(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES_GLOBALLY)
    } else null
    Log.i(LOG_TAG, "event=installer-source-check requested=$requestsInstallPackages granted=$installPermissionGranted allowed=$canRequestPackageInstalls appOpMode=$installAppOpModeName managedProfile=${managedProfile ?: "not-applicable"} disallowedByUser=${disallowedByUser ?: "unknown"} disallowedInUserRestrictions=${disallowedInUserRestrictions ?: "unknown"} disallowedGlobally=${disallowedGlobally ?: "not-applicable"} userManagerAvailable=${userManager != null} appOpsManagerAvailable=${appOpsManager != null} api=${Build.VERSION.SDK_INT}")
    // Android 15+ rejects immutable PackageInstaller status receivers for apps targeting API 35+.
    // The explicit, non-exported receiver needs system status extras; Android 12+ requires mutability.
    val callbackMutability = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val pendingIntent = PendingIntent.getBroadcast(app, actionId.hashCode(), callback,
      PendingIntent.FLAG_UPDATE_CURRENT or callbackMutability)
    installer.openSession(sessionId).use { it.commit(pendingIntent.intentSender) }
    Log.i(LOG_TAG, "event=installer-commit status=committed session=$sessionId")
    return actionResult(taskId, actionId, "unknown", "INSTALLER_AWAITING_READBACK", artifact.getString("publicationId"), null)
  }

  private fun actionResult(taskId: String, actionId: String, state: String, reason: String?, publicationId: String, bootId: String?): Map<String, Any?> =
    mapOf("taskId" to taskId, "actionId" to actionId, "state" to state, "reason" to reason,
      "publicationId" to publicationId, "bootId" to bootId)

  fun updateSelection(
    context: ReactContext,
    publicationId: String,
    bundleVersion: String,
    bundleFile: File,
    entryKind: String,
  ): TerminalUpdateBootReservation = synchronized(lock) {
    require(entryKind == "hot" || entryKind == "file-recovery") { "TERMINAL_UPDATE_ENTRY_KIND_INVALID" }
    val app = context.applicationContext
    val identity = readInstalledIdentity(app)
    require(bundleFile.isFile && bundleFile.canonicalPath.startsWith(app.filesDir.canonicalPath + File.separator)) {
      "TERMINAL_UPDATE_BUNDLE_PATH_INVALID"
    }
    bindCurrentContextToPreviousReservation()
    val record = readRecord(app) ?: JSONObject()
    val currentPublication = record.optString("selectedPublicationId").ifBlank { identity.publicationId }
    val currentKind = record.optString("entryKind").ifBlank { "embedded" }
    require(record.optString("failedCandidatePublicationId") != publicationId) {
      "TERMINAL_UPDATE_FAILED_CANDIDATE_REENTRY_FORBIDDEN"
    }
    require(record.optBoolean("bootConfirmed") || currentKind == "embedded") {
      "TERMINAL_UPDATE_CURRENT_BOOT_UNCONFIRMED"
    }
    record.put("installedIdentity", identity.key())
    record.put("applicationId", identity.applicationId)
    record.put("nativeBuildNumber", identity.nativeBuildNumber)
    record.put("embeddedPublicationId", identity.publicationId)
    record.put("previousPublicationId", currentPublication)
    record.put("previousBundleVersion", record.optString("selectedBundleVersion").ifBlank { identity.embeddedBundleVersion })
    record.put("previousEntryKind", currentKind)
    record.put("previousBundleFile", if (currentKind == "embedded") JSONObject.NULL else record.optString("selectedBundleFile"))
    record.put("previousBundleSha256", if (currentKind == "embedded") JSONObject.NULL else record.optString("selectedBundleSha256"))
    record.put("previousInstalledIdentity", identity.key())
    record.put("candidatePublicationId", publicationId)
    record.put("entryKind", entryKind)
    record.put("selectedPublicationId", publicationId)
    record.put("selectedBundleVersion", bundleVersion)
    record.put("selectedBundleFile", bundleFile.canonicalPath)
    record.put("selectedBundleSha256", FileInputStream(bundleFile).use { it.sha256(MAX_HOT_BUNDLE_BYTES) })
    record.put("bootConfirmed", false)
    record.put("recoveryBootPending", false)
    record.put("rollbackAttempted", false)
    val next = TerminalUpdateBootReservation(
      UUID.randomUUID().toString(), identity, entryKind, publicationId, bundleFile.canonicalPath,
      readPublicationMetadata(app).second,
    )
    record.put("bootToken", next.token)
    writeRecord(app, record)
    currentReservation = next
    selectionResetReason = null
    scheduleBootDeadline(app, next)
    next
  }

  suspend fun reload(reason: String, timeoutMs: Long): String = suspendCancellableCoroutine { continuation ->
    if (timeoutMs <= 0) {
      continuation.resume("RELOAD_TIMEOUT_INVALID")
      return@suspendCancellableCoroutine
    }
    val app = application?.get()
    val host = reactHost?.get()
    if (app == null || host == null) {
      continuation.resume("REACT_HOST_UNAVAILABLE")
      return@suspendCancellableCoroutine
    }
    val reservation = try {
      synchronized(lock) {
        val existing = currentReservation
        val record = readRecord(app)
        if (existing != null && record?.optString("bootToken") == existing.token && !record.optBoolean("bootConfirmed")) {
          existing
        } else {
          beginBoot(app)
        }
      }
    } catch (_error: Throwable) {
      continuation.resume("BOOT_RESERVATION_FAILED")
      return@suspendCancellableCoroutine
    }
    val task = try {
      host.reload(reason)
    } catch (_error: Throwable) {
      continuation.resume("RELOAD_REJECTED")
      return@suspendCancellableCoroutine
    }
    Thread {
      val result = try {
        if (!task.waitForCompletion(timeoutMs, TimeUnit.MILLISECONDS)) "RELOAD_TIMED_OUT"
        else if (task.isCancelled() || task.isFaulted() || task.getError() != null) "RELOAD_FAILED"
        else {
          synchronized(lock) {
            val record = readRecord(app)
            if (currentReservation?.token == reservation.token && record?.optString("bootToken") == reservation.token)
              "SUCCESSOR_RUNTIME_STARTED"
            else "RELOAD_RESERVATION_SUPERSEDED"
          }
        }
      } catch (_error: InterruptedException) {
        Thread.currentThread().interrupt()
        "RELOAD_INTERRUPTED"
      } catch (_error: Throwable) {
        "RELOAD_FAILED"
      }
      if (continuation.isActive) continuation.resume(result)
    }.apply {
      name = "terminal-update-react-reload"
      isDaemon = true
      start()
    }
  }

  fun record(context: Context): JSONObject? = synchronized(lock) { readRecord(context.applicationContext) }

  fun updateRecord(context: Context, mutation: (JSONObject) -> Unit) = synchronized(lock) {
    val app = context.applicationContext
    val value = readRecord(app) ?: JSONObject()
    mutation(value)
    writeRecord(app, value)
  }

  private fun recoverPreviousSelection(
    app: Context,
    record: JSONObject,
    identity: TerminalUpdateInstalledIdentity,
  ): Triple<String, String, String?> {
    val candidatePublication = record.optString("candidatePublicationId")
    val previousKind = record.optString("previousEntryKind")
    val previousPublication = record.optString("previousPublicationId")
    val sameInstalledIdentity = record.optString("previousInstalledIdentity") == identity.key()
    if (sameInstalledIdentity && previousKind == "embedded" && previousPublication == identity.publicationId) {
      Log.w(LOG_TAG, "event=hot-boot-recovery outcome=embedded-selected candidateRecorded=true")
      return Triple("embedded", identity.publicationId, null)
    }
    val previousFile = record.optString("previousBundleFile")
      .takeIf { it.isNotBlank() && it != "null" }
      ?.let(::File)
    val expectedDigest = record.optString("previousBundleSha256")
    val previousHotIsUsable = sameInstalledIdentity && previousKind == "hot" && previousFile != null &&
      expectedDigest.matches(Regex("[a-fA-F0-9]{64}")) && runCatching {
        previousFile.canonicalPath.startsWith(app.filesDir.canonicalPath + File.separator) && previousFile.isFile &&
          FileInputStream(previousFile).use { it.sha256(MAX_HOT_BUNDLE_BYTES) }.equals(expectedDigest, ignoreCase = true)
      }.getOrDefault(false)
    if (previousHotIsUsable) {
      Log.w(LOG_TAG, "event=hot-boot-recovery outcome=previous-hot-selected candidateRecorded=true")
      return Triple("file-recovery", previousPublication, previousFile!!.canonicalPath)
    }
    Log.e(LOG_TAG, "event=hot-boot-recovery outcome=unavailable candidateRecorded=true")
    return Triple("failed", candidatePublication, null)
  }

  private fun scheduleBootDeadline(app: Context, reservation: TerminalUpdateBootReservation) {
    cancelBootDeadline()
    val record = readRecord(app) ?: return
    val hotCandidate = reservation.entryKind == "hot" && !record.optBoolean("bootConfirmed") &&
      record.optString("candidatePublicationId") == reservation.publicationId &&
      record.optString("selectedPublicationId") == reservation.publicationId
    val recoveryCandidate = record.optBoolean("recoveryBootPending") && !record.optBoolean("bootConfirmed") &&
      reservation.entryKind != "failed"
    if (!hotCandidate && !recoveryCandidate) return
    val task = Runnable { recoverExpiredBoot(app, reservation.token) }
    bootDeadline = task
    mainHandler.postDelayed(task, HOT_BOOT_TIMEOUT_MS)
    Log.i(LOG_TAG, "event=hot-boot-deadline-started timeoutMs=$HOT_BOOT_TIMEOUT_MS")
  }

  private fun cancelBootDeadline() {
    bootDeadline?.let(mainHandler::removeCallbacks)
    bootDeadline = null
  }

  private fun recoverExpiredBoot(app: Context, token: String) {
    val transition = synchronized(lock) {
      val record = readRecord(app) ?: return
      val current = currentReservation ?: return
      if (current.token != token || record.optString("bootToken") != token || record.optBoolean("bootConfirmed")) return
      val recoveryCandidate = record.optBoolean("recoveryBootPending") && current.entryKind != "failed"
      val hotCandidate = current.entryKind == "hot" &&
        record.optString("candidatePublicationId") == record.optString("selectedPublicationId")
      if (!recoveryCandidate && !hotCandidate) return
      bindCurrentContextToPreviousReservation()
      record.put("actionState", "failed")
      val nextKind: String
      val nextPublication: String
      val nextFile: String?
      val nextBundleVersion: String?
      if (recoveryCandidate) {
        record.put("actionReason", "HOT_ROLLBACK_BOOT_TIMEOUT")
        record.put("recoveryBootPending", false)
        nextKind = "failed"
        nextPublication = record.optString("selectedPublicationId")
        nextFile = null
        nextBundleVersion = null
      } else {
        val restored = recoverPreviousSelection(app, record, current.installedIdentity)
        record.put("failedCandidatePublicationId", record.optString("candidatePublicationId"))
        record.put("actionReason", "HOT_BOOT_TIMEOUT")
        record.put("rollbackAttempted", true)
        record.put("recoveryBootPending", restored.first != "failed")
        nextKind = restored.first
        nextPublication = restored.second
        nextFile = restored.third
        nextBundleVersion = when (restored.first) {
          "embedded" -> current.installedIdentity.embeddedBundleVersion
          "file-recovery" -> record.optString("previousBundleVersion").takeIf { it.isNotBlank() }
          else -> null
        }
      }
      record.put("entryKind", nextKind)
      record.put("selectedPublicationId", nextPublication)
      if (nextBundleVersion == null) record.put("selectedBundleVersion", JSONObject.NULL)
      else record.put("selectedBundleVersion", nextBundleVersion)
      if (nextFile == null) record.put("selectedBundleFile", JSONObject.NULL)
      else record.put("selectedBundleFile", nextFile)
      val next = TerminalUpdateBootReservation(UUID.randomUUID().toString(), current.installedIdentity,
        nextKind, nextPublication, nextFile, current.embeddedBundleAssetName)
      record.put("bootToken", next.token)
      record.put("bootConfirmed", false)
      writeRecord(app, record)
      currentReservation = next
      cancelBootDeadline()
      scheduleBootDeadline(app, next)
      val host = reactHost?.get()
      if (host == null) {
        Log.e(LOG_TAG, "event=hot-boot-timeout-recovery outcome=host-unavailable entryKind=${next.entryKind}")
        return
      }
      host to next
    }
    Log.w(LOG_TAG, "event=hot-boot-timeout-recovery entryKind=${transition.second.entryKind}")
    runCatching { transition.first.reload("terminal-update-boot-timeout") }.onFailure {
      Log.e(LOG_TAG, "event=hot-boot-timeout-recovery outcome=reload-failed errorType=${it.javaClass.simpleName}")
    }
  }

  private fun bindCurrentContextToPreviousReservation() {
    val host = reactHost?.get() ?: return
    val oldContext = host.currentReactContext ?: return
    val oldToken = currentReservation?.token ?: readRecord(oldContext.applicationContext)?.optString("bootToken")
    if (!oldToken.isNullOrBlank()) contextBoots[oldContext] = oldToken
  }

  private fun readInstalledIdentity(context: Context): TerminalUpdateInstalledIdentity {
    val packageInfo = packageInfo(context)
    val applicationInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()))
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    }
    val metadata = applicationInfo.metaData ?: error("TERMINAL_UPDATE_PUBLICATION_METADATA_MISSING")
    val declaredPublicationId = metadata.getString(PUBLICATION_ID_METADATA)
      ?: error("TERMINAL_UPDATE_PUBLICATION_METADATA_MISSING")
    val (assetName, bundleAssetName) = readPublicationMetadata(context)
    val manifestBytes = context.assets.open(assetName).use { input -> input.readBounded(MAX_PUBLICATION_BYTES) }
    val manifest = JSONObject(String(manifestBytes, Charsets.UTF_8))
    val appId = manifest.getString("applicationId")
    val buildNumber = manifest.getLong("nativeBuildNumber")
    val publicationId = manifest.getString("publicationId")
    require(appId == context.packageName && publicationId == declaredPublicationId) {
      "TERMINAL_UPDATE_PUBLICATION_IDENTITY_MISMATCH"
    }
    require(buildNumber == installedVersionCode(packageInfo) && manifest.getString("nativeVersion") == packageInfo.versionName) {
      "TERMINAL_UPDATE_APK_VERSION_IDENTITY_MISMATCH"
    }
    val entry = manifest.getString("entry")
    require(entry == "assets/$bundleAssetName") { "TERMINAL_UPDATE_EMBEDDED_ENTRY_INVALID" }
    val files = manifest.getJSONArray("files")
    var bundleDigest: String? = null
    var bundleSize = -1L
    for (index in 0 until files.length()) {
      val item = files.getJSONObject(index)
      if (item.getString("path") == EMBEDDED_ENTRY) {
        bundleDigest = item.getString("sha256")
        bundleSize = item.getLong("sizeBytes")
        break
      }
    }
    require(bundleDigest != null && bundleSize in 0..MAX_EMBEDDED_BYTES) { "TERMINAL_UPDATE_EMBEDDED_BUNDLE_METADATA_INVALID" }
    val actualDigest = context.assets.open(bundleAssetName).use { input -> input.sha256(MAX_EMBEDDED_BYTES) }
    require(actualDigest == bundleDigest) { "TERMINAL_UPDATE_EMBEDDED_BUNDLE_DIGEST_MISMATCH" }
    return TerminalUpdateInstalledIdentity(
      context.packageName,
      installedVersionCode(packageInfo),
      publicationId,
      manifest.getString("bundleVersion"),
    )
  }

  private fun installedVersionCode(packageInfo: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) packageInfo.longVersionCode else packageInfo.versionCode.toLong()

  private fun readPublicationMetadata(context: Context): Pair<String, String> {
    val applicationInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()))
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    }
    val metadata = applicationInfo.metaData ?: error("TERMINAL_UPDATE_PUBLICATION_METADATA_MISSING")
    val manifestAsset = metadata.getString(PUBLICATION_MANIFEST_ASSET_METADATA)
      ?: error("TERMINAL_UPDATE_PUBLICATION_METADATA_MISSING")
    val bundleAsset = metadata.getString(EMBEDDED_BUNDLE_ASSET_METADATA)
      ?: error("TERMINAL_UPDATE_PUBLICATION_METADATA_MISSING")
    require(manifestAsset == PUBLICATION_ASSET) { "TERMINAL_UPDATE_PUBLICATION_ASSET_INVALID" }
    require(bundleAsset.matches(Regex("[A-Za-z0-9_.-]+"))) { "TERMINAL_UPDATE_EMBEDDED_ASSET_INVALID" }
    return manifestAsset to bundleAsset
  }

  private fun packageInfo(context: Context): PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
  } else {
    @Suppress("DEPRECATION")
    context.packageManager.getPackageInfo(context.packageName, 0)
  }

  private fun readRecord(context: Context): JSONObject? {
    val file = AtomicFile(File(context.filesDir, RECORD_NAME))
    if (!file.baseFile.exists()) return null
    return file.openRead().use { input ->
      val bytes = input.readBounded(MAX_PUBLICATION_BYTES)
      JSONObject(String(bytes, Charsets.UTF_8))
    }
  }

  private fun writeRecord(context: Context, record: JSONObject) {
    val file = AtomicFile(File(context.filesDir, RECORD_NAME))
    var stream: FileOutputStream? = null
    try {
      stream = file.startWrite()
      stream.write(record.toString().toByteArray(Charsets.UTF_8))
      file.finishWrite(stream)
    } catch (error: Throwable) {
      if (stream != null) file.failWrite(stream)
      Log.e(LOG_TAG, "event=native-state-write status=failed")
      throw error
    }
  }

  private fun JSONObject.toWireMap(): Map<String, Any?> {
    val result = linkedMapOf<String, Any?>()
    val iterator = keys()
    while (iterator.hasNext()) {
      val key = iterator.next()
      val value = get(key)
      result[key] = when (value) {
        JSONObject.NULL -> null
        is JSONObject -> value.toWireMap()
        is org.json.JSONArray -> value.toWireList()
        else -> value
      }
    }
    return result
  }

  private fun org.json.JSONArray.toWireList(): List<Any?> = (0 until length()).map { index ->
    when (val value = get(index)) {
      JSONObject.NULL -> null
      is JSONObject -> value.toWireMap()
      is org.json.JSONArray -> value.toWireList()
      else -> value
    }
  }

  private fun java.io.InputStream.readBounded(maxBytes: Long): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    var count = 0L
    while (true) {
      val read = read(buffer)
      if (read < 0) break
      count += read
      require(count <= maxBytes) { "TERMINAL_UPDATE_INPUT_TOO_LARGE" }
      output.write(buffer, 0, read)
    }
    return output.toByteArray()
  }

  private fun java.io.InputStream.sha256(maxBytes: Long): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(64 * 1024)
    var count = 0L
    while (true) {
      val read = read(buffer)
      if (read < 0) break
      count += read
      require(count <= maxBytes) { "TERMINAL_UPDATE_EMBEDDED_BUNDLE_TOO_LARGE" }
      digest.update(buffer, 0, read)
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
}
