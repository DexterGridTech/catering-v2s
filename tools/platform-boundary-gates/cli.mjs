#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, "../..");
const inventoryRelativePath = "doc/evidence/platform/r3-gate-0-business-source-inventory.json";
const expectedInventory = {
  kind: "r3-business-source-inventory",
  programId: "V2S_W0_W4_EXECUTION",
  roadmapStep: "R3",
  schemaVersion: 1,
  sources: [],
  status: "EMPTY_BEFORE_GATE_0",
};

function fail(code, detail) {
  const error = new Error(`${code}${detail ? `: ${detail}` : ""}`);
  error.code = code;
  throw error;
}

function fileExists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function walkFiles(root, relative = "") {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if ([".git", "node_modules", ".gradle", "build", "dist"].includes(entry.name)) continue;
    const child = path.join(relative, entry.name);
    files.push(...walkFiles(root, child));
  }
  return files;
}

function filesUnder(root, relativePath) {
  return walkFiles(root, relativePath);
}

function assertInventory(root) {
  const absolute = path.join(root, inventoryRelativePath);
  if (!fs.existsSync(absolute)) fail("R3_GATE0_INVENTORY_MISSING", inventoryRelativePath);

  let actual;
  try {
    actual = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    fail("R3_GATE0_INVENTORY_INVALID_JSON", error.message);
  }

  if (JSON.stringify(actual) !== JSON.stringify(expectedInventory)) {
    fail("R3_GATE0_INVENTORY_NOT_EMPTY_OR_EXACT", inventoryRelativePath);
  }
}

function validatePostGate0ContractFace(root) {
  const specPath = path.join(root, "contracts/openapi/edge.openapi.yaml");
  if (!fs.existsSync(specPath)) fail("R3_CONTRACT_FACE_MISSING", "contracts/openapi/edge.openapi.yaml");

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch (error) {
    fail("R3_CONTRACT_FACE_INVALID", error.message);
  }

  const reportPath = path.join(root, "doc/evidence/platform/r5-u01-edge-placement-resolution.json");
  let report;
  try { report = JSON.parse(fs.readFileSync(reportPath, "utf8")); } catch (error) { fail("R5_CONTRACT_FACE_RESOLUTION_REPORT_INVALID", error.message); }
  if (report.operations?.length !== 106 || JSON.stringify(report.closure?.faceCounts) !== JSON.stringify({ "platform-admin": 39, "operations-admin": 56, public: 11 })) fail("R5_CONTRACT_FACE_OPERATION_CLOSURE_INVALID");
  const rootRoutes = Object.entries(spec.paths ?? {});
  if (rootRoutes.length === 0 || rootRoutes.some(([, item]) => !item?.$ref?.startsWith("./paths/"))) fail("R5_CONTRACT_FACE_ROOT_REFERENCE_INVALID");
  if (spec.components?.schemas?.Problem?.$ref !== "./components/common/problem.schemas.yaml#/components/schemas/Problem") fail("R5_CONTRACT_FACE_PROBLEM_REFERENCE_INVALID");
  const problem = JSON.parse(fs.readFileSync(path.join(root, "contracts/openapi/components/common/problem.schemas.yaml"), "utf8")).components?.schemas?.Problem;
  if (!problem?.required?.includes("errorCode") || !problem?.required?.includes("correlationId") || problem.properties?.code) fail("R5_CONTRACT_FACE_PROBLEM_WIRE_INVALID");

  const generated = [
    "apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/EdgeProblemCode.java",
    "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
    "apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts",
    "apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts",
    "apps/frontend/operations-admin/src/app/api/generated/public-edge.ts",
  ];
  const missing = generated.filter((relativePath) => !fileExists(root, relativePath));
  if (missing.length > 0) fail("R5_CONTRACT_FACE_GENERATED_CLOSURE_MISSING", missing.join(","));
  const generatedCheck = spawnSync(process.execPath, [path.join(root, "scripts/generate/edge-codegen.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  if (generatedCheck.status !== 0) {
    fail("R5_CONTRACT_FACE_GENERATED_DRIFT", (generatedCheck.stdout || generatedCheck.stderr || "").trim());
  }
}

function validateContractFace(root, postGate0 = false) {
  if (postGate0) return validatePostGate0ContractFace(root);
  const files = filesUnder(root, "contracts/openapi");
  if (files.length > 0) fail("R3_CONTRACT_FACE_NOT_EMPTY", files.join(","));
}

function validateFlywayLayout(root, postGate0 = false) {
  const migrationFiles = walkFiles(root).filter((relativePath) => {
    const normalized = relativePath.split(path.sep).join("/");
    return normalized.split("/").includes("migration") || /^V\d+__.+\.sql$/i.test(path.basename(normalized));
  }).map((relativePath) => relativePath.split(path.sep).join("/")).sort();
  if (!postGate0) {
    if (migrationFiles.length > 0) fail("R3_FLYWAY_LAYOUT_NOT_EMPTY", migrationFiles.join(","));
    return;
  }
  const acceptedMigrationRoot = "apps/backend/catering-business-server/src/main/resources/db/migration";
  const expectedPrefix = `${acceptedMigrationRoot}/`;
  const currentOrderedDenominator = filesUnder(root, acceptedMigrationRoot)
    .map((relativePath) => relativePath.split(path.sep).join("/"))
    .sort();
  if (currentOrderedDenominator.length === 0) fail("R5_FLYWAY_MIGRATION_MISSING", expectedPrefix);
  const invalid = migrationFiles.filter((relativePath) => {
    return !currentOrderedDenominator.includes(relativePath)
      || !/^V\d+_\d+_\d+__.+\.sql$/i.test(path.basename(relativePath));
  });
  if (invalid.length > 0) fail("R5_FLYWAY_LAYOUT_INVALID", invalid.join(","));
  const migrationText = currentOrderedDenominator.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  if (/ON\s+(?:DELETE|UPDATE)\s+CASCADE|\bDEFERRABLE\b/i.test(migrationText)) {
    fail("R5_FLYWAY_FORBIDDEN_CASCADE_OR_DEFERRABLE");
  }
  for (const schema of ["platform_workspace", "platform_iam", "platform_asset", "organization", "extension", "workspace_iam", "contract"]) {
    if (!new RegExp(`CREATE\\s+SCHEMA\\s+${schema}\\b`, "i").test(migrationText)) {
      fail("R5_FLYWAY_OWNER_SCHEMA_MISSING", schema);
    }
  }
  if (!/CREATE\s+TABLE\s+platform_workspace\.group_workspace\b/i.test(migrationText)
      || !/CREATE\s+TABLE\s+organization\.commercial_group\b/i.test(migrationText)
      || !/CREATE\s+TABLE\s+workspace_iam\.workspace_account\b/i.test(migrationText)
      || !/CREATE\s+TABLE\s+contract\.store_contract\b/i.test(migrationText)
      || !/CONSTRAINT\s+fk_commercial_group_workspace\b/i.test(migrationText)) {
    fail("R5_FLYWAY_OWNER_DDL_INCOMPLETE");
  }
}

function validateProductionConformity(root, postGate0 = false) {
  if (postGate0) {
    assertInventory(root);
    const appFiles = filesUnder(root, "apps/backend");
    if (appFiles.length === 0) fail("R3_PRODUCTION_BACKEND_MISSING");
    validateContractFace(root, true);
    validateFlywayLayout(root, true);
    return;
  }
  assertInventory(root);
  const appFiles = filesUnder(root, "apps");
  if (appFiles.length > 0) fail("R3_PRODUCTION_APP_SOURCE_NOT_EMPTY", appFiles.join(","));
  validateContractFace(root);
  validateFlywayLayout(root);
}

function validateGateWiring(root) {
  const requiredFiles = [
    "scripts/check/code-layout",
    "scripts/check/gate-0",
    "scripts/check/contract-face",
    "scripts/check/flyway-layout",
    "scripts/check/production-conformity",
    "tools/platform-boundary-gates/cli.mjs",
    inventoryRelativePath,
  ];
  const missing = requiredFiles.filter((relativePath) => !fileExists(root, relativePath));
  if (missing.length > 0) fail("R3_GATE0_WIRING_INCOMPLETE", missing.join(","));
}

function runCodeLayout(root, selfTest = false) {
  const args = [path.join(root, "tools/code-layout/cli.mjs")];
  if (selfTest) args.push("--self-test");
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    fail("R3_GATE0_CODE_LAYOUT_FAILED", (result.stdout || result.stderr || "").trim());
  }
  return (result.stdout || "").trim();
}

function validateGate0(root) {
  validateGateWiring(root);
  validateProductionConformity(root);
  runCodeLayout(root);
}

function makeScratchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "catering-v2s-r3-gate-"));
}

function writeScratchFile(root, relativePath, content = "red\n") {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function expectFailure(label, callback, expectedCode) {
  try {
    callback();
  } catch (error) {
    if (error.code !== expectedCode) {
      fail("R3_GATE0_SELF_TEST_WRONG_RED", `${label}:${error.code || error.message}`);
    }
    return `${label}=RED(${expectedCode})`;
  }
  fail("R3_GATE0_SELF_TEST_RED_NOT_DETECTED", label);
}

function writeR5FlywayFixture(root) {
  const prefix = "apps/backend/catering-business-server/src/main/resources/db/migration/";
  const r3 = "CREATE SCHEMA platform_workspace; CREATE SCHEMA organization; CREATE TABLE platform_workspace.group_workspace(id BIGINT PRIMARY KEY); CREATE TABLE organization.commercial_group(id BIGINT PRIMARY KEY, CONSTRAINT fk_commercial_group_workspace FOREIGN KEY(id) REFERENCES platform_workspace.group_workspace(id));";
  const r5 = "CREATE SCHEMA platform_iam; CREATE SCHEMA platform_asset; CREATE SCHEMA extension; CREATE SCHEMA workspace_iam; CREATE SCHEMA contract; CREATE TABLE workspace_iam.workspace_account(id UUID); CREATE TABLE contract.store_contract(id UUID);";
  const lifecycle = "CREATE TABLE workspace_iam.invitation_public_progress(invitation_id UUID PRIMARY KEY, verification_grant_hash CHAR(64), password_hash VARCHAR(255));";
  const passwordResetProgress = "CREATE TABLE workspace_iam.password_reset_progress(password_reset_id UUID PRIMARY KEY, password_reset_grant_hash CHAR(64));";
  const assignmentAudit = "ALTER TABLE workspace_iam.role_assignment ADD COLUMN created_at_epoch_millis BIGINT NOT NULL DEFAULT 0;";
  const assetContent = "CREATE TABLE platform_asset.asset_content(asset_ref UUID PRIMARY KEY, content_bytes BYTEA NOT NULL); CREATE TABLE platform_asset.asset_bind_grant(asset_ref UUID PRIMARY KEY, grant_hash CHAR(64) NOT NULL);";
  const persistenceCorrection = "ALTER TABLE organization.brand ADD COLUMN alias VARCHAR(120);";
  const jsonStorageAlignment = "ALTER TABLE organization.brand ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb;";
  const roleReadbackTimestamps = "ALTER TABLE workspace_iam.workspace_role ADD COLUMN created_at_epoch_millis BIGINT NOT NULL, ADD COLUMN updated_at_epoch_millis BIGINT NOT NULL;";
  const invitationLifecycleTimestamps = "ALTER TABLE workspace_iam.invitation ADD COLUMN created_at_epoch_millis BIGINT NOT NULL;";
  const organizationNodeNotes = "ALTER TABLE organization.organization_node ADD COLUMN notes VARCHAR(2000);";
  writeScratchFile(root, `${prefix}V20260725_170000_000__platform_workspace_and_commercial_group.sql`, r3);
  writeScratchFile(root, `${prefix}V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql`, r5);
  writeScratchFile(root, `${prefix}V20260726_110000_000__workspace_access_lifecycle_support.sql`, lifecycle);
  writeScratchFile(root, `${prefix}V20260726_120000_000__workspace_password_reset_progress.sql`, passwordResetProgress);
  writeScratchFile(root, `${prefix}V20260726_130000_000__workspace_assignment_audit_timestamps.sql`, assignmentAudit);
  writeScratchFile(root, `${prefix}V20260726_140000_000__platform_asset_content_and_bind_grant.sql`, assetContent);
  writeScratchFile(root, `${prefix}V20260726_150000_000__organization_and_contract_persistence_correction.sql`, persistenceCorrection);
  writeScratchFile(root, `${prefix}V20260726_160000_000__extension_and_role_json_storage_alignment.sql`, jsonStorageAlignment);
  writeScratchFile(root, `${prefix}V20260726_170000_000__workspace_role_readback_timestamps.sql`, roleReadbackTimestamps);
  writeScratchFile(root, `${prefix}V20260726_180000_000__workspace_invitation_lifecycle_timestamps.sql`, invitationLifecycleTimestamps);
  writeScratchFile(root, `${prefix}V20260726_190000_000__organization_node_notes.sql`, organizationNodeNotes);
  writeScratchFile(root, `${prefix}V20260726_200000_000__brand_name_uniqueness.sql`, "CREATE UNIQUE INDEX uq_brand_normalized_name ON organization.brand (id);");
  writeScratchFile(root, `${prefix}V20260726_210000_000__canonical_owner_audit_events.sql`, "CREATE TABLE organization.audit_event(id UUID PRIMARY KEY, occurred_at_epoch_millis BIGINT NOT NULL);");
}

function runSelfTest(kind, postGate0 = false) {
  const root = makeScratchRoot();
  try {
    if (postGate0) fs.cpSync(defaultRoot, root, { recursive: true, filter: (source) => !source.includes("/.git") && !source.includes("/build") && !source.includes("/dist") });
    writeScratchFile(root, inventoryRelativePath, `${JSON.stringify(expectedInventory, null, 2)}\n`);
    if (postGate0 && (kind === "flyway" || kind === "production" || kind === "gate-0")) writeR5FlywayFixture(root);
    const cleanValidators = {
      contract: (repositoryRoot) => validateContractFace(repositoryRoot, postGate0),
      flyway: (repositoryRoot) => validateFlywayLayout(repositoryRoot, postGate0),
      production: (repositoryRoot) => validateProductionConformity(repositoryRoot, postGate0),
      "gate-0": validateProductionConformity,
    };
    cleanValidators[kind](root);

    const redResults = [];
    if (kind === "contract" || kind === "gate-0") {
      writeScratchFile(root, "contracts/openapi/edge.openapi.yaml");
      redResults.push(expectFailure("contract", () => validateContractFace(root, postGate0), postGate0 ? "R3_CONTRACT_FACE_INVALID" : "R3_CONTRACT_FACE_NOT_EMPTY"));
      fs.rmSync(path.join(root, "contracts"), { recursive: true, force: true });
    }
    if (kind === "flyway" || kind === "gate-0") {
      const unexpectedRoot = postGate0 ? "apps/backend/unapproved-server/src/main/resources/db/migration/V20260727_000000_000__unexpected.sql" : "apps/backend/src/main/resources/db/migration/V1__red.sql";
      writeScratchFile(root, unexpectedRoot);
      redResults.push(expectFailure("flyway-unexpected-root", () => validateFlywayLayout(root, postGate0), postGate0 ? "R5_FLYWAY_LAYOUT_INVALID" : "R3_FLYWAY_LAYOUT_NOT_EMPTY"));
      if (postGate0) {
        writeScratchFile(root, "apps/backend/catering-business-server/src/main/resources/db/migration/U20260727_000000_000__invalid.sql");
        redResults.push(expectFailure("flyway-invalid-name", () => validateFlywayLayout(root, true), "R5_FLYWAY_LAYOUT_INVALID"));
      }
      fs.rmSync(path.join(root, "apps"), { recursive: true, force: true });
    }
    if (kind === "production" || kind === "gate-0") {
      writeScratchFile(root, "apps/backend/Main.java");
      redResults.push(expectFailure("production", () => validateProductionConformity(root), "R3_PRODUCTION_APP_SOURCE_NOT_EMPTY"));
    }
    return `${postGate0 ? "R5" : "R3"}_${kind.toUpperCase().replaceAll("-", "_")}_SELF_TEST=PASS; ${redResults.join("; ")}`;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const [, , command, ...args] = process.argv;
  const root = defaultRoot;
  const selfTest = args.includes("--self-test");
  const postGate0 = args.includes("--post-gate-0");
  const commands = {
    contract: (repositoryRoot) => validateContractFace(repositoryRoot, postGate0),
    flyway: (repositoryRoot) => validateFlywayLayout(repositoryRoot, postGate0),
    production: (repositoryRoot) => validateProductionConformity(repositoryRoot, postGate0),
    "gate-0": validateGate0,
  };
  if (!commands[command]) fail("R3_GATE0_USAGE", "expected contract|flyway|production|gate-0 [--self-test] [--post-gate-0]");

  if (selfTest) {
    process.stdout.write(`${runSelfTest(command, postGate0)}\n`);
    if (command === "gate-0") {
      process.stdout.write(`${runSelfTest("contract")}\n`);
      process.stdout.write(`${runSelfTest("flyway", postGate0)}\n`);
      process.stdout.write(`${runSelfTest("production", postGate0)}\n`);
      process.stdout.write("CODE_LAYOUT_SELF_TEST=DELEGATED\n");
    }
    return;
  }

  commands[command](root);
  const label = command === "gate-0" ? "GATE_0" : `${postGate0 ? "R5" : "R3"}_${command.toUpperCase().replaceAll("-", "_")}`;
  process.stdout.write(`${label}=PASS; STATE=${postGate0 ? "POST_GATE_0" : "EMPTY_SOURCE_PRECONDITION"}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.code || "R3_GATE0_FAIL"}: ${error.message}\n`);
  process.exitCode = 1;
}
