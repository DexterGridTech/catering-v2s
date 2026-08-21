package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    private final BackendAcceptanceTest host;

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
        assertTrue(
                provider.path("bindableNodeTypes").toString().contains("STORE"),
                "BUSINESS: provider exposes store binding capability");
        assertTrue(
                meituan.path("attributeDictionary").toString().contains("groupBuyMappingDirection"),
                "BUSINESS: descriptor key is read back");
        assertFalse(
                tree.raw().contains("authorizationRef"), "BUSINESS: technical authorization reference is not exposed");
        assertFalse(tree.raw().contains("token"), "BUSINESS: token material is not exposed");

        BackendAcceptanceTest.Response detail =
                context.get(SYSTEM_DETAIL, prefix + "/external-systems/MEITUAN", session.cookie(), Set.of(200));
        assertEquals(
                "MEITUAN",
                detail.json().path("externalSystemCode").asText(),
                "BUSINESS: detail identity is owner readback");
        assertEquals(
                meituan.path("capabilities").toString(),
                detail.json().path("capabilities").toString(),
                "BUSINESS: detail preserves capability literals");
        BackendAcceptanceTest.Response dictionary = context.get(
                CAPABILITY_DICTIONARY, "/api/platform/external-capability-dictionary", session.cookie(), Set.of(200));
        assertTrue(
                dictionary.json().path("providerProfiles").toString().contains("MEITUAN_ISV_A"),
                "BUSINESS: dictionary contains the checked-in provider");
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
        BackendAcceptanceTest.Response binding = createBinding(
                context,
                fixture,
                "MEMBERSHIP_COUPON_STORE",
                null,
                "STORE",
                fixture.fixture().storeId(),
                null);
        String displayPath = binding.json().path("nodeDisplayPath").asText();
        assertFalse(displayPath.isBlank(), "BUSINESS: owner binding readback has a task node display path");
        String[] pathSegments = displayPath.split(" / ");
        assertTrue(pathSegments.length >= 2, "BUSINESS: store display path includes an ancestor and leaf");
        String ancestorPathSegment = pathSegments[0].trim();
        String leafPathSegment = pathSegments[pathSegments.length - 1].trim();
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
        BackendAcceptanceTest.Response rejected = createBinding(
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
        BackendAcceptanceTest.Response internal = createBinding(
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
                internal.json().path("businessScopeDisplayNames").toString().contains("订单同步"),
                "BUSINESS: INTERNAL_MAPPING exposes provider business scope display names");
        BackendAcceptanceTest.Response noMapping = createBinding(
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
                noMapping.json().path("businessScopeDisplayNames").toString().contains("用户与权益"),
                "BUSINESS: NO_MAPPING exposes provider business scope display names");

        BackendAcceptanceTest.Response internalMissingOwner = createBinding(
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
        BackendAcceptanceTest.Response noMappingWithOwner = createBinding(
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
        BackendAcceptanceTest.Response binding = createBinding(
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
        BackendAcceptanceTest.Response binding = createBinding(
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
        BackendAcceptanceTest.Response binding = createOperationsExternalBinding(context, fixture);
        UUID bindingRef = UUID.fromString(binding.json().path("bindingRef").asText());
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        BackendAcceptanceTest.Response rejected = context.delete(
                BINDING_DELETE,
                bindingPath(fixture.fixture(), bindingRef),
                platform.cookie(),
                Map.of("expectedVersion", binding.json().path("version").asLong()),
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

    private BackendAcceptanceTest.Response createBinding(
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

    private BackendAcceptanceTest.Response createBinding(
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
        return context.post(
                BINDING_CREATE,
                "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey() + "/owner-bindings",
                fixture.session().cookie(),
                body,
                headers(),
                expectedStatuses);
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

    private BackendAcceptanceTest.Response createOperationsExternalBinding(
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
                root + "/business-channels/" + channel.json().path("channelRef").asText() + "/owner-binding",
                fixture.session().cookie(),
                bindingBody,
                headers(),
                Set.of(200));
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
