package com.catering.v2s.storeterminal.api;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.storeterminal.domain.ActivationCode;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Store-terminal-owned reads and aggregate commands exposed to the operations edge. */
public interface StoreTerminalOwnerApi {
    TerminalPage listTerminalPage(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String query, String cursor, int pageSize);

    TerminalDetail readTerminalDetail(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID terminalRef);

    /**
     * Resolves the group identity and locks a matching terminal row for the caller's REQUIRED activation transaction.
     */
    ActivationCandidate lockActivationCandidate(
            String groupWorkspaceKey, ActivationCode activationCode, String surfaceForm);

    /** Rechecks the store-scoped grant and resolves the terminal's actual store before binding-owner replay. */
    OperationsActivationCancellationTarget resolveOperationsActivationCancellationTarget(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            long contextVersion,
            OperationsOwnerScopeGrant ownerScopeGrant);

    CandidatePage<AreaCandidate> listAreaCandidates(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String query, String cursor, int pageSize);

    CandidatePage<TagCandidate> listTagCandidates(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, String query, String cursor, int pageSize);

    TerminalMutation createTerminal(CreateCommand command);

    TerminalMutation replaceTerminal(ReplaceCommand command);

    TerminalMutation transitionTerminalStatus(StatusCommand command);

    record TerminalSummary(
            UUID terminalRef, String name, String deviceType, String status, long version, long updatedAt) {}

    record TerminalDetail(
            UUID terminalRef,
            UUID storeRef,
            String name,
            String deviceType,
            String status,
            long version,
            long createdAt,
            long updatedAt,
            String activationCode,
            JsonNode configuration,
            List<AreaReference> areaReferences,
            List<TagReference> tagReferences,
            TerminalBinding binding) {
        public TerminalDetail {
            configuration = configuration == null ? null : configuration.deepCopy();
            areaReferences = List.copyOf(areaReferences == null ? List.of() : areaReferences);
            tagReferences = List.copyOf(tagReferences == null ? List.of() : tagReferences);
            binding = Objects.requireNonNull(binding, "binding");
        }

        @Override
        public String toString() {
            return "TerminalDetail[terminalRef=" + terminalRef + ", status=" + status + ", activationCode=redacted]";
        }
    }

    /** Read-only binding projection; inactive state deliberately carries no previous generation details. */
    record TerminalBinding(String status, Long activatedAt, Long generation) {
        public TerminalBinding {
            status = Objects.requireNonNull(status, "status");
            if ("INACTIVE".equals(status)) {
                if (activatedAt != null || generation != null)
                    throw new IllegalArgumentException("inactive binding must not expose activation details");
            } else if ("ACTIVE".equals(status)) {
                if (activatedAt == null || activatedAt < 0 || generation == null || generation < 1)
                    throw new IllegalArgumentException("active binding requires activation details");
            } else {
                throw new IllegalArgumentException("binding status is invalid");
            }
        }

        public static TerminalBinding inactive() {
            return new TerminalBinding("INACTIVE", null, null);
        }

        public static TerminalBinding active(long activatedAt, long generation) {
            return new TerminalBinding("ACTIVE", activatedAt, generation);
        }
    }

    record TerminalPage(List<TerminalSummary> items, String nextCursor, long total) {
        public TerminalPage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }

    /** Non-secret command acknowledgement; the edge reads the authoritative detail after transaction commit. */
    record TerminalMutation(UUID terminalRef, long version, String status) {}

    /** Non-secret identity facts verified by this owner against its terminal and store records. */
    record OperationsActivationCancellationTarget(
            UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef, UUID terminalRef) {
        public OperationsActivationCancellationTarget {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            storeRef = Objects.requireNonNull(storeRef, "storeRef");
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
        }
    }

    /** Contains no activation-code value and is safe to pass to the app-edge coordinator. */
    record ActivationCandidate(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String surfaceForm,
            boolean activationCodeFound,
            UUID storeRef,
            UUID terminalRef,
            String terminalStatus,
            String deviceType) {
        public ActivationCandidate {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            if (!"laptop".equals(surfaceForm) && !"mobile".equals(surfaceForm)) {
                throw new IllegalArgumentException("surfaceForm is invalid");
            }
            if (activationCodeFound
                    && (storeRef == null || terminalRef == null || terminalStatus == null || deviceType == null)) {
                throw new IllegalArgumentException("found activation candidate requires terminal facts");
            }
            if (!activationCodeFound
                    && (storeRef != null || terminalRef != null || terminalStatus != null || deviceType != null)) {
                throw new IllegalArgumentException("missing activation candidate must not carry terminal facts");
            }
        }

        @Override
        public String toString() {
            return "ActivationCandidate[groupWorkspaceKey=" + groupWorkspaceKey + ", surfaceForm=" + surfaceForm
                    + ", activationCodeFound=" + activationCodeFound + ", terminalRef=" + terminalRef + "]";
        }
    }

    record CandidatePage<T>(List<T> items, String nextCursor, long total) {
        public CandidatePage {
            items = List.copyOf(items == null ? List.of() : items);
        }
    }

    record AreaCandidate(UUID areaRef, String name, String code) {}

    record TagCandidate(UUID tagRef, String name, String code, String status) {}

    record AreaReference(UUID areaRef, String name, String code, String areaType, String status) {}

    record TagReference(UUID tagRef, String name, String code, String status) {}

    record CreateCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            String name,
            String deviceType,
            ActivationCode activationCode,
            JsonNode configuration,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public CreateCommand {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            storeRef = Objects.requireNonNull(storeRef, "storeRef");
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
            configuration = configuration == null ? null : configuration.deepCopy();
        }

        @Override
        public String toString() {
            return "CreateCommand[storeRef=" + storeRef + ", activationCode=redacted, payload=redacted]";
        }
    }

    record ReplaceCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            String name,
            JsonNode configuration,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public ReplaceCommand {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            storeRef = Objects.requireNonNull(storeRef, "storeRef");
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
            configuration = configuration == null ? null : configuration.deepCopy();
        }

        @Override
        public String toString() {
            return "ReplaceCommand[storeRef=" + storeRef + ", terminalRef=" + terminalRef + ", payload=redacted]";
        }
    }

    record StatusCommand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID terminalRef,
            String targetStatus,
            long expectedVersion,
            String idempotencyKey,
            AuditActor actor,
            OperationsOwnerScopeGrant ownerScopeGrant) {
        public StatusCommand {
            workspaceUuid = Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            groupWorkspaceKey = Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
            storeRef = Objects.requireNonNull(storeRef, "storeRef");
            terminalRef = Objects.requireNonNull(terminalRef, "terminalRef");
            actor = Objects.requireNonNull(actor, "actor");
            ownerScopeGrant = Objects.requireNonNull(ownerScopeGrant, "ownerScopeGrant");
        }
    }
}
