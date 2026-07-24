#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const MODULE_KEYS = ["moduleKey", "ownerSchema", "commandApiPackages"];
const COMMON_EDGE_KEYS = ["edgeId", "edgeKind", "fromModule", "toModule", "rationale"];
const EDGE_KEYS = {
  COMMAND: [...COMMON_EDGE_KEYS, "apiPackage", "operation"],
  SCHEMA_FK: [...COMMON_EDGE_KEYS, "referencingObject", "referencedObject", "constraintName"],
  TASK_READ: [...COMMON_EDGE_KEYS, "queryId", "initiatingModule", "referencedSchemaObject"],
};
const MODULE_KEY = /^[a-z][a-z0-9-]*$/;
const OWNER_SCHEMA = /^[a-z][a-z0-9_]*$/;
const JAVA_PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const OPERATION = /^[A-Z][A-Za-z0-9]*$/;

function sameKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function assert(condition, code, details = "") {
  if (!condition) {
    throw new Error(`${code}${details ? `: ${details}` : ""}`);
  }
}

function assertNonEmpty(value, code) {
  assert(typeof value === "string" && value.trim() === value && value.length > 0, code);
}

function hasCycle(modules, edges) {
  const adjacency = new Map(modules.map(({moduleKey}) => [moduleKey, []]));
  const indegree = new Map(modules.map(({moduleKey}) => [moduleKey, 0]));
  for (const edge of edges) {
    adjacency.get(edge.fromModule).push(edge.toModule);
    indegree.set(edge.toModule, indegree.get(edge.toModule) + 1);
  }
  const queue = [...indegree].filter(([, count]) => count === 0).map(([key]) => key);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    visited += 1;
    for (const next of adjacency.get(current)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return visited !== modules.length;
}

function semanticKey(edge) {
  if (edge.edgeKind === "COMMAND") {
    return ["COMMAND", edge.fromModule, edge.toModule, edge.apiPackage, edge.operation].join("|");
  }
  if (edge.edgeKind === "SCHEMA_FK") {
    return ["SCHEMA_FK", edge.referencingObject, edge.referencedObject, edge.constraintName].join("|");
  }
  return ["TASK_READ", edge.queryId, edge.initiatingModule, edge.referencedSchemaObject].join("|");
}

export function validateRegistry(registry, {requireEmpty = false} = {}) {
  assert(
    sameKeys(registry, ["schemaVersion", "kind", "status", "modules", "edges"]),
    "REGISTRY_TOP_LEVEL_SHAPE_INVALID",
  );
  assert(registry.schemaVersion === 1, "REGISTRY_SCHEMA_VERSION_INVALID");
  assert(registry.kind === "module-dependency-registry", "REGISTRY_KIND_INVALID");
  assert(registry.status === "ACTIVE", "REGISTRY_STATUS_INVALID");
  assert(Array.isArray(registry.modules), "REGISTRY_MODULES_INVALID");
  assert(Array.isArray(registry.edges), "REGISTRY_EDGES_INVALID");

  const modulesByKey = new Map();
  const ownerSchemas = new Set();
  const apiOwners = new Map();
  for (const module of registry.modules) {
    assert(sameKeys(module, MODULE_KEYS), "MODULE_SHAPE_INVALID");
    assert(MODULE_KEY.test(module.moduleKey), "MODULE_KEY_INVALID", module.moduleKey);
    assert(OWNER_SCHEMA.test(module.ownerSchema), "OWNER_SCHEMA_INVALID", module.ownerSchema);
    assert(Array.isArray(module.commandApiPackages), "COMMAND_API_PACKAGES_INVALID", module.moduleKey);
    assert(!modulesByKey.has(module.moduleKey), "MODULE_KEY_DUPLICATE", module.moduleKey);
    assert(!ownerSchemas.has(module.ownerSchema), "OWNER_SCHEMA_DUPLICATE", module.ownerSchema);
    modulesByKey.set(module.moduleKey, module);
    ownerSchemas.add(module.ownerSchema);
    const localPackages = new Set();
    for (const apiPackage of module.commandApiPackages) {
      assert(JAVA_PACKAGE.test(apiPackage), "COMMAND_API_PACKAGE_INVALID", apiPackage);
      assert(!localPackages.has(apiPackage), "COMMAND_API_PACKAGE_DUPLICATE", apiPackage);
      assert(!apiOwners.has(apiPackage), "COMMAND_API_PACKAGE_OWNER_DUPLICATE", apiPackage);
      localPackages.add(apiPackage);
      apiOwners.set(apiPackage, module.moduleKey);
    }
  }

  const edgeIds = new Set();
  const semanticKeys = new Set();
  for (const edge of registry.edges) {
    assert(edge && typeof edge === "object" && !Array.isArray(edge), "EDGE_INVALID");
    assert(Object.hasOwn(EDGE_KEYS, edge.edgeKind), "EDGE_KIND_INVALID", edge.edgeKind);
    assert(sameKeys(edge, EDGE_KEYS[edge.edgeKind]), "EDGE_SHAPE_INVALID", edge.edgeId);
    assertNonEmpty(edge.edgeId, "EDGE_ID_INVALID");
    assertNonEmpty(edge.rationale, "EDGE_RATIONALE_INVALID");
    assert(!edgeIds.has(edge.edgeId), "EDGE_ID_DUPLICATE", edge.edgeId);
    edgeIds.add(edge.edgeId);
    assert(modulesByKey.has(edge.fromModule), "EDGE_FROM_MODULE_UNKNOWN", edge.fromModule);
    assert(modulesByKey.has(edge.toModule), "EDGE_TO_MODULE_UNKNOWN", edge.toModule);
    assert(edge.fromModule !== edge.toModule, "EDGE_SELF_REFERENCE", edge.edgeId);
    const from = modulesByKey.get(edge.fromModule);
    const to = modulesByKey.get(edge.toModule);

    if (edge.edgeKind === "COMMAND") {
      assert(JAVA_PACKAGE.test(edge.apiPackage), "COMMAND_API_PACKAGE_INVALID", edge.apiPackage);
      assert(OPERATION.test(edge.operation), "COMMAND_OPERATION_INVALID", edge.operation);
      assert(apiOwners.get(edge.apiPackage) === edge.toModule, "COMMAND_API_OWNER_MISMATCH", edge.edgeId);
      assert(!from.commandApiPackages.includes(edge.apiPackage), "COMMAND_API_OWNED_BY_CALLER", edge.edgeId);
      assert(to.commandApiPackages.includes(edge.apiPackage), "COMMAND_API_NOT_OWNED_BY_TARGET", edge.edgeId);
    } else if (edge.edgeKind === "SCHEMA_FK") {
      assertNonEmpty(edge.constraintName, "SCHEMA_FK_CONSTRAINT_INVALID");
      assert(
        typeof edge.referencingObject === "string" &&
          edge.referencingObject.startsWith(`${from.ownerSchema}.`) &&
          edge.referencingObject.length > from.ownerSchema.length + 1,
        "SCHEMA_FK_REFERENCING_OWNER_MISMATCH",
        edge.edgeId,
      );
      assert(
        typeof edge.referencedObject === "string" &&
          edge.referencedObject.startsWith(`${to.ownerSchema}.`) &&
          edge.referencedObject.length > to.ownerSchema.length + 1,
        "SCHEMA_FK_REFERENCED_OWNER_MISMATCH",
        edge.edgeId,
      );
    } else {
      assertNonEmpty(edge.queryId, "TASK_READ_QUERY_ID_INVALID");
      assert(edge.initiatingModule === edge.fromModule, "TASK_READ_INITIATOR_MISMATCH", edge.edgeId);
      assert(
        typeof edge.referencedSchemaObject === "string" &&
          edge.referencedSchemaObject.startsWith(`${to.ownerSchema}.`) &&
          edge.referencedSchemaObject.length > to.ownerSchema.length + 1,
        "TASK_READ_TARGET_OWNER_MISMATCH",
        edge.edgeId,
      );
    }

    const key = semanticKey(edge);
    assert(!semanticKeys.has(key), "EDGE_SEMANTIC_KEY_DUPLICATE", key);
    semanticKeys.add(key);
  }

  assert(
    !hasCycle(registry.modules, registry.edges.filter(({edgeKind}) => edgeKind === "COMMAND")),
    "COMMAND_DAG_CYCLE",
  );
  assert(
    !hasCycle(registry.modules, registry.edges.filter(({edgeKind}) => edgeKind === "SCHEMA_FK")),
    "SCHEMA_FK_DAG_CYCLE",
  );
  if (requireEmpty) {
    assert(registry.modules.length === 0 && registry.edges.length === 0, "R1_EMPTY_REALITY_REQUIRED");
  }
  return true;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function edgeFixture() {
  return {
    schemaVersion: 1,
    kind: "module-dependency-registry",
    status: "ACTIVE",
    modules: [
      {
        moduleKey: "orders",
        ownerSchema: "orders",
        commandApiPackages: ["com.catering.orders.api"],
      },
      {
        moduleKey: "inventory",
        ownerSchema: "inventory",
        commandApiPackages: ["com.catering.inventory.api"],
      },
    ],
    edges: [],
  };
}

function expectPass(name, registry) {
  validateRegistry(registry);
  process.stdout.write(`FIXTURE=${name}; EXPECTED=PASS; ACTUAL=PASS\n`);
}

function expectFail(name, registry, expectedCode) {
  try {
    validateRegistry(registry);
  } catch (error) {
    assert(error.message.startsWith(expectedCode), "SELF_TEST_WRONG_FAILURE", `${name}: ${error.message}`);
    process.stdout.write(`FIXTURE=${name}; EXPECTED=FAIL; ACTUAL=FAIL; CODE=${expectedCode}\n`);
    return;
  }
  throw new Error(`SELF_TEST_FALSE_GREEN: ${name}`);
}

function selfTest() {
  const command = {
    edgeId: "cmd-orders-inventory-reserve",
    edgeKind: "COMMAND",
    fromModule: "orders",
    toModule: "inventory",
    rationale: "Reserve stock in the target owner transaction.",
    apiPackage: "com.catering.inventory.api",
    operation: "ReserveInventory",
  };
  const validCommand = edgeFixture();
  validCommand.edges.push(command);
  expectPass("command-correct-target-owner", validCommand);

  const swapped = edgeFixture();
  swapped.edges.push({...command, fromModule: "inventory", toModule: "orders"});
  expectFail("command-swapped-direction", swapped, "COMMAND_API_OWNER_MISMATCH");

  const unknownOwner = edgeFixture();
  unknownOwner.edges.push({...command, apiPackage: "com.catering.unknown.api"});
  expectFail("command-unknown-api-owner", unknownOwner, "COMMAND_API_OWNER_MISMATCH");

  const fkValid = {
    edgeId: "fk-orders-inventory",
    edgeKind: "SCHEMA_FK",
    fromModule: "orders",
    toModule: "inventory",
    rationale: "Relational integrity across owner schemas.",
    referencingObject: "orders.order_line.inventory_item_id",
    referencedObject: "inventory.inventory_item.id",
    constraintName: "fk_order_line_inventory_item",
  };
  const fkInverted = edgeFixture();
  fkInverted.edges.push({...fkValid, referencingObject: "inventory.inventory_item.id"});
  expectFail("schema-fk-owner-inversion", fkInverted, "SCHEMA_FK_REFERENCING_OWNER_MISMATCH");

  const duplicateId = edgeFixture();
  duplicateId.edges.push(command, {
    ...fkValid,
    edgeId: command.edgeId,
  });
  expectFail("duplicate-edge-id", duplicateId, "EDGE_ID_DUPLICATE");

  const duplicateSemantic = edgeFixture();
  duplicateSemantic.edges.push(command, {...command, edgeId: "cmd-orders-inventory-reserve-2"});
  expectFail("duplicate-semantic-key", duplicateSemantic, "EDGE_SEMANTIC_KEY_DUPLICATE");

  const missingTarget = edgeFixture();
  missingTarget.edges.push({...command, toModule: "missing"});
  expectFail("missing-target-module", missingTarget, "EDGE_TO_MODULE_UNKNOWN");

  const commandCycle = edgeFixture();
  commandCycle.edges.push(command, {
    ...command,
    edgeId: "cmd-inventory-orders-update",
    fromModule: "inventory",
    toModule: "orders",
    apiPackage: "com.catering.orders.api",
    operation: "UpdateOrder",
  });
  expectFail("command-cycle", commandCycle, "COMMAND_DAG_CYCLE");

  const fkCycle = edgeFixture();
  fkCycle.edges.push(fkValid, {
    ...fkValid,
    edgeId: "fk-inventory-orders",
    fromModule: "inventory",
    toModule: "orders",
    referencingObject: "inventory.inventory_item.order_id",
    referencedObject: "orders.order.id",
    constraintName: "fk_inventory_item_order",
  });
  expectFail("schema-fk-cycle", fkCycle, "SCHEMA_FK_DAG_CYCLE");

  const reads = edgeFixture();
  reads.edges.push(
    {
      edgeId: "read-orders-inventory",
      edgeKind: "TASK_READ",
      fromModule: "orders",
      toModule: "inventory",
      rationale: "Compose a task-oriented order view.",
      queryId: "order-preparation",
      initiatingModule: "orders",
      referencedSchemaObject: "inventory.inventory_item",
    },
    {
      edgeId: "read-inventory-orders",
      edgeKind: "TASK_READ",
      fromModule: "inventory",
      toModule: "orders",
      rationale: "Compose a task-oriented replenishment view.",
      queryId: "inventory-replenishment",
      initiatingModule: "inventory",
      referencedSchemaObject: "orders.order_line",
    },
  );
  expectPass("task-read-cycle-legal", reads);

  const missingQuery = deepClone(reads);
  delete missingQuery.edges[0].queryId;
  expectFail("task-read-missing-query-id", missingQuery, "EDGE_SHAPE_INVALID");

  const extraField = deepClone(reads);
  extraField.edges[0].apiPackage = "com.catering.inventory.api";
  expectFail("task-read-extra-kind-field", extraField, "EDGE_SHAPE_INVALID");
  process.stdout.write("MODULE_DEPENDENCY_REGISTRY_SELF_TEST=PASS\n");
}

function parseArgs(argv) {
  const args = {selfTest: false, requireEmpty: false, registry: null};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--self-test") args.selfTest = true;
    else if (token === "--require-empty") args.requireEmpty = true;
    else if (token === "--registry") args.registry = argv[++index];
    else throw new Error(`UNKNOWN_ARGUMENT: ${token}`);
  }
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    selfTest();
  } else {
    const root = process.env.CATERING_V2S_ROOT || process.cwd();
    const registryPath = path.resolve(root, args.registry || "contracts/policy/module-dependency-registry.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    validateRegistry(registry, {requireEmpty: args.requireEmpty});
    process.stdout.write(`MODULE_DEPENDENCY_REGISTRY=PASS; PATH=${path.relative(root, registryPath)}\n`);
  }
} catch (error) {
  process.stderr.write(`MODULE_DEPENDENCY_REGISTRY=FAIL; ${error.message}\n`);
  process.exitCode = 1;
}
