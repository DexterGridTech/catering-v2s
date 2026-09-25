import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createL2SuiteAdmissionStrategy} from './l2-suite-admission.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const salesMenuL2AdmissionStrategy = createL2SuiteAdmissionStrategy({
  suite: 'sales-menu',
  policyPath: path.join(root, 'contracts/policy/sales-menu-l2-admission.json'),
  policyKind: 'sales-menu-l2-script-admission',
  caseSourcePaths: [
    ['contracts/policy/sales-menu-l2-activation-candidate.json', 'candidate', 'approvedCaseIds'],
    ['contracts/policy/sales-menu-l2-case-blueprint.json', 'blueprint', 'scenarios[].cases[].caseId'],
    ['contracts/policy/sales-menu-l2-scenarios.json', 'scenarios', 'scenarios[].cases[].caseId'],
    ['contracts/policy/sales-menu-l2-timing-budget.json', 'timing', 'cases[].caseId'],
  ],
});

export const SALES_MENU_L2_ADMISSION_POLICY_PATH = salesMenuL2AdmissionStrategy.policyPath;
