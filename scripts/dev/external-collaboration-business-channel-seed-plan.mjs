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

const seedDatasets = [
  {
    fixtureId: "EXTERNAL-COLLABORATION-BUSINESS-CHANNEL",
    class: "SEED",
    ownerScopes: ["collaboration", "business-channel"],
    entities: {
      ownerNodes: [
        { code: "COLLAB-COMMERCIAL-GROUP", nodeType: "COMMERCIAL_GROUP", name: "万象城商业集团" },
        { code: "COLLAB-REGION", nodeType: "REGION", name: "华东大区" },
        { code: "COLLAB-PROJECT", nodeType: "PROJECT", name: "万象城项目" },
        { code: "COLLAB-HEAD-COMPANY", nodeType: "HEAD_COMPANY", name: "海底捞总公司" },
        { code: "COLLAB-STORE", nodeType: "STORE", name: "万象城海底捞", projectRef: "COLLAB-PROJECT" },
      ],
      enablements: [
        { code: "ENABLE-MEITUAN-ISV-A", providerCode: "MEITUAN_ISV_A", status: "ENABLED" },
        { code: "ENABLE-MEITUAN-ISV-B", providerCode: "MEITUAN_ISV_B", status: "ENABLED" },
        { code: "ENABLE-ELEME-OPEN", providerCode: "ELEME_OPEN", status: "ENABLED" },
        { code: "ENABLE-ERP-DEFAULT", providerCode: "SHOPPING_MALL_ERP_DEFAULT", status: "ENABLED" },
        { code: "ENABLE-MEMBER-STORE", providerCode: "MEMBERSHIP_COUPON_STORE", status: "ENABLED" },
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
      ],
      templates: [
        { code: "TEMPLATE-STORE-TAKEAWAY-A", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "EXTERNAL" },
        { code: "TEMPLATE-STORE-TAKEAWAY-B", ownerNodeType: "STORE", orderKind: "TAKEAWAY", accessKind: "EXTERNAL" },
        { code: "TEMPLATE-STORE-GROUP-BUY", ownerNodeType: "STORE", orderKind: "GROUP_BUY", accessKind: "EXTERNAL" },
        { code: "TEMPLATE-STORE-DINE-IN-POS", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: "POS", accessKind: "INTERNAL" },
        { code: "TEMPLATE-STORE-DINE-IN-QR", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: "QR", accessKind: "INTERNAL" },
        { code: "TEMPLATE-STORE-DINE-IN-KIOSK", ownerNodeType: "STORE", orderKind: "DINE_IN", dineInForm: "KIOSK", accessKind: "INTERNAL" },
      ],
      channels: [
        {
          code: "CHANNEL-STORE-TAKEAWAY-MEITUAN",
          channelName: "海底捞拌饭",
          channelCode: null,
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-TAKEAWAY-A",
          bindingRef: "BIND-STORE-TAKEAWAY-MEITUAN",
        },
        {
          code: "CHANNEL-STORE-TAKEAWAY-ELEME",
          channelName: "海底捞冒菜",
          channelCode: null,
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "TAKEAWAY",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-TAKEAWAY-B",
          bindingRef: "BIND-STORE-TAKEAWAY-ELEME",
        },
        {
          code: "CHANNEL-STORE-GROUP-BUY-MEITUAN",
          channelName: "海底捞万象城店",
          channelCode: null,
          ownerNodeType: "STORE",
          ownerNodeRef: "COLLAB-STORE",
          operatorKind: "STORE",
          orderKind: "GROUP_BUY",
          accessKind: "EXTERNAL",
          templateRef: "TEMPLATE-STORE-GROUP-BUY",
          bindingRef: "BIND-STORE-GROUP-BUY-MEITUAN",
        },
      ],
      relations: [
        { from: "BIND-STORE-TAKEAWAY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "BIND-STORE-TAKEAWAY-ELEME", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "BIND-STORE-GROUP-BUY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-TAKEAWAY-A", to: "BIND-STORE-TAKEAWAY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-TAKEAWAY-B", to: "BIND-STORE-TAKEAWAY-ELEME", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-GROUP-BUY", to: "BIND-STORE-GROUP-BUY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "TEMPLATE-STORE-DINE-IN-POS", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-DINE-IN-QR", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "TEMPLATE-STORE-DINE-IN-KIOSK", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-TAKEAWAY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-TAKEAWAY-MEITUAN", to: "TEMPLATE-STORE-TAKEAWAY-A", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-TAKEAWAY-MEITUAN", to: "BIND-STORE-TAKEAWAY-MEITUAN", refKind: "CHANNEL_BINDING" },
        { from: "CHANNEL-STORE-TAKEAWAY-ELEME", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-TAKEAWAY-ELEME", to: "TEMPLATE-STORE-TAKEAWAY-B", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-TAKEAWAY-ELEME", to: "BIND-STORE-TAKEAWAY-ELEME", refKind: "CHANNEL_BINDING" },
        { from: "CHANNEL-STORE-GROUP-BUY-MEITUAN", to: "COLLAB-STORE", refKind: "OWNER_NODE" },
        { from: "CHANNEL-STORE-GROUP-BUY-MEITUAN", to: "TEMPLATE-STORE-GROUP-BUY", refKind: "CHANNEL_TEMPLATE" },
        { from: "CHANNEL-STORE-GROUP-BUY-MEITUAN", to: "BIND-STORE-GROUP-BUY-MEITUAN", refKind: "CHANNEL_BINDING" },
      ],
    },
  },
];

const plan = {
  schemaVersion: 1,
  kind: "external-collaboration-business-channel-seed-plan",
  status: "STATIC_PLAN_ONLY",
  authority: "DECLARATIVE_INPUTS_ONLY",
  revision: "EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_20260819",
  noDirectDatabaseWrites: true,
  noRuntimeExecution: true,
  catalogReference: {
    path: catalogPath,
    mode: "READ_ONLY_INPUT_REFERENCE",
    sha256: sha256(catalogBytes),
  },
  seedDatasets,
  acceptanceScenarioIds: [
    "collaboration.catalog-readback",
    "collaboration.planned-profile-enablement",
    "collaboration.bindable-node-candidates",
    "collaboration.external-grant-create-callback",
    "collaboration.internal-and-no-mapping",
    "collaboration.provider-binding-edit-policy",
    "collaboration.same-store-two-owner-ids",
    "collaboration.logical-delete-retains-row",
    "collaboration.adapter-unbind-required",
    "business-channel.cascade-and-draft",
    "business-channel.planned-provider-candidate",
    "business-channel.double-source-and-manual-stop",
    "business-channel.store-template-scope",
    "business-channel.disabled-store-create",
  ],
};

const expectedStoreChannels = Object.freeze([
  {
    code: "CHANNEL-STORE-TAKEAWAY-MEITUAN",
    channelName: "海底捞拌饭",
    orderKind: "TAKEAWAY",
    templateRef: "TEMPLATE-STORE-TAKEAWAY-A",
    bindingRef: "BIND-STORE-TAKEAWAY-MEITUAN",
  },
  {
    code: "CHANNEL-STORE-TAKEAWAY-ELEME",
    channelName: "海底捞冒菜",
    orderKind: "TAKEAWAY",
    templateRef: "TEMPLATE-STORE-TAKEAWAY-B",
    bindingRef: "BIND-STORE-TAKEAWAY-ELEME",
  },
  {
    code: "CHANNEL-STORE-GROUP-BUY-MEITUAN",
    channelName: "海底捞万象城店",
    orderKind: "GROUP_BUY",
    templateRef: "TEMPLATE-STORE-GROUP-BUY",
    bindingRef: "BIND-STORE-GROUP-BUY-MEITUAN",
  },
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
  const stores = entities.ownerNodes.filter((node) => node.nodeType === "STORE");
  if (stores.length !== 1 || stores[0].code !== "COLLAB-STORE" || stores[0].name !== "万象城海底捞") fail("SEED_STORE_SHAPE_INVALID");
  const storeBindings = entities.bindings.filter((binding) => binding.nodeRef === "COLLAB-STORE");
  if (entities.bindings.length !== 3) fail("SEED_BINDING_ENTITY_COUNT_INVALID");
  if (storeBindings.length !== 3) fail("SEED_STORE_BINDING_COUNT_INVALID");
  if (storeBindings.filter((binding) => binding.capabilityClass === "TAKEAWAY").length !== 2) fail("SEED_STORE_TAKEAWAY_BINDING_COUNT_INVALID");
  if (storeBindings.filter((binding) => binding.capabilityClass === "GROUP_BUY").length !== 1) fail("SEED_STORE_GROUP_BUY_BINDING_COUNT_INVALID");
  if (storeBindings.some((binding) => binding.nodeType !== "STORE")) fail("SEED_STORE_BINDING_NODE_TYPE_INVALID");
  const bindingsByCode = new Map(entities.bindings.map((binding) => [binding.code, binding]));
  const templatesByCode = new Map(entities.templates.map((template) => [template.code, template]));
  const channels = entities.channels;
  if (!Array.isArray(channels) || channels.length !== expectedStoreChannels.length) fail("SEED_CHANNEL_ENTITY_COUNT_INVALID");
  if (channels.filter((channel) => channel.orderKind === "TAKEAWAY").length !== 2) fail("SEED_CHANNEL_TAKEAWAY_LITERAL_COUNT_INVALID");
  if (channels.filter((channel) => channel.orderKind === "GROUP_BUY").length !== 1) fail("SEED_CHANNEL_GROUP_BUY_LITERAL_COUNT_INVALID");
  if (new Set(channels.map((channel) => channel.code)).size !== channels.length) fail("SEED_CHANNEL_ENTITY_CODE_DUPLICATE");
  const relations = entities.relations;
  const hasRelation = (from, to, refKind) => relations.some((relation) => relation.from === from && relation.to === to && relation.refKind === refKind);
  for (const expected of expectedStoreChannels) {
    const channel = channels.find((entry) => entry.code === expected.code);
    if (!channel) fail("SEED_CHANNEL_ENTITY_MISSING", expected.code);
    if (channel.channelName !== expected.channelName || channel.orderKind !== expected.orderKind || channel.accessKind !== "EXTERNAL") fail("SEED_CHANNEL_LITERAL_INVALID", expected.code);
    if (channel.ownerNodeType !== "STORE" || channel.ownerNodeRef !== "COLLAB-STORE" || channel.operatorKind !== "STORE") fail("SEED_CHANNEL_OWNER_RELATION_INVALID", expected.code);
    if (!Object.prototype.hasOwnProperty.call(channel, "channelCode") || channel.channelCode !== null) fail("SEED_CHANNEL_CODE_MUST_REMAIN_UNDECIDED", expected.code);
    if (channel.templateRef !== expected.templateRef || channel.bindingRef !== expected.bindingRef) fail("SEED_CHANNEL_RELATION_INVALID", expected.code);
    const template = templatesByCode.get(expected.templateRef);
    if (!template || template.ownerNodeType !== "STORE" || template.orderKind !== expected.orderKind || template.accessKind !== "EXTERNAL") fail("SEED_CHANNEL_TEMPLATE_RELATION_INVALID", expected.code);
    const binding = bindingsByCode.get(expected.bindingRef);
    if (!binding || binding.nodeType !== "STORE" || binding.nodeRef !== "COLLAB-STORE" || binding.capabilityClass !== expected.orderKind) fail("SEED_CHANNEL_BINDING_RELATION_INVALID", expected.code);
    if (binding.bindingDisplayName !== expected.channelName) fail("SEED_CHANNEL_BINDING_NAME_INVALID", expected.code);
    if (!hasRelation(channel.code, "COLLAB-STORE", "OWNER_NODE") || !hasRelation(channel.code, expected.templateRef, "CHANNEL_TEMPLATE") || !hasRelation(channel.code, expected.bindingRef, "CHANNEL_BINDING")) fail("SEED_CHANNEL_RELATION_EDGE_MISSING", expected.code);
  }
  const dineInTemplates = entities.templates.filter((template) => template.orderKind === "DINE_IN");
  if (dineInTemplates.length !== 3) fail("SEED_DINE_IN_TEMPLATE_COUNT_INVALID");
  for (const form of ["POS", "QR", "KIOSK"]) {
    const matches = dineInTemplates.filter((template) => template.dineInForm === form);
    if (matches.length !== 1) fail("SEED_DINE_IN_FORM_COUNT_INVALID", form);
    if (matches[0].accessKind !== "INTERNAL" || matches[0].providerCode != null) fail("SEED_DINE_IN_MUST_BE_INTERNAL", form);
  }
  if (input.acceptanceScenarioIds.length !== 14 || new Set(input.acceptanceScenarioIds).size !== 14) fail("SEED_ACCEPTANCE_SCENARIO_COUNT_INVALID");
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
  expectRejected("CHANNEL_TEMPLATE_REF", (red) => { red.seedDatasets[0].entities.channels[0].templateRef = "TEMPLATE-STORE-GROUP-BUY"; });
  expectRejected("CHANNEL_BINDING_NAME", (red) => { red.seedDatasets[0].entities.bindings[0].bindingDisplayName = "未批准绑定"; });
  expectRejected("CHANNEL_BINDING_EDGE", (red) => {
    red.seedDatasets[0].entities.relations = red.seedDatasets[0].entities.relations.filter((relation) => relation.from !== "CHANNEL-STORE-TAKEAWAY-MEITUAN" || relation.refKind !== "CHANNEL_BINDING");
  });
  expectRejected("CHANNEL_CODE_GENERATED", (red) => { red.seedDatasets[0].entities.channels[0].channelCode = "CHANNEL-001"; });
  expectRejected("DINE_IN_KIOSK", (red) => {
    red.seedDatasets[0].entities.templates = red.seedDatasets[0].entities.templates.filter((template) => template.dineInForm !== "KIOSK");
  });
  expectRejected("DINE_IN_EXTERNAL", (red) => {
    red.seedDatasets[0].entities.templates.find((template) => template.dineInForm === "POS").accessKind = "EXTERNAL";
  });
  process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_SELF_TEST=PASS SCENARIOS=${plan.acceptanceScenarioIds.length} RED_CASES=12\n`);
}

export { plan, validate };
