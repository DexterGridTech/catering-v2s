import {afterAll, afterEach, beforeAll, expect} from 'vitest';
import {resetNativeTestRefFactory} from './rntl-native-test-host';

type RntlTestGlobals = typeof globalThis & {
  expect?: typeof expect;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const testGlobals = globalThis as RntlTestGlobals;
const previousActEnvironment = testGlobals.IS_REACT_ACT_ENVIRONMENT;
const previousAutoCleanup = process.env.RNTL_SKIP_AUTO_CLEANUP;
const previousRequestAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');

if (typeof globalThis.requestAnimationFrame !== 'function') {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (callback: (timestamp: number) => void) => {
      callback(Date.now());
      return 0;
    },
  });
}

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
  if (previousRequestAnimationFrame === undefined) {
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
  } else {
    Object.defineProperty(globalThis, 'requestAnimationFrame', previousRequestAnimationFrame);
  }
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
