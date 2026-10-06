import {fireEvent, render} from '@testing-library/react-native';
import {createElement} from 'react';
import {Text} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import {SystemFailureNotice, type SystemFailureNoticeProps} from '../src/index';
import {renderTestIds} from '../src/foundations/renderTestIds';

const noticeId = renderTestIds.node('sample.system-notice');
const defaultNoticeId = renderTestIds.node('sample.default-notice');

const forbiddenRawNoticeProps: SystemFailureNoticeProps = {
  testIDPrefix: noticeId,
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
        testIDPrefix={noticeId}
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

    const root = renderer.getByTestId(noticeId);
    const card = renderer.getByTestId(renderTestIds.child(noticeId, 'card'));
    const actions = renderer.getByTestId(renderTestIds.child(noticeId, 'actions'));
    const dismiss = renderer.getByTestId(renderTestIds.child(noticeId, 'dismiss'));

    expect(root?.props.style).toEqual({padding: 16, alignItems: 'stretch'});
    expect(card?.props.style).toEqual([{width: '100%'}, {maxHeight: '100%', minHeight: 0, overflow: 'hidden'}]);
    expect(actions?.props.className).toBe('w-full items-center gap-3');
    expect(dismiss?.props.style).toEqual([{width: '100%'}, undefined]);
    expect(renderer.getByTestId(renderTestIds.child(noticeId, 'message'))).toBeDefined();
    await fireEvent.press(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });

  it('keeps the default copy, alert role, children slot and dismiss label', async () => {
    const onDismiss = vi.fn();
    const renderer = await render(
      <SystemFailureNotice testIDPrefix={defaultNoticeId} onDismiss={onDismiss} dismissLabel="关闭">
        {createElement(
          'notice-child',
          {testID: renderTestIds.child(defaultNoticeId, 'child')},
          createElement(Text, null, '补充说明'),
        )}
      </SystemFailureNotice>,
    );

    expect(renderer.getByText('系统提示')).toBeDefined();
    expect(renderer.getByTestId(renderTestIds.child(defaultNoticeId, 'message')).props.role).toBe('alert');
    expect(renderer.getByTestId(renderTestIds.child(defaultNoticeId, 'child'))).toBeDefined();
    const dismiss = renderer.getByTestId(renderTestIds.child(defaultNoticeId, 'dismiss'));
    expect(dismiss?.props.accessibilityLabel).toBe('关闭系统提示');
    expect(renderer.getByText('关闭')).toBeDefined();
    await fireEvent.press(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });
});
