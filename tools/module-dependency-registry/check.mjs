#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const MODULE_KEYS = ["moduleKey", "sourceRoot", "ownerSchema", "commandApiPackages"];
const VALUE_ONLY_MODULE_KEYS = [...MODULE_KEYS, "valueOnly"];
const COMMON_EDGE_KEYS = ["edgeId", "edgeKind", "fromModule", "toModule", "rationale"];
const EDGE_KEYS = {
  COMMAND: [...COMMON_EDGE_KEYS, "apiPackage", "operation"],
  VALUE_API: [...COMMON_EDGE_KEYS, "apiPackage", "operation"],
  SCHEMA_FK: [...COMMON_EDGE_KEYS, "referencingObject", "referencedObject", "constraintName"],
  TASK_READ: [...COMMON_EDGE_KEYS, "queryId", "initiatingModule", "referencedSchemaObject"],
};
const MODULE_KEY = /^[a-z][a-z0-9-]*$/;
const MODULE_SOURCE_ROOT = /^apps\/backend\/catering-business-server\/modules\/[a-z][a-z0-9-]*$/;
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
  if (edge.edgeKind === "VALUE_API") {
    return ["VALUE_API", edge.fromModule, edge.toModule, edge.apiPackage, edge.operation].join("|");
  }
  if (edge.edgeKind === "SCHEMA_FK") {
    return ["SCHEMA_FK", edge.referencingObject, edge.referencedObject, edge.constraintName].join("|");
  }
  return ["TASK_READ", edge.queryId, edge.initiatingModule, edge.referencedSchemaObject].join("|");
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function javaStringLiterals(source) {
  return [...source.matchAll(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"/g)].map((match) => match[0]);
}

export function validateSourceFacts(root, registry) {
  const ownerBySchema = new Map(
    registry.modules
      .filter((module) => module.ownerSchema !== null)
      .map((module) => [module.ownerSchema, module.moduleKey]),
  );
  const declaredReads = new Set(
    registry.edges
      .filter((edge) => edge.edgeKind === "TASK_READ")
      .map((edge) => `${edge.fromModule}|${edge.toModule}|${edge.referencedSchemaObject}`),
  );
  for (const module of registry.modules) {
    const sourceRoot = path.join(root, module.sourceRoot, "src/main");
    assert(fs.existsSync(sourceRoot), "MODULE_SOURCE_ROOT_MISSING", module.sourceRoot);
    const javaFiles = walkFiles(sourceRoot).filter((candidate) => candidate.endsWith(".java"));
    assert(javaFiles.length > 0, "MODULE_SOURCE_ROOT_EMPTY", module.sourceRoot);
    for (const file of javaFiles) {
      const relative = path.relative(root, file);
      for (const literal of javaStringLiterals(fs.readFileSync(file, "utf8"))) {
        for (const [schema, ownerModule] of ownerBySchema) {
          if (ownerModule === module.moduleKey || !literal.includes(`${schema}.`)) continue;
          const objects = [...literal.matchAll(new RegExp(`\\b${schema}\\.([a-z][a-z0-9_]*)`, "g"))]
            .map((match) => `${schema}.${match[1]}`);
          assert(objects.length > 0, "SOURCE_SCHEMA_OBJECT_DYNAMIC", `${relative}:${schema}`);
          for (const object of new Set(objects)) {
            assert(
              declaredReads.has(`${module.moduleKey}|${ownerModule}|${object}`),
              "SOURCE_TASK_READ_UNDECLARED",
              `${relative}:${object}`,
            );
          }
        }
      }
    }
  }
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
  const moduleSourceRoots = new Set();
  const ownerSchemas = new Set();
  const apiOwners = new Map();
  for (const module of registry.modules) {
    const valueOnly = module.valueOnly === true;
    assert(sameKeys(module, valueOnly ? VALUE_ONLY_MODULE_KEYS : MODULE_KEYS), "MODULE_SHAPE_INVALID");
    assert(MODULE_KEY.test(module.moduleKey), "MODULE_KEY_INVALID", module.moduleKey);
    assert(MODULE_SOURCE_ROOT.test(module.sourceRoot), "MODULE_SOURCE_ROOT_INVALID", module.sourceRoot);
    assert(!moduleSourceRoots.has(module.sourceRoot), "MODULE_SOURCE_ROOT_DUPLICATE", module.sourceRoot);
    moduleSourceRoots.add(module.sourceRoot);
    assert(module.ownerSchema === null || OWNER_SCHEMA.test(module.ownerSchema), "OWNER_SCHEMA_INVALID", module.ownerSchema);
    if (valueOnly) assert(module.ownerSchema === null, "VALUE_ONLY_OWNER_SCHEMA_FORBIDDEN", module.moduleKey);
    assert(Array.isArray(module.commandApiPackages), "COMMAND_API_PACKAGES_INVALID", module.moduleKey);
    assert(!modulesByKey.has(module.moduleKey), "MODULE_KEY_DUPLICATE", module.moduleKey);
    if (module.ownerSchema !== null) assert(!ownerSchemas.has(module.ownerSchema), "OWNER_SCHEMA_DUPLICATE", module.ownerSchema);
    modulesByKey.set(module.moduleKey, module);
    if (module.ownerSchema !== null) ownerSchemas.add(module.ownerSchema);
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

    if (edge.edgeKind === "COMMAND" || edge.edgeKind === "VALUE_API") {
      assert(JAVA_PACKAGE.test(edge.apiPackage), "COMMAND_API_PACKAGE_INVALID", edge.apiPackage);
      assert(OPERATION.test(edge.operation), "COMMAND_OPERATION_INVALID", edge.operation);
      assert(apiOwners.get(edge.apiPackage) === edge.toModule, "COMMAND_API_OWNER_MISMATCH", edge.edgeId);
      assert(!from.commandApiPackages.includes(edge.apiPackage), "COMMAND_API_OWNED_BY_CALLER", edge.edgeId);
      assert(to.commandApiPackages.includes(edge.apiPackage), "COMMAND_API_NOT_OWNED_BY_TARGET", edge.edgeId);
      if (edge.edgeKind === "VALUE_API") assert(to.valueOnly === true, "VALUE_API_TARGET_NOT_VALUE_ONLY", edge.edgeId);
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
      assert(to.ownerSchema !== null, "TASK_READ_TARGET_SCHEMALESS", edge.edgeId);
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
        sourceRoot: "apps/backend/catering-business-server/modules/orders",
        ownerSchema: "orders",
        commandApiPackages: ["com.catering.orders.api"],
      },
      {
        moduleKey: "inventory",
        sourceRoot: "apps/backend/catering-business-server/modules/inventory",
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

  const schemaLessAndValueOnly = edgeFixture();
  schemaLessAndValueOnly.modules.push({
    moduleKey: "access-facade",
    sourceRoot: "apps/backend/catering-business-server/modules/access-facade",
    ownerSchema: null,
    commandApiPackages: ["com.catering.access.api"],
  });
  schemaLessAndValueOnly.modules.push({
    moduleKey: "audit-values",
    sourceRoot: "apps/backend/catering-business-server/modules/audit-values",
    ownerSchema: null,
    valueOnly: true,
    commandApiPackages: ["com.catering.audit.values"],
  });
  schemaLessAndValueOnly.edges.push({
    edgeId: "value-orders-audit",
    edgeKind: "VALUE_API",
    fromModule: "orders",
    toModule: "audit-values",
    rationale: "Carry immutable audit value objects without a fact schema.",
    apiPackage: "com.catering.audit.values",
    operation: "AuditValues",
  });
  expectPass("schema-less-facade-and-value-api", schemaLessAndValueOnly);

  const invalidValueTarget = deepClone(schemaLessAndValueOnly);
  invalidValueTarget.edges[0].toModule = "access-facade";
  invalidValueTarget.edges[0].apiPackage = "com.catering.access.api";
  expectFail("value-api-target-must-be-value-only", invalidValueTarget, "VALUE_API_TARGET_NOT_VALUE_ONLY");

  const missingQuery = deepClone(reads);
  delete missingQuery.edges[0].queryId;
  expectFail("task-read-missing-query-id", missingQuery, "EDGE_SHAPE_INVALID");

  const extraField = deepClone(reads);
  extraField.edges[0].apiPackage = "com.catering.inventory.api";
  expectFail("task-read-extra-kind-field", extraField, "EDGE_SHAPE_INVALID");
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-module-source-root-"));
  try {
    const ordersSource = path.join(sourceRoot, "apps/backend/catering-business-server/modules/orders/src/main/Orders.java");
    for (const module of edgeFixture().modules) {
      const source = path.join(sourceRoot, module.sourceRoot, "src/main", `${module.moduleKey}.java`);
      fs.mkdirSync(path.dirname(source), {recursive: true});
      fs.writeFileSync(source, `package fixture; class ${module.moduleKey === "orders" ? "Orders" : "Inventory"} {}\n`);
    }
    validateSourceFacts(sourceRoot, edgeFixture());

    fs.writeFileSync(
      ordersSource,
      'package fixture; class Orders { String query = "SELECT id FROM inventory.inventory_item"; }\n',
    );
    try {
      validateSourceFacts(sourceRoot, edgeFixture());
      throw new Error("SELF_TEST_FALSE_GREEN:source-task-read-unregistered");
    } catch (error) {
      assert(
        error.message.startsWith("SOURCE_TASK_READ_UNDECLARED"),
        "SELF_TEST_WRONG_FAILURE",
        `source-task-read-unregistered: ${error.message}`,
      );
      process.stdout.write("FIXTURE=source-task-read-unregistered; EXPECTED=FAIL; ACTUAL=FAIL\n");
    }

    const misownedTaskRead = edgeFixture();
    misownedTaskRead.edges.push({
      edgeId: "read-inventory-orders-wrong-owner",
      edgeKind: "TASK_READ",
      fromModule: "inventory",
      toModule: "orders",
      rationale: "Fixture declares the query under the wrong owner.",
      queryId: "wrong-owner-query",
      initiatingModule: "inventory",
      referencedSchemaObject: "orders.order",
    });
    try {
      validateSourceFacts(sourceRoot, misownedTaskRead);
      throw new Error("SELF_TEST_FALSE_GREEN:source-task-read-misowned");
    } catch (error) {
      assert(
        error.message.startsWith("SOURCE_TASK_READ_UNDECLARED"),
        "SELF_TEST_WRONG_FAILURE",
        `source-task-read-misowned: ${error.message}`,
      );
      process.stdout.write("FIXTURE=source-task-read-misowned; EXPECTED=FAIL; ACTUAL=FAIL\n");
    }

    fs.writeFileSync(ordersSource, "package fixture; class Orders {}\n");
    fs.rmSync(path.join(sourceRoot, "apps/backend/catering-business-server/modules/orders"), {recursive: true, force: true});
    try { validateSourceFacts(sourceRoot, edgeFixture()); throw new Error("SELF_TEST_FALSE_GREEN:module-source-root-missing"); }
    catch (error) { assert(error.message.startsWith("MODULE_SOURCE_ROOT_MISSING"), "SELF_TEST_WRONG_FAILURE", error.message); }
    fs.mkdirSync(path.join(sourceRoot, "apps/backend/catering-business-server/modules/orders/src/main"), {recursive: true});
    try { validateSourceFacts(sourceRoot, edgeFixture()); throw new Error("SELF_TEST_FALSE_GREEN:module-source-root-empty"); }
    catch (error) { assert(error.message.startsWith("MODULE_SOURCE_ROOT_EMPTY"), "SELF_TEST_WRONG_FAILURE", error.message); }
    process.stdout.write("RED_MODULE_SOURCE_ROOT_MISSING=PASS\nRED_MODULE_SOURCE_ROOT_EMPTY=PASS\n");
  } finally { fs.rmSync(sourceRoot, {recursive: true, force: true}); }
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
    if (!args.registry && !args.requireEmpty) validateSourceFacts(root, registry);
    process.stdout.write(`MODULE_DEPENDENCY_REGISTRY=PASS; PATH=${path.relative(root, registryPath)}\n`);
  }
} catch (error) {
  process.stderr.write(`MODULE_DEPENDENCY_REGISTRY=FAIL; ${error.message}\n`);
  process.exitCode = 1;
}
