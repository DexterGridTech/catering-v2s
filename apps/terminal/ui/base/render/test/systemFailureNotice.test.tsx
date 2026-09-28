import {fireEvent, render} from '@testing-library/react-native';
import {createElement} from 'react';
import {Text} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import {SystemFailureNotice, type SystemFailureNoticeProps} from '../src/index';

const forbiddenRawNoticeProps: SystemFailureNoticeProps = {
  testIDPrefix: 'sample.system-notice',
  onDismiss: () => undefined,
  // @ts-expect-error Base notice must not accept feature-specific raw operation fields.
  operation: 'login',
};
void forbiddenRawNoticeProps;

describe('SystemFailureNotice presentation contract', () => {
  it('preserves safe content and applies only the frozen layout profile', async () => {
    const onDismiss = vi.fn();
    const renderer = await render(
      <SystemFailureNotice
        testIDPrefix="sample.system-notice"
        onDismiss={onDismiss}
        title="系统提示"
        message="操作没有完成，请重试"
        presentation={{
          rootStyle: {padding: 16, alignItems: 'stretch'},
          cardStyle: {width: '100%'},
          actionsOrientation: 'column',
          dismissButtonStyle: {width: '100%'},
        }}
      />,
    );

    const root = renderer.getByTestId('sample.system-notice');
    const card = renderer.getByTestId('sample.system-notice:card');
    const actions = renderer.getByTestId('sample.system-notice:actions');
    const dismiss = renderer.getByTestId('sample.system-notice:dismiss');

    expect(root?.props.style).toEqual({padding: 16, alignItems: 'stretch'});
    expect(card?.props.style).toEqual([{width: '100%'}, {maxHeight: '100%', minHeight: 0, overflow: 'hidden'}]);
    expect(actions?.props.className).toBe('w-full items-center gap-3');
    expect(dismiss?.props.style).toEqual([{width: '100%'}, undefined]);
    expect(renderer.getByTestId('sample.system-notice:message')).toBeDefined();
    await fireEvent.press(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });

  it('keeps the default copy, alert role, children slot and dismiss label', async () => {
    const onDismiss = vi.fn();
    const renderer = await render(
      <SystemFailureNotice testIDPrefix="sample.default-notice" onDismiss={onDismiss} dismissLabel="关闭">
        {createElement('notice-child', {testID: 'sample.default-notice:child'}, createElement(Text, null, '补充说明'))}
      </SystemFailureNotice>,
    );

    expect(renderer.getByText('系统提示')).toBeDefined();
    expect(renderer.getByTestId('sample.default-notice:message').props.role).toBe('alert');
    expect(renderer.getByTestId('sample.default-notice:child')).toBeDefined();
    const dismiss = renderer.getByTestId('sample.default-notice:dismiss');
    expect(dismiss?.props.accessibilityLabel).toBe('关闭系统提示');
    expect(renderer.getByText('关闭')).toBeDefined();
    await fireEvent.press(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });
});
