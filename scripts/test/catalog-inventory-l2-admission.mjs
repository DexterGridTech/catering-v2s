import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createL2SuiteAdmissionStrategy} from './l2-suite-admission.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const catalogInventoryL2AdmissionStrategy = createL2SuiteAdmissionStrategy({
  suite: 'catalog-inventory',
  policyPath: path.join(root, 'contracts/policy/catalog-inventory-l2-admission.json'),
  policyKind: 'catalog-inventory-l2-script-admission',
  caseSourcePaths: [
    ['contracts/policy/catalog-inventory-l2-activation-candidate.json', 'candidate', 'approvedCaseIds'],
    ['contracts/policy/catalog-inventory-l2-case-blueprint.json', 'blueprint', 'scenarios[].cases[].caseId'],
    ['contracts/policy/catalog-inventory-l2-scenarios.json', 'scenarios', 'scenarios[].cases[].caseId'],
    ['contracts/policy/catalog-inventory-l2-timing-budget.json', 'timing', 'cases[].caseId'],
  ],
});

export const CATALOG_INVENTORY_L2_ADMISSION_POLICY_PATH = catalogInventoryL2AdmissionStrategy.policyPath;
