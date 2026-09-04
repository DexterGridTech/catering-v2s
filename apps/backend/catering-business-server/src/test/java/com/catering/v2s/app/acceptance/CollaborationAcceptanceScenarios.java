package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Real HTTP business oracles for the collaboration owner; adapter callbacks stay outside admin faces. */
final class CollaborationAcceptanceScenarios {
    private static final RouteIdentity TREE = new RouteIdentity(
            "getPlatformExternalCollaborationTree",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/external-collaboration");
    private static final RouteIdentity SYSTEM_DETAIL = new RouteIdentity(
            "getPlatformExternalSystemDetail",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}");
    private static final RouteIdentity PROVIDER_DETAIL = new RouteIdentity(
            "getPlatformProviderProfileDetail",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}");
    private static final RouteIdentity SYSTEM_STATUS = new RouteIdentity(
            "transitionPlatformExternalSystemStatus",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}/status");
    private static final RouteIdentity PROVIDER_STATUS = new RouteIdentity(
            "transitionPlatformProviderProfileStatus",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/status");
    private static final RouteIdentity PROVIDER_BINDINGS = new RouteIdentity(
            "getPlatformProviderProfileBindings",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/owner-bindings");
    private static final RouteIdentity BINDING_DETAIL = new RouteIdentity(
            "getPlatformOwnerBindingDetail",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}");
    private static final RouteIdentity BINDING_CREATE = new RouteIdentity(
            "createPlatformOwnerBinding", "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings");
    private static final RouteIdentity BINDING_UPDATE = new RouteIdentity(
            "updatePlatformOwnerBinding",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}");
    private static final RouteIdentity BINDING_DELETE = new RouteIdentity(
            "deletePlatformOwnerBinding",
            "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}");
    private static final RouteIdentity OPERATIONS_TEMPLATE_CREATE = new RouteIdentity(
            "createOperationsBusinessChannelTemplate",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates");
    private static final RouteIdentity OPERATIONS_CHANNEL_CREATE = new RouteIdentity(
            "createOperationsBusinessChannel",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels");
    private static final RouteIdentity OPERATIONS_OWNER_BINDING_CREATE = new RouteIdentity(
            "createOperationsOwnerBinding",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");
    private static final RouteIdentity CAPABILITY_DICTIONARY = new RouteIdentity(
            "getPlatformExternalCapabilityDictionary", "/api/platform/external-capability-dictionary");
    private static final RouteIdentity OPERATIONS_CAPABILITY_DICTIONARY = new RouteIdentity(
            "getOperationsExternalCapabilityDictionary", "/api/operations/external-capability-dictionary");
    private static final RouteIdentity OPERATIONS_PROVIDER_CANDIDATES = new RouteIdentity(
            "getOperationsExternalProviderCandidates",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/external-provider-candidates");
    private static final RouteIdentity OPERATIONS_BINDING_DETAIL = new RouteIdentity(
            "getOperationsOwnerBindingDetail",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");
    private static final RouteIdentity OPERATIONS_BINDING_DELETE = new RouteIdentity(
            "deleteOperationsOwnerBinding",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}/owner-binding");

    private final BackendAcceptanceTest host;

    private record BindingResult(int status, String problemCode, JsonNode json) {}

    CollaborationAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(id = "collaboration.catalog-readback", module = "COLLABORATION", operation = "catalogReadback")
    void catalogReadback(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session session = host.platformLogin(context);
        String prefix = "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey();

        BackendAcceptanceTest.Response tree =
                context.get(TREE, prefix + "/external-collaboration", session.cookie(), Set.of(200));
        ArrayNode expectedProviderScope = arrayText("TAKEAWAY");
        ArrayNode expectedBindableNodeTypes =
                arrayText("COMMERCIAL_GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE");
        oracleEquals(
                tree.json(),
                "getPlatformExternalCollaborationTree",
                "/externalSystems/0/externalSystemCode",
                text("MEITUAN"),
                JsonNodeType.STRING,
                "BUSINESS: tree keeps the checked-in external-system code");
        oracleEquals(
                tree.json(),
                "getPlatformExternalCollaborationTree",
                "/providerProfiles/0/businessScope",
                expectedProviderScope,
                JsonNodeType.ARRAY,
                "BUSINESS: tree keeps provider business-scope order");
        oracleEquals(
                tree.json(),
                "getPlatformExternalCollaborationTree",
                "/providerProfiles/0/bindableNodeTypes",
                expectedBindableNodeTypes,
                JsonNodeType.ARRAY,
                "BUSINESS: tree keeps the complete bindable-node set");
        JsonNode meituan = find(tree.json().path("externalSystems"), "externalSystemCode", "MEITUAN");
        JsonNode provider = find(tree.json().path("providerProfiles"), "providerCode", "MEITUAN_ISV_A");
        assertEquals("美团", meituan.path("displayName").asText(), "BUSINESS: system display name is read back");
        assertEquals(
                checkedInCatalogStatus("externalSystems", "externalSystemCode", "MEITUAN"),
                meituan.path("catalogStatus").asText(),
                "BUSINESS: system catalog status is read back from the checked-in catalog");
        assertEquals(
                checkedInCatalogStatus("providerProfiles", "providerCode", "MEITUAN_ISV_A"),
                provider.path("catalogStatus").asText(),
                "BUSINESS: provider catalog status is read back from the checked-in catalog");
        assertEquals(
                "EXTERNAL_GRANT",
                provider.path("authenticationKind").asText(),
                "BUSINESS: provider auth kind is read back");
        JsonNode groupBuyCapability = find(meituan.path("capabilities"), "capabilityClass", "GROUP_BUY");
        assertEquals(
                "EXTERNAL_TO_INTERNAL",
                groupBuyCapability
                        .path("attributeValues")
                        .path("groupBuyMappingDirection")
                        .asText(),
                "BUSINESS: typed capability attribute fact is read back");
        assertFalse(meituan.has("attributeDictionary"), "BUSINESS: descriptor presentation payload is retired");
        assertFalse(groupBuyCapability.has("attributeValueLabels"), "BUSINESS: attribute label projection is retired");
        assertFalse(
                tree.raw().contains("authorizationRef"), "BUSINESS: technical authorization reference is not exposed");
        assertFalse(tree.raw().contains("token"), "BUSINESS: token material is not exposed");

        BackendAcceptanceTest.Response detail =
                context.get(SYSTEM_DETAIL, prefix + "/external-systems/MEITUAN", session.cookie(), Set.of(200));
        oracleEquals(
                detail.json(),
                "getPlatformExternalSystemDetail",
                "/externalSystemCode",
                text("MEITUAN"),
                JsonNodeType.STRING,
                "BUSINESS: system detail identity is owner readback");
        oracleEquals(
                detail.json(),
                "getPlatformExternalSystemDetail",
                "/capabilities/0/capabilityClass",
                text("GROUP_BUY"),
                JsonNodeType.STRING,
                "BUSINESS: system detail keeps capability identity");
        oracleEquals(
                detail.json(),
                "getPlatformExternalSystemDetail",
                "/capabilities/0/attributeValues/groupBuyMappingDirection",
                text("EXTERNAL_TO_INTERNAL"),
                JsonNodeType.STRING,
                "BUSINESS: system detail keeps typed capability direction");
        BackendAcceptanceTest.Response providerDetail = context.get(
                PROVIDER_DETAIL, prefix + "/provider-profiles/MEITUAN_ISV_A", session.cookie(), Set.of(200));
        oracleEquals(
                providerDetail.json(),
                "getPlatformProviderProfileDetail",
                "/providerCode",
                text("MEITUAN_ISV_A"),
                JsonNodeType.STRING,
                "BUSINESS: provider detail identity is owner readback");
        oracleEquals(
                providerDetail.json(),
                "getPlatformProviderProfileDetail",
                "/businessScope",
                expectedProviderScope,
                JsonNodeType.ARRAY,
                "BUSINESS: provider detail keeps business-scope order");
        oracleEquals(
                providerDetail.json(),
                "getPlatformProviderProfileDetail",
                "/bindableNodeTypes",
                expectedBindableNodeTypes,
                JsonNodeType.ARRAY,
                "BUSINESS: provider detail keeps the complete bindable-node set");
        oracleEquals(
                providerDetail.json(),
                "getPlatformProviderProfileDetail",
                "/authenticationKind",
                text("EXTERNAL_GRANT"),
                JsonNodeType.STRING,
                "BUSINESS: provider detail keeps authentication policy");
        BackendAcceptanceTest.Response dictionary = context.get(
                CAPABILITY_DICTIONARY, "/api/platform/external-capability-dictionary", session.cookie(), Set.of(200));
        oracleEquals(
                dictionary.json(),
                "getPlatformExternalCapabilityDictionary",
                "/externalSystems/0/externalSystemCode",
                text("MEITUAN"),
                JsonNodeType.STRING,
                "BUSINESS: platform dictionary keeps the first system code");
        oracleEquals(
                dictionary.json(),
                "getPlatformExternalCapabilityDictionary",
                "/externalSystems/0/capabilities/0/capabilityClass",
                text("GROUP_BUY"),
                JsonNodeType.STRING,
                "BUSINESS: platform dictionary keeps the first capability code");
        oracleEquals(
                dictionary.json(),
                "getPlatformExternalCapabilityDictionary",
                "/providerProfiles/0/businessScope",
                expectedProviderScope,
                JsonNodeType.ARRAY,
                "BUSINESS: platform dictionary keeps provider scope order");

        enableProvider(context, fixture, "MEITUAN_ISV_A");
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        BackendAcceptanceTest.Response operationsDictionary = context.get(
                OPERATIONS_CAPABILITY_DICTIONARY,
                "/api/operations/external-capability-dictionary",
                operations.cookie(),
                Set.of(200));
        oracleEquals(
                operationsDictionary.json(),
                "getOperationsExternalCapabilityDictionary",
                "/externalSystems/0/externalSystemCode",
                text("MEITUAN"),
                JsonNodeType.STRING,
                "BUSINESS: operations dictionary keeps the first system code");
        oracleEquals(
                operationsDictionary.json(),
                "getOperationsExternalCapabilityDictionary",
                "/providerProfiles/0/businessScope",
                expectedProviderScope,
                JsonNodeType.ARRAY,
                "BUSINESS: operations dictionary keeps provider scope order");
        oracleEquals(
                operationsDictionary.json(),
                "getOperationsExternalCapabilityDictionary",
                "/providerProfiles/0/bindableNodeTypes",
                expectedBindableNodeTypes,
                JsonNodeType.ARRAY,
                "BUSINESS: operations dictionary keeps bindable node order");
        BackendAcceptanceTest.Response candidates = context.get(
                OPERATIONS_PROVIDER_CANDIDATES,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/external-provider-candidates",
                operations.cookie(),
                Set.of(200));
        oracleEquals(
                candidates.json(),
                "getOperationsExternalProviderCandidates",
                "/items/0/providerCode",
                text("MEITUAN_ISV_A"),
                JsonNodeType.STRING,
                "BUSINESS: enabled provider candidate keeps provider identity");
        oracleEquals(
                candidates.json(),
                "getOperationsExternalProviderCandidates",
                "/items/0/businessScope",
                expectedProviderScope,
                JsonNodeType.ARRAY,
                "BUSINESS: enabled provider candidate keeps scope order");
        oracleEquals(
                candidates.json(),
                "getOperationsExternalProviderCandidates",
                "/items/0/bindableNodeTypes",
                expectedBindableNodeTypes,
                JsonNodeType.ARRAY,
                "BUSINESS: enabled provider candidate keeps bindable-node order");
    }

    @AcceptanceScenario(
            id = "collaboration.planned-profile-enablement",
            module = "COLLABORATION",
            operation = "plannedProfileEnablement")
    void plannedProfileEnablement(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        BackendAcceptanceTest.Response before = context.get(
                PROVIDER_DETAIL,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/provider-profiles/MEITUAN_ISV_A",
                platform.cookie(),
                Set.of(200));
        assertEquals(
                "PLANNED",
                before.json().path("catalogStatus").asText(),
                "BUSINESS: PLANNED is catalogue information only");
        BackendAcceptanceTest.Response enabled = context.post(
                PROVIDER_STATUS,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey()
                        + "/provider-profiles/MEITUAN_ISV_A/status",
                platform.cookie(),
                Map.of(
                        "status",
                        "ENABLED",
                        "expectedVersion",
                        before.json().path("version").asLong()),
                headers(),
                Set.of(200));
        assertEquals(
                "ENABLED",
                enabled.json().path("enablementStatus").asText(),
                "BUSINESS: PLANNED provider can be enabled");
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session operations = host.login(context, fixture);
        BackendAcceptanceTest.Response candidates = context.get(
                new RouteIdentity(
                        "getOperationsExternalProviderCandidates",
                        "/api/operations/group-workspaces/{groupWorkspaceKey}/external-provider-candidates"),
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/external-provider-candidates",
                operations.cookie(),
                Set.of(200));
        assertNotNull(
                find(candidates.json().path("items"), "providerCode", "MEITUAN_ISV_A"),
                "BUSINESS: enabled PLANNED provider enters candidates");
    }

    @AcceptanceScenario(
            id = "collaboration.bindable-node-candidates",
            module = "COLLABORATION",
            operation = "bindableNodeCandidates")
    void bindableNodeCandidates(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        BackendAcceptanceTest.Response provider = context.get(
                PROVIDER_DETAIL,
                "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/provider-profiles/MEITUAN_ISV_B",
                platform.cookie(),
                Set.of(200));
        Set<String> expected = Set.of("COMMERCIAL_GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE");
        Set<String> actual = new HashSet<>();
        provider.json().path("bindableNodeTypes").forEach(value -> actual.add(value.asText()));
        assertEquals(expected, actual, "BUSINESS: provider candidates expose exactly the five bindable node types");
        assertNotNull(fixture.storeId(), "BUSINESS: store fixture has a real owner identity");
        BackendAcceptanceTest.Response storeCandidates = context.get(
                OPERATIONS_ORGANIZATION_CANDIDATES,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey()
                        + "/organization/candidates?subjectType=STORE&candidateUsage=EXTERNAL_BINDING"
                        + "&expectedContextVersion=1&page=1&pageSize=10",
                null,
                Set.of(401));
        assertEquals(401, storeCandidates.status(), "CONTRACT: unauthenticated candidate access is rejected");
    }

    @AcceptanceScenario(
            id = "collaboration.binding-page-searches-node-name",
            module = "COLLABORATION",
            operation = "bindingPageNodeNameSearch")
    void bindingPageSearchesNodeName(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PlatformFixture fixture = platformFixture(context, "STORE");
        enableProvider(context, fixture.fixture(), "MEMBERSHIP_COUPON_STORE");
        BindingResult binding = createBinding(
                context,
                fixture,
                "MEMBERSHIP_COUPON_STORE",
                null,
                "STORE",
                fixture.fixture().storeId(),
                null);
        ArrayNode expectedNodePath = path(
                pathNode(fixture.fixture().regionId(), "acceptance-region", "Acceptance Region", "REGION"),
                pathNode(fixture.fixture().projectId(), "acceptance-project", "Acceptance Project", "PROJECT"),
                pathNode(fixture.fixture().storeId(), "acceptance-store", "Acceptance Store", "STORE"));
        ArrayNode expectedBusinessScope = arrayText("MEMBER_BENEFIT");
        oracleEquals(
                binding.json(),
                "createPlatformOwnerBinding",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: platform create returns the exact ordered store path");
        oracleEquals(
                binding.json(),
                "createPlatformOwnerBinding",
                "/status",
                text("EFFECTIVE"),
                JsonNodeType.STRING,
                "BUSINESS: platform create returns effective binding status");
        oracleEquals(
                binding.json(),
                "createPlatformOwnerBinding",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: platform create returns provider scope codes");
        oracleNull(
                binding.json(),
                "createPlatformOwnerBinding",
                "/capabilityClass",
                "BUSINESS: NO_MAPPING platform create returns an exact null capability");
        UUID bindingRef = UUID.fromString(binding.json().path("bindingRef").asText());
        BackendAcceptanceTest.Response detail = context.get(
                BINDING_DETAIL,
                bindingPath(fixture.fixture(), bindingRef),
                fixture.session().cookie(),
                Set.of(200));
        oracleEquals(
                detail.json(),
                "getPlatformOwnerBindingDetail",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: platform detail returns the exact ordered store path");
        oracleEquals(
                detail.json(),
                "getPlatformOwnerBindingDetail",
                "/status",
                text("EFFECTIVE"),
                JsonNodeType.STRING,
                "BUSINESS: platform detail returns effective binding status");
        oracleEquals(
                detail.json(),
                "getPlatformOwnerBindingDetail",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: platform detail returns provider scope codes");
        oracleNull(
                detail.json(),
                "getPlatformOwnerBindingDetail",
                "/capabilityClass",
                "BUSINESS: NO_MAPPING platform detail returns an exact null capability");
        JsonNode nodePath = requiredJsonNode(
                binding.json(), "/nodePath", JsonNodeType.ARRAY, "BUSINESS: owner binding structured node path");
        assertTrue(nodePath.size() >= 2, "BUSINESS: store node path includes an ancestor and leaf");
        assertJsonNodeEquals(
                binding.json(),
                "/nodePath",
                path(
                        pathNode(fixture.fixture().regionId(), "acceptance-region", "Acceptance Region", "REGION"),
                        pathNode(fixture.fixture().projectId(), "acceptance-project", "Acceptance Project", "PROJECT"),
                        pathNode(fixture.fixture().storeId(), "acceptance-store", "Acceptance Store", "STORE")),
                "BUSINESS: owner binding returns the exact ordered organization path facts");
        String ancestorPathSegment = nodePath.get(0).path("name").asText();
        String leafPathSegment = nodePath.get(nodePath.size() - 1).path("name").asText();
        assertFalse(ancestorPathSegment.isBlank(), "BUSINESS: ancestor path node has a name");
        assertFalse(leafPathSegment.isBlank(), "BUSINESS: leaf path node has a name");
        assertFalse(
                ancestorPathSegment.equals(leafPathSegment),
                "BUSINESS: ancestor path search is distinct from the leaf-name search");
        BackendAcceptanceTest.Response unfilteredPage = context.get(
                PROVIDER_BINDINGS,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/provider-profiles/MEMBERSHIP_COUPON_STORE/owner-bindings?page=1&pageSize=10",
                fixture.session().cookie(),
                Set.of(200));
        assertNotNull(
                findOrNull(
                        unfilteredPage.json().path("items"),
                        "bindingRef",
                        binding.json().path("bindingRef").asText()),
                "BUSINESS: unfiltered provider binding page contains the created binding; items="
                        + bindingRefs(unfilteredPage.json().path("items"))
                        + ", metadata=" + unfilteredPage.json().path("metadata"));
        oracleEquals(
                unfilteredPage.json(),
                "getPlatformProviderProfileBindings",
                "/items/0/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: provider page returns the exact ordered store path");
        oracleEquals(
                unfilteredPage.json(),
                "getPlatformProviderProfileBindings",
                "/items/0/status",
                text("EFFECTIVE"),
                JsonNodeType.STRING,
                "BUSINESS: provider page returns effective binding status");
        oracleEquals(
                unfilteredPage.json(),
                "getPlatformProviderProfileBindings",
                "/items/0/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: provider page returns provider scope codes");
        oracleNull(
                unfilteredPage.json(),
                "getPlatformProviderProfileBindings",
                "/items/0/capabilityClass",
                "BUSINESS: provider page preserves the exact null capability");
        BackendAcceptanceTest.Response page = context.get(
                PROVIDER_BINDINGS,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/provider-profiles/MEMBERSHIP_COUPON_STORE/owner-bindings?nodeQueryText="
                        + URLEncoder.encode(ancestorPathSegment, StandardCharsets.UTF_8)
                        + "&page=1&pageSize=10",
                fixture.session().cookie(),
                Set.of(200));
        assertNotNull(
                findOrNull(
                        page.json().path("items"),
                        "bindingRef",
                        binding.json().path("bindingRef").asText()),
                "BUSINESS: provider binding page searches an owner-resolved ancestor path segment; query="
                        + ancestorPathSegment + ", items="
                        + bindingRefs(page.json().path("items"))
                        + ", metadata=" + page.json().path("metadata"));
        assertTrue(
                page.json().path("metadata").path("total").asLong() >= 1,
                "BUSINESS: ancestor-path query total is real");
        assertEquals(
                ancestorPathSegment,
                page.json().path("metadata").path("nodeQueryText").asText(),
                "CONTRACT: node query is independently echoed in page metadata");

        BackendAcceptanceTest.Response bindingNamePage = context.get(
                PROVIDER_BINDINGS,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/provider-profiles/MEMBERSHIP_COUPON_STORE/owner-bindings?bindingName="
                        + URLEncoder.encode("MEMBERSHIP_COUPON_STORE STORE", StandardCharsets.UTF_8)
                        + "&page=1&pageSize=10",
                fixture.session().cookie(),
                Set.of(200));
        assertNotNull(
                findOrNull(
                        bindingNamePage.json().path("items"),
                        "bindingRef",
                        binding.json().path("bindingRef").asText()),
                "BUSINESS: binding-name search is independent from node search");
        assertEquals(
                "MEMBERSHIP_COUPON_STORE STORE",
                bindingNamePage.json().path("metadata").path("bindingName").asText(),
                "CONTRACT: binding-name query is independently echoed in page metadata");

        BackendAcceptanceTest.Response sorted = context.get(
                PROVIDER_BINDINGS,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/provider-profiles/MEMBERSHIP_COUPON_STORE/owner-bindings?sortKey=BINDING_NAME"
                        + "&sortDirection=ASC"
                        + "&page=1&pageSize=1",
                fixture.session().cookie(),
                Set.of(200));
        assertEquals(
                "BINDING_NAME", sorted.json().path("metadata").path("sortKey").asText());
        assertEquals("ASC", sorted.json().path("metadata").path("sortDirection").asText());
        assertEquals(1, sorted.json().path("metadata").path("pageSize").asInt());
        assertEquals(1, sorted.json().path("items").size(), "BUSINESS: server pagination returns one requested row");
    }

    @AcceptanceScenario(
            id = "collaboration.platform-external-grant-create-rejected",
            module = "COLLABORATION",
            operation = "platformExternalGrantCreateRejected")
    void platformExternalGrantCreateRejected(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PlatformFixture fixture = platformFixture(context, "STORE");
        String providerPath = "/api/platform/group-workspaces/"
                + fixture.fixture().groupWorkspaceKey() + "/provider-profiles/MEITUAN_ISV_A/owner-bindings?pageSize=20";
        BackendAcceptanceTest.Response before =
                context.get(PROVIDER_BINDINGS, providerPath, fixture.session().cookie(), Set.of(200));
        BindingResult rejected = createBinding(
                context,
                fixture,
                "MEITUAN_ISV_A",
                "TAKEAWAY",
                "STORE",
                fixture.fixture().storeId(),
                null,
                Set.of(403));
        assertEquals(
                "BINDING_EDIT_NOT_ALLOWED",
                rejected.problemCode(),
                "BUSINESS: platform-admin cannot create an EXTERNAL_GRANT binding");
        BackendAcceptanceTest.Response after =
                context.get(PROVIDER_BINDINGS, providerPath, fixture.session().cookie(), Set.of(200));
        assertEquals(
                before.json().path("metadata").path("total").asLong(),
                after.json().path("metadata").path("total").asLong(),
                "BUSINESS: rejected platform create does not create a binding row");
    }

    @AcceptanceScenario(
            id = "collaboration.internal-and-no-mapping",
            module = "COLLABORATION",
            operation = "internalAndNoMapping")
    void internalAndNoMapping(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PlatformFixture fixture = platformFixture(context, "STORE");
        enableProvider(context, fixture.fixture(), "SHOPPING_MALL_ERP_DEFAULT");
        enableProvider(context, fixture.fixture(), "MEMBERSHIP_COUPON_STORE");
        BindingResult internal = createBinding(
                context,
                fixture,
                "SHOPPING_MALL_ERP_DEFAULT",
                null,
                "COMMERCIAL_GROUP",
                fixture.fixture().groupId(),
                "ERP-GROUP-1");
        assertEquals(
                "EFFECTIVE",
                internal.json().path("status").asText(),
                "BUSINESS: INTERNAL_MAPPING is effective with its owner id");
        assertTrue(
                internal.json().path("capabilityClass").isMissingNode()
                        || internal.json().path("capabilityClass").isNull(),
                "BUSINESS: INTERNAL_MAPPING does not persist a capability class");
        assertTrue(
                internal.json().path("businessScope").toString().contains("ORDER_SYNC"),
                "BUSINESS: INTERNAL_MAPPING exposes provider business scope codes");
        BindingResult noMapping = createBinding(
                context,
                fixture,
                "MEMBERSHIP_COUPON_STORE",
                null,
                "STORE",
                fixture.fixture().storeId(),
                null);
        assertEquals(
                "EFFECTIVE",
                noMapping.json().path("status").asText(),
                "BUSINESS: NO_MAPPING is effective without an owner id");
        assertTrue(
                noMapping.json().path("externalOwnerId").isMissingNode()
                        || noMapping.json().path("externalOwnerId").isNull(),
                "BUSINESS: NO_MAPPING has no external owner id");
        assertTrue(
                noMapping.json().path("capabilityClass").isMissingNode()
                        || noMapping.json().path("capabilityClass").isNull(),
                "BUSINESS: NO_MAPPING does not persist a capability class");
        assertTrue(
                noMapping.json().path("businessScope").toString().contains("MEMBER_BENEFIT"),
                "BUSINESS: NO_MAPPING exposes provider business scope codes");

        BindingResult internalMissingOwner = createBinding(
                context,
                fixture,
                "SHOPPING_MALL_ERP_DEFAULT",
                null,
                "COMMERCIAL_GROUP",
                fixture.fixture().groupId(),
                null,
                Set.of(422));
        assertEquals(
                "EXTERNAL_OWNER_ID_MISMATCH",
                internalMissingOwner.problemCode(),
                "BUSINESS: INTERNAL_MAPPING requires an external owner id");
        BindingResult noMappingWithOwner = createBinding(
                context,
                fixture,
                "MEMBERSHIP_COUPON_STORE",
                null,
                "STORE",
                fixture.fixture().storeId(),
                "forbidden-owner",
                Set.of(422));
        assertEquals(
                "EXTERNAL_OWNER_ID_MISMATCH",
                noMappingWithOwner.problemCode(),
                "BUSINESS: NO_MAPPING rejects an external owner id");
    }

    @AcceptanceScenario(
            id = "collaboration.provider-binding-edit-policy",
            module = "COLLABORATION",
            operation = "providerBindingEditPolicy")
    void providerBindingEditPolicy(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PlatformFixture fixture = platformFixture(context, "STORE");
        enableProvider(context, fixture.fixture(), "SHOPPING_MALL_ERP_DEFAULT");
        BindingResult binding = createBinding(
                context,
                fixture,
                "SHOPPING_MALL_ERP_DEFAULT",
                null,
                "COMMERCIAL_GROUP",
                fixture.fixture().groupId(),
                "ERP-GROUP-1");
        UUID bindingRef = UUID.fromString(binding.json().path("bindingRef").asText());
        BackendAcceptanceTest.Response updated = context.patch(
                BINDING_UPDATE,
                bindingPath(fixture.fixture(), bindingRef),
                fixture.session().cookie(),
                Map.of(
                        "bindingDisplayName",
                        "edited internal mapping",
                        "externalOwnerId",
                        "ERP-GROUP-2",
                        "expectedVersion",
                        binding.json().path("version").asLong()),
                headers(),
                Set.of(200));
        ArrayNode expectedNodePath =
                path(pathNode(fixture.fixture().groupId(), "ACCEPTANCE-ROOT", "Acceptance root", "GROUP"));
        ArrayNode expectedBusinessScope = arrayText("ORDER_SYNC");
        oracleEquals(
                updated.json(),
                "updatePlatformOwnerBinding",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: platform update preserves the exact ordered store path");
        oracleEquals(
                updated.json(),
                "updatePlatformOwnerBinding",
                "/status",
                text("EFFECTIVE"),
                JsonNodeType.STRING,
                "BUSINESS: platform update preserves effective binding status");
        oracleEquals(
                updated.json(),
                "updatePlatformOwnerBinding",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: platform update preserves provider scope codes");
        oracleNull(
                updated.json(),
                "updatePlatformOwnerBinding",
                "/capabilityClass",
                "BUSINESS: INTERNAL_MAPPING platform update keeps capability null");
        assertEquals(
                "edited internal mapping",
                updated.json().path("bindingDisplayName").asText(),
                "BUSINESS: non-grant binding display name follows platform owner update policy");
        assertEquals(
                "ERP-GROUP-2",
                updated.json().path("externalOwnerId").asText(),
                "BUSINESS: INTERNAL_MAPPING owner id follows platform owner update policy");
        BackendAcceptanceTest.Response bindings = context.get(
                PROVIDER_BINDINGS,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                        + "/provider-profiles/SHOPPING_MALL_ERP_DEFAULT/owner-bindings?pageSize=20",
                fixture.session().cookie(),
                Set.of(200));
        assertTrue(
                bindings.json().path("items").toString().contains(bindingRef.toString()),
                "BUSINESS: updated non-grant binding remains visible");
    }

    @AcceptanceScenario(
            id = "collaboration.logical-delete-retains-row",
            module = "COLLABORATION",
            operation = "logicalDeleteRetainsRow")
    void logicalDeleteRetainsRow(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PlatformFixture fixture = platformFixture(context, "STORE");
        enableProvider(context, fixture.fixture(), "MEMBERSHIP_COUPON_STORE");
        BindingResult binding = createBinding(
                context,
                fixture,
                "MEMBERSHIP_COUPON_STORE",
                null,
                "STORE",
                fixture.fixture().storeId(),
                null);
        UUID bindingRef = UUID.fromString(binding.json().path("bindingRef").asText());
        BackendAcceptanceTest.Response deleted = context.delete(
                BINDING_DELETE,
                bindingPath(fixture.fixture(), bindingRef),
                fixture.session().cookie(),
                Map.of("expectedVersion", binding.json().path("version").asLong()),
                Set.of(200));
        ArrayNode expectedNodePath = path(
                pathNode(fixture.fixture().regionId(), "acceptance-region", "Acceptance Region", "REGION"),
                pathNode(fixture.fixture().projectId(), "acceptance-project", "Acceptance Project", "PROJECT"),
                pathNode(fixture.fixture().storeId(), "acceptance-store", "Acceptance Store", "STORE"));
        ArrayNode expectedBusinessScope = arrayText("MEMBER_BENEFIT");
        oracleEquals(
                deleted.json(),
                "deletePlatformOwnerBinding",
                "/nodePath",
                expectedNodePath,
                JsonNodeType.ARRAY,
                "BUSINESS: platform delete preserves the exact ordered organization path");
        oracleEquals(
                deleted.json(),
                "deletePlatformOwnerBinding",
                "/status",
                text("DELETED"),
                JsonNodeType.STRING,
                "BUSINESS: platform delete returns the terminal binding status");
        oracleEquals(
                deleted.json(),
                "deletePlatformOwnerBinding",
                "/businessScope",
                expectedBusinessScope,
                JsonNodeType.ARRAY,
                "BUSINESS: platform delete preserves provider scope codes");
        assertEquals(
                "DELETED",
                deleted.json().path("status").asText(),
                "BUSINESS: local unbind transitions to logical DELETED");
        BackendAcceptanceTest.Response retained = context.get(
                BINDING_DETAIL,
                bindingPath(fixture.fixture(), bindingRef),
                fixture.session().cookie(),
                Set.of(200));
        assertEquals(
                bindingRef.toString(),
                retained.json().path("bindingRef").asText(),
                "BUSINESS: logical delete retains owner identity for readback");
        assertEquals("DELETED", retained.json().path("status").asText(), "BUSINESS: retained row is visibly deleted");
    }

    @AcceptanceScenario(
            id = "collaboration.adapter-unbind-required",
            module = "COLLABORATION",
            operation = "adapterUnbindRequired")
    void adapterUnbindRequired(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        OperationsFixture fixture = operationsStoreFixture(context);
        JsonNode binding = createOperationsExternalBinding(context, fixture);
        UUID bindingRef = UUID.fromString(binding.path("bindingRef").asText());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        BackendAcceptanceTest.Response rejected = context.delete(
                BINDING_DELETE,
                bindingPath(fixture.fixture(), bindingRef),
                platform.cookie(),
                Map.of("expectedVersion", binding.path("version").asLong()),
                Set.of(409));
        assertEquals(
                "ADAPTER_UNBIND_REQUIRED",
                rejected.problemCode(),
                "BUSINESS: adapter unbind is required before logical delete");
        BackendAcceptanceTest.Response retained =
                context.get(BINDING_DETAIL, bindingPath(fixture.fixture(), bindingRef), platform.cookie(), Set.of(200));
        assertNotEquals(
                "DELETED",
                retained.json().path("status").asText(),
                "BUSINESS: failed adapter unbind does not delete the row");
    }

    private PlatformFixture platformFixture(BackendAcceptanceTest.ScenarioContext context, String targetType)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture(targetType, Set.of());
        host.ensurePlatformAdministrator();
        return new PlatformFixture(fixture, host.platformLogin(context));
    }

    private BindingResult createBinding(
            BackendAcceptanceTest.ScenarioContext context,
            PlatformFixture fixture,
            String providerCode,
            String capabilityClass,
            String nodeType,
            UUID nodeRef,
            String externalOwnerId)
            throws Exception {
        return createBinding(
                context, fixture, providerCode, capabilityClass, nodeType, nodeRef, externalOwnerId, Set.of(200));
    }

    private BindingResult createBinding(
            BackendAcceptanceTest.ScenarioContext context,
            PlatformFixture fixture,
            String providerCode,
            String capabilityClass,
            String nodeType,
            UUID nodeRef,
            String externalOwnerId,
            Set<Integer> expectedStatuses)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("providerCode", providerCode);
        if (capabilityClass != null) body.put("capabilityClass", capabilityClass);
        body.put("nodeType", nodeType);
        body.put("nodeRef", nodeRef.toString());
        body.put("bindingDisplayName", providerCode + " " + nodeType);
        body.put("externalOwnerId", externalOwnerId);
        BackendAcceptanceTest.Response response = context.post(
                BINDING_CREATE,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/owner-bindings",
                fixture.session().cookie(),
                body,
                headers(),
                expectedStatuses);
        return new BindingResult(response.status(), response.problemCode(), response.json());
    }

    private OperationsFixture operationsStoreFixture(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session login = host.login(context, fixture);
        String root = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response selected = context.post(
                OPERATIONS_WORKSPACE_SESSION_DATA_NODE,
                root + "/session/data-node",
                login.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId(),
                        "dataNodeType", "STORE",
                        "requiredContextVersion", login.contextVersion()),
                headers(),
                Set.of(200));
        assertEquals(
                fixture.storeId().toString(),
                selected.json()
                        .path("scopeContext")
                        .path("store")
                        .path("dataNodeRef")
                        .asText(),
                "BUSINESS: operations session selects the claimed store node");
        return new OperationsFixture(
                fixture,
                new BackendAcceptanceTest.Session(
                        login.cookie(),
                        selected.json(),
                        selected.json().path("contextVersion").asLong()));
    }

    private JsonNode createOperationsExternalBinding(
            BackendAcceptanceTest.ScenarioContext context, OperationsFixture fixture) throws Exception {
        enableProvider(context, fixture.fixture(), "MEITUAN_ISV_A");
        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(fixture.fixture(), Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        OperationsFixture projectOwner = new OperationsFixture(projectFixture, host.login(context, projectFixture));
        String root = "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey();
        Map<String, Object> templateBody = new LinkedHashMap<>();
        templateBody.put("projectRef", fixture.fixture().projectId().toString());
        templateBody.put("templateName", "Adapter unbind test");
        templateBody.put("templateCode", "TPL-ADAPTER-" + UUID.randomUUID());
        templateBody.put("accessKind", "EXTERNAL");
        templateBody.put("operatorKind", "STORE");
        templateBody.put("orderKind", "TAKEAWAY");
        templateBody.put("dineInForm", null);
        templateBody.put("providerCode", "MEITUAN_ISV_A");
        BackendAcceptanceTest.Response template = context.post(
                OPERATIONS_TEMPLATE_CREATE,
                root + "/business-channel-templates",
                projectOwner.session().cookie(),
                templateBody,
                headers(),
                Set.of(200));
        Map<String, Object> channelBody = new LinkedHashMap<>();
        channelBody.put("templateRef", template.json().path("templateRef").asText());
        channelBody.put("ownerNodeType", "STORE");
        channelBody.put("ownerNodeRef", fixture.fixture().storeId().toString());
        channelBody.put("channelCode", "CH-ADAPTER-" + UUID.randomUUID());
        channelBody.put("channelName", "Adapter unbind channel");
        channelBody.put("bindingRef", null);
        BackendAcceptanceTest.Response channel = context.post(
                OPERATIONS_CHANNEL_CREATE,
                root + "/business-channels",
                fixture.session().cookie(),
                channelBody,
                headers(),
                Set.of(200));
        Map<String, Object> bindingBody = new LinkedHashMap<>();
        bindingBody.put("providerCode", "MEITUAN_ISV_A");
        bindingBody.put("capabilityClass", "TAKEAWAY");
        bindingBody.put("nodeType", "STORE");
        bindingBody.put("nodeRef", fixture.fixture().storeId().toString());
        bindingBody.put("bindingDisplayName", "Adapter unbind binding");
        bindingBody.put("externalOwnerId", null);
        return context.post(
                        OPERATIONS_OWNER_BINDING_CREATE,
                        root + "/business-channels/"
                                + channel.json().path("channelRef").asText() + "/owner-binding",
                        fixture.session().cookie(),
                        bindingBody,
                        headers(),
                        Set.of(200))
                .json();
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

    private static String bindingPath(BackendAcceptanceTest.Fixture fixture, UUID bindingRef) {
        return "/api/platform/group-workspaces/" + fixture.groupWorkspaceKey() + "/owner-bindings/" + bindingRef;
    }

    private static Map<String, String> headers() {
        return Map.of("Idempotency-Key", "acceptance-" + UUID.randomUUID());
    }

    private static JsonNode find(JsonNode values, String field, String expected) {
        for (JsonNode value : values) if (expected.equals(value.path(field).asText())) return value;
        fail("BUSINESS: missing " + field + "=" + expected);
        return null;
    }

    private static JsonNode findOrNull(JsonNode values, String field, String expected) {
        for (JsonNode value : values) if (expected.equals(value.path(field).asText())) return value;
        return null;
    }

    private static List<String> bindingRefs(JsonNode values) {
        List<String> refs = new ArrayList<>();
        values.forEach(value -> refs.add(value.path("bindingRef").asText("<missing>")));
        return refs;
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

    private static JsonNode oracle(
            JsonNode json, String operationId, String pointer, JsonNodeType expectedType, String message) {
        JsonNode value = json.at(pointer);
        assertFalse(value.isMissingNode(), message + ": operation=" + operationId + ", missing pointer=" + pointer);
        assertEquals(
                expectedType,
                value.getNodeType(),
                message + ": operation=" + operationId + ", wrong JSON type at=" + pointer);
        return value;
    }

    private static void oracleEquals(
            JsonNode json,
            String operationId,
            String pointer,
            JsonNode expected,
            JsonNodeType expectedType,
            String message) {
        assertEquals(expected, oracle(json, operationId, pointer, expectedType, message), message + ": exact value");
    }

    private static void oracleNull(JsonNode json, String operationId, String pointer, String message) {
        oracle(json, operationId, pointer, JsonNodeType.NULL, message);
    }

    private static ObjectNode pathNode(UUID ref, String code, String name, String nodeType) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        result.put("ref", ref.toString());
        result.put("code", code);
        result.put("name", name);
        result.put("nodeType", nodeType);
        return result;
    }

    private static String checkedInCatalogStatus(String collection, String key, String expected) throws Exception {
        try (InputStream source = CollaborationAcceptanceScenarios.class
                .getClassLoader()
                .getResourceAsStream("external-platform-catalog.json")) {
            assertNotNull(source, "BUSINESS: checked-in collaboration catalog is available to acceptance");
            JsonNode catalog = new ObjectMapper().readTree(source);
            return find(catalog.path(collection), key, expected)
                    .path("catalogStatus")
                    .asText();
        }
    }

    private record OperationsFixture(BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session) {}

    private record PlatformFixture(BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session) {}
}
