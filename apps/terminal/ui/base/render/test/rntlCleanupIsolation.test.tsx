import {createElement, useCallback, useState} from 'react';
import {View} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {describe, expect, it, vi} from 'vitest';

const RESIDUAL_TEST_ID = 'rntl-cleanup-isolation:previous-case';

describe('RNTL shared setup cleanup isolation', () => {
  it('mounts a tree that must not leak into the following test case', async () => {
    await render(createElement(View, {testID: RESIDUAL_TEST_ID}));
    expect(screen.getByTestId(RESIDUAL_TEST_ID)).toBeDefined();
  });

  it('starts the next case without the previous test tree', () => {
    expect(() => screen.queryByTestId(RESIDUAL_TEST_ID)).toThrow(/render.*has not been called/);
  });

  it('attaches host refs in the commit phase instead of updating a parent while rendering', async () => {
    const errors: string[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.map(String).join(' '));
    });
    const RefUpdatingParent = () => {
      const [, setAttached] = useState(false);
      const ref = useCallback(() => setAttached(true), []);
      return createElement(View, {ref});
    };

    try {
      await render(createElement(RefUpdatingParent));
      expect(errors.join('\n')).not.toMatch(/Cannot update a component .* while rendering a different component/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
