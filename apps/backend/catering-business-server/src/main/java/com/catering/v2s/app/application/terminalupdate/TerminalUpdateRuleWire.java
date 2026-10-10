package com.catering.v2s.app.application.terminalupdate;

import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleDetail;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleDetailFullArtifactIdentity;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRulePage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleStorePage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleSummary;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleSummaryFullArtifactIdentity;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleStorePageItemsItem;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleReadback;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RulePage;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleStorePage;

public final class TerminalUpdateRuleWire {
    private TerminalUpdateRuleWire() {}

    public static TerminalUpdateRuleDetail from(RuleReadback rule) {
        return new TerminalUpdateRuleDetail(
                rule.ruleRef(), rule.projectRef(), rule.status(), rule.targetMode(), rule.fullArtifactRef(),
                rule.hotArtifactRef(), fullDetailIdentity(rule), nullableIdentity(rule.hotArtifactIdentity()),
                rule.nSeconds(), rule.hotStrategy(), nullableLong(rule.mSeconds()),
                nullableString(rule.description()), rule.createdAtEpochMillis(), rule.revision(), rule.storeRefs());
    }

    public static TerminalUpdateRulePage from(RulePage page) {
        return new TerminalUpdateRulePage(page.items().stream().map(rule -> new TerminalUpdateRuleSummary(
                rule.ruleRef(), rule.projectRef(), rule.status(), rule.targetMode(), rule.fullArtifactRef(),
                rule.hotArtifactRef(), new TerminalUpdateRuleSummaryFullArtifactIdentity(
                        rule.fullArtifactIdentity().applicationId(), rule.fullArtifactIdentity().kind(),
                        rule.fullArtifactIdentity().version()), nullableIdentity(rule.hotArtifactIdentity()),
                rule.nSeconds(), rule.hotStrategy(), nullableLong(rule.mSeconds()),
                nullableString(rule.description()), rule.createdAtEpochMillis(), rule.revision())).toList(),
                nullableString(page.nextCursor()));
    }

    public static TerminalUpdateRuleStorePage from(RuleStorePage page) {
        return new TerminalUpdateRuleStorePage(page.items().stream().map(store -> new TerminalUpdateRuleStorePageItemsItem(
                store.storeRef(), nullableString(store.name().isEmpty() ? null : store.name()),
                nullableString(store.code().isEmpty() ? null : store.code()), store.status(), store.unknownReason()))
                .toList(), nullableString(page.nextCursor()));
    }

    private static tools.jackson.databind.JsonNode nullableLong(Long value) {
        return value == null ? null : tools.jackson.databind.node.JsonNodeFactory.instance.numberNode(value);
    }

    private static tools.jackson.databind.JsonNode nullableString(String value) {
        return value == null ? null : tools.jackson.databind.node.JsonNodeFactory.instance.textNode(value);
    }

    private static TerminalUpdateRuleDetailFullArtifactIdentity fullDetailIdentity(RuleReadback rule) {
        var identity = rule.fullArtifactIdentity();
        if (identity == null) throw new IllegalStateException("terminal update rule full artifact identity is missing");
        return new TerminalUpdateRuleDetailFullArtifactIdentity(
                identity.applicationId(), identity.kind(), identity.version());
    }

    private static tools.jackson.databind.JsonNode nullableIdentity(
            com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RuleArtifactIdentity identity) {
        if (identity == null) return null;
        var object = tools.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        object.put("applicationId", identity.applicationId());
        object.put("kind", identity.kind());
        object.put("version", identity.version());
        return object;
    }
}
