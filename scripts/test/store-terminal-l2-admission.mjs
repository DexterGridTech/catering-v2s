import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createL2SuiteAdmissionStrategy} from './l2-suite-admission.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const storeTerminalL2AdmissionStrategy = createL2SuiteAdmissionStrategy({
  suite: 'store-terminal',
  policyPath: path.join(root, 'contracts/policy/store-terminal-l2-admission.json'),
  policyKind: 'store-terminal-l2-script-admission',
  caseSourcePaths: [
    ['contracts/policy/store-terminal-l2-activation-candidate.json', 'candidate', 'approvedCaseIds'],
    ['contracts/policy/store-terminal-l2-case-blueprint.json', 'blueprint', 'screens[].caseId'],
    ['contracts/policy/store-terminal-l2-scenarios.json', 'scenarios', 'scenarios[].cases[].caseId'],
    ['contracts/policy/store-terminal-l2-timing-budget.json', 'timing', 'cases[].caseId'],
    ['contracts/policy/store-terminal-l2-fixture.json', 'fixture', 'caseFixtures[].caseId'],
  ],
});

export {storeTerminalL2AdmissionStrategy};
export const STORE_TERMINAL_L2_ADMISSION_POLICY_PATH = storeTerminalL2AdmissionStrategy.policyPath;
