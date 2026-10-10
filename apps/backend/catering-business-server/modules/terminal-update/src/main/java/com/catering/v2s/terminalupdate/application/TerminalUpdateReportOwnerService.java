package com.catering.v2s.terminalupdate.application;

import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportHistoryPage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportInput;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.ReportReceipt;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionDetail;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionPage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateReportOwnerApi.VersionQuery;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateReportPersistence;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateReportPersistence.ReportFacts;
import com.catering.v2s.terminalupdate.application.persistence.TerminalUpdateReportPersistence.StoredReport;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns accepted update reports and their project-scoped readback. */
@Service
public class TerminalUpdateReportOwnerService implements TerminalUpdateReportOwnerApi {
    private final TerminalUpdateReportPersistence persistence;
    private final TerminalCredentialVerificationApi credentials;
    private final TimeProvider time;

    public TerminalUpdateReportOwnerService(
            TerminalUpdateReportPersistence persistence,
            TerminalCredentialVerificationApi credentials,
            TimeProvider time) {
        this.persistence = Objects.requireNonNull(persistence, "persistence");
        this.credentials = Objects.requireNonNull(credentials, "credentials");
        this.time = Objects.requireNonNull(time, "time");
    }

    @Override
    @Transactional
    public ReportReceipt record(Verification binding, ReportInput input) {
        Objects.requireNonNull(binding, "binding");
        validate(input);
        if (!credentials.lockCurrentActiveBinding(binding))
            throw new TerminalUpdateReportOwnerApi.BindingNoLongerActiveException();
        persistence.lock(binding);

        ReportFacts facts = persistence.facts(binding, input);
        StoredReport current = facts.current();
        StoredReport sameSequence = facts.sameSequence();
        StoredReport sameReportId = facts.sameReportId();
        if (sameSequence != null) {
            if (!Objects.equals(sameSequence.taskId(), input.taskId())) throw new IdentityConflictException();
            if (sameSequence.reportId().equals(input.reportId()) && sameSequence.bodyHash().equals(input.bodyHash())
                    && sameSequence.deviceId().equals(input.deviceId()))
                return new ReportReceipt(sameSequence.reportId(), sameSequence.taskId(), sameSequence.sequence(), "ACCEPTED");
            throw new IdentityConflictException();
        }

        if (sameReportId != null) throw new IdentityConflictException();

        if (current != null && input.reportSequence() < current.sequence()) {
            if (input.taskId() != null && current.taskId().equals(input.taskId()))
                return new ReportReceipt(input.reportId(), input.taskId(), current.sequence(), "SUPERSEDED");
            throw new IdentityConflictException();
        }

        if (input.reportSequence() < facts.maximumSequence() && input.taskId() == null)
            throw new IdentityConflictException();
        long receivedAt = Math.max(1, time.currentEpochMillis());
        if (current != null) return persistence.update(binding, input, receivedAt);
        return persistence.insert(binding, input, receivedAt);
    }

    @Override
    @Transactional(readOnly = true)
    public VersionPage readVersionPage(VersionQuery query) {
        validateQuery(query);
        var page = persistence.page(query);
        return new VersionPage(page.items(), page.nextCursor());
    }

    @Override
    @Transactional(readOnly = true)
    public VersionDetail readVersionDetail(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef) {
        return persistence.detail(workspaceUuid, groupWorkspaceKey, projectRef, terminalRef)
                .orElseThrow(TargetNotFoundException::new);
    }

    @Override
    @Transactional(readOnly = true)
    public ReportHistoryPage readHistory(UUID workspaceUuid, String groupWorkspaceKey, UUID projectRef, UUID terminalRef,
            String cursor, int limit) {
        var page = persistence.history(workspaceUuid, groupWorkspaceKey, projectRef, terminalRef, cursor, limit);
        if (!page.eligible()) throw new TargetNotFoundException();
        return new ReportHistoryPage(page.items(), page.nextCursor());
    }

    private static void validate(ReportInput input) {
        if (input == null || input.reportId() == null || input.reportSequence() < 1 || input.deviceId() == null
                || input.deviceId().isBlank() || input.deviceId().length() > 128
                || input.actualJson() == null || input.recentJson() == null || input.changedAtEpochMillis() < 0
                || input.bodyHash() == null || !input.bodyHash().matches("[a-f0-9]{64}"))
            throw new InvalidQueryException();
    }

    private static void validateQuery(VersionQuery query) {
        if (query == null || query.workspaceUuid() == null || query.groupWorkspaceKey() == null
                || query.projectRef() == null || query.limit() < 1 || query.limit() > 100
                || exceeds(query.queryText(), 120) || exceeds(query.currentApkVersion(), 128)
                || exceeds(query.currentJsVersion(), 128) || exceeds(query.runtimeVersion(), 128)
                || exceeds(query.cursor(), 512)) throw new InvalidQueryException();
    }

    private static boolean exceeds(String value, int max) { return value != null && value.length() > max; }
}
