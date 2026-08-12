import assert from "node:assert/strict";
import test from "node:test";
import {
  HMAC_POLICY,
  decodeIntegrityKey,
  databaseOperationEvidenceCanonical,
  isBase64UrlHmac,
  signCompletionEvidence,
  signDatabaseOperationEvidence,
  verifyBase64UrlHmac,
} from "./backend-performance-evidence-hmac.mjs";

const encodedKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const key = decodeIntegrityKey(encodedKey);

test("shared HMAC owner exposes the reviewed canonical domains exactly", () => {
  assert.deepEqual(HMAC_POLICY.completionFields, [
    "runId|managedDevRunId", "correlationId", "requestId", "operationId",
    "performanceFixtureId", "performanceArea", "databaseOperationCount", "logicalStatementCount",
  ]);
  assert.deepEqual(HMAC_POLICY.databaseOperationFields, [
    "runId", "correlationId", "requestId", "operationId", "seq", "section", "kind", "action", "statementId ?? \"\"",
  ]);
  assert.equal(HMAC_POLICY.separator, "\\u0000");
  assert.equal(HMAC_POLICY.keyEnvironment, "V2S_DB_OPERATIONS_HMAC_KEY");
});

test("database operation canonical bytes preserve statementId ?? empty-string semantics", () => {
  const withoutStatementId = {runId: "run", correlationId: "correlation", requestId: "request", operationId: "operation", seq: 1, section: "OWNER_READ", kind: "JDBC", action: "QUERY"};
  const explicitEmptyStatementId = {...withoutStatementId, statementId: ""};
  const namedStatementId = {...withoutStatementId, statementId: "statement-1"};
  assert.equal(databaseOperationEvidenceCanonical(withoutStatementId), databaseOperationEvidenceCanonical(explicitEmptyStatementId));
  assert.equal(signDatabaseOperationEvidence(key, withoutStatementId), signDatabaseOperationEvidence(key, explicitEmptyStatementId));
  assert.notEqual(signDatabaseOperationEvidence(key, withoutStatementId), signDatabaseOperationEvidence(key, namedStatementId));
});

test("completion and database signatures verify only their exact canonical payload", () => {
  const completion = {runId: "run", correlationId: "correlation", requestId: "request", operationId: "operation", performanceFixtureId: "fixture", performanceArea: "U07_ROUTE", logicalStatementCount: 2};
  const signature = signCompletionEvidence(key, completion, 2);
  assert.equal(isBase64UrlHmac(signature), true);
  assert.equal(verifyBase64UrlHmac(signature, signCompletionEvidence(key, completion, 2)), true);
  assert.equal(verifyBase64UrlHmac(signature, signCompletionEvidence(key, {...completion, operationId: "other"}, 2)), false);

  const database = {runId: "run", correlationId: "correlation", requestId: "request", operationId: "operation", seq: 1, section: "OWNER_READ", kind: "JDBC", action: "QUERY", statementId: "statement-1"};
  const databaseSignature = signDatabaseOperationEvidence(key, database);
  assert.equal(verifyBase64UrlHmac(databaseSignature, signDatabaseOperationEvidence(key, database)), true);
  assert.equal(verifyBase64UrlHmac(databaseSignature, signDatabaseOperationEvidence(key, {...database, action: "UPDATE"})), false);
});

test("integrity key decoding fails closed at the reusable owner boundary", () => {
  assert.throws(() => decodeIntegrityKey("too-short"), /BP_FINAL_INTEGRITY_KEY_REQUIRED/);
  assert.throws(() => decodeIntegrityKey("not base64!"), /BP_FINAL_INTEGRITY_KEY_REQUIRED/);
});
