#!/usr/bin/env node
/**
 * The only reusable owner of backend-performance evidence HMAC bytes.
 *
 * The canonical field order is intentionally copied once from the accepted
 * final-acceptance verifier. Consumers may choose their own failure code, but
 * they may not reimplement the byte sequence, key decoding, or comparison.
 */
import {createHmac, timingSafeEqual} from "node:crypto";

const HMAC_ALGORITHM = "sha256";
const HMAC_ENCODING = "base64url";
const HMAC_KEY_ENVIRONMENT = "V2S_DB_OPERATIONS_HMAC_KEY";
const HMAC_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const completionCanonicalFields = (row, databaseOperationCount) => [
  row.runId ?? row.managedDevRunId,
  row.correlationId,
  row.requestId,
  row.operationId,
  row.performanceFixtureId,
  row.performanceArea,
  databaseOperationCount,
  row.logicalStatementCount,
];

const databaseOperationCanonicalFields = (row) => [
  row.runId,
  row.correlationId,
  row.requestId,
  row.operationId,
  row.seq,
  row.section,
  row.kind,
  row.action,
  row.statementId ?? "",
];

const canonicalBytes = (fields) => fields.join("\u0000");
const sign = (key, fields) => createHmac(HMAC_ALGORITHM, key).update(canonicalBytes(fields)).digest(HMAC_ENCODING);

export const HMAC_POLICY = Object.freeze({
  algorithm: "HmacSHA256",
  keyEnvironment: HMAC_KEY_ENVIRONMENT,
  keyEncoding: "BASE64URL",
  digestEncoding: HMAC_ENCODING,
  separator: "\\u0000",
  completionFields: Object.freeze(["runId|managedDevRunId", "correlationId", "requestId", "operationId", "performanceFixtureId", "performanceArea", "databaseOperationCount", "logicalStatementCount"]),
  databaseOperationFields: Object.freeze(["runId", "correlationId", "requestId", "operationId", "seq", "section", "kind", "action", "statementId ?? \"\""]),
});

export function decodeIntegrityKey(encoded = process.env[HMAC_KEY_ENVIRONMENT], errorCode = "BP_FINAL_INTEGRITY_KEY_REQUIRED") {
  if (typeof encoded !== "string" || !/^[A-Za-z0-9_-]{22,}$/.test(encoded)) throw Object.assign(new Error(errorCode), {code: errorCode});
  const key = Buffer.from(encoded, HMAC_ENCODING);
  if (key.length < 16) throw Object.assign(new Error(errorCode), {code: errorCode});
  return key;
}

export function completionEvidenceCanonical(row, databaseOperationCount) {
  return canonicalBytes(completionCanonicalFields(row, databaseOperationCount));
}

export function databaseOperationEvidenceCanonical(row) {
  return canonicalBytes(databaseOperationCanonicalFields(row));
}

export function signCompletionEvidence(key, row, databaseOperationCount) {
  return sign(key, completionCanonicalFields(row, databaseOperationCount));
}

export function signDatabaseOperationEvidence(key, row) {
  return sign(key, databaseOperationCanonicalFields(row));
}

export function isBase64UrlHmac(value) {
  return typeof value === "string" && HMAC_PATTERN.test(value);
}

export function verifyBase64UrlHmac(actual, expected) {
  if (!isBase64UrlHmac(actual) || !isBase64UrlHmac(expected)) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
