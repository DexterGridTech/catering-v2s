#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = "contracts/collaboration/external-platform-catalog.json";
const catalogBytes = fs.readFileSync(path.join(root, catalogPath));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code, detail = "") => {
  throw new Error(`${code}${detail ? `:${detail}` : ""}`);
};

const acceptanceScenarioIds = Object.freeze([
  "collaboration.catalog-readback",
  "collaboration.planned-profile-enablement",
  "collaboration.bindable-node-candidates",
  "collaboration.platform-external-grant-create-rejected",
  "collaboration.internal-and-no-mapping",
  "collaboration.provider-binding-edit-policy",
  "collaboration.logical-delete-retains-row",
  "collaboration.adapter-unbind-required",
  "business-channel.cascade-and-draft",
  "business-channel.planned-provider-candidate",
  "business-channel.double-source-and-manual-stop",
  "business-channel.store-template-scope",
  "business-channel.disabled-store-create",
  "business-channel.store-visibility-all-candidates",
  "business-channel.store-visibility-selected-candidates",
  "business-channel.store-visibility-create-update",
  "business-channel.store-visibility-invalid-inputs",
  "business-channel.store-visibility-existing-channel-retained",
  "business-channel.store-visibility-stale-create-rejected",
  "business-channel.store-visibility-idempotency-and-cas",
  "business-channel.store-visibility-visible-store-page",
  "business-channel.store-visibility-voided-relation-retained-then-removed",
  "business-channel.store-visibility-disabled-store-candidate-blocked",
  "business-channel.same-store-two-owner-ids",
  "collaboration.dine-in-capability-readback",
  "collaboration.dine-in-provider-candidates",
  "collaboration.dine-in-binding-scope",
  "business-channel.store-external-dine-in-template",
  "business-channel.store-external-dine-in-provider-missing",
  "business-channel.store-external-dine-in-channel",
  "business-channel.project-external-dine-in-rejected",
  "business-channel.external-dine-in-form-rejected",
  "business-channel.internal-dine-in-form-matrix",
  "business-channel.store-management-channel-read-includes-external-dine-in",
  "business-channel.store-profile-read-for-store-role",
  "sales-menu.external-dine-in-excluded",
  "business-channel.store-usage-separation",
  "business-channel.dine-in-project-no-partial-write",
]);

const seedDatasets = [
  {
    fixtureId: "EXTERNAL-COLLABORATION-BUSINESS-CHANNEL",
    class: "SEED",
    ownerScopes: ["collaboration", "business-channel"],
    entities: {
      ownerNodes: [
        { code: "COLLAB-COMMERCIAL-GROUP", sourceFixtureKey: "cg-aurora", nodeType: "COMMERCIAL_GROUP", name: "华润万象生活" },
        { code: "COLLAB-REGION", sourceFixtureKey: "region-east", nodeType: "REGION", name: "华北大区" },
        { code: "COLLAB-PROJECT", sourceFixtureKey: "project-river", nodeType: "PROJECT", name: "太原万象城" },
        { code: "COLLAB-HEAD-COMPANY", sourceFixtureKey: "hc-a", nodeType: "HEAD_COMPANY", name: "极光餐饮总公司" },
        { code: "COLLAB-STORE", sourceFixtureKey: "store-operating", nodeType: "STORE", name: "河畔茶里店", projectRef: "COLLAB-PROJECT" },
        { code: "COLLAB-STORE-B", sourceFixtureKey: "store-preparing", nodeType: "STORE", name: "河畔麦香筹备店", projectRef: "COLLAB-PROJECT" },
      ],
      enablements: [
        { code: "ENABLE-MEITUAN-ISV-A", providerCode: "MEITUAN_ISV_A", status: "ENABLED" },
        { code: "ENABLE-MEITUAN-ISV-B", providerCode: "MEITUAN_ISV_B", status: "ENABLED" },
        { code: "ENABLE-ELEME-OPEN", providerCode: "ELEME_OPEN", status: "ENABLED" },
        { code: "ENABLE-ERP-DEFAULT", providerCode: "SHOPPING_MALL_ERP_DEFAULT", status: "ENABLED" },
        { code: "ENABLE-MEMBER-STORE", providerCode: "MEMBERSHIP_COUPON_STORE", status: "ENABLED" },
        { code: "ENABLE-STORE-OWNED-MINI-PROGRAM-DINE-IN", providerCode: "STORE_OWNED_MINI_PROGRAM_DINE_IN", status: "ENABLED" },
      ],
      bindings: [
        {
          code: "BIND-STORE-TAKEAWAY-MEITUAN",
          providerCode: "MEITUAN_ISV_A",
          capabilityClass: "TAKEAWAY",
          nodeType: "STORE",
          nodeRef: "COLLAB-STORE",
          bindingDisplayName: "海底捞拌饭",
          externalOwnerId: "MEITUAN-STORE-OWNER-A",
        },
        {
          code: "BIND-STORE-TAKEAWAY-ELEME",
          providerCode: "ELEME_OPEN",
          capabilityClass: "TAKEAWAY",
          nodeType: "STORE",
          nodeRef: "COLLAB-STORE",
          bindingDisplayName: "海底捞冒菜",
          externalOwnerId: "ELEME-STORE-OWNER-A",
        },
        {
          code: "BIND-STORE-GROUP-BUY-MEITUAN",
          providerCode: "MEITUAN_ISV_B",
          capabilityClass: "GROUP_BUY",
          nodeType: "STORE",
          nodeRef: "COLLAB-STORE",
          bindingDisplayName: "海底捞万象城店",
          externalOwnerId: "MEITUAN-STORE-OWNER-B",
        },
        {
          code: "BIND-STORE-DINE-IN-MINI-PROGRAM",
          providerCode: "STORE_OWNED_MINI_PROGRAM_DINE_IN",
          capabilityClass: "DINE_IN",
          nodeType: "STORE",
          nodeRef: "COLLAB-STORE",
          bindingDisplayName: "河畔茶里店自有点单小程序堂食",
          externalOwnerId: "STORE-OWNED-MINI-PROGRAM-STORE-A",
        },
      ],
      templates: [
        { code: "TEMPLATE-STORE-TAKEAWAY-A", templateName: "门店美团外卖模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "EXTERNAL", providerCode: "MEITUAN_ISV_A", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-TAKEAWAY-B", templateName: "门店饿了么外卖模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "EXTERNAL", providerCode: "ELEME_OPEN", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-GROUP-BUY", templateName: "门店美团团购模板", ownerNodeType: "STORE", orderKind: "GROUP_BUY", accessKind: "EXTERNAL", providerCode: "MEITUAN_ISV_B", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-DINE-IN-POS", templateName: "门店堂食 POS 模板", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: "POS", accessKind: "INTERNAL", providerCode: null, storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-DINE-IN-QR", templateName: "门店堂食 QR 模板", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: "QR", accessKind: "INTERNAL", providerCode: null, urlRule: "https://qr.example.com/order?source=seed#entry", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-DINE-IN-KIOSK", templateName: "门店堂食自助机模板", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: "KIOSK", accessKind: "INTERNAL", providerCode: null, storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-DINE-IN-EXTERNAL", templateName: "门店自有点单小程序堂食模板", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: null, accessKind: "EXTERNAL", providerCode: "STORE_OWNED_MINI_PROGRAM_DINE_IN", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
        { code: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", templateName: "门店内部外卖模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "INTERNAL", providerCode: null, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: ["COLLAB-STORE", "COLLAB-STORE-B"] },
        { code: "TEMPLATE-STORE-VISIBILITY-STATUS", templateName: "门店可见范围状态模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "INTERNAL", providerCode: null, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: ["COLLAB-STORE-B"] },
        { code: "TEMPLATE-PROJECT-INTERNAL-TAKEAWAY", templateName: "项目内部外卖模板", ownerNodeType: "PROJECT", orderKind: "TAKEAWAY", accessKind: "INTERNAL", providerCode: null, storeVisibilityScope: null, visibleStoreRefs: [] },
      ],
      channels: [
        {
          code: "CHANNEL-STORE-TAKEAWAY-MEITUAN",
          channelName: "海底捞拌饭",
          channelCode: "CHANNEL-STORE-TAKEAWAY-MEITUAN",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-TAKEAWAY-A",
          bindingRef: "BIND-STORE-TAKEAWAY-MEITUAN",
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-TAKEAWAY-ELEME",
          channelName: "海底捞冒菜",
          channelCode: "CHANNEL-STORE-TAKEAWAY-ELEME",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-TAKEAWAY-B",
          bindingRef: "BIND-STORE-TAKEAWAY-ELEME",
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-GROUP-BUY-MEITUAN",
          channelName: "海底捞万象城店",
          channelCode: "CHANNEL-STORE-GROUP-BUY-MEITUAN",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "GROUP_BUY",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-GROUP-BUY",
          bindingRef: "BIND-STORE-GROUP-BUY-MEITUAN",
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-INTERNAL-DINE-IN-POS",
          channelName: "万象城堂食 POS",
          channelCode: "CHANNEL-STORE-INTERNAL-DINE-IN-POS",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "DINE_IN",
          accessKind: "INTERNAL",
          templateRef: "TEMPLATE-STORE-DINE-IN-POS",
          bindingRef: null,
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-INTERNAL-DINE-IN-QR",
          channelName: "万象城扫码点单",
          channelCode: "CHANNEL-STORE-INTERNAL-DINE-IN-QR",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "DINE_IN",
          accessKind: "INTERNAL",
          templateRef: "TEMPLATE-STORE-DINE-IN-QR",
          bindingRef: null,
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-DINE-IN-EXTERNAL",
          channelName: "河畔茶里店自有点单小程序堂食",
          channelCode: "CHANNEL-STORE-DINE-IN-EXTERNAL",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "DINE_IN",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-DINE-IN-EXTERNAL",
          bindingRef: "BIND-STORE-DINE-IN-MINI-PROGRAM",
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-INTERNAL-TAKEAWAY",
          channelName: "万象城内部外卖",
          channelCode: "CHANNEL-STORE-INTERNAL-TAKEAWAY",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "INTERNAL",
          templateRef: "TEMPLATE-STORE-INTERNAL-TAKEAWAY",
          bindingRef: null,
          status: "ENABLED",
        },
        {
          code: "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED",
          channelName: "万象城内部外卖已停用",
          channelCode: "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "INTERNAL",
          templateRef: "TEMPLATE-STORE-INTERNAL-TAKEAWAY",
          bindingRef: null,
          status: "DISABLED",
        },
        {
          code: "CHANNEL-STORE-INTERNAL-TAKEAWAY-B",
          channelName: "筹备店内部外卖",
          channelCode: "CHANNEL-STORE-INTERNAL-TAKEAWAY-B",
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE-B",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "INTERNAL",
          templateRef: "TEMPLATE-STORE-INTERNAL-TAKEAWAY",
          bindingRef: null,
          status: "ENABLED",
        },
        {
          code: "CHANNEL-PROJECT-INTERNAL-TAKEAWAY",
          channelName: "万象城项目内部外卖",
          channelCode: "CHANNEL-PROJECT-INTERNAL-TAKEAWAY",
          ownerNodeType: "PROJECT",
          ownerNodeRef: "COLLAB-PROJECT",
          operatorKind: "PROJECT",
          orderKind: "TAKEAWAY",
          accessKind: "INTERNAL",
          templateRef: "TEMPLATE-PROJECT-INTERNAL-TAKEAWAY",
          bindingRef: null,
          status: "ENABLED",
        },
      ],
      relations: [
        { from: "BIND-STORE-TAKEAWAY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "BIND-STORE-TAKEAWAY-ELEME", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "BIND-STORE-GROUP-BUY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "BIND-STORE-DINE-IN-MINI-PROGRAM", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-TAKEAWAY-A", to: "BIND-STORE-TAKEAWAY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-TAKEAWAY-B", to: "BIND-STORE-TAKEAWAY-ELEME", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-GROUP-BUY", to: "BIND-STORE-GROUP-BUY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-DINE-IN-POS", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-DINE-IN-QR", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-DINE-IN-KIOSK", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-DINE-IN-EXTERNAL", to: "BIND-STORE-DINE-IN-MINI-PROGRAM", refKind: "CHANNEL_BINDING" },
        { from: "CHANNEL-STORE-TAKEAWAY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-TAKEAWAY-MEITUAN", to: "TEMPLATE-STORE-TAKEAWAY-A", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-TAKEAWAY-MEITUAN", to: "BIND-STORE-TAKEAWAY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "CHANNEL-STORE-TAKEAWAY-ELEME", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-TAKEAWAY-ELEME", to: "TEMPLATE-STORE-TAKEAWAY-B", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-TAKEAWAY-ELEME", to: "BIND-STORE-TAKEAWAY-ELEME", refKind: "CHANNEL_BINDING" },
        { from: "CHANNEL-STORE-GROUP-BUY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-GROUP-BUY-MEITUAN", to: "TEMPLATE-STORE-GROUP-BUY", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-GROUP-BUY-MEITUAN", to: "BIND-STORE-GROUP-BUY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", to: "COLLAB-PROJECT", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", to: "COLLAB-STORE", refKind: "VISIBLE_STORE" },
        { from: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", to: "COLLAB-STORE-B", refKind: "VISIBLE_STORE" },
        { from: "TEMPLATE-STORE-VISIBILITY-STATUS", to: "COLLAB-PROJECT", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-VISIBILITY-STATUS", to: "COLLAB-STORE-B", refKind: "VISIBLE_STORE" },
        { from: "TEMPLATE-PROJECT-INTERNAL-TAKEAWAY", to: "COLLAB-PROJECT", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-INTERNAL-DINE-IN-POS", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-INTERNAL-DINE-IN-POS", to: "TEMPLATE-STORE-DINE-IN-POS", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-INTERNAL-DINE-IN-QR", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-INTERNAL-DINE-IN-QR", to: "TEMPLATE-STORE-DINE-IN-QR", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-DINE-IN-EXTERNAL", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-DINE-IN-EXTERNAL", to: "TEMPLATE-STORE-DINE-IN-EXTERNAL", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-DINE-IN-EXTERNAL", to: "BIND-STORE-DINE-IN-MINI-PROGRAM", refKind: "CHANNEL_BINDING" },
        { from: "CHANNEL-STORE-INTERNAL-TAKEAWAY", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-INTERNAL-TAKEAWAY", to: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED", to: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-INTERNAL-TAKEAWAY-B", to: "COLLAB-STORE-B", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-INTERNAL-TAKEAWAY-B", to: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-PROJECT-INTERNAL-TAKEAWAY", to: "COLLAB-PROJECT", refKind: "OWNER_NODE" },
        { from: "CHANNEL-PROJECT-INTERNAL-TAKEAWAY", to: "TEMPLATE-PROJECT-INTERNAL-TAKEAWAY", refKind: "CHANNEL_TEMPLATE" },
      ],
    },
  },
];

const plan = {
  schemaVersion: 1,
  kind: "external-collaboration-business-channel-seed-plan",
  status: "STATIC_PLAN_ONLY",
  authority: "DECLARATIVE_INPUTS_ONLY",
  revision: "EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_20260917_STORE_QR_RULE",
  noDirectDatabaseWrites: true,
  noRuntimeExecution: true,
  catalogReference: {
    path: catalogPath,
    mode: "READ_ONLY_INPUT_REFERENCE",
    sha256: sha256(catalogBytes),
  },
  seedDatasets,
  acceptanceScenarioIds: [...acceptanceScenarioIds],
};

const expectedChannels = Object.freeze([
  {
    code: "CHANNEL-STORE-TAKEAWAY-MEITUAN",
    channelName: "海底捞拌饭",
    channelCode: "CHANNEL-STORE-TAKEAWAY-MEITUAN",
    orderKind: "TAKEAWAY",
    accessKind: "EXTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-TAKEAWAY-A",
    bindingRef: "BIND-STORE-TAKEAWAY-MEITUAN",
  },
  {
    code: "CHANNEL-STORE-TAKEAWAY-ELEME",
    channelName: "海底捞冒菜",
    channelCode: "CHANNEL-STORE-TAKEAWAY-ELEME",
    orderKind: "TAKEAWAY",
    accessKind: "EXTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-TAKEAWAY-B",
    bindingRef: "BIND-STORE-TAKEAWAY-ELEME",
  },
  {
    code: "CHANNEL-STORE-GROUP-BUY-MEITUAN",
    channelName: "海底捞万象城店",
    channelCode: "CHANNEL-STORE-GROUP-BUY-MEITUAN",
    orderKind: "GROUP_BUY",
    accessKind: "EXTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-GROUP-BUY",
    bindingRef: "BIND-STORE-GROUP-BUY-MEITUAN",
  },
  {
    code: "CHANNEL-STORE-INTERNAL-DINE-IN-POS",
    channelName: "万象城堂食 POS",
    channelCode: "CHANNEL-STORE-INTERNAL-DINE-IN-POS",
    orderKind: "DINE_IN",
    accessKind: "INTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-DINE-IN-POS",
    bindingRef: null,
  },
  {
    code: "CHANNEL-STORE-INTERNAL-DINE-IN-QR",
    channelName: "万象城扫码点单",
    channelCode: "CHANNEL-STORE-INTERNAL-DINE-IN-QR",
    orderKind: "DINE_IN",
    accessKind: "INTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-DINE-IN-QR",
    bindingRef: null,
  },
  {
    code: "CHANNEL-STORE-DINE-IN-EXTERNAL",
    channelName: "河畔茶里店自有点单小程序堂食",
    channelCode: "CHANNEL-STORE-DINE-IN-EXTERNAL",
    orderKind: "DINE_IN",
    accessKind: "EXTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-DINE-IN-EXTERNAL",
    bindingRef: "BIND-STORE-DINE-IN-MINI-PROGRAM",
  },
  {
    code: "CHANNEL-STORE-INTERNAL-TAKEAWAY",
    channelName: "万象城内部外卖",
    channelCode: "CHANNEL-STORE-INTERNAL-TAKEAWAY",
    orderKind: "TAKEAWAY",
    accessKind: "INTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-INTERNAL-TAKEAWAY",
    bindingRef: null,
  },
  {
    code: "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED",
    channelName: "万象城内部外卖已停用",
    channelCode: "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED",
    orderKind: "TAKEAWAY",
    accessKind: "INTERNAL",
    status: "DISABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-INTERNAL-TAKEAWAY",
    bindingRef: null,
  },
  {
    code: "CHANNEL-STORE-INTERNAL-TAKEAWAY-B",
    channelName: "筹备店内部外卖",
    channelCode: "CHANNEL-STORE-INTERNAL-TAKEAWAY-B",
    orderKind: "TAKEAWAY",
    accessKind: "INTERNAL",
    status: "ENABLED",
    ownerNodeType: "STORE",
    ownerNodeRef: "COLLAB-STORE-B",
    operatorKind: "STORE",
    templateRef: "TEMPLATE-STORE-INTERNAL-TAKEAWAY",
    bindingRef: null,
  },
  {
    code: "CHANNEL-PROJECT-INTERNAL-TAKEAWAY",
    channelName: "万象城项目内部外卖",
    channelCode: "CHANNEL-PROJECT-INTERNAL-TAKEAWAY",
    orderKind: "TAKEAWAY",
    accessKind: "INTERNAL",
    status: "ENABLED",
    ownerNodeType: "PROJECT",
    ownerNodeRef: "COLLAB-PROJECT",
    operatorKind: "PROJECT",
    templateRef: "TEMPLATE-PROJECT-INTERNAL-TAKEAWAY",
    bindingRef: null,
  },
]);

// Logical seed names are never runtime identifiers.  Each one must point to
// the already materialized r5-full owner fact that the HTTP executor resolves
// through session/readback before it sends a write.
const expectedOwnerNodes = Object.freeze([
  { code: "COLLAB-COMMERCIAL-GROUP", sourceFixtureKey: "cg-aurora", nodeType: "COMMERCIAL_GROUP", name: "华润万象生活" },
  { code: "COLLAB-REGION", sourceFixtureKey: "region-east", nodeType: "REGION", name: "华北大区" },
  { code: "COLLAB-PROJECT", sourceFixtureKey: "project-river", nodeType: "PROJECT", name: "太原万象城" },
  { code: "COLLAB-HEAD-COMPANY", sourceFixtureKey: "hc-a", nodeType: "HEAD_COMPANY", name: "极光餐饮总公司" },
  { code: "COLLAB-STORE", sourceFixtureKey: "store-operating", nodeType: "STORE", name: "河畔茶里店", projectRef: "COLLAB-PROJECT" },
  { code: "COLLAB-STORE-B", sourceFixtureKey: "store-preparing", nodeType: "STORE", name: "河畔麦香筹备店", projectRef: "COLLAB-PROJECT" },
]);

const expectedTemplates = Object.freeze([
  { code: "TEMPLATE-STORE-TAKEAWAY-A", templateName: "门店美团外卖模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "EXTERNAL", providerCode: "MEITUAN_ISV_A", dineInForm: null, storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-TAKEAWAY-B", templateName: "门店饿了么外卖模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "EXTERNAL", providerCode: "ELEME_OPEN", dineInForm: null, storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-GROUP-BUY", templateName: "门店美团团购模板", ownerNodeType: "STORE", orderKind: "GROUP_BUY", accessKind: "EXTERNAL", providerCode: "MEITUAN_ISV_B", dineInForm: null, storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-DINE-IN-POS", templateName: "门店堂食 POS 模板", ownerNodeType: "STORE", orderKind: "DINE_IN", accessKind: "INTERNAL", providerCode: null, dineInForm: "POS", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-DINE-IN-QR", templateName: "门店堂食 QR 模板", ownerNodeType: "STORE", orderKind: "DINE_IN", accessKind: "INTERNAL", providerCode: null, dineInForm: "QR", urlRule: "https://qr.example.com/order?source=seed#entry", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-DINE-IN-KIOSK", templateName: "门店堂食自助机模板", ownerNodeType: "STORE", orderKind: "DINE_IN", accessKind: "INTERNAL", providerCode: null, dineInForm: "KIOSK", storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-DINE-IN-EXTERNAL", templateName: "门店自有点单小程序堂食模板", ownerNodeType: "STORE", orderKind: "DINE_IN", accessKind: "EXTERNAL", providerCode: "STORE_OWNED_MINI_PROGRAM_DINE_IN", dineInForm: null, storeVisibilityScope: "ALL_PROJECT_STORES", visibleStoreRefs: [] },
  { code: "TEMPLATE-STORE-INTERNAL-TAKEAWAY", templateName: "门店内部外卖模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "INTERNAL", providerCode: null, dineInForm: null, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: ["COLLAB-STORE", "COLLAB-STORE-B"] },
  { code: "TEMPLATE-STORE-VISIBILITY-STATUS", templateName: "门店可见范围状态模板", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "INTERNAL", providerCode: null, dineInForm: null, storeVisibilityScope: "SELECTED_PROJECT_STORES", visibleStoreRefs: ["COLLAB-STORE-B"] },
  { code: "TEMPLATE-PROJECT-INTERNAL-TAKEAWAY", templateName: "项目内部外卖模板", ownerNodeType: "PROJECT", orderKind: "TAKEAWAY", accessKind: "INTERNAL", providerCode: null, dineInForm: null, storeVisibilityScope: null, visibleStoreRefs: [] },
]);

function validate(input) {
  if (input.status !== "STATIC_PLAN_ONLY" || input.noDirectDatabaseWrites !== true || input.noRuntimeExecution !== true) fail("SEED_PLAN_AUTHORITY_INVALID");
  if (input.catalogReference.mode !== "READ_ONLY_INPUT_REFERENCE") fail("SEED_CATALOG_MUST_BE_READ_ONLY");
  if (input.seedDatasets.length !== 1) fail("SEED_DATASET_COUNT_INVALID");
  const dataset = input.seedDatasets[0];
  if (dataset.class !== "SEED" || dataset.ownerScopes.join(",") !== "collaboration,business-channel") fail("SEED_OWNER_SCOPE_INVALID");
  const entities = dataset.entities;
  const nodeTypes = new Set(entities.ownerNodes.map((node) => node.nodeType));
  for (const required of ["COMMERCIAL_GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE"]) {
    if (!nodeTypes.has(required)) fail("SEED_BINDABLE_NODE_TYPE_MISSING", required);
  }
  if (entities.ownerNodes.length !== expectedOwnerNodes.length) fail("SEED_OWNER_NODE_DENOMINATOR_INVALID");
  for (const expected of expectedOwnerNodes) {
    const node = entities.ownerNodes.find((entry) => entry.code === expected.code);
    if (!node
      || node.sourceFixtureKey !== expected.sourceFixtureKey
      || node.nodeType !== expected.nodeType
      || node.name !== expected.name
      || (expected.projectRef ?? null) !== (node.projectRef ?? null)) {
      fail("SEED_OWNER_NODE_SOURCE_MAPPING_INVALID", expected.code);
    }
  }
  const stores = entities.ownerNodes.filter((node) => node.nodeType === "STORE");
  if (stores.length !== 2
    || stores.some((store) => store.projectRef !== "COLLAB-PROJECT")
    || stores.map((store) => store.code).sort().join(",") !== "COLLAB-STORE,COLLAB-STORE-B"
    || stores.find((store) => store.code === "COLLAB-STORE")?.sourceFixtureKey !== "store-operating"
    || stores.find((store) => store.code === "COLLAB-STORE-B")?.sourceFixtureKey !== "store-preparing") fail("SEED_STORE_SHAPE_INVALID");
  const storeBindings = entities.bindings.filter((binding) => binding.nodeRef === "COLLAB-STORE");
  if (entities.bindings.length !== 4) fail("SEED_BINDING_ENTITY_COUNT_INVALID");
  if (storeBindings.length !== 4) fail("SEED_STORE_BINDING_COUNT_INVALID");
  if (storeBindings.filter((binding) => binding.capabilityClass === "TAKEAWAY").length !== 2) fail("SEED_STORE_TAKEAWAY_BINDING_COUNT_INVALID");
  if (storeBindings.filter((binding) => binding.capabilityClass === "GROUP_BUY").length !== 1) fail("SEED_STORE_GROUP_BUY_BINDING_COUNT_INVALID");
  if (storeBindings.filter((binding) => binding.capabilityClass === "DINE_IN").length !== 1) fail("SEED_STORE_DINE_IN_BINDING_COUNT_INVALID");
  if (storeBindings.some((binding) => binding.nodeType !== "STORE")) fail("SEED_STORE_BINDING_NODE_TYPE_INVALID");
  const bindingsByCode = new Map(entities.bindings.map((binding) => [binding.code, binding]));
  const templatesByCode = new Map(entities.templates.map((template) => [template.code, template]));
  if (templatesByCode.size !== expectedTemplates.length) fail("SEED_TEMPLATE_DENOMINATOR_INVALID");
  for (const expected of expectedTemplates) {
    const template = templatesByCode.get(expected.code);
    if (!template
      || template.templateName !== expected.templateName
      || template.ownerNodeType !== expected.ownerNodeType
      || template.orderKind !== expected.orderKind
      || template.accessKind !== expected.accessKind
      || (template.providerCode ?? null) !== expected.providerCode
      || (template.dineInForm ?? null) !== expected.dineInForm
      || (template.urlRule ?? null) !== (expected.urlRule ?? null)) {
      fail("SEED_TEMPLATE_LITERAL_INVALID", expected.code);
    }
    if ((template.storeVisibilityScope ?? null) !== expected.storeVisibilityScope
      || JSON.stringify(template.visibleStoreRefs ?? []) !== JSON.stringify(expected.visibleStoreRefs)) {
      fail("SEED_TEMPLATE_STORE_VISIBILITY_INVALID", expected.code);
    }
    if (expected.ownerNodeType === "PROJECT" && (template.storeVisibilityScope !== null || (template.visibleStoreRefs ?? []).length !== 0)) {
      fail("SEED_PROJECT_TEMPLATE_STORE_VISIBILITY_FORBIDDEN", expected.code);
    }
    if (expected.ownerNodeType === "STORE") {
      if (!expected.storeVisibilityScope || !Array.isArray(expected.visibleStoreRefs)) fail("SEED_STORE_TEMPLATE_STORE_VISIBILITY_MISSING", expected.code);
      if (new Set(expected.visibleStoreRefs).size !== expected.visibleStoreRefs.length) fail("SEED_TEMPLATE_VISIBLE_STORE_DUPLICATE", expected.code);
      if (expected.visibleStoreRefs.some((storeRef) => !stores.some((store) => store.code === storeRef))) fail("SEED_TEMPLATE_VISIBLE_STORE_UNKNOWN", expected.code);
      if (expected.storeVisibilityScope === "ALL_PROJECT_STORES" && expected.visibleStoreRefs.length !== 0) fail("SEED_ALL_TEMPLATE_VISIBLE_STORE_LIST_FORBIDDEN", expected.code);
      if (expected.storeVisibilityScope === "SELECTED_PROJECT_STORES" && expected.visibleStoreRefs.length === 0) fail("SEED_SELECTED_TEMPLATE_VISIBLE_STORE_LIST_MISSING", expected.code);
    }
  }
  const channels = entities.channels;
  if (!Array.isArray(channels) || channels.length !== expectedChannels.length) fail("SEED_CHANNEL_ENTITY_COUNT_INVALID");
  if (channels.filter((channel) => channel.orderKind === "TAKEAWAY").length !== 6) fail("SEED_CHANNEL_TAKEAWAY_LITERAL_COUNT_INVALID");
  if (channels.filter((channel) => channel.orderKind === "GROUP_BUY").length !== 1) fail("SEED_CHANNEL_GROUP_BUY_LITERAL_COUNT_INVALID");
  if (channels.filter((channel) => channel.orderKind === "DINE_IN").length !== 3) fail("SEED_CHANNEL_DINE_IN_LITERAL_COUNT_INVALID");
  if (new Set(channels.map((channel) => channel.code)).size !== channels.length) fail("SEED_CHANNEL_ENTITY_CODE_DUPLICATE");
  const relations = entities.relations;
  const hasRelation = (from, to, refKind) => relations.some((relation) => relation.from === from && relation.to === to && relation.refKind === refKind);
  for (const expected of expectedChannels) {
    const channel = channels.find((entry) => entry.code === expected.code);
    if (!channel) fail("SEED_CHANNEL_ENTITY_MISSING", expected.code);
    if (channel.channelName !== expected.channelName || channel.orderKind !== expected.orderKind || channel.accessKind !== expected.accessKind || channel.status !== expected.status) fail("SEED_CHANNEL_LITERAL_INVALID", expected.code);
    if (channel.ownerNodeType !== expected.ownerNodeType || channel.ownerNodeRef !== expected.ownerNodeRef || channel.operatorKind !== expected.operatorKind) fail("SEED_CHANNEL_OWNER_RELATION_INVALID", expected.code);
    if (channel.channelCode !== expected.channelCode) fail("SEED_CHANNEL_CODE_MUST_BE_EXPLICIT", expected.code);
    if (channel.templateRef !== expected.templateRef || channel.bindingRef !== expected.bindingRef) fail("SEED_CHANNEL_RELATION_INVALID", expected.code);
    const template = templatesByCode.get(expected.templateRef);
    if (!template || template.ownerNodeType !== expected.ownerNodeType || template.orderKind !== expected.orderKind || template.accessKind !== expected.accessKind) fail("SEED_CHANNEL_TEMPLATE_RELATION_INVALID", expected.code);
    if (!hasRelation(channel.code, expected.ownerNodeRef, "OWNER_NODE") || !hasRelation(channel.code, expected.templateRef, "CHANNEL_TEMPLATE")) fail("SEED_CHANNEL_RELATION_EDGE_MISSING", expected.code);
    if (expected.bindingRef === null) {
      if (hasRelation(channel.code, "COLLAB-STORE", "CHANNEL_BINDING") || hasRelation(channel.code, "COLLAB-PROJECT", "CHANNEL_BINDING")) fail("SEED_INTERNAL_CHANNEL_BINDING_FORBIDDEN", expected.code);
    } else {
      const binding = bindingsByCode.get(expected.bindingRef);
      if (!binding || binding.nodeType !== "STORE" || binding.nodeRef !== "COLLAB-STORE" || binding.capabilityClass !== expected.orderKind) fail("SEED_CHANNEL_BINDING_RELATION_INVALID", expected.code);
      if (binding.bindingDisplayName !== expected.channelName) fail("SEED_CHANNEL_BINDING_NAME_INVALID", expected.code);
      if (!hasRelation(channel.code, expected.bindingRef, "CHANNEL_BINDING")) fail("SEED_CHANNEL_RELATION_EDGE_MISSING", expected.code);
    }
  }
  const dineInTemplates = entities.templates.filter((template) => template.orderKind === "DINE_IN");
  if (dineInTemplates.length !== 4) fail("SEED_DINE_IN_TEMPLATE_COUNT_INVALID");
  for (const form of ["POS", "QR", "KIOSK"]) {
    const matches = dineInTemplates.filter((template) => template.dineInForm === form);
    if (matches.length !== 1) fail("SEED_DINE_IN_FORM_COUNT_INVALID", form);
    if (matches[0].accessKind !== "INTERNAL" || matches[0].providerCode != null) fail("SEED_INTERNAL_DINE_IN_SHAPE_INVALID", form);
  }
  const externalDineInTemplates = dineInTemplates.filter((template) => template.accessKind === "EXTERNAL");
  if (externalDineInTemplates.length !== 1
    || externalDineInTemplates[0].ownerNodeType !== "STORE"
    || externalDineInTemplates[0].providerCode !== "STORE_OWNED_MINI_PROGRAM_DINE_IN"
    || externalDineInTemplates[0].dineInForm !== null) fail("SEED_EXTERNAL_DINE_IN_SHAPE_INVALID");
  // The sales-menu projection lists both enabled and disabled store channels;
  // channel status remains a separate publish-blocker/read-model fact.
  const eligibleForSalesMenu = channels.filter((channel) => channel.ownerNodeType === "STORE" && channel.accessKind === "INTERNAL" && ["DINE_IN", "TAKEAWAY"].includes(channel.orderKind));
  if (eligibleForSalesMenu.map((channel) => channel.code).sort().join(",") !== "CHANNEL-STORE-INTERNAL-DINE-IN-POS,CHANNEL-STORE-INTERNAL-DINE-IN-QR,CHANNEL-STORE-INTERNAL-TAKEAWAY,CHANNEL-STORE-INTERNAL-TAKEAWAY-B,CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED") fail("SEED_SALES_MENU_ELIGIBLE_CHANNEL_SET_INVALID");
  if (!channels.some((channel) => channel.ownerNodeType === "PROJECT" && channel.accessKind === "INTERNAL" && channel.orderKind === "TAKEAWAY")) fail("SEED_PROJECT_NEGATIVE_CHANNEL_MISSING");
  if (!channels.some((channel) => channel.ownerNodeType === "STORE" && channel.accessKind === "INTERNAL" && channel.orderKind === "TAKEAWAY" && channel.status === "DISABLED")) fail("SEED_DISABLED_INTERNAL_TAKEAWAY_MISSING");
  if (channels.filter((channel) => channel.ownerNodeType === "STORE" && channel.accessKind === "EXTERNAL" && channel.orderKind === "DINE_IN").length !== 1) fail("SEED_EXTERNAL_DINE_IN_CHANNEL_MISSING");
  const externalDineInChannel = channels.find((channel) => channel.ownerNodeType === "STORE" && channel.accessKind === "EXTERNAL" && channel.orderKind === "DINE_IN");
  if (externalDineInChannel?.templateRef !== "TEMPLATE-STORE-DINE-IN-EXTERNAL"
    || externalDineInChannel?.bindingRef !== "BIND-STORE-DINE-IN-MINI-PROGRAM") fail("SEED_EXTERNAL_DINE_IN_CHANNEL_RELATION_INVALID");
  if (channels.filter((channel) => channel.ownerNodeType === "STORE" && channel.accessKind === "EXTERNAL" && channel.orderKind === "TAKEAWAY").length !== 2) fail("SEED_EXTERNAL_TAKEAWAY_NEGATIVE_COUNT_INVALID");
  if (channels.filter((channel) => channel.ownerNodeType === "STORE" && channel.orderKind === "GROUP_BUY").length !== 1) fail("SEED_STORE_GROUP_BUY_NEGATIVE_COUNT_INVALID");
  if (JSON.stringify(input.acceptanceScenarioIds) !== JSON.stringify(acceptanceScenarioIds)) fail("SEED_ACCEPTANCE_SCENARIO_ROSTER_INVALID");
  if (JSON.stringify(dataset).includes("externalSystems") || JSON.stringify(dataset).includes("providerProfiles")) fail("SEED_CATALOG_DATA_MUST_NOT_BE_WRITTEN");
  const references = new Set([
    ...entities.ownerNodes.map((entry) => entry.code),
    ...entities.bindings.map((entry) => entry.code),
    ...entities.templates.map((entry) => entry.code),
    ...channels.map((entry) => entry.code),
  ]);
  for (const relation of relations) {
    if (!references.has(relation.from) || !references.has(relation.to)) fail("SEED_RELATION_DANGLING", `${relation.from}->${relation.to}`);
  }
  for (const expected of expectedTemplates.filter((template) => template.ownerNodeType === "STORE" && template.storeVisibilityScope === "SELECTED_PROJECT_STORES")) {
    for (const storeRef of expected.visibleStoreRefs) {
      if (!hasRelation(expected.code, storeRef, "VISIBLE_STORE")) fail("SEED_TEMPLATE_VISIBLE_STORE_RELATION_EDGE_MISSING", `${expected.code}->${storeRef}`);
    }
  }
  return input;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--self-test")) {
  validate(plan);
  const expectRejected = (label, mutate) => {
    const red = structuredClone(plan);
    mutate(red);
    let rejected = false;
    try { validate(red); } catch { rejected = true; }
    if (!rejected) fail("SEED_PLAN_RED_MUTATION_NOT_REJECTED", label);
  };
  expectRejected("CHANNEL_COUNT", (red) => { red.seedDatasets[0].entities.channels.pop(); });
  expectRejected("CHANNEL_LITERAL", (red) => { red.seedDatasets[0].entities.channels[0].orderKind = "GROUP_BUY"; });
  expectRejected("CHANNEL_NAME", (red) => { red.seedDatasets[0].entities.channels[0].channelName = "未批准渠道"; });
  expectRejected("BINDING_COUNT", (red) => { red.seedDatasets[0].entities.bindings.pop(); });
  expectRejected("BINDING_LITERAL", (red) => { red.seedDatasets[0].entities.bindings[0].capabilityClass = "GROUP_BUY"; });
  expectRejected("CHANNEL_OWNER_NODE_REF", (red) => { red.seedDatasets[0].entities.channels[0].ownerNodeRef = "COLLAB-PROJECT"; });
  expectRejected("OWNER_NODE_SOURCE_MAPPING", (red) => { red.seedDatasets[0].entities.ownerNodes.find((node) => node.code === "COLLAB-STORE").sourceFixtureKey = "store-preparing"; });
  expectRejected("CHANNEL_TEMPLATE_REF", (red) => { red.seedDatasets[0].entities.channels[0].templateRef = "TEMPLATE-STORE-GROUP-BUY"; });
  expectRejected("EXTERNAL_TEMPLATE_PROVIDER", (red) => { red.seedDatasets[0].entities.templates.find((template) => template.code === "TEMPLATE-STORE-TAKEAWAY-A").providerCode = null; });
  expectRejected("TEMPLATE_NAME", (red) => { red.seedDatasets[0].entities.templates.find((template) => template.code === "TEMPLATE-STORE-INTERNAL-TAKEAWAY").templateName = "未批准模板"; });
  expectRejected("CHANNEL_BINDING_NAME", (red) => { red.seedDatasets[0].entities.bindings[0].bindingDisplayName = "未批准绑定"; });
  expectRejected("CHANNEL_BINDING_EDGE", (red) => {
    red.seedDatasets[0].entities.relations = red.seedDatasets[0].entities.relations.filter((relation) => relation.from !== "CHANNEL-STORE-TAKEAWAY-MEITUAN" || relation.refKind !== "CHANNEL_BINDING");
  });
  expectRejected("CHANNEL_CODE_REQUIRED", (red) => { red.seedDatasets[0].entities.channels[0].channelCode = null; });
  expectRejected("DINE_IN_KIOSK", (red) => {
    red.seedDatasets[0].entities.templates = red.seedDatasets[0].entities.templates.filter((template) => template.dineInForm !== "KIOSK");
  });
  expectRejected("EXTERNAL_DINE_IN_FORM", (red) => {
    red.seedDatasets[0].entities.templates.find((template) => template.code === "TEMPLATE-STORE-DINE-IN-EXTERNAL").dineInForm = "POS";
  });
  expectRejected("INTERNAL_CHANNEL_BECOMES_EXTERNAL", (red) => { red.seedDatasets[0].entities.channels.find((channel) => channel.code === "CHANNEL-STORE-INTERNAL-TAKEAWAY").accessKind = "EXTERNAL"; });
  expectRejected("DISABLED_BRANCH_MISSING", (red) => { red.seedDatasets[0].entities.channels.find((channel) => channel.code === "CHANNEL-STORE-INTERNAL-TAKEAWAY-DISABLED").status = "ENABLED"; });
  expectRejected("PROJECT_NEGATIVE_BECOMES_STORE", (red) => { const channel = red.seedDatasets[0].entities.channels.find((entry) => entry.code === "CHANNEL-PROJECT-INTERNAL-TAKEAWAY"); channel.ownerNodeType = "STORE"; channel.ownerNodeRef = "COLLAB-STORE"; channel.operatorKind = "STORE"; });
  expectRejected("ELIGIBLE_INTERNAL_TAKEAWAY_MISSING", (red) => { red.seedDatasets[0].entities.channels.find((channel) => channel.code === "CHANNEL-STORE-INTERNAL-TAKEAWAY").status = "DISABLED"; });
  process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_SELF_TEST=PASS SCENARIOS=${plan.acceptanceScenarioIds.length} RED_CASES=19\n`);
}

export { acceptanceScenarioIds, plan, validate };
