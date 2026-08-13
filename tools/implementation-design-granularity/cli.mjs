#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shaPattern = /^[a-f0-9]{64}$/;
const unitIdPattern = /^[A-Z][A-Z0-9-]*-U\d{2}$/;
const findingSeverity = new Set(["M", "S", "N"]);
const reviewVerdicts = new Set(["GO", "NO_GO"]);
const unitVerdicts = new Set(["GO", "GO_WITH_N", "NO_GO"]);
const evidenceFields = ["l1", "l2", "l3", "business", "cleanup"];
const operationDesignRedFixtures = [
  "OPERATION_LOGIC_STEPS_MISSING",
  "OPERATION_CALL_CHAIN_OWNER_SET_DRIFT",
  "OPERATION_PROBLEM_MAPPING_DRIFT",
  "OPERATION_DB_COUNT_DRIFT",
];
const backendAcceptanceImpactValues = new Set([
  "NONE_WITH_REASON",
  "ADDED_OR_CHANGED",
]);
const backendAcceptanceScenarioFields = [
  "identity",
  "fixture",
  "request",
  "businessOracle",
  "performanceCriterion",
  "cleanup",
];
const backendAcceptanceUnitIds = [
  "BA-U01",
  "BA-U02",
  "BA-U03",
  "BA-U04",
  "BA-U05",
  "BA-U06",
];
const flowIdentifier = /(?:^|[\\/._-])(?:(?:r|u|j|jg|pkg)\d+[a-z0-9_-]*|g-\d+[a-z0-9_-]*)(?=$|[\\/._-])/i;

function fail(reason) {
  throw new Error(reason);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireString(value, reason) {
  if (!isNonEmptyString(value)) {
    fail(reason);
  }
  return value;
}

function requireStringArray(value, reason, minimum = 1) {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.some((entry) => !isNonEmptyString(entry))
  ) {
    fail(reason);
  }
  return value;
}

function requireUniqueStringArray(value, reason, minimum = 1) {
  const entries = requireStringArray(value, reason, minimum);
  if (new Set(entries).size !== entries.length) {
    fail(reason);
  }
  return entries;
}

function sameStringSet(left, right) {
  return (
    left.length === right.length &&
    left.every((entry) => right.includes(entry))
  );
}

function requireConsecutiveOrder(entries, field, reason) {
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    entries.some(
      (entry, index) =>
        !entry ||
        typeof entry !== "object" ||
        entry[field] !== index + 1,
    )
  ) {
    fail(reason);
  }
  return entries;
}

function resolveRepositoryPath(root, relativePath, reason) {
  requireString(relativePath, reason);
  if (
    path.isAbsolute(relativePath) ||
    relativePath.includes("\0") ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    fail(reason);
  }
  const resolved = path.resolve(root, relativePath);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    fail(reason);
  }
  return resolved;
}

function isRuntimeOrLibraryPath(relativePath) {
  return /^(?:apps|libraries)\//.test(relativePath);
}

function validateCapabilityNamedChangeSurface(unitId, surfacePath, disposition) {
  if (
    /^(create|update)$/.test(disposition) &&
    isRuntimeOrLibraryPath(surfacePath) &&
    flowIdentifier.test(surfacePath)
  ) {
    fail(`FLOW_IDENTIFIER_IN_DESIGN_CHANGE_SURFACE:${unitId}:${surfacePath}`);
  }
}

function readJson(root, relativePath, label) {
  const absolutePath = resolveRepositoryPath(
    root,
    relativePath,
    `${label}_PATH_INVALID`,
  );
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`${label}_NOT_FOUND:${relativePath}`);
  }
  try {
    return {
      absolutePath,
      bytes: fs.readFileSync(absolutePath),
      value: JSON.parse(fs.readFileSync(absolutePath, "utf8")),
    };
  } catch {
    fail(`${label}_INVALID_JSON:${relativePath}`);
  }
}

function readBoundFile(root, binding, label) {
  if (!binding || typeof binding !== "object") {
    fail(`${label}_BINDING_MISSING`);
  }
  const relativePath = requireString(binding.path, `${label}_PATH_MISSING`);
  const expectedHash = requireString(binding.sha256, `${label}_HASH_MISSING`);
  if (!shaPattern.test(expectedHash)) {
    fail(`${label}_HASH_INVALID`);
  }
  const absolutePath = resolveRepositoryPath(
    root,
    relativePath,
    `${label}_PATH_INVALID`,
  );
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`${label}_NOT_FOUND:${relativePath}`);
  }
  const bytes = fs.readFileSync(absolutePath);
  if (sha256(bytes) !== expectedHash) {
    fail(`${label}_HASH_DRIFT:${relativePath}`);
  }
  return {
    relativePath,
    absolutePath,
    bytes,
    text: bytes.toString("utf8"),
  };
}

function requireUniqueAnchor(text, anchor, label) {
  requireString(anchor, `${label}_ANCHOR_MISSING`);
  let count = 0;
  let offset = 0;
  while (true) {
    const found = text.indexOf(anchor, offset);
    if (found === -1) {
      break;
    }
    count += 1;
    offset = found + anchor.length;
  }
  if (count !== 1) {
    fail(`${label}_ANCHOR_NOT_UNIQUE:${count}`);
  }
}

function validateArtifactBinding(root, binding, label) {
  return readBoundFile(root, binding, label);
}

function validateBackendOperationDesignContract(root, binding) {
  const bound = readBoundFile(
    root,
    binding,
    "BACKEND_OPERATION_DESIGN_CONTRACT",
  );
  let contract;
  try {
    contract = JSON.parse(bound.text);
  } catch {
    fail("BACKEND_OPERATION_DESIGN_CONTRACT_INVALID_JSON");
  }
  if (
    contract?.schemaVersion !== 1 ||
    contract.kind !== "backend-operation-design-contract" ||
    !Array.isArray(contract.operations) ||
    contract.operations.length === 0
  ) {
    fail("BACKEND_OPERATION_DESIGN_CONTRACT_IDENTITY_INVALID");
  }

  const operationIds = new Set();
  for (const operation of contract.operations) {
    const operationId = requireString(
      operation?.operationId,
      "BACKEND_OPERATION_ID_MISSING",
    );
    if (operationIds.has(operationId)) {
      fail(`BACKEND_OPERATION_ID_DUPLICATE:${operationId}`);
    }
    operationIds.add(operationId);

    const initiatingOwner = requireString(
      operation.initiatingOwner,
      `OPERATION_INITIATING_OWNER_MISSING:${operationId}`,
    );
    const coordinatedOwners = requireUniqueStringArray(
      operation.coordinatedOwners,
      `OPERATION_COORDINATED_OWNERS_INVALID:${operationId}`,
      0,
    );
    const problemCodes = requireUniqueStringArray(
      operation.problemCodes,
      `OPERATION_PROBLEM_CODES_INVALID:${operationId}`,
    );

    const logicSteps = requireConsecutiveOrder(
      operation.logicSteps,
      "order",
      `OPERATION_LOGIC_STEPS_MISSING:${operationId}`,
    );
    const logicStepIds = new Set();
    for (const step of logicSteps) {
      const stepId = requireString(
        step.stepId,
        `OPERATION_LOGIC_STEPS_MISSING:${operationId}`,
      );
      requireString(
        step.action,
        `OPERATION_LOGIC_STEPS_MISSING:${operationId}`,
      );
      if (logicStepIds.has(stepId)) {
        fail(`OPERATION_LOGIC_STEP_ID_DUPLICATE:${operationId}:${stepId}`);
      }
      logicStepIds.add(stepId);
    }

    const callChain = requireConsecutiveOrder(
      operation.callChain,
      "order",
      `OPERATION_CALL_CHAIN_INVALID:${operationId}`,
    );
    const allowedCallKinds = new Set([
      "EDGE",
      "SECURITY_CONTEXT",
      "APPLICATION_COORDINATOR",
      "INITIATING_OWNER",
      "COORDINATED_OWNER",
    ]);
    const initiatingOwnerCalls = [];
    const coordinatedOwnerCalls = [];
    for (const call of callChain) {
      requireString(
        call.target,
        `OPERATION_CALL_CHAIN_INVALID:${operationId}`,
      );
      if (!allowedCallKinds.has(call.kind)) {
        fail(`OPERATION_CALL_CHAIN_KIND_INVALID:${operationId}`);
      }
      if (call.kind === "INITIATING_OWNER") {
        initiatingOwnerCalls.push(
          requireString(
            call.owner,
            `OPERATION_CALL_CHAIN_INITIATING_OWNER_MISMATCH:${operationId}`,
          ),
        );
      } else if (call.kind === "COORDINATED_OWNER") {
        coordinatedOwnerCalls.push(
          requireString(
            call.owner,
            `OPERATION_CALL_CHAIN_COORDINATED_OWNER_SET_MISMATCH:${operationId}`,
          ),
        );
      } else if (call.owner !== undefined) {
        fail(`OPERATION_CALL_CHAIN_NON_OWNER_HAS_OWNER:${operationId}`);
      }
    }
    if (
      initiatingOwnerCalls.length !== 1 ||
      initiatingOwnerCalls[0] !== initiatingOwner
    ) {
      fail(`OPERATION_CALL_CHAIN_INITIATING_OWNER_MISMATCH:${operationId}`);
    }
    const coordinatedOwnerSet = [...new Set(coordinatedOwnerCalls)];
    if (!sameStringSet(coordinatedOwnerSet, coordinatedOwners)) {
      fail(`OPERATION_CALL_CHAIN_COORDINATED_OWNER_SET_MISMATCH:${operationId}`);
    }

    const conditionToProblem = requireConsecutiveOrder(
      operation.conditionToProblem,
      "precedence",
      `OPERATION_PROBLEM_CONDITION_SET_MISMATCH:${operationId}`,
    );
    const mappedProblemCodes = [];
    for (const mapping of conditionToProblem) {
      mappedProblemCodes.push(
        requireString(
          mapping.problemCode,
          `OPERATION_PROBLEM_CONDITION_SET_MISMATCH:${operationId}`,
        ),
      );
      requireStringArray(
        mapping.conditions,
        `OPERATION_PROBLEM_CONDITION_SET_MISMATCH:${operationId}`,
      );
    }
    if (
      new Set(mappedProblemCodes).size !== mappedProblemCodes.length ||
      !sameStringSet(mappedProblemCodes, problemCodes)
    ) {
      fail(`OPERATION_PROBLEM_CONDITION_SET_MISMATCH:${operationId}`);
    }

    const database = operation.normalPathDbOperations;
    if (
      !database ||
      typeof database !== "object" ||
      !Number.isInteger(database.expectedCount) ||
      database.expectedCount < 0 ||
      database.countUnit !== "REQUEST_COMPLETION_DATABASE_OPERATION_COUNT"
    ) {
      fail(`OPERATION_NORMAL_PATH_DB_OPERATIONS_INVALID:${operationId}`);
    }
    requireStringArray(
      database.assumptions,
      `OPERATION_NORMAL_PATH_DB_OPERATIONS_INVALID:${operationId}`,
    );
    requireUniqueStringArray(
      database.verificationScenarioIds,
      `OPERATION_NORMAL_PATH_DB_OPERATIONS_INVALID:${operationId}`,
    );
    if (!Array.isArray(database.breakdown)) {
      fail(`OPERATION_NORMAL_PATH_DB_OPERATIONS_INVALID:${operationId}`);
    }
    const breakdownOwners = new Set();
    let breakdownCount = 0;
    for (const entry of database.breakdown) {
      const owner = requireString(
        entry?.owner,
        `OPERATION_NORMAL_PATH_DB_OPERATIONS_INVALID:${operationId}`,
      );
      if (
        breakdownOwners.has(owner) ||
        !Number.isInteger(entry.readCount) ||
        entry.readCount < 0 ||
        !Number.isInteger(entry.writeCount) ||
        entry.writeCount < 0
      ) {
        fail(`OPERATION_NORMAL_PATH_DB_OPERATIONS_INVALID:${operationId}`);
      }
      breakdownOwners.add(owner);
      breakdownCount += entry.readCount + entry.writeCount;
    }
    if (breakdownCount !== database.expectedCount) {
      fail(`OPERATION_NORMAL_PATH_DB_OPERATION_COUNT_MISMATCH:${operationId}`);
    }
  }
  return operationIds.size;
}

function validateExistingUniqueAnchor(root, reference, label) {
  if (!reference || typeof reference !== "object") {
    fail(`${label}_MISSING`);
  }
  const relativePath = requireString(reference.path, `${label}_PATH_MISSING`);
  const anchor = requireString(reference.anchor, `${label}_ANCHOR_MISSING`);
  const absolutePath = resolveRepositoryPath(
    root,
    relativePath,
    `${label}_PATH_INVALID`,
  );
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`${label}_NOT_FOUND:${relativePath}`);
  }
  requireUniqueAnchor(fs.readFileSync(absolutePath, "utf8"), anchor, label);
}

function validateAdversarialReviewPolicy(manifest) {
  const policy = manifest.adversarialReviewPolicy;
  if (policy === undefined) {
    return false;
  }
  if (
    !policy ||
    policy.version !== "INDEPENDENT_SUBAGENT_V1" ||
    policy.reviewerKindRequired !== "INDEPENDENT_SUBAGENT" ||
    policy.blindReviewRequired !== true
  ) {
    fail("INDEPENDENT_SUBAGENT_POLICY_INVALID");
  }
  return true;
}

function validateBackendAcceptanceAdmission(root, admissionPath) {
  const admissionFile = readJson(
    root,
    admissionPath,
    "BACKEND_ACCEPTANCE_ADMISSION",
  );
  const admission = admissionFile.value;
  if (
    admission?.schemaVersion !== 1 ||
    admission.kind !== "backend-acceptance-design-admission" ||
    admission.status !== "ACTIVE_IMPLEMENTATION" ||
    admission.packageId !== "BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813"
  ) {
    fail("BACKEND_ACCEPTANCE_ADMISSION_IDENTITY_INVALID");
  }
  const sourceBindings = admission.sourceBindings;
  if (!sourceBindings || typeof sourceBindings !== "object") {
    fail("BACKEND_ACCEPTANCE_ADMISSION_SOURCE_BINDINGS_MISSING");
  }
  for (const [key, label] of [
    ["design", "BACKEND_ACCEPTANCE_ADMISSION_DESIGN"],
    ["requirements", "BACKEND_ACCEPTANCE_ADMISSION_REQUIREMENTS"],
    ["designReview", "BACKEND_ACCEPTANCE_ADMISSION_DESIGN_REVIEW"],
    ["executionContract", "BACKEND_ACCEPTANCE_ADMISSION_EXECUTION_CONTRACT"],
    ["implementationManifest", "BACKEND_ACCEPTANCE_ADMISSION_IMPLEMENTATION_MANIFEST"],
  ]) {
    validateArtifactBinding(root, sourceBindings[key], label);
  }
  if (!Array.isArray(admission.deliveryUnits)) {
    fail("BACKEND_ACCEPTANCE_ADMISSION_UNITS_MISSING");
  }
  const unitsById = new Map();
  for (const unit of admission.deliveryUnits) {
    const id = requireString(unit?.id, "BACKEND_ACCEPTANCE_ADMISSION_UNIT_ID_MISSING");
    if (!backendAcceptanceUnitIds.includes(id) || unitsById.has(id)) {
      fail(`BACKEND_ACCEPTANCE_ADMISSION_UNIT_ID_INVALID:${id}`);
    }
    unitsById.set(id, unit);
    const impact = requireString(
      unit.backendOperationImpact,
      `BACKEND_ACCEPTANCE_OPERATION_DISPOSITION_REQUIRED:${id}`,
    );
    if (!backendAcceptanceImpactValues.has(impact)) {
      fail(`BACKEND_ACCEPTANCE_OPERATION_DISPOSITION_INVALID:${id}:${impact}`);
    }
    if (impact === "NONE_WITH_REASON") {
      requireString(
        unit.reason,
        `BACKEND_ACCEPTANCE_OPERATION_DISPOSITION_REASON_REQUIRED:${id}`,
      );
      if (unit.scenarioContracts !== undefined) {
        fail(`BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_UNEXPECTED:${id}`);
      }
      continue;
    }
    if (!Array.isArray(unit.scenarioContracts) || unit.scenarioContracts.length === 0) {
      fail(`BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_REQUIRED:${id}`);
    }
    for (const contract of unit.scenarioContracts) {
      requireString(
        contract?.registryPath,
        `BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_REGISTRY_PATH_MISSING:${id}`,
      );
      resolveRepositoryPath(
        root,
        contract.registryPath,
        `BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_REGISTRY_PATH_INVALID:${id}`,
      );
      requireString(
        contract?.identitySource,
        `BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_IDENTITY_SOURCE_MISSING:${id}`,
      );
      if (contract.exactSet !== "CURRENT_SEMANTIC_OPERATION_IDENTITY") {
        fail(`BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_EXACT_SET_INVALID:${id}`);
      }
      if (
        !Array.isArray(contract.requiredFields) ||
        contract.requiredFields.length !== backendAcceptanceScenarioFields.length ||
        !sameStringSet(contract.requiredFields, backendAcceptanceScenarioFields)
      ) {
        fail(`BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_FIELDS_INVALID:${id}`);
      }
    }
  }
  if (
    unitsById.size !== backendAcceptanceUnitIds.length ||
    backendAcceptanceUnitIds.some((id) => !unitsById.has(id))
  ) {
    fail("BACKEND_ACCEPTANCE_ADMISSION_UNIT_EXACT_SET_DRIFT");
  }
  return {
    units: unitsById.size,
    addedOrChanged: [...unitsById.values()].filter(
      (unit) => unit.backendOperationImpact === "ADDED_OR_CHANGED",
    ).length,
  };
}


function validateManifest(root, manifestPath) {
  const manifestFile = readJson(root, manifestPath, "MANIFEST");
  const manifest = manifestFile.value;
  const manifestSchemaVersion = manifest.schemaVersion ?? 1;
  if (
    !Number.isInteger(manifestSchemaVersion) ||
    manifestSchemaVersion < 1 ||
    manifest.kind !== "implementation-facing-design-granularity-manifest" ||
    manifest.status !== "PROPOSED_REVIEW_ONLY" ||
    !isNonEmptyString(manifest.programId) ||
    !isNonEmptyString(manifest.goalId)
  ) {
    fail("MANIFEST_IDENTITY_INVALID");
  }

  const design = validateArtifactBinding(root, manifest.design, "DESIGN");
  const authorization = validateArtifactBinding(
    root,
    manifest.authorization,
    "AUTHORIZATION",
  );
  if (manifest.authorization.scope !== "design-only") {
    fail("AUTHORIZATION_SCOPE_NOT_DESIGN_ONLY");
  }
  if (!/^implementationAuthority:\s*false\s*$/m.test(design.text)) {
    fail("DESIGN_IMPLEMENTATION_AUTHORITY_NOT_FALSE");
  }
  if (!/^implementationAuthority:\s*false\s*$/m.test(authorization.text)) {
    fail("AUTHORIZATION_IMPLEMENTATION_AUTHORITY_NOT_FALSE");
  }

  const checker = manifest.implementationDesignGranularityChecker;
  if (
    !checker ||
    checker.status !== "ACTIVE" ||
    checker.selfTest !== true ||
    !Array.isArray(checker.redFixtures) ||
    checker.redFixtures.length < 4
  ) {
    fail("IMPLEMENTATION_DESIGN_CHECKER_BINDING_INCOMPLETE");
  }
  if (
    manifestSchemaVersion >= 2 &&
    operationDesignRedFixtures.some(
      (fixtureId) => !checker.redFixtures.includes(fixtureId),
    )
  ) {
    fail("OPERATION_DESIGN_RED_FIXTURES_MISSING");
  }
  validateArtifactBinding(
    root,
    checker.script,
    "IMPLEMENTATION_DESIGN_CHECKER_SCRIPT",
  );
  validateArtifactBinding(
    root,
    checker.tool,
    "IMPLEMENTATION_DESIGN_CHECKER_TOOL",
  );
  const backendOperationCount =
    manifestSchemaVersion >= 2
      ? validateBackendOperationDesignContract(
          root,
          manifest.backendOperationDesignContract,
        )
      : 0;
  const independentSubagentReviewRequired = validateAdversarialReviewPolicy(
    manifest,
  );

  for (const [key, label] of [
    ["independentReview", "INDEPENDENT_REVIEW"],
    ["independentReviewResolution", "INDEPENDENT_REVIEW_RESOLUTION"],
    [
      "revisedDesignIndependentVerification",
      "REVISED_DESIGN_INDEPENDENT_VERIFICATION",
    ],
    [
      "revisedDesignVerificationResolution",
      "REVISED_DESIGN_VERIFICATION_RESOLUTION",
    ],
  ]) {
    if (manifest[key] !== undefined) {
      validateArtifactBinding(root, manifest[key], label);
    }
  }

  const journey = manifest.candidateJourney;
  if (
    !journey ||
    !isNonEmptyString(journey.id) ||
    !isNonEmptyString(journey.status) ||
    !isNonEmptyString(journey.actor) ||
    !isNonEmptyString(journey.task) ||
    !isNonEmptyString(journey.pageKey) ||
    !isNonEmptyString(journey.ownerReadback) ||
    !Array.isArray(journey.mutations)
  ) {
    fail("CANDIDATE_JOURNEY_INCOMPLETE");
  }

  if (!Array.isArray(manifest.deliveryUnits) || manifest.deliveryUnits.length === 0) {
    fail("DELIVERY_UNITS_MISSING");
  }
  const declaredPostRemediationUnitIds = new Set(
    manifest.postRemediationDeclaration?.addedDeliveryUnitIds ?? [],
  );
  const unitIds = new Set();
  for (const unit of manifest.deliveryUnits) {
    const id = requireString(unit?.id, "UNIT_ID_MISSING");
    if (!unitIdPattern.test(id) || unitIds.has(id)) {
      fail(`UNIT_ID_INVALID_OR_DUPLICATE:${id}`);
    }
    unitIds.add(id);
    requireString(unit.title, `UNIT_TITLE_MISSING:${id}`);
    requireStringArray(
      unit.approvedAssertions,
      `UNIT_APPROVED_ASSERTIONS_MISSING:${id}`,
    );

    if (!Array.isArray(unit.approvedSources) || unit.approvedSources.length === 0) {
      fail(`UNIT_APPROVED_SOURCES_MISSING:${id}`);
    }
    for (const [index, source] of unit.approvedSources.entries()) {
      const label = `UNIT_SOURCE_${id}_${index + 1}`;
      const boundSource = readBoundFile(root, source, label);
      requireUniqueAnchor(boundSource.text, source.anchor, label);
    }

    if (!unit.detailDesign) {
      fail(`UNIT_DETAIL_DESIGN_PATH_INVALID:${id}`);
    }
    let detailDesignText = design.text;
    if (unit.detailDesign.path !== design.relativePath) {
      const detailDesignSource = unit.approvedSources.find(
        (source) => source.path === unit.detailDesign.path,
      );
      if (!declaredPostRemediationUnitIds.has(id) || !detailDesignSource) {
        fail(`UNIT_DETAIL_DESIGN_PATH_INVALID:${id}`);
      }
      detailDesignText = readBoundFile(
        root,
        detailDesignSource,
        `UNIT_REMEDIATION_DETAIL_DESIGN_${id}`,
      ).text;
    }
    requireUniqueAnchor(
      detailDesignText,
      unit.detailDesign.anchor,
      `UNIT_DETAIL_DESIGN_${id}`,
    );
    requireString(unit.currentDeviation, `UNIT_CURRENT_DEVIATION_MISSING:${id}`);

    if (!Array.isArray(unit.changeSurfaces) || unit.changeSurfaces.length === 0) {
      fail(`UNIT_CHANGE_SURFACES_MISSING:${id}`);
    }
    const surfacePaths = new Set();
    for (const surface of unit.changeSurfaces) {
      const surfacePath = requireString(
        surface?.path,
        `UNIT_CHANGE_SURFACE_PATH_MISSING:${id}`,
      );
      resolveRepositoryPath(
        root,
        surfacePath.replace(/<[^>]+>/g, "placeholder"),
        `UNIT_CHANGE_SURFACE_PATH_INVALID:${id}`,
      );
      if (surfacePaths.has(surfacePath)) {
        fail(`UNIT_CHANGE_SURFACE_DUPLICATE:${id}:${surfacePath}`);
      }
      surfacePaths.add(surfacePath);
      if (!/^(create|update|delete|retain|not-applicable)$/.test(surface.disposition)) {
        fail(`UNIT_CHANGE_SURFACE_DISPOSITION_INVALID:${id}:${surfacePath}`);
      }
      if (surface.disposition === "create") {
        if (surfacePath.includes("*") || surfacePath.includes("<")) {
          fail(`UNIT_CHANGE_SURFACE_CREATE_NOT_CONCRETE:${id}:${surfacePath}`);
        }
        if (fs.existsSync(resolveRepositoryPath(root, surfacePath, `UNIT_CHANGE_SURFACE_PATH_INVALID:${id}`))) {
          fail(`UNIT_CHANGE_SURFACE_CREATE_ALREADY_EXISTS:${id}:${surfacePath}`);
        }
      }
      validateCapabilityNamedChangeSurface(
        id,
        surfacePath,
        surface.disposition,
      );
      requireString(
        surface.target,
        `UNIT_CHANGE_SURFACE_TARGET_MISSING:${id}:${surfacePath}`,
      );
    }

    requireStringArray(unit.orderedChain, `UNIT_ORDERED_CHAIN_TOO_SHALLOW:${id}`, 2);
    requireStringArray(
      unit.dependencyAndSerialBoundaries,
      `UNIT_SERIAL_BOUNDARY_MISSING:${id}`,
    );
    if (!unit.dataEvolution || typeof unit.dataEvolution !== "object") {
      fail(`UNIT_DATA_EVOLUTION_MISSING:${id}`);
    }
    if (!unit.uiAndTerms || typeof unit.uiAndTerms !== "object") {
      fail(`UNIT_UI_AND_TERMS_MISSING:${id}`);
    }
    const pageKeys = Array.isArray(unit.uiAndTerms.pageKeys)
      ? unit.uiAndTerms.pageKeys
      : [];
    if (
      pageKeys.some((pageKey) => !isNonEmptyString(pageKey)) ||
      new Set(pageKeys).size !== pageKeys.length ||
      (isNonEmptyString(unit.uiAndTerms.pageKey) && pageKeys.length > 0)
    ) {
      fail(`UNIT_UI_PAGE_KEYS_INVALID:${id}`);
    }
    if (
      !isNonEmptyString(unit.uiAndTerms.notApplicableReason) &&
      !isNonEmptyString(unit.uiAndTerms.pageKey) &&
      pageKeys.length === 0 &&
      !isNonEmptyString(unit.uiAndTerms.requiresDexterDecision)
    ) {
      fail(`UNIT_UI_APPLICABILITY_MISSING:${id}`);
    }
    if (!isNonEmptyString(unit.uiAndTerms.termSource)) {
      fail(`UNIT_TERM_SOURCE_MISSING:${id}`);
    }
    if (isNonEmptyString(unit.uiAndTerms.pageKey)) {
      validateExistingUniqueAnchor(
        root,
        unit.uiAndTerms.interactionArtifact,
        `UNIT_UI_INTERACTION_ARTIFACT:${id}`,
      );
    }
    if (pageKeys.length > 0) {
      const interactionArtifacts = unit.uiAndTerms.interactionArtifacts;
      if (
        !Array.isArray(interactionArtifacts) ||
        interactionArtifacts.length !== pageKeys.length
      ) {
        fail(`UNIT_UI_INTERACTION_ARTIFACTS_INVALID:${id}`);
      }
      const artifactPageKeys = new Set();
      for (const artifact of interactionArtifacts) {
        const artifactPageKey = requireString(
          artifact?.pageKey,
          `UNIT_UI_INTERACTION_ARTIFACT_PAGE_KEY_MISSING:${id}`,
        );
        if (!pageKeys.includes(artifactPageKey) || artifactPageKeys.has(artifactPageKey)) {
          fail(`UNIT_UI_INTERACTION_ARTIFACT_PAGE_KEY_INVALID:${id}:${artifactPageKey}`);
        }
        artifactPageKeys.add(artifactPageKey);
        validateExistingUniqueAnchor(
          root,
          artifact,
          `UNIT_UI_INTERACTION_ARTIFACT:${id}:${artifactPageKey}`,
        );
      }
    }
    if (!unit.evidence || typeof unit.evidence !== "object") {
      fail(`UNIT_EVIDENCE_MISSING:${id}`);
    }
    for (const field of evidenceFields) {
      requireString(
        unit.evidence[field],
        `UNIT_EVIDENCE_FIELD_MISSING:${id}:${field}`,
      );
    }
    requireStringArray(
      unit.forbiddenPseudoFixes,
      `UNIT_FORBIDDEN_PSEUDO_FIXES_MISSING:${id}`,
    );
    requireString(
      unit.discriminator?.fixture,
      `UNIT_DISCRIMINATOR_MISSING:${id}`,
    );
  }

  return {
    manifest,
    manifestBytes: manifestFile.bytes,
    unitIds,
    backendOperationCount,
    independentSubagentReviewRequired,
  };
}

function validateIndependentSubagentReview(root, review, manifestResult) {
  if (!manifestResult.independentSubagentReviewRequired) {
    return;
  }
  if (review.reviewerKind !== "INDEPENDENT_SUBAGENT") {
    fail("REVIEWER_KIND_NOT_INDEPENDENT_SUBAGENT");
  }
  const checklist = review.reviewerInputChecklist;
  if (!checklist || typeof checklist !== "object") {
    fail("REVIEWER_INPUT_CHECKLIST_MISSING");
  }
  const checklistPath = requireString(
    checklist.path,
    "REVIEWER_INPUT_CHECKLIST_PATH_MISSING",
  );
  const checklistHash = requireString(
    checklist.sha256,
    "REVIEWER_INPUT_CHECKLIST_HASH_MISSING",
  );
  if (!shaPattern.test(checklistHash)) {
    fail("REVIEWER_INPUT_CHECKLIST_HASH_INVALID");
  }
  const checklistAbsolutePath = resolveRepositoryPath(
    root,
    checklistPath,
    "REVIEWER_INPUT_CHECKLIST_PATH_INVALID",
  );
  if (
    !fs.existsSync(checklistAbsolutePath) ||
    !fs.statSync(checklistAbsolutePath).isFile()
  ) {
    fail(`REVIEWER_INPUT_CHECKLIST_NOT_FOUND:${checklistPath}`);
  }
  requireString(
    review.blindReviewDeclaration,
    "BLIND_REVIEW_DECLARATION_MISSING",
  );
  if (review.authorMaterialReadAfterIndependentVerdict !== true) {
    fail("AUTHOR_MATERIAL_ORDER_DECLARATION_MISSING");
  }
}

function validatePostRemediationDeclaration(
  root,
  reviewPath,
  reviewFile,
  review,
  manifestResult,
) {
  const declaration = manifestResult.manifest.postRemediationDeclaration;
  if (!declaration || typeof declaration !== "object") {
    fail("REVIEW_MANIFEST_HASH_DRIFT");
  }
  if (
    declaration.version !== "POST_REMEDIATION_V1" ||
    declaration.reviewCycleId !== review.reviewCycleId ||
    declaration.reviewRound !== review.reviewRound ||
    declaration.reviewPath !== reviewPath ||
    declaration.reviewedManifestSha256 !== review.manifestSha256 ||
    declaration.reviewSha256 !== sha256(reviewFile.bytes) ||
    declaration.currentBytesNotReviewedByAdversarialReviewer !== true ||
    declaration.claudeRecheckRequired !== true ||
    declaration.implementationAuthority !== false ||
    review.reviewRound !== 2 ||
    review.roundFinalDecision !== "SELF_DECIDED" ||
    review.furtherCodexAdversarialRoundAllowed !== false
  ) {
    fail("POST_REMEDIATION_DECLARATION_INVALID");
  }
  requireString(
    declaration.reason,
    "POST_REMEDIATION_DECLARATION_REASON_MISSING",
  );
  readBoundFile(root, declaration.intake, "POST_REMEDIATION_INTAKE");
  const addedDeliveryUnitIds = declaration.addedDeliveryUnitIds;
  if (addedDeliveryUnitIds === undefined) {
    return new Set();
  }
  if (!Array.isArray(addedDeliveryUnitIds) || addedDeliveryUnitIds.length === 0) {
    fail("POST_REMEDIATION_ADDED_UNITS_INVALID");
  }
  const addedUnits = new Set();
  for (const unitId of addedDeliveryUnitIds) {
    if (
      !isNonEmptyString(unitId) ||
      addedUnits.has(unitId) ||
      !manifestResult.unitIds.has(unitId)
    ) {
      fail(`POST_REMEDIATION_ADDED_UNIT_INVALID:${unitId}`);
    }
    addedUnits.add(unitId);
  }
  return addedUnits;
}

function validateReview(root, reviewPath, manifestResult) {
  const reviewFile = readJson(root, reviewPath, "REVIEW");
  const review = reviewFile.value;
  if (
    review.kind !== "implementation-design-adversarial-review" ||
    review.reviewTarget !== "DESIGN" ||
    !reviewVerdicts.has(review.verdict)
  ) {
    fail("REVIEW_IDENTITY_INVALID");
  }
  const postRemediationDeclared =
    review.manifestSha256 !== sha256(manifestResult.manifestBytes);
  const postRemediationAddedUnits =
    postRemediationDeclared
      ? validatePostRemediationDeclaration(
          root,
          reviewPath,
          reviewFile,
          review,
          manifestResult,
        )
      : new Set();
  const reviewedUnitIds = new Set(
    [...manifestResult.unitIds].filter(
      (unitId) => !postRemediationAddedUnits.has(unitId),
    ),
  );
  if (
    !isNonEmptyString(review.reviewCycleId) ||
    ![1, 2].includes(review.reviewRound) ||
    review.reviewRoundLimit !== 2 ||
    (review.reviewRound === 2 &&
      (review.roundFinalDecision !== "SELF_DECIDED" ||
        review.furtherCodexAdversarialRoundAllowed !== false))
  ) {
    fail("REVIEW_ROUND_INVALID");
  }
  validateIndependentSubagentReview(root, review, manifestResult);
  if (
    review.reviewMethod?.sourceFirst !== true ||
    review.reviewMethod?.solutionReasonablenessReviewedBeforeClosure !== true ||
    review.reviewMethod?.allDeliveryUnitsReviewed !== true ||
    !Array.isArray(review.reviewMethod?.riskClasses) ||
    review.reviewMethod.riskClasses.length === 0
  ) {
    fail("REVIEW_METHOD_INCOMPLETE");
  }
  requireStringArray(review.expectedBehavior, "REVIEW_EXPECTED_BEHAVIOR_MISSING");

  if (!Array.isArray(review.findings)) {
    fail("REVIEW_FINDINGS_NOT_ARRAY");
  }
  const findings = new Map();
  const actualCounts = { M: 0, S: 0, N: 0 };
  for (const finding of review.findings) {
    const id = requireString(finding?.id, "REVIEW_FINDING_ID_MISSING");
    if (findings.has(id) || !findingSeverity.has(finding.severity)) {
      fail(`REVIEW_FINDING_INVALID_OR_DUPLICATE:${id}`);
    }
    requireString(finding.status, `REVIEW_FINDING_STATUS_MISSING:${id}`);
    requireStringArray(finding.unitIds, `REVIEW_FINDING_UNIT_IDS_MISSING:${id}`);
    for (const unitId of finding.unitIds) {
      if (!reviewedUnitIds.has(unitId)) {
        fail(`REVIEW_FINDING_UNKNOWN_UNIT:${id}:${unitId}`);
      }
    }
    requireString(finding.title, `REVIEW_FINDING_TITLE_MISSING:${id}`);
    requireString(finding.evidence, `REVIEW_FINDING_EVIDENCE_MISSING:${id}`);
    requireString(finding.risk, `REVIEW_FINDING_RISK_MISSING:${id}`);
    requireString(finding.disposition, `REVIEW_FINDING_DISPOSITION_MISSING:${id}`);
    findings.set(id, finding);
    actualCounts[finding.severity] += 1;
  }

  if (!Array.isArray(review.unitVerdicts)) {
    fail("REVIEW_UNIT_VERDICTS_NOT_ARRAY");
  }
  const verdictUnits = new Set();
  const verdictsByUnit = new Map();
  for (const unitVerdict of review.unitVerdicts) {
    const unitId = requireString(
      unitVerdict?.id,
      "REVIEW_UNIT_VERDICT_ID_MISSING",
    );
    if (
      verdictUnits.has(unitId) ||
      !reviewedUnitIds.has(unitId) ||
      !unitVerdicts.has(unitVerdict.verdict) ||
      !Array.isArray(unitVerdict.findingIds)
    ) {
      fail(`REVIEW_UNIT_VERDICT_INVALID:${unitId}`);
    }
    verdictUnits.add(unitId);
    verdictsByUnit.set(unitId, unitVerdict);
    for (const findingId of unitVerdict.findingIds) {
      const finding = findings.get(findingId);
      if (!finding || !finding.unitIds.includes(unitId)) {
        fail(`REVIEW_UNIT_FINDING_LINK_INVALID:${unitId}:${findingId}`);
      }
    }
  }
  if (
    verdictUnits.size !== reviewedUnitIds.size ||
    [...reviewedUnitIds].some((unitId) => !verdictUnits.has(unitId))
  ) {
    fail("REVIEW_UNIT_VERDICT_DENOMINATOR_MISMATCH");
  }
  for (const [findingId, finding] of findings) {
    for (const unitId of finding.unitIds) {
      if (!verdictsByUnit.get(unitId).findingIds.includes(findingId)) {
        fail(`REVIEW_FINDING_UNIT_LINK_MISSING:${findingId}:${unitId}`);
      }
    }
  }

  for (const field of [
    "problemFit",
    "simplerAlternativeAssessment",
    "costFit",
    "verdict",
  ]) {
    requireString(
      review.solutionReasonableness?.[field],
      `REVIEW_REASONABLENESS_FIELD_MISSING:${field}`,
    );
  }
  if (
    review.conclusion?.verdict !== review.verdict ||
    !isNonEmptyString(review.conclusion?.summary) ||
    !isNonEmptyString(review.conclusion?.authorizationBoundary)
  ) {
    fail("REVIEW_CONCLUSION_INCOMPLETE_OR_INCONSISTENT");
  }
  const declaredCounts = review.conclusion.severityCounts;
  if (
    !declaredCounts ||
    findingSeverity.size !== Object.keys(declaredCounts).length ||
    [...findingSeverity].some(
      (severity) => declaredCounts[severity] !== actualCounts[severity],
    )
  ) {
    fail("REVIEW_SEVERITY_COUNT_MISMATCH");
  }
  if (review.verdict === "GO" && (actualCounts.M > 0 || actualCounts.S > 0)) {
    fail("REVIEW_GO_WITH_BLOCKING_FINDINGS");
  }
  return { review, postRemediationDeclared };
}

function validate({ root, manifestPath, reviewPath }) {
  const manifestResult = validateManifest(root, manifestPath);
  const reviewResult = validateReview(root, reviewPath, manifestResult);
  const review = reviewResult.review;
  return {
    units: manifestResult.unitIds.size,
    operations: manifestResult.backendOperationCount,
    findings: review.findings.length,
    verdict: review.verdict,
    reviewRound: review.reviewRound,
    bindingMode: reviewResult.postRemediationDeclared
      ? "DECLARED_POST_REMEDIATION_AWAITING_CLAUDE"
      : "EXACT_REVIEWED_MANIFEST",
  };
}

const s0BaselineStates = new Set([
  "ACTIVE_RED_VERIFIED",
  "OUT_OF_SCOPE_THIS_PACKAGE",
]);

function validateS0Baseline({ root, baselinePath }) {
  const absolutePath = resolveRepositoryPath(
    root,
    baselinePath,
    "S0_BASELINE_PATH_INVALID",
  );
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`S0_BASELINE_NOT_FOUND:${baselinePath}`);
  }
  const text = fs.readFileSync(absolutePath, "utf8");
  const section = text.match(
    /^## 3\. Existing-control baseline\s*$(.*?)(?=^##\s|\z)/ms,
  );
  if (!section) {
    fail("S0_BASELINE_CONTROL_TABLE_MISSING");
  }
  const rows = section[1]
    .split("\n")
    .filter((line) => line.startsWith("| `scripts/") || line.startsWith("| backend ArchUnit") || line.startsWith("| edge route coverage") || line.startsWith("| security and logging controls") || line.startsWith("| aggregate `scripts/verify`") || line.startsWith("| routed pitfall anchor"));
  if (rows.length === 0) {
    fail("S0_BASELINE_CONTROL_ROWS_MISSING");
  }
  for (const row of rows) {
    const cells = row.split("|").map((cell) => cell.trim());
    const state = cells[2];
    if (!s0BaselineStates.has(state)) {
      fail(`S0_BASELINE_CONTROL_STATE_INVALID:${state || "MISSING"}`);
    }
  }
  return { controls: rows.length };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeSelfTestFixture(root) {
  const designPath = "doc/plans/design.md";
  const authorizationPath = "doc/decisions/authorization.md";
  const sourcePath = "doc/decisions/source.md";
  const interactionPath = "doc/review/interaction.md";
  const reviewerInputChecklistPath = "doc/review/reviewer-input-checklist.md";
  const backendOperationDesignContractPath =
    "doc/review/backend-operation-design-contract.json";
  const designText = [
    "---",
    "implementationAuthority: false",
    "---",
    "# Design",
    "## Unit detail",
    "",
  ].join("\n");
  const authorizationText = [
    "---",
    "implementationAuthority: false",
    "---",
    "# Authorization",
    "",
  ].join("\n");
  const sourceText = "# Source\n## Approved anchor\n";
  const interactionText = "# Interaction\n## Screen: self-test\n";
  const reviewerInputChecklistText = "# Independent reviewer input checklist\n";
  const memoryPath = "project-memory/kernel/self-test.md";
  const memoryText = "# Self-test project memory\n";
  const backendOperationDesignContract = {
    schemaVersion: 1,
    kind: "backend-operation-design-contract",
    operations: [
      {
        operationId: "getSelfTestResource",
        initiatingOwner: "catalog",
        coordinatedOwners: ["inventory"],
        problemCodes: ["VALIDATION_ERROR", "NOT_FOUND"],
        logicSteps: [
          { order: 1, stepId: "validate", action: "validate the typed query" },
          { order: 2, stepId: "read", action: "read the resource and availability" },
        ],
        callChain: [
          { order: 1, kind: "EDGE", target: "generated web adapter" },
          {
            order: 2,
            kind: "INITIATING_OWNER",
            target: "catalog task query",
            owner: "catalog",
          },
          {
            order: 3,
            kind: "COORDINATED_OWNER",
            target: "inventory task read",
            owner: "inventory",
            purpose: "availability facts",
          },
        ],
        conditionToProblem: [
          {
            precedence: 1,
            problemCode: "VALIDATION_ERROR",
            conditions: ["query shape is invalid"],
          },
          {
            precedence: 2,
            problemCode: "NOT_FOUND",
            conditions: ["resource is absent in the trusted scope"],
          },
        ],
        normalPathDbOperations: {
          expectedCount: 2,
          countUnit: "REQUEST_COMPLETION_DATABASE_OPERATION_COUNT",
          assumptions: ["one existing resource in a selected workspace"],
          verificationScenarioIds: ["SELF-API-001"],
          breakdown: [
            { owner: "workspace-iam", readCount: 1, writeCount: 0 },
            { owner: "catalog", readCount: 1, writeCount: 0 },
          ],
        },
      },
    ],
  };
  const backendOperationDesignContractText = `${JSON.stringify(
    backendOperationDesignContract,
    null,
    2,
  )}\n`;
  const memoryIndex = {
    schemaVersion: 1,
    kind: "project-memory-index",
    entries: [
      {
        id: "self-test.matching-memory",
        path: memoryPath,
        sha256: sha256(memoryText),
        route: {
          taskKinds: ["implementation"], domains: ["platform"],
          consumerFaces: ["backend"], owners: ["platform"],
          impacts: ["governance"], triggers: ["implementation"],
        },
      },
      {
        id: "self-test.non-matching-memory",
        path: "project-memory/decisions/non-matching.md",
        sha256: "a".repeat(64),
        route: {
          taskKinds: ["review"], domains: ["platform"],
          consumerFaces: ["backend"], owners: ["platform"],
          impacts: ["governance"], triggers: ["review"],
        },
      },
    ],
  };
  for (const [relativePath, content] of [
    [designPath, designText],
    [authorizationPath, authorizationText],
    [sourcePath, sourceText],
    [interactionPath, interactionText],
    [reviewerInputChecklistPath, reviewerInputChecklistText],
    [memoryPath, memoryText],
    [backendOperationDesignContractPath, backendOperationDesignContractText],
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
  writeJson(path.join(root, "project-memory/index.json"), memoryIndex);

  const sourceBinding = (selector) => ({
    sourcePath,
    selector: `md:${selector}`,
    applicability: "APPLICABLE",
    missingEntryFails: true,
    sourceSha256: sha256(sourceText),
    owningSourceSet: [{ path: sourcePath, sha256: sha256(sourceText), selector: `md:${selector}` }],
  });

  const manifest = {
    schemaVersion: 2,
    kind: "implementation-facing-design-granularity-manifest",
    status: "PROPOSED_REVIEW_ONLY",
    programId: "SELF_TEST",
    goalId: "SELF-TEST-DESIGN",
    adversarialReviewPolicy: {
      version: "INDEPENDENT_SUBAGENT_V1",
      reviewerKindRequired: "INDEPENDENT_SUBAGENT",
      blindReviewRequired: true,
    },
    design: { path: designPath, sha256: sha256(designText) },
    authorization: {
      path: authorizationPath,
      sha256: sha256(authorizationText),
      scope: "design-only",
    },
    backendOperationDesignContract: {
      path: backendOperationDesignContractPath,
      sha256: sha256(backendOperationDesignContractText),
    },
    implementationDesignGranularityChecker: {
      status: "ACTIVE",
      script: {
        path: sourcePath,
        sha256: sha256(sourceText),
      },
      tool: {
        path: sourcePath,
        sha256: sha256(sourceText),
      },
      selfTest: true,
      redFixtures: [
        ...operationDesignRedFixtures,
        "DESIGN_HASH_DRIFT",
        "MISSING_BUSINESS_EVIDENCE",
        "SEVERITY_COUNT_MISMATCH",
        "ROUND_THREE",
        "MISSING_FINDING_UNIT_LINK",
        "REVIEWER_KIND_NOT_INDEPENDENT_SUBAGENT",
        "REVIEWER_INPUT_CHECKLIST_NOT_FOUND",
        "FLOW_IDENTIFIER_IN_DESIGN_CHANGE_SURFACE",
      ],
    },
    candidateJourney: {
      id: "ST-J01",
      status: "PROPOSED",
      actor: "operator",
      task: "confirm one fact",
      pageKey: "SELF_TEST_PAGE",
      ownerReadback: "self-test-owner",
      mutations: [],
    },
    deliveryUnits: [
      {
        id: "ST-U01",
        title: "Self-test delivery unit",
        approvedAssertions: ["one bounded assertion"],
        approvedSources: [
          {
            path: sourcePath,
            anchor: "## Approved anchor",
            sha256: sha256(sourceText),
          },
        ],
        detailDesign: {
          path: designPath,
          anchor: "## Unit detail",
        },
        currentDeviation: "unit is absent",
        changeSurfaces: [
          {
            path: "scripts/check/example",
            disposition: "create",
            target: "bounded validator",
          },
        ],
        memoryRoute: {
          taskKind: "implementation",
          domain: "platform",
          consumerFace: "backend",
          owner: "platform",
          impact: "governance",
          trigger: "implementation",
        },
        orderedChain: ["create validator", "run evidence"],
        dependencyAndSerialBoundaries: ["validator precedes evidence"],
        dataEvolution: { notApplicableReason: "no data" },
        uiAndTerms: {
          pageKey: "SELF_TEST_PAGE",
          termSource: "self-test",
          interactionArtifact: {
            path: interactionPath,
            anchor: "## Screen: self-test",
          },
        },
        evidence: {
          l1: "static check",
          l2: "not applicable",
          l3: "not applicable",
          business: "bounded result",
          cleanup: "no resources",
        },
        forbiddenPseudoFixes: ["file-exists-only check"],
        discriminator: { fixture: "missing evidence must fail" },
      },
    ],
  };
  const manifestPath = "manifest.json";
  writeJson(path.join(root, manifestPath), manifest);
  const manifestBytes = fs.readFileSync(path.join(root, manifestPath));
  const review = {
    kind: "implementation-design-adversarial-review",
    reviewTarget: "DESIGN",
    reviewCycleId: "SELF-TEST",
    reviewRound: 2,
    reviewRoundLimit: 2,
    roundFinalDecision: "SELF_DECIDED",
    furtherCodexAdversarialRoundAllowed: false,
    verdict: "NO_GO",
    reviewerKind: "INDEPENDENT_SUBAGENT",
    reviewerInputChecklist: {
      path: reviewerInputChecklistPath,
      sha256: sha256(reviewerInputChecklistText),
    },
    blindReviewDeclaration:
      "Independent findings and verdict were formed before author material was read.",
    authorMaterialReadAfterIndependentVerdict: true,
    manifestSha256: sha256(manifestBytes),
    reviewMethod: {
      sourceFirst: true,
      solutionReasonablenessReviewedBeforeClosure: true,
      allDeliveryUnitsReviewed: true,
      riskClasses: ["scope"],
    },
    expectedBehavior: ["one bounded result"],
    findings: [
      {
        id: "ST-N-001",
        severity: "N",
        status: "OPEN",
        unitIds: ["ST-U01"],
        title: "note",
        evidence: "fixture evidence",
        risk: "fixture risk",
        disposition: "retain note",
      },
    ],
    unitVerdicts: [
      {
        id: "ST-U01",
        verdict: "GO_WITH_N",
        findingIds: ["ST-N-001"],
      },
    ],
    solutionReasonableness: {
      problemFit: "correct problem",
      simplerAlternativeAssessment: "smaller alternative compared",
      costFit: "cost fits",
      verdict: "REASONABLE",
    },
    conclusion: {
      verdict: "NO_GO",
      summary: "fixture remains no-go",
      severityCounts: { M: 0, S: 0, N: 1 },
      authorizationBoundary: "no implementation authority",
    },
  };
  const reviewPath = "review.json";
  writeJson(path.join(root, reviewPath), review);
  return {
    manifestPath,
    reviewPath,
    manifest,
    review,
    backendOperationDesignContractPath,
    backendOperationDesignContract,
  };
}

function expectFailure(action, expectedReason) {
  try {
    action();
  } catch (error) {
    if (error instanceof Error && error.message === expectedReason) {
      return;
    }
    throw error;
  }
  fail(`SELF_TEST_RED_DID_NOT_FAIL:${expectedReason}`);
}

function selfTest() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "v2s-implementation-design-granularity-"),
  );
  try {
    const fixture = makeSelfTestFixture(root);
    validate({ root, ...fixture });

    const schemaV1Manifest = structuredClone(fixture.manifest);
    schemaV1Manifest.schemaVersion = 1;
    delete schemaV1Manifest.backendOperationDesignContract;
    writeJson(path.join(root, fixture.manifestPath), schemaV1Manifest);
    const schemaV1Review = structuredClone(fixture.review);
    schemaV1Review.manifestSha256 = sha256(
      fs.readFileSync(path.join(root, fixture.manifestPath)),
    );
    writeJson(path.join(root, fixture.reviewPath), schemaV1Review);
    validate({ root, ...fixture });

    const expectOperationContractFailure = (
      mutate,
      expectedReason,
    ) => {
      const contract = structuredClone(fixture.backendOperationDesignContract);
      mutate(contract);
      const contractText = `${JSON.stringify(contract, null, 2)}\n`;
      fs.writeFileSync(
        path.join(root, fixture.backendOperationDesignContractPath),
        contractText,
      );
      const manifest = structuredClone(fixture.manifest);
      manifest.backendOperationDesignContract.sha256 = sha256(contractText);
      writeJson(path.join(root, fixture.manifestPath), manifest);
      expectFailure(
        () => validate({ root, ...fixture }),
        expectedReason,
      );
    };

    expectOperationContractFailure(
      (contract) => {
        contract.operations[0].logicSteps = [];
      },
      "OPERATION_LOGIC_STEPS_MISSING:getSelfTestResource",
    );
    expectOperationContractFailure(
      (contract) => {
        contract.operations[0].callChain =
          contract.operations[0].callChain.filter(
            (entry) => entry.kind !== "COORDINATED_OWNER",
          );
      },
      "OPERATION_CALL_CHAIN_COORDINATED_OWNER_SET_MISMATCH:getSelfTestResource",
    );
    expectOperationContractFailure(
      (contract) => {
        contract.operations[0].conditionToProblem.pop();
      },
      "OPERATION_PROBLEM_CONDITION_SET_MISMATCH:getSelfTestResource",
    );
    expectOperationContractFailure(
      (contract) => {
        contract.operations[0].normalPathDbOperations.expectedCount = 3;
      },
      "OPERATION_NORMAL_PATH_DB_OPERATION_COUNT_MISMATCH:getSelfTestResource",
    );

    fs.writeFileSync(
      path.join(root, fixture.backendOperationDesignContractPath),
      `${JSON.stringify(fixture.backendOperationDesignContract, null, 2)}\n`,
    );
    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    writeJson(path.join(root, fixture.reviewPath), fixture.review);


    const missingMultiPageInteractionArtifacts = structuredClone(fixture.manifest);
    delete missingMultiPageInteractionArtifacts.deliveryUnits[0].uiAndTerms.pageKey;
    delete missingMultiPageInteractionArtifacts.deliveryUnits[0].uiAndTerms.interactionArtifact;
    missingMultiPageInteractionArtifacts.deliveryUnits[0].uiAndTerms.pageKeys = [
      "SELF_TEST_PAGE",
      "SECOND_SELF_TEST_PAGE",
    ];
    writeJson(
      path.join(root, fixture.manifestPath),
      missingMultiPageInteractionArtifacts,
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "UNIT_UI_INTERACTION_ARTIFACTS_INVALID:ST-U01",
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    const existingCreatePath = path.join(root, "scripts/check/example");
    fs.mkdirSync(path.dirname(existingCreatePath), { recursive: true });
    fs.writeFileSync(existingCreatePath, "#!/bin/sh\n");
    expectFailure(
      () => validate({ root, ...fixture }),
      "UNIT_CHANGE_SURFACE_CREATE_ALREADY_EXISTS:ST-U01:scripts/check/example",
    );
    fs.rmSync(existingCreatePath, { force: true });

    const badHash = structuredClone(fixture.manifest);
    badHash.design.sha256 = "0".repeat(64);
    writeJson(path.join(root, fixture.manifestPath), badHash);
    expectFailure(
      () => validate({ root, ...fixture }),
      `DESIGN_HASH_DRIFT:${badHash.design.path}`,
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    const missingEvidence = structuredClone(fixture.manifest);
    delete missingEvidence.deliveryUnits[0].evidence.business;
    writeJson(path.join(root, fixture.manifestPath), missingEvidence);
    expectFailure(
      () => validate({ root, ...fixture }),
      "UNIT_EVIDENCE_FIELD_MISSING:ST-U01:business",
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    const missingInteractionArtifact = structuredClone(fixture.manifest);
    delete missingInteractionArtifact.deliveryUnits[0].uiAndTerms
      .interactionArtifact;
    writeJson(
      path.join(root, fixture.manifestPath),
      missingInteractionArtifact,
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "UNIT_UI_INTERACTION_ARTIFACT:ST-U01_MISSING",
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    fs.writeFileSync(
      path.join(root, fixture.manifest.deliveryUnits[0].uiAndTerms.interactionArtifact.path),
      "# Interaction\n## Screen: self-test\n## Screen: self-test\n",
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "UNIT_UI_INTERACTION_ARTIFACT:ST-U01_ANCHOR_NOT_UNIQUE:2",
    );
    fs.writeFileSync(
      path.join(root, fixture.manifest.deliveryUnits[0].uiAndTerms.interactionArtifact.path),
      "# Interaction\n## Screen: self-test\n",
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    const manifestBytes = fs.readFileSync(path.join(root, fixture.manifestPath));
    const badCounts = structuredClone(fixture.review);
    badCounts.manifestSha256 = sha256(manifestBytes);
    badCounts.conclusion.severityCounts.N = 0;
    writeJson(path.join(root, fixture.reviewPath), badCounts);
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEW_SEVERITY_COUNT_MISMATCH",
    );

    const roundThree = structuredClone(fixture.review);
    roundThree.manifestSha256 = sha256(manifestBytes);
    roundThree.reviewRound = 3;
    writeJson(path.join(root, fixture.reviewPath), roundThree);
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEW_ROUND_INVALID",
    );

    const missingFindingUnitLink = structuredClone(fixture.review);
    missingFindingUnitLink.manifestSha256 = sha256(manifestBytes);
    missingFindingUnitLink.unitVerdicts[0].findingIds = [];
    writeJson(path.join(root, fixture.reviewPath), missingFindingUnitLink);
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEW_FINDING_UNIT_LINK_MISSING:ST-N-001:ST-U01",
    );

    const wrongReviewerKind = structuredClone(fixture.review);
    wrongReviewerKind.manifestSha256 = sha256(manifestBytes);
    wrongReviewerKind.reviewerKind = "AUTHOR_SESSION";
    writeJson(path.join(root, fixture.reviewPath), wrongReviewerKind);
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEWER_KIND_NOT_INDEPENDENT_SUBAGENT",
    );

    const missingInputChecklist = structuredClone(fixture.review);
    missingInputChecklist.manifestSha256 = sha256(manifestBytes);
    missingInputChecklist.reviewerInputChecklist.path = "doc/review/missing.md";
    writeJson(path.join(root, fixture.reviewPath), missingInputChecklist);
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEWER_INPUT_CHECKLIST_NOT_FOUND:doc/review/missing.md",
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    writeJson(path.join(root, fixture.reviewPath), fixture.review);
    const postRemediationWithoutDeclaration = structuredClone(fixture.manifest);
    postRemediationWithoutDeclaration.remediationMarker = true;
    writeJson(
      path.join(root, fixture.manifestPath),
      postRemediationWithoutDeclaration,
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEW_MANIFEST_HASH_DRIFT",
    );

    const intakePath = "doc/review/post-remediation-intake.md";
    const intakeText = "# Post-remediation intake\n";
    fs.writeFileSync(path.join(root, intakePath), intakeText);
    const postRemediationDeclared = structuredClone(
      postRemediationWithoutDeclaration,
    );
    const reviewBytes = fs.readFileSync(path.join(root, fixture.reviewPath));
    postRemediationDeclared.postRemediationDeclaration = {
      version: "POST_REMEDIATION_V1",
      reviewCycleId: fixture.review.reviewCycleId,
      reviewRound: fixture.review.reviewRound,
      reviewPath: fixture.reviewPath,
      reviewSha256: sha256(reviewBytes),
      reviewedManifestSha256: fixture.review.manifestSha256,
      intake: {
        path: intakePath,
        sha256: sha256(intakeText),
      },
      reason: "review findings were remediated after the round-two hard stop",
      currentBytesNotReviewedByAdversarialReviewer: true,
      claudeRecheckRequired: true,
      implementationAuthority: false,
    };
    writeJson(
      path.join(root, fixture.manifestPath),
      postRemediationDeclared,
    );
    validate({ root, ...fixture });

    const postRemediationWithAddedUnit = structuredClone(
      postRemediationDeclared,
    );
    const addedUnit = structuredClone(
      postRemediationWithAddedUnit.deliveryUnits[0],
    );
    const remediationDesignPath = "remediation-design.md";
    const remediationDesignText = "# Declared remediation detail\n";
    fs.writeFileSync(
      path.join(root, remediationDesignPath),
      remediationDesignText,
    );
    addedUnit.id = "ST-U02";
    addedUnit.title = "Declared remediation delivery unit";
    addedUnit.changeSurfaces[0].path = "scripts/check/another-example";
    addedUnit.detailDesign = {
      path: remediationDesignPath,
      anchor: "# Declared remediation detail",
    };
    addedUnit.approvedSources.push({
      path: remediationDesignPath,
      anchor: "# Declared remediation detail",
      sha256: sha256(remediationDesignText),
    });
    addedUnit.uiAndTerms = {
      notApplicableReason: "No user interaction changes in this remediation unit.",
      termSource: "self-test",
    };
    postRemediationWithAddedUnit.deliveryUnits.push(addedUnit);
    postRemediationWithAddedUnit.postRemediationDeclaration.addedDeliveryUnitIds = [
      "ST-U02",
    ];
    writeJson(
      path.join(root, fixture.manifestPath),
      postRemediationWithAddedUnit,
    );
    validate({ root, ...fixture });

    const addedUnitWithoutDeclaration = structuredClone(
      postRemediationWithAddedUnit,
    );
    delete addedUnitWithoutDeclaration.postRemediationDeclaration
      .addedDeliveryUnitIds;
    addedUnitWithoutDeclaration.deliveryUnits.find(
      (unit) => unit.id === "ST-U02",
    ).detailDesign = structuredClone(fixture.manifest.deliveryUnits[0].detailDesign);
    writeJson(
      path.join(root, fixture.manifestPath),
      addedUnitWithoutDeclaration,
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "REVIEW_UNIT_VERDICT_DENOMINATOR_MISMATCH",
    );

    const unknownDeclaredAddedUnit = structuredClone(
      postRemediationWithAddedUnit,
    );
    unknownDeclaredAddedUnit.postRemediationDeclaration.addedDeliveryUnitIds = [
      "ST-U99",
    ];
    unknownDeclaredAddedUnit.deliveryUnits.find(
      (unit) => unit.id === "ST-U02",
    ).detailDesign = structuredClone(fixture.manifest.deliveryUnits[0].detailDesign);
    writeJson(
      path.join(root, fixture.manifestPath),
      unknownDeclaredAddedUnit,
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "POST_REMEDIATION_ADDED_UNIT_INVALID:ST-U99",
    );

    const missingPostRemediationIntake = structuredClone(
      postRemediationDeclared,
    );
    missingPostRemediationIntake.postRemediationDeclaration.intake.path =
      "doc/review/missing-post-remediation-intake.md";
    writeJson(
      path.join(root, fixture.manifestPath),
      missingPostRemediationIntake,
    );
    expectFailure(
      () => validate({ root, ...fixture }),
      "POST_REMEDIATION_INTAKE_NOT_FOUND:doc/review/missing-post-remediation-intake.md",
    );

    const flowNamedSurface = structuredClone(fixture.manifest);
    flowNamedSurface.deliveryUnits[0].changeSurfaces[0].path =
      "apps/example/src/R5Foo.java";
    writeJson(path.join(root, fixture.manifestPath), flowNamedSurface);
    expectFailure(
      () => validate({ root, ...fixture }),
      "FLOW_IDENTIFIER_IN_DESIGN_CHANGE_SURFACE:ST-U01:apps/example/src/R5Foo.java",
    );

    writeJson(path.join(root, fixture.manifestPath), fixture.manifest);
    writeJson(path.join(root, fixture.reviewPath), fixture.review);
    const admissionPath = "backend-acceptance-admission.json";
    const boundBytes = (relativePath) =>
      fs.readFileSync(path.join(root, relativePath));
    const admission = {
      schemaVersion: 1,
      kind: "backend-acceptance-design-admission",
      status: "ACTIVE_IMPLEMENTATION",
      packageId: "BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813",
      sourceBindings: {
        design: {
          path: "doc/plans/design.md",
          sha256: sha256(boundBytes("doc/plans/design.md")),
        },
        requirements: {
          path: "doc/decisions/source.md",
          sha256: sha256(boundBytes("doc/decisions/source.md")),
        },
        designReview: {
          path: fixture.reviewPath,
          sha256: sha256(boundBytes(fixture.reviewPath)),
        },
        executionContract: {
          path: fixture.backendOperationDesignContractPath,
          sha256: sha256(boundBytes(fixture.backendOperationDesignContractPath)),
        },
        implementationManifest: {
          path: fixture.manifestPath,
          sha256: sha256(boundBytes(fixture.manifestPath)),
        },
      },
      deliveryUnits: [
        {
          id: "BA-U01",
          backendOperationImpact: "NONE_WITH_REASON",
          reason: "static route and admission infrastructure only",
        },
        {
          id: "BA-U02",
          backendOperationImpact: "ADDED_OR_CHANGED",
          scenarioContracts: [
            {
              registryPath: "contracts/registry/backend-acceptance-scenarios.json",
              identitySource: "CURRENT_ENTRY_OPERATION_DENOMINATOR",
              exactSet: "CURRENT_SEMANTIC_OPERATION_IDENTITY",
              requiredFields: backendAcceptanceScenarioFields,
            },
          ],
        },
        ...["BA-U03", "BA-U04", "BA-U05", "BA-U06"].map((id) => ({
          id,
          backendOperationImpact: "NONE_WITH_REASON",
          reason: "acceptance infrastructure or migration only",
        })),
      ],
    };
    writeJson(path.join(root, admissionPath), admission);
    validateBackendAcceptanceAdmission(root, admissionPath);
    const missingImpact = structuredClone(admission);
    delete missingImpact.deliveryUnits[0].backendOperationImpact;
    writeJson(path.join(root, admissionPath), missingImpact);
    expectFailure(
      () => validateBackendAcceptanceAdmission(root, admissionPath),
      "BACKEND_ACCEPTANCE_OPERATION_DISPOSITION_REQUIRED:BA-U01",
    );
    const missingScenarioContract = structuredClone(admission);
    delete missingScenarioContract.deliveryUnits[1].scenarioContracts;
    writeJson(path.join(root, admissionPath), missingScenarioContract);
    expectFailure(
      () => validateBackendAcceptanceAdmission(root, admissionPath),
      "BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_REQUIRED:BA-U02",
    );

    const baselinePath = "doc/evidence/s0-baseline.md";
    const baselineText = [
      "# Baseline",
      "",
      "## 3. Existing-control baseline",
      "",
      "| control | S0 state | proof / activation rule |",
      "|---|---|---|",
      "| `scripts/check/example` | ACTIVE_RED_VERIFIED | real mutation |",
      "| aggregate `scripts/verify` | OUT_OF_SCOPE_THIS_PACKAGE | later dynamic evidence |",
      "",
      "## 4. Exit",
      "",
    ].join("\n");
    fs.mkdirSync(path.dirname(path.join(root, baselinePath)), { recursive: true });
    fs.writeFileSync(path.join(root, baselinePath), baselineText);
    validateS0Baseline({ root, baselinePath });
    fs.writeFileSync(
      path.join(root, baselinePath),
      baselineText.replace("ACTIVE_RED_VERIFIED", "PENDING Phase C"),
    );
    expectFailure(
      () => validateS0Baseline({ root, baselinePath }),
      "S0_BASELINE_CONTROL_STATE_INVALID:PENDING Phase C",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write(
    [
      "IMPLEMENTATION_DESIGN_GRANULARITY_SELF_TEST=PASS",
      "RED_FIXTURE_OPERATION_LOGIC_STEPS_MISSING=PASS",
      "RED_FIXTURE_OPERATION_CALL_CHAIN_OWNER_SET_DRIFT=PASS",
      "RED_FIXTURE_OPERATION_PROBLEM_MAPPING_DRIFT=PASS",
      "RED_FIXTURE_OPERATION_DB_COUNT_DRIFT=PASS",
      "SCHEMA_V1_BACKWARD_COMPATIBILITY=PASS",
      "RED_FIXTURE_DESIGN_HASH_DRIFT=PASS",
      "RED_FIXTURE_MISSING_BUSINESS_EVIDENCE=PASS",
      "RED_FIXTURE_MISSING_UI_INTERACTION_ARTIFACT=PASS",
      "RED_FIXTURE_MISSING_MULTI_PAGE_INTERACTION_ARTIFACTS=PASS",
      "RED_FIXTURE_DUPLICATE_UI_INTERACTION_ANCHOR=PASS",
      "RED_FIXTURE_SEVERITY_COUNT_MISMATCH=PASS",
      "RED_FIXTURE_ROUND_THREE=PASS",
      "RED_FIXTURE_MISSING_FINDING_UNIT_LINK=PASS",
      "RED_FIXTURE_REVIEWER_KIND_NOT_INDEPENDENT_SUBAGENT=PASS",
      "RED_FIXTURE_REVIEWER_INPUT_CHECKLIST_NOT_FOUND=PASS",
      "RED_FIXTURE_POST_REMEDIATION_WITHOUT_DECLARATION=PASS",
      "RED_FIXTURE_POST_REMEDIATION_INTAKE_NOT_FOUND=PASS",
      "RED_FIXTURE_POST_REMEDIATION_ADDED_UNIT_DECLARATION=PASS",
      "RED_FIXTURE_POST_REMEDIATION_UNKNOWN_ADDED_UNIT=PASS",
      "RED_FIXTURE_FLOW_IDENTIFIER_IN_DESIGN_CHANGE_SURFACE=PASS",
      "RED_FIXTURE_CREATE_PATH_ALREADY_EXISTS=PASS",
      "RED_FIXTURE_S0_BASELINE_PENDING_CONTROL=PASS",
      "RED_FIXTURE_BACKEND_ACCEPTANCE_OPERATION_DISPOSITION_REQUIRED=PASS",
      "RED_FIXTURE_BACKEND_ACCEPTANCE_SCENARIO_CONTRACT_REQUIRED=PASS",
      "",
    ].join("\n"),
  );
}

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  scripts/check/implementation-design-granularity --manifest <path> --review <path>",
      "  scripts/check/implementation-design-granularity --backend-acceptance-admission <path>",
      "  scripts/check/implementation-design-granularity --self-test",
      "  scripts/check/implementation-design-granularity --s0-baseline <path>",
      "",
    ].join("\n"),
  );
}

function main(argv) {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  if (argv.length === 1 && argv[0] === "--self-test") {
    selfTest();
    return;
  }
  if (argv.length === 2 && argv[0] === "--s0-baseline") {
    const result = validateS0Baseline({ root, baselinePath: argv[1] });
    process.stdout.write(
      [
        "IMPLEMENTATION_DESIGN_GRANULARITY_S0_BASELINE=PASS",
        `CONTROLS=${result.controls}`,
        "",
      ].join("\n"),
    );
    return;
  }
  if (
    argv.length === 2 &&
    argv[0] === "--backend-acceptance-admission"
  ) {
    const result = validateBackendAcceptanceAdmission(root, argv[1]);
    process.stdout.write(
      [
        "BACKEND_ACCEPTANCE_DESIGN_ADMISSION=PASS",
        `UNITS=${result.units}`,
        `ADDED_OR_CHANGED=${result.addedOrChanged}`,
        "",
      ].join("\n"),
    );
    return;
  }
  if (
    argv.length === 4 &&
    argv[0] === "--manifest" &&
    argv[2] === "--review"
  ) {
    const result = validate({
      root,
      manifestPath: argv[1],
      reviewPath: argv[3],
    });
    process.stdout.write(
      [
        "IMPLEMENTATION_DESIGN_GRANULARITY=PASS",
        `UNITS=${result.units}`,
        `OPERATIONS=${result.operations}`,
        `FINDINGS=${result.findings}`,
        `VERDICT=${result.verdict}`,
        `REVIEW_ROUND=${result.reviewRound}`,
        `REVIEW_BINDING_MODE=${result.bindingMode}`,
        "",
      ].join("\n"),
    );
    return;
  }
  usage();
  process.exitCode = 2;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `IMPLEMENTATION_DESIGN_GRANULARITY=FAIL\nREASON=${reason}\n`,
  );
  process.exitCode = 1;
}
