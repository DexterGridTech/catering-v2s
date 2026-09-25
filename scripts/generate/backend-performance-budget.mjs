#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BACKEND_PERFORMANCE_OPERATION_COUNTS} from '../policy/backend-performance-operation-counts.mjs';

const currentFile = path.resolve(fileURLToPath(import.meta.url));

export const EXPECTED_OPERATION_COUNT = BACKEND_PERFORMANCE_OPERATION_COUNTS.operations;
export const BATCH_OPERATION_ID = 'batchTransitionOperationsCatalogItemStatus';
export const CP05_CALIBRATION_REPORT_PATH = 'contracts/policy/backend-performance-cp05-calibration-report.json';
export const CP05_CALIBRATION_BOOTSTRAP_DIGEST = crypto
  .createHash('sha256')
  .update('CP05_CALIBRATION_BOOTSTRAP_IDENTITY_ONLY')
  .digest('hex');
export const CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF = 'DEXTER-2026-08-26-CURRENT_PROGRAM_RESULT_BUDGET';
export const LINEAR_REQUEST_CARDINALITY_BUDGET = Object.freeze({
  kind: 'LINEAR_REQUEST_CARDINALITY',
  base: 15,
  perItem: 5,
  cardinalityPath: '$.items',
});
export const REQUIRED_BATCH_CARDINALITIES = Object.freeze([1, 20, 100]);

// Dexter decision 2026-08-29: the generic P3 <=20 ceiling does not fit
// invitation and employment-assignment commands whose business fact is
// inherently written across multiple tables. This remains an exact,
// report-bound exception set; it is not a blanket ceiling increase or a
// reclassification of unrelated operations.
const INVITATION_ASSIGNMENT_P3_DECISION_REF =
  'DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3';
const INVITATION_ASSIGNMENT_P3_MEASURED_MAX_BY_OPERATION = Object.freeze({
  createWorkspaceInvitation: 26,
  reissueOperationsWorkspaceGroupInvitation: 29,
  reissueOperationsWorkspaceHeadCompanyInvitation: 29,
  reissueOperationsWorkspaceProjectInvitation: 28,
  reissueOperationsWorkspaceRegionInvitation: 29,
  reissueOperationsWorkspaceStoreInvitation: 28,
  reissueWorkspaceInvitation: 30,
  revokeOperationsWorkspaceGroupUserAssignment: 28,
  revokeOperationsWorkspaceHeadCompanyUserAssignment: 28,
  revokeOperationsWorkspaceProjectUserAssignment: 26,
  revokeOperationsWorkspaceRegionUserAssignment: 28,
  revokeOperationsWorkspaceStoreUserAssignment: 26,
});

// Dexter decision 2026-09-02: the generic P3 <=20 ceiling does not fit the
// Sales Menu command paths after the current-tree CP-05 repair. The three
// managed calibration runs proved stable operation-scoped maxima, and the
// fresh step reconciliation found no safe consolidation that would remove
// owner facts, transaction, idempotency, locking, audit, or authoritative
// readback. This is the exact authorized command set; it is not a blanket
// Sales Menu or P3 ceiling increase.
const SALES_MENU_P3_DECISION_REF = 'DEXTER-2026-09-02-SALES-MENU-NATURAL-MULTI-TABLE-P3';
const SALES_MENU_P3_MEASURED_MAX_BY_OPERATION = Object.freeze({
  // The current-tree CP-05 remeasurement includes the Store operating-rule gate read.
  // Keep the existing operation-scoped Dexter exception; refresh only its measured maxima.
  addOperationsSalesMenuItems: 32,
  archiveOperationsSalesMenu: 27,
  copyOperationsSalesMenu: 39,
  createOperationsSalesMenu: 33,
  createOperationsSalesMenuSection: 30,
  deleteOperationsSalesMenuItem: 34,
  deleteOperationsSalesMenuSection: 31,
  moveOperationsSalesMenuItem: 34,
  moveOperationsSalesMenuSection: 34,
  publishOperationsSalesMenu: 48,
  releaseOperationsSalesMenuStagedAsset: 31,
  renameOperationsSalesMenu: 27,
  renameOperationsSalesMenuSection: 30,
  restoreOperationsSalesMenuItemSale: 36,
  setOperationsSalesMenuActivation: 32,
  setOperationsSalesMenuItemSoldOut: 36,
  stageOperationsSalesMenuAsset: 36,
  updateOperationsSalesMenuItem: 51,
  updateOperationsSalesMenuSchedule: 29,
});

const FORBIDDEN_PLACEHOLDER_TOKENS = new Set([
  'NULL',
  'SENTINEL',
  'UNLIMITED',
  'INFINITE',
  'INFINITY',
  'PENDING',
  'CALIBRATION_PENDING',
]);
const NORMAL_MEASUREMENT_SCENARIO_ID = 'performance.normal-path';

// This resolver deliberately owns only Dexter's bounded decision scope.  It
// contains no ceilings or budget numbers: those must come from the three-run
// CP-05 report, otherwise a historical value could silently become a new
// source of truth.
export const CONTROLLED_BUDGET_EXCEPTION_DECISION_SCOPE = Object.freeze({
  'DEXTER-2026-08-26-REORDER_DICTIONARY_BUDGET': Object.freeze(['reorderOperationsCatalogDictionaryEntry']),
  'DEXTER-2026-08-26-INVENTORY_QUANTITY_WRITE_BUDGET': Object.freeze([
    'increaseOperationsInventoryTarget',
    'adjustOperationsInventoryTarget',
  ]),
  'DEXTER-2026-08-26-INVENTORY_TARGET_SUMMARY_READ_BUDGET': Object.freeze([
    'getOperationsInventoryTargetChangeSummary',
    'getOperationsInventoryTargetBusinessHistory',
  ]),
  'DEXTER-2026-08-26-TEMPORARY_PROMOTION_CLOSURE_BUDGET': Object.freeze([
    'preflightOperationsTemporaryCatalogItemPromotion',
    'executeOperationsTemporaryCatalogItemPromotion',
  ]),
  'DEXTER-2026-08-26-BRAND_COPY_CLOSURE_BUDGET': Object.freeze(['executeOperationsBrandCatalogCopy']),
  [INVITATION_ASSIGNMENT_P3_DECISION_REF]: Object.freeze(
    Object.keys(INVITATION_ASSIGNMENT_P3_MEASURED_MAX_BY_OPERATION),
  ),
  [SALES_MENU_P3_DECISION_REF]: Object.freeze(Object.keys(SALES_MENU_P3_MEASURED_MAX_BY_OPERATION)),
  'IMPLEMENTATION-AGENT-2026-09-18-STORE-CREATE-P3': Object.freeze(['createOperationsOrganizationStore']),
  'IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-CREATE-P3': Object.freeze([
    'postOperationsStoreServicePoint',
  ]),
  'IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-PATCH-P3': Object.freeze([
    'patchOperationsStoreServicePoint',
  ]),
  'IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-ASSET-STAGE-P3': Object.freeze(['stageStoreServicePointImage']),
});

// Source-owned controlled exception records.  Keep this in the budget
// generator, not in the generated CP-05 report, so reclassification can project
// the current approved record set without making the report a second source of
// truth. Each record is deliberately operation-scoped and tied to the
// three-run CP-05 calibration maxima; it does not authorize deleting business
// facts to make a count fit the generic ceiling.
const invitationAssignmentBudgetExceptionRecords = Object.entries(INVITATION_ASSIGNMENT_P3_MEASURED_MAX_BY_OPERATION).map(
  ([operationId, measuredMax]) => {
    const isAssignmentRevocation = operationId.startsWith('revokeOperationsWorkspace');
    return Object.freeze({
      operationId,
      decisionRef: INVITATION_ASSIGNMENT_P3_DECISION_REF,
      authority: 'DEXTER',
      from: 20,
      to: measuredMax,
      history: [
        {
          from: 20,
          to: measuredMax,
          reason:
            'Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.',
          decisionRef: INVITATION_ASSIGNMENT_P3_DECISION_REF,
        },
      ],
      businessFactsPreserved: true,
      businessFactsEvidence: [
        isAssignmentRevocation
          ? 'owner:workspace-iam:assignment-revocation-command'
          : 'owner:workspace-iam:invitation-command',
        'business-facts:owner-recheck-transaction-idempotency-lock-audit-authoritative-readback',
        `measurement:cp05-three-run-max:${operationId}:${measuredMax}`,
      ],
      sharedMechanismsReused: true,
      sharedMechanismsEvidence: [
        'source:workspace-iam:shared-command-receipt-audit-lock-readback',
        'measurement:cp05-three-run-exact-operation-set:238:unclassified-sql:0',
      ],
      rejectedAlternative:
        '删除邀请或任职聚合的 owner 复核、事务、幂等回放、并发锁、typed problem、审计或权威 readback，以硬压到 20；该方案会丢失业务事实。',
      costComparison:
        '三轮受管 CP-05 已证明该 operation 的稳定上限；保留天然多表业务事实的成本高于通用 P3 计数上限，但没有可消除的共享 fan-out，不能以止血改写业务。',
      narrowScope: operationId,
    });
  },
);

const salesMenuBudgetExceptionRecords = Object.entries(SALES_MENU_P3_MEASURED_MAX_BY_OPERATION).map(
  ([operationId, measuredMax]) =>
    Object.freeze({
      operationId,
      decisionRef: SALES_MENU_P3_DECISION_REF,
      authority: 'DEXTER',
      from: 20,
      to: measuredMax,
      history: [
        {
          from: 20,
          to: measuredMax,
          reason:
            'Dexter 2026-09-02: the Sales Menu command keeps its complete owner transaction and authoritative readback after three managed CP-05 calibration runs; no safe consolidation can remove the remaining natural multi-table business facts.',
          decisionRef: SALES_MENU_P3_DECISION_REF,
        },
      ],
      businessFactsPreserved: true,
      businessFactsEvidence: [
        'owner:sales-menu:store-scope-channel-draft-publication-manual-asset-readback',
        'business-facts:owner-recheck-transaction-idempotency-lock-cas-typed-problem-audit-authoritative-readback',
        'business-facts:asset-target-claim-release-guards-for-applicable-asset-operations',
        `measurement:cp05-three-run-max:${operationId}:${measuredMax}`,
        'measurement:cp05-report:contracts/policy/backend-performance-cp05-calibration-report.json',
        'measurement:cp05-source-runs:r5-tc-1789567247310-40901,r5-tc-1789567647809-42171,r5-tc-1789568049113-43334',
      ],
      sharedMechanismsReused: true,
      sharedMechanismsEvidence: [
        'source:sales-menu:shared-command-receipt-lock-owner-readback',
        'source:sales-menu:set-based-write-helpers-and-shared-owner-guards',
        'measurement:basis:JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH',
        'measurement:cp05-three-run-exact-operation-set:270:unclassified-sql:0',
      ],
      rejectedAlternative:
        '删除 Sales Menu owner 复核、REQUIRED 事务、幂等回放、并发锁、CAS、typed problem、审计、asset target guard 或权威 readback，以硬压到通用 20；该方案会丢失销售菜单业务事实或原子性。',
      costComparison:
        '三轮受管 CP-05 已证明该 operation 的稳定上限；fresh 步骤级复核未发现可消除的共享 fan-out、重复实现或安全 N+1，保留完整业务闭包的成本高于通用 P3 计数上限。',
      narrowScope: operationId,
    }),
);

// Dexter decision 2026-08-26: retain the complete brand-copy closure. The
// current-tree CP-05 remeasurement moves its exact operation-scoped ceiling
// from the previously recorded 48 to 49; this is not a generic P3 allowance.
const brandCopyBudgetExceptionRecords = Object.freeze([
  Object.freeze({
    operationId: 'executeOperationsBrandCatalogCopy',
    decisionRef: 'DEXTER-2026-08-26-BRAND_COPY_CLOSURE_BUDGET',
    authority: 'DEXTER',
    from: 48,
    to: 49,
    history: [
      {
        from: 48,
        to: 49,
        reason:
          'Dexter 2026-08-26: brand-copy keeps its complete multi-owner closure; three current-tree CP-05 calibration runs measured a stable maximum of 49 after the Store operating-rule gate, with no safe consolidation that preserves all business facts.',
        decisionRef: 'DEXTER-2026-08-26-BRAND_COPY_CLOSURE_BUDGET',
      },
    ],
    businessFactsPreserved: true,
    businessFactsEvidence: [
      'owner:catalog:brand-copy-coordinator-and-copy-closure',
      'business-facts:scope-recheck-preflight-digest-transaction-idempotency-lock-audit-authoritative-readback',
      'measurement:cp05-three-run-max:executeOperationsBrandCatalogCopy:49',
      'measurement:cp05-report:contracts/policy/backend-performance-cp05-calibration-report.json',
      'measurement:cp05-source-runs:r5-tc-1789570560983-51172,r5-tc-1789570966699-52876,r5-tc-1789571368879-54896',
    ],
    sharedMechanismsReused: true,
    sharedMechanismsEvidence: [
      'source:catalog:shared-copy-preflight-closure-and-owner-command-path',
      'measurement:basis:JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH',
      'measurement:cp05-three-run-exact-operation-set:270:unclassified-sql:0',
    ],
    rejectedAlternative:
      '删除品牌复制的 owner 闭包、预检重算、事务、幂等回放、并发锁、审计、跨 owner command 或权威 readback，以硬压到 48；该方案会丢失复制事实或原子性。',
    costComparison:
      '三轮受管 CP-05 在 1、20、100 三种批量基数下均测得 49；逐项检查未发现可消除的共享 fan-out 或重复 owner 查询，保留完整闭包的成本高于既有 48 ceiling，但只影响这一条已授权 operation。',
    narrowScope: 'executeOperationsBrandCatalogCopy',
  }),
]);

// Dexter's 2026-09-18 implementation authorization delegates the already
// defined fixed, single-operation exception decision for this batch.  The
// four records below are deliberately separate: the Store create operation
// retains its complete organization/contract/rule readback, the two service
// point mutations retain their owner transaction and point readback, and
// asset staging retains its digest/usage/staging proof.  None of these records
// changes the generic P3 ceiling or covers the linear batch operation.
const STORE_SERVICE_POINT_P3_DECISIONS = Object.freeze({
  createOperationsOrganizationStore: Object.freeze({
    decisionRef: 'IMPLEMENTATION-AGENT-2026-09-18-STORE-CREATE-P3',
    measuredMax: 25,
    businessFactsEvidence: [
      'source:apps/backend/catering-business-server/src/main/java/com/catering/v2s/organization/application/operations/CreateOperationsOrganizationStoreOperation.java:32-47',
      'source:apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java:createNow',
      'business-facts:store-create-rule-json-qr-singleton-extension-audit-organization-contract-rule-readback',
      'measurement:cp05-three-run-max:createOperationsOrganizationStore:25',
    ],
    sharedMechanismsEvidence: [
      'source:organization:shared-command-receipt-owner-transaction-audit-readback',
      'source:organization:store-operating-rule-codec-and-qr-singleton-persistence',
      'measurement:cp05-three-run-exact-operation-set:286:unclassified-sql:0',
    ],
    rejectedAlternative:
      '删除组织详情、合同派生状态或 operating-rule/QR 最终 readback，以硬压到通用 P3=20；这会丢失当前 operation 契约要求的业务事实或让新建后的规则状态无法得到权威确认。',
    costComparison:
      '1、20、100 三个批量基数下该 operation 均稳定为 25；同根扫描未发现可安全合并的 owner fan-out，保留完整新建闭包的安全与审计成本高于通用阈值，但只放行该一个 operation。',
  }),
  postOperationsStoreServicePoint: Object.freeze({
    decisionRef: 'IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-CREATE-P3',
    measuredMax: 27,
    businessFactsEvidence: [
      'source:apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java:195-211',
      'source:apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java:createPoint',
      'business-facts:store-scope-area-type-compatibility-extension-audit-idempotency-owner-readback',
      'measurement:cp05-three-run-max:postOperationsStoreServicePoint:27',
    ],
    sharedMechanismsEvidence: [
      'source:organization:shared-owner-scope-gate-receipt-extension-audit-version',
      'source:organization:store-service-point-asset-lifecycle-adapter',
      'measurement:cp05-three-run-exact-operation-set:286:unclassified-sql:0',
    ],
    rejectedAlternative:
      '删除 area 类型重验、扩展定义校验、审计、幂等/版本或创建后的 point readback，以硬压到通用 P3=20；这会允许错误类型或半成品写入，或者失去权威创建结果。',
    costComparison:
      '1、20、100 三个批量基数下该 operation 均稳定为 27；owner 事实、事务和 readback 已复用共享机制，未发现不削弱业务语义的安全 consolidation，例外仅绑定该 create operation。',
  }),
  patchOperationsStoreServicePoint: Object.freeze({
    decisionRef: 'IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-PATCH-P3',
    measuredMax: 25,
    businessFactsEvidence: [
      'source:apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java:225-241',
      'source:apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java:updatePoint',
      'business-facts:store-scope-version-type-extension-image-claim-audit-owner-readback',
      'measurement:cp05-three-run-max:patchOperationsStoreServicePoint:25',
    ],
    sharedMechanismsEvidence: [
      'source:organization:shared-owner-scope-gate-receipt-extension-audit-version',
      'source:asset:shared-stage-claim-release-and-typed-target-core',
      'measurement:cp05-three-run-exact-operation-set:286:unclassified-sql:0',
    ],
    rejectedAlternative:
      '删除并发锁/版本、扩展校验、图片 claim、审计或更新后的 point readback，以硬压到通用 P3=20；这会破坏保存原子性、资产归属或历史追溯。',
    costComparison:
      '1、20、100 三个批量基数下该 operation 均稳定为 25；同根 owner/asset 扫描未发现可消除的重复 fan-out，完整更新闭包的成本只对该 operation 放宽。',
  }),
  stageStoreServicePointImage: Object.freeze({
    decisionRef: 'IMPLEMENTATION-AGENT-2026-09-18-SERVICE-POINT-ASSET-STAGE-P3',
    measuredMax: 25,
    businessFactsEvidence: [
      'source:apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java:314-340',
      'source:apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:118-140',
      'business-facts:asset-digest-usage-staging-bind-proof-scope-and-failure-cleanup',
      'measurement:cp05-three-run-max:stageStoreServicePointImage:25',
    ],
    sharedMechanismsEvidence: [
      'source:asset:PlatformAssetService.shared-stage-content-and-bind-grant',
      'source:organization:store-service-point-asset-typed-boundary',
      'measurement:cp05-three-run-exact-operation-set:286:unclassified-sql:0',
    ],
    rejectedAlternative:
      '跳过 digest/usage/租户范围或 staging proof，以硬压到通用 P3=20；这会允许错误资产类型、越界对象或无法补偿的孤儿资产。',
    costComparison:
      '1、20、100 三个批量基数下该 operation 均稳定为 25；既有资产 stage 核心已经复用，剩余开销来自不可删除的安全边界，例外只绑定 staging operation。',
  }),
});

const storeServicePointBudgetExceptionRecords = Object.freeze(
  Object.entries(STORE_SERVICE_POINT_P3_DECISIONS).map(([operationId, decision]) =>
    Object.freeze({
      operationId,
      decisionRef: decision.decisionRef,
      authority: 'IMPLEMENTATION_AGENT',
      from: 20,
      to: decision.measuredMax,
      history: [
        {
          from: 20,
          to: decision.measuredMax,
          reason:
            'Dexter 2026-09-18 implementation authorization: retain the complete owner transaction, security boundaries and authoritative readback after three managed CP-05 measurements; no safe consolidation remains.',
          decisionRef: decision.decisionRef,
        },
      ],
      businessFactsPreserved: true,
      businessFactsEvidence: decision.businessFactsEvidence,
      sharedMechanismsReused: true,
      sharedMechanismsEvidence: decision.sharedMechanismsEvidence,
      rejectedAlternative: decision.rejectedAlternative,
      costComparison: decision.costComparison,
      narrowScope: operationId,
    }),
  ),
);

export const CONTROLLED_BUDGET_EXCEPTION_RECORDS = Object.freeze([
  ...invitationAssignmentBudgetExceptionRecords,
  ...salesMenuBudgetExceptionRecords,
  ...brandCopyBudgetExceptionRecords,
  ...storeServicePointBudgetExceptionRecords,
]);

const CONTROLLED_BUDGET_EXCEPTION_AUTHORITIES = new Set(['DEXTER', 'IMPLEMENTATION_AGENT']);

export const DATABASE_OPERATION_BUDGET_SCHEMA = Object.freeze({
  type: 'object',
  required: ['kind', 'measurementScenarioIds', 'history'],
  commonProperties: {
    kind: {enum: ['FIXED', 'LINEAR_REQUEST_CARDINALITY']},
    measurementScenarioIds: {type: 'array', minItems: 1, uniqueItems: true},
    history: {type: 'array', minItems: 1},
  },
  fixed: {
    required: ['max'],
    properties: {max: {type: 'integer', minimum: 0}},
  },
  linearRequestCardinality: {
    required: ['base', 'perItem', 'cardinalityPath'],
    properties: {
      base: {const: 15},
      perItem: {const: 5},
      cardinalityPath: {const: '$.items'},
    },
  },
});

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

export function isCp05CalibrationBootstrapMode(env = process.env) {
  return env?.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE === 'CALIBRATION';
}

/**
 * Focused acceptance compiles need the same identity-only projection as CP-05 calibration while the
 * newly added operations are not yet present in the current measured report. This build-only mode must
 * remain distinct from the full-run verification mode: it emits no budgets and cannot make an acceptance
 * run or a normal budget projection pass.
 */
export function isCp05IdentityOnlyProjectionMode(env = process.env) {
  return isCp05CalibrationBootstrapMode(env) || env?.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE === 'IDENTITY_ONLY';
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function placeholderToken(value) {
  if (typeof value !== 'string') return null;
  const token = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return FORBIDDEN_PLACEHOLDER_TOKENS.has(token) ? token : null;
}

function requireText(value, code, context) {
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) fail(code, context);
  const token = placeholderToken(value);
  if (token) fail('BUDGET_PLACEHOLDER_REJECTED', `${context}:${token}`);
  return value;
}

function requireNonNegativeInteger(value, code, context) {
  if (value === null || value === undefined) fail('BUDGET_NULL_REJECTED', context);
  if (typeof value === 'string' && placeholderToken(value)) {
    fail('BUDGET_PLACEHOLDER_REJECTED', `${context}:${placeholderToken(value)}`);
  }
  if (!Number.isInteger(value) || value < 0) fail(code, context);
  return value;
}

function requirePlainObject(value, code, context) {
  if (!isPlainObject(value)) {
    if (value === null || value === undefined) fail('BUDGET_NULL_REJECTED', context);
    if (placeholderToken(value)) fail('BUDGET_PLACEHOLDER_REJECTED', `${context}:${placeholderToken(value)}`);
    fail(code, context);
  }
  return value;
}

function requireUniqueTexts(values, code, context) {
  if (!Array.isArray(values) || values.length === 0) fail(code, context);
  const seen = new Set();
  for (const [index, value] of values.entries()) {
    requireText(value, code, `${context}[${index}]`);
    if (seen.has(value)) fail('BUDGET_DUPLICATE_VALUE', `${context}:${value}`);
    seen.add(value);
  }
  return values;
}

function assertAllowedKeys(value, allowed, code, context) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(code, `${context}.${key}`);
  }
}

function validateHistory(history, context) {
  if (!Array.isArray(history) || history.length === 0) fail('BUDGET_HISTORY_REQUIRED', context);
  for (const [index, entry] of history.entries()) {
    const entryContext = `${context}[${index}]`;
    requirePlainObject(entry, 'BUDGET_HISTORY_ENTRY_INVALID', entryContext);
    assertAllowedKeys(
      entry,
      new Set(['from', 'to', 'reason', 'decisionRef']),
      'BUDGET_HISTORY_FIELD_UNKNOWN',
      entryContext,
    );
    if (!Object.hasOwn(entry, 'from') || !Object.hasOwn(entry, 'to') || !Object.hasOwn(entry, 'reason')) {
      fail('BUDGET_HISTORY_ENTRY_INVALID', entryContext);
    }
    if (entry.from !== null)
      requireNonNegativeInteger(entry.from, 'BUDGET_HISTORY_FROM_INVALID', `${entryContext}.from`);
    requireNonNegativeInteger(entry.to, 'BUDGET_HISTORY_TO_INVALID', `${entryContext}.to`);
    requireText(entry.reason, 'BUDGET_HISTORY_REASON_INVALID', `${entryContext}.reason`);
    if (Object.hasOwn(entry, 'decisionRef'))
      requireText(entry.decisionRef, 'BUDGET_HISTORY_DECISION_REF_INVALID', `${entryContext}.decisionRef`);
    if (entry.from !== null) {
      if (entry.to === entry.from) fail('BUDGET_HISTORY_NOOP', entryContext);
      if (entry.to > entry.from && !entry.decisionRef)
        fail('BUDGET_HISTORY_INCREASE_DECISION_REF_REQUIRED', entryContext);
    }
  }
  return history;
}

export function validateDatabaseOperationBudget(budget, {operationId} = {}) {
  requireText(operationId, 'BUDGET_OPERATION_ID_INVALID', 'operationId');
  requirePlainObject(budget, 'BUDGET_OBJECT_INVALID', operationId);
  assertAllowedKeys(
    budget,
    new Set(['kind', 'max', 'base', 'perItem', 'cardinalityPath', 'measurementScenarioIds', 'history']),
    'BUDGET_FIELD_UNKNOWN',
    operationId,
  );
  requireText(budget.kind, 'BUDGET_KIND_INVALID', `${operationId}.kind`);
  requireUniqueTexts(
    budget.measurementScenarioIds,
    'BUDGET_MEASUREMENT_SCENARIOS_INVALID',
    `${operationId}.measurementScenarioIds`,
  );
  if (
    budget.measurementScenarioIds.length !== 1 ||
    budget.measurementScenarioIds[0] !== NORMAL_MEASUREMENT_SCENARIO_ID
  ) {
    fail('BUDGET_MEASUREMENT_SCENARIO_ID_INVALID', operationId);
  }
  validateHistory(budget.history, `${operationId}.history`);

  if (budget.kind === 'FIXED') {
    if (!Object.hasOwn(budget, 'max')) fail('BUDGET_FIXED_MAX_REQUIRED', operationId);
    requireNonNegativeInteger(budget.max, 'BUDGET_FIXED_MAX_INVALID', `${operationId}.max`);
    if (Object.hasOwn(budget, 'base') || Object.hasOwn(budget, 'perItem') || Object.hasOwn(budget, 'cardinalityPath')) {
      fail('BUDGET_FIXED_LINEAR_FIELDS_MIXED', operationId);
    }
    return budget;
  }

  if (budget.kind === 'LINEAR_REQUEST_CARDINALITY') {
    if (operationId !== BATCH_OPERATION_ID) fail('BUDGET_LINEAR_OPERATION_NOT_ALLOWED', operationId);
    if (Object.hasOwn(budget, 'max')) fail('BUDGET_LINEAR_FIXED_FIELDS_MIXED', operationId);
    if (
      budget.base !== LINEAR_REQUEST_CARDINALITY_BUDGET.base ||
      budget.perItem !== LINEAR_REQUEST_CARDINALITY_BUDGET.perItem ||
      budget.cardinalityPath !== LINEAR_REQUEST_CARDINALITY_BUDGET.cardinalityPath
    ) {
      fail('BUDGET_LINEAR_SHAPE_INVALID', operationId);
    }
    return budget;
  }

  fail('BUDGET_KIND_INVALID', `${operationId}:${budget.kind}`);
}

function validateOperationIds(operationIds, context = 'operationIds', expectedCount = EXPECTED_OPERATION_COUNT) {
  if (!Array.isArray(operationIds)) fail('BUDGET_OPERATION_SET_INVALID', context);
  const seen = new Set();
  for (const [index, operationId] of operationIds.entries()) {
    requireText(operationId, 'BUDGET_OPERATION_ID_INVALID', `${context}[${index}]`);
    if (seen.has(operationId)) fail('BUDGET_OPERATION_DUPLICATE', operationId);
    seen.add(operationId);
  }
  if (operationIds.length !== expectedCount)
    fail('BUDGET_OPERATION_COUNT_INVALID', `${context}:${operationIds.length}`);
  return operationIds;
}

function sameSet(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === new Set(right).size &&
    left.every(value => new Set(right).has(value))
  );
}

export function validateOperationExactSet(
  operationIds,
  {expectedOperationIds, expectedCount = EXPECTED_OPERATION_COUNT} = {},
) {
  const actual = validateOperationIds(operationIds, 'operationIds', expectedCount);
  if (expectedOperationIds !== undefined) {
    const expected = validateOperationIds(expectedOperationIds, 'expectedOperationIds', expectedCount);
    if (!sameSet(actual, expected)) {
      const actualSet = new Set(actual);
      const expectedSet = new Set(expected);
      const missing = expected.filter(operationId => !actualSet.has(operationId));
      const extra = actual.filter(operationId => !expectedSet.has(operationId));
      fail('BUDGET_OPERATION_EXACT_SET_MISMATCH', `missing=${missing.join(',')}:extra=${extra.join(',')}`);
    }
  }
  return actual;
}

export function validateBudgetRegistry(registry, {expectedOperationIds} = {}) {
  requirePlainObject(registry, 'BUDGET_REGISTRY_INVALID', 'registry');
  if (registry.activation === 'NOT_READY' || registry.status === 'NOT_READY') fail('BUDGET_REGISTRY_NOT_READY');
  if (!Array.isArray(registry.operations)) fail('BUDGET_REGISTRY_OPERATIONS_INVALID');
  const operationIds = validateOperationExactSet(
    registry.operations.map((operation, index) => {
      requirePlainObject(operation, 'BUDGET_OPERATION_INVALID', `operations[${index}]`);
      requireText(operation.operationId, 'BUDGET_OPERATION_ID_INVALID', `operations[${index}].operationId`);
      return operation.operationId;
    }),
    {expectedOperationIds},
  );
  let linearCount = 0;
  for (const operation of registry.operations) {
    if (!Object.hasOwn(operation, 'databaseOperationBudget')) fail('BUDGET_MISSING', operation.operationId);
    const budget = validateDatabaseOperationBudget(operation.databaseOperationBudget, {
      operationId: operation.operationId,
    });
    if (budget.kind === 'LINEAR_REQUEST_CARDINALITY') linearCount += 1;
  }
  if (linearCount !== 1 || !operationIds.includes(BATCH_OPERATION_ID)) fail('BUDGET_LINEAR_EXACT_SET_INVALID');
  return registry;
}

export function validateBudgetChange({operationId, from, to, decisionRef} = {}) {
  validateDatabaseOperationBudget(from, {operationId});
  validateDatabaseOperationBudget(to, {operationId});
  if (from.kind !== to.kind) fail('BUDGET_KIND_CHANGE_FORBIDDEN', operationId);
  if (from.kind === 'LINEAR_REQUEST_CARDINALITY') {
    if (from.base !== to.base || from.perItem !== to.perItem || from.cardinalityPath !== to.cardinalityPath) {
      fail('BUDGET_LINEAR_SHAPE_CHANGE_FORBIDDEN', operationId);
    }
    return to;
  }
  if (to.max < from.max) return to;
  if (to.max === from.max) fail('BUDGET_CHANGE_NOT_LOWER', operationId);
  const historyDecisionRef = to.history.at(-1)?.decisionRef;
  if (!(decisionRef || historyDecisionRef)) fail('BUDGET_INCREASE_DECISION_REF_REQUIRED', operationId);
  return to;
}

const requireEvidenceTexts = (value, code, context) => {
  const values = requireUniqueTexts(value, code, context);
  return Object.freeze([...values]);
};

export function validateControlledBudgetException({operationId, from, to, measuredMax, exception} = {}) {
  requireText(operationId, 'BUDGET_OPERATION_ID_INVALID', 'operationId');
  validateDatabaseOperationBudget(from, {operationId});
  validateDatabaseOperationBudget(to, {operationId});
  if (exception === null || exception === undefined) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_REQUIRED', operationId);
  }
  requireNonNegativeInteger(measuredMax, 'PERFORMANCE_REMEDIATION_EXCEPTION_MEASURED_MAX_INVALID', operationId);
  const record = requirePlainObject(exception, 'PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_INVALID', operationId);
  assertAllowedKeys(
    record,
    new Set([
      'operationId',
      'decisionRef',
      'authority',
      'from',
      'to',
      'history',
      'businessFactsPreserved',
      'businessFactsEvidence',
      'sharedMechanismsReused',
      'sharedMechanismsEvidence',
      'rejectedAlternative',
      'costComparison',
      'narrowScope',
    ]),
    'PERFORMANCE_REMEDIATION_EXCEPTION_FIELD_UNKNOWN',
    operationId,
  );
  for (const field of [
    'operationId',
    'decisionRef',
    'authority',
    'from',
    'to',
    'history',
    'businessFactsPreserved',
    'businessFactsEvidence',
    'sharedMechanismsReused',
    'sharedMechanismsEvidence',
    'rejectedAlternative',
    'costComparison',
    'narrowScope',
  ]) {
    if (!Object.hasOwn(record, field))
      fail('PERFORMANCE_REMEDIATION_EXCEPTION_FIELD_REQUIRED', `${operationId}.${field}`);
  }
  if (record.operationId !== operationId) fail('PERFORMANCE_REMEDIATION_EXCEPTION_OPERATION_MISMATCH', operationId);
  requireText(record.decisionRef, 'PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_REF_INVALID', operationId);
  if (!CONTROLLED_BUDGET_EXCEPTION_AUTHORITIES.has(record.authority)) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_AUTHORITY_INVALID', operationId);
  }
  const allowed = CONTROLLED_BUDGET_EXCEPTION_DECISION_SCOPE[record.decisionRef];
  if (!allowed) fail('PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_REF_UNKNOWN', record.decisionRef);
  if (!allowed.includes(operationId))
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_SCOPE_MISMATCH', `${record.decisionRef}:${operationId}`);
  if (record.authority === 'IMPLEMENTATION_AGENT' && allowed.length !== 1) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_IMPLEMENTATION_SCOPE_NOT_SINGLE', record.decisionRef);
  }
  if (record.from !== from.max || record.to !== to.max || record.to !== measuredMax) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_FROM_TO_MEASURED_MISMATCH', operationId);
  }
  if (
    !Array.isArray(record.history) ||
    record.history.length !== 1 ||
    JSON.stringify(record.history[0]) !== JSON.stringify(to.history.at(-1))
  ) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_HISTORY_MISMATCH', operationId);
  }
  if (
    to.history.at(-1)?.from !== from.max ||
    to.history.at(-1)?.to !== to.max ||
    to.history.at(-1)?.decisionRef !== record.decisionRef
  ) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_HISTORY_INCREMENT_MISMATCH', operationId);
  }
  if (record.businessFactsPreserved !== true)
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_BUSINESS_FACTS_REQUIRED', operationId);
  if (record.sharedMechanismsReused !== true)
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_MECHANISMS_REQUIRED', operationId);
  requireEvidenceTexts(
    record.businessFactsEvidence,
    'PERFORMANCE_REMEDIATION_EXCEPTION_BUSINESS_EVIDENCE_REQUIRED',
    `${operationId}.businessFactsEvidence`,
  );
  requireEvidenceTexts(
    record.sharedMechanismsEvidence,
    'PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_EVIDENCE_REQUIRED',
    `${operationId}.sharedMechanismsEvidence`,
  );
  requireText(
    record.rejectedAlternative,
    'PERFORMANCE_REMEDIATION_EXCEPTION_REJECTED_ALTERNATIVE_REQUIRED',
    operationId,
  );
  requireText(record.costComparison, 'PERFORMANCE_REMEDIATION_EXCEPTION_COST_COMPARISON_REQUIRED', operationId);
  requireText(record.narrowScope, 'PERFORMANCE_REMEDIATION_EXCEPTION_NARROW_SCOPE_REQUIRED', operationId);
  if (record.narrowScope !== operationId) fail('PERFORMANCE_REMEDIATION_EXCEPTION_NARROW_SCOPE_MISMATCH', operationId);
  return Object.freeze(record);
}

const fixedBudgetForMax = (max, history) =>
  Object.freeze({
    kind: 'FIXED',
    max,
    measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
    history,
  });

export function controlledBudgetExceptionForOperation({
  operationId,
  fromMax,
  toMax,
  measuredMax,
  records = CONTROLLED_BUDGET_EXCEPTION_RECORDS,
} = {}) {
  requireText(operationId, 'BUDGET_OPERATION_ID_INVALID', 'operationId');
  requireNonNegativeInteger(fromMax, 'PERFORMANCE_REMEDIATION_EXCEPTION_FROM_INVALID', operationId);
  requireNonNegativeInteger(toMax, 'PERFORMANCE_REMEDIATION_EXCEPTION_TO_INVALID', operationId);
  requireNonNegativeInteger(measuredMax, 'PERFORMANCE_REMEDIATION_EXCEPTION_MEASURED_MAX_INVALID', operationId);
  if (!Array.isArray(records)) fail('PERFORMANCE_REMEDIATION_EXCEPTION_SOURCE_INVALID', operationId);
  const matches = records.filter(record => record?.operationId === operationId);
  if (matches.length > 1) fail('PERFORMANCE_REMEDIATION_EXCEPTION_DUPLICATE', operationId);
  if (matches.length === 0) return null;
  const record = matches[0];
  const history = Array.isArray(record.history) ? record.history : [];
  const from = fixedBudgetForMax(fromMax, [{from: null, to: fromMax, reason: 'pre-CP-05 class ceiling'}]);
  const to = fixedBudgetForMax(toMax, history);
  validateRemediationBudgetChange({
    operationId,
    from,
    to,
    measuredMax,
    controlledException: record,
  });
  return Object.freeze(record);
}

/**
 * A fixed ceiling can only rise through the report-bound dual-admission
 * exception.  The generic `decisionRef` field is intentionally insufficient:
 * it must resolve to this operation and carry both correctness and reuse
 * proofs, so it cannot become a blanket performance escape hatch.
 */
export function validateRemediationBudgetChange({operationId, from, to, measuredMax, controlledException} = {}) {
  validateDatabaseOperationBudget(from, {operationId});
  validateDatabaseOperationBudget(to, {operationId});
  if (from.kind !== to.kind) fail('PERFORMANCE_REMEDIATION_BUDGET_KIND_CHANGE_FORBIDDEN', operationId);
  if (from.kind === 'FIXED' && to.max > from.max) {
    validateControlledBudgetException({
      operationId,
      from,
      to,
      measuredMax,
      exception: controlledException,
    });
  }
  return to;
}

export function validateLinearBudgetObservation({operationId, requestCardinality, databaseOperationCount} = {}) {
  if (operationId !== BATCH_OPERATION_ID) fail('BUDGET_LINEAR_OPERATION_NOT_ALLOWED', operationId || 'missing');
  requireNonNegativeInteger(requestCardinality, 'BUDGET_REQUEST_CARDINALITY_INVALID', 'requestCardinality');
  if (requestCardinality < 1 || requestCardinality > 100)
    fail('BUDGET_REQUEST_CARDINALITY_OUT_OF_RANGE', `${requestCardinality}`);
  requireNonNegativeInteger(
    databaseOperationCount,
    'BUDGET_DATABASE_OPERATION_COUNT_INVALID',
    'databaseOperationCount',
  );
  const maxAllowed =
    LINEAR_REQUEST_CARDINALITY_BUDGET.base + LINEAR_REQUEST_CARDINALITY_BUDGET.perItem * requestCardinality;
  if (databaseOperationCount > maxAllowed)
    fail('BUDGET_LINEAR_LIMIT_EXCEEDED', `${databaseOperationCount}>${maxAllowed}`);
  return Object.freeze({requestCardinality, databaseOperationCount, maxAllowed});
}

export function batchCardinalityEvidence(observations = []) {
  const observedCardinalities = [...new Set(observations.map(observation => observation.requestCardinality))].sort(
    (left, right) => left - right,
  );
  const missingCardinalities = REQUIRED_BATCH_CARDINALITIES.filter(
    cardinality => !observedCardinalities.includes(cardinality),
  );
  const unexpectedCardinalities = observedCardinalities.filter(
    cardinality => !REQUIRED_BATCH_CARDINALITIES.includes(cardinality),
  );
  return Object.freeze({
    observedCardinalities: Object.freeze(observedCardinalities),
    missingCardinalities: Object.freeze(missingCardinalities),
    unexpectedCardinalities: Object.freeze(unexpectedCardinalities),
    valid: missingCardinalities.length === 0 && unexpectedCardinalities.length === 0,
  });
}

export function validateThreeRunMaxInputs({operationIds, runs, expectedCount = EXPECTED_OPERATION_COUNT} = {}) {
  const expectedOperationIds = validateOperationExactSet(operationIds, {expectedCount});
  if (!Array.isArray(runs) || runs.length !== 3) fail('BUDGET_THREE_RUNS_REQUIRED', `${runs?.length ?? 'invalid'}`);
  const seenRunIds = new Set();
  const normalizedRuns = runs.map((run, runIndex) => {
    requirePlainObject(run, 'BUDGET_RUN_INVALID', `runs[${runIndex}]`);
    requireText(run.runId, 'BUDGET_RUN_ID_INVALID', `runs[${runIndex}].runId`);
    if (seenRunIds.has(run.runId)) fail('BUDGET_RUN_DUPLICATE', run.runId);
    seenRunIds.add(run.runId);
    if (!Array.isArray(run.operations)) fail('BUDGET_RUN_OPERATIONS_INVALID', run.runId);
    const ids = run.operations.map((operation, operationIndex) => {
      requirePlainObject(operation, 'BUDGET_RUN_OPERATION_INVALID', `${run.runId}.operations[${operationIndex}]`);
      requireText(
        operation.operationId,
        'BUDGET_OPERATION_ID_INVALID',
        `${run.runId}.operations[${operationIndex}].operationId`,
      );
      requireNonNegativeInteger(
        operation.maxDatabaseOperationCount,
        'BUDGET_RUN_MAX_DATABASE_OPERATION_COUNT_INVALID',
        `${run.runId}:${operation.operationId}`,
      );
      return operation.operationId;
    });
    validateOperationExactSet(ids, {expectedOperationIds, expectedCount});
    const byId = new Map(run.operations.map(operation => [operation.operationId, operation]));
    return Object.freeze({
      runId: run.runId,
      operations: Object.freeze(
        expectedOperationIds.map(operationId =>
          Object.freeze({
            operationId,
            maxDatabaseOperationCount: byId.get(operationId).maxDatabaseOperationCount,
          }),
        ),
      ),
    });
  });
  const maxByOperation = Object.fromEntries(
    expectedOperationIds.map(operationId => [
      operationId,
      Math.max(
        ...normalizedRuns.map(
          run => run.operations.find(operation => operation.operationId === operationId).maxDatabaseOperationCount,
        ),
      ),
    ]),
  );
  return Object.freeze({
    expectedOperations: EXPECTED_OPERATION_COUNT,
    runCount: 3,
    runs: Object.freeze(normalizedRuns),
    maxByOperation: Object.freeze(maxByOperation),
  });
}

function cp05OperationMaxInputs(report, operationIds, expectedCount = operationIds.length) {
  if (report.measurement.runCount === 1) {
    const run = report.source.runs[0];
    const maxByOperation = Object.fromEntries(
      report.operations.map(operation => {
        const max = operation.runs[0]?.databaseOperationCount?.max;
        requireNonNegativeInteger(max, 'BUDGET_RUN_MAX_DATABASE_OPERATION_COUNT_INVALID', operation.operationId);
        return [operation.operationId, max];
      }),
    );
    return Object.freeze({
      expectedOperations: EXPECTED_OPERATION_COUNT,
      runCount: 1,
      runs: Object.freeze([
        {
          runId: run.runId,
          operations: Object.freeze(
            operationIds.map(operationId =>
              Object.freeze({
                operationId,
                maxDatabaseOperationCount: maxByOperation[operationId],
              }),
            ),
          ),
        },
      ]),
      maxByOperation: Object.freeze(maxByOperation),
    });
  }
  const selectedOperationIds = new Set(operationIds);
  const runs = report.source.runs.map((run, runIndex) => ({
    runId: run.runId,
    operations: report.operations
      .filter(operation => selectedOperationIds.has(operation.operationId))
      .map(operation => ({
        operationId: operation.operationId,
        maxDatabaseOperationCount: operation.runs[runIndex]?.databaseOperationCount?.max,
      })),
  }));
  return validateThreeRunMaxInputs({operationIds, runs, expectedCount});
}

function validateOperationSetEvidence(operationSet, context, expectedCount = EXPECTED_OPERATION_COUNT) {
  requirePlainObject(operationSet, 'BUDGET_CP05_EXACT_SET_INVALID', context);
  if (
    operationSet.expected !== expectedCount ||
    operationSet.observed !== expectedCount ||
    !Array.isArray(operationSet.missing) ||
    operationSet.missing.length ||
    !Array.isArray(operationSet.extra) ||
    operationSet.extra.length ||
    !Array.isArray(operationSet.drift) ||
    operationSet.drift.length
  ) {
    fail('BUDGET_CP05_EXACT_SET_NOT_CLOSED', context);
  }
}

function validateExactSetEvidence(exactSet, context) {
  if (!Array.isArray(exactSet) || exactSet.length !== 3) fail('BUDGET_CP05_EXACT_SET_RUN_COUNT_INVALID', context);
  for (const [index, operationSet] of exactSet.entries())
    validateOperationSetEvidence(operationSet, `${context}[${index}]`);
}

export function validateCp05CalibrationReport(report) {
  requirePlainObject(report, 'BUDGET_CP05_REPORT_INVALID', 'report');
  if (report.kind !== 'backend-performance-cp05-current-tree-reclassification' || report.schemaVersion !== 1) {
    fail('BUDGET_CP05_REPORT_KIND_INVALID');
  }
  if (report.business !== 'PASS' || report.cleanup !== 'PASS') fail('BUDGET_CP05_BUSINESS_OR_CLEANUP_NOT_PASS');
  const reportBudget = requirePlainObject(report.budget, 'BUDGET_CP05_BUDGET_SECTION_INVALID', 'report.budget');
  if (reportBudget.generated !== false) fail('BUDGET_CP05_REPORT_ALREADY_GENERATED');
  requireNonNegativeInteger(reportBudget.readyCount, 'BUDGET_CP05_READY_COUNT_INVALID', 'report.budget.readyCount');
  requireNonNegativeInteger(
    reportBudget.blockedCount,
    'BUDGET_CP05_BLOCKED_COUNT_INVALID',
    'report.budget.blockedCount',
  );
  for (const field of ['activation', 'status', 'reason']) {
    const value = reportBudget[field];
    if (typeof value === 'string' && placeholderToken(value))
      fail('BUDGET_PLACEHOLDER_REJECTED', `report.budget.${field}`);
  }
  const measurement = report.measurement;
  requirePlainObject(measurement, 'BUDGET_CP05_MEASUREMENT_INVALID', 'report.measurement');
  const currentRunAuthority =
    measurement.runCount === 1 &&
    measurement.classificationRule === 'CURRENT_MANAGED_ACCEPTANCE_RUN_MAX;AVERAGE_NOT_USED' &&
    report.budget?.currentRunAuthorityDecisionRef === CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF &&
    report.source?.mode === 'CURRENT_MANAGED_ACCEPTANCE_RESULT';
  if (measurement.runCount === 3) {
    requireText(
      reportBudget.baselineDecisionRef,
      'BUDGET_CP05_BASELINE_DECISION_REF_REQUIRED',
      'report.budget.baselineDecisionRef',
    );
  }
  const reportExpectedCount = measurement.expectedOperations;
  if (
    !Number.isInteger(reportExpectedCount) ||
    reportExpectedCount < 1 ||
    !(measurement.runCount === 3 || currentRunAuthority) ||
    !(measurement.classificationRule === 'MAX_PER_OPERATION_ACROSS_THREE_RUNS;AVERAGE_NOT_USED' || currentRunAuthority)
  ) {
    fail('BUDGET_CP05_MEASUREMENT_SHAPE_INVALID');
  }
  if (!Array.isArray(measurement.exactSet) || measurement.exactSet.length !== measurement.runCount) {
    fail('BUDGET_CP05_EXACT_SET_RUN_COUNT_INVALID', 'report.measurement.exactSet');
  }
  for (const [index, operationSet] of measurement.exactSet.entries()) {
    validateOperationSetEvidence(operationSet, `report.measurement.exactSet[${index}]`, reportExpectedCount);
  }
  const classificationCounts = measurement.classificationCounts;
  requirePlainObject(
    classificationCounts,
    'BUDGET_CP05_CLASSIFICATION_INVALID',
    'report.measurement.classificationCounts',
  );
  for (const category of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5']) {
    requireNonNegativeInteger(
      classificationCounts[category],
      'BUDGET_CP05_CLASSIFICATION_COUNT_INVALID',
      `report.measurement.classificationCounts.${category}`,
    );
  }
  if (
    classificationCounts.P0 !== 0 ||
    ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'].reduce((sum, category) => sum + classificationCounts[category], 0) !==
      reportExpectedCount
  ) {
    fail('BUDGET_CP05_CLASSIFICATION_NOT_CLOSED');
  }
  if (!Array.isArray(report.source?.runs) || report.source.runs.length !== measurement.runCount) {
    fail('BUDGET_CP05_SOURCE_RUN_COUNT_INVALID');
  }
  for (const [index, run] of report.source.runs.entries()) {
    const validCurrentProgramResult =
      currentRunAuthority &&
      run.currentProgramResult === true &&
      run.managedRunStatus === 'FAIL' &&
      String(run.firstFailure ?? '').startsWith('PERFORMANCE_OPERATION_BUDGET_EXCEEDED:') &&
      run.managedMeasurementEvidence?.status === 'NOT_RUN' &&
      run.evidenceArchive?.status === 'PASS';
    if (
      run.testExecution?.status !== 'PASS' ||
      run.measurementEvidence?.status !== 'PASS' ||
      run.cleanup?.status !== 'PASS' ||
      (currentRunAuthority && !validCurrentProgramResult)
    ) {
      fail('BUDGET_CP05_RUN_NOT_PASS', `${index}`);
    }
    validateOperationSetEvidence(run.operationSet, `report.source.runs[${index}].operationSet`, reportExpectedCount);
  }
  if (!Array.isArray(report.operations)) fail('BUDGET_CP05_OPERATIONS_INVALID');
  const operationIds = report.operations.map((operation, index) => {
    requirePlainObject(operation, 'BUDGET_CP05_OPERATION_INVALID', `report.operations[${index}]`);
    requireText(operation.operationId, 'BUDGET_OPERATION_ID_INVALID', `report.operations[${index}].operationId`);
    return operation.operationId;
  });
  validateOperationExactSet(operationIds, {expectedCount: reportExpectedCount});
  if (operationIds.length !== reportExpectedCount)
    fail('BUDGET_CP05_OPERATION_COUNT_MISMATCH', `${operationIds.length}:${reportExpectedCount}`);
  const maxInputs = cp05OperationMaxInputs(report, operationIds, reportExpectedCount);
  for (const operation of report.operations) {
    if (operation.maxDatabaseOperationCount !== maxInputs.maxByOperation[operation.operationId]) {
      fail('BUDGET_CP05_MAX_NOT_REDUCED_FROM_MEASURED_RUNS', operation.operationId);
    }
  }
  if (!currentRunAuthority) {
    const batchOperation = report.operations.find(operation => operation.operationId === BATCH_OPERATION_ID);
    const observations = batchOperation?.linearBudgetObservations;
    if (!Array.isArray(observations)) fail('BUDGET_CP05_BATCH_CARDINALITY_EVIDENCE_INVALID', 'missing');
    const validatedObservations = observations.map((observation, index) => {
      try {
        return validateLinearBudgetObservation({
          operationId: BATCH_OPERATION_ID,
          requestCardinality: observation?.requestCardinality,
          databaseOperationCount: observation?.databaseOperationCount,
        });
      } catch (error) {
        fail('BUDGET_CP05_BATCH_CARDINALITY_EVIDENCE_INVALID', `${index}:${error.code || error.message}`);
      }
    });
    const evidence = batchCardinalityEvidence(validatedObservations);
    if (!evidence.valid) {
      fail(
        'BUDGET_CP05_BATCH_CARDINALITY_EVIDENCE_INVALID',
        `missing=${evidence.missingCardinalities.join(',') || 'none'}:unexpected=${evidence.unexpectedCardinalities.join(',') || 'none'}`,
      );
    }
  }
  return Object.freeze({report, operationIds: Object.freeze(operationIds), maxInputs});
}

export function assertCp05ReadyForBudget(report) {
  const validated = validateCp05CalibrationReport(report);
  if (report.budget.blockedCount !== 0) fail('BUDGET_NOT_READY_CP05_BLOCKED', `${report.budget.blockedCount}`);
  for (const operation of report.operations) {
    if (operation.budgetReadiness?.status !== 'READY') fail('BUDGET_NOT_READY_OPERATION', operation.operationId);
  }
  return validated;
}

const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableValue(value[key])]),
    );
  return value;
};

const digest = value =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');

const reportDigestPayload = report => {
  const {generatedAt: _generatedAt, replayIdentity, ...payload} = report;
  const {contentDigest: _contentDigest, ...replayIdentityPayload} = replayIdentity ?? {};
  return {...payload, replayIdentity: replayIdentityPayload};
};

export const calibrationReportDigest = report => digest(reportDigestPayload(report));

/**
 * The CP-05 report is the only build-time budget input.  It is intentionally
 * read here rather than copied into edge/catalog sources, and its digest is
 * emitted with both projections for the acceptance verifier to compare.
 */
export function readCp05CalibrationReport({
  root,
  relativePath = CP05_CALIBRATION_REPORT_PATH,
  read = fs.readFileSync,
} = {}) {
  if (typeof root !== 'string' || root.trim() === '') fail('BUDGET_CP05_REPORT_ROOT_REQUIRED');
  if (relativePath !== CP05_CALIBRATION_REPORT_PATH) fail('BUDGET_CP05_REPORT_PATH_INVALID', relativePath);
  let report;
  try {
    report = JSON.parse(read(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    fail('BUDGET_CP05_REPORT_REQUIRED', error.code === 'ENOENT' ? relativePath : 'invalid-json');
  }
  requirePlainObject(report.replayIdentity, 'BUDGET_CP05_REPLAY_IDENTITY_INVALID', 'report.replayIdentity');
  requireText(
    report.replayIdentity.contentDigest,
    'BUDGET_CP05_REPLAY_DIGEST_INVALID',
    'report.replayIdentity.contentDigest',
  );
  const actualDigest = calibrationReportDigest(report);
  if (report.replayIdentity.contentDigest !== actualDigest) fail('BUDGET_CP05_REPLAY_DIGEST_MISMATCH');
  const validated = assertCp05ReadyForBudget(report);
  return Object.freeze({
    report: validated.report,
    operationIds: validated.operationIds,
    digest: actualDigest,
  });
}

const projectedBudgetForOperation = (
  operation,
  measurement,
  controlledExceptionRecords = CONTROLLED_BUDGET_EXCEPTION_RECORDS,
) => {
  const readiness = operation.budgetReadiness;
  if (!readiness || readiness.status !== 'READY' || !readiness.databaseOperationBudget) {
    fail('BUDGET_NOT_READY_OPERATION', operation.operationId);
  }
  const candidate = readiness.databaseOperationBudget;
  if (candidate.kind === 'LINEAR_REQUEST_CARDINALITY') {
    if (operation.controlledBudgetException) {
      fail('PERFORMANCE_REMEDIATION_EXCEPTION_LINEAR_FORBIDDEN', operation.operationId);
    }
    return Object.freeze({
      ...LINEAR_REQUEST_CARDINALITY_BUDGET,
      measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
      history: [
        {
          from: null,
          to: LINEAR_REQUEST_CARDINALITY_BUDGET.base + LINEAR_REQUEST_CARDINALITY_BUDGET.perItem,
          reason: 'CP-05 calibrated linear shape',
        },
      ],
    });
  }
  if (candidate.kind !== 'FIXED') fail('BUDGET_CP05_CANDIDATE_KIND_INVALID', operation.operationId);
  requireNonNegativeInteger(candidate.max, 'BUDGET_CP05_CANDIDATE_MAX_INVALID', operation.operationId);
  const exception = operation.controlledBudgetException;
  if (!exception) {
    return Object.freeze({
      kind: 'FIXED',
      max: candidate.max,
      measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
      history: [
        {
          from: null,
          to: candidate.max,
          reason:
            measurement?.runCount === 1
              ? 'current managed acceptance program maximum'
              : 'CP-05 maximum database operation count across three runs',
        },
      ],
    });
  }
  const history = exception.history;
  if (!Array.isArray(history) || history.length !== 1)
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_HISTORY_MISMATCH', operation.operationId);
  const sourceException = controlledBudgetExceptionForOperation({
    operationId: operation.operationId,
    fromMax: exception.from,
    toMax: candidate.max,
    measuredMax: operation.maxDatabaseOperationCount,
    records: controlledExceptionRecords,
  });
  if (!sourceException) fail('PERFORMANCE_REMEDIATION_EXCEPTION_SOURCE_RECORD_REQUIRED', operation.operationId);
  if (JSON.stringify(stableValue(sourceException)) !== JSON.stringify(stableValue(exception))) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_SOURCE_RECORD_MISMATCH', operation.operationId);
  }
  const from = {
    kind: 'FIXED',
    max: exception.from,
    measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
    history: [{from: null, to: exception.from, reason: 'pre-CP-05 recorded ceiling'}],
  };
  const to = {
    kind: 'FIXED',
    max: candidate.max,
    measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
    history,
  };
  validateRemediationBudgetChange({
    operationId: operation.operationId,
    from,
    to,
    measuredMax: operation.maxDatabaseOperationCount,
    controlledException: sourceException,
  });
  return Object.freeze(to);
};

// This returns an in-memory projection only. The current generator operation
// list is the active identity source; CP-05 contributes measured ceilings and
// may contain historical identities that are no longer routable.
export function buildBudgetProjectionSubset({
  operations,
  calibrationReport,
  controlledExceptionRecords = CONTROLLED_BUDGET_EXCEPTION_RECORDS,
} = {}) {
  const calibration = assertCp05ReadyForBudget(calibrationReport);
  if (!Array.isArray(operations)) fail('BUDGET_SOURCE_OPERATIONS_INVALID');
  const operationIds = operations.map((operation, index) => {
    requirePlainObject(operation, 'BUDGET_SOURCE_OPERATION_INVALID', `operations[${index}]`);
    requireText(operation.operationId, 'BUDGET_OPERATION_ID_INVALID', `operations[${index}].operationId`);
    if (Object.hasOwn(operation, 'databaseOperationBudget'))
      fail('BUDGET_STATIC_SOURCE_RETIRED', operation.operationId);
    return operation.operationId;
  });
  if (new Set(operationIds).size !== operationIds.length) fail('BUDGET_OPERATION_DUPLICATE');
  const reportOperations = new Map(calibration.report.operations.map(operation => [operation.operationId, operation]));
  for (const operationId of operationIds) {
    if (!reportOperations.has(operationId)) fail('BUDGET_PROJECTION_OPERATION_MISSING', operationId);
  }
  const activeOperationIds = new Set(operationIds);
  for (const record of controlledExceptionRecords) {
    const operationId = record?.operationId;
    if (!activeOperationIds.has(operationId)) continue;
    const reportOperation = reportOperations.get(operationId);
    if (!reportOperation.controlledBudgetException) {
      fail('PERFORMANCE_REMEDIATION_EXCEPTION_REPORT_RECORD_REQUIRED', operationId);
    }
  }
  const registry = {
    operations: operations.map(operation => ({
      ...operation,
      databaseOperationBudget: projectedBudgetForOperation(
        reportOperations.get(operation.operationId),
        calibration.report.measurement,
        controlledExceptionRecords,
      ),
    })),
  };
  for (const operation of registry.operations) {
    const reportOperation = reportOperations.get(operation.operationId);
    if (
      operation.operationId !== BATCH_OPERATION_ID &&
      operation.databaseOperationBudget.max !== reportOperation.maxDatabaseOperationCount
    ) {
      fail('BUDGET_INITIAL_MAX_NOT_MEASURED_RUN_MAX', operation.operationId);
    }
  }
  return Object.freeze({
    expectedOperations: registry.operations.length,
    calibrationReportDigest: calibrationReportDigest(calibration.report),
    operations: Object.freeze(registry.operations.map(operation => Object.freeze(operation))),
  });
}

export function buildCp05CalibrationIdentityProjection({operations} = {}) {
  if (!Array.isArray(operations)) fail('BUDGET_SOURCE_OPERATIONS_INVALID');
  const seen = new Set();
  const identities = operations.map((operation, index) => {
    requirePlainObject(operation, 'BUDGET_SOURCE_OPERATION_INVALID', `operations[${index}]`);
    const {databaseOperationBudget: _retired, ...identity} = operation;
    requireText(identity.operationId, 'BUDGET_OPERATION_ID_INVALID', `operations[${index}].operationId`);
    if (seen.has(identity.operationId)) fail('BUDGET_OPERATION_DUPLICATE', identity.operationId);
    seen.add(identity.operationId);
    return Object.freeze(identity);
  });
  return Object.freeze({
    expectedOperations: identities.length,
    calibrationReportDigest: CP05_CALIBRATION_BOOTSTRAP_DIGEST,
    operations: Object.freeze(identities),
  });
}

export function buildBudgetProjection({
  operations,
  calibrationReport,
  controlledExceptionRecords = CONTROLLED_BUDGET_EXCEPTION_RECORDS,
} = {}) {
  const projection = buildBudgetProjectionSubset({operations, calibrationReport, controlledExceptionRecords});
  const activeOperationIds = operations.map(operation => operation.operationId);
  validateOperationExactSet(activeOperationIds);
  validateOperationExactSet(
    projection.operations.map(operation => operation.operationId),
    {expectedOperationIds: activeOperationIds},
  );
  validateBudgetRegistry({operations: projection.operations}, {expectedOperationIds: activeOperationIds});
  return Object.freeze({...projection, expectedOperations: EXPECTED_OPERATION_COUNT});
}

export function notReady(reason = 'CP05_MEASUREMENT_REQUIRED') {
  return Object.freeze({
    status: 'NOT_READY',
    reason,
    stop: true,
    generated: false,
    activated: false,
  });
}

function emitNotReady(reason = 'CP05_MEASUREMENT_REQUIRED') {
  const result = notReady(reason);
  process.stdout.write(
    [
      'BACKEND_PERFORMANCE_BUDGET=NOT_READY',
      `REASON=${result.reason}`,
      'GENERATED=false',
      'ACTIVATED=false',
      'STOP=NO_BUDGET_REGISTRY_BEFORE_CP05',
    ].join('\n') + '\n',
  );
  process.exitCode = 2;
}

function expectFailure(action, code) {
  try {
    action();
    fail('BUDGET_SELF_TEST_RED_NOT_DETECTED', code);
  } catch (error) {
    if (error.code !== code) throw error;
  }
}

function selfTest() {
  const operationIds = [
    BATCH_OPERATION_ID,
    ...Array.from({length: EXPECTED_OPERATION_COUNT - 1}, (_, index) => `operation-${index + 1}`),
  ];
  const fixed = max => ({
    kind: 'FIXED',
    max,
    measurementScenarioIds: ['performance.normal-path'],
    history: [{from: null, to: max, reason: 'initial calibrated ceiling'}],
  });
  const linear = {
    ...LINEAR_REQUEST_CARDINALITY_BUDGET,
    measurementScenarioIds: ['performance.normal-path'],
    history: [{from: null, to: 20, reason: 'initial calibrated ceiling'}],
  };
  const operations = operationIds.map(operationId => ({
    operationId,
    databaseOperationBudget: operationId === BATCH_OPERATION_ID ? linear : fixed(4),
  }));
  validateBudgetRegistry({operations}, {expectedOperationIds: operationIds});
  expectFailure(
    () => validateDatabaseOperationBudget({...fixed(4), max: null}, {operationId: 'operation-1'}),
    'BUDGET_NULL_REJECTED',
  );
  expectFailure(
    () => validateDatabaseOperationBudget({...fixed(4), max: 'UNLIMITED'}, {operationId: 'operation-1'}),
    'BUDGET_PLACEHOLDER_REJECTED',
  );
  expectFailure(
    () =>
      validateDatabaseOperationBudget(
        {...fixed(4), history: [{from: null, to: 4, reason: 'CALIBRATION_PENDING'}]},
        {operationId: 'operation-1'},
      ),
    'BUDGET_PLACEHOLDER_REJECTED',
  );
  expectFailure(
    () => validateDatabaseOperationBudget({...linear, max: 20}, {operationId: BATCH_OPERATION_ID}),
    'BUDGET_LINEAR_FIXED_FIELDS_MIXED',
  );
  expectFailure(
    () =>
      validateDatabaseOperationBudget(
        {
          ...LINEAR_REQUEST_CARDINALITY_BUDGET,
          measurementScenarioIds: ['performance.normal-path'],
          history: [{from: null, to: 20, reason: 'initial calibrated ceiling'}],
        },
        {operationId: 'operation-1'},
      ),
    'BUDGET_LINEAR_OPERATION_NOT_ALLOWED',
  );
  expectFailure(
    () =>
      validateLinearBudgetObservation({
        operationId: BATCH_OPERATION_ID,
        requestCardinality: 20,
        databaseOperationCount: 116,
      }),
    'BUDGET_LINEAR_LIMIT_EXCEEDED',
  );
  validateLinearBudgetObservation({
    operationId: BATCH_OPERATION_ID,
    requestCardinality: 100,
    databaseOperationCount: 515,
  });
  expectFailure(
    () => validateBudgetChange({operationId: 'operation-1', from: fixed(4), to: fixed(5)}),
    'BUDGET_INCREASE_DECISION_REF_REQUIRED',
  );
  validateBudgetChange({operationId: 'operation-1', from: fixed(4), to: fixed(3)});
  const controlledOperationId = 'reorderOperationsCatalogDictionaryEntry';
  const controlledFrom = fixed(4);
  const controlledTo = {
    ...fixed(5),
    history: [
      {
        from: 4,
        to: 5,
        reason: 'measured correctness closure',
        decisionRef: 'DEXTER-2026-08-26-REORDER_DICTIONARY_BUDGET',
      },
    ],
  };
  const controlledException = {
    operationId: controlledOperationId,
    decisionRef: 'DEXTER-2026-08-26-REORDER_DICTIONARY_BUDGET',
    authority: 'DEXTER',
    from: 4,
    to: 5,
    history: controlledTo.history,
    businessFactsPreserved: true,
    businessFactsEvidence: ['owner:catalog', 'event:calibration:reorderOperationsCatalogDictionaryEntry'],
    sharedMechanismsReused: true,
    sharedMechanismsEvidence: ['source:shared-owner-command'],
    rejectedAlternative: 'would remove authoritative reference checks',
    costComparison: 'safety review cost exceeds one avoided query',
    narrowScope: controlledOperationId,
  };
  expectFailure(
    () =>
      validateRemediationBudgetChange({
        operationId: controlledOperationId,
        from: controlledFrom,
        to: controlledTo,
        measuredMax: 5,
      }),
    'PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_REQUIRED',
  );
  validateRemediationBudgetChange({
    operationId: controlledOperationId,
    from: controlledFrom,
    to: controlledTo,
    measuredMax: 5,
    controlledException,
  });
  const groupedSelfDecision = {
    ...controlledException,
    operationId: 'increaseOperationsInventoryTarget',
    decisionRef: 'DEXTER-2026-08-26-INVENTORY_QUANTITY_WRITE_BUDGET',
    authority: 'IMPLEMENTATION_AGENT',
    narrowScope: 'increaseOperationsInventoryTarget',
  };
  expectFailure(
    () =>
      validateRemediationBudgetChange({
        operationId: 'increaseOperationsInventoryTarget',
        from: fixed(4),
        to: {
          ...fixed(5),
          history: [
            {from: 4, to: 5, reason: 'measured correctness closure', decisionRef: groupedSelfDecision.decisionRef},
          ],
        },
        measuredMax: 5,
        controlledException: {
          ...groupedSelfDecision,
          from: 4,
          to: 5,
          history: [
            {from: 4, to: 5, reason: 'measured correctness closure', decisionRef: groupedSelfDecision.decisionRef},
          ],
        },
      }),
    'PERFORMANCE_REMEDIATION_EXCEPTION_IMPLEMENTATION_SCOPE_NOT_SINGLE',
  );
  validateRemediationBudgetChange({
    operationId: 'increaseOperationsInventoryTarget',
    from: fixed(4),
    to: {
      ...fixed(5),
      history: [{from: 4, to: 5, reason: 'measured correctness closure', decisionRef: groupedSelfDecision.decisionRef}],
    },
    measuredMax: 5,
    controlledException: {
      ...groupedSelfDecision,
      authority: 'DEXTER',
      from: 4,
      to: 5,
      history: [{from: 4, to: 5, reason: 'measured correctness closure', decisionRef: groupedSelfDecision.decisionRef}],
    },
  });
  expectFailure(
    () =>
      validateRemediationBudgetChange({
        operationId: controlledOperationId,
        from: controlledFrom,
        to: controlledTo,
        measuredMax: 5,
        controlledException: {...controlledException, sharedMechanismsReused: false},
      }),
    'PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_MECHANISMS_REQUIRED',
  );
  const runs = [0, 1, 2].map(runIndex => ({
    runId: `run-${runIndex + 1}`,
    operations: operationIds.map(operationId => ({operationId, maxDatabaseOperationCount: runIndex + 4})),
  }));
  const maxInputs = validateThreeRunMaxInputs({operationIds, runs});
  if (maxInputs.maxByOperation['operation-1'] !== 6) fail('BUDGET_SELF_TEST_MAX_NOT_THREE_RUN_MAX');
  expectFailure(() => validateThreeRunMaxInputs({operationIds, runs: runs.slice(0, 2)}), 'BUDGET_THREE_RUNS_REQUIRED');
  expectFailure(() => validateOperationExactSet(operationIds.slice(0, -1)), 'BUDGET_OPERATION_COUNT_INVALID');
  process.stdout.write(
    [
      'BUDGET_SCHEMA=PASS',
      'RED_NULL=PASS',
      'RED_PLACEHOLDER=PASS',
      'RED_LINEAR_MIX=PASS',
      'RED_LINEAR_UNIQUE_OPERATION=PASS',
      'RED_LINEAR_LIMIT=PASS',
      'RED_INCREASE_WITHOUT_DECISION_REF=PASS',
      'RED_UNDECIDED_FIXED_INCREASE=PASS',
      'HISTORICAL_GROUPED_DEXTER_GREEN=PASS',
      'CONTROLLED_EXCEPTION_DUAL_ADMISSION=PASS',
      'RED_OPERATION_EXACT_SET=PASS',
      'RED_THREE_RUN_INPUT_COUNT=PASS',
      'BUDGET_SELF_TEST=PASS',
    ].join('\n') + '\n',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--self-test') {
      selfTest();
    } else if (args.length === 0 || (args.length === 1 && args[0] === '--check')) {
      emitNotReady();
    } else if (args.includes('--write')) {
      emitNotReady();
    } else {
      fail('BUDGET_ARGUMENT_INVALID', '--self-test|--check|--write');
    }
  } catch (error) {
    if (error.code?.startsWith('BUDGET_NOT_READY') || error.code?.startsWith('BUDGET_CP05')) {
      emitNotReady(error.code);
    } else {
      process.stderr.write(`BACKEND_PERFORMANCE_BUDGET=FAIL\nREASON=${error.code || error.message}\n`);
      process.exitCode = 1;
    }
  }
}
