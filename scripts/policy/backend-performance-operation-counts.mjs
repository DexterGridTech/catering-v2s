import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const OPERATION_COUNT_SOURCE_PATH = "contracts/policy/backend-performance-operation-counts.json";

const requiredCounts = Object.freeze(["operations", "reads", "commands"]);
const requiredFaceCounts = Object.freeze(["operationsAdmin", "platformAdmin", "public"]);
const allowedRootKeys = Object.freeze(["schemaVersion", "kind", "status", "manual", ...requiredCounts, "commandsByFace"]);

const fail = (code, detail = "") => {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
};

const readSource = (root) => {
  if (typeof root !== "string" || root.trim() === "") fail("OPERATION_COUNT_SOURCE_ROOT_REQUIRED");
  let source;
  try {
    source = JSON.parse(fs.readFileSync(path.join(root, OPERATION_COUNT_SOURCE_PATH), "utf8"));
  } catch (error) {
    fail("OPERATION_COUNT_SOURCE_READ_FAILED", error.code ?? "PARSE_ERROR");
  }
  if (source?.schemaVersion !== 1 || source?.kind !== "backend-performance-operation-counts"
    || source?.status !== "ACTIVE" || source?.manual !== true) {
    fail("OPERATION_COUNT_SOURCE_SHAPE_INVALID");
  }
  if (Object.keys(source).some((key) => !allowedRootKeys.includes(key))) {
    fail("OPERATION_COUNT_SOURCE_FIELD_UNKNOWN");
  }
  for (const field of requiredCounts) {
    if (!Number.isInteger(source[field]) || source[field] < 0) fail("OPERATION_COUNT_SOURCE_VALUE_INVALID", field);
  }
  if (!source.commandsByFace || typeof source.commandsByFace !== "object" || Array.isArray(source.commandsByFace)) {
    fail("OPERATION_COUNT_SOURCE_FACE_SHAPE_INVALID");
  }
  if (Object.keys(source.commandsByFace).some((key) => !requiredFaceCounts.includes(key))) {
    fail("OPERATION_COUNT_SOURCE_FACE_FIELD_UNKNOWN");
  }
  for (const field of requiredFaceCounts) {
    if (!Number.isInteger(source.commandsByFace[field]) || source.commandsByFace[field] < 0) {
      fail("OPERATION_COUNT_SOURCE_FACE_VALUE_INVALID", field);
    }
  }
  if (requiredFaceCounts.reduce((sum, field) => sum + source.commandsByFace[field], 0) !== source.commands) {
    fail("OPERATION_COUNT_SOURCE_FACE_SUM_INVALID");
  }
  return Object.freeze({
    operations: source.operations,
    reads: source.reads,
    commands: source.commands,
    commandsByFace: Object.freeze({
      operationsAdmin: source.commandsByFace.operationsAdmin,
      platformAdmin: source.commandsByFace.platformAdmin,
      public: source.commandsByFace.public,
    }),
  });
};

export const readBackendPerformanceOperationCounts = ({ root = repositoryRoot } = {}) => readSource(root);
export const BACKEND_PERFORMANCE_OPERATION_COUNTS = readBackendPerformanceOperationCounts();
