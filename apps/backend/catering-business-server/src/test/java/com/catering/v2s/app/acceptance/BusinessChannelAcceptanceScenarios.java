package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.List;
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
    private static final RouteIdentity TEMPLATE_VISIBLE_STORES = new RouteIdentity(
            "getOperationsBusinessChannelTemplateVisibleStores",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates/"
                    + "{templateRef}/visible-stores");
    private static final RouteIdentity STORE_PROFILE = new RouteIdentity(
            "getOperationsStoreProfile", "/api/operations/group-workspaces/{groupWorkspaceKey}/store/profile");
    private static final RouteIdentity CHANNEL_LIST_PROJECT = new RouteIdentity(
            "getOperationsProjectBusinessChannels",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/business-channels");
    static final RouteIdentity CHANNEL_LIST_STORE = new RouteIdentity(
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
    private static final String STORE_OWNED_DINE_IN_PROVIDER = "STORE_OWNED_MINI_PROGRAM_DINE_IN";

    private final BackendAcceptanceTest host;

    private record CreatedTemplate(UUID templateRef, long version, JsonNode json) {}

    private record CreatedChannel(UUID channelRef, long version, JsonNode json) {}

    private record CreatedBinding(UUID bindingRef, long version, JsonNode json) {}

    private record CreatedExternalStoreBinding(CreatedChannel channel, CreatedBinding binding) {}

    private record StoreProjectFixture(OperationsFixture projectOwner, OperationsFixture storeOwner) {}

    private record StoreVisibilityFixture(
            OperationsFixture projectOwner, OperationsFixture storeA, OperationsFixture storeB) {}

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
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(fixture, Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOperations =
                new OperationsFixture(projectFixture, host.login(context, projectFixture));
        String name = "Calibration external binding";
        CreatedTemplate template = createTemplate(
                context, projectOperations, name + " template", "EXTERNAL", "STORE", "GROUP_BUY", providerCode, null);
        CreatedChannel channel = createChannel(
                context,
                operations,
                template.json().path("templateRef").asText(),
                "STORE",
                fixture.storeId(),
                name + " channel");
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        CreatedBinding binding = createBinding(
                context,
                operations,
                channelRef,
                providerCode,
                "GROUP_BUY",
                "STORE",
                fixture.storeId(),
                name + " binding",
                "calibration-owner-" + UUID.randomUUID());
        assertFalse(
                binding.json().path("bindingRef").asText().isBlank(),
                "BUSINESS: calibration external channel has a real owner binding");
        return channel.json();
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
        CreatedTemplate template = createTemplate(
                context,
                projectOperations,
                "Calibration binding delete template",
                "EXTERNAL",
                "STORE",
                "GROUP_BUY",
                providerCode,
                null);
        CreatedChannel channel = createChannel(
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
                        + "/business-channels?usage=SALES_MENU&pageSize=20",
                session.cookie(),
                Set.of(200));
        boolean listedInSalesMenu = false;
        for (JsonNode row : storeChannels.json().path("items")) {
            if (channelRef.toString().equals(row.path("channelRef").asText())) {
                listedInSalesMenu = true;
                break;
            }
        }
        assertFalse(listedInSalesMenu, "BUSINESS: sales-menu channel task excludes the external group-buy channel");
        CreatedBinding binding = createBinding(
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
        CreatedTemplate template = createTemplate(
                context,
                projectOwner,
                "Performance calibration template",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null);
        UUID templateRef = UUID.fromString(template.json().path("templateRef").asText());
        Map<String, Object> templateUpdateBody = new LinkedHashMap<>();
        templateUpdateBody.put("templateName", "Performance calibration template updated");
        templateUpdateBody.put(
                "expectedVersion", template.json().path("version").asLong());
        templateUpdateBody.put("storeVisibilityScope", null);
        templateUpdateBody.put("visibleStoreRefs", List.of());
        BackendAcceptanceTest.Response updatedTemplate = context.patch(
                TEMPLATE_UPDATE,
                templatePath(projectOwner.fixture(), templateRef),
                projectOwner.session().cookie(),
                templateUpdateBody,
                headers(),
                Set.of(200));
        assertEquals(
                "Performance calibration template updated",
                updatedTemplate.json().path("templateName").asText(),
                "BUSINESS: normal calibration saves the internal template name");

        CreatedChannel channel = createChannel(
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
        CreatedTemplate template =
                createTemplate(context, fixture, "Internal takeaway", "INTERNAL", "PROJECT", "TAKEAWAY", null, null);
        CreatedChannel channel = createChannel(
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
        duplicateTemplateBody.put("storeVisibilityScope", null);
        duplicateTemplateBody.put("visibleStoreRefs", List.of());
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
        Map<String, Object> disabledEditBody = new LinkedHashMap<>();
        disabledEditBody.put("templateName", "disabled template edited");
        disabledEditBody.put(
                "expectedVersion", stoppedTemplate.json().path("version").asLong());
        disabledEditBody.put("storeVisibilityScope", null);
        disabledEditBody.put("visibleStoreRefs", List.of());
        BackendAcceptanceTest.Response disabledEdit = context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixture.fixture(), templateRef),
                fixture.session().cookie(),
                disabledEditBody,
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
        CreatedTemplate voidedTemplate = createTemplateWithCode(
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
        CreatedTemplate replacementTemplate = createTemplateWithCode(
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
        CreatedChannel voidedChannel = createChannelWithCode(
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
        CreatedChannel replacementChannel = createChannelWithCode(
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
        CreatedTemplate template = createTemplate(
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
        CreatedTemplate template =
                createTemplate(context, fixture, "Manual stop test", "INTERNAL", "PROJECT", "TAKEAWAY", null, null);
        CreatedChannel channel = createChannel(
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
        CreatedTemplate projectTemplate = createTemplate(
                context, projectOwner, "Project template", "INTERNAL", "PROJECT", "TAKEAWAY", null, null);
        CreatedTemplate storeTemplate =
                createTemplate(context, projectOwner, "Store template", "INTERNAL", "STORE", "TAKEAWAY", null, null);
        CreatedTemplate disabledStoreTemplate = createTemplate(
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
        BackendAcceptanceTest.Response storeTemplates = context.get(
                TEMPLATE_LIST,
                "/api/operations/group-workspaces/" + storeViewer.fixture().groupWorkspaceKey()
                        + "/business-channel-templates?pageSize=20",
                storeViewer.session().cookie(),
                Set.of(200));
        JsonNode storeTemplateItems = requiredJsonNode(
                storeTemplates.json(),
                "/items",
                JsonNodeType.ARRAY,
                "BUSINESS: store assignment can read its owner-scoped template metadata");
        assertNotNull(
                find(
                        storeTemplateItems,
                        "templateRef",
                        storeTemplate.json().path("templateRef").asText()),
                "BUSINESS: store assignment reads the STORE template used by its channel selector");
        assertNotNull(
                find(
                        storeTemplateItems,
                        "templateRef",
                        disabledStoreTemplate.json().path("templateRef").asText()),
                "BUSINESS: store assignment retains disabled STORE template metadata for status display");
        assertFalse(
                storeTemplateItems
                        .toString()
                        .contains(projectTemplate.json().path("templateRef").asText()),
                "BUSINESS: store assignment does not read PROJECT template metadata");
        storeTemplateItems.forEach(row -> assertEquals(
                "STORE",
                row.path("operatorKind").asText(),
                "BUSINESS: store assignment template metadata remains STORE-owned"));
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
        CreatedChannel channel = createChannel(
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
                        + storeViewer.fixture().storeId() + "/business-channels?usage=SALES_MENU&pageSize=20",
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
            id = "business-channel.store-visibility-all-candidates",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityAllCandidates")
    void storeVisibilityAllCandidates(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        CreatedTemplate projectTemplate = createTemplate(
                context,
                fixtures.projectOwner(),
                "All visibility project template",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null);
        CreatedTemplate allTemplate = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "All visibility store template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-ALL-" + UUID.randomUUID(),
                "ALL_PROJECT_STORES",
                List.of());
        CreatedTemplate disabledTemplate = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Disabled visibility store template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-DISABLED-" + UUID.randomUUID(),
                "ALL_PROJECT_STORES",
                List.of());
        transitionTemplateStatus(context, fixtures.projectOwner(), disabledTemplate, "DISABLED");
        CreatedTemplate voidedTemplate = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Voided visibility store template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-VOIDED-" + UUID.randomUUID(),
                "ALL_PROJECT_STORES",
                List.of());
        transitionTemplateStatus(context, fixtures.projectOwner(), voidedTemplate, "VOIDED");

        BackendAcceptanceTest.Response first = readStoreTemplateCandidates(context, fixtures.storeA());
        BackendAcceptanceTest.Response second = readStoreTemplateCandidates(context, fixtures.storeB());
        assertCandidateOnly(
                first,
                allTemplate.templateRef(),
                "BUSINESS: ALL scope exposes the enabled store template to store A only",
                projectTemplate.templateRef(),
                disabledTemplate.templateRef(),
                voidedTemplate.templateRef());
        assertCandidateOnly(
                second,
                allTemplate.templateRef(),
                "BUSINESS: ALL scope dynamically exposes the same template to store B",
                projectTemplate.templateRef(),
                disabledTemplate.templateRef(),
                voidedTemplate.templateRef());
        JsonNode row = templateRow(context, fixtures.projectOwner(), allTemplate.templateRef());
        assertEquals("ALL_PROJECT_STORES", row.path("storeVisibilityScope").asText());
        assertEquals(0, row.path("visibleStoreCount").asLong(), "BUSINESS: ALL has no selected relation count");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-selected-candidates",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilitySelectedCandidates")
    void storeVisibilitySelectedCandidates(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Selected visibility store template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-SELECTED-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(fixtures.storeA().fixture().storeId()));
        BackendAcceptanceTest.Response storeA = readStoreTemplateCandidates(context, fixtures.storeA());
        BackendAcceptanceTest.Response storeB = readStoreTemplateCandidates(context, fixtures.storeB());
        assertEquals(
                selected.templateRef().toString(),
                storeA.json().path("items").get(0).path("templateRef").asText(),
                "BUSINESS: selected scope exposes the template to the selected store");
        assertFalse(
                storeB.json().toString().contains(selected.templateRef().toString()),
                "BUSINESS: selected scope does not expose the template to an unselected store");
        JsonNode row = templateRow(context, fixtures.projectOwner(), selected.templateRef());
        assertEquals("SELECTED_PROJECT_STORES", row.path("storeVisibilityScope").asText());
        assertEquals(
                1, row.path("visibleStoreCount").asLong(), "BUSINESS: selected scope count uses visible relations");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-create-update",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityCreateUpdate")
    void storeVisibilityCreateUpdate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        UUID storeA = fixtures.storeA().fixture().storeId();
        UUID storeB = fixtures.storeB().fixture().storeId();
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Create update visibility store template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-CREATE-UPDATE-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        long version = selected.version();
        BackendAcceptanceTest.Response added = updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Create update visibility store template with B",
                version,
                "SELECTED_PROJECT_STORES",
                List.of(storeA, storeB));
        assertEquals(version + 1, added.json().path("version").asLong());
        assertEquals(2, added.json().path("visibleStoreCount").asLong());
        assertEquals(
                2,
                readVisibleStores(context, fixtures.projectOwner(), selected.templateRef(), "ALL", 20, null)
                        .json()
                        .path("total")
                        .asLong(),
                "BUSINESS: whole replacement adds the final selected set");

        BackendAcceptanceTest.Response removed = updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Create update visibility store template with B only",
                added.json().path("version").asLong(),
                "SELECTED_PROJECT_STORES",
                List.of(storeB));
        assertEquals(1, removed.json().path("visibleStoreCount").asLong());
        assertFalse(
                readStoreTemplateCandidates(context, fixtures.storeA())
                        .json()
                        .toString()
                        .contains(selected.templateRef().toString()),
                "BUSINESS: removed store leaves the candidate set");
        assertTrue(
                readStoreTemplateCandidates(context, fixtures.storeB())
                        .json()
                        .toString()
                        .contains(selected.templateRef().toString()),
                "BUSINESS: retained store remains a candidate");

        BackendAcceptanceTest.Response all = updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Create update visibility store template for all",
                removed.json().path("version").asLong(),
                "ALL_PROJECT_STORES",
                List.of());
        assertEquals(
                "ALL_PROJECT_STORES", all.json().path("storeVisibilityScope").asText());
        assertEquals(0, all.json().path("visibleStoreCount").asLong());
        assertTrue(
                readStoreTemplateCandidates(context, fixtures.storeA())
                        .json()
                        .toString()
                        .contains(selected.templateRef().toString()),
                "BUSINESS: switching to ALL restores dynamic candidate access for store A");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-invalid-inputs",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityInvalidInputs")
    void storeVisibilityInvalidInputs(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        UUID projectRef = fixtures.projectOwner().fixture().projectId();
        UUID storeA = fixtures.storeA().fixture().storeId();

        Map<String, Object> projectScopeBody = templateBody(
                fixtures.projectOwner(),
                "Project template with store visibility",
                "PROJECT",
                "ALL_PROJECT_STORES",
                List.of());
        BackendAcceptanceTest.Response projectScope = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(fixtures.projectOwner().fixture()),
                fixtures.projectOwner().session().cookie(),
                projectScopeBody,
                headers(),
                Set.of(422));
        assertEquals(
                "BUSINESS_CHANNEL_STORE_VISIBILITY_NOT_APPLICABLE",
                projectScope.problemCode(),
                "BUSINESS: PROJECT templates reject store visibility fields");

        Map<String, Object> projectRefsBody = templateBody(
                fixtures.projectOwner(), "Project template with visible store refs", "PROJECT", null, List.of(storeA));
        BackendAcceptanceTest.Response projectRefs = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(fixtures.projectOwner().fixture()),
                fixtures.projectOwner().session().cookie(),
                projectRefsBody,
                headers(),
                Set.of(422));
        assertEquals(
                "BUSINESS_CHANNEL_STORE_VISIBILITY_NOT_APPLICABLE",
                projectRefs.problemCode(),
                "BUSINESS: PROJECT templates reject visible store refs even without a scope");

        Map<String, Object> duplicateBody = templateBody(
                fixtures.projectOwner(),
                "Duplicate selected store refs",
                "STORE",
                "SELECTED_PROJECT_STORES",
                List.of(storeA, storeA));
        BackendAcceptanceTest.Response duplicate = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(fixtures.projectOwner().fixture()),
                fixtures.projectOwner().session().cookie(),
                duplicateBody,
                headers(),
                Set.of(422));
        assertEquals(
                "BUSINESS_CHANNEL_STORE_VISIBILITY_DUPLICATE",
                duplicate.problemCode(),
                "BUSINESS: duplicate refs are rejected without silent de-duplication");

        UUID foreignStore = UUID.randomUUID();
        Map<String, Object> foreignStoreBody = templateBody(
                fixtures.projectOwner(),
                "Foreign selected store",
                "STORE",
                "SELECTED_PROJECT_STORES",
                List.of(foreignStore));
        BackendAcceptanceTest.Response foreignStoreResponse = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(fixtures.projectOwner().fixture()),
                fixtures.projectOwner().session().cookie(),
                foreignStoreBody,
                headers(),
                Set.of(403, 404, 422));
        assertTypedReject(
                foreignStoreResponse,
                foreignStore.toString(),
                "BUSINESS: foreign store ref is typed-rejected without identity leakage");

        UUID foreignProject = UUID.randomUUID();
        Map<String, Object> foreignProjectBody = templateBody(
                fixtures.projectOwner(),
                "Foreign project template",
                "STORE",
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        foreignProjectBody.put("projectRef", foreignProject.toString());
        BackendAcceptanceTest.Response foreignProjectResponse = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(fixtures.projectOwner().fixture()),
                fixtures.projectOwner().session().cookie(),
                foreignProjectBody,
                headers(),
                Set.of(403, 404, 422));
        assertTypedReject(
                foreignProjectResponse,
                foreignProject.toString(),
                "BUSINESS: foreign project ref is typed-rejected without identity leakage");

        CreatedTemplate empty = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Empty selected visibility store template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-EMPTY-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of());
        assertEquals(0, empty.json().path("visibleStoreCount").asLong());
        assertFalse(
                readStoreTemplateCandidates(context, fixtures.storeA())
                        .json()
                        .toString()
                        .contains(empty.templateRef().toString()),
                "BUSINESS: empty SELECTED is a valid saved scope with no candidates");
        JsonNode emptyRow = templateRow(context, fixtures.projectOwner(), empty.templateRef());
        assertEquals(0, emptyRow.path("visibleStoreCount").asLong());
        assertEquals(projectRef.toString(), emptyRow.path("projectRef").asText());
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-existing-channel-retained",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityExistingChannelRetained")
    void storeVisibilityExistingChannelRetained(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        UUID storeA = fixtures.storeA().fixture().storeId();
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Existing channel retention template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-RETAINED-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        CreatedChannel channel = createChannel(
                context,
                fixtures.storeA(),
                selected.templateRef().toString(),
                "STORE",
                storeA,
                "Existing retained channel");
        BackendAcceptanceTest.Response removed = updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Existing channel retention template after remove",
                selected.version(),
                "SELECTED_PROJECT_STORES",
                List.of());
        assertEquals(0, removed.json().path("visibleStoreCount").asLong());
        assertFalse(
                readStoreTemplateCandidates(context, fixtures.storeA())
                        .json()
                        .toString()
                        .contains(selected.templateRef().toString()),
                "BUSINESS: removed visibility is absent from new-channel candidates");
        BackendAcceptanceTest.Response storeChannels = context.get(
                CHANNEL_LIST_STORE,
                storeChannelPath(fixtures.storeA().fixture()),
                fixtures.storeA().session().cookie(),
                Set.of(200));
        JsonNode retained = find(
                storeChannels.json().path("items"),
                "channelRef",
                channel.channelRef().toString());
        assertEquals("ENABLED", retained.path("status").asText());
        BackendAcceptanceTest.Response detail = context.get(
                CHANNEL_DETAIL,
                channelPath(fixtures.storeA().fixture(), channel.channelRef()),
                fixtures.storeA().session().cookie(),
                Set.of(200));
        assertEquals("ENABLED", detail.json().path("status").asText());
        assertEquals(
                "ENABLED",
                dimensionStatus(
                        detail.json().path("statusDimensions"), "BUSINESS_CHANNEL_TEMPLATE", selected.templateRef()),
                "BUSINESS: template status remains an independent channel status dimension");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-stale-create-rejected",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityStaleCreateRejected")
    void storeVisibilityStaleCreateRejected(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        UUID storeA = fixtures.storeA().fixture().storeId();
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Stale candidate template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-STALE-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        assertTrue(
                readStoreTemplateCandidates(context, fixtures.storeA())
                        .json()
                        .toString()
                        .contains(selected.templateRef().toString()),
                "BUSINESS: candidate response contains the template before removal");
        updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Stale candidate template removed",
                selected.version(),
                "SELECTED_PROJECT_STORES",
                List.of());
        Map<String, Object> body = channelBody(
                fixtures.storeA(),
                selected.templateRef(),
                storeA,
                "Stale candidate channel",
                "CH-STALE-" + UUID.randomUUID());
        BackendAcceptanceTest.Response stale = context.post(
                CHANNEL_CREATE,
                businessChannelCollectionPath(fixtures.storeA().fixture()),
                fixtures.storeA().session().cookie(),
                body,
                headers(),
                Set.of(409));
        assertEquals(
                "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE",
                stale.problemCode(),
                "BUSINESS: stale store candidate is rejected at channel-create owner gate");
        assertEquals(
                0,
                context.get(
                                CHANNEL_LIST_STORE,
                                storeChannelPath(fixtures.storeA().fixture()),
                                fixtures.storeA().session().cookie(),
                                Set.of(200))
                        .json()
                        .path("total")
                        .asLong(),
                "BUSINESS: stale create does not write a channel");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-idempotency-and-cas",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityIdempotencyAndCas")
    void storeVisibilityIdempotencyAndCas(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        UUID storeA = fixtures.storeA().fixture().storeId();
        UUID storeB = fixtures.storeB().fixture().storeId();
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Idempotency and CAS template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-IDEMPOTENCY-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        Map<String, Object> update = templateUpdateBody(
                "Idempotency and CAS template with B",
                selected.version(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA, storeB));
        Map<String, String> key = Map.of("Idempotency-Key", "acceptance-visibility-replay-" + UUID.randomUUID());
        BackendAcceptanceTest.Response first = context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixtures.projectOwner().fixture(), selected.templateRef()),
                fixtures.projectOwner().session().cookie(),
                update,
                key,
                Set.of(200));
        BackendAcceptanceTest.Response replay = context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixtures.projectOwner().fixture(), selected.templateRef()),
                fixtures.projectOwner().session().cookie(),
                update,
                key,
                Set.of(200));
        assertEquals(
                first.json().path("templateRef").asText(),
                replay.json().path("templateRef").asText());
        assertEquals(
                first.json().path("version").asLong(),
                replay.json().path("version").asLong());

        Map<String, Object> differentFinalSet = templateUpdateBody(
                "Idempotency and CAS template with B only",
                selected.version(),
                "SELECTED_PROJECT_STORES",
                List.of(storeB));
        BackendAcceptanceTest.Response conflict = context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixtures.projectOwner().fixture(), selected.templateRef()),
                fixtures.projectOwner().session().cookie(),
                differentFinalSet,
                key,
                Set.of(409));
        assertEquals("IDEMPOTENCY_CONFLICT", conflict.problemCode());
        BackendAcceptanceTest.Response stale = context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixtures.projectOwner().fixture(), selected.templateRef()),
                fixtures.projectOwner().session().cookie(),
                templateUpdateBody("Stale CAS update", selected.version(), "SELECTED_PROJECT_STORES", List.of(storeB)),
                headers(),
                Set.of(409));
        assertEquals("VERSION_CONFLICT", stale.problemCode());
        BackendAcceptanceTest.Response readback =
                readVisibleStores(context, fixtures.projectOwner(), selected.templateRef(), "ALL", 20, null);
        assertEquals(
                2, readback.json().path("total").asLong(), "BUSINESS: failed CAS leaves the full relation set intact");
        assertTrue(readback.json().toString().contains(storeA.toString()));
        assertTrue(readback.json().toString().contains(storeB.toString()));
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-visible-store-page",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityVisibleStorePage")
    void storeVisibilityVisibleStorePage(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, false);
        BackendAcceptanceTest.Fixture storeC = host.siblingStoreFixtureSameBrand(
                fixtures.storeA().fixture(), Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        UUID templateRef;
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Visible store page template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-PAGE-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(
                        fixtures.storeA().fixture().storeId(),
                        fixtures.storeB().fixture().storeId(),
                        storeC.storeId()));
        templateRef = selected.templateRef();
        BackendAcceptanceTest.Response first =
                readVisibleStores(context, fixtures.projectOwner(), templateRef, "NON_VOIDED", 2, null);
        assertEquals(3, first.json().path("total").asLong());
        assertEquals(2, first.json().path("items").size());
        String cursor = first.json().path("nextCursor").asText();
        assertFalse(cursor.isBlank(), "BUSINESS: visible-store page returns an opaque cursor");
        first.json().path("items").forEach(item -> {
            assertTrue(item.path("storeRef").isTextual());
            assertFalse(item.path("storeCode").asText().isBlank());
            assertFalse(item.path("storeName").asText().isBlank());
            assertEquals("ENABLED", item.path("storeStatus").asText());
        });
        BackendAcceptanceTest.Response second =
                readVisibleStores(context, fixtures.projectOwner(), templateRef, "NON_VOIDED", 2, cursor);
        assertEquals(3, second.json().path("total").asLong());
        assertEquals(1, second.json().path("items").size());
        assertTrue(second.json().path("nextCursor").isNull());
        Set<String> refs = new java.util.LinkedHashSet<>();
        first.json()
                .path("items")
                .forEach(item -> refs.add(item.path("storeRef").asText()));
        second.json()
                .path("items")
                .forEach(item -> refs.add(item.path("storeRef").asText()));
        assertEquals(3, refs.size(), "BUSINESS: visible-store cursor pages do not duplicate relations");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-voided-relation-retained-then-removed",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityVoidedRelationRetainedThenRemoved")
    void storeVisibilityVoidedRelationRetainedThenRemoved(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, true);
        UUID storeA = fixtures.storeA().fixture().storeId();
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Voided relation retention template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-VOIDED-RELATION-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        transitionStoreStatus(context, fixtures.projectOwner(), storeA, "VOIDED", 1);
        BackendAcceptanceTest.Response allBeforeSave =
                readVisibleStores(context, fixtures.projectOwner(), selected.templateRef(), "ALL", 20, null);
        assertEquals(1, allBeforeSave.json().path("total").asLong());
        assertEquals(
                "VOIDED",
                allBeforeSave.json().path("items").get(0).path("storeStatus").asText());
        assertEquals(
                0,
                readVisibleStores(context, fixtures.projectOwner(), selected.templateRef(), "NON_VOIDED", 20, null)
                        .json()
                        .path("total")
                        .asLong());
        BackendAcceptanceTest.Response retained = updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Voided relation retention template unrelated edit",
                selected.version(),
                "SELECTED_PROJECT_STORES",
                List.of(storeA));
        assertEquals(0, retained.json().path("visibleStoreCount").asLong());
        assertEquals(
                1,
                readVisibleStores(context, fixtures.projectOwner(), selected.templateRef(), "ALL", 20, null)
                        .json()
                        .path("total")
                        .asLong(),
                "BUSINESS: whole replacement preserves a VOIDED relation when the editor retains it");
        BackendAcceptanceTest.Response removed = updateTemplate(
                context,
                fixtures.projectOwner(),
                selected.templateRef(),
                "Voided relation retention template removed",
                retained.json().path("version").asLong(),
                "SELECTED_PROJECT_STORES",
                List.of());
        assertEquals(0, removed.json().path("visibleStoreCount").asLong());
        assertEquals(
                0,
                readVisibleStores(context, fixtures.projectOwner(), selected.templateRef(), "ALL", 20, null)
                        .json()
                        .path("total")
                        .asLong(),
                "BUSINESS: explicit editor removal deletes the VOIDED relation");
    }

    @AcceptanceScenario(
            id = "business-channel.store-visibility-disabled-store-candidate-blocked",
            module = "BUSINESS_CHANNEL",
            operation = "storeVisibilityDisabledStoreCandidateBlocked")
    void storeVisibilityDisabledStoreCandidateBlocked(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreVisibilityFixture fixtures = storeVisibilityFixture(context, true);
        BackendAcceptanceTest.Fixture disabledFixture = host.siblingStoreFixtureSameBrand(
                fixtures.storeA().fixture(), Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        BackendAcceptanceTest.Fixture voidedFixture = host.siblingStoreFixtureSameBrand(
                fixtures.storeA().fixture(), Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, disabledFixture);
        host.completeInvitation(context, voidedFixture);
        OperationsFixture disabledOwner =
                selectStore(context, new OperationsFixture(disabledFixture, host.login(context, disabledFixture)));
        OperationsFixture voidedOwner =
                selectStore(context, new OperationsFixture(voidedFixture, host.login(context, voidedFixture)));
        transitionStoreStatus(context, fixtures.projectOwner(), disabledFixture.storeId(), "DISABLED", 1);
        transitionStoreStatus(context, fixtures.projectOwner(), voidedFixture.storeId(), "VOIDED", 1);
        CreatedTemplate selected = createTemplateWithVisibility(
                context,
                fixtures.projectOwner(),
                "Disabled and voided candidate block template",
                "INTERNAL",
                "STORE",
                "TAKEAWAY",
                null,
                null,
                "TPL-STATUS-BLOCK-" + UUID.randomUUID(),
                "SELECTED_PROJECT_STORES",
                List.of(disabledFixture.storeId(), voidedFixture.storeId()));
        for (OperationsFixture targetOwner : List.of(disabledOwner, voidedOwner)) {
            BackendAcceptanceTest.Response candidates =
                    readStoreTemplateCandidates(context, targetOwner, Set.of(403, 409));
            assertTrue(
                    "PLATFORM_COMMON_ACCESS_DENIED".equals(candidates.problemCode())
                            || "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE".equals(candidates.problemCode()),
                    "BUSINESS: non-ENABLED target is fail-closed at candidate edge");
            assertFalse(
                    candidates.json().toString().contains(selected.templateRef().toString()),
                    "BUSINESS: fail-closed candidate response does not expose the selected template");
            BackendAcceptanceTest.Response create = context.post(
                    CHANNEL_CREATE,
                    businessChannelCollectionPath(targetOwner.fixture()),
                    targetOwner.session().cookie(),
                    channelBody(
                            targetOwner,
                            selected.templateRef(),
                            targetOwner.fixture().storeId(),
                            "Blocked status channel",
                            "CH-BLOCKED-" + UUID.randomUUID()),
                    headers(),
                    Set.of(409));
            assertEquals(
                    "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE",
                    create.problemCode(),
                    "BUSINESS: non-ENABLED target is fail-closed at direct create owner gate");
            assertEquals(
                    0,
                    context.get(
                                    CHANNEL_LIST_STORE,
                                    storeChannelPath(targetOwner.fixture()),
                                    fixtures.projectOwner().session().cookie(),
                                    Set.of(200))
                            .json()
                            .path("total")
                            .asLong(),
                    "BUSINESS: blocked create does not produce a channel");
        }
    }

    @AcceptanceScenario(
            id = "business-channel.store-external-dine-in-template",
            module = "BUSINESS_CHANNEL",
            operation = "storeExternalDineInTemplate")
    void storeExternalDineInTemplate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        enableProvider(context, projectOwner.fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        String root =
                "/api/operations/group-workspaces/" + projectOwner.fixture().groupWorkspaceKey();
        BackendAcceptanceTest.Response candidates = context.get(
                PROVIDER_CANDIDATES,
                root + "/external-provider-candidates?capabilityClass=DINE_IN&nodeType=STORE&pageSize=20",
                projectOwner.session().cookie(),
                Set.of(200));
        JsonNode provider = find(candidates.json().path("items"), "providerCode", STORE_OWNED_DINE_IN_PROVIDER);
        assertEquals(
                arrayText("DINE_IN"),
                provider.path("businessScope"),
                "BUSINESS: DINE_IN candidate is scoped only to DINE_IN");
        assertEquals(
                arrayText("STORE"),
                provider.path("bindableNodeTypes"),
                "BUSINESS: store-owned DINE_IN candidate is bindable only to STORE");

        CreatedTemplate template = createTemplate(
                context,
                projectOwner,
                "Store external DINE_IN template",
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                STORE_OWNED_DINE_IN_PROVIDER,
                null);
        assertEquals("EXTERNAL", template.json().path("accessKind").asText());
        assertEquals("STORE", template.json().path("operatorKind").asText());
        assertEquals("DINE_IN", template.json().path("orderKind").asText());
        assertTrue(
                template.json().path("dineInForm").isNull(),
                "BUSINESS: STORE external DINE_IN stores a null platform terminal form");
        assertEquals(
                STORE_OWNED_DINE_IN_PROVIDER,
                template.json().path("providerCode").asText(),
                "BUSINESS: template keeps the exact DINE_IN provider identity");

        transitionProviderStatus(context, projectOwner.fixture(), STORE_OWNED_DINE_IN_PROVIDER, "DISABLED");
        String unchangedName = "Store external DINE_IN template unchanged";
        BackendAcceptanceTest.Response rejectedUpdate = context.patch(
                TEMPLATE_UPDATE,
                templatePath(projectOwner.fixture(), template.templateRef()),
                projectOwner.session().cookie(),
                templateUpdateBody(unchangedName, template.version(), "ALL_PROJECT_STORES", List.of()),
                headers(),
                Set.of(422));
        assertEquals(
                "PROVIDER_NOT_ENABLED",
                rejectedUpdate.problemCode(),
                "BUSINESS: template update revalidates the current external provider before writing");
        JsonNode afterRejectedUpdate = templateRow(context, projectOwner, template.templateRef());
        assertEquals(
                template.json().path("templateName").asText(),
                afterRejectedUpdate.path("templateName").asText(),
                "BUSINESS: rejected provider revalidation preserves the template name");
        assertEquals(
                template.version(),
                afterRejectedUpdate.path("version").asLong(),
                "BUSINESS: rejected provider revalidation preserves the template version");
        transitionProviderStatus(context, projectOwner.fixture(), STORE_OWNED_DINE_IN_PROVIDER, "ENABLED");
    }

    @AcceptanceScenario(
            id = "business-channel.store-external-dine-in-provider-missing",
            module = "BUSINESS_CHANNEL",
            operation = "storeExternalDineInProviderMissing")
    void storeExternalDineInProviderMissing(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        String templateCode = "TPL-EXTERNAL-DINE-IN-MISSING-" + UUID.randomUUID();
        BackendAcceptanceTest.Response rejected = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(projectOwner.fixture()),
                projectOwner.session().cookie(),
                rawTemplateBody(
                        projectOwner,
                        "External DINE_IN missing provider",
                        templateCode,
                        "EXTERNAL",
                        "STORE",
                        "DINE_IN",
                        null,
                        null,
                        "ALL_PROJECT_STORES",
                        List.of()),
                headers(),
                Set.of(422));
        assertTypedReject(rejected, templateCode, "BUSINESS: external DINE_IN without a provider is rejected");
        assertEquals("VALIDATION_ERROR", rejected.problemCode());
        assertFalse(
                templateCollection(context, projectOwner).toString().contains(templateCode),
                "BUSINESS: missing-provider rejection leaves no template row");
    }

    @AcceptanceScenario(
            id = "business-channel.store-external-dine-in-channel",
            module = "BUSINESS_CHANNEL",
            operation = "storeExternalDineInChannel")
    void storeExternalDineInChannel(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreProjectFixture fixtures = storeProjectFixture(context);
        enableProvider(context, fixtures.projectOwner().fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        CreatedTemplate template = createTemplate(
                context,
                fixtures.projectOwner(),
                "Store external DINE_IN channel template",
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                STORE_OWNED_DINE_IN_PROVIDER,
                null);
        CreatedChannel channel = createChannel(
                context,
                fixtures.storeOwner(),
                template.templateRef().toString(),
                "STORE",
                fixtures.storeOwner().fixture().storeId(),
                "Store external DINE_IN channel");
        assertEquals(
                template.templateRef().toString(),
                channel.json().path("templateRef").asText(),
                "BUSINESS: external DINE_IN channel points to the created template");
        assertEquals(
                "STORE",
                channel.json().path("ownerNodeType").asText(),
                "BUSINESS: external DINE_IN channel is STORE-owned");
        assertEquals(
                "UNBOUND", channel.json().path("bindingStatus").asText(), "BUSINESS: binding is an independent fact");
        assertEquals(
                "DINE_IN",
                templateRow(context, fixtures.projectOwner(), template.templateRef())
                        .path("orderKind")
                        .asText(),
                "BUSINESS: channel template readback remains DINE_IN");
        assertTrue(
                templateRow(context, fixtures.projectOwner(), template.templateRef())
                        .path("dineInForm")
                        .isNull(),
                "BUSINESS: channel template readback keeps null external form");
    }

    @AcceptanceScenario(
            id = "business-channel.project-external-dine-in-rejected",
            module = "BUSINESS_CHANNEL",
            operation = "projectExternalDineInRejected")
    void projectExternalDineInRejected(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        enableProvider(context, projectOwner.fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        String templateCode = "TPL-PROJECT-EXTERNAL-DINE-IN-" + UUID.randomUUID();
        BackendAcceptanceTest.Response rejected = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(projectOwner.fixture()),
                projectOwner.session().cookie(),
                rawTemplateBody(
                        projectOwner,
                        "Project external DINE_IN",
                        templateCode,
                        "EXTERNAL",
                        "PROJECT",
                        "DINE_IN",
                        null,
                        STORE_OWNED_DINE_IN_PROVIDER,
                        null,
                        List.of()),
                headers(),
                Set.of(422));
        assertEquals(
                "PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED",
                rejected.problemCode(),
                "BUSINESS: PROJECT external DINE_IN is rejected by the typed policy");
        assertTypedReject(
                rejected, templateCode, "BUSINESS: project external DINE_IN does not leak the rejected identity");
        assertFalse(
                templateCollection(context, projectOwner).toString().contains(templateCode),
                "BUSINESS: project external DINE_IN rejection creates no template");
    }

    @AcceptanceScenario(
            id = "business-channel.external-dine-in-form-rejected",
            module = "BUSINESS_CHANNEL",
            operation = "externalDineInFormRejected")
    void externalDineInFormRejected(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        enableProvider(context, projectOwner.fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        for (String form : List.of("POS", "QR", "KIOSK")) {
            String templateCode = "TPL-EXTERNAL-DINE-IN-FORM-" + form + "-" + UUID.randomUUID();
            BackendAcceptanceTest.Response rejected = context.post(
                    TEMPLATE_CREATE,
                    templateCollectionPath(projectOwner.fixture()),
                    projectOwner.session().cookie(),
                    rawTemplateBody(
                            projectOwner,
                            "External DINE_IN form " + form,
                            templateCode,
                            "EXTERNAL",
                            "STORE",
                            "DINE_IN",
                            form,
                            STORE_OWNED_DINE_IN_PROVIDER,
                            "ALL_PROJECT_STORES",
                            List.of()),
                    headers(),
                    Set.of(422));
            assertEquals("DINE_IN_FORM_MISMATCH", rejected.problemCode());
            assertTypedReject(rejected, templateCode, "BUSINESS: external DINE_IN rejects platform form " + form);
            assertFalse(
                    templateCollection(context, projectOwner).toString().contains(templateCode),
                    "BUSINESS: rejected external form leaves no template " + form);
        }
    }

    @AcceptanceScenario(
            id = "business-channel.internal-dine-in-form-matrix",
            module = "BUSINESS_CHANNEL",
            operation = "internalDineInFormMatrix")
    void internalDineInFormMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        for (String form : List.of("POS", "QR", "KIOSK")) {
            CreatedTemplate template = createTemplate(
                    context, projectOwner, "Internal DINE_IN " + form, "INTERNAL", "STORE", "DINE_IN", null, form);
            assertEquals("INTERNAL", template.json().path("accessKind").asText());
            assertEquals(form, template.json().path("dineInForm").asText());
            assertTrue(
                    template.json().path("providerCode").isNull(),
                    "BUSINESS: internal DINE_IN " + form + " has no external provider");
        }
        String missingCode = "TPL-INTERNAL-DINE-IN-MISSING-" + UUID.randomUUID();
        BackendAcceptanceTest.Response missing = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(projectOwner.fixture()),
                projectOwner.session().cookie(),
                rawTemplateBody(
                        projectOwner,
                        "Internal DINE_IN missing form",
                        missingCode,
                        "INTERNAL",
                        "STORE",
                        "DINE_IN",
                        null,
                        null,
                        "ALL_PROJECT_STORES",
                        List.of()),
                headers(),
                Set.of(422));
        assertEquals("DINE_IN_FORM_MISMATCH", missing.problemCode());
        assertTypedReject(missing, missingCode, "BUSINESS: internal DINE_IN requires a terminal form");
        String nonDineInCode = "TPL-TAKEAWAY-FORM-" + UUID.randomUUID();
        BackendAcceptanceTest.Response nonDineIn = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(projectOwner.fixture()),
                projectOwner.session().cookie(),
                rawTemplateBody(
                        projectOwner,
                        "Takeaway with form",
                        nonDineInCode,
                        "INTERNAL",
                        "STORE",
                        "TAKEAWAY",
                        "POS",
                        null,
                        "ALL_PROJECT_STORES",
                        List.of()),
                headers(),
                Set.of(422));
        assertEquals("DINE_IN_FORM_MISMATCH", nonDineIn.problemCode());
        assertTypedReject(nonDineIn, nonDineInCode, "BUSINESS: non-DINE_IN rejects a terminal form");
        assertFalse(
                templateCollection(context, projectOwner).toString().contains(missingCode),
                "BUSINESS: missing internal DINE_IN form creates no template");
        assertFalse(
                templateCollection(context, projectOwner).toString().contains(nonDineInCode),
                "BUSINESS: non-DINE_IN form rejection creates no template");
    }

    @AcceptanceScenario(
            id = "business-channel.store-management-channel-read-includes-external-dine-in",
            module = "BUSINESS_CHANNEL",
            operation = "storeManagementChannelReadIncludesExternalDineIn")
    void storeManagementChannelReadIncludesExternalDineIn(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        StoreProjectFixture fixtures = storeProjectFixture(context);
        enableProvider(context, fixtures.projectOwner().fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        CreatedTemplate template = createTemplate(
                context,
                fixtures.projectOwner(),
                "Store management external DINE_IN",
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                STORE_OWNED_DINE_IN_PROVIDER,
                null);
        CreatedChannel channel = createChannel(
                context,
                fixtures.storeOwner(),
                template.templateRef().toString(),
                "STORE",
                fixtures.storeOwner().fixture().storeId(),
                "Store management external DINE_IN channel");
        BackendAcceptanceTest.Response storeChannels = context.get(
                CHANNEL_LIST_STORE,
                storeBusinessChannelPath(fixtures.storeOwner().fixture()),
                fixtures.storeOwner().session().cookie(),
                Set.of(200));
        JsonNode row = find(
                storeChannels.json().path("items"),
                "channelRef",
                channel.channelRef().toString());
        assertEquals("STORE", row.path("ownerNodeType").asText());
        assertEquals(
                channel.channelRef().toString(),
                row.path("channelRef").asText(),
                "BUSINESS: store management read returns the external DINE_IN channel identity");
        assertEquals(
                "DISABLED",
                row.path("status").asText(),
                "BUSINESS: an unbound external DINE_IN channel keeps its disabled status");
        assertEquals(
                "UNBOUND",
                row.path("bindingStatus").asText(),
                "BUSINESS: store management read preserves the independent unbound status");
    }

    @AcceptanceScenario(
            id = "business-channel.store-profile-read-for-store-role",
            module = "BUSINESS_CHANNEL",
            operation = "storeProfileReadForStoreRole")
    void storeProfileReadForStoreRole(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreProjectFixture fixtures = storeProjectFixture(context);
        BackendAcceptanceTest.Response profile = context.get(
                STORE_PROFILE,
                "/api/operations/group-workspaces/"
                        + fixtures.storeOwner().fixture().groupWorkspaceKey() + "/store/profile?expectedContextVersion="
                        + fixtures.storeOwner().session().contextVersion(),
                fixtures.storeOwner().session().cookie(),
                Set.of(200));
        assertEquals(
                fixtures.storeOwner().fixture().storeId().toString(),
                profile.json().path("id").asText(),
                "BUSINESS: store profile is readable by the current STORE role");
        assertEquals(
                fixtures.projectOwner().fixture().projectId().toString(),
                profile.json().path("project").path("id").asText(),
                "BUSINESS: store profile returns the owning project for candidate lookup");
    }

    @AcceptanceScenario(
            id = "business-channel.store-usage-separation",
            module = "BUSINESS_CHANNEL",
            operation = "storeUsageSeparation")
    void storeUsageSeparation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreProjectFixture fixtures = storeProjectFixture(context);
        enableProvider(context, fixtures.projectOwner().fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        CreatedTemplate template = createTemplate(
                context,
                fixtures.projectOwner(),
                "Store usage separation external DINE_IN",
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                STORE_OWNED_DINE_IN_PROVIDER,
                null);
        CreatedChannel channel = createChannel(
                context,
                fixtures.storeOwner(),
                template.templateRef().toString(),
                "STORE",
                fixtures.storeOwner().fixture().storeId(),
                "Store usage separation external DINE_IN channel");
        BackendAcceptanceTest.Response managementRead = context.get(
                CHANNEL_LIST_STORE,
                storeBusinessChannelPath(fixtures.storeOwner().fixture()),
                fixtures.storeOwner().session().cookie(),
                Set.of(200));
        assertNotNull(
                find(
                        managementRead.json().path("items"),
                        "channelRef",
                        channel.channelRef().toString()),
                "BUSINESS: BUSINESS_CHANNEL usage includes external DINE_IN");
        BackendAcceptanceTest.Response salesMenuRead = context.get(
                CHANNEL_LIST_STORE,
                storeChannelPath(fixtures.storeOwner().fixture()),
                fixtures.storeOwner().session().cookie(),
                Set.of(200));
        assertFalse(
                salesMenuRead.json().toString().contains(channel.channelRef().toString()),
                "BUSINESS: SALES_MENU usage excludes external DINE_IN");
    }

    @AcceptanceScenario(
            id = "business-channel.dine-in-project-no-partial-write",
            module = "BUSINESS_CHANNEL",
            operation = "dineInProjectNoPartialWrite")
    void dineInProjectNoPartialWrite(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture projectOwner =
                operationsFixture(context, "PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        enableProvider(context, projectOwner.fixture(), STORE_OWNED_DINE_IN_PROVIDER);
        String templateCode = "TPL-PROJECT-DINE-IN-NO-WRITE-" + UUID.randomUUID();
        BackendAcceptanceTest.Response rejected = context.post(
                TEMPLATE_CREATE,
                templateCollectionPath(projectOwner.fixture()),
                projectOwner.session().cookie(),
                rawTemplateBody(
                        projectOwner,
                        "Project external DINE_IN no write",
                        templateCode,
                        "EXTERNAL",
                        "PROJECT",
                        "DINE_IN",
                        "POS",
                        STORE_OWNED_DINE_IN_PROVIDER,
                        null,
                        List.of()),
                headers(),
                Set.of(422));
        assertEquals("PROJECT_DINE_IN_EXTERNAL_NOT_ALLOWED", rejected.problemCode());
        assertTypedReject(rejected, templateCode, "BUSINESS: project DINE_IN rejection is typed and non-leaking");
        BackendAcceptanceTest.Response templates = context.get(
                TEMPLATE_LIST,
                templateCollectionPath(projectOwner.fixture()) + "?projectRef="
                        + projectOwner.fixture().projectId(),
                projectOwner.session().cookie(),
                Set.of(200));
        assertFalse(
                templates.json().toString().contains(templateCode),
                "BUSINESS: rejected project DINE_IN leaves no template residue");
        BackendAcceptanceTest.Response projectChannels = context.get(
                CHANNEL_LIST_PROJECT,
                "/api/operations/group-workspaces/" + projectOwner.fixture().groupWorkspaceKey() + "/projects/"
                        + projectOwner.fixture().projectId() + "/business-channels?pageSize=20",
                projectOwner.session().cookie(),
                Set.of(200));
        assertEquals(
                0, projectChannels.json().path("total").asLong(), "BUSINESS: no partial project channel is created");
    }

    private StoreVisibilityFixture storeVisibilityFixture(
            BackendAcceptanceTest.ScenarioContext context, boolean includeStoreStatusCapability) throws Exception {
        OperationsFixture storeA =
                selectStore(context, operationsFixture(context, "STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT")));
        Set<String> projectCapabilities = includeStoreStatusCapability
                ? Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT", "BC-ORG-STORE-STATUS")
                : Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT");
        BackendAcceptanceTest.Fixture projectFixture = host.projectUserFixture(storeA.fixture(), projectCapabilities);
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        BackendAcceptanceTest.Fixture storeBFixture =
                host.siblingStoreFixtureSameBrand(storeA.fixture(), Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, storeBFixture);
        OperationsFixture storeB =
                selectStore(context, new OperationsFixture(storeBFixture, host.login(context, storeBFixture)));
        return new StoreVisibilityFixture(projectOwner, storeA, storeB);
    }

    private StoreProjectFixture storeProjectFixture(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture storeOwner =
                selectStore(context, operationsFixture(context, "STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT")));
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(storeOwner.fixture(), Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        return new StoreProjectFixture(projectOwner, storeOwner);
    }

    private BackendAcceptanceTest.Response transitionTemplateStatus(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            CreatedTemplate template,
            String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                TEMPLATE_STATUS,
                templatePath(fixture.fixture(), template.templateRef()) + "/status",
                fixture.session().cookie(),
                Map.of("status", status, "expectedVersion", template.version()),
                headers(),
                Set.of(200));
        assertEquals(
                status, response.json().path("status").asText(), "BUSINESS: template status transition is read back");
        return response;
    }

    private BackendAcceptanceTest.Response transitionStoreStatus(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture projectOwner,
            UUID storeRef,
            String status,
            long expectedVersion)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + projectOwner.fixture().groupWorkspaceKey()
                        + "/organization/stores/" + storeRef + "/status",
                projectOwner.session().cookie(),
                Map.of("targetStatus", status, "expectedVersion", expectedVersion),
                headers(),
                Set.of(200));
        assertEquals(status, response.json().path("status").asText(), "BUSINESS: target store status is read back");
        return response;
    }

    private BackendAcceptanceTest.Response readStoreTemplateCandidates(
            BackendAcceptanceTest.ScenarioContext context, OperationsFixture fixture) throws Exception {
        return readStoreTemplateCandidates(context, fixture, Set.of(200));
    }

    private BackendAcceptanceTest.Response readStoreTemplateCandidates(
            BackendAcceptanceTest.ScenarioContext context, OperationsFixture fixture, Set<Integer> expected)
            throws Exception {
        return context.get(
                TEMPLATE_CANDIDATES,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/business-channel-template-candidates?projectRef="
                        + fixture.fixture().projectId()
                        + "&storeRef=" + fixture.fixture().storeId() + "&pageSize=20",
                fixture.session().cookie(),
                expected);
    }

    private BackendAcceptanceTest.Response readVisibleStores(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture projectOwner,
            UUID templateRef,
            String filter,
            int pageSize,
            String cursor)
            throws Exception {
        String path = templatePath(projectOwner.fixture(), templateRef) + "/visible-stores?storeStatusFilter=" + filter
                + "&pageSize=" + pageSize;
        if (cursor != null) {
            path += "&cursor=" + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8);
        }
        return context.get(TEMPLATE_VISIBLE_STORES, path, projectOwner.session().cookie(), Set.of(200));
    }

    private JsonNode templateRow(
            BackendAcceptanceTest.ScenarioContext context, OperationsFixture projectOwner, UUID templateRef)
            throws Exception {
        BackendAcceptanceTest.Response response = context.get(
                TEMPLATE_LIST,
                templateCollectionPath(projectOwner.fixture()) + "?projectRef="
                        + projectOwner.fixture().projectId(),
                projectOwner.session().cookie(),
                Set.of(200));
        return find(response.json().path("items"), "templateRef", templateRef.toString());
    }

    private BackendAcceptanceTest.Response updateTemplate(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            UUID templateRef,
            String name,
            long expectedVersion,
            String scope,
            List<UUID> visibleStoreRefs)
            throws Exception {
        return context.patch(
                TEMPLATE_UPDATE,
                templatePath(fixture.fixture(), templateRef),
                fixture.session().cookie(),
                templateUpdateBody(name, expectedVersion, scope, visibleStoreRefs),
                headers(),
                Set.of(200));
    }

    private static Map<String, Object> templateUpdateBody(
            String name, long expectedVersion, String scope, List<UUID> visibleStoreRefs) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("templateName", name);
        body.put("expectedVersion", expectedVersion);
        body.put("storeVisibilityScope", scope);
        body.put("visibleStoreRefs", visibleStoreRefs == null ? List.of() : visibleStoreRefs);
        return body;
    }

    private static Map<String, Object> templateBody(
            OperationsFixture fixture, String name, String operatorKind, String scope, List<UUID> visibleStoreRefs) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("projectRef", fixture.fixture().projectId().toString());
        body.put("templateName", name);
        body.put("templateCode", "TPL-" + UUID.randomUUID());
        body.put("accessKind", "INTERNAL");
        body.put("operatorKind", operatorKind);
        body.put("orderKind", "TAKEAWAY");
        body.put("dineInForm", null);
        body.put("providerCode", null);
        body.put("storeVisibilityScope", scope);
        body.put("visibleStoreRefs", visibleStoreRefs == null ? List.of() : visibleStoreRefs);
        return body;
    }

    private static Map<String, Object> rawTemplateBody(
            OperationsFixture fixture,
            String name,
            String templateCode,
            String accessKind,
            String operatorKind,
            String orderKind,
            String dineInForm,
            String providerCode,
            String storeVisibilityScope,
            List<UUID> visibleStoreRefs) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("projectRef", fixture.fixture().projectId().toString());
        body.put("templateName", name);
        body.put("templateCode", templateCode);
        body.put("accessKind", accessKind);
        body.put("operatorKind", operatorKind);
        body.put("orderKind", orderKind);
        body.put("dineInForm", dineInForm);
        body.put("providerCode", providerCode);
        body.put("storeVisibilityScope", storeVisibilityScope);
        body.put("visibleStoreRefs", visibleStoreRefs == null ? List.of() : visibleStoreRefs);
        return body;
    }

    private static JsonNode templateCollection(
            BackendAcceptanceTest.ScenarioContext context, OperationsFixture projectOwner) throws Exception {
        return context.get(
                        TEMPLATE_LIST,
                        templateCollectionPath(projectOwner.fixture()) + "?projectRef="
                                + projectOwner.fixture().projectId(),
                        projectOwner.session().cookie(),
                        Set.of(200))
                .json()
                .path("items");
    }

    private static Map<String, Object> channelBody(
            OperationsFixture fixture, UUID templateRef, UUID storeRef, String name, String code) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("templateRef", templateRef.toString());
        body.put("ownerNodeType", "STORE");
        body.put("ownerNodeRef", storeRef.toString());
        body.put("channelCode", code);
        body.put("channelName", name);
        body.put("bindingRef", null);
        return body;
    }

    private static void assertCandidateOnly(
            BackendAcceptanceTest.Response response, UUID expected, String message, UUID... forbidden) {
        assertEquals(1, response.json().path("items").size(), message + " [one candidate]");
        assertEquals(
                expected.toString(),
                response.json().path("items").get(0).path("templateRef").asText(),
                message);
        for (UUID ref : forbidden) {
            assertFalse(response.json().toString().contains(ref.toString()), message + " [excludes " + ref + "]");
        }
    }

    private static void assertTypedReject(
            BackendAcceptanceTest.Response response, String forbiddenIdentity, String message) {
        assertTrue(response.status() >= 400 && response.status() < 500, message + " [4xx]");
        assertFalse(response.problemCode().isBlank(), message + " [typed reason]");
        assertFalse(response.json().toString().contains(forbiddenIdentity), message + " [no identity leakage]");
    }

    /**
     * Shared acceptance fixture bridge for sales-menu scenarios. Channel/template ownership stays in this owner file;
     * callers only receive the real STORE-scoped INTERNAL TAKEAWAY channel refs they need to exercise menu behavior.
     */
    List<UUID> acceptanceCreateSalesMenuEligibleStoreChannels(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture storeFixture,
            BackendAcceptanceTest.Session storeSession,
            int count,
            String namePrefix)
            throws Exception {
        return acceptanceCreateSalesMenuEligibleStoreChannels(
                context, storeFixture, storeSession, count, namePrefix, "TAKEAWAY");
    }

    /** Creates real STORE-owned INTERNAL channels for a sales-menu fixture with the requested order kind. */
    List<UUID> acceptanceCreateSalesMenuEligibleStoreChannels(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture storeFixture,
            BackendAcceptanceTest.Session storeSession,
            int count,
            String namePrefix,
            String orderKind)
            throws Exception {
        if (count < 1) throw new IllegalArgumentException("count must be positive");
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(storeFixture, Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        String dineInForm = "DINE_IN".equals(orderKind) ? "POS" : null;
        CreatedTemplate template = createTemplate(
                context, projectOwner, namePrefix + " template", "INTERNAL", "STORE", orderKind, null, dineInForm);
        String templateRef = template.json().path("templateRef").asText();
        assertFalse(templateRef.isBlank(), "BUSINESS: sales-menu fixture obtains a STORE template ref");
        assertEquals("INTERNAL", template.json().path("accessKind").asText(), "BUSINESS: channel template is INTERNAL");
        assertEquals(
                "STORE", template.json().path("operatorKind").asText(), "BUSINESS: channel template is STORE-owned");
        assertEquals(
                orderKind,
                template.json().path("orderKind").asText(),
                "BUSINESS: channel template has the requested order kind");
        OperationsFixture storeOwner = new OperationsFixture(storeFixture, storeSession);
        List<UUID> channels = new java.util.ArrayList<>();
        for (int index = 0; index < count; index++) {
            CreatedChannel channel = createChannel(
                    context, storeOwner, templateRef, "STORE", storeFixture.storeId(), namePrefix + " " + index);
            assertEquals(
                    "ENABLED", channel.json().path("status").asText(), "BUSINESS: eligible store channel is enabled");
            assertEquals("STORE", channel.json().path("ownerNodeType").asText(), "BUSINESS: channel owner is STORE");
            channels.add(UUID.fromString(channel.json().path("channelRef").asText()));
        }
        return List.copyOf(channels);
    }

    /** Creates a real STORE-owned external DINE_IN channel for the sales-menu exclusion proof. */
    JsonNode acceptanceCreateExternalDineInChannel(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture storeFixture,
            BackendAcceptanceTest.Session storeSession)
            throws Exception {
        OperationsFixture storeOwner = new OperationsFixture(storeFixture, storeSession);
        enableProvider(context, storeFixture, STORE_OWNED_DINE_IN_PROVIDER);
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(storeFixture, Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        String name = "Sales menu external DINE_IN";
        CreatedTemplate template = createTemplate(
                context,
                projectOwner,
                name + " template",
                "EXTERNAL",
                "STORE",
                "DINE_IN",
                STORE_OWNED_DINE_IN_PROVIDER,
                null);
        assertEquals(
                "EXTERNAL",
                template.json().path("accessKind").asText(),
                "BUSINESS: exclusion fixture is an external channel");
        assertEquals(
                "DINE_IN",
                template.json().path("orderKind").asText(),
                "BUSINESS: exclusion fixture has the DINE_IN order kind");
        assertTrue(
                template.json().path("dineInForm").isNull(),
                "BUSINESS: external DINE_IN template has no platform terminal form");
        assertEquals(
                STORE_OWNED_DINE_IN_PROVIDER,
                template.json().path("providerCode").asText(),
                "BUSINESS: external DINE_IN template uses the exact DINE_IN provider");
        CreatedChannel channel = createChannel(
                context,
                storeOwner,
                template.json().path("templateRef").asText(),
                "STORE",
                storeFixture.storeId(),
                name + " channel");
        CreatedBinding binding = createBinding(
                context,
                storeOwner,
                channel.channelRef(),
                STORE_OWNED_DINE_IN_PROVIDER,
                "DINE_IN",
                "STORE",
                storeFixture.storeId(),
                name + " binding",
                "sales-menu-external-dine-in-" + UUID.randomUUID());
        assertTrue(
                binding.json().path("bindingRef").isTextual(),
                "BUSINESS: exclusion fixture has a real external binding");
        return context.get(
                        CHANNEL_DETAIL,
                        channelPath(storeFixture, channel.channelRef()),
                        storeSession.cookie(),
                        Set.of(200))
                .json();
    }

    @AcceptanceScenario(
            id = "business-channel.sales-menu-eligible-cursor",
            module = "BUSINESS_CHANNEL",
            operation = "salesMenuEligibleCursor")
    void salesMenuEligibleCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = selectStore(
                        context, new OperationsFixture(fixture, host.login(context, fixture)))
                .session();
        List<UUID> expectedTakeaway = acceptanceCreateSalesMenuEligibleStoreChannels(
                context, fixture, session, 20, "Sales menu eligible takeaway cursor", "TAKEAWAY");
        List<UUID> expectedDineIn = acceptanceCreateSalesMenuEligibleStoreChannels(
                context, fixture, session, 1, "Sales menu eligible dine-in cursor", "DINE_IN");
        List<UUID> expected = new java.util.ArrayList<>(expectedTakeaway);
        expected.addAll(expectedDineIn);
        OperationsFixture storeOwner = new OperationsFixture(fixture, session);
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(fixture, Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));

        CreatedTemplate projectTemplate = createTemplate(
                context,
                projectOwner,
                "Sales menu ineligible project template",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null);
        CreatedChannel projectChannel = createChannel(
                context,
                projectOwner,
                projectTemplate.json().path("templateRef").asText(),
                "PROJECT",
                projectFixture.projectId(),
                "Sales menu ineligible project channel");
        UUID projectChannelRef =
                UUID.fromString(projectChannel.json().path("channelRef").asText());
        assertEquals(
                "PROJECT",
                projectChannel.json().path("ownerNodeType").asText(),
                "BUSINESS: project-owned channel is an explicit ineligible counterexample");

        CreatedTemplate groupBuyTemplate = createTemplate(
                context,
                projectOwner,
                "Sales menu ineligible group-buy template",
                "INTERNAL",
                "STORE",
                "GROUP_BUY",
                null,
                null);
        CreatedChannel groupBuyChannel = createChannel(
                context,
                storeOwner,
                groupBuyTemplate.json().path("templateRef").asText(),
                "STORE",
                fixture.storeId(),
                "Sales menu ineligible group-buy channel");
        UUID groupBuyChannelRef =
                UUID.fromString(groupBuyChannel.json().path("channelRef").asText());

        enableProvider(context, fixture, "MEITUAN_ISV_A");
        CreatedExternalStoreBinding externalChannel = createExternalStoreBinding(
                context,
                projectOwner,
                storeOwner,
                "MEITUAN_ISV_A",
                "TAKEAWAY",
                "SALES-MENU-INELIGIBLE-EXTERNAL-" + UUID.randomUUID(),
                "Sales menu ineligible external channel");
        UUID externalChannelRef = externalChannel.channel().channelRef();
        String root = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/business-channels";
        BackendAcceptanceTest.Response first =
                context.get(CHANNEL_LIST_STORE, root + "?usage=SALES_MENU&pageSize=20", session.cookie(), Set.of(200));
        assertEquals(20, first.json().path("items").size(), "BUSINESS: eligible channel first page is exactly 20");
        String cursor = first.json().path("nextCursor").asText();
        assertFalse(cursor.isBlank(), "BUSINESS: eligible channel first page returns a cursor");
        BackendAcceptanceTest.Response second = context.get(
                CHANNEL_LIST_STORE,
                root + "?usage=SALES_MENU&pageSize=20&cursor="
                        + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(200));
        assertEquals(1, second.json().path("items").size(), "BUSINESS: eligible channel second page has the 21st item");
        assertTrue(second.json().path("nextCursor").isNull(), "BUSINESS: eligible channel cursor is exhausted");
        Set<String> observed = new java.util.LinkedHashSet<>();
        first.json()
                .path("items")
                .forEach(item -> observed.add(item.path("channelRef").asText()));
        second.json()
                .path("items")
                .forEach(item -> observed.add(item.path("channelRef").asText()));
        assertEquals(21, observed.size(), "BUSINESS: eligible channel pages have no duplicate refs");
        expected.forEach(channelRef -> assertTrue(
                observed.contains(channelRef.toString()),
                "BUSINESS: eligible channel pages retain created ref " + channelRef));
        assertFalse(
                observed.contains(projectChannelRef.toString()),
                "BUSINESS: project-owned channel is excluded from the STORE sales-menu projection");
        assertFalse(
                observed.contains(groupBuyChannelRef.toString()),
                "BUSINESS: unsupported order kind is excluded from the sales-menu projection");
        assertFalse(
                observed.contains(externalChannelRef.toString()),
                "BUSINESS: external channel is excluded from the INTERNAL sales-menu projection");
        BackendAcceptanceTest.Response wrongQuery = context.get(
                CHANNEL_LIST_STORE,
                root + "?usage=SALES_MENU&pageSize=20&sortKey=CHANNEL_CODE&cursor="
                        + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(422));
        assertEquals("VALIDATION_ERROR", wrongQuery.problemCode(), "BUSINESS: cursor binds to its query identity");
        BackendAcceptanceTest.Fixture sibling = host.siblingStoreFixtureSameBrand(fixture, Set.of());
        BackendAcceptanceTest.Response wrongStore = context.get(
                CHANNEL_LIST_STORE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + sibling.storeId()
                        + "/business-channels?usage=SALES_MENU&pageSize=20&cursor="
                        + java.net.URLEncoder.encode(cursor, java.nio.charset.StandardCharsets.UTF_8),
                session.cookie(),
                Set.of(403));
        assertTrue(
                wrongStore.problemCode().contains("ACCESS")
                        || wrongStore.problemCode().contains("SCOPE"),
                "BUSINESS: cursor cannot cross the selected store scope");
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
        CreatedTemplate template = createTemplate(
                context, projectOwner, "Disabled store channel", "INTERNAL", "STORE", "TAKEAWAY", null, null);
        BackendAcceptanceTest.Response rejected = context.post(
                CHANNEL_CREATE,
                businessChannelCollectionPath(fixture.fixture()),
                fixture.session().cookie(),
                channelBody(
                        fixture,
                        UUID.fromString(template.json().path("templateRef").asText()),
                        fixture.fixture().storeId(),
                        "Created while store disabled",
                        "CH-DISABLED-" + UUID.randomUUID()),
                headers(),
                Set.of(409));
        assertEquals(
                "BUSINESS_CHANNEL_STORE_VISIBILITY_STALE",
                rejected.problemCode(),
                "BUSINESS: disabled store direct create is rejected by the owner status gate");
        BackendAcceptanceTest.Response channels = context.get(
                CHANNEL_LIST_STORE,
                storeChannelPath(fixture.fixture()),
                projectOwner.session().cookie(),
                Set.of(200));
        assertEquals(
                0,
                channels.json().path("total").asLong(),
                "BUSINESS: disabled store rejection does not create a partial channel");
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

        CreatedTemplate ownerTemplate = createTemplate(
                context,
                projectOwner,
                "M1 protected store channel",
                "EXTERNAL",
                "STORE",
                "TAKEAWAY",
                "MEITUAN_ISV_B",
                null);
        CreatedChannel ownerChannel = createChannel(
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
        CreatedBinding ownerBinding = createBinding(
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
                        root + "/stores/" + owner.fixture().storeId()
                                + "/business-channels?usage=SALES_MENU&pageSize=20",
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

        CreatedExternalStoreBinding meituanA = createExternalStoreBinding(
                context, projectOwner, fixture, "MEITUAN_ISV_A", "TAKEAWAY", "MEITUAN-OWNER-A", "Meituan takeaway");
        CreatedExternalStoreBinding meituanB = createExternalStoreBinding(
                context, projectOwner, fixture, "MEITUAN_ISV_B", "GROUP_BUY", "MEITUAN-OWNER-B", "Meituan group buy");
        CreatedExternalStoreBinding elemeA = createExternalStoreBinding(
                context, projectOwner, fixture, "ELEME_OPEN", "TAKEAWAY", "ELEME-OWNER-SAME", "Eleme takeaway");
        CreatedExternalStoreBinding elemeB = createExternalStoreBinding(
                context, projectOwner, fixture, "ELEME_OPEN", "GROUP_BUY", "ELEME-OWNER-SAME", "Eleme group buy");

        assertEquals(
                4,
                Set.of(
                                meituanA.binding().bindingRef().toString(),
                                meituanB.binding().bindingRef().toString(),
                                elemeA.binding().bindingRef().toString(),
                                elemeB.binding().bindingRef().toString())
                        .size(),
                "BUSINESS: four channel owner rows remain distinct despite repeated external owner ids");
        assertEquals(
                "PENDING_AUTHORIZATION",
                meituanA.binding().json().path("status").asText(),
                "BUSINESS: Meituan grant remains callback-controlled");
        assertEquals(
                "PENDING_AUTHORIZATION",
                meituanB.binding().json().path("status").asText(),
                "BUSINESS: second Meituan grant remains callback-controlled");
        assertEquals(
                "PENDING_AUTHORIZATION",
                elemeA.binding().json().path("status").asText(),
                "BUSINESS: Eleme grant remains callback-controlled");
        assertEquals(
                "PENDING_AUTHORIZATION",
                elemeB.binding().json().path("status").asText(),
                "BUSINESS: same Eleme owner id is not a global uniqueness key");

        CreatedTemplate readbackTemplate = createTemplate(
                context,
                projectOwner,
                "Owner binding readback template",
                "EXTERNAL",
                "STORE",
                "TAKEAWAY",
                "ELEME_OPEN",
                null);
        CreatedChannel readbackChannel = createChannel(
                context,
                fixture,
                readbackTemplate.json().path("templateRef").asText(),
                "STORE",
                fixture.fixture().storeId(),
                "Owner binding readback channel");
        UUID readbackChannelRef =
                UUID.fromString(readbackChannel.json().path("channelRef").asText());
        CreatedBinding readbackBinding = createBinding(
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

    private CreatedExternalStoreBinding createExternalStoreBinding(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture projectOwner,
            OperationsFixture fixture,
            String providerCode,
            String orderKind,
            String externalOwnerId,
            String name)
            throws Exception {
        CreatedTemplate template = createTemplate(
                context, projectOwner, name + " template", "EXTERNAL", "STORE", orderKind, providerCode, null);
        CreatedChannel channel = createChannel(
                context,
                fixture,
                template.json().path("templateRef").asText(),
                "STORE",
                fixture.fixture().storeId(),
                name + " channel");
        CreatedBinding binding = createBinding(
                context,
                fixture,
                channel.channelRef(),
                providerCode,
                orderKind,
                "STORE",
                fixture.fixture().storeId(),
                name + " binding",
                externalOwnerId);
        return new CreatedExternalStoreBinding(channel, binding);
    }

    private void enableProvider(
            BackendAcceptanceTest.ScenarioContext context, BackendAcceptanceTest.Fixture fixture, String providerCode)
            throws Exception {
        transitionProviderStatus(context, fixture, providerCode, "ENABLED");
    }

    private void transitionProviderStatus(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            String providerCode,
            String desiredStatus)
            throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String path =
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/provider-profiles/" + providerCode;
        BackendAcceptanceTest.Response current = context.get(PROVIDER_DETAIL, path, platform.cookie(), Set.of(200));
        if (desiredStatus.equals(current.json().path("enablementStatus").asText())) return;
        BackendAcceptanceTest.Response transitioned = context.post(
                PROVIDER_STATUS,
                path + "/status",
                platform.cookie(),
                Map.of(
                        "status",
                        desiredStatus,
                        "expectedVersion",
                        current.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                desiredStatus,
                transitioned.json().path("enablementStatus").asText(),
                "BUSINESS: provider enablement status is read back");
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

    private CreatedBinding createBinding(
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
        BackendAcceptanceTest.Response response = context.post(
                OWNER_BINDING_CREATE,
                channelPath(fixture.fixture(), channelRef) + "/owner-binding",
                fixture.session().cookie(),
                body,
                headers(),
                Set.of(200));
        JsonNode json = response.json();
        UUID bindingRef = UUID.fromString(
                requiredJsonNode(json, "/bindingRef", JsonNodeType.STRING, "BUSINESS: owner binding identity")
                        .asText());
        long version = requiredJsonNode(json, "/version", JsonNodeType.NUMBER, "BUSINESS: owner binding version")
                .asLong();
        return new CreatedBinding(bindingRef, version, json);
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

    private CreatedTemplate createTemplate(
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

    private CreatedTemplate createTemplateWithCode(
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
        String scope = "STORE".equals(operatorKind) ? "ALL_PROJECT_STORES" : null;
        return createTemplateWithVisibility(
                context,
                fixture,
                name,
                accessKind,
                operatorKind,
                orderKind,
                providerCode,
                dineInForm,
                templateCode,
                scope,
                List.of());
    }

    private CreatedTemplate createTemplateWithVisibility(
            BackendAcceptanceTest.ScenarioContext context,
            OperationsFixture fixture,
            String name,
            String accessKind,
            String operatorKind,
            String orderKind,
            String providerCode,
            String dineInForm,
            String templateCode,
            String storeVisibilityScope,
            List<UUID> visibleStoreRefs)
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
        body.put("storeVisibilityScope", storeVisibilityScope);
        body.put("visibleStoreRefs", visibleStoreRefs == null ? List.of() : visibleStoreRefs);
        BackendAcceptanceTest.Response response = context.post(
                TEMPLATE_CREATE,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/business-channel-templates",
                fixture.session().cookie(),
                body,
                headers(),
                Set.of(200));
        JsonNode json = response.json();
        UUID templateRef = UUID.fromString(
                requiredJsonNode(json, "/templateRef", JsonNodeType.STRING, "BUSINESS: channel template identity")
                        .asText());
        long version = requiredJsonNode(json, "/version", JsonNodeType.NUMBER, "BUSINESS: channel template version")
                .asLong();
        return new CreatedTemplate(templateRef, version, json);
    }

    private CreatedChannel createChannel(
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

    private CreatedChannel createChannelWithCode(
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
        BackendAcceptanceTest.Response response = context.post(
                CHANNEL_CREATE,
                "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/business-channels",
                fixture.session().cookie(),
                body,
                headers(),
                Set.of(200));
        JsonNode json = response.json();
        UUID channelRef =
                UUID.fromString(requiredJsonNode(json, "/channelRef", JsonNodeType.STRING, "BUSINESS: channel identity")
                        .asText());
        long version = requiredJsonNode(json, "/version", JsonNodeType.NUMBER, "BUSINESS: channel version")
                .asLong();
        return new CreatedChannel(channelRef, version, json);
    }

    private static String templatePath(BackendAcceptanceTest.Fixture fixture, UUID templateRef) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channel-templates/"
                + templateRef;
    }

    private static String templateCollectionPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channel-templates";
    }

    private static String businessChannelCollectionPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channels";
    }

    private static String storeChannelPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/business-channels?usage=SALES_MENU&pageSize=20";
    }

    private static String storeBusinessChannelPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/business-channels?usage=BUSINESS_CHANNEL";
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
