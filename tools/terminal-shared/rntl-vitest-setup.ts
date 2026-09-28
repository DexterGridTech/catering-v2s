import {afterAll, afterEach, beforeAll, expect} from 'vitest';
import {resetNativeTestRefFactory} from './rntl-native-test-host';

type RntlTestGlobals = typeof globalThis & {
  expect?: typeof expect;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const testGlobals = globalThis as RntlTestGlobals;
const previousActEnvironment = testGlobals.IS_REACT_ACT_ENVIRONMENT;
const previousAutoCleanup = process.env.RNTL_SKIP_AUTO_CLEANUP;

process.env.RNTL_SKIP_AUTO_CLEANUP = 'true';

testGlobals.expect = expect;
testGlobals.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  testGlobals.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  const {cleanup} = await import('@testing-library/react-native');
  await cleanup();
  resetNativeTestRefFactory();
});

afterAll(() => {
  if (previousAutoCleanup === undefined) {
    delete process.env.RNTL_SKIP_AUTO_CLEANUP;
  } else {
    process.env.RNTL_SKIP_AUTO_CLEANUP = previousAutoCleanup;
  }
  if (previousActEnvironment === undefined) {
    delete testGlobals.IS_REACT_ACT_ENVIRONMENT;
  } else {
    testGlobals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
