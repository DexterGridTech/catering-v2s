package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Real HTTP business oracles for template/channel ownership and cross-owner stop policy. */
final class BusinessChannelAcceptanceScenarios {
    private static final RouteIdentity PROVIDER_CANDIDATES = new RouteIdentity(
            "getOperationsExternalProviderCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/external-provider-candidates");
    private static final RouteIdentity OWNER_BINDING_DETAIL = new RouteIdentity(
            "getOperationsOwnerBindingDetail",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");
    private static final RouteIdentity OWNER_BINDING_CREATE = new RouteIdentity(
            "createOperationsOwnerBinding",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");
    private static final RouteIdentity OWNER_BINDING_DELETE = new RouteIdentity(
            "deleteOperationsOwnerBinding",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");
    private static final RouteIdentity PROVIDER_DETAIL = new RouteIdentity(
            "getPlatformProviderProfileDetail",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}");
    private static final RouteIdentity PROVIDER_STATUS = new RouteIdentity(
            "transitionPlatformProviderProfileStatus",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/status");
    private static final RouteIdentity TEMPLATE_LIST = new RouteIdentity(
            "getOperationsBusinessChannelTemplates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates");
    private static final RouteIdentity TEMPLATE_CREATE = new RouteIdentity(
            "createOperationsBusinessChannelTemplate",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates");
    private static final RouteIdentity TEMPLATE_UPDATE = new RouteIdentity(
            "updateOperationsBusinessChannelTemplate",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}");
    private static final RouteIdentity TEMPLATE_STATUS = new RouteIdentity(
            "transitionOperationsBusinessChannelTemplateStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/{templateRef}/status");
    private static final RouteIdentity TEMPLATE_CANDIDATES = new RouteIdentity(
            "getOperationsStoreBusinessChannelTemplateCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-template-candidates");
    private static final RouteIdentity CHANNEL_LIST_PROJECT = new RouteIdentity(
            "getOperationsProjectBusinessChannels",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels");
    private static final RouteIdentity CHANNEL_LIST_STORE = new RouteIdentity(
            "getOperationsStoreBusinessChannels",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/business-channels");
    private static final RouteIdentity CHANNEL_CREATE = new RouteIdentity(
            "createOperationsBusinessChannel",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels");
    private static final RouteIdentity CHANNEL_UPDATE = new RouteIdentity(
            "updateOperationsBusinessChannel",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}");
    private static final RouteIdentity CHANNEL_DETAIL = new RouteIdentity(
            "getOperationsBusinessChannelDetail",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}");
    private static final RouteIdentity CHANNEL_STATUS = new RouteIdentity(
            "transitionOperationsBusinessChannelStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}");

    private final BackendAcceptanceTest host;

    BusinessChannelAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    /** CP-05 calibration bridge: creates a real externally-bound store channel for owner update/delete probes. */
    JsonNode calibrationCreateExternalBinding(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session,
            String providerCode)
            throws Exception {
        OperationsFixture operations = new OperationsFixture(fixture, session);
        enableProvider(context, fixture, providerCode);
        return createExternalStoreBinding(
                        context,
                        operations,
                        operations,
                        providerCode,
                        "GROUP_BUY",
                        "calibration-owner-" + UUID.randomUUID(),
                        "Calibration external binding")
                .json();
    }

    /** CP-05 calibration bridge: exercises legal local unbind on a real externally authorized binding. */
    void calibrationDeleteLocallyUnboundExternalBinding(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session,
            String providerCode)
            throws Exception {
        OperationsFixture operations = new OperationsFixture(fixture, session);
        enableProvider(context, fixture, providerCode);
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(fixture, Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOperations =
                new OperationsFixture(projectFixture, host.login(context, projectFixture));
        BackendAcceptanceTest.Response template = createTemplate(
                context,
                projectOperations,
                "Calibration binding delete template",
                "EXTERNAL",
                "STORE",
                "GROUP_BUY",
                providerCode,
                null);
        BackendAcceptanceTest.Response channel = createChannel(
                context,
                operations,
                template.json().path("templateRef").asText(),
                "STORE",
                fixture.storeId(),
                "Calibration binding delete channel");
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response storeChannels = context.get(
                CHANNEL_LIST_STORE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                        + "/business-channels?pageSize=20",
                session.cookie(),
                Set.of(200));
        assertTrue(
                find(storeChannels.json().path("items"), "channelRef", channelRef.toString()) != null,
                "BUSINESS: store channel task read returns the newly created channel");
        BackendAcceptanceTest.Response binding = createBinding(
                context,
                operations,
                channelRef,
                providerCode,
                "GROUP_BUY",
                "STORE",
                fixture.storeId(),
                "Calibration binding",
                "calibration-binding-" + UUID.randomUUID());
        BackendAcceptanceTest.Response bindingDetail = context.get(
                OWNER_BINDING_DETAIL,
                channelPath(fixture, channelRef) + "/owner-binding",
                session.cookie(),
                Set.of(200));
        assertEquals(
                binding.json().path("bindingRef").asText(),
                bindingDetail.json().path("bindingRef").asText(),
                "BUSINESS: owner-binding detail reads back the created owner identity");
        BackendAcceptanceTest.RouteIdentity delete = new BackendAcceptanceTest.RouteIdentity(
                "deleteOperationsOwnerBinding",
                "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");
        BackendAcceptanceTest.Response deleted = context.delete(
                delete,
                channelPath(fixture, channelRef) + "/owner-binding",
                session.cookie(),
                Map.of("expectedVersion", binding.json().path("version").asLong()),
                Set.of(200));
        assertEquals("DELETED", deleted.json().path("status").asText(), "BUSINESS: local unbind deletes the binding");
    }

    /**
     * CP-05 normal-path bridge: supplies real successful update completions for the two business-channel operations
     * whose bounded product scenarios otherwise exercise only rejected updates. It is deliberately not an
     * {@link AcceptanceScenario}: the run-level performance verifier owns this calibration proof and the business
     * scenario denominator remains unchanged.
     */
    void calibrationUpdateInternalTemplateAndChannel(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        BackendAcceptanceTest.Response template = createTemplate(
                context,
                projectOwner,
                "Performance calibration template",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null);
        UUID templateRef = UUID.fromString(template.json().path("templateRef").asText());
        BackendAcceptanceTest.Response updatedTemplate = context.patch(
                TEMPLATE_UPDATE,
                templatePath(projectOwner.fixture(), templateRef),
                projectOwner.session().cookie(),
                Map.of(
                        "templateName",
                        "Performance calibration template updated",
                        "expectedVersion",
                        template.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "Performance calibration template updated",
                updatedTemplate.json().path("templateName").asText(),
                "BUSINESS: normal calibration saves the internal template name");

        BackendAcceptanceTest.Response channel = createChannel(
                context,
                projectOwner,
                templateRef.toString(),
                "PROJECT",
                projectOwner.fixture().projectId(),
                "Performance calibration channel");
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response updatedChannel = context.patch(
                CHANNEL_UPDATE,
                channelPath(projectOwner.fixture(), channelRef),
                projectOwner.session().cookie(),
                Map.of(
                        "channelName",
                        "Performance calibration channel updated",
                        "expectedVersion",
                        channel.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "Performance calibration channel updated",
                updatedChannel.json().path("channelName").asText(),
                "BUSINESS: normal calibration saves the internal channel name");
    }

    @AcceptanceScenario(
            id = "business-channel.cascade-and-draft",
            module = "BUSINESS_CHANNEL",
            operation = "cascadeAndDraft")
    void cascadeAndDraft(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture fixture = operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        BackendAcceptanceTest.Response template =
                createTemplate(context, fixture, "Internal takeaway", "INTERNAL", "PROJECT", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response channel = createChannel(
                context,
                fixture,
                template.json().path("templateRef").asText(),
                "PROJECT",
                fixture.fixture().projectId(),
                "Project takeaway");
        assertEquals(
                "ENABLED",
                channel.json().path("status").asText(),
                "BUSINESS: an internal channel is enabled immediately without an external binding");
        assertEquals(
                "NOT_REQUIRED",
                channel.json().path("bindingStatus").asText(),
                "BUSINESS: an internal channel has no binding requirement");
        assertFalse(
                channel.json().has("bindingStatusDisplayName"),
                "BUSINESS: binding status presentation is owned by the frontend dictionary");
        UUID templateRef = UUID.fromString(template.json().path("templateRef").asText());
        assertChannelFacts(
                channel.json(),
                "createOperationsBusinessChannel",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: channel create returns exact structured status facts");

        BackendAcceptanceTest.Response projectChannels = context.get(
                CHANNEL_LIST_PROJECT,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/projects/"
                        + fixture.fixture().projectId() + "/business-channels",
                fixture.session().cookie(),
                Set.of(200));
        assertChannelPageFacts(
                projectChannels.json(),
                "getOperationsProjectBusinessChannels",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: project channel page binds structured status facts to the page response");
        JsonNode internalListRow = find(
                projectChannels.json().path("items"),
                "channelRef",
                channel.json().path("channelRef").asText());
        assertEquals(
                "NOT_REQUIRED",
                internalListRow.path("bindingStatus").asText(),
                "BUSINESS: project channel list preserves the owner binding semantic");
        assertChannelFacts(
                internalListRow,
                "getOperationsProjectBusinessChannels",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: project channel list returns exact structured status facts");

        Map<String, Object> duplicateTemplateBody = new LinkedHashMap<>();
        duplicateTemplateBody.put("projectRef", fixture.fixture().projectId().toString());
        duplicateTemplateBody.put("templateName", "Duplicate template code");
        duplicateTemplateBody.put(
                "templateCode", template.json().path("templateCode").asText());
        duplicateTemplateBody.put("accessKind", "INTERNAL");
        duplicateTemplateBody.put("operatorKind", "PROJECT");
        duplicateTemplateBody.put("orderKind", "TAKEAWAY");
        duplicateTemplateBody.put("dineInForm", null);
        duplicateTemplateBody.put("providerCode", null);
        BackendAcceptanceTest.Response duplicateTemplate = context.post(
                TEMPLATE_CREATE,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/business-channel-templates",
                fixture.session().cookie(),
                duplicateTemplateBody,
                headers(),
                Set.of(409));
        assertEquals(
                "DUPLICATE_CODE",
                duplicateTemplate.problemCode(),
                "BUSINESS: template code is unique within the project");

        Map<String, Object> duplicateChannelBody = new LinkedHashMap<>();
        duplicateChannelBody.put(
                "templateRef", template.json().path("templateRef").asText());
        duplicateChannelBody.put("ownerNodeType", "PROJECT");
        duplicateChannelBody.put("ownerNodeRef", fixture.fixture().projectId().toString());
        duplicateChannelBody.put(
                "channelCode", channel.json().path("channelCode").asText());
        duplicateChannelBody.put("channelName", "Duplicate channel code");
        duplicateChannelBody.put("bindingRef", null);
        BackendAcceptanceTest.Response duplicateChannel = context.post(
                CHANNEL_CREATE,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/business-channels",
                fixture.session().cookie(),
                duplicateChannelBody,
                headers(),
                Set.of(409));
        assertEquals(
                "DUPLICATE_CODE",
                duplicateChannel.problemCode(),
                "BUSINESS: channel code is unique within the group workspace");

        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response stoppedTemplate = context.post(
                TEMPLATE_STATUS,
                templatePath(fixture.fixture(), templateRef) + "/status",
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        template.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "DISABLED",
                stoppedTemplate.json().path("status").asText(),
                "BUSINESS: template stop is persisted by business-channel owner");
        BackendAcceptanceTest.Response templatePage = context.get(
                TEMPLATE_LIST,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/business-channel-templates?pageSize=20",
                fixture.session().cookie(),
                Set.of(200));
        assertNotNull(
                find(templatePage.json().path("items"), "templateRef", templateRef.toString()),
                "BUSINESS: disabled template remains visible in list readback");
        BackendAcceptanceTest.Response disabledEdit = context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixture.fixture(), templateRef),
                fixture.session().cookie(),
                Map.of(
                        "templateName",
                        "disabled template edited",
                        "expectedVersion",
                        stoppedTemplate.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "disabled template edited",
                disabledEdit.json().path("templateName").asText(),
                "BUSINESS: disabled template remains editable");
        assertEquals(
                "DISABLED",
                disabledEdit.json().path("status").asText(),
                "BUSINESS: editing a disabled template does not re-enable it");
        BackendAcceptanceTest.Response readback = context.get(
                CHANNEL_DETAIL,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Set.of(200));
        assertChannelFacts(
                readback.json(),
                "getOperationsBusinessChannelDetail",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "DISABLED"),
                dimensions(dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED")),
                "BUSINESS: channel detail returns exact structured status facts");
        assertEquals(
                "ENABLED",
                requiredJsonNode(readback.json(), "/status", JsonNodeType.STRING, "BUSINESS: channel self status")
                        .asText(),
                "BUSINESS: template stop does not rewrite channel self status");
        assertEquals(
                "ENABLED",
                requiredJsonNode(readback.json(), "/selfStatus", JsonNodeType.STRING, "BUSINESS: channel selfStatus")
                        .asText(),
                "BUSINESS: selfStatus mirrors the channel's own lifecycle fact");
        assertJsonNodeEquals(
                readback.json(),
                "/statusDimensions",
                dimensions(
                        dimension("GROUP_WORKSPACE", fixture.fixture().groupWorkspaceKey(), "ENABLED"),
                        dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED"),
                        dimension(
                                "ORGANIZATION_PROJECT",
                                fixture.fixture().projectId().toString(),
                                "ENABLED"),
                        dimension(
                                "ORGANIZATION_REGION",
                                fixture.fixture().regionId().toString(),
                                "ENABLED")),
                "BUSINESS: channel status dimensions preserve ordered owner facts");
        assertJsonNodeEquals(
                readback.json(),
                "/blockers",
                dimensions(dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED")),
                "BUSINESS: channel blockers contain exactly the disabled template fact");
        assertEquals(
                "ENABLED",
                readback.json().path("status").asText(),
                "BUSINESS: template stop does not rewrite channel self status");
        assertEquals(
                "DISABLED",
                dimensionStatus(readback.json().path("statusDimensions"), "BUSINESS_CHANNEL_TEMPLATE", templateRef),
                "BUSINESS: template status is returned as an independent dimension");
        assertEquals(
                "DISABLED",
                dimensionStatus(readback.json().path("blockers"), "BUSINESS_CHANNEL_TEMPLATE", templateRef),
                "BUSINESS: template stop is surfaced as a structured blocker");
        BackendAcceptanceTest.Response updatedChannel = context.patch(
                CHANNEL_UPDATE,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Map.of(
                        "channelName",
                        "Project takeaway edited while template disabled",
                        "expectedVersion",
                        readback.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertChannelFacts(
                updatedChannel.json(),
                "updateOperationsBusinessChannel",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "DISABLED"),
                dimensions(dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED")),
                "BUSINESS: channel update preserves exact upstream status facts");
        BackendAcceptanceTest.Response disabledChannel = context.post(
                CHANNEL_STATUS,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        updatedChannel.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertChannelFacts(
                disabledChannel.json(),
                "transitionOperationsBusinessChannelStatus",
                "DISABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "DISABLED"),
                dimensions(dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED")),
                "BUSINESS: channel transition returns exact disabled and blocker facts");
        BackendAcceptanceTest.Response enabledChannel = context.post(
                CHANNEL_STATUS,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "ENABLED",
                        "expectedVersion",
                        disabledChannel.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertChannelFacts(
                enabledChannel.json(),
                "transitionOperationsBusinessChannelStatus",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "DISABLED"),
                dimensions(dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED")),
                "BUSINESS: channel re-enable preserves exact upstream blocker facts");
        BackendAcceptanceTest.Response restoredTemplate = context.post(
                TEMPLATE_STATUS,
                templatePath(fixture.fixture(), templateRef) + "/status",
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "ENABLED",
                        "expectedVersion",
                        disabledEdit.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals("ENABLED", restoredTemplate.json().path("status").asText());
        BackendAcceptanceTest.Response recovered = context.get(
                CHANNEL_DETAIL,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Set.of(200));
        assertChannelFacts(
                recovered.json(),
                "getOperationsBusinessChannelDetail",
                "ENABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: recovered channel returns exact structured status facts");
        assertEquals(
                "ENABLED",
                requiredJsonNode(recovered.json(), "/status", JsonNodeType.STRING, "BUSINESS: recovered channel status")
                        .asText(),
                "BUSINESS: restoring the upstream template preserves channel self status");
        assertJsonNodeEquals(
                recovered.json(),
                "/statusDimensions",
                dimensions(
                        dimension("GROUP_WORKSPACE", fixture.fixture().groupWorkspaceKey(), "ENABLED"),
                        dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "ENABLED"),
                        dimension(
                                "ORGANIZATION_PROJECT",
                                fixture.fixture().projectId().toString(),
                                "ENABLED"),
                        dimension(
                                "ORGANIZATION_REGION",
                                fixture.fixture().regionId().toString(),
                                "ENABLED")),
                "BUSINESS: recovery returns the complete ordered status dimensions");
        assertJsonNodeEquals(
                recovered.json(),
                "/blockers",
                dimensions(),
                "BUSINESS: restoring the upstream template clears derived blockers without a channel write");

        String reusableTemplateCode = "TPL-VOIDED-" + UUID.randomUUID();
        BackendAcceptanceTest.Response voidedTemplate = createTemplateWithCode(
                context,
                fixture,
                "Void and reuse template",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null,
                reusableTemplateCode);
        BackendAcceptanceTest.Response voidedTemplateReadback = context.post(
                TEMPLATE_STATUS,
                templatePath(
                                fixture.fixture(),
                                UUID.fromString(voidedTemplate
                                        .json()
                                        .path("templateRef")
                                        .asText()))
                        + "/status",
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "VOIDED",
                        "expectedVersion",
                        voidedTemplate.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "VOIDED",
                voidedTemplateReadback.json().path("status").asText(),
                "BUSINESS: voided template remains a historical fact");
        BackendAcceptanceTest.Response replacementTemplate = createTemplateWithCode(
                context,
                fixture,
                "Replacement template after void",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null,
                reusableTemplateCode);
        assertEquals(
                reusableTemplateCode,
                replacementTemplate.json().path("templateCode").asText(),
                "BUSINESS: VOIDED template releases its project-scoped code");

        String reusableChannelCode = "CH-VOIDED-" + UUID.randomUUID();
        BackendAcceptanceTest.Response voidedChannel = createChannelWithCode(
                context,
                fixture,
                templateRef.toString(),
                "PROJECT",
                fixture.fixture().projectId(),
                "Void and reuse channel",
                reusableChannelCode);
        BackendAcceptanceTest.Response voidedChannelReadback = context.post(
                CHANNEL_STATUS,
                channelPath(
                        fixture.fixture(),
                        UUID.fromString(voidedChannel.json().path("channelRef").asText())),
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "VOIDED",
                        "expectedVersion",
                        voidedChannel.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "VOIDED",
                voidedChannelReadback.json().path("status").asText(),
                "BUSINESS: voided channel remains a historical fact");
        BackendAcceptanceTest.Response replacementChannel = createChannelWithCode(
                context,
                fixture,
                templateRef.toString(),
                "PROJECT",
                fixture.fixture().projectId(),
                "Replacement channel after void",
                reusableChannelCode);
        assertEquals(
                reusableChannelCode,
                replacementChannel.json().path("channelCode").asText(),
                "BUSINESS: VOIDED channel releases its group-scoped code");
    }

    @AcceptanceScenario(
            id = "business-channel.planned-provider-candidate",
            module = "BUSINESS_CHANNEL",
            operation = "plannedProviderCandidate")
    void plannedProviderCandidate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture fixture = operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        enableProvider(context, fixture.fixture(), "MEITUAN_ISV_B");
        BackendAcceptanceTest.Response candidates = context.get(
                PROVIDER_CANDIDATES,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/external-provider-candidates",
                fixture.session().cookie(),
                Set.of(200));
        JsonNode planned = find(candidates.json().path("items"), "providerCode", "MEITUAN_ISV_B");
        assertEquals(
                "PLANNED",
                planned.path("catalogStatus").asText(),
                "BUSINESS: candidate retains PLANNED catalogue status");
        BackendAcceptanceTest.Response template = createTemplate(
                context, fixture, "External group buy", "EXTERNAL", "PROJECT", "GROUP_BUY", "MEITUAN_ISV_B", null);
        assertEquals(
                "EXTERNAL",
                template.json().path("accessKind").asText(),
                "BUSINESS: enabled admission is independent from catalogue phase");
        assertEquals(
                "MEITUAN_ISV_B",
                template.json().path("providerCode").asText(),
                "BUSINESS: template stores the selected provider identity");
    }

    @AcceptanceScenario(
            id = "business-channel.double-source-and-manual-stop",
            module = "BUSINESS_CHANNEL",
            operation = "doubleSourceAndManualStop")
    void doubleSourceAndManualStop(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture fixture = operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        BackendAcceptanceTest.Response template =
                createTemplate(context, fixture, "Manual stop test", "INTERNAL", "PROJECT", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response channel = createChannel(
                context,
                fixture,
                template.json().path("templateRef").asText(),
                "PROJECT",
                fixture.fixture().projectId(),
                "Manual stop channel");
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response manual = context.post(
                CHANNEL_STATUS,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        channel.json().path("version").asLong()),
                headers(),
                Set.of(200));
        UUID templateRef = UUID.fromString(template.json().path("templateRef").asText());
        assertChannelFacts(
                manual.json(),
                "transitionOperationsBusinessChannelStatus",
                "DISABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: manual stop returns exact channel status facts");
        BackendAcceptanceTest.Response templateStop = context.post(
                TEMPLATE_STATUS,
                templatePath(fixture.fixture(), templateRef) + "/status",
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        template.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "DISABLED", templateStop.json().path("status").asText(), "BUSINESS: second stop source is persisted");
        BackendAcceptanceTest.Response restoredTemplate = context.post(
                TEMPLATE_STATUS,
                templatePath(fixture.fixture(), templateRef) + "/status",
                fixture.session().cookie(),
                Map.of(
                        "status",
                        "ENABLED",
                        "expectedVersion",
                        templateStop.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "ENABLED",
                restoredTemplate.json().path("status").asText(),
                "BUSINESS: restoring one source is accepted");
        BackendAcceptanceTest.Response afterOneSource = context.get(
                CHANNEL_DETAIL,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Set.of(200));
        assertChannelFacts(
                afterOneSource.json(),
                "getOperationsBusinessChannelDetail",
                "DISABLED",
                projectChannelDimensions(fixture.fixture(), templateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: one remaining manual stop is read back exactly");
    }

    @AcceptanceScenario(
            id = "business-channel.store-template-scope",
            module = "BUSINESS_CHANNEL",
            operation = "storeTemplateScope")
    void storeTemplateScope(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        BackendAcceptanceTest.Response projectTemplate = createTemplate(
                context, projectOwner, "Project template", "INTERNAL", "PROJECT", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response storeTemplate =
                createTemplate(context, projectOwner, "Store template", "INTERNAL", "STORE", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response disabledStoreTemplate = createTemplate(
                context, projectOwner, "Disabled store template", "INTERNAL", "STORE", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response disabledStoreTemplateReadback = context.post(
                TEMPLATE_STATUS,
                templatePath(
                                projectOwner.fixture(),
                                UUID.fromString(disabledStoreTemplate
                                        .json()
                                        .path("templateRef")
                                        .asText()))
                        + "/status",
                projectOwner.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        disabledStoreTemplate.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabledStoreTemplateReadback.json().path("status").asText(),
                "BUSINESS: disabled store template is a real excluded candidate fixture");
        BackendAcceptanceTest.Fixture storeFixture =
                host.siblingStoreFixtureSameBrand(projectOwner.fixture(), Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, storeFixture);
        OperationsFixture storeViewer =
                selectStore(context, new OperationsFixture(storeFixture, host.login(context, storeFixture)));
        BackendAcceptanceTest.Response candidates = context.get(
                TEMPLATE_CANDIDATES,
                "/api/operations/group-workspaces/" + storeViewer.fixture().groupWorkspaceKey()
                        + "/business-channel-template-candidates?projectRef="
                        + storeViewer.fixture().projectId()
                        + "&storeRef=" + storeViewer.fixture().storeId() + "&pageSize=20",
                storeViewer.session().cookie(),
                Set.of(200));
        assertEquals(
                1, candidates.json().path("items").size(), "BUSINESS: store candidate list excludes project templates");
        assertEquals(
                storeTemplate.json().path("templateRef").asText(),
                candidates.json().path("items").get(0).path("templateRef").asText(),
                "BUSINESS: store candidate is the owner-compatible template");
        assertFalse(
                candidates
                        .json()
                        .toString()
                        .contains(
                                disabledStoreTemplate.json().path("templateRef").asText()),
                "BUSINESS: disabled store template is not an effective candidate");
        BackendAcceptanceTest.Response channel = createChannel(
                context,
                storeViewer,
                storeTemplate.json().path("templateRef").asText(),
                "STORE",
                storeViewer.fixture().storeId(),
                "Store channel from project template");
        assertEquals(
                "ENABLED",
                channel.json().path("status").asText(),
                "BUSINESS: an internal store channel is enabled immediately");
        UUID storeTemplateRef =
                UUID.fromString(storeTemplate.json().path("templateRef").asText());
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response storeChannels = context.get(
                CHANNEL_LIST_STORE,
                "/api/operations/group-workspaces/" + storeViewer.fixture().groupWorkspaceKey() + "/stores/"
                        + storeViewer.fixture().storeId() + "/business-channels?pageSize=20",
                storeViewer.session().cookie(),
                Set.of(200));
        assertChannelPageFacts(
                storeChannels.json(),
                "getOperationsStoreBusinessChannels",
                "ENABLED",
                storeChannelDimensions(storeViewer.fixture(), storeTemplateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: store channel page binds structured status facts to the page response");
        JsonNode storeListRow = find(
                storeChannels.json().path("items"),
                "channelRef",
                channel.json().path("channelRef").asText());
        assertChannelFacts(
                storeListRow,
                "getOperationsStoreBusinessChannels",
                "ENABLED",
                storeChannelDimensions(storeViewer.fixture(), storeTemplateRef, "ENABLED"),
                dimensions(),
                "BUSINESS: store channel list returns exact structured status facts");
        BackendAcceptanceTest.Response stoppedStoreTemplate = context.post(
                TEMPLATE_STATUS,
                templatePath(projectOwner.fixture(), storeTemplateRef) + "/status",
                projectOwner.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        storeTemplate.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "DISABLED",
                stoppedStoreTemplate.json().path("status").asText(),
                "BUSINESS: project owner can disable the store template");
        BackendAcceptanceTest.Response cascadedChannel = context.get(
                CHANNEL_DETAIL,
                channelPath(storeViewer.fixture(), channelRef),
                storeViewer.session().cookie(),
                Set.of(200));
        assertChannelFacts(
                cascadedChannel.json(),
                "getOperationsBusinessChannelDetail",
                "ENABLED",
                storeChannelDimensions(storeViewer.fixture(), storeTemplateRef, "DISABLED"),
                dimensions(dimension("BUSINESS_CHANNEL_TEMPLATE", storeTemplateRef.toString(), "DISABLED")),
                "BUSINESS: existing store channel keeps exact status facts when template is disabled");
        BackendAcceptanceTest.Response candidatesAfterDisable = context.get(
                TEMPLATE_CANDIDATES,
                "/api/operations/group-workspaces/" + storeViewer.fixture().groupWorkspaceKey()
                        + "/business-channel-template-candidates?projectRef="
                        + storeViewer.fixture().projectId()
                        + "&storeRef=" + storeViewer.fixture().storeId() + "&pageSize=20",
                storeViewer.session().cookie(),
                Set.of(200));
        assertEquals(
                0,
                candidatesAfterDisable.json().path("items").size(),
                "BUSINESS: disabled store templates are removed from new-channel candidates");
        assertFalse(
                candidatesAfterDisable.json().toString().contains(storeTemplateRef.toString()),
                "BUSINESS: the disabled template is not offered again");
        assertEquals(
                "PROJECT",
                projectTemplate.json().path("operatorKind").asText(),
                "BUSINESS: project template remains project-owned");
    }

    @AcceptanceScenario(
            id = "business-channel.disabled-store-create",
            module = "BUSINESS_CHANNEL",
            operation = "disabledStoreCreate")
    void disabledStoreCreate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture fixture = operationsFixture(context, "STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        BackendAcceptanceTest.Fixture projectFixture = host.projectUserFixture(
                fixture.fixture(), Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        BackendAcceptanceTest.Response disabled = context.post(
                OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/organization/stores/"
                        + fixture.fixture().storeId() + "/status",
                projectOwner.session().cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", 1),
                Set.of(200));
        assertEquals("DISABLED", disabled.json().path("status").asText(), "BUSINESS: store master status is disabled");
        BackendAcceptanceTest.Response template = createTemplate(
                context, projectOwner, "Disabled store channel", "INTERNAL", "STORE", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response channel = createChannel(
                context,
                fixture,
                template.json().path("templateRef").asText(),
                "STORE",
                fixture.fixture().storeId(),
                "Created while store disabled");
        assertEquals(
                "STORE",
                channel.json().path("ownerNodeType").asText(),
                "BUSINESS: channel owner remains the requested store");
        assertEquals(
                fixture.fixture().storeId().toString(),
                channel.json().path("ownerNodeRef").asText(),
                "BUSINESS: disabled store identity is read back");
        assertEquals(
                "ENABLED",
                channel.json().path("status").asText(),
                "BUSINESS: store status does not block an internal channel from becoming enabled");
        assertFalse(
                channel.json().path("channelRef").asText().isBlank(),
                "BUSINESS: disabled store creation returns a real channel identity");
    }

    @AcceptanceScenario(
            id = "business-channel.cross-node-read-authorization",
            module = "BUSINESS_CHANNEL",
            operation = "crossNodeReadAuthorization")
    void crossNodeReadAuthorization(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Set<String> storeChannelCapabilities = Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT");
        OperationsFixture attacker =
                selectStore(context, operationsFixture(context, "STORE", storeChannelCapabilities));
        BackendAcceptanceTest.Fixture ownerFixture =
                host.siblingStoreFixtureSameBrand(attacker.fixture(), storeChannelCapabilities);
        host.completeInvitation(context, ownerFixture);
        OperationsFixture owner =
                selectStore(context, new OperationsFixture(ownerFixture, host.login(context, ownerFixture)));
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(attacker.fixture(), Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        enableProvider(context, owner.fixture(), "MEITUAN_ISV_B");

        BackendAcceptanceTest.Response ownerTemplate = createTemplate(
                context,
                projectOwner,
                "M1 protected store channel",
                "EXTERNAL",
                "STORE",
                "TAKEAWAY",
                "MEITUAN_ISV_B",
                null);
        BackendAcceptanceTest.Response ownerChannel = createChannel(
                context,
                owner,
                ownerTemplate.json().path("templateRef").asText(),
                "STORE",
                owner.fixture().storeId(),
                "M1 protected channel");
        assertEquals(
                "UNBOUND",
                ownerChannel.json().path("bindingStatus").asText(),
                "BUSINESS: an external channel without a binding is explicitly unbound");
        assertFalse(
                ownerChannel.json().has("bindingStatusDisplayName"),
                "BUSINESS: binding status presentation is owned by the frontend dictionary");
        UUID ownerChannelRef =
                UUID.fromString(ownerChannel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response ownerBinding = createBinding(
                context,
                owner,
                ownerChannelRef,
                "MEITUAN_ISV_B",
                "TAKEAWAY",
                "STORE",
                owner.fixture().storeId(),
                "M1 protected binding",
                "M1 protected external owner");
        UUID ownerBindingRef =
                UUID.fromString(ownerBinding.json().path("bindingRef").asText());
        assertEquals(
                "PENDING_AUTHORIZATION",
                ownerBinding.json().path("status").asText(),
                "BUSINESS: protected owner binding is a real external collaboration fact");

        UUID forgedProjectRef = UUID.randomUUID();
        String root = "/api/operations/group-workspaces/" + attacker.fixture().groupWorkspaceKey();
        assertScopeDenied(
                context.get(
                        TEMPLATE_LIST,
                        root + "/business-channel-templates?projectRef=" + forgedProjectRef + "&pageSize=20",
                        attacker.session().cookie(),
                        Set.of(403)),
                ownerTemplate.json().path("templateRef").asText(),
                "BUSINESS: template list rejects a forged project node");

        BackendAcceptanceTest.Response candidateMismatch = context.get(
                TEMPLATE_CANDIDATES,
                root + "/business-channel-template-candidates?projectRef=" + forgedProjectRef + "&storeRef="
                        + owner.fixture().storeId() + "&pageSize=20",
                attacker.session().cookie(),
                Set.of(403));
        assertScopeDenied(
                candidateMismatch,
                ownerTemplate.json().path("templateRef").asText(),
                "BUSINESS: forged project and foreign store candidate request does not return owner facts");

        assertScopeDenied(
                context.get(
                        TEMPLATE_CANDIDATES,
                        root + "/business-channel-template-candidates?projectRef="
                                + owner.fixture().projectId() + "&storeRef="
                                + owner.fixture().storeId() + "&pageSize=20",
                        attacker.session().cookie(),
                        Set.of(403)),
                ownerTemplate.json().path("templateRef").asText(),
                "BUSINESS: same-project foreign-store candidate read rejects the selected-store mismatch");

        assertScopeDenied(
                context.get(
                        CHANNEL_LIST_PROJECT,
                        root + "/projects/" + forgedProjectRef + "/business-channels?pageSize=20",
                        attacker.session().cookie(),
                        Set.of(403)),
                ownerChannelRef.toString(),
                "BUSINESS: project channel list rejects a forged project node");
        assertScopeDenied(
                context.get(
                        CHANNEL_LIST_STORE,
                        root + "/stores/" + owner.fixture().storeId() + "/business-channels?pageSize=20",
                        attacker.session().cookie(),
                        Set.of(403)),
                ownerChannelRef.toString(),
                "BUSINESS: store channel list rejects a forged store node");
        assertScopeDenied(
                context.get(
                        CHANNEL_DETAIL,
                        channelPath(attacker.fixture(), ownerChannelRef),
                        attacker.session().cookie(),
                        Set.of(403)),
                ownerChannelRef.toString(),
                "BUSINESS: channel detail reads the real owner before rejecting a foreign store channel");
        assertScopeDenied(
                context.get(
                        OWNER_BINDING_DETAIL,
                        channelPath(attacker.fixture(), ownerChannelRef) + "/owner-binding",
                        attacker.session().cookie(),
                        Set.of(403)),
                ownerBindingRef.toString(),
                "BUSINESS: binding detail rejects before exposing the foreign binding");
    }

    @AcceptanceScenario(
            id = "business-channel.same-store-two-owner-ids",
            module = "BUSINESS_CHANNEL",
            operation = "sameStoreTwoOwnerIds")
    void sameStoreTwoOwnerIds(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture fixture =
                selectStore(context, operationsFixture(context, "STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT")));
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(fixture.fixture(), Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        enableProvider(context, fixture.fixture(), "MEITUAN_ISV_A");
        enableProvider(context, fixture.fixture(), "MEITUAN_ISV_B");
        enableProvider(context, fixture.fixture(), "ELEME_OPEN");

        BackendAcceptanceTest.Response meituanA = createExternalStoreBinding(
                context, projectOwner, fixture, "MEITUAN_ISV_A", "TAKEAWAY", "MEITUAN-OWNER-A", "Meituan takeaway");
        BackendAcceptanceTest.Response meituanB = createExternalStoreBinding(
                context, projectOwner, fixture, "MEITUAN_ISV_B", "GROUP_BUY", "MEITUAN-OWNER-B", "Meituan group buy");
        BackendAcceptanceTest.Response elemeA = createExternalStoreBinding(
                context, projectOwner, fixture, "ELEME_OPEN", "TAKEAWAY", "ELEME-OWNER-SAME", "Eleme takeaway");
        BackendAcceptanceTest.Response elemeB = createExternalStoreBinding(
                context, projectOwner, fixture, "ELEME_OPEN", "GROUP_BUY", "ELEME-OWNER-SAME", "Eleme group buy");

        assertEquals(
                4,
                Set.of(
                                meituanA.json().path("bindingRef").asText(),
                                meituanB.json().path("bindingRef").asText(),
                                elemeA.json().path("bindingRef").asText(),
                                elemeB.json().path("bindingRef").asText())
                        .size(),
                "BUSINESS: four channel owner rows remain distinct despite repeated external owner ids");
        assertEquals(
                "PENDING_AUTHORIZATION",
                meituanA.json().path("status").asText(),
                "BUSINESS: Meituan grant remains callback-controlled");
        assertEquals(
                "PENDING_AUTHORIZATION",
                meituanB.json().path("status").asText(),
                "BUSINESS: second Meituan grant remains callback-controlled");
        assertEquals(
                "PENDING_AUTHORIZATION",
                elemeA.json().path("status").asText(),
                "BUSINESS: Eleme grant remains callback-controlled");
        assertEquals(
                "PENDING_AUTHORIZATION",
                elemeB.json().path("status").asText(),
                "BUSINESS: same Eleme owner id is not a global uniqueness key");

        BackendAcceptanceTest.Response readbackTemplate = createTemplate(
                context,
                projectOwner,
                "Owner binding readback template",
                "EXTERNAL",
                "STORE",
                "TAKEAWAY",
                "ELEME_OPEN",
                null);
        BackendAcceptanceTest.Response readbackChannel = createChannel(
                context,
                fixture,
                readbackTemplate.json().path("templateRef").asText(),
                "STORE",
                fixture.fixture().storeId(),
                "Owner binding readback channel");
        UUID readbackChannelRef =
                UUID.fromString(readbackChannel.json().path("channelRef").asText());
        BackendAcceptanceTest.Response readbackBinding = createBinding(
                context,
                fixture,
                readbackChannelRef,
                "ELEME_OPEN",
                "TAKEAWAY",
                "STORE",
                fixture.fixture().storeId(),
                "Owner binding readback",
                "MEITUAN-OWNER-READBACK");
        ArrayNode expectedNodePath = path(
                pathNode(fixture.fixture().regionId(), "acceptance-region", "Acceptance Region", "REGION"),
                pathNode(fixture.fixture().projectId(), "acceptance-project", "Acceptance Project", "PROJECT"),
                pathNode(fixture.fixture().storeId(), "acceptance-store", "Acceptance Store", "STORE"));
        ArrayNode expectedBusinessScope = arrayText("TAKEAWAY", "GROUP_BUY");
        oracleEquals(
                readbackBinding.json(),
                "createOperationsOwnerBinding",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: operations external binding create returns the exact ordered store path");
        oracleEquals(
                readbackBinding.json(),
                "createOperationsOwnerBinding",
                "/status",
                text("PENDING_AUTHORIZATION"),
                JsonNodeType.STRING,
                "BUSINESS: operations external binding create preserves callback-controlled status");
        oracleEquals(
                readbackBinding.json(),
                "createOperationsOwnerBinding",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: operations external binding create returns provider scope");
        oracleEquals(
                readbackBinding.json(),
                "createOperationsOwnerBinding",
                "/capabilityClass",
                text("TAKEAWAY"),
                JsonNodeType.STRING,
                "BUSINESS: operations external binding create returns its capability class");

        BackendAcceptanceTest.Response readback = context.get(
                OWNER_BINDING_DETAIL,
                channelPath(fixture.fixture(), readbackChannelRef) + "/owner-binding",
                fixture.session().cookie(),
                Set.of(200));
        oracleEquals(
                readback.json(),
                "getOperationsOwnerBindingDetail",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: operations binding detail returns the exact ordered store path");
        oracleEquals(
                readback.json(),
                "getOperationsOwnerBindingDetail",
                "/status",
                text("PENDING_AUTHORIZATION"),
                JsonNodeType.STRING,
                "BUSINESS: operations binding detail preserves callback-controlled status");
        oracleEquals(
                readback.json(),
                "getOperationsOwnerBindingDetail",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: operations binding detail returns provider scope");
        oracleEquals(
                readback.json(),
                "getOperationsOwnerBindingDetail",
                "/capabilityClass",
                text("TAKEAWAY"),
                JsonNodeType.STRING,
                "BUSINESS: operations binding detail returns its capability class");

        BackendAcceptanceTest.Response deleted = context.delete(
                OWNER_BINDING_DELETE,
                channelPath(fixture.fixture(), readbackChannelRef) + "/owner-binding",
                fixture.session().cookie(),
                Map.of("expectedVersion", readback.json().path("version").asLong()),
                Set.of(200));
        oracleEquals(
                deleted.json(),
                "deleteOperationsOwnerBinding",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: operations binding delete preserves the exact ordered store path");
        oracleEquals(
                deleted.json(),
                "deleteOperationsOwnerBinding",
                "/status",
                text("DELETED"),
                JsonNodeType.STRING,
                "BUSINESS: operations binding delete returns terminal status");
        oracleEquals(
                deleted.json(),
                "deleteOperationsOwnerBinding",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: operations binding delete preserves provider scope");
    }

    private BackendAcceptanceTest.Response createExternalStoreBinding(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture projectOwner,
            OperationsFixture fixture,
            String providerCode,
            String orderKind,
            String externalOwnerId,
            String name)
            throws Exception {
        BackendAcceptanceTest.Response template = createTemplate(
                context, projectOwner, name + " template", "EXTERNAL", "STORE", orderKind, providerCode, null);
        BackendAcceptanceTest.Response channel = createChannel(
                context,
                fixture,
                template.json().path("templateRef").asText(),
                "STORE",
                fixture.fixture().storeId(),
                name + " channel");
        return createBinding(
                context,
                fixture,
                UUID.fromString(channel.json().path("channelRef").asText()),
                providerCode,
                orderKind,
                "STORE",
                fixture.fixture().storeId(),
                name + " binding",
                externalOwnerId);
    }

    private void enableProvider(
            BackendAcceptanceTest.ScenarioContext context, BackendAcceptanceTest.Fixture fixture, String providerCode)
            throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String path =
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/provider-profiles/" + providerCode;
        BackendAcceptanceTest.Response current = context.get(PROVIDER_DETAIL, path, platform.cookie(), Set.of(200));
        if ("ENABLED".equals(current.json().path("enablementStatus").asText())) return;
        BackendAcceptanceTest.Response enabled = context.post(
                PROVIDER_STATUS,
                path + "/status",
                platform.cookie(),
                Map.of(
                        "status",
                        "ENABLED",
                        "expectedVersion",
                        current.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals("ENABLED", enabled.json().path("enablementStatus").asText(), "BUSINESS: provider is enabled");
    }

    private OperationsFixture selectStore(BackendAcceptanceTest.ScenarioContext context, OperationsFixture fixture)
            throws Exception {
        String root = "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey();
        BackendAcceptanceTest.Response selected = context.post(
                OPERATIONS_WORKSPACE_SESSION_DATA_NODE,
                root + "/session/data-node",
                fixture.session().cookie(),
                Map.of(
                        "dataNodeRef", fixture.fixture().storeId(),
                        "dataNodeType", "STORE",
                        "requiredContextVersion", fixture.session().contextVersion()),
                headers(),
                Set.of(200));
        assertEquals(
                fixture.fixture().storeId().toString(),
                selected.json()
                        .path("scopeContext")
                        .path("store")
                        .path("dataNodeRef")
                        .asText(),
                "BUSINESS: acceptance session selects the claimed store node");
        return new OperationsFixture(
                fixture.fixture(),
                new BackendAcceptanceTest.Session(
                        fixture.session().cookie(),
                        selected.json(),
                        selected.json().path("contextVersion").asLong()));
    }

    private BackendAcceptanceTest.Response createBinding(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            UUID channelRef,
            String providerCode,
            String capabilityClass,
            String nodeType,
            UUID nodeRef,
            String bindingDisplayName,
            String externalOwnerId)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("providerCode", providerCode);
        body.put("capabilityClass", capabilityClass);
        body.put("nodeType", nodeType);
        body.put("nodeRef", nodeRef.toString());
        body.put("bindingDisplayName", bindingDisplayName);
        body.put("externalOwnerId", externalOwnerId);
        return context.post(
                OWNER_BINDING_CREATE,
                channelPath(fixture.fixture(), channelRef) + "/owner-binding",
                fixture.session().cookie(),
                body,
                headers(),
                Set.of(200));
    }

    private static void assertScopeDenied(
            BackendAcceptanceTest.Response response, String forbiddenIdentity, String message) {
        assertEquals("PLATFORM_COMMON_ACCESS_DENIED", response.problemCode(), message + " [typed reason]");
        JsonNode publicProblem = response.json().deepCopy();
        if (publicProblem.isObject()) ((ObjectNode) publicProblem).remove("instance");
        assertFalse(publicProblem.toString().contains(forbiddenIdentity), message + " [no forbidden identity leakage]");
    }

    private OperationsFixture operationsFixture(
            BackendAcceptanceTest.ScenarioContext context, String targetType, Set<String> capabilities)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture(targetType, capabilities);
        host.completeInvitation(context, fixture);
        return new OperationsFixture(fixture, host.login(context, fixture));
    }

    private BackendAcceptanceTest.Response createTemplate(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            String name,
            String accessKind,
            String operatorKind,
            String orderKind,
            String providerCode,
            String dineInForm)
            throws Exception {
        return createTemplateWithCode(
                context,
                fixture,
                name,
                accessKind,
                operatorKind,
                orderKind,
                providerCode,
                dineInForm,
                "TPL-" + UUID.randomUUID());
    }

    private BackendAcceptanceTest.Response createTemplateWithCode(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            String name,
            String accessKind,
            String operatorKind,
            String orderKind,
            String providerCode,
            String dineInForm,
            String templateCode)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("projectRef", fixture.fixture().projectId().toString());
        body.put("templateName", name);
        body.put("templateCode", templateCode);
        body.put("accessKind", accessKind);
        body.put("operatorKind", operatorKind);
        body.put("orderKind", orderKind);
        body.put("dineInForm", dineInForm);
        body.put("providerCode", providerCode);
        return context.post(
                TEMPLATE_CREATE,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/business-channel-templates",
                fixture.session().cookie(),
                body,
                headers(),
                Set.of(200));
    }

    private BackendAcceptanceTest.Response createChannel(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            String templateRef,
            String ownerNodeType,
            UUID ownerNodeRef,
            String channelName)
            throws Exception {
        return createChannelWithCode(
                context, fixture, templateRef, ownerNodeType, ownerNodeRef, channelName, "CH-" + UUID.randomUUID());
    }

    private BackendAcceptanceTest.Response createChannelWithCode(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            String templateRef,
            String ownerNodeType,
            UUID ownerNodeRef,
            String channelName,
            String channelCode)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("templateRef", templateRef);
        body.put("ownerNodeType", ownerNodeType);
        body.put("ownerNodeRef", ownerNodeRef.toString());
        body.put("channelCode", channelCode);
        body.put("channelName", channelName);
        body.put("bindingRef", null);
        return context.post(
                CHANNEL_CREATE,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/business-channels",
                fixture.session().cookie(),
                body,
                headers(),
                Set.of(200));
    }

    private static String templatePath(BackendAcceptanceTest.Fixture fixture, UUID templateRef) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channel-templates/"
                + templateRef;
    }

    private static String channelPath(BackendAcceptanceTest.Fixture fixture, UUID channelRef) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channels/" + channelRef;
    }

    private static Map<String, String> headers() {
        return Map.of("Idempotency-Key", "acceptance-" + UUID.randomUUID());
    }

    private static JsonNode find(JsonNode values, String field, String expected) {
        for (JsonNode value : values) if (expected.equals(value.path(field).asText())) return value;
        fail("BUSINESS: missing " + field + "=" + expected);
        return null;
    }

    private static String dimensionStatus(JsonNode values, String type, UUID ref) {
        for (JsonNode value : values) {
            if (type.equals(value.path("type").asText())
                    && ref.toString().equals(value.path("ref").asText())) {
                return value.path("status").asText();
            }
        }
        fail("BUSINESS: missing status dimension " + type + "=" + ref);
        return null;
    }

    private static ArrayNode dimensions(ObjectNode... values) {
        ArrayNode result = JsonNodeFactory.instance.arrayNode();
        for (ObjectNode value : values) result.add(value);
        return result;
    }

    private static ArrayNode path(ObjectNode... values) {
        ArrayNode result = JsonNodeFactory.instance.arrayNode();
        for (ObjectNode value : values) result.add(value);
        return result;
    }

    private static ArrayNode arrayText(String... values) {
        ArrayNode result = JsonNodeFactory.instance.arrayNode();
        for (String value : values) result.add(value);
        return result;
    }

    private static JsonNode text(String value) {
        return JsonNodeFactory.instance.textNode(value);
    }

    private static ObjectNode pathNode(UUID ref, String code, String name, String nodeType) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        result.put("ref", ref.toString());
        result.put("code", code);
        result.put("name", name);
        result.put("nodeType", nodeType);
        return result;
    }

    private static ObjectNode dimension(String type, String ref, String status) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        result.put("type", type);
        result.put("ref", ref);
        result.put("status", status);
        return result;
    }

    private static void assertChannelFacts(
            JsonNode json,
            String operationId,
            String expectedStatus,
            ArrayNode expectedDimensions,
            ArrayNode expectedBlockers,
            String message) {
        JsonNode status = oracle(json, operationId, "/status", message);
        JsonNode selfStatus = oracle(json, operationId, "/selfStatus", message);
        JsonNode statusDimensions = oracle(json, operationId, "/statusDimensions", message);
        JsonNode blockers = oracle(json, operationId, "/blockers", message);
        assertEquals(JsonNodeType.STRING, status.getNodeType(), message + ": status type");
        assertEquals(JsonNodeType.STRING, selfStatus.getNodeType(), message + ": selfStatus type");
        assertEquals(JsonNodeType.ARRAY, statusDimensions.getNodeType(), message + ": statusDimensions type");
        assertEquals(JsonNodeType.ARRAY, blockers.getNodeType(), message + ": blockers type");
        assertEquals(expectedStatus, status.asText(), message + ": status");
        assertEquals(expectedStatus, selfStatus.asText(), message + ": selfStatus");
        assertEquals(expectedDimensions, statusDimensions, message + ": ordered status dimensions");
        assertEquals(expectedBlockers, blockers, message + ": ordered blockers");
    }

    private static void assertChannelPageFacts(
            JsonNode json,
            String operationId,
            String expectedStatus,
            ArrayNode expectedDimensions,
            ArrayNode expectedBlockers,
            String message) {
        JsonNode status = json.at("/items/0/status");
        JsonNode selfStatus = json.at("/items/0/selfStatus");
        JsonNode statusDimensions = json.at("/items/0/statusDimensions");
        JsonNode blockers = json.at("/items/0/blockers");
        assertEquals(JsonNodeType.STRING, status.getNodeType(), operationId + ": page status type");
        assertEquals(JsonNodeType.STRING, selfStatus.getNodeType(), operationId + ": page selfStatus type");
        assertEquals(JsonNodeType.ARRAY, statusDimensions.getNodeType(), operationId + ": page dimensions type");
        assertEquals(JsonNodeType.ARRAY, blockers.getNodeType(), operationId + ": page blockers type");
        assertEquals(expectedStatus, status.asText(), message + ": status");
        assertEquals(expectedStatus, selfStatus.asText(), message + ": selfStatus");
        assertEquals(expectedDimensions, statusDimensions, message + ": ordered status dimensions");
        assertEquals(expectedBlockers, blockers, message + ": ordered blockers");
    }

    private static JsonNode oracle(JsonNode json, String operationId, String pointer, String message) {
        JsonNode value = json.at(pointer);
        assertFalse(value.isMissingNode(), message + ": missing pointer " + pointer);
        assertFalse(value.isNull(), message + ": null pointer " + pointer);
        return value;
    }

    private static void oracleEquals(
            JsonNode json,
            String operationId,
            String pointer,
            JsonNode expected,
            JsonNodeType expectedType,
            String message) {
        JsonNode actual = requiredJsonNode(json, pointer, expectedType, message + ": operation=" + operationId);
        assertEquals(expected, actual, message + ": exact value");
    }

    private static ArrayNode storeChannelDimensions(
            BackendAcceptanceTest.Fixture fixture, UUID templateRef, String templateStatus) {
        return dimensions(
                dimension("GROUP_WORKSPACE", fixture.groupWorkspaceKey(), "ENABLED"),
                dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), templateStatus),
                dimension("ORGANIZATION_PROJECT", fixture.projectId().toString(), "ENABLED"),
                dimension("ORGANIZATION_REGION", fixture.regionId().toString(), "ENABLED"),
                dimension("ORGANIZATION_STORE", fixture.storeId().toString(), "ENABLED"),
                dimension("ORGANIZATION_TENANT", fixture.tenantId().toString(), "ENABLED"),
                dimension("ORGANIZATION_BRAND", fixture.brandId().toString(), "ENABLED"));
    }

    private static ArrayNode projectChannelDimensions(
            BackendAcceptanceTest.Fixture fixture, UUID templateRef, String templateStatus) {
        return dimensions(
                dimension("GROUP_WORKSPACE", fixture.groupWorkspaceKey(), "ENABLED"),
                dimension("BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), templateStatus),
                dimension("ORGANIZATION_PROJECT", fixture.projectId().toString(), "ENABLED"),
                dimension("ORGANIZATION_REGION", fixture.regionId().toString(), "ENABLED"));
    }

    private record OperationsFixture(BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session) {}
}
