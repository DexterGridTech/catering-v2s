package com.catering.v2s.terminalupdate.application;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEntityTypes;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup.PersistedStoreFact;
import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.platform.foundation.persistence.CommandReceiptSupport;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateArtifactOwnerApi.ArtifactReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleArtifactIdentity;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.ChangeRuleStatus;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.CreateRule;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RulePage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RulePageQuery;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleStore;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleStorePage;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRulePersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateRuleSnapshotPersistence;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns mutable project update rules and publishes their same-transaction topic snapshot. */
@Service
public class TerminalUpdateRuleOwnerService implements TerminalUpdateRuleOwnerApi {
    private static final String CREATE = "create_rule";
    private static final String STATUS = "change_rule_status";

    private final TerminalUpdateRulePersistence persistence;
    private final TerminalUpdateRuleSnapshotPersistence snapshots;
    private final TerminalUpdateArtifactOwnerApi artifacts;
    private final OrganizationTaskPathLookup organization;
    private final AuditEventWriter auditEvents;
    private final TimeProvider time;

    public TerminalUpdateRuleOwnerService(
            TerminalUpdateRulePersistence persistence,
            TerminalUpdateRuleSnapshotPersistence snapshots,
            TerminalUpdateArtifactOwnerApi artifacts,
            OrganizationTaskPathLookup organization,
            @Qualifier("terminalUpdateAuditEventWriter") AuditEventWriter auditEvents,
            TimeProvider time) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.snapshots = Objects.requireNonNull(snapshots, "snapshots");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.organization = Objects.requireNonNull(organization, "organization");
        this.auditEvents = Objects.requireNonNull(auditEvents, "auditEvents");
        this.time = Objects.requireNonNull(time, "time");
    }

    @Override
    @Transactional
    public RuleReadback create(CreateRule command) {
        Objects.requireNonNull(command, "command");
        String hash = createHash(command);
        persistence.lockCommand(command.groupWorkspaceKey(), CREATE, command.idempotencyKey());
        Optional<RuleReadback> previous = receipt(command.workspaceUuid(), command.groupWorkspaceKey(),
                CREATE, command.idempotencyKey(), hash);
        if (previous.isPresent()) return previous.get();

        persistence.lockProject(command.workspaceUuid(), command.groupWorkspaceKey(), command.projectRef());
        organization.requireTaskPath(command.workspaceUuid(), command.groupWorkspaceKey(), "PROJECT", command.projectRef());
        validateRule(command);
        if (!command.storeRefs().isEmpty()) {
            var memberships = organization.requireStoreProjectMemberships(
                    command.workspaceUuid(), command.groupWorkspaceKey(), command.storeRefs());
            if (memberships.size() != command.storeRefs().size()
                    || memberships.values().stream().anyMatch(project -> !project.equals(command.projectRef())))
                throw new TerminalUpdateRuleScopeMismatchException();
        }
        RuleArtifactIdentities artifactIdentities = validateArtifacts(command);

        long now = time.currentEpochMillis();
        RuleReadback rule = new RuleReadback(UUID.randomUUID(), command.projectRef(), command.targetMode(),
                command.storeRefs(), command.fullArtifactRef(), command.hotArtifactRef(),
                artifactIdentities.full(), artifactIdentities.hot(), command.status(),
                command.nSeconds(), command.hotStrategy(), command.mSeconds(), command.description(), now, now, 1);
        if (persistence.insert(rule, command.workspaceUuid(), command.groupWorkspaceKey()) != 1)
            throw new TerminalUpdateRuleInvariantException();
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), command.actor(), rule.ruleRef(), "CREATE",
                List.of(change("status", rule.status()), change("targetMode", rule.targetMode())));
        persistence.refreshTopic(command.workspaceUuid(), command.groupWorkspaceKey(), command.projectRef(), now);
        persistence.insertReceipt(command.groupWorkspaceKey(), CREATE, command.idempotencyKey(), hash, rule, now);
        return rule;
    }

    @Override
    @Transactional
    public RuleReadback changeStatus(ChangeRuleStatus command) {
        Objects.requireNonNull(command, "command");
        String hash = statusHash(command);
        persistence.lockCommand(command.groupWorkspaceKey(), STATUS, command.idempotencyKey());
        Optional<RuleReadback> previous = receipt(command.workspaceUuid(), command.groupWorkspaceKey(),
                STATUS, command.idempotencyKey(), hash);
        if (previous.isPresent()) return previous.get();

        persistence.lockProject(command.workspaceUuid(), command.groupWorkspaceKey(), command.projectRef());
        organization.requireTaskPath(command.workspaceUuid(), command.groupWorkspaceKey(), "PROJECT", command.projectRef());
        RuleReadback current = persistence.read(command.workspaceUuid(), command.groupWorkspaceKey(),
                        command.projectRef(), command.ruleRef(), true)
                .orElseThrow(TerminalUpdateRuleNotFoundException::new);
        if (current.revision() != command.revision()) throw new TerminalUpdateRuleStaleStateException();
        requireStatus(command.status());
        if (current.status().equals(command.status())) {
            persistence.insertReceipt(command.groupWorkspaceKey(), STATUS, command.idempotencyKey(), hash, current,
                    time.currentEpochMillis());
            return current;
        }
        long now = time.currentEpochMillis();
        if (!persistence.changeStatus(command.workspaceUuid(), command.groupWorkspaceKey(), command.projectRef(),
                command.ruleRef(), command.revision(), command.status(), now))
            throw new TerminalUpdateRuleStaleStateException();
        RuleReadback changed = persistence.read(command.workspaceUuid(), command.groupWorkspaceKey(),
                        command.projectRef(), command.ruleRef(), false)
                .orElseThrow(TerminalUpdateRuleInvariantException::new);
        audit(command.workspaceUuid(), command.groupWorkspaceKey(), command.actor(), command.ruleRef(),
                command.status().equals("ENABLED") ? "ENABLE" : "DISABLE",
                List.of(change("status", current.status(), changed.status()),
                        change("reason", null, command.reason())));
        persistence.refreshTopic(command.workspaceUuid(), command.groupWorkspaceKey(), command.projectRef(), now);
        persistence.insertReceipt(command.groupWorkspaceKey(), STATUS, command.idempotencyKey(), hash, changed, now);
        return changed;
    }

    @Override
    @Transactional(readOnly = true)
    public RuleReadback read(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID ruleRef) {
        organization.requireTaskPath(workspaceUuid, groupWorkspaceKey, "PROJECT", projectRef);
        return persistence.read(workspaceUuid, groupWorkspaceKey, projectRef, ruleRef, false)
                .orElseThrow(TerminalUpdateRuleNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public RulePage page(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, RulePageQuery query) {
        validatePageQuery(query);
        organization.requireTaskPath(workspaceUuid, groupWorkspaceKey, "PROJECT", projectRef);
        TerminalUpdateRulePersistence.RulePageRows page = persistence.page(workspaceUuid, groupWorkspaceKey, projectRef, query);
        return new RulePage(page.items(), page.nextCursor());
    }

    @Override
    @Transactional(readOnly = true)
    public RuleStorePage stores(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID ruleRef,
            String cursor, int limit) {
        if (limit < 1 || limit > 100) throw new TerminalUpdateRuleInvalidException();
        RuleReadback rule = read(workspaceUuid, groupWorkspaceKey, projectRef, ruleRef);
        if (!"STORE_REFS".equals(rule.targetMode())) return new RuleStorePage(List.of(), null);
        List<UUID> sortedRefs = rule.storeRefs().stream().sorted(Comparator.comparing(TerminalUpdateRuleOwnerService::uuidHex)).toList();
        String identity = Sha256Hex.digest(workspaceUuid + "|" + groupWorkspaceKey + "|" + projectRef + "|"
                + ruleRef + "|" + Sha256Hex.digest(sortedRefs.stream().map(TerminalUpdateRuleOwnerService::uuidHex)
                        .collect(java.util.stream.Collectors.joining(","))) + "|" + limit);
        OpaqueCollectionCursor.Position frontier;
        try { frontier = OpaqueCollectionCursor.decode(cursor, identity); }
        catch (OpaqueCollectionCursor.InvalidCursor invalid) { throw new TerminalUpdateRuleInvalidException(); }
        if (frontier != null && !uuidHex(frontier.tieBreaker()).equals(frontier.sortKey()))
            throw new TerminalUpdateRuleInvalidException();
        List<UUID> remaining = frontier == null ? sortedRefs
                : sortedRefs.stream().filter(ref -> uuidHex(ref).compareTo(frontier.sortKey()) > 0).toList();
        boolean hasMore = remaining.size() > limit;
        List<UUID> refs = hasMore ? List.copyOf(remaining.subList(0, limit)) : remaining;
        var facts = organization.describePersistedStoresInProject(workspaceUuid, groupWorkspaceKey, projectRef, refs);
        List<RuleStore> items = refs.stream().map(ref -> {
            PersistedStoreFact fact = facts.get(ref);
            return fact == null
                    ? new RuleStore(ref, "", "", "UNKNOWN", "MISSING_OR_OUT_OF_PROJECT")
                    : new RuleStore(ref, fact.name(), fact.code(), fact.status(), null);
        }).toList();
        String next = hasMore && !refs.isEmpty()
                ? OpaqueCollectionCursor.encode(identity, uuidHex(refs.getLast()), refs.getLast())
                : null;
        return new RuleStorePage(items, next);
    }

    @Override
    @Transactional(readOnly = true)
    public RuleSnapshotPage terminalSnapshot(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef,
            String cursor, int limit, String collectionHash) {
        if (limit < 1 || limit > 100 || (collectionHash != null && !collectionHash.matches("[a-f0-9]{64}")))
            throw new TerminalUpdateRuleInvalidException();
        organization.requireTaskPath(workspaceUuid, groupWorkspaceKey, "PROJECT", projectRef);
        String identity = workspaceUuid + "|" + groupWorkspaceKey + "|" + projectRef;
        OpaqueCollectionCursor.Position frontier;
        try { frontier = OpaqueCollectionCursor.decode(cursor, identity); }
        catch (OpaqueCollectionCursor.InvalidCursor invalid) { throw new TerminalUpdateRuleInvalidException(); }
        if (frontier != null && collectionHash == null) throw new TerminalUpdateRuleInvalidException();
        Long beforeCreatedAt = null;
        UUID beforeRuleRef = null;
        if (frontier != null) {
            try { beforeCreatedAt = Long.parseLong(frontier.sortKey()); }
            catch (NumberFormatException invalid) { throw new TerminalUpdateRuleInvalidException(); }
            beforeRuleRef = frontier.tieBreaker();
        }
        List<TerminalUpdateRuleSnapshotPersistence.Row> rows = snapshots.page(workspaceUuid, groupWorkspaceKey,
                projectRef, beforeCreatedAt, beforeRuleRef, limit + 1);
        String members = rows.getFirst().memberText();
        String currentHash = Sha256Hex.digest(members);
        if (collectionHash != null && !collectionHash.equals(currentHash))
            throw new TerminalUpdateRuleStaleStateException();
        List<TerminalUpdateRuleSnapshotPersistence.Row> visible = rows.stream()
                .filter(row -> row.ruleRef() != null).limit(limit + 1).toList();
        boolean hasMore = visible.size() > limit;
        List<TerminalUpdateRuleSnapshotPersistence.Row> page = hasMore
                ? visible.subList(0, limit) : visible;
        List<RuleSnapshotItem> items = page.stream().map(row -> new RuleSnapshotItem(row.ruleRef(),
                row.targetMode(), row.storeRefs(), row.applicationId(), row.createdAtEpochMillis(), snapshotArtifact(row.full()),
                row.hot() == null ? null : snapshotArtifact(row.hot()), row.nSeconds(), row.hotStrategy(),
                row.mSeconds(), row.description())).toList();
        String next = hasMore && !page.isEmpty()
                ? OpaqueCollectionCursor.encode(identity, Long.toString(page.getLast().createdAtEpochMillis()),
                        page.getLast().ruleRef())
                : null;
        return new RuleSnapshotPage(items, currentHash, next);
    }

    private static SnapshotArtifact snapshotArtifact(TerminalUpdateRuleSnapshotPersistence.Artifact artifact) {
        return new SnapshotArtifact(artifact.artifactRef(), artifact.kind(), artifact.applicationId(),
                artifact.runtimeVersion(), artifact.nativeBuildNumber(), artifact.apkVersion(), artifact.jsVersion(),
                artifact.publicationId(), artifact.apkSha256(), artifact.zipSha256(), artifact.byteSize(),
                artifact.createdAtEpochMillis());
    }

    private static void validatePageQuery(RulePageQuery query) {
        if (query == null || query.limit() < 1 || query.limit() > 100
                || (query.status() != null && !List.of("ENABLED", "DISABLED").contains(query.status()))
                || (query.applicationId() != null && (query.applicationId().isBlank() || query.applicationId().length() > 128))
                || (query.createdFromEpochMillis() != null && query.createdFromEpochMillis() < 0)
                || (query.createdToEpochMillis() != null && query.createdToEpochMillis() < 0)
                || (query.cursor() != null && query.cursor().length() > 512)
                || (query.createdFromEpochMillis() != null && query.createdToEpochMillis() != null
                        && query.createdFromEpochMillis() > query.createdToEpochMillis()))
            throw new TerminalUpdateRuleInvalidException();
    }

    private static String uuidHex(UUID ref) {
        return ref.toString().replace("-", "").toLowerCase(java.util.Locale.ROOT);
    }

    private Optional<RuleReadback> receipt(UUID workspaceUuid, String key, String name, String idempotencyKey, String hash) {
        Optional<String> storedHash = persistence.receiptHash(key, name, idempotencyKey);
        Optional<RuleReadback> stored = persistence.findReceipt(key, name, idempotencyKey);
        if (storedHash.isPresent() != stored.isPresent()) throw new TerminalUpdateRuleInvariantException();
        if (storedHash.isPresent() && !storedHash.get().equals(hash))
            throw new TerminalUpdateRuleIdempotencyConflictException();
        return stored.map(rule -> withArtifactIdentities(workspaceUuid, key, rule));
    }

    private void validateRule(CreateRule command) {
        if (command.workspaceUuid() == null || command.projectRef() == null || command.actor() == null
                || command.idempotencyKey() == null || command.idempotencyKey().length() < 16
                || command.groupWorkspaceKey() == null || command.groupWorkspaceKey().isBlank())
            throw new TerminalUpdateRuleInvalidException();
        if ("ALL".equals(command.targetMode())) {
            if (!command.storeRefs().isEmpty()) throw new TerminalUpdateRuleInvalidException();
        } else if ("STORE_REFS".equals(command.targetMode())) {
            if (command.storeRefs().isEmpty() || command.storeRefs().stream().anyMatch(Objects::isNull)
                    || command.storeRefs().stream().distinct().count() != command.storeRefs().size())
                throw new TerminalUpdateRuleInvalidException();
        } else throw new TerminalUpdateRuleInvalidException();
        if (command.fullArtifactRef() == null || command.nSeconds() < 60 || command.nSeconds() > 86_400
                || command.nSeconds() % 60 != 0
                || !List.of("ENABLED", "DISABLED").contains(command.status())
                || (command.description() != null && command.description().length() > 500))
            throw new TerminalUpdateRuleInvalidException();
        if (command.hotArtifactRef() == null) {
            if (command.hotStrategy() != null || command.mSeconds() != null)
                throw new TerminalUpdateRuleInvalidException();
        } else if ("IMMEDIATE".equals(command.hotStrategy())) {
            if (command.mSeconds() != null) throw new TerminalUpdateRuleInvalidException();
        } else if (!"IDLE".equals(command.hotStrategy()) || command.mSeconds() == null
                || command.mSeconds() < 60 || command.mSeconds() > 86_400
                || command.mSeconds() % 60 != 0) throw new TerminalUpdateRuleInvalidException();
    }

    private RuleArtifactIdentities validateArtifacts(CreateRule command) {
        ArtifactReadback full = artifacts.read(command.workspaceUuid(), command.groupWorkspaceKey(), command.fullArtifactRef());
        if (!"FULL".equals(full.kind())) throw new TerminalUpdateRuleTargetInvalidException();
        if (command.hotArtifactRef() == null) return new RuleArtifactIdentities(identity(full), null);
        ArtifactReadback hot = artifacts.read(command.workspaceUuid(), command.groupWorkspaceKey(), command.hotArtifactRef());
        if (!"HOT".equals(hot.kind()) || !command.fullArtifactRef().equals(hot.minimumFullArtifactRef())
                || hot.minimumFull() == null
                || !full.applicationId().equals(hot.minimumFull().applicationId())
                || full.nativeBuildNumber() != hot.minimumFull().nativeBuildNumber()
                || !full.runtimeVersion().equals(hot.minimumFull().runtimeVersion())
                || !full.publicationId().equals(hot.minimumFull().publicationId())
                || !full.apkSha256().equals(hot.minimumFull().apkSha256()))
            throw new TerminalUpdateRuleTargetInvalidException();
        return new RuleArtifactIdentities(identity(full), identity(hot));
    }

    private RuleReadback withArtifactIdentities(UUID workspaceUuid, String groupWorkspaceKey, RuleReadback rule) {
        if (rule.fullArtifactIdentity() != null
                && (rule.hotArtifactRef() == null || rule.hotArtifactIdentity() != null)) return rule;
        ArtifactReadback full = artifacts.read(workspaceUuid, groupWorkspaceKey, rule.fullArtifactRef());
        ArtifactReadback hot = rule.hotArtifactRef() == null ? null
                : artifacts.read(workspaceUuid, groupWorkspaceKey, rule.hotArtifactRef());
        return new RuleReadback(rule.ruleRef(), rule.projectRef(), rule.targetMode(), rule.storeRefs(),
                rule.fullArtifactRef(), rule.hotArtifactRef(), identity(full), hot == null ? null : identity(hot),
                rule.status(), rule.nSeconds(), rule.hotStrategy(), rule.mSeconds(), rule.description(),
                rule.createdAtEpochMillis(), rule.updatedAtEpochMillis(), rule.revision());
    }

    private static RuleArtifactIdentity identity(ArtifactReadback artifact) {
        return new RuleArtifactIdentity(artifact.applicationId(), artifact.kind(),
                "FULL".equals(artifact.kind()) ? artifact.nativeVersion() : artifact.bundleVersion());
    }

    private record RuleArtifactIdentities(RuleArtifactIdentity full, RuleArtifactIdentity hot) {}

    private static void requireStatus(String status) {
        if (!List.of("ENABLED", "DISABLED").contains(status)) throw new TerminalUpdateRuleInvalidException();
    }

    private void audit(UUID workspace, String group, AuditActor actor, UUID ruleRef, String action,
            List<AuditChange> changes) {
        auditEvents.write(new AuditEvent(UUID.randomUUID(), workspace, group,
                new AuditTarget(AuditEntityTypes.TERMINAL_UPDATE_RULE, ruleRef.toString()), actor, action,
                time.currentEpochMillis(), changes));
    }

    private static AuditChange change(String key, String value) {
        return AuditChange.forNullableScalar(key, null, value);
    }

    private static AuditChange change(String key, String before, String after) {
        return AuditChange.forNullableScalar(key, before, after);
    }

    private static String createHash(CreateRule c) {
        return CommandReceiptSupport.requestHash(c.workspaceUuid() + "|" + c.groupWorkspaceKey() + "|" + c.projectRef()
                + "|" + c.targetMode() + "|" + c.storeRefs() + "|" + c.fullArtifactRef() + "|" + c.hotArtifactRef()
                + "|" + c.status() + "|" + c.nSeconds() + "|" + c.hotStrategy() + "|" + c.mSeconds() + "|"
                + c.description() + "|" + c.expectedContextVersion() + "|" + c.actor().actorType() + "|" + c.actor().actorId());
    }

    private static String statusHash(ChangeRuleStatus c) {
        return CommandReceiptSupport.requestHash(c.workspaceUuid() + "|" + c.groupWorkspaceKey() + "|" + c.projectRef()
                + "|" + c.ruleRef() + "|" + c.revision() + "|" + c.status() + "|" + c.reason() + "|"
                + c.expectedContextVersion() + "|" + c.actor().actorType() + "|" + c.actor().actorId());
    }

    public static class TerminalUpdateRuleInvalidException extends RuntimeException {}
    public static class TerminalUpdateRuleTargetInvalidException extends RuntimeException {}
    public static class TerminalUpdateRuleScopeMismatchException extends RuntimeException {}
    public static class TerminalUpdateRuleNotFoundException extends RuntimeException {}
    public static class TerminalUpdateRuleStaleStateException extends RuntimeException {}
    public static class TerminalUpdateRuleIdempotencyConflictException extends RuntimeException {}
    public static class TerminalUpdateRuleInvariantException extends RuntimeException {}
}
