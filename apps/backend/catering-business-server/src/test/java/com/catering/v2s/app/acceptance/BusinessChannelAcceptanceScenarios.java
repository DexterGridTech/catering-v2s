package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
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
                "EFFECTIVE",
                channel.json().path("status").asText(),
                "BUSINESS: an internal channel is effective immediately without an external binding");
        assertEquals(
                "NOT_REQUIRED",
                channel.json().path("bindingStatus").asText(),
                "BUSINESS: an internal channel has no binding requirement");
        assertEquals(
                "—",
                channel.json().path("bindingStatusDisplayName").asText(),
                "BUSINESS: an internal channel does not present an unbound state");

        BackendAcceptanceTest.Response projectChannels = context.get(
                CHANNEL_LIST_PROJECT,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/projects/"
                        + fixture.fixture().projectId() + "/business-channels",
                fixture.session().cookie(),
                Set.of(200));
        JsonNode internalListRow = find(
                projectChannels.json().path("items"),
                "channelRef",
                channel.json().path("channelRef").asText());
        assertEquals(
                "NOT_REQUIRED",
                internalListRow.path("bindingStatus").asText(),
                "BUSINESS: project channel list preserves the owner binding semantic");

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

        UUID templateRef = UUID.fromString(template.json().path("templateRef").asText());
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
                        "illegal disabled edit",
                        "expectedVersion",
                        stoppedTemplate.json().path("version").asLong()),
                headers(),
                Set.of(409));
        assertEquals(
                "DISABLED_OBJECT_NOT_EDITABLE",
                disabledEdit.problemCode(),
                "BUSINESS: disabled template cannot be saved");
        BackendAcceptanceTest.Response readback = context.get(
                CHANNEL_DETAIL,
                channelPath(fixture.fixture(), channelRef),
                fixture.session().cookie(),
                Set.of(200));
        assertTrue(
                readback.json().path("stopReasons").toString().contains("CASCADE_TEMPLATE"),
                "BUSINESS: template stop cascades to channel stop reasons");
        assertEquals(
                "DISABLED",
                readback.json().path("status").asText(),
                "BUSINESS: cascaded channel is not reported effective");
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
        assertTrue(
                manual.json().path("stopReasons").toString().contains("MANUAL"),
                "BUSINESS: manual stop is an independent reason");
        UUID templateRef = UUID.fromString(template.json().path("templateRef").asText());
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
        assertTrue(
                afterOneSource.json().path("stopReasons").toString().contains("MANUAL"),
                "BUSINESS: restoring template does not clear manual stop");
        assertNotEquals(
                "EFFECTIVE",
                afterOneSource.json().path("status").asText(),
                "BUSINESS: one remaining stop reason keeps channel non-effective");
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
                "EFFECTIVE",
                channel.json().path("status").asText(),
                "BUSINESS: an internal store channel is effective immediately");
        UUID storeTemplateRef =
                UUID.fromString(storeTemplate.json().path("templateRef").asText());
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
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
        assertEquals(
                "DISABLED",
                cascadedChannel.json().path("status").asText(),
                "BUSINESS: an existing store channel is disabled with its template");
        assertTrue(
                cascadedChannel.json().path("stopReasons").toString().contains("CASCADE_TEMPLATE"),
                "BUSINESS: store channel records the template cascade reason");
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
                "EFFECTIVE",
                channel.json().path("status").asText(),
                "BUSINESS: store status does not block an internal channel from taking effect");
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
        assertEquals(
                "未绑定",
                ownerChannel.json().path("bindingStatusDisplayName").asText(),
                "BUSINESS: external channel binding display remains distinct from internal no-binding");
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
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("projectRef", fixture.fixture().projectId().toString());
        body.put("templateName", name);
        body.put("templateCode", "TPL-" + UUID.randomUUID());
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
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("templateRef", templateRef);
        body.put("ownerNodeType", ownerNodeType);
        body.put("ownerNodeRef", ownerNodeRef.toString());
        body.put("channelCode", "CH-" + UUID.randomUUID());
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

    private record OperationsFixture(BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session) {}
}
